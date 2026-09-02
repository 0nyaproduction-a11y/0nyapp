-- PX01-B-RT-B: Realtime room-state backend foundation.
--
-- Source-only additive migration. Do not apply remotely from this session.
-- Builds on the existing PX01 room/invite/access schema without modifying it.
--
-- Adds:
--   1. play_together_rooms.last_command_id / updated_by_user_id — provenance
--      metadata for the most recent applied Host command.
--   2. play_together_room_commands — server-side Host command log. It makes
--      commands retry-safe (command_id idempotency with deterministic replay),
--      detects conflicting reuse, and gives a deterministic audit trail.
--   3. apply_play_together_room_command(...) — service-role RPC that applies a
--      single Host playback command to the canonical room row atomically,
--      bumps state_version exactly once per applied command, stamps
--      state_server_time from the database clock, and records the command.
--      Host authority, stale expected_version, ended/expired room, and
--      authoritative seek bounds are enforced inside the transaction.
--   4. notify_play_together_room_state_change() — database-driven Realtime
--      Broadcast (private topic play_together_room:<room_id>, event
--      'state_changed') fired AFTER any room state-version change. Broadcast is
--      a notification/fan-out layer only; the canonical DB row is the source
--      of truth and clients recover missed broadcasts from the room read API.
--   5. realtime.messages RLS select policy — private-channel authorization so
--      only room participants may join/receive a room topic. No client insert
--      policy is created, so clients cannot send broadcasts on room topics.
--
-- No product numeric policy is invented here: no host disconnect timeout,
-- no drift threshold, no heartbeat cadence, no command rate, no retention.

-- ---------------------------------------------------------------------------
-- 1. Room provenance metadata (additive columns)
-- ---------------------------------------------------------------------------

alter table public.play_together_rooms
  add column if not exists last_command_id text,
  add column if not exists updated_by_user_id uuid;

alter table public.play_together_rooms
  drop constraint if exists play_together_rooms_last_command_id_length_check;

alter table public.play_together_rooms
  add constraint play_together_rooms_last_command_id_length_check
  check (
    last_command_id is null
    or (char_length(last_command_id) between 8 and 160)
  );

alter table public.play_together_rooms
  drop constraint if exists play_together_rooms_updated_by_user_id_fkey;

alter table public.play_together_rooms
  add constraint play_together_rooms_updated_by_user_id_fkey
  foreign key (updated_by_user_id)
  references auth.users (id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- 2. play_together_room_commands
-- ---------------------------------------------------------------------------
-- Server-authoritative command log. Only the trusted API layer inserts rows
-- through apply_play_together_room_command. unique (room_id, command_id) is the
-- idempotency guard: an identical retry after success must not double-bump
-- state_version.

create table if not exists public.play_together_room_commands (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.play_together_rooms (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  command_id text not null check (
    char_length(command_id) between 8 and 160
  ),
  command_type text not null check (
    command_type in ('play', 'pause', 'seek', 'episode_change', 'end_room')
  ),
  expected_version bigint
    check (expected_version is null or expected_version >= 0),
  position_ms integer
    check (position_ms is null or position_ms >= 0),
  target_episode_id uuid
    references public.episodes (id)
    on delete set null,
  created_at timestamptz not null default now(),
  unique (room_id, command_id)
);

create index if not exists play_together_room_commands_room_created_idx
  on public.play_together_room_commands (room_id, created_at desc);

alter table public.play_together_room_commands enable row level security;

revoke all on public.play_together_room_commands from anon;
revoke all on public.play_together_room_commands from authenticated;
grant all on public.play_together_room_commands to service_role;

comment on table public.play_together_room_commands is
  'Server-authoritative Play Together Host command log. Idempotency via unique (room_id, command_id); Host-only writes via apply_play_together_room_command; no client access.';

-- ---------------------------------------------------------------------------
-- 3. apply_play_together_room_command
-- ---------------------------------------------------------------------------
-- Applies a single Host command to the canonical room row. Deterministic
-- idempotency (replay/transaction_conflict), Host authority, expected_version
-- stale detection, ended/expired guards, and authoritative seek clamping.
-- SECURITY INVOKER by design: only service_role may execute, matching the
-- existing PX01 room RPCs.

create or replace function public.apply_play_together_room_command(
  p_actor_user_id uuid,
  p_room_id uuid,
  p_command_id text,
  p_command_type text,
  p_expected_version bigint default null,
  p_position_ms integer default null,
  p_target_episode_id uuid default null
)
returns table (
  success boolean,
  status text,
  room_id uuid,
  status_code text,
  episode_id uuid,
  playback_state text,
  host_position_ms integer,
  playback_rate numeric,
  state_version bigint,
  state_server_time timestamptz,
  ended_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room public.play_together_rooms%rowtype;
  v_existing public.play_together_room_commands%rowtype;
  v_now timestamptz := now();
begin
  if p_actor_user_id is null
    or p_room_id is null
    or p_command_id is null
    or char_length(btrim(p_command_id)) < 8
    or char_length(p_command_id) > 160
    or p_command_type not in ('play', 'pause', 'seek', 'episode_change', 'end_room')
    or (p_expected_version is not null and p_expected_version < 0)
  then
    return query select false, 'invalid_request'::text, p_room_id, null::text, null::uuid, null::text, null::integer, null::numeric, null::bigint, null::timestamptz, null::timestamptz;
    return;
  end if;

  if p_command_type = 'seek' then
    if p_position_ms is null or p_position_ms < 0 then
      return query select false, 'invalid_position'::text, p_room_id, null::text, null::uuid, null::text, null::integer, null::numeric, null::bigint, null::timestamptz, null::timestamptz;
      return;
    end if;
  elsif p_position_ms is not null then
    return query select false, 'invalid_request'::text, p_room_id, null::text, null::uuid, null::text, null::integer, null::numeric, null::bigint, null::timestamptz, null::timestamptz;
    return;
  end if;

  if p_command_type = 'episode_change' and p_target_episode_id is null then
    return query select false, 'invalid_episode'::text, p_room_id, null::text, null::uuid, null::text, null::integer, null::numeric, null::bigint, null::timestamptz, null::timestamptz;
    return;
  end if;

  if p_command_type <> 'episode_change' and p_target_episode_id is not null then
    return query select false, 'invalid_request'::text, p_room_id, null::text, null::uuid, null::text, null::integer, null::numeric, null::bigint, null::timestamptz, null::timestamptz;
    return;
  end if;

  -- Serialize all commands for a room so state_version increments exactly once
  -- per applied command, regardless of retry/concurrency ordering.
  select *
  into v_room
  from public.play_together_rooms
  where public.play_together_rooms.id = p_room_id
  for update;

  if not found then
    return query select false, 'room_not_found'::text, p_room_id, null::text, null::uuid, null::text, null::integer, null::numeric, null::bigint, null::timestamptz, null::timestamptz;
    return;
  end if;

  select *
  into v_existing
  from public.play_together_room_commands
  where public.play_together_room_commands.room_id = p_room_id
    and public.play_together_room_commands.command_id = p_command_id;

  if found then
    if v_existing.actor_user_id = p_actor_user_id
      and v_existing.command_type = p_command_type
      and v_existing.expected_version is not distinct from p_expected_version
      and v_existing.position_ms is not distinct from p_position_ms
      and v_existing.target_episode_id is not distinct from p_target_episode_id
    then
      return query select true, 'replayed'::text, v_room.id, v_room.status, v_room.episode_id, v_room.playback_state, v_room.host_position_ms, v_room.playback_rate, v_room.state_version, v_room.state_server_time, v_room.ended_at;
      return;
    end if;

    return query select false, 'transaction_conflict'::text, v_room.id, v_room.status, v_room.episode_id, v_room.playback_state, v_room.host_position_ms, v_room.playback_rate, v_room.state_version, v_room.state_server_time, v_room.ended_at;
    return;
  end if;

  if v_room.status = 'ended' then
    return query select false, 'room_ended'::text, v_room.id, v_room.status, v_room.episode_id, v_room.playback_state, v_room.host_position_ms, v_room.playback_rate, v_room.state_version, v_room.state_server_time, v_room.ended_at;
    return;
  end if;

  if v_room.status = 'expired' or v_room.expires_at <= v_now then
    return query select false, 'room_expired'::text, v_room.id, v_room.status, v_room.episode_id, v_room.playback_state, v_room.host_position_ms, v_room.playback_rate, v_room.state_version, v_room.state_server_time, v_room.ended_at;
    return;
  end if;

  if not exists (
    select 1
    from public.play_together_participants
    where public.play_together_participants.room_id = p_room_id
      and public.play_together_participants.user_id = p_actor_user_id
      and public.play_together_participants.role = 'host'
  ) then
    return query select false, 'not_host'::text, v_room.id, v_room.status, v_room.episode_id, v_room.playback_state, v_room.host_position_ms, v_room.playback_rate, v_room.state_version, v_room.state_server_time, v_room.ended_at;
    return;
  end if;

  if p_expected_version is not null and v_room.state_version <> p_expected_version then
    return query select false, 'stale_version'::text, v_room.id, v_room.status, v_room.episode_id, v_room.playback_state, v_room.host_position_ms, v_room.playback_rate, v_room.state_version, v_room.state_server_time, v_room.ended_at;
    return;
  end if;

  if p_command_type = 'episode_change' then
    if not exists (
      select 1
      from public.episodes
      join public.series on public.series.id = public.episodes.series_id
      where public.episodes.id = p_target_episode_id
        and public.episodes.status = 'published'
        and (public.episodes.published_at is null or public.episodes.published_at <= v_now)
        and public.series.status = 'published'
    ) then
      return query select false, 'invalid_episode'::text, v_room.id, v_room.status, v_room.episode_id, v_room.playback_state, v_room.host_position_ms, v_room.playback_rate, v_room.state_version, v_room.state_server_time, v_room.ended_at;
      return;
    end if;
  end if;

  if p_command_type = 'play' then
    update public.play_together_rooms
    set playback_state = 'playing',
        state_version = public.play_together_rooms.state_version + 1,
        state_server_time = v_now,
        last_command_id = p_command_id,
        updated_by_user_id = p_actor_user_id
    where public.play_together_rooms.id = p_room_id
    returning * into v_room;
  elsif p_command_type = 'pause' then
    update public.play_together_rooms
    set playback_state = 'paused',
        state_version = public.play_together_rooms.state_version + 1,
        state_server_time = v_now,
        last_command_id = p_command_id,
        updated_by_user_id = p_actor_user_id
    where public.play_together_rooms.id = p_room_id
    returning * into v_room;
  elsif p_command_type = 'seek' then
    -- Authoritative seek bounds from the canonical published episode duration.
    -- Positions beyond the published duration clamp to it so near-end seeks
    -- behave deterministically without inventing product policy.
    update public.play_together_rooms
    set host_position_ms = least(
          p_position_ms,
          coalesce(
            (select public.episodes.duration_seconds * 1000
             from public.episodes
             where public.episodes.id = v_room.episode_id),
            p_position_ms
          )
        ),
        state_version = public.play_together_rooms.state_version + 1,
        state_server_time = v_now,
        last_command_id = p_command_id,
        updated_by_user_id = p_actor_user_id
    where public.play_together_rooms.id = p_room_id
    returning * into v_room;
  elsif p_command_type = 'episode_change' then
    update public.play_together_rooms
    set episode_id = p_target_episode_id,
        host_position_ms = 0,
        playback_state = 'paused',
        status = case
          when public.play_together_rooms.status = 'active' then 'waiting_for_access'
          else public.play_together_rooms.status
        end,
        state_version = public.play_together_rooms.state_version + 1,
        state_server_time = v_now,
        last_command_id = p_command_id,
        updated_by_user_id = p_actor_user_id
    where public.play_together_rooms.id = p_room_id
    returning * into v_room;
  else
    update public.play_together_rooms
    set status = 'ended',
        ended_at = v_now,
        playback_state = 'paused',
        state_version = public.play_together_rooms.state_version + 1,
        state_server_time = v_now,
        last_command_id = p_command_id,
        updated_by_user_id = p_actor_user_id
    where public.play_together_rooms.id = p_room_id
    returning * into v_room;
  end if;

  insert into public.play_together_room_commands (
    room_id,
    actor_user_id,
    command_id,
    command_type,
    expected_version,
    position_ms,
    target_episode_id
  )
  values (
    p_room_id,
    p_actor_user_id,
    p_command_id,
    p_command_type,
    p_expected_version,
    p_position_ms,
    p_target_episode_id
  );

  return query select true, 'applied'::text, v_room.id, v_room.status, v_room.episode_id, v_room.playback_state, v_room.host_position_ms, v_room.playback_rate, v_room.state_version, v_room.state_server_time, v_room.ended_at;
end;
$$;

revoke all on function public.apply_play_together_room_command(uuid, uuid, text, text, bigint, integer, uuid) from public;
revoke all on function public.apply_play_together_room_command(uuid, uuid, text, text, bigint, integer, uuid) from anon;
revoke all on function public.apply_play_together_room_command(uuid, uuid, text, text, bigint, integer, uuid) from authenticated;
grant execute on function public.apply_play_together_room_command(uuid, uuid, text, text, bigint, integer, uuid) to service_role;

comment on function public.apply_play_together_room_command(uuid, uuid, text, text, bigint, integer, uuid) is
  'Applies one Host playback command to the canonical room row. Idempotent per (room_id, command_id); serializes per room; bumps state_version exactly once; stamps DB clock; clamps seek to episode duration.';

-- ---------------------------------------------------------------------------
-- 4. Database-driven broadcast trigger
-- ---------------------------------------------------------------------------
-- After any state-version change (commands, joins, access transitions), notify
-- participants over the private realtime topic play_together_room:<room_id>.
-- Broadcast is fan-out only; the canonical row is the source of truth.

create or replace function public.notify_play_together_room_state_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'type', 'room_state',
      'room_id', new.id,
      'episode_id', new.episode_id,
      'status', new.status,
      'playback_state', new.playback_state,
      'host_position_ms', new.host_position_ms,
      'playback_rate', new.playback_rate,
      'state_version', new.state_version,
      'state_server_time', new.state_server_time,
      'last_command_id', new.last_command_id,
      'ended_at', new.ended_at
    ),
    'state_changed',
    'play_together_room:' || new.id::text,
    true
  );

  return new;
end;
$$;

drop trigger if exists notify_play_together_room_state_change_trigger
  on public.play_together_rooms;

create trigger notify_play_together_room_state_change_trigger
  after update on public.play_together_rooms
  for each row
  when (new.state_version <> old.state_version)
  execute function public.notify_play_together_room_state_change();

-- ---------------------------------------------------------------------------
-- 5. Realtime private-topic authorization (realtime.messages RLS)
-- ---------------------------------------------------------------------------
-- Real-time authorization via RLS policies on realtime.messages:
--   - select policy  -> who may join/receive a private broadcast topic
--   - (no insert policy -> clients cannot send broadcasts on room topics)
-- realtime.topic() exposes the channel topic being authorized. Only topics of
-- the shape play_together_room:<room_id> reach the room-membership check, so a
-- participant cannot use the room check against arbitrary topics.

create or replace function public.play_together_room_id_from_realtime_topic()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when realtime.topic() ~
      '^play_together_room:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then substring(realtime.topic() from length('play_together_room:') + 1)::uuid
    else null
  end;
$$;

revoke all on function public.play_together_room_id_from_realtime_topic() from public;
revoke all on function public.play_together_room_id_from_realtime_topic() from anon;
grant execute on function public.play_together_room_id_from_realtime_topic() to authenticated;

drop policy if exists "Play Together participants receive room broadcasts"
  on realtime.messages;

create policy "Play Together participants receive room broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    (select public.is_room_participant(
      public.play_together_room_id_from_realtime_topic(),
      auth.uid()
    ))
    and realtime.messages.extension in ('broadcast')
  );

comment on policy "Play Together participants receive room broadcasts" on realtime.messages is
  'Only room participants may join/receive the private play_together_room:<room_id> broadcast topic. Non-participant and anon attempts are denied.';