# APP-AUTO-RUNTIME-SESSION-01 -- Session Runtime Disposition

**Date:** 2026-09-06

**Status:** `ALREADY_COMPLETE_SINKLESS`

## Disposition

The SESSION runtime producer is already complete at the approved sinkless
boundary. No lifecycle call or controller behavior is missing, and no
executable code change is required.

## Verified runtime chain

- [`AppNavigator`](../../apps/android/App.tsx) creates exactly one
  `createSessionObservationController()` instance in a `useRef`.
- Its mount effect calls `appOpened()`, producing `APP_OPENED` followed by
  `SESSION_STARTED` once.
- The same effect subscribes to `AppState`: `background` and `inactive` call
  `appBackground()`; `active` calls `appForeground()`.
- Controller guards emit `APP_BACKGROUND` once per transition, and emit
  `APP_FOREGROUND` then `SESSION_RESUMED` only after a recorded background.
- `SESSION_ENDED` is intentionally available only through the explicit
  controller method. It is not called from component unmount, background, or
  process termination because those are not reliable end-of-session signals.
  This is the approved and correct non-fabrication behavior, not missing
  lifecycle wiring.

## Identity, actor, and failure boundary

- [`getEvidenceSessionId`](../../apps/android/src/lib/evidenceIdentity.ts) is
  the sole process-scoped session identity source. The controller retains it as
  both `session_id` and `correlation_id` for its lifetime.
- `AppNavigator` calls `setActorId(session?.user.id ?? null)`, preserving
  anonymous actor identity as `null`.
- There is no second runtime controller construction or session producer.
  Existing ranking evidence reuses the same session ID but is not a SESSION
  lifecycle producer.
- `AppNavigator` passes no `onObservation` callback. The absence of a sink is
  intentional. The controller first validates observations, exits when no
  callback exists, and isolates synchronous/asynchronous callback failures
  when one is supplied for tests or a future approved boundary.
- The controller contains no HTTP request, transport, persistence, or
  Autonomous dependency.

## Verification

`npx tsx --test apps/android/src/lib/sessionObservations.test.ts`

Result: **7 passed, 0 failed**. Covered:

- stable same-process session/correlation identity;
- background/foreground ordering and duplicate suppression;
- explicit new-controller restart semantics;
- shared-contract acceptance without widening;
- anonymous actor and explicit-only end;
- invalid/sensitive observation fail-open behavior; and
- sink failure isolation and CanonicalEvent projection.

`git diff --check` found no whitespace errors. It emitted only existing
working-tree CRLF conversion warnings.

## Scope confirmation

- Runtime lifecycle wired: `YES`
- Session identity authoritative: `YES`
- Duplicate producer: `NO`
- Sink: `NONE`
- Transport: `NONE`
- Persistence: `NONE`
- Autonomous impact: `NONE`
- Product behavior impact: `NONE`
- Code changes required: `NO`
