# APP-AUTO-GAPS-01 — Pre-Launch Autonomous-Readiness Gap Extraction

**Date:** 2026-09-06  
**Source:** `APP_AUTO_READINESS_AUDIT.md`  
**Scope:** Non-ranking Consumer App readiness only. No Autonomous implementation,
transport, migration, deployment, or behavior change is authorized by this
document.

## A. MUST FIX BEFORE APP LAUNCH

### A1 — Shared server-side observation envelope

- **Domain:** Cross-domain foundation; session, monetization, access, failure
- **Exact missing capability:** One versioned, privacy-reviewed envelope with
  server-reconstructed actor/session context, immutable occurred/received
  timestamps, correlation ID, retry-stable request/dedupe identity, explicit
  pre/decision/post phase, and linked outcomes.
- **Existing system to reuse:** The ranking behavior validation and
  CanonicalEvent projection patterns; existing server route/RPC/provider IDs.
- **Why it matters:** Without this, non-ranking actions and outcomes cannot be
  replayed, deduplicated, or causally linked.
- **Smallest implementation:** Define the shared contract and allowlists first;
  add only the required correlation/request/dedupe fields at existing
  authoritative boundaries and emit bounded observations server-side.
- **Files likely involved:** `src/lib/ranking/behavior-events.ts`,
  `src/lib/ranking/observation-adapter.ts`, `src/lib/monetization/events.ts`,
  `src/lib/api/**/route.ts`, relevant Supabase migrations and generated types.
- **Migration needed:** YES
- **Privacy risk:** HIGH
- **Launch blocker:** YES
- **Autonomous blocker:** YES

### A2 — Runtime proof for existing evidence persistence and RLS

- **Domain:** Content performance; ranking-adjacent observation foundation
- **Exact missing capability:** Verified runtime application of prepared evidence
  persistence, RLS/grants, deduplication, and replay behavior in the approved
  environment.
- **Existing system to reuse:** `ranking_behavior_events`,
  `ranking_decisions`, their validation routes, and the existing ranking
  observation adapter. Do not create another performance table.
- **Why it matters:** Source-prepared schemas are not evidence that launch
  runtime persistence is safe, durable, or queryable.
- **Smallest implementation:** Apply through the authorized database workflow,
  run bounded insert/duplicate/privacy/RLS/replay checks, and record the
  result. This audit itself does not apply anything.
- **Files likely involved:** `src/app/api/v1/ranking/events/route.ts`,
  `src/app/api/v1/ranking/decisions/route.ts`,
  `supabase/migrations/20260905040000_035_ranking_behavior_events.sql`,
  `supabase/migrations/20260905162706_ranking_decision_evidence.sql`.
- **Migration needed:** YES
- **Privacy risk:** HIGH
- **Launch blocker:** YES
- **Autonomous blocker:** YES

### A3 — Authoritative monetization and access outcome linkage

- **Domain:** Monetization; access/entitlement
- **Exact missing capability:** Bounded post-action observations linking
  server-authoritative offer/action/outcome records to a request/correlation
  identity, without exporting secrets or making analytics authoritative.
- **Existing system to reuse:** Wallets, `coin_transactions`,
  `payment_orders`, `episode_entitlements`, subscriptions,
  `rewarded_ad_attempts`, SSV results, Chai ledger/RPCs, `canUserWatchEpisode`,
  and the typed monetization event vocabulary.
- **Why it matters:** Autonomous cannot safely observe purchase, reward,
  entitlement, or playback-access outcomes when the originating action and
  authoritative result cannot be joined.
- **Smallest implementation:** Add server-generated linkage and a bounded
  outcome projection for coin purchase, rewarded grant, Chai, entitlement,
  and access decisions; keep all ledgers and access decisions authoritative.
- **Files likely involved:** `src/lib/monetization/events.ts`,
  `src/lib/monetization/validation.ts`, `src/lib/purchases.ts`,
  `src/lib/rewarded-backend.ts`, `src/lib/entitlements.ts`,
  `src/lib/playback.ts`, billing/rewarded/Chai API routes, Supabase types.
- **Migration needed:** YES
- **Privacy risk:** HIGH
- **Launch blocker:** YES
- **Autonomous blocker:** YES

### A4 — Normalized failure taxonomy with causal linkage

- **Domain:** Failure/system events
- **Exact missing capability:** Durable, privacy-safe classifications for
  payment, playback, access, provider, API, and persistence failures linked to
  the originating request/action/provider record.
- **Existing system to reuse:** API error envelopes, route status codes,
  payment/order statuses, rewarded attempts, Mux webhook state, and existing
  performance markers.
- **Why it matters:** A transport error, business denial, provider rejection,
  and security failure must not be conflated; otherwise observation and
  operational diagnosis are misleading.
- **Smallest implementation:** Define an allowlisted failure enum and emit
  server-side failure observations with source, safe code, correlation/request
  ID, and original timestamp. Retain subsystem records as authority.
- **Files likely involved:** `src/lib/api/responses.ts`,
  `src/app/api/v1/**/route.ts`, payment/rewarded/playback modules,
  `src/app/api/webhooks/**`, Supabase migration/types.
- **Migration needed:** YES
- **Privacy risk:** HIGH
- **Launch blocker:** YES
- **Autonomous blocker:** YES

## B. SHOULD FIX BEFORE LAUNCH IF LOW RISK

### B1 — Session lifecycle and retention evidence

- **Domain:** Session / retention
- **Exact missing capability:** Canonical app-process start/resume/exit and
  bounded retention observations; current `watch_progress` is only mutable
  current state.
- **Existing system to reuse:** Process-scoped behavior `session_id`,
  authenticated Supabase actor, `watch_progress`, guest history merge, and
  existing playback behavior events.
- **Why it matters:** Retention cannot be reconstructed reliably from progress
  rows alone, while a process session must not become a durable anonymous
  identity.
- **Smallest implementation:** Emit lifecycle and playback-return events using
  the existing session ID and server timestamp; do not add device
  fingerprinting or a second history store.
- **Files likely involved:** `apps/android/App.tsx`,
  `apps/android/src/lib/behavioralEvents.ts`,
  `apps/android/src/lib/playbackHistory.ts`,
  `src/app/api/v1/ranking/events/route.ts` or the shared envelope route.
- **Migration needed:** YES
- **Privacy risk:** MEDIUM
- **Launch blocker:** NO
- **Autonomous blocker:** YES

### B2 — Preserve initiating source/session context at authoritative outcomes

- **Domain:** Traffic attribution; monetization; access/entitlement
- **Exact missing capability:** Originating surface, session, and bounded
  context surviving from an App action into its server outcome.
- **Existing system to reuse:** `toPlaybackOriginContext`,
  `source_surface`, row/position, sanitized search context, ranking decision
  IDs, and navigation origin context.
- **Why it matters:** Existing in-App attribution is useful, but outcome
  records currently cannot consistently show what initiated them.
- **Smallest implementation:** Carry the existing bounded context and shared
  correlation ID through purchase, rewarded, Chai, playback, and access
  requests; preserve delayed attribution as a labelled hypothesis.
- **Files likely involved:** Android navigation types and API facade,
  `apps/android/src/lib/behaviorContext.ts`, monetization/access/playback
  routes and server modules.
- **Migration needed:** YES
- **Privacy risk:** MEDIUM
- **Launch blocker:** NO
- **Autonomous blocker:** YES

### B3 — Complete non-ranking content-performance projection

- **Domain:** Content performance
- **Exact missing capability:** A bounded projection that combines existing
  content metadata, playback outcomes, and current-state progress without
  weakening the precise ranking event semantics.
- **Existing system to reuse:** CMS/catalog metadata, `watch_progress`, and
  `ranking_behavior_events`/`RankingDecision`.
- **Why it matters:** Performance evidence is already the strongest area, but
  current-state progress and event evidence are not yet uniformly linked.
- **Smallest implementation:** Add only missing linkage and runtime verification
  for completion/progress observations; retain the existing definitions for
  impression, qualified watch, completion, and abandon.
- **Files likely involved:** `src/lib/watch-progress.ts`,
  Android playback progress hooks, ranking event route/adapter, Supabase types.
- **Migration needed:** MAYBE
- **Privacy risk:** MEDIUM
- **Launch blocker:** NO
- **Autonomous blocker:** YES

### B4 — Decide external traffic-attribution scope before collecting it

- **Domain:** Traffic/source attribution
- **Exact missing capability:** An explicit launch decision and privacy contract
  for campaign, referral, install, notification-open, or UTM attribution.
- **Existing system to reuse:** Existing sanitized in-App source context and
  deep-link origin context.
- **Why it matters:** Collecting raw URLs, referrers, advertising IDs, or
  campaign data without consent, retention, and semantics would create privacy
  and causal-attribution problems.
- **Smallest implementation:** If launch measurement requires it, specify
  consent, allowed source fields, retention, and event semantics before adding
  a narrow server-side source event. Otherwise explicitly defer collection.
- **Files likely involved:** Android linking/navigation context, API event
  validation, privacy/release documentation.
- **Migration needed:** NO, unless collection is approved
- **Privacy risk:** HIGH
- **Launch blocker:** NO
- **Autonomous blocker:** YES

## C. SAFE TO DEFER UNTIL AFTER LAUNCH

### C1 — Push notification delivery and engagement observation

- **Domain:** Notifications
- **Exact missing capability:** Server preference sync, push registration,
  send/delivery/open/dismiss/block/failure events, and notification audit.
- **Existing system to reuse:** Local Settings notification preferences as UI
  intent only; existing deep-link context for eventual opens.
- **Why it matters:** It matters only if notifications are a launch feature;
  no current notification delivery system exists to observe.
- **Smallest implementation:** Defer until notification delivery is approved;
  then define consent and provider event semantics before implementation.
- **Files likely involved:** `apps/android/src/lib/settingsPreferences.ts`,
  `apps/android/src/screens/SettingsScreen.tsx`, future server notification
  boundary and Supabase schema.
- **Migration needed:** YES, when the feature is approved
- **Privacy risk:** HIGH
- **Launch blocker:** NO
- **Autonomous blocker:** NO

### C2 — Cross-session anonymous retention identity

- **Domain:** Session / retention
- **Exact missing capability:** A privacy-approved way to relate anonymous
  sessions across launches before authentication.
- **Existing system to reuse:** Current process-scoped UUIDv4 session and local
  guest history; do not invent a device fingerprint.
- **Why it matters:** It would improve anonymous retention analysis, but it is
  not required for authenticated truth and carries material privacy risk.
- **Smallest implementation:** Defer pending explicit privacy/product approval;
  if approved, use a purpose-limited, non-authoritative identifier with
  retention controls.
- **Files likely involved:** Android session storage, privacy documentation,
  shared event validation.
- **Migration needed:** MAYBE
- **Privacy risk:** HIGH
- **Launch blocker:** NO
- **Autonomous blocker:** NO

### C3 — Advanced D1/D7/D30 retention calculations

- **Domain:** Session / retention
- **Exact missing capability:** Derived cohort metrics based on canonical
  lifecycle and return events.
- **Existing system to reuse:** Session lifecycle events from B1, Auth user ID,
  and watch-progress/playback evidence.
- **Why it matters:** These are useful product metrics but are not a prerequisite
  for safe App authority or basic observation.
- **Smallest implementation:** Defer calculation until lifecycle event
  semantics and retention policy are stable.
- **Files likely involved:** Future reporting/query layer and bounded event
  projections.
- **Migration needed:** NO
- **Privacy risk:** MEDIUM
- **Launch blocker:** NO
- **Autonomous blocker:** NO

### C4 — Autonomous observation of real Play Billing and PX01 flows

- **Domain:** Monetization; access/entitlement
- **Exact missing capability:** Observation of provider-verified Play Billing
  lifecycle and post-roadmap Play Together flows.
- **Existing system to reuse:** Existing payment orders/RPCs, rewarded and
  entitlement authority, and PX01 server-owned state when activated.
- **Why it matters:** Those flows are externally blocked, partial, or
  post-roadmap; observing them before authoritative runtime exists would be
  misleading.
- **Smallest implementation:** Defer until provider verification and PX01
  activation are independently proven, then reuse the shared envelope.
- **Files likely involved:** Billing route/client boundary, payment migrations,
  PX01 routes/migrations, shared event projection.
- **Migration needed:** YES, only with the underlying feature
- **Privacy risk:** HIGH
- **Launch blocker:** NO
- **Autonomous blocker:** NO

## D. FUTURE AUTONOMOUS INTEGRATION ONLY

### D1 — Read-only non-ranking CanonicalEvent projection

- **Domain:** All approved non-ranking domains
- **Exact missing capability:** A future bounded projection from the shared
  App observation envelope into the existing four-field CanonicalEvent shape.
- **Existing system to reuse:** The ranking observation adapter's timestamp,
  context, allowlist, phase, and deterministic serialization rules.
- **Why it matters:** It enables observation compatibility without coupling
  Autonomous to App tables or moving App authority.
- **Smallest implementation:** Implement only after A1–A4 are proven; project
  sanitized observations read-only, with IDs in context and no transport or
  action callback.
- **Files likely involved:** Existing ranking adapter pattern, future
  non-ranking adapter module, contract tests.
- **Migration needed:** NO
- **Privacy risk:** HIGH
- **Launch blocker:** NO
- **Autonomous blocker:** YES

### D2 — Shadow ingestion/replay validation

- **Domain:** All approved non-ranking domains
- **Exact missing capability:** A future offline/read-only replay harness proving
  ordering, deduplication, temporal integrity, and no future-information
  leakage across non-ranking observations.
- **Existing system to reuse:** Ranking replay fixtures and deterministic
  CanonicalEvent tests.
- **Why it matters:** It is required before any Autonomous observation or shadow
  evaluation, but not before the App launches independently.
- **Smallest implementation:** Add bounded fixtures and validation only after
  the App envelope and domain events are stable; no live control path.
- **Files likely involved:** Future contract/fixture tests and the existing
  observation adapter test patterns.
- **Migration needed:** NO
- **Privacy risk:** HIGH
- **Launch blocker:** NO
- **Autonomous blocker:** YES

## Classification summary

- **Pre-launch required gaps:** 4
- **Low-risk pre-launch gaps:** 4
- **Safe-to-defer gaps:** 4
- **Future Autonomous integration-only gaps:** 2

## Guardrails

- No new reward scores, AI, ranking, recommendation, experiment, or live
  Autonomous control is proposed.
- No existing wallet, entitlement, payment, watch-history, rewarded, Chai, or
  ranking system should be duplicated.
- Autonomous must never become authoritative for identity, pricing, payments,
  wallet balance, reward credit, access, entitlement, playback, notification
  consent, or App routing.
