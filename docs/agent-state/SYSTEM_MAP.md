# 0nya System Map

Snapshot generated from repository evidence. See `README.md` in this
directory for authority and status vocabulary. Verify against current code
before relying on it.

## What 0nya is

0nya is a mobile-first micro-drama / short-film streaming product. The
consumer app is a React Native (Expo) Android application; the backend and
editorial CMS are a single Next.js (App Router) application; persistence is
Supabase (Postgres). Monetisation is coin unlocks, rewarded-ad unlocks, Chai
(coin tipping) on short films, and 0nya Plus subscriptions.

## Repository architecture — actual paths

| Area | Path |
| --- | --- |
| Android consumer app | `apps/android/` (Expo ~57, React Native 0.86) |
| Android entry | `apps/android/App.tsx`, `apps/android/index.ts` |
| Backend + CMS (Next.js root app) | `src/` (root of repo) |
| API routes (Android-facing) | `src/app/api/v1/**/route.ts` |
| Webhooks | `src/app/api/webhooks/admob/ssv/route.ts`, `src/app/api/webhooks/mux/route.ts` |
| CMS admin | `src/app/admin/` |
| Consumer web pages | `src/app/{account,login,signup,plans,purchase,series,short-films,wallet,watch}` |
| Server logic | `src/lib/` |
| Supabase schema/migrations | `supabase/` (numbered migrations + SQL files) |
| Local Supabase config | `supabase/config.toml` (project `0nyapp`) |
| Shared data/type layer | `src/data/content.ts`, `src/types/` |
| Scripts | `scripts/` |
| Cloud Run container | `Dockerfile` |
| Authority/product docs | `docs/` (see README authority list) |
| Android agent rules | `apps/android/AGENTS.md` (Expo versioned-docs note) |
| QA evidence | `docs/qa/`, `docs/android-performance-checkpoint-2026-08-28.md`, root `emulator_*.png`, `test_device.png` |

Note: `0nya_autonomous/` is a separate autonomous-governance simulation
subsystem (Python). Per its ADR-009 it must not touch the existing 0nya app.
It is not the product surface documented here.

## Runtime data flow (verified)

### Android → API → backend → Supabase

```
Android (apps/android/src/lib/api.ts)
→ Bearer token (Supabase access token; 401 triggers refreshSession retry)
→ /api/v1/* routes (src/app/api/v1)
→ getApiAuth(request) (src/lib/api/auth.ts) resolves user
→ server logic in src/lib/* (admin/session client)
→ Supabase (admin client / service-role or user-scoped client)
→ response envelope (data | error) → Android
```

Catalog/series responses are cached client-side with a 15s TTL and deduped
per auth scope (`src/lib/api.ts`).

### CMS → API/backend → persistence → Android-consumed representation

```
src/app/admin/* (server components + client forms)
→ src/lib/cms/* (server-only admin logic via createAdminClient)
→ Supabase tables (series, episodes, short_films, home_rows, media_assets, ...)
→ src/lib/catalog.ts + src/lib/api/serializers.ts (public representation)
→ /api/v1/catalog, /api/v1/series/[slug], /api/v1/short-films/[slug]
→ Android
```

CMS admins are authorized by the `cms_admins` table +
`is_cms_admin()` RPC. Consumer-facing API surfaces are distinct from CMS
routes.

### Playback → access decision → playback authorization → player

```
Android PlaybackAuthorizationRequest
→ POST /api/v1/playback (or /playback/preview)
→ src/lib/playback.ts authorizeMuxPlayback / authorizeMuxPreviewPlayback
→ content lookup (published status + release time)
→ classification / parental / age gate (src/lib/classification.ts,
   src/lib/parental-controls.ts)
→ canUserWatchEpisode (src/lib/entitlements.ts: free → entitlement → Plus;
   fail closed for guests)
→ media_assets readiness check
→ resolvePlaybackMaxResolution (720p guest / 1440p Plus)
→ Mux signed playback URL (src/lib/mux/*)
→ Android player (apps/android/src/player/*)
```

## Authority map

Authoritative layer proven by repository evidence (`src/lib/entitlements.ts`,
`src/lib/playback.ts`, `src/lib/purchases.ts`, `src/lib/rewarded-ads.ts`,
`src/lib/supabase/admin.ts`).

| Concern | Authoritative layer |
| --- | --- |
| Identity | Supabase Auth (server-verified on every API request, `src/lib/api/auth.ts`) |
| Profile | Supabase `profiles` table (created by `handle_new_user`) |
| Content / catalog | Supabase `series`, `episodes`, `short_films` (published status enforced server-side) |
| Editorial Home data | Supabase `home_settings`, `home_rows`, `home_row_items` (`src/lib/home.ts`, `src/lib/cms/home.ts`) |
| Playback history | Supabase `watch_progress`; guest history is device-local and merged after sign-in |
| Entitlements | Supabase `episode_entitlements` (server window check) |
| Wallet / coin balance | Supabase `wallets` (server only; `GET /api/v1/wallet`) |
| Coin credits | Server/RPC `credit_verified_coin_purchase`; `purchase_episode_with_coins` |
| Subscriptions | Supabase `subscriptions` (`hasActiveSubscription`, fail closed) |
| Pricing | CMS/store-controlled (`coin_products`, subscriptions); never hardcode into clients (AGENTS.md rule 5) |
| Rewarded rewards | AdMob SSV webhook signature verification + `finalize_rewarded_ad_callback`; never a client "ad completed" flag |
| Playback authorization | Server (`src/lib/playback.ts`) → Mux signed URLs. Client is never authoritative |

## Important entry points

- Backend/CMS: `src/app/page.tsx`, `src/app/admin/page.tsx`,
  `src/app/api/v1/*/route.ts`
- CMS admin login: `src/app/admin/login/`, `src/components/admin/*`
- Android: `apps/android/App.tsx`, `apps/android/src/navigation/MainTabs.tsx`,
  `apps/android/src/navigation/linking.ts`
- Client API facade: `apps/android/src/lib/api.ts`
- Server Supabase clients: `src/lib/supabase/{admin,server,client,env,proxy}.ts`
- Mux: `src/lib/mux/*`
- Serializers: `src/lib/api/serializers.ts`, `src/lib/catalog.ts`
- Root config: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`

## API surface (families, not implementations)

Verified under `src/app/api/v1/`:

- `account/delete`, `account/parental-controls`
- `billing/google-play` (purchase/restore boundary)
- `catalog`
- `episodes/[episodeId]/purchase`, `episodes/[episodeId]/rewarded`,
  `episodes/[episodeId]/rewarded/progress`
- `me`
- `monetization/rewarded-events`
- `playback`, `playback/preview`
- `play-together/acquisitions`, `play-together/acquisitions/[intentId]/coin`
  (uncommitted PX01 source foundation; deployed runtime UNVERIFIED)
- `rewarded-ad-attempts/[customData]`
- `series/[slug]`
- `short-films/[slug]`, `short-films/[slug]/chai`
- `wallet`
- `watch-progress`

PX01 source foundation uses server-owned room/access state and keeps room
acquisition separate from per-participant episode authorization. SOURCE-LEVEL
PX01-D playback-sync foundation exists (backend sync-tuning columns/config seam
+ Realtime PRESENCE RLS on a separate `play_together_room_presence:<roomId>`
topic; Android inert sync adapter + pure helpers, gated by backend `enabled`
and an explicit room scope). Realtime room timeline synchronization and Android
0chat UI are NOT applied or proven at runtime.

Webhooks: `webhooks/admob/ssv`, `webhooks/mux`.
Dev-only: `api/dev/mux/local-operator`.

Consumer web pages use the same `/series/[slug]`, `/watch/[...]`,
`/short-films/[slug]`, `/wallet`, `/plans`, `/purchase` routes under
`src/app/`.

## Important environment variables

NAMES ONLY. Never write values. Secret values must never be documented.

Root (`src/` / Next.js):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_ONYA_CANONICAL_URL`
- `SUPABASE_SECRET_KEY` (server key; fallback `SUPABASE_SERVICE_ROLE_KEY`)
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_PLAYBACK_SIGNING_KEY_ID`
- `MUX_PLAYBACK_SIGNING_PRIVATE_KEY`
- `MUX_WEBHOOK_SIGNING_SECRET`
- `MUX_DIRECT_UPLOAD_CORS_ORIGIN`
- `ADMOB_REWARDED_AD_UNIT_ID` (SSV ad-unit pin, `webhooks/admob/ssv`)

Android (`apps/android/`, EXPO_PUBLIC_*), see `src/config/env.ts`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_ONYA_API_BASE_URL`
- `EXPO_PUBLIC_ONYA_CANONICAL_URL`
- `EXPO_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID`
- `EXPO_PUBLIC_ONYA_DEV_BILLING_HARNESS`
- `EXPO_PUBLIC_ONYA_TEST_MUX_PLAYBACK`
- `EXPO_PUBLIC_ONYA_TEST_SHORT_FILM_MUX_PLAYBACK`

`apps/android/.env` and `apps/android/.env.local` exist locally — treat as
secret-bearing; never read, print, or commit values.

## Approved infrastructure — 31 August 2026

Explicit user-approved project decision (31 August 2026).

```
ANDROID APP
      |
      v
GOOGLE CLOUD RUN QA API
https://onya-qa-api-gwkke6nq5a-el.a.run.app
      |
      +---- backend / API
      |
      +---- CMS / admin  (/admin/login)
      |
      +---- server integrations
              |
              +---- Supabase  (database/data)
              |
              +---- Mux      (video/media)

NETLIFY
      |
      +---- website / frontend / domain hosting
```

Evidence class:
EXPLICIT PROJECT / EXTERNAL STATE
(unless separately repository/runtime verified).

Approved roles:

- QA API / server / backend runtime: Cloud Run
  (`https://onya-qa-api-gwkke6nq5a-el.a.run.app`).
- QA CMS / admin: same Cloud Run host, `/admin/login`.
- Netlify: website / frontend / domain hosting only — NOT the active QA API,
  QA backend runtime, or CMS/admin backend.
- Supabase: database / data layer. Preserve; never point physical Android QA
  at localhost Supabase.
- Mux: approved video/media infrastructure.
- Android playback: expo-video (preserve).

Provider/hosting approval does NOT imply production readiness of media
(signed playback authorization, CDN/security config), security, API routes,
or deployment. Verify those separately.

## Deployment/environment map

- `Dockerfile` builds a Cloud Run image from the Next.js app (`next start`,
  secret mounts at build; no `.env*` copied).
- `apps/android/eas.json` defines EAS builds: development, preview (QA env),
  production. Android package id: `com.onya.app`. Preview env pins
  `EXPO_PUBLIC_ONYA_API_BASE_URL` to the approved Cloud Run QA API.
- `.env.example` (root) documents required env names.
- Current branch at snapshot time: `qa/netlify-api-e34ab5e` with a large
  uncommitted working tree (see `RELEASE_CURRENT_STATE.md`).
- Live deployment status is NOT inferred here; verify externally.
  UNVERIFIED unless proven by current evidence.
- Do not direct Android API calls to an old Netlify QA API address; Netlify
  is website/frontend/domain hosting only.