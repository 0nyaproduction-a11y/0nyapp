# APP-AUTO-02 — Session / Retention Observation

## Scope

The Android app now emits validated, fail-open lifecycle observations through
the APP-AUTO-01 envelope. There is no new session store, transport, migration,
retention score, or product behavior.

## Semantics

`getEvidenceSessionId()` remains the process-scoped session identity already
used by ranking behavior evidence. A controller keeps that ID and its
correlation ID stable for `APP_OPENED`, `SESSION_STARTED`, background,
foreground, resume, and explicit end events. A new controller/process receives
a new session ID. Background and foreground transitions do not create sessions;
foreground is emitted only after a background transition.

The Android lifecycle does not reliably expose process termination. Therefore
`SESSION_ENDED` is available to an explicit owner but is not fabricated from
background or component unmount.

## Verification

[`apps/android/src/lib/sessionObservations.ts`](../../apps/android/src/lib/sessionObservations.ts)
uses the shared foundation, existing process session identity, nullable auth
actor IDs, bounded payloads, original timestamps, and CanonicalEvent
projection. Its focused tests cover stable identity/correlation, deterministic
restart semantics, background/foreground behavior, anonymous flow, timestamp
ordering, validation fail-open behavior, sink failure isolation, and projection.

No Autonomous code, live transport, persistence, migration, or product
behavior was changed.
