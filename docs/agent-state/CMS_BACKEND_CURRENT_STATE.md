# 0nya CMS + Backend Current State

Snapshot from repository evidence. Verify against `src/`, `supabase/` before
editing. Status vocabulary: COMPLETE / PARTIAL / PENDING / BLOCKED /
UNVERIFIED.

## Architecture

- Backend and CMS are one Next.js (App Router) application at the repo root
  (`src/`). Version noted in root `AGENTS.md`: this Next.js version has
  breaking changes — read `node_modules/next/dist/docs/` before writing code.
- Server logic lives in `src/lib/`; route handlers in `src/app/**/route.ts`;
  CMS pages in `src/app/admin/`; consumer web pages in `src/app/*`.
- Supabase access: `src/lib/supabase/admin.ts` uses a server secret key
  (env `SUPABASE_SECRET_KEY`, dev fallback reads local `supabase status`,
  legacy fallback `SUPABASE_SERVICE_ROLE_KEY`); `server.ts` is the cookie
  session client; `client.ts` is browser; `proxy.ts` shared.
- Next.js 16, React 19. Lint via `npm run lint` (eslint config
  `eslint.config.mjs`). Root `package.json` has a `test` script
  (`npx tsx --test ...`); current tree runs 346 pass / 2 fail / 12 skip.
  Unit tests (`*.test.ts`) exist (tracked + untracked).

## CMS routes/features (verified)

`src/app/admin/`: `page.tsx` (dashboard), `login/`, `reset-password/`,
`home/` (editorial Home management), `media/`, `series/`, `short-films/`.

Client components: `src/components/admin/*`
(`AdminLoginPanel`, `AdminForgotPassword`) and `src/components/cms/*`
(Series/Episode intake & metadata, `BulkEpisodeUploadForm`,
`EpisodeMediaAssignmentForm`, `MediaDirectUploadField`, `MediaAssetRefreshForm`,
`ShortFilmMetadataForm`, `ShortFilmChaiConfigForm`, `SeriesStatusForm`,
`DangerZoneDeleteForm`, `ArtworkUploadField`, `CmsSelect`, ...).

Server logic: `src/lib/cms/*` — `series.ts`, `episodes.ts`, `bulk-episodes.ts`,
`short-films.ts`, `short-film-form.ts`, `series-form.ts`, `episode-form.ts`,
`home.ts`, `artwork.ts`, `media.ts`, `video-intake.ts`, `subtitle-intake.ts`,
`upload-progress.ts`, `chai.ts`, `constants.ts`, `auth.ts`.

## Authentication/authorization

- CMS admins: `cms_admins` table + `is_cms_admin()` RPC
  (`src/lib/cms/auth.ts`, migrations `020_cms_admin_foundation.sql`,
  `20260828151544_repair_cms_admin_foundation.sql`). Forms/panels gate admin
  routes. Password recovery flow exists (`AdminForgotPassword`,
  `admin/reset-password/`; recent commit `fix: complete CMS password
  recovery flow`).
- Auth middleware for consumer API: `src/lib/api/auth.ts` resolves user from
  Bearer token (or cookie session) per request. Each v1 route enforces its
  own auth.
- Consumer sign-up/login pages under `src/app/{signup,login}`.

## Content management

- Model: `series`, `episodes`, `short_films` tables; `src/data/content.ts`
  static fallback catalog; `src/lib/catalog.ts` maps DB rows to the public
  consumer shape.
- Access/format metadata on episodes: `is_free`, `coin_price`,
  `coin_unlock_enabled`, `rewarded_unlock_enabled`, `rewarded_access_mode`
  (permanent | session), `required_rewarded_completions` (launch max 2,
  `src/lib/cms/constants.ts`), `plus_access`, `locked_preview_seconds`,
  classification overrides.
- Publish guardrail: `publish_series_with_episodes` RPC; a Series publish
  cascade migration exists (`022_series_publish_cascade.sql`); a short-film
  publish integrity guardrail is referenced in recent git log
  (`fix(cms): add fail-closed Short Film publish integrity guardrail`).

## Series/episode management

- `src/components/cms/SeriesMetadataForm`, `SeriesEpisodeManager`,
  `EpisodeMetadataForm`, `NewSeriesIntakeForm`, `BulkEpisodeUploadForm`;
  `src/lib/cms/{series,episodes,episode-form,series-form,bulk-episodes}.ts`.

## Artwork/media management

- `media_assets`, `subtitle_tracks` tables; Mux media foundation migrations
  (`011_media_assets_foundation`, `012_mux_video_foundation`,
  `014_content_artwork_storage_foundation`, `015_subtitle_foundation`).
- `src/lib/cms/{artwork,media,video-intake,subtitle-intake,upload-progress}.ts`
  + `src/lib/mux/*` + `src/lib/media.ts`, `src/lib/subtitles.ts`.
- Development media tooling: `scripts/mux-local-operator.mjs`
  (`npm run mux:operator`), `scripts/local-data-state.mjs`
  (`local:backup`/`local:restore`), dev route `api/dev/mux/local-operator`.

## Home/editorial configuration

- `home_settings` (e.g. key `low_history_threshold`), `home_rows`
  (`row_role`: start_here | editorial | spotlight), `home_row_items`
  (content_type + series_id/short_film_id + sort_order + show_title*).
- Consumer resolution: `src/lib/home.ts` `getHomeState`.
- Admin management: `src/lib/cms/home.ts` `getHomeAdminData` and
  `src/app/admin/home/page.tsx`.
- In-progress in working tree: home spotlight foundation
  (`023_home_spotlight_foundation.sql`), row item `show_title`
  (`026_home_row_items_show_title.sql`), `src/lib/cms/home.ts` + admin page
  updates — PARTIAL/uncommitted.

## API architecture

- Route handlers `src/app/api/v1/**`. Envelope helpers
  `src/lib/api/responses.ts` (`dataResponse` / `errorResponse`); API auth
  `src/lib/api/auth.ts`; perf helpers `src/lib/api/perf.ts`; serializers
  `src/lib/api/serializers.ts`.
- Render-path dynamic vs static handled by Next.js catalog plumbing
  (`src/lib/catalog.ts`, `generateStaticParams` noted in Dockerfile for
  series/watch pages).
- PX01-B2E-B1 source adds `POST /api/v1/play-together/acquisitions` and
  `POST /api/v1/play-together/acquisitions/[intentId]/coin` for
  server-authoritative 0chat acquisition intent creation and atomic Coin room
  access. Migration source is unapplied; runtime DB/API behavior remains
  UNVERIFIED until safe test deployment/application.

## Android-facing API surfaces

Verified routes (see also `SYSTEM_MAP.md`): catalog, series/[slug],
short-films/[slug], short-films/[slug]/chai, me, wallet, watch-progress,
playback, playback/preview, episodes/[id]/{purchase,rewarded,rewarded/progress},
rewarded-ad-attempts/[customData], billing/google-play, account/delete,
account/parental-controls, monetization/rewarded-events.

Contracts documented in `docs/0nya_BACKEND_API_CONTRACT_v1.0.md` (also
modified in working tree).

## CMS-facing API surfaces

CMS is server-rendered (`src/app/admin/*`) and calls Supabase directly via
`createAdminClient`; no separate REST CMS API found. Webhook ingress:
`webhooks/admob/ssv` (rewarded verification), `webhooks/mux` (media states).

## Configuration

- `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`.
- Env names: see `SYSTEM_MAP.md`. Secret values never documented.
- Commercial configuration lock: `scripts/verify-commercial-config.mjs`
  (node:test) validates launch coin packs (30/50/100/250),
  chai amounts, dev harness and Plus config against source-of-truth SQL +
  client files; recent commits `Build 15: lock launch commercial
  configuration`.

## Supabase integration

- Migrations: `supabase/migrations/` (numbered) plus legacy `supabase/*.sql`.
  Key families: auth/profiles (`handle_new_user`, welcome coin grant 018),
  catalog/episodes, entitlements + monetization (003/004/005/006 + Google
  Play foundation + `credit_verified_coin_purchase`),
  classification/parental controls (007/008/013), short films (009), chai
  ledger (010), media/mux/subtitles (011/012/014/015), locked preview (016),
  short-film watch progress (017), home rows (019), CMS admin (020 + repair),
  series publish cascade (022), home spotlight (023), launch coin packs (024),
  chai launch amounts (025), row items title (026), rewarded multi-completion
   (027, tracked/committed in source; not proven applied to remote QA).
- Admin client is used solely server-side. RLS is defined in the migrations
  and was designed to keep shared/resource rows server-managed; do not alter
  RLS without authority change approval.
- Do not reveal secret values. `SUPABASE_SECRET_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY` are used by `createAdminClient` only.

## Compatibility behavior

- Contract docs referenced by `docs/0nya_BACKEND_API_CONTRACT_v1.0.md` and
  `docs/0nya_CMS_PRODUCT_CONTRACT_v1.0.md` were revised in the working tree —
  re-open them before changing API shapes.
- Android consumes the API contract through `apps/android/src/types/api.ts`
  and `src/lib/api.ts`. Backward-compatible/additive changes preferred.

## Completed/stable systems (evidence-backed)

- CMS login + is_cms_admin route protection; password recovery.
- Series/episode/short-film intake, metadata, artwork, media assignment,
  bulk episode upload, status transitions, publish guardrails.
- Home rows/editorial management (pre-spotlight phase).
- Android-facing v1 API family listed above.
- AdMob SSV verification + Mux webhook handlers.
- Local Supabase + media scripts.

## Partial/pending

- Home spotlight editorial phase + `show_title` row items — uncommitted.
- Rewarded multi-completion (027 migration tracked/committed + `monetization`
  events route + `src/lib/monetization/events.ts` tracked/committed,
  commit `5126208`; real AdMob SSV device E2E + session-mode-trap remediation
  IN PROGRESS / unproven on remote QA).
- Unit tests (`src/lib/rewarded-*.test.ts`, `src/lib/monetization/events.test.ts`,
  `src/lib/notification-qa-verification.test.ts`) exist (tracked + untracked);
  root `package.json` `test` script is wired (current tree: 346 pass / 2 fail).

## Known issues

- Repository evidence only; verify at runtime before reporting fixes.

## High-risk boundaries

- Never make the client authoritative for monetization/access/playback.
- Do not hardcode CMS/store-controlled CONFIG values into clients.
- Do not mutate production data to pass checks.
- CMS admin route changes must keep `is_cms_admin()` fail-closed.

## Relevant files

`src/app/admin/**`, `src/app/api/**`, `src/components/{admin,cms}/**`,
`src/lib/{api,cms,mux,supabase}/**`, `src/lib/{catalog,home,playback,
entitlements,purchases,payments,rewarded-ads,watch-progress,classification,
parental-controls,chai,media,subtitles,account,account-deletion,profiles}.ts`,
`src/data/content.ts`, `src/types/*`, `supabase/migrations/**`,
`scripts/*`, `Dockerfile`.

## Remotes

UNVERIFIED REMOTELY — this snapshot does not prove live remote deployment
health. QA/infra state: see `RELEASE_CURRENT_STATE.md` and commit hints
(`qa/netlify-api-e34ab5e`, Netlify build fixes, Cloud Run preview URL in
`eas.json`).
