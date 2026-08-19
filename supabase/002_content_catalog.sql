create extension if not exists pgcrypto;

create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  synopsis text,
  genre text,
  language text default 'Hindi',
  format text,
  episode_count integer not null default 0 check (episode_count >= 0),
  episode_duration_label text,
  poster_url text,
  hero_image_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series (id) on delete cascade,
  episode_number integer not null check (episode_number > 0),
  title text,
  synopsis text,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  thumbnail_url text,
  video_asset_id text,
  is_free boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, episode_number)
);

create index if not exists series_status_sort_order_idx
  on public.series (status, sort_order);

create index if not exists episodes_status_idx
  on public.episodes (status);

drop trigger if exists set_series_updated_at on public.series;
create trigger set_series_updated_at
before update on public.series
for each row
execute function public.set_updated_at();

drop trigger if exists set_episodes_updated_at on public.episodes;
create trigger set_episodes_updated_at
before update on public.episodes
for each row
execute function public.set_updated_at();

alter table public.series enable row level security;
alter table public.episodes enable row level security;

drop policy if exists "Viewers can read published series" on public.series;
create policy "Viewers can read published series"
on public.series
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Viewers can read published episodes" on public.episodes;
create policy "Viewers can read published episodes"
on public.episodes
for select
to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.series
    where public.series.id = public.episodes.series_id
      and public.series.status = 'published'
  )
);

revoke insert, update, delete
on public.series
from anon, authenticated;

revoke insert, update, delete
on public.episodes
from anon, authenticated;

grant select on public.series to anon, authenticated;
grant select on public.episodes to anon, authenticated;

insert into public.series (
  slug,
  title,
  synopsis,
  genre,
  language,
  format,
  episode_count,
  episode_duration_label,
  poster_url,
  hero_image_url,
  status,
  featured,
  sort_order
)
values
  (
    'aadha-takiya',
    'Aadha Takiya',
    'A 45-episode vertical micro-drama about Nandini and Raghav''s intimate domestic marriage.',
    'Romantic drama',
    'Hindi',
    'Series',
    45,
    '90-120 sec',
    '/logo-og.jpg',
    '/logo-og.jpg',
    'published',
    true,
    10
  ),
  (
    'chaadar',
    'Chaadar',
    'A wedding gift arrives with an old embroidered name, reopening the one story everyone agreed to bury.',
    'Family secret',
    'Hindi',
    'Mini',
    18,
    '7 min episodes',
    '/logo-og.jpg',
    '/logo-og.jpg',
    'published',
    false,
    20
  ),
  (
    'mute-button',
    'Mute Button',
    'A support agent discovers the voice she has been training belongs to the man who ghosted her.',
    'Office romance',
    'Hindi',
    'Short',
    15,
    '6 min episodes',
    '/logo-og.jpg',
    '/logo-og.jpg',
    'published',
    false,
    30
  ),
  (
    'doosri-rasoi',
    'Doosri Rasoi',
    'Every afternoon, a locked kitchen in Jaipur serves a meal for someone who should not exist.',
    'Domestic thriller',
    'Hindi',
    'Series',
    32,
    '8 min episodes',
    '/logo-og.jpg',
    '/logo-og.jpg',
    'published',
    false,
    40
  )
on conflict (slug) do update
set
  title = excluded.title,
  synopsis = excluded.synopsis,
  genre = excluded.genre,
  language = excluded.language,
  format = excluded.format,
  episode_count = excluded.episode_count,
  episode_duration_label = excluded.episode_duration_label,
  poster_url = excluded.poster_url,
  hero_image_url = excluded.hero_image_url,
  status = excluded.status,
  featured = excluded.featured,
  sort_order = excluded.sort_order;

with episode_seed as (
  select
    public.series.id as series_id,
    seed.episode_number,
    seed.title,
    seed.synopsis,
    seed.duration_seconds,
    seed.thumbnail_url,
    seed.video_asset_id,
    seed.is_free,
    seed.status,
    seed.published_at
  from (
    values
      ('aadha-takiya', 1, 'Episode 1', null::text, 102, '/logo-og.jpg', null::text, true, 'published', now()),
      ('aadha-takiya', 2, 'Episode 2', null::text, 115, '/logo-og.jpg', null::text, true, 'published', now()),
      ('aadha-takiya', 3, 'Episode 3', null::text, 108, '/logo-og.jpg', null::text, true, 'published', now()),
      ('aadha-takiya', 4, 'Episode 4', null::text, 120, '/logo-og.jpg', null::text, false, 'published', now()),
      ('aadha-takiya', 5, 'Episode 5', null::text, 96, '/logo-og.jpg', null::text, false, 'published', now()),
      ('aadha-takiya', 6, 'Episode 6', null::text, 118, '/logo-og.jpg', null::text, false, 'published', now()),
      ('aadha-takiya', 7, 'Episode 7', null::text, 104, '/logo-og.jpg', null::text, false, 'published', now()),
      ('aadha-takiya', 8, 'Episode 8', null::text, 112, '/logo-og.jpg', null::text, false, 'published', now()),
      ('chaadar', 1, 'Episode 1', null::text, 420, '/logo-og.jpg', null::text, true, 'published', now()),
      ('chaadar', 2, 'Episode 2', null::text, 420, '/logo-og.jpg', null::text, true, 'published', now()),
      ('chaadar', 3, 'Episode 3', null::text, 420, '/logo-og.jpg', null::text, true, 'published', now()),
      ('chaadar', 4, 'Episode 4', null::text, 420, '/logo-og.jpg', null::text, false, 'published', now()),
      ('mute-button', 1, 'Episode 1', null::text, 360, '/logo-og.jpg', null::text, true, 'published', now()),
      ('mute-button', 2, 'Episode 2', null::text, 360, '/logo-og.jpg', null::text, true, 'published', now()),
      ('mute-button', 3, 'Episode 3', null::text, 360, '/logo-og.jpg', null::text, true, 'published', now()),
      ('mute-button', 4, 'Episode 4', null::text, 360, '/logo-og.jpg', null::text, false, 'published', now()),
      ('doosri-rasoi', 1, 'Episode 1', null::text, 480, '/logo-og.jpg', null::text, true, 'published', now()),
      ('doosri-rasoi', 2, 'Episode 2', null::text, 480, '/logo-og.jpg', null::text, true, 'published', now()),
      ('doosri-rasoi', 3, 'Episode 3', null::text, 480, '/logo-og.jpg', null::text, true, 'published', now()),
      ('doosri-rasoi', 4, 'Episode 4', null::text, 480, '/logo-og.jpg', null::text, false, 'published', now())
  ) as seed (
    series_slug,
    episode_number,
    title,
    synopsis,
    duration_seconds,
    thumbnail_url,
    video_asset_id,
    is_free,
    status,
    published_at
  )
  join public.series on public.series.slug = seed.series_slug
)
insert into public.episodes (
  series_id,
  episode_number,
  title,
  synopsis,
  duration_seconds,
  thumbnail_url,
  video_asset_id,
  is_free,
  status,
  published_at
)
select
  series_id,
  episode_number,
  title,
  synopsis,
  duration_seconds,
  thumbnail_url,
  video_asset_id,
  is_free,
  status,
  published_at
from episode_seed
on conflict (series_id, episode_number) do update
set
  title = excluded.title,
  synopsis = excluded.synopsis,
  duration_seconds = excluded.duration_seconds,
  thumbnail_url = excluded.thumbnail_url,
  video_asset_id = excluded.video_asset_id,
  is_free = excluded.is_free,
  status = excluded.status,
  published_at = coalesce(public.episodes.published_at, excluded.published_at);
