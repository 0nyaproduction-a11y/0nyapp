# APP-AUTO-03 — Monetization Observation

## Scope

Added a pure adapter from the existing validated monetization event vocabulary
to the APP-AUTO-01 observation envelope. Only currently supported coin
purchase, rewarded unlock, and Chai tip attempt/outcome events are mapped.
Attempt observations are emitted only when both the existing `request_id` and
`dedupe_key` are present, providing a trustworthy retry identity for later
authoritative correlation. Otherwise the adapter rejects the attempt and
leaves authoritative success/failure observation available.
Subscriptions and unsupported fiat/payment semantics are not fabricated.

The adapter reuses existing event, request, correlation, dedupe, provider,
episode, and short-film identifiers. Amounts are explicitly represented as
bounded integer `coins`; raw payment credentials, receipts, purchase tokens,
gateway secrets, and PII remain rejected by the existing validator and the
shared envelope.

Retries of the same authoritative event preserve the same observation ID and
dedupe key. Attempts are `PRE_ACTION`; authoritative results are `OUTCOME`.
CanonicalEvent projection remains the existing four-field shape. Observation
failures are isolated and cannot interrupt payment flow.

No ledger, purchase logic, persistence, migration, transport, Autonomous code,
or product behavior was changed.

## Verification

Focused tests in
[`src/lib/observation/monetization.test.ts`](../../src/lib/observation/monetization.test.ts)
cover attempt/success/failure correlation, retry identity, authoritative IDs,
timestamp preservation, amount/currency validation, payment-secret rejection,
anonymous behavior, temporal separation, fail-open behavior, and
CanonicalEvent compatibility.
