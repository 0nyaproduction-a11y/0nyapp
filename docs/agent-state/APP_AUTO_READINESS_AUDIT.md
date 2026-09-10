# APP-AUTO-AUDIT-01 — Non-Ranking Autonomous Readiness Audit

**Date:** 2026-09-06  
**Scope:** Read-only audit of the Consumer App's non-ranking evidence surfaces.  
**Boundary:** No Autonomous code, transport, adapter, migration, deployment, or App behavior was changed.

## 1. EXECUTIVE VERDICT

The App has several authoritative data sources that are suitable inputs for
future Autonomous observation, but it does not yet have one coherent,
cross-domain event foundation. Ranking/discovery is the only domain with a
defined, validated observation envelope and CanonicalEvent projection. The
remaining domains are therefore **PARTIAL**, not autonomous-ready.

The strongest reusable foundations are:

- server-authoritative wallet, payment-order, coin-ledger, entitlement,
  subscription, rewarded-attempt, Chai-ledger, playback, and watch-progress
  records;
- the existing ranking behavior event/session vocabulary and privacy
  allowlists;
- the design-only monetization observation vocabulary, which must remain a
  contract rather than a second analytics system.

The main blocker is not lack of product data. It is lack of a single
server-reconstructable identity/correlation/temporal model for non-ranking
actions and outcomes. Autonomous must observe these records only; it must not
own access, wallet, payment, content, notification, or playback decisions.

**Overall readiness:** `NEEDS_EVENT_FOUNDATION`

## 2. DOMAIN READINESS MATRIX

| Domain | Existing evidence/data | Status | Final readiness | Principal reason |
|---|---|---|---|---|
| Session / retention | `watch_progress`, local guest history, process-scoped behavior session ID | `PARTIAL` | `NEEDS_EVENT_FOUNDATION` | No durable session/lifecycle/retention event model; anonymous cross-session identity is intentionally absent |
| Monetization | Wallet/ledger/orders, entitlements, subscriptions, rewarded attempts, Chai ledger, rewarded analytics, typed monetization vocabulary | `PARTIAL` | `NEEDS_SMALL_CONTRACT_WORK` | Authority exists, but event correlation, request identity, and provider outcome linkage are not unified |
| Traffic/source attribution | Ranking `source_surface`, row/position, sanitized search context, deep-link origin context | `PARTIAL` | `NEEDS_EVENT_FOUNDATION` | Product acquisition/referrer/campaign source is not persisted as a canonical event |
| Notifications | Local Settings preferences only | `MISSING` | `NOT_READY` | No push registration, delivery, open, failure, or server preference system |
| Content-performance metadata | CMS/catalog metadata, `watch_progress`, ranking behavior events and deterministic semantics | `PARTIAL` | `NEEDS_SMALL_CONTRACT_WORK` | Ranking evidence is strong but prepared persistence/runtime status and non-ranking performance linkage remain incomplete |
| Access / entitlement outcomes | Server access resolver, entitlement rows, subscriptions, purchase/rewarded outcomes, signed playback authorization | `EXISTS` | `NEEDS_SMALL_CONTRACT_WORK` | Truth is authoritative and auditable, but access-decision outcomes are not emitted as one linked observation stream |
| System/playback/payment failures | Route errors, client fail-open logging, perf timing markers, provider/order statuses | `PARTIAL` | `NEEDS_EVENT_FOUNDATION` | No durable, normalized, privacy-reviewed failure event with originating action correlation |

Status meanings in this audit: `EXISTS` means a reusable authoritative
source is present; `PARTIAL` means useful sources exist but the observation
contract or persistence is incomplete; `MISSING` means no meaningful source was
found; `CONFLICT` means sources disagree; `DO_NOT_DUPLICATE` means the
existing source should be reused rather than replaced.

## 3. SESSION / RETENTION

**Status:** `PARTIAL`  
**Readiness:** `NEEDS_EVENT_FOUNDATION`

- **Existing events/data:** Authenticated `watch_progress` stores content,
  position, duration, completion, ad-break state, and `last_watched_at`.
  Guests use device-local SecureStore history and merge after sign-in.
  Ranking behavior events carry a UUIDv4 process-scoped `session_id`.
- **Source of truth:** Supabase Auth for identity; Supabase `watch_progress`
  for authenticated playback history; SecureStore is only guest pre-account
  state. Resume position is not entitlement.
- **Stable IDs/timestamps:** user ID, content keys, progress uniqueness key,
  and `last_watched_at` exist. The behavior session ID is stable only for the
  app process, not a durable user session.
- **Actor/session/source/context:** authenticated actor is server-derived;
  guest actor is null. Ranking evidence has surface/context; watch-progress
  rows do not retain originating surface, action, or session.
- **Outcome semantics:** resume and completion are clear. D1/D7/D30,
  session-start/end, return, churn, and retention outcomes are not canonical
  events.
- **Privacy/security:** guest history and auth state are protected; no need to
  export raw auth/session tokens. Cross-session anonymous identity is absent
  by design and must not be invented casually.
- **Persistence/replay/temporal correctness:** progress is durable and
  upserted, but it is a current-state record, not an immutable event log.
  Multiple saves cannot reconstruct every viewing action or session boundary.
- **Authority boundary:** Autonomous may observe retention/playback evidence; it
  must not decide resume, completion, access, or identity.
- **Duplicate systems:** ranking session evidence and playback history are
  complementary, not substitutes. Do not create a second watch-history store.
- **CanonicalEvent compatibility:** shape-compatible after a bounded adapter
  can map progress/action observations to post-decision context; current
  `watch_progress` alone is not an event stream.
- **Readiness conclusion:** small-to-medium event-foundation work is required
  for session lifecycle and retention observation. Do not add a new retention
  database before defining the event boundary.

## 4. MONETIZATION

**Status:** `PARTIAL`  
**Readiness:** `NEEDS_SMALL_CONTRACT_WORK`

- **Existing events/data:** `wallets`, `coin_transactions`, `payment_orders`,
  `episode_entitlements`, `subscriptions`, `rewarded_ad_attempts`,
  `rewarded_monetization_events`, `chai_tip_requests`, and
  `chai_ledger_entries`. Server RPCs provide atomic/idempotent purchase,
  reward, entitlement, and Chai outcomes.
- **Source of truth:** server/database/RPCs; AdMob SSV verification for
  rewarded completion; Google Play purchase verification is not operational
  in the current client and remains externally blocked/partial.
- **Stable IDs/timestamps:** transaction/order/attempt/entitlement/ledger
  identifiers and provider transaction references exist; timestamps generally
  exist. A shared `correlation_id` and retry-stable `request_id` do not
  consistently exist on persisted product flows.
- **Actor/session/source/context:** user and content IDs are available; offer
  snapshots are reconstructable server-side. Session, originating surface,
  and action-to-outcome linkage are inconsistent or absent.
- **Outcome semantics:** authoritative statuses distinguish success,
  already-processed, conflict, insufficient balance, verified reward, and
  access outcomes. The typed monetization contract correctly separates
  opportunity, intent, success, failure, and verified-provider outcome.
- **Privacy/security:** the monetization design explicitly prohibits raw
  purchase tokens, provider secrets, signatures, receipts, and arbitrary PII.
  Provider references must remain sanitized audit context, never features.
- **Persistence/replay/temporal correctness:** ledgers and orders support
  audit/replay better than client analytics. `rewarded_monetization_events`
  has a separate analytics role and must not become grant authority.
- **Authority boundary:** Autonomous can observe economic outcomes only; it
  must never set prices, credit coins, verify purchases, grant entitlements,
  or alter subscriptions.
- **Duplicate systems:** typed `src/lib/monetization/events.ts`,
  rewarded analytics, financial ledgers, and ranking evidence are different
  layers. `DO_NOT_DUPLICATE`: do not create another wallet/payment/reward
  ledger or a parallel monetization tracker.
- **CanonicalEvent compatibility:** good conceptual fit through the existing
  event fields and allowlisted offer/outcome snapshots. A small contract
  bridge is needed for correlation/request/dedupe identity and server-emitted
  timestamps.
- **Readiness conclusion:** reuse the authoritative records and the typed
  vocabulary. Do not call the current design-only bridge production-ready
  until its server reconstruction and linkage are proven.

## 5. TRAFFIC ATTRIBUTION

**Status:** `PARTIAL`  
**Readiness:** `NEEDS_EVENT_FOUNDATION`

- **Existing events/data:** ranking evidence records `source_surface`, row,
  position, sanitized search context, recommendation reason, and delayed
  attribution fields. Navigation/playback origin context preserves the same
  bounded fields. Deep links identify content routes.
- **Source of truth:** current source context is App navigation/ranking
  evidence; there is no canonical acquisition/referrer source of truth.
- **Stable IDs/timestamps:** content, row, ranking decision, event, and session
  IDs exist in ranking flows. Campaign/referrer/install IDs are not established.
- **Actor/session/source/context:** surface context is strong for in-App
  discovery; external source, campaign, referral, UTM, notification-open, and
  install attribution are missing.
- **Outcome semantics:** later search/return/related-navigation attribution is
  explicitly labelled as a hypothesis, not direct causality. This is correct
  and must not be upgraded to causal truth without policy/evidence.
- **Privacy/security:** search context is sanitized and excludes raw
  email/phone-like queries. Do not export URLs containing tokens or raw
  referrer/identity data.
- **Persistence/replay/temporal correctness:** ranking persistence is
  source-prepared and needs runtime confirmation. Delayed attribution must
  retain original event time and policy version; it must not rewrite history.
- **Authority boundary:** Autonomous may observe declared source context; it
  must not choose attribution policy or rewrite App routing.
- **Duplicate systems:** `DO_NOT_DUPLICATE` ranking source context. Add only
  missing external attribution at the existing event boundary.
- **CanonicalEvent compatibility:** compatible for in-App context; incomplete
  for traffic acquisition because no canonical source/referrer event exists.
- **Readiness conclusion:** requires a privacy-reviewed event foundation,
  not a new analytics SaaS or client-only attribution cache.

## 6. NOTIFICATIONS

**Status:** `MISSING`  
**Readiness:** `NOT_READY`

- **Existing events/data:** Settings has local booleans for new-release and
  marketing notification preferences. No push token registration, notification
  job, delivery receipt, open/deep-link event, suppression reason, or failure
  record was found.
- **Source of truth:** none beyond local preference storage; local preference
  is not sufficient for server delivery or audit.
- **Stable IDs/timestamps/actor/session/source:** absent as a notification
  event model.
- **Outcome semantics:** no canonical sent, delivered, opened, dismissed,
  blocked, expired, or provider-failed outcomes.
- **Privacy/security:** push tokens and notification payloads would be sensitive
  operational data; they must not be placed in Autonomous observable features
  or raw event metadata.
- **Persistence/replay/temporal correctness:** absent.
- **Authority boundary:** a future notification service may own delivery
  mechanics; Autonomous must not send notifications or infer consent.
- **Duplicate systems:** preserve local settings as UI preference only if a
  server preference system is introduced; do not create parallel preference
  stores without an explicit sync contract.
- **CanonicalEvent compatibility:** no meaningful event source exists yet.
- **Readiness conclusion:** notification observation is not launch-ready and
  is safe to defer unless notifications themselves become a launch
  requirement.

## 7. CONTENT PERFORMANCE

**Status:** `PARTIAL`  
**Readiness:** `NEEDS_SMALL_CONTRACT_WORK`

- **Existing events/data:** CMS/catalog content IDs, format/genre/editorial
  metadata, publication state, `watch_progress`, and ranking behavior events
  (`served`, `impression`, `open`, `play_start`, `qualified_watch`,
  `play_complete`, `play_abandon`).
- **Source of truth:** CMS/catalog for content metadata; server playback and
  watch-progress for playback truth; ranking evidence for discovery behavior.
- **Stable IDs/timestamps:** content IDs, row IDs, ranking decision IDs,
  event IDs, session IDs, and canonical occurred-at values exist in ranking
  evidence. Watch-progress timestamps are current-state timestamps.
- **Actor/session/source/context:** strongest of the audited non-ranking
  domains in the existing ranking event path. Auth actor is server-derived;
  guest actor remains null; surface and position are bounded.
- **Outcome semantics:** definitions are unusually precise: actual player
  start, measured impression, continuous 30-second qualified watch, completion
  after final progress save, and explicit-exit abandon. These must not be
  weakened into taps or route renders.
- **Privacy/security:** strict event metadata allowlists and search
  sanitization are present in the ranking path. Raw arbitrary metadata must
  remain rejected.
- **Persistence/replay/temporal correctness:** the event schema and adapter
  are coherent; prepared ranking migrations and current uncommitted state
  require runtime/application verification. The adapter preserves original
  event time and deterministic replay order.
- **Authority boundary:** performance evidence cannot change CMS order,
  eligibility, entitlement, parental controls, or playback authorization.
- **Duplicate systems:** `DO_NOT_DUPLICATE` ranking behavior events,
  `RankingDecision`, and `watch_progress`; extend their observation coverage
  rather than creating a generic content analytics table.
- **CanonicalEvent compatibility:** `YES` for the existing ranking-shaped
  events, `PARTIAL` for broader content performance derived from current
  state.
- **Readiness conclusion:** this is the closest non-ranking surface to
  readiness; only bounded contract/runtime proof is missing.

## 8. ACCESS / ENTITLEMENT

**Status:** `EXISTS`  
**Readiness:** `NEEDS_SMALL_CONTRACT_WORK`

- **Existing events/data:** server `canUserWatchEpisode`, `episode_entitlements`,
  subscription checks, free-access rules, coin purchase RPC outcomes,
  rewarded SSV outcomes, parental/age checks, media readiness checks, and
  signed playback authorization. Locked preview authorization is separate from
  full playback.
- **Source of truth:** server and protected Supabase state; Mux signed URL
  issuance is the final playback authorization boundary.
- **Stable IDs/timestamps:** user, episode/content, entitlement, purchase,
  rewarded attempt, and provider IDs exist; decision IDs for access outcomes
  are not consistently exposed as one observation identity.
- **Actor/session/source/context:** authenticated user and content context
  are available; initiating surface/session/request linkage is incomplete.
- **Outcome semantics:** free, access-required, already-owned, active Plus,
  insufficient balance, rewarded pending/granted, parental denial, media
  unavailable, and authorization failure are separable. Preserve these
  distinctions.
- **Privacy/security:** highly sensitive. Never export wallet balance,
  purchase tokens, signed URLs, secrets, parental details, or raw provider
  receipts as observable features.
- **Persistence/replay/temporal correctness:** entitlement and ledger records
  are durable and idempotent; playback authorization is an ephemeral
  signed decision. Reconstructing why a specific request was denied or
  granted needs a bounded access-decision observation.
- **Authority boundary:** absolute `DO_NOT_MOVE`: Autonomous cannot grant,
  revoke, price, unlock, authorize playback, or override age/parental policy.
- **Duplicate systems:** reuse existing entitlement/ledger/access resolver;
  do not create an Autonomous entitlement cache.
- **CanonicalEvent compatibility:** compatible as sanitized post-action
  outcome/context once request/correlation identity is added.
- **Readiness conclusion:** authority is already strong; the gap is
  observation linkage, not a new access system.

## 9. FAILURE / SYSTEM EVENTS

**Status:** `PARTIAL`  
**Readiness:** `NEEDS_EVENT_FOUNDATION`

- **Existing events/data:** typed API error envelopes, route status codes,
  provider/order status fields, Mux webhook state, client development
  warnings, fire-and-forget/fail-open behavior-event logging, and latency
  performance markers.
- **Source of truth:** individual subsystem response/provider records; no
  unified failure ledger.
- **Stable IDs/timestamps:** request/provider/order/attempt IDs exist in some
  flows; a common failure-event ID and originating-action correlation are
  absent.
- **Actor/session/source/context:** route and content context are often
  available at the point of failure, but session/source/action context is not
  consistently persisted.
- **Outcome semantics:** HTTP/API errors, payment rejection, rewarded
  verification failure, Mux/media failure, playback denial, and client
  persistence failure are not normalized into one taxonomy. Do not equate
  a transport error with a business denial.
- **Privacy/security:** logs must exclude tokens, signed URLs, receipts,
  secrets, OTPs, and raw PII. Development console logging is not an
  auditable production event source.
- **Persistence/replay/temporal correctness:** provider ledgers support
  selected replay; client-only failures can disappear and fail-open evidence
  can be lost. No durable cross-system causal chain exists.
- **Authority boundary:** Autonomous may observe failures and trends; it must
  not retry purchases, change access, alter playback policy, or suppress
  safety/security failures.
- **Duplicate systems:** keep subsystem-native error/status records as
  authority; add one normalized observation projection rather than a second
  operational error database.
- **CanonicalEvent compatibility:** technically straightforward after an
  allowlisted taxonomy and correlation contract; currently incomplete.
- **Readiness conclusion:** needs a shared event foundation and privacy
  review before observation can be trusted.

## 10. CROSS-DOMAIN IDENTITY / SESSION MODEL

Current identity is intentionally layered:

1. Supabase Auth user ID is authoritative for authenticated actor identity.
2. A UUIDv4 behavior session identifies one app process and is not a durable
   person/device identity.
3. Guest watch history is local and later merged into the authenticated
   account; it must not be treated as pre-auth identity proof.
4. Content IDs, row IDs, ranking decision IDs, order/transaction IDs,
   entitlement IDs, attempt IDs, and provider references identify domain
   records, not people.

The missing cross-domain contract is a server-reconstructable,
retry-stable `correlation_id`/`request_id` relationship that links an
originating action to its outcome without using raw identity as a feature.
Do not solve this with a new global device fingerprint, raw advertising ID,
or client-provided authoritative user ID.

## 11. PRIVACY / SECURITY

**Status:** `PARTIAL` for future non-ranking observation; existing authority
boundaries are generally strong.

- Raw PII risks: notification/device tokens, search text, payment/provider
  references, auth identifiers, parental data, and arbitrary metadata.
- Explicitly prohibited from Autonomous observable features: user IDs,
  content IDs when used as identity-like features, event/correlation/request
  IDs, provider refs, wallet balances unless separately approved as
  bounded state, signed URLs, receipts, purchase tokens, access/refresh
  tokens, secrets, OTPs, phone/email, and raw queries.
- Client-only truth risks: local notification preferences, guest history,
  client playback observations, and client analytics impressions are
  evidence only. Server/database truth remains authoritative for access,
  wallet, payments, rewards, subscriptions, and playback.
- Future-information leakage: post-action outcomes must never enter
  pre-decision or decision-time observations. Delayed attribution must retain
  its original event time and policy label.
- Privacy-positive existing patterns: server-derived actor identity,
  ranking metadata allowlists, query sanitization, fail-closed access,
  SSV verification, idempotent ledgers, and no direct Autonomous write path.

## 12. CANONICALEVENT COMPATIBILITY

**Result:** `PARTIAL`

The existing ranking observation adapter proves the current four-field
CanonicalEvent mapping (`event_id`, `timestamp`, `observable_features`,
`context`) and the important rules: original occurred-at time is retained,
IDs stay in context, only allowlisted values become observable features, and
there is no transport or action callback.

Non-ranking domains can reuse that projection pattern, but they are not
compatible merely because their tables have timestamps. Each domain needs:

- versioned event type and schema;
- stable event and correlation/request identity;
- server-reconstructed actor/context;
- explicit pre/decision/post phase;
- bounded payload allowlist and privacy policy;
- outcome linkage and dedupe/replay semantics;
- immutable source timestamp plus received timestamp where needed.

No live Autonomous ingestion, shadow mode, action adapter, or Constitution
change is authorized or required by this audit.

## 13. DO-NOT-DUPLICATE LIST

- Do not create a second watch-history/resume store.
- Do not create a second wallet, coin, payment, subscription, entitlement,
  rewarded-attempt, or Chai ledger.
- Do not replace `RankingDecision` or `ranking_behavior_events`.
- Do not turn `rewarded_monetization_events` into grant authority.
- Do not create a generic client analytics SDK alongside the existing
  bounded event paths.
- Do not create a second attribution policy or infer causal attribution from
  later navigation.
- Do not create an Autonomous-side cache of App content/access truth.
- Do not move identity, pricing, verification, entitlement, playback, or
  notification consent authority into Autonomous.

## 14. GAPS THAT ACTUALLY MATTER BEFORE LAUNCH

1. Define and privacy-review one reusable server-side observation envelope
   for correlation, request/dedupe identity, timestamps, actor/session
   context, outcome linkage, and phase separation.
2. Prove runtime persistence/RLS for the prepared ranking evidence without
   treating source-prepared migrations as deployed.
3. Add bounded access and monetization outcome linkage to the existing
   authoritative records; do not duplicate their ledgers.
4. Define a normalized, privacy-safe failure taxonomy linked to originating
   action/request IDs.
5. Decide whether external acquisition attribution is a launch requirement;
   if yes, specify consent, retention, and source semantics before collecting
   it.
6. Keep Play Billing, AdMob production verification, Mux deliverability, and
   current release blockers separate from Autonomous readiness; their
   authority must be proven first.

## 15. GAPS SAFE TO DEFER

- Notification delivery/open analytics, if push notifications are not a
  launch feature.
- Cross-session anonymous retention identity, pending explicit privacy
  approval.
- Advanced D1/D7/D30 retention calculations, until lifecycle events exist.
- External campaign/install attribution, if launch traffic is not being
  measured through paid/acquisition campaigns.
- Autonomous observation of Play Billing until real provider verification is
  operational.
- Autonomous observation of PX01/Play Together, which remains post-roadmap
  and not activated.
- Any recommendation, scoring, learning, experiment, or reverse action path.

## 16. RECOMMENDED IMPLEMENTATION ORDER

1. Reuse and freeze the existing ranking privacy/temporal/CanonicalEvent
   patterns as the cross-domain contract template.
2. Add only the missing server-reconstructed correlation/request/dedupe and
   session-context fields at existing monetization/access/failure boundaries.
3. Project authoritative monetization and access outcomes into bounded
   post-action observations.
4. Define failure taxonomy and causal linkage using existing route/provider
   IDs; retain subsystem records as authority.
5. Add session lifecycle/retention events from App lifecycle and server
   outcomes, without inventing a durable anonymous identity.
6. Decide and, only if approved, specify traffic attribution and notification
   contracts.
7. Run privacy/security, replay, duplicate, temporal, and authority-boundary
   tests before any read-only Autonomous ingestion discussion.

## 17. FINAL GATES

`APP NON-RANKING AUTONOMOUS READINESS: PARTIAL`

`SESSION/RETENTION: PARTIAL`  
`MONETIZATION: PARTIAL`  
`TRAFFIC ATTRIBUTION: PARTIAL`  
`NOTIFICATIONS: NOT_READY`  
`CONTENT PERFORMANCE: PARTIAL`  
`ACCESS/ENTITLEMENT: READY`  
`FAILURE EVENTS: PARTIAL`

`CANONICAL EVENT COMPATIBILITY: PARTIAL`  
`PRIVACY BOUNDARY: PASS`  
`AUTONOMOUS MODIFIED: NO`  
`CONSTITUTION CHANGE REQUIRED: NO`

`PRE-LAUNCH IMPLEMENTATION REQUIRED: YES`

`NEXT STEP: Define and privacy-review the reusable server-side non-ranking observation envelope, then wire only authoritative monetization/access/failure outcomes to it without creating duplicate ledgers.`
