create extension if not exists pgcrypto;

alter table public.media_assets
  add column if not exists provider_upload_reference text,
  add column if not exists provider_playback_reference text;

alter table public.media_assets
  drop constraint if exists media_assets_provider_upload_reference_check;

alter table public.media_assets
  add constraint media_assets_provider_upload_reference_check
    check (provider_upload_reference is null or btrim(provider_upload_reference) <> '');

alter table public.media_assets
  drop constraint if exists media_assets_provider_playback_reference_check;

alter table public.media_assets
  add constraint media_assets_provider_playback_reference_check
    check (provider_playback_reference is null or btrim(provider_playback_reference) <> '');

create index if not exists media_assets_provider_upload_reference_idx
  on public.media_assets (provider_upload_reference);

create index if not exists media_assets_provider_asset_reference_idx
  on public.media_assets (provider_asset_reference);

create index if not exists media_assets_provider_playback_reference_idx
  on public.media_assets (provider_playback_reference);
