-- RANK-05B ranking decision evidence contract.
--
-- Prepared only. This migration is additive, does not alter ranking behavior,
-- and must not be applied without a separately authorized database workflow.

create table if not exists public.ranking_decisions (
  ranking_decision_id uuid primary key,
  decision_schema_version text not null
    check (decision_schema_version = 'ranking_decision_v1'),
  created_at timestamptz not null,
  received_at timestamptz not null default now(),
  actor_id uuid references auth.users (id) on delete set null,
  session_id uuid,
  ranking_policy text not null
    check (ranking_policy in ('editorial', 'default_catalog', 'search_relevance', 'continue_watching')),
  ranking_policy_version text not null,
  config_version text not null,
  config_hash text
    check (config_hash is null or config_hash ~ '^[0-9a-f]{64}$'),
  ranking_engine_version text,
  candidate_set_id uuid not null unique,
  candidate_set_version text not null
    check (candidate_set_version = 'ranking_candidate_set_v1'),
  candidate_count integer not null
    check (candidate_count between 0 and 200),
  eligibility_snapshot_ref uuid not null,
  source_surface text not null
    check (source_surface in ('home', 'explore', 'search')),
  row_id text,
  deterministic boolean not null
    check (deterministic),
  experiment_id text,
  experiment_variant text,
  propensity_type text not null default 'none'
    check (propensity_type = 'none'),
  selection_probability double precision,
  request_context jsonb not null default '{}'::jsonb,
  candidate_snapshot jsonb not null,
  ordered_results jsonb not null,
  constraint ranking_decisions_snapshot_ref_matches_candidate_set check (
    eligibility_snapshot_ref = candidate_set_id
  ),
  constraint ranking_decisions_no_active_experiment check (
    experiment_id is null and experiment_variant is null
  ),
  constraint ranking_decisions_no_fake_propensity check (
    selection_probability is null
  ),
  constraint ranking_decisions_request_context_object check (
    jsonb_typeof(request_context) = 'object'
  ),
  constraint ranking_decisions_candidate_snapshot_array check (
    jsonb_typeof(candidate_snapshot) = 'array'
    and jsonb_array_length(candidate_snapshot) = candidate_count
  ),
  constraint ranking_decisions_ordered_results_array check (
    jsonb_typeof(ordered_results) = 'array'
    and jsonb_array_length(ordered_results) <= candidate_count
  )
);

comment on table public.ranking_decisions is
  'Immutable audit evidence for one deterministic ranking evaluation and its decision-time candidate/result snapshots.';
comment on column public.ranking_decisions.ranking_decision_id is
  'Stable unique identity for one ranking evaluation/result set; never a content, row, or session identifier.';
comment on column public.ranking_decisions.candidate_snapshot is
  'Bounded decision-time snapshot of candidates, eligibility/filter evidence, pre-rank and final positions.';
comment on column public.ranking_decisions.ordered_results is
  'Exact one-based ordered result returned by the producing ranking policy.';
comment on column public.ranking_decisions.eligibility_snapshot_ref is
  'Reference to the immutable candidate snapshot stored by this same decision row.';
comment on column public.ranking_decisions.selection_probability is
  'Reserved for future randomized policies; always null for current deterministic policies.';

create index if not exists ranking_decisions_created_at_idx
  on public.ranking_decisions (created_at desc);
create index if not exists ranking_decisions_policy_created_idx
  on public.ranking_decisions (ranking_policy, ranking_policy_version, created_at desc);
create index if not exists ranking_decisions_surface_row_created_idx
  on public.ranking_decisions (source_surface, row_id, created_at desc);
create index if not exists ranking_decisions_actor_created_idx
  on public.ranking_decisions (actor_id, created_at desc)
  where actor_id is not null;

alter table public.ranking_decisions enable row level security;
revoke all on public.ranking_decisions from public, anon, authenticated;
grant select, insert on public.ranking_decisions to service_role;

alter table public.ranking_behavior_events
  add column if not exists recommendation_reason text,
  add column if not exists attribution_source text,
  add column if not exists attribution_policy text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ranking_behavior_events_recommendation_reason_check'
      and conrelid = 'public.ranking_behavior_events'::regclass
  ) then
    alter table public.ranking_behavior_events
      add constraint ranking_behavior_events_recommendation_reason_check
      check (
        recommendation_reason is null or recommendation_reason in (
          'NEW_RELEASE',
          'CONTINUE_WATCHING',
          'SEARCH_RELEVANCE',
          'GENRE_FILTER',
          'FORMAT_FILTER',
          'EDITORIAL'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ranking_behavior_events_attribution_source_check'
      and conrelid = 'public.ranking_behavior_events'::regclass
  ) then
    alter table public.ranking_behavior_events
      add constraint ranking_behavior_events_attribution_source_check
      check (
        attribution_source is null or attribution_source in (
          'LATER_SEARCH',
          'LATER_RETURN',
          'RELATED_NAVIGATION'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ranking_behavior_events_attribution_pair_check'
      and conrelid = 'public.ranking_behavior_events'::regclass
  ) then
    alter table public.ranking_behavior_events
      add constraint ranking_behavior_events_attribution_pair_check
      check (
        (attribution_source is null and attribution_policy is null)
        or
        (attribution_source is not null and attribution_policy is not null)
      );
  end if;
end $$;

comment on column public.ranking_behavior_events.ranking_decision_id is
  'Direct provenance/correlation to the producing RankingDecision. Nullable for direct/non-ranked entry; intentionally not a foreign key so fail-open out-of-order evidence is not rejected.';
comment on column public.ranking_behavior_events.attribution_source is
  'Optional later attribution hypothesis, distinct from direct ranking_decision_id provenance.';
comment on column public.ranking_behavior_events.attribution_policy is
  'Versioned policy for optional delayed attribution; null when no delayed attribution is asserted.';

create index if not exists ranking_behavior_events_decision_occurred_idx
  on public.ranking_behavior_events (ranking_decision_id, occurred_at asc)
  where ranking_decision_id is not null;
