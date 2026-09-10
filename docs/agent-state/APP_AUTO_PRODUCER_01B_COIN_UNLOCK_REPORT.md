# APP-AUTO-PRODUCER-01B -- Coin Unlock Success/Retry Observation

**Date:** 2026-09-06  
**Status:** `SOURCE VERIFIED`

## Producer boundary

[`purchaseEpisodeWithCoins`](../../src/lib/purchases.ts) now invokes the
sinkless server-local producer only after the existing RPC reports
`purchase_success` or the idempotent `already_owned` retry and the existing
matching `episode_purchase` ledger row is available.

The producer:

- uses the authenticated user as `actor_id`;
- uses `session_id: null`;
- uses the persisted transaction UUID as both observation and correlation ID;
- preserves `coin_transactions.created_at` as `occurred_at`;
- derives the positive coin amount only from the existing negative
  `coin_transactions.amount` debit;
- includes only the episode `content_id` and transaction ID references; and
- validates and projects the observation through the shared frozen contract.

The default producer is intentionally sinkless. Its optional in-process
observer is invoked fail-open for future bounded consumers; no transport,
external sink, persistence, or response field was added.

## Retry and failure disposition

An `already_owned` retry looks up the same user/episode/`episode_purchase`
ledger row and therefore preserves the same transaction identity, timestamp,
and amount. It does not debit coins or create a new ledger row.

No failure observation is emitted. Non-persisted RPC outcomes and operational
failures remain excluded because they have no durable transaction identity and
authoritative occurrence timestamp.

## Privacy and behavior

No payment provider data, payment tokens, receipts, raw error objects, or PII
is read into the producer. The existing API response remains the same safe
shape: its `evidence` exposes only `transactionId` and `occurredAt`, never the
internal amount used to form the observation.

The RPC, ledger, database schema, entitlement behavior, API status, balance,
and response semantics are unchanged. Observation validation or a synchronous
or asynchronous observer error cannot affect the purchase result.

## Verification

| Check | Result |
| --- | --- |
| Persisted success identity/time/amount/session/canonical projection | PASS |
| Retry deterministic identity | PASS |
| Unsupported failure emission | PASS -- none emitted |
| Sensitive value rejection | PASS |
| Fail-open synchronous observer failure | PASS |
| Purchase evidence public-response boundary | PASS |
| Root + adapter + Android session parity tests | PASS -- 65 tests |
| Root typecheck | PASS |
| Android typecheck | PASS |
| Touched-file lint | PASS |
| Scoped `git diff --check` | PASS |

## Scope confirmation

- Producer: server-local persisted coin-unlock success/retry only
- Ledger/RPC/schema: unchanged
- Product behavior: unchanged
- Transport/persistence/external sink: none
- Autonomous: unchanged
