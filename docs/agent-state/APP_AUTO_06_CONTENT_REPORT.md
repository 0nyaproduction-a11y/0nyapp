# APP-AUTO-06 — Content Performance / Metadata Observation

## Scope

Added a pure adapter for authoritative CMS/catalog content lifecycle
observations: published, updated, unpublished, available, and unavailable.
Content identity remains a bounded reference to the existing catalog/CMS
record; no second catalog or persistence system was introduced.

CMS metadata takes precedence over catalog and client claims. Client metadata
cannot create observations, and missing language, duration, creator, genre, or
lifecycle metadata remains null/unknown. Publication timestamps and event
timestamps are preserved, while temporal ordering is explicitly validated.

Ranking scores, reasons, popularity, quality, performance, and reward fields
are rejected as content metadata. Creator and genre references are bounded and
privacy-safe. CanonicalEvent projection and fail-open producer behavior are
preserved.

## Verification

Focused tests cover stable identity, metadata precedence, lifecycle temporal
ordering, null/unknown preservation, ranking contamination rejection,
non-fabricated performance, CanonicalEvent compatibility, and fail-open
observation behavior.
