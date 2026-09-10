# APP-AUTO-RUNTIME-PLAN-01 -- Bounded Producer Integration Plan

**Date:** 2026-09-06

**Status:** `SOURCE VERIFIED` -- planning only. No producer, sink, transport,
persistence, Autonomous integration, event vocabulary, contract semantics, or
product behavior changed.

## Fixed boundary

The sole executable contract is
[`shared/observation/foundation.ts`](../../shared/observation/foundation.ts).
All future producer work must validate through the existing domain adapter,
preserve the original event time, reuse existing authoritative identifiers, and
be fail-open relative to the product operation. It must not use observation as
an authority for identity, access, wallet, purchase, subscription, rewarded
credit, content, or playback.

`getEvidenceSessionId()` is the existing Android process-scoped session source.
The session controller uses it for both `session_id` and `correlation_id`; its
actor is the current authenticated user ID or `null`. There is currently no
observation sink in [`apps/android/App.tsx`](../../apps/android/App.tsx), by
design. This plan does not propose changing that.

## Producer disposition

| Priority | Domain | Existing authoritative runtime boundary | Contract event(s) | Identity, correlation, timestamp | Fail-open insertion point | Duplicate/retry and privacy constraints | Evidence authority | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | SESSION | [`AppNavigator`](../../apps/android/App.tsx) calls the existing `createSessionObservationController` for app open and `AppState` transitions. | `APP_OPENED`, `SESSION_STARTED`, `APP_BACKGROUND`, `APP_FOREGROUND`, `SESSION_RESUMED`; `SESSION_ENDED` only from a future explicit owner. | `getEvidenceSessionId()`; correlation equals that session ID; actor comes from `useAuth`; event time is the lifecycle callback time. | The controller's existing validation and `onObservation` isolation are the only insertion point; a future observer must remain asynchronous and ignored on failure. | Controller already deduplicates open/background/foreground and monotonic timestamps. No actor value beyond the authenticated ID; no device, token, or AppState metadata outside the allowlist. | Client-observed lifecycle. | `SAFE_NOW` for the existing lifecycle producer once an approved non-authoritative consumption boundary exists; no sink may be introduced in this task. |
| 2 | MONETIZATION | Coin unlock: [`handleUnlockWithCoins`](../../apps/android/src/screens/EpisodeAccessOptionsScreen.tsx) receives `purchaseEpisodeWithCoins` server result. Rewarded: [`useRewardedEpisodeUnlock`](../../apps/android/src/lib/useRewardedEpisodeUnlock.ts) receives server attempt/status/progress results after SSV. Chai: [`handleSubmit`](../../apps/android/src/screens/ShortFilmChaiConfirmScreen.tsx) receives the idempotent server result. Google Play: [`CoinPurchaseScreen`](../../apps/android/src/screens/CoinPurchaseScreen.tsx) and [`PlusScreen`](../../apps/android/src/screens/PlusScreen.tsx) receive the boundary result. | `MONETIZATION_ACTION` only for an existing stable request and dedupe identity; `MONETIZATION_OUTCOME` only from authoritative server result. | Current screen paths have actor/session but coin unlock response exposes no request/transaction identity; Chai has its existing idempotency key; rewarded custom data is sensitive and must not enter observations. Preserve server occurrence time when it exists; do not substitute UI completion time for an authoritative result. | Immediately after the authoritative result is decoded, separately from UI branching, behind the adapter's fail-open helper. | Preserve server idempotency/replay semantics. Never observe tokens, receipts, custom data, ad payloads, raw errors, prices invented by the client, or a client `earned` signal as a grant. | Server-authoritative outcomes; client-observed user intent only. | `NEEDS_SERVER_AUTHORITY` -- add a privacy-safe result identity/correlation contract to the authoritative API/RPC result before wiring. Real Play Billing is also externally blocked. |
| 3 | ACCESS | [`authorizePlayback`](../../apps/android/src/lib/api.ts), [`authorizePreviewPlayback`](../../apps/android/src/lib/api.ts), and `purchaseEpisodeWithCoins` receive server decisions. The server decision boundaries are [`playback/route.ts`](../../src/app/api/v1/playback/route.ts), [`playback/preview/route.ts`](../../src/app/api/v1/playback/preview/route.ts), and [`episodes/[episodeId]/purchase/route.ts`](../../src/app/api/v1/episodes/[episodeId]/purchase/route.ts). | `ACCESS_CHECKED`, `ACCESS_GRANTED`, or `ACCESS_DENIED`; entitlement lifecycle events only from server entitlement changes. | Content identity comes from the resolved server target; actor is server-authenticated; authoritative status/reason and occurrence time must originate at the resolver/RPC. Existing Android process session must be propagated only through an approved bounded correlation field, never derived into a new identity. | On the server after the authoritative resolver/RPC result and before response serialization; adapter failure must not change HTTP status/body. | Playback retries and cached catalog refreshes must not produce a second decision. Never record signed playback URLs, guest credentials, parental tokens, purchase material, or client UI state. | Server-authoritative. | `NEEDS_SERVER_AUTHORITY` -- server lacks a contract-safe session/correlation input and result lifecycle IDs. |
| 4 | SYSTEM | Existing failure boundaries include [`requestApi`](../../apps/android/src/lib/api.ts), [`usePlaybackSource`](../../apps/android/src/player/usePlaybackSource.ts), billing handlers, and the authoritative playback result routes. | `SYSTEM_FAILURE` for proven API, playback, payment, entitlement, media, or content-load failures only. | Reuse operation/request identity where it exists. Current Android API facade does not expose a stable request ID or original server failure timestamp. Client failures use the caught failure time only when it is a bounded known failure, not an arbitrary error object. | At typed `ApiError`/known playback status conversion points, before existing recovery UI updates, using an isolated async observer. | Request retry, cache de-duplication, polling, and screen remount can repeat a failure; retain only existing stable retry/request identity. Never include stack traces, raw provider responses, URLs, credentials, messages, or console arguments. User cancellation is not a system failure. | Mixed: typed client-observed network/playback failure; server-authoritative authorization/media result. | `NEEDS_RUNTIME_PROOF` -- requires a bounded request identity map and proof that retries/cancellation remain correctly classified without changing recovery. |
| 5 | TRAFFIC | [`getAndroidLinkingConfig`](../../apps/android/src/navigation/linking.ts) parses initial/deep link routes, but does not retain a verified attribution identifier or source event. | `TRAFFIC_SOURCE_OBSERVED` only for a supplied, privacy-safe `deep_link`, `notification`, referral, campaign, organic, direct, or unknown classification. | Session/correlation reuse `getEvidenceSessionId()`. A deep-link receipt time can be client-observed only after a route is accepted. There is no existing verified campaign/referral ID. | After route validation and before navigation side effects, with observation errors ignored. | Navigation state restoration may reparse links; dedupe needs an existing bounded link/event ID, not the raw URL. Raw URLs, query strings, UTMs, and any PII must be excluded. | Client-observed route; campaign/referral/notification attribution requires trusted evidence. | `NEEDS_RUNTIME_PROOF` for route receipt only; `DEFER` all referral/campaign attribution until a verified identifier exists. |
| 6 | NOTIFICATION | No notification delivery/provider lifecycle is installed. The App has preferences only, not provider callbacks. | None safely today. Future provider-confirmed `NOTIFICATION_SENT`/`DELIVERED`; client-observed `OPENED`/`DISMISSED` only with a provider-issued bounded notification ID. | Must reuse session on client open and provider message/campaign/correlation IDs; use provider/client callback time. | Future provider callback boundary, isolated from delivery/navigation behavior. | Provider retries and redelivery need provider event identity. Never include push token, message body, raw payload, deep-link URL, email, phone, or secret. | Provider authority for sent/delivered; client authority for open/dismiss. | `BLOCKED` -- no notification provider lifecycle runtime exists. |
| 7 | CONTENT | Android catalog/series/short-film fetches consume server/CMS representation through [`getCatalog`](../../apps/android/src/lib/api.ts), [`getSeries`](../../apps/android/src/lib/api.ts), and [`getShortFilm`](../../apps/android/src/lib/api.ts). CMS publication is owned server-side. | `CONTENT_PUBLISHED`, `CONTENT_UPDATED`, `CONTENT_UNPUBLISHED`, `CONTENT_AVAILABLE`, `CONTENT_UNAVAILABLE` only from CMS/catalog authority. | Use content ID, server/CMS lifecycle time, and authoritative request/correlation IDs. Android sessions may annotate catalog consumption only if an approved producer is defined, but client metadata cannot emit content lifecycle. | Server CMS/catalog lifecycle boundary after authoritative state reads/writes; not Android rendering or cache callbacks. | Client TTL cache and repeated catalog reads are not content lifecycle. Never infer publication from visibility, use ranking/performance fields, or include unbounded metadata. | CMS/catalog server authority. | `DEFER` -- no existing durable CMS lifecycle event stream with the required original times/correlation. |

## First bounded implementation

**SESSION** is the first producer to implement after approval because:

1. it already has one runtime controller and one established process session ID;
2. it has no server-authority dependency;
3. its allowed events, ordering, duplicate guards, privacy rules, and
   fail-open behavior are already verified; and
4. it can be validated without altering navigation, auth, access, billing, or
   playback behavior.

The implementation must not create a second session, change
[`App.tsx`](../../apps/android/App.tsx) lifecycle semantics, infer
`SESSION_ENDED`, or add a transport/persistence sink. The unresolved design
decision is the non-authoritative in-process observation consumption boundary;
that boundary needs explicit approval before any visible emission work.

## Likely file scope by future producer

- SESSION: [`apps/android/App.tsx`](../../apps/android/App.tsx),
  [`apps/android/src/lib/sessionObservations.ts`](../../apps/android/src/lib/sessionObservations.ts),
  and its focused test only, subject to approval of the sinkless consumption
  boundary.
- MONETIZATION: authoritative API/RPC response contracts first; then the
  corresponding Android result handlers. Do not wire Google Play outcomes
  until real verification is available.
- ACCESS: server playback and purchase routes/resolvers first; then Android
  typed response consumers.
- SYSTEM: [`apps/android/src/lib/api.ts`](../../apps/android/src/lib/api.ts),
  [`apps/android/src/player/usePlaybackSource.ts`](../../apps/android/src/player/usePlaybackSource.ts),
  and focused retry/cancellation tests.
- TRAFFIC: [`apps/android/src/navigation/linking.ts`](../../apps/android/src/navigation/linking.ts)
  plus route/deep-link tests.
- NOTIFICATION: no file is safe until a provider lifecycle is approved.
- CONTENT: server CMS/catalog lifecycle source only; Android readers are not
  content-authoritative producers.

## Non-negotiable verification for any later wiring

- Contract acceptance/rejection and CanonicalEvent parity remain unchanged.
- Observation validation/adaptation failure cannot change the originating
  result, UI state, navigation, playback, purchase, reward polling, or retry.
- Existing actor/session/correlation/request/dedupe IDs are reused; no
  observation-specific authority ID is invented.
- Retries, cache hits, remounts, app foregrounding, polling, and duplicate
  server responses do not generate duplicate observations.
- Client output is never promoted to server authority, and server results are
  observed only with their original bounded status/time/identity evidence.
- No raw URLs, query strings, tokens, receipts, custom ad data, credentials,
  PII, arbitrary errors, stack traces, or ranking inputs pass the contract.

## Explicit exclusions

- Transport: `NO`
- Persistence: `NO`
- Database migration: `NO`
- Autonomous integration: `NONE`
- Ranking changes: `NONE`
- Product behavior change: `NONE`
