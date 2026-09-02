-- PX01-B2B: Play Together / 0chat room + invite API primitives.
--
-- These functions are intentionally service-role only. The trusted API layer
-- must derive the actor from getApiAuth(request), verify 0chat access, verify
-- episode/content access, and pass server-authoritative expiry timestamps.
-- Direct anon/authenticated RPC execution remains revoked.

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
  v_room_id uuid;
  v_host_participant_id uuid;
begin
  if p_host_user_id is null or p_episode_id is null or p_room_expires_at is null then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  if p_room_expires_at <= now() then
    raise exception 'invalid_expiry' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.episodes
    join public.series on public.series.id = public.episodes.series_id
    where public.episodes.id = p_episode_id
      and public.episodes.status = 'published'
      and (public.episodes.published_at is null or public.episodes.published_at <= now())
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
begin
  if p_actor_user_id is null or p_room_id is null or p_invite_expires_at is null then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_token_hash' using errcode = '22023';
  end if;

  if p_invite_expires_at <= now() then
    raise exception 'invalid_expiry' using errcode = '22023';
  end if;

  perform 1
  from public.play_together_rooms
  where id = p_room_id
    and host_user_id = p_actor_user_id
    and status in ('waiting', 'active', 'waiting_for_access')
    and expires_at > now()
  for update;

  if not found then
    raise exception 'room_not_joinable' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.play_together_participants
    where room_id = p_room_id
      and role = 'guest'
  ) then
    raise exception 'room_full' using errcode = '23505';
  end if;

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
  revoked_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_revoked_at timestamptz;
begin
  if p_actor_user_id is null or p_room_id is null or p_invite_id is null then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.play_together_rooms
    where id = p_room_id
      and host_user_id = p_actor_user_id
  ) then
    raise exception 'not_host' using errcode = '42501';
  end if;

  update public.play_together_invites
  set revoked_at = coalesce(revoked_at, now())
  where id = p_invite_id
    and room_id = p_room_id
  returning public.play_together_invites.revoked_at into v_revoked_at;

  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;

  return query
  select p_invite_id, p_room_id, v_revoked_at;
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
  where token_hash = p_token_hash
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

  if v_invite.expires_at <= now() then
    raise exception 'invite_expired' using errcode = '42501';
  end if;

  select *
  into v_room
  from public.play_together_rooms
  where id = v_invite.room_id
  for update;

  if not found
    or v_room.status not in ('waiting', 'active', 'waiting_for_access')
    or v_room.expires_at <= now()
  then
    raise exception 'room_not_joinable' using errcode = 'P0002';
  end if;

  select id
  into v_existing_participant_id
  from public.play_together_participants
  where room_id = v_room.id
    and user_id = p_joining_user_id;

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
    where room_id = v_room.id
      and role = 'guest'
  ) then
    raise exception 'room_full' using errcode = '23505';
  end if;

  insert into public.play_together_participants (room_id, user_id, role)
  values (v_room.id, p_joining_user_id, 'guest')
  returning id into v_participant_id;

  update public.play_together_invites
  set used_at = now()
  where id = v_invite.id
    and used_at is null
    and revoked_at is null;

  if not found then
    raise exception 'invite_consume_conflict' using errcode = '40001';
  end if;

  update public.play_together_rooms
  set status = case when status = 'waiting' then 'active' else status end,
      state_version = state_version + 1,
      state_server_time = now()
  where id = v_room.id
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
