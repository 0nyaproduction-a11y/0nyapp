# APP-AUTO-05 — Notification Observation

## Scope

Added a pure adapter for notification lifecycle evidence without changing
delivery, provider, preferences, or navigation logic. It supports queued,
sent, delivered, opened, dismissed, and failed observations only when the
caller supplies the corresponding evidence and stable correlation/session
identity.

Provider confirmation is required for sent and delivered. Opened and dismissed
are client-observed unless a future provider integration supplies equivalent
evidence. The adapter never promotes sent to delivered or opened, and missing
lifecycle evidence remains unobserved rather than inferred.

Existing notification/message/campaign identifiers are retained as bounded
references. Push/device tokens, raw message bodies, URLs, query strings, PII,
and secrets are rejected. Notification open may carry an already-proven
session/traffic correlation as context only.

The current App contains notification preference storage but no installed
notification delivery/provider lifecycle implementation, so lifecycle
authority is PARTIAL and no provider events are fabricated.

## Verification

Focused tests cover send-to-outcome correlation, false delivery/open
prevention, provider/client authority, session and traffic linkage, sensitive
data rejection, unknown evidence preservation, temporal integrity,
CanonicalEvent projection, and fail-open producer behavior.
