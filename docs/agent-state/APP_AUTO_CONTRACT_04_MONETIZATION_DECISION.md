# APP-AUTO-CONTRACT-04 -- Server Monetization Admissibility Decision

**Date:** 2026-09-06

**Status:** `SOURCE VERIFIED` -- decision only. No contract, producer,
persistence, transport, ledger, or Autonomous code changed.

## Decision

Persisted server-authoritative coin-unlock success/retry outcomes are
admissible after one required semantic correction: `session_id` must be
nullable for server-authoritative observations that have no trustworthy app
session correlation. The contract must retain a mandatory UUID session identity
for client/session-originated observations.

This is not an authority relaxation. It prevents fabricated client-session
identity while preserving the existing server actor, durable transaction
identity, authoritative timestamp, correlation, and privacy constraints.

## 1. SESSION_ID

`session_id` is mandatory in the frozen contract because APP-AUTO initially
models client lifecycle and app-observed activity; it preserves process session
continuity, actor/session separation, and deterministic correlation for those
events.

It is semantically required for client/session-originated observations, but it
is not inherently required for every observation. A server-authoritative
outcome may legitimately occur after an authenticated request, provider
callback, retry, or delayed processing when no trustworthy Android process
session is available to the server.

No trustworthy existing app-session correlation is available in the
coin-unlock RPC or API route. The server has authenticated actor identity and
the transaction UUID, but neither is an app session. Reusing either as
`session_id` or creating a server session would be false correlation.

Making `session_id` nullable only for server-authoritative outcomes is a
`REQUIRED_SEMANTIC_CORRECTION`. It preserves all current client guarantees when
validation continues to require a UUID for `SESSION` domain events and
client-originated observations. Making it broadly optional without
source/authority constraints would be `UNSAFE_WEAKENING`.

## 2. AMOUNT

`MONETIZATION_OUTCOME` requires `amount_coins` so a coin-purchase outcome
cannot claim success/failure with an invented or ambiguous economic value.

For persisted coin-unlock success/retry, authoritative truth already contains
the amount: `coin_transactions.amount`. The
`purchase_episode_with_coins` transaction creates an `episode_purchase` row
with the server-resolved negative debit amount; the schema constraint defines
that transaction type as negative. Its positive coin value is therefore
derived directly and safely as the absolute value of the existing ledger
amount, not client input.

The amount requirement remains `KEEP` and is `NO_CHANGE_REQUIRED`. Future
projection may expose only the positive integer coin value alongside the
already projected transaction ID/timestamp. If a proposed outcome has no
authoritative amount, validation must reject it rather than fabricate one.

## 3. FAILURE

Authoritative failure does **not** consistently have both a stable durable ID
and authoritative `occurred_at`:

- `insufficient_balance`, `invalid_episode`, `active_subscription`, and
  `already_accessible` can be authoritative RPC outcomes but do not create an
  `episode_purchase` ledger record.
- `purchase_failed` represents an RPC/operational failure, not a durable
  business outcome.

Accordingly, failure observation remains unsupported. No synthetic failure
identity, route-clock timestamp, or substitute transaction ID may be created.
This is `NO_CHANGE_REQUIRED`.

## 4. Success-only admissibility

`purchase_success` is safely observable after the nullable-server-session
correction because the existing `coin_transactions` row provides:

- stable observation/correlation reference: transaction UUID;
- authoritative occurrence time: ledger `created_at`; and
- authoritative amount: ledger debit `amount`.

The idempotent `already_owned` retry resolves to the same existing purchase
ledger row and must preserve that UUID/time/amount rather than emit a second
logical success. Whether it should be emitted again must be controlled by a
deterministic observation key from that same durable transaction identity; it
must never cause a second debit or infer a new attempt.

This success-only scope is safe. It does not claim coverage for non-persisted
failures, client attempts, rewarded outcomes, or provider purchases.

## Change classification

| Proposed change | Classification | Decision |
| --- | --- | --- |
| Permit `session_id: null` for explicitly server-authoritative outcomes while retaining UUID enforcement for session/client-originated observations | `REQUIRED_SEMANTIC_CORRECTION` | Required before server coin-success producer |
| Make `session_id` nullable for every observation without source/authority validation | `UNSAFE_WEAKENING` | Rejected |
| Add a separate context-only server-session substitute | `OPTIONAL_CONVENIENCE` | Not needed; do not add |
| Remove `amount_coins` from monetization outcomes | `UNSAFE_WEAKENING` | Rejected |
| Project positive coin value from existing ledger debit | `NO_CHANGE_REQUIRED` to contract | Required producer input, not a contract change |
| Observe non-persisted failures with generated ID/time | `UNSAFE_WEAKENING` | Rejected |

## Required re-freeze scope

The source freeze must reopen only for the constrained nullable-session
semantics, associated validation/parity tests, and a re-freeze assessment.
No event vocabulary, payload allowlist, reference allowlist, actor identity,
amount requirement, canonical projection, transport, persistence, or
Autonomous integration may change.

## Safe producer after decision

After the contract correction and re-freeze, the first safe producer is a
server-local `COIN_PURCHASE_COMPLETED` / `MONETIZATION_OUTCOME` for the
persisted coin-unlock transaction only. It must use:

- `actor_id`: server-authenticated user;
- `session_id`: `null`;
- `observation_id` and `correlation_id`: existing transaction UUID;
- `occurred_at`: existing transaction `created_at`;
- `amount_coins`: positive value derived from existing ledger debit;
- `context.references.transaction_id`: same existing UUID; and
- deterministic duplicate suppression based on that transaction UUID.

It must not emit an attempt or a failure, write observation persistence, use a
sink/transport, or alter the purchase response/business result.
