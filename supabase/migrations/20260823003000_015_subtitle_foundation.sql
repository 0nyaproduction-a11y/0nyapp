create extension if not exists pgcrypto;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'content-subtitles',
  'content-subtitles',
  false,
  1048576,
  array['application/x-subrip', 'text/plain', 'text/vtt']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.subtitle_tracks (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  episode_id uuid references public.episodes(id) on delete cascade,
  short_film_id uuid references public.short_films(id) on delete cascade,
  language_code text not null,
  label text not null,
  source_format text not null,
  closed_captions boolean not null default false,
  is_default boolean not null default false,
  source_bucket text not null default 'content-subtitles',
  source_object_path text not null unique,
  source_mime_type text not null,
  mux_track_reference text,
  status text not null default 'pending',
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_type in ('SERIES_EPISODE', 'SHORT_FILM')),
  check (
    (target_type = 'SERIES_EPISODE' and episode_id is not null and short_film_id is null)
    or (target_type = 'SHORT_FILM' and short_film_id is not null and episode_id is null)
  ),
  check (btrim(language_code) <> ''),
  check (btrim(label) <> ''),
  check (source_format in ('srt', 'vtt')),
  check (source_bucket = 'content-subtitles'),
  check (source_mime_type in ('application/x-subrip', 'text/plain', 'text/vtt')),
  check (status in ('pending', 'processing', 'ready', 'failed', 'deleted')),
  check (failure_code is null or btrim(failure_code) <> ''),
  check (failure_message is null or btrim(failure_message) <> '')
);

create index if not exists subtitle_tracks_episode_id_idx
  on public.subtitle_tracks (episode_id);

create index if not exists subtitle_tracks_short_film_id_idx
  on public.subtitle_tracks (short_film_id);

create index if not exists subtitle_tracks_status_idx
  on public.subtitle_tracks (status, created_at desc);

create index if not exists subtitle_tracks_mux_track_reference_idx
  on public.subtitle_tracks (mux_track_reference);

create unique index if not exists subtitle_tracks_episode_default_idx
  on public.subtitle_tracks (episode_id)
  where episode_id is not null and is_default;

create unique index if not exists subtitle_tracks_short_film_default_idx
  on public.subtitle_tracks (short_film_id)
  where short_film_id is not null and is_default;

drop trigger if exists set_subtitle_tracks_updated_at on public.subtitle_tracks;
create trigger set_subtitle_tracks_updated_at
before update on public.subtitle_tracks
for each row
execute function public.set_updated_at();

alter table public.subtitle_tracks enable row level security;

revoke all on public.subtitle_tracks from anon, authenticated;
grant all on public.subtitle_tracks to service_role;

comment on table public.subtitle_tracks is
  'Provider-neutral subtitle track metadata and private source references for series episodes and short films.';
