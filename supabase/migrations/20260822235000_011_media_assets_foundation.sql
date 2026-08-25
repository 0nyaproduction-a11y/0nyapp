create extension if not exists pgcrypto;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  provider_name text,
  provider_asset_reference text,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (provider_name is null or btrim(provider_name) <> ''),
  check (provider_asset_reference is null or btrim(provider_asset_reference) <> ''),
  check (failure_code is null or btrim(failure_code) <> ''),
  check (failure_message is null or btrim(failure_message) <> '')
);

alter table public.episodes
  add column if not exists media_asset_id uuid;

alter table public.short_films
  add column if not exists media_asset_id uuid;

alter table public.episodes
  drop constraint if exists episodes_media_asset_id_fkey;

alter table public.episodes
  add constraint episodes_media_asset_id_fkey
    foreign key (media_asset_id) references public.media_assets (id) on delete set null;

alter table public.short_films
  drop constraint if exists short_films_media_asset_id_fkey;

alter table public.short_films
  add constraint short_films_media_asset_id_fkey
    foreign key (media_asset_id) references public.media_assets (id) on delete set null;

create index if not exists episodes_media_asset_id_idx
  on public.episodes (media_asset_id);

create index if not exists short_films_media_asset_id_idx
  on public.short_films (media_asset_id);

create index if not exists media_assets_status_created_at_idx
  on public.media_assets (status, created_at desc);

drop trigger if exists set_media_assets_updated_at on public.media_assets;
create trigger set_media_assets_updated_at
before update on public.media_assets
for each row
execute function public.set_updated_at();

alter table public.media_assets enable row level security;

revoke all on public.media_assets from anon, authenticated;
grant all on public.media_assets to service_role;

comment on table public.media_assets is
  'Provider-neutral media readiness metadata for production video assets. No consumer-facing access policy lives here.';

