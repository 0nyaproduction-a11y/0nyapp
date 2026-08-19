create extension if not exists pgcrypto;

alter table public.episodes
add column if not exists coin_price integer not null default 0 check (coin_price >= 0);

create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null,
  transaction_type text not null check (transaction_type in ('credit', 'episode_purchase', 'refund', 'promo')),
  episode_id uuid references public.episodes (id) on delete set null,
  reference text,
  created_at timestamptz not null default now(),
  check (
    (transaction_type = 'episode_purchase' and amount < 0)
    or (transaction_type in ('credit', 'refund', 'promo') and amount > 0)
  )
);

create index if not exists coin_transactions_user_created_at_idx
  on public.coin_transactions (user_id, created_at desc);

drop index if exists public.coin_transactions_one_episode_purchase_idx;

create index if not exists coin_transactions_user_episode_purchase_idx
  on public.coin_transactions (user_id, episode_id, created_at desc)
  where transaction_type = 'episode_purchase';

alter table public.coin_transactions enable row level security;

drop policy if exists "Users can read their own coin transactions" on public.coin_transactions;
create policy "Users can read their own coin transactions"
on public.coin_transactions
for select
to authenticated
using (auth.uid() = user_id);

revoke all on public.wallets from anon;
revoke all on public.episode_entitlements from anon;
revoke all on public.subscriptions from anon;
revoke all on public.coin_transactions from anon;

revoke all on public.wallets from authenticated;
revoke all on public.episode_entitlements from authenticated;
revoke all on public.subscriptions from authenticated;
revoke all on public.coin_transactions from authenticated;

grant select on public.wallets to authenticated;
grant select on public.episode_entitlements to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.coin_transactions to authenticated;

update public.episodes
set coin_price = 0
where is_free = true;

-- 10 coins is development placeholder pricing only; final business pricing will be set later.
update public.episodes
set coin_price = 10
where is_free = false
  and coin_price = 0
  and exists (
    select 1
    from public.series
    where public.series.id = public.episodes.series_id
      and public.series.slug = 'aadha-takiya'
  );

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

  if exists (
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

  if v_episode.coin_price <= 0 then
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
