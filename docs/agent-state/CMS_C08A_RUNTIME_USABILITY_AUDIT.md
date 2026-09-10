# CMS-C08A — Runtime Usability / Operator Experience Current-State Audit

**Audit Date:** 2026-09-07  
**Mode:** READ-ONLY — source code inspection only  
**Scope:** All CMS admin surfaces at `/admin/*`  
**Authority:** `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md`, `docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md`, `AGENTS.md`  
**Constraint:** No code edits, no CMS data changes, no destructive actions taken.

---

## Methodology Note

This audit is based on **source code inspection** of the Next.js CMS admin application at `src/app/admin/` and `src/components/cms/`. Runtime evidence (screenshots, live browser interaction) was not available per the READ-ONLY constraint. Findings marked with `[RUNTIME]` indicate patterns observable in source that would manifest at runtime. Findings marked `[SOURCE]` are source-code-level observations. No feature is declared "broken" from source inference alone — severity is assigned based on whether the pattern would cause an operator error or workflow block at runtime.

---

## SURFACES AUDITED

| Surface | Path | Source Files | Status |
|---|---|---|---|
| Admin Dashboard | `/admin` | `src/app/admin/page.tsx` | Audited |
| Home Composer | `/admin/home` | `src/app/admin/home/page.tsx` | Audited |
| Series List | `/admin/series` | `src/app/admin/series/page.tsx` | Audited |
| Series Edit | `/admin/series/[id]` | `src/app/admin/series/[id]/page.tsx` | Audited |
| Episode Edit | `/admin/series/[id]/episodes/[episodeId]` | `src/app/admin/series/[id]/episodes/[episodeId]/page.tsx` | Audited |
| New Episode | `/admin/series/[id]/episodes/new` | `src/app/admin/series/[id]/episodes/new/page.tsx` | Audited |
| Bulk Upload | `/admin/series/[id]/episodes/bulk-upload` | `src/app/admin/series/[id]/episodes/bulk-upload/page.tsx` | Audited |
| Short Films List | `/admin/short-films` | `src/app/admin/short-films/page.tsx` | Audited |
| Short Film Edit | `/admin/short-films/[id]` | `src/app/admin/short-films/[id]/page.tsx` | Audited |
| New Short Film | `/admin/short-films/new` | `src/app/admin/short-films/new/page.tsx` | Audited |
| Media | `/admin/media` | `src/app/admin/media/page.tsx` | Audited |
| Billing | `/admin/billing` | `src/app/admin/billing/page.tsx` | Audited |
| Admin Login | `/admin/login` | `src/app/admin/login/page.tsx` | Audited |
| Operations / Control Room | — | **Does not exist** | Not found |
| Publishing surface | — | **No dedicated surface** | Not found |
| Analytics surface | — | **Does not exist** | Not found |

---

## WHAT WORKS

- **Authentication gate**: `requireCmsAdmin()` protects all admin routes. Forbidden states render cleanly with sign-out option.
- **Destructive action protection**: All delete operations require typing confirmation text matching the slug (`DELETE SERIES AND EPISODES {slug}`). `DangerZoneDeleteForm` enforces this with explicit blocker lists.
- **Server-action pattern**: All mutations use Next.js server actions with `revalidatePath()` for cache consistency. Flash/error messaging via URL search params works consistently.
- **CmsSelect component**: ARIA-compliant combobox with keyboard navigation (ArrowUp/Down, Enter, Escape, Home, End, Tab). Focus stays on trigger.
- **Episode manager pagination**: 25-item page size with search, status filter, media filter. Filters reset page on change.
- **Media tab filtering**: Client-side tab switching (all/processing/problems/unassigned) with instant local filtering of preloaded rows.
- **Artwork upload flow**: Signed upload intent → upload → persist pattern works consistently across series, episodes, and short films.
- **Bulk episode upload**: File intake with metadata probing, progress tracking, and per-row retry.
- **Chai configuration**: Dedicated form with duplicate coin amount detection before save.
- **Publish preflight**: Short film edit shows `verifyShortFilmPublishIntegrity` errors before status change.
- **Series status cascade**: Publishing a series explicitly archives/publishes all child episodes with confirmation.
- **Consistent visual language**: Bone/teal/matte-black palette applied uniformly across all admin surfaces.

---

## P1 — BLOCKS OR RISKS DESTRUCTIVE/OPERATOR ERROR

### P1-01: No unsaved-changes / dirty-state indication on any form
**Surface:** All edit pages (series, episode, short film, home rows, billing)  
**Source:** `[SOURCE]` Every form uses `defaultValue` with no `useState` tracking of initial vs. current values. `CmsAutoSubmitCheckbox` auto-submits on change with no dirty indicator. `SeriesStatusForm` uses `useActionState` but never tracks whether the form has been modified.  
**Risk:** An operator makes changes, navigates away (accidentally or intentionally), and loses all work with no warning. There is no `beforeunload` handler, no dirty flag, no "You have unsaved changes" modal.  
**Severity:** P1 — Operator loses work silently. On long forms like the series intake (NewSeriesIntakeForm), this is a significant data-loss risk.

### P1-02: Series publish action publishes all child episodes without per-episode confirmation
**Surface:** `/admin/series/[id]` — SeriesStatusForm  
**Source:** `[SOURCE]` `SeriesStatusForm.handleSubmit` calls `window.confirm("Publish this series and all child episodes?")` only when status is "published". The `handleSubmit` has a guard `if (status !== "published") return;` that prevents non-published submissions, but the `window.confirm` is the only gate.  
**Risk:** If the operator has 50+ episodes, the confirm dialog says "all child episodes" but doesn't list them. An operator could accidentally publish unreleased episodes. The `archiveAllEpisodesForSeries` action on archive also runs silently.  
**Severity:** P1 — Destructive bulk action with no itemized confirmation.

### P1-03: Delete all episodes confirmation uses series slug, not episode-specific identifier
**Surface:** `/admin/series/[id]` — `deleteAllEpisodesAction`  
**Source:** `[SOURCE]` Confirmation value is `DELETE ALL EPISODES ${currentSeries.slug}`. The operator must type this exact string. But the form field label says "Type the confirmation text" and the placeholder shows the confirmation value.  
**Risk:** The operator might confuse this with the series delete confirmation (which also uses the slug). Two different destructive actions both require typing the same slug pattern. A rushed operator could type the series slug for the "delete all episodes" action and vice versa.  
**Severity:** P1 — Two destructive actions with similar confirmation patterns risk wrong-action execution.

### P1-04: Media asset deletion has no visible confirmation step before quarantine
**Surface:** `/admin/media` — `MediaAdminClient`  
**Source:** `[SOURCE]` `handleQuarantineAsset` calls `quarantineMediaAssetAction` directly without a confirmation dialog. The `confirmDeleteMediaAssetAction` requires a `confirmationToken`, but quarantine does not.  
**Risk:** An operator clicks quarantine on a media asset and it's immediately quarantined with no confirmation. The delete flow has explicit confirmation, but quarantine does not. This asymmetry is dangerous.  
**Severity:** P1 — Destructive action (quarantine removes asset from active use) without confirmation.

### P1-05: No loading/skeleton states on any list page
**Surface:** All list pages (series, short-films, billing, home)  
**Source:** `[SOURCE]` All pages are server-rendered async functions. If the database query is slow, the page shows a blank screen with no loading indicator. There are no skeleton screens, spinners, or loading placeholders.  
**Risk:** Operator sees a blank page, assumes the action failed, and may refresh or re-submit, causing duplicate actions.  
**Severity:** P1 — Operator cannot distinguish between "loading" and "error" on any admin page.

---

## P2 — MAJOR WORKFLOW FRICTION

### P2-01: No breadcrumb navigation on any edit page
**Surface:** All edit pages  
**Source:** `[SOURCE]` Series edit has `← Back to series` link. Episode edit has `← Back to series` link. Short film edit has `← Back to short films` link. Home page has `← Back to admin`. But there are no hierarchical breadcrumbs (e.g., `Admin > Series > My Series > Episode 5`).  
**Impact:** Operator loses context when drilling into nested resources. On episode edit, the operator sees the series title in the header but cannot see where they are in the hierarchy without reading the URL.

### P2-02: Home Composer page is extremely long with no section navigation
**Surface:** `/admin/home`  
**Source:** `[SOURCE]` The page contains: Spotlight section, Overview Metrics, Low-history threshold, Create editorial row, Home Rows list (with nested add-item forms, move buttons, remove buttons). The page is a single scrollable page with 960+ lines of JSX.  
**Impact:** Operator must scroll extensively to reach lower sections. No anchor links, no "back to top" button, no section navigation. The "Create editorial row" form is buried below the entire rows list.

### P2-03: Series list has no pagination, filtering, or search
**Surface:** `/admin/series`  
**Source:** `[SOURCE]` `listSeriesForAdmin()` returns all series. The page renders them in a single `<div>` with `<Link>` items. No pagination, no search, no status filter.  
**Impact:** With 100+ series, the page becomes extremely long. Operator cannot find a specific series quickly. Compare with the Episode manager which has search + filters + pagination.

### P2-04: Short films list has no pagination, filtering, or search
**Surface:** `/admin/short-films`  
**Source:** `[SOURCE]` Same pattern as series list — `listShortFilmsForAdmin()` returns all items, rendered in a single list.  
**Impact:** Same as P2-03. Inconsistent with the episode manager which has proper filtering.

### P2-05: Billing page has no pagination or search
**Surface:** `/admin/billing`  
**Source:** `[SOURCE]` `listCoinProducts()` returns all products. Rendered in a flat list with reorder buttons.  
**Impact:** With many coin packs, the list becomes unwieldy. No search by code or name.

### P2-06: No keyboard shortcuts for common operations
**Surface:** All admin pages  
**Source:** `[SOURCE]` No `document.addEventListener('keydown')` handlers for shortcuts (except Escape to close episode modal). No Ctrl+S for save, no Ctrl+K for search.  
**Impact:** Operator must use mouse for every action. On dense pages like the Home Composer, this is slow.

### P2-07: Episode manager "Configure access" vs "Full episode editor" creates context confusion
**Surface:** `/admin/series/[id]/episodes` — `SeriesEpisodeManager`  
**Source:** `[SOURCE]` Each episode row has two buttons: "Configure access" (opens modal) and "Full episode editor" (navigates to full page). The modal says "This panel is scoped to quick access and metadata configuration. For Media, Thumbnail, Status and advanced controls, open the full episode editor."  
**Impact:** Operator may not understand what "Configure access" actually does vs. the full editor. The modal only has metadata + access summary, but the description mentions "Media, Thumbnail, Status and advanced controls" as being in the full editor — which could imply the modal is incomplete.

### P2-08: Media page has no refresh button or auto-refresh
**Surface:** `/admin/media`  
**Source:** `[SOURCE]` The `MediaAdminClient` receives `initialRows` from server. Tabs switch client-side. But there is no "Refresh" button to reload data from the server. The `refreshMediaAssetAction` exists but is only called per-asset, not for the whole table.  
**Impact:** If an asset's status changes on the backend (e.g., Mux processing completes), the operator must manually reload the page to see the update. No freshness indicator.

### P2-09: No saved views or filter presets
**Surface:** All list pages with filters (episode manager, media)  
**Source:** `[SOURCE]` Episode manager has search + status + media filters. Media has tabs. But no "Save view" or "Share filter" functionality.  
**Impact:** Operators who frequently use the same filter combination must re-apply filters each time.

### P2-10: Series edit page has no save confirmation or success indicator
**Surface:** `/admin/series/[id]` — `updateSeriesAction`  
**Source:** `[SOURCE]` After saving metadata, `revalidatePath(seriesEditPath(id))` is called but there is no flash message, no toast, no "Saved" indicator. The page just re-renders.  
**Impact:** Operator doesn't know if the save succeeded. They must look for subtle changes (e.g., the metadata values updating).

### P2-11: Episode status change has no confirmation for non-published transitions
**Surface:** `/admin/series/[id]/episodes/[episodeId]` — `updateStatusAction`  
**Source:** `[SOURCE]` The status change uses `CmsSelect` + `Button type="submit"`. No `window.confirm` for draft→archived or published→draft transitions. Only the series-level publish has confirmation.  
**Impact:** An operator could accidentally archive a published episode with one click.

### P2-12: Short film publish preflight shows errors but doesn't block the dropdown
**Surface:** `/admin/short-films/[id]` — `verifyShortFilmPublishIntegrity`  
**Source:** `[SOURCE]` The publish preflight shows errors in a list below the status dropdown. But the `CmsSelect` for status still allows selecting "published" regardless of preflight errors.  
**Impact:** Operator sees errors but can still click "Update status" to publish. The preflight is informational, not a gate.

---

## P3 — POLISH / CLARITY

### P3-01: Inconsistent "Back" link patterns
**Surface:** Various  
**Source:** `[SOURCE]` Some pages have `← Back to admin`, others have `← Back to series`, others have `← Back to short films`. The Home Composer has `← Back to admin`. But the Series list page has NO back link — it just has "New series" button.  
**Impact:** Inconsistent navigation patterns confuse operators about where they are.

### P3-02: Status badge colors are inconsistent across surfaces
**Surface:** Series, short films, episodes, media, billing  
**Source:** `[SOURCE]` Series uses `draft: text-bone/50`, `published: text-teal`, `archived: text-bone/30`. Short films use the same. Billing uses `active: text-teal`, `inactive: text-bone/30`. Media uses `classificationVariant` with `success/processing/error`. The color semantics differ — "archived" and "inactive" both use `text-bone/30` but mean different things.  
**Impact:** Operator must read the text label to understand the status, not just the color.

### P3-03: "Refresh processing uploads" button appears only conditionally
**Surface:** `/admin/series/[id]` — `refreshProcessingMediaAction`  
**Source:** `[SOURCE]` The button only renders when `hasUnassignedMediaEpisode` is true. The button label says "Refresh processing uploads" but the action description says it "reconciles orphaned processing media assets."  
**Impact:** The label doesn't match the action. An operator might expect it to refresh all processing uploads, but it only reconciles orphaned ones.

### P3-04: Home Composer "Spotlight Active" badge is ambiguous
**Surface:** `/admin/home` — Spotlight section  
**Source:** `[SOURCE]` The badge shows `Spotlight Active · N items` or `Spotlight Disabled`. But there's no indication of whether the spotlight is actually visible to consumers vs. just configured.  
**Impact:** Operator may not understand the difference between "Spotlight configured" and "Spotlight shown to consumers."

### P3-05: Episode number display uses `padStart(2, "0")` but no zero-padding for 100+
**Surface:** `/admin/series/[id]/episodes` — `SeriesEpisodeManager`  
**Source:** `[SOURCE]` `String(row.episode.episode_number).padStart(2, "0")` displays "EP 01", "EP 02", etc. But for episode 100, it shows "EP 100" (3 digits). The padding only affects single-digit numbers.  
**Impact:** Visual inconsistency in episode numbering display.

### P3-06: No "last updated" or freshness timestamp on any list
**Surface:** All list pages  
**Source:** `[SOURCE]` Series list shows title, slug, episode count, status. No updated_at, created_at, or last_modified. Short film list shows title, slug, duration, publish_at. No freshness indicator.  
**Impact:** Operator cannot tell which items were recently modified.

### P3-07: CmsSelect placeholder text says "Choose…" but no visual distinction from selected
**Surface:** All CmsSelect usages  
**Source:** `[SOURCE]` The trigger shows the selected value or `placeholderLabel`. The selected value and placeholder have the same font styling. Only the opacity differs (`text-[#E8E4DA]/40` for placeholder).  
**Impact:** On dark backgrounds, the distinction between "no selection" and "selected" is subtle.

### P3-08: Bulk upload form has `min-w-[1180px]` table
**Surface:** `/admin/series/[id]/episodes/bulk-upload` — `BulkEpisodeUploadForm`  
**Source:** `[SOURCE]` The review queue table has `min-w-[1180px]`. On screens narrower than 1180px, the table overflows horizontally.  
**Impact:** Operator on a standard laptop screen (typically 1366px or 1536px) sees a horizontally scrollable table. The table columns are dense and hard to read when scrolled.

### P3-09: Series intake form has 6-second polling interval
**Surface:** `/admin/series/new` — `NewSeriesIntakeForm`  
**Source:** `[SOURCE]` `useEffect` sets `window.setInterval(() => processingPollTickRef.current(), 6000)` for processing media. The comment says "Auto-refresh rows still processing on Mux."  
**Impact:** 6-second polling is aggressive for a form that the operator may have left open. If the operator steps away, the polling continues. No cleanup on unmount is visible in the source.

### P3-10: Admin login page says "Temporary QA CMS"
**Surface:** `/admin/login`  
**Source:** `[SOURCE]` The login page header says "Temporary QA CMS" and the subtitle says "Email/password access for the temporary QA admin account while CMS phone OTP is offline."  
**Impact:** This label may be stale if the OTP system is now operational. It could mislead operators into thinking the CMS is not production-grade.

---

## DEAD CONTROLS

| ID | Control | Location | Evidence |
|---|---|---|---|
| DEAD-01 | `← Back to admin` link on Home Composer | `/admin/home` — line 477 | Present but redundant since the admin nav grid is accessible from any page. Not actually dead, but the link destination (`/admin`) is the same as the current page's parent. |
| DEAD-02 | `Refresh processing uploads` button | `/admin/series/[id]` | Only visible when `hasUnassignedMediaEpisode`. If no unassigned media episodes exist, the button never appears. The action itself (`reconcileOrphanedProcessingMediaAssets`) is a valid operation but the trigger condition is narrow. |
| DEAD-03 | `series.row_role === "editorial"` delete button | `/admin/home` — line 779 | Only editorial rows can be deleted. `start_here` rows cannot be deleted (the `deleteHomeEditorialRow` action explicitly blocks it). The UI doesn't explain why the delete button is absent for start_here rows. |
| DEAD-04 | `CmsAutoSubmitCheckbox` on `showTitle` toggle | `/admin/home` — Spotlight items | Auto-submits on checkbox change. No visual feedback that it auto-submitted. The operator may not realize the change was saved. |

---

## DUPLICATE CONTROLS

| ID | Control | Location | Evidence |
|---|---|---|---|
| DUP-01 | "Add" button patterns | `/admin/home` (Add Spotlight Content, Add content to row), `/admin/series/[id]` (Add episodes), `/admin/short-films/new` (Create short film) | Each surface has its own "Add" flow with different forms and validation. No shared "Add content" pattern. |
| DUP-02 | Artwork upload fields | Series edit, Episode edit, Short film edit, New series, New short film | `ArtworkUploadField` is used in 5+ places with identical props patterns. The upload intent → persist pattern is duplicated across all surfaces. |
| DUP-03 | Media assignment forms | `EpisodeMediaAssignmentForm`, `MediaAssetAssignmentForm` | Nearly identical components with different labels. Both use `CmsSelect` + `useActionState` + assign button. |
| DUP-04 | Delete confirmation pattern | `DangerZoneDeleteForm` used for series, episodes, short films, media | The confirmation text pattern (type the slug) is identical across all delete forms. The `DangerZoneDeleteForm` component is well-designed but the confirmation mechanism is repetitive. |
| DUP-05 | "Refresh" actions | `refreshProcessingMediaAction` (series), `refreshMediaAssetAction` (media), `refreshRow` (bulk upload) | Three different refresh mechanisms with different scopes and triggers. |

---

## MISLEADING CONTROLS

| ID | Control | Location | Evidence |
|---|---|---|---|
| MIS-01 | "Quick configure access" modal title | `/admin/series/[id]/episodes` — `SeriesEpisodeManager` | The modal title says "Quick configure access & metadata" but the actual content is EpisodeMetadataForm + access summary. The operator might expect access configuration (coin price, free access, etc.) to be the primary function, but it's actually metadata editing with access info as secondary. |
| MIS-02 | "Refresh processing uploads" label | `/admin/series/[id]` | The button label says "Refresh processing uploads" but the action reconciles orphaned processing media assets. It doesn't refresh all processing uploads — only those that were orphaned. |
| MIS-03 | "Spotlight Active" status badge | `/admin/home` | Shows "Spotlight Active · N items" but doesn't indicate whether the spotlight is actually being shown to consumers. The `isSpotlightEnabled` toggle controls this separately. |
| MIS-04 | "Ready to publish" text | `/admin/short-films/[id]` — publish preflight | Shows "Ready to publish" when `publishIntegrityErrors.length === 0`. But this doesn't mean the short film is actually published — it just means there are no preflight errors. The operator still needs to change the status dropdown to "published". |
| MIS-05 | "Create editorial row" form | `/admin/home` | The form creates a row with `row_role: "editorial"` by default. But the operator might not understand that "editorial" rows can be deleted while "start_here" rows cannot. |

---

## EMPTY/LOADING STATES

| ID | State | Location | Evidence |
|---|---|---|---|
| EMPTY-01 | "No series yet." | `/admin/series` | Simple text. No illustration, no call-to-action beyond "New series" button. |
| EMPTY-02 | "No short films yet." | `/admin/short-films` | Same pattern as series. |
| EMPTY-03 | "No coin products configured." | `/admin/billing` | Same pattern. |
| EMPTY-04 | "No episodes match the current filters." | `/admin/series/[id]/episodes` | Shows when filters return no results. No "Clear filters" link. |
| EMPTY-05 | "No home rows configured." | `/admin/home` | Shows when no rows exist. |
| EMPTY-06 | "No media assets in this view." | `/admin/media` | Shows per-tab. |
| EMPTY-07 | **No loading/skeleton states anywhere** | All pages | `[SOURCE]` Every page is server-rendered with no loading placeholder. If the database query is slow, the operator sees a blank page. |

---

## ERROR STATES

| ID | Error State | Location | Evidence |
|---|---|---|---|
| ERR-01 | Flash/error messages via URL search params | All pages | `flashMessage` and `errorMessage` are rendered as colored banners. Error messages are red, flash messages are teal. This pattern works but is transient — the message disappears on refresh. |
| ERR-02 | `DangerZoneDeleteForm` error display | All delete forms | Shows `state.error` in red text. Blockers are shown as a list. This is well-designed. |
| ERR-03 | `CmsSelect` error handling | All selects | No inline error display for select validation. Errors are shown as text below the form. |
| ERR-04 | **No error boundary** | Entire admin app | `[SOURCE]` No React error boundary component exists in the admin routes. If a component throws, the entire page crashes with a blank screen. |
| ERR-05 | **No network error handling** | All server actions | `[SOURCE]` Server actions redirect on error but don't handle network failures gracefully. If the fetch fails, the operator sees a redirect to an error URL with no retry option. |

---

## SAVE/DIRTY STATE

| ID | Finding | Location | Evidence |
|---|---|---|---|
| DS-01 | **No dirty state tracking** | All edit forms | `[SOURCE]` Every form uses `defaultValue` with no comparison to current values. No `useState` for tracking modifications. |
| DS-02 | **No unsaved changes warning** | All edit forms | `[SOURCE]` No `beforeunload` event listener. No modal warning on navigation away. |
| DS-03 | **Auto-submit on checkbox change** | `/admin/home` — `CmsAutoSubmitCheckbox` | Checkbox changes immediately submit the form. No "Save" button. The operator may not realize the change was saved. |
| DS-04 | **Auto-submit on CmsSelect change** | Various | `CmsSelect` calls `onChange` which may trigger server actions. No confirmation. |
| DS-05 | **SeriesStatusForm has `pending` state** | `/admin/series/[id]` | Shows "Updating…" while pending. But no success indicator after save. |
| DS-06 | **EpisodeMetadataForm has `submitMode`** | `/admin/series/[id]/episodes` | Supports "save" and "save-and-next" modes. The "save-and-next" advances to the next episode. But no dirty state — the operator can click "Save & Next" without knowing if changes were made. |

---

## BULK WORKFLOW

| ID | Finding | Location | Evidence |
|---|---|---|---|
| BW-01 | **No bulk select/delete** | `/admin/series`, `/admin/short-films` | `[SOURCE]` No checkboxes on list items. No "Select all" or "Delete selected" functionality. Each item must be edited/deleted individually. |
| BW-02 | **Bulk episode upload exists** | `/admin/series/[id]/episodes/bulk-upload` | Well-designed batch upload with progress tracking, per-row retry, and metadata review. But it's a separate page, not accessible from the episode list. |
| BW-03 | **Series publish cascades to all episodes** | `/admin/series/[id]` | Publishing a series publishes all child episodes. No per-episode selection. |
| BW-04 | **No bulk status change** | `/admin/series`, `/admin/short-films` | `[SOURCE]` Cannot change status for multiple items at once. Must edit each item individually. |
| BW-05 | **Bulk episode creation in intake form** | `/admin/series/new` | The `NewSeriesIntakeForm` creates a series and all episodes in one workflow. But this is only for new series creation, not for adding episodes to existing series. |

---

## HIGH-VOLUME READINESS

| ID | Finding | Location | Evidence |
|---|---|---|---|
| HV-01 | **No pagination on series list** | `/admin/series` | `[SOURCE]` All series rendered in a single list. No pagination. With 100+ series, this is a performance and usability problem. |
| HV-02 | **No pagination on short films list** | `/admin/short-films` | Same as series. |
| HV-03 | **No pagination on billing list** | `/admin/billing` | Same pattern. |
| HV-04 | **Episode manager has 25-item pagination** | `/admin/series/[id]/episodes` | The only page with proper pagination. `pageSize = 25`. |
| HV-05 | **No virtualization** | Any page | `[SOURCE]` No virtual scrolling. All rows are rendered in the DOM. With 1000+ media assets, the Media page would be extremely slow. |
| HV-06 | **Media page loads all rows server-side** | `/admin/media` | `getMediaViewRows({}, "all")` loads all media assets. No cursor-based pagination. |
| HV-07 | **No search on series/short-film/billing lists** | `/admin/series`, `/admin/short-films`, `/admin/billing` | `[SOURCE]` No search input. Operator must scroll through all items. |
| HV-08 | **Episode manager search is client-side only** | `/admin/series/[id]/episodes` | Search filters `rows` array in memory. With 1000+ episodes, this could be slow. |

---

## DESTRUCTIVE UX

| ID | Finding | Location | Evidence |
|---|---|---|---|
| DU-01 | **Delete series requires typing the slug** | `/admin/series/[id]` | `DangerZoneDeleteForm` requires `confirmation === currentSeries.slug`. This is a good pattern but the slug is visible in the URL and page header. |
| DU-02 | **Delete all episodes requires typing `DELETE ALL EPISODES {slug}`** | `/admin/series/[id]` | Similar pattern. But the confirmation string is longer and more complex. |
| DU-03 | **Delete series + episodes requires typing `DELETE SERIES AND EPISODES {slug}`** | `/admin/series/[id]` | Three different delete actions with three different confirmation strings. Risk of confusion. |
| DU-04 | **Delete episode requires typing `{slug}#{episodeNumber}`** | `/admin/series/[id]/episodes/[episodeId]` | Different format from series delete. Operator must remember the `#` separator. |
| DU-05 | **Delete short film requires typing the slug** | `/admin/short-films/[id]` | Same as series delete. |
| DU-06 | **Media asset quarantine has NO confirmation** | `/admin/media` | `[SOURCE]` `handleQuarantineAsset` calls the action directly. No confirmation dialog. This is the most dangerous gap. |
| DU-07 | **Media asset delete requires confirmation token** | `/admin/media` | `confirmDeleteMediaAssetAction` requires a `confirmationToken`. The token is presumably generated server-side. But the operator doesn't see the token — it's handled internally. |
| DU-08 | **No undo/rollback for any delete** | All delete actions | `[SOURCE]` All deletes are permanent. No trash/bin/undo mechanism. |

---

## STATUS VOCABULARY

| ID | Finding | Location | Evidence |
|---|---|---|---|
| SV-01 | **`draft` / `published` / `archived` used across series, episodes, short films** | All content types | Consistent vocabulary. Good. |
| SV-02 | **`active` / `inactive` used for billing** | `/admin/billing` | Different vocabulary from content types. An operator might confuse "inactive" coin product with "archived" series. |
| SV-03 | **`ready` / `processing` / `failed` / `pending` / `not assigned` for media** | `/admin/media`, episode manager | Different vocabulary from content types. The media status vocabulary is more technical. |
| SV-04 | **`consumerVisible` flag on home items** | `/admin/home` | Not a status badge — it's a property shown as "(Published)" or "(Hidden)" next to the status. This is confusing because the status badge already shows `draft`/`published`/`archived`. |
| SV-05 | **`row_role` property on home rows** | `/admin/home` | Shows "Canonical Start Here" badge for `start_here` rows and nothing for `editorial` rows. The operator may not understand what `row_role` means. |
| SV-06 | **`sharePath` shown as "Path:"** | `/admin/home` | Shows the share path or "Orphaned item". The term "orphaned" is technical and alarming. |

---

## FRESHNESS/REFRESH

| ID | Finding | Location | Evidence |
|---|---|---|---|
| FR-01 | **No auto-refresh on any list page** | All admin pages | `[SOURCE]` After a server action, `revalidatePath()` is called but the page doesn't auto-refresh. The operator must manually reload or navigate away and back. |
| FR-02 | **No "last updated" timestamp** | All list pages | `[SOURCE]` No freshness indicator on any data display. |
| FR-03 | **Intake forms have 6-second polling** | `/admin/series/new`, `/admin/short-films/new` | Only the intake forms have auto-refresh. This is appropriate for upload workflows but inconsistent with other pages. |
| FR-04 | **`revalidatePath` after mutations** | All server actions | Cache is revalidated after mutations, but the page doesn't automatically update. The operator sees the old data until they refresh. |
| FR-05 | **No stale-while-revalidate pattern** | Any page | `[SOURCE]` No SWR or similar pattern for background data updates. |

---

## ACCESSIBILITY

| ID | Finding | Location | Evidence |
|---|---|---|---|
| AX-01 | **Focus-visible outlines present** | All interactive elements | `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal` is consistently applied. Good. |
| AX-02 | **CmsSelect has ARIA attributes** | `CmsSelect.tsx` | `role="combobox"`, `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`. Well-implemented. |
| AX-03 | **Color contrast concerns** | All pages | The palette uses `#E8E4DA` (bone) on `#050505` (matte black). The text-bone/50, text-bone/60, text-bone/70 variants may not meet WCAG AA contrast ratios. |
| AX-04 | **Status badges use color alone** | All list pages | Status badges use `text-teal`, `text-bone/50`, `text-bone/30` with border colors. Color-blind operators may not distinguish statuses. |
| AX-05 | **No skip-to-content link** | All pages | `[SOURCE]` No skip navigation link. |
| AX-06 | **Form labels present but some are visual-only** | All forms | Labels use `font-mono text-[0.65rem] uppercase tracking-[0.18em] text-bone/50` which is very small and low-contrast. May be hard to read. |
| AX-07 | **`CmsAutoSubmitCheckbox` has no aria-label** | `/admin/home` | The checkbox input has no `aria-label`. The label text is the child content, but the checkbox itself may not be properly announced. |
| AX-08 | **No `aria-live` for dynamic content** | All pages | `[SOURCE]` Flash/error messages appear without `aria-live` regions. Screen readers may not announce them. |

---

## MOBILE/TABLET BREAKAGE

| ID | Finding | Location | Evidence |
|---|---|---|---|
| MB-01 | **No responsive breakpoints in admin CSS** | All admin pages | `[SOURCE]` Admin pages use `min-h-screen bg-deep px-4 py-10` with `max-w-*` containers. No `md:`, `lg:`, or `xl:` responsive classes on the main layout. The admin is designed for desktop only. |
| MB-02 | **Grid layouts assume wide screens** | `/admin/home`, `/admin/media` | `sm:grid-cols-2 lg:grid-cols-4` on the admin nav grid. But the edit pages use `max-w-3xl`, `max-w-4xl`, `max-w-6xl` without responsive adjustments. |
| MB-03 | **Dense tables overflow on small screens** | `/admin/media`, bulk upload | The media table and bulk upload table have many columns. On mobile, these would overflow horizontally. |
| MB-04 | **Episode manager modal is `max-h-[90vh]`** | `/admin/series/[id]/episodes` | The modal uses `max-h-[90vh]` and `sm:items-center`. On mobile, this would be nearly full-screen. |
| MB-05 | **No touch target sizes verified** | All interactive elements | Buttons use `h-12` on login but standard padding elsewhere. The `CmsSelect` trigger has `h-auto`. Touch targets may be too small for tablet use. |

---

## ACCIDENTAL DUPLICATE CONTROLS

| ID | Finding | Location | Evidence |
|---|---|---|---|
| ADC-01 | **Multiple "Add" buttons with different meanings** | `/admin/home` (Add Spotlight Content, Add content to row), `/admin/series/[id]` (Add episodes), `/admin/short-films/new` (Create short film) | Each surface has its own "Add" flow. No unified "Add content" pattern. |
| ADC-02 | **"Save" and "Save row" and "Save changes" labels** | Various edit forms | Different labels for the same action. "Save row" on home rows, "Save changes" on series/episode/short film, "Save" on episode metadata. |
| ADC-03 | **"Remove" and "Delete" used interchangeably** | Various | Home row items use "Remove", series/episodes use "Delete", media uses "Delete". The distinction is not consistent. |
| ADC-04 | **"Configure access" and "Open full episode editor"** | `/admin/series/[id]/episodes` | Two buttons that both lead to episode configuration but with different scopes. The operator may not understand the difference. |

---

## CONTEXT LOSS BETWEEN LIST/DETAIL/EDIT

| ID | Finding | Location | Evidence |
|---|---|---|---|
| CL-01 | **No breadcrumbs on any edit page** | All edit pages | Operator navigates from list → detail → edit but has no breadcrumb trail. |
| CL-02 | **Series list → Series edit → Episode edit loses series context** | `/admin/series/[id]/episodes/[episodeId]` | The episode edit page shows the series title in the header but the operator must read the URL to know which series they're editing. |
| CL-03 | **Home Composer → Home row → Row item has no navigation trail** | `/admin/home` | The nested forms within home rows have no visual indication of the hierarchy. |
| CL-04 | **Media asset detail panel closes without navigation** | `/admin/media` | Clicking a row opens `AssetDetailPanel` as a modal. Closing it returns to the same view. No navigation history. |
| CL-05 | **Bulk upload page is separate from episode list** | `/admin/series/[id]/episodes/bulk-upload` | The bulk upload page is a separate route. The operator must navigate back to the episode list to see the results. |

---

## TOP 10 OPERATOR FRICTIONS

1. **No unsaved-changes warning** — Operator loses work on every form when navigating away accidentally. (P1)
2. **No loading/skeleton states** — Operator sees blank pages during slow queries and cannot distinguish loading from error. (P1)
3. **No pagination on series/short-film/billing lists** — With 100+ items, lists become unwieldy and slow. (P2)
4. **Media quarantine has no confirmation** — Destructive action without any gate. (P1)
5. **Home Composer is a single extremely long page** — No section navigation, no anchor links, no back-to-top. (P2)
6. **No keyboard shortcuts** — Every action requires mouse interaction. (P2)
7. **No breadcrumb navigation** — Operator loses context when drilling into nested resources. (P2)
8. **Inconsistent status vocabulary** — `draft/published/archived` vs `active/inactive` vs `ready/processing/failed`. (P3)
9. **No freshness indicators** — No "last updated" timestamps, no auto-refresh on list pages. (P2)
10. **No bulk select/delete** — Must edit/delete items one at a time on all list pages. (P2)

---

## SAFE UX SLICES

These are patterns that work well and should be preserved/extended:

- **`DangerZoneDeleteForm` component** — Explicit confirmation text matching, blocker lists, pending state. This is the gold standard for destructive action UX.
- **`CmsSelect` ARIA implementation** — Proper combobox pattern with keyboard navigation and ARIA attributes.
- **Episode manager pagination + filters** — 25-item page size with search, status filter, and media filter. The pattern should be replicated on series/short-film/billing lists.
- **Server action + `revalidatePath` pattern** — Consistent cache invalidation after mutations.
- **Flash/error message banners** — Teal for success, red for error. Consistent visual language.
- **Artwork upload flow** — Signed intent → upload → persist pattern works reliably across all surfaces.
- **`SeriesEpisodeManager` modal panel** — Quick configure access with Escape-to-close and body scroll lock.
- **Bulk episode upload progress tracking** — Per-row status with progress bars and retry.

---

## REQUIRES_OWNER_DECISION

| ID | Decision | Rationale |
|---|---|---|
| OWN-01 | Should the admin CMS have a dedicated Operations/Control Room surface? | Does not exist in source. The Bible mentions "Control Room" but no code exists. |
| OWN-02 | Should the admin CMS have an Analytics surface? | Does not exist in source. The Bible mentions analytics but no admin analytics UI exists. |
| OWN-03 | Should the "Temporary QA CMS" label be removed from the login page? | The label may be stale if phone OTP is now operational. |
| OWN-04 | Should the admin have a dedicated Publishing dashboard? | No publishing surface exists. Publishing is done inline on each content type's edit page. |
| OWN-05 | Should the 6-second polling interval on intake forms be reduced? | Aggressive polling may cause unnecessary server load. |
| OWN-06 | Should the admin have mobile/tablet support? | Currently desktop-only. The Bible doesn't specify admin mobile support. |

---

## DO_NOT_CHANGE

Per the audit constraints and the Locked Final Acceptance Protocol:

- **Do not change financial/playback/content authority** — Billing prices, coin amounts, episode access rules, and content classification are backend-controlled. The admin UI renders these values but does not set them.
- **Do not change the destructive action confirmation pattern** — The `DangerZoneDeleteForm` pattern (type the slug to confirm) is fail-closed and must remain.
- **Do not change the `CmsSelect` ARIA implementation** — It is correctly implemented and changing it could break accessibility.
- **Do not change the server action + `revalidatePath` pattern** — This is the correct pattern for cache consistency.
- **Do not add new paid dependencies** — Per the Lean Build principle.
- **Do not change the visual palette** — Bone/teal/matte-black is the locked visual direction.

---

## BLOCKER

**BLOCKER-01: No unsaved-changes protection on any form**

This is the single highest-risk finding. Every edit page in the CMS lacks dirty-state tracking and unsaved-changes warnings. An operator who makes changes and navigates away (accidentally clicking a link, pressing Back, or closing the tab) loses all work silently. This affects every edit page: series, episode, short film, home rows, billing, and the intake forms.

**Impact:** Data loss, operator frustration, potential for duplicate submissions when operators re-create lost work.

**Recommendation:** Add `useState` tracking of initial form values, compare on navigation attempt, and show a `beforeunload` warning. This is a foundational UX fix that should be implemented before any other CMS-C08B work.

---

## NEXT: CMS-C08B IMPLEMENTATION PLAN

The CMS-C08B implementation plan should prioritize:

1. **Fix BLOCKER-01**: Add dirty-state tracking and unsaved-changes warnings to all edit forms.
2. **Add loading/skeleton states** to all list pages and edit forms.
3. **Add pagination** to series, short-film, and billing lists.
4. **Add confirmation dialog** for media asset quarantine.
5. **Add breadcrumb navigation** to all edit pages.
6. **Add section navigation** to the Home Composer page.
7. **Add keyboard shortcuts** for common operations (Ctrl+S, Ctrl+K).
8. **Add freshness indicators** ("last updated" timestamps, auto-refresh).
9. **Add bulk select/delete** to all list pages.
10. **Add error boundaries** to the admin app.

---

## STOP

Return to Product Owner + ChatGPT.

**Audit complete. No code changes made. No CMS data modified. No destructive actions taken.**

---

*Report generated from source code inspection at `C:\Users\Akash\Documents\0nyapp`. Runtime evidence was not available per READ-ONLY constraint. All findings are source-code-level observations that would manifest as runtime UX issues.*
