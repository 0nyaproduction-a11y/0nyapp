# 0nya BACKEND API CONTRACT v1.0

## Scope

This document records the API contract evidence that actually exists in the repository. It is intentionally limited to implementation evidence from the codebase and SQL migrations and does not assume a billing client that is not present in the repository.

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

Status: `MISSING` / `UNKNOWN / NOT FOUND`

Evidence:

- No Android `queryPurchases` implementation was found.
- No Android restore-purchases screen or sync route was found.
- No server endpoint named for restore/sync purchase state was found.
- No `restore` or `syncPurchases` logic was found in `src/**` or `apps/android/src/**`.

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
