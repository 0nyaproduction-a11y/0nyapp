create extension if not exists pgcrypto;

create table if not exists public.rewarded_ad_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  episode_id uuid not null references public.episodes (id) on delete cascade,
  provider text not null default 'google_admob' check (provider = 'google_admob'),
  custom_data text not null unique,
  rewarded_access_mode_snapshot text not null check (
    rewarded_access_mode_snapshot in ('permanent', 'session')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'granted', 'expired', 'failed', 'unsupported_pending_policy')
  ),
  expires_at timestamptz not null,
  verified_at timestamptz,
  provider_transaction_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rewarded_ad_attempts_user_episode_created_idx
  on public.rewarded_ad_attempts (user_id, episode_id, created_at desc);

create index if not exists rewarded_ad_attempts_user_custom_data_idx
  on public.rewarded_ad_attempts (user_id, custom_data);

create index if not exists rewarded_ad_attempts_status_expires_idx
  on public.rewarded_ad_attempts (status, expires_at);

drop trigger if exists set_rewarded_ad_attempts_updated_at on public.rewarded_ad_attempts;
create trigger set_rewarded_ad_attempts_updated_at
before update on public.rewarded_ad_attempts
for each row
execute function public.set_updated_at();

alter table public.rewarded_ad_attempts enable row level security;

drop policy if exists "Users can read their own rewarded ad attempts" on public.rewarded_ad_attempts;
create policy "Users can read their own rewarded ad attempts"
on public.rewarded_ad_attempts
for select
to authenticated
using (auth.uid() = user_id);

revoke all on public.rewarded_ad_attempts from anon, authenticated;

grant select on public.rewarded_ad_attempts to authenticated;

create or replace function public.create_rewarded_ad_attempt(
  p_episode_id uuid
)
returns table (
  status text,
  custom_data text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_episode public.episodes%rowtype;
  v_custom_data text;
begin
  if v_user_id is null then
    return query select 'not_authenticated'::text, null::text, null::timestamptz;
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
    return query select 'not_found'::text, null::text, null::timestamptz;
    return;
  end if;

  if v_episode.is_free then
    return query select 'already_accessible'::text, null::text, null::timestamptz;
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
    return query select 'already_accessible'::text, null::text, null::timestamptz;
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
    return query select 'already_accessible'::text, null::text, null::timestamptz;
    return;
  end if;

  if not v_episode.rewarded_unlock_enabled then
    return query select 'rewarded_disabled'::text, null::text, null::timestamptz;
    return;
  end if;

  if v_episode.rewarded_access_mode = 'session' then
    return query select 'unsupported_pending_policy'::text, null::text, null::timestamptz;
    return;
  end if;

  v_custom_data := encode(extensions.gen_random_bytes(16), 'hex');

  return query
  with inserted as (
    insert into public.rewarded_ad_attempts (
      user_id,
      episode_id,
      provider,
      custom_data,
      rewarded_access_mode_snapshot,
      status,
      expires_at
    )
    values (
      v_user_id,
      p_episode_id,
      'google_admob',
      v_custom_data,
      v_episode.rewarded_access_mode,
      'pending',
      now() + interval '15 minutes'
    )
    returning
      public.rewarded_ad_attempts.status as status,
      public.rewarded_ad_attempts.custom_data,
      public.rewarded_ad_attempts.expires_at
  )
  select inserted.status, inserted.custom_data, inserted.expires_at
  from inserted;
end;
$$;

create or replace function public.get_rewarded_ad_attempt_status(
  p_custom_data text
)
returns table (
  status text,
  custom_data text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt public.rewarded_ad_attempts%rowtype;
begin
  if v_user_id is null then
    return query select 'not_authenticated'::text, null::text, null::timestamptz;
    return;
  end if;

  select *
  into v_attempt
  from public.rewarded_ad_attempts
  where public.rewarded_ad_attempts.user_id = v_user_id
    and public.rewarded_ad_attempts.custom_data = p_custom_data
  for update;

  if not found then
    return query select 'not_found'::text, null::text, null::timestamptz;
    return;
  end if;

  if v_attempt.status = 'pending' and v_attempt.expires_at <= now() then
    update public.rewarded_ad_attempts
    set status = 'expired'
    where public.rewarded_ad_attempts.id = v_attempt.id;

    v_attempt.status := 'expired';
  end if;

  return query select v_attempt.status, v_attempt.custom_data, v_attempt.expires_at;
end;
$$;

create or replace function public.finalize_rewarded_ad_callback(
  p_custom_data text,
  p_provider_transaction_id text
)
returns table (
  success boolean,
  status text,
  custom_data text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.rewarded_ad_attempts%rowtype;
  v_conflicting_attempt_id uuid;
  v_existing_entitlement_id uuid;
begin
  if p_custom_data is null or btrim(p_custom_data) = '' then
    return query select false, 'invalid_request'::text, null::text, null::timestamptz;
    return;
  end if;

  if p_provider_transaction_id is null or btrim(p_provider_transaction_id) = '' then
    return query select false, 'invalid_request'::text, null::text, null::timestamptz;
    return;
  end if;

  select *
  into v_attempt
  from public.rewarded_ad_attempts
  where public.rewarded_ad_attempts.custom_data = p_custom_data
  for update;

  if not found then
    return query select false, 'not_found'::text, null::text, null::timestamptz;
    return;
  end if;

  if v_attempt.status = 'pending' and v_attempt.expires_at <= now() then
    update public.rewarded_ad_attempts
    set status = 'expired'
    where public.rewarded_ad_attempts.id = v_attempt.id;

    return query select false, 'expired'::text, v_attempt.custom_data, v_attempt.expires_at;
    return;
  end if;

  if v_attempt.status = 'unsupported_pending_policy' then
    return query select false, 'unsupported_pending_policy'::text, v_attempt.custom_data, v_attempt.expires_at;
    return;
  end if;

  if v_attempt.status = 'expired' then
    return query select false, 'expired'::text, v_attempt.custom_data, v_attempt.expires_at;
    return;
  end if;

  if v_attempt.status = 'failed' then
    return query select false, 'failed'::text, v_attempt.custom_data, v_attempt.expires_at;
    return;
  end if;

  if v_attempt.provider_transaction_id is not null then
    if v_attempt.provider_transaction_id = p_provider_transaction_id and v_attempt.status = 'granted' then
      return query select true, 'already_granted'::text, v_attempt.custom_data, v_attempt.expires_at;
      return;
    end if;

    if v_attempt.provider_transaction_id <> p_provider_transaction_id then
      return query select false, 'transaction_conflict'::text, v_attempt.custom_data, v_attempt.expires_at;
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
    return query select false, 'transaction_conflict'::text, v_attempt.custom_data, v_attempt.expires_at;
    return;
  end if;

  update public.rewarded_ad_attempts
  set
    provider_transaction_id = p_provider_transaction_id,
    status = 'granted',
    verified_at = now()
  where public.rewarded_ad_attempts.id = v_attempt.id;

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

  return query select true, 'granted'::text, v_attempt.custom_data, v_attempt.expires_at;
end;
$$;

revoke all on function public.create_rewarded_ad_attempt(uuid) from public;
revoke all on function public.get_rewarded_ad_attempt_status(text) from public;
revoke all on function public.finalize_rewarded_ad_callback(text, text) from public;

grant execute on function public.create_rewarded_ad_attempt(uuid) to authenticated;
grant execute on function public.get_rewarded_ad_attempt_status(text) to authenticated;
grant execute on function public.finalize_rewarded_ad_callback(text, text) to service_role;
