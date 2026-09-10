# CMS-C07A — Publishing & Compliance Reconciliation (READ-ONLY)

**Run:** 2026-09-07
**Mode:** Read-only inspection. No CMS data, no migrations, no deployments, no consumer-app edits.
**Scope:** Series, Episode, Short-Film publishing & compliance surface across CMS UI → server action → DB/RPC → catalog/API → consumer.

---

## Executive summary

Three independent `status` text columns (`series.status`, `episodes.status`, `short_films.status`) all constrained to the same vocabulary `('draft','published','archived')`. No `is_published` boolean exists anywhere — no dual/duplicate publish controls.

**Enforcement is layered:**

1. DB CHECK on `status` vocabulary (every table).
2. RLS `USING (status='published')` (plus `publish_at` gate for short films) on the consumer-visible SELECT policies — defense in depth.
3. RPC `publish_series_with_episodes` (service_role-only since `20260902160000_028_security_hardening.sql`) blocks series publication unless **every** child episode has `media_asset_id` → `media_assets.status='ready'` → non-empty `provider_playback_reference`.
4. App-layer `verifyShortFilmPublishIntegrity` blocks short-film publication unless poster file exists in storage AND a ready media asset with a playback reference is assigned.
5. Catalog filter + `isMediaAssetReady` predicate silently drops anything that slips through.
6. Playback resolver hard-fails with `playback_unavailable`/`media_not_ready` if anything is wrong at playback time.

**Gaps and soft spots:**

- **Episode standalone publish is unguarded.** `updateEpisodeStatus` does not call any readiness RPC; an editor can flip `episodes.status='published'` on an episode with no media. Such episodes never reach consumers (catalog filter drops them; playback rejects them), but the DB row exists in a published-but-unplayable state. This is a SOURCE_ONLY/PARTIAL situation — defense in depth compensates, but there is no application-level blocker.
- **Series has no poster-required-to-publish gate.** Only short films do.
- **`home_new_releases_exclusions` table has no migration.** Referenced in `src/lib/new-releases.ts:77,84–88` but no file in `supabase/migrations/` creates it — the code references an object that does not exist via migrations.
- **`short_films.playback_reference`** is a legacy/dev-only column never written by production assignment path; dev Mux local-operator route writes it. Strong cleanup candidate.
- **`series.episode_count`** is a denormalized integer maintained by CMS display code only — consumer ignores it and counts actual episode rows. Drift risk.
- **`series.featured`** is not a publish control, but `getFeaturedSeries` requires `status='published' AND featured=true` — conflates visibility with editorial pinning.
- **No recency window on New Releases.** "New" = `status='published' AND publish_at/published_at IS NOT NULL AND <= now()` ordered DESC, no time bound.
- **Catalog `getEpisodes` is fail-open** when the media-asset join errors: `src/lib/catalog.ts:329–337` silently drops episodes rather than failing the series read. Acceptable but should be documented.
- **`HomePage.tsx` legacy "New Releases" slice** (`catalogSeries.toReversed().slice(0,6)`) is still in the tree as a fallback when `home` prop is not passed; canonical New Releases flows via `getHomeState` from `/api/v1/catalog`. Any consumer reading `HomePage.tsx` directly sees the stale slice.

---

## Per-domain status

### SERIES PUBLISHING — **PARTIAL**
- **CMS UI**: `src/components/cms/SeriesStatusForm.tsx:17–51` — single `<select>` over `['draft','published','archived']`, JS confirm dialog on `published`, calls `updateStatusAction` server action in `src/app/admin/series/[id]/page.tsx:169–223`. On `archived` the action first calls `archiveAllEpisodesForSeries` then mutates series. On `published` it calls `updateSeriesStatus` which invokes the RPC.
- **Server action**: `src/lib/cms/series.ts:222–277` — `updateSeriesStatus`. For `published` invokes `publish_series_with_episodes` RPC and surfaces blockers. For `draft`/`archived` does plain `series.update({ status })`.
- **RPC**: `supabase/migrations/20260826010000_022_series_publish_cascade.sql` — `public.publish_series_with_episodes(p_series_id uuid)`. SECURITY DEFINER. Validates every episode: `media_asset_id IS NOT NULL` AND `media_assets.status='ready'` AND `provider_playback_reference` non-empty. If any episode fails, returns `success=false, status='blocked'` with `blockers[]`. Otherwise flips `series.status='published'` and cascades to all child `episodes.status='published'` plus `published_at = coalesce(published_at, now())`.
- **Privileges**: `supabase/migrations/20260902160000_028_security_hardening.sql:87–94` — revokes `anon`/`authenticated` execute; grants only `service_role`. CMS calls via `createAdminClient()`.
- **Zero-episode series cannot publish via this RPC** (no episodes → no media-asset set → blocked by the cascade's per-episode validator). However, a series can be flipped to `draft` or `archived` without episodes — that's expected.
- **Catalog filter**: `src/lib/catalog.ts:339–370` — `getPublishedSeries` requires `status='published'` only (not media-ready; media-ready is enforced per-episode in `getEpisodesForSeries`).
- **Consumer visibility enforcement**: `src/lib/catalog-rules.ts:59–61` — `isSeriesConsumerVisible` requires the series to serve ≥1 episode (which itself requires ready media). Series with zero ready episodes are dropped.
- **RLS**: `supabase/migrations/20260820122207_baseline_remote_schema.sql:958` — "Viewers can read published series" `USING (status='published')`.
- **No poster-required-to-publish gate for series.** Series can be published with an empty `poster_url`. Short-film has the gate; series does not. **MISSING** for poster requirement on series.

### EPISODE READINESS — **SOURCE_ONLY** (partially enforced, mostly defense-in-depth)
- **CMS UI**: `src/components/cms/SeriesEpisodeManager.tsx:33–70` lists episodes with status badge styles (draft/published/archived). No per-row publish toggle; status is changed on the full episode edit page.
- **Server action**: `src/lib/cms/episodes.ts:319–354` — `updateEpisodeStatus(id, status)`. Plain update; stamps `published_at` on first transition. **Does NOT verify media readiness.** Does NOT cascade or trigger anything.
- **Catalog filter**: `src/lib/catalog.ts:521–553` — `getEpisodesForSeries` filters to `status='published'` AND only episodes whose `media_asset_id` points to a `media_assets` row with `status='ready'` AND non-empty `provider_playback_reference`.
- **Playback resolver**: `src/lib/playback.ts:289–318` — hard-fails `playback_unavailable`/`media_not_ready` if asset missing/not-ready/no playback reference.
- **RLS**: `baseline_remote_schema.sql:952–954` — viewers can read only `status='published'` episodes whose parent series is also `status='published'`.
- **Gap**: An editor can set `episodes.status='published'` on an episode with no media. The row exists in a published-but-unplayable state. Consumers never see it (catalog filter drops it; playback rejects), but DB invariant is not enforced at write time. The series cascade enforces this when publishing via series; standalone episode publish does not. **PARTIAL** — application-level enforcement exists at the parent-series publish flow only.

### SHORT-FILM READINESS — **PASS**
- **CMS UI**: `src/components/cms/ShortFilmMetadataForm.tsx:88–108` — `Status` select + `Publish at` datetime-local input. Publish preflight UI in `src/app/admin/short-films/[id]/page.tsx:440–452` lists blockers from `verifyShortFilmPublishIntegrity`.
- **Server action**: `src/lib/cms/short-films.ts:351–385` — `updateShortFilmStatus`. For `published` runs `verifyShortFilmPublishIntegrity`; if blockers, returns `success=false, errors[]`. Otherwise plain update.
- **Integrity check**: `src/lib/cms/short-films.ts:305–349` — `verifyShortFilmPublishIntegrity`. Checks:
  - `poster_url` non-empty
  - poster object exists in `content-artwork` storage bucket (via `extractTrustedArtworkObjectPath` + `artworkObjectExists`)
  - `media_asset_id` set
  - assigned media asset exists
  - `media_assets.status='ready'`
  - `media_assets.provider_playback_reference` non-empty
- **Explicit non-gate**: short_films.playback_reference (legacy column) is explicitly NOT used as a gate.
- **Catalog filter**: `src/lib/catalog.ts:486–519` — `getShortFilmBySlug` requires `status='published'` AND `publish_at <= now()`.
- **Consumer visibility predicate**: `src/lib/catalog-rules.ts:68–83` — `resolveShortFilmPlaybackReady` requires published AND released AND mediaReady AND `!ageVerificationRequired` (for "A" rating).
- **RLS**: `supabase/migrations/20260822230500_009_short_films.sql:53–61` — viewers can read only `status='published' AND (publish_at IS NULL OR publish_at <= now())`.
- **PASS** — full chain enforced at UI, server action, catalog filter, playback resolver, and RLS.

### MEDIA REQUIREMENTS — **PARTIAL**
- **Schema**: `media_assets.status` CHECK in `('pending','processing','ready','failed')` (`011_media_assets_foundation.sql:3–16`).
- **Provider fields**: `provider_upload_reference`, `provider_asset_reference`, `provider_playback_reference` with non-empty-or-null CHECK constraints (`012_mux_video_foundation.sql`).
- **Schema linkage**: `episodes.media_asset_id` and `short_films.media_asset_id` FK → `media_assets(id) ON DELETE SET NULL`.
- **DB constraint enforcing media readiness at publish time**: NONE. Enforcement is application/RPC layer only.
- **Series publish RPC**: enforces per-episode media readiness (PASS).
- **Short-film publish integrity**: enforces media readiness (PASS).
- **Episode standalone publish**: NO enforcement. **GAP.**
- **Series publish itself**: does not require the series to have any media — the media requirement is per-episode. **CORRECT BY DESIGN** but worth noting.

### ARTWORK REQUIREMENTS — **PARTIAL**
- **Short-film**: poster is required to publish (`verifyShortFilmPublishIntegrity:311–322`). Hero image is optional.
- **Series**: poster is NOT required to publish. Series can be flipped to `published` with no poster. Hero image is optional.
- **Episode**: `thumbnail_url` is optional (no constraint).
- **DB CHECK**: none enforce artwork presence.
- **Storage**: `content-artwork` bucket is public, 8 MiB, image/{jpeg,png,webp}. Path-trust validation via `extractTrustedArtworkObjectPath`.
- **GAP**: Series has no poster-required gate. **MISSING** for series-level poster requirement.

### ACCESS/PREVIEW REQUIREMENTS — **PASS**
- **Episode access flags** (`006_episode_access_controls.sql`):
  - `is_free boolean NOT NULL DEFAULT false`
  - `coin_unlock_enabled`, `coin_price > 0` (CHECK `episodes_coin_unlock_requires_price`)
  - `rewarded_unlock_enabled`, `rewarded_access_mode IN ('permanent','session')`, `required_rewarded_completions`
  - `plus_access boolean NOT NULL DEFAULT false`
  - `locked_preview_seconds` CHECK 0..3 (or 0..5 after `20260905010000_032_locked_preview_seconds_five_seconds.sql`)
- **Validation**: `src/lib/cms/episodes.ts:99–178` validates access flag combinations (non-free episode must enable exactly one mode, etc.).
- **RPC `purchase_episode_with_coins`**: requires both episode AND series `status='published'` (`006_episode_access_controls.sql:65–71`).
- **CMS UI**: `EpisodeMetadataForm.tsx` renders the access config fields.
- **Pass** — schema, validation, RPC, and CMS UI all aligned. Note: `REWARDED_ACCESS_MODES = ["permanent"]` is hardcoded in CMS; DB still permits `'session'`. Editorial choice, not an enforcement gap.

### CONTENT RATING / DESCRIPTORS — **PASS**
- **Vocabulary**: `CONTENT_RATINGS = ["U","U/A 7+","U/A 13+","U/A 16+","A"]`, `CONTENT_DESCRIPTORS = ["language","violence","sexual content","substance use","fear / horror","mature themes"]` (`src/lib/classification.ts`).
- **Derived rules**:
  - `"A"` → `ageVerificationRequired=true`
  - `≥"U/A 13+"` → `parentalLockRequired=true`
- **DB CHECK**:
  - `series_content_rating_check`, `series_content_descriptors_check` (`007_content_classification.sql:7–47`)
  - `episodes_content_rating_override_check`, `episodes_content_descriptors_override_check`
  - `short_films.content_rating CHECK`, `short_films.content_descriptors CHECK` (`009_short_films.sql:24–36`)
- **CMS UI**: rating `<select>` + descriptor checkboxes rendered in all three metadata forms.
- **Validation**: server-side validates rating ∈ vocabulary; descriptors ⊆ canonical set.
- **Pass.**

### NEW RELEASES ELIGIBILITY — **PASS** (with noted caveat)
- **Resolver**: `src/lib/new-releases.ts`.
- **Auto series**: `status='published' AND published_at IS NOT NULL` ORDER BY `published_at DESC`.
- **Auto short films**: `status='published' AND publish_at <= now_iso` ORDER BY `publish_at DESC nulls last`.
- **Editorial items**: read from `home_row_items` where row title is `"New Releases"` and `row_role='editorial'`. Pinned first.
- **Media readiness**: short-film auto items filtered by `resolveShortFilmMediaReadiness` (status=ready + playback reference). Series auto items filtered by `getSeriesIdsWithConsumerEpisodes` (must serve ≥1 ready episode).
- **Exclusions**: reads `home_new_releases_exclusions` table. **TABLE HAS NO MIGRATION.** **PARTIAL** — this exclusion path is dead unless the table was created out-of-band; needs verification against production DB.
- **Limit**: `NEW_RELEASES_LIMIT = 10` (L29).
- **Recency window**: NONE. "New" means chronologically most recent publish, not "released in the last N days".
- **Home wiring**: `getHomeState` (`src/lib/home.ts:488–510`) invokes the hybrid resolver for the "New Releases" row. The catalog API (`src/app/api/v1/catalog/route.ts:25`) feeds this to consumers.

### HOME/CATALOG VISIBILITY — **PASS**
- **Catalog API**: `src/app/api/v1/catalog/route.ts` calls `getHomeState(user?.id ?? null)`.
- **`getHomeState`**: `src/lib/home.ts` orchestrates `start_here`, `editorial`, `spotlight`, and category rows. All gated by `status='published'` (series) and `status='published' AND released` (short films). Series with no playable episodes are dropped.
- **Spotlight gate**: `src/lib/cms/home.ts:338–403` — `addSpotlightItem` refuses anything not currently `published` and released.
- **`getFeaturedSeries`** (`src/lib/catalog.ts:372–414`): requires `status='published' AND featured=true`.
- **`getPublishedShortFilms`** (`src/lib/catalog.ts:452–484`): requires `status='published'`, ordered by `publish_at ASC nulls first`, title.
- **Series detail**: `getSeriesBySlug` filters by `status='published'` then `isSeriesConsumerVisible` ensures ≥1 playable episode.
- **Short-film detail**: `getShortFilmBySlug` filters by `status='published'` AND `publish_at <= now()`.
- **Pass**, but with stale fallback in `src/components/home/HomePage.tsx:23–24` (`catalogSeries.toReversed().slice(0,6)`).

### PUBLISH TIMESTAMPS — **PARTIAL**
- **`series.published_at`**: NOT stamped by `updateSeriesStatus` (the RPC stamps child `episodes.published_at`, not `series.published_at` itself). **GAP** — series never gets a `published_at` timestamp, breaking any series-level recency logic.
- **`episodes.published_at`**: stamped only on first transition into `published` by `updateEpisodeStatus` (`src/lib/cms/episodes.ts:337–343`); RPC cascade uses `coalesce(published_at, now())` so never overwritten.
- **`short_films.publish_at`**: editor-set only (no auto-stamp on publish). Future date = scheduled. Past/null = released immediately.
- **No DB trigger** stamps `published_at`.
- **New Releases series branch uses `published_at IS NOT NULL`** — for series, this column is currently always NULL per the codebase, so the series branch of New Releases may currently be empty/dead (only editorial items surface). **VERIFY ON QA.** If true, series New Releases is effectively editorial-only.

### SCHEDULED RELEASE — **PARTIAL**
- **Field**: `short_films.publish_at timestamptz` (nullable). Indexed `short_films_status_publish_at_idx`.
- **Field**: `series.published_at` (nullable, but never stamped — see above).
- **Field**: `episodes.published_at` (stamped on publish).
- **Editor UI**: short-film "Publish at" datetime input (`ShortFilmMetadataForm.tsx:101–108`). No series or episode scheduled-release UI.
- **Consumer gate**: `isReleased(publish_at)` — past/null = released; future = hidden. RLS on `short_films` enforces same (`status='published' AND (publish_at IS NULL OR publish_at <= now())`).
- **Catalog order**: `getPublishedShortFilms` orders `publish_at ASC nulls first` — surprising (oldest first); `getAutoShortFilms` for New Releases orders `publish_at DESC nulls last` — newest first. Inconsistent ordering directions across surfaces.
- **GAP**: Series and episodes have no scheduled-release field/UI. Only short films can be scheduled.

### ARCHIVE / DRAFT / PUBLISHED STATES — **PASS**
- **Vocabulary** identical across `series`, `episodes`, `short_films`: `('draft','published','archived')`.
- **DB CHECK** on all three: `series_status_check`, `episodes_status_check`, `short_films.status` CHECK.
- **Server actions** validate vocabulary before mutating.
- **Cascades**:
  - Series → archived: `archiveAllEpisodesForSeries` (`src/lib/cms/episodes.ts:627–675`) bulk-archives child episodes first.
  - Series → published: RPC cascades `episodes.status='published'`.
  - Series → draft: no cascade; child episodes remain in their own state.
  - Short-film: no cascade (no children).
- **Pass** — vocabulary and behavior are consistent; cascades on the two state transitions that need them.

### DUPLICATE / CONFLICTING PUBLISH CONTROLS — **PASS**
- **No `is_published` boolean.** Single `status` text column per table.
- **No dual status+boolean fields.**
- **`published_at`** is an audit timestamp, not a publish control.
- **`series.featured`** is editorial visibility (Home hero), not a publish control — but it conflates visibility with editorial pinning. Not a duplicate control but worth a cleanup.
- **`series.episode_count`** is denormalized display data, not a publish control.
- **Pass** — no duplicate controls.

### MISSING CONTROLS
1. **`series.published_at` is never stamped** — series-level recency logic is broken. **MISSING.**
2. **Episode standalone publish has no media-readiness gate** — only the series cascade enforces it. **MISSING.**
3. **Series has no poster-required-to-publish gate** — only short films do. **MISSING.**
4. **`home_new_releases_exclusions` table has no migration** — exclusion path is dead unless out-of-band DDL applied. **MISSING/RUNTIME_UNVERIFIED.**
5. **No series or episode scheduled-release field/UI.** Only short films. **MISSING.**
6. **`series.episode_count` has no DB constraint and no auto-sync** — drift risk. **PARTIAL.**

### UNSAFE STATES
- **Episode published with no media**: achievable via `updateEpisodeStatus('published')`. Not reachable by consumers (catalog filter drops, playback rejects), but the DB invariant is unenforced. **UNSAFE — soft.**
- **Series published with zero playable episodes**: blocked from consumers by `isSeriesConsumerVisible`. **SAFE** at consumer boundary, but DB state is not auto-cleaned if all episodes later become unready. **PARTIAL.**
- **Series published with empty poster**: allowed today; consumer sees no artwork on the catalog/detail tile. **UNSAFE — cosmetic.**
- **Series published with no `published_at`**: timestamps are missing; any series-level recency is broken. **UNSAFE — data integrity.**

### PUBLISHED-BUT-UNPLAYABLE PROTECTION — **PASS** (defense-in-depth)
- **DB**: no CHECK enforces media readiness at publish. The series RPC enforces it for series.
- **RPC `publish_series_with_episodes`**: hard-blocks if any episode lacks ready media. **PASS.**
- **App `verifyShortFilmPublishIntegrity`**: hard-blocks short-film publish if poster missing or media not ready. **PASS.**
- **Catalog filter**: silently drops unplayable episodes / unplayable short films.
- **`isSeriesConsumerVisible`**: drops series with no playable episodes.
- **Playback resolver**: hard-fails with `playback_unavailable`/`media_not_ready`.
- **RLS**: viewer rows are pre-filtered.
- **Gap**: standalone episode publish is unguarded. If you publish an episode outside the series cascade, it exists in a published-but-unplayable state until something cleans it up. Consumers are protected by filter+playback gate, but DB invariant is missing.
- **Overall**: **PASS** at consumer boundary. **PARTIAL** at DB write boundary.

### CONSUMER VISIBILITY ENFORCEMENT — **PASS**
- **Server catalog filter** (`src/lib/catalog.ts`) + RLS (`baseline_remote_schema.sql:952–958`, `009_short_films.sql:53–61`) provide defense in depth.
- **Android consumer** (`apps/android/src/lib/api.ts:426–443`): `isShortFilmPublished` defensively re-checks `status='published' AND publishAt elapsed` before throwing 404.
- **Playback screen** (`apps/android/src/screens/ShortFilmPlaybackScreen.tsx:265,299`): defensive guard.
- **Detail screen** (`apps/android/src/screens/ShortFilmDetailScreen.tsx:185,213`): defensive guard.
- **TS contract** (`apps/android/src/types/api.ts:108,114`): `status` + `playbackReady` exposed.
- **Pass** — consumer never sees an unpublished row, even if API filtering regresses (RLS catches it) and the Android client also defensively re-checks.

### MIGRATION REQUIRED
- **None for this reconciliation** (read-only run).
- **For implementation plan CMS-C07B**, migrations likely needed for:
  1. Stamp `series.published_at` on first series publish (DB trigger or app-side change).
  2. Gate series publish on poster presence (DB CHECK or RPC extension).
  3. Add `home_new_releases_exclusions` table migration (or remove code reference).
  4. (Optional) Add DB trigger to enforce media readiness on standalone episode publish.
  5. (Optional) Drop `short_films.playback_reference` legacy column.
  6. (Optional) Add series/episode scheduled-release fields + DB constraint.

### HIGH-COLLISION FILES (multiple rules overlap here)
- `src/lib/cms/series.ts:222–277` — `updateSeriesStatus` (RPC + blocker surfacing + plain update path).
- `src/lib/cms/episodes.ts:319–354` — `updateEpisodeStatus` (stamps `published_at`, no media gate).
- `src/lib/cms/episodes.ts:627–675` — `archiveAllEpisodesForSeries` (cascade on series archive).
- `src/lib/cms/short-films.ts:305–349` — `verifyShortFilmPublishIntegrity` (poster + media gate).
- `src/lib/cms/short-films.ts:351–385` — `updateShortFilmStatus` (calls integrity + plain update).
- `src/lib/catalog-rules.ts:27–83` — single source of truth for visibility predicates.
- `src/lib/catalog.ts:339–599` — catalog fetchers with embedded media-readiness filtering.
- `src/lib/new-releases.ts:29–335` — New Releases resolver (status + media-ready + exclusions + editorial pins).
- `src/lib/playback.ts:289–531` — playback authorization (status + released + media ready + access).
- `supabase/migrations/20260826010000_022_series_publish_cascade.sql` — `publish_series_with_episodes` RPC.
- `supabase/migrations/20260902160000_028_security_hardening.sql:87–94` — RPC privilege lockdown.
- `src/components/cms/SeriesStatusForm.tsx` and `SeriesEpisodeManager.tsx` — CMS UI for status changes.
- `src/app/admin/series/[id]/page.tsx:169–223` and `src/app/admin/short-films/[id]/page.tsx:309–345` and `src/app/admin/series/[id]/episodes/[episodeId]/page.tsx:106–137` — server actions that drive publish mutations.
- `src/app/admin/short-films/[id]/page.tsx:440–452` — "Publish preflight" UI.

### SAFE IMPLEMENTATION SLICES (for CMS-C07B)
1. **Stamp `series.published_at` on first publish** — minimal app-side change in `src/lib/cms/series.ts` (mirror the episode pattern) + RPC extension in `20260826010000_022_series_publish_cascade.sql`. No data migration needed if backfill is run on QA.
2. **Series poster-required-to-publish gate** — extend RPC `publish_series_with_episodes` to reject if `poster_url` is empty/null. App-side pre-check in `updateSeriesStatus` mirroring `verifyShortFilmPublishIntegrity`. UI hint in `SeriesStatusForm`.
3. **Episode standalone publish media gate** — wrap `updateEpisodeStatus` to call the same per-episode media-readiness check used by the RPC. RLS already protects consumers; this tightens DB invariants.
4. **Add `home_new_releases_exclusions` migration** (or delete the code path). Low risk either way.
5. **Remove or annotate `short_films.playback_reference`** — drop column once dev Mux local-operator route is retired.
6. **Drop the legacy `HomePage.tsx:23–24` "New Releases" slice** — replace with the canonical `getHomeState` output, or delete the prop-fallback path.
7. **Consistent publish_at ordering** — reconcile `getPublishedShortFilms` (ASC) vs `getAutoShortFilms` (DESC).
8. **Optional: add series/episode `scheduled_release_at` field + UI** — mirrors short-film `publish_at`.

### BLOCKER
None for the read-only reconciliation itself.

For implementation plan CMS-C07B:
- **`home_new_releases_exclusions` runtime state is UNKNOWN** — code references it; no migration creates it. Must verify on QA DB before designing C07B.
- **`series.published_at` is null on every row** — backfill strategy for New Releases recency must be decided before enabling series-branch of New Releases.

### NEXT: CMS-C07B IMPLEMENTATION PLAN
Hand off to Product Owner + ChatGPT for review of this reconciliation. CMS-C07B plan should address the Missing Controls list above, prioritizing (1) stamp series `published_at`, (2) series poster gate, (3) episode standalone media gate, (4) reconcile `home_new_releases_exclusions`.