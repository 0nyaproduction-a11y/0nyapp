-- 034: Home editorial ranking provenance
--
-- RANK-02 source foundation only.
-- Additive history storage for CMS Home editorial changes. This migration does
-- not mutate existing Home rows/items, does not seed content, and does not
-- change consumer ordering behavior.
--
-- STATUS: PREPARED ONLY - NOT APPLIED. Requires Product Owner authorization.

create table if not exists public.home_editorial_change_events (
  id uuid primary key default gen_random_uuid(),
  changed_at timestamptz not null default now(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_source text not null default 'system'
    check (actor_source in ('cms_admin', 'system')),
  change_type text not null check (
    change_type in (
      'ROW_CREATE',
      'ROW_UPDATE',
      'ROW_DELETE',
      'ROW_REORDER',
      'ITEM_ADD',
      'ITEM_UPDATE',
      'ITEM_REMOVE',
      'ITEM_REORDER',
      'SPOTLIGHT_TOGGLE',
      'HOME_SETTING_UPDATE'
    )
  ),
  intervention_type text not null check (
    intervention_type in (
      'EDITORIAL_PIN',
      'EDITORIAL_BOOST',
      'EDITORIAL_REMOVE',
      'EDITORIAL_ORDER'
    )
  ),
  ranking_policy text not null default 'editorial'
    check (ranking_policy = 'editorial'),
  ranking_policy_version text not null default 'home_editorial_v1'
    check (ranking_policy_version = 'home_editorial_v1'),
  config_version text not null default 'home_editorial_config_v1',
  config_hash text,
  home_row_id uuid,
  home_row_item_id uuid,
  affected_content_type text check (
    affected_content_type is null or affected_content_type in ('series', 'short_film')
  ),
  series_id uuid references public.series (id) on delete set null,
  short_film_id uuid references public.short_films (id) on delete set null,
  previous_state jsonb,
  new_state jsonb,
  constraint home_editorial_change_events_single_content check (
    (
      affected_content_type is null
      and series_id is null
      and short_film_id is null
    ) or (
      affected_content_type = 'series'
      and series_id is not null
      and short_film_id is null
    ) or (
      affected_content_type = 'short_film'
      and short_film_id is not null
      and series_id is null
    )
  )
);

comment on table public.home_editorial_change_events is
  'Append-only provenance for CMS Home editorial ranking/order changes.';

comment on column public.home_editorial_change_events.ranking_policy is
  'Ranking policy namespace for current CMS-authored Home ordering.';

comment on column public.home_editorial_change_events.ranking_policy_version is
  'Stable semantic policy version for Home editorial ordering.';

comment on column public.home_editorial_change_events.config_version is
  'Effective Home editorial configuration version used when recording the change.';

comment on column public.home_editorial_change_events.config_hash is
  'Optional SHA-256 hash of the canonical Home editorial configuration snapshot.';

create index if not exists home_editorial_change_events_changed_at_idx
  on public.home_editorial_change_events (changed_at desc);

create index if not exists home_editorial_change_events_config_version_idx
  on public.home_editorial_change_events (config_version, changed_at desc);

create index if not exists home_editorial_change_events_home_row_idx
  on public.home_editorial_change_events (home_row_id, changed_at desc)
  where home_row_id is not null;

create index if not exists home_editorial_change_events_home_row_item_idx
  on public.home_editorial_change_events (home_row_item_id, changed_at desc)
  where home_row_item_id is not null;

create index if not exists home_editorial_change_events_series_idx
  on public.home_editorial_change_events (series_id, changed_at desc)
  where series_id is not null;

create index if not exists home_editorial_change_events_short_film_idx
  on public.home_editorial_change_events (short_film_id, changed_at desc)
  where short_film_id is not null;

alter table public.home_editorial_change_events enable row level security;

revoke all on public.home_editorial_change_events from anon, authenticated;
