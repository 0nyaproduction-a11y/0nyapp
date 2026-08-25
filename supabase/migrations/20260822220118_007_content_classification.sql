-- Adds the minimal backend classification contract required for G01/G02.
-- Existing unrated rows remain explicitly unrated; no real-world ratings are
-- invented for seeded development content.

create extension if not exists pgcrypto;

alter table public.series
  add column if not exists content_rating text,
  add column if not exists content_descriptors text[] not null default '{}'::text[];

alter table public.episodes
  add column if not exists content_rating_override text,
  add column if not exists content_descriptors_override text[] not null default '{}'::text[];

alter table public.series
  add constraint series_content_rating_check
  check (content_rating is null or content_rating in ('U', 'U/A 7+', 'U/A 13+', 'U/A 16+', 'A'));

alter table public.series
  add constraint series_content_descriptors_check
  check (
    content_descriptors <@ array[
      'language',
      'violence',
      'sexual content',
      'substance use',
      'fear / horror',
      'mature themes'
    ]::text[]
  );

alter table public.episodes
  add constraint episodes_content_rating_override_check
  check (content_rating_override is null or content_rating_override in ('U', 'U/A 7+', 'U/A 13+', 'U/A 16+', 'A'));

alter table public.episodes
  add constraint episodes_content_descriptors_override_check
  check (
    content_descriptors_override <@ array[
      'language',
      'violence',
      'sexual content',
      'substance use',
      'fear / horror',
      'mature themes'
    ]::text[]
  );
