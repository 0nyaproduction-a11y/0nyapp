-- PX01-B1: Play Together / 0chat database + RLS foundation.
--
-- Adds the minimum production-safe PostgreSQL schema and row-level security
-- for Play Together rooms, participants, private invites, and ordered 0chat
-- messages. This is additive only — no existing tables or migrations are
-- modified. APIs, realtime subscriptions, and access-grant logic are NOT
-- implemented here.
--
-- V1 room capacity: exactly 1 Host + maximum 1 Guest (max 2 participants).
-- Invite tokens are stored only as SHA-256 hashes — never plaintext.
-- 0chat access (Plus / Coin / Rewarded) is NOT implemented in this slice.

-- ---------------------------------------------------------------------------
-- Table 1: play_together_rooms
-- ---------------------------------------------------------------------------
-- Server-authoritative room lifecycle and playback snapshot.
-- host_user_id is the room creator; episode_id references the canonical
-- Micro-Drama episode being co-viewed (Short Films excluded from V1).
-- Playback play/pause is represented by playback_state, separate from
-- room lifecycle status.

create table if not exists public.play_together_rooms (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users (id) on delete cascade,
  episode_id uuid not null references public.episodes (id) on delete cascade,
  status text not null default 'waiting'
    check (status in ('waiting', 'active', 'waiting_for_access', 'ended', 'expired')),
  playback_state text not null default 'paused'
    check (playback_state in ('playing', 'paused')),
  host_position_ms integer not null default 0
    check (host_position_ms >= 0),
  playback_rate numeric(3,2) not null default 1.00
    check (playback_rate > 0),
  state_version bigint not null default 0
    check (state_version >= 0),
  state_server_time timestamptz not null default now(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  check (ended_at is null or ended_at >= created_at)
);

create index if not exists play_together_rooms_host_user_id_idx
  on public.play_together_rooms (host_user_id);

create index if not exists play_together_rooms_episode_id_idx
  on public.play_together_rooms (episode_id, created_at desc);

create index if not exists play_together_rooms_status_expires_at_idx
  on public.play_together_rooms (status, expires_at);

create index if not exists play_together_rooms_created_at_idx
  on public.play_together_rooms (created_at desc);

-- ---------------------------------------------------------------------------
-- Table 2: play_together_participants
-- ---------------------------------------------------------------------------
-- Room membership. Max 2 rows per V1 room enforced by database constraints:
--   UNIQUE(room_id, user_id) — same user cannot join twice
--   UNIQUE(room_id) WHERE role = 'host' — at most one Host
--   UNIQUE(room_id) WHERE role = 'guest' — at most one Guest
-- These three constraints together prevent a third participant row.

create table if not exists public.play_together_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.play_together_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('host', 'guest')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  connection_state text not null default 'connected'
    check (connection_state in ('connected', 'reconnecting', 'disconnected')),
  unique (room_id, user_id)
);

-- Enforce exactly 0..1 Host per room
create unique index if not exists play_together_participants_one_host_per_room_idx
  on public.play_together_participants (room_id)
  where role = 'host';

-- Enforce exactly 0..1 Guest per room
create unique index if not exists play_together_participants_one_guest_per_room_idx
  on public.play_together_participants (room_id)
  where role = 'guest';

create index if not exists play_together_participants_user_id_idx
  on public.play_together_participants (user_id);

create index if not exists play_together_participants_connection_state_idx
  on public.play_together_participants (room_id, connection_state);

-- ---------------------------------------------------------------------------
-- Helper: SECURITY DEFINER participant membership check
-- ---------------------------------------------------------------------------
-- Avoids recursive RLS when policies need to verify room membership.
-- search_path is explicitly restricted per repository convention.
-- Read-only: returns a boolean and exposes no privileged rows.
-- Created after play_together_participants so the table reference resolves
-- under check_function_bodies (default true).

create or replace function public.is_room_participant(
  p_room_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.play_together_participants
    where public.play_together_participants.room_id = p_room_id
      and public.play_together_participants.user_id = p_user_id
  );
$$;

revoke all on function public.is_room_participant(uuid, uuid) from public;
revoke all on function public.is_room_participant(uuid, uuid) from anon;
grant execute on function public.is_room_participant(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Rooms: RLS
-- ---------------------------------------------------------------------------

alter table public.play_together_rooms enable row level security;

-- Authenticated user may SELECT a room if they are the host or a participant.
-- No general client INSERT/UPDATE/DELETE — server API owns mutations.
drop policy if exists "Users can read rooms they belong to" on public.play_together_rooms;
create policy "Users can read rooms they belong to"
  on public.play_together_rooms
  for select
  to authenticated
  using (
    host_user_id = auth.uid()
    or public.is_room_participant(id, auth.uid())
  );

revoke all on public.play_together_rooms from anon;
grant select on public.play_together_rooms to authenticated;
grant all on public.play_together_rooms to service_role;

comment on table public.play_together_rooms is
  'Play Together room lifecycle and server-authoritative playback snapshot. V1: max 2 participants (1 Host + 1 Guest), Micro-Drama episodes only.';

-- ---------------------------------------------------------------------------
-- Participants: RLS
-- ---------------------------------------------------------------------------

alter table public.play_together_participants enable row level security;

-- Authenticated user may SELECT participant rows for rooms they belong to.
drop policy if exists "Users can read participants for their rooms" on public.play_together_participants;
create policy "Users can read participants for their rooms"
  on public.play_together_participants
  for select
  to authenticated
  using (
    public.is_room_participant(room_id, auth.uid())
  );

revoke all on public.play_together_participants from anon;
grant select on public.play_together_participants to authenticated;
grant all on public.play_together_participants to service_role;

comment on table public.play_together_participants is
  'Play Together room membership. V1 max-two participant model: exactly 1 Host + maximum 1 Guest per room.';

-- ---------------------------------------------------------------------------
-- Table 3: play_together_invites
-- ---------------------------------------------------------------------------
-- Private invite tokens for room joining. ONLY the SHA-256 hash of the token
-- is stored — plaintext invite secrets are never persisted.
-- Invite validation belongs to a later server route/RPC; no general client
-- SELECT policy is provided.

create table if not exists public.play_together_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.play_together_rooms (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  check (
    used_at is null or used_at >= created_at
  ),
  check (
    revoked_at is null or revoked_at >= created_at
  ),
  check (
    used_at is not null or revoked_at is not null or expires_at > created_at
  )
);

create index if not exists play_together_invites_room_id_idx
  on public.play_together_invites (room_id);

create index if not exists play_together_invites_expires_at_idx
  on public.play_together_invites (expires_at);

create index if not exists play_together_invites_revoked_at_idx
  on public.play_together_invites (revoked_at)
  where revoked_at is null;

alter table public.play_together_invites enable row level security;

-- No general client read policy. Invite validation is server-only via API/RPC.
-- Only service_role has access.

revoke all on public.play_together_invites from anon;
revoke all on public.play_together_invites from authenticated;
grant all on public.play_together_invites to service_role;

comment on table public.play_together_invites is
  'Play Together room invite tokens stored as SHA-256 hashes only. Plaintext secrets must never be persisted. Server-side validation via API/RPC.';

-- ---------------------------------------------------------------------------
-- Table 4: play_together_messages
-- ---------------------------------------------------------------------------
-- Ordered 0chat messages scoped to a room. Sequence is unique per room and
-- monotonically increasing. Messages are ephemeral V1 — retention is a
-- future policy decision. Direct client writes are NOT authoritative in B1;
-- server API owns message mutations.

create table if not exists public.play_together_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.play_together_rooms (id) on delete cascade,
  sequence integer not null check (sequence >= 0),
  sender_user_id uuid not null references auth.users (id) on delete cascade,
  message_text text not null check (btrim(message_text) <> ''),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (room_id, sequence)
);

create index if not exists play_together_messages_room_id_created_at_idx
  on public.play_together_messages (room_id, created_at desc);

create index if not exists play_together_messages_room_id_sender_idx
  on public.play_together_messages (room_id, sender_user_id);

alter table public.play_together_messages enable row level security;

-- Authenticated user may SELECT messages for rooms they are a participant of.
drop policy if exists "Participants can read room messages" on public.play_together_messages;
create policy "Participants can read room messages"
  on public.play_together_messages
  for select
  to authenticated
  using (
    public.is_room_participant(room_id, auth.uid())
  );

revoke all on public.play_together_messages from anon;
grant select on public.play_together_messages to authenticated;
grant all on public.play_together_messages to service_role;

comment on table public.play_together_messages is
  '0chat messages ordered per room. V1: private, two-participant, text-only, ephemeral. All writes via server API.';

comment on column public.play_together_messages.message_text is
  '0chat message body. Must be non-blank. Maximum length is a future policy decision.';
