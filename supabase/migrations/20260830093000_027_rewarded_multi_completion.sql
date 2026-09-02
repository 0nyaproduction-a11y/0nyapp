-- Multi-rewarded episode unlock (V1 launch extension).
--
-- Extends the EXISTING verified rewarded foundation (011_rewarded_ad_foundation)
-- instead of rebuilding it. No new progress ledger: verified progress is derived
-- from granted rewarded_ad_attempts rows bound to the active required-count
-- snapshot. No automatic chained ads. Required count is backend/CMS controlled,
-- launch range 1..2, permanent mode only.

-- ---------------------------------------------------------------------------
-- Phase 1: episode required-count configuration
-- ---------------------------------------------------------------------------
alter table public.episodes
  add column if not exists required_rewarded_completions integer not null default 1
  check (required_rewarded_completions between 1 and 2);

-- ---------------------------------------------------------------------------
-- Phase 1: attempt policy snapshot (freezes the required count for the sequence)
-- ---------------------------------------------------------------------------
alter table public.rewarded_ad_attempts
  add column if not exists required_completions_snapshot integer not null default 1
  check (required_completions_snapshot between 1 and 2);

-- ---------------------------------------------------------------------------
-- Phase 14: smallest internal analytics table (no external SaaS).
-- Rewarded attempt/entitlement tables remain the authoritative financial source.
-- ---------------------------------------------------------------------------
create table if not exists public.rewarded_monetization_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  user_id uuid references auth.users (id) on delete set null,
  episode_id uuid references public.episodes (id) on delete cascade,
  ad_index smallint,
  required_count smallint,
  resulting_progress smallint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists rewarded_monetization_events_episode_idx
  on public.rewarded_monetization_events (episode_id, created_at desc);
create index if not exists rewarded_monetization_events_user_idx
  on public.rewarded_monetization_events (user_id, created_at desc);

alter table public.rewarded_monetization_events enable row level security;

drop policy if exists "Users can insert their own rewarded analytics events" on public.rewarded_monetization_events;
create policy "Users can insert their own rewarded analytics events"
  on public.rewarded_monetization_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

revoke all on public.rewarded_monetization_events from anon, authenticated;
grant insert on public.rewarded_monetization_events to authenticated;
grant insert, select on public.rewarded_monetization_events to service_role;

create or replace function public.record_rewarded_event(
  p_event_type text,
  p_user_id uuid,
  p_episode_id uuid default null,
  p_ad_index smallint default null,
  p_required_count smallint default null,
  p_resulting_progress smallint default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.rewarded_monetization_events (
    event_type,
    user_id,
    episode_id,
    ad_index,
    required_count,
    resulting_progress,
    metadata
  )
  values (
    p_event_type,
    p_user_id,
    p_episode_id,
    p_ad_index,
    p_required_count,
    p_resulting_progress,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_rewarded_event(text, uuid, uuid, smallint, smallint, smallint, jsonb) from public;
grant execute on function public.record_rewarded_event(text, uuid, uuid, smallint, smallint, smallint, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Phase 3 / 4 / 6: create_rewarded_ad_attempt
--   * reads current required count N (CMS/backend authoritative)
--   * freezes N to the active in-flight sequence snapshot when one exists
--   * derives verified progress P from granted attempts of the active snapshot
--   * P >= N -> already accessible
--   * P < N  -> reuse a non-expired pending attempt (abuse control) or create one
--   * snapshots N onto the new attempt
-- ---------------------------------------------------------------------------
drop function if exists public.create_rewarded_ad_attempt(uuid);

create or replace function public.create_rewarded_ad_attempt(
  p_episode_id uuid
)
returns table (
  status text,
  custom_data text,
  expires_at timestamptz,
  verified_progress integer,
  required_completions integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_episode public.episodes%rowtype;
  v_custom_data text;
  v_target_n integer;
  v_verified_p integer;
  v_existing_pending public.rewarded_ad_attempts%rowtype;
begin
  if v_user_id is null then
    return query select 'not_authenticated'::text, null::text, null::timestamptz, 0, 0;
    return;
  end if;

  select *
  into v_episode
  from public.episodes
  where public.episodes.id = p_episode_id
    and public.episodes.status = 'published'
    and exists (
      select 1
      from public.series
      where public.series.id = public.episodes.series_id
        and public.series.status = 'published'
    );

  if not found then
    return query select 'not_found'::text, null::text, null::timestamptz, 0, 0;
    return;
  end if;

  if v_episode.is_free then
    return query select 'already_accessible'::text, null::text, null::timestamptz, 0, 0;
    return;
  end if;

  if exists (
    select 1
    from public.episode_entitlements
    where public.episode_entitlements.user_id = v_user_id
      and public.episode_entitlements.episode_id = p_episode_id
      and (
        public.episode_entitlements.expires_at is null
        or public.episode_entitlements.expires_at > now()
      )
  ) then
    return query select 'already_accessible'::text, null::text, null::timestamptz, 0, 0;
    return;
  end if;

  if v_episode.plus_access and exists (
    select 1
    from public.subscriptions
    where public.subscriptions.user_id = v_user_id
      and public.subscriptions.status = 'active'
      and (
        public.subscriptions.starts_at is null
        or public.subscriptions.starts_at <= now()
      )
      and (
        public.subscriptions.ends_at is null
        or public.subscriptions.ends_at > now()
      )
  ) then
    return query select 'already_accessible'::text, null::text, null::timestamptz, 0, 0;
    return;
  end if;

  if not v_episode.rewarded_unlock_enabled then
    return query select 'rewarded_disabled'::text, null::text, null::timestamptz, 0, 0;
    return;
  end if;

  if v_episode.rewarded_access_mode = 'session' then
    return query select 'unsupported_pending_policy'::text, null::text, null::timestamptz, 0, 0;
    return;
  end if;

  -- Phase 6: freeze N to the most recent in-flight sequence snapshot if present,
  -- otherwise use the current CMS required count. N is stable for the sequence.
  select required_completions_snapshot
  into v_target_n
  from public.rewarded_ad_attempts
  where public.rewarded_ad_attempts.user_id = v_user_id
    and public.rewarded_ad_attempts.episode_id = p_episode_id
    and public.rewarded_ad_attempts.required_completions_snapshot between 1 and 2
  order by public.rewarded_ad_attempts.created_at desc
  limit 1;

  if v_target_n is null then
    v_target_n := v_episode.required_rewarded_completions;
  end if;

  -- Phase 3/5: verified progress P = granted attempts of the active snapshot.
  select count(*)
  into v_verified_p
  from public.rewarded_ad_attempts
  where public.rewarded_ad_attempts.user_id = v_user_id
    and public.rewarded_ad_attempts.episode_id = p_episode_id
    and public.rewarded_ad_attempts.status = 'granted'
    and public.rewarded_ad_attempts.required_completions_snapshot = v_target_n;

  if v_verified_p >= v_target_n then
    return query select 'already_accessible'::text, null::text, null::timestamptz, v_verified_p, v_target_n;
    return;
  end if;

  -- Phase 4: reuse a non-expired pending attempt for this step instead of
  -- flooding pending rows (prevents POST spam / concurrent active attempts).
  select *
  into v_existing_pending
  from public.rewarded_ad_attempts
  where public.rewarded_ad_attempts.user_id = v_user_id
    and public.rewarded_ad_attempts.episode_id = p_episode_id
    and public.rewarded_ad_attempts.status = 'pending'
    and public.rewarded_ad_attempts.required_completions_snapshot = v_target_n
    and public.rewarded_ad_attempts.expires_at > now()
  order by public.rewarded_ad_attempts.created_at desc
  limit 1;

  if found then
    perform public.record_rewarded_event(
      'rewarded_attempt_reused',
      v_user_id,
      p_episode_id,
      (v_verified_p + 1)::smallint,
      v_target_n::smallint,
      v_verified_p::smallint,
      jsonb_build_object('custom_data', v_existing_pending.custom_data)
    );

    return query select 'pending'::text, v_existing_pending.custom_data, v_existing_pending.expires_at, v_verified_p, v_target_n;
    return;
  end if;

  v_custom_data := encode(extensions.gen_random_bytes(16), 'hex');

  insert into public.rewarded_ad_attempts (
    user_id,
    episode_id,
    provider,
    custom_data,
    rewarded_access_mode_snapshot,
    required_completions_snapshot,
    status,
    expires_at
  )
  values (
    v_user_id,
    p_episode_id,
    'google_admob',
    v_custom_data,
    v_episode.rewarded_access_mode,
    v_target_n,
    'pending',
    now() + interval '15 minutes'
  );

  perform public.record_rewarded_event(
    'rewarded_attempt_started',
    v_user_id,
    p_episode_id,
    (v_verified_p + 1)::smallint,
    v_target_n::smallint,
    v_verified_p::smallint,
    jsonb_build_object('custom_data', v_custom_data)
  );

  return query select 'pending'::text, v_custom_data, (now() + interval '15 minutes'), v_verified_p, v_target_n;
end;
$$;

grant execute on function public.create_rewarded_ad_attempt(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Phase 3/8: get_rewarded_ad_attempt_status (returns progress)
-- ---------------------------------------------------------------------------
drop function if exists public.get_rewarded_ad_attempt_status(text);

create or replace function public.get_rewarded_ad_attempt_status(
  p_custom_data text
)
returns table (
  status text,
  custom_data text,
  expires_at timestamptz,
  verified_progress integer,
  required_completions integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.rewarded_ad_attempts%rowtype;
  v_target_n integer;
  v_verified_p integer;
begin
  if v_user_id is null then
    return query select 'not_authenticated'::text, null::text, null::timestamptz, 0, 0;
    return;
  end if;

  select *
  into v_attempt
  from public.rewarded_ad_attempts
  where public.rewarded_ad_attempts.user_id = v_user_id
    and public.rewarded_ad_attempts.custom_data = p_custom_data
  for update;

  if not found then
    return query select 'not_found'::text, null::text, null::timestamptz, 0, 0;
    return;
  end if;

  if v_attempt.status = 'pending' and v_attempt.expires_at <= now() then
    update public.rewarded_ad_attempts
    set status = 'expired'
    where public.rewarded_ad_attempts.id = v_attempt.id;

    v_attempt.status := 'expired';
  end if;

  v_target_n := v_attempt.required_completions_snapshot;

  select count(*)
  into v_verified_p
  from public.rewarded_ad_attempts
  where public.rewarded_ad_attempts.user_id = v_user_id
    and public.rewarded_ad_attempts.episode_id = v_attempt.episode_id
    and public.rewarded_ad_attempts.status = 'granted'
    and public.rewarded_ad_attempts.required_completions_snapshot = v_target_n;

  return query select v_attempt.status, v_attempt.custom_data, v_attempt.expires_at, v_verified_p, v_target_n;
end;
$$;

grant execute on function public.get_rewarded_ad_attempt_status(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Phase 5 / 6 / 8: finalize_rewarded_ad_callback
--   * marks the individual attempt granted (preserving SSV/idempotency)
--   * derives P from granted attempts of the attempt's own snapshot
--   * only grants the entitlement when P >= N
--   * never downgrades an existing purchased entitlement
-- ---------------------------------------------------------------------------
drop function if exists public.finalize_rewarded_ad_callback(text, text);

create or replace function public.finalize_rewarded_ad_callback(
  p_custom_data text,
  p_provider_transaction_id text
)
returns table (
  success boolean,
  status text,
  custom_data text,
  expires_at timestamptz,
  verified_progress integer,
  required_completions integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.rewarded_ad_attempts%rowtype;
  v_conflicting_attempt_id uuid;
  v_existing_entitlement_id uuid;
  v_required_n integer;
  v_verified_p integer;
  v_granted_entitlement boolean := false;
begin
  if p_custom_data is null or btrim(p_custom_data) = '' then
    return query select false, 'invalid_request'::text, null::text, null::timestamptz, 0, 0;
    return;
  end if;

  if p_provider_transaction_id is null or btrim(p_provider_transaction_id) = '' then
    return query select false, 'invalid_request'::text, null::text, null::timestamptz, 0, 0;
    return;
  end if;

  select *
  into v_attempt
  from public.rewarded_ad_attempts
  where public.rewarded_ad_attempts.custom_data = p_custom_data
  for update;

  if not found then
    return query select false, 'not_found'::text, null::text, null::timestamptz, 0, 0;
    return;
  end if;

  if v_attempt.status = 'pending' and v_attempt.expires_at <= now() then
    update public.rewarded_ad_attempts
    set status = 'expired'
    where public.rewarded_ad_attempts.id = v_attempt.id;

    return query select false, 'expired'::text, v_attempt.custom_data, v_attempt.expires_at, 0, v_attempt.required_completions_snapshot;
    return;
  end if;

  if v_attempt.status = 'unsupported_pending_policy' then
    return query select false, 'unsupported_pending_policy'::text, v_attempt.custom_data, v_attempt.expires_at, 0, v_attempt.required_completions_snapshot;
    return;
  end if;

  if v_attempt.status = 'expired' then
    return query select false, 'expired'::text, v_attempt.custom_data, v_attempt.expires_at, 0, v_attempt.required_completions_snapshot;
    return;
  end if;

  if v_attempt.status = 'failed' then
    return query select false, 'failed'::text, v_attempt.custom_data, v_attempt.expires_at, 0, v_attempt.required_completions_snapshot;
    return;
  end if;

  if v_attempt.provider_transaction_id is not null then
    if v_attempt.provider_transaction_id = p_provider_transaction_id and v_attempt.status = 'granted' then
      -- Replay protection: same transaction already granted this attempt.
      v_required_n := v_attempt.required_completions_snapshot;

      select count(*)
      into v_verified_p
      from public.rewarded_ad_attempts
      where public.rewarded_ad_attempts.user_id = v_attempt.user_id
        and public.rewarded_ad_attempts.episode_id = v_attempt.episode_id
        and public.rewarded_ad_attempts.status = 'granted'
        and public.rewarded_ad_attempts.required_completions_snapshot = v_required_n;

      return query select true, 'already_granted'::text, v_attempt.custom_data, v_attempt.expires_at, v_verified_p, v_required_n;
      return;
    end if;

    if v_attempt.provider_transaction_id <> p_provider_transaction_id then
      return query select false, 'transaction_conflict'::text, v_attempt.custom_data, v_attempt.expires_at, 0, v_attempt.required_completions_snapshot;
      return;
    end if;
  end if;

  select public.rewarded_ad_attempts.id
  into v_conflicting_attempt_id
  from public.rewarded_ad_attempts
  where public.rewarded_ad_attempts.provider_transaction_id = p_provider_transaction_id
    and public.rewarded_ad_attempts.custom_data <> p_custom_data
  limit 1;

  if v_conflicting_attempt_id is not null then
    return query select false, 'transaction_conflict'::text, v_attempt.custom_data, v_attempt.expires_at, 0, v_attempt.required_completions_snapshot;
    return;
  end if;

  -- Authoritative SSV mark: grant this individual attempt.
  update public.rewarded_ad_attempts
  set
    provider_transaction_id = p_provider_transaction_id,
    status = 'granted',
    verified_at = now()
  where public.rewarded_ad_attempts.id = v_attempt.id;

  v_required_n := v_attempt.required_completions_snapshot;

  -- Derive current verified progress for the frozen sequence.
  select count(*)
  into v_verified_p
  from public.rewarded_ad_attempts
  where public.rewarded_ad_attempts.user_id = v_attempt.user_id
    and public.rewarded_ad_attempts.episode_id = v_attempt.episode_id
    and public.rewarded_ad_attempts.status = 'granted'
    and public.rewarded_ad_attempts.required_completions_snapshot = v_required_n;

  perform public.record_rewarded_event(
    'rewarded_ad_verified',
    v_attempt.user_id,
    v_attempt.episode_id,
    v_verified_p::smallint,
    v_required_n::smallint,
    v_verified_p::smallint,
    jsonb_build_object('custom_data', v_attempt.custom_data, 'provider_transaction_id', p_provider_transaction_id)
  );

  -- Phase 5: only grant the entitlement when the requirement is fully met.
  if v_verified_p >= v_required_n then
    select public.episode_entitlements.id
    into v_existing_entitlement_id
    from public.episode_entitlements
    where public.episode_entitlements.user_id = v_attempt.user_id
      and public.episode_entitlements.episode_id = v_attempt.episode_id
    for update;

    if v_existing_entitlement_id is not null then
      update public.episode_entitlements
      set
        source = case
          when public.episode_entitlements.source = 'purchase' then 'purchase'
          else 'rewarded_ad'
        end,
        expires_at = null
      where public.episode_entitlements.user_id = v_attempt.user_id
        and public.episode_entitlements.episode_id = v_attempt.episode_id;
    else
      insert into public.episode_entitlements (
        user_id,
        episode_id,
        source,
        expires_at
      )
      values (
        v_attempt.user_id,
        v_attempt.episode_id,
        'rewarded_ad',
        null
      );
    end if;

    v_granted_entitlement := true;

    perform public.record_rewarded_event(
      'rewarded_unlock_completed',
      v_attempt.user_id,
      v_attempt.episode_id,
      v_required_n::smallint,
      v_required_n::smallint,
      v_verified_p::smallint,
      jsonb_build_object('custom_data', v_attempt.custom_data)
    );
  else
    -- Partial progress: recorded above as rewarded_ad_verified.
    perform public.record_rewarded_event(
      'rewarded_unlock_partial',
      v_attempt.user_id,
      v_attempt.episode_id,
      v_verified_p::smallint,
      v_required_n::smallint,
      v_verified_p::smallint,
      jsonb_build_object('custom_data', v_attempt.custom_data)
    );
  end if;

  return query select true, 'granted'::text, v_attempt.custom_data, v_attempt.expires_at, v_verified_p, v_required_n;
end;
$$;

grant execute on function public.finalize_rewarded_ad_callback(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Phase 8 / 12: episode-level rewarded progress for recovery (no custom_data).
-- Genuinely necessary so the client can recover 1/2 after app kill without
-- persisting authoritative state client-side.
-- ---------------------------------------------------------------------------
create or replace function public.get_rewarded_progress(
  p_episode_id uuid
)
returns table (
  verified_progress integer,
  required_completions integer,
  state text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_episode public.episodes%rowtype;
  v_target_n integer;
  v_verified_p integer;
begin
  if v_user_id is null then
    return query select 0, 0, 'not_authenticated'::text;
    return;
  end if;

  select *
  into v_episode
  from public.episodes
  where public.episodes.id = p_episode_id;

  if not found then
    return query select 0, 0, 'not_found'::text;
    return;
  end if;

  if not v_episode.rewarded_unlock_enabled then
    return query select 0, v_episode.required_rewarded_completions, 'disabled'::text;
    return;
  end if;

  if exists (
    select 1
    from public.episode_entitlements
    where public.episode_entitlements.user_id = v_user_id
      and public.episode_entitlements.episode_id = p_episode_id
      and (
        public.episode_entitlements.expires_at is null
        or public.episode_entitlements.expires_at > now()
      )
  ) then
    return query select v_episode.required_rewarded_completions, v_episode.required_rewarded_completions, 'complete'::text;
    return;
  end if;

  select required_completions_snapshot
  into v_target_n
  from public.rewarded_ad_attempts
  where public.rewarded_ad_attempts.user_id = v_user_id
    and public.rewarded_ad_attempts.episode_id = p_episode_id
    and public.rewarded_ad_attempts.required_completions_snapshot between 1 and 2
  order by public.rewarded_ad_attempts.created_at desc
  limit 1;

  if v_target_n is null then
    v_target_n := v_episode.required_rewarded_completions;
  end if;

  select count(*)
  into v_verified_p
  from public.rewarded_ad_attempts
  where public.rewarded_ad_attempts.user_id = v_user_id
    and public.rewarded_ad_attempts.episode_id = p_episode_id
    and public.rewarded_ad_attempts.status = 'granted'
    and public.rewarded_ad_attempts.required_completions_snapshot = v_target_n;

  if v_verified_p >= v_target_n then
    return query select v_verified_p, v_target_n, 'complete'::text;
    return;
  end if;

  if v_verified_p > 0 then
    return query select v_verified_p, v_target_n, 'partial'::text;
    return;
  end if;

  return query select 0, v_target_n, 'none'::text;
end;
$$;

grant execute on function public.get_rewarded_progress(uuid) to authenticated;
