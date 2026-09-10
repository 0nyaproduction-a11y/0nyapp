# CMS-C07B — Publishing & Compliance Implementation Plan (READ-ONLY PLANNING)

**Run:** 2026-09-07
**Mode:** Planning only. No source edits, no migrations, no deployments, no CMS data mutation, no Android touches, no entitlement/playback changes.
**Inputs:** `docs/agent-state/CMS_C07A_PUBLISHING_COMPLIANCE_RECONCILIATION.md`, root `AGENTS.md` authority documents (PRODUCT_UIUX_BIBLE, MASTER_USER_FLOW), repo conventions.
**Out of scope for this run:** `docs/CMS_COMPLETION_ROADMAP.md` does not exist in the repo (verified). This plan is grounded in C07A findings + AGENTS.md authority.

---

## Read-first guardrails (binding)

- **AGENTS.md §0nya Agent Skills**: load `0nya-backend-cms` and `0nya-monetization-security` before any backend or monetization-touching slice. Not invoked here (planning), but required at implementation time.
- **AGENTS.md §7**: client never authoritative for identity, wallet, coin credit, entitlements, subscriptions, pricing, payment verification, rewarded-ad rewards, or playback authorization. CMS-side enforcement of publish state is mandatory; client must remain a read-side enforcement boundary only.
- **AGENTS.md §Locked Final Acceptance Protocol (31 Aug 2026)**: any CMS-side behavior change must still pass SOURCE → EMULATOR → SCREENSHOTS → OWNER+CHATGPT REVIEW → PHYSICAL ONEPLUS → LOCK. This plan only prepares for SOURCE-stage work.
- **AGENTS.md §Provider/hosting approval**: CMS publish hardeness does not prove production readiness. Treat each slice as `IMPLEMENTED / PARTIALLY IMPLEMENTED / MISSING / EXTERNALLY BLOCKED / DEFERRED / UNKNOWN / NOT PROVEN` until verified.

---

## SLICE 1 — SERIES published_at

### Current defect (from C07A)
`series.published_at` is never stamped by any code path. `src/lib/cms/series.ts:222–277` (`updateSeriesStatus`) calls the RPC `publish_series_with_episodes` which updates `series.status='published'` (line 67–69 of `20260826010000_022_series_publish_cascade.sql`) but does NOT write `series.published_at`. `new-releases.ts:278` (`if (!series.published_at) continue;`) means the series-auto lane of "New Releases" is currently a dead branch in absence of data.

### Exact publish RPC/action path
- **CMS UI**: `src/components/cms/SeriesStatusForm.tsx:17–51` → `<form action={updateStatusAction}>`.
- **Server action**: `src/app/admin/series/[id]/page.tsx:169–223` `updateStatusAction` (page-level). For `archived`: calls `archiveAllEpisodesForSeries` first, then `updateSeriesStatus`. For `published`: calls `updateSeriesStatus`. For `draft`: calls `updateSeriesStatus`.
- **Application wrapper**: `src/lib/cms/series.ts:222–277` `updateSeriesStatus`. For `published`: invokes `supabase.rpc("publish_series_with_episodes", { p_series_id: id })`. RPC returns blockers or success; on success the wrapper re-reads the series row and returns it. For `draft`/`archived`: plain `series.update({ status })`.
- **DB RPC**: `supabase/migrations/20260826010000_022_series_publish_cascade.sql` lines 67–81 — only writes `status='published'` on `series` and cascades `status='published', published_at=coalesce(published_at, now())` on episodes. **Does not write `series.published_at`.**

### Safest place to stamp `series.published_at`
**Inside the RPC**, on the successful branch, on the same `update public.series` statement that flips `status='published'`. This keeps the stamp atomic with the status mutation, gives a single authoritative write site, and matches the existing pattern used for `episodes.published_at` (RPC line 75).

### Semantics matrix

| Transition | `series.status` | `series.published_at` | `episodes.status` (cascade) | `episodes.published_at` (cascade) |
|---|---|---|---|---|
| `draft → published` (first time) | `published` | `now()` | `published` | `coalesce(published_at, now())` |
| `draft → published` (already had `published_at`) | `published` | unchanged | `published` | `coalesce(published_at, now())` |
| `archived → published` (republish) | `published` | `now()` (overwrite allowed on republish, see Owner decision) | `published` | `coalesce(published_at, now())` |
| `published → draft` | `draft` | unchanged | unchanged | unchanged |
| `published → archived` | `archived` | unchanged (audit) | cascade to `archived` (via `archiveAllEpisodesForSeries`) | unchanged |
| `archived → draft` | `draft` | unchanged | unchanged | unchanged |

### Republish semantics — owner decision required
Two options:

**Option R1 (recommended, preserves audit accuracy)**: On any `* → published` transition (including republish from `archived`), overwrite `series.published_at = now()`. Rationale: `published_at` is "the time the row entered the published state", which is the most recent publish action. Mirrors the `episodes` RPC behavior of stamping on cascade only when not already set, but for the series row the timestamp should reflect the most recent publication event.

**Option R2**: Only stamp if `published_at IS NULL` (mirror `episodes.published_at` `coalesce`). Rationale: preserves a "first publish" timestamp. But this hides the fact that the series was unpublished and republished.

### Backfill options for existing rows — owner decision required
Today, `series.published_at` is null on every row (no writer exists). The `new-releases.ts` series-auto branch is effectively dead until either the field is stamped on forward publishes or backfilled. Options:

**A. Leave historical published rows null**
- Pros: zero risk to historical data; preserves unknown provenance; aligned with "don't fabricate truth".
- Cons: New Releases series-auto branch remains dead until enough new publishes happen; user-visible regression in New Releases variety.
- Migration: none.
- Risk: LOW. Cost: medium UX gap.

**B. Backfill from best authoritative existing timestamp**
- Best candidates, in priority order: `series.updated_at` (last update), `series.created_at` (first record), or the maximum `episodes.published_at` across the series (true published-first-time evidence). Without an `episodes.published_at` audit log per series, the strongest available truth is `MAX(episodes.published_at)` for that series.
- Migration: one-time UPDATE in a new migration file `YYYYMMDDHHMMSS_backfill_series_published_at.sql` with explicit WHERE clauses and a guard so it's idempotent.
- Pros: restores series-New-Releases branch; preserves editorial intent.
- Cons: requires deciding the precedence rule and an owner sign-off; needs a verifiable audit-friendly mapping table.
- Risk: MEDIUM (irreversible without manual rollback; needs owner review).
- Migration: YES.

**C. Backfill current time**
- `UPDATE public.series SET published_at = now() WHERE status='published' AND published_at IS NULL;`
- Pros: simple.
- Cons: lies about provenance. **Not recommended** because it explicitly violates the "do not fabricate truth" spirit of AGENTS.md §0nya Product Authority.
- Migration: YES. Risk: HIGH.

**D. Manual/admin reconciliation**
- Editor opens each series and re-stamps manually.
- Pros: zero automated risk.
- Cons: scales poorly; not realistic for any non-trivial catalog.
- Migration: none. Risk: LOW operational, HIGH UX.

**Recommendation for Owner:** Option A for go-live safety, then Option B with `MAX(episodes.published_at)` precedence after audit confirms the mapping. NEVER Option C.

### Classification
- Migration needed: **YES** if Option B/C chosen; NO if Option A.
- Runtime risk: **LOW** for Option A; MEDIUM for Option B; HIGH for Option C.
- Owner decision needed: **YES** (backfill option + republish semantics).
- Tests required: RPC happy-path stamps `published_at`; first publish stamps; republish overwrites (R1) or preserves (R2); concurrent RPCs don't double-stamp.
- QA acceptance: SOURCE VERIFIED → EMULATOR (CMS): publish a series, confirm `published_at` set in DB; transition to draft, confirm `published_at` preserved; republish, confirm chosen semantics; New Releases page surfaces the series.
- Files touched: `supabase/migrations/20260826010000_022_series_publish_cascade.sql` (extend the `update public.series` block); potentially new migration for backfill.
- Current authority: none. **Proposed authority: RPC is sole writer; CMS app code must not write `series.published_at`.**

---

## SLICE 2 — SERIES POSTER PUBLISH GATE

### Current behavior (from C07A)
Series can be flipped to `published` with empty `poster_url`. Short films have `verifyShortFilmPublishIntegrity` enforcing poster; series has no equivalent.

### Exact required artwork field
**`series.poster_url`** (per CMS UI in `SeriesMetadataForm.tsx`). Optionally also `series.hero_image_url` but poster is the canonical catalog tile artwork. Owner decision: require poster alone, or poster+hero?

### File existence verification
`verifyShortFilmPublishIntegrity` uses `extractTrustedArtworkObjectPath(row.poster_url)` + `artworkObjectExists(objectPath, supabase)`. Both functions live in the CMS media module. Reuse them for series exactly. Do not duplicate the path/object-exists logic.

### UI validation
- **`SeriesStatusForm`**: add a server-side pre-check (mirror the short-film preflight) that calls a `verifySeriesPublishIntegrity` helper. If poster missing/unreachable, surface blockers inline next to the `<select>`.
- **`SeriesMetadataForm`**: if `poster_url` is empty, show a soft warning ("Poster is required to publish"). Do not block save-as-draft.

### Server/RPC validation
- Extend `publish_series_with_episodes` RPC with one additional check before flipping status: `case when btrim(coalesce(s.poster_url, '')) = '' then 'Series poster artwork is required to publish.' when not exists (select 1 from storage.objects where bucket_id='content-artwork' and name=extractTrustedArtworkObjectPath(s.poster_url)) then 'Series poster artwork file is missing or unavailable.'` — this duplicates the storage check at DB level, which adds true defense in depth but requires `service_role` (RPC is already service_role-only since `20260902160000_028_security_hardening.sql:87–94`).
- **Alternative (lighter touch)**: only enforce in `updateSeriesStatus` application wrapper, not RPC. Lower blast radius, but RPC becomes a back door if someone calls it directly via service_role. Owner decision.
- **Recommendation**: enforce in BOTH app wrapper AND RPC, with the same predicate. The poster-exists check is cheap; defense-in-depth matches the short-film pattern.

### Consumer fallback implications
- Today: catalog silently drops series with no playable episodes; series with empty poster already renders but ugly.
- After this gate: series cannot enter `published` state with empty poster → no catalog regression; series in `draft` with empty poster can still be authored.

### Draft editing preserved
- Drafts are unaffected — gate applies only when transitioning to `published`.
- Poster can be edited in draft freely without triggering the gate.

### Classification
- Migration needed: **YES** if extending RPC; NO if only app-wrapper enforcement (still recommend extending RPC).
- Runtime risk: **LOW**.
- Owner decision needed: **YES** for poster-vs-poster+hero scope; **YES** for RPC extension vs app-only.
- Tests required: poster empty blocks publish; poster URL with valid storage object allows publish; poster URL pointing to missing storage object blocks publish; draft transitions unaffected; updating poster and re-publishing works.
- QA acceptance: SOURCE VERIFIED → CMS WEBSITE VERIFIED: publish a series without poster, confirm blocked; upload poster, retry publish, confirm success.
- Files touched: `src/lib/cms/series.ts` (new `verifySeriesPublishIntegrity` helper + invoke from `updateSeriesStatus`); `supabase/migrations/20260826010000_022_series_publish_cascade.sql` (extend validators); `src/components/cms/SeriesStatusForm.tsx` (UI hint); `src/app/admin/series/[id]/page.tsx` (server action pre-check).
- Current authority: none. **Proposed authority: RPC + app wrapper, both required.**

---

## SLICE 3 — EPISODE STANDALONE PUBLISH GATE

### Current behavior (from C07A)
`src/lib/cms/episodes.ts:319–354` `updateEpisodeStatus(id, status)` does plain update with `published_at` stamping; does NOT verify media readiness. An editor can flip `episodes.status='published'` on an episode with no `media_asset_id` and no ready media. Such an episode never reaches consumers (catalog filter, RLS, playback resolver all gate), but the DB row is in a published-but-unplayable state.

### Reuse existing media readiness truth
`src/lib/catalog-rules.ts:45–52` `isMediaAssetReady(asset)` — `status='ready' AND provider_playback_reference IS NOT NULL AND trim != ''`. Reuse verbatim. Also `src/lib/cms/short-films.ts:305–349` `verifyShortFilmPublishIntegrity` provides a clean pattern: read the assigned `media_asset_id`, fetch the asset, fail if missing / not-ready / empty playback reference. Mirror this structure in a new `verifyEpisodePublishIntegrity`.

### Plan
- **New helper**: `src/lib/cms/episodes.ts` `verifyEpisodePublishIntegrity(row)` — returns `EpisodeValidationError[]` for: missing `media_asset_id`, asset not found, asset `status != 'ready'`, empty `provider_playback_reference`.
- **Modify `updateEpisodeStatus`**: before performing the update, if `status === 'published'`:
  - Fetch the episode row.
  - Call `verifyEpisodePublishIntegrity`.
  - If errors, return `{ success: false, errors: [...] }`.
  - Then stamp `published_at = coalesce(existing.published_at, now())` as today.
- **Do NOT** invoke the series cascade RPC here — that is a different operation; standalone episode publish remains a single-episode mutation.

### Preserve draft/archived editing
- Only the `→ published` transition is gated. Draft editing and archive transitions remain unrestricted.

### Do not duplicate Mux truth logic
- Single source: `isMediaAssetReady` in `src/lib/catalog-rules.ts`.
- `verifyEpisodePublishIntegrity` calls `isMediaAssetReady(asset)` (or its inlined predicate) — no new branching logic.

### Classification
- Migration needed: **NO** (app-side change only; existing RPC and DB unchanged).
- Runtime risk: **LOW** (only tightens the gate, doesn't loosen).
- Owner decision needed: **NO** (defensive tightening only; aligns with established pattern).
- Tests required: publish episode with no `media_asset_id` → blocked; publish episode with `media_asset.status='processing'` → blocked; publish episode with `status='ready'` + empty playback reference → blocked; publish episode with ready media + playback reference → success; draft/archived transitions unaffected; episode.published_at stamped only on first publish.
- QA acceptance: CMS WEBSITE VERIFIED: editor opens episode, attempts to publish with no media → server action returns error and UI surfaces it.
- Files touched: `src/lib/cms/episodes.ts` (new helper + invoke from `updateEpisodeStatus`); `src/components/cms/EpisodeMetadataForm.tsx` (UI hint if desired — not strictly required since the server action already surfaces errors).
- Current authority: `updateSeriesStatus` + RPC. **Proposed authority: also `updateEpisodeStatus` + new `verifyEpisodePublishIntegrity`.**

---

## SLICE 4 — NEW RELEASES EXCLUSION TABLE (`home_new_releases_exclusions`)

### Investigation results
- **In code**: `src/lib/new-releases.ts:67–92` defines `ExclusionRow` type and `fetchExclusions` reads `home_new_releases_exclusions`. Read is wrapped in `timePerf` and tolerates errors gracefully (line 79–82: returns empty Set on error and warns).
- **In migrations**: NOT FOUND in `C:\Users\Akash\Documents\0nyapp\supabase\migrations\`. Verified via `Get-ChildItem` listing 42 migration files; no file references the table.
- **In QA**: UNKNOWN without QA DB read. The code path is fail-open (returns empty Set on error), so the table's absence in production would not break the app — it would just disable exclusions.

### Determine
- Need an explicit QA-DB read of `pg_class` or equivalent to confirm whether `home_new_releases_exclusions` exists in the live QA schema.
- If it does exist, no migration is needed; the code is correct as-is.
- If it does not exist, the table was never created — the feature was designed but not implemented. Either:
  - Add a migration now (REQUIRES_OWNER_DECISION on schema shape).
  - Remove the dead code path (REQUIRES_OWNER_DECISION on whether the feature is in scope).

### Plan
- **Phase A (pre-implementation)**: read QA DB schema; confirm presence/absence; report to Owner.
- **Phase B (conditional)**: if absent, owner decision — implement migration OR delete code.
- **Proposed migration shape** (only if needed): `public.home_new_releases_exclusions (id uuid PK, content_type text CHECK IN ('series','short_film'), series_id uuid NULL FK, short_film_id uuid NULL FK, excluded_at timestamptz NOT NULL DEFAULT now(), excluded_by uuid NULL FK to profiles, CHECK (content_type='series' AND series_id IS NOT NULL AND short_film_id IS NULL OR content_type='short_film' AND short_film_id IS NOT NULL AND series_id IS NULL))`. RLS: cms_admin SELECT/INSERT/DELETE; anon/authenticated no access. Index on `(content_type, series_id)` and `(content_type, short_film_id)`.

### Classification
- Migration needed: **CONDITIONAL** (depends on QA DB state).
- Runtime risk: **LOW** either way (code is fail-open).
- Owner decision needed: **YES** — confirm schema on QA, decide implement-vs-delete.
- Tests required: only after decision.
- QA acceptance: CMS WEBSITE VERIFIED only after decision.
- Files touched: NEW migration file (if implementing); possibly `src/lib/new-releases.ts:75–92` (if deleting).

---

## SLICE 5 — LEGACY HomePage FALLBACK

### Inspection
- **File**: `src/components/home/HomePage.tsx:9–60`.
- **Imported by**: `src/app/page.tsx:1,4` — the root web consumer page uses `HomePage` directly.
- **Stale slice**: Line 24: `const newReleaseItems = catalogSeries.toReversed().slice(0, 6);` — uses `getPublishedSeries()` (no recency filter, no exclusions, no editorial pinning, no media-readiness check at this surface). Pure array reverse + slice.
- **Canonical New Releases**: lives in `src/lib/home.ts:488–510` (`getHomeState`) for the API consumer (`/api/v1/catalog/route.ts:25`).

### Determine removal safety
- **Is the catalog/API authoritative?** Yes — `getHomeState` is the documented canonical home resolver. The `/api/v1/catalog` route consumes it and is what Android consumers read.
- **Does the web consumer `HomePage` depend on the stale fallback?** Yes — `src/app/page.tsx` imports `HomePage` and the web home page therefore uses the stale slice.
- **Could removal blank Home unexpectedly?** If we replace the stale `newReleaseItems` with the canonical New Releases from `getHomeState`, the home still shows rows. No blanking risk as long as `getHomeState` returns non-empty data. If `getHomeState` returns empty (e.g., no editorial pins and series branch is dead per C07A), the row would show an empty `ContentRow` instead of a stale-but-non-empty one.

### Plan
**Two-step replacement, no removal in C07B** (planning only):
- **Step 1**: wire `HomePage` to read from `getHomeState(user?.id ?? null)` instead of building its own list. Keep the page's component shell (`Header`, `MobileBottomNav`, `FeaturedHero`) intact.
- **Step 2**: once Step 1 is verified on EMULATOR and the canonical home returns the expected rows, the stale `getPublishedSeries` + reverse + slice block can be deleted in a follow-up slice.
- **Alternative (deferred)**: leave `HomePage` as-is for the web consumer; rely on `/api/v1/catalog` for Android. Document the divergence. **Not recommended** because web visitors would see different New Releases than Android visitors for the same product.

### Classification
- Migration needed: **NO**.
- Runtime risk: **MEDIUM** (changes what web consumers see; needs EMULATOR + visual review per locked protocol).
- Owner decision needed: **YES** (approve replacing `HomePage`'s stale slice with `getHomeState`; decide recency-window policy).
- Tests required: HomePage renders same items as `/api/v1/catalog` for the "New Releases" row; Start Here row unaffected; Continue Watching unaffected.
- QA acceptance: EMULATOR → SCREENSHOTS → OWNER+CHATGPT REVIEW → PHYSICAL ONEPLUS.
- Files touched: `src/components/home/HomePage.tsx`; possibly `src/app/page.tsx` if signature changes.
- Current authority: `HomePage.tsx:24` (stale). **Proposed authority: `getHomeState` from `src/lib/home.ts`.**

---

## SLICE 6 — publish_at ORDERING

### Today
- `getPublishedShortFilms` (`src/lib/catalog.ts:452–484`): `ORDER BY publish_at ASC nulls first, title`. Oldest-first.
- `getAutoShortFilms` (`src/lib/new-releases.ts:48–65`): `ORDER BY publish_at DESC nulls last, title`. Newest-first.
- `fetchAutoSeries` (`src/lib/new-releases.ts:31–46`): `ORDER BY published_at DESC`. Newest-first.
- Final sort in `new-releases.ts:328–333`: editorial first (sortOrder=0), then auto (sortOrder=1) by `publishedAt DESC`. `publishedAt` is `series.published_at ?? null` or `short_film.publish_at ?? null`.

### Surfaces with recency ordering
1. **Consumer Home → New Releases**: editorial first, then auto DESC by `publishedAt`.
2. **Catalog page → Short Films tile**: `getPublishedShortFilms` ASC by `publish_at` (oldest first — likely a bug or intentional "oldest always available" order).
3. **Catalog page → Series tile**: `getPublishedSeries` orders by `sort_order` (`src/lib/catalog.ts:339–370`) — no recency.

### Proposed deterministic rule
**One rule, applied at all surfaces that advertise recency:**
- **Recency surfaces (Home → New Releases, any future "Recently Added" rows)**: order by `published_at`/`publish_at` DESC (newest first). Null timestamps sort LAST.
- **Catalog tile surfaces (browse, search)**: keep `sort_order` then title — recency is NOT a catalog surface.

For New Releases, `publishedAt` is the per-row effective publish time:
- **Series**: `series.published_at` (after Slice 1 stamps it).
- **Short films**: `short_films.publish_at`.
- **No `created_at` fallback**: if `publish_at IS NULL` AND `published_at IS NULL`, the row is excluded from New Releases' auto lane (today's code already does this — `if (!series.published_at) continue` at line 278 and `if (sf.publish_at && new Date(sf.publish_at) > now)` at line 287).

### Plan
- Add a single helper `getNewReleaseTimestamp(row)` that returns the canonical `publishedAt` for a series or short-film row. Use it everywhere New Releases ordering matters.
- Keep `getPublishedShortFilms` ASC unchanged for the catalog tile (owner decision on whether that surface should change; not in C07B scope).
- **No DB change required.**
- Slice 1's RPC stamp makes `series.published_at` available, so the series-New-Releases branch becomes live.

### Classification
- Migration needed: **NO**.
- Runtime risk: **LOW** (only normalization; behavior identical for short films today; series branch becomes live after Slice 1).
- Owner decision needed: **NO** (the rule is already used; this slice just codifies it and removes the ASC vs DESC divergence concern by defining where recency surfaces are).
- Tests required: order of New Releases items by publishedAt DESC; null timestamps excluded; editorial always first.
- QA acceptance: SOURCE VERIFIED → EMULATOR: verify Home New Releases order on emulator.
- Files touched: `src/lib/new-releases.ts` only (extraction helper; possibly tighten the final sort comparator).

---

## SLICE 7 — SCHEDULED PUBLISHING

### Decision requested
Report only — **DO NOT IMPLEMENT**.

### Current state (from C07A + AGENTS.md)
- `short_films.publish_at` exists with editor UI; consumer gate via `isReleased`; RLS filter.
- `series` and `episodes` have NO scheduled-release field. Series uses `published_at` (audit-only after Slice 1).
- `MASTER_USER_FLOW` and `PRODUCT_UIUX_BIBLE` govern release UX. Not re-read here in full; flagging for Owner review.

### Classification
**Status to be confirmed by Owner.**

Candidates:

| Verdict | Implication |
|---|---|
| **REQUIRED_NOW** | Schema additions: `series.scheduled_release_at timestamptz NULL`, `episodes.scheduled_release_at timestamptz NULL`. UI: extend `SeriesMetadataForm` + `EpisodeMetadataForm` with datetime-local. RPC: `publish_series_with_episodes` checks `now() >= series.scheduled_release_at` OR `scheduled_release_at IS NULL`. Catalog/RLS: filter `scheduled_release_at IS NULL OR scheduled_release_at <= now()`. App-layer gate in `updateSeriesStatus` + `updateEpisodeStatus`. Side-effect: cascade behavior, New Releases ordering, hidden draft auto-publish jobs (none today). Risk: MEDIUM (multiple touch points). Owner must approve scope. |
| **DEFERRED** | No schema changes; short films keep their `publish_at`; series/episode scheduling added in a later release. Risk: NONE. |
| **NOT_REQUIRED** | Product does not need scheduled release for series/episode today. Editorial publishes on demand; short-film scheduling covers the only scheduling need. |

### Recommendation
**DEFERRED** until Owner confirms product intent. The current product (`short_films.publish_at`) is sufficient for the only documented use case (short-film drops). Adding series/episode scheduling expands scope materially (DB CHECK, RPC, RLS, UI, cascade behavior). **Recommend DEFERRED for C07B; revisit at CMS roadmap.**

### Owner decision: **YES**.

---

## SLICE 8 — short_films.playback_reference DEPENDENCY MAP

### Readers
1. **Type declarations**: `src/types/database.ts:978,1001,1024` — TS shape (read by every typed query).
2. **Tests**: `src/lib/catalog-visibility.test.ts:53` — column whitelist for `isMediaAssetReady` test (column name listed).
3. **Mux module**: `src/lib/mux/index.ts:968,980,1318` — reads `short_films.playback_reference`, writes it back; used by `getShortFilmPlayback` and `updateShortFilmPlayback` functions.
4. **Dev Mux local-operator**: `src/app/api/dev/mux/local-operator/route.ts:33,122,152,161,503` — reads + writes (dev only).
5. **Documentation comment**: `src/lib/catalog-rules.ts:65`, `src/lib/cms/short-films.ts:326–329` — explicit "must not gate publish" comments; explains why production playback does not use this column.

### Writers
1. **Dev Mux local-operator route** (`src/app/api/dev/mux/local-operator/route.ts`) — sets `playback_reference: null` on create; updates it during operator action. Dev-only route; not reachable from production Android client.
2. **Mux module** (`src/lib/mux/index.ts:1318`) — writes `playback_reference: playbackReference` where playbackReference is derived from `mediaAsset.provider_playback_reference`. Likely the source of historical writes.

### Serializers
- TS type at `src/types/database.ts:978,1001,1024` — surfaces to typed responses.

### Migrations
- Defined in `supabase/migrations/20260822230500_009_short_films.sql:12` — `playback_reference text` column.

### Runtime/API compatibility
- **Production playback path** (`src/lib/playback.ts:498–527` for short-film) reads ONLY `media_assets.provider_playback_reference`. The `short_films.playback_reference` column is never read in the production playback resolver.
- **CMS publish integrity** (`src/lib/cms/short-films.ts:305–349`) explicitly does NOT consult `short_films.playback_reference`.
- **Catalog filtering** does not consult `short_films.playback_reference`.
- **Android client** does not read `short_films.playback_reference` (per C07A scan of `apps/android/src/lib/api.ts` and `apps/android/src/types/api.ts`).

### Data backfill implications
- If dropped, all existing `short_films.playback_reference` values become irrelevant. The single producer of truth is `media_assets.provider_playback_reference`. No backfill needed because playback never read this column.
- If kept, existing values remain harmless vestigial data.

### Classification
- **STILL_USED** by: dev Mux local-operator route (writes), Mux module (`src/lib/mux/index.ts:968–980, 1318` — reads + writes), TS types (read).
- **NOT_USED** by: production playback, CMS publish integrity, catalog, Android consumer.
- **SAFE_TO_DEPRECATE** in the production playback chain; **STILL_USED** in dev tooling.
- **Verdict: STILL_USED (legacy/dev surface).** Per C07B instruction, NO DROP migration. Annotate for future deprecation in a later roadmap.

### Migration needed: **NO** (per C07B instruction; planned future-only).
- Runtime risk (if hypothetically dropped today): LOW to MEDIUM — dev Mux tooling would break; no production impact.
- Owner decision needed: **NO** (no action in C07B; informational only).

---

## Per-slice matrix

| Slice | Files (exact) | DB objects | Current authority | Proposed authority | Migration | Risk | Owner decision |
|---|---|---|---|---|---|---|---|
| 1. series published_at | `src/lib/cms/series.ts:222–277`; `supabase/migrations/20260826010000_022_series_publish_cascade.sql:67–81` | `series.published_at` (column already exists) | none | RPC `publish_series_with_episodes` only | YES (backfill option B/C); NO (option A) | LOW–HIGH | **YES** |
| 2. series poster gate | `src/lib/cms/series.ts` (new helper); `20260826010000_022_series_publish_cascade.sql` (extend); `src/components/cms/SeriesStatusForm.tsx`; `src/app/admin/series/[id]/page.tsx:169–223` | `series.poster_url`; `storage.objects` (bucket `content-artwork`) | none | RPC + `updateSeriesStatus` app wrapper | YES (RPC extension recommended) | LOW | **YES** (scope) |
| 3. episode standalone publish gate | `src/lib/cms/episodes.ts:319–354`; `src/components/cms/EpisodeMetadataForm.tsx` (UI hint only) | none (uses existing `media_assets`, `episodes.media_asset_id`) | none | `updateEpisodeStatus` + new `verifyEpisodePublishIntegrity` (reuses `isMediaAssetReady`) | NO | LOW | NO |
| 4. exclusion table | new migration (conditional); `src/lib/new-releases.ts:75–92` | `home_new_releases_exclusions` (existence TBD on QA) | fail-open empty Set | conditional: migration if absent | CONDITIONAL | LOW | **YES** (QA verify + implement/delete) |
| 5. HomePage fallback | `src/components/home/HomePage.tsx:9–60` | none | `getPublishedSeries` reverse slice (stale) | `getHomeState` | NO | MEDIUM | **YES** |
| 6. publish_at ordering | `src/lib/new-releases.ts` (extract helper) | none | scattered (ASC + DESC) | helper + canonical DESC for recency surfaces only | NO | LOW | NO |
| 7. scheduled publishing | n/a (planning only) | n/a | n/a | n/a | n/a | n/a | **YES** (REQUIRED_NOW/DEFERRED/NOT_REQUIRED) |
| 8. playback_reference map | none this run | `short_films.playback_reference` (column, legacy/dev) | dev Mux local-operator + `src/lib/mux/index.ts` | unchanged this run | NO this run | LOW (no action) | NO (informational) |

---

## Classification rollup

### SAFE_NOW
- **Slice 3** (episode standalone publish gate) — defensive tightening; no DB change; no Owner decision; same pattern as short-film gate already in production. Risk LOW.
- **Slice 6** (publish_at ordering normalization) — pure refactor; no DB change; codifies existing rule.

### SAFE_WITH_TESTS
- **Slice 2** (series poster gate) — once Owner approves scope (poster-only vs poster+hero), app + RPC extension with full tests is safe.

### REQUIRES_MIGRATION
- **Slice 1** — extend existing RPC `publish_series_with_episodes` to stamp `series.published_at`. Migration file: extend `20260826010000_022_series_publish_cascade.sql` (or add a new migration that re-defines the function with `create or replace function` — preferred to keep the original immutable and add a new file).
- **Slice 1 (conditional backfill)** — new migration if Owner selects Option B.
- **Slice 4 (conditional)** — new migration if `home_new_releases_exclusions` confirmed absent on QA.

### REQUIRES_OWNER_DECISION
- **Slice 1** — backfill option (A/B/C/D) + republish semantics (R1/R2).
- **Slice 2** — poster scope (poster-only vs poster+hero) + RPC extension vs app-only.
- **Slice 4** — QA existence confirmation + implement-vs-delete.
- **Slice 5** — approve replacing `HomePage` New Releases slice with `getHomeState`.
- **Slice 7** — REQUIRED_NOW / DEFERRED / NOT_REQUIRED.

### DEFER
- **Slice 7** (scheduled publishing for series/episode) — recommend DEFERRED; revisit at CMS roadmap.
- **Slice 8 (action)** — no action in C07B; document for future deprecation.

### DO_NOT_IMPLEMENT
- Drop of `short_films.playback_reference`.
- Any change to entitlement / playback authorization / wallet / coin / rewarded / subscription logic.
- Any change to consumer apps (`apps/android/**`).
- Any change to Mux/media truth modules (`src/lib/mux/**`, `src/lib/cms/media-truth-*.ts`) beyond consumer of `isMediaAssetReady`.
- Any commit/push.

---

## HIGH-COLLISION FILES (all slices)

- `src/lib/cms/series.ts` — Slices 1, 2.
- `src/lib/cms/episodes.ts` — Slice 3.
- `supabase/migrations/20260826010000_022_series_publish_cascade.sql` — Slices 1, 2.
- `src/components/home/HomePage.tsx` — Slice 5.
- `src/lib/new-releases.ts` — Slices 4, 6.
- `src/lib/catalog-rules.ts` — Slice 3 (consumer of `isMediaAssetReady`); Slice 8 (only documents the rule).
- `src/app/admin/series/[id]/page.tsx` — Slices 1, 2 (server action error surfacing).
- `src/components/cms/SeriesStatusForm.tsx` — Slice 2 (UI hint).
- `src/components/cms/EpisodeMetadataForm.tsx` — Slice 3 (UI hint, optional).

---

## IMPLEMENTATION ORDER (when authorized)

1. **Slice 3** (episode standalone gate) — pure app change, no Owner, no migration. Lowest risk; ship first to build muscle memory and pattern reuse.
2. **Slice 6** (ordering normalization) — refactor; depends on Slice 1 only for series-branch effectiveness. Can ship in parallel with Slice 3.
3. **Slice 1** (series published_at) — requires Owner decision on backfill + republish. RPC extension.
4. **Slice 1 backfill** (conditional) — depends on Owner selecting B/C and Slice 1 landed.
5. **Slice 2** (series poster gate) — requires Owner scope decision. After Slice 1.
6. **Slice 4** (exclusion table) — depends on QA DB read result.
7. **Slice 5** (HomePage replacement) — requires Owner approval + visual review per locked acceptance protocol.
8. **Slice 7** (scheduled publishing) — DEFERRED unless Owner says REQUIRED_NOW.
9. **Slice 8** (playback_reference) — no action.

---

## TEST PLAN

### Unit tests (per slice)
- **Slice 1**: RPC returns success and `series.published_at` is set after first publish; second publish preserves per chosen semantics (R1/R2); draft transition preserves `published_at`; archived transition preserves `published_at`; backfill idempotent (if implemented).
- **Slice 2**: `verifySeriesPublishIntegrity` returns errors for empty `poster_url`, unresolvable storage path, missing storage object; passes when poster present and object exists; draft editing unaffected.
- **Slice 3**: `updateEpisodeStatus('published')` fails when no media; fails when media `status='processing'`; fails when `provider_playback_reference` empty; succeeds when ready; draft/archived unaffected; `published_at` stamped only on first publish.
- **Slice 4**: `fetchExclusions` returns empty Set on table absence (existing fail-open behavior); returns populated Set on table presence; does not break on malformed rows.
- **Slice 5**: `HomePage` renders New Releases items identical to `/api/v1/catalog`; empty New Releases renders empty `ContentRow` without error.
- **Slice 6**: ordering helper returns canonical timestamp per row type; final sort comparator is stable; null timestamps excluded from auto lane.

### Integration tests
- Full CMS flow: create series → add episodes → assign media → wait for `ready` → publish series → verify `series.published_at`, `episodes.status='published'`, `episodes.published_at`, New Releases surfaces series.
- Poster gate: publish series without poster → verify RPC returns `status='blocked'`, message lists poster blocker.
- Episode gate: publish episode with no media → verify server action returns error and DB row stays in pre-publish state.
- HomePage + catalog equivalence: `HomePage` New Releases and `/api/v1/catalog` New Releases return identical arrays for a given user.

### Regression tests
- Existing `catalog-visibility.test.ts`, `playback-w01.test.ts`, `new-releases.test.ts` must continue to pass unchanged (Slice 6 is the only one touching `new-releases.ts` directly).
- Existing RLS policies: anon/authenticated cannot `SELECT` non-published rows (unchanged; no policy changes proposed).
- Existing short-film publish integrity (`verifyShortFilmPublishIntegrity`) unchanged.

---

## QA ACCEPTANCE PLAN

Per AGENTS.md §Locked Final Acceptance Protocol, ordered as:

### A. Consumer App / UI Acceptance Sequence (Slices 2, 5)
```
SOURCE -> EMULATOR -> SCREENSHOTS -> PRODUCT OWNER + CHATGPT REVIEW -> REFINEMENT LOOP -> PHYSICAL ONEPLUS -> LOCK
```

### B. CMS Acceptance Sequence (Slices 1, 2, 3, 4)
```
CMS SOURCE / CONFIG -> DEPLOYED QA BACKEND / API -> ACTUAL CMS WEBSITE RUNTIME CHECK -> SCREENSHOTS / EVIDENCE -> PRODUCT OWNER + CHATGPT REVIEW -> PRODUCT OWNER HANDS-ON CMS WEBSITE CHECK -> LOCK
```

### C. CMS -> Consumer App Integration (Slice 5)
- HomePage replacement: SOURCE → DEPLOYED QA WEB → EMULATOR (web) → SCREENSHOTS → OWNER + CHATGPT → ONEPLUS (only if a mobile home also uses this path).

### Statuses used (per protocol)
- `SOURCE VERIFIED` — diff/typecheck/lint/state
- `CMS/API VERIFIED` — actual QA Cloud Run responses
- `CMS WEBSITE VERIFIED` — actual CMS admin UI on QA host
- `READY FOR OWNER/CHATGPT REVIEW`
- `VISUAL CANDIDATE APPROVED — READY FOR PHYSICAL FINAL CHECK`
- `PHYSICAL QA PASS`
- `VERIFIED COMPLETE` + `LOCKED BASELINE`

### Specific per-slice QA steps

**Slice 1 (series published_at)**
1. SOURCE VERIFIED — read updated RPC; verify stamp site; typecheck/lint.
2. CMS/API VERIFIED — on QA Cloud Run, call `publish_series_with_episodes` via CMS; check DB row; confirm `series.published_at` populated.
3. CMS WEBSITE VERIFIED — log into QA CMS, publish a series, view DB.
4. SCREENSHOTS — capture DB row + CMS success message.
5. OWNER + CHATGPT REVIEW.
6. OWNER HANDS-ON CMS check.
7. LOCK.

**Slice 2 (series poster gate)**
1. SOURCE VERIFIED — read RPC + `updateSeriesStatus` + UI form.
2. CMS/API VERIFIED — publish via CMS with no poster; expect blocked; upload poster; retry; expect success.
3. CMS WEBSITE VERIFIED — verify "Publish preflight" UI surfaces poster blocker.
4. SCREENSHOTS.
5. OWNER + CHATGPT REVIEW.
6. OWNER HANDS-ON.
7. LOCK.

**Slice 3 (episode standalone publish gate)**
1. SOURCE VERIFIED.
2. CMS/API VERIFIED — direct episode publish via CMS with no media; expect blocked.
3. CMS WEBSITE VERIFIED — verify error surfaces in episode edit page.
4. SCREENSHOTS.
5. OWNER + CHATGPT REVIEW.
6. OWNER HANDS-ON.
7. LOCK.

**Slice 4 (exclusion table)** — pending QA DB read.
- If implementing: same sequence as Slice 2/3.
- If deleting: SOURCE VERIFIED only (code-only change); OWNER + CHATGPT review of the deletion decision.

**Slice 5 (HomePage fallback)** — full Consumer App sequence:
1. SOURCE VERIFIED.
2. DEPLOYED QA WEB — load QA web home; capture default-state screenshot.
3. EMULATOR — load web on emulator; capture New Releases row.
4. SCREENSHOTS.
5. OWNER + CHATGPT REVIEW — confirm canonical New Releases matches Android API output.
6. REFINEMENT LOOP if any item differs.
7. PHYSICAL ONEPLUS — only if Android home also reads from same path (currently Android reads `/api/v1/catalog`, not the web `HomePage`).
8. LOCK.

**Slice 6 (publish_at ordering)** — SOURCE VERIFIED only (no behavior change visible to consumer beyond what Slice 1 enables); OWNER + CHATGPT review of the rule codification.

**Slice 7 (scheduled publishing)** — DEFERRED.

**Slice 8 (playback_reference)** — no QA actions; informational only.

---

## ANDROID CHANGED: NO

No Android consumer changes in C07B. The `apps/android/` workspace is untouched. Defensive consumer checks in `apps/android/src/lib/api.ts:426–443` continue to provide the read-side enforcement boundary per AGENTS.md §7.

---

## BLOCKER

None for this planning run.

For implementation authorization, the following Owner decisions are required before any code change:

1. **Slice 1 backfill option** (A/B/C/D) — RECOMMEND A; acceptable B with `MAX(episodes.published_at)` precedence.
2. **Slice 1 republish semantics** (R1/R2) — RECOMMEND R1 (overwrite on republish).
3. **Slice 2 poster scope** (poster-only vs poster+hero) — RECOMMEND poster-only (matches short-film).
4. **Slice 2 enforcement location** (RPC + app vs app-only) — RECOMMEND RPC + app.
5. **Slice 4** — QA DB read to confirm table existence; Owner decide implement-vs-delete based on result.
6. **Slice 5** — Owner approve replacing `HomePage` New Releases slice with `getHomeState`.
7. **Slice 7** — REQUIRED_NOW / DEFERRED / NOT_REQUIRED; RECOMMEND DEFERRED.

---

## NEXT: CMS-C07B SLICE IMPLEMENTATION AUTHORIZATION

Hand off to Product Owner + ChatGPT for review and Owner-decision collection. Implementation will not begin until all Owner decisions are returned and an explicit "implement" instruction is issued.

STOP. Returning to Product Owner + ChatGPT before any code changes.