create extension if not exists pgcrypto;

create table if not exists public.payment_provider_products (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google_play', 'apple_store', 'web', 'admin_test')),
  provider_product_id text not null check (btrim(provider_product_id) <> ''),
  product_code text not null references public.coin_products (code),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_product_id)
);

create table if not exists public.google_play_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  purchase_token_hash text not null unique check (purchase_token_hash ~ '^[a-f0-9]{64}$'),
  purchase_token_ciphertext text not null check (btrim(purchase_token_ciphertext) <> ''),
  purchase_token_key_version text not null check (btrim(purchase_token_key_version) <> ''),
  google_product_id text not null check (btrim(google_product_id) <> ''),
  product_code text not null references public.coin_products (code),
  payment_order_id uuid references public.payment_orders (id),
  google_order_id text,
  google_purchase_state text check (
    google_purchase_state is null
    or google_purchase_state in ('PURCHASED', 'CANCELLED', 'PENDING')
  ),
  google_consumption_state text check (
    google_consumption_state is null
    or google_consumption_state in ('YET_TO_BE_CONSUMED', 'CONSUMED', 'UNSPECIFIED')
  ),
  google_acknowledgement_state text check (
    google_acknowledgement_state is null
    or google_acknowledgement_state in ('ACKNOWLEDGED', 'NOT_ACKNOWLEDGED', 'UNSPECIFIED')
  ),
  quantity integer not null default 1 check (quantity > 0),
  obfuscated_external_account_id text,
  billing_region_code text check (
    billing_region_code is null
    or billing_region_code ~ '^[A-Z]{2}$'
  ),
  is_test_purchase boolean not null default false,
  purchase_completed_at timestamptz,
  last_verified_at timestamptz,
  processing_state text not null default 'pending' check (
    processing_state in ('pending', 'verified', 'consume_pending', 'consumed', 'cancelled')
  ),
  credited_at timestamptz,
  consumed_at timestamptz,
  consume_attempt_count integer not null default 0 check (consume_attempt_count >= 0),
  last_consume_attempt_at timestamptz,
  next_consume_retry_at timestamptz,
  last_error_code text check (
    last_error_code is null
    or last_error_code ~ '^[A-Za-z0-9_.:-]{1,120}$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists google_play_purchases_payment_order_unique_idx
  on public.google_play_purchases (payment_order_id)
  where payment_order_id is not null;

create unique index if not exists payment_provider_products_active_product_unique_idx
  on public.payment_provider_products (provider, product_code)
  where is_active = true;

create index if not exists payment_provider_products_active_provider_idx
  on public.payment_provider_products (provider, is_active);

create index if not exists google_play_purchases_user_created_at_idx
  on public.google_play_purchases (user_id, created_at desc);

create index if not exists google_play_purchases_processing_retry_idx
  on public.google_play_purchases (processing_state, next_consume_retry_at)
  where processing_state = 'consume_pending';

drop trigger if exists set_payment_provider_products_updated_at on public.payment_provider_products;
create trigger set_payment_provider_products_updated_at
before update on public.payment_provider_products
for each row
execute function public.set_updated_at();

drop trigger if exists set_google_play_purchases_updated_at on public.google_play_purchases;
create trigger set_google_play_purchases_updated_at
before update on public.google_play_purchases
for each row
execute function public.set_updated_at();

alter table public.payment_provider_products enable row level security;
alter table public.google_play_purchases enable row level security;

revoke all on public.payment_provider_products from anon;
revoke all on public.google_play_purchases from anon;

revoke all on public.payment_provider_products from authenticated;
revoke all on public.google_play_purchases from authenticated;

grant all on public.payment_provider_products to service_role;
grant all on public.google_play_purchases to service_role;

comment on table public.payment_provider_products is
  'Server-controlled payment-provider product mapping. Android/web clients must receive sanitized product catalog data only through trusted API routes.';

comment on table public.google_play_purchases is
  'Server-only Google Play purchase verification and consume-retry state. Purchase tokens must be HMAC-fingerprinted and encrypted by trusted backend code before persistence.';

comment on column public.google_play_purchases.purchase_token_hash is
  'Server-computed HMAC-SHA256 fingerprint of the Google purchase token. Intended future provider_transaction_id for credit_verified_coin_purchase.';

comment on column public.google_play_purchases.purchase_token_ciphertext is
  'Recoverable encrypted purchase-token envelope produced by trusted backend code for future consume retries. Never store plaintext purchase tokens.';
