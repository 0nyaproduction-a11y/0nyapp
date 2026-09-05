# RANK-FREEZE-01 — Ranking Foundation Freeze / Integration Readiness Audit

Date: 2026-09-05

## 1. EXECUTIVE VERDICT

`RANKING_FOUNDATION_FREEZE_BLOCKED`.

Most ranking/discovery architecture is coherent and deterministic at source level, but the baseline cannot yet be frozen because three source gates fail:

1. `validateBehaviorEvent()` accepts phone numbers and arbitrary nested metadata when they are placed under innocuous key names; the API then persists that metadata verbatim.
2. the consumer web Home still exposes a pseudo-`Trending` rail implemented as `catalogSeries.slice(1, 7)`, competing with the CMS-authoritative/deterministic ranking semantics;
3. the mandatory synthetic Home end-to-end trace is incomplete because its replay fixture omits `qualified_watch` between `play_start` and `play_complete`.

Prepared migrations, runtime persistence, emulator/device viewport acceptance, and Autonomous ingestion are additional runtime/integration gaps, but are not the reason for the blocked source-freeze verdict.

## 2. REPOSITORY STATE

### Consumer

| Field | Evidence |
| --- | --- |
| cwd | `C:\Users\Akash\Documents\0nyapp` |
| branch | `qa/netlify-api-e34ab5e` |
| HEAD | `ac9e11676c3434cb16b4f33adc4208e1c7c4f1e5` |
| index | readable, non-zero, 47,023 bytes |
| worktree | heavily dirty: 90 tracked dirty entries and 106 untracked entries before this report |
| ranking baseline tracking | governing contract, all RANK reports, ranking libraries/routes, Android ranking helpers, and migrations 034/035/decision-evidence are untracked |
| pending migrations | 034, 035, and decision-evidence are present locally and absent from remote migration history; migrations 029–033 and older unrelated migrations are also pending |

Untracked entries were recorded by `git status --porcelain=v1`; ranking-relevant entries are: `docs/0NYA_RANKING_DOMAIN_CONTRACT_v1.0.md`, all `docs/agent-state/RANK-*` reports, `docs/agent-state/RANKING_DOMAIN_CONTRACT.md`, `src/lib/ranking/`, `src/app/api/v1/ranking/`, `src/lib/taxonomy.ts`, `src/lib/catalog-rules.ts`, Android taxonomy/discovery/search/behavior/decision evidence files, and migrations 034/035/decision-evidence. The repository also contains numerous unrelated untracked application, documentation, test, tooling, and workspace directories; none were altered by this audit.

### Autonomous

| Field | Evidence |
| --- | --- |
| cwd | `C:\Users\Akash\Documents\0nya-autonomous` |
| branch | `master` |
| HEAD | `e957bad4e283ef21e5d0fa1e78fa4d5feba71541` |
| worktree | clean |
| tags at HEAD | none |
| Consumer ranking code present | no matches for Consumer ranking schemas, adapter names, paths, or event/candidate identifiers |

Autonomous was read only. No Autonomous file changed.

## 3. DOCUMENT AUTHORITY

Result: `CANONICAL_SINGLE_SOURCE`.

`docs/0NYA_RANKING_DOMAIN_CONTRACT_v1.0.md` is the only editable ranking-domain contract. `docs/agent-state/RANKING_DOMAIN_CONTRACT.md` explicitly identifies itself as a pointer and forbids maintaining a second copy. The only other match is the historical RANK-00 audit, not a competing contract. No duplicate authority or semantic conflict was found.

## 4. RANK-01 TAXONOMY AUDIT

Source result: coherent but persistence-partial.

- Stable IDs: `romance`, `drama`, `comedy`, `thriller`, `mystery`, `family` in `src/lib/taxonomy.ts`.
- Formats remain separate: `MICRO_DRAMA` and `SHORT_FILM` are content types, not genres.
- `normalizeGenreAssignments()` provides one primary genre and deduplicated secondary genres.
- CMS/backend fields are authoritative; mock taxonomy fallback is blocked by tests.
- Android consumes canonical IDs/labels through its compatibility module and API types.
- Legacy API `genre` remains an intentional backwards-compatibility field.

Persistence gaps:

| Gap | Classification |
| --- | --- |
| `series.genre` legacy text storage | `NON_BLOCKING_SCHEMA_DEBT` |
| Short Film persisted genres absent | `PRODUCT_FEATURE_DEPENDENT` |
| independently persisted/edited secondary genres absent | `NON_BLOCKING_SCHEMA_DEBT` |

## 5. RANK-02 EDITORIAL AUDIT

CMS remains authoritative through `home_rows.sort_order`, `home_row_items.sort_order`, enabled state, Spotlight settings, and New Releases exclusions. Home policy identity is `editorial / home_editorial_v1`; config identity is derived from the canonical ordered snapshot as `home_editorial_config_v1:<hash-prefix>` plus SHA-256 `config_hash`. New Releases preserves `editorial_pin` versus `deterministic_release_date`. Current mapping never emits fake `EDITORIAL_BOOST`.

Migration 034 is `SOURCE_READY`, `RUNTIME_UNVERIFIED`, and by itself `DOES_NOT_BLOCK_FREEZE`. It is additive and server-only, but unapplied remotely and locally unverified. Historical provenance begins only after application.

## 6. RANK-03 EXPLORE AUDIT

Canonical format and genre filters compose through `apps/android/src/lib/discovery.ts`. Default order preserves catalog order; `Newest` sorts authoritative publication time descending with stable `contentType:slug` tie-breaking and null/invalid timestamps last. Eligibility reuses server catalog rules. No behavioral weighting, algorithmic Trending, Staff Picks, or Most Watched entered Explore.

Result: deterministic Explore semantics pass at source level.

## 7. RANK-04 SEARCH AUDIT

Search reuses canonical taxonomy and eligible catalog data. Its explicit match tiers are title, creator where available, canonical genre, content type, language, episode title, synopsis, and episode description; results then tie-break by normalized title and stable content key. Recent Search continues to use one SecureStore key. One-based result position and private query context survive navigation into playback; query context is excluded from URLs and email/phone-like query strings are redacted.

No popularity, watch, CTR, AI, experiment, propensity, or behavioral weighting is used. Search remains query relevance; Explore remains browse/filter/sort.

## 8. RANK-05 / 05A BEHAVIORAL EVIDENCE AUDIT

Semantics:

- `content_served`: delivered/rendered collection item, not visibility.
- `content_impression`: measured area visibility `>= 0.5` continuously for `>= 1000 ms`.
- `content_open`: deliberate card/action navigation.
- `play_start`: actual player `playingChange`, not route/render/tap.
- `qualified_watch`: `continuous_playback_30s_v1`; paused time, non-positive deltas, and jumps over two seconds are excluded.
- `play_complete`: emitted after final watch-progress save.
- `play_abandon`: started, incomplete playback plus explicit exit only.

| Surface | SERVED | IMPRESSION | OPEN | PLAY ORIGIN CONTINUITY |
| --- | --- | --- | --- | --- |
| Home | source yes | source yes | source yes | yes |
| Explore | source yes | source yes | source yes | yes |
| Search | source yes | source yes | source yes | yes |
| Playback | N/A | N/A | N/A | yes; emits play/watch/complete/explicit-abandon |

`BehaviorImpression` uses actual `measureInWindow` geometry against the current viewport, remeasures after the timer, resets below threshold, and excludes unfocused/covered surfaces. Positions are one-based. Home uses canonical CMS row UUIDs. Served and impression keys dedupe rerenders per process session/collection context. Evidence submissions are fire-and-forget/fail-open. Search query context is sanitized and kept out of URLs. Session identity is one purpose-limited UUIDv4 per app process.

Persistent anonymous actor identity is absent. This is `NON_BLOCKING` for source semantics; authenticated actor is server-derived and anonymous actor remains null. It limits cross-session anonymous analysis and must receive separate privacy approval before implementation.

## 9. RANK-05B DECISION EVIDENCE AUDIT

`ranking_decision_v1` uses unique UUIDv4 decision and candidate-set IDs. Decision boundaries are per server Home row/Spotlight request and per meaningful client Explore/Search/Continue Watching evaluation. Policy/config/engine versions are explicit. Experiments are reserved null; `deterministic=true`, `propensity_type=none`, and probabilities are null.

Candidate-set evidence is not merely the final list: `candidate_snapshot` contains every bounded considered candidate (maximum 200), `eligible`, `filter_reason`, `pre_rank_position`, and nullable `final_position`. `ordered_results` is a separate array restricted to eligible candidates with contiguous one-based positions. `eligibility_snapshot_ref` equals the immutable `candidate_set_id`; persistence stores both arrays atomically in the decision row. Thus a filtered candidate can exist in `candidate_snapshot` while being absent from `ordered_results`.

Recommendation reasons and genuine editorial provenance remain separate from Autonomous reasons. Behavioral events carry the originating decision ID when available. Direct/deep-link playback supports null decision ID. Delayed attribution requires a paired source/policy and remains distinct from direct provenance.

## 10. RANK-05C OBSERVATION ADAPTER AUDIT

The pure adapter declares `ranking_observation_v1` and `ranking_observation_adapter_v1`; controlled types are decision, served, impression, open, play start, qualified watch, complete, and abandon. Recursive key sorting provides deterministic serialization and replay ordering is `occurred_at`, then `observation_id`.

Decision evidence maps into separate `pre_decision` and `decision_time` objects; behavior maps only to `post_decision`. Candidate export is bounded to 200 and normalized. Search query context is sanitized. CanonicalEvent projection has exactly `event_id`, `timestamp`, `observable_features`, and `context`, matching Autonomous `core/interfaces.py`.

No Autonomous reason, action adapter, live transport, network writer, cross-repository import, or ranking feedback path exists. Autonomous Core is untouched. Compatibility is source/shape readiness only; Autonomous still requires an authorized ingestion design that preserves source event time while defining reproducible logical-clock sequencing.

## 11. END-TO-END TRACE RESULTS

All IDs below are synthetic.

### A. Home editorial

Session `00000000-0000-4000-8000-000000000001`; decision `10000000-0000-4000-8000-000000000001`; candidate set/snapshot `10000000-0000-4000-8000-000000000002`; content `home-title`; ordered position 1; served `...0003`; impression `...0004`; open `...0005`; play_start `...0006`; play_complete `...0007`. Every adapter observation retains the decision/session/content relationship and projects to a CanonicalEvent with the event/decision ID in its defined location.

Result: `FAIL` for the required complete chain because the fixture contains no `qualified_watch` event. A separate mapping test synthesizes one from the play-start event, but it is not part of the chronological replay chain and therefore does not prove the requested chain.

### B. Explore filtered

Session `00000000-0000-4000-8000-000000000001`; decision `20000000-0000-4000-8000-000000000001`; candidate set `...0002`; content `explore-title`; served `...0003`; impression `...0004`; open `...0005`; abandon `...0006`. All events carry decision/session/content and adapt to post-decision CanonicalEvent outcomes. Result: `PASS`.

### C. Search query

Session `00000000-0000-4000-8000-000000000001`; decision `30000000-0000-4000-8000-000000000001`; candidate set `...0002`; content `search-title`; query context `mystery`; result position 1; served `...0003`; impression `...0004`; open `...0005`; play_start `...0006`. Result: `PASS` for the requested playback-start projection.

### D. Direct/deep-link

Event `40000000-0000-4000-8000-000000000001`; content `direct-title`; surface `direct`; `ranking_decision_id=null`; valid play-start observation and CanonicalEvent projection. Result: `PASS`.

## 12. TEMPORAL LEAKAGE AUDIT

| Field group | Phase |
| --- | --- |
| normalized candidates, eligibility/filter reason, pre-rank position, candidate count/export mode, request context | `PRE_DECISION` |
| decision ID/time, policy/config/engine identity, candidate-set identity/version, deterministic flag, exact ordered results/final positions | `DECISION_TIME` |
| served/impression/open/play/watch/complete/abandon, visibility/duration/watch/completion/abandon evidence, delayed attribution | `POST_DECISION` |

Decision features are captured atomically into the decision object before/at its single `createdAt`; there are no later per-feature timestamps or lookups against current catalog state. Therefore every decision-time feature is represented as observable no later than the decision timestamp. Adapter validation structurally rejects outcome fields in decision payloads, behavior observations contain only `post_decision`, identifiers/outcomes remain outside Autonomous observable decision features, and there is no adapter-to-ranking feedback path.

Limitation: the behavior API validates ISO parseability but does not cross-check a linked event's `occurredAt` against persisted decision time; out-of-order arrival is intentionally allowed. This affects chronology validation, not backward data flow, because events are never consumed by decision generation.

Result: `TEMPORAL_ISOLATION_PASS` at source architecture level.

## 13. AUTHORITY BOUNDARY AUDIT

| Boundary | Result | Evidence |
| --- | --- | --- |
| CMS owns editorial order | PASS | server Home copies CMS row/item order |
| catalog rules own eligibility | PASS | canonical `catalog-rules.ts` used upstream |
| entitlement/playback owns final access | PASS | ranking evidence does not authorize playback |
| ranking does not own access | PASS | candidates contain observational eligibility only |
| behavioral events do not alter ranking | PASS | append-only write path, no ranking reader |
| RankingDecision records evidence only | PASS | producers copy existing order/filter output |
| observation adapter translates only | PASS | pure library, no transport/action path |
| Autonomous has no live influence | PASS | no Consumer import, transport, or reverse adapter |

Result: `AUTHORITY BOUNDARIES: PASS`.

## 14. DUPLICATION AUDIT

| Concern | Classification |
| --- | --- |
| taxonomy | `INTENTIONAL_COMPATIBILITY_LAYER`: server canonical module plus Android consumer mirror/API contract |
| genre maps | `ONE_CANONICAL_IMPLEMENTATION`: server IDs/aliases; Android consumes normalized API semantics |
| eligibility | `ONE_CANONICAL_IMPLEMENTATION`: `src/lib/catalog-rules.ts` |
| ranking event stream | `ONE_CANONICAL_IMPLEMENTATION`: `ranking_behavior_events` |
| ranking decision model | `INTENTIONAL_COMPATIBILITY_LAYER`: server validation/persistence plus Android producer shape |
| candidate-set model | `ONE_CANONICAL_IMPLEMENTATION`: part of RankingDecision evidence |
| observation adapter | `ONE_CANONICAL_IMPLEMENTATION` |
| editorial provenance | `ONE_CANONICAL_IMPLEMENTATION` |
| Search relevance | `ONE_CANONICAL_IMPLEMENTATION` |
| Explore sorting | `ONE_CANONICAL_IMPLEMENTATION` |
| session identity | `ONE_CANONICAL_IMPLEMENTATION`: behavior session; evidence helper supplies UUID creation, not a second lifetime policy |
| web Home `Trending` | `CONFLICT`: positional slice falsely presented as Trending outside the canonical CMS/deterministic model |

Result: `DUPLICATE FOUNDATIONAL SYSTEMS: YES` because the web pseudo-Trending path is a competing ranking presentation and must be removed, renamed, or placed under real authority before freeze.

## 15. PRIVACY / SECURITY AUDIT

Positive evidence: actor UUID is server-derived; anonymous actor is null; query context redacts phone/email patterns; top-level event/decision fields are allowlisted; payload sizes and IDs are bounded; tokens/OTP/password/PIN/service-role/access/refresh/purchase/signed-playback URL key names are rejected; database designs enable RLS, revoke public/anon/authenticated writes, and use server-only service-role persistence; clients fail open.

Blocker evidence: `validateBehaviorEvent()` accepts arbitrary recursively nested metadata up to 2 KiB and checks sensitive key names, not sensitive values. A live source-level probe returned `ok: true` for `metadata: { note: "+91 98765 43210", arbitrary_nested: { freeform: "accepted" } }`; `POST /api/v1/ranking/events` persists `event.metadata` verbatim. This violates the no-phone/no-arbitrary-metadata evidence boundary.

Result: `PRIVACY_SECURITY_BLOCKER`.

## 16. MIGRATION INVENTORY

| Filename | Purpose | Dependency order | Source review | Applied locally? | Applied remotely? | Runtime verified? | Blocking |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `20260905030000_034_home_editorial_ranking_provenance.sql` | editorial change history/provenance | before 035/decision evidence by timestamp; depends on Home/content/auth tables | `SOURCE_READY` | `UNVERIFIED` (local DB unavailable) | NO (remote migration list) | NO | runtime gap; does not independently block source freeze |
| `20260905040000_035_ranking_behavior_events.sql` | append-only behavior stream | after 034; before decision-evidence ALTER | `SOURCE_READY` | `UNVERIFIED` | NO | NO | runtime gap; required before decision evidence |
| `20260905162706_ranking_decision_evidence.sql` | decision/candidate/result snapshots and behavior linkage columns | after 035 | `SOURCE_READY` | `UNVERIFIED` | NO | NO | runtime gap; required for persistence/readiness |

`npx supabase migration list` connected to the remote project read-only and showed all three local-only. `npx supabase db lint --local` failed because no Postgres was listening on `127.0.0.1:54322`. No migration was applied.

## 17. TEST / BUILD EVIDENCE MATRIX

| Evidence | Status | Fresh result |
| --- | --- | --- |
| taxonomy tests | PASS | included in 306-pass root suite |
| editorial provenance tests | PASS | included |
| Explore tests | PASS | included |
| Search tests | PASS | included |
| behavioral evidence tests | PASS | included |
| ranking decision tests | PASS | included |
| observation adapter tests | PASS | included, but mandated Home fixture coverage gap found by audit |
| root typecheck | PASS | `tsc --noEmit` |
| Android typecheck | PASS | `tsc --noEmit` |
| production build | PASS | Next.js 16.3.1; static generation logged unavailable published-series data but completed |
| root test suite | PASS | 323 total; 306 pass; 17 intentional skips; 0 fail |
| Android standalone tests | UNAVAILABLE | Android package has no `test` script; Android pure tests are exercised from root where registered |
| lint | BLOCKED_BY_ENVIRONMENT | full lint ran but fails on current broader dirty worktree: 24 errors, 52 warnings; ranking files also have unused-symbol warnings and established Home/Player errors |
| database lint | BLOCKED_BY_ENVIRONMENT | local Supabase/Postgres unavailable |
| emulator/device acceptance | NOT_RUN | no runtime acceptance authorized/performed |

## 18. SOURCE VS RUNTIME VERIFICATION MATRIX

| Subsystem | SOURCE VERIFIED | RUNTIME VERIFIED |
| --- | --- | --- |
| contract authority | YES | N/A |
| taxonomy/API shape | YES | NO |
| editorial order/config identity | YES | NO |
| Explore deterministic discovery | YES | NO |
| Search deterministic relevance | YES | NO |
| behavior semantics/emission | PARTIAL — privacy blocker | NO |
| viewport impression model | YES | NO |
| ranking decision/candidate model | YES | NO |
| persistence/RLS designs | YES | NO |
| observation adapter | YES | N/A (library only) |
| live observation transport | N/A — not implemented/authorized | NO |
| Autonomous CanonicalEvent shape compatibility | YES | NO |
| Autonomous logical-clock ingestion | NO | NO |

## 19. REMAINING GAP CLASSIFICATION

### A. FREEZE BLOCKER

- Behavior metadata permits phone values and arbitrary nested keys.
- Web Home pseudo-`Trending` conflicts with canonical ranking semantics.
- Mandatory Home synthetic replay chain lacks `qualified_watch`.
- Foundational ranking files and contract remain untracked, so there is no durable Git baseline to freeze; this requires a later explicitly authorized version-control step after remediation, not a commit during this audit.

### B. DEPLOYMENT/RUNTIME VERIFICATION

- migrations 034/035/decision-evidence unapplied and persistence/RLS inserts unverified;
- emulator viewport/event verification and physical OnePlus acceptance not run;
- deployed CMS editorial provenance persistence not verified.

### C. SCHEMA DEBT

- legacy `series.genre` text;
- no independent persisted secondary genres;
- no historical editorial change records before migration application.

### D. PRODUCT FEATURE DEFERRED

- Short Film persisted genres;
- trustworthy Trending, Staff Picks, Most Watched;
- persistent anonymous actor (privacy approval required);
- broader abandon gestures and delayed-attribution policy/windows.

### E. FUTURE AUTONOMOUS INTEGRATION

- live observation sink/export job and custody/retention/audit-chain design;
- authorized ingestion runner;
- deterministic Autonomous logical-clock sequencing while retaining source event time;
- shadow authorization/certification and any future action adapter.

### F. OPERATIONS / TOOLING

- local Supabase runtime unavailable for DB lint;
- Android package lacks a standalone test script;
- full-repository lint debt;
- heavily dirty/untracked worktree requires coordinated, explicitly authorized baseline preparation.

## 20. BASELINE INVENTORY

Freeze is not approved, so this is the candidate baseline inventory, not a frozen baseline:

| Component | Canonical location |
| --- | --- |
| contract | `docs/0NYA_RANKING_DOMAIN_CONTRACT_v1.0.md` |
| taxonomy | `src/lib/taxonomy.ts`; Android compatibility `apps/android/src/lib/taxonomy.ts` |
| editorial provenance | `src/lib/ranking/editorial-provenance.ts` |
| Explore discovery | `apps/android/src/lib/discovery.ts`, `apps/android/src/screens/ExploreScreen.tsx` |
| Search relevance | `apps/android/src/lib/search.ts`, `apps/android/src/screens/SearchResultsScreen.tsx` |
| behavior event model | `src/lib/ranking/behavior-events.ts`, `apps/android/src/lib/behavioralEvents.ts`, API route `src/app/api/v1/ranking/events/route.ts` |
| viewport impression model | `apps/android/src/components/BehaviorImpression.tsx`, `apps/android/src/lib/behaviorImpressionModel.ts` |
| ranking decision/candidate model | `src/lib/ranking/decision-evidence.ts`, `apps/android/src/lib/rankingDecisionEvidence.ts` |
| observation adapter | `src/lib/ranking/observation-adapter.ts` |
| synthetic replay evidence | `src/lib/ranking/observation-adapter.fixtures.ts` |
| reports | `docs/agent-state/RANK-00_AUDIT.md`, `RANK-00A_RECONCILIATION.md`, `RANK-01_REPORT.md` through `RANK-05C_REPORT.md`, this report |
| prepared migrations | `supabase/migrations/20260905030000_034_home_editorial_ranking_provenance.sql`, `20260905040000_035_ranking_behavior_events.sql`, `20260905162706_ranking_decision_evidence.sql` |
| tests | `src/lib/taxonomy.test.ts`; `src/lib/ranking/*.test.ts`; Android route serialization tests; root `npm test` registration |

## 21. FREEZE DECISION

`RANKING_FOUNDATION_FREEZE_BLOCKED`.

The source architecture is close, but the privacy boundary, competing pseudo-Trending implementation, incomplete mandatory replay proof, and absence of a tracked baseline prevent freezing foundational semantics today.

## 22. AUTONOMOUS READINESS

| Gate | Result |
| --- | --- |
| `READY_FOR_AUTONOMOUS_OBSERVATION_INTEGRATION` | NO — adapter shape is ready, but Consumer source freeze/privacy and trace gates fail |
| `READY_FOR_AUTONOMOUS_SHADOW_MODE` | NO — no ingestion runner, logical-clock policy, live custody, runtime persistence, authorization, or certification |
| `READY_FOR_LIVE_AUTONOMOUS_RANKING` | NO — explicitly unauthorized; no action adapter or proven shadow phase |

## 23. NEXT AUTHORIZED STEP

`BLOCKER_REMEDIATION`

This is the single next step because source/privacy and semantic-conflict blockers must be resolved before applying migrations or designing live ingestion.

## 24. FILES CREATED / MODIFIED

- Created `docs/agent-state/RANKING_FOUNDATION_FREEZE_REPORT.md`.
- No Consumer implementation, migration, prior phase report, Autonomous file, deployment, database, Git history, or remote state was modified.

## 25. FINAL GATES

RANKING FOUNDATION: BLOCKED

SOURCE ARCHITECTURE COHERENT: NO

TEMPORAL ISOLATION: PASS

AUTHORITY BOUNDARIES: PASS

DUPLICATE FOUNDATIONAL SYSTEMS: YES

PRIVACY / SECURITY: BLOCKED

RANKING BEHAVIOR STILL DETERMINISTIC: YES

BEHAVIORAL RANKING IMPLEMENTED: NO

FAKE PROPENSITY IMPLEMENTED: NO

AUTONOMOUS CORE MODIFIED: NO

CONSTITUTION CHANGE REQUIRED: NO

SOURCE FREEZE APPROVED: NO

RUNTIME DEPLOYMENT VERIFIED: NO

READY FOR AUTONOMOUS OBSERVATION INTEGRATION: NO

READY FOR AUTONOMOUS SHADOW MODE: NO

READY FOR LIVE AUTONOMOUS RANKING: NO

NEXT STEP: BLOCKER_REMEDIATION
