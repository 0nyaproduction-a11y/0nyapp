create extension if not exists pgcrypto;

create table if not exists public.creator_accounting_destinations (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  accounting_reference text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (accounting_reference is null or btrim(accounting_reference) <> '')
);

create table if not exists public.short_film_chai_destinations (
  short_film_id uuid primary key references public.short_films (id) on delete cascade,
  creator_destination_id uuid not null references public.creator_accounting_destinations (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chai_allowed_coin_amounts (
  id uuid primary key default gen_random_uuid(),
  coin_amount integer not null check (coin_amount > 0),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coin_amount)
);

create table if not exists public.chai_tip_requests (
  id uuid primary key default gen_random_uuid(),
  viewer_user_id uuid not null references auth.users (id) on delete cascade,
  short_film_id uuid not null references public.short_films (id) on delete cascade,
  creator_destination_id uuid not null references public.creator_accounting_destinations (id),
  coin_amount integer not null check (coin_amount > 0),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  status text not null default 'pending' check (
    status in ('pending', 'completed', 'insufficient_balance', 'failed')
  ),
  remaining_balance integer check (remaining_balance is null or remaining_balance >= 0),
  coin_transaction_id uuid unique references public.coin_transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chai_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  chai_tip_request_id uuid unique references public.chai_tip_requests (id) on delete set null,
  viewer_user_id uuid references auth.users (id) on delete set null,
  short_film_id uuid not null references public.short_films (id) on delete restrict,
  creator_destination_id uuid not null references public.creator_accounting_destinations (id) on delete restrict,
  viewer_coin_transaction_id uuid unique references public.coin_transactions (id) on delete set null,
  coin_amount integer not null check (coin_amount > 0),
  entry_type text not null check (entry_type in ('credit', 'reversal', 'adjustment')),
  status text not null default 'posted' check (status in ('posted', 'reversed', 'adjusted', 'voided')),
  original_tip_entry_id uuid references public.chai_ledger_entries (id) on delete set null,
  related_entry_id uuid references public.chai_ledger_entries (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coin_transactions
  add column if not exists short_film_id uuid,
  add column if not exists chai_tip_request_id uuid,
  add column if not exists chai_ledger_entry_id uuid,
  add column if not exists related_transaction_id uuid;

alter table public.coin_transactions
  drop constraint if exists coin_transactions_short_film_id_fkey;

alter table public.coin_transactions
  add constraint coin_transactions_short_film_id_fkey
    foreign key (short_film_id) references public.short_films (id) on delete set null;

alter table public.coin_transactions
  drop constraint if exists coin_transactions_chai_tip_request_id_fkey;

alter table public.coin_transactions
  add constraint coin_transactions_chai_tip_request_id_fkey
    foreign key (chai_tip_request_id) references public.chai_tip_requests (id) on delete set null;

alter table public.coin_transactions
  drop constraint if exists coin_transactions_chai_ledger_entry_id_fkey;

alter table public.coin_transactions
  add constraint coin_transactions_chai_ledger_entry_id_fkey
    foreign key (chai_ledger_entry_id) references public.chai_ledger_entries (id) on delete set null;

alter table public.coin_transactions
  drop constraint if exists coin_transactions_related_transaction_id_fkey;

alter table public.coin_transactions
  add constraint coin_transactions_related_transaction_id_fkey
    foreign key (related_transaction_id) references public.coin_transactions (id) on delete set null;

alter table public.coin_transactions
  drop constraint if exists coin_transactions_check;

alter table public.coin_transactions
  drop constraint if exists coin_transactions_transaction_type_check;

alter table public.coin_transactions
  add constraint coin_transactions_transaction_type_check
  check (
    transaction_type in (
      'credit',
      'episode_purchase',
      'refund',
      'promo',
      'chai_tip',
      'chai_refund',
      'chai_adjustment'
    )
  );

alter table public.coin_transactions
  add constraint coin_transactions_amount_direction_check
  check (
    (transaction_type = 'episode_purchase' and amount < 0)
    or (transaction_type in ('credit', 'refund', 'promo', 'chai_refund') and amount > 0)
    or (transaction_type = 'chai_tip' and amount < 0)
    or (transaction_type = 'chai_adjustment' and amount <> 0)
  );

create unique index if not exists chai_tip_requests_viewer_film_key_idx
  on public.chai_tip_requests (viewer_user_id, short_film_id, idempotency_key);

create unique index if not exists chai_ledger_entries_request_unique_idx
  on public.chai_ledger_entries (chai_tip_request_id)
  where chai_tip_request_id is not null;

create index if not exists chai_ledger_entries_film_created_at_idx
  on public.chai_ledger_entries (short_film_id, created_at desc);

create index if not exists chai_ledger_entries_destination_created_at_idx
  on public.chai_ledger_entries (creator_destination_id, created_at desc);

create index if not exists chai_tip_requests_user_created_at_idx
  on public.chai_tip_requests (viewer_user_id, created_at desc);

drop trigger if exists set_creator_accounting_destinations_updated_at on public.creator_accounting_destinations;
create trigger set_creator_accounting_destinations_updated_at
before update on public.creator_accounting_destinations
for each row
execute function public.set_updated_at();

drop trigger if exists set_short_film_chai_destinations_updated_at on public.short_film_chai_destinations;
create trigger set_short_film_chai_destinations_updated_at
before update on public.short_film_chai_destinations
for each row
execute function public.set_updated_at();

drop trigger if exists set_chai_allowed_coin_amounts_updated_at on public.chai_allowed_coin_amounts;
create trigger set_chai_allowed_coin_amounts_updated_at
before update on public.chai_allowed_coin_amounts
for each row
execute function public.set_updated_at();

drop trigger if exists set_chai_tip_requests_updated_at on public.chai_tip_requests;
create trigger set_chai_tip_requests_updated_at
before update on public.chai_tip_requests
for each row
execute function public.set_updated_at();

drop trigger if exists set_chai_ledger_entries_updated_at on public.chai_ledger_entries;
create trigger set_chai_ledger_entries_updated_at
before update on public.chai_ledger_entries
for each row
execute function public.set_updated_at();

alter table public.creator_accounting_destinations enable row level security;
alter table public.short_film_chai_destinations enable row level security;
alter table public.chai_allowed_coin_amounts enable row level security;
alter table public.chai_tip_requests enable row level security;
alter table public.chai_ledger_entries enable row level security;

revoke all on public.creator_accounting_destinations from anon, authenticated;
revoke all on public.short_film_chai_destinations from anon, authenticated;
revoke all on public.chai_allowed_coin_amounts from anon, authenticated;
revoke all on public.chai_tip_requests from anon, authenticated;
revoke all on public.chai_ledger_entries from anon, authenticated;

grant all on public.creator_accounting_destinations to service_role;
grant all on public.short_film_chai_destinations to service_role;
grant all on public.chai_allowed_coin_amounts to service_role;
grant all on public.chai_tip_requests to service_role;
grant all on public.chai_ledger_entries to service_role;

create or replace function public.get_short_film_chai_details(p_short_film_slug text)
returns table (
  available boolean,
  allowed_coin_amounts integer[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_short_film public.short_films%rowtype;
  v_short_film_found boolean := false;
  v_allowed_coin_amounts integer[];
  v_has_destination boolean;
begin
  select *
  into v_short_film
  from public.short_films
  where public.short_films.slug = p_short_film_slug
    and public.short_films.status = 'published'
    and (
      public.short_films.publish_at is null
      or public.short_films.publish_at <= now()
    );
  v_short_film_found := found;

  select coalesce(
    array_agg(public.chai_allowed_coin_amounts.coin_amount order by public.chai_allowed_coin_amounts.sort_order, public.chai_allowed_coin_amounts.coin_amount),
    '{}'::integer[]
  )
  into v_allowed_coin_amounts
  from public.chai_allowed_coin_amounts
  where public.chai_allowed_coin_amounts.enabled = true;

  if v_short_film_found then
    select exists (
      select 1
      from public.short_film_chai_destinations
      join public.creator_accounting_destinations
        on public.creator_accounting_destinations.id = public.short_film_chai_destinations.creator_destination_id
      where public.short_film_chai_destinations.short_film_id = v_short_film.id
        and public.creator_accounting_destinations.is_active = true
    )
    into v_has_destination;
  else
    v_has_destination := false;
  end if;

  available := v_short_film_found
    and coalesce(v_short_film.chai_enabled, false)
    and v_has_destination
    and cardinality(v_allowed_coin_amounts) > 0;
  allowed_coin_amounts := v_allowed_coin_amounts;
  return next;
end;
$$;

create or replace function public.submit_short_film_chai_tip(
  p_short_film_slug text,
  p_coin_amount integer,
  p_idempotency_key text
)
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
  v_short_film public.short_films%rowtype;
  v_allowed boolean;
  v_destination public.creator_accounting_destinations%rowtype;
  v_wallet public.wallets%rowtype;
  v_request public.chai_tip_requests%rowtype;
  v_coin_transaction_id uuid;
  v_ledger_entry_id uuid;
  v_remaining_balance integer;
begin
  if v_user_id is null then
    return query select false, 'not_authenticated'::text, null::integer;
    return;
  end if;

  if p_coin_amount is null or p_coin_amount <= 0 then
    return query select false, 'invalid_amount'::text, null::integer;
    return;
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    return query select false, 'invalid_request'::text, null::integer;
    return;
  end if;

  select *
  into v_short_film
  from public.short_films
  where public.short_films.slug = p_short_film_slug
    and public.short_films.status = 'published'
    and (
      public.short_films.publish_at is null
      or public.short_films.publish_at <= now()
    );

  if not found then
    return query select false, 'invalid_short_film'::text, null::integer;
    return;
  end if;

  if not v_short_film.chai_enabled then
    return query select false, 'chai_disabled'::text, null::integer;
    return;
  end if;

  select public.creator_accounting_destinations.*
  into v_destination
  from public.creator_accounting_destinations
  join public.short_film_chai_destinations
    on public.short_film_chai_destinations.creator_destination_id = public.creator_accounting_destinations.id
  where public.short_film_chai_destinations.short_film_id = v_short_film.id
    and public.creator_accounting_destinations.is_active = true;

  if not found then
    return query select false, 'inactive_destination'::text, null::integer;
    return;
  end if;

  select exists (
    select 1
    from public.chai_allowed_coin_amounts
    where public.chai_allowed_coin_amounts.coin_amount = p_coin_amount
      and public.chai_allowed_coin_amounts.enabled = true
  )
  into v_allowed;

  if not v_allowed then
    return query select false, 'invalid_amount'::text, null::integer;
    return;
  end if;

  insert into public.chai_tip_requests (
    viewer_user_id,
    short_film_id,
    creator_destination_id,
    coin_amount,
    idempotency_key,
    status
  )
  values (
    v_user_id,
    v_short_film.id,
    v_destination.id,
    p_coin_amount,
    p_idempotency_key,
    'pending'
  )
  on conflict (viewer_user_id, short_film_id, idempotency_key) do nothing
  returning * into v_request;

  if not found then
    select *
    into v_request
    from public.chai_tip_requests
    where public.chai_tip_requests.viewer_user_id = v_user_id
      and public.chai_tip_requests.short_film_id = v_short_film.id
      and public.chai_tip_requests.idempotency_key = p_idempotency_key;

    if v_request.coin_amount is distinct from p_coin_amount then
      return query select false, 'transaction_conflict'::text, v_request.remaining_balance;
      return;
    end if;

    if v_request.status = 'completed' then
      return query select true, 'already_processed'::text, v_request.remaining_balance;
      return;
    end if;

    if v_request.status = 'insufficient_balance' then
      return query select false, 'insufficient_balance'::text, v_request.remaining_balance;
      return;
    end if;

    return query select false, 'transaction_conflict'::text, v_request.remaining_balance;
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

  if v_wallet.coin_balance < p_coin_amount then
    update public.chai_tip_requests
    set
      status = 'insufficient_balance',
      remaining_balance = v_wallet.coin_balance
    where public.chai_tip_requests.id = v_request.id;

    return query select false, 'insufficient_balance'::text, v_wallet.coin_balance;
    return;
  end if;

  update public.wallets
  set coin_balance = public.wallets.coin_balance - p_coin_amount
  where public.wallets.user_id = v_user_id
  returning public.wallets.coin_balance into v_remaining_balance;

  insert into public.coin_transactions (
    user_id,
    amount,
    transaction_type,
    short_film_id,
    chai_tip_request_id,
    reference
  )
  values (
    v_user_id,
    -p_coin_amount,
    'chai_tip',
    v_short_film.id,
    v_request.id,
    p_idempotency_key
  )
  returning public.coin_transactions.id into v_coin_transaction_id;

  insert into public.chai_ledger_entries (
    chai_tip_request_id,
    viewer_user_id,
    short_film_id,
    creator_destination_id,
    viewer_coin_transaction_id,
    coin_amount,
    entry_type,
    status
  )
  values (
    v_request.id,
    v_user_id,
    v_short_film.id,
    v_destination.id,
    v_coin_transaction_id,
    p_coin_amount,
    'credit',
    'posted'
  )
  returning public.chai_ledger_entries.id into v_ledger_entry_id;

  update public.coin_transactions
  set chai_ledger_entry_id = v_ledger_entry_id
  where public.coin_transactions.id = v_coin_transaction_id;

  update public.chai_tip_requests
  set
    status = 'completed',
    remaining_balance = v_remaining_balance,
    coin_transaction_id = v_coin_transaction_id
  where public.chai_tip_requests.id = v_request.id;

  return query select true, 'tip_success'::text, v_remaining_balance;
end;
$$;

revoke all on function public.get_short_film_chai_details(text) from public;
revoke all on function public.submit_short_film_chai_tip(text, integer, text) from public;

grant execute on function public.get_short_film_chai_details(text) to anon, authenticated;
grant execute on function public.submit_short_film_chai_tip(text, integer, text) to authenticated;

comment on table public.creator_accounting_destinations is
  'Internal creator/accounting destination registry for Chai and future creator reporting. No auth.users ownership is implied.';

comment on table public.short_film_chai_destinations is
  'Exactly one active creator/accounting destination may back a Chai-enabled short film.';

comment on table public.chai_allowed_coin_amounts is
  'Backend-owned allowed coin tip amounts for Chai. Android/web must read these values rather than hardcoding them.';

comment on table public.chai_tip_requests is
  'Idempotent viewer Chai request log used to prevent double debit and double creator credit.';

comment on table public.chai_ledger_entries is
  'Internal creator/film Chai ledger. Viewer identity may exist for reconciliation but must not leak through creator-facing APIs.';

comment on function public.get_short_film_chai_details(text) is
  'Returns only the safe Chai availability signal and allowed coin amounts for a published short film.';

comment on function public.submit_short_film_chai_tip(text, integer, text) is
  'Atomic viewer Chai debit plus creator ledger credit. Call from trusted backend routes only.';
