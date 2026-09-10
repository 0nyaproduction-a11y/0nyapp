# APP-AUTO-08 — System / Failure Observation

## Scope

Added a pure adapter for proven playback, API, payment, entitlement-check,
media-availability, and content-load failures. It reuses existing result/error
boundaries and does not replace logging, error handling, recovery, playback, or
payment logic.

Failure observations preserve original timestamps, session/content/request/
transaction/entitlement correlation where supplied, bounded stable reason
codes, retryability, and explicit unknown values. User cancellation is not
accepted as a technical failure. Media unavailability is kept distinct from
playback failure. No severity, reward, or root-cause score is inferred.

Raw stack traces, provider payloads, auth material, URLs with secrets, tokens,
email, phone, and arbitrary error objects are rejected by the bounded adapter.
Duplicate/retry identity is deterministic through correlation, request, dedupe,
and timestamp fields. Notification failure remains owned by the notification
adapter's existing lifecycle event; this system adapter does not duplicate it.

The current application has distributed failure/result sources rather than one
durable unified failure stream, so failure authority remains PARTIAL until
authoritative producers feed this adapter.

## Verification

Focused tests cover classification, cancellation separation, correlation,
unknown cause preservation, sensitive payload rejection, deterministic retry
identity, temporal integrity, CanonicalEvent projection, and fail-open
recovery behavior.
