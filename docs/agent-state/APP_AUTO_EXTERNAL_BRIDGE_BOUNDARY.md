# APP-AUTO-BOUNDARY-01 -- External Observation Bridge Boundary Audit

**Date:** 2026-09-06  
**Status:** `SOURCE VERIFIED` -- audit only. No runtime architecture, transport,
persistence, bridge service, producer, or Autonomous code was changed.

## Decision

The Consumer App (Android plus the existing server product runtime) must retain
only authoritative product operations and privacy-safe evidence projection at
those operations. A future Observation Bridge must own the conversion of that
evidence into normalized observations, CanonicalEvent projection, delivery,
deduplication/retry, replay, and observation persistence. Autonomous must
consume bridge output and own only learning/decision logic; it must not call
product persistence or become a product authority.

The present architecture is reusable, but the current shared foundation and
domain adapters are an in-process transitional bridge implementation. They
should not remain permanently coupled to the Consumer App once an external
bridge is approved and runtime-proven.

## Component disposition

| Component | Current path | Current runtime usage | True authority owner | Classification | Future boundary and migration constraints |
| --- | --- | --- | --- | --- | --- |
| Shared observation envelope | [`shared/observation/foundation.ts`](../../shared/observation/foundation.ts) | Imported by Android lifecycle, root domain adapters, and coin producer | Shared contract stewardship; not product or Autonomous authority | `KEEP_AS_SHARED_CONTRACT` | Keep versioned, dependency-free types and validation shared by producer and bridge. Do not give Autonomous unilateral schema control. |
| Event vocabulary / domain / phase rules | [`shared/observation/foundation.ts`](../../shared/observation/foundation.ts) | Validation only | Shared contract stewardship | `KEEP_AS_SHARED_CONTRACT` | Bridge validates on ingress. App may locally prevalidate only while fail-open semantics need it. No vocabulary expansion during extraction. |
| Privacy validation | [`shared/observation/foundation.ts`](../../shared/observation/foundation.ts) and domain adapter guards | Active where observations are constructed | Bridge policy with App-side data-minimization guard | `MOVE_TO_BRIDGE` | Retain local projection allowlists for sensitive product boundaries; centralize final normalization/rejection in bridge. Never export raw tokens, URLs, provider payloads, receipts, signed media URLs, PII, or arbitrary errors. |
| Deterministic serialization | [`shared/observation/foundation.ts`](../../shared/observation/foundation.ts) | Utility only; no delivery | Observation Bridge | `MOVE_TO_BRIDGE` | Move with delivery/replay so a single implementation computes durable/replay bytes. Preserve deterministic ordering. |
| CanonicalEvent projection | [`shared/observation/foundation.ts`](../../shared/observation/foundation.ts) | Used by optional sink callbacks only | Observation Bridge | `MOVE_TO_BRIDGE` | Make bridge the sole production projection point. App retains raw, bounded evidence only. Null server session representation must remain exact. |
| Fail-open helper | [`shared/observation/foundation.ts`](../../shared/observation/foundation.ts) | Used by server coin producer; Android has equivalent local isolation | Consumer App runtime boundary | `APP_RUNTIME_REQUIRED` | Product action/lifecycle must isolate bridge submission failure locally even after projection/delivery move. The bridge cannot guarantee product fail-open by itself. |
| Session lifecycle controller | [`apps/android/src/lib/sessionObservations.ts`](../../apps/android/src/lib/sessionObservations.ts) | Active from [`App.tsx`](../../apps/android/App.tsx) open/background/foreground lifecycle calls | Android runtime | `KEEP_IN_APP` | Retain lifecycle capture, `getEvidenceSessionId()`, monotonicity, and duplicate guards. Replace its optional observation callback with a future bridge evidence handoff only after runtime proof. |
| Coin-unlock evidence projection | [`src/lib/purchases.ts`](../../src/lib/purchases.ts) | Active after RPC success/retry, from persisted ledger row | Server RPC/ledger | `KEEP_IN_APP` | Keep authenticated actor, ledger transaction ID/time/amount projection adjacent to authoritative result. Bridge receives only the bounded projection, never database access or payment state authority. |
| Coin-unlock observation construction | [`src/lib/observation/coin-unlock.ts`](../../src/lib/observation/coin-unlock.ts) | Active, intentionally sinkless, after persisted success/retry | Server product runtime for evidence; bridge for translation | `MOVE_TO_BRIDGE` | Replace with a bounded raw evidence handoff. Preserve `session_id: null`, transaction ID correlation, timestamp, amount, and fail-open call site. No failure event without durable evidence. |
| Monetization adapter | [`src/lib/observation/monetization.ts`](../../src/lib/observation/monetization.ts) | No production importer | Existing server/provider result boundaries | `MOVE_TO_BRIDGE` | Translation only; must consume server-projected evidence and never client-asserted purchase/reward outcome. |
| Traffic adapter | [`src/lib/observation/traffic.ts`](../../src/lib/observation/traffic.ts) | No production importer | Android link parsing / verified attribution source | `MOVE_TO_BRIDGE` | App retains accepted route receipt and existing session context. Bridge normalizes only bounded IDs; raw URLs/query strings remain local and excluded. |
| Notification adapter | [`src/lib/observation/notifications.ts`](../../src/lib/observation/notifications.ts) | No production importer | Provider callbacks/client UI for their respective facts | `DEFER` | No installed provider lifecycle. Do not move or wire until provider-issued IDs and callback semantics exist. |
| Content adapter | [`src/lib/observation/content.ts`](../../src/lib/observation/content.ts) | No production importer | CMS/catalog server authority | `MOVE_TO_BRIDGE` | CMS/catalog retains lifecycle truth and content metadata; bridge translates a bounded server event. Client consumption is not publication authority. |
| Access adapter | [`src/lib/observation/access.ts`](../../src/lib/observation/access.ts) | No production importer | Server playback resolver / entitlement transaction | `MOVE_TO_BRIDGE` | Bridge may translate only server decision evidence after a future bounded decision identity/time contract exists. It must never access signed playback URLs or treat UI as authority. |
| System adapter | [`src/lib/observation/system.ts`](../../src/lib/observation/system.ts) | No production importer | Typed app/server failure boundaries | `MOVE_TO_BRIDGE` | App retains typed failure classification and recovery; bridge normalizes safe codes only after retry/cancellation behavior is proven. |
| Ranking observation adapter | [`src/lib/ranking/observation-adapter.ts`](../../src/lib/ranking/observation-adapter.ts) | No production importer outside tests | Current ranking decision/evidence producer; neither consumer UI nor Autonomous | `MOVE_TO_BRIDGE` | This is already a specialized translation/normalization layer. Move only with its ranking evidence contracts and privacy sanitizer; retain ranking decision generation in product runtime. It is not Autonomous decision logic. |
| Authoritative evidence fields | Ledger/entitlement/CMS/playback result projections, including [`src/lib/purchases.ts`](../../src/lib/purchases.ts) | Coin success/retry projection active | Consumer App server product runtime | `KEEP_IN_APP` | Evidence must be projected at the authoritative result boundary. Bridge receives no privileged database credentials, service role, wallet mutation capability, entitlement writer, or Mux signing authority. |
| Sink / transport / retry / replay / observation persistence | None currently | No transport or persistence exists | Future Observation Bridge | `MOVE_TO_BRIDGE` | One bridge-owned outbox/idempotency/replay system may be introduced only under a separately approved design. Product retries and observation delivery retries must remain distinct. |

## Minimum Consumer App code that must remain

1. Product authority: authentication, authorization, wallet/RPC operations,
   entitlement decisions, payment/provider verification, CMS publication,
   playback authorization, navigation, and existing recovery/UI behavior.
2. Evidence extraction at authoritative boundaries: existing IDs, authoritative
   timestamps, bounded status/reason values, and server-derived amounts.
3. Android lifecycle capture and process-scoped `getEvidenceSessionId()`.
4. Local privacy minimization before any boundary crossing.
5. A one-way, non-blocking fail-open bridge handoff at product call sites.

The Consumer App must not retain durable observation queues, delivery retries,
CanonicalEvent production, learning features, ranking feedback loops, or
Autonomous control code after externalization.

## Ownership by system

### Consumer App owns

- Authoritative business/product truth and all user-visible behavior.
- Existing server/RPC/ledger/entitlement/CMS/playback state and idempotency.
- Local lifecycle facts, trusted evidence extraction, and product fail-open
  boundary handling.

### Observation Bridge should own

- Observation normalization and contract enforcement at ingress.
- CanonicalEvent projection and deterministic serialization.
- Observation-only idempotency, delivery retry, replay, dead-letter handling,
  and observation persistence.
- Version negotiation and compatibility validation between evidence producers
  and Autonomous consumers.

### Autonomous owns

- Learning, analysis, ranking/decision logic, and any future recommendations
  derived from bridge-delivered observations.
- No product database writes, entitlement/wallet mutation, payment
  verification, playback authorization, CMS publication, or direct Android
  lifecycle ownership.

## Migration order and risks

1. Define a versioned, privacy-safe raw evidence ingress contract that is
   narrower than the current ObservationEnvelope.
2. Keep existing product call sites and fail-open behavior, swapping only the
   sinkless local handoff for bridge ingress in shadow/observability mode.
3. Move normalization, CanonicalEvent projection, serialization, and
   delivery/replay together; two production projection paths would create
   divergence and duplicate observations.
4. Retire local domain adapters only after bridge parity validates accepted and
   rejected inputs, null-session handling, timestamp preservation, privacy,
   idempotency, and replay behavior.

The principal risk is conflating product idempotency with observation delivery
idempotency, or allowing a bridge/Autonomous failure to alter purchase,
entitlement, playback, navigation, or recovery behavior. The current
sinkless/session and coin-success boundaries make incremental handoff feasible,
but no external bridge runtime exists today.

## Deferred / blocked conditions

- Notification runtime is blocked by the absent provider lifecycle.
- Access, content, system, and traffic producers remain un-wired or require
  authoritative correlation/time/runtime proof.
- No bridge transport, persistence, retry, replay, or Autonomous consumer can
  be implemented under this audit.
