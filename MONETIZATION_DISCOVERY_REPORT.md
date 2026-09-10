# MONETIZATION DISCOVERY REPORT — 0nya (0nyapp)

**Audit type:** READ-ONLY architecture discovery
**Scope:** Monetization / pricing / paywalls / offers / checkout / payments / subscriptions / purchases / refunds / cancellations / entitlements / credits / revenue tracking
**Stack observed:** Next.js 16 (App Router, RSC + Route Handlers), Supabase (Postgres + Auth + RLS), Mux (video), AdMob (rewarded-ad SSV). No Stripe / Razorpay / RevenueCat / Paddle present.

> **IMPORTANT:** This is a discovery-only audit. No source files, migrations, CMS, UI, or `.env` values were modified. No secrets, keys, or credentials are reproduced in this document.

---

## 1. MONETIZATION SYSTEM MAP

### 1.1 Core library files (server-side logic)

| Path | Purpose | Exported functions / classes | Called by | Calls into |
|------|---------|-------------------------------|-----------|------------|
| `src/lib/entitlements.ts` | **Single source of truth for access/entitlement decisions** (free/owned/subscription/locked; Plus resolution; wallet/subscription loaders) | `getUserWallet`, `getUserSubscription`, `hasActiveSubscription`, `resolvePlaybackMaxResolution`, `hasValidEpisodeEntitlement`, `userOwnsEpisode`, `getValidEpisodeEntitlementIds`, `getEpisodeAccessStates`, `canUserWatchEpisode` | `playback.ts`, `catalog.ts` (series page), `watch/[…]/page.tsx`, `purchase/[…]/page.tsx`, `account/page.tsx`, `plans/page.tsx`, `me/route.ts`, `wallet/route.ts`, `account/actions.ts` | Supabase `wallets`, `subscriptions`, `episode_entitlements`; `api/perf` |
| `src/lib/purchases.ts` | Coin-based episode purchase + coin transaction history | `purchaseEpisodeWithCoins`, `getUserCoinTransactions` | `purchase/actions.ts`, `api/v1/episodes/[episodeId]/purchase/route.ts`, `purchase/[…]/page.tsx` | RPC `purchase_episode_with_coins`; `coin_transactions` |
| `src/lib/payments.ts` | Coin-product catalog + payment-order history (top-ups) | `getActiveCoinProducts`, `getUserPaymentOrders`, `getPaymentOrderById`, `formatOrderStatus`, `formatPaymentProvider` | `wallet/route.ts`, `wallet/page.tsx` | `coin_products`, `payment_orders` |
| `src/lib/rewarded-ads.ts` | Rewarded-ad unlock attempt lifecycle (server-verified) | `createRewardedAdAttempt`, `getRewardedAdAttemptStatus`, `finalizeRewardedAdCallback` | `api/v1/episodes/[episodeId]/rewarded/route.ts`, `api/v1/rewarded-ad-attempts/[customData]/route.ts`, `api/webhooks/admob/ssv/route.ts` | RPCs `create_rewarded_ad_attempt`, `get_rewarded_ad_attempt_status`, `finalize_rewarded_ad_callback` |
| `src/lib/chai.ts` | Creator "Chai" tipping (coins → creator split) | `getShortFilmChaiDetails`, `submitShortFilmChaiTip` | `api/v1/short-films/[slug]/chai/route.ts` | RPCs `get_short_film_chai_details`, `submit_short_film_chai_tip` |
| `src/lib/catalog.ts` | Content catalog → maps DB rows to runtime `Episode`/`ShortFilm` including monetization flags | `getPublishedSeries`, `getSeriesBySlug`, `getShortFilmBySlug`, `getEpisodeBySeriesSlugAndNumber`, `mapEpisode`, `mapShortFilm` | `watch/page`, `series/page`, `purchase/page`, `account/page`, `api/v1/catalog`, `api/v1/series/[slug]`, `api/v1/short-films/[slug]` | `episodes`, `series`, `short_films`, `classification.ts` |
| `src/lib/playback.ts` | Playback authorization (entitlement + parental + Mux signing) | `authorizeMuxPlayback`, `authorizeMuxPreviewPlayback`, `provisionEpisodePreviewMediaAsset` | `api/v1/playback/route.ts`, `api/v1/playback/preview/route.ts` | `entitlements.canUserWatchEpisode`, `resolvePlaybackMaxResolution`, `mux`, `parental-controls` |
| `src/lib/classification.ts` | Content rating → parental/age gating (not price, but gates access) | `normalizeContentRating`, `resolveContentClassification`, `getParentalLockRequired`, `getAgeVerificationRequired` | `catalog.ts`, `playback.ts` | — |
| `src/lib/cms/constants.ts` | CMS-side **labeling** of which access methods apply to an episode (coin/rewarded/plus) | `describeEpisodeAccessMethods` (inferred) | CMS episode UI | `episodes` row fields |
| `src/lib/cms/episodes.ts` | CMS write path for monetization columns | episode upsert writing `is_free`, `coin_price`, `coin_unlock_enabled`, `rewarded_unlock_enabled`, `plus_access` | admin CMS | `episodes` |
| `src/lib/account.ts` | Account-level summaries (wallet/subscription) | `getWalletSummary`, `getSubscriptionSummary`, `getSafeDisplayName` | `account/page.tsx`, `me/route.ts` | `entitlements` |
| `src/lib/api/auth.ts` | Request auth (bearer/cookie) → `{supabase, user}` | `getApiAuth` | all `api/v1/*` + webhook routes | Supabase auth |
| `src/lib/api/perf.ts` | **Latency** perf collector (NOT business analytics) | `timePerf`, `PerfCollector`, `runWithPerf` | throughout | — |
| `src/types/database.ts` | Generated Supabase types (canonical schema reference) | `Database` | everywhere | — |

### 1.2 API / route handlers

| Path | Purpose | Monetization relevance |
|------|---------|------------------------|
| `src/app/api/v1/episodes/[episodeId]/purchase/route.ts` | POST → coin purchase of an episode | **Primary purchase endpoint** (calls `purchaseEpisodeWithCoins`) |
| `src/app/api/v1/episodes/[episodeId]/rewarded/route.ts` | POST → start rewarded-ad attempt | Creates `rewarded_ad_attempts` (pending) |
| `src/app/api/v1/rewarded-ad-attempts/[customData]/route.ts` | GET → attempt status | Reads attempt status |
| `src/app/api/v1/wallet/route.ts` | GET → wallet balance, coin products, transactions, top-up history | Surfaces pricing catalog + payment history |
| `src/app/api/v1/short-films/[slug]/chai/route.ts` | POST → chai tip | Creator monetization (coins) |
| `src/app/api/v1/billing/google-play/route.ts` | POST → Google Play purchase/restore **STUB** | Returns `EXTERNALLY_BLOCKED_NOT_CONFIGURED` / `not_configured` — **not wired to any real verification** |
| `src/app/api/webhooks/admob/ssv/route.ts` | POST → AdMob SSV callback | **Real provider verification**; finalizes rewarded entitlement |
| `src/app/api/webhooks/mux/route.ts` | POST → Mux asset events | Video delivery (not payment) |
| `src/app/api/v1/playback/route.ts`, `.../preview/route.ts` | Playback auth | Enforces entitlements (access gate) |
| `src/app/api/v1/me/route.ts` | Current user wallet + subscription summary | Surfaces entitlement state |
| `src/app/api/v1/catalog/route.ts`, `series/[slug]/route.ts`, `short-films/[slug]/route.ts` | Content + monetization flags | Returns `isFree`, `coinPrice`, `plusAccess`, `rewardedUnlockEnabled` to clients |

### 1.3 UI / server-component surfaces

| Path | Purpose | Monetization relevance |
|------|---------|------------------------|
| `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx` | Decides LockedEpisode vs VerticalPlayer via `canUserWatchEpisode` | **Primary access decision (UI side)** |
| `src/components/player/LockedEpisode.tsx` | Paywall UI (Unlock / View plans / Watch-ad — ad button disabled) | The paywall surface |
| `src/app/purchase/[seriesSlug]/[episodeNumber]/page.tsx` | Purchase/checkout page (coin price, balance, Buy) | **Offer + price display + purchase action** |
| `src/app/purchase/actions.ts` | Server action `buyEpisodeWithCoins` | Invokes `purchaseEpisodeWithCoins`, redirects with status |
| `src/app/plans/page.tsx` | Subscription plans page — **"Coming soon", disabled** | Subscription surface (stubbed) |
| `src/app/wallet/page.tsx` | Wallet: balance, coin packs, history — **"Coming soon", disabled** | Top-up catalog surface (stubbed) |
| `src/app/account/page.tsx` | Account: wallet + plan summary | Entitlement display |
| `src/components/player/VerticalPlayer.tsx`, `EpisodeComplete.tsx` | Player + post-episode upsell | Minimal monetization (next-episode, ad state) |

### 1.4 Database (Postgres, via Supabase migrations)

Monetization tables (full field lists in §5): `wallets`, `coin_products`, `coin_transactions`, `payment_orders`, `payment_provider_products`, `google_play_purchases`, `episode_entitlements`, `rewarded_ad_attempts`, `subscriptions`, `chai_tip_requests`, `chai_ledger_entries`, `chai_allowed_coin_amounts`, `short_film_chai_destinations`, `creator_accounting_destinations`, `episodes` (monetization columns), `short_films` (chai_enabled), `profiles`, `parental_sessions`, `guest_parental_controls`.

Key RPC functions (defined in `supabase/migrations`): `purchase_episode_with_coins` (006), `create_rewarded_ad_attempt` / `get_rewarded_ad_attempt_status` / `finalize_rewarded_ad_callback` (011), `get_short_film_chai_details` / `submit_short_film_chai_tip` (010), `credit_verified_coin_purchase` (baseline + 008/allow_verified_inactive_coin_fulfillment — **defined but never called**), `apply_welcome_coin_grant` / `handle_new_user` (018).

---

## 2. CURRENT MONETIZATION ENTRY POINT

The monetization decision is **server-authoritative** and lives in two layers:

1. **Access gate** — `entitlements.ts`
   - `canUserWatchEpisode()` (`src/lib/entitlements.ts:264`) returns boolean. Order of checks:
     1. `episode.isFree` → free (`entitlements.ts:269`)
     2. no `userId` → locked (`entitlements.ts:273`)
     3. existing valid `episode_entitlements` (purchase/rewarded/promo/admin) → owned (`entitlements.ts:279`)
     4. `episode.plusAccess === true` **and** `hasActiveSubscription()` → subscription (`entitlements.ts:285`)
     5. otherwise locked.
   - `getEpisodeAccessStates()` (`entitlements.ts:207`) computes `free|owned|subscription|locked` per episode for catalog/series pages.
   - `hasActiveSubscription()` (`entitlements.ts:112`) checks `subscriptions` rows with `status='active'` and valid `starts_at`/`ends_at` windows.
   - `resolvePlaybackMaxResolution()` (`entitlements.ts:134`) uses subscription state to grant 1440p (Plus) vs 720p.

2. **UI entry path** (episode watch):
   - `watch/[seriesSlug]/[episodeNumber]/page.tsx:47` → `canUserWatchEpisode({userId, episode, supabase})`
   - if `false` → renders `LockedEpisode` paywall (`watch/.../page.tsx:53`).
   - if `true` → `VerticalPlayer`.

3. **Checkout entry path** (episode unlock):
   - `purchase/[seriesSlug]/[episodeNumber]/page.tsx:62` redirects free episodes to watch.
   - otherwise loads `wallet`, `hasActiveSubscription`, `userOwnsEpisode` (`purchase/.../page.tsx:70`) and computes `canBuyWithCoins` (client-ish logic, `purchase/.../page.tsx:79`).
   - Submit → `purchase/actions.ts:buyEpisodeWithCoins` → `purchaseEpisodeWithCoins(episodeId)` → RPC.

4. **Price/offer selection:** price is **not** "chosen" — it is the episode's stored `coin_price` (`catalog.ts:102` → `Episode.coinPrice`). The offer shown is derived purely from episode flags (`is_free`, `coin_unlock_enabled`, `plus_access`, `rewarded_unlock_enabled`, `rewarded_access_mode`) + user state (balance, subscription, ownership).

5. **When shown:** paywall shown whenever `canUserWatchEpisode` is false and episode is not free. Offer (purchase page) shown when user navigates to `/purchase/...` or taps "Unlock episode".

**Call path summary (UI → decision):**
`watch/.../page.tsx` → `canUserWatchEpisode()` → `entitlements.ts` → Supabase (`wallets`, `subscriptions`, `episode_entitlements`, `episodes`) → boolean → LockedEpisode (paywall) OR player.
`purchase/.../page.tsx` → `getEpisodeBySeriesSlugAndNumber` (catalog) → episode flags → price display → `buyEpisodeWithCoins` → `purchaseEpisodeWithCoins` RPC → DB writes.

---

## 3. CURRENT MONETIZATION ACTION SPACE

Only what exists in code (verified):

| Action | Status | Where |
|--------|--------|-------|
| **free** | Active | `episodes.is_free`; `entitlements.ts:269` |
| **fixed price (coins)** | Active (requires pre-existing coins) | `episodes.coin_price` + `purchase_episode_with_coins` RPC |
| **unlock / entitlement (per-episode)** | Active | `episode_entitlements` via purchase or rewarded |
| **rewarded ad unlock** | Active (AdMob SSV verified) | `rewarded_ad_attempts` + `finalize_rewarded_ad_callback` |
| **subscription / Plus** | Data model + entitlement check active; **no purchase/checkout path** | `subscriptions` table, `hasActiveSubscription`, `plans/page.tsx` (disabled) |
| **credits / coins** | Active (internal currency) | `wallets.coin_balance`, `coin_transactions`; seeded by welcome grant (100 coins) |
| **coin packs / top-up checkout** | **Catalog only — no checkout** | `coin_products` (active), `payment_orders`; `wallet/page.tsx` "Coming soon"; `google-play/route.ts` stubbed |
| **creator tip (Chai)** | Active | `chai_tip_requests`, `chai_ledger_entries`, `submit_short_film_chai_tip` |
| **ad-supported preview** | Active (locked preview clip) | `episodes.locked_preview_seconds` + `provisionEpisodePreviewMediaAsset` |
| **premium (resolution tiers)** | Active (derived from subscription) | `resolvePlaybackMaxResolution` 720p/1440p |
| **dynamic price** | **Not present** | — |
| **real-money payment provider (Stripe/etc.)** | **Not present** | Only AdMob (ads) + Mux (video) are real third parties |
| **refund / cancellation** | Schema + enums present; **no code path writes them** | `payment_orders.status` (refunded/cancelled), `coin_transactions.transaction_type` (refund/chai_refund) — unused by app |

**Price definition & handling:**
- `episodes.coin_price` (integer coins) — **DB-configured, CMS-editable** (`cms/episodes.ts:216`). Hard rule: `coin_unlock_enabled` requires `coin_price > 0` (migration 006 constraint).
- `coin_products.coin_amount` (coins per pack) — **DB/CMS-configured**, surfaced via `getActiveCoinProducts`. No real-money price currently shown to users.
- `payment_orders.amount_minor` + `currency` — real-money fields **present but unused** (no top-up checkout).
- **Currency handling:** coins are virtual; no fiat currency conversion in app. `Intl.DateTimeFormat("en-IN", …)` is used only for **date** display (`plans/page.tsx:13`, `wallet/page.tsx:17`). No currency localization.
- **Hard-coded values:** welcome grant = 100 coins (`migrations/018:30`); locked preview clamp 0–3s (`migrations/006:21`); rewarded attempt TTL 15 min (`migrations/011:156`); AdMob provider fixed to `'google_admob'` (`migrations/011:7`).
- **CMS-configured:** yes — episode monetization flags and coin products are CMS/admin-managed, not client-hardcoded (per `AGENTS.md` rule: treat CONFIG as backend/CMS-controlled).

---

## 4. PAYMENT / BILLING PROVIDERS

| Provider | Integration files | Checkout init | Webhook | Verification | Success handling | Failure | Refund |
|----------|-------------------|---------------|---------|--------------|------------------|---------|--------|
| **AdMob (rewarded ads)** | `api/webhooks/admob/ssv/route.ts`, `rewarded-ads.ts`, `migrations/011` | `create_rewarded_ad_attempt` (route `episodes/[id]/rewarded`) | `POST /api/webhooks/admob/ssv` | RSA signature verify against gstatic verifier keys (`admob/ssv:88-138`), `ADMOB_REWARDED_AD_UNIT_ID` check | `finalize_rewarded_ad_callback` → status `granted`, `verified_at`, grant `episode_entitlements` (source `rewarded_ad`) | invalid sig → 403; missing `transaction_id` → 400; expired/failed attempt statuses | n/a (no refund concept) |
| **Google Play Billing** | `api/v1/billing/google-play/route.ts`, `migrations/008/google_play_payment_foundation.sql` (`google_play_purchases`, `payment_provider_products`), RPC `credit_verified_coin_purchase` | Route exists but **returns `EXTERNALLY_BLOCKED_NOT_CONFIGURED`** — no real init | None implemented | `google_play_purchases` schema designed for HMAC+fingerprint+encrypted token + verification state machine (`consume_pending`/retry) | `credit_verified_coin_purchase` RPC **defined but never called** | n/a | `payment_orders.status='refunded'` enum exists; no code |
| **Apple Store / Web** | `payment_orders.provider` enum (`apple_store`, `web`, `admin_test`); `credit_verified_coin_purchase` provider param | Foundation only (enums/tables) | None | None | None wired | — | — |
| **Mux** | `lib/mux`, `api/webhooks/mux/route.ts` | n/a (video) | `POST /api/webhooks/mux` (signature-verified) | `verifyMuxWebhookSignature` (`MUX_WEBHOOK_SIGNING_SECRET`) | Asset state updates | invalid sig → 401 | n/a |
| **Stripe / Razorpay / RevenueCat / Paddle** | **None** | — | — | — | — | — | — |

**Conclusion:** The only *executing* external billing integration is **AdMob rewarded-ad SSV**. Google Play / Apple / Web top-up is a **foundation only** (schema + stub route + unused RPC). No fiat payment gateway is connected; coins currently enter wallets only via the **welcome grant** (100) and any admin/test path.

---

## 5. DATABASE / PERSISTENCE

(Field lists from `src/types/database.ts`; relationships verified.)

| Table | Key fields | Relationships | Timestamps | Correlation IDs |
|-------|-----------|---------------|------------|-----------------|
| `wallets` | `user_id` (PK), `coin_balance` | 1:1 `users` | `created_at`, `updated_at` | user_id |
| `coin_products` | `code` (PK), `coin_amount`, `display_name`, `active`, `sort_order` | referenced by `payment_orders.product_code` | `created_at`, `updated_at` | product code |
| `coin_transactions` | `id`, `user_id`, `amount`, `transaction_type` (credit/episode_purchase/refund/promo/chai_tip/chai_refund/chai_adjustment), `episode_id`, `payment_order_id`, `short_film_id`, `chai_tip_request_id`, `chai_ledger_entry_id`, `related_transaction_id`, `reference` | → `episodes`, `payment_orders`, `short_films`, `chai_tip_requests`, `chai_ledger_entries`, `coin_transactions` (self), `users` | `created_at` | id; links user+episode+payment+chai |
| `payment_orders` | `id`, `user_id`, `provider`, `provider_order_id`, `provider_transaction_id`, `product_code`, `coin_amount`, `amount_minor`, `currency`, `status` (pending/completed/failed/refunded/cancelled), `verification_status`, `verified_at`, `completed_at` | → `coin_products.code`, `users` | `created_at`, `updated_at`, `verified_at`, `completed_at` | id; `provider_transaction_id` |
| `payment_provider_products` | `id`, `provider`, `provider_product_id`, `product_code`, `is_active` | → `coin_products.code` | `created_at`, `updated_at` | provider product mapping |
| `google_play_purchases` | `id`, `user_id`, `purchase_token_hash` (HMAC), `purchase_token_ciphertext`, `google_product_id`, `product_code`, `payment_order_id`, `google_purchase_state`, `processing_state` (pending/verified/consume_pending/consumed/cancelled), `credited_at`, `consume_attempt_count`, … | → `coin_products`, `payment_orders`, `users` | many (created/verified/credited/consume/retry) | id; `payment_order_id` |
| `episode_entitlements` | `id`, `user_id`, `episode_id`, `source` (purchase/rewarded_ad/promo/admin), `expires_at` | → `episodes`, `users` | `created_at` | id; links user+episode+source |
| `rewarded_ad_attempts` | `id`, `user_id`, `episode_id`, `provider`, `custom_data` (unique), `rewarded_access_mode_snapshot`, `status` (pending/granted/expired/failed/unsupported_pending_policy), `expires_at`, `verified_at`, `provider_transaction_id` | → `episodes`, `users` | `created_at`, `updated_at`, `verified_at` | `custom_data` (client-ad correlation); `provider_transaction_id` |
| `subscriptions` | `id`, `user_id`, `status` (inactive/active/expired/cancelled), `plan_code`, `starts_at`, `ends_at` | → `users` | `created_at`, `updated_at` | id; user_id; `plan_code` |
| `chai_tip_requests` | `id`, `viewer_user_id`, `short_film_id`, `creator_destination_id`, `coin_amount`, `idempotency_key`, `status`, `remaining_balance`, `coin_transaction_id` | → `users`, `short_films`, `creator_accounting_destinations`, `coin_transactions` | `created_at`, `updated_at` | id; `idempotency_key` |
| `chai_ledger_entries` | `id`, `chai_tip_request_id`, `viewer_user_id`, `short_film_id`, `creator_destination_id`, `viewer_coin_transaction_id`, `coin_amount`, `entry_type` (credit/reversal/adjustment), `status` (posted/reversed/adjusted/voided), `original_tip_entry_id`, `related_entry_id` | → `chai_tip_requests`, `users`, `short_films`, `creator_accounting_destinations`, `coin_transactions` | `created_at`, `updated_at` | id; links tip→ledger→transaction |
| `chai_allowed_coin_amounts` | `id`, `coin_amount`, `enabled`, `sort_order` | — | `created_at`, `updated_at` | — |
| `short_film_chai_destinations` | `short_film_id` (PK), `creator_destination_id` | → `short_films`, `creator_accounting_destinations` | `created_at`, `updated_at` | short_film_id |
| `creator_accounting_destinations` | `id`, `display_name`, `accounting_reference`, `is_active` | referenced by chai tables | `created_at`, `updated_at` | id |
| `episodes` (monetization cols) | `is_free`, `coin_price`, `coin_unlock_enabled`, `rewarded_unlock_enabled`, `rewarded_access_mode`, `plus_access`, `locked_preview_seconds` | → `series`, `media_assets` | `created_at`, `updated_at`, `published_at` | `id`; `series_id` |
| `short_films` | `chai_enabled`, `status`, `publish_at`, `media_asset_id` | — | `created_at`, `updated_at` | `id`, `slug` |
| `profiles` | `id`(=user), `display_name` | → `users` | `created_at`, `updated_at` | user_id |
| `parental_sessions` / `guest_parental_controls` | token/session identity (not price) | → `users` | `issued_at`, `expires_at`, `revoked_at` | token_hash / credential_hash |

**No sensitive user PII values are reproduced here.** All above are structural.

---

## 6. USER AND SESSION IDENTITY

| Concept | Identifier | Stable / correlatable? |
|---------|-----------|------------------------|
| Authenticated user | `auth.users.id` (Supabase) — exposed as `user.id` from `getApiAuth` / `supabase.auth.getUser()` | ✅ Stable primary key across all monetization tables (`user_id`) |
| Anonymous / guest user | No monetization allowed for guests (purchases require auth). Parental guests identified by `guest_parental_controls.credential_hash` + `parental_sessions.token_hash` | Guest id is parental-only, not used for purchases |
| Session | Supabase auth session (cookie/bearer). No separate "monetization session" table. Rewarded "session" mode uses `rewarded_ad_attempts.expires_at` (15 min) | ❌ No session id links offers→purchases |
| Device | **Not captured** anywhere in monetization flow | ❌ |
| Content / episode | `episodes.id` (UUID) + human key `series.slug` + `episode_number` | ✅ Stable; `episode_entitlements.episode_id`, `coin_transactions.episode_id` |
| Content / short film | `short_films.id` + `slug` | ✅ |
| Purchase (episode coin) | `coin_transactions.id` (type `episode_purchase`) + `episode_entitlements.id` | ✅ links user+episode |
| Purchase (top-up) | `payment_orders.id` + `provider_transaction_id` | ✅ but unused currently |
| Rewarded attempt | `rewarded_ad_attempts.custom_data` (unique hex) + `provider_transaction_id` | ✅ correlates client ad SDK ↔ server |
| Subscription | `subscriptions.id` + `plan_code` | ✅ |
| Chai tip | `chai_tip_requests.id` + `idempotency_key` | ✅ |

**Stable correlation keys for future outcome analysis:** `user_id`, `episode_id`, `short_film_id`, `payment_orders.id`, `rewarded_ad_attempts.custom_data`, `coin_transactions.id`, `subscriptions.id`. Note: there is **no offer_id / price_point_id** linking a shown offer to a later purchase (see §12).

---

## 7. CURRENT EVENTS / ANALYTICS

**Finding: There is NO business/analytics event system in the codebase.** Grep for `analytics|trackEvent|logEvent|posthog|segment|amplitude|plausible|gtag|mixpanel|telemetry|emitEvent` across `src` returns **zero matches**. The only instrumentation is `timePerf` / `PerfCollector` (`lib/api/perf.ts`), which records **server latency markers** (e.g. `wallet_q`, `subscription_q`, `mux_sign`, `content_lookup`) — not monetization outcomes.

| Event name | Source file | Fields | Timestamp | Destination |
|-----------|-------------|--------|-----------|-------------|
| *(none — offer shown)* | — | — | — | — |
| *(none — paywall shown)* | — | — | — | — |
| *(none — checkout started)* | — | — | — | — |
| *(none — purchase completed)* | — | — | — | — |
| *(none — purchase failed)* | — | — | — | — |
| *(none — subscription started/renewed/cancelled)* | — | — | — | — |
| *(none — refund)* | — | — | — | — |
| *(none — user returned / churn / retention)* | — | — | — | — |
| Perf markers only | `lib/api/perf.ts` (+ call sites in `entitlements.ts`, `playback.ts`, `catalog.ts`) | `marker`, `durationMs` | `performance.now()` | in-memory response headers / collector (not persisted) |

Implication: **0nya currently has zero observable monetization signals.** Every event in §11 must be newly emitted.

---

## 8. PURCHASE LIFECYCLE

### 8.1 Successful coin purchase (episode) — end to end
1. **User action:** taps "Buy with coins" → `purchase/[…]/page.tsx` form → `purchase/actions.ts:buyEpisodeWithCoins`.
2. **Server action:** `purchaseEpisodeWithCoins(episodeId)` (`purchases.ts:43`).
3. **RPC:** `purchase_episode_with_coins(p_episode_id)` (`migrations/006:41`):
   - auth check (`auth.uid()`), episode published check, free/owned/subscription short-circuits.
   - locks wallet row `for update` (`006:145`); re-checks ownership; checks `coin_balance >= coin_price`.
   - **DB updates:** `wallets.coin_balance -= coin_price`; insert `coin_transactions` (type `episode_purchase`, `episode_id`, amount `-coin_price`); upsert `episode_entitlements` (`source='purchase'`, `expires_at=null`) (`006:178-213`).
   - returns `purchase_success` + `remaining_balance`.
4. **Entitlement/access:** `episode_entitlements` row now grants `canUserWatchEpisode`=true.
5. **Redirect:** `purchase/actions.ts` → `/purchase/...?purchase=purchase_success` → user can watch.
6. **Analytics:** **none.**

### 8.2 Failed coin purchase (insufficient balance)
- RPC returns `insufficient_balance` (`006:174`); no DB write; redirect `?purchase=insufficient_balance`. **No event.**

### 8.3 Rewarded-ad unlock (success)
1. Client calls `POST /api/v1/episodes/[id]/rewarded` → `createRewardedAdAttempt` → RPC `create_rewarded_ad_attempt` inserts `rewarded_ad_attempts` (`status='pending'`, `custom_data`, `expires_at=now+15m`) (`011:138-164`). Returns `custom_data` to client ad SDK.
2. Ad SDK shows ad; AdMob calls `POST /api/webhooks/admob/ssv` → signature verified → `finalizeRewardedAdCallback(custom_data, provider_transaction_id)` → RPC `finalize_rewarded_ad_callback` (`011:213`): locks attempt, sets `status='granted'`, `verified_at`, `provider_transaction_id`; grants/updates `episode_entitlements` (`source='rewarded_ad'`) (`011:301-338`).
3. Entitlement now active → watch allowed. **No business event emitted** (only SSV HTTP 204).

### 8.4 Rewarded-ad failure
- Expired (`expires_at <= now()`), `failed`, `unsupported_pending_policy` (session mode disabled), `transaction_conflict` (duplicate `provider_transaction_id`) statuses handled in `finalize_rewarded_ad_callback` (`011:253-298`). No entitlement granted. **No event.**

### 8.5 Subscription (start / renew / cancel)
- **No purchase/checkout path exists.** `subscriptions` rows are only read (`getUserSubscription`/`hasActiveSubscription`). Nothing in app code inserts/updates a subscription from a payment. Plans page disabled; Google Play route stubbed. Therefore start/renew/cancel lifecycles are **not implemented end-to-end**.

### 8.6 Refund
- `payment_orders.status='refunded'` and `coin_transactions.transaction_type='refund'`/`'chai_refund'` enums exist, but **no code path writes them**. No refund lifecycle executes.

---

## 9. CURRENT MONETIZATION DECISION INPUTS

Inputs used by `canUserWatchEpisode` / `purchase_episode_with_coins` **before** the decision:

| Field | Source | Timestamp available? | Exists before decision? |
|-------|--------|----------------------|--------------------------|
| Authenticated user id | `supabase.auth.getUser()` | auth `created_at` (not passed in) | ✅ (or null for guest) |
| Episode `is_free` | `episodes` (DB/CMS) | `updated_at` | ✅ |
| Episode `coin_unlock_enabled` / `coin_price` | `episodes` | `updated_at` | ✅ |
| Episode `plus_access` | `episodes` | `updated_at` | ✅ |
| Episode `rewarded_unlock_enabled` / `rewarded_access_mode` | `episodes` | `updated_at` | ✅ |
| Episode `locked_preview_seconds` | `episodes` | `updated_at` | ✅ |
| Wallet `coin_balance` | `wallets` | `updated_at` | ✅ (fetched in RPC) |
| Subscription `status`/`starts_at`/`ends_at` | `subscriptions` | `updated_at` | ✅ |
| Existing `episode_entitlements` | `episode_entitlements` | `created_at` | ✅ |
| Parental PIN / restriction threshold | `user_parental_controls` / `guest_parental_controls` | `updated_at` | ✅ (for gating, not price) |
| Content rating / descriptors | `episodes`/`series`/`short_films` | `updated_at` | ✅ (classification, not price) |

**Inputs NOT used (absent):** traffic source / UTM, geography / billing region (present only on `google_play_purchases.billing_region_code`, unused), device, engagement, previous purchase history (besides ownership), session, A/B or offer variant.

**Future-information / data-leakage risks:**
- The purchase page computes `canBuyWithCoins` client-side from `wallet.coin_balance >= coinPrice` (`purchase/.../page.tsx:78-85`) — this duplicates server logic and reveals to the client whether the user can afford the item. Low risk (balance already known to user) but logic duplication (see §12).
- No leakage of secrets observed; `google_play_purchases` tokens are hashed/encrypted at rest by design.
- No monetization decision depends on data that arrives *after* the decision, so no temporal leakage — but there is also **no recording** of *which* inputs produced a decision (no decision log), limiting future attribution.

---

## 10. CURRENT OUTCOME DATA

What the system can observe **after** a monetization action:

| Outcome | Stored where | Available when |
|---------|--------------|----------------|
| Revenue (coins) | `coin_transactions.amount` (credit on top-up via `credit_verified_coin_purchase` — unused), `episode_purchase` debits | only if top-up path active (currently not) |
| Processor fees / cost | **Not stored anywhere** | never |
| Fiat amount | `payment_orders.amount_minor` + `currency` | only if top-up path active (currently not) |
| Conversion (view→purchase) | **Not stored** (no offer-impression log) | never |
| Failure | RPC status strings (`insufficient_balance`, `purchase_failed`, rewarded `failed`/`expired`) returned to client only; **not persisted as an event** | at request time only |
| Refund | `payment_orders.status='refunded'`, `coin_transactions` refund types — **no writer** | never (schema only) |
| Subscription status | `subscriptions.status` | readable now (but rows never created by app) |
| Cancellation | `subscriptions.status='cancelled'` enum — **no writer** | never |
| Return / retention / churn | **Not stored** (no return/visit event; `watch_progress` tracks viewing only) | never |
| Coin balance / history | `wallets`, `coin_transactions` | real-time |
| Creator split (Chai) | `chai_ledger_entries` (posted/reversed/adjusted/voided) | real-time on tip |
| Entitlement granted | `episode_entitlements` | real-time |

**Net:** the only durable post-action monetization facts today are coin balances/transactions, entitlements, rewarded-ad attempt states, chai ledger, and (read-only) subscription status. **No revenue/cost/conversion/refund/cancellation/churn facts are captured.**

---

## 11. INTEGRATION POINTS FOR 0nya (proposed, non-modifying)

For each canonical event, the safest existing hook (no logic change needed; add a fire-and-forget emit alongside the existing call):

| Event | Best source file / function | Why | Available fields | Timestamp | User/session/content IDs there |
|-------|------------------------------|-----|------------------|-----------|-------------------------------|
| `MONETIZATION_OPPORTUNITY` | `src/lib/entitlements.ts:canUserWatchEpisode` (when returns false) **and** `getEpisodeAccessStates` (`entitlements.ts:207`) | Single decision point for "this content is monetizable for this user" | episode flags, access kind, user auth state | `Date.now()` at call | `userId`, `episode.id`, `series.slug` |
| `OFFER_SHOWN` | `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx:53` (render `LockedEpisode`) + `purchase/[…]/page.tsx` render | Exact UI moment the paywall/price is displayed | `coinPrice`, `plusAccess`, `rewardedUnlockEnabled`, `hasSubscription`, `ownsEpisode`, balance | request time | `userId`, `episode.id`, `series.slug` |
| `PURCHASE_STARTED` | `src/app/api/v1/episodes/[episodeId]/purchase/route.ts:25` (before `purchaseEpisodeWithCoins`) **and** `purchase/actions.ts:22` | Captures intent before the atomic RPC | `episodeId`, current balance | request time | `auth.user.id`, `episode.id` |
| `PURCHASE_COMPLETED` | `src/app/api/v1/episodes/[episodeId]/purchase/route.ts:27` (on `status==='purchase_success'`) | Mirrors RPC success | `remainingBalance`, `episodeId` | request time | `auth.user.id`, `episode.id` |
| `PURCHASE_FAILED` | same route (on `status` ∈ failed/insufficient/already_owned/etc.) | Mirrors RPC failure | `status` | request time | `auth.user.id`, `episode.id` |
| `SUBSCRIPTION_STARTED` | `src/lib/entitlements.ts:getUserSubscription` insert site — **currently none**; propose hook where a verified subscription would be written (future Google Play / web verification, e.g. `credit_verified_coin_purchase` or a new subscription RPC) | No current writer; emit when a subscription row is created/verified | `plan_code`, `starts_at`, `ends_at` | write time | `user_id` |
| `SUBSCRIPTION_RENEWED` | same as above (on `ends_at` extension) | Subscription renewal has no code path today | `plan_code`, new `ends_at` | write time | `user_id` |
| `SUBSCRIPTION_CANCELLED` | where `subscriptions.status` would be set to `cancelled` (none today) | Cancellation path absent; emit when implemented | `plan_code`, reason | write time | `user_id` |
| `REFUND_COMPLETED` | where `payment_orders.status='refunded'` / `coin_transactions` refund would be written (none today) | Refund writer absent; emit when implemented | `payment_order_id`, `amount`, `coin_amount` | write time | `user_id`, `payment_order_id` |
| `REWARD_STARTED` (maps to rewarded attempt) | `src/app/api/v1/episodes/[episodeId]/rewarded/route.ts:21` (after `createRewardedAdAttempt`) — treat as `PURCHASE_STARTED` for rewarded | Intent to earn entitlement via ad | `custom_data`, `episodeId` | request time | `auth.user.id`, `episode.id`, `custom_data` |
| `REWARD_COMPLETED` (maps to rewarded granted) | `src/app/api/webhooks/admob/ssv/route.ts:193` (after `finalizeRewardedAdCallback` success) — treat as `PURCHASE_COMPLETED` | Verified provider callback = realized entitlement | `custom_data`, `provider_transaction_id` | webhook time | `user_id` (via attempt), `episode.id`, `custom_data` |
| Chai tip outcomes | `src/app/api/v1/short-films/[slug]/chai/route.ts:38` (success/fail) | Mirrors `submitShortFilmChaiTip` result | `coinAmount`, `shortFilmSlug`, `idempotencyKey` | request time | `auth.user.id`, `short_film.id` |

All hooks already have `user.id` (or null), `episode.id`/`short_film.id`, and a natural timestamp; the only missing key is an **offer/correlation id** (see §12) — recommended to generate one at `OFFER_SHOWN`/`MONETIZATION_OPPORTUNITY` and thread it into subsequent events via the existing request/session scope.

---

## 12. RISKS / GAPS

1. **No event tracking at all** — zero monetization analytics (§7). Every §11 event is absent.
2. **No timestamps linking offer → purchase** — there is no `offer_id`/`impression_id`/`price_point_id` on `episode_entitlements`, `coin_transactions`, or `payment_orders`. A purchase cannot be attributed to the specific offer/price surfaced.
3. **Missing correlation IDs** — no session-scoped correlation id; rewarded flow uses `custom_data` (good) but episode purchases have no client→server correlation token.
4. **Payment events cannot be associated with an offer** — `payment_orders` carries `product_code`+`coin_amount` but no episode/offer reference; `coin_transactions.episode_purchase` has `episode_id` but no offer/price-point id. Top-up (pack) purchases are not linked to the episode they may later unlock.
5. **Price logic duplicated in several locations** — `purchase/[…]/page.tsx:78-85` recomputes `balance >= coinPrice` (client-visible) duplicating the RPC/entitlement logic; `cms/constants.ts` re-labels access methods; `entitlements.ts` and `catalog.ts` both encode the free/owned/subscription/locked rules. Risk of drift.
6. **Monetization logic mixed with UI** — `LockedEpisode.tsx`, `purchase/page.tsx`, `wallet/page.tsx`, `plans/page.tsx` embed pricing/entitlement display and affordance logic; `watch/page.tsx` embeds the access decision.
7. **Monetization logic mixed with CMS** — `cms/episodes.ts` writes monetization columns; `cms/constants.ts` describes access methods; pricing is CMS-controlled (acceptable per `AGENTS.md`, but logic lives in CMS module).
8. **Missing revenue/cost fields** — no processor fee column; fiat `amount_minor`/`currency` present but unused; no revenue aggregation table.
9. **Missing delayed outcome tracking** — no renewal/cancel/refund/churn writers; `subscriptions` and `google_play_purchases` state machines are never advanced by app code (Google Play route is a stub; `credit_verified_coin_purchase` never called).
10. **Stubbed/uncalled integrations** — `google-play/route.ts` returns `EXTERNALLY_BLOCKED_NOT_CONFIGURED`; `credit_verified_coin_purchase` RPC defined but never invoked; coin packs checkout absent. Risk: apparent "monetization" surface that does nothing.
11. **Race conditions** — largely handled: `purchase_episode_with_coins` uses `select … for update` on wallet (`006:145`); `finalize_rewarded_ad_callback` locks attempt + entitlement and rejects duplicate `provider_transaction_id` (`011:277-299`); chai tip uses `idempotency_key`. **Residual risk:** no idempotency/dedup between an `OFFER_SHOWN` emit and a later `PURCHASE_COMPLETED` (would need the correlation id from gap #2).
12. **No subscription purchase path** — Plus/1440p entitlement is enforced, but users cannot actually subscribe; plans page disabled. Monetization is effectively **coins (grant/rewarded) + chai tips** only.
13. **Guest monetization impossible** — all purchases require auth; anonymous users always hit the paywall with only "log in" affordance.
14. **No geography/device/traffic inputs** — cannot later analyze price sensitivity by region/device/source (may be intentional for launch).

---

## 13. RECOMMENDED MINIMAL OBSERVATION BRIDGE

Smallest safe future change (NOT implemented here) to enable 0nya shadow decisions without altering behavior:

1. **Add one side-effect-free emitter** `emitMonetizationEvent(event: CanonicalEvent)` (e.g. in `src/lib/monetization-events.ts`) that:
   - is **fire-and-forget / async, non-blocking, never throws into the caller** (wrap in try/catch + `void`);
   - serializes `CanonicalEvent` (`eventType`, `eventId`, `correlationId`, `userId`, `episodeId`/`shortFilmId`, `offerId`, `price`, `currency`, `status`, `timestamp`, `source`);
   - ships to a durable sink (edge function / queue / Supabase table `monetization_events`) **out of the request critical path**.
2. **Inject a `correlationId`** at the earliest monetization touch (e.g. `OFFER_SHOWN`/`MONETIZATION_OPPORTUNITY`) and thread it via request scope / cookie so later `PURCHASE_*` events share it.
3. **Call sites:** add a single `void emitMonetizationEvent(...)` line next to each existing decision/result in §11 (purchase route, rewarded route+webhook, chai route, entitlement decision, subscription/refund writers when built). The **existing monetization still executes first**; the emit is purely observational.
4. **Shadow decision:** 0nya consumes the `CanonicalEvent` stream, computes its own decision, and (later, if desired) writes back an `OutcomeEnvelope` — but the app's own flow is unchanged, so this is strictly additive.
5. **Safety:** emitter must be a no-op when unconfigured (no sink URL / feature flag off) so it cannot break checkout; it must never read secrets or alter DB writes.

No migrations, no provider changes, no UI rewrites required for the bridge itself — only additive emit calls + one new table/queue.

---

## 14. APPENDIX — FILE INVENTORY

| PATH | ROLE | MONETIZATION RELEVANCE | SAFE INTEGRATION POINT? |
|------|------|------------------------|--------------------------|
| `src/lib/entitlements.ts` | Access/entitlement decisions + loaders | High (free/owned/sub/locked, Plus, wallet, subscription) | ✅ `canUserWatchEpisode`, `getEpisodeAccessStates`, `getUserSubscription` |
| `src/lib/purchases.ts` | Coin episode purchase | High | ✅ around `purchaseEpisodeWithCoins` |
| `src/lib/payments.ts` | Coin products + payment orders | High (catalog/history) | ✅ `getActiveCoinProducts`, `getUserPaymentOrders` |
| `src/lib/rewarded-ads.ts` | Rewarded-ad lifecycle | High | ✅ all 3 fns |
| `src/lib/chai.ts` | Creator chai tips | High | ✅ `submitShortFilmChaiTip` |
| `src/lib/catalog.ts` | Content→runtime mapping (price flags) | High | ✅ `mapEpisode`, `getEpisodeBySeriesSlugAndNumber` |
| `src/lib/playback.ts` | Playback auth + preview | Medium-High (enforces entitlement) | ✅ `authorizeMuxPlayback` |
| `src/lib/classification.ts` | Rating/parental gating | Medium (access gate) | ➖ not price |
| `src/lib/cms/constants.ts` | CMS access-method labels | Medium | ⚠️ mixes logic+CMS |
| `src/lib/cms/episodes.ts` | CMS monetization writes | Medium | ➖ writer |
| `src/lib/account.ts` | Wallet/subscription summaries | Medium | ✅ summaries |
| `src/lib/api/auth.ts` | Request auth | Medium (identity) | ✅ provides `user` |
| `src/lib/api/perf.ts` | Latency perf only | Low (not business) | ➖ |
| `src/types/database.ts` | Schema types | Reference | ➖ |
| `src/app/api/v1/episodes/[episodeId]/purchase/route.ts` | Purchase endpoint | High | ✅ primary emit site |
| `src/app/api/v1/episodes/[episodeId]/rewarded/route.ts` | Rewarded start | High | ✅ |
| `src/app/api/v1/rewarded-ad-attempts/[customData]/route.ts` | Attempt status | Medium | ✅ |
| `src/app/api/v1/wallet/route.ts` | Wallet + catalog + history | High | ✅ |
| `src/app/api/v1/short-films/[slug]/chai/route.ts` | Chai tip | High | ✅ |
| `src/app/api/v1/billing/google-play/route.ts` | Google Play stub | Medium (stubbed) | ✅ when wired |
| `src/app/api/webhooks/admob/ssv/route.ts` | AdMob SSV verify | High (real provider) | ✅ after finalize |
| `src/app/api/webhooks/mux/route.ts` | Mux webhook | Low (video) | ➖ |
| `src/app/api/v1/playback/route.ts` | Playback auth | Medium | ✅ |
| `src/app/api/v1/playback/preview/route.ts` | Preview auth | Medium | ✅ |
| `src/app/api/v1/me/route.ts` | User summary | Medium | ✅ |
| `src/app/api/v1/catalog/route.ts`, `series/[slug]`, `short-films/[slug]` | Content+flags | High | ✅ |
| `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx` | Access decision (UI) | High | ✅ `canUserWatchEpisode` result |
| `src/components/player/LockedEpisode.tsx` | Paywall UI | High | ✅ render moment |
| `src/app/purchase/[seriesSlug]/[episodeNumber]/page.tsx` | Checkout/offer UI | High | ✅ render + `canBuyWithCoins` |
| `src/app/purchase/actions.ts` | Buy server action | High | ✅ before/after RPC |
| `src/app/plans/page.tsx` | Subscription (disabled) | Medium (stub) | ✅ when enabled |
| `src/app/wallet/page.tsx` | Wallet (disabled checkout) | Medium (stub) | ✅ when enabled |
| `src/app/account/page.tsx` | Account summary | Medium | ✅ |
| `supabase/migrations/006_episode_access_controls.sql` | `purchase_episode_with_coins` RPC | High (DB writes) | ✅ (RPC body) |
| `supabase/migrations/011_rewarded_ad_foundation.sql` | Rewarded RPCs + table | High | ✅ (RPC body) |
| `supabase/migrations/010_chai_ledger_foundation.sql` | Chai RPCs + ledger | High | ✅ (RPC body) |
| `supabase/migrations/008_google_play_payment_foundation.sql` | `google_play_purchases`, `payment_provider_products` | Medium (unused) | ✅ when wired |
| `supabase/migrations/baseline_remote_schema.sql` | `credit_verified_coin_purchase` (unused), base tables | High (schema) | ✅ when wired |
| `supabase/migrations/018_welcome_account_grant.sql` | Welcome 100-coin grant | High (coin supply) | ✅ grant event |

---

**NO SOURCE FILES WERE MODIFIED DURING THIS AUDIT.**
