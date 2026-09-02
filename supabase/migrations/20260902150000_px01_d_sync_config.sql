-- PX01-D: Play Together playback-synchronization config + Presence delivery.
--
-- Source-only additive migration. Do not apply remotely from this session.
--
-- Two concerns, both strictly additive to the existing PX01 layout:
--
--   1. Sync tuning mirrors on play_together_commercial_config so the Android
--      sync adapter never hardcodes drift/rate/heartbeat values (root AGENTS.md:
--      CONFIG values are backend-controlled). The activation gate `enabled`
--      from PX01-C1 stays false here and is NOT flipped by this migration.
--
--   2. Realtime Presence authorization for the ephemeral "Host is buffering"
--      signal. Verified against official Supabase behavior (2026): Realtime
--      Broadcast AND Presence are both authorized with RLS policies on
--      realtime.messages, keyed by realtime.topic() + realtime.messages.extension,
--      and the client must join the topic with config { private: true }.
--
--      PX01-B-RT-B already authorizes participants to RECEIVE broadcasts by
--      extension 'broadcast' only (clients cannot send, cannot track presence).
--      This migration adds presence READ (select) + presence WRITE (insert)
--      policies on a SEPARATE topic shape (`play_together_room_presence:<room>`)
--      so the existing read-only room-state seam (usePlayTogetherRoom) is not
--      granted any write capability. Broadcast insert stays denied.
--
--      Presence authorization reuses the exact same room-membership guard
--      (is_room_participant) via a new topic parser scoped to the presence
--      prefix; non-participants and anon are denied both directions.

-- ---------------------------------------------------------------------------
-- 1. Sync tuning values for the backend-controlled sync adapter.
--    Conceptual defaults: small drift 300ms, large drift 1200ms, gentle rate
--    correction within canonicalRate x [0.97, 1.03], heartbeat every 10s.
-- ---------------------------------------------------------------------------

alter table public.play_together_commercial_config
  add column if not exists sync_small_drift_ms integer not null default 300
    check (sync_small_drift_ms >= 0),
  add column if not exists sync_large_drift_ms integer not null default 1200
    check (sync_large_drift_ms > sync_small_drift_ms),
  add column if not exists sync_rate_min_factor numeric not null default 0.97
    check (sync_rate_min_factor > 0 and sync_rate_min_factor <= 1),
  add column if not exists sync_rate_max_factor numeric not null default 1.03
    check (sync_rate_max_factor >= 1),
  add column if not exists sync_heartbeat_seconds integer not null default 10
    check (sync_heartbeat_seconds > 0);

comment on column public.play_together_commercial_config.sync_small_drift_ms is
  'Play Together drift below this threshold (ms) is ignored. Backend-controlled; never hardcoded by clients.';
comment on column public.play_together_commercial_config.sync_large_drift_ms is
  'Play Together drift above this threshold (ms) is corrected by a direct seek. Backend-controlled; never hardcoded by clients.';
comment on column public.play_together_commercial_config.sync_rate_min_factor is
  'Lower bound of the gentle rate-correction factor relative to the canonical playback rate. Backend-controlled; never hardcoded by clients.';
comment on column public.play_together_commercial_config.sync_rate_max_factor is
  'Upper bound of the gentle rate-correction factor relative to the canonical playback rate. Backend-controlled; never hardcoded by clients.';
comment on column public.play_together_commercial_config.sync_heartbeat_seconds is
  'Client heartbeat cadence for clock-offset estimation and canonical-state refresh. Backend-controlled; never hardcoded by clients.';

-- Explicitly reaffirm the activation seam stays off; the sync adapter is inert
-- until the Product Owner enables Play Together (consume only).
update public.play_together_commercial_config
  set enabled = false
  where id = 'launch';

-- ---------------------------------------------------------------------------
-- 2. Expose the sync tuning through the existing central config RPC.
--    PostgreSQL disallows changing a function's return type with
--    CREATE OR REPLACE FUNCTION, so the RPC is dropped and recreated (same
--    pattern as PX01-C1). Visibility gate semantics are unchanged.
-- ---------------------------------------------------------------------------

drop function if exists public.get_play_together_commercial_config();

create or replace function public.get_play_together_commercial_config()
returns table (
  enabled boolean,
  coin_price integer,
  required_rewarded_completions integer,
  sync_small_drift_ms integer,
  sync_large_drift_ms integer,
  sync_rate_min_factor numeric,
  sync_rate_max_factor numeric,
  sync_heartbeat_seconds integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.play_together_commercial_config.enabled,
    public.play_together_commercial_config.coin_price,
    public.play_together_commercial_config.required_rewarded_completions,
    public.play_together_commercial_config.sync_small_drift_ms,
    public.play_together_commercial_config.sync_large_drift_ms,
    public.play_together_commercial_config.sync_rate_min_factor,
    public.play_together_commercial_config.sync_rate_max_factor,
    public.play_together_commercial_config.sync_heartbeat_seconds
  from public.play_together_commercial_config
  where id = 'launch';
$$;

revoke all on function public.get_play_together_commercial_config() from public;
revoke all on function public.get_play_together_commercial_config() from anon;
revoke all on function public.get_play_together_commercial_config() from authenticated;
grant execute on function public.get_play_together_commercial_config() to service_role;

-- ---------------------------------------------------------------------------
-- 3. Realtime Presence authorization for the ephemeral room signal.
--    Mirrors the PX01-B-RT-B topic parser but scoped to the presence topic
--    prefix so presence never collides with or extends the broadcast topic.
-- ---------------------------------------------------------------------------

create or replace function public.play_together_room_id_from_realtime_presence_topic()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when realtime.topic() ~
      '^play_together_room_presence:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then substring(realtime.topic() from length('play_together_room_presence:') + 1)::uuid
    else null
  end;
$$;

revoke all on function public.play_together_room_id_from_realtime_presence_topic() from public;
revoke all on function public.play_together_room_id_from_realtime_presence_topic() from anon;
grant execute on function public.play_together_room_id_from_realtime_presence_topic() to authenticated;

drop policy if exists "Play Together participants receive presence in room topic"
  on realtime.messages;

create policy "Play Together participants receive presence in room topic"
  on realtime.messages
  for select
  to authenticated
  using (
    (select public.is_room_participant(
      public.play_together_room_id_from_realtime_presence_topic(),
      auth.uid()
    ))
    and realtime.messages.extension in ('presence')
  );

comment on policy "Play Together participants receive presence in room topic" on realtime.messages is
  'Only room participants may receive presence on the play_together_room_presence:<room_id> topic (ephemeral room signals such as Host buffering). Non-participant and anon attempts are denied.';

drop policy if exists "Play Together participants track presence in room topic"
  on realtime.messages;

create policy "Play Together participants track presence in room topic"
  on realtime.messages
  for insert
  to authenticated
  with check (
    (select public.is_room_participant(
      public.play_together_room_id_from_realtime_presence_topic(),
      auth.uid()
    ))
    and realtime.messages.extension in ('presence')
  );

comment on policy "Play Together participants track presence in room topic" on realtime.messages is
  'Only room participants may track (write) presence on the play_together_room_presence:<room_id> topic. Broadcast writes remain denied (PX01-B-RT-B).';