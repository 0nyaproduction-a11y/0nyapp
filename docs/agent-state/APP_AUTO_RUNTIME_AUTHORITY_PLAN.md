# APP-AUTO-RUNTIME-AUTH-01 -- Monetization and Access Server Authority Plan

**Date:** 2026-09-06

**Status:** `SOURCE VERIFIED` -- planning only. This report adds no producer,
sink, transport, persistence, Autonomous connection, business behavior, ledger,
or schema change.

## Fixed authority boundary

The Android client may observe an intent or render an API response, but it must
not assert a monetization outcome, entitlement, wallet balance, subscription
state, or playback authorization. Server-authenticated API routes, trusted
provider verification, and existing database/RPC state remain authoritative.

Any future observer must be invoked after the authoritative operation has
returned, through the existing fail-open domain adapter boundary. Its failure
must not alter the HTTP response, database transaction, entitlement, or client
branching. It must not receive tokens, SSV `custom_data`, signatures, receipts,
raw provider payloads, signed playback URLs, guest credentials, parental
session tokens, or raw errors.

## Monetization authority candidates

| Candidate | Exact authoritative insertion point | Existing identity and durable IDs | Original authority time and retry semantics | Safe event and payload boundary | Disposition |
| --- | --- | --- | --- | --- | --- |
| Coin episode unlock | [`POST /api/v1/episodes/[episodeId]/purchase`](../../src/app/api/v1/episodes/[episodeId]/purchase/route.ts), immediately after [`purchaseEpisodeWithCoins`](../../src/lib/purchases.ts) returns the `purchase_episode_with_coins` RPC outcome. | Actor is `getApiAuth().user.id`; episode UUID is the route parameter. On a successful debit, the existing `coin_transactions` and `episode_entitlements` rows are the durable authority, but neither their IDs nor `created_at` values are returned. | The RPC locks wallet state and rechecks entitlement, so repeated calls return `already_owned`/other authoritative statuses rather than a second debit. The current API response lacks a stable logical request/correlation ID and authoritative transaction time. | `MONETIZATION_OUTCOME` only from the RPC result. Allowlisted status, success, integer remaining balance/coin amount only when server-derived, and existing episode/ledger reference. Never trust client result state. | `NEEDS_CORRELATION_FIELD` -- expose or internally retain a server-safe existing transaction/entitlement reference plus its authoritative occurrence time; do not create a new ledger. |
| Chai tip | [`POST /api/v1/short-films/[slug]/chai`](../../src/app/api/v1/short-films/[slug]/chai/route.ts), immediately after [`submitShortFilmChaiTip`](../../src/lib/chai.ts) returns the `submit_short_film_chai_tip` result. | Actor is authenticated server user. Request already supplies a stable idempotency key. The existing `chai_tip_requests.id`, `chai_ledger_entries.id`, and linked coin transaction are the authoritative records; current result exposes only success/status/balance. | `(viewer_user_id, short_film_id, idempotency_key)` is unique, and the ledger has one entry per request. `created_at`/`updated_at` are authoritative but are not projected by the current function/library response. | `CHAI_TIP_COMPLETED` or `CHAI_TIP_FAILED` as `MONETIZATION_OUTCOME`; bounded status, success, server-derived integer coin amount, and a safe existing request/ledger reference. The idempotency key is dedupe evidence, never a feature. | `NEEDS_CORRELATION_FIELD` -- keep the existing idempotency key and project an existing request/ledger ID and authoritative timestamp; no client-side success assertion. |
| Verified rewarded outcome | [`POST /api/webhooks/admob/ssv`](../../src/app/api/webhooks/admob/ssv/route.ts), only after signature/ad-unit validation and [`finalizeRewardedAdCallback`](../../src/lib/rewarded-ads.ts) complete. | This is provider/server authority. Existing provider `transaction_id` is the provider dedupe identity; `rewarded_ad_attempts` and any resulting entitlement are durable authority. SSV `custom_data` is sensitive and cannot be an observation ID, correlation ID, reference, or payload. | Callback replay safety is owned by the finalized attempt/provider transaction path. The returned object lacks attempt/entitlement ID and completion timestamp. Current multi-completion source is uncommitted and deployment status is unproven. | `REWARDED_UNLOCK_GRANTED` only if the verified finalizer reports an authoritative grant; failure outcomes only for a finalizer result, never a client "ad completed" assertion. Permit only status, success, bounded progress/count, provider transaction reference when validation accepts it. | `NEEDS_CORRELATION_FIELD` and `NEEDS_RUNTIME_PROOF` -- a safe server-owned attempt/entitlement reference must bridge attempt to callback without exposing `custom_data`; verify the active deployed RPC behavior before wiring. |
| Rewarded attempt creation/progress | [`POST /api/v1/episodes/[episodeId]/rewarded`](../../src/app/api/v1/episodes/[episodeId]/rewarded/route.ts) and rewarded progress/status reads. | Authenticated user and episode ID are authoritative for attempt eligibility. Returned `customData` is intentionally sensitive. The current response contains no safe attempt ID. | Pending-attempt reuse and progress derive from existing rewarded attempt rows. Poll/read responses are not final grant authority. | A server-validated `REWARDED_UNLOCK_STARTED` can only be emitted if a safe retry identity is supplied; progress reads must not fabricate grant/failure events. | `NEEDS_CORRELATION_FIELD`; final outcomes remain at the SSV finalizer. |
| Google Play coin credit / subscription | Future trusted provider-verification handler immediately after existing `credit_verified_coin_purchase` succeeds or rejects; not the present [`billing/google-play`](../../src/app/api/v1/billing/google-play/route.ts) boundary, which explicitly reports unconfigured/no entitlement change. | Existing `payment_orders.id`, `(provider, provider_transaction_id)` uniqueness, `google_play_purchases` fields, and `credit_verified_coin_purchase` result's `payment_order_id` are correct server authority. | Payment order `verified_at`, `completed_at`, and credit state are authority timestamps. Existing RPC returns `payment_order_id`; provider transaction uniqueness prevents duplicate credit. | A verified coin-credit `MONETIZATION_OUTCOME` could use the existing payment order ID, provider transaction reference, verified amount/status, and authoritative stored time. Store tokens/receipts are excluded. No subscription outcome is currently live. | `DEFER` -- real Google verification/fulfillment is externally blocked/not configured; current route is not a success/failure authority. |

### Monetization correlation path

For every future attempt/outcome pair, retain existing identities rather than
inventing business IDs:

1. Coin unlock: server actor + episode ID + returned existing transaction or
   entitlement ID.
2. Chai: existing idempotency key -> existing `chai_tip_requests.id` / ledger
   ID.
3. Rewarded: safe server-owned attempt ID -> provider transaction ID -> existing
   granted attempt/entitlement ID. Never use `custom_data`.
4. Store credit: existing payment order ID -> provider transaction ID.

The current routes are not required to expose client observation data. A
server-local, fail-open producer is preferable once the safe fields exist; the
client's receipt of an outcome is unnecessary for authoritative observation.

## Access authority candidates

| Candidate | Exact authoritative insertion point | Existing identity/content/reason source | Original authority time and check-to-outcome correlation | Safe event and payload boundary | Disposition |
| --- | --- | --- | --- | --- | --- |
| Full series-episode playback | [`POST /api/v1/playback`](../../src/app/api/v1/playback/route.ts), after [`authorizeMuxPlayback`](../../src/lib/playback.ts) has returned and before response serialization. | Actor is server-authenticated user or `null` guest. Resolver loads canonical series/episode UUIDs and evaluates publication, classification, parental proof, entitlement/free/Plus access, media readiness, and Mux readiness. Result status supplies the authoritative bounded outcome. | The route has no stable request ID/correlation ID, and the resolver returns no decision time. HTTP retry can repeat a decision; catalog/API cache state must not be used as decision authority. | Emit `ACCESS_CHECKED` plus exactly one `ACCESS_GRANTED`/`ACCESS_DENIED` projection through `ACCESS_OUTCOME`, with canonical content ID/type, bounded status, `authorized`, and an allowlisted denial reason. Never include `playbackUrl`, `stillUrl`, auth/parental data, or raw request data. | `NEEDS_CORRELATION_FIELD` -- add a privacy-safe client-propagated or server-issued request correlation field and server decision timestamp/ID before durable production emission. |
| Locked episode preview authorization | [`POST /api/v1/playback/preview`](../../src/app/api/v1/playback/preview/route.ts), after [`authorizeMuxPreviewPlayback`](../../src/lib/playback.ts) returns and before response serialization. | Same authenticated/guest identity and canonical episode resolution as full playback. `preview_not_required`, `preview_unavailable`, and other resolver statuses are source of truth. | No current request/decision ID or authority timestamp. It is a distinct preview decision; it must not be merged with full-playback success. | Same bounded ACCESS observation with canonical episode ID and status only. Never include preview URL, preview token, parental proof, raw request, or client timer result. | `NEEDS_CORRELATION_FIELD` -- use the same future bounded request correlation contract while preserving full versus preview target/source distinction. |
| Short-film playback | [`POST /api/v1/playback`](../../src/app/api/v1/playback/route.ts), after the short-film branch of [`authorizeMuxPlayback`](../../src/lib/playback.ts). | Actor is server-authenticated user or `null`; resolver loads canonical short-film ID and applies publication/classification/media checks. | The current route has no request correlation or decision timestamp. The short-film resolver has no episode entitlement decision and must not be described as one. | Bounded `ACCESS_OUTCOME` only; content ID/type `short_film`, authoritative status/authorization. Exclude signed URLs and credentials. | `NEEDS_CORRELATION_FIELD` -- same correlation/time deficit as full playback. |
| Entitlement grant from coin unlock | The existing `purchase_episode_with_coins` RPC transaction, after insert/upsert of `episode_entitlements`, with route-level fallback only if existing entitlement ID/timestamp can be retrieved atomically. | Authenticated RPC user, episode UUID, `episode_entitlements` row, and `coin_transactions` row are server authority. | Idempotent entitlement recheck precedes debit. Existing `created_at`/row identity are not returned by the RPC. | `ENTITLEMENT_GRANTED` only for the new authoritative grant, not for `already_owned`, `active_subscription`, or client UI changes. | `NEEDS_IDENTITY_FIELD` -- surface an existing entitlement/transaction ID and created time from the authoritative transaction; no new ledger. |
| Entitlement grant from verified rewarded callback | Verified `finalize_rewarded_ad_callback` transaction after it durably grants entitlement. | Verified provider transaction, resolved server user/episode, rewarded attempt, and resulting entitlement are server authority. | Provider retry is authoritative; callback result currently does not project a safe attempt/entitlement ID or grant time. | `ENTITLEMENT_GRANTED` only after verified finalization, using safe existing IDs/progress/status. | `NEEDS_IDENTITY_FIELD` and `NEEDS_RUNTIME_PROOF` -- do not infer a grant from polling, client ad callbacks, or `custom_data`; active RPC/deployment must be proven. |
| Subscription entitlement changes | Existing `subscriptions` persistence/verification lifecycle, not Android plan selection or the unconfigured Google billing boundary. | Subscription row and trusted provider verification are authority. | No configured provider fulfillment/event path is active to establish a lifecycle timestamp and dedupe handling. | No event until actual authoritative subscription state transition exists. | `DEFER` / `BLOCKED` by unconfigured provider verification. |

### Access reason handling

The access adapter already permits only bounded authoritative reason codes:
`not_found`, `access_required`, `age_verification_required`,
`parental_required`, `media_not_ready`, `playback_unavailable`,
`insufficient_balance`, `already_accessible`, `active_subscription`,
`expired`, `revoked`, and `unknown`.

When a resolver result does not identify an allowlisted denial reason, emit
`status` only with the adapter's `unknown`/null reason semantics. Do not
derive a reason from client UI, missing data, URL contents, exceptions, or
response copy. Client UI remains non-authoritative and may only render the
server decision.

## Minimum future contract additions (not implemented)

1. **Access:** one bounded request/correlation value accepted and echoed only
   after server validation, plus a server decision ID or decision timestamp.
   It must be independent of tokens and raw URLs.
2. **Coin/Chai:** project existing transaction/request/ledger or entitlement
   identity and its existing authoritative timestamp from the transaction that
   made the decision.
3. **Rewarded:** project a safe server-owned attempt/entitlement identity;
   retain the provider transaction ID only as bounded provider evidence; never
   expose or repurpose `custom_data`.
4. **Google Play:** no change until trusted provider verification becomes
   configured and runtime-proven. Reuse existing payment-order records.

These are contract-field requirements only. They do not authorize an observer,
new database work, a ledger, or client authority.

## Disposition

- **Monetization authority:** existing server RPC/ledger/provider boundaries.
- **Access authority:** existing server playback resolver and entitlement
  transactions.
- **First safe producer:** none is safe to wire now. The first implementation
  candidate after explicit authorization is a server-local coin episode-unlock
  outcome producer, but only after its existing transaction/entitlement
  identity, occurrence time, and correlation semantics are projected without
  changing purchase behavior.
- **Client authority:** not required and prohibited.
- **Transport/persistence/sink/Autonomous:** none introduced or required for
  this planning task.
