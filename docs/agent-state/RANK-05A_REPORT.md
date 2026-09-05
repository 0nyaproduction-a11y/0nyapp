# RANK-05A — Behavioral Evidence Completion

## 1. EXECUTIVE VERDICT

RANK-05A: **PASS (SOURCE VERIFIED)**. The RANK-05 surface gaps are closed in source: Home, Explore, and Search now emit served, deliberate open, and measured viewport impression evidence with discovery origin continuity into playback. Persistence is schema-ready but remains intentionally unapplied.

## 2. SAFETY / WORKTREE STATE

- CWD: `C:\Users\Akash\Documents\0nyapp`
- Branch: `qa/netlify-api-e34ab5e`
- HEAD: `ac9e11676c3434cb16b4f33adc4208e1c7c4f1e5`
- `.git/index`: **damaged; zero bytes**, timestamp `2026-09-05 21:10:57`. It was not repaired, recreated, reset, or replaced.
- `git status`/diff inspection remains unavailable because Git rejects the truncated index. Filesystem and targeted source evidence were used safely.
- Existing dirty/untracked work was preserved. No reset, clean, stash, commit, push, deploy, or remote mutation occurred.
- High-collision files: Home, Explore, Search, PlayerScreen, Android API/navigation, event validation, DB types, migration 035.
- Pending migrations through `20260905040000_035_ranking_behavior_events.sql` remain unapplied by this task.

## 3. AUTHORITY REVIEWED

Reviewed root/Android AGENTS instructions, Expo SDK 57 documentation, Supabase current RLS/security documentation and breaking-change index, project execution/current-state/Android/backend/playback/QA/Git skills, ranking domain contract, RANK-00–05 reports, current code, navigation, event foundation, and migration 035.

## 4. PRE-CLOSURE EVENT COVERAGE

RANK-05 had Search served/open and playback events. Home/Explore served/open and every surface's viewport impressions were missing. Discovery context was Search-only.

## 5. HOME CONTENT_SERVED RESULT

Home emits `content_served` only after a successfully loaded collection is rendered. Spotlight, Continue Watching, and enabled CMS rows are covered. CMS rows preserve `row.id`; position is the one-based index in the exact rendered row. A stable collection fingerprint prevents rerender duplicates.

## 6. HOME CONTENT_OPEN RESULT

Spotlight poster/info/watch actions, Continue Watching selection, and CMS row cards emit from deliberate presses. They preserve content, Home surface, available row ID, and displayed position without changing navigation behavior.

## 7. EXPLORE CONTENT_SERVED RESULT

Explore emits the post-filter/post-sort `filteredItems` array in its displayed order. Position is `index + 1`; `row_id` is null. Each unique collection fingerprint emits once per screen/session lifetime.

## 8. EXPLORE CONTENT_OPEN RESULT

Explore card presses emit content/open evidence with the exact displayed position before existing Series/Short Film navigation.

## 9. SEARCH IMPRESSION RESULT

Search cards use the existing RANK-04 content/query/result context. Impression evidence preserves the existing one-based result position and private query attribution.

## 10. VIEWPORT IMPRESSION IMPLEMENTATION

`BehaviorImpression` wraps the actual rendered card without changing ordering. It calls React Native `measureInWindow` after layout and on real vertical/horizontal scroll signals, calculates visible card area against the current window, and begins a timer only while measured visibility is at least 50%. At 1000 ms it remeasures before emitting. Falling below 50% clears elapsed exposure. Unfocused screens and Explore's covering genre modal cannot qualify.

Mount, API response, off-screen layout, and detached timers do not qualify as impressions.

## 11. IMPRESSION DEDUPLICATION

The key is:

`session_id | surface | collection_context | row_id | content_id | displayed_position`

It emits at most once for that collection exposure context. A changed filter/query/content collection produces a new context. It does not suppress later exposures globally or across app-process sessions.

## 12. ROW IDENTITY RESULT

CMS Home rows use canonical `row.id`, never translated/display titles. Spotlight uses the existing spotlight-row ID when present. Non-CMS Continue Watching, Explore, and Search use null row identity.

## 13. POSITION SEMANTICS RESULT

All positions are one-based:

- Home: position within the rendered canonical row/rail
- Explore: post-filter/post-sort displayed position
- Search: established RANK-04 result position

## 14. PLAYBACK CONTEXT CONTINUITY

The private navigation context is generalized to controlled discovery origins. Home, Explore, and Search context propagates through Series/Short Film detail and into Watch/Short Film playback evidence. No context is placed in public URLs.

## 15. PERSISTENCE SCHEMA REVIEW

`ranking_behavior_events` is additive and append-oriented. UUID primary-key idempotency, client occurrence/server receipt timestamps, nullable server-derived actor, session/content/surface/row/position/Search fields, schema version, bounded API validation, nullable future `ranking_decision_id`, audit indexes, RLS, revoked client writes, and service-role-only insert/select were verified.

Current Supabase guidance confirms that table grants and RLS are separate controls; migration 035 explicitly uses both. No policy grants client access.

Result: `PERSISTENCE_SCHEMA_VERIFIED`.

## 16. MIGRATION STATUS

Migration 035 is **PREPARED_ONLY** and was not applied. Local execution could not be proven because the installed `supabase.cmd` shim resolves to a missing path; no remote fallback was attempted. Runtime persistence is therefore not claimed.

## 17. ACTOR / SESSION STATUS

Authenticated actor identity remains server-derived. Anonymous actor stays null (`ANONYMOUS_ACTOR_ID_DEFERRED`). Session identity remains a purpose-limited app-process UUIDv4.

## 18. FAIL-OPEN RESULT

All event calls are fire-and-forget with caught rejection. Home, Explore, Search, navigation, playback, watch progress, entitlement, and playback authorization never await behavioral persistence.

## 19. FILES MODIFIED

RANK-05A additions/updates:

- `apps/android/src/components/Screen.tsx`
- `apps/android/src/components/BehaviorImpression.tsx`
- `apps/android/src/lib/behaviorImpressionModel.ts`
- `apps/android/src/lib/behaviorContext.ts`
- `apps/android/src/lib/behavioralEvents.ts`
- `apps/android/src/navigation/types.ts`
- `apps/android/src/screens/HomeScreen.tsx`
- `apps/android/src/screens/ExploreScreen.tsx`
- `apps/android/src/screens/SearchResultsScreen.tsx`
- `apps/android/src/player/PlayerScreen.tsx`
- `src/lib/ranking/behavior-evidence-completion.test.ts`
- `package.json`
- `docs/agent-state/RANK-05A_REPORT.md`

RANK-05 foundation files and migration 035 were preserved rather than replaced.

## 20. TESTS ADDED / UPDATED

Behavioral tests now cover Home row/position served/open, Explore displayed order, Search position, geometric visibility, 50% threshold, 1000 ms threshold, off-screen exclusion, exposure reset, rerender dedupe, collection served dedupe, all three playback origins, one-based validation, client ranking-decision rejection, fail-open transport, and prepared schema security/idempotency.

## 21. TEST RESULTS

- `npm run test:ranking-behavior`: 15 passed, 0 failed
- Existing repository suite: 254 passed, 0 failed, 17 intentional skips
- Root TypeScript: passed
- Android TypeScript: passed
- New/shared foundation-file ESLint: passed
- Full Home/Player touched-file lint still contains established unrelated errors (`require()` asset import and Player effect state warning); no new foundation lint error remains.
- Emulator/physical-device runtime acceptance: not performed; status remains SOURCE VERIFIED.

## 22. REGRESSION VERIFICATION

No comparator, filter, sort, CMS canonical order, Search matcher, New Releases logic, eligibility, entitlement, authorization, watch-progress, taxonomy, or recent-Search behavior was changed. The existing 254-test suite and both typechecks pass.

## 23. REMAINING GAPS

- Authorized migration application and environment persistence integration test.
- Emulator runtime verification of measurement events, followed by the repository's screenshot/owner/physical-device acceptance sequence if final Android acceptance is requested.
- Privacy-approved persistent anonymous actor remains intentionally deferred.
- Git index repair requires separate authorization/coordination.
- Explicit Back remains the conservative abandon definition; other unknown exits remain excluded.

These gaps do not require redesigning the event contract and do not block RANK-05B design work.

## 24. AUTONOMOUS BOUNDARY CONFIRMATION

No Autonomous, Constitution, Seed action space, ranking decision generation, candidate set, propensity, experimentation, behavioral ranking, recommendation, or universal score code was added. The endpoint writes `ranking_decision_id = null` only.

## 25. FINAL GATES

- RANK-05A: PASS
- HOME CONTENT_SERVED: PASS
- HOME CONTENT_OPEN: PASS
- EXPLORE CONTENT_SERVED: PASS
- EXPLORE CONTENT_OPEN: PASS
- SEARCH CONTENT_IMPRESSION: PASS
- HOME CONTENT_IMPRESSION: PASS
- EXPLORE CONTENT_IMPRESSION: PASS
- VIEWPORT IMPRESSION SEMANTICS: VERIFIED
- SOURCE/ROW/POSITION COVERAGE: YES
- PLAYBACK ORIGIN CONTINUITY: YES
- EVENT PERSISTENCE: PREPARED_ONLY
- RAW EVIDENCE PRESERVED: YES
- RANKING BEHAVIOR CHANGED: NO
- RANKING_DECISION_ID GENERATED: NO
- PROPENSITY ADDED: NO
- AUTONOMOUS MODIFIED: NO
- CONSTITUTION CHANGE REQUIRED: NO
- READY FOR RANK-05B: YES
- READY FOR AUTONOMOUS OBSERVATION ADAPTER: NO
- READY FOR LIVE AUTONOMOUS RANKING: NO
