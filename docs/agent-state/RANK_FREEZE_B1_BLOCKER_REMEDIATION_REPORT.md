# RANK-FREEZE-B1 — Freeze Blocker Remediation Report

Date: 2026-09-05

## Scope and safety

Fixed only the four blockers named by `RANKING_FOUNDATION_FREEZE_REPORT.md`. No feature, ranking algorithm, migration application, deployment, Git staging/history operation, or Autonomous change was made.

Consumer repository: `C:\Users\Akash\Documents\0nyapp`, branch `qa/netlify-api-e34ab5e`, HEAD `ac9e11676c3434cb16b4f33adc4208e1c7c4f1e5`. The pre-existing dirty worktree was preserved.

## 1. Privacy

Result: `PASS`.

`src/lib/ranking/behavior-events.ts` now enforces exact per-event metadata keys:

| Event | Allowed metadata |
| --- | --- |
| `content_served` | none |
| `content_impression` | `visibility_fraction`, `visible_duration_ms` |
| `content_open` | none |
| `play_start` | none |
| `qualified_watch` | `definition`, optional `watched_seconds` |
| `play_complete` | optional `completion_source` |
| `play_abandon` | `reason` |

Existing type/range/fixed-value validation remains in force. Because no arbitrary string-valued field survives these allowlists, raw phone, email, token, or secret values cannot be persisted under harmless or nested keys. Unknown and nested metadata is rejected before the API insert.

Adversarial tests cover phone/email values under innocuous keys, deeply nested token/secret payloads, extra impression fields, and nested qualified-watch payloads. A direct probe confirmed all previously accepted examples now return `ok: false`.

## 2. Pseudo-Trending

Result: `RESOLVED`.

Removed `trendingItems = catalogSeries.slice(1, 7)` and its rendered `Trending` ContentRow from `src/components/home/HomePage.tsx`. No replacement algorithm, score, or invented Trending source was added. The remaining Android `Trending Now` string is an empty-catalog placeholder heading only; it is not backed by a candidate list or ranking output.

## 3. Home replay

Result: `PASS`.

The Home replay fixture now contains this chronological chain with one decision/session/content relationship:

`RANKING_DECISION → CONTENT_SERVED → CONTENT_IMPRESSION → CONTENT_OPEN → PLAY_START → QUALIFIED_WATCH → PLAY_COMPLETE`

The added qualified-watch event uses `continuous_playback_30s_v1`, `watched_seconds=30`, occurs after play start and before completion, retains the Home decision ID, and maps through `ranking_observation_v1` to the exact four-field Autonomous-compatible CanonicalEvent shape. The explicit replay test verifies event order, decision linkage, observation mapping, and CanonicalEvent projection at every stage.

## 4. RANK-01 through RANK-05C foundational inventory

Classification vocabulary:

- `REQUIRED`: source needed for the candidate ranking baseline.
- `REPORT`: milestone/audit documentation, not executable authority.
- `MIGRATION`: prepared database source; unapplied.
- `TEMP`: development/QA artifacts not part of the ranking foundation.
- `UNRELATED`: shared or neighboring work not owned by this freeze baseline.

### Required canonical/source files

| Area | Files | Git state/classification |
| --- | --- | --- |
| contract | `docs/0NYA_RANKING_DOMAIN_CONTRACT_v1.0.md` | untracked / REQUIRED |
| taxonomy | `src/lib/taxonomy.ts`, `src/lib/taxonomy.test.ts`, `apps/android/src/lib/taxonomy.ts` | untracked / REQUIRED |
| catalog eligibility/API compatibility | `src/lib/catalog-rules.ts`, `src/lib/catalog-visibility.test.ts`, `src/lib/catalog.ts`, `src/lib/api/serializers.ts`, `src/data/content.ts`, `apps/android/src/types/api.ts` | mixed tracked-modified and untracked / REQUIRED |
| CMS taxonomy consumption | `src/components/cms/NewSeriesIntakeForm.tsx`, `src/components/cms/SeriesMetadataForm.tsx` | tracked-modified / REQUIRED shared integration |
| editorial provenance | `src/lib/ranking/editorial-provenance.ts`, `src/lib/ranking/editorial-provenance.test.ts`, `src/lib/new-releases.ts`, `src/lib/new-releases.test.ts`, `src/lib/home.ts`, `src/lib/cms/home.ts`, `src/app/admin/home/page.tsx`, `src/app/api/v1/catalog/route.ts` | mixed / REQUIRED |
| Explore | `apps/android/src/lib/discovery.ts`, `apps/android/src/lib/useDiscoveryCatalog.ts`, `apps/android/src/screens/ExploreScreen.tsx`, `src/lib/ranking/explore-discovery.test.ts` | mixed / REQUIRED |
| Search | `apps/android/src/lib/search.ts`, `apps/android/src/lib/recentSearchModel.ts`, `apps/android/src/lib/recentSearches.ts`, `apps/android/src/screens/SearchResultsScreen.tsx`, `apps/android/src/navigation/types.ts`, `apps/android/src/navigation/routeSerialization.ts`, `apps/android/src/navigation/routeSerialization.test.ts`, `apps/android/src/screens/SeriesScreen.tsx`, `apps/android/src/screens/SeriesEpisodesScreen.tsx`, `apps/android/src/screens/ShortFilmDetailScreen.tsx`, `src/lib/ranking/search-metadata.test.ts` | mixed / REQUIRED |
| behavior model/API | `src/lib/ranking/behavior-events.ts`, `src/lib/ranking/behavior-events.test.ts`, `src/lib/ranking/behavior-evidence-completion.test.ts`, `src/app/api/v1/ranking/events/route.ts`, `apps/android/src/lib/behavioralEvents.ts`, `apps/android/src/lib/behaviorContext.ts`, `apps/android/src/lib/evidenceIdentity.ts`, `apps/android/src/lib/api.ts`, `src/types/database.ts` | mixed / REQUIRED |
| viewport impressions | `apps/android/src/components/BehaviorImpression.tsx`, `apps/android/src/lib/behaviorImpressionModel.ts`, `apps/android/src/components/Screen.tsx`, `apps/android/src/screens/HomeScreen.tsx` | mixed / REQUIRED |
| playback evidence continuity | `apps/android/src/player/PlayerScreen.tsx`, `apps/android/src/screens/WatchScreen.tsx`, `apps/android/src/screens/ShortFilmPlaybackScreen.tsx` | tracked-modified / REQUIRED shared integration |
| decision/candidate evidence | `src/lib/ranking/decision-evidence.ts`, `src/lib/ranking/decision-evidence.test.ts`, `src/app/api/v1/ranking/decisions/route.ts`, `apps/android/src/lib/rankingDecisionEvidence.ts` | untracked / REQUIRED |
| observation adapter/replay | `src/lib/ranking/observation-adapter.ts`, `src/lib/ranking/observation-adapter.fixtures.ts`, `src/lib/ranking/observation-adapter.test.ts`, `src/lib/ranking/privacy.ts` | untracked / REQUIRED |
| test registration | `package.json` | tracked-modified / REQUIRED shared integration |
| web conflict remediation | `src/components/home/HomePage.tsx` | tracked-modified / REQUIRED blocker remediation |

### Reports

All are untracked and classified `REPORT`:

- `docs/agent-state/RANK-00_AUDIT.md`
- `docs/agent-state/RANK-00A_RECONCILIATION.md`
- `docs/agent-state/RANK-01_REPORT.md`
- `docs/agent-state/RANK-02_REPORT.md`
- `docs/agent-state/RANK-03_REPORT.md`
- `docs/agent-state/RANK-04_REPORT.md`
- `docs/agent-state/RANK-05_REPORT.md`
- `docs/agent-state/RANK-05A_REPORT.md`
- `docs/agent-state/RANK-05B_REPORT.md`
- `docs/agent-state/RANK-05C_REPORT.md`
- `docs/agent-state/RANKING_DOMAIN_CONTRACT.md` (pointer only)
- `docs/agent-state/RANKING_FOUNDATION_FREEZE_REPORT.md`
- `docs/agent-state/RANK_FREEZE_B1_BLOCKER_REMEDIATION_REPORT.md`

### Prepared migrations

All are untracked, unapplied, runtime-unverified, and classified `MIGRATION`:

- `supabase/migrations/20260905030000_034_home_editorial_ranking_provenance.sql`
- `supabase/migrations/20260905040000_035_ranking_behavior_events.sql`
- `supabase/migrations/20260905162706_ranking_decision_evidence.sql`

Migrations 029–033 are neighboring pending product/schema work. They may be dependencies in a future authorized migration workflow, but they are not newly owned by RANK-FREEZE-B1 and are classified `UNRELATED/DEPENDENCY_REVIEW_REQUIRED`, not part of this remediation change.

### Temporary and unrelated worktree content

`.temp/`, `.playwright-mcp/`, `ui-audit/`, `workspace_verify/`, and `docs/agent-state/screen-captures/` are `TEMP` for baseline recording unless a separate evidence-retention decision includes them. `.continue/`, `.obsidian/`, unrelated CMS/media/Play Together/playback changes, root helper scripts, and other application work shown by `git status` are `UNRELATED` to RANK-01–05C. None should be bulk-staged with the ranking baseline.

### Readiness separation

- `SOURCE_READY`: YES. The four identified source blockers are remediated and requested static verification passes.
- `BASELINE_RECORDING_READY`: AUTHORIZATION REQUIRED. Required source, reports, and migrations are still a mixture of tracked modifications and untracked files in a heavily dirty worktree. This report inventories them, but selecting/staging/committing the baseline is a separate user-authorized Git operation.
- `FOUNDATIONAL FILES TRACKED`: AUTH_REQUIRED. No `git add` or commit was performed.

## Verification

| Check | Result |
| --- | --- |
| focused privacy/behavior/adapter tests | PASS — 29/29 |
| package full behavior/decision/adapter suite (`npm run test:ranking-behavior`) | PASS — 54/54 |
| full ranking-domain suite (taxonomy, editorial, Explore, Search, behavior, decision, adapter, New Releases) | PASS — 98/98 |
| root typecheck | PASS |
| Android typecheck | PASS |
| relevant `git diff --check` | PASS; existing line-ending warning only |
| pseudo-Trending source search | removed positional slice and rendered web Trending row |
| adversarial privacy probe | PASS — all tested payloads rejected |

No emulator/device, deployment, migration, or runtime persistence verification was requested or claimed.

## Files changed by RANK-FREEZE-B1

- `src/lib/ranking/behavior-events.ts`
- `src/lib/ranking/behavior-events.test.ts`
- `src/lib/ranking/observation-adapter.fixtures.ts`
- `src/lib/ranking/observation-adapter.test.ts`
- `src/components/home/HomePage.tsx`
- `docs/agent-state/RANK_FREEZE_B1_BLOCKER_REMEDIATION_REPORT.md`

## Final gates

PRIVACY: PASS

PSEUDO-TRENDING: RESOLVED

HOME REPLAY: PASS

SOURCE ARCHITECTURE COHERENT: YES

FOUNDATIONAL INVENTORY COMPLETE: YES

FOUNDATIONAL FILES TRACKED: AUTH_REQUIRED

SOURCE FREEZE READY: YES

READY TO RE-RUN FREEZE: YES

AUTONOMOUS MODIFIED: NO

CONSTITUTION CHANGE REQUIRED: NO

Remaining blockers: none at source architecture level. Baseline recording, migration/runtime verification, and device acceptance remain separately authorized future work and must not be represented as completed.
