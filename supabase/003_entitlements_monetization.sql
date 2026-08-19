create table if not exists public.wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  coin_balance integer not null default 0 check (coin_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.episode_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  episode_id uuid not null references public.episodes (id) on delete cascade,
  source text not null check (source in ('purchase', 'rewarded_ad', 'promo', 'admin')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, episode_id)
);

comment on table public.episode_entitlements is
  'Future trusted grant flows must upsert the single entitlement row for a user and episode. rewarded_ad or promo may later be replaced by purchase, and purchase may clear expires_at for permanent ownership.';

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'inactive' check (status in ('inactive', 'active', 'expired', 'cancelled')),
  plan_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create unique index if not exists subscriptions_one_active_per_user_idx
  on public.subscriptions (user_id)
  where status = 'active';

drop trigger if exists set_wallets_updated_at on public.wallets;
create trigger set_wallets_updated_at
before update on public.wallets
for each row
execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    display_name,
    avatar_url
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

insert into public.wallets (user_id)
select auth.users.id
from auth.users
on conflict (user_id) do nothing;

alter table public.wallets enable row level security;
alter table public.episode_entitlements enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "Users can read their own wallet" on public.wallets;
create policy "Users can read their own wallet"
on public.wallets
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own episode entitlements" on public.episode_entitlements;
create policy "Users can read their own episode entitlements"
on public.episode_entitlements
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own subscriptions" on public.subscriptions;
create policy "Users can read their own subscriptions"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

revoke all on public.wallets from anon;
revoke all on public.episode_entitlements from anon;
revoke all on public.subscriptions from anon;

revoke insert, update, delete
on public.wallets
from authenticated;

revoke insert, update, delete
on public.episode_entitlements
from authenticated;

revoke insert, update, delete
on public.subscriptions
from authenticated;

grant select on public.wallets to authenticated;
grant select on public.episode_entitlements to authenticated;
grant select on public.subscriptions to authenticated;
