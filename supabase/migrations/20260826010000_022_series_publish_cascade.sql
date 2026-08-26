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
  select *
  into v_series
  from public.series
  where public.series.id = p_series_id;

  if not found then
    return query
      select
        false,
        'not_found'::text,
        'Series not found.'::text,
        array['Series not found.']::text[],
        null::text,
        array[]::integer[];
    return;
  end if;

  select coalesce(array_agg(checks.blocker order by checks.episode_number), array[]::text[])
  into v_blockers
  from (
    select
      e.episode_number,
      case
        when e.media_asset_id is null then format('Episode %s has no playback source assigned.', e.episode_number)
        when ma.id is null then format('Episode %s playback source is missing.', e.episode_number)
        when ma.status is distinct from 'ready' then format('Episode %s playback source is %s.', e.episode_number, ma.status)
        when btrim(coalesce(ma.provider_playback_reference, '')) = '' then format('Episode %s playback source is missing a playback reference.', e.episode_number)
        else null
      end as blocker
    from public.episodes e
    left join public.media_assets ma
      on ma.id = e.media_asset_id
    where e.series_id = p_series_id
  ) checks
  where checks.blocker is not null;

  if coalesce(array_length(v_blockers, 1), 0) > 0 then
    return query
      select
        false,
        'blocked'::text,
        'Resolve the blockers before publishing this series.'::text,
        v_blockers,
        v_series.slug,
        array[]::integer[];
    return;
  end if;

  update public.series
  set status = 'published'
  where public.series.id = p_series_id;

  with updated_episodes as (
    update public.episodes
    set
      status = 'published',
      published_at = coalesce(published_at, now())
    where public.episodes.series_id = p_series_id
    returning episode_number
  )
  select coalesce(array_agg(updated_episodes.episode_number order by updated_episodes.episode_number), array[]::integer[])
  into published_episode_numbers
  from updated_episodes;

  return query
    select
      true,
      'published'::text,
      'Series and child episodes published.'::text,
      array[]::text[],
      v_series.slug,
      coalesce(published_episode_numbers, array[]::integer[]);
end;
$$;
