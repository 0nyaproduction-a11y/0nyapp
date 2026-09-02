---
name: 0nya-backend-cms
description: Use for 0nya CMS, Next.js administration, backend APIs, Supabase integration, server configuration, editorial controls, content management, and backend work.
---

# 0nya Backend and CMS

Load:

- `0nya-execution`
- `0nya-current-state`

Read relevant backend/API/CMS authority documents.

## Server authority

Clients are not authoritative for:

- identity
- balances
- coin credits
- purchases
- subscriptions
- entitlements
- pricing
- payment verification
- rewarded-ad rewards
- playback authorization

## Existing contract first

Before changing an API:

1. identify consumers
2. inspect request contract
3. inspect response contract
4. inspect validation
5. inspect authentication/authorization
6. inspect compatibility
7. inspect tests

Prefer backwards-compatible/additive changes when product requirements permit.

## CMS

CMS fields must reflect explicit editorial/product controls.

Do not invent hidden semantics.

Do not silently reinterpret values.

Do not convert dynamic server configuration into client hardcodes.

## CMS Final Acceptance Protocol

All CMS final acceptance must strictly adhere to the **Locked Final Acceptance Protocol** in `AGENTS.md`. This order must NEVER be reversed or bypassed:

```
CMS SOURCE / CONFIG -> DEPLOYED QA BACKEND / API -> ACTUAL CMS WEBSITE RUNTIME CHECK -> SCREENSHOTS / EVIDENCE -> PRODUCT OWNER + CHATGPT REVIEW -> PRODUCT OWNER HANDS-ON CMS WEBSITE CHECK -> LOCK / VERIFIED COMPLETE
```

1. **CMS SOURCE / CONFIG:** Verify code, schema, config -> `SOURCE VERIFIED`.
2. **DEPLOYED QA BACKEND / API:** Verify actual Cloud Run QA API responses, persistence, order, metadata -> `CMS/API VERIFIED`.
3. **CMS WEBSITE RUNTIME:** Run deployed QA CMS website (`/admin/login`, `/admin/home`, etc.), test real UI/controls/save/refresh -> `CMS WEBSITE VERIFIED`.
4. **SCREENSHOTS / EVIDENCE + REVIEW:** Capture CMS website states for Product Owner + ChatGPT review.
5. **PRODUCT OWNER HANDS-ON CHECK:** Product Owner personally logs into deployed CMS website, performs operations, and validates persistence/behavior. Agents must never fabricate this human check.
6. **LOCK:** CMS item becomes `VERIFIED COMPLETE` + `LOCKED BASELINE` only after all gates including Owner hands-on pass.

CMS lock does not automatically lock rendered Android UI. CMS data affecting the App must pass the full App sequence (`EMULATOR -> SCREENSHOTS -> OWNER+CHATGPT REVIEW -> REFINEMENT -> ONEPLUS -> LOCK`).

## Production safety

Do not mutate production data merely to pass a test.

Do not deploy automatically.

Do not modify Android merely to simplify backend implementation.