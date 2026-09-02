# 0nya Monetization Current State

Snapshot from repository evidence. Security-sensitive. Verify against
`src/` and `supabase/` before editing. Status vocabulary: COMPLETE /
PARTIAL / PENDING / BLOCKED / UNVERIFIED.

Title: coins, subscriptions, entitlements, rewarded ads, Chai tips, wallet,
payments, playback authorization, and the server/client authority boundary.

## Server/client authority (non-negotiable)

Client (Android or web) is NEVER authoritative for identity, wallet balance,
coin credit, purchase verification, subscription state, entitlement, price,
rewarded-ad credit, or playback authorization (root `AGENTS.md` rule 7).

Evidence this is enforced:

- `src/lib/entitlements.ts` `canUserWatchEpisode` — free → episode
  entitlement → explicit `plusAccess === true` + active subscription; guests
  fail closed; entitlement window checked server-side.
- `src/lib/playback.ts` — access, parental/age gates, media readiness and
  resolution ceiling all resolved server-side before Mux signed URLs.
- `src/app/api/webhooks/admob/ssv/route.ts` — AdMob SSV signature verified
  against Google verifier keys; production pins `ADMOB_REWARDED_AD_UNIT_ID`
  (fail closed). Credit funnels through `finalize_rewarded_ad_callback`.
- `credit_verified_coin_purchase` RPC is the only verified-coin credit path.

## Classification of subsystems

### Free-access rules — COMPLETE

Episode-level `is_free`. Guests can watch free episodes
(`entitlements.ts` `canUserWatchEpisode`). Free rows surface in catalog and
in access labels (Free). Preview of locked episodes via `locked_preview_seconds`
+ `preview_media_asset_id` (server-provisioned preview clips, `playback.ts`
`provisionEpisodePreviewMediaAsset`, Mux clip creation).

### Registration gate — PARTIAL

Playback returns `access_required` for guests on non-free content (server
behavior, `playback.ts` `resolveEpisodePlayback` `canWatch=false` →
`access_required`). Client gate/UX routing to auth is in the app
(`EpisodeAccessOptionsScreen`, `SignInScreen`); full gating matrix per
authority docs must be re-verified against the working tree.

### Coins — COMPLETE

- Tables: `wallets`, `coin_transactions`, `coin_products`, `payment_orders`
  (migrations 003/004/005, google-play foundation).
- RPCs: `purchase_episode_with_coins` (wallet debit + entitlement on
  success), `credit_verified_coin_purchase` (verified top-up credit),
  `apply_welcome_coin_grant` (welcome grant on new user, 018/021).
- API: `GET /api/v1/wallet` (balance/products/transactions/top-ups),
  `POST /api/v1/episodes/[episodeId]/purchase` → `purchases.ts`
  `purchaseEpisodeWithCoins`.
- Launch coin packs 30/50/100/250 confirmed by
  `scripts/verify-commercial-config.mjs` (024 launch coin packs migration).

### Wallet — COMPLETE (read); purchase path PARTIAL

Server wallet read is COMPLETE. Android top-up purchase goes through the
Google Play billing boundary (`POST /api/v1/billing/google-play`); the
client billing service (`apps/android/src/billing/googlePlay.ts`) is a
`not_configured` stub and `devHarness.ts` is dev-only — real Play purchase
integration UNVERIFIED / PARTIAL.

Real Google Play Billing is **EXTERNALLY BLOCKED — D-U-N-S / Play organization
+ current availability; expected unavailable approximately one month from
2026-09-02; re-check before resuming.** Preserve the trusted path: Play token
-> trusted backend -> Google verification -> `PENDING` / `PURCHASED` /
`INVALID` -> server-authoritative grant -> acknowledge/consume as applicable
-> Restore/Sync -> P05 -> RTDN lifecycle reconciliation. Do not fabricate
purchases, prices, token verification, Restore/Sync, or client-authoritative
Coins/Plus.

### Episode unlocks — COMPLETE (coin path); rewarded PARTIAL

- Coin unlock: RPC-managed, idempotent statuses
  (`already_owned`, `active_subscription`, `already_accessible`,
  `insufficient_balance`, `purchase_success`).
- Persistent unlock behavior preserved: `episode_entitlements` checked
  before subscription (`entitlements.ts` ordering); previously unlocked
  content stays unlocked regardless of later config/subscription state.

### Subscriptions — COMPLETE (server authority)

- `subscriptions` table; `hasActiveSubscription` / `getUserSubscription`
  (`entitlements.ts`) fail closed on lookup errors/windows.
- Only explicit `plus_access === true` episodes are Plus-eligible.
- Quality ceiling: `resolvePlaybackMaxResolution` 720p guest / 1440p Plus.
- Billing boundary route accepts `kind: "subscription"`; real Play purchase
  same PARTIAL caveat as wallet/coins.

### Rewarded ads — PARTIAL (multi-completion in progress)

- Tables/RPCs: `rewarded_ad_attempts` +
  `create_rewarded_ad_attempt`, `get_rewarded_ad_attempt_status`,
  `finalize_rewarded_ad_callback` (011 rewarded-ad foundation).
- Client flow: create attempt → AdMob show → SSV webhook verify → poll
  status. Access modes `permanent | session`;
  `rewarded_access_mode`, `rewarded_unlock_enabled`,
  `required_rewarded_completions` (launch 1–2, `src/lib/cms/constants.ts`).
- Multi-completion: migration `20260830093000_027_rewarded_multi_completion.sql`
  (adds `rewarded_monetization_events`, `record_rewarded_event`,
  `get_rewarded_progress`, redefines attempt RPCs) plus untracked
  `src/lib/rewarded-*.ts`/tests and `monetization/rewarded-events` route —
  IN-PROGRESS / uncommitted.
- `ad_unit` production pin required for SSV acceptance (fail closed).

### Short-film access (Chai tipping) — COMPLETE (ledger + route)

- `creator_accounting_destinations`, `short_film_chai_destinations`,
  `chai_allowed_coin_amounts` (launch amounts 025), `chai_tip_requests`,
  `chai_ledger_entries` (010).
- Route `POST /api/v1/short-films/[slug]/chai` →
  `submit_short_film_chai_tip`; Android `submitShortFilmChaiTip`
  client function + Chai amount/confirm screens.
- Short-film ad-break state persisted in watch_progress
  (`ad_break_state`).

### Play Together / 0chat Coin access — SOURCE VERIFIED (unapplied)

PX01-B2E-B1 source now adds an unapplied, additive migration
(`20260901190000_px01_b2e_b1_acquisition_intent_coin_access.sql`) for
backend-controlled 0chat commercial config, server-owned acquisition intents,
and atomic room-scoped Coin acquisition.

Launch config in source:

- `coin_price = 5`
- `required_rewarded_completions = 1`
- Rewarded model/config prepared only; Rewarded acquisition is NOT operational.

Source boundaries:

- Coin purchase writes `coin_transactions.transaction_type =
  'play_together_0chat'`.
- Coin access creates `play_together_room_access_grants` only; it does not
  create `episode_entitlements`.
- Host Coin acquisition creates the final room + Host participant + Host room
  grant in one SQL function after access validation.
- Guest Coin acquisition binds through hashed invite context and does not
  consume the invite; the existing JOIN flow later recognizes the room grant.
- Plus short-circuits before debit; no post-commit refund/reversal system is
  introduced.

Runtime/concurrency proof remains UNVERIFIED until the migration is applied to a
safe test database and exercised transactionally.

PX01 production hardening remains required: concurrency/idempotency runtime
tests across Coin/Chai/Rewarded/PX01; one authoritative room Auto-Next;
per-participant episode authorization; and account-deletion FK/nullability
verification for rooms, participants, and messages. Analytics must never carry
tokens, OTP, phone, purchase tokens, or signed playback URLs.

### Entitlements — COMPLETE

`episode_entitlements` (user_id, episode_id, window); read helpers
`hasValidEpisodeEntitlement`, `getValidEpisodeEntitlementIds`,
`getEpisodeAccessStates` (free/owned/included/locked).

### Purchase/payment verification — COMPLETE (server path)

- `payment_orders`, `google_play_purchases`, provider product mapping
  (`payment_provider_products`); `credit_verified_coin_purchase` only credits
  verified orders; google-play mapping immutability + trigger privileges
  migrations (20260820133935, 20260820134607); verified-inactive fulfillment
  allowed migration (20260820131555).
- `POST /api/v1/billing/google-play` is the client boundary that reports
  purchase/restore; server verifies.

### Playback authorization — COMPLETE

Server-authorized Mux signed playback/preview URLs; access → classification →
parental → entitlement → media readiness → resolution → signing.
Client only requests; never self-grants. See `0nya-playback-access`.

### Persistence behavior

- Watch progress: `watch_progress` (series_episode + short_film), resume
  semantics (`getResumePositionSeconds`: completed or within 5s of end = 0),
  Continue Watching = non-completed rows ordered by last_watched_at
  (`getContinueWatching`, limit 12), guest local history merged at sign-in.
- Entitlement window persistence independent of subscription.

## Security-sensitive highlights

- `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` drive the admin client
  (`src/lib/supabase/admin.ts`) — names only, never values.
- Mux signing private key (`MUX_PLAYBACK_SIGNING_PRIVATE_KEY`) — server only,
  used for signed playback URLs.
- AdMob SSV verifier keys fetched from Google (`gstatic.com/admob/reward/
  verifier-keys.json`) with 24h cache; invalid signature → 403.
- Replay/idempotency: rewarded attempts keyed by `custom_data`,
  `finalize_rewarded_ad_callback` idempotent per provider transaction; coin
  purchase RPC returns already-owned/accessible statuses.

## Relevant paths (evidence)

`src/lib/{entitlements,purchases,payments,rewarded-ads,playback,chai,watch-progress,classification,parental-controls,monetization}.ts`;
`src/app/api/v1/{wallet,me,billing/google-play,episodes/[episodeId]/{purchase,rewarded,rewarded/progress},rewarded-ad-attempts/[customData],monetization/rewarded-events,playback,playback/preview,short-films/[slug]/chai}/route.ts`;
`src/app/api/webhooks/admob/ssv/route.ts`; `apps/android/src/lib/{api,adMob,episodeRewardedUnlockAd}.ts`,
`apps/android/src/screens/{Wallet,CoinPurchase,Plus,EpisodeAccessOptions,ShortFilmChai*}`,
`apps/android/src/billing/*`;
`supabase/migrations/*.sql`;
`scripts/verify-commercial-config.mjs`.

## Do-not-reimplement

Rewarded SSV verification; verified coin credit RPC; coin purchase RPC;
entitlement window checks; Plus resolution ceiling; server playback
authorization; welcome coin grant.

## Pending/blocked

- Play Billing real purchase/restore (client stub) — PARTIAL + EXTERNALLY
  BLOCKED during the current availability window. Return point: `B08 real
  Google Play Billing implementation + store configuration + server
  verification + Restore/Sync + physical-device E2E`.
- Rewarded multi-completion flow + monetization events — in-progress.
- Any rollout of subscription/coin-pack pricing beyond launch config —
  treat as CMS/store controlled; verify authority docs before changing.
