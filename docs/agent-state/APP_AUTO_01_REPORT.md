# APP-AUTO-01 — Shared Observation Foundation

## Scope

Implemented a pure, reusable Consumer App observation contract. It validates,
serializes, and projects observations without persistence, transport,
instrumentation, migrations, Autonomous changes, or product authority.

## Contract

The foundation is in
[`src/lib/observation/foundation.ts`](../../src/lib/observation/foundation.ts).
It provides:

- canonical UUIDv4 `observation_id`;
- `app_observation_v1` schema version;
- immutable source `occurred_at` validation;
- nullable server-supplied `actor_id`;
- required UUIDv4 process/session `session_id`;
- reserved domains: `SESSION`, `MONETIZATION`, `TRAFFIC`, `NOTIFICATION`,
  `CONTENT`, `ACCESS`, `SYSTEM`;
- controlled event types and domain/phase matching;
- bounded source/context and references to existing authoritative IDs;
- required `correlation_id` plus optional retry/causation IDs;
- per-event scalar payload allowlists;
- value-level rejection for email, phone, token, secret, and key material;
- deterministic key-sorted JSON serialization;
- read-only four-field CanonicalEvent projection;
- fail-open producer helper.

No domain has been instrumented. Existing wallets, ledgers, entitlements,
watch-progress, ranking evidence, and notification preferences remain the
systems of record.

## Verification

Focused tests in
[`src/lib/observation/foundation.test.ts`](../../src/lib/observation/foundation.test.ts)
cover timestamps, correlation, anonymous actors, reserved domains, existing ID
references, PII/secret rejection, nested metadata rejection, allowlists,
temporal phase separation, deterministic serialization, CanonicalEvent
compatibility, and fail-open behavior.

No migration was created or applied. No Autonomous file was modified. No live
transport or product behavior was added.
