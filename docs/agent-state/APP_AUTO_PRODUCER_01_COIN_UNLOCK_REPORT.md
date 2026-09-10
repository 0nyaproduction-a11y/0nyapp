# APP-AUTO-PRODUCER-01 -- Coin Unlock Observation Producer Disposition

**Date:** 2026-09-06

**Status:** `BLOCKED`

No APP-AUTO producer was added. The existing evidence projection is correct for
the successful persisted ledger record, but the requested complete
success/failure producer cannot conform to the frozen shared contract without
manufacturing or conflating identifiers/timestamps.

## Proven available evidence

For `purchase_success` and the idempotent `already_owned` retry outcome,
[`purchaseEpisodeWithCoins`](../../src/lib/purchases.ts) projects exactly:

- `evidence.transactionId` from the existing `coin_transactions.id`; and
- `evidence.occurredAt` from that existing row's `created_at`.

The lookup is restricted to the authenticated user, requested episode, and
`episode_purchase` transaction type. It exposes no provider, payment, token,
or personal data. The existing RPC still owns wallet locking, entitlement
rechecks, debit, and durable ledger/entitlement creation.

## Blocking contract gaps

1. The frozen [`ObservationEnvelope`](../../shared/observation/foundation.ts)
   requires a UUIDv4 `session_id`. The server purchase route has no
   authoritative client session identity and the client does not send one.
   Reusing `transactionId` as `session_id` would merge distinct identities and
   violate their semantics; creating a server session ID violates the task.
2. The frozen monetization adapter requires an authoritative `amount_coins` for
   every `COIN_PURCHASE_COMPLETED` or `COIN_PURCHASE_FAILED` event. The
   projection intentionally provides only the required ID/timestamp, and the
   current RPC route response does not otherwise contain server-derived amount.
3. Authoritative non-success outcomes such as `insufficient_balance`,
   `invalid_episode`, `active_subscription`, and `already_accessible` create no
   episode-purchase transaction record. Therefore they have no existing
   transaction ID or persisted authoritative occurrence timestamp. An RPC
   error (`purchase_failed`) is not an authoritative business outcome.

Emitting a success-only record would leave the requested authoritative failure
behavior unimplemented. Emitting failures at route time would manufacture an
occurrence timestamp; emitting either outcome with a generated or substituted
session ID would widen/reinterpret the frozen contract.

## Required decision before implementation

Explicit authorization is required for one of the following, neither of which
is implemented by this task:

1. Define a bounded, server-validated client session correlation contract for
   this route and project authoritative server-derived amount/outcome metadata;
   or
2. Revise the frozen contract to represent server-originated observations
   without a client session identity, while separately defining durable
   authoritative failure evidence.

Neither choice requires a new ledger, but each is a contract/authority decision
that must precede a conforming producer.

## Scope confirmation

- Purchase behavior: unchanged
- Ledger/RPC/schema: unchanged
- New IDs: none
- Persistence/transport/sink: none
- Autonomous: unchanged
- APP-AUTO producer: not added
