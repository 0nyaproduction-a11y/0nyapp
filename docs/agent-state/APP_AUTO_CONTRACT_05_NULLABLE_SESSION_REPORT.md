# APP-AUTO-CONTRACT-05 -- Nullable Session for Server-Authoritative Observations

**Date:** 2026-09-06  
**Status:** `SOURCE VERIFIED`

## Implemented correction

[`shared/observation/foundation.ts`](../../shared/observation/foundation.ts)
now represents `session_id` as `string | null`. Validation accepts `null` only
when all of the following are true:

1. the source explicitly begins `server:`;
2. the event phase is `OUTCOME`; and
3. the domain is not `SESSION`.

All other envelopes, including Android/session lifecycle and client-originated
observations, continue to require a UUIDv4 session ID. `actor_id` remains
independently nullable.

`MONETIZATION_OUTCOME` continues to require the `amount_coins` payload field.
The correction does not make a failure durable: absent authoritative
observation/correlation identity and canonical occurrence time still reject
the envelope. No producer was added.

## Regression proof

- Server-authoritative monetization success with `session_id: null` validates.
- Android lifecycle mutation to `session_id: null` is rejected.
- A non-server client source with `session_id: null` is rejected.
- Missing `amount_coins` is rejected for `MONETIZATION_OUTCOME`.
- Missing observation identity/canonical timestamp is rejected for a server
  failure-shaped payload.
- Privacy allowlists/rejection and deterministic serialization are unchanged.
- CanonicalEvent keeps the existing shape and projects a valid null server
  session as `context.session_id: null`.

## Verification

| Check | Result |
| --- | --- |
| Root foundation, adapters, Android session, and parity tests | PASS -- 56 tests |
| Root typecheck | PASS |
| Android typecheck | PASS |
| Android native Metro export | PASS |
| Touched-file lint | PASS |
| Scoped `git diff --check` | PASS |

## Scope confirmation

- Producer: none
- Sink: none
- Transport: none
- Persistence: none
- New events: none
- Payload/reference allowlist expansion: none
- Monetization business logic: unchanged
- Autonomous: unchanged

## Re-freeze

The source contract is refrozen at this constrained boundary. It remains a
source-only approval, not runtime/producer authorization.
