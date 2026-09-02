-- PX01-B2D: Product-decision activation for Play Together / 0chat room access.
--
-- Additive source-only migration. Not applied remotely in this session.
-- Activates the room-scoped Coin/Rewarded access foundation and replaces the
-- B2B RPC bodies with server-authoritative TTL/invite semantics while
-- preserving the audited function names/signatures.

create table if not exists public.play_together_room_access_grants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.play_together_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('coin', 'rewarded')),
  granted_at timestamptz not null default now(),
  unique (user_id, room_id)
);

create index if not exists play_together_room_access_grants_room_id_idx
  on public.play_together_room_access_grants (room_id);

create index if not exists play_together_room_access_grants_user_id_idx
  on public.play_together_room_access_grants (user_id, granted_at desc);

alter table public.play_together_room_access_grants enable row level security;

-- Server-only model: the Android/web client cannot insert, update, delete, or
-- read grants directly. The trusted API resolves access with the service role.
revoke all on public.play_together_room_access_grants from anon;
revoke all on public.play_together_room_access_grants from authenticated;
grant all on public.play_together_room_access_grants to service_role;

comment on table public.play_together_room_access_grants is
  'Room-scoped 0chat access grants for Coin/Rewarded. Grants are user+room bound, server-created only, and useful only while the room remains valid.';

comment on column public.play_together_room_access_grants.source is
  '0chat room access source. Plus is resolved from current subscription state and is not persisted here.';

create unique index if not exists play_together_invites_one_active_unused_per_room_idx
  on public.play_together_invites (room_id)
  where used_at is null
    and revoked_at is null;

create or replace function public.create_play_together_room(
  p_host_user_id uuid,
  p_episode_id uuid,
  p_room_expires_at timestamptz
)
returns table (
  room_id uuid,
  episode_id uuid,
  status text,
  state_version bigint,
  expires_at timestamptz,
  host_participant_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_room_id uuid;
  v_host_participant_id uuid;
begin
  if p_host_user_id is null or p_episode_id is null then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  -- Kept for signature compatibility with PX01-B2B. TTL is server-side only.
  p_room_expires_at := v_now + interval '6 hours';

  if not exists (
    select 1
    from public.episodes
    join public.series on public.series.id = public.episodes.series_id
    where public.episodes.id = p_episode_id
      and public.episodes.status = 'published'
      and (public.episodes.published_at is null or public.episodes.published_at <= v_now)
      and public.series.status = 'published'
  ) then
    raise exception 'invalid_episode' using errcode = 'P0002';
  end if;

  insert into public.play_together_rooms (host_user_id, episode_id, expires_at)
  values (p_host_user_id, p_episode_id, p_room_expires_at)
  returning id into v_room_id;

  insert into public.play_together_participants (room_id, user_id, role)
  values (v_room_id, p_host_user_id, 'host')
  returning id into v_host_participant_id;

  return query
  select
    public.play_together_rooms.id,
    public.play_together_rooms.episode_id,
    public.play_together_rooms.status,
    public.play_together_rooms.state_version,
    public.play_together_rooms.expires_at,
    v_host_participant_id
  from public.play_together_rooms
  where public.play_together_rooms.id = v_room_id;
end;
$$;

revoke all on function public.create_play_together_room(uuid, uuid, timestamptz) from public;
revoke all on function public.create_play_together_room(uuid, uuid, timestamptz) from anon;
revoke all on function public.create_play_together_room(uuid, uuid, timestamptz) from authenticated;
grant execute on function public.create_play_together_room(uuid, uuid, timestamptz) to service_role;

create or replace function public.create_play_together_invite(
  p_actor_user_id uuid,
  p_room_id uuid,
  p_token_hash text,
  p_invite_expires_at timestamptz
)
returns table (
  invite_id uuid,
  room_id uuid,
  expires_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invite_id uuid;
  v_now timestamptz := now();
  v_room public.play_together_rooms%rowtype;
begin
  if p_actor_user_id is null or p_room_id is null then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_token_hash' using errcode = '22023';
  end if;

  select *
  into v_room
  from public.play_together_rooms
  where public.play_together_rooms.id = p_room_id
    and public.play_together_rooms.host_user_id = p_actor_user_id
    and public.play_together_rooms.status in ('waiting', 'active', 'waiting_for_access')
    and public.play_together_rooms.expires_at > v_now
  for update;

  if not found then
    raise exception 'room_not_joinable' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.play_together_participants
    where public.play_together_participants.room_id = p_room_id
      and public.play_together_participants.role = 'guest'
  ) then
    raise exception 'room_full' using errcode = '23505';
  end if;

  -- Kept for signature compatibility with PX01-B2B. TTL is server-side only.
  p_invite_expires_at := least(v_now + interval '1 hour', v_room.expires_at);

  update public.play_together_invites
  set revoked_at = coalesce(revoked_at, v_now)
  where public.play_together_invites.room_id = p_room_id
    and public.play_together_invites.used_at is null
    and public.play_together_invites.revoked_at is null;

  insert into public.play_together_invites (room_id, token_hash, created_by, expires_at)
  values (p_room_id, p_token_hash, p_actor_user_id, p_invite_expires_at)
  returning id into v_invite_id;

  return query
  select v_invite_id, p_room_id, p_invite_expires_at;
end;
$$;

revoke all on function public.create_play_together_invite(uuid, uuid, text, timestamptz) from public;
revoke all on function public.create_play_together_invite(uuid, uuid, text, timestamptz) from anon;
revoke all on function public.create_play_together_invite(uuid, uuid, text, timestamptz) from authenticated;
grant execute on function public.create_play_together_invite(uuid, uuid, text, timestamptz) to service_role;

create or replace function public.revoke_play_together_invite(
  p_actor_user_id uuid,
  p_room_id uuid,
  p_invite_id uuid
)
returns table (
  invite_id uuid,
  room_id uuid,
  revoked_at timestamptz,
  used_at timestamptz,
  result text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invite public.play_together_invites%rowtype;
  v_now timestamptz := now();
begin
  if p_actor_user_id is null or p_room_id is null or p_invite_id is null then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  perform 1
  from public.play_together_rooms
  where public.play_together_rooms.id = p_room_id
    and public.play_together_rooms.host_user_id = p_actor_user_id;

  if not found then
    raise exception 'not_host' using errcode = '42501';
  end if;

  select *
  into v_invite
  from public.play_together_invites
  where public.play_together_invites.id = p_invite_id
    and public.play_together_invites.room_id = p_room_id
  for update;

  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;

  if v_invite.used_at is not null then
    return query select p_invite_id, p_room_id, v_invite.revoked_at, v_invite.used_at, 'already_used'::text;
    return;
  end if;

  if v_invite.revoked_at is not null then
    return query select p_invite_id, p_room_id, v_invite.revoked_at, v_invite.used_at, 'already_revoked'::text;
    return;
  end if;

  update public.play_together_invites
  set revoked_at = v_now
  where public.play_together_invites.id = p_invite_id
    and public.play_together_invites.room_id = p_room_id
  returning * into v_invite;

  return query select p_invite_id, p_room_id, v_invite.revoked_at, v_invite.used_at, 'revoked'::text;
end;
$$;

revoke all on function public.revoke_play_together_invite(uuid, uuid, uuid) from public;
revoke all on function public.revoke_play_together_invite(uuid, uuid, uuid) from anon;
revoke all on function public.revoke_play_together_invite(uuid, uuid, uuid) from authenticated;
grant execute on function public.revoke_play_together_invite(uuid, uuid, uuid) to service_role;

create or replace function public.redeem_play_together_invite(
  p_joining_user_id uuid,
  p_token_hash text
)
returns table (
  room_id uuid,
  episode_id uuid,
  status text,
  state_version bigint,
  participant_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invite public.play_together_invites%rowtype;
  v_room public.play_together_rooms%rowtype;
  v_existing_participant_id uuid;
  v_participant_id uuid;
  v_now timestamptz := now();
begin
  if p_joining_user_id is null then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_token_hash' using errcode = '22023';
  end if;

  select *
  into v_invite
  from public.play_together_invites
  where public.play_together_invites.token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'invite_revoked' using errcode = '42501';
  end if;

  if v_invite.used_at is not null then
    raise exception 'invite_used' using errcode = '42501';
  end if;

  if v_invite.expires_at <= v_now then
    raise exception 'invite_expired' using errcode = '42501';
  end if;

  select *
  into v_room
  from public.play_together_rooms
  where public.play_together_rooms.id = v_invite.room_id
  for update;

  if not found
    or v_room.status not in ('waiting', 'active', 'waiting_for_access')
    or v_room.expires_at <= v_now
  then
    raise exception 'room_not_joinable' using errcode = 'P0002';
  end if;

  select id
  into v_existing_participant_id
  from public.play_together_participants
  where public.play_together_participants.room_id = v_room.id
    and public.play_together_participants.user_id = p_joining_user_id;

  if found then
    return query
    select
      v_room.id,
      v_room.episode_id,
      v_room.status,
      v_room.state_version,
      v_existing_participant_id;
    return;
  end if;

  if v_room.host_user_id = p_joining_user_id then
    raise exception 'host_cannot_join_as_guest' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.play_together_participants
    where public.play_together_participants.room_id = v_room.id
      and public.play_together_participants.role = 'guest'
  ) then
    raise exception 'room_full' using errcode = '23505';
  end if;

  insert into public.play_together_participants (room_id, user_id, role)
  values (v_room.id, p_joining_user_id, 'guest')
  returning id into v_participant_id;

  update public.play_together_invites
  set used_at = v_now
  where public.play_together_invites.id = v_invite.id
    and public.play_together_invites.used_at is null
    and public.play_together_invites.revoked_at is null;

  if not found then
    raise exception 'invite_consume_conflict' using errcode = '40001';
  end if;

  update public.play_together_rooms
  set status = case when public.play_together_rooms.status = 'waiting' then 'active' else public.play_together_rooms.status end,
      state_version = public.play_together_rooms.state_version + 1,
      state_server_time = v_now
  where public.play_together_rooms.id = v_room.id
  returning * into v_room;

  return query
  select
    v_room.id,
    v_room.episode_id,
    v_room.status,
    v_room.state_version,
    v_participant_id;
end;
$$;

revoke all on function public.redeem_play_together_invite(uuid, text) from public;
revoke all on function public.redeem_play_together_invite(uuid, text) from anon;
revoke all on function public.redeem_play_together_invite(uuid, text) from authenticated;
grant execute on function public.redeem_play_together_invite(uuid, text) to service_role;
