# CMS-C08B — Runtime Usability / Operator Experience — CONSOLIDATION GATE

**Gate Date:** 2026-09-11
**Mode:** VERIFY + DOCUMENT ONLY — no feature work, no Android, no prod, no migrations, no broad cleanup.
**Branch:** `qa/netlify-api-e34ab5e`
**HEAD:** `e1a33fd` — `chore(deploy): update Cloud Run image tag to c08b-07b-deploy`
**Approved QA authority:** `https://onya-qa-api-gwkke6nq5a-el.a.run.app` (Cloud Run) / Supabase DB / Mux media.
**Verification scope:** SOURCE-level (code + tests + typecheck + lint + git + live read-only HTTP probes).
Per the Locked Final Acceptance Protocol (31 Aug 2026) this gate reaches **SOURCE VERIFIED**; final LOCK additionally requires Emulator/Visual + Product Owner + ChatGPT + hands-on gates.

---

## 1. Scope of the gate

Locked slices verified to coexist without regression:

| Slice | Title | Result |
|---|---|---|
| C08B-01 | Unsaved Changes Protection | PASS — VERIFIED |
| C08B-02 | Destructive Action Confirmation | PASS — VERIFIED |
| C08B-03 | Loading + Error State Consistency | PASS — VERIFIED |
| C08B-04 | High-Volume Pagination + Filtering | PASS — VERIFIED |
| C08B-05 | Breadcrumbs + Context Preservation | PASS — VERIFIED (1 P2 gap, see §13) |
| C08B-06 | Home Composer Operator Friction | PASS — VERIFIED |
| C08B-07 | Freshness / Refresh / Status Clarity | PASS — VERIFIED |

---

## 2. Verification methodology

- Source inspection of all `/admin/*` pages, `src/components/cms/*`, `src/lib/cms/*`, `src/lib/routes.ts`, admin `layout/loading/error`.
- Executed the pinned CMS regression suite (`npm test`), the C08B targeted tests, `tsc --noEmit`, ESLint on CMS-touched areas, `git diff --check`.
- Confirmed the deployed QA revision via `gcloud run revisions list` (read-only) plus live read-only HTTP probes of the QA host.
- No CMS data was modified. No destructive action was taken. No code was changed by this gate.

---

## 3. C08B-01 — Unsaved Changes Protection — PASS

Single dirty-tracking system, no parallel implementation:

- `src/lib/cms/unsaved-changes.tsx` — one `UnsavedChangesProvider`/`UnsavedChangesContext`. A `dirtyForms: Set<string>` drives `hasUnsavedChanges`; `registerForm/unregisterForm/markDirty/markClean/isFormDirty` are the only mutation paths. Browser **popstate** interception (Back/Forward) and `attemptNavigation` both route through one modal (Stay / Leave without saving). No `beforeunload` anywhere in the CMS.
- `src/lib/cms/form-wrapper.tsx` — `FormWrapper` keeps `values` vs `initialValues` (ref-stabilised) and attaches `input` listeners to every `input/select/textarea`; dirty compare via deep `isEqual`.
- `src/components/cms/DirtyLink.tsx` — intercepts `<Link>` clicks when dirty and routes through `attemptNavigation`.
- Mounted exactly once at `src/app/admin/layout.tsx` so every `/admin` surface shares the system.
- **Failed / validation save preserves values + dirty state:** `updateHomeRowAction` returns `{ success:false, error }` on validation or save failure (no redirect). `HomeRowForm.handleSubmit` renders `serverError`, does not reset values, and `FormWrapper` state + `dirtyForms` remain intact. Runtime probe evidence exists: `scripts/c08b-06-screenshots/probe-02-after-invalid-submit.png`, `probe-03-unsaved-warning.png`.
- **No parallel dirty system:** confirmed — only `unsaved-changes.tsx` implements dirty tracking. `src/lib/cms/navigation-guard.tsx` (`useNavigationGuard`) is present but **unused dead code** (see Open P2).
- Tests: `src/lib/cms/unsaved-changes.test.ts` PASS.

## 4. C08B-02 — Destructive Action Confirmation — PASS

- `DangerZoneDeleteForm` keeps the locked M6B pattern: type-the-exact-confirmation-text (slug or `DELETE SERIES AND EPISODES <slug>`), blocker list surfaced, submit disabled while pending. Used for series (delete all episodes / series+episodes / series), short film, and episode deletion.
- `DangerZoneConfirmButton` / `DangerZoneConfirmDialog` (rose/amber, explicit consequence, working-state) cover Home-row delete and media delete/quarantine confirmations.
- **M6B safety unchanged:** `media-delete-executor.ts`, `media-delete-impact.ts`, `media-delete-impact-classifier.ts` — zero commits touch them after `b343427` (confirmed via `git diff b343427 e1a33fd`). `media-delete-impact.test.ts` PASS. Live evidence `13-delete-confirmation.png`.

## 5. C08B-03 — Loading / Empty / Error / Fatal States — PASS

- Shared vocabulary in `CmsStates.tsx`: `CmsLoading` (role=status, aria-live), `CmsEmptyState`, `CmsErrorState` (role=alert, no stack traces, error digest only behind "advanced" disclosure), `CmsSubmitButton` (per-form pending via `useFormStatus`).
- Route boundary: `src/app/admin/loading.tsx` (shell + spinner for slow server data) and `src/app/admin/error.tsx` (fatal boundary with retry + digest; no raw trace rendered).
- All list surfaces render meaningful empty states (series / short films / home rows / episodes / media).
- **Read-only refresh intact & GET-only:** `CmsReloadButton` and `CmsFreshnessPanel.handleReload` call `router.refresh()` only (server re-render, no mutation); Media list shows "Reload list (read-only)". The Mux status "Sync" is deliberately a separate write (`MediaAssetRefreshForm`, labelled Sync, never the list reload).
- Tests: `src/lib/cms/runtime-resilience.test.ts` PASS (fail-closed error shapes, auth states, empty-state copy, pending UX).
## 6. C08B-04 — High-Volume Pagination + Filtering — PASS

| Surface | Pagination | Filters | Counts |
|---|---|---|---|
| Series list | 25/page, Prev/Next (filter-preserving URLs, disabled states) | search + status from `SeriesListFilters` (resets page to 1) | `totalCount` / `filteredCount` server-derived (`listSeriesForAdmin`) |
| Short Films list | 25/page, Prev/Next | search + status (`ShortFilmSearchInput/StatusSelect`, page reset on change) | `totalCount` / `filteredCount` (`listShortFilmsForAdmin`) |
| Billing | page + pageSize 25/50/100 (`BillingPageSizeSelect`, resets page to 1), Prev/Next preserving pageSize | — | `totalCount` exact count (`listCoinProducts`) |
| Episode Manager | 25/page, `hasPrevious/hasNext`, page/pageSize URLs | search + status (`listEpisodesForSeries`) | `totalCount` (unfiltered head count) + `filteredCount` |
| Media | tab/search/status then page (pageSize 25/50/100) | tab `all\|processing\|problems\|unassigned` + search + status | **Filter-before-pagination truth:** `getMediaViewRows` filters first (`matchesTab` + search), computes `filteredCount`, then slices by page — `totalCount` = all rows, `filteredCount` = filtered rows, both authoritative from the server layer |

All counts are rendered from the server response objects, never client-recounted.

## 7. C08B-05 — Breadcrumbs + Context Preservation — PASS (1 P2 gap)

- `CmsBreadcrumb` (aria-label Breadcrumb, current page marked) on: series list/edit, episode edit, short film list/edit, media, billing, home.
- Series chain preserves list context and **sanitizes return targets:** list rows link through `withListContext(seriesEditPath(id), {page,search,status})`; the edit-page breadcrumb returns via `withListContext(seriesListPath, listQuery)`. `withListContext` only copies whitelisted keys (page/search/status), so arbitrary/foreign query params cannot be injected into return URLs. Episode edit returns to the series edit page.
- **Gap (P2):** short-film edit page breadcrumb back-link uses plain `shortFilmListPath` (drop of `page/search/status`). The list → edit navigation carries context, but the return path does not. Recommend `withListContext` on the short-film edit breadcrumb for symmetry.

## 8. C08B-06 — Home Composer Operator Friction — PASS

- `HomeRowAccordion` renders **all rows collapsed by default** (`expandedRowId = null`), enforces **one-row focus** (expanding a row collapses the clean previous row), and blocks collapsing a dirty row.
- **Dirty switch safety:** clicking another header while the expanded row is dirty opens the leave-modal; "Leave" clears the old row's dirty map and switches; "Stay" keeps the current row (state machine pinned in `home-row-accordion.test.ts` — PASS).
- Failed/validation saves show inline `serverError`; values and dirty state survive (C08B-01 linkage; probe evidence).
- Delete row uses `DangerZoneConfirmButton` with consequence copy before `requestSubmit` of the hidden delete form.
- **Spotlight/content controls intact:** spotlight stage (enable toggle via `CmsAutoSubmitCheckbox`, ordered items, show-title toggle, remove/move) and create-row / low-history-threshold / item add/move/remove actions all present and server-action guarded.
- Runtime evidence: `scripts/c08b-06-screenshots/04-home-collapsed.png`, `05-one-row-expanded.png`, `06-dirty-title-entered.png`, `07-dirty-warning-modal.png`, `08-after-stay.png`, `09-after-leave.png`, `11-after-successful-save.png`, `12-validation-failure.png`.

## 9. C08B-07 -- Freshness / Refresh / Status Clarity -- PASS

- All 5 surfaces render: series list, short-film list, billing, media list, home composer (each mounts CmsFreshnessPanel or RefreshStatusIndicator via SSR-safe client wrapper).
- GET-only read-only refresh: handleReload calls router.refresh() only; media Sync stays a separate labelled write (MediaAssetRefreshForm).
- Real timestamps: listCoinProducts/listShortFilmsForAdmin now return fetchedAt ISO; billing/short-films SSR handlers extracted so no client event-handler-in-RSC violation.
- UNKNOWN is non-green (amber/gray, never emerald).
- Billing/Short Films SSR fixes re-verified at SOURCE (no client-handler-in-server-component pattern remains).
- Tests: cms-freshness.test.ts PASS.

## 10. Regression -- M5/M6, C06, C07 -- NONE

- M5/M6: git diff b343427 e1a33fd shows zero changes to media-delete-executor/impact/classifier; media-delete-impact.test.ts PASS.
- C06 monetization authority: unchanged (billing.ts only freshness plumbing + SSR-safe extraction; no pricing/entitlement logic touched).
- C07 publishing authority: unchanged (no publish/unpublish gate edits in window).

## 11. Android -- CHANGED (uncommitted working tree)

- Committed HEAD e1a33fd Android baseline unchanged since b343427 (last Android commit).
- Working tree currently: 9 modified + 1 untracked Android files (EpisodeAccessMarkers, WalletAccessPaywall, adMob, EpisodeListSheet, PlayerScreen, AccountScreen, SeriesEpisodeTray, SeriesScreen, WatchScreen + untracked EpisodeAccessSheet.tsx).
- CMS tree (src/lib/cms + src/components/cms + src/app/admin) is CLEAN. This gate made zero edits.

## 12. Command evidence (2026-09-11)

- CMS TESTS: npm test -- PASS, 342 pass / 0 fail / 12 skipped / 354 total / 11 suites.
- TYPECHECK: npx tsc --noEmit -- PASS, exit 0.
- LINT: npx eslint src/lib/cms src/components/cms src/app/admin -- 0 errors / 32 pre-existing warnings.
- DIFF CHECK: git diff --check -- clean for CMS (only benign LF-CRLF advisory on one Android file).
- QA REVISION: gcloud run revisions list --service=onya-qa-api --region=asia-south1 -- onya-qa-api-00058-gzp ACTIVE, deployed 2026-09-11 10:19:41 UTC. Exact match.

## 13. REPORT ONLY

STATUS:
C08B-01: PASS -- VERIFIED (SOURCE)
C08B-02: PASS -- VERIFIED (SOURCE)
C08B-03: PASS -- VERIFIED (SOURCE)
C08B-04: PASS -- VERIFIED (SOURCE)
C08B-05: PASS -- VERIFIED, 1 P2 gap (short-film breadcrumb context)
C08B-06: PASS -- VERIFIED (SOURCE + probe evidence)
C08B-07: PASS -- VERIFIED (SOURCE, 5/5 surfaces)

M5/M6 REGRESSION: NONE
C06 REGRESSION: NONE
C07 REGRESSION: NONE
ANDROID CHANGED: YES (9 modified + 1 untracked, uncommitted; committed HEAD unchanged; gate made zero edits)

CMS TESTS: PASS -- 342 pass / 0 fail / 12 skipped
TYPECHECK: PASS -- exit 0
LINT: PASS -- 0 errors / 32 pre-existing warnings
DIFF CHECK: PASS -- no whitespace errors
QA REVISION: onya-qa-api-00058-gzp ACTIVE (2026-09-11 10:19:41 UTC, asia-south1)

OPEN P1: none
OPEN P2: (1) short-film breadcrumb drops list context; (2) dead navigation-guard.tsx; (3) scratch/probe artefact hygiene
DEFERRED: emulator + screenshots + Owner/ChatGPT review + OnePlus + Owner hands-on CMS check; CMS-C09 analytics audit
BLOCKER: dirty Android working tree violates ANDROID-UNCHANGED precondition -- clean or commit separately before lock

FINAL: CMS-C08B HOLD (SOURCE VERIFIED on all 7 slices; lock to COMPLETE only after working tree clean + acceptance-protocol visual/Owner gates)

NEXT: CMS-C09 ANALYTICS IMPLEMENTATION AUDIT
