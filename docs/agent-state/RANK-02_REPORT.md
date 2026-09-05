# RANK-02 Report

Date: 2026-09-05

## Executive Verdict

RANK-02: PARTIAL

The Consumer App now has a source-level editorial ranking provenance foundation:
stable Home editorial policy identity, deterministic server-side config
hash/version computation, New Releases source distinction, prepared additive
history migration, and CMS Home Composer hooks that record editorial changes
when the migration exists.

It remains PARTIAL because no remote migration was run, no deployment was
performed, and the new `home_editorial_change_events` table is prepared in
source only. Runtime CMS persistence must be verified after authorized migration
application.

## Current Editorial Model

Current Home editorial authority remains:

- `home_rows.sort_order` for row order.
- `home_row_items.sort_order` for item order.
- `home_rows.enabled` for row visibility.
- `home_row_items.show_title` for Spotlight title visibility.
- `home_new_releases_exclusions` for New Releases automatic-fill exclusions.

Android remains a consumer of the backend/API order and is not config authority.

## Editorial Semantics Map

| Concept | Status | Repository mapping |
| --- | --- | --- |
| `EDITORIAL_PIN` | PARTIAL | Adding an item to a manually curated Home row or New Releases manual set is a pin/membership intervention. No separate pin flag exists. |
| `EDITORIAL_BOOST` | MISSING | No boost score/weight/priority field exists. No boost semantics were invented. |
| `EDITORIAL_REMOVE` | EXISTS | Removing row items and deleting editorial rows are explicit remove events. |
| `EDITORIAL_ORDER` | EXISTS | Row reorder, item reorder, sort-order edits, enabled/disabled changes, Spotlight toggles, and low-history setting changes alter editorial order/config semantics. |

## Provenance Model

New source module:

- `src/lib/ranking/editorial-provenance.ts`

It defines:

- `ranking_policy = editorial`
- `ranking_policy_version = home_editorial_v1`
- `config schema = home_editorial_config_v1`
- deterministic Home editorial snapshot hashing
- `config_version = home_editorial_config_v1:<hash-prefix>`
- `config_hash = sha256(canonical Home config snapshot)`
- `editorial_pin` vs `deterministic_release_date` New Releases source constants
- current CMS change-type to editorial-intervention mapping

CMS Home Composer server actions now pass the existing CMS admin Supabase user id
into Home mutation helpers. The helpers best-effort insert audit rows into
`home_editorial_change_events` after successful row/item/settings mutations.

The audit writer records:

- actor UUID where available
- actor source (`cms_admin` or `system`)
- change type
- editorial intervention type
- ranking policy/version
- effective config version/hash
- affected row/item/content references
- previous/new JSON state
- changed timestamp from the database default

## Config / Version Model

The effective config snapshot includes low-history threshold, ordered Home rows,
and ordered Home row items. It normalizes array ordering before hashing, so the
same logical configuration produces the same hash even if query order varies.

Consumer `HomeRow` objects now include:

- `rankingPolicy`
- `rankingPolicyVersion`
- `configVersion`
- `configHash`

These fields are produced server-side only.

## New Releases

The hybrid resolver formula is unchanged:

```text
editorial items first
+
automatic released content by publication timestamp
+
exclusions
```

It now marks each returned item with:

- `source = editorial_pin`
- `source = deterministic_release_date`

This allows future learning/evaluation systems to distinguish manual editorial
placement from chronological fill without changing the ordering formula.

## Migration Status

Prepared only:

- `supabase/migrations/20260905030000_034_home_editorial_ranking_provenance.sql`

The migration creates `home_editorial_change_events` with RLS enabled and no
public grants. It is additive and does not mutate existing Home rows/items or
seed content.

The local `supabase` CLI was not available in this shell, so the migration file
was created manually and must be reviewed/applied through the normal authorized
Supabase flow later. No remote migration was run.

## Tests

Added:

- `src/lib/ranking/editorial-provenance.test.ts`

Updated:

- `package.json` test script includes the new provenance test.

Covered:

- stable editorial policy/version identity
- deterministic config hashing
- reconstructible config version
- enabled/disabled and ordered snapshot preservation
- change-to-intervention mapping
- no invented boost semantics
- New Releases source distinction

## Verification

Passed:

```text
npm exec -- tsx --test src/lib/ranking/editorial-provenance.test.ts src/lib/new-releases.test.ts src/lib/catalog-visibility.test.ts src/lib/taxonomy.test.ts
67 passed, 0 failed
```

Passed:

```text
npm test
231 tests total; 214 passed; 17 skipped; 0 failed
```

Passed:

```text
cd apps/android
npm run typecheck
```

Passed:

```text
git diff --check
```

Root typecheck remains blocked by unrelated existing media-admin errors:

```text
src/app/admin/media/page.tsx: Cannot find module '@/lib/cms/media-delete-impact'
src/components/cms/MediaAdminClient.tsx: Cannot find module '@/lib/cms/media-delete-impact'
src/components/cms/MediaAdminClient.tsx: Property 'scanAction' does not exist
```

## Remaining Gaps

- Prepared migration is not applied locally or remotely.
- Runtime CMS audit-row persistence is not verified on deployed QA.
- No `ranking_decision_id` was added; this remains later RANK-05B scope.
- No impression/served event sink was added; this remains later RANK-05 scope.
- No candidate-set snapshot was added; this remains later RANK-05B scope.
- `EDITORIAL_BOOST` remains missing because CMS has no boost field.
- Historical reconstruction begins at migration application time; earlier Home
  editorial changes remain reconstructible only from current row state and Git/CMS
  external evidence, not from the new audit table.

## Gates

RANK-02: PARTIAL

EDITORIAL ORDER STILL CANONICAL: YES

EDITORIAL PROVENANCE: PARTIAL

CONFIG VERSIONING: YES

CONFIG HASH: YES

HISTORICAL RECONSTRUCTION: PARTIAL

NEW RELEASES SOURCE DISTINCTION: YES

HOME ORDER CHANGED: NO

BEHAVIORAL RANKING ADDED: NO

AUTONOMOUS MODIFIED: NO

CONSTITUTION CHANGE REQUIRED: NO

READY FOR NEXT RANK PHASE: YES

RECOMMENDED NEXT PHASE: RANK-03
