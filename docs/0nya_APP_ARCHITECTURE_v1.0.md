# 0nya APP ARCHITECTURE v1.0

## Scope and evidence basis

This document describes the architecture that is actually implemented in the current repository, not the intended Build 15 design. It is based on the code in this repo, the Supabase migration files, and the Android starter app in `apps/android`.

Evidence reviewed:

- `package.json`
- `src/app/**`
- `src/components/**`
- `src/lib/**`
- `src/data/content.ts`
- `src/types/database.ts`
- `supabase/*.sql`
- `apps/android/App.tsx`
- `apps/android/src/**`
- `docs/android-client-bootstrap.md`
- `docs/mobile-api-readiness.md`

Important note: `docs/0nya_CMS_PRODUCT_CONTRACT_v1.0.md` is not present in this repo. Where CMS/product contract details are expected, this document marks the state as `UNKNOWN / NOT YET IMPLEMENTED` unless actual repository evidence exists.

---

## 1. Repository structure

```text
0nyapp/
├─ AGENTS.md
├─ CLAUDE.md
├─ .github/copilot-instructions.md
├─ docs/
│  ├─ 0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md
│  ├─ 0nya_PRODUCT_UIUX_BIBLE_v3.0.md
│  ├─ 0nya_UI_WIREFRAMES_ALL_SCREENS_v1.0.md
│  ├─ android-client-bootstrap.md
│  ├─ mobile-api-readiness.md
│  └─ (no 0nya_CMS_PRODUCT_CONTRACT_v1.0.md found)
├─ public/
├─ src/
│  ├─ app/
│  │  ├─ account/
│  │  ├─ api/v1/
│  │  ├─ login/
│  │  ├─ plans/
│  │  ├─ purchase/
│  │  ├─ series/
│  │  ├─ signup/
│  │  ├─ wallet/
│  │  └─ watch/
│  ├─ components/
│  │  ├─ auth/
│  │  ├─ brand/
│  │  ├─ content/
│  │  ├─ home/
│  │  ├─ layout/
│  │  ├─ player/
│  │  ├─ series/
│  │  └─ ui/
│  ├─ data/
│  ├─ lib/
│  │  ├─ api/
│  │  ├─ supabase/
│  │  ├─ account.ts
│  │  ├─ catalog.ts
│  │  ├─ entitlements.ts
│  │  ├─ payments.ts
│  │  ├─ profiles.ts
│  │  ├─ purchases.ts
│  │  ├─ routes.ts
│  │  └─ watch-progress.ts
│  ├─ types/
│  │  └─ database.ts
│  └─ proxy.ts
├─ supabase/
│  ├─ 001_profiles_watch_progress.sql
│  ├─ 002_content_catalog.sql
│  ├─ 003_entitlements_monetization.sql
│  ├─ 004_coin_transactions.sql
│  ├─ 005_wallet_topups.sql
├─ apps/
│  └─ android/
│     ├─ App.tsx
│     ├─ src/
│     └─ package.json
├─ next.config.ts
├─ next-env.d.ts
├─ eslint.config.mjs
├─ postcss.config.mjs
├─ tsconfig.json
├─ README.md
└─ package.json
```

### Actual repo status

- The primary product app is a Next.js 16 app in `src/`.
- The Android app is a separate Expo starter shell in `apps/android/`.
- The real domain authority and transactional logic live in Supabase SQL migrations plus Next.js server code.
- The repo contains a UI prototype / demo catalogue more than a full production-ready app architecture.

---

## 2. Android / mobile framework and runtime

### Actual mobile app stack

Relevant files:

- `apps/android/package.json`
- `apps/android/App.tsx`
- `apps/android/src/lib/authContext.tsx`
- `apps/android/src/lib/api.ts`
- `apps/android/src/navigation/*`
- `apps/android/src/screens/*`
- `docs/android-client-bootstrap.md`

What exists:

- Expo React Native app under `apps/android`.
- React Navigation used for native stack and bottom tabs.
- App entry runs through `NavigationContainer` and `createNativeStackNavigator`.
- Authentication uses Supabase client auth with Expo SecureStore (referenced in docs but not clearly implemented in the current file set).
- The app calls Next.js API endpoints with `Authorization: Bearer <access token>`.
- There is no native video player implementation in the current Android app files.
- There is no native Google Play Billing client implementation in the Android app source (`BillingClient`, `ProductDetails`, `PurchasesUpdatedListener`, `queryProductDetails`, `queryPurchases`, `acknowledgePurchase`, `consumePurchase`, or Play purchase-token handling were not found in the repository).
- There is no true rewarded-ad verification flow in mobile code.

### Android app entry point

- `apps/android/App.tsx` is the top-level React Native app component.
- It wraps the tree in `AuthProvider` and bootstraps `AppNavigator`.

### Android runtime reality

- React Native / Expo runtime is configured by the Android app package and Expo.
- The project is not a fully wired mobile product yet; it is a foundation shell.

Status: `PARTIALLY IMPLEMENTED`

---

## Google Play Store & Billing Architecture

### Evidence summary

The repository does not contain a native Android Google Play Billing implementation. A code search for the play billing classes and APIs returned no app-level usage of:

- `BillingClient`
- `ProductDetails`
- `PurchasesUpdatedListener`
- `queryProductDetails`
- `queryPurchases`
- `acknowledgePurchase`
- `consumePurchase`
- `purchaseToken`

This means the actual Android app is not integrating Google Play Billing directly in the code that exists in this repo.

### Billing library / version

Status: `UNKNOWN / NOT FOUND`

Evidence found:

- No Gradle dependency for `com.android.billingclient:billing` was found in the repository Android app files.
- No Kotlin/Java billing client setup or purchase listener lifecycle was found in `apps/android/src/**` or the Android Gradle files visible in the repo.
- No `BillingClient` initialization, connection lifecycle, or purchase callback listener was found in app code.

### BillingClient setup and lifecycle

Status: `MISSING` / `UNKNOWN / NOT FOUND`

The repo does not contain:

- `BillingClient.newBuilder(...)`
- `billingClient.startConnection(...)`
- `PurchasesUpdatedListener`
- `billingClient.queryProductDetailsAsync(...)`
- `billingClient.queryPurchasesAsync(...)`
- `billingClient.acknowledgePurchase(...)`
- `billingClient.consumeAsync(...)`

### Product querying and product IDs

Status: `PARTIALLY IMPLEMENTED` at backend schema level only

Evidence found:

- `supabase/005_wallet_topups.sql` defines `public.coin_products` with rows:
  - `coins_50`
  - `coins_100`
  - `coins_250`
- Those are database product codes, not Play Store product IDs.
- `src/lib/payments.ts` exposes `CoinProduct` from `Database["public"]["Tables"]["coin_products"]["Row"]` and reads active products with `getActiveCoinProducts()`.
- `src/lib/payments.ts` also exposes provider names and maps `provider === "google_play"` to `Google Play` for UI output.

Important distinction:

- The repo models `google_play` as a payment provider in the database.
- The repository does not contain actual Play Billing product IDs or a Play product-query implementation in Android code.

### Coin-pack purchase flow

Status: `PARTIALLY IMPLEMENTED` in backend/data model, not in Android store flow

Evidence found:

- `public.coin_products` table contains the coin pack entries.
- `public.payment_orders` records provider-level purchase attempts.
- `public.coin_transactions` stores credit records and references a `payment_order_id`.
- `public.credit_verified_coin_purchase(...)` credits the wallet when a verified purchase is processed.
- `src/lib/payments.ts` is a read-only helper for active coin products and payment orders.
- `src/lib/purchases.ts` wraps the DB function `purchase_episode_with_coins`, not a Google Play purchase flow.

### 0nya Plus subscription flow

Status: `PARTIALLY IMPLEMENTED` (schema + entitlement checks only)

Evidence found:

- `src/types/database.ts` defines `subscriptions` with fields including `status`, `plan_code`, `starts_at`, `ends_at`.
- `src/lib/entitlements.ts` contains `getUserSubscription()`, `hasActiveSubscription()`, and the logic to check whether a user has current active subscription entitlement.
- `src/app/plans/page.tsx` renders a placeholder plan page with a note that subscription access is “available here soon.”
- There is no Google Play subscription purchase code or subscription verification flow in Android or backend code.

### Purchase acknowledgement

Status: `MISSING` / `UNKNOWN / NOT FOUND`

Evidence found:

- No `acknowledgePurchase(...)` call exists anywhere in the repo.
- No Android-side `Purchase` acknowledgement flow was found.
- The backend verification approach is instead centered around database verification functions and transaction deduplication rather than store acknowledgement logic.

### Consumable / coin handling

Status: `IMPLEMENTED` at backend wallet/verification layer

Evidence found:

- `supabase/005_wallet_topups.sql` defines `credit_verified_coin_purchase(...)` as a service-role-only function.
- The function inserts a `public.payment_orders` row, checks for existing transaction collision, credits `public.wallets.coin_balance`, and inserts a matching `public.coin_transactions` credit row.
- It uses a unique index on `(provider, provider_transaction_id)` and a unique index on `coin_transactions(payment_order_id)` for `transaction_type = 'credit'` to prevent duplicate crediting.

### Purchase token handling

Status: `MISSING` / `UNKNOWN / NOT FOUND`

Evidence found:

- `provider_transaction_id` is stored in `public.payment_orders` and used as the idempotency key.
- There is no Android implementation that receives, stores, validates, or forwards `purchaseToken` from Google Play Billing.
- There is no search result for `purchaseToken` in the Android app or repo codebase.

### Restore / query purchases

Status: `MISSING` / `UNKNOWN / NOT FOUND`

Evidence found:

- No `queryPurchases` calls exist in the Android codebase.
- No restore-purchases screen or backend sync route was found.
- There is no Google Play `queryPurchasesAsync` flow or direct purchase restore implementation.
- The backend implements a deduplicated verification function, but not a Play purchase-sync API.

### Server verification and entitlement sync

Status: `PARTIALLY IMPLEMENTED`

Evidence found:

- `supabase/005_wallet_topups.sql` contains `public.credit_verified_coin_purchase(...)` with a comment explicitly stating:
  - “Android: Google Play Billing purchase -> backend token verification -> wallet credited.”
- `src/types/database.ts` defines the `credit_verified_coin_purchase` RPC and its provider types.
- `public.payment_orders` stores `user_id`, `provider`, `provider_transaction_id`, `product_code`, `status`, and `verification_status`.
- `public.wallets` and `public.coin_transactions` record the final credited balance and debit/credit ledger.

This is the actual server-side verification model in the repo, but it is not backed by a real Play client integration in the app code that exists here.

### Billing errors and retries

Status: `PARTIALLY IMPLEMENTED` at backend verification layer only

Evidence found:

- `public.credit_verified_coin_purchase(...)` explicitly rejects invalid user, invalid provider, blank transaction ID, invalid product, and transaction conflicts.
- It returns states such as `transaction_conflict`, `already_processed`, `invalid_transaction`, and `invalid_product`.
- `payment_orders` has operational statuses: `pending`, `completed`, `failed`, `refunded`, `cancelled` and verification statuses: `unverified`, `verified`, `rejected`.
- No Android-side retry logic or automated billing error handling was found.

### Relevant source files

- `supabase/005_wallet_topups.sql`
- `src/types/database.ts`
- `src/lib/payments.ts`
- `src/lib/purchases.ts`
- `src/lib/entitlements.ts`
- `src/app/plans/page.tsx`
- `src/app/wallet/page.tsx`
- `src/app/account/page.tsx`
- `apps/android/App.tsx`
- `apps/android/src/**`

### Conclusion

The repository contains a backend-ready payment model that references Google Play as a provider and includes wallet-credit verification logic, but the actual Google Play Billing client implementation is not present in the Android app source. The code evidence supports a backend/provider contract and product catalog, not a working Play Billing SDK integration.

---

## 3. Web app framework and runtime

Relevant files:

- `package.json`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/**` route files
- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`

Actual stack:

- Next.js 16.3.1
- React 19.2.8
- TypeScript
- Supabase SSR + JS SDK
- Tailwind CSS v4
- ESLint configured via `eslint.config.mjs`

The web app is structured as server-rendered App Router pages plus route handlers for API endpoints.

---

## 4. App entry points and routing

### Web app

- `src/app/page.tsx` renders Home.
- `src/app/series/[slug]/page.tsx` renders series detail.
- `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx` renders player guard and playback page.
- `src/app/account/page.tsx` renders account.
- `src/app/wallet/page.tsx` renders wallet.
- `src/app/plans/page.tsx` shows membership placeholder.
- `src/app/purchase/[seriesSlug]/[episodeNumber]/page.tsx` is the coin purchase flow page.

### Native app

- `apps/android/App.tsx` creates the main stack navigator.
- `apps/android/src/navigation/MainTabs.tsx` defines the bottom tab stack: Home / Explore / Profile.
- `apps/android/src/navigation/ProfileStack.tsx` wraps profile flows.

### Navigation architecture

- Web UI uses Next.js route-based navigation.
- Android app uses React Navigation native stack and bottom tabs.
- The repository does not implement a shared app-router architecture across web + Android; the web and mobile projects are independent.

Status: `PARTIALLY IMPLEMENTED` for cross-platform navigation; the web app is substantially more complete than Android.

---

## 5. Screen structure

### Web screens

Primary screen layers:

- Home: `src/components/home/HomePage.tsx`
- Series page: `src/app/series/[slug]/page.tsx`
- Watch page: `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx`
- Account page: `src/app/account/page.tsx`
- Wallet page: `src/app/wallet/page.tsx`
- Plans page: `src/app/plans/page.tsx`
- Purchase page: `src/app/purchase/[seriesSlug]/[episodeNumber]/page.tsx`
- Login page: `src/app/login/page.tsx`
- Signup page: `src/app/signup/page.tsx`

### Android screens

- `apps/android/src/screens/HomeScreen.tsx`
- `apps/android/src/screens/SeriesScreen.tsx`
- `apps/android/src/screens/WatchScreen.tsx`
- `apps/android/src/screens/AccountScreen.tsx`
- `apps/android/src/screens/WalletScreen.tsx`
- `apps/android/src/screens/ExploreScreen.tsx`
- `apps/android/src/screens/SignInScreen.tsx`

### Screen reality check

The repo includes a thin set of screens but no full implementation of the Product Bible screens such as rewarded-ad gating, Chai tipping, short-film detail and ad flow, deep-link router, parental gate, delete-account flow, or search results UI.

Status: `PARTIALLY IMPLEMENTED`

---

## 6. State management

### Existing state management

What is implemented:

- React local state in components and screen-level hooks.
- Supabase client state for auth/session.
- Server Component fetches for route-driven UI in the web app.
- Minimal `AuthProvider` in Android for session state.

Relevant files:

- `apps/android/src/lib/authContext.tsx`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`
- `src/components/player/VerticalPlayer.tsx`
- `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx`
- `src/app/account/page.tsx`

### Missing or not implemented

- No Redux/Zustand/Context store for app-wide domain state.
- No centralized state machine for access/paywall/player lifecycle.
- No global feature-flag store.
- No cross-app shared logic layer across web + Android.

Status: `PARTIALLY IMPLEMENTED` (local + Supabase session state only)

---

## 7. Authentication and session architecture

### Web auth

Relevant files:

- `src/lib/supabase/server.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/env.ts`
- `src/components/auth/AuthForm.tsx`
- `src/app/login/actions.ts`
- `src/app/account/actions.ts`
- `src/lib/api/auth.ts`

What exists:

- Uses Supabase auth for browser and server sessions.
- Web server routes use `createServerClient` from `@supabase/ssr`.
- Browser client uses `createBrowserClient`.
- Protected API routes validate bearer tokens or server session cookies through `getApiAuth`.
- `src/lib/api/auth.ts` supports bearer token validation for the mobile API contract.

### Android auth

Relevant files:

- `apps/android/src/lib/authContext.tsx`
- `apps/android/src/lib/supabase.ts`
- `apps/android/src/config/env.ts`

What exists:

- Supabase client is used.
- `AuthProvider` initializes session from `supabase.auth.getSession()` and listens to auth state changes.
- Sign-in implementation currently uses email/password, not the production phone OTP flow.

### Actual issue

The repository contains the intended future design for phone OTP and bearer-token auth, but the actual user-facing app is not yet fully built around it.

Status: `PARTIALLY IMPLEMENTED`

---

## 8. API and service layer

### Web API routes

Implemented routes under `src/app/api/v1`:

- `src/app/api/v1/catalog/route.ts`
- `src/app/api/v1/me/route.ts`
- `src/app/api/v1/series/[slug]/route.ts`
- `src/app/api/v1/wallet/route.ts`
- `src/app/api/v1/watch-progress/route.ts`

Helper layers:

- `src/lib/api/auth.ts` – bearer-token and cookie auth parsing
- `src/lib/api/responses.ts` – standard `{ data }` / `{ error }` wrappers
- `src/lib/api/serializers.ts` – API response shaping

### Shared domain helpers

- `src/lib/catalog.ts` – content retrieval from published DB rows + fallback mock catalog
- `src/lib/entitlements.ts` – user wallet, subscription, and episode access checks
- `src/lib/payments.ts` – coin product and payment order retrieval
- `src/lib/purchases.ts` – `purchase_episode_with_coins` RPC wrapper
- `src/lib/watch-progress.ts` – watch progress read/write and resume logic
- `src/lib/account.ts` – safe display data shaping
- `src/lib/profiles.ts` – profile lookup

### Service layer reality

- There is no layered domain service architecture beyond these server helper functions.
- The real business rules live mostly in Supabase SQL functions and RLS.

Status: `IMPLEMENTED` for a minimal server API + shared helper layer; incomplete for full feature set.

---

## 9. Environment and configuration handling

### Web environment

Relevant files:

- `src/lib/supabase/env.ts`
- `apps/android/src/config/env.ts`

Configured values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Android app env expects:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_ONYA_API_BASE_URL`

### Actual behavior

- Public Supabase config is in client-facing env vars.
- Service-role keys and trusted server-only credentials are not exposed in the app code.
- `getSupabaseEnv()` throws if required public config is missing.
- The Android client reads env from Expo variables with runtime validation.

Status: `IMPLEMENTED` for basic public config access; no remote feature-flag service or CMS config layer is in place.

---

## 10. Home / feed architecture

Relevant files:

- `src/components/home/HomePage.tsx`
- `src/components/home/FeaturedHero.tsx`
- `src/components/content/ContentRow.tsx`
- `src/components/content/ContentCard.tsx`
- `src/data/content.ts`
- `src/lib/catalog.ts`

Actual behavior:

- Home page renders a hero, Continue Watching, Start Here, Trending, and New Releases.
- It fetches `getFeaturedSeries()`, `getPublishedSeries()`, and user watch progress.
- If no published DB catalog exists, it falls back to the mock in-memory catalogue from `src/data/content.ts`.
- `continueWatching` and `progressToContentItems` create resume cards.

This is a static editorial home style, not a personalized recommendation engine.

Status: `IMPLEMENTED` as a demo/placeholder feed architecture.

---

## 11. Series / Episode architecture

Relevant files:

- `src/data/content.ts`
- `src/lib/catalog.ts`
- `src/components/series/SeriesHero.tsx`
- `src/components/series/EpisodeList.tsx`
- `src/components/series/EpisodeCard.tsx`
- `src/app/series/[slug]/page.tsx`
- `supabase/002_content_catalog.sql`
- `src/types/database.ts`

Actual implementation:

- Series and episodes are seeded in Supabase DB with `public.series` and `public.episodes` tables.
- `mapSeries()` and `mapEpisode()` translate DB rows into app content objects.
- Each episode has `id`, `episode_number`, `title`, `duration_seconds`, `is_free`, `coin_price`, and `status`.
- Series page calculates access state using `getEpisodeAccessStates()`.
- The mock catalogue in `src/data/content.ts` acts as a fallback when DB rows are missing.

Important reality:

- There is no actual HLS video asset pipeline in the observable code.
- The code uses runtime strings like `"1:42"` instead of actual media metadata or playback URLs for most episodes.

Status: `PARTIALLY IMPLEMENTED`

---

## 12. Current episode access resolution

Relevant files:

- `src/lib/entitlements.ts`
- `src/lib/catalog.ts`
- `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx`
- `src/app/purchase/[seriesSlug]/[episodeNumber]/page.tsx`
- `supabase/003_entitlements_monetization.sql`
- `supabase/004_coin_transactions.sql`

Actual logic:

- `getEpisodeAccessStates()` checks:
  1. `episode.isFree` -> free
  2. user has valid `episode_entitlements` row -> owned
  3. user has active `subscriptions` row -> subscription included
  4. otherwise locked
- `canUserWatchEpisode()` returns true only if the episode is free, user has active subscription, or valid entitlement.
- `purchaseEpisodeWithCoins()` uses the database RPC `public.purchase_episode_with_coins`.
- The DB function enforces not_authenticated, invalid_episode, already_owned, active_subscription, insufficient_balance, purchase_success cases.

This means the app does not compute business access on the client; it relies on the shared helper and DB RPCs.

Important difference from the Bible:

- This repo does not implement the Bible’s combinable/variant access model with `coin_unlock_enabled`, `rewarded_unlock_enabled`, `plus_access`, `free_access`, and `rewarded_access_mode` as distinct CMS-controlled data fields.
- It only implements an earlier simplified access pattern: free / owned / subscription / locked.

Status: `PARTIALLY IMPLEMENTED` but not Bible-compliant

---

## 13. Video / HLS / player architecture

Relevant files:

- `src/components/player/VerticalPlayer.tsx`
- `src/components/player/PlayerControls.tsx`
- `src/components/player/EpisodeComplete.tsx`
- `src/components/player/LockedEpisode.tsx`
- `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx`
- `src/lib/watch-progress.ts`

Actual behavior:

- The player is a mock vertical viewer, not a real HLS or video SDK integration.
- It uses a poster image and UI overlays (`Playing` / `Paused`) instead of actual media playback.
- It tracks a simulated position in seconds and saves progress to `watch_progress`.
- `PlayerControls` is UI-only and does not control a native video element.
- `EpisodeComplete` appears when progress reaches 100%.

This is not a real media pipeline. There are no actual HLS URL fields, DRM, adaptive bitrate logic, or video stream configuration in the visible code.

Status: `PARTIALLY IMPLEMENTED` as a UI simulation, not a real video app.

---

## 14. Continue Watching / history

Relevant files:

- `supabase/001_profiles_watch_progress.sql`
- `src/lib/watch-progress.ts`
- `src/app/account/page.tsx`
- `src/components/home/HomePage.tsx`
- `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx`
- `apps/android/src/screens/AccountScreen.tsx`

Actual implementation:

- `watch_progress` table stores `user_id`, `series_slug`, `episode_number`, `position_seconds`, `duration_seconds`, `completed`, `last_watched_at`.
- `saveWatchProgress()` upserts by `(user_id, series_slug, episode_number)`.
- `getContinueWatching()` reads unfinished episodes and passes them to `progressToContentItems()`.
- `VerticalPlayer` persists progress during playback and on page hide/unload.
- `getResumePositionSeconds()` restores progress and clamps it to runtime length.

Status: `IMPLEMENTED` for a basic per-user resume system.

---

## 15. Coins / wallet

Relevant files:

- `supabase/003_entitlements_monetization.sql`
- `supabase/004_coin_transactions.sql`
- `supabase/005_wallet_topups.sql`
- `src/lib/entitlements.ts`
- `src/lib/payments.ts`
- `src/lib/purchases.ts`
- `src/lib/account.ts`
- `src/app/wallet/page.tsx`
- `src/app/api/v1/wallet/route.ts`
- `src/app/api/v1/me/route.ts`

Actual behavior:

- Wallet is a per-user row in `public.wallets` with `coin_balance`.
- Coin transactions table stores credits and purchase deductions.
- `purchase_episode_with_coins()` deducts coins and grants permanent entitlement by inserting `public.episode_entitlements` with `source = 'purchase'` and `expires_at = null`.
- `credit_verified_coin_purchase()` is a service-role function for trusted provider verification and then credits wallet balance.
- Web wallet UI shows balance, coin products, recent coin activity, and recent top-ups.
- Coin product cards are displayed but are intentionally disabled as “coming soon.”

Important reality:

- There is no actual checkout or store provider integration implemented in the app UI.
- The top-up flow is a backend-ready but not frontend-live architecture.

Status: `PARTIALLY IMPLEMENTED`

---

## 16. Purchase / billing integration

Relevant files:

- `supabase/005_wallet_topups.sql`
- `src/lib/payments.ts`
- `src/lib/purchases.ts`
- `src/app/purchase/[seriesSlug]/[episodeNumber]/page.tsx`
- `src/app/purchase/actions.ts`
- `src/app/api/v1/wallet/route.ts`

Actual behavior:

- There is a server-side purchase flow using `public.purchase_episode_with_coins`.
- There is a provider-neutral payment order model with `payment_orders` and `coin_products`.
- The app supports reading payment orders and coin products but not actually completing a real store purchase.
- `credit_verified_coin_purchase` is written as a backend trust function to be called from a verified provider flow.

What is not implemented:

- Native Google Play Billing client code in Android app
- Apple StoreKit integration
- Store webhook or verification route
- real payment checkout UI

Status: `PARTIALLY IMPLEMENTED` backend/provider scaffolding only; no Play Billing SDK integration was found in the repository code.

---

## 17. Rewarded-ad integration

Relevant files:

- `src/app/purchase/[seriesSlug]/[episodeNumber]/page.tsx`
- `src/components/player/LockedEpisode.tsx`
- `src/types/database.ts`
- `supabase/003_entitlements_monetization.sql`

Actual behavior:

- The purchase page includes a `Watch ad to unlock` button, but it is disabled.
- Comments explicitly note: “Rewarded-ad entitlements must be granted only after trusted server-side ad verification.”
- `episode_entitlements.source` includes `'rewarded_ad'`, but no actual rewarded-ad flow exists in the app.
- No rewarded-ad API, callback, verification route, or UI flow is implemented.

Status: `MISSING` in the actual app; only placeholder UI and schema scaffolding exist.

---

## 18. Subscription / Plus entitlement

Relevant files:

- `src/lib/entitlements.ts`
- `src/lib/account.ts`
- `src/app/plans/page.tsx`
- `src/app/api/v1/me/route.ts`
- `supabase/003_entitlements_monetization.sql`
- `src/types/database.ts`

Actual behavior:

- `public.subscriptions` table has status, plan code, starts_at, ends_at.
- `hasActiveSubscription()` checks for an active subscription within current time window.
- Subscription status is included in `/api/v1/me` as a summary.
- Plans page is a placeholder “coming soon” page.
- The app consistently treats active subscription as a valid episode entitlement in `getEpisodeAccessStates()`.

But there is no actual checkout, provider verification, or subscription purchase flow implemented in the current repo.

Status: `PARTIALLY IMPLEMENTED` backend data model and entitlement checks only.

---

## 19. Short Film playback and ad architecture

Relevant files:

- `apps/android/src/screens/ShortFilmDetailScreen.tsx`
- `apps/android/src/screens/ShortFilmPlaybackScreen.tsx`
- `apps/android/src/screens/ShortFilmEndScreen.tsx`
- `apps/android/src/player/PlayerScreen.tsx`
- `apps/android/src/player/resumePosition.ts`
- `apps/android/src/player/usePlaybackController.ts`
- `apps/android/src/player/useWatchProgressSync.ts`

Actual repository status:

- Android implements the dedicated short-film detail -> playback -> film-end flow with expo-video.
- Non-Plus short-film ad behavior remains CMS-controlled; Plus remains ad-free.
- Normal short-film resume now derives from the shared resume helper (`resumePosition`) so completed/final-zone progress is non-resumable on a fresh Play action.
- Explicit F02 Replay remains replay-only (`startFromBeginning`) and starts from zero without deleting watch history.

Status: `IMPLEMENTED` for Android short-film flow (web parity may still differ by surface).

---

## 20. Current Chai implementation

Relevant files:

- `apps/android/src/player/PlayerScreen.tsx`
- `apps/android/src/screens/ShortFilmPlaybackScreen.tsx`
- `apps/android/src/screens/ShortFilmEndScreen.tsx`
- `apps/android/src/lib/chai.ts`
- `apps/android/src/lib/api.ts`
- `supabase/003_entitlements_monetization.sql`
- `supabase/migrations/20260825000000_018_welcome_account_grant.sql`

Actual repository status:

- Short-film completion can surface a compact in-context Chai affordance in the final 10 seconds of playback.
- The app uses the backend-driven amount list (`chai.allowedCoinAmounts`) and keeps the authoritative wallet/ledger logic server-side.
- Insufficient-balance continues through the existing coin-purchase route and returns to the same short-film Chai flow.
- Chai is modeled as an 0nya coin tip, not a separate cash/UPI payment flow.
- The app does not re-implement wallet balance mutation locally; it submits a server-authoritative tip request and trusts the backend ledger.

Status: `IMPLEMENTED` for the Android short-film experience and backend-authoritative wallet contract.

---

## 21. Profile / settings / account

Relevant files:

- `src/app/account/page.tsx`
- `src/components/auth/AuthStatus.tsx`
- `src/components/auth/AuthForm.tsx`
- `src/app/login/page.tsx`
- `src/app/login/actions.ts`
- `src/lib/profiles.ts`
- `src/lib/account.ts`
- `supabase/001_profiles_watch_progress.sql`

Actual behavior:

- User profile is stored in `public.profiles`.
- Account page displays wallet, plan, and continue watching.
- Auth form supports phone OTP UI in the front-end (UI wiring), but a production OTP flow is not fully implemented in the actual repo state.
- There is no settings screen with notifications, logout + guest reset, delete account, or privacy links.
- `signOut` exists in account actions but there is no full account deletion flow.

Status: `PARTIALLY IMPLEMENTED`

---

## 22. Deep links

Relevant files:

- `docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md`
- `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md`
- no deep-link code in `src/**` or `apps/android/src/**`

Actual behavior:

- No deep-link router exists in the codebase.
- No universal links / app links handling is implemented.
- No deep-link route handlers or flow exists.

Status: `MISSING`

---

## 23. Analytics

Relevant files:

- search across repo shows no analytics SDK or event layer in `src/**`
- `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md` mentions analytics but no actual implementation exists

Actual behavior:

- No telemetry package is installed.
- No analytics provider or event schema is implemented.
- No usage event logging or QA instrumentation is present in the source.

Status: `MISSING`

---

## 24. Errors and loading states

Relevant files:

- `src/app/api/v1/**` response wrappers
- `apps/android/src/screens/*` loading/error state patterns
- `src/components/ui/*` if present

Actual behavior:

- API routes return standard `{ data }` or `{ error }` objects.
- Android screens manage `isLoading` and `error` state locally.
- Web pages use `notFound()` and redirect flow for invalid or protected content.
- Loading indicators exist in UI shells but not a global error boundary.

Status: `PARTIALLY IMPLEMENTED` for basic network and page states

---

## 25. Feature flags

Relevant files:

- no feature-flag infrastructure found in repo
- no remote-config layer in code

Actual behavior:

- The repo has placeholder “coming soon” states and disabled buttons, but not a configurable feature-flag system.
- No backend feature/config endpoint exists.

Status: `MISSING`

---

## 26. Backend / CMS interaction

### Actual backend authority

The real app authority is:

1. Supabase SQL + tables/functions/RLS
2. Next.js server helpers (`src/lib/*`)
3. Server routes in `src/app/api/v1/*`
4. Fallback mock catalog in `src/data/content.ts`

### Actual CMS-like model

The DB schema supports these fields in `public.series` and `public.episodes`:

- `status`
- `featured`
- `sort_order`
- `slug`
- `format`
- `episode_count`
- `episode_duration_label`
- `poster_url`
- `hero_image_url`
- `is_free`
- `coin_price`

This is closer to a content catalogue and monetization schema than a full CMS contract with all Bible fields like `rewarded_unlock_enabled`, `midroll_enabled`, `plus_access`, `publish_at`, `locked_preview_seconds`, or `chai_enabled`.

Status: `PARTIALLY IMPLEMENTED` with basic content and entitlement schema only

---

## 27. Existing reusable components

Relevant files:

- `src/components/ui/Button.tsx`
- `src/components/ui/Icon.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/MobileBottomNav.tsx`
- `src/components/content/ContentCard.tsx`
- `src/components/content/ContentRow.tsx`
- `src/components/series/SeriesHero.tsx`
- `src/components/series/EpisodeList.tsx`
- `src/components/player/VerticalPlayer.tsx`
- `src/components/player/PlayerControls.tsx`
- `src/components/player/LockedEpisode.tsx`
- `apps/android/src/components/Screen.tsx`
- `apps/android/src/components/ui.tsx`

Actual value:

- These components provide the foundation for a content-driven app shell.
- They are reusable but still mostly design/demo-oriented rather than fully product-coded.

---

## 28. Code that should be preserved

The following code should be preserved because it is the current working infrastructure:

- Shared catalog + entitlement helpers in `src/lib/catalog.ts` and `src/lib/entitlements.ts`
- Public API response wrappers in `src/lib/api/` 
- Supabase schema and migration logic in `supabase/*.sql`
- Watch progress resume logic in `src/lib/watch-progress.ts`
- Wallet and coin purchase foundation in `src/lib/payments.ts` and `src/lib/purchases.ts`
- Web app page structure and route-driven content experience in `src/app/**`
- Android starter foundation in `apps/android/App.tsx` and navigation files
- UX patterns for loading/error states in current screen-level components

These are the current base systems to preserve, even though several features are not complete.

---

## 29. Known technical debt relevant to Build 15

1. Missing true Build-15 product compliance with Bible rules.
2. `src/data/content.ts` is still a mock catalogue used as fallback and not a live CMS-backed content source.
3. Episode access is simplified to `free` / `owned` / `subscription` / `locked`; the Bible expects CMS-controlled mixed access methods per episode.
4. No real rewarded-ad system exists, even though schema and placeholder UI mention it.
5. No short-film flow exists beyond generic content placeholders.
6. No Chai flow or ledger model exists.
7. No deep links or universal link routers exist.
8. No analytics integration exists.
9. No feature-flag configuration layer exists.
10. No actual HLS or native video player integration is present.
11. The Android app is still a foundation shell and not a full consumer app.
12. `plans/page.tsx` and wallet top-up UI are intentionally disabled placeholders.
13. CMS contract file `docs/0nya_CMS_PRODUCT_CONTRACT_v1.0.md` is absent from the repo, so the CMS-authoritative contract is not represented by source evidence.

---

## 30. Architecture verdict

The repository currently implements a minimal but real foundation:

- Next.js consumer app shell
- Supabase-backed content + watch progress + wallet + entitlement scaffolding
- minimal Android starter app
- server-side purchase/RPC pattern

It does not currently implement the full Build 15 product architecture described in the Bible, especially around:

- mixed episode access methods
- rewarded-ad verification
- short films with ad rules
- Chai tipping
- deep links
- analytics
- feature flags
- full Android consumer app behavior

The repository evidence is sufficient to document the actual architecture accurately. Where the repo lacks evidence, this document marks the area as `UNKNOWN / NOT YET IMPLEMENTED`.

---

## BUILD 15 GAPS

### Gap 1: Mixed per-episode access model

- Current behavior: `getEpisodeAccessStates()` uses a simplified access model: free / owned / subscription / locked.
- Required behavior: Bible expects episode access controlled by backend/CMS with any valid combination of free, coin unlock, rewarded-ad unlock, and Plus access; no mandatory first-3-free rule; no fixed episode 4 paywall.
- Affected files: `src/lib/entitlements.ts`, `src/lib/catalog.ts`, `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx`, `src/app/purchase/[seriesSlug]/[episodeNumber]/page.tsx`, `supabase/003_entitlements_monetization.sql`, `src/types/database.ts`
- Scope: shared
- Severity: BLOCKER

### Gap 2: Rewarded-ad unlock flow

- Current behavior: placeholder button disabled, schema includes `rewarded_ad` source, but no actual rewarded ad verification or entitlement issuance exists.
- Required behavior: user-initiated rewarded ad unlock with trusted server-side verification and idempotent entitlement grant.
- Affected files: `src/app/purchase/[seriesSlug]/[episodeNumber]/page.tsx`, `src/components/player/LockedEpisode.tsx`, `supabase/003_entitlements_monetization.sql`, `src/types/database.ts`
- Scope: shared
- Severity: BLOCKER

### Gap 3: Short Film flow and ads

- Current behavior: Android has dedicated short-film detail/playback/F02 flow and CMS-controlled ad handling; any remaining gaps are parity-specific by surface.
- Required behavior: short films are playable, non-Plus users may see CMS-controlled mid/post-roll ads, Plus users are ad-free, and Chai is available after completion.
- Affected files: see Android short-film files above.
- Scope: verify remaining non-Android parity separately.
- Severity: PARTIAL / parity-tracking, not an Android blocker.

### Gap 4: Chai implementation

- Current behavior: Android short-film Chai flow is implemented (including final-window affordance + F02 path) with server-authoritative wallet/ledger behavior.
- Required behavior: same-coin tipping flow with wallet debit and creator ledger credit after completion.
- Affected files: `apps/android/src/player/PlayerScreen.tsx`, `apps/android/src/screens/ShortFilmEndScreen.tsx`, `apps/android/src/lib/chai.ts`, `apps/android/src/lib/api.ts`
- Scope: shared
- Severity: implemented on Android; validate other surfaces independently.

### Gap 5: Deep link architecture

- Current behavior: no deep-link routing, universal link handling, or app-link infrastructure.
- Required behavior: deep links route to content while respecting parental classification, access checks, and release status.
- Affected files: no actual deep-link code exists in `src/**` or `apps/android/src/**`
- Scope: frontend-only + backend-only + shared
- Severity: HIGH

### Gap 6: Search and Explore UI

- Current behavior: `MobileBottomNav` still contains `Home`, `Browse`, `Search`, and `Profile`, and there is a minimal `ExploreScreen.tsx` placeholder. There is no real Explore/search results flow.
- Required behavior: bottom nav is Home / Explore / Profile; search lives inside Explore.
- Affected files: `apps/android/src/navigation/MainTabs.tsx`, `apps/android/src/screens/ExploreScreen.tsx`, `src/components/layout/MobileBottomNav.tsx`, `src/components/layout/Header.tsx`
- Scope: frontend-only
- Severity: HIGH

### Gap 7: Real video/HLS pipeline

- Current behavior: `VerticalPlayer` is a simulated poster and progress UI, not an actual video player.
- Required behavior: real media playback, asset metadata, resume behavior, and proper player lifecycle.
- Affected files: `src/components/player/VerticalPlayer.tsx`, `src/components/player/PlayerControls.tsx`, `src/app/watch/[seriesSlug]/[episodeNumber]/page.tsx`
- Scope: frontend-only + backend-only (media asset source)
- Severity: BLOCKER

### Gap 8: Real payment and top-up flow

- Current behavior: wallet reads and coin products are implemented, but real store checkout and provider verification are missing.
- Required behavior: real store purchase, trusted verification, wallet credit, and idempotent reconciliation.
- Affected files: `supabase/005_wallet_topups.sql`, `src/lib/payments.ts`, `src/lib/purchases.ts`, `src/app/wallet/page.tsx`, `src/app/purchase/[seriesSlug]/[episodeNumber]/page.tsx`
- Scope: backend-only + shared + frontend-only
- Severity: BLOCKER

### Gap 9: Full subscription/Plus flow

- Current behavior: subscription table and entitlement checks exist, but no actual plan purchase flow or Plus gating UI is implemented.
- Required behavior: real Plus offer screen, active subscription state, and per-episode plus entitlement logic consistent with product rules.
- Affected files: `src/app/plans/page.tsx`, `src/lib/entitlements.ts`, `supabase/003_entitlements_monetization.sql`
- Scope: shared
- Severity: HIGH

### Gap 10: Full account/privacy/settings lifecycle

- Current behavior: account page and basic auth exist, but no settings, notifications, delete account, privacy links, or compliance flows are implemented.
- Required behavior: settings, privacy, notification consent, delete account, and guest-to-account merge behavior as described in the Bible.
- Affected files: `src/app/account/page.tsx`, `src/components/auth/AuthForm.tsx`, `src/app/login/page.tsx`, `supabase/001_profiles_watch_progress.sql`
- Scope: frontend-only + backend-only
- Severity: HIGH

### Gap 11: Analytics and feature-flag infrastructure

- Current behavior: no analytics code, no feature flags, no backend config endpoint.
- Required behavior: event schema, configuration endpoints, and rollout control for Build 15-ready product flows.
- Affected files: none implemented in repo
- Scope: shared
- Severity: MEDIUM

### Gap 12: Missing CMS contract and product authority content

- Current behavior: repo contains the Bible and master flow docs but not the CMS contract file referenced by the user request.
- Required behavior: a concrete CMS contract with all product/config fields needed for access, short-film ads, Chai, ratings, and deep-links.
- Affected files: repo has no `docs/0nya_CMS_PRODUCT_CONTRACT_v1.0.md`
- Scope: CMS-only
- Severity: HIGH

---

## Final conclusion

The actual repository shows a viable prototype foundation but not a full Build-15-compliant implementation. The workable base is the Next.js app plus Supabase SQL model; the missing and partial areas are real product gaps that must be addressed before the project matches the Bible and user-flow documents.
