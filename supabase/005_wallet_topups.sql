create extension if not exists pgcrypto;

create table if not exists public.coin_products (
  code text primary key,
  coin_amount integer not null check (coin_amount > 0),
  display_name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  provider text not null check (provider in ('google_play', 'apple_store', 'web', 'admin_test')),
  provider_order_id text,
  provider_transaction_id text,
  product_code text not null references public.coin_products (code),
  coin_amount integer not null check (coin_amount > 0),
  amount_minor integer,
  currency text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'rejected')),
  verified_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_orders
alter column user_id drop not null;

alter table public.payment_orders
drop constraint if exists payment_orders_user_id_fkey;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_orders_user_id_fkey'
      and conrelid = 'public.payment_orders'::regclass
  ) then
    alter table public.payment_orders
    add constraint payment_orders_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete set null;
  end if;
end;
$$;

alter table public.coin_transactions
alter column user_id drop not null;

alter table public.coin_transactions
drop constraint if exists coin_transactions_user_id_fkey;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'coin_transactions_user_id_fkey'
      and conrelid = 'public.coin_transactions'::regclass
  ) then
    alter table public.coin_transactions
    add constraint coin_transactions_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete set null;
  end if;
end;
$$;

alter table public.coin_transactions
add column if not exists payment_order_id uuid references public.payment_orders (id) on delete set null;

create unique index if not exists payment_orders_provider_transaction_unique_idx
  on public.payment_orders (provider, provider_transaction_id)
  where provider_transaction_id is not null;

create unique index if not exists coin_transactions_one_credit_per_payment_order_idx
  on public.coin_transactions (payment_order_id)
  where transaction_type = 'credit'
    and payment_order_id is not null;

create index if not exists payment_orders_user_created_at_idx
  on public.payment_orders (user_id, created_at desc);

create index if not exists payment_orders_pending_verification_idx
  on public.payment_orders (provider, created_at)
  where status = 'pending'
    and verification_status = 'unverified';

create index if not exists coin_products_active_sort_order_idx
  on public.coin_products (active, sort_order);

drop trigger if exists set_coin_products_updated_at on public.coin_products;
create trigger set_coin_products_updated_at
before update on public.coin_products
for each row
execute function public.set_updated_at();

drop trigger if exists set_payment_orders_updated_at on public.payment_orders;
create trigger set_payment_orders_updated_at
before update on public.payment_orders
for each row
execute function public.set_updated_at();

alter table public.coin_products enable row level security;
alter table public.payment_orders enable row level security;

drop policy if exists "Viewers can read active coin products" on public.coin_products;
create policy "Viewers can read active coin products"
on public.coin_products
for select
to anon, authenticated
using (active = true);

drop policy if exists "Users can read their own payment orders" on public.payment_orders;
create policy "Users can read their own payment orders"
on public.payment_orders
for select
to authenticated
using (auth.uid() = user_id);

revoke all on public.coin_products from anon;
revoke all on public.payment_orders from anon;

revoke all on public.coin_products from authenticated;
revoke all on public.payment_orders from authenticated;

grant select on public.coin_products to anon, authenticated;
grant select on public.payment_orders to authenticated;

insert into public.coin_products (
  code,
  coin_amount,
  display_name,
  active,
  sort_order
)
values
  ('coins_50', 50, '50 coins', true, 10),
  ('coins_100', 100, '100 coins', true, 20),
  ('coins_250', 250, '250 coins', true, 30)
-- Preserve existing rows so future production/store configuration is not reset by rerunning this migration.
on conflict (code) do nothing;

comment on table public.coin_products is
  'Development placeholder coin packs only. Final Android, iOS, and web pricing will come from store or payment-provider product configuration.';

create or replace function public.credit_verified_coin_purchase(
  p_user_id uuid,
  p_provider text,
  p_provider_transaction_id text,
  p_product_code text,
  p_reference text default null
)
returns table (
  success boolean,
  status text,
  credited_coins integer,
  new_balance integer,
  payment_order_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.coin_products%rowtype;
  v_wallet public.wallets%rowtype;
  v_existing_order public.payment_orders%rowtype;
  v_order_id uuid;
  v_reference text;
begin
  if p_user_id is null then
    return query select false, 'invalid_user'::text, 0, null::integer, null::uuid;
    return;
  end if;

  if not exists (
    select 1
    from auth.users
    where auth.users.id = p_user_id
  ) then
    return query select false, 'invalid_user'::text, 0, null::integer, null::uuid;
    return;
  end if;

  if p_provider not in ('google_play', 'apple_store', 'web', 'admin_test') then
    return query select false, 'invalid_provider'::text, 0, null::integer, null::uuid;
    return;
  end if;

  if p_provider_transaction_id is null or btrim(p_provider_transaction_id) = '' then
    return query select false, 'invalid_transaction'::text, 0, null::integer, null::uuid;
    return;
  end if;

  select *
  into v_product
  from public.coin_products
  where public.coin_products.code = p_product_code
    and public.coin_products.active = true;

  if not found then
    return query select false, 'invalid_product'::text, 0, null::integer, null::uuid;
    return;
  end if;

  select *
  into v_existing_order
  from public.payment_orders
  where public.payment_orders.provider = p_provider
    and public.payment_orders.provider_transaction_id = p_provider_transaction_id
  for update;

  if found then
    if v_existing_order.user_id is distinct from p_user_id
      or v_existing_order.product_code is distinct from p_product_code then
      return query select false, 'transaction_conflict'::text, 0, null::integer, v_existing_order.id;
      return;
    end if;

    if v_existing_order.status = 'completed'
      and v_existing_order.verification_status = 'verified' then
      select public.wallets.coin_balance
      into new_balance
      from public.wallets
      where public.wallets.user_id = p_user_id;

      return query select true, 'already_processed'::text, 0, new_balance, v_existing_order.id;
      return;
    end if;

    if v_existing_order.status <> 'pending'
      or v_existing_order.verification_status <> 'unverified' then
      return query select false, 'transaction_conflict'::text, 0, null::integer, v_existing_order.id;
      return;
    end if;

    v_order_id := v_existing_order.id;
  end if;

  select *
  into v_wallet
  from public.wallets
  where public.wallets.user_id = p_user_id
  for update;

  if not found then
    insert into public.wallets (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    select *
    into v_wallet
    from public.wallets
    where public.wallets.user_id = p_user_id
    for update;
  end if;

  select *
  into v_existing_order
  from public.payment_orders
  where public.payment_orders.provider = p_provider
    and public.payment_orders.provider_transaction_id = p_provider_transaction_id
  for update;

  if found then
    if v_existing_order.user_id is distinct from p_user_id
      or v_existing_order.product_code is distinct from p_product_code then
      return query select false, 'transaction_conflict'::text, 0, v_wallet.coin_balance, v_existing_order.id;
      return;
    end if;

    if v_existing_order.status = 'completed'
      and v_existing_order.verification_status = 'verified' then
      return query select true, 'already_processed'::text, 0, v_wallet.coin_balance, v_existing_order.id;
      return;
    end if;

    if v_existing_order.status <> 'pending'
      or v_existing_order.verification_status <> 'unverified' then
      return query select false, 'transaction_conflict'::text, 0, v_wallet.coin_balance, v_existing_order.id;
      return;
    end if;

    v_order_id := v_existing_order.id;
  end if;

  if v_order_id is not null then
    update public.payment_orders
    set
      coin_amount = v_product.coin_amount,
      status = 'completed',
      verification_status = 'verified',
      verified_at = now(),
      completed_at = now()
    where public.payment_orders.id = v_order_id
    returning public.payment_orders.id into v_order_id;
  else
    insert into public.payment_orders (
      user_id,
      provider,
      provider_transaction_id,
      product_code,
      coin_amount,
      status,
      verification_status,
      verified_at,
      completed_at
    )
    values (
      p_user_id,
      p_provider,
      p_provider_transaction_id,
      v_product.code,
      v_product.coin_amount,
      'completed',
      'verified',
      now(),
      now()
    )
    on conflict (provider, provider_transaction_id) where provider_transaction_id is not null
    do nothing
    returning public.payment_orders.id into v_order_id;

    if v_order_id is null then
      select *
      into v_existing_order
      from public.payment_orders
      where public.payment_orders.provider = p_provider
        and public.payment_orders.provider_transaction_id = p_provider_transaction_id;

      if v_existing_order.user_id is distinct from p_user_id
        or v_existing_order.product_code is distinct from p_product_code then
        return query select false, 'transaction_conflict'::text, 0, v_wallet.coin_balance, v_existing_order.id;
        return;
      end if;

      return query select true, 'already_processed'::text, 0, v_wallet.coin_balance, v_existing_order.id;
      return;
    end if;
  end if;

  if exists (
    select 1
    from public.coin_transactions
    where public.coin_transactions.payment_order_id = v_order_id
      and public.coin_transactions.transaction_type = 'credit'
  ) then
    select public.wallets.coin_balance
    into new_balance
    from public.wallets
    where public.wallets.user_id = p_user_id;

    return query select true, 'already_processed'::text, 0, new_balance, v_order_id;
    return;
  end if;

  update public.wallets
  set coin_balance = public.wallets.coin_balance + v_product.coin_amount
  where public.wallets.user_id = p_user_id
  returning public.wallets.coin_balance into new_balance;

  v_reference := coalesce(
    nullif(p_reference, ''),
    p_provider || ':' || p_provider_transaction_id
  );

  insert into public.coin_transactions (
    user_id,
    amount,
    transaction_type,
    payment_order_id,
    reference
  )
  values (
    p_user_id,
    v_product.coin_amount,
    'credit',
    v_order_id,
    v_reference
  );

  return query select true, 'credited'::text, v_product.coin_amount, new_balance, v_order_id;
end;
$$;

revoke all on function public.credit_verified_coin_purchase(uuid, text, text, text, text) from public;
revoke all on function public.credit_verified_coin_purchase(uuid, text, text, text, text) from anon;
revoke all on function public.credit_verified_coin_purchase(uuid, text, text, text, text) from authenticated;
grant execute on function public.credit_verified_coin_purchase(uuid, text, text, text, text) to service_role;

comment on function public.credit_verified_coin_purchase(uuid, text, text, text, text) is
  'The service_role credential must only be used by trusted server/provider verification infrastructure, never browser/mobile client code. Android: Google Play Billing purchase -> backend token verification -> wallet credited. iOS: StoreKit purchase -> backend App Store verification -> wallet credited. Web: payment provider webhook/server verification -> wallet credited.';
