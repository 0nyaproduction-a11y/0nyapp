# APP-AUTO-07 — Access / Entitlement Observation

## Scope

Added a pure observation adapter over the existing server access resolver and
entitlement authority. It supports access checked/granted/denied and
entitlement granted/revoked/expired events without changing authorization,
playback, entitlement persistence, or client behavior.

Only server access or server entitlement evidence is accepted. Client UI state
cannot grant or revoke an observation. Allowlisted denial reason codes are
preserved when authoritative; missing reasons remain null/unknown. The adapter
does not infer why access was denied and keeps `not_watched` distinct from
`access_required` or other access outcomes.

Existing content and entitlement identifiers, request/correlation IDs, and
dedupe keys are retained as bounded context. Sensitive purchase tokens,
receipts, auth material, PII, and secrets are rejected. CanonicalEvent
projection and fail-open behavior are preserved.

The current access implementation exposes a boolean resolver and playback
status codes, while durable unified access lifecycle emission is not present.
Therefore this domain remains PARTIAL until authoritative producers supply the
adapter with those existing server outcomes.

## Verification

Focused tests cover grant/deny correlation, authoritative reason handling,
unknown reason preservation, client UI authority rejection, deterministic
duplicate/retry identity, sensitive-data rejection, temporal integrity,
CanonicalEvent projection, and fail-open access behavior.
