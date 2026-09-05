# RANK-01 Report

Date: 2026-09-05

## Executive Verdict

RANK-01: PARTIAL

The Consumer App now has a shared canonical taxonomy module with stable machine-readable genre IDs, API-level primary/secondary genre output, canonical content-format IDs for Micro Drama and Short Film, Android consumption of canonical genre fields, CMS series validation against the shared taxonomy vocabulary, and regression coverage for the mock fallback authority bug.

The remaining partial area is database persistence: no remote migration was run, and the existing schema still stores series genre in the legacy `series.genre` text column. Short films still have no database genre column. This was kept intentionally migration-free for this narrow, dirty-worktree milestone.

## Safety / Worktree State

- cwd: `C:\Users\Akash\Documents\0nyapp`
- branch: `qa/netlify-api-e34ab5e`
- HEAD: `ac9e11676c3434cb16b4f33adc4208e1c7c4f1e5`
- Worktree was heavily dirty before RANK-01. Unrelated changes were preserved.
- High-collision files included `src/lib/catalog.ts`, `src/data/content.ts`, `src/lib/api/serializers.ts`, Android Explore/Search/API types, CMS series forms, and untracked catalog/new-release tests.

## Authority Reviewed

- `AGENTS.md`
- `docs/agent-state/APP_COMPLETION_ROADMAP.md`
- `docs/0NYA_RANKING_DOMAIN_CONTRACT_v1.0.md`
- `docs/agent-state/RANK-00_AUDIT.md`
- `docs/agent-state/RANK-00A_RECONCILIATION.md`
- Current content schema and migrations
- Current catalog/API serializers
- Android API models and Explore/Search handling
- CMS series validation and forms
- `src/data/content.ts`

## Implementation Summary

Canonical genre model:

- `romance` -> `Romance`
- `drama` -> `Drama`
- `comedy` -> `Comedy`
- `thriller` -> `Thriller`
- `mystery` -> `Mystery`
- `family` -> `Family`

Primary/secondary semantics:

- `normalizeGenreAssignments()` maps existing legacy DB strings and aliases into one primary genre plus zero or more secondary genres.
- Duplicate genre assignments are removed.
- Primary genre is not repeated in secondary genres.
- Unknown/free-form display labels are ignored and do not become canonical identities.

Format normalization:

- Series catalog items expose `contentType: "MICRO_DRAMA"`.
- Short-film catalog items expose `contentType: "SHORT_FILM"`.
- `Micro Drama` and `Short Film` are not accepted as genres.

Mock fallback fix:

- `src/lib/catalog.ts` no longer uses `src/data/content.ts` fallback genre values when DB/CMS genre is null.
- DB/CMS genre values are normalized into canonical API taxonomy fields.
- Fallback remains available for non-taxonomy development/demo fields such as accent/artwork where current code already used it.

## Regression Verification

Verified unchanged by scope and tests:

- Home order logic was not edited.
- Explore order logic was not changed; only genre matching source changed.
- Search ranking/order logic was not changed; only genre matching source changed.
- New Releases tests still pass.
- Catalog eligibility tests still pass.
- Android typecheck passes.
- Autonomous repository was not touched.

## Test Results

Passed:

```text
npm test
224 tests total; 207 passed; 17 skipped; 0 failed
```

Passed:

```text
npm exec -- tsx --test src/lib/taxonomy.test.ts src/lib/catalog-visibility.test.ts src/lib/new-releases.test.ts
60 tests passed
```

Passed:

```text
cd apps/android
npm run typecheck
```

Blocked by unrelated existing error:

```text
npm run typecheck
src/components/cms/MediaAdminClient.tsx(383,11): Property 'scanAction' does not exist on type ...
```

## Remaining Gaps

- Legacy database storage remains `series.genre text`; no production migration was run.
- Short films do not yet have persisted genre fields in the current schema.
- CMS series authoring supports a controlled primary genre in normal forms, but full persisted secondary-genre editing remains deferred until a schema-backed model is approved/applied.
- API retains legacy `genre` for backward compatibility.

## Final Gates

RANK-01: PARTIAL

CANONICAL GENRE TAXONOMY: PARTIAL

STABLE MACHINE GENRE IDS: YES

PRIMARY / SECONDARY GENRE SEMANTICS: PARTIAL

DB/CMS TAXONOMY AUTHORITATIVE: YES

MOCK FALLBACK AUTHORITY BUG FIXED: YES

HOME ORDER CHANGED: NO

EXPLORE ORDER CHANGED: NO

SEARCH RANKING CHANGED: NO

AUTONOMOUS MODIFIED: NO

CONSTITUTION CHANGE REQUIRED: NO

READY FOR NEXT RANK PHASE: YES

RECOMMENDED NEXT PHASE: RANK-02
