---
name: 0nya-playback-access
description: Mandatory for 0nya episode access, free-watch rules, registration gates, coins, subscriptions, rewarded unlocks, Mux playback authorization, resume/history, Continue Watching, and player access behavior.
---

# 0nya Playback and Access

Playback/access crosses UI, persistence, server authority and monetization.

Load:

- `0nya-execution`
- `0nya-current-state`
- `0nya-android`
- `0nya-monetization-security`

when relevant.

## Separate these concepts

Never casually merge:

- playback history
- resume position
- Continue Watching UI
- entitlement
- episode unlock
- subscription access
- rewarded unlock
- playback authorization
- authentication

They may interact but are not the same system.

## Resume/history

Saved playback position may influence where playback begins.

Resume state must not silently become entitlement state.

Continue Watching must not become authoritative for access.

## Access

Before modifying access logic trace:

```
USER
→ authentication state
→ requested content
→ content/free-access rule
→ entitlement/subscription/coin/reward rule
→ authoritative server decision
→ playback authorization
→ player
```

## Unlock persistence

When repository/product rules establish persistent unlock behavior:
preserve it.

Do not make previously unlocked content depend incorrectly on an unrelated
current subscription state.

## Rewarded access

Reward confirmation/credit must remain authoritative according to existing
server design.

Do not trust a client-only "ad completed" flag as authoritative unless an
authority document explicitly defines such behavior.

## Mux/playback

Do not weaken playback authorization merely to make playback work.

Do not expose signing secrets.

## UI

Visible CTA/copy does not automatically define underlying playback behavior.

A UI label correction must not change resume/access logic unless explicitly required.

## Verification

For access changes verify relevant combinations of:

- guest
- registered user
- subscriber
- coin-unlocked user
- rewarded-unlocked user
- previously unlocked content
- resume history
- unauthorized access
- retry/failure