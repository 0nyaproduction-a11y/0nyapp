# OBS-BRIDGE-CONTRACT-01 -- EvidenceEnvelope and Ingress Semantics

**Date:** 2026-09-06  
**Status:** `SOURCE VERIFIED`

## Contract and package boundary

[`shared/observation/evidence-envelope.ts`](../../shared/observation/evidence-envelope.ts)
defines `onya_evidence_envelope_v1` as a dependency-free, versioned package
boundary for the Consumer App and a future Observation Bridge. It has no
Autonomous import, no product-runtime dependency, no transport, no endpoint,
and no persistence.

The future package should be extracted unchanged to a separately versioned
package such as `@0nya/observation-evidence-contract`. The Consumer App and
Bridge may import that package; Autonomous core must not. The generic
`app_observation_v1` contract remains separate: this envelope carries
producer evidence and does not reconcile ranking semantics or emit a
CanonicalEvent.

## Envelope v1

Required fields are `schema_version`, `producer_id`, `evidence_id`,
`occurred_at`, `domain`, `type`, `source`, `source_version`, `actor_id`,
`session_id`, `correlation`, `references`, and `payload`.

- `evidence_id` is a producer-owned UUIDv4. It must use an existing
  authoritative durable identity when one exists; Android lifecycle evidence
  uses its existing generated evidence UUID. The Bridge must never replace a
  missing business identity.
- `occurred_at` is canonical UTC and producer-authoritative. Bridge ingestion
  time is deliberately outside this contract and must never overwrite it.
- `actor_id` and `session_id` are independently nullable.
- `correlation` has a required UUID `correlation_id` and nullable UUID
  `request_id` / `causation_id`.
- `references` is a bounded identifier map. `payload` is a maximum 24-key,
  scalar-only map, with finite numbers, strings at most 256 characters, and a
  2KB serialized bound.

The validator rejects nested payloads, unknown top-level fields, malformed
identifiers/timestamps, URLs/query strings, secrets, provider/payment tokens,
unreviewed PII, and sensitive key/value patterns.

## Ingress idempotency semantics

The canonical idempotency key is:

```text
(producer_id, evidence_id, schema_version)
```

`serializeEvidenceEnvelope` recursively sorts keys. `evidenceContentHash`
computes a portable SHA-256 over those deterministic bytes.

`evaluateEvidenceIngress` is deliberately storage-free: a future Bridge
provides the existing receipt for the canonical key.

| Condition | Disposition |
| --- | --- |
| Valid envelope and no matching stored receipt | `ACCEPT` |
| Same key and identical SHA-256 | `DUPLICATE` |
| Same key and different SHA-256 | `IDEMPOTENCY_CONFLICT` |
| Unsupported schema/shape | `REJECT_SCHEMA` |
| Invalid producer/evidence/actor/session identity | `REJECT_IDENTITY` |
| Non-canonical occurrence time | `REJECT_TIMESTAMP` |
| Privacy/payload/reference/domain/source violation | `REJECT_PRIVACY` |

No result implies durable acceptance until a future Bridge stores the receipt.

## Compatibility proof

Tests prove representability, not semantic reconciliation, for:

1. Android `APP_OPENED` lifecycle evidence with generated lifecycle UUID and
   process session UUID.
2. Persisted server coin-unlock success using the existing transaction UUID,
   authoritative ledger timestamp, authenticated actor, null session, and
   server-derived amount.
3. Ranking decision evidence with its existing ranking decision UUID and
   bounded decision metadata.

## Scope confirmation

- Live service/HTTP ingress: none
- Transport/retry worker: none
- Database/outbox/persistence: none
- Product behavior: unchanged
- Autonomous: unchanged
