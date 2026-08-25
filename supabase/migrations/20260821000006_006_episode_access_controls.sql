-- Adds the missing per-episode commercial access controls required by the
-- Product Bible (coin unlock, rewarded-ad unlock, Plus eligibility, locked
-- preview duration) without renaming or touching existing is_free/coin_price
-- columns or any historical migration (002/003/004/005).

alter table public.episodes
add column if not exists coin_unlock_enabled boolean not null default false;

alter table public.episodes
add column if not exists rewarded_unlock_enabled boolean not null default false;

alter table public.episodes
add column if not exists rewarded_access_mode text not null default 'permanent'
  check (rewarded_access_mode in ('permanent', 'session'));

alter table public.episodes
add column if not exists plus_access boolean not null default true;

alter table public.episodes
add column if not exists locked_preview_seconds integer not null default 0
  check (locked_preview_seconds between 0 and 3);

-- Compatibility backfill: only turn coin unlock on for episodes that already
-- carry a positive coin_price. This must NOT globally enable coin unlock for
-- every existing non-free episode.
update public.episodes
set coin_unlock_enabled = true
where coin_price > 0;

-- Where practical, keep coin_unlock_enabled consistent with a positive
-- coin_price. The backfill above already guarantees this holds for existing
-- rows, so this constraint validates immediately without breaking data.
alter table public.episodes
add constraint episodes_coin_unlock_requires_price
  check (not coin_unlock_enabled or coin_price > 0);

-- Replace purchase_episode_with_coins (originally defined in 004) so the
-- Plus subscription short-circuit only applies when the episode explicitly
-- allows Plus access, and so coin purchase respects coin_unlock_enabled.
-- Signature, wallet/transaction architecture, and return shape are unchanged.
create or replace function public.purchase_episode_with_coins(p_episode_id uuid)
returns table (
  success boolean,
  status text,
  remaining_balance integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_episode public.episodes%rowtype;
  v_wallet public.wallets%rowtype;
begin
  if v_user_id is null then
    return query select false, 'not_authenticated'::text, null::integer;
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
    return query select false, 'invalid_episode'::text, null::integer;
    return;
  end if;

  if v_episode.is_free then
    select public.wallets.coin_balance
    into remaining_balance
    from public.wallets
    where public.wallets.user_id = v_user_id;

    return query select true, 'already_accessible'::text, remaining_balance;
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
    select public.wallets.coin_balance
    into remaining_balance
    from public.wallets
    where public.wallets.user_id = v_user_id;

    return query select true, 'already_owned'::text, remaining_balance;
    return;
  end if;

  -- The active-subscription short-circuit may only cover this episode when
  -- the episode itself still allows Plus access. If plus_access is false,
  -- an otherwise coin-enabled episode must fall through to its normal
  -- coin-unlock flow below instead of being treated as already accessible.
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
    select public.wallets.coin_balance
    into remaining_balance
    from public.wallets
    where public.wallets.user_id = v_user_id;

    return query select true, 'active_subscription'::text, remaining_balance;
    return;
  end if;

  -- Coin purchase requires coin unlock to be explicitly enabled for this
  -- episode, in addition to the existing positive coin_price requirement.
  if not v_episode.coin_unlock_enabled or v_episode.coin_price <= 0 then
    return query select false, 'invalid_episode'::text, null::integer;
    return;
  end if;

  select *
  into v_wallet
  from public.wallets
  where public.wallets.user_id = v_user_id
  for update;

  if not found then
    insert into public.wallets (user_id)
    values (v_user_id)
    on conflict (user_id) do nothing;

    select *
    into v_wallet
    from public.wallets
    where public.wallets.user_id = v_user_id
    for update;
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
    return query select true, 'already_owned'::text, v_wallet.coin_balance;
    return;
  end if;

  if v_wallet.coin_balance < v_episode.coin_price then
    return query select false, 'insufficient_balance'::text, v_wallet.coin_balance;
    return;
  end if;

  update public.wallets
  set coin_balance = public.wallets.coin_balance - v_episode.coin_price
  where public.wallets.user_id = v_user_id
  returning public.wallets.coin_balance into remaining_balance;

  insert into public.coin_transactions (
    user_id,
    amount,
    transaction_type,
    episode_id,
    reference
  )
  values (
    v_user_id,
    -v_episode.coin_price,
    'episode_purchase',
    p_episode_id,
    'episode_purchase'
  );

  insert into public.episode_entitlements (
    user_id,
    episode_id,
    source,
    expires_at
  )
  values (
    v_user_id,
    p_episode_id,
    'purchase',
    null
  )
  on conflict (user_id, episode_id) do update
  set
    source = 'purchase',
    expires_at = null;

  return query select true, 'purchase_success'::text, remaining_balance;
end;
$$;

revoke all on function public.purchase_episode_with_coins(uuid) from public;
grant execute on function public.purchase_episode_with_coins(uuid) to authenticated;
