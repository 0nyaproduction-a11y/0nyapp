# RANK-05C — Ranking Observation Adapter Preparation

## 1. EXECUTIVE VERDICT

`RANK-05C: PASS` at source/contract level. The Consumer App now has a pure, one-way, versioned observation translation library, deterministic serialization, bounded replay fixtures, and an explicit `CanonicalEvent` projection. It adds no transport, Autonomous control, ranking change, action adapter, deployment, migration, or repository coupling.

## 2. SAFETY / WORKTREE STATE

- Consumer cwd: `C:\Users\Akash\Documents\0nyapp`
- Branch: `qa/netlify-api-e34ab5e`
- HEAD: `ac9e11676c3434cb16b4f33adc4208e1c7c4f1e5`
- `.git/index`: present/readable, 47,023 bytes at pre-flight. No metadata repair attempted.
- Consumer worktree: heavily dirty before RANK-05C; unrelated modified/untracked work was preserved. Ranking evidence/report/migration files from RANK-00 through RANK-05B were already untracked.
- Pending migrations relevant to ranking: `20260905030000_034_home_editorial_ranking_provenance.sql`, `20260905040000_035_ranking_behavior_events.sql`, and `20260905162706_ranking_decision_evidence.sql` remain source-prepared/untracked and were not applied.
- Autonomous repository reachable: yes, at `C:\Users\Akash\Documents\0nya-autonomous`.
- Autonomous branch/HEAD: `master` / `e957bad4e283ef21e5d0fa1e78fa4d5feba71541`.
- Autonomous worktree: clean at pre-flight; no relevant dirty work and no RANK-05C modifications.
- No reset, clean, stash, index repair, commit, push, deployment, remote write, or migration application occurred.

## 3. CONSUMER AUTHORITY REVIEWED

Reviewed root `AGENTS.md`; required 0nya execution/current-state/backend/security/QA/Git-safety skills; `SYSTEM_MAP.md`; `CMS_BACKEND_CURRENT_STATE.md`; `APP_COMPLETION_ROADMAP.md`; `0NYA_RANKING_DOMAIN_CONTRACT_v1.0.md`; RANK-00, RANK-00A, and RANK-01 through RANK-05B reports; RankingDecision and behavior-event domain/validation/persistence code; ranking submission routes; prepared migrations; Search privacy helper; package tests and relevant repository conventions.

## 4. AUTONOMOUS AUTHORITY REVIEWED

Read the locked v2.4 Constitution, Macro Architecture Plan v1.1, Macro Architecture Blueprint v0.2, `CANONICAL_EVENT.md`, `READ_ONLY_OBSERVATION_GATE.md`, runtime/core boundaries, ADR-003, ADR-007, ADR-008, `core/interfaces.py`, Sensor, State construction, runtime configuration hashing, audit chain, persistence, and existing Story/Monetization adapter-contract precedents. Autonomous remains simulation-first and independently buildable; live app contact remains unauthorized.

## 5. PRE-IMPLEMENTATION BOUNDARY STATE

RANK-05B provided normalized decision/outcome evidence but no stable external observation envelope, no explicit temporal sections for adapter output, no deterministic observation serialization/replay ordering helper, and no concrete mapping into the actual four-field Autonomous `CanonicalEvent`. No live integration existed.

## 6. OBSERVATION ENVELOPE

`RankingObservationEnvelope` is `ranking_observation_v1`, emitted by `ranking_observation_adapter_v1`. It carries observation/source-schema identity, original timestamp, phase/type, decision/content/context linkage, policy/config/engine/candidate identity, attribution, and a controlled payload. It never exports raw Supabase rows or arbitrary Consumer JSON.

## 7. OBSERVATION TYPE VOCABULARY

Controlled types are exactly: `RANKING_DECISION`, `CONTENT_SERVED`, `CONTENT_IMPRESSION`, `CONTENT_OPEN`, `PLAY_START`, `QUALIFIED_WATCH`, `PLAY_COMPLETE`, and `PLAY_ABANDON`. No AI/model/Autonomous decision types were introduced.

## 8. RANKING DECISION MAPPING

`ranking_decision_v1` maps to `RANKING_DECISION`. The observation ID equals the immutable ranking decision UUID; original `created_at`, policy/version, config version/hash, engine version, candidate-set identity/version/count, surface/row, deterministic state, normalized candidate evidence, and exact one-based ordered results survive. Experiments and propensity values are rejected.

## 9. BEHAVIOR EVENT MAPPING

Mappings are exact: `content_served→CONTENT_SERVED`, `content_impression→CONTENT_IMPRESSION`, `content_open→CONTENT_OPEN`, `play_start→PLAY_START`, `qualified_watch→QUALIFIED_WATCH`, `play_complete→PLAY_COMPLETE`, and `play_abandon→PLAY_ABANDON`. Behavior payload is allowlisted per event; unsupported metadata is omitted and malformed required evidence fails validation.

## 10. TEMPORAL INTEGRITY RESULT

The adapter retains `createdAt`/`occurredAt` as `occurred_at`; `CanonicalEvent.timestamp` is a field-name transform of that original value. Canonical ISO-8601 UTC is required. No wall-clock processing timestamp is inserted. Replay order is deterministic by `occurred_at`, then `observation_id`.

## 11. PRE/DECISION/POST CLASSIFICATION

- `PRE_DECISION`: normalized candidates, candidate count/export mode, eligibility/filter evidence, request context.
- `DECISION_TIME`: ranking decision ID, policy/config/engine identity, deterministic flag, exact ordered results and one-based positions.
- `POST_DECISION`: served/impression/open/play/watch/complete/abandon evidence and separately-labelled later attribution.

Decision payloads have distinct `pre_decision` and `decision_time` objects. Behavioral payloads have only `post_decision`. Tests prove outcome data cannot appear in decision-time output.

## 12. AUTONOMOUS CANONICALEVENT MAPPING

The current Autonomous contract has no explicit version field and consists of `event_id`, `timestamp`, `observable_features`, and `context`. The adapter records compatibility identity as `canonical_event_unversioned_2026-09-05` without changing Autonomous.

| Envelope field | Mapping | Canonical location |
| --- | --- | --- |
| `observation_id` | `DIRECT_MAP` | `event_id` |
| `occurred_at` | `TRANSFORMED_MAP` | `timestamp` (rename only) |
| `observation_type` | `DIRECT_MAP` | `observable_features.observation_type` |
| `source_surface` | `DIRECT_MAP` | `observable_features.source_surface` |
| decision policy/version | `DIRECT_MAP` | decision `observable_features` |
| schema/adapter/source versions | `DIRECT_MAP` | `context` |
| evidence phase | `DIRECT_MAP` | `context.evidence_phase` |
| actor/session/content/decision IDs | `DIRECT_MAP` | `context` only; never observable feature inputs |
| row/position | `DIRECT_MAP` | `context` |
| config/engine/candidate identity | `DIRECT_MAP` | `context` |
| recommendation/behavior/attribution | `DIRECT_MAP` | `context` |
| decision payload | `TRANSFORMED_MAP` | `context.decision_evidence` |
| behavior payload | `TRANSFORMED_MAP` | `context.outcome` |
| `adapted_at` | `NOT_EXPORTED` | omitted to retain deterministic output |
| live delivery/action callback | `NOT_SUPPORTED` | outside current contract/authority |

Compatibility is conceptual: the current Sensor accepts this shape and State copies observable features/context, but the Autonomous runtime uses a reproducible logical-clock convention while App evidence uses ISO-8601 event time. A future authorized ingestion runner must define deterministic logical-time sequencing without replacing the retained source timestamp.

## 13. ACTOR / SESSION RESULT

Actor is accepted only as the separate `serverActorId` adapter context, validated as UUIDv4, and defaults to null. The adapter never reads actor identity from client evidence and never upgrades anonymous null to a persistent identity. Purpose-limited session UUIDv4 is preserved when present.

## 14. SEARCH PRIVACY RESULT

Only the existing sanitized `queryContext`/`searchQueryContext` representation may cross. Email- and phone-like strings are redacted through the existing RANK-04/RANK-05 sanitizer. Raw query text, URLs, tokens, phone numbers, profiles, entitlements, and arbitrary metadata do not cross.

## 15. DECISION / OUTCOME LINKAGE

`ranking_decision_id` survives on every linked observation and is nullable for direct/deep-link entry. `content_id` and `session_id` accompany it where present. Correlation never depends on actor identity or `content_id` alone.

## 16. CANDIDATE-SET EXPORT STRATEGY

`CANDIDATE EXPORT: BOUNDED`. The existing Autonomous repository cannot resolve an App-private reference, so reference-only export would not support replay. The adapter exports the existing normalized decision-time candidate list, bounded to 200, plus `candidate_set_id`, version, count, and export mode. It does not export raw DB/CMS/catalog rows, media URLs, entitlement state, universal scores, or unbounded snapshots.

## 17. ORDERED RESULT EXPORT

The bounded normalized result contains `content_id`, `content_type`, one-based contiguous `position`, optional product recommendation reason, and optional editorial provenance. No synthetic score or selection probability is exported.

## 18. ELIGIBILITY EVIDENCE RESULT

Candidate evidence can state `eligible` or a controlled `FORMAT_FILTER`/`GENRE_FILTER` reason. This is immutable decision-time evidence, not entitlement authority and not permission to change access constraints.

## 19. ADAPTER VERSIONING

Kept separate: App decision schema `ranking_decision_v1`; App behavior schema `ranking_behavior_v1`; candidate schema `ranking_candidate_set_v1`; observation schema `ranking_observation_v1`; adapter version `ranking_observation_adapter_v1`; and the currently unversioned Autonomous contract compatibility label.

## 20. VALIDATION RESULT

Validation covers observation/source type, UUIDv4 identities, canonical timestamps, surfaces, content types, policies/versions, hashes, one-based/contiguous positions, candidate/result consistency, bounds, exact request-context keys, controlled outcome metadata, actor/session semantics, privacy sanitization, experiment/propensity rejection, and Autonomous decision-reason exclusion. Deterministic recursive-key serialization is provided.

## 21. TRANSPORT STATUS

`ADAPTER_LIBRARY_ONLY` and `LIVE_DELIVERY_NOT_AUTHORIZED`. No network, endpoint, polling, database writer, Autonomous import, callback, or cross-repository runtime path was added.

## 22. REPLAY FIXTURES

Synthetic deterministic fixtures cover: Home editorial → served → impression → open → play → complete; Explore decision → served → impression → open → abandon; Search decision → served → impression → open → play; and direct playback with null `ranking_decision_id`. Tests prove chronology and provenance. No production data is present.

## 23. AUTONOMOUS COMPATIBILITY RESULT

Contract compatibility is `YES`: translated observations have exactly the four `CanonicalEvent` keys and can conceptually enter `CanonicalEvent → Sensor → State/evidence`. Identifiers stay out of `observable_features`; outcomes are labelled under `context.outcome`; there is no Oracle path, direct structural-memory write, Safety Governor bypass, Seed action mutation, or decision-time outcome backfill. Live/runtime integration is not claimed.

## 24. FAIL-OPEN RESULT

The library is pure, has no delivery side effect, and is not called from ranking/render/navigation/playback paths. Therefore adapter absence/failure currently has zero product impact. Any future delivery must remain asynchronous/non-blocking and must not become a ranking dependency.

## 25. FILES MODIFIED

- `src/lib/ranking/observation-adapter.ts` (new)
- `src/lib/ranking/observation-adapter.fixtures.ts` (new)
- `src/lib/ranking/observation-adapter.test.ts` (new)
- `package.json` (test registration only)
- `docs/agent-state/RANK-05C_REPORT.md` (new)

No Autonomous file was modified.

## 26. TESTS ADDED / UPDATED

Added adapter tests covering required mappings, nullable linkage, version/policy/config identity, positions, bounded normalized candidates, private/sensitive-field omission, Search redaction, original timestamps, phase isolation, deterministic serialization/replay, malformed rejection, forbidden reason absence, fixture chronology, and exact CanonicalEvent shape. Existing ranking and full test scripts include the suite.

## 27. TEST RESULTS

- Focused ranking behavior/evidence/adapter: 52 passed, 0 failed.
- Full repository suite: 306 passed, 17 intentional skips, 0 failed (323 total).
- Root TypeScript: passed.
- Targeted adapter ESLint: passed.
- Next.js 16 production build: passed. Static generation logged existing unavailable published-series data, but build completed successfully.
- Relevant `git diff --check`: passed; only an existing line-ending warning for `package.json` was emitted.

## 28. REGRESSION VERIFICATION

No ranking producer, comparator, filter, ordering, API route, Android code, behavior emitter, database schema, migration, entitlement, playback authorization, or user flow was changed. Existing ranking tests and the complete repository suite pass; production build and typecheck pass.

## 29. REMAINING GAPS

- Ranking migrations remain prepared-only and require separately authorized review/application/runtime verification.
- No live observation sink or authenticated export job exists; this is intentional.
- Autonomous lacks an explicit CanonicalEvent schema version and production-time/logical-time ingestion convention. The adapter reports this compatibility gap rather than changing Autonomous.
- A future authorized ingestion task must define custody, append-only persistence, replay packaging, audit-chain attachment, config/experiment association, operational access, retention, and failure monitoring.
- Contract readiness does not grant Autonomous Shadow runtime authorization, recommendation authority, or live ranking authority.

## 30. AUTONOMOUS BOUNDARY CONFIRMATION

Only Consumer-side passive translation preparation was added. No Autonomous repository/core/Constitution/Seed action-space file changed. There is no reverse direction, action interface, recommendation, ranking mutation, Autonomous decision reason, personalization, behavioral ranking, Most Watched, algorithmic Trending, experiment, propensity, or deployment.

## 31. FINAL GATES

- `RANK-05C: PASS`
- `OBSERVATION ENVELOPE: PASS`
- `RANKING DECISION MAPPING: PASS`
- `BEHAVIOR EVENT MAPPING: PASS`
- `TEMPORAL BOUNDARY PRESERVED: YES`
- `CANONICAL EVENT COMPATIBLE: YES`
- `CANDIDATE EXPORT: BOUNDED`
- `PRIVACY BOUNDARY: PASS`
- `ADAPTER VERSIONED: YES`
- `LIVE TRANSPORT ADDED: NO`
- `ACTION ADAPTER ADDED: NO`
- `AUTONOMOUS DECISION REASON ADDED: NO`
- `RANKING BEHAVIOR CHANGED: NO`
- `AUTONOMOUS CORE MODIFIED: NO`
- `SEED ACTION SPACE CHANGED: NO`
- `CONSTITUTION CHANGE REQUIRED: NO`
- `READY FOR AUTONOMOUS OBSERVATION INTEGRATION: YES` (contract/preparation only; requires a separately authorized integration task)
- `READY FOR AUTONOMOUS SHADOW MODE: NO`
- `READY FOR LIVE AUTONOMOUS RANKING: NO`
