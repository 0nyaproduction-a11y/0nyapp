create extension if not exists pgcrypto;

alter table public.media_assets
  add column if not exists source_media_asset_id uuid,
  add column if not exists clip_start_seconds integer,
  add column if not exists clip_end_seconds integer;

alter table public.media_assets
  drop constraint if exists media_assets_source_media_asset_id_fkey;

alter table public.media_assets
  add constraint media_assets_source_media_asset_id_fkey
    foreign key (source_media_asset_id) references public.media_assets (id) on delete set null;

alter table public.media_assets
  drop constraint if exists media_assets_preview_clip_check;

alter table public.media_assets
  add constraint media_assets_preview_clip_check
    check (
      (
        source_media_asset_id is null
        and clip_start_seconds is null
        and clip_end_seconds is null
      )
      or (
        source_media_asset_id is not null
        and source_media_asset_id <> id
        and clip_start_seconds is not null
        and clip_start_seconds >= 0
        and clip_end_seconds is not null
        and clip_end_seconds > clip_start_seconds
      )
    );

create index if not exists media_assets_source_media_asset_id_idx
  on public.media_assets (source_media_asset_id);

alter table public.episodes
  add column if not exists preview_media_asset_id uuid;

alter table public.episodes
  drop constraint if exists episodes_preview_media_asset_id_fkey;

alter table public.episodes
  add constraint episodes_preview_media_asset_id_fkey
    foreign key (preview_media_asset_id) references public.media_assets (id) on delete set null;

alter table public.episodes
  drop constraint if exists episodes_preview_media_asset_not_full_check;

alter table public.episodes
  add constraint episodes_preview_media_asset_not_full_check
    check (preview_media_asset_id is null or preview_media_asset_id <> media_asset_id);

create index if not exists episodes_preview_media_asset_id_idx
  on public.episodes (preview_media_asset_id);
