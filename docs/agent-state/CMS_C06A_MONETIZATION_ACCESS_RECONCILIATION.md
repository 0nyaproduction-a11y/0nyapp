# CMS-C06A — Monetization & Access Configuration: Current-State Reconciliation

**Mode:** READ-ONLY (no edits, no CMS data changes, no deploy, no migration, no Android changes).
**Roadmap:** CMS-C06 — Monetization & Access Configuration
**Authority:** CMS configures. Server remains financial / entitlement authority. (AGENTS.md rule 7; 0nya_monetization_security; 0nya-playback-access)
**Verified against (this pass):** current working-tree source `src/lib/{cms,entitlements,playback,purchases,rewarded-ads,rewarded-config,chai,catalog,api/serializers}.ts`; CMS UI `src/components/cms/{EpisodeMetadataForm,ShortFilmMetadataForm,ShortFilmChaiConfigForm}.tsx` + admin pages `src/app/admin/{series/\...,short-films/\...}/[id]/page.tsx`; server actions gating on `requireCmsAdmin` + `createAdminClient()`; migrations `002/006/007/009/010/024/025/027/032/033`; legacy seed `supabase/002_content_catalog.sql`; webhooks `app/api/webhooks/admob/ssv/route.ts`; Android consumer `apps/android/src/` (read-only). Pure-logic test suite run: **44 pass / 16 skipped / 0 fail** (`npx tsx --test` over `episode-access`, `rewarded-config`, `rewarded-backend`, `short-film-chai-authoring`, `series-episode-authoring`, `catalog-visibility`). The 16 skipped are DB-backed RPC short-circuit tests requiring a live Supabase. `src/lib/playback-w01.test.ts` is environment-blocked only (Next.js 16 internal module `../web/spec-extension/adapters/request-cookies` unresolvable under `tsx` in this sandbox) — NOT a code defect; it does not alter any monetary/access authority.

> Scope: trace each CMS-controlled monetization/access field UI → server action → DB → consumer/API authority; classify each control; confirm authority boundaries; flag duplicated/missing/unsafe controls. This is a *reconciliation*, not an implementation spec. Implementation planning is CMS-C06B.

All write paths flow through **server actions** that re-gate on `requireCmsAdmin` (fail-closed CMS auth) and use `createAdminClient()` (service role) to write. Consumer-facing tables have **insert/update/delete revoked from `anon`/`authenticated`** (RLS, `supabase/002_content_catalog.sql`), so consumers cannot mutate any commercial field. Reads are served through the catalog serializers into `/api/v1/series/[slug]` and `/api/v1/short-films/[slug]`.

## 1. Trace chains (UI → server action → DB → consumer/API authority)

### FREE ACCESS
`EpisodeMetadataForm` `isFree` checkbox → `parseEpisodeFormData` → `createEpisode`/`updateEpisode` writes `episodes.is_free` → `mapEpisode`/`serializeEpisode` → `GET /api/v1/series/[slug]` → Android `ApiEpisode.isFree` → Server authority: `entitlements.canUserWatchEpisode` (`if episode.isFree return true`, guests included). `buildAccessSummary` surfaces "Free".

### COIN UNLOCK
`EpisodeMetadataForm` `coinUnlockEnabled`+`coinPrice` → `parseEpisodeFormData` → writes `coin_unlock_enabled`,`coin_price` → DB CHECK `episodes_coin_unlock_requires_price` (`006`) → `mapEpisode`/`serializeEpisode` → API → Android → `purchases.purchaseEpisodeWithCoins` → RPC `purchase_episode_with_coins` (security-definer, `auth.uid()`) → debits `wallets.coin_balance`, inserts `coin_transactions`, inserts `episode_entitlements` `expires_at=NULL` (permanent). Idempotent: `already_owned`/`already_accessible`/`insufficient_balance`/`active_subscription`.

### COIN PRICE (per-episode)
Same trace as COIN. CMS-controlled editorial value; **never** a store price. RPC reads `episodes.coin_price` at purchase; client cannot set it.

### COIN PRODUCTS (packs 30/50/100/250)
`public.coin_products` (`supabase/005_wallet_topups.sql`) maps Google-Play product codes → coin amounts. **Not exposed in CMS** — seeded only via migration `024`. Localized prices live in Google Play store metadata. No CMS admin page exists (admin pages: `login`, `reset-password`, `home`, `media`, `series`, `short-films`).

### REWARDED
`EpisodeMetadataForm` `rewardedUnlockEnabled` → `parseEpisodeFormData` → writes `rewarded_unlock_enabled` → DB `episodes.rewarded_unlock_enabled` (default false) → `mapEpisode`/`serializeEpisode` → API → Android `ApiEpisode` → `rewarded-ads.createRewardedAdAttempt` → RPC `create_rewarded_ad_attempt` (`033`, security-definer, `auth.uid()`) snapshots `rewarded_access_mode_snapshot='permanent'` + `required_completions_snapshot` onto the attempt row → AdMob SSV `POST /api/webhooks/admob/ssv` → `apps/api/webhooks/admob/ssv/route.ts` verifies ECDSA/SHA-256 vs Google verifier keys (fail-closed `ad_unit` pin in production) → RPC `finalize_rewarded_ad_callback` (`service_role` only) → grants permanent `episode_entitlements`. SSV verification server-side; client never credits.

### REWARDED COMPLETION COUNT
`EpisodeMetadataForm` `requiredRewardedCompletions` select (1/2) → `parseEpisodeFormData` clamps 1..2 (`clampRewardedRequiredCompletions`) → writes `required_rewarded_completions` → DB CHECK (`027`, between 1 and 2) → `mapEpisode`/`serializeEpisode` → API → Android → RPC reads episode row; attempt uses snapshot. `lib/rewarded-config.ts` `isIndependentlyConfigured` documents the value is NOT derived from coin price (Phase 15 commercial guard). `getRewardedProgress` returns `required_completions` to Android for 1/2→2/2 UI.

### PLUS
`EpisodeMetadataForm` `plusAccess` checkbox (default true) → `parseEpisodeFormData` → writes `plus_access` → DB `episodes.plus_access` (default true, `006`) → `mapEpisode`/`serializeEpisode` → API → Android → Server authority: `entitlements.canUserWatchEpisode` (`plusAccess === true && hasActiveSubscription`). `hasActiveSubscription` reads `public.subscriptions` (Google Play lifecycle), fail-closed on missing/undefined. Plus authority NOT relocated to CMS; the flag only *gates* whether a subscriber may access.

### PREVIEW DURATION
`EpisodeMetadataForm` `lockedPreviewSeconds` (0–5) → `parseEpisodeFormData` → writes `locked_preview_seconds` → DB CHECK `episodes_locked_preview_seconds_check` between 0 and 5 (`032`, tightened from 0..3 in `006`) → `mapEpisode`/`serializeEpisode` → API → Android → `POST /api/v1/playback/preview` → `lib/playback.ts` `resolvePreviewPlayback` reads `episode.locked_preview_seconds` from the **same main `media_asset_id`** (no separate preview clip; `preview_media_asset_id` unused LEGACY/COMPAT schema, `016`) → `createMuxSignedPreviewPlaybackUrl(...,previewSeconds,…)` returns `previewUrl`+`previewSeconds` only for viewers who cannot watch; `preview_not_required` if `canWatch`. Full `/api/v1/playback` returns `access_required` for locked episodes. Client timer is defense-in-depth only; boundary is server-limited Mux preview JWT (W01).

### SHORT FILM ADS / Chai CONFIG
Admin short-film page → `ShortFilmMetadataForm` (midroll/postroll/chai) + `ShortFilmChaiConfigForm` (chai enable + global amounts) → `parseShortFilmFormData`/`updateChaiConfigAction` (server action, `requireCmsAdmin`) → `updateShortFilm` writes `midroll_enabled`,`midroll_timecodes`,`postroll_enabled`,`chai_enabled`; `updateShortFilmChaiEnabled` → `short_films.chai_enabled`; `lib/cms/chai.ts` `updateChaiAllowedCoinAmount` → global `chai_allowed_coin_amounts` (5/10/20/50 from seed `025`). Mid-roll enforced by DB CHECK (`009`: `not midroll_enabled or cardinality(midroll_timecodes) > 0`). `short_films` has NO coin/plus/rewarded columns → Short Films structurally never coin-locked, never subscriber-only. `mapShortFilm`/`serializeShortFilm` → `GET /api/v1/short-films/[slug]` → Android `ApiShortFilm`. Chai tip → `submitShortFilmChaiTip` RPC (atomic debit + creator ledger credit + idempotency key). Chai = 0nya coin tip (same wallet), not cash/UPI. Plus suppresses Short Film ads at consumer runtime.

### COMMERCIAL-FIELD PERMISSIONS
- RLS (`002`/`009`): `revoke insert, update, delete on episodes/short_films from anon, authenticated; grant select` → consumers only read published rows.
- Writes through CMS server actions: each calls `requireCmsAdmin` (fail-closed) then `createAdminClient()`. No consumer write path for any commercial field.
- `purchase_episode_with_coins`, `create_rewarded_ad_attempt` are `security definer` granted to `authenticated` but consume only `auth.uid()` and existing episode config — they **consume**, never set, pricing/unlock config. `finalize_rewarded_ad_callback` is `service_role` only.

### INCOMPATIBLE-COMBINATION VALIDATION (server-enforced, server-authored)
- Coin unlock w/o price: DB CHECK + `validateEpisodeAccessInput` → `coinPrice` error.
- Rewarded completions 1..2: DB CHECK (`027`) + CMS clamp.
- Rewarded permanent-only: DB CHECK (`033`, `rewarded_access_mode = 'permanent'`) + CMS `REWARDED_ACCESS_MODES=['permanent']` + RPC hardcodes `'permanent'`; `session` structurally rejected.
- Locked preview 0..5: DB CHECK (`032`) + CMS validation.
- Classification vocabulary: DB CHECK (`007`) + CMS validation.
- `is_free` true alongside coin/rewarded/Plus: allowed by design — purchase/RPC short-circuit free episodes to `already_accessible` (not invalid; see `episode-access.test.ts`: "free plus interactive access methods remain a valid combination").
- Mid-roll enabled w/o timecodes: DB CHECK enforces (fail-closed); CMS `validateShortFilmInput` does **not** mirror this guard (UX gap only; see §3 PARTIAL).

## 2. Authority boundaries (explicit confirmations)

| Boundary | Preserved? | Evidence |
|---|---|---|
| Server remains financial/entitlement authority | YES | `entitlements.canUserWatchEpisode`, `purchase_episode_with_coins`, `subscriptions` (Google Play), `finalize_rewarded_ad_callback` (service_role + SSV), `submitShortFilmChaiTip`. |
| Client not authoritative (identity/wallet/balance/entitlement/price/payment/reward/ad/playback) | YES | AGENTS.md rule 7; SYSTEM_MAP flow; MONETIZATION_CURRENT_STATE §Server/client authority. |
| Coin entitlement permanence unchanged | YES | RPC inserts `episode_entitlements expires_at=NULL`; `006` comment unchanged. |
| Coin purchase idempotent | YES | `already_owned`/`already_accessible`/`insufficient_balance`/`active_subscription`. |
| Rewarded SSV verification server-side | YES | `apps/api/webhooks/admob/ssv/route.ts` ECDSA verify; `finalize_rewarded_ad_callback` service_role-only; `transaction_conflict` replay guard; 15-min expiry. |
| Rewarded progress recovery server-side | YES | `GET /api/v1/episodes/:id/rewarded/progress` → `get_rewarded_progress` RPC (not client-stored). |
| Plus authority NOT moved to CMS | YES | Resolved from `subscriptions` (Google Play) server-side; `plus_access` flag only gates subscriber access. |
| Preview duration ownership | YES — server | `resolvePreviewPlayback` reads `episode.locked_preview_seconds`; signed Mux preview JWT; client consumes only `previewSeconds`. |
| Short Films never coin-locked / subscriber-only | YES — structural | `short_films` has no coin/plus columns (`009`); `resolveShortFilmPlayback` has no coin/Plus gate. |
| Episode access independently configurable | YES | Access columns per-row on `episodes`; no series-level override; CMS edits per episode. |
| No hardcoded episode-4 / first-three-free runtime rule | YES — runtime is episode-number-agnostic | `canUserWatchEpisode`, `purchase_episode_with_coins`, `create_rewarded_ad_attempt`, `get_rewarded_progress` select on `episodes` by id and read access columns; none branches on `episode_number`. (Seed/mock-data caveat in §4.) |



## 3. Per-control classification

FREE: PASS · COIN: PASS · COIN PRICE: PASS · COIN PRODUCTS: MISSING · REWARDED: PASS · REWARDED COMPLETION: PASS · PLUS: PASS · PREVIEW DURATION: PASS · SHORT FILM ADS: PASS · Chai: PASS · COMMERCIAL-FIELD PERMISSIONS: PASS · INCOMPATIBLE-COMBINATION VALIDATION: PASS · SHORT-FILM MID-ROLL GUARD: PARTIAL.

### PASS (all confirmed server/gated)
FREE, COIN, COIN PRICE (per-episode), REWARDED, REWARDED COMPLETION COUNT, PLUS, PREVIEW DURATION, SHORT FILM ADS, Chai, COMMERCIAL-FIELD PERMISSIONS, INCOMPATIBLE-COMBINATION VALIDATION. All commercial writes require `requireCmsAdmin` + service-role; consumers read-only; DB CHECKs enforce bounds; SSV/RPCs fail-closed.

### PARTIAL
- **Short-film mid-roll guard**: DB CHECK (`009`: `not midroll_enabled or cardinality(midroll_timecodes) > 0`) enforces fail-closed at the layer, but CMS `validateShortFilmInput` (`cms/short-films.ts`) does **not** mirror the check — an admin enabling mid-roll with empty timecodes receives a generic DB error rather than a field-level CMS message. No authority violation; UX gap only.

### MISSING
- **Coin PRODUCTS not in CMS**: `coin_products` (30/50/100/250) seeded via migrations `005`/`024` only; no CMS editor for list/enable/reorder/quantity-edit. (Store prices correctly remain Google-Play-side.)
- **No CMS guard for "non-free episode with no unlock method"**: a published episode can be saved `is_free=false` with coin/rewarded/Plus all off → `buildAccessSummary` shows "Not configured"; server still fails closed with `access_required`. No monetary-authority violation, but no editor warning.

### DUPLICATED / COSMETIC
1. **Rewarded-completion bounds declared in two modules**: `cms/constants.ts` (`MIN=1`, `MAX=2`, `REQUIRED_COMPLETIONS_VALUES=[1,2]`, `clampRewardedRequiredCompletions`) and `lib/rewarded-config.ts` (own MIN/MAX/VALUES + duplicate clamp + `isIndependentlyConfigured`). Same 1..2 bounds independently declared — consolidation candidate for CMS-C06B.
2. **`rewardedAccessMode` UI control is cosmetic**: `EpisodeMetadataForm` renders a select offering "Permanent", but `parseEpisodeFormData` hardcodes `rewardedAccessMode: "permanent"` (ignores the submitted value). Redundant UI; DB CHECK `033` + RPC are authoritative. Safe but dead/misleading.

### UNSAFE
None crossing the authority boundary. `free + coin + rewarded + Plus` is valid by design (purchase/RPC short-circuit free episodes to `already_accessible`). No CMS field can grant wallet/entitlement/subscription/SSV-credit/playback-authorization.

### SOURCE-ONLY / NON-RUNTIME
- `src/lib/monetization/events.ts` — types/analytics bridge, no I/O or DB writes.
- `src/data/content.ts` — dev/preview static catalog only; Android reads live `ApiEpisode`, never this mock.
- `supabase/002_content_catalog.sql` — legacy root `supabase/` seed (local dev only), not runtime logic.



## 4. Hardcoded Episode-4 / first-three-free — detailed finding
- **Runtime code: NO.** `canUserWatchEpisode`, `purchase_episode_with_coins`, `create_rewarded_ad_attempt`, `get_rewarded_progress` select `episodes` by id and read the access columns only — none branches on `episode_number`.
- **Seed/mock data: YES (local-dev only).** `supabase/002_content_catalog.sql` seeds *chaadar* episodes 1–3 `is_free=true` and ep4+ paywalled; `UPDATE … WHERE episode_number=4 AND series.slug='chaadar'` sets `rewarded_unlock_enabled=true, plus_access=false`. `src/data/content.ts` mock mirrors this sample.
- **Classification:** seed/sample only — not a code-enforced rule. Consumer Android derives access from live `ApiEpisode`, not the mock. Stale-assumption risk: the seed sample still encodes "episode 4 paywall". Recommend CMS-C06B neutralize sample values in seed/mock.

## 5. High-collision files (CMS-C06B planning surface)
- `src/lib/cms/episodes.ts`, `src/lib/cms/episode-access.ts`, `src/lib/cms/episode-form.ts`, `src/lib/cms/constants.ts` — validation + persistence.
- `src/lib/rewarded-config.ts` — duplicated bounds constants (consolidation candidate).
- `src/components/cms/EpisodeMetadataForm.tsx` — cosmetic `rewardedAccessMode` select.
- `src/lib/catalog.ts`, `src/lib/api/serializers.ts` — consumer shape (additive only).
- `src/lib/{entitlements,playback,purchases,rewarded-ads}.ts` — server authority (do NOT alter).
- `supabase/migrations/006,007,009,027,032,033` + `002` RLS — already enforce bounds; do not weaken.
- `apps/android/**` — read-only verification surface; do not modify.

## 6. Safe implementation slices (next-step suggestions — NOT committed here)
1. **Coin PRODUCTS CMS editor** — list/enable/reorder `coin_products` quantities on a new `/admin/billing` page via admin action; prices remain Google-Play-side. No schema change (table + seed already exist).
2. **Deduplicate reward-completion bounds** — single source of truth (prefer `cms/constants.ts`); drop the duplicate in `rewarded-config.ts` (keep `isIndependentlyConfigured`).
3. **Remove cosmetic `rewardedAccessMode` select** from `EpisodeMetadataForm`; replace with a server-confirmed disabled field showing "Permanent".
4. **Mirror mid-roll guard in `validateShortFilmInput`** for field-level CMS messaging (DB CHECK `009` stays as backstop).
5. **Neutralize episode-4 sample** in `supabase/002_content_catalog.sql` seed + `src/data/content.ts` mock.

## 7. Verification (this step — source only)
- Trace fields against `src/` and `supabase/migrations/` + `supabase/*.sql` in the working tree: all traces above confirmed.
- Pure-logic test suite (episode-access / validation / entitlements / RPC short-circuits): 44 pass, 16 skipped (DB-backed), 0 fail.
- No CMS data writes, no migrations, no deploys, no Android changes were made.
- Runtime / Cloud Run QA API + CMS website runtime + Product Owner hands-on verification is the **next** gate (see Locked Final Acceptance Protocol).
- Environment caveat: `src/lib/playback-w01.test.ts` could not execute in this sandbox (`Cannot find module '../web/spec-extension/adapters/request-cookies'` from `next/dist/server/request/cookies.js`). This is a Next.js-16-internal module-resolution defect under `tsx`, not a 0nya code defect, and does not change any monetization/access authority conclusion.

## 8. Status summary (per control)
- CMS C06A reconciled against source: all commercial-field write paths require CMS admin server actions + service role and are blocked from consumer mutation by RLS.
- Classification: PASS (core); PARTIAL (short-film mid-roll CMS mirror); MISSING (coin PRODUCTS editor; non-free/no-unlock guard); DUPLICATED/COSMETIC (rewarded-completion bounds; `rewardedAccessMode` select).
- Status: **SOURCE VERIFIED** → `READY FOR EMULATOR / PRODUCT OWNER + CHATGPT REVIEW` (CMS website runtime check + owner hands-on per Locked Final Acceptance Protocol).

