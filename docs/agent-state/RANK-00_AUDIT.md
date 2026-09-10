## 1. EXECUTIVE VERDICT

RANK-00: PARTIAL

The Consumer App already contains a substantial, server-authoritative editorial
discovery surface (Home Composer, CMS rows/items, category rows, New Releases
hybrid resolver, catalog, Explore/Search faceting). It does NOT contain any
behavioral ranking engine, no ranking decision identity, no experiment/propensity
infrastructure, and no Autonomous coupling.

CRITICAL FINDING: The governing document `0NYA_RANKING_DOMAIN_CONTRACT_v1.0.md`
is ABSENT from both the Consumer App repository and the Autonomous repository.
The audit therefore cannot be run against the contract; it is run against the
actual repository state. This must be resolved before RANK-01.

READY FOR RANK-01: NO (contract missing; ranking_decision_id chain MISSING)
READY FOR RANK-05B: NO (no RankingEventAdapter / RankingOutcomeAdapter; no event sink)
READY FOR AUTONOMOUS OBSERVATION ADAPTER: NO (no observation envelope, no adapter seam)
READY FOR LIVE AUTONOMOUS RANKING: NO
CONSTITUTION CHANGE REQUIRED: NO
## 2. REPOSITORY / WORKTREE STATE

- Current working directory: `C:\Users\Akash\Documents\0nyapp`
- Git branch: `qa/netlify-api-e34ab5e`
- HEAD commit: `ac9e11676c3434cb16b4f33adc4208e1c7c4f1e5`
- git status: heavily dirty — 63 modified tracked files + ~55 untracked files/dirs.
- Root AGENTS.md: `C:\Users\Akash\Documents\0nyapp\AGENTS.md`
- APP_COMPLETION_ROADMAP.md: `C:\Users\Akash\Documents\0nyapp\docs\agent-state\APP_COMPLETION_ROADMAP.md`
- Ranking Domain Contract: **NOT FOUND** (see §3).

Dirty files preserved; nothing reset. High-collision files relevant to ranking/discovery
(untracked, in-flight, not yet committed):
- `src/lib/new-releases.ts` + `src/lib/new-releases.test.ts` (untracked)
- `src/lib/cms/home.ts` (modified)
- `src/lib/home.ts` (modified)
- `src/lib/catalog.ts`, `src/lib/catalog-rules.ts` (untracked)
- `src/lib/cms/episode-access.ts` + test (untracked)
- `src/lib/cms/media-truth*.ts` (untracked)
- `supabase/migrations/20260904000000_029…`, `…030…`, `…031…`, `…032…`, `…033…` (untracked)
- `apps/android/src/screens/HomeScreen.tsx`, `ExploreScreen.tsx`, `SearchResultsScreen.tsx` (modified)

## 3. AUTHORITY DOCUMENTS REVIEWED

Read:
- `AGENTS.md` (root) — authority order, QA infra, locked acceptance protocol.
- `docs/agent-state/APP_COMPLETION_ROADMAP.md` v1.9 (B00–B11, PX01).
- `docs/0nya_BACKEND_API_CONTRACT_v1.0.md`
- `docs/0nya_CMS_PRODUCT_CONTRACT_v1.0.md`
- `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md`
- `docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md`
- `docs/0nya_APP_ARCHITECTURE_v1.0.md`
- `docs/agent-state/SYSTEM_MAP.md`, `ANDROID_CURRENT_STATE.md`, `CMS_BACKEND_CURRENT_STATE.md`

### GOVERNING CONTRACT — ABSENT
`0NYA_RANKING_DOMAIN_CONTRACT_v1.0.md` exists in NEITHER repository:
- Searched `C:\Users\Akash\Documents\0nyapp` recursively (all depths, all extensions) — not found.
- Searched `C:\Users\Akash\Documents\0nya-autonomous` full tree — not found.
- Searched all of `C:\Users\Akash\Documents` for `RANKING` / `DOMAIN_CONTRACT` — not found.
- Content search for the literal string `RANKING_DOMAIN_CONTRACT` — no matches.

This is a blocking precondition. The audit below is therefore run against
**actual repository state**, not against a contract that is not present.

### Authority conflicts found
1. **Home "Trending" is duplicated and contradictory.**
   - `src/components/home/HomePage.tsx:24` (web CMS-rendered page): `trendingItems = catalogSeries.slice(1, 7)` — pure positional slice, hardcoded, no ranking signal.
   - `apps/android/src/screens/HomeScreen.tsx` renders only `homeState.rows` from `/api/v1/catalog` — it never renders a "Trending" row unless the CMS creates one. The web HomePage "Trending" row has no Android counterpart.
   - `apps/android/src/lib/appLanguage.tsx:97` ships a Hindi key `explore.trending` that no screen consumes.
2. **"Featured" has two unrelated meanings.**
   - `series.featured = true` (DB boolean, `supabase/002_content_catalog.sql:16`) → `getFeaturedSeries()` picks one published series for the web hero.
   - `src/components/home/FeaturedHero.tsx` is a web-only legacy hero. The Product Bible (§ synchronized in B00) formally superseded "Featured Hero / Watch Now / Info Home model" with Multi-Spotlight. `FeaturedHero.tsx` still exists in source — stale, not consumer-authoritative.
3. **"Staff Picks" / "Start Here" are UI labels with no underlying policy.**
   - `apps/android/src/screens/HomeScreen.tsx:885-892` `VIRGIN_HOME_HEADINGS` includes "Trending Now", "Staff Picks" as *static placeholder headings* shown only when the catalog is empty. They are not backed by any CMS row or policy.
4. **`src/data/content.ts` mock data is still authoritative for some fields.**
   - `src/lib/catalog.ts:180` `mapSeries` falls back to `getMockSeriesBySlug(row.slug)` for `genre`, `episodeDuration`, `synopsis`, `poster`, `isFree`, `isLocked`, `progress`, `currentEpisode`. Mock values override DB for any seeded slug. This is a data-quality hazard, not a ranking policy, but it means some consumer-visible fields are **hardcoded**, not CMS/DB-managed.

## 4. CURRENT RANKING SYSTEM MAP (what exists vs what is missing)

### EXISTS — server-authoritative editorial discovery
| Capability | Location | Evidence |
|---|---|---|
| Home rows (CMS-configured) | `src/lib/cms/home.ts`, `src/lib/home.ts` | `home_rows` table, `row_role` in (`start_here`,`editorial`,`spotlight`,`category`) |
| Row ordering | `home_rows.sort_order` ASC | `src/lib/home.ts:130`, `src/lib/cms/home.ts:70` |
| Item ordering within a row | `home_row_items.sort_order` ASC | `src/lib/cms/home.ts:98`, `src/lib/home.ts:187` |
| Drag/reorder (up/down) | `moveHomeRow`, `moveHomeRowItem`, `moveHomeRow`, `moveSpotlightItem` | `src/lib/cms/home.ts:485,627,344` |
| Row enabled/disabled | `home_rows.enabled` | `src/lib/home.ts:130` filters `enabled=true` |
| Item show_title toggle | `home_row_items.show_title` | `src/lib/cms/home.ts:348` |
| Duplicate prevention | `addHomeRowItem` dedupe query | `src/lib/cms/home.ts:552-571` |
| Content validity check (published) | `addSpotlightItem` validates status | `src/lib/cms/home.ts:273-300` |
| Category rows (auto-populated) | migration `030` + `src/lib/home.ts:285-324` | "Micro Dramas" / "Short Films" |
| New Releases hybrid resolver | `src/lib/new-releases.ts` | editorial pinned + auto by `published_at` desc + exclusions table |
| Catalog (published + media-ready) | `src/lib/catalog.ts` | `getPublishedSeries`, `getPublishedShortFilms` |
| Explore format + genre filter | `apps/android/src/screens/ExploreScreen.tsx` | client-side only |
| Search (client-side substring) | `apps/android/src/screens/SearchResultsScreen.tsx` | client-side only |
| Continue Watching | `src/lib/watch-progress.ts`, `HomeScreen.tsx` | server `watch_progress` |
| Staff Picks / Trending / Featured | **no policy exists** | only labels/placeholders |

### MISSING (entirely absent)
- Any behavioral ranking score (trending/popular/most-watched/completion-based).
- `ranking_decision_id`, `candidate_set_id`, `ranking_policy`, `config_version`, `config_hash`, `ranking_engine_version`.
- Experiment / A/B / feature-flag / rollout infrastructure.
- Behavioral event sink (impression / content_served / search_result_open).
- Any Autonomous coupling (see §18 — verified clean).
- The governing Ranking Domain Contract itself.

### CONFLICT
- Web `HomePage.tsx` "Trending" = `catalogSeries.slice(1,7)` positional; Android has no equivalent row.
- `FeaturedHero.tsx` legacy web hero still in source although superseded by Multi-Spotlight.

### DO NOT DUPLICATE
- `home_rows` / `home_row_items` / `home_settings` / `home_new_releases_exclusions` schema — single editorial source.
- `watch_progress` — single watch-state source.
- `series.sort_order` — single catalog ordering key.
- `media_assets.status` + `provider_playback_reference` — single readiness source (`catalog-rules.ts`).
- Monetization event contracts in `src/lib/monetization/events.ts` — do not extend into ranking events.

## 5. TAXONOMY AUDIT

All taxonomy values live in `src/types/database.ts` (Supabase-generated types) backed by
`supabase/002_content_catalog.sql` and migrations 029-033. The Android DTO is
`apps/android/src/types/api.ts`; the web DTO is `src/lib/api/serializers.ts`.

| Item | Status | Where | Source of truth |
|---|---|---|---|
| content type / format | EXISTS | `series.format` (`002_content_catalog.sql:8-10`), `toContentFormat()` maps `Series\|Mini\|Short` (`catalog.ts:120`) | DB-managed, server-derived |
| Micro Drama | EXISTS (label only) | `series.format="Series"`; label "MICRO DRAMA" hardcoded in `ExploreScreen.tsx:649`, `HomeScreen.tsx:1259`, `SearchResultsScreen.tsx:349` | **hardcoded client label** |
| Short Film | EXISTS | `short_films` table (`database.ts:747`), DTO `ApiShortFilm` | DB-managed |
| genres | EXISTS | `series.genre` (comma string), `short_films.genre` (see `ExploreScreen.tsx:176-202`) | DB-managed; split client-side |
| primary genre | MISSING | No primary/secondary distinction anywhere | — |
| secondary genres | MISSING | Genre is a single comma-joined string; no array, no ordering | — |
| editorial flags | PARTIAL | `series.featured` boolean (`002:16`); `home_row_items.show_title`; `home_rows.row_role` | DB-managed |
| lifecycle state | EXISTS | `series.status` / `short_films.status` in (`draft`,`published`,`archived`) | DB-managed |
| compliance rating/descriptors | EXISTS | `content_rating` (U/U-A 7+/U-A 13+/U-A 16+/A), `content_descriptors[]` (`classification.ts:1-12`); episode-level override | DB-managed, server-derived (`resolveContentClassification`) |
| access state | EXISTS | `EpisodeAccessState` (`entitlements.ts:24`): free/owned/subscription/locked | server-derived at playback |
| creator | PARTIAL | `short_films.creator_reference` (`database.ts:755`) exists; `series` has **no creator column** | DB-managed (short films only) |
| language | EXISTS | `series.language`, `short_films.language` (`database.ts:573,759`) | DB-managed |
| runtime | EXISTS | `episodes.duration_seconds` → `toRuntime()` (`catalog.ts:128`); short film `duration_seconds` + `formatShortFilmDuration()` | DB-managed, server-derived |
| publication/release date | EXISTS | `series.published_at` (migration 029), `short_films.publish_at`; `isReleased()` checks `<= now` (`catalog-rules.ts:27`) | DB-managed, server-derived |

### Notes
- `genre` is a free-form comma-joined string, not a normalized array. Explore derives the
  genre chip set client-side from the loaded catalog (`ExploreScreen.tsx:176`). No canonical
  genre taxonomy table exists.
- "Micro Drama" vs "Short Film" is a **client-rendered label**, not a stored content type.
  `series.format` values `Series`/`Mini`/`Short` are the only DB signal and `Mini` is never
  surfaced. This is a DO NOT DUPLICATE risk: any future content-type taxonomy must not be
  layered on top of `format` string magic.
- Mock fallback in `catalog.ts:180,199` means genre/synopsis/poster for seeded slugs can be
  **hardcoded** rather than CMS-managed.

## 6. CMS / EDITORIAL AUDIT

### Home rows — EXISTS, fully CMS-authoritative
- Source: `home_rows` (id, title, row_role, enabled, sort_order) + `home_row_items` (row_id, content_type, series_id|short_film_id, sort_order, show_title).
- Admin UI: `src/app/admin/home/page.tsx` (Home Composer), backed by `src/lib/cms/home.ts`.
- Row roles: `start_here`, `editorial`, `spotlight`, `category` (migration 030).
- Drag/reorder: `moveHomeRow` / `moveHomeRowItem` / `moveSpotlightItem` swap `sort_order` pairwise (cms/home.ts:485-521, 627-671, 344-346).
- Enabled/disabled: row-level `enabled`; consumer read filters `enabled=true` (home.ts:130).
- Scheduling: **MISSING** — no `publish_at`/`start_at`/`end_at` on `home_rows` or `home_row_items`. Row visibility is binary.
- Duplicate prevention: EXISTS — `addHomeRowItem` queries existing `(row_id, content_type, id)` and returns `{ duplicate: true }` (cms/home.ts:552-571).
- Content validity: EXISTS for Spotlight (`addSpotlightItem` rejects non-published, cms/home.ts:273-300); weaker for editorial rows (existence check only, cms/home.ts:536-550).
- Publication/media-readiness validation: PARTIAL — consumer read re-checks published status + media readiness at serve time (home.ts:287-323, catalog-rules.ts).

### Is CMS order canonical? — YES
`/api/v1/catalog` returns `home.rows` in `home_rows.sort_order` ASC; items in
`home_row_items.sort_order` ASC. Confirmed by B00 closeout: "API/CMS order is authoritative.
Do not maintain a predetermined client-side title order."

### Does Android ever rerank or reconstruct CMS order? — NO
`apps/android/src/screens/HomeScreen.tsx:1192-1225` renders `homeState.rows` in the exact
server array order. The only client-side reordering is Continue Watching sorting by
`lastWatchedAt` desc (a watch-history concern, not a ranking override) and the Spotlight
rail snap-index derivation (pure geometry).

### Stable row/config/version identity? — PARTIAL
- `home_rows.id` (UUID) is a stable row identity. `home_row_items.id` is a stable item identity.
- **No config version, no config hash, no ranking_policy, no ranking_engine_version.**
  `home_settings` is a single-row key/value table (`low_history_threshold` only).

### CMS audit/change provenance? — MISSING
- No `updated_by` / `changed_at` / `audit_log` on `home_rows`, `home_row_items`, or `home_settings`.
- `created_at`/`updated_at` timestamps exist on the rows (DB defaults) but carry no actor identity.
- `requireCmsAdmin` gates writes (cms/auth.ts) but does not record who.

### Editorial semantics mapping
| Future concept | Maps onto existing CMS? |
|---|---|
| EDITORIAL_PIN | PARTIAL — `home_row_items.sort_order` pinned low = de-facto pin. No explicit pin flag. |
| EDITORIAL_BOOST | MISSING — no boost/score field anywhere. |
| EDITORIAL_REMOVE | EXISTS — `removeHomeRowItem` / `removeSpotlightItem`. |
| EDITORIAL_ORDER | EXISTS — `sort_order` + pairwise swap. |

## 7. HOME AUDIT

Source: `src/lib/home.ts` (`getHomeState`) served by `src/app/api/v1/catalog/route.ts`;
client `apps/android/src/screens/HomeScreen.tsx`.

| Element | Status | Evidence |
|---|---|---|
| row source | EXISTS | `home_rows` (enabled) + `home_row_items` + catalog category auto-population |
| row ordering | EXISTS | `home_rows.sort_order` ASC (home.ts:130) |
| content ordering | EXISTS | `home_row_items.sort_order` ASC; category rows use `series.sort_order` / `short_films.publish_at` then title |
| Continue Watching | EXISTS | `watch_progress` filtered `position_seconds >= 5`, `!completed`, `lastWatchedAt` desc, one-per-series (HomeScreen.ts:791-833) |
| New Releases | EXISTS (hybrid) | `getHybridNewReleases` (new-releases.ts): editorial pinned (sortOrder 0) then auto by `published_at` desc, limit 10, exclusions table |
| Micro Dramas (category row) | EXISTS | migration 030; home.ts:285-305 filters published series with >=1 media-ready episode |
| Short Films (category row) | EXISTS | migration 030; home.ts:307-324 filters published + released short films |
| Staff Picks | MISSING as policy | only a static placeholder heading in the virgin/empty state (HomeScreen.ts:885-892) |
| Spotlight / Multi-Spotlight | EXISTS | `home_rows.row_role="spotlight"`; returns ALL valid items in sort_order; 5-item rail verified on OnePlus 13R |
| Trending | MISSING | no trending policy; web `HomePage.tsx:24` uses `catalogSeries.slice(1,7)` positional only |
| Start Here | PARTIAL | `row_role="start_here"` is a CMS row; H01/H02 state machine driven by `completedCount` vs `low_history_threshold` (home.ts:402-406) |

### Collisions with a future Ranking Domain Contract
1. **Category rows are auto-populated, not editorially ordered.** "Micro Dramas" uses
   `series.sort_order` ASC; "Short Films" uses `publish_at` ASC then title. Any future
   per-row ranking must not silently replace these two deterministic orders without an
   explicit CMS opt-in, because they are the consumer-visible contract today.
2. **`low_history_threshold` is the only `home_settings` key.** It is a gate for the
   H01/H02 Start Here state machine, not a ranking parameter. Do not overload it.
3. **Spotlight `show_title` is a per-item CMS flag** (`home_row_items.show_title`). It is
   presentation, not ranking, and must not be repurposed as a recommendation reason.
4. **No `catalog[0]` fallback** (per locked product rule) — HomeScreen.ts:847 returns `[]`
   when no spotlights exist. Preserve this.
5. **Continue Watching min-seconds = 5 is a hardcoded client constant**
   (`HomeScreen.ts:50`) with an explicit comment that the API does not expose a configurable
   threshold. Do not move this into ranking config without a backend field.

## 8. EXPLORE AUDIT

Source: `apps/android/src/screens/ExploreScreen.tsx`. Data: `getCatalog()` → `/api/v1/catalog`
(`src/app/api/v1/catalog/route.ts` → `getPublishedSeries` + `getPublishedShortFilms`).

| Feature | Status | Evidence |
|---|---|---|
| All view | EXISTS | `formatOptions` "All" chip (ExploreScreen.tsx:37-41) |
| Micro Drama filter | EXISTS | `selectedFormat="micro-dramas"` hides short films (ExploreScreen.tsx:205-207) |
| Short Film filter | EXISTS | `selectedFormat="short-films"` hides series (ExploreScreen.tsx:223-225) |
| genre filters | EXISTS | client-derived `availableGenres` from loaded catalog, modal selector (ExploreScreen.tsx:176-202, 506-587) |
| sort modes | **MISSING** | No sort control anywhere. Order is whatever the server returns. |
| Trending | MISSING | no trending sort |
| Newest | MISSING | no newest sort (server returns `series.sort_order` ASC, `short_films.publish_at` ASC) |
| Staff Picks | MISSING | no staff-pick filter or sort |
| Most Watched | MISSING (and not ready) | no watch-count column, no watch-time aggregate |
| filter combinations | EXISTS | format AND genre AND query combined client-side (ExploreScreen.tsx:204-256) |
| server vs client filtering | **CLIENT** | All format/genre/query filtering is `Array.filter` in `useMemo` on the client. Server does no filtering. |
| pagination | **MISSING** | No pagination. Full catalog loaded at once. |

### Notes
- Genre derivation is format-aware: when a format filter is active, only genres from that
  format are offered (ExploreScreen.tsx:179, 190). This is a client-computed set, so the
  genre list is not deterministic across renders if the catalog changes between mounts.
- `shortFilms` genre is read via `(film as any).genre` (ExploreScreen.tsx:192, 228) — the
  DTO does not formally declare `genre` on `ApiShortFilm`. Type-unsafe; do not "fix" by
  adding a field that duplicates `short_films.genre`.
- Server ordering for Explore is `series.sort_order` ASC and short films `publish_at` ASC
  then title ASC (`catalog.ts:295, 399`). This is a fixed deterministic order, not ranking.

## 9. SEARCH AUDIT

Source: `apps/android/src/screens/SearchResultsScreen.tsx`; entry point `ExploreScreen.tsx`
submitSearch (ExploreScreen.tsx:311) navigates to SearchResults with `query`, `format`, `genre`.

| Metadata | Supported? | Evidence |
|---|---|---|
| title | YES | `matchesMicroDramaQuery` / `matchesShortFilmQuery` substring on `item.title` (SearchResultsScreen.tsx:42-54) |
| series | PARTIAL | matched indirectly via `series.title`; no separate series-name field |
| creator | **NO** | `series` has no creator column; `short_films.creator_reference` is never searched |
| genre | YES (filter only) | genre is a filter chip, not a free-text search target, though `matchesMicroDramaQuery` does substring `series.genre` (ExploreScreen.tsx:49) |
| content type | YES | `format` chip (all/micro-dramas/short-films) |
| language | PARTIAL | `matchesShortFilmQuery` substring-matches `item.language` (ExploreScreen.tsx:52); series language is never searched |
| synopsis/description | **NO** | `series.synopsis` / `episode.description` are never matched |

### Architecture
- **100% client-side search.** `getCatalog()` fetches the whole catalog once; every query
  is `Array.filter` with `.includes()` on the client. No search endpoint exists
  (`/api/v1/search` is not present in `src/app/api`).
- **Ranking/sort behavior: MISSING.** Results preserve server order; no relevance scoring,
  no ranking, no sort toggle.
- **Deterministic?** YES for a given catalog snapshot (pure filter, stable server order),
  but NOT across catalog changes, because the genre chip set and result order both depend
  on the full catalog state.
- **Result-position attribution: MISSING.** `renderResultCard(item, index)` receives an
  `index` (SearchResultsScreen.tsx:292) but no event is emitted on tap. `perfMark("CONTENT_TAP",
  { source: "SEARCH_RESULTS" })` fires (SearchResultsScreen.tsx:308, 317) but carries no
  position, no query, no result-count. There is no way to attribute an open to a result position.

### DO NOT DUPLICATE
- `recentSearches.ts` (client secure-storage key `0nya.recent-searches.v1`, max 8) is the
  only search-history store. Do not add a server-side search-history table that duplicates it.

## 10. CURRENT RANKING POLICIES

Searched for `trending|newest|latest|popular|most watched|views|watch time|completion|order|sort|rank|score|featured|staff pick` across `src`, `apps/android/src`, `supabase/migrations`.

### Real ranking/sorting implementations that exist
| Policy | Location | Input | Formula | Deterministic? | Server/Client | Verdict |
|---|---|---|---|---|---|---|
| Row order | `home.ts:130`, `cms/home.ts:70` | `home_rows.sort_order` | ASC | YES | Server | KEEP — canonical editorial order |
| Item order | `home.ts:187`, `cms/home.ts:98` | `home_row_items.sort_order` | ASC | YES | Server | KEEP |
| Category "Micro Dramas" | `home.ts:287-305` | `series.sort_order` | ASC, filtered to published + media-ready | YES | Server | KEEP — but note it is catalog order, not ranking |
| Category "Short Films" | `home.ts:307-324` | `short_films.publish_at`, `title` | publish_at ASC, nullsFirst, then title ASC | YES | Server | KEEP |
| New Releases (hybrid) | `new-releases.ts:180-326` | `published_at`, editorial `home_row_items` | editorial (sortOrder 0) pinned first, then auto by `published_at` DESC, limit 10, exclusions applied | YES (given DB state) | Server | KEEP — closest thing to a real policy |
| Catalog series order | `catalog.ts:295` | `series.sort_order` | ASC | YES | Server | KEEP |
| Catalog short film order | `catalog.ts:399-400` | `short_films.publish_at`, `title` | publish_at ASC nullsFirst, then title ASC | YES | Server | KEEP |
| Continue Watching | `HomeScreen.tsx:791-833` | `watch_progress.lastWatchedAt` | DESC, one entry per series | YES | Client | KEEP — watch-history, not ranking |
| Web "Trending" | `HomePage.tsx:24` | `catalogSeries` array | `slice(1, 7)` — positional, no signal | YES | Server (web) | **PROVISIONAL / SHOULD BE REMOVED OR REPLACED** — pure positional slice, mislabeled, no Android counterpart |
| Featured series | `catalog.ts:313-350` | `series.featured=true` | picks 1 published, `sort_order` ASC, limit 1 | YES | Server | KEEP — editorial flag, not ranking |

### Explicitly absent (verified by grep — zero implementations)
- `trending` score, `popular` score, `most_watched`, `views`, `watch_time`, `completion`-based
  ranking, `rank`, `score`, `staff_pick`, `recommendation`, `ranking`, `candidate_set`,
  `eligibility_snapshot`, `ranking_decision`, `ranking_policy`, `config_version`, `config_hash`,
  `ranking_engine_version`, `experiment`, `feature_flag`, `ab_test`, `rollout`, `cohort`.

### Trustworthiness
Every ordering that exists is **deterministic and server-derived**. None is randomized.
None is provisional in the sense of "unverified" — but the web "Trending" slice is
**mislabeled** (it is positional, not trend data) and should not be presented as a ranking
policy to the future contract.

### Conflict with a future Ranking Domain Contract
- The two category rows ("Micro Dramas", "Short Films") use **fixed catalog order**, not
  ranking. If the contract later wants these rows ranked, that must be an explicit opt-in
  with a visible policy identity — silently swapping `sort_order` ASC for a score would be
  a behavior change with no CMS trace.
- `new-releases.ts` is the only file that mixes automatic chronology with an editorial
  override (`home_new_releases_exclusions` table + editorial `home_row_items`). This is
  the pattern the future contract should generalize, not bypass.

## 11. BEHAVIORAL EVENT AUDIT

### What currently emits events
| Event | Producer | Server/Client | Timestamp | Actor | Session | Content | Surface | Row | Position | Persisted? | Trust |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CONTENT_TAP | `apps/android/src/lib/api.ts` `perfMark` | Client (dev-only console) | `perfNow()` | NO user id | NO session id | `series_slug` / `short_film_slug` | `HOME`, `HOME_SPOTLIGHT`, `HOME_SPOTLIGHT_INFO`, `HOME_CONTINUE_WATCHING`, `EXPLORE`, `SEARCH_RESULTS` | NO row id | NO position | **NO** — dev console.info only, stripped in release | Provisional |
| WALLET_TAP | `HomeScreen.tsx:1079` | Client (dev-only) | perfNow | NO | NO | — | `HOME` | — | — | NO | Provisional |
| HOME_REQUEST_START / HOME_DATA_READY | `HomeScreen.tsx` | Client (dev-only) | perfNow | NO | NO | — | `HOME` | — | — | NO | Provisional |
| SEARCH_RESULTS_MOUNT / DATA_READY | `SearchResultsScreen.tsx` | Client (dev-only) | perfNow | NO | NO | — | `SEARCH_RESULTS` | — | — | NO | Provisional |
| EXPLORE_MOUNT / DATA_READY / CONTENT_TAP | `ExploreScreen.tsx` | Client (dev-only) | perfNow | NO | NO | slug | `EXPLORE` | — | — | NO | Provisional |
| API_REQUEST_END | `api.ts` | Client (dev-only) | perfNow | NO | NO | path | NETWORK | — | — | NO | Provisional |
| rewarded events | `recordRewardedEvent` → `/api/v1/monetization/rewarded-events` | Client → Server | `created_at` (DB) | `user_id` (from session) | NO session id | `episode_id` | — | — | — | **YES** — `rewarded_monetization_events` table | Server-validated |
| watch progress writes | `putWatchProgress` → `/api/v1/watch-progress` | Client → Server | `last_watched_at` | `user_id` | NO | series_slug/episode_number or short_film_slug | — | — | — | **YES** — `watch_progress` | Server-authoritative |
| monetization events (design only) | `src/lib/monetization/events.ts` | TYPES ONLY | — | — | — | — | — | — | — | **NO** — no producer, no sink, no route | Contract only |

### Events explicitly requested by the audit that DO NOT exist
content_served, content_impression, play_start, watch_progress (as event), qualified_watch,
completion (as event), abandonment, watch_time (aggregate), share, tip (event), hide, skip,
quick_back, session_exit, search (event), search_result_open.

### Critical finding: no impression model
"Do not assume screen rendering equals impression" — currently there is **no impression
event at all**. `perfMark("CONTENT_TAP", ...)` is the closest thing and it is a tap, not an
impression, and it is dev-only console output that does not persist. A row render, a card
visible in a scroll view, and a search result position are all currently unobservable.

### Reliability
The only persisted behavioral data is `watch_progress` (trustworthy, server-authoritative)
and `rewarded_monetization_events` (trustworthy, server-validated). Everything else is
dev-only console and must never be treated as evidence.

## 12. WATCH / PLAYBACK SIGNAL AUDIT

Sources: `src/lib/watch-progress.ts`, `src/lib/entitlements.ts`, `src/lib/playback.ts`,
`apps/android/src/player/usePlaybackController.ts`, `apps/android/src/player/useWatchProgressSync.ts`,
`supabase/migrations/...`.

### Trustworthy data that exists
| Signal | Where | Trust |
|---|---|---|
| play start | implicit — `watch_progress` row created/updated on first progress write | server-authoritative |
| playback duration | `watch_progress.duration_seconds` (client-supplied, server-stored) | client-reported, server-persisted |
| watch progress | `watch_progress.position_seconds`, `last_watched_at` | server-authoritative |
| completion | `watch_progress.completed` (derived: `position >= duration - 5`, or explicit) | server-authoritative |
| qualified watch | **no concept exists** | — |
| unique viewer | `watch_progress.user_id` (FK to `users`) | server-authoritative |
| total watch minutes | **no aggregate** — no view/count column on any table, no watch-time sum | MISSING |

### Data model
`watch_progress` (database.ts:1346): id, user_id, content_type (series_episode|short_film),
series_slug, episode_number, short_film_slug, position_seconds, duration_seconds, completed,
ad_break_state (Json), last_watched_at, created_at, updated_at.
Unique constraint: `user_id,content_type,series_slug,episode_number` and
`user_id,content_type,short_film_slug`.

### Verdict
**MOST_WATCHED_NOT_READY**

Evidence:
1. No `views`, `view_count`, `watch_count`, `play_count`, or `unique_viewers` column exists on
   `episodes`, `series`, `short_films`, or any table. Verified against `database.ts` and
   `supabase/002_content_catalog.sql`.
2. No watch-time aggregate column or materialized view.
3. `watch_progress` can tell you *how many users completed* a given episode/short film
   (`completed=true` grouped by content), and *how many have any progress*, but it cannot tell
   you *total watch minutes* without a server-side SUM over `position_seconds`, and it cannot
   tell you *unique viewers at the content level* without a distinct count that the current
   queries do not perform.
4. `completed` is derived client-side (`position >= duration - 5`, watch-progress.ts:209) and
   is therefore a threshold rule, not a measured outcome. It is deterministic but provisional.
5. Guest watch progress is local-only (`playbackHistory.ts`); it merges on sign-in. A guest
   completion is not server-authoritative until the merge succeeds.

To implement Most Watched you would need a new aggregate (count or sum) that does not currently
exist. Do not repurpose `watch_progress` row counts as "views" — that would conflate
"started and saved progress" with "watched".

## 13. IDENTITY / SESSION AUDIT

### Current semantics
| Concept | Where | Semantics |
|---|---|---|
| authenticated user ID | `supabase.auth.user.id` (UUID) | Single source. `authContext.tsx:56` `getUser()`. Used as `user_id` FK across `watch_progress`, `wallets`, `subscriptions`, `episode_entitlements`, `rewarded_ad_attempts`, `coin_transactions`, `parental_sessions`. |
| anonymous user / guest viewer | `session === null` in `useAuth()` | Guest can browse, play free episodes, play ad-supported short films, local resume. No server `user_id`. |
| pseudonymous analytics ID | **MISSING** | No device/install/analytics ID exists anywhere. `perf.ts` has a `getRunId()` (`DEV-<hex>` or `EXPO_PUBLIC_ONYA_PERF_RUN_ID`) but it is a dev-only perf correlation token, not a persistent pseudonymous identity, and it is not stored. |
| device/install ID | **MISSING** | No `device_id`, `installation_id`, or equivalent. |
| session ID | **MISSING** (as an analytics concept) | Supabase `Session` has `access_token`/`refresh_token` but no stable session-id field is exposed or recorded. `authContext.tsx` tracks `session.user.id` only. |

### Can the current system support the Ranking Domain Contract actor_id/session_id without a second identity system?
**YES — with caveats.**
- `supabase.auth.user.id` is the single authoritative `actor_id`. It is already the FK on every
  behavioral table. Do not create a second identity.
- A **session_id** does not exist and would need to be introduced. It must be a new,
  non-sensitive UUID issued per app foreground session — NOT derived from the Supabase
  access token (which must never appear in analytics per B11 rules) and NOT a second user id.
- A **pseudonymous analytics ID** for guests does not exist. If the contract requires a stable
  guest identity, it must be generated client-side (UUIDv4, persisted in secure storage),
  separate from the Supabase credential, and never linked to phone/PII. This would be a new
  system, but it must not duplicate `supabase.auth`.

### Secrets note
No secrets or raw sensitive values are reported here. `secureStorage.ts` holds the Supabase
session token encrypted; it is never read by any analytics path.

## 14. RANKING DECISION IDENTITY AUDIT

Searched for `ranking_decision_id` and equivalents (`request_id`, `recommendation_id`,
`feed_id`, `row_render_id`, `response_id`, `analytics correlation id`) across `src`,
`apps/android/src`, `supabase/migrations`.

### Existing identifiers that partially overlap
| Concept | Exists? | Where | Scope |
|---|---|---|---|
| request_id | PARTIAL | `MonetizationEvent.request_id` (`monetization/events.ts:186`) — design only, no producer | monetization only |
| correlation_id | PARTIAL | `MonetizationEvent.correlation_id` (events.ts:185) — design only | monetization only |
| event_id | PARTIAL | `MonetizationEvent.event_id` (events.ts:181) — design only | monetization only |
| perf run id | PARTIAL | `perf.ts` `__0NYA_PERF_RUN_ID__` / `EXPO_PUBLIC_ONYA_PERF_RUN_ID` | dev-only, not persisted |
| catalog cache key | PARTIAL | `api.ts` `getAuthScopedCacheKey` = `auth:<token>` or `guest` | client cache, not a decision id |
| home row id | EXISTS | `home_rows.id` | CMS row identity, stable |
| home row item id | EXISTS | `home_row_items.id` | CMS item identity, stable |
| watch progress id | EXISTS | `watch_progress.id` | row identity |
| rewarded event id | EXISTS | `rewarded_monetization_events.id` | DB PK |

### Chain reconstruction: ranking generation → served → impression → open → play → outcome
**MISSING**

There is no ranking generation step at all (no ranking engine), so the chain cannot start.
Even for the editorial (non-behavioral) path:
- **ranking generation**: N/A (CMS sort_order is the "policy", but it has no version/id).
- **served**: observable — `/api/v1/catalog` response carries `home.rows[]` with `id` per row
  and item, but carries no response-level id, no timestamp, no policy version.
- **impression**: MISSING — no event fires when a row renders or a card appears.
- **open**: PARTIAL — `CONTENT_TAP` perfMark fires with slug + source, but no position, no row
  no query, and it does not persist.
- **play**: PARTIAL — implicit via `watch_progress` write; no explicit play_start event.
- **outcome**: PARTIAL — `watch_progress.completed` / `position_seconds` are the only outcome
  records, and they are server-authoritative.

### Verdict
**MISSING** for the full behavioral chain. The CMS editorial chain is partially reconstructible
from `home_rows.id` + `home_row_items.id` + `watch_progress` but has no decision id, no
served-time snapshot, and no impression link.

## 15. CANDIDATE / ELIGIBILITY AUDIT

### How candidate content is currently generated
| Surface | Candidate generation | Location |
|---|---|---|
| Home rows (editorial/start_here) | `home_row_items` membership for the row, joined to `series`/`short_films` | `home.ts:326-396` |
| Home category rows ("Micro Dramas") | ALL published series with >=1 media-ready episode, `series.sort_order` ASC | `home.ts:287-305`, `catalog.ts:488` |
| Home category rows ("Short Films") | ALL published + released short films, `publish_at` ASC then title | `home.ts:307-324`, `catalog.ts:388` |
| Spotlight | ALL valid items in `home_row_items.sort_order` ASC for the spotlight row | `home.ts:232-242` |
| New Releases | `series.published_at` not null DESC + `short_films.publish_at` DESC, then editorial overrides + exclusions | `new-releases.ts:180-326` |
| Explore | ALL published series + ALL published short films, filtered client-side | `catalog.ts:284,388`, `ExploreScreen.tsx` |
| Search | Same full catalog, filtered client-side | `SearchResultsScreen.tsx` |

### Reconstructibility
- **initial candidates**: YES for editorial rows (the `home_row_items` set is the candidate set).
  NO for category rows and Explore/Search — the candidate set is "all published content", which
  is only reconstructible by re-running the same catalog query.
- **eligibility**: YES — published status + media readiness (`isMediaAssetReady`,
  `isSeriesConsumerVisible`, `isShortFilmConsumerVisible`, `resolveShortFilmPlaybackReady` in
  `catalog-rules.ts`) are pure, testable, single-source-of-truth functions. This is the strongest
  foundation in the repo for future eligibility snapshots.
- **filtering**: server-side eligibility (published + media-ready + released + age-verification
  gate) happens BEFORE content reaches the client. Client-side filtering (format/genre/query) is
  a view filter, not eligibility.
- **ranked candidates**: N/A — no ranking step exists.
- **served candidates**: the exact array the client receives. Reconstructible only by re-calling
  the endpoint with the same DB state.

### Historical decision-time eligibility
**Only current state is knowable.** `home_row_items` has `created_at`/`updated_at` but no
`effective_at`/`valid_from`/`valid_to`. If a series was unpublished after being served in a
Home row, there is no record of what its eligibility was at serve time. The same applies to
`published_at`, `sort_order`, and `media_assets.status`.

### Future needs (NOT implemented, do not implement yet)
- `candidate_set_id` — MISSING
- `candidate_set_version` — MISSING
- `eligibility_snapshot_ref` — MISSING

The eligibility *rules* are ready (`catalog-rules.ts` is pure and unit-tested). The eligibility
*snapshots* are not. Do not snapshot until there is a decision engine that emits them.

## 16. ELIGIBILITY / FILTERS

Sources: `src/lib/catalog-rules.ts`, `src/lib/catalog.ts`, `src/lib/entitlements.ts`,
`src/lib/playback.ts`, `src/lib/classification.ts`, `apps/android/src/lib/parentalControls.ts`.

| Check | Where it happens | Before/after ranking | At playback auth |
|---|---|---|---|
| unpublished content | `series.status="published"` / `short_films.status="published"` | **before** (catalog.ts:294, 398; home.ts:288, 311) | also at playback (playback.ts:164, 457) |
| media unavailable | `isMediaAssetReady` = status=ready AND provider_playback_reference present | **before** (catalog.ts:95, getReadyMediaAssetIds; new-releases.ts:153) | also at playback (playback.ts:306-314, 516-523) |
| age restrictions | `content_rating === "A"` → `ageVerificationRequired` | **before** (catalog.ts:188 filters out age-verified episodes; short film `playbackReady` excludes them) | also at playback (playback.ts:188, 467) |
| parental restrictions | `parentalLockRequired` for U/A 13+ and above | **before** (catalog exposes the flag; does not block) | **at playback** (playback.ts:192-213, 471-493) — requires parentalSessionToken |
| region restrictions | **MISSING** | — | — |
| entitlements (coin/rewarded) | `episode_entitlements` | NOT at catalog | **at playback** (`canUserWatchEpisode`, playback.ts:275) |
| subscription (Plus) | `subscriptions.status="active"` | NOT at catalog | **at playback** (entitlements.ts:245) |
| coin access | `wallets.coin_balance` vs `episode.coin_price` | NOT at catalog | **at purchase** (`purchase_episode_with_coins` RPC), not at catalog |
| rewarded access | `rewarded_ad_attempts` + `required_rewarded_completions` | NOT at catalog | **at playback** (entitlements via episode_entitlements after SSV) |
| editorial block | `home_rows.enabled`, `home_row_items` membership | **before** (home.ts:130, 326) | — |
| invalid state | `isReleased(publish_at)`, `duration_seconds <= 0` | **before** (catalog-rules.ts:27; catalog.ts:316) | also at playback (playback.ts:316, 526) |

### Ordering invariant (must be preserved)
Eligibility (published + media-ready + released + age-gate) runs **before** content reaches any
ranking or client. Parental gate and entitlement checks run **at playback authorization**,
not before. This two-phase split is correct and must not be collapsed: the catalog must never
be filtered by the viewer entitlements, because entitlements are per-user and the catalog is
shared. Do not make catalog filtering entitlement-aware.

### DO NOT DUPLICATE
- `catalog-rules.ts` is the single source for consumer-visibility predicates. It is pure and
  unit-tested (`catalog-visibility.test.ts`). Do not re-implement these rules in a ranking layer.
- `entitlements.ts` is the single source for access decisions. Do not move entitlement logic into
  a ranking/eligibility module.

## 17. EDITORIAL PROVENANCE AUDIT

### Can the current CMS/backend tell us...
| Question | Answer | Evidence |
|---|---|---|
| who/what changed editorial order | **NO** | No `updated_by`, no actor column, no audit table on `home_rows` / `home_row_items` / `home_settings` / `home_new_releases_exclusions`. Writes are gated by `requireCmsAdmin` (cms/auth.ts) but the actor is not persisted. |
| when | PARTIAL | `updated_at` timestamp exists on `home_rows` and `home_row_items` (DB default `now()`). It records the last write, not a change event. |
| old order | **NO** | No before/after image. `moveHomeRowItem` swaps two `sort_order` values in place; the previous state is not stored. |
| new order | YES | the current `sort_order` values are the new order. |
| pin/boost/remove/order semantics | PARTIAL | remove EXISTS; order EXISTS (sort_order + swap); pin is implicit (low sort_order); boost MISSING. |
| config version | **NO** | no version column, no version table. |
| audit record | **NO** | no audit log table, no change-event stream. |

### Mapping future concepts onto existing CMS behavior
- `EDITORIAL_PIN` → PARTIAL. A pinned item is one with a deliberately low `sort_order` within its
  row. There is no explicit pin flag, so "was this ever pinned" is not reconstructible.
- `EDITORIAL_BOOST` → MISSING. No numeric boost/score/priority field exists on any editorial table.
- `EDITORIAL_REMOVE` → EXISTS. `removeHomeRowItem`, `removeSpotlightItem`, `deleteHomeEditorialRow`.
- `EDITORIAL_ORDER` → EXISTS. `sort_order` + `moveHomeRow`/`moveHomeRowItem`/`moveSpotlightItem`.

### Verdict
Editorial provenance is **MISSING for actor and old-value**, partial for timestamp. Any future
contract requiring "who changed editorial order, when, from what, to what" cannot be satisfied
by the current schema. This is a schema addition (audit columns/tables), not a behavioral change.

## 18. VERSION / EXPERIMENT / PROPENSITY AUDIT

### Ranking policy versioning
| Concept | Exists? | Evidence |
|---|---|---|
| ranking_policy | **MISSING** | no string/enum constant, no column, no config row |
| ranking_policy_version | **MISSING** | — |
| config_version | **MISSING** | `home_settings` has no version; `home_rows` has no version |
| config_hash | **MISSING** | — |
| ranking_engine_version | **MISSING** | — |

The only version-like constants in the repo are:
- `MONETIZATION_EVENT_SCHEMA_VERSION = "0.2"` (`monetization/events.ts:26`) — monetization only,
  not ranking.
- `RECENT_SEARCHES_KEY = "0nya.recent-searches.v1"` (`recentSearches.ts:3`) — storage schema tag.
- Roadmap/doc version strings (`APP_COMPLETION_ROADMAP.md` v1.9, contract docs v1.0/v3.0) —
  documentation, not runtime config.

### Experiment infrastructure
| Capability | Exists? | Evidence |
|---|---|---|
| feature flags | **MISSING** | `0nya_APP_ARCHITECTURE_v1.0.md:427` "No global feature-flag store"; `:927` "no feature-flag infrastructure found in repo"; `:1142` "no analytics code, no feature flags, no backend config endpoint" |
| experiments | **MISSING** | — |
| A/B assignments | **MISSING** | — |
| remote config | **MISSING** | `home_settings` (one key) is the only config table and it is not remote-fetchable by the Android client |
| rollout cohorts | **MISSING** | — |
| variant IDs | **MISSING** | — |

The Android client has no config endpoint. `getCatalog()` is the only data fetch and it carries
no config. `getPlayTogetherConfig()` (`api.ts:763`) is PX01-specific and read-only.

### Propensity readiness
- **Is any current ranking logic randomized?** NO. Every ordering in the repo is deterministic:
  `sort_order` ASC, `published_at` ASC/DESC, `title` localeCompare, `slice(n, m)`. There are no
  `Math.random()`, no sampling, no weighted selection, no probability fields anywhere in `src`
  or `apps/android/src`.
- **Can future randomized policy decisions record/reconstruct meaningful selection probability
  without major schema replacement?** NO — there is no decision-id, no candidate-set-id, no
  policy-version, and no probability field. Introducing propensity would require the full
  decision-identity schema from scratch. This is a NEW schema, not a modification.

## 19. APP ↔ AUTONOMOUS SEPARATION AUDIT

### Expected result: separation. Verified CLEAN.

| Check | Result | Evidence |
|---|---|---|
| Autonomous imports in App | **NONE** | No `src` or `apps/android/src` file imports from any autonomous package/path |
| Autonomous internal code copied into App | **NONE** | No autonomous code present in App source |
| direct access to Autonomous memory/state | **NONE** | — |
| ranking actions mapped into Seed actions | **NONE** | No Seed/autonomous action mapping exists |
| shared runtime state | **NONE** | — |
| direct cross-repository dependency | **NONE** | `package.json` has no autonomous dependency; no workspace reference |

### The `0nya_autonomous/` directory inside the App repo
`C:\Users\Akash\Documents\0nyapp\0nya_autonomous/` exists but contains **only an empty
`constitution/` directory** (1 entry, 0 files). It is:
- NOT git-tracked (`git ls-files 0nya_autonomous` returns nothing).
- NOT in `.gitignore` and NOT in `.gcloudignore`.
- A leftover empty stub, not the real Autonomous repository.

The real Autonomous repository is at `C:\Users\Akash\Documents\0nya-autonomous/` (separate,
populated: `constitution/`, `core/`, `docs/`, `runtime/`, `simulation/`, `tests/`,
`0NYA_AUTONOMOUS_SEED_FREEZE_FINAL_v1.0.md`, etc.). The two are physically separate and
share no code.

### Boundary discipline already present
- `docs/agent-state/APP_COMPLETION_ROADMAP.md:47-49`: "Normal App work must not use
  `0nya_autonomous/**` as product, UI, backend, CMS, playback, monetization, or release authority."
- `docs/CMS_COMPLETION_ROADMAP.md:26`: same prohibition for CMS.
- `docs/agent-state/SYSTEM_MAP.md:36`: "0nya_autonomous/ is a separate autonomous-governance simulation."
- `src/lib/monetization/index.ts:8`: "no 0nya runtime / adapter is connected."

### Verdict
**SEPARATION CONFIRMED.** No remediation needed. The empty `0nya_autonomous/constitution/`
stub should eventually be removed from the App repo to avoid confusion, but it contains no
code and is untracked, so it is not a violation.

## 19. CONTRACT GAP MATRIX

| Item | Status | Evidence |
|---|---|---|
| ranking_decision_id | **MISSING** | No field, no table, no constant anywhere |
| actor_id | **PARTIAL** | `supabase.auth.user.id` exists and is the FK on all behavioral tables, but is not surfaced in any ranking/event DTO |
| session_id | **MISSING** | No session-id concept; `authContext.tsx` exposes only `session.user.id` |
| ranking_policy | **MISSING** | No policy enum/string/column |
| ranking_policy_version | **MISSING** | — |
| config_version | **MISSING** | `home_settings` has no version |
| config_hash | **MISSING** | — |
| ranking_engine_version | **MISSING** | — |
| candidate_set_id | **MISSING** | — |
| candidate_set_version | **MISSING** | — |
| eligibility snapshot/reconstruction | **PARTIAL** | Rules are pure and testable (`catalog-rules.ts`); historical snapshots are impossible (no effective_at/valid_from on any table) |
| content_served | **PARTIAL** | Observable via `/api/v1/catalog` response, but no response-level id/timestamp/policy-version |
| content_impression | **MISSING** | No impression event, no producer, no sink |
| source_surface | **PARTIAL** | `perfMark` `source` field exists (HOME/EXPLORE/SEARCH_RESULTS/...) but is dev-only console, not persisted |
| row_id | **EXISTS** | `home_rows.id` |
| position | **MISSING** | No position recorded for any card render or tap |
| recommendation_reason | **MISSING** | No reason/relevance field anywhere |
| autonomous_decision_reason namespace | **NOT APPLICABLE YET** | No Autonomous integration exists |
| negative events | **MISSING** | No hide/skip/quick_back/abandon event |
| delayed attribution | **MISSING** | No attribution model; search result opens cannot be attributed to a position |
| editorial intervention provenance | **MISSING** | No audit columns/tables (see §17) |
| experiment identity | **MISSING** | No experiment/variant infrastructure (see §18) |
| propensity readiness | **MISSING** | No randomness, no probability field (see §18) |
| RankingEventAdapter | **MISSING** | No adapter; no event sink |
| RankingOutcomeAdapter | **MISSING** | No adapter; no outcome envelope |
| FutureRankingActionAdapter | **MISSING** | No adapter; no action envelope |
| MonetizationEvent (reference) | **EXISTS (design only)** | `src/lib/monetization/events.ts` — types + validation, no producer, no route, no DB |

## 20. DO NOT DUPLICATE LIST

These must never be duplicated by a future ranking/discovery layer:

1. `home_rows` / `home_row_items` / `home_settings` / `home_new_releases_exclusions` schema —
   the single CMS editorial source. Do not create `ranking_rows` or `recommendation_items`.
2. `home_rows.sort_order` and `home_row_items.sort_order` — the canonical editorial order.
3. `series.sort_order` — the canonical catalog order used by "Micro Dramas" category row.
4. `watch_progress` — single watch-state source. Do not create `watch_events` or
   `playback_events` that duplicate it.
5. `media_assets.status` + `provider_playback_reference` — single media-readiness source
   (`catalog-rules.ts::isMediaAssetReady`). Do not re-derive readiness in a ranking module.
6. `catalog-rules.ts` predicates (`isReleased`, `isShortFilmConsumerVisible`,
   `isSeriesConsumerVisible`, `resolveShortFilmPlaybackReady`) — single eligibility source.
7. `entitlements.ts` — single access-decision source. Ranking must never make entitlement calls.
8. `classification.ts` (`CONTENT_RATINGS`, `CONTENT_DESCRIPTORS`, `resolveContentClassification`)
   — single taxonomy source.
9. `monetization/events.ts` (`MonetizationEvent`, `MONETIZATION_EVENT_SCHEMA_VERSION`) —
   monetization event vocabulary. Ranking events are a SEPARATE branch and must not be
   merged into MonetizationEvent.
10. `rewarded_monetization_events` / `rewarded-analytics.ts` — rewarded analytics vocabulary.
11. `recentSearches.ts` (`0nya.recent-searches.v1`) — single client search-history store.
12. `series.featured` boolean — single "featured" editorial flag. Do not add a second
    featured/spotlight flag.
13. `perf.ts` perf tokens — dev-only, must not be repurposed as ranking/decision identity.
14. The two category rows "Micro Dramas" and "Short Films" — their auto-population logic is
    the consumer contract; do not replace it with a ranking row of the same name.
15. `CONTINUE_WATCHING_MIN_SECONDS = 5` (`HomeScreen.tsx:50`) — single product-default constant;
    do not scatter the threshold.

## 21. SAFE IMPLEMENTATION RECOMMENDATION

### Precondition (blocking)
1. **Produce `0NYA_RANKING_DOMAIN_CONTRACT_v1.0.md`.** It does not exist. No RANK-01 work can
   begin until the contract is written and placed in the repo. The audit above records what
   the real system can and cannot support; the contract must be reconciled against it.

### Ordering for any future ranking work
1. Do not touch Home, Explore, Search, or CMS behavior in RANK-01..RANK-07. These are
   VERIFIED COMPLETE / LOCKED BASELINE for product behavior. Ranking is additive only.
2. Introduce new tables/columns with explicit names that cannot collide:
   `ranking_decisions`, `candidate_sets`, `eligibility_snapshots`, `ranking_events`,
   `ranking_outcomes`. Never `ALTER` `home_rows`/`home_row_items`/`watch_progress` for ranking
   purposes.
3. Put the ranking engine server-side only (`src/lib/ranking/`, `server-only`). The Android
   client must consume, never compute, ranking.
4. Reuse, do not reimplement: `catalog-rules.ts` for eligibility, `entitlements.ts` for access,
   `classification.ts` for taxonomy, `supabase.auth.user.id` for actor_id.
5. Keep the two-phase split: eligibility (published + media-ready + released + age-gate)
   BEFORE ranking; entitlement/parental gates AT playback authorization. Never filter the
   shared catalog by per-user entitlements.
6. Every new ranking write must be append-only and immutable (ADR-004 pattern in the
   Autonomous repo: decision logs are immutable). No UPDATE on a decision row.
7. No secrets, tokens, PII, or signed-URL material in any ranking/event table (mirror the
   `PROHIBITED_KEY_SUBSTRINGS` list in `rewarded-analytics.ts`).

### Highest-value, lowest-risk first step
Add a **read-only observation seam** — a `ranking_events` table + a server-side emitter that
records, per served surface: `ranking_decision_id`, `surface`, `row_id`, `content_id`,
`position`, `served_at`, `policy_name`, `policy_version`. No client changes, no behavior
change, zero risk to VERIFIED COMPLETE surfaces. This unlocks RANK-05B and the Autonomous
observation adapter without touching Home/Explore/Search.

## 22. PROPOSED RANK-01 THROUGH RANK-07 CHANGES

These are proposals only. NONE has been implemented. Nothing in this section modifies any
existing file.

### RANK-01 — Ranking decision identity (additive, no behavior change)
- New table `ranking_decisions` (id UUID PK, surface, row_id, policy_name, policy_version,
  config_hash, candidate_set_id, created_at). Emitted server-side at every Home/Explore/Search
  serve. Immutable: insert-only, no UPDATE.
- New table `candidate_sets` (id UUID PK, surface, version, eligibility_snapshot_ref,
  generated_at).
- New table `eligibility_snapshots` (id UUID PK, candidate_set_id, content_id, eligible bool,
  reasons jsonb, snapshot_at).
- Reuse `catalog-rules.ts` as the eligibility function; snapshot its output per decision.

### RANK-02 — Behavioral event schema (additive)
- New `ranking_events` table: event_id, ranking_decision_id, actor_id, session_id, surface,
  row_id, content_id, position, event_type (served/impression/open/play_start/qualified_watch/
  completion/abandon/share/hide/skip/quick_back/session_exit/search/search_result_open),
  occurred_at, metadata jsonb.
- New `src/lib/ranking/events.ts` (types only, mirroring `monetization/events.ts` discipline).
- No client changes. Events emitted by the server at serve time and by existing client
  `CONTENT_TAP` perfMarks upgraded to real events.

### RANK-03 — Candidate set + eligibility reconstruction
- Each `ranking_decisions` row points to a `candidate_sets` row, which points to an
  `eligibility_snapshots` row capturing the exact eligible set at decision time.
- This makes historical reconstruction possible: given a `ranking_decision_id`, walk
  decision → candidate_set → eligibility_snapshot → served items.

### RANK-04 — Editorial provenance (additive to CMS)
- Add `updated_by` (cms_admin user_id) and `change_note` to `home_rows` / `home_row_items`.
- Add a `home_row_item_audit` append-only log capturing old/new `sort_order` on every move.
- Maps future EDITORIAL_PIN / EDITORIAL_BOOST / EDITORIAL_REMOVE / EDITORIAL_ORDER semantics.
- Does not change existing behavior; only records it.

### RANK-05 — Ranking policy versioning
- Add `ranking_policies` table (name, version, engine_version, config_hash, enabled, valid_from).
- Every `ranking_decisions.policy_name` + `policy_version` references a row here.
- Reuse `home_settings` as the config store; add keys as needed (never hardcode).

### RANK-05B — RankingEventAdapter / RankingOutcomeAdapter (Autonomous observation seam)
- New `src/lib/ranking/adapters/` with:
  - `RankingEventAdapter` — converts `ranking_events` rows into the Autonomous OUTCOME_ENVELOPE /
    CANONICAL_EVENT shapes read-only (no writes to Autonomous).
  - `RankingOutcomeAdapter` — converts Autonomous outcome envelopes into no-op verification
    records in the App (Autonomous is never authoritative for App ranking).
  - `FutureRankingActionAdapter` — a sealed, disabled-by-default seam that would translate a
    future Autonomous ranking action into an App-side observation. NOT activated.
- All adapters are read-only, fail-closed, and emit nothing to Autonomous.

### RANK-06 — Experiment infrastructure (additive, disabled by default)
- New `experiments` table (id, name, key, variants jsonb, status, rollout_cohort, started_at,
  ended_at).
- New `experiment_assignments` table (experiment_id, actor_id, variant, assigned_at).
- No existing behavior is randomized. All current ordering remains deterministic.
- Propensity fields (`selection_probability`) added to `ranking_decisions` for future use only.

### RANK-07 — Propensity readiness
- Add `selection_probability` (numeric, nullable) to `ranking_decisions`.
- When a future randomized policy runs, it records the exact probability used for each served
  candidate, enabling reconstruction of propensity without re-running the policy.
- All current policies remain deterministic; this field is NULL everywhere until a randomized
  policy exists.

### What RANK-01..RANK-07 must NOT do
- Not modify `home_rows`, `home_row_items`, `watch_progress`, `catalog-rules.ts`,
  `entitlements.ts`, `classification.ts`, or `monetization/events.ts` behavior.
- Not change Home, Explore, Search, or CMS rendering or ordering.
- Not touch the Autonomous repository.
- Not add paid dependencies.
- Not expose service_role or secrets.

## 23. BLOCKERS / QUESTIONS FOR PRODUCT OWNER

### BLOCKER 1 (blocking all further work)
**`0NYA_RANKING_DOMAIN_CONTRACT_v1.0.md` does not exist.** It is absent from both the
Consumer App repo and the Autonomous repo, and absent from the whole `Documents` tree. This
audit could not be run against the governing contract. Produce the contract before RANK-01.

### BLOCKER 2
**Home "Trending" is a mislabeled positional slice.** `src/components/home/HomePage.tsx:24`
`trendingItems = catalogSeries.slice(1, 7)`. It has no Android counterpart and no ranking
signal. Decide: remove it, or define what "Trending" means before any contract references it.

### BLOCKER 3
**`FeaturedHero.tsx` is legacy web-only and still in source** although the Product Bible
superseded the Featured Hero model with Multi-Spotlight in B00. Decide: retire it or mark it
explicitly non-authoritative.

### BLOCKER 4
**`src/data/content.ts` mock data overrides DB fields** for seeded slugs (`genre`, `synopsis`,
`poster`, `isFree`, `isLocked`, `progress`, `currentEpisode` in `catalog.ts:180-210`). This is a
data-integrity hazard that could silently surface wrong taxonomy/genre in a ranking context.
Decide: cap the mock fallback or remove it.

### BLOCKER 5
**No session_id, no pseudonymous guest analytics ID, no device/install ID.** The Ranking
Domain Contract presumably needs `session_id` and a stable guest identity. Decide whether to
introduce a new session-id/guest-id schema (must NOT duplicate `supabase.auth`).

### BLOCKER 6
**Most Watched is not implementable now** (MOST_WATCHED_NOT_READY). No view-count, no
watch-time aggregate. Decide whether to add an aggregate column/view before any "Most Watched"
policy is attempted.

### BLOCKER 7
**No CMS audit provenance.** There is no record of who changed editorial order or what the old
value was. Decide whether editorial-provenance auditing (RANK-04) is in scope for the current
batch.

### QUESTIONS
1. Is "Micro Drama" a content type, a format value, or a client label? (Currently it is a
   client label over `series.format`.)
2. Should the two category rows ("Micro Dramas", "Short Films") ever become rankable, or are
   they permanently fixed catalog order?
3. Should Search become server-side, or remain client-side substring?
4. Is a pseudonymous guest identity required for ranking attribution, or is guest attribution
   deferred?
5. Should the web `HomePage.tsx` (legacy web shell) be aligned with the Android Home, or is
   it out of scope for ranking work?

## 24. FINAL VERDICT

RANK-00: PARTIAL

The audit confirms the Consumer App has a mature, server-authoritative editorial discovery
surface (Home Composer, CMS rows/items with drag-reorder, category rows, hybrid New Releases,
catalog, Explore/Search faceting, Continue Watching, entitlement + playback authorization).
CMS order is canonical and Android never reranks it. The eligibility rules are pure,
testable, and single-source. The App ↔ Autonomous boundary is verified clean.

The audit also confirms the App has NO behavioral ranking engine, NO ranking decision
identity, NO candidate-set/eligibility-snapshot reconstruction, NO experiment/propensity
infrastructure, NO behavioral event sink, and NO CMS editorial audit provenance. Most Watched
is not implementable with current data.

The single blocking defect is that the governing document `0NYA_RANKING_DOMAIN_CONTRACT_v1.0.md`
does not exist in either repository, so the audit was executed against repository truth rather
than against the contract.

READY FOR RANK-01: NO
READY FOR RANK-05B: NO
READY FOR AUTONOMOUS OBSERVATION ADAPTER: NO
READY FOR LIVE AUTONOMOUS RANKING: NO
CONSTITUTION CHANGE REQUIRED: NO

