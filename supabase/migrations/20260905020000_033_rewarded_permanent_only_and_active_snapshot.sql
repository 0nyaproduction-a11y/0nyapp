-- COMPAT-02B: permanent-only rewarded episode configuration.
-- Historical rewarded attempt snapshots deliberately remain unchanged so prior
-- rows can continue to be read and audited accurately.

update public.episodes
set rewarded_access_mode = 'permanent'
where rewarded_access_mode = 'session';

alter table public.episodes
  drop constraint if exists episodes_rewarded_access_mode_check;

alter table public.episodes
  add constraint episodes_rewarded_access_mode_check
  check (rewarded_access_mode = 'permanent');

-- A sequence is only in flight while its pending attempt is still valid.
-- Granted, expired, and failed attempts are historical and must not carry an
-- obsolete required-count configuration into a later sequence.
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

  select *
  into v_existing_pending
  from public.rewarded_ad_attempts
  where public.rewarded_ad_attempts.user_id = v_user_id
    and public.rewarded_ad_attempts.episode_id = p_episode_id
    and public.rewarded_ad_attempts.status = 'pending'
    and public.rewarded_ad_attempts.rewarded_access_mode_snapshot = 'permanent'
    and public.rewarded_ad_attempts.expires_at > now()
  order by public.rewarded_ad_attempts.created_at desc
  limit 1;

  if found then
    v_target_n := v_existing_pending.required_completions_snapshot;

    select count(*)
    into v_verified_p
    from public.rewarded_ad_attempts
    where public.rewarded_ad_attempts.user_id = v_user_id
      and public.rewarded_ad_attempts.episode_id = p_episode_id
      and public.rewarded_ad_attempts.status = 'granted'
      and public.rewarded_ad_attempts.required_completions_snapshot = v_target_n;

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

  v_target_n := v_episode.required_rewarded_completions;

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
    'permanent',
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
