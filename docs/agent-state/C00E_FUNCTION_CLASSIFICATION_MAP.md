# C00E Function Classification Map

Generated from read-only source analysis (2026-09-04). Each existing function is classified per the C00E design safety rule:

`KEEP IN PLACE` | `KEEP BEHAVIOR / MOVE UI` | `MERGE UI` | `HIDE AS ADVANCED` | `REMOVE DUPLICATE UI ONLY` | `REQUIRES NEW ADDITIVE CAPABILITY` | `DEFER`

Reference: roadmap section 8, "Design safety rule".

---

## 1. Auth & Admin (C01 — Admin Authentication, Authorization & Safety)

| Function | File | Classification | Notes |
|----------|------|----------------|-------|
| `getCmsAdminContext()` | `cms/auth.ts` | KEEP IN PLACE | Re-checks `is_cms_admin()` on every call; fail-closed |
| `requireCmsAdmin()` | `cms/auth.ts` | KEEP IN PLACE | Server component guard |
| `cmsEmailPasswordLogin` | `admin/login/actions.ts` | KEEP IN PLACE | Admin login flow |
| `AdminLoginPanel` | `components/admin/AdminLoginPanel.tsx` | KEEP IN PLACE | Login form UI |
| `AdminForgotPassword` | `components/admin/AdminForgotPassword.tsx` | KEEP IN PLACE | Password recovery form |
| `admin/reset-password/page.tsx` | page | KEEP IN PLACE | Password reset route |

---

## 2. Constants & Shared Types

| Function / Export | File | Classification | Notes |
|-------------------|------|----------------|-------|
| `SERIES_STATUSES`, `SERIES_FORMATS` | `cms/constants.ts` | KEEP IN PLACE | Canonical location |
| `SERIES_STATUSES`, `SERIES_FORMATS` | `cms/series.ts` | REMOVE DUPLICATE UI ONLY | Duplicate export — keep canonical in constants.ts |
| `EPISODE_STATUSES`, `EpisodeStatus` | `cms/constants.ts` | KEEP IN PLACE | |
| `RewardedAccessMode`, `REWARDED_ACCESS_MODES`, `REWARDED_REQUIRED_COMPLETIONS_VALUES` | `cms/constants.ts` | KEEP IN PLACE | Launch max 2 completions |
| `buildAccessSummary()` | `cms/constants.ts` | HIDE AS ADVANCED | Technical access summary for Episode Inspector > Access |
| `SeriesRow`, `EpisodeRow`, `SeriesStatus` | `cms/constants.ts` | KEEP IN PLACE | Shared row types |

---

## 3. Series Authoring (C02 — Series & Episode Authoring)

| Function | File | Classification | Notes |
|----------|------|----------------|-------|
| `createSeries()` | `cms/series.ts` | KEEP BEHAVIOR / MOVE UI | To Series Workspace > Series Info |
| `updateSeries()` | `cms/series.ts` | KEEP BEHAVIOR / MOVE UI | To Series Workspace > Series Info |
| `deleteSeries()` | `cms/series.ts` | KEEP BEHAVIOR / MOVE UI | To Series Workspace > Publishing/Danger Zone |
| `getSeriesForAdminById()` | `cms/series.ts` | KEEP IN PLACE | Admin data loading |
| `getSeriesForAdminBySlug()` | `cms/series.ts` | KEEP IN PLACE | Admin data loading |
| `updateSeriesStatus()` | `cms/series.ts` | KEEP BEHAVIOR / MOVE UI | To Publishing section |
| `verifySeriesPublishIntegrity()` | `cms/series.ts` | KEEP BEHAVIOR / MOVE UI | To Publishing Centre — reuse `publish_series_with_episodes` RPC |
| `getSeriesDeletePreview()` | `cms/series.ts` | MERGE UI | Into Smart Delete impact report (C00C 8.15) |
| `persistSeriesArtwork()` | `cms/series.ts` | MERGE UI | Into Artwork section of Series Workspace (C00E 8.2) |
| `createSeriesDraftAction` | `admin/series/actions.ts` | KEEP BEHAVIOR / MOVE UI | Server action — to Series Workspace |
| `createSeriesAction` | `admin/series/actions.ts` | KEEP BEHAVIOR / MOVE UI | Server action — to Series Workspace |
| `updateSeriesAction` | `admin/series/actions.ts` | KEEP BEHAVIOR / MOVE UI | Server action — to Series Workspace |
| `deleteSeriesAction` | `admin/series/actions.ts` | KEEP BEHAVIOR / MOVE UI | Server action — to Series Workspace |
| `updateSeriesStatusAction` | `admin/series/actions.ts` | KEEP BEHAVIOR / MOVE UI | Server action — to Series Workspace |
| `NewSeriesIntakeForm` | `components/cms/NewSeriesIntakeForm.tsx` | KEEP BEHAVIOR / MOVE UI | Content Library > New Series |
| `SeriesMetadataForm` | `components/cms/SeriesMetadataForm.tsx` | KEEP BEHAVIOR / MOVE UI | Series Workspace > Series Info |
| `SeriesStatusForm` | `components/cms/SeriesStatusForm.tsx` | KEEP BEHAVIOR / MOVE UI | Series Workspace > Publishing |
| `admin/series/new/page.tsx` | page | KEEP BEHAVIOR / MOVE UI | Content Library > New Series entry point |
| `admin/series/[id]/page.tsx` | page | KEEP BEHAVIOR / MOVE UI | To Series Workspace (consolidate long form → compact workspace) |

---

## 4. Episode Authoring (C02 — Episode Grid + Inspector)

| Function | File | Classification | Notes |
|----------|------|----------------|-------|
| `createEpisode()` | `cms/episodes.ts` | KEEP BEHAVIOR / MOVE UI | Add-One / Add-Many + Episode Inspector |
| `updateEpisode()` | `cms/episodes.ts` | KEEP BEHAVIOR / MOVE UI | Episode Inspector |
| `deleteEpisode()` | `cms/episodes.ts` | KEEP BEHAVIOR / MOVE UI | Episode Inspector > Danger Zone / Smart Delete |
| `updateEpisodeStatus()` | `cms/episodes.ts` | KEEP BEHAVIOR / MOVE UI | Episode Inspector > Release |
| `getEpisodeForAdminById()` | `cms/episodes.ts` | KEEP IN PLACE | Admin data loading |
| `getEpisodeDeletePreview()` | `cms/episodes.ts` | MERGE UI | Into Smart Delete impact report (C00C 8.15) |
| `listEpisodesForSeries()` | `cms/episodes.ts` | KEEP IN PLACE | Data for Episode Grid |
| `resolveEpisodeMediaReadiness()` | `cms/episodes.ts` | HIDE AS ADVANCED | Episode Grid > Media column indicator; detail in Media section |
| `persistEpisodeThumbnail()` | `cms/episodes.ts` | MERGE UI | Into Episode Inspector > Media section |
| `EpisodeMetadataForm` | `components/cms/EpisodeMetadataForm.tsx` | MERGE UI | Merge into Episode Inspector > Basic section (8.4) |
| `EpisodeMediaAssignmentForm` | `components/cms/EpisodeMediaAssignmentForm.tsx` | MERGE UI | Into Episode Inspector > Media section + Media workflow |
| `NewShortFilmIntakeForm` | (see Short Films) | — | |
| `admin/series/[id]/episodes/[episodeId]/page.tsx` | page | KEEP BEHAVIOR / MOVE UI | Currently long-form → compact to Episode Inspector side panel |
| `admin/series/[id]/episodes/new/page.tsx` | page | KEEP BEHAVIOR / MOVE UI | Add-One entry point |
| `admin/series/[id]/episodes/bulk-upload/page.tsx` | page | KEEP BEHAVIOR / MOVE UI | Add-Many entry point |
| `SeriesEpisodeManager` | `components/cms/SeriesEpisodeManager.tsx` | KEEP IN PLACE | Dominant Episode Grid surface |
| `parseEpisodeFormData()` / `EpisodeFormState` | `cms/episode-form.ts` | MERGE UI | Consolidate into Episode Inspector form handling |

---

## 5. Episode Access Configuration (C06 — Monetization & Access)

| Function | File | Classification | Notes |
|----------|------|----------------|-------|
| `EpisodeAccessInput`, `EpisodeAccessValidationError` | `cms/episode-access.ts` | KEEP IN PLACE | Pure validation types |
| `validateEpisodeAccessInput()` | `cms/episode-access.ts` | HIDE AS ADVANCED | Episode Inspector > Access (progressive disclosure) |
| `serializeEpisodeAccess()` | `api/serializers.ts` | KEEP IN PLACE | Consumer API — do not change |
| `getEpisodeAccessStates()` | `lib/entitlements.ts` | KEEP IN PLACE | Consumer-facing — do not change |
| `canUserWatchEpisode()` | `lib/entitlements.ts` | KEEP IN PLACE | Consumer-facing — do not change |
| `hasValidEpisodeEntitlement()` | `lib/entitlements.ts` | KEEP IN PLACE | Consumer-facing — do not change |

---

## 6. Series Episode Defaults & Bulk (C02 — 8.5 Add-Many, 8.6 Defaults, 8.7 Bulk Edit)

| Function | File | Classification | Notes |
|----------|------|----------------|-------|
| `buildEpisodeInputForBulkCreate()` | `cms/bulk-episodes.ts` | KEEP BEHAVIOR / MOVE UI | Add-Many surface (8.5) |
| `BulkEpisodeCreateInput`, `BulkEpisodeCreateResult`, `BulkEpisodeFinalizeResult`, `BulkEpisodeDefaults` | `cms/bulk-episodes.ts` | KEEP IN PLACE | Types / defaults |
| `BulkEpisodeUploadForm` | `components/cms/BulkEpisodeUploadForm.tsx` | KEEP BEHAVIOR / MOVE UI | Add-Many UI (8.5) |

---

## 7. Short Film Authoring (C03 — Short Film Workspace)

| Function | File | Classification | Notes |
|----------|------|----------------|-------|
| `createShortFilm()` | `cms/short-films.ts` | KEEP BEHAVIOR / MOVE UI | Short Film Workspace > Details |
| `updateShortFilm()` (first) | `cms/short-films.ts` | KEEP BEHAVIOR / MOVE UI | Short Film Workspace > Details |
| `updateShortFilm()` (duplicate export) | `cms/short-films.ts` | REMOVE DUPLICATE UI ONLY | Duplicate — keep one |
| `deleteShortFilm()` | `cms/short-films.ts` | KEEP BEHAVIOR / MOVE UI | Short Film Workspace > Publishing/Danger Zone |
| `getShortFilmForAdminById()` | `cms/short-films.ts` | KEEP IN PLACE | Admin data loading |
| `updateShortFilmStatus()` | `cms/short-films.ts` | KEEP BEHAVIOR / MOVE UI | Short Film Workspace > Publishing |
| `verifyShortFilmPublishIntegrity()` | `cms/short-films.ts` | KEEP BEHAVIOR / MOVE UI | Publishing Centre |
| `getShortFilmDeletePreview()` | `cms/short-films.ts` | MERGE UI | Smart Delete impact report (C00C 8.15) |
| `persistShortFilmArtwork()` | `cms/short-films.ts` | MERGE UI | Artwork section |
| `parseShortFilmFormData()` / `ShortFilmFormState` | `cms/short-film-form.ts` | MERGE UI | Consolidate into Short Film Workspace form handling |
| `ShortFilmMetadataForm` | `components/cms/ShortFilmMetadataForm.tsx` | KEEP BEHAVIOR / MOVE UI | Short Film Workspace > Details |
| `ShortFilmChaiConfigForm` | `components/cms/ShortFilmChaiConfigForm.tsx` | HIDE AS ADVANCED | Short Film Workspace > Ads & Chai — verify NO duplication with ShortFilmMetadataForm |
| `admin/short-films/[id]/page.tsx` (DIRTY) | page | MERGE UI | Consolidate to Short Film Workspace (8.8) — verify no duplicate Status/Chai/controls |
| `admin/short-films/new/page.tsx` | page | KEEP BEHAVIOR / MOVE UI | Content Library > New Short Film |

**Collision note**: The prior audit (C00E 5.1) found "Short Film editing exposed duplicated controls" including duplicate status/Chai config locations. The dirty `admin/short-films/[id]/page.tsx` is likely addressing this consolidation. Must verify `ShortFilmMetadataForm` and `ShortFilmChaiConfigForm` do not both render status controls.

---

## 8. Chai / Creator Mapping (C03 — 8.52 Ads & Chai)

| Function | File | Classification | Notes |
|----------|------|----------------|-------|
| `getShortFilmChaiDetails()` | `cms/short-films.ts` | HIDE AS ADVANCED | Admin data — Short Film Workspace > Ads & Chai |
| `getShortFilmChaiDetails()` | `lib/chai.ts` | KEEP IN PLACE | Consumer-facing chai read (short-films/[slug]/chai route) |
| `listChaiAllowedCoinAmountsForAdmin()` | `cms/short-films.ts` | HIDE AS ADVANCED | Admin chai config |
| `updateChaiAllowedCoinAmount()` | `cms/short-films.ts` | HIDE AS ADVANCED | Admin chai config |
| `updateShortFilmChaiEnabled()` | `cms/short-films.ts` | HIDE AS ADVANCED | Admin chai config |
| `submitShortFilmChaiTip()` | `lib/chai.ts` | KEEP IN PLACE | Consumer-facing chai tip submission — server-authoritative wallet |
| `api/v1/short-films/[slug]/chai/route.ts` | route | KEEP IN PLACE | Consumer chai tip endpoint — server authority |

**Collision note**: Chai admin functions are split between `cms/short-films.ts` and `lib/chai.ts`. Consider MERGE UI into one chai module — but consumer functions must remain server-authoritative.

---

## 9. Home Composer (C04 — Editorial Control)

| Function | File | Classification | Notes |
|----------|------|----------------|-------|
| `getHomeAdminData()` | `cms/home.ts` | KEEP BEHAVIOR / MOVE UI | Home Composer dashboard |
| `listHomeContentChoices()` | `cms/home.ts` | KEEP IN PLACE | Content selection data |
| `addHomeRowItem()` | `cms/home.ts` | KEEP BEHAVIOR / MOVE UI | Home Composer |
| `addSpotlightItem()` | `cms/home.ts` | KEEP BEHAVIOR / MOVE UI | Multi-Spotlight (C00E 8.22) |
| `removeHomeRowItem()` | `cms/home.ts` | KEEP BEHAVIOR / MOVE UI | Home Composer |
| `removeSpotlightItem()` | `cms/home.ts` | KEEP BEHAVIOR / MOVE UI | Multi-Spotlight |
| `moveHomeRow()` | `cms/home.ts` | KEEP BEHAVIOR / MOVE UI | Row ordering |
| `moveHomeRowItem()` | `cms/home.ts` | KEEP BEHAVIOR / MOVE UI | Item ordering |
| `moveSpotlightItem()` | `cms/home.ts` | KEEP BEHAVIOR / MOVE UI | Spotlight ordering |
| `createHomeEditorialRow()` | `cms/home.ts` | KEEP BEHAVIOR / MOVE UI | Home Composer |
| `deleteHomeEditorialRow()` | `cms/home.ts` | KEEP BEHAVIOR / MOVE UI | Home Composer |
| `updateHomeRow()` | `cms/home.ts` | KEEP BEHAVIOR / MOVE UI | Row config (title/order/visibility) |
| `updateHomeRowItem()` | `cms/home.ts` | KEEP BEHAVIOR / MOVE UI | Item config |
| `toggleHomeSpotlight()` | `cms/home.ts` | KEEP BEHAVIOR / MOVE UI | Spotlight enable/disable |
| `updateSpotlightItemShowTitle()` | `cms/home.ts` | KEEP BEHAVIOR / MOVE UI | Per-item showTitle (8.23) |
| `updateHomeLowHistoryThreshold()` | `cms/home.ts` | HIDE AS ADVANCED | Configuration section (global config) |
| `getHomeState()` | `lib/home.ts` | KEEP IN PLACE | Consumer-facing — do not change |
| `admin/home/page.tsx` | page | KEEP BEHAVIOR / MOVE UI | To Home Composer surface |

**Collision note**: `getHomeState()` (consumer) and `getHomeAdminData()` (CMS) both read home configuration. The in-progress working tree changes (dirty `cms/home.ts`, `lib/home.ts`) are implementing the Multi-Spotlight foundation. C00E 8.44 requires duplicate prevention and no fabricated/fallback items.

---

## 10. Media / Mux Ingest & Media Guardian (C05 — Media Operations)

| Function | File | Classification | Notes |
|----------|------|----------------|-------|
| `createMediaUploadIntent()` | `cms/episodes.ts` + `cms/media.ts` | MERGE UI | Duplicated across modules — consolidate into `cms/media.ts` |
| `attachEpisodeMediaUploadIntent()` | `cms/episodes.ts` + `cms/media.ts` | MERGE UI | Duplicate — consolidate |
| `attachShortFilmMediaUploadIntent()` | `cms/media.ts` | KEEP IN PLACE | Short-film-specific |
| `refreshMediaAssetStatus()` | `cms/episodes.ts` + `cms/media.ts` | MERGE UI | Duplicate — consolidate into `cms/media.ts` |
| `assignEpisodeMediaAsset()` | `cms/episodes.ts` + `cms/media.ts` | MERGE UI | Duplicate — consolidate into `cms/media.ts` |
| `assignShortFilmMediaAsset()` | `cms/media.ts` | KEEP IN PLACE | Short-film-specific |
| `listReadyMediaAssetsForAdmin()` | `cms/media.ts` | KEEP IN PLACE | Media workflow data |
| `createMuxDirectUpload()` | `cms/media.ts` | KEEP IN PLACE | Media ingest |
| `reconcileMuxMediaAssetState()` | `cms/media.ts` | DEFER | Media Guardian (C00C 8.13) — design first |
| `reconcileOrphanedProcessingMediaAssets()` | `cms/episodes.ts` + `cms/media.ts` | DEFER | Media Guardian orphan detection (C00C 8.13) |
| `deleteMuxAsset()` | `cms/media.ts` | MERGE UI | Smart Delete lifecycle (C00C 8.15) |
| `mediaAssetHasRemainingReferences()` | `cms/media.ts` | MERGE UI | Smart Delete dependency model (C00C 8.15) |
| `MediaAssetAssignmentForm` | `components/cms/MediaAssetAssignmentForm.tsx` | MERGE UI | Media workflow + Media Guardian views |
| `MediaAssetRefreshForm` | `components/cms/MediaAssetRefreshForm.tsx` | MERGE UI | Media Guardian + Media workflow |
| `MediaDirectUploadField` | `components/cms/MediaDirectUploadField.tsx` | KEEP IN PLACE | Component utility |
| `video-intake.ts` (all functions) | `cms/video-intake.ts` | KEEP IN PLACE | Media intake tooling |
| `subtitle-intake.ts` (all functions) | `cms/subtitle-intake.ts` | KEEP IN PLACE | Subtitle intake tooling |
| `upload-progress.ts` (all functions) | `cms/upload-progress.ts` | KEEP IN PLACE | UI utilities |
| `artwork.ts` (all functions) | `cms/artwork.ts` | MERGE UI | Into Artwork sections + Smart Delete lifecycle |

**Collision note**: Significant duplication of media functions across `cms/episodes.ts` and `cms/media.ts`. The C00C blueprint (8.13–8.15) requires a unified Media Guardian with orphaned/stuck/failed detection and Smart Delete. Functions like `reconcileOrphanedProcessingMediaAssets`, `reconcileMuxMediaAssetState`, `deleteMuxAsset` belong to the Control Room/Media Guardian (C00C design phase).

---

## 11. Media Asset Types (shared)

| Type | File | Classification | Notes |
|------|------|----------------|-------|
| `MediaAssetRow` | `cms/media.ts` | KEEP IN PLACE | Type |
| `MediaAssetFormState` | `cms/media.ts` | KEEP IN PLACE | Type |
| `MediaUploadIntent` | `cms/media.ts` | KEEP IN PLACE | Type |

---

## 12. Consumer API Routes (all KEEP IN PLACE — do not change without API contract approval)

| Route | Classification | Notes |
|-------|---------------|-------|
| `api/v1/catalog/route.ts` | KEEP IN PLACE | Consumer catalog — imports `getPublishedSeries`, `getPublishedShortFilms` from `lib/catalog.ts` |
| `api/v1/series/[slug]/route.ts` | KEEP IN PLACE | Consumer series detail — imports `getSeriesBySlug` |
| `api/v1/short-films/[slug]/route.ts` | KEEP IN PLACE | Consumer short film detail — imports `getShortFilmBySlug`, `getShortFilmChaiDetails` |
| `api/v1/short-films/[slug]/chai/route.ts` | KEEP IN PLACE | Consumer chai tip — imports `submitShortFilmChaiTip` |
| `api/v1/me/route.ts` | KEEP IN PLACE | Consumer auth/user profile |
| `api/v1/playback/route.ts` | KEEP IN PLACE | Server-authoritative playback authorization |
| `api/v1/wallet/route.ts` | KEEP IN PLACE | Consumer wallet/orders — server authority |
| `api/v1/episodes/[id]/purchase/route.ts` | KEEP IN PLACE | Episode Coin purchase — server authority |
| `api/v1/episodes/[id]/rewarded/route.ts` | KEEP IN PLACE | Rewarded ad attempt — backend verified |
| `api/v1/episodes/[id]/rewarded/progress/route.ts` | KEEP IN PLACE | Rewarded progress |
| `api/v1/watch-progress/route.ts` | KEEP IN PLACE | Watch progress |
| `api/v1/playback/preview/route.ts` | KEEP IN PLACE | Preview playback |
| `api/v1/account/delete/route.ts` | KEEP IN PLACE | Consumer account deletion |
| `api/v1/account/parental-controls/route.ts` | KEEP IN PLACE | Parental controls |
| `api/v1/billing/google-play/route.ts` | KEEP IN PLACE | Google Play billing |
| `api/v1/webhooks/mux/route.ts` | KEEP IN PLACE | Mux webhook — media state handler |
| `api/v1/webhooks/admob/ssv/route.ts` | KEEP IN PLACE | AdMob SSV — rewarded verification |
| `api/dev/mux/local-operator/route.ts` | KEEP IN PLACE | Dev tooling |
| All `play-together/*` routes | KEEP IN PLACE | PX01/B-2E-B1 — not CMS scope |

---

## 13. Consumer Lib Functions (all KEEP IN PLACE — shared, must not change)

| Function | File | Classification | Notes |
|----------|------|----------------|-------|
| `serializeEpisode`, `serializeSeries`, `serializeShortFilm`, `serializeEpisodeAccess` | `api/serializers.ts` (dirty) | KEEP IN PLACE | Defines consumer API output shape — must not change |
| `getPublishedSeries`, `getPublishedShortFilms`, `getSeriesBySlug`, `getShortFilmBySlug`, `getEpisodesForSeries`, `getEpisodeBySeriesSlugAndNumber`, `getSeriesIdsWithConsumerEpisodes` | `lib/catalog.ts` (dirty) | KEEP IN PLACE | Consumer catalog resolution |
| `mapSeries`, `mapShortFilm`, `mapEpisode` | `lib/catalog.ts` (dirty) | KEEP IN PLACE | Row→shape mappers |
| `ShortFilm` (type) | `lib/catalog.ts` (dirty) | KEEP IN PLACE | Consumer-facing type |
| `getHomeState` | `lib/home.ts` (dirty) | KEEP IN PLACE | Consumer home state resolution |
| `HomeState`, `HomeSpotlight`, `HomeRowItem`, `HomeRow`, `HomeContentType` | `lib/home.ts` (dirty) | KEEP IN PLACE | Consumer-facing types |
| `getShortFilmChaiDetails`, `submitShortFilmChaiTip` | `lib/chai.ts` | KEEP IN PLACE | Consumer chai functions |
| `getEpisodeAccessStates`, `canUserWatchEpisode`, `hasValidEpisodeEntitlement`, `userOwnsEpisode`, `getValidEpisodeEntitlementIds`, `hasActiveSubscription`, `resolvePlaybackMaxResolution` | `lib/entitlements.ts` | KEEP IN PLACE | Consumer entitlements — server authority |
| `getUserWallet`, `getUserSubscription` | `lib/entitlements.ts` | KEEP IN PLACE | Wallet/subscription reads |

---

## 14. CMS Dashboard / Overview

| Function | File | Classification | Notes |
|----------|------|----------------|-------|
| `admin/page.tsx` (dashboard) | page | MERGE UI | Transform into Overview command center (C00E 8.1) — consolidate health, content-needs-attention, media problems into one concise surface |
| `admin/media/page.tsx` (if exists) | page | MERGE UI | Media tab → Media workflow + Media Guardian |

---

## 15. Form Parsers (shared form state)

| Function | File | Classification | Notes |
|----------|------|----------------|-------|
| `parseSeriesFormData()` / `SeriesFormState` | `cms/series-form.ts` | MERGE UI | Consolidate into Series Workspace form handling |
| `parseEpisodeFormData()` / `EpisodeFormState` | `cms/episode-form.ts` | MERGE UI | Consolidate into Episode Inspector form handling |
| `parseShortFilmFormData()` / `ShortFilmFormState` | `cms/short-film-form.ts` | MERGE UI | Consolidate into Short Film Workspace form handling |
| `CmsSelect` | `components/cms/CmsSelect.tsx` | KEEP IN PLACE | Shared component |
| `CmsAutoSubmitCheckbox` | `components/cms/CmsAutoSubmitCheckbox.tsx` | KEEP IN PLACE | Shared component |
| `ArtworkUploadField` | `components/cms/ArtworkUploadField.tsx` | MERGE UI | Into Artwork sections of workspaces |
| `DangerZoneDeleteForm` | `components/cms/DangerZoneDeleteForm.tsx` | MERGE UI | Into workspaces' Publishing/Danger Zone + Smart Delete |

---

## 16. Consumer Lib — Dirty Files (require verification before any change)

| File | Dirty | Risk |
|------|-------|------|
| `src/lib/api/serializers.ts` | dirty | HIGH — defines consumer API output shape; changes require API contract approval |
| `src/lib/catalog.ts` | dirty | HIGH — consumer catalog resolution; shared by catalog/series/short-films API routes |
| `src/lib/home.ts` | dirty | HIGH — consumer home state; shared by catalog API route |
| `src/lib/cms/short-films.ts` | dirty | MEDIUM-HIGH — CMS short film logic + chai admin; duplicate export found |
| `src/lib/cms/series.ts` | dirty | MEDIUM-HIGH — CMS series logic; duplicate SERIES_STATUSES export |
| `src/lib/cms/episodes.ts` | dirty | MEDIUM-HIGH — CMS episodes logic; duplicate media functions with media.ts |
| `src/lib/cms/home.ts` | dirty | MEDIUM — CMS home logic; Multi-Spotlight foundation in progress |
| `src/app/admin/short-films/[id]/page.tsx` | dirty | MEDIUM — Short Film workspace consolidation in progress |
| `src/types/database.ts` | dirty | HIGH — Supabase Database types; schema changes affect all queries |
| `src/proxy.ts` | dirty | LOW — proxy config; verify scope |
| `package.json` | dirty | LOW — dependencies; verify no breaking changes |

---

## 17. REQUIRES NEW ADDITIVE CAPABILITY (C00E 8.16)

These are genuinely new features beyond the reorganization — require C00E blueprint approval before implementation:

| Capability | Blueprint Section |
|------------|-------------------|
| Content Library (search, status filters, saved filters, compact tables, problem indicators) | C00B 8.1 |
| Episode Grid (dense spreadsheet manager) | C00B 8.3 |
| Episode Inspector (side panel with Basic/Access/Media/Release/Advanced) | C00B 8.4 |
| Add-Many (count, starting number, naming pattern) | C00B 8.5 |
| Series Episode Defaults (create-once/apply-defaults) | C00B 8.6 |
| Bulk Edit (access, Coin, Rewarded, Plus, preview, release, ratings) | C00B 8.7 |
| Search & saved filters (Needs Attention, Missing Media, Processing, etc.) | C00B 8.9 |
| Operations / Control Room (health view across Cloud Run/Supabase/Mux) | C00C 8.10-8.13 |
| Media Guardian (total/ready/processing/failed/unassigned/orphan metrics) | C00C 8.13 |
| Smart Delete (impact report + lifecycle: ACTIVE→UNREFERENCED→CANDIDATE→QUARANTINED→CONFIRMED→CLEANUP→VERIFY) | C00C 8.15-8.16 |
| Analytics dashboards (Executive, Traffic, Content, Audience, Monetization, Playback) | C00D 8.17-8.24 |
| Publishing Centre (Needs Attention/Blocked/Draft/Scheduled/Published) | C00E final IA 9 |
| Configuration page (global CMS config, feature flags, Chai global values) | C00E final IA 9 |

---

## 18. Summary Counts

| Classification | Count |
|----------------|-------|
| KEEP IN PLACE | ~31 |
| KEEP BEHAVIOR / MOVE UI | ~44 |
| MERGE UI | ~28 |
| HIDE AS ADVANCED | ~9 |
| REMOVE DUPLICATE UI ONLY | ~4 |
| REQUIRES NEW ADDITIVE CAPABILITY | 14 (surface-level) |
| DEFER | ~4 |
| **Total** | ~131 |

---

## 19. Key Collisions Requiring Attention

1. **Chai module split** — `cms/short-films.ts` (admin chai config) + `lib/chai.ts` (consumer chai read/tip). Merge admin config into unified chai module, but preserve consumer server authority.

2. **Media function duplication** — `cms/episodes.ts` and `cms/media.ts` both export `createMediaUploadIntent`, `attachEpisodeMediaUploadIntent`, `refreshMediaAssetStatus`, `assignEpisodeMediaAsset`. Consolidate into `cms/media.ts`.

3. **Short Film duplicate exports** — `updateShortFilm()` exported twice in `cms/short-films.ts`; `SERIES_STATUSES`/`SERIES_FORMATS` duplicated in `series.ts` + `constants.ts`.

4. **Short Film workspace duplication** — per prior audit (C00E 5.1), status/Chai controls may exist in both `ShortFilmMetadataForm` and `ShortFilmChaiConfigForm`. The dirty `admin/short-films/[id]/page.tsx` is addressing this — verify before C00E approval.

5. **Dashboard → Overview** — `admin/page.tsx` needs transformation into C00E Overview command center (8.1), not a card wall.
