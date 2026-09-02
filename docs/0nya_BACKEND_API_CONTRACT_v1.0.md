# 0nya BACKEND API CONTRACT v1.0

## Scope

This document records the API contract evidence that actually exists in the repository. It is intentionally limited to implementation evidence from the codebase and SQL migrations and does not assume a billing client that is not present in the repository.

## Build 15 verified endpoint inventory

Current proven endpoints/functions:

| Surface | Contract |
| --- | --- |
| `POST /api/v1/playback` | Server-authorizes Series Episode or Short Film playback and returns signed Mux HLS URL data when allowed. |
| `POST /api/v1/playback/preview` | Server-authorizes locked preview playback where configured. |
| `POST /api/v1/episodes/[episodeId]/purchase` | Authenticated coin unlock path backed by `purchase_episode_with_coins`. |
| `POST /api/v1/episodes/[episodeId]/rewarded` | Authenticated rewarded-ad attempt creation backed by `create_rewarded_ad_attempt`. |
| `GET /api/v1/rewarded-ad-attempts/[customData]` | Authenticated rewarded-attempt status polling backed by `get_rewarded_ad_attempt_status`. |
| `POST /api/webhooks/admob/ssv` | AdMob SSV callback verification using Google ECDSA verifier keys and `finalize_rewarded_ad_callback`. |
| `GET /api/v1/short-films/[slug]` | Short Film detail response including backend Chai availability. |
| `POST /api/v1/short-films/[slug]/chai` | Authenticated Chai coin tip using `submit_short_film_chai_tip`. |
| `POST /api/v1/billing/google-play` | Development/blocked production Google Play boundary; never credits wallet or Plus from client state. |
| `GET /api/v1/me` | Authenticated account summary, wallet, and Plus reconciliation. |
| `GET /api/v1/wallet` | Authenticated wallet/coin product/ledger summary. |

Server-authoritative invariants:

- Wallet balance and coin deductions are backend/RPC controlled.
- Coin episode unlock is idempotent and creates a permanent entitlement with `expires_at = null`.
- Rewarded unlock depends on AdMob SSV verification and backend finalization; duplicate provider transactions do not duplicate grants.
- Plus access is resolved server-side and remains independent of permanent coin/rewarded episode entitlements.
- Chai uses one wallet, validates allowed amounts, debits the viewer, credits the creator/film ledger, and uses an idempotency key.
- The Google Play boundary is not real Play purchase verification; real token verification, acknowledge/consume, restore, refund/revocation, and subscription lifecycle remain incomplete.

## Google Play Billing / Purchase Contracts

### 1. purchase verification endpoint/function

Status: `PARTIALLY IMPLEMENTED`

Evidence:

- `supabase/005_wallet_topups.sql` defines `public.credit_verified_coin_purchase(...)`.
- `src/types/database.ts` exposes the RPC signature under `Database["public"]["Functions"]["credit_verified_coin_purchase"]`.
- The function comment explicitly says it is intended for trusted server/provider verification infrastructure.

Function signature:

- `public.credit_verified_coin_purchase(p_user_id uuid, p_provider text, p_provider_transaction_id text, p_product_code text, p_reference text default null)`

Purpose:

- Accept a provider purchase token / transaction identifier.
- Validate that the user, provider, and product code are valid.
- Prevent duplicate processing.
- Credit the wallet with the coin amount once the purchase is verified.

Important caveat:

- This is a backend verification function, not a live Google Play Billing client integration.
- The repository does not contain a route or server handler that performs live Play token verification against Google Play.

### 2. purchase-token verification

Status: `PARTIALLY IMPLEMENTED`

Evidence:

- `public.payment_orders.provider_transaction_id` exists and is the transaction identifier key.
- `public.credit_verified_coin_purchase(...)` validates `p_provider_transaction_id` and rejects blank/null values.
- A unique index exists on `(provider, provider_transaction_id)`.

Repository proof points:

- `supabase/005_wallet_topups.sql`
- `src/types/database.ts`

Not found:

- Google Play token verification API call
- server-side Google Play purchase verification route
- Play Billing `verifyPurchase` service code
- Play `purchaseToken` parsing or validation logic

This means the repo models token-based verification structurally but does not implement the actual verification call against Google Play.

### 3. coin-credit logic

Status: `IMPLEMENTED`

Evidence:

- `public.credit_verified_coin_purchase(...)` updates `public.wallets.coin_balance`.
- It inserts a `public.coin_transactions` credit row with `transaction_type = 'credit'` and `payment_order_id`.
- It returns `success`, `status`, `credited_coins`, `new_balance`, and `payment_order_id`.

Relevant files:

- `supabase/005_wallet_topups.sql`
- `src/types/database.ts`

Behavior:

- Validates that the user exists.
- Validates the provider and product.
- Prevents duplicate crediting using `payment_order_id` and `(provider, provider_transaction_id)` uniqueness.
- Credits wallet balance by `coin_amount` from the active product.

### 4. duplicate / idempotency protection

Status: `IMPLEMENTED`

Evidence:

- Unique index: `payment_orders_provider_transaction_unique_idx`
- Unique index: `coin_transactions_one_credit_per_payment_order_idx`
- Function branch for `already_processed`
- Function conflict guard for `transaction_conflict`

Database protections:

- `payment_orders(provider, provider_transaction_id)` is unique when transaction ID exists.
- `coin_transactions(payment_order_id)` is unique for credits.
- `credit_verified_coin_purchase(...)` checks for existing order and existing credit before crediting again.

This is strong backend idempotency protection for the verified coin purchase flow.

### 5. Plus entitlement creation/status

Status: `PARTIALLY IMPLEMENTED`

Evidence:

- `src/types/database.ts` defines `subscriptions` table structure with `status`, `plan_code`, `starts_at`, `ends_at`.
- `src/lib/entitlements.ts` contains `getUserSubscription()` and `hasActiveSubscription()` logic.
- `src/app/plans/page.tsx` shows a placeholder plan page.

Limitations:

- No Google Play subscription purchase flow was found in the repository.
- No subscription verification or billing client lifecycle was found in Android files.
- No real `0nya Plus` purchase server route or Google Play signature verification implementation was found.

This appears to be only a backend entitlement model and UI shell, not a real subscription billing integration.

### 6. restore / sync flow

Status: `PARTIALLY IMPLEMENTED / EXTERNALLY BLOCKED`

Evidence:

- Android has `apps/android/src/screens/RestoreSyncScreen.tsx`.
- `POST /api/v1/billing/google-play` accepts `mode: "restore"` and reports current trusted wallet/Plus state.
- In development, the boundary returns `DEVELOPMENT_TEST_BOUNDARY`, `entitlementChanged=false`, and does not mutate wallet or Plus.

Not complete:

- No real Google Play `queryPurchasesAsync` reconciliation.
- No production purchase-token verification, acknowledge/consume, refund, revocation, or subscription lifecycle processing.

### 7. subscription expiration / cancellation / refund handling

Status: `UNKNOWN / NOT FOUND`

Evidence:

- The schema includes `subscriptions.status` values: `inactive`, `active`, `expired`, `cancelled`.
- The logic for active subscription is computed in `src/lib/entitlements.ts`.
- No actual Google Play subscription lifecycle handling (`BillingClient.queryPurchasesAsync` for subscriptions, cancellation, expiration, or refund processing) was found.

This is schema- and helper-level only, not a full store lifecycle implementation.

### 8. purchase-to-account association

Status: `IMPLEMENTED`

Evidence:

- `public.payment_orders.user_id` relates the purchase order to the authenticated user.
- `public.wallets.user_id` is the wallet owner.
- `public.coin_transactions.user_id` is the ledger owner.
- `public.credit_verified_coin_purchase(p_user_id, ...)` is called with the user account ID and writes the credit to that account.

Relevant files:

- `supabase/005_wallet_topups.sql`
- `src/types/database.ts`

This is properly mapped to the user account rather than to a device-only identifier.

---

## 9. Existing payment product model

Status: `IMPLEMENTED`

Evidence:

- `public.coin_products` table contains `code`, `coin_amount`, `display_name`, `active`, and `sort_order`.
- Product rows include:
  - `coins_50`
  - `coins_100`
  - `coins_250`
- These are used in payment-order and wallet-credit logic.

Files:

- `supabase/005_wallet_topups.sql`
- `src/lib/payments.ts`
- `src/types/database.ts`

### Important note

These product codes are database product identifiers. They are not proven to be the same as the Google Play product IDs used in a real store implementation because there is no actual BillingClient configuration or Play product query code in the repository.

---

## 10. payment order schema

Status: `IMPLEMENTED`

Evidence:

- `public.payment_orders` includes:
  - `provider`
  - `provider_order_id`
  - `provider_transaction_id`
  - `product_code`
  - `coin_amount`
  - `amount_minor`
  - `currency`
  - `status`
  - `verification_status`
  - `verified_at`
  - `completed_at`
  - `user_id`

Provider values:

- `google_play`
- `apple_store`
- `web`
- `admin_test`

This is sufficient to support a provider-agnostic purchase pipeline.

---

## 11. frontend API surfaces for wallet and top-ups

Status: `PARTIALLY IMPLEMENTED`

Evidence:

- `src/lib/payments.ts`
  - `getActiveCoinProducts()`
  - `getUserPaymentOrders()`
  - `getPaymentOrderById()`
- `src/app/api/v1/wallet/route.ts`
- `src/app/api/v1/me/route.ts`
- `src/app/wallet/page.tsx`

These surfaces provide a wallet summary and recent payment order records, but they do not implement a live Google Play purchase client or verification flow.

---

## 12. parental controls opt-in contract

Status: `IMPLEMENTED`

Endpoint:

- `GET /api/v1/account/parental-controls`
- `POST /api/v1/account/parental-controls`

GET response fields:

- `hasPin`
- `failedAttempts`
- `lockedUntil`
- `restrictionsEnabled`
- `restrictionThreshold`

Supported `restrictionThreshold` values:

- `U/A 13+`
- `U/A 16+`

POST modes:

- `mode: "set"` sets or changes the parental PIN.
- `mode: "verify"` verifies the parental PIN and issues an opaque parental session token.
- `mode: "settings"` updates `restrictionsEnabled` and `restrictionThreshold` through the existing parental-controls route.

Important invariants:

- A PIN may exist while `restrictionsEnabled=false`.
- Setting or changing a PIN does not enable restrictions by itself.
- Enabling restrictions requires a configured PIN and a valid threshold.
- Disabling restrictions preserves the PIN.
- Invalid thresholds are rejected.
- The database rejects `restrictions_enabled=true` with null/invalid `restriction_threshold`.
- Backend playback authorization reads server parental state and enforces the same opt-in policy for Series and Short Films.
- Android is not authoritative for restriction state or threshold.

---

## 12A. HOME CATALOG SPOTLIGHT CONTRACT

`GET /api/v1/catalog` returns `home` (type `HomeState`). The Spotlight stage is now a CMS-controlled ordered collection.

Backward-compatible first item:

- `home.spotlight` is the first valid Spotlight item, or `null` when none.
- This preserves the existing Android contract (`HomeState.spotlight`) before the client adopts the collection.

Ordered collection:

- `home.spotlights` is an array of all valid (published) Spotlight items in `home_row_items.sort_order` ASC.
- Semantics:

```text
3 items:  spotlights = [A, B, C]   spotlight = A
1 item:   spotlights = [A]         spotlight = A
0 items:  spotlights = []          spotlight = null
```

Each Spotlight item contains only proven useful fields:

```text
id
contentType        ("series" | "short_film")
slug
title
poster
synopsis           (when already part of the Spotlight object)
sharePath
showTitle          (boolean, CMS-controlled per-item title visibility)
```

The collection is resolved entirely from the single `home_rows` row with `row_role = 'spotlight'` plus its `home_row_items`. No new network request and no per-item API request is introduced; resolving `spotlights` reuses the same `getHomeState` query batch (membershipsByRow, seriesById, shortFilmsById) used for `spotlight` and the other rows.

Invariants:

- No editorial hook, ranking, carousel metadata, timer, auto-play metadata, or new hero artwork model is added to the API.
- `home.spotlight` is preserved for existing Android builds.
- The stage never auto-rotates and never fabricates content; only published canonical content is returned.

---

## 13. overall verdict

| Area | Status |
| --- | --- |
| Google Play client SDK integration | `MISSING` / `UNKNOWN / NOT FOUND` |
| Server-side Google Play verification route | `PARTIALLY IMPLEMENTED` |
| Coin-credit verification logic | `IMPLEMENTED` |
| Duplicate/idempotent protection | `IMPLEMENTED` |
| Purchase-to-user association | `IMPLEMENTED` |
| 0nya Plus subscription flow | `PARTIALLY IMPLEMENTED` |
| Restore/sync purchases | `MISSING` / `UNKNOWN / NOT FOUND` |
| Subscription cancellation/refund handling | `UNKNOWN / NOT FOUND` |
| Product catalog mapping | `IMPLEMENTED` |
| Parental controls opt-in contract | `IMPLEMENTED` |

### Final conclusion

The repository contains a backend-ready payment and wallet verification architecture that explicitly models Google Play as a provider and includes a trusted server-side coin-credit function. However, there is no actual Google Play Billing client implementation, no `BillingClient` lifecycle, no `queryProductDetails` / `queryPurchases` flow, and no store purchase-token verification code in the app source. The repository therefore supports a purchase verification contract and wallet ledger foundation, but not a live Play Billing integration in the code currently present.

---

## Multi-Rewarded Unlock (V1 Launch Policy)

Implemented on top of the existing verified rewarded foundation (`rewarded_ad_attempts`,
`create_rewarded_ad_attempt`, `finalize_rewarded_ad_callback`). No new progress ledger was
created; verified progress is derived from granted attempt rows bound to the active
required-count snapshot.

- **Required count is backend/CMS controlled.** Field `episodes.required_rewarded_completions`
  (integer, NOT NULL, default 1, range 1–2). Android is told the value via
  `requiredRewardedCompletions` on the episode; it never derives it from coin price.
- **Launch maximum is 2.** No 3- or 4-ad unlocks at launch. If an episode is too valuable for
  two ads, Rewarded is disabled and Coin + Plus (or another CMS combination) is used.
- **Permanent only at launch.** `rewarded_access_mode` still permits `session` in the DB for
  migration compatibility, but the operational CMS editor no longer offers Session and
  `create_rewarded_ad_attempt` rejects `session` with `unsupported_pending_policy`.
- **Commercial guideline (editorial, NOT code):** 5–7 coins ~ usually 1 ad; 8–15 coins ~
  usually 2 ads. CMS/backend owns the actual value; there is no automatic
  `coin_price -> required_ads` mapping.
- **No automatic chained ads.** 0/2 -> explicit Watch Ad -> Ad1 verified -> 1/2 -> controlled
  0nya screen -> explicit Watch next Ad -> Ad2 verified -> 2/2 -> permanent entitlement.
  Ad 2 is never auto-launched.
- **Partial progress is preserved** across no-fill, network failure, background, app close,
  app kill, and later return. Backend remains authoritative; Android recovers 1/2 from
  `GET /api/v1/episodes/:id/rewarded/progress` on mount/focus.
- **SSV/idempotency preserved.** Google AdMob SSV ECDSA/SHA-256 verification, service-role-only
  finalize, unique `provider_transaction_id`, row locking, entitlement uniqueness, and
  user/episode binding are unchanged. Replayed transactions do not increase progress; a
  transaction reused on another attempt is rejected (`transaction_conflict`).
- **Abuse control:** `create_rewarded_ad_attempt` reuses a non-expired pending attempt for the
  same user+episode+snapshot instead of flooding pending rows.
- **Production ad-unit pinning is fail-closed.** In `NODE_ENV=production`,
  `ADMOB_REWARDED_AD_UNIT_ID` must be configured and the SSV `ad_unit` must match it; otherwise
  the callback is rejected. Dev/test uses safe test configuration.
- **Client is never entitlement-authoritative.** Navigation to Watch happens only after the
  backend confirms `verifiedProgress >= requiredCompletions`.
- **Analytics:** internal `rewarded_monetization_events` table + `record_rewarded_event` RPC
  (server-side) and `POST /api/v1/monetization/rewarded-events` (client-offer/CTA/no-fill).
  No auth tokens, OTP, receipts, or provider secrets are stored; analytics is not a financial
  authority — the attempt/entitlement tables remain authoritative.

---

## API Verification & Final Integration Acceptance

Backend API and route verification (`CMS/API VERIFIED`) is a prerequisite step and does not independently close CMS or consumer App acceptance. Final acceptance is governed by the **Locked Final Acceptance Protocol** in `AGENTS.md`:

- CMS operational acceptance requires real deployed CMS website testing plus Product Owner hands-on verification.
- Consumer App integration requires full emulator screenshot approval by Product Owner + ChatGPT followed by physical hardware validation on OnePlus 13R.

*Final Acceptance Protocol synchronized — Product Owner approved — 2026-08-31*

---

## PX01 / Play Together / 0chat source-foundation boundary

Status: **SOURCE FOUNDATION PRESENT / DEPLOYED RUNTIME UNVERIFIED**.

Current uncommitted source adds server-authoritative preparation for secure
invite/redeem, rooms/participants, ordered room-scoped 0chat messages, and
backend-controlled acquisition/access, including the approved configured Coin
price and Plus bypass. Room acquisition/access is separate from episode
entitlement: every participant must independently authorize playback, Host
entitlement never transfers to a Guest, and an invite never grants episode
entitlement.

Do not represent these source routes/migrations as deployed or as realtime
Android synchronization/chat UI. Production work must add one canonical room
timeline with Host playback-intent authority, state version/time reference,
heartbeat/offset measurement, measured drift correction, and
buffering/reconnect/control policy; no arbitrary drift threshold is specified.
