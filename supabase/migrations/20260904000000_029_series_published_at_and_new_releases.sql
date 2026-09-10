-- 029: Series published_at + New Releases hybrid automation foundation
--
-- REQUIRED for CMS-C04 New Releases Hybrid Automation + Editorial Control.
--
-- BLOCKER: Series table has no publication timestamp. Without series.published_at,
-- authoritative chronological newly-released ordering for Series is impossible
-- from existing fields. This migration resolves that blocker.
--
-- Also establishes the persistent exclusion storage required for hybrid behavior.
--
-- STATUS: PREPARED ONLY - NOT APPLIED. Requires Product Owner authorization.

-- 1. Add published_at to series
alter table public.series
  add column if not exists published_at timestamptz;

-- 2. Best-effort backfill for existing published series
update public.series
set published_at = updated_at
where status = 'published'
  and published_at is null;

-- 3. Updated publish_series_with_episodes sets series.published_at
create or replace function public.publish_series_with_episodes(p_series_id uuid)
returns table (
  success boolean,
  status text,
  message text,
  blockers text[],
  series_slug text,
  published_episode_numbers integer[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series public.series%rowtype;
  v_blockers text[] := array[]::text[];
  published_episode_numbers integer[];
begin
  select * into v_series from public.series where public.series.id = p_series_id;
  if not found then
    return query select false, 'not_found'::text, 'Series not found.'::text,
      array['Series not found.']::text[], null::text, array[]::integer[];
    return;
  end if;

  select coalesce(array_agg(checks.blocker order by checks.episode_number), array[]::text[])
  into v_blockers
  from (
    select e.episode_number,
      case
        when e.media_asset_id is null then format('Episode %s has no playback source assigned.', e.episode_number)
        when ma.id is null then format('Episode %s playback source is missing.', e.episode_number)
        when ma.status is distinct from 'ready' then format('Episode %s playback source is %s.', e.episode_number, ma.status)
        when btrim(coalesce(ma.provider_playback_reference, '')) = '' then format('Episode %s playback source is missing a playback reference.', e.episode_number)
        else null
      end as blocker
    from public.episodes e
    left join public.media_assets ma on ma.id = e.media_asset_id
    where e.series_id = p_series_id
  ) checks
  where checks.blocker is not null;

  if coalesce(array_length(v_blockers, 1), 0) > 0 then
    return query select false, 'blocked'::text,
      'Resolve the blockers before publishing this series.'::text,
      v_blockers, v_series.slug, array[]::integer[];
    return;
  end if;

  update public.series
  set status = 'published', published_at = now()
  where public.series.id = p_series_id;

  with updated_episodes as (
    update public.episodes
    set status = 'published', published_at = coalesce(published_at, now())
    where public.episodes.series_id = p_series_id
    returning episode_number
  )
  select coalesce(array_agg(updated_episodes.episode_number order by updated_episodes.episode_number), array[]::integer[])
  into published_episode_numbers
  from updated_episodes;

  return query select true, 'published'::text,
    'Series and child episodes published.'::text,
    array[]::text[], v_series.slug,
    coalesce(published_episode_numbers, array[]::integer[]);
end;
$$;

-- 4. Persistent exclusion storage for hybrid New Releases
create table if not exists public.home_new_releases_exclusions (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('series', 'short_film')),
  series_id uuid references public.series (id) on delete cascade,
  short_film_id uuid references public.short_films (id) on delete cascade,
  excluded_at timestamptz not null default now(),
  constraint home_new_releases_exclusions_single_content check (
    (content_type = 'series' and series_id is not null and short_film_id is null) or
    (content_type = 'short_film' and short_film_id is not null and series_id is null)
  ),
  constraint home_new_releases_exclusions_unique unique (content_type, series_id, short_film_id)
);

create index if not exists home_new_releases_exclusions_series_idx
  on public.home_new_releases_exclusions (series_id) where series_id is not null;

create index if not exists home_new_releases_exclusions_short_film_idx
  on public.home_new_releases_exclusions (short_film_id) where short_film_id is not null;

-- 5. RLS for exclusions table
alter table public.home_new_releases_exclusions enable row level security;

drop policy if exists "Public can read new releases exclusions" on public.home_new_releases_exclusions;
create policy "Public can read new releases exclusions"
  on public.home_new_releases_exclusions for select to anon, authenticated using (true);

revoke insert, update, delete on public.home_new_releases_exclusions from anon, authenticated;
grant select on public.home_new_releases_exclusions to anon, authenticated;
