-- RANK-05 raw discovery/playback evidence. Prepared only; do not infer ranking scores.
create table if not exists public.ranking_behavior_events (
  event_id uuid primary key,
  event_schema_version text not null check (event_schema_version = 'ranking_behavior_v1'),
  event_type text not null check (event_type in ('content_served','content_impression','content_open','play_start','qualified_watch','play_complete','play_abandon')),
  occurred_at timestamptz not null,
  actor_id uuid references auth.users(id) on delete set null,
  session_id uuid,
  content_id text not null check (char_length(content_id) between 1 and 200),
  content_type text not null check (content_type in ('MICRO_DRAMA','SHORT_FILM','SERIES_EPISODE')),
  source_surface text not null check (source_surface in ('home','explore','search','continue_watching','detail','direct')),
  row_id text,
  position integer check (position is null or position >= 1),
  search_query_context text,
  search_result_position integer check (search_result_position is null or search_result_position >= 1),
  metadata jsonb not null default '{}'::jsonb,
  ranking_decision_id uuid,
  received_at timestamptz not null default now()
);
create index if not exists ranking_behavior_events_occurred_idx on public.ranking_behavior_events (occurred_at desc);
create index if not exists ranking_behavior_events_content_idx on public.ranking_behavior_events (content_type, content_id, occurred_at desc);
create index if not exists ranking_behavior_events_actor_idx on public.ranking_behavior_events (actor_id, occurred_at desc) where actor_id is not null;
alter table public.ranking_behavior_events enable row level security;
revoke all on public.ranking_behavior_events from public, anon, authenticated;
grant select, insert on public.ranking_behavior_events to service_role;
