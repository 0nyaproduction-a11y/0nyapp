# RANK-05 — Behavioral Signal Foundation

## 1. EXECUTIVE VERDICT

RANK-05 is **PARTIAL**. A server-authoritative, append-only, versioned raw-event foundation now exists, with Search served/open evidence and player lifecycle integration for start, qualified watch, completion, and explicit abandonment. Reliable viewport instrumentation is not yet wired into the current ScrollView discovery surfaces, and Home/Explore emission is deferred; no impression is fabricated from mount/API delivery.

## 2. SAFETY / WORKTREE STATE

- CWD: `C:\Users\Akash\Documents\0nyapp`
- Branch: `qa/netlify-api-e34ab5e`
- HEAD: `ac9e11676c3434cb16b4f33adc4208e1c7c4f1e5`
- The worktree was heavily dirty before RANK-05. No reset, clean, stash, commit, push, deployment, or remote migration was performed.
- High-collision areas included Android analytics/API, playback, Home, Explore, Search, and navigation.
- Pending migrations before this phase included 029–034 plus other unrelated worktree migrations. RANK-05 adds prepared-only migration 035.
- During verification, an external/concurrent writer again truncated `.git/index` to zero bytes and transiently corrupted Search/Explore/Android tsconfig reads. The files recovered sufficiently for both typechecks to pass, but the index remained zero bytes; it was not repaired or overwritten.

## 3. AUTHORITY REVIEWED

Reviewed `AGENTS.md`, the app roadmap, ranking domain contract, RANK-00 through RANK-04 evidence, system/current-state maps, existing monetization and rewarded analytics, watch progress, playback/controller flows, Search attribution, navigation types, Supabase admin/auth/RLS conventions, and privacy/security constraints.

## 4. PRE-IMPLEMENTATION SIGNAL STATE

Rewarded analytics was intentionally monetization-only. `watch_progress` was authoritative for progress/completion but was not an append-only discovery evidence stream. No canonical raw behavioral stream covered the seven required events.

## 5. EVENT INFRASTRUCTURE DECISION

Created a dedicated `ranking_behavior_events` stream. Reusing `rewarded_monetization_events` would violate its domain boundary. The new endpoint validates a narrow envelope, derives authenticated actor identity server-side, and writes only through a server secret client.

## 6. EVENT ENVELOPE

`event_id`, `event_schema_version`, `event_type`, `occurred_at`, nullable `actor_id`, nullable `session_id`, `content_id`, `content_type`, `source_surface`, nullable `row_id`, nullable one-based `position`, nullable Search query/result context, bounded metadata, nullable reserved `ranking_decision_id`, and server `received_at`.

## 7. ACTOR IDENTITY RESULT

Authenticated actor IDs are derived from verified Supabase auth on the server. Anonymous events store a null actor; no device fingerprint, phone number, or second anonymous identity system was invented. `ANONYMOUS_ACTOR_ID_DEFERRED`.

## 8. SESSION IDENTITY RESULT

The Android runtime creates one random UUIDv4 discovery/playback session ID per app process. It is purpose-limited and not a cross-device identity. This is intentionally a minimal session primitive.

## 9. CONTENT_SERVED RESULT

Search emits once per stable rendered result collection snapshot, with content, surface, query, and one-based position. It is separate from impression. Home/Explore served wiring remains deferred.

## 10. CONTENT_IMPRESSION RESULT

The canonical validator requires measured exposure of at least 50% for at least 1000 ms and rejects mount/API-only impressions. Current ScrollView surfaces do not yet provide sufficiently reliable visibility callbacks, so client emission is deliberately not wired. `CONTENT_IMPRESSION_PARTIAL`.

## 11. CONTENT_OPEN RESULT

Search emits only from the deliberate result-card press before navigation and preserves the private RANK-04 context. Home/Explore open wiring remains deferred.

## 12. PLAY_START RESULT

Player emission is driven by `usePlaybackController().isPlaying`, whose source is the expo-video `playingChange` lifecycle—not route arrival, render, or tap.

## 13. QUALIFIED_WATCH RESULT

**PROVISIONAL SIGNAL DEFINITION:** `continuous_playback_30s_v1` emits once after 30 accumulated seconds of forward playback deltas. Paused time, non-positive deltas, and jumps over two seconds (seeks/reconnect discontinuities) are excluded.

## 14. PLAY_COMPLETE RESULT

Emits only after the existing final watch-progress save resolves, including the auto-next handoff path. The event records `completion_source: watch_progress_final_save`; it does not define a competing completion ledger.

## 15. PLAY_ABANDON RESULT

Emits only after actual playback start when the user explicitly exits through the player Back action and completion has not occurred. Backgrounding, pause, network failure, crash, and unknown incomplete state are not classified as abandon. Other native/navigation exit gestures are not yet proven and remain partial.

## 16. SOURCE / ROW / POSITION RESULT

Controlled surfaces: `home`, `explore`, `search`, `continue_watching`, `detail`, `direct`. Position is one-based everywhere. Row is nullable and bounded. Search is wired; other discovery surfaces remain schema-ready.

## 17. SEARCH ATTRIBUTION CONTEXT RESULT

RANK-04 private navigation context now flows from Search open through Watch/Short Film playback evidence. Search evidence requires result position. Email/phone-like query text is redacted server-side and context is never placed in a public URL.

## 18. PERSISTENCE / MIGRATION RESULT

- Table: `public.ranking_behavior_events`
- Migration: `supabase/migrations/20260905040000_035_ranking_behavior_events.sql`
- Indexes: occurred time; content/type/time; partial actor/time
- RLS: enabled; public/anon/authenticated table access revoked; service role select/insert only
- Write path: `POST /api/v1/ranking/events` using server admin client
- Retention: no new policy invented
- Status: prepared only; not applied locally or remotely

## 19. EVENT VERSIONING RESULT

All persisted events use `ranking_behavior_v1`. Impression and qualified-watch semantics can evolve under a new schema version.

## 20. DEDUPLICATION / IDEMPOTENCY RESULT

The client creates a UUIDv4 event ID once per emission attempt. The primary key deduplicates retries; PostgreSQL unique violation returns success with `deduplicated: true`. No global content-ID dedupe suppresses legitimate repeat behavior.

## 21. PRIVACY / SECURITY RESULT

Exact top-level fields are allowlisted. Sensitive key names are rejected recursively in metadata; metadata is capped at 2 KiB. Tokens, OTP/PIN/password/keys, purchase tokens, cookies, and signed/playback URLs are rejected. Search email/phone patterns are redacted. Actor identity is server-derived.

## 22. FAIL-OPEN RESULT

Mobile emission is fire-and-forget and catches all failures. Navigation, playback, entitlement, and watch progress do not await behavioral persistence. Development-only warnings contain only the error message.

## 23. FILES MODIFIED

- `src/lib/ranking/behavior-events.ts`
- `src/lib/ranking/behavior-events.test.ts`
- `src/app/api/v1/ranking/events/route.ts`
- `src/types/database.ts`
- `supabase/migrations/20260905040000_035_ranking_behavior_events.sql`
- `apps/android/src/lib/behavioralEvents.ts`
- `apps/android/src/lib/api.ts`
- `apps/android/src/screens/SearchResultsScreen.tsx`
- `apps/android/src/player/PlayerScreen.tsx`
- `apps/android/src/screens/WatchScreen.tsx`
- `apps/android/src/screens/ShortFilmPlaybackScreen.tsx`
- `docs/agent-state/RANK-05_REPORT.md`

## 24. TESTS ADDED / UPDATED

Six tests cover version/envelope validation, served-vs-impression semantics, exact viewport threshold, Search open/play attribution and PII redaction, deterministic qualified watch, completion/abandon classification, controlled surfaces, one-based positions, and sensitive-field rejection.

## 25. TEST RESULTS

- New RANK-05 tests: 6 passed, 0 failed
- Existing repository tests: 254 passed, 0 failed, 17 intentional skips
- Root TypeScript: passed
- Android TypeScript: passed
- New foundation files ESLint: passed
- Broader touched-file lint: one pre-existing `react-hooks/set-state-in-effect` error at PlayerScreen line 439 plus existing warnings; the reported line is unrelated to RANK-05.

## 26. REGRESSION VERIFICATION

No Home, Explore, or Search comparator/order implementation was modified. No score, recommendation, personalization, experimentation, candidate-set, propensity, or ranking-decision generation was added. Existing test suite and both typechecks pass.

## 27. REMAINING GAPS

- Add framework-reliable viewport measurement before emitting impressions.
- Wire served/open context for Home, Explore, and Continue Watching without changing their order.
- Decide a privacy-authorized anonymous actor primitive, if needed.
- Expand explicit-abandon coverage only for navigation gestures with trustworthy semantics.
- Apply migration through a separately authorized environment workflow, then add persistence integration tests.
- Repair/restore the externally corrupted Git index outside this phase.

## 28. AUTONOMOUS BOUNDARY CONFIRMATION

No Autonomous, Constitution, Seed action space, observation adapter, reward score, or live ranking code was touched. `ranking_decision_id` is nullable storage only and is never accepted/generated by the client endpoint.

## 29. FINAL GATES

- RANK-05: PARTIAL
- BEHAVIORAL EVENT FOUNDATION: PARTIAL
- CONTENT_SERVED: PARTIAL
- CONTENT_IMPRESSION: PARTIAL
- CONTENT_OPEN: PARTIAL
- PLAY_START: PASS
- QUALIFIED_WATCH: PASS
- PLAY_COMPLETE: PASS
- PLAY_ABANDON: PARTIAL
- ACTOR_ID: PARTIAL
- SESSION_ID: YES
- SOURCE/ROW/POSITION CONTEXT: PARTIAL
- SEARCH ATTRIBUTION CONTEXT: YES
- EVENT PERSISTENCE: PREPARED_ONLY
- RAW EVIDENCE PRESERVED: YES
- UNIVERSAL REWARD SCORE ADDED: NO
- RANKING BEHAVIOR CHANGED: NO
- HOME ORDER CHANGED: NO
- EXPLORE ORDER CHANGED: NO
- SEARCH ORDER CHANGED: NO
- AUTONOMOUS MODIFIED: NO
- CONSTITUTION CHANGE REQUIRED: NO
- READY FOR RANK-05B: NO
- READY FOR AUTONOMOUS OBSERVATION ADAPTER: NO
- READY FOR LIVE AUTONOMOUS RANKING: NO
