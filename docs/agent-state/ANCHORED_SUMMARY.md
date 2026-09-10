## Objective
- Map current CMS source code to the approved C00E blueprint structure (read-only analysis)
- Produce a function classification map (KEEP/MOVE/MERGE/ADVANCED/REMOVE DUPLICATE/ADD/DEFER), collision files, dirty files, and Wave 1/Wave 2 implementation slices

## Important Details
- Working repo: `C:\Users\Akash\Documents\0nyapp` (branch `qa/netlify-api-e34ab5e`)
- Blueprint reference: `0nya_CMS_COMPLETION_ROADMAP_v2.0.md` (downloaded to `C:\Users\Akash\Downloads\`), section 8 "CMS-C00E — Unified CMS Blueprint & Implementation Contract" — **BLOCKED BY C00B + C00C + C00D DESIGN APPROVAL**; implementation must NOT begin before C00E approval
- Active milestone: **CMS-C00B — Smart CMS IA / High-Volume Workflow Design** (design phase); parallel design prep allowed for C00C (Operations/Control Room/Media Guardian/Smart Delete) and C00D (Analytics)
- CMS boundary: `src/app/admin/*` + `src/lib/cms/*` + `src/components/cms/*` + `src/components/admin/*` + CMS API routes + CMS portions of `src/lib/routes.ts`
- Auth: `src/lib/cms/auth.ts` — `getCmsAdminContext()` re-checks via `is_cms_admin()` RPC on every call; `requireCmsAdmin()` guards server components
- Next.js 16, React 19; Supabase Postgres with server-secret-key admin client (`createAdminClient` from `src/lib/supabase/admin.ts`)
- CMS is server-rendered pages calling Supabase directly via `createAdminClient`; **no separate REST CMS API** exists (per CMS_BACKEND_CURRENT_STATE.md)
- Consumer-facing API routes at `src/app/api/v1/**` use per-route `getApiAuth()` (Bearer token or cookie session)

## Work State
### Completed
- Read all CMS server logic modules (17): `auth.ts`, `constants.ts`, `series.ts`, `episodes.ts`, `short-films.ts`, `home.ts`, `media.ts`, `chai.ts`, `episode-access.ts`, `episode-form.ts`, `series-form.ts`, `short-film-form.ts`, `video-intake.ts`, `subtitle-intake.ts`, `bulk-episodes.ts`, `upload-progress.ts`, `artwork.ts`
- Read all CMS admin pages: `admin/page.tsx` (dashboard), `admin/home/page.tsx`, `admin/login/page.tsx`, `admin/media/page.tsx` (media asset table + upload/refresh actions), `admin/series/[id]/page.tsx`, `admin/series/[id]/episodes/[episodeId]/page.tsx`, `admin/series/[id]/episodes/bulk-upload/page.tsx`, `admin/series/[id]/episodes/new/page.tsx`, `admin/series/new/page.tsx`, `admin/short-films/[id]/page.tsx`, `admin/short-films/new/page.tsx`
- Read all 17 CMS client components in `src/components/cms/*` + `src/components/admin/*` (AdminLoginPanel, AdminForgotPassword)
- Read CMS server actions: `app/admin/series/actions.ts`, `app/admin/login/actions.ts`
- Read ALL 28 consumer-facing API route handlers in `src/app/api/v1/**` + `webhooks/**`: catalog, series/[slug], short-films/[slug], short-films/[slug]/chai, me, playback, playback/preview, wallet, episodes/[id]/purchase, episodes/[id]/rewarded, episodes/[id]/rewarded/progress, watch-progress, monetization/rewarded-events, rewarded-ad-attempts/[customData], account/delete, account/parental-controls, billing/google-play, play-together/* (6 routes), dev/mux/local-operator, webhooks/admob/ssv, webhooks/mux
- Read supporting consumer-facing lib files: `src/lib/api/serializers.ts` (dirty), `src/lib/catalog.ts` (dirty), `src/lib/home.ts` (dirty), `src/lib/chai.ts`, `src/lib/entitlements.ts`, `src/lib/api/auth.ts`, `src/lib/api/responses.ts`
- Read C00E blueprint section (roadmap section 8): function classification categories + required blueprint elements
- Read product invariants (roadmap section 6), do-not-reimplement list (section 12), execution order (section 14), current active milestone = C00B
- Read `CMS_BACKEND_CURRENT_STATE.md` — confirms architecture, CMS routes/features, auth, content model, API architecture, configuration, known issues
- Ran `git status` (branch `qa/netlify-api-e34ab5e`, HEAD `ac9e116`) — identified dirty files + untracked files in CMS scope (see Relevant Files)
- Produced function classification map: `docs/agent-state/C00E_FUNCTION_CLASSIFICATION_MAP.md` (131 functions across 19 sections, classified into KEEP IN PLACE / KEEP BEHAVIOR+MOVE UI / MERGE UI / HIDE AS ADVANCED / REMOVE DUPLICATE UI ONLY / REQUIRES NEW ADDITIVE CAPABILITY / DEFER)

### Active
- Producing Wave 1 (C00E blueprint document) / Wave 2 (C01-C03 implementation slice) breakdown with file-collision boundaries

### Blocked
- (none)

## Next Move
1. Complete the function classification map — DONE (see `C00E_FUNCTION_CLASSIFICATION_MAP.md`)
2. Produce collision/dirty files risk list — DONE (see table above)
3. Produce Wave 1 (C00E blueprint doc) / Wave 2 (C01-C03 implementation slice) breakdown
4. Write implementation slice doc and update ANCHORED_SUMMARY.md

## Key Architectural Findings
### Separation: CMS logic (`src/lib/cms/*`) vs Consumer logic (`src/lib/*.ts`)
- `src/lib/cms/*` — CMS-specific server logic using `createAdminClient` (server-secret-key): series, episodes, short-films, home, media, chai, artwork, forms, intake, bulk, upload-progress
- `src/lib/catalog.ts` — consumer catalog resolution (getPublishedSeries, getPublishedShortFilms, getSeriesBySlug, getShortFilmBySlug); also used by CMS pages for preview/validation
- `src/lib/home.ts` — consumer home state resolution (getHomeState); imports CMS `getSeriesIdsWithConsumerEpisodes`
- `src/lib/chai.ts` — chai details + tip submission; shared by both CMS (home.ts imports from cms/chai.ts) and consumer API (short-films/[slug]/chai route)
- `src/lib/api/serializers.ts` — consumer API output serialization (dirty file)
- API routes are purely consumer-facing; CMS pages SSR directly via Supabase

### Dirty Files in CMS Scope (from git status, branch `qa/netlify-api-e34ab5e`, HEAD `ac9e116`)

**Modified (tracked):**
| File | Risk |
|------|------|
| `src/app/admin/short-films/[id]/page.tsx` | MEDIUM — Short Film workspace consolidation in progress |
| `src/lib/api/serializers.ts` | HIGH — consumer API output shape; must not change |
| `src/lib/catalog.ts` | HIGH — consumer catalog resolution; shared by API routes |
| `src/lib/cms/episodes.ts` | MEDIUM-HIGH — duplicate media functions with media.ts |
| `src/lib/cms/home.ts` | MEDIUM — Multi-Spotlight foundation in progress |
| `src/lib/cms/series.ts` | MEDIUM-HIGH — duplicate SERIES_STATUSES export |
| `src/lib/cms/short-films.ts` | MEDIUM-HIGH — duplicate `updateShortFilm()` export |
| `src/lib/home.ts` | HIGH — consumer home state resolution |
| `src/proxy.ts` | LOW — verify scope |
| `src/types/database.ts` | HIGH — Supabase Database types; schema changes cascade |
| `package.json` | LOW — verify no breaking dependency changes |

**Untracked (new, CMS-relevant):**
| File | Notes |
|------|-------|
| `src/lib/catalog-rules.ts` | New — extracted catalog visibility rules (isMediaAssetReady, isSeriesConsumerVisible, isShortFilmConsumerVisible, resolveShortFilmPlaybackReady) |
| `src/lib/new-releases.ts` | New — hybrid new releases resolver (used by home.ts) |
| `src/lib/catalog-visibility.test.ts` | New — test for catalog-rules |
| `src/lib/new-releases.test.ts` | New — test for new-releases |
| `src/lib/cms/episode-access.test.ts` | New — test for episode-access validation |
| `src/lib/cms/series-episode-authoring.test.ts` | New — test for series/episode authoring |
| `src/lib/cms/short-film-chai-authoring.test.ts` | New — test for short film chai |
| `src/lib/cms/runtime-resilience.test.ts` | New — test for runtime resilience |
| `src/middleware.ts` | New — middleware (verify CMS route gating) |
| `supabase/migrations/20260904000000_029_series_published_at_and_new_releases.sql` | Unapplied — series published_at + new releases |
| `supabase/migrations/20260904120000_030_home_category_rows.sql` | Unapplied — home category rows (Micro Dramas / Short Films auto-population) |
| `docs/0NYA_PARALLEL_STATIC_SOURCE_RECONCILIATION_2026-08-31.md` | Audit artifact |
| `docs/0NYA_STATIC_AUDIT_SUMMARY_2026-08-31.md` | Audit artifact |
| `docs/0nya_MASTER_AUDIT_2026-08-31.md` | Audit artifact |

**Untracked (non-CMS, excluded from analysis):** `apps/android/*` (consumer app), `FINAL_SEMANTIC_ISOLATION_REPORT.md`, `MONETIZATION_DISCOVERY_REPORT.md`, `audit-home.js`, `catalog.json`/`catalog_out.json`/`temp_catalog.json`/`tmp_catalog.json`, `apk_server.js`, `app.json`, `opencode.json`, `verify_auth.cjs`/`verify_constraints.cjs`/`verify_schema.cjs`, `workspace_verify/`, `ui-audit/`, `.continue/`, `.obsidian/`, `.playwright-mcp/`, `.temp/`

### C00E Function Classification Categories (from roadmap section 8)
1. **KEEP IN PLACE** — working, no relocation needed
2. **KEEP BEHAVIOR / MOVE UI** — preserve behavior, relocate UI surface
3. **MERGE UI** — consolidate duplicated controls into one location
4. **HIDE AS ADVANCED** — move to progressive disclosure / advanced section
5. **REMOVE DUPLICATE UI ONLY** — eliminate duplicate, keep canonical location
6. **REQUIRES NEW ADDITIVE CAPABILITY** — genuinely new feature beyond reorganization
7. **DEFER** — out of scope for current phase

### Product Invariants (must preserve, roadmap section 6)
- Every episode independently CMS/backend controlled; no mandatory first-3-free; no hardcoded Episode 4 paywall; Coin price CMS-controlled; Rewarded access backend-verified (permanent-only launch, no session mode); Plus eligibility server-resolved; `locked_preview_seconds` backend/CMS authoritative; Short Films always playable, never Coin-locked or Plus-only; Chai = Coin tip via server-authoritative wallet; Home ordering/editorial CMS/backend authoritative; Continue Watching system-driven; published content must not bypass media/readiness; CMS cannot make client authoritative for wallet/entitlements/purchases/rewarded/playback

## Next Move
1. Produce Wave 1 (C00E blueprint document) / Wave 2 (C01-C03 implementation slice) breakdown with file-collision boundaries
2. Write implementation slice doc: `docs/agent-state/C00E_IMPLEMENTATION_SLICES.md`

## Relevant Files
- `C:\Users\Akash\Documents\0nyapp` — repo root (branch `qa/netlify-api-e34ab5e`, HEAD `ac9e116`)
- `C:\Users\Akash\Downloads\0nya_CMS_COMPLETION_ROADMAP_v2.0.md` — C00E blueprint, read complete (sections 1-17)
- `C:\Users\Akash\Documents\0nyapp\docs/CMS_COMPLETION_ROADMAP.md` — in-repo v1.0 CMS roadmap
- `C:\Users\Akash\Documents\0nyapp\docs/agent-state/CMS_BACKEND_CURRENT_STATE.md` — current state snapshot
- `C:\Users\Akash\Documents\0nyapp\docs/agent-state/SYSTEM_MAP.md` — system architecture map
- `C:\Users\Akash\Documents\0nyapp\docs/agent-state/C00E_FUNCTION_CLASSIFICATION_MAP.md` — function classification map (131 functions, 19 sections) [NEW]
- `C:\Users\Akash\Documents\0nyapp\docs/agent-state/C00E_IMPLEMENTATION_SLICES.md` — Wave 1/Wave 2 breakdown [TO WRITE]
- `C:\Users\Akash\Documents\0nyapp\src/app/admin/` — CMS admin pages (dashboard, home, login, media, reset-password, series, short-films)
- `C:\Users\Akash\Documents\0nyapp\src/lib/cms/` — 17 CMS server logic modules (auth, constants, series, episodes, short-films, home, media, chai, episode-access, episode-form, series-form, short-film-form, video-intake, subtitle-intake, bulk-episodes, upload-progress, artwork)
- `C:\Users\Akash\Documents\0nyapp\src/components/cms/` — 17 CMS client components (SeriesMetadataForm, EpisodeMetadataForm, NewSeriesIntakeForm, NewShortFilmIntakeForm, BulkEpisodeUploadForm, SeriesEpisodeManager, SeriesStatusForm, EpisodeMediaAssignmentForm, MediaAssetAssignmentForm, MediaDirectUploadField, MediaAssetRefreshForm, ArtworkUploadField, CmsSelect, CmsAutoSubmitCheckbox, DangerZoneDeleteForm, ShortFilmChaiConfigForm, ShortFilmMetadataForm)
- `C:\Users\Akash\Documents\0nyapp\src/components/admin/` — AdminLoginPanel, AdminForgotPassword
- `C:\Users\Akash\Documents\0nyapp\src/app/api/v1/` — 28 consumer-facing API route handlers
- `C:\Users\Akash\Documents\0nyapp\src/lib/api/serializers.ts` (dirty) — consumer API serialization (serializeEpisode, serializeSeries, serializeShortFilm, serializeEpisodeAccess)
- `C:\Users\Akash\Documents\0nyapp\src/lib/catalog.ts` (dirty) — consumer catalog (getPublishedSeries, getPublishedShortFilms, getSeriesBySlug, getShortFilmBySlug, getEpisodesForSeries, getSeriesIdsWithConsumerEpisodes, mapSeries, mapShortFilm, mapEpisode)
- `C:\Users\Akash\Documents\0nyapp\src/lib/catalog-rules.ts` (untracked) — extracted catalog visibility rules (isMediaAssetReady, isSeriesConsumerVisible, isShortFilmConsumerVisible, resolveShortFilmPlaybackReady)
- `C:\Users\Akash\Documents\0nyapp\src/lib/home.ts` (dirty) — consumer home state (getHomeState, HomeState type, resolveSpotlightItem)
- `C:\Users\Akash\Documents\0nyapp\src/lib/new-releases.ts` (untracked) — hybrid new releases resolver (used by home.ts)
- `C:\Users\Akash\Documents\0nyapp\src/lib/chai.ts` — chai (getShortFilmChaiDetails, submitShortFilmChaiTip) — shared CMS + consumer
- `C:\Users\Akash\Documents\0nyapp\src/lib/entitlements.ts` — consumer entitlements (getEpisodeAccessStates, canUserWatchEpisode, hasActiveSubscription, getUserWallet, getUserSubscription, resolvePlaybackMaxResolution, hasValidEpisodeEntitlement, userOwnsEpisode, getValidEpisodeEntitlementIds)
- `C:\Users\Akash\Documents\0nyapp\src/lib/api/auth.ts` — getApiAuth (Bearer token + cookie session auth for consumer API)
- `C:\Users\Akash\Documents\0nyapp\src/app/admin/series/actions.ts` — server actions: createSeriesDraftAction, createSeriesAction, updateSeriesAction, deleteSeriesAction, updateSeriesStatusAction
- `C:\Users\Akash\Documents\0nyapp\src/app/admin/login/actions.ts` — cmsEmailPasswordLogin
- `C:\Users\Akash\Documents\0nyapp\src/app/admin/media/page.tsx` — recovered Media/Mux CMS: async server page + server actions (requestMediaUploadAction, refreshMediaAssetAction, loadAssetDetailAction); rows via media-truth-views.ts; renders `MediaAdminClient` (M)
- `C:\Users\Akash\Documents\0nyapp\src/lib/routes.ts` — route path helpers
- `C:\Users\Akash\Documents\0nyapp\supabase/migrations/` — migrations 029 (series_published_at + new_releases) and 030 (home_category_rows) untracked/unapplied
- `C:\Users\Akash\Documents\0nyapp\docs/agent-state/APP_COMPLETION_ROADMAP.md` — consumer Android roadmap
- `C:\Users\Akash\Documents\0nyapp\docs/agent-state/ANDROID_CURRENT_STATE.md` — Android state snapshot
