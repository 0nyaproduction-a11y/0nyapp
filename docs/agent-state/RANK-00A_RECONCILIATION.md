# RANK-00A Reconciliation

Date: 2026-09-05

## Canonical Contract

- Canonical editable Consumer App copy: `docs/0NYA_RANKING_DOMAIN_CONTRACT_v1.0.md`
- Version: 1.0
- Status: APPROVED ARCHITECTURAL BASELINE / CANONICAL DOMAIN BRIDGE
- SHA-256: `2487195D12A0E4A6D811DE33F251308FEF9ADBDA01C96B296CE03ECD9ED7BEC0`

## Placement Evidence

Selected location: `docs/0NYA_RANKING_DOMAIN_CONTRACT_v1.0.md`

Repository evidence:

- `docs/agent-state/README.md` says agent-state documents are "navigation aids and snapshots, not authority."
- The same README lists canonical authority documents as root `docs/0nya_*_v*.md` files.
- Existing long-lived product/technical contract and architecture files already live directly under `docs/`:
  - `docs/0nya_APP_ARCHITECTURE_v1.0.md`
  - `docs/0nya_BACKEND_API_CONTRACT_v1.0.md`
  - `docs/0nya_CMS_PRODUCT_CONTRACT_v1.0.md`
  - `docs/0nya_DESIGN_SYSTEM_v1.0.md`
  - `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md`
  - `docs/0nya_VIDEO_PLAYBACK_ARCHITECTURE_v1.0.md`
- `docs/architecture/` did not exist and was not created.
- `docs/agent-state/RANKING_DOMAIN_CONTRACT.md` was replaced with a pointer, not a second editable copy.

## Precision Refinements Applied

- Reserved optional `config_hash?` while preserving `ranking_policy`, `ranking_policy_version`, and `config_version`.
- Clarified `config_version` as human/operator-friendly identity and `config_hash` as optional exact machine-reproducible identity.
- Added decision-time eligibility reconstruction and reserved `eligibility_snapshot_ref?`.
- Clarified delayed attribution as hypothesis/evidence unless causality is established by approved evaluation.
- Reserved `ranking_engine_version?` and distinguished policy version, config identity, and producing implementation identity.

## RANK-00 Evidence Reconciliation

The RANK-00 findings remain valid after installing the contract:

- CMS/Home editorial order is canonical: `home_rows.sort_order`, `home_row_items.sort_order`.
- Android does not rerank CMS order; it renders `homeState.rows` in server order.
- Home Composer exists through `src/app/admin/home/page.tsx` and `src/lib/cms/home.ts`.
- `home_rows` and `home_row_items` exist.
- Drag-reorder and enabled/disabled behavior exist.
- Duplicate prevention exists in `addHomeRowItem` and unique indexes.
- Multi-Spotlight exists through `row_role = 'spotlight'`.
- Micro Drama / Short Film catalog rows exist through category rows.
- Hybrid New Releases resolver exists in `src/lib/new-releases.ts`.
- `catalog-rules.ts` is the eligibility source of truth.
- Explore/Search currently use client-side faceting.
- `watch_progress` is server authoritative.
- Eligibility is before ranking while entitlements remain at playback.
- Consumer/App to Autonomous separation is clean.
- Current ranking/order behavior is deterministic.
- No behavioral event sink/impression model exists.
- No `ranking_decision_id` chain exists.
- No candidate-set historical reconstruction exists.
- No A/B/experiment infrastructure exists.
- No CMS editorial audit provenance exists.
- Most Watched is NOT READY.

## Authority Conflict Classification

| Conflict | Classification | Blocks RANK-01? | Blocks ranking? |
| --- | --- | --- | --- |
| Web `HomePage.tsx` "Trending" uses `catalogSeries.slice(1, 7)` and has no Android equivalent. | CONFIRMED_CONFLICT; ACTIVE_BUG for any active web Trending claim; DOCUMENTATION_DRIFT; SAFE_TO_DEFER for RANK-01. | NO | YES, for any Trending/Most Watched claim. |
| `FeaturedHero.tsx` remains after B00 superseded Featured Hero with Multi-Spotlight. | CONFIRMED_CONFLICT; LEGACY_ONLY; DOCUMENTATION_DRIFT; SAFE_TO_DEFER. | NO | NO, unless reused as current authority. |
| `src/data/content.ts` mock fallback can override DB genre/synopsis for seeded slugs. | CONFIRMED_CONFLICT; ACTIVE_BUG/data-quality hazard; SAFE_TO_DEFER for contract install. | YES, if RANK-01 modifies taxonomy output. | YES, for taxonomy evidence quality. |

## Final Contract Gap Matrix

| Contract item | Status | Evidence |
| --- | --- | --- |
| `ranking_decision_id` | MISSING | No field/table/constant found. |
| `actor_id` | PARTIAL | Supabase user id exists; no ranking/event DTO. |
| `session_id` | MISSING | No ranking session identity. |
| `ranking_policy` | MISSING | No ranking policy enum/string/column. |
| `ranking_policy_version` | MISSING | No ranking policy version. |
| `config_version` | MISSING | `home_settings` has no ranking version. |
| `config_hash` | NOT_APPLICABLE_YET | Architecturally reserved until canonical config representation exists. |
| `ranking_engine_version` | NOT_APPLICABLE_YET | Architecturally reserved; no ranking engine exists. |
| `candidate_set_id` | MISSING | No candidate-set identity. |
| `candidate_set_version` | MISSING | No candidate-set version. |
| `eligibility_snapshot_ref` | MISSING | Decision-time eligibility reconstruction absent. |
| `content_served` | PARTIAL | Catalog response serves content but records no ranking decision evidence. |
| `content_impression` | MISSING | No impression producer/sink. |
| `source_surface` | PARTIAL | Dev perf source exists; no persisted ranking source surface. |
| `row_id` | EXISTS | `home_rows.id`. |
| `position` | PARTIAL | Sort order exists; no event/result position evidence. |
| `recommendation_reason` | MISSING | No reason-code field. |
| `autonomous_decision_reason` namespace | NOT_APPLICABLE_YET | No Autonomous control/integration. |
| negative signals | MISSING | No hide/skip/quick_back/abandon ranking events. |
| delayed attribution | MISSING | No attribution model or decision chain. |
| editorial intervention provenance | PARTIAL | `sort_order` and remove/move actions exist; no actor/old-value audit. |
| `experiment_id` | MISSING | No experiment infrastructure. |
| `experiment_variant` | MISSING | No variant infrastructure. |
| propensity readiness | MISSING | No probability/randomized policy fields. |
| `RankingEventAdapter` | MISSING | No adapter or event sink. |
| `RankingOutcomeAdapter` | MISSING | No outcome adapter/envelope. |
| `FutureRankingActionAdapter` | NOT_APPLICABLE_YET | Architecturally reserved; future only/disabled. |

## Do-Not-Duplicate List

- `home_rows`, `home_row_items`, `home_settings`, `home_new_releases_exclusions`
- `home_rows.sort_order`, `home_row_items.sort_order`
- `series.sort_order`
- `watch_progress`
- `media_assets.status`, `provider_playback_reference`
- `catalog-rules.ts`
- `entitlements.ts`
- `classification.ts`
- `src/lib/monetization/events.ts`
- rewarded analytics/event vocabulary
- `recentSearches.ts`
- `series.featured`
- dev-only `perf.ts` tokens
- "Micro Dramas" and "Short Films" category-row semantics
- `CONTINUE_WATCHING_MIN_SECONDS`

## Phase Ownership

| Gap | Phase |
| --- | --- |
| format, canonical genres, primary/secondary genre semantics, stable machine ids, CMS assignment, API representation | RANK-01 |
| editorial policy/config identity, change/version provenance, intervention semantics | RANK-02 |
| Explore deterministic discovery sort/filter policy, Trending/Newest/Staff Picks readiness | RANK-03 |
| search metadata and delayed-attribution compatibility | RANK-04 |
| served/impression/open/play_start/qualified_watch/play_complete/play_abandon evidence | RANK-05 |
| `ranking_decision_id`, candidate sets, policy identity, eligibility snapshot, outcome objects | RANK-05B |
| RankingEventAdapter / RankingOutcomeAdapter observation seam | RANK-05C |
| Most Watched and trustworthy aggregate metrics | RANK-06 |
| normalized ordered-result API boundary and recommendation-ready metadata | RANK-07 |
| AI, Autonomous shadow evaluation, experiments, propensity/randomization | FUTURE |

## RANK-01 Necessity Verdict

RANK-01_IMPLEMENTATION_REQUIRED

Exact taxonomy gaps:

- No normalized canonical genre taxonomy table or stable machine genre ids.
- No primary/secondary genre distinction.
- Genre is a free-form comma string and client-derived in Explore.
- "Micro Drama" is currently a client label over series/catalog semantics, not a clean canonical content-type value.
- `src/data/content.ts` mock fallback can override DB genre/synopsis for seeded slugs and must be reconciled before taxonomy can be trusted.

## True First Coding Milestone

FIRST IMPLEMENTATION MILESTONE: RANK-01

Reason: RANK-01 has genuine repository-backed taxonomy gaps and is the earliest prerequisite for clean ranking semantics. It should be narrowly scoped to canonical taxonomy and mock-fallback reconciliation, without changing Home, Explore, Search ordering, production ranking behavior, or Autonomous boundaries.

## Gates

RANK-00A: PASS

CANONICAL CONTRACT INSTALLED: YES

READY FOR FIRST RANKING IMPLEMENTATION MILESTONE: YES

FIRST IMPLEMENTATION MILESTONE: RANK-01

READY FOR RANK-05B: NO

READY FOR AUTONOMOUS OBSERVATION ADAPTER: NO

READY FOR LIVE AUTONOMOUS RANKING: NO

CONSTITUTION CHANGE REQUIRED: NO
