# APP-AUTO-CONTRACT-02 -- Shared Executable Contract

**Date:** 2026-09-06  
**Status:** `PARTIAL` -- source contract migration and targeted tests pass; the
configured Metro bundle and full Android typecheck remain blocked by
pre-existing checkout configuration/errors.

## STATUS

| Field | Result |
| --- | --- |
| SHARED CONTRACT PATH | `shared/observation/foundation.ts` |
| SINGLE CONTRACT AUTHORITY | YES |
| ROOT FOUNDATION MIGRATED | YES |
| ANDROID DUPLICATE REMOVED | YES |
| ROOT IMPORTERS MIGRATED | YES |
| ANDROID SESSION IMPORT MIGRATED | YES |
| EVENT VOCABULARY CHANGED | NO |
| PRIVACY SURFACE CHANGED | NO |
| SESSION IDENTITY PRESERVED | YES |
| APP-AUTO-02 COMPATIBLE | YES |
| BACKGROUND/FOREGROUND SEMANTICS PRESERVED | YES |
| APP RESTART SEMANTICS PRESERVED | YES |
| ANONYMOUS SUPPORT PRESERVED | YES |
| CANONICALEVENT COMPATIBLE | YES |
| APP.TSX CHANGED | NO |
| TRANSPORT ADDED | NO |
| PERSISTENCE ADDED | NO |
| SINK ADDED | NO |
| AUTONOMOUS MODIFIED | NO |
| MIGRATION | NONE |

## IMPLEMENTATION

The root-authoritative `app_observation_v1` contract was extracted to
[`shared/observation/foundation.ts`](../../shared/observation/foundation.ts).
The module remains dependency-free and contains only the contract types,
constants, domain/phase/payload/context/reference validation, privacy
rejection, deterministic serialization, CanonicalEvent projection, and
fail-open helper.

All root adapters now import that module. The Android lifecycle controller now
imports the same executable module. The prior Android foundation duplicate was
removed. [`App.tsx`](../../apps/android/App.tsx) was intentionally unchanged:
it remains sinkless and preserves the existing lifecycle call sequence.

The shared module retains the root-authoritative generic event vocabulary and
its narrower privacy allowlists. The previously untracked root adapters had
been written against the Android fork's wider event/reference vocabulary; their
unwired projections now map their validated domain evidence to the existing
generic root events and fields. No producer was wired, so no product behavior
or authority changed.

[`metro.config.js`](../../apps/android/metro.config.js) now watches the
repository root, which is the minimum Metro configuration required for the
dependency-free shared path.

## VERIFICATION

| Check | Result |
| --- | --- |
| ROOT TESTS | PASS -- 51 explicit foundation, adapter, Android-session, and parity tests |
| ANDROID TESTS | PASS -- 7 session/controller tests, including shared-contract parity |
| PARITY TESTS | PASS -- generic event rejection, domain/phase and payload/context/reference rules, privacy, canonical timestamps, serialization, and CanonicalEvent projection |
| TYPECHECK | Root PASS; Android BLOCKED by pre-existing `CoinPurchaseScreen.tsx` missing `billingPlan` errors |
| METRO | PARTIAL -- configuration assertion PASS; configured Android export is unavailable because Expo config lists only `web`, and the subsequent configured-web attempt cannot find `expo` from the Android project checkout |
| LINT | PASS for migrated TypeScript files; `metro.config.js` is CommonJS and triggers pre-existing `no-require-imports` lint errors |
| DIFF CHECK | PASS -- no whitespace errors; unrelated working-tree CRLF warnings remain |

The focused suite proves the six APP-AUTO-02 lifecycle events remain valid:
`SESSION_STARTED`, `SESSION_RESUMED`, `SESSION_ENDED`, `APP_OPENED`,
`APP_BACKGROUND`, and `APP_FOREGROUND`. It also proves process-scoped
`getEvidenceSessionId()` reuse, stable session/correlation identity,
background/foreground continuity, explicit end behavior, anonymous `null`
actors, timestamp ordering, invalid-observation rejection, fail-open sink
isolation, and CanonicalEvent projection.

## FREEZE REASSESSMENT

`PARTIAL`.

The contract has one executable authority and APP-AUTO-02 conforms to it
without a second event/session system. No transport, persistence, sink,
telemetry endpoint, migration, producer wiring, or Autonomous change was
introduced.

The source-level contract is ready for Product Owner and ChatGPT review. It
must not be treated as Android runtime-bundle proof until the existing Expo
configuration/installation issue and unrelated Android typecheck errors are
resolved and the bundle is rerun.

## APP-AUTO REFROZEN

`NO` -- re-freeze is pending the blocked Android bundle/typecheck gates.

## FILES CHANGED

- `shared/observation/foundation.ts`
- `src/lib/observation/{access,content,monetization,notifications,system,traffic}.ts`
- `src/lib/observation/foundation.test.ts`
- `src/lib/observation/{access,content,monetization,notifications,traffic}.test.ts`
- `apps/android/src/lib/sessionObservations.ts`
- `apps/android/src/lib/sessionObservations.test.ts`
- `apps/android/src/lib/observation/foundation.ts` (removed)
- `apps/android/metro.config.js`
- this report and the freeze reassessment below

## BLOCKER

Android `npm run typecheck` is blocked by two pre-existing
[`CoinPurchaseScreen.tsx`](../../apps/android/src/screens/CoinPurchaseScreen.tsx)
errors requiring `StoreProduct.billingPlan`. Metro bundle validation is blocked
by the existing web-only Expo platform configuration and no reachable Expo
installation from the Android project. Neither blocker is changed by this
task.

## NEXT

Return to Product Owner + ChatGPT. Do not continue into monetization,
transport, persistence, Autonomous, or new APP-AUTO domains.
