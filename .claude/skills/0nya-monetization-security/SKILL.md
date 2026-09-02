---
name: 0nya-monetization-security
description: Mandatory for 0nya coins, subscriptions, entitlements, rewarded ads, payments, wallet, playback authorization, Supabase RLS, identity, secrets, monetization events, or security-sensitive work.
---

# 0nya Monetization and Security

HIGH-RISK DOMAIN.

Load:

- `0nya-execution`
- `0nya-current-state`

AUDIT BEFORE EDITING.

## Non-negotiable

The client is not authoritative for:

- identity
- wallet balance
- coin credit
- purchase verification
- subscription state
- entitlement
- price
- rewarded-ad credit
- playback authorization

Never move server authority to the client.

If proposed implementation does:

STOP.

Report:

```
BLOCKED: proposed implementation violates server-authority boundary.
```

## Secrets

Never expose or print:

- service_role
- private API keys
- access tokens
- payment secrets
- signing keys
- production credentials

Environment-variable NAMES may be inspected.

Values must never be documented.

Publishable (client-safe) values that already exist in tracked files may be
referenced, but never reproduce private credentials.

## Required trust trace

For relevant work trace:

```
CLIENT
→ API
→ authentication
→ authorization
→ validation
→ authoritative state
→ persistence
→ idempotency/replay protection
→ result
→ client
```

## Database

Do not automatically alter:

- schema
- migrations
- RLS
- functions
- production data

## Verification

When relevant verify:

- happy path
- unauthorized path
- invalid input
- duplicate/replay behavior
- retry behavior
- failure behavior
- preservation of existing entitlement

Happy path alone is not sufficient.