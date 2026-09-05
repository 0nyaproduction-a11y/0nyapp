# RANK-05B — Ranking Decision Evidence Contract Implementation

## 1. EXECUTIVE VERDICT

RANK-05B: PASS at source level. The implementation adds an observational RankingDecision contract, decision-time candidate/result snapshots, server persistence preparation, and downstream event linkage without changing ranking order or access authority. Database persistence remains PREPARED_ONLY because no migration was applied and no live database verification was authorized.

## 2. SAFETY / WORKTREE STATE

- CWD: `C:\Users\Akash\Documents\0nyapp`
- Branch: `qa/netlify-api-e34ab5e`
- HEAD: `ac9e11676c3434cb16b4f33adc4208e1c7c4f1e5`
- `.git/index`: readable and non-zero before implementation; final observed size 47,023 bytes. The previously reported zero-byte condition was not present and no Git metadata repair was performed.
- Worktree: pre-existing heavy dirty state retained; final snapshot contained 90 modified and 104 untracked paths.
- Safety: no reset, clean, stash, commit, push, deploy, or remote migration apply.
- High-collision paths handled in place: server Home/catalog/ranking routes and types; Android Home/Explore/Search/navigation/API/event files.

## 3. AUTHORITY REVIEWED

Reviewed the governing ranking contract, RANK-00 through RANK-05A reports, root and Android agent instructions, project execution/current-state/git/backend/Android/playback/security/QA skills, Product/UI Bible, master flow, existing ranking/search/discovery code, Next.js 16 route-handler/`after()` documentation, Expo 57 project documentation, and Supabase RLS/Postgres guidance.

## 4. PRE-IMPLEMENTATION DECISION-EVIDENCE STATE

RANK-05A already supplied versioned behavioral events and nullable `ranking_decision_id`, but the producer always wrote null and there was no first-class decision record, immutable candidate snapshot, exact ordered-result snapshot, or surface decision creation lifecycle.

## 5. RANKING DECISION MODEL

The canonical `ranking_decision_v1` object records decision/session identity, policy/config/engine identity, candidate-set identity, source surface/row, deterministic/experiment/propensity state, bounded request context, candidate evidence, and exact ordered results. Server and Android producers share the same semantic shape.

## 6. RANKING_DECISION_ID RESULT

Each meaningful evaluation receives a UUIDv4 distinct from content, row, candidate-set, and session identifiers. React memoization keeps an ID stable across harmless rerenders; changed normalized Search/filter/result inputs create a fresh evaluation and ID. Server Home creates fresh IDs for each catalog request.

## 7. POLICY / VERSION MODEL

- Home rows and Spotlight: `editorial` / `home_editorial_v1`.
- Explore: `default_catalog` / `explore_filter_order_v1`.
- Search: `search_relevance` / `search_match_priority_v1`.
- Continue Watching: `continue_watching` / `last_watched_at_desc_v1`.

These names map directly to existing behavior; no learned or synthetic policy was added.

## 8. CONFIG IDENTITY RESULT

Home reuses the RANK-02 canonical editorial `config_version` and SHA-256 `config_hash`. Explore, Search, and Continue Watching use stable request/config schema versions and null hashes because those client policies do not have canonical hashed configuration documents.

## 9. RANKING ENGINE VERSION RESULT

Server Home uses `home_server_v1`; client Explore/Search use `android_discovery_v1`; client Continue Watching uses `android_continue_watching_v1`. These identify the producing implementation rather than an arbitrary app build.

## 10. CANDIDATE SET MODEL

Every decision has a UUID `candidate_set_id`, `ranking_candidate_set_v1`, count, and same-row immutable snapshot reference. Candidate snapshots contain only content identity/type, eligibility/filter evidence, pre-rank/final positions, recommendation reason, and optional editorial provenance.

## 11. DECISION-TIME ELIGIBILITY RESULT

Candidate eligibility is stored at decision time in `candidate_snapshot`; audits do not consult later catalog state. Explore and Search snapshot the full discoverable catalog input. Home snapshots the authority-resolved row/Spotlight pool; Continue Watching snapshots the visible, resolved shelf. Final access/entitlement authority remains unchanged and outside ranking.

## 12. FILTER / EXCLUSION REASONS

The implemented vocabulary is intentionally limited to real client filtering: `FORMAT_FILTER` and `GENRE_FILTER`. Search query matching affects result membership/reason without fabricating an exclusion reason. Server catalog/media/publication checks remain the existing upstream eligibility authority.

## 13. ORDERED RESULT MODEL

`ordered_results` stores the exact result emitted by the producer, with one-based contiguous positions and candidate/result consistency validation. No later catalog ordering is needed for reconstruction.

## 14. RECOMMENDATION REASON MODEL

The grounded vocabulary is `NEW_RELEASE`, `CONTINUE_WATCHING`, `SEARCH_RELEVANCE`, `GENRE_FILTER`, `FORMAT_FILTER`, and `EDITORIAL`. Generic default catalog results may remain null. This namespace is ranking/product evidence only.

## 15. EDITORIAL PROVENANCE LINKAGE

Home decisions preserve row ID, policy/version, config version/hash, New Releases source distinction, and real intervention values (`EDITORIAL_PIN` or `EDITORIAL_ORDER` where applicable). Chronological New Releases fill and category rows do not receive fabricated intervention values. `EDITORIAL_BOOST` was not added to the decision contract.

## 16. DETERMINISTIC / PROPENSITY STATUS

All decisions record `deterministic=true`, `propensity_type=none`, and null selection probabilities. Determinism is not misrepresented as probability 1.0.

## 17. EXPERIMENT STATUS

Experiment ID/variant fields are reserved and constrained null. The client submission validator rejects experiments, variants, randomized propensity types, and non-null probabilities. No assignment, cohort, routing, or A/B infrastructure was added.

## 18. HOME DECISION SEMANTICS

One server-generated decision is created per Home row and one for the Spotlight collection on each catalog request. Returned canonical row/item order is copied exactly. Full evidence is stripped from the public catalog response; only decision IDs and existing public provenance are exposed for event linkage. Persistence runs through Next.js `after()` and cannot delay the catalog response.

## 19. EXPLORE DECISION SEMANTICS

One client decision represents the currently displayed Explore result set. Initial generation and changes to normalized query, format, genre, or result input produce a new decision. Harmless rerenders reuse the memoized object. Existing filter and default-order functions are used unchanged.

## 20. SEARCH DECISION SEMANTICS

One client decision represents one normalized query/format/genre result evaluation. It snapshots the full discoverable input and the cards actually displayed, including the existing no-result suggestion fallback. NFKC normalization prevents cosmetic whitespace/case changes from altering query identity. Existing match-priority/title/stable-key order is unchanged, and private query context remains excluded from URL serialization.

## 21. BEHAVIORAL EVENT LINKAGE

The existing `ranking_behavior_events` path now accepts and persists validated decision ID, recommendation reason, and optional delayed-attribution fields. Served, measured impression, open, play start, qualified watch, completion, and explicit abandon carry the originating ID when navigation context has one. No duplicate event family was created.

## 22. DIRECT / NON-RANKED ENTRY RESULT

Discovery/navigation context fields are optional. Direct/deep-linked playback naturally resolves to `ranking_decision_id=null`; no synthetic decision is manufactured.

## 23. DELAYED ATTRIBUTION SEPARATION

Direct provenance remains `ranking_decision_id`. Optional later hypotheses use paired `attribution_source` and `attribution_policy`; validation requires both together and an explicit decision reference. No automatic later-behavior crediting was introduced.

## 24. PERSISTENCE / MIGRATION RESULT

`20260905162706_ranking_decision_evidence.sql` prepares one append-oriented `ranking_decisions` table with atomic JSONB candidate/result snapshots, constraints, indexes, RLS, and service-role select/insert privileges only. It additively extends `ranking_behavior_events` for recommendation and attribution fields. Local database lint could not connect to `127.0.0.1:54322` because the local Supabase service was not running. PERSISTENCE = PREPARED_ONLY.

## 25. SECURITY / PRIVACY RESULT

The client endpoint allowlists exact policy/surface/version/engine combinations; requires UUIDv4 identities, bounded counts/IDs/metadata, one-based positions, candidate/result consistency, and no client editorial provenance; derives actor identity server-side; rejects sensitive keys, experiments, and propensity values; and sanitizes query context for email/phone patterns. Candidate snapshots exclude media URLs, tokens, OTPs, entitlements, and unrelated PII. Database tables deny public/anon/authenticated direct access.

## 26. FAIL-OPEN RESULT

Android submissions are fire-and-forget with caught failures. Home persistence is scheduled after response and catches both returned failures and thrown errors. Evidence failure does not block rendering, filtering, navigation, playback, entitlement, or authorization.

## 27. FILES MODIFIED

RANK-05B work spans `package.json`; server ranking privacy/model/tests/routes, catalog/Home, and database types; the new prepared migration; and Android API/evidence identity/decision model/context/search/navigation/Home/Explore/Search/type files. Pre-existing unrelated worktree changes were preserved.

## 28. TESTS ADDED / UPDATED

Added `decision-evidence.test.ts` with the required 23 numbered contract assertions plus privacy and persistence tests. Updated behavioral completion expectations for nullable/valid decision context, and included ranking evidence tests in focused and full test scripts.

## 29. TEST RESULTS

- Ranking behavior/evidence: 40 passed, 0 failed.
- Full repository suite: 294 passed, 17 skipped, 0 failed.
- Android pure tests: 80 passed, 0 failed.
- Root TypeScript: pass.
- Android TypeScript: pass.
- Targeted new server-module lint: pass.
- Next.js 16 production build: pass.
- Local Supabase DB lint: not run to completion because local Postgres was unavailable.

## 30. REGRESSION VERIFICATION

Tests confirm default Explore order and existing Search relevance order remain unchanged, Home copies canonical order, one-based behavioral positions remain intact, private Search context remains out of URLs, and production build/type checks succeed. Targeted screen lint found no new ranking-evidence errors; an existing Home `require()` lint violation and unrelated warnings remain outside this task.

## 31. REMAINING GAPS

The migration must be reviewed/applied in an authorized database workflow, then live inserts/RLS/queryability should be verified. `editorial_change_ref` remains null because current Home result construction does not reliably identify one causative change event. No live Android device/network persistence run was performed.

## 32. AUTONOMOUS BOUNDARY CONFIRMATION

No Autonomous, Constitution, Seed action-space, observation-adapter, AI ranking, personalization, behavioral ranking, Most Watched, algorithmic Trending, experiments, or live ranking code was added or modified. Recommendation reasons remain a distinct product/ranking namespace.

## 33. FINAL GATES

- RANK-05B: PASS
- RANKING_DECISION MODEL: PASS
- RANKING_DECISION_ID: YES
- POLICY VERSIONING: YES
- CONFIG IDENTITY: YES
- CANDIDATE SET IDENTITY: YES
- DECISION-TIME ELIGIBILITY: YES
- ORDERED RESULT PRESERVED: YES
- RECOMMENDATION REASONS: YES
- EDITORIAL PROVENANCE LINKED: YES
- DETERMINISTIC FLAG: YES
- FAKE PROPENSITY ADDED: NO
- EXPERIMENT INFRASTRUCTURE ADDED: NO
- BEHAVIORAL EVENTS LINKED TO DECISION: YES
- DIRECT ENTRY NULL DECISION SUPPORTED: YES
- RANKING BEHAVIOR CHANGED: NO
- AUTONOMOUS MODIFIED: NO
- CONSTITUTION CHANGE REQUIRED: NO
- PERSISTENCE: PREPARED_ONLY
- READY FOR RANK-05C: YES
- READY FOR AUTONOMOUS OBSERVATION ADAPTER: NO
- READY FOR LIVE AUTONOMOUS RANKING: NO
