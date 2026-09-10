# C00E Implementation Slices

Wave 1 = design phase (C00B/C00C/C00D/C00E blueprint docs — no code).
Wave 2 = post-C00E-approval code implementation (C01-C03).

Reference: v2.0 roadmap section 14 (execution order), section 8 (C00E requirements), and `C00E_FUNCTION_CLASSIFICATION_MAP.md`.

---

## Wave 1 — C00E Blueprint Document (DESIGN ONLY, NO CODE)

**Active milestone**: CMS-C00B (Smart CMS IA / High-Volume Workflow Design)
**Parallel design**: C00C (Control Room / Media Guardian / Smart Delete), C00D (Analytics)
**Prerequisites**: C00 prior audit evidence complete; no re-audit needed

### Wave 1 Deliverables (documents only)

| # | Deliverable | Reference | Output File |
|---|------------|-----------|-------------|
| 1 | C00B — Content Library + Series Workspace + Episode Grid + Inspector + Add-Many + Defaults + Bulk Edit design | Roadmap 8.1-8.7 | `docs/agent-state/C00B_DESIGN.md` |
| 2 | C00B — Short Film Workspace + Search/Saved Filters design | Roadmap 8.8-8.9 | Same file |
| 3 | C00C — Operations/Control Room + Media Guardian + Smart Delete architecture | Roadmap 8.10-8.16 | `docs/agent-state/C00C_DESIGN.md` |
| 4 | C00D — Analytics Command Centre architecture | Roadmap 8.17-8.25 | `docs/agent-state/C00D_DESIGN.md` |
| 5 | C00E — Unified Blueprint (navigation map, page map, info hierarchy, data-source map, existing-function-to-new-surface map, field/action movement, do-not-reimplement list, implementation phases, file-collision boundaries) | Roadmap 8 (CMS-C00E section) | `docs/agent-state/C00E_BLUEPRINT.md` |

### Design inputs available (from analysis)
- `C00E_FUNCTION_CLASSIFICATION_MAP.md` — complete function-level classification
- `ANCHORED_SUMMARY.md` — dirty files, risk assessment, architectural separation
- v2.0 roadmap sections 1-17 (authority, invariants, safety, acceptance chain)
- `CMS_BACKEND_CURRENT_STATE.md` — verified current architecture evidence

### File-collision boundaries (from dirty-file analysis)
Files that multiple design surfaces touch — verify before C00E approval:

| File | Touched By | Collision Risk |
|------|-----------|----------------|
| `src/lib/cms/short-films.ts` (dirty) | C00B Short Film Workspace, C00C Smart Delete, C00D Monetization | HIGH — has duplicate `updateShortFilm()` export |
| `src/lib/cms/episodes.ts` (dirty) | C00B Episode Grid/Inspector, C00C Media Guardian, C00C Smart Delete | HIGH — has duplicate media functions with `cms/media.ts` |
| `src/lib/cms/series.ts` (dirty) | C00B Series Workspace, C00C Smart Delete | MEDIUM — has duplicate `SERIES_STATUSES` export with `constants.ts` |
| `src/lib/cms/media.ts` | C00C Media Guardian, C00B Media workflow | HIGH — has duplicate media functions with `cms/episodes.ts` |
| `src/lib/cms/home.ts` (dirty) | C00B Home Composer, C00C Smart Delete (Home relationships) | MEDIUM — Multi-Spotlight foundation in progress |
| `src/lib/catalog.ts` (dirty) | C00C Smart Delete (consumer visible check), C00D Analytics | HIGH — consumer-facing, do not change |
| `src/lib/home.ts` (dirty) | C00B Home Composer (consumer resolution), C00D Analytics | HIGH — consumer-facing, do not change |
| `src/lib/api/serializers.ts` (dirty) | C00D Analytics (metric serialization) | HIGH — consumer API output, do not change |
| `src/types/database.ts` (dirty) | All surfaces | HIGH — schema types cascade to all queries |
| `src/app/admin/short-films/[id]/page.tsx` (dirty) | C00B Short Film Workspace consolidation | MEDIUM — actively consolidating duplicate controls |
| `supabase/migrations/029_*` | C00C Media Guardian (published_at), C00B New Releases | MEDIUM — unapplied, affects new releases + media readiness |
| `supabase/migrations/030_*` | C00B Content Library auto-rows, C00D Analytics | MEDIUM — unapplied, category row auto-population |
| `src/app/admin/media/page.tsx` | C00C Media Guardian, C00B Media workflow | LOW — media asset table exists |
| `src/app/admin/page.tsx` | C00B Overview (transform) | LOW — dashboard → command center transform |

### Safety rules for Wave 1
- NO code changes to working functions — preserve all KEEP IN PLACE behaviors
- Document collisions and duplicates found (see classification map section 19)
- Propose consolidation plan for media function duplication (episodes.ts ↔ media.ts)
- Propose chai module consolidation (cms/short-films.ts ↔ lib/chai.ts) — admin vs consumer split
- Propose duplicate export removal (updateShortFilm, SERIES_STATUSES)
- Verify Short Film workspace has no duplicate Status/Chai controls (C00E 8.8)
- Design Overview command center to replace dashboard card wall (C00E 8.1)

### Acceptance gate for Wave 1 → Wave 2
- C00B design approved (information architecture, Series/Episode/Short Film workflows, duplication-removal rules)
- C00C design approved (Control Room topology, Media Guardian classifications, Smart Delete model)
- C00D design approved (metrics dictionary, authoritative-vs-telemetry source mapping, privacy rules)
- C00E unified blueprint approved by Product Owner + ChatGPT
- All design docs signed off: maximum status `DESIGN APPROVED — IMPLEMENTATION AUTHORIZED`

---

## Wave 2 — C01 through C03 Implementation (POST C00E APPROVAL)

**Gate**: C00E blueprint approved. No implementation before this gate.

### Wave 2A — CMS-C01: Admin Authentication & Safety

| Task | Functions Affected | Files | Classification |
|------|-------------------|-------|----------------|
| Verify CMS admin auth fail-closed | `getCmsAdminContext`, `requireCmsAdmin` | `cms/auth.ts`, `admin/login/actions.ts`, all admin pages | KEEP IN PLACE (verify) |
| Password recovery flow | `AdminForgotPassword`, `admin/reset-password/` | `components/admin/*`, `admin/reset-password/` | KEEP IN PLACE (verify) |
| Role-appropriate access to Operations/Analytics/destructive | New permission checks | `cms/auth.ts` (extend) | REQUIRES NEW ADDITIVE |
| No privileged secrets in client | All CMS | N/A | Verify constraint |
| Admin Login Panel review | `cmsEmailPasswordLogin` | `admin/login/actions.ts`, `components/admin/AdminLoginPanel.tsx` | KEEP IN PLACE |

**Phase**: C01 — Admin Safety (Wave 2A)

### Wave 2B — CMS-C02: Series & Episode Authoring

| Task | Functions Affected | Files | Classification |
|------|-------------------|-------|----------------|
| Consolidate Series page into workspace | `createSeries`, `updateSeries`, `updateSeriesStatus`, `verifySeriesPublishIntegrity`, `persistSeriesArtwork` | `cms/series.ts`, `admin/series/[id]/page.tsx`, `admin/series/actions.ts`, `components/cms/SeriesMetadataForm.tsx`, `SeriesStatusForm.tsx` | KEEP BEHAVIOR / MOVE UI |
| Build Episode Grid (dense table) | `listEpisodesForSeries`, `resolveEpisodeMediaReadiness` | `cms/episodes.ts`, `components/cms/SeriesEpisodeManager.tsx`, `admin/series/[id]/page.tsx` | KEEP IN PLACE + MOVE UI |
| Build Episode Inspector (side panel) | `updateEpisode`, `updateEpisodeStatus`, `persistEpisodeThumbnail`, `validateEpisodeAccessInput` | `cms/episodes.ts`, `cms/episode-access.ts`, `cms/episode-form.ts`, `components/cms/EpisodeMetadataForm.tsx`, `EpisodeMediaAssignmentForm.tsx`, `admin/series/[id]/episodes/[episodeId]/page.tsx` | MERGE UI + MOVE UI |
| Add-Many | `buildEpisodeInputForBulkCreate`, `BulkEpisodeUploadForm` | `cms/bulk-episodes.ts`, `components/cms/BulkEpisodeUploadForm.tsx`, `admin/series/[id]/episodes/bulk-upload/` | KEEP BEHAVIOR / MOVE UI |
| Remove duplicate SERIES_STATUSES export | `SERIES_STATUSES`, `SERIES_FORMATS` | `cms/series.ts` (remove), `cms/constants.ts` (keep) | REMOVE DUPLICATE UI ONLY |
| Series Episode Defaults | `BulkEpisodeDefaults` | `cms/bulk-episodes.ts` | KEEP BEHAVIOR / MOVE UI |

**Phase**: C02 — Series/Episode Authoring (Wave 2B)

**Critical rules to verify**:
- No mandatory first-3-free; no hardcoded Episode 4 paywall
- Coin price CMS/backend controlled
- Rewarded launch: permanent-only (no session mode); completion count supported
- Backend/CMS authoritative `locked_preview_seconds`

### Wave 2C — CMS-C03: Short Film Authoring & Chai

| Task | Functions Affected | Files | Classification |
|------|-------------------|-------|----------------|
| Consolidate Short Film page (remove duplicate controls) | ShortFilmMetadataForm, ShortFilmChaiConfigForm, `createShortFilm`, `updateShortFilm`, `updateShortFilmStatus`, `verifyShortFilmPublishIntegrity`, `persistShortFilmArtwork` | `admin/short-films/[id]/page.tsx` (dirty), `components/cms/ShortFilmMetadataForm.tsx`, `ShortFilmChaiConfigForm.tsx`, `cms/short-films.ts` (dirty), `cms/short-film-form.ts` | MERGE UI + HIDE AS ADVANCED |
| Remove duplicate `updateShortFilm()` export | `updateShortFilm` | `cms/short-films.ts` | REMOVE DUPLICATE UI ONLY |
| Chai config consolidation | `getShortFilmChaiDetails` (admin), `listChaiAllowedCoinAmountsForAdmin`, `updateChaiAllowedCoinAmount`, `updateShortFilmChaiEnabled` | `cms/short-films.ts`, `lib/chai.ts` | HIDE AS ADVANCED + MERGE into one module |
| Verify no Chai/Status duplication | ShortFilmMetadataForm vs ShortFilmChaiConfigForm | `components/cms/*` | Verify — REMOVE DUPLICATE if found |

**Phase**: C00C + C03 — Short Film Workspace (Wave 2C)

**Critical rules to verify**:
- Short Films always playable; never Coin-locked; never Plus-only
- Plus suppresses Short Film ads at consumer runtime
- Chai = Coin tip via server-authoritative wallet

### Wave 2D — Media Duplication Remediation (prerequisite for C05)

| Task | Functions Affected | Files | Classification |
|------|-------------------|-------|----------------|
| Consolidate `createMediaUploadIntent` | duplicate in `cms/episodes.ts` + `cms/media.ts` | Both | REMOVE DUPLICATE (keep in `media.ts`) |
| Consolidate `attachEpisodeMediaUploadIntent` | duplicate in both | Both | REMOVE DUPLICATE |
| Consolidate `refreshMediaAssetStatus` | duplicate in both | Both | REMOVE DUPLICATE |
| Consolidate `assignEpisodeMediaAsset` | duplicate in both | Both | REMOVE DUPLICATE |
| Keep `assignShortFilmMediaAsset` | unique to `media.ts` | `cms/media.ts` | KEEP IN PLACE |
| Keep `attachShortFilmMediaUploadIntent` | unique to `media.ts` | `cms/media.ts` | KEEP IN PLACE |
| Keep `listReadyMediaAssetsForAdmin` | unique to `media.ts` | `cms/media.ts` | KEEP IN PLACE |
| Keep `deleteMuxAsset`, `createMuxDirectUpload`, `mediaAssetHasRemainingReferences` | unique to `media.ts` | `cms/media.ts` | KEEP IN PLACE / MERGE UI |

**Phase**: C00C prerequisite (can run in parallel with Wave 2B/2C)

---

## Wave 3 — C00C/C00D Implementation (AFTER C00B/C00C/C00D DESIGN APPROVAL)

These design milestones run in parallel with Wave 2 implementation but have their own code phases:

| Phase | Milestone | Type |
|-------|-----------|------|
| C00C design | Operations/Control Room/Media Guardian/Smart Delete architecture | DOCUMENT |
| C00D design | Analytics Command Centre architecture | DOCUMENT |
| C00E | Unified Blueprint approval | DOCUMENT |
| C01 | Admin auth/safety implementation | CODE |
| C02 | Series/Episode authoring | CODE |
| C03 | Short Film/Chai | CODE |
| C04 | Home Composer | CODE |
| C00C implementation | Control Room + Media Guardian + Smart Delete | CODE |
| C00D implementation | Analytics dashboards | CODE |
| C05 | Media/Mux operations | CODE |
| C05B | Smart Delete implementation | CODE |
| C06 | Monetization/Access config | CODE |
| C07 | Ratings/Compliance/Scheduling | CODE |
| C08 | Runtime resilience | CODE |
| C08B | Operations runtime verification | VERIFY |
| C09 | Analytics implementation | CODE |
| C10 | Full QA evidence pack | VERIFY |
| C11 | Owner + ChatGPT review | REVIEW |
| C12 | Owner hands-on | REVIEW |
| C13 | Final reconciliation/lock | LOCK |

---

## Risk Summary

| Risk | Files | Mitigation |
|------|-------|-----------|
| Consumer-facing lib changes break App | `serializers.ts`, `catalog.ts`, `home.ts`, `entitlements.ts` | All KEEP IN PLACE; never modify without API contract approval |
| Dirty files lost | 11 modified + 6 untracked CMS files | Preserve uncommitted work; no `git reset`/`restore` without approval |
| Duplicate exports cause confusion | `short-films.ts` (updateShortFilm x2), `series.ts`+constants.ts (SERIES_STATUSES x2), episodes.ts+media.ts (4 shared fns) | Document + plan removal in Wave 2 |
| Chai admin/consumer split unclear | `cms/short-films.ts` vs `lib/chai.ts` | Merge admin config, preserve consumer server authority |
| Short Film workspace duplication | `admin/short-films/[id]/page.tsx` (dirty), ShortFilmMetadataForm + ShortFilmChaiConfigForm | Verify before C00E approval; ensure single source of truth |
| Unapplied migrations | 029, 030 | Verify schema before any DB-dependent design decisions |
| Implementation before C00E approval | All code phases | Hard gate — no implementation until blueprint signed off |
