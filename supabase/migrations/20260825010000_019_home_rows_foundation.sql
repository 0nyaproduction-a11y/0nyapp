create extension if not exists pgcrypto;

create table if not exists public.home_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value integer not null default 5,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.home_rows (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  row_role text not null check (row_role in ('start_here', 'editorial')),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.home_row_items (
  id uuid primary key default gen_random_uuid(),
  row_id uuid not null references public.home_rows (id) on delete cascade,
  content_type text not null check (content_type in ('series', 'short_film')),
  series_id uuid references public.series (id) on delete cascade,
  short_film_id uuid references public.short_films (id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_row_items_single_content check (
    (
      content_type = 'series'
      and series_id is not null
      and short_film_id is null
    ) or (
      content_type = 'short_film'
      and short_film_id is not null
      and series_id is null
    )
  )
);

create index if not exists home_rows_enabled_sort_order_idx
  on public.home_rows (enabled, sort_order);

create index if not exists home_row_items_row_sort_order_idx
  on public.home_row_items (row_id, sort_order);

create unique index if not exists home_row_items_row_series_unique_idx
  on public.home_row_items (row_id, series_id)
  where content_type = 'series' and series_id is not null;

create unique index if not exists home_row_items_row_short_film_unique_idx
  on public.home_row_items (row_id, short_film_id)
  where content_type = 'short_film' and short_film_id is not null;

create index if not exists home_row_items_series_idx
  on public.home_row_items (series_id)
  where series_id is not null;

create index if not exists home_row_items_short_film_idx
  on public.home_row_items (short_film_id)
  where short_film_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

drop trigger if exists set_home_settings_updated_at on public.home_settings;
create trigger set_home_settings_updated_at
before update on public.home_settings
for each row
execute function public.set_updated_at();

drop trigger if exists set_home_rows_updated_at on public.home_rows;
create trigger set_home_rows_updated_at
before update on public.home_rows
for each row
execute function public.set_updated_at();

drop trigger if exists set_home_row_items_updated_at on public.home_row_items;
create trigger set_home_row_items_updated_at
before update on public.home_row_items
for each row
execute function public.set_updated_at();

alter table public.home_settings enable row level security;
alter table public.home_rows enable row level security;
alter table public.home_row_items enable row level security;

drop policy if exists "Public can read home settings" on public.home_settings;
create policy "Public can read home settings"
on public.home_settings
for select
to anon, authenticated
using (true);

drop policy if exists "Public can read enabled home rows" on public.home_rows;
create policy "Public can read enabled home rows"
on public.home_rows
for select
to anon, authenticated
using (enabled = true);

drop policy if exists "Public can read home row items" on public.home_row_items;
create policy "Public can read home row items"
on public.home_row_items
for select
to anon, authenticated
using (exists (
  select 1
  from public.home_rows
  where public.home_rows.id = public.home_row_items.row_id
    and public.home_rows.enabled = true
));

revoke insert, update, delete on public.home_settings from anon, authenticated;
revoke insert, update, delete on public.home_rows from anon, authenticated;
revoke insert, update, delete on public.home_row_items from anon, authenticated;

grant select on public.home_settings to anon, authenticated;
grant select on public.home_rows to anon, authenticated;
grant select on public.home_row_items to anon, authenticated;

insert into public.home_settings (key, value, description)
values ('low_history_threshold', 5, 'Completed content count used to exit the Start Here state for low-history viewers.')
on conflict (key) do update
set value = excluded.value,
    description = excluded.description,
    updated_at = now();

insert into public.home_rows (title, row_role, enabled, sort_order)
select 'Start Here', 'start_here', true, 10
where not exists (
  select 1 from public.home_rows where row_role = 'start_here'
);

