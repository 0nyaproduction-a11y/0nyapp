# APP-AUTO-04 — Traffic / Source Attribution Observation

## Scope

Added a pure, privacy-bounded adapter for trustworthy source evidence. It
supports deep-link, referral, campaign, notification, social, organic,
direct, and unknown classifications without inferring missing attribution.

Known identifiers are preserved as bounded references and linked to the
existing session/correlation IDs. Server evidence outranks verified link or
notification evidence, which outranks untrusted client claims. Raw URLs,
query strings, and PII-bearing source values are rejected. Unknown/direct
remains explicit when no proven source exists.

No ranking, navigation, product behavior, persistence, migration, transport,
or Autonomous code was changed. The current App has no durable verified
campaign/referral ingestion path, so this adapter does not fabricate one;
callers must provide existing trustworthy evidence.

## Verification

Focused tests cover known source preservation, unknown/direct behavior, session
correlation, deterministic authority resolution, URL/query rejection, no
fabricated attribution, and CanonicalEvent compatibility.
