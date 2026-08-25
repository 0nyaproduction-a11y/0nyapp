alter table public.watch_progress
  add column if not exists content_type text not null default 'series_episode';

alter table public.watch_progress
  add column if not exists short_film_slug text;

alter table public.watch_progress
  add column if not exists ad_break_state jsonb not null default '{}'::jsonb;

alter table public.watch_progress
  alter column series_slug drop not null;

alter table public.watch_progress
  alter column episode_number drop not null;

alter table public.watch_progress
  drop constraint if exists watch_progress_content_type_check;

alter table public.watch_progress
  add constraint watch_progress_content_type_check
  check (content_type in ('series_episode', 'short_film'));

alter table public.watch_progress
  drop constraint if exists watch_progress_content_shape_check;

alter table public.watch_progress
  add constraint watch_progress_content_shape_check
  check (
    (
      content_type = 'series_episode'
      and series_slug is not null
      and episode_number is not null
      and short_film_slug is null
    )
    or (
      content_type = 'short_film'
      and short_film_slug is not null
      and series_slug is null
      and episode_number is null
    )
  );

alter table public.watch_progress
  drop constraint if exists watch_progress_user_id_content_type_series_slug_episode_number_key;

alter table public.watch_progress
  add constraint watch_progress_user_id_content_type_series_slug_episode_number_key
    unique (user_id, content_type, series_slug, episode_number);

alter table public.watch_progress
  drop constraint if exists watch_progress_user_id_content_type_short_film_slug_key;

alter table public.watch_progress
  add constraint watch_progress_user_id_content_type_short_film_slug_key
    unique (user_id, content_type, short_film_slug);
