create extension if not exists pgcrypto;

create table if not exists public.short_films (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  synopsis text,
  poster_url text,
  hero_image_url text,
  creator_reference text,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  playback_reference text,
  language text,
  content_rating text,
  content_descriptors text[] not null default '{}'::text[],
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  publish_at timestamptz,
  midroll_enabled boolean not null default false,
  midroll_timecodes integer[] not null default '{}'::integer[],
  postroll_enabled boolean not null default false,
  chai_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    content_rating is null or content_rating in ('U', 'U/A 7+', 'U/A 13+', 'U/A 16+', 'A')
  ),
  check (
    content_descriptors <@ array[
      'language',
      'violence',
      'sexual content',
      'substance use',
      'fear / horror',
      'mature themes'
    ]::text[]
  ),
  check (
    not midroll_enabled or cardinality(midroll_timecodes) > 0
  )
);

create index if not exists short_films_status_publish_at_idx
  on public.short_films (status, publish_at);

drop trigger if exists set_short_films_updated_at on public.short_films;
create trigger set_short_films_updated_at
before update on public.short_films
for each row
execute function public.set_updated_at();

alter table public.short_films enable row level security;

drop policy if exists "Viewers can read published short films" on public.short_films;
create policy "Viewers can read published short films"
on public.short_films
for select
to anon, authenticated
using (
  status = 'published'
  and (publish_at is null or publish_at <= now())
);

revoke insert, update, delete
on public.short_films
from anon, authenticated;

grant select on public.short_films to anon, authenticated;
