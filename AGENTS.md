<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 0nya project authority

1. Product/UI/user-flow authority order: explicitly approved current product decision; docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md; docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md; repository AI instructions; existing implementation conventions; AI preference.
2. The Product + UI/UX Bible wins over the Master User Flow on conflict.
3. Before consumer UI, UX, navigation, player, paywall, wallet, monetisation, short-film, profile, deep-link, account, or error/recovery work, read both docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md and docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md.
4. Do not silently reinterpret LOCKED rules.
5. Treat CONFIG values as backend/CMS/store-controlled and do not hardcode them into clients.
6. Preserve existing working architecture unless required by the authority documents or security/correctness.
7. Never make the mobile/web client authoritative for user identity, wallet balance, coin credit, entitlements, subscriptions, pricing, payment verification, rewarded-ad rewards, or playback authorization.
8. Never expose service_role or secrets.
9. Do not add paid dependencies/services without explicit approval.
10. Do not perform broad refactors merely because generated code prefers a different architecture.

## 0nya Agent Skills

Project-specific engineering skills live under `.claude/skills/`.

For every significant engineering task:

- load `0nya-execution`
- load `0nya-current-state`
- load relevant domain skill(s)
- obey root AGENTS.md and its authority documents

Domain routing:

- Android / React Native / Expo → `0nya-android`
- UI / layout / visual work → `0nya-ui-compliance`
- CMS / backend / API → `0nya-backend-cms`
- monetization / auth / coins / subscriptions / security → `0nya-monetization-security`
- playback / access / resume / unlock / Mux → `0nya-playback-access`
- testing / physical device / release → `0nya-qa-device`
- git / working tree → `0nya-git-safety`
- session/model/context transfer → `0nya-handover`

Multiple skills may apply to one task.

Current verified implementation state lives under:

`docs/agent-state/`

Agents must use these state documents to avoid re-discovering or
reimplementing completed systems, but must verify relevant state against the
current repository before editing.

Skills and agent-state docs supplement authority documents.

They NEVER override, in order:

1. explicit current user-approved product decisions
2. root AGENTS.md
3. product/UI/user-flow/security/backend authority documents referenced by AGENTS.md
4. current verified implementation

If documentation is stale, inspect code and correct the state document.

## Current Approved QA Infrastructure — 31 August 2026

Explicit user-approved project decision (31 August 2026). Supersedes stale
references to old Netlify QA API endpoints, local/localhost QA URLs, older
CMS/admin deployment URLs, and uncertain QA hosting.

- QA API / server / backend runtime: `https://onya-qa-api-gwkke6nq5a-el.a.run.app` (Google Cloud Run).
- QA CMS / admin: same Cloud Run host, `/admin/login`.
- Cloud Run: current QA backend/API + CMS/admin hosting.
- Netlify: website / frontend / domain hosting only — NOT the active QA API, QA backend runtime, or CMS/admin backend.
- Supabase: database / data layer. Preserve it; never point physical Android QA at localhost Supabase.
- Mux: approved video/media infrastructure.
- Android playback: expo-video (preserve).
- Physical QA: Android API calls go to the Cloud Run QA API, never an old Netlify QA address.

Provider/hosting approval does NOT prove production readiness (signed playback
authorization, CDN/security config, media provisioning, RLS correctness, every
API route health, deployment readiness). Verify those separately as:
IMPLEMENTED / PARTIALLY IMPLEMENTED / MISSING / EXTERNALLY BLOCKED / DEFERRED /
UNKNOWN / NOT PROVEN.

Mandatory bounded physical-device testing discipline (timeboxes, anti-loop, build
identity, no-hallucination evidence, timer report):
`.claude/skills/0nya-qa-device/SKILL.md`.

## Locked Final Acceptance Protocol — 31 August 2026

Explicit user-approved project decision (31 August 2026). Mandatory protocol for all consumer App and CMS final acceptance. This ordering must NEVER be reversed or bypassed.

### A. Consumer App / UI Acceptance Sequence

```
SOURCE -> EMULATOR -> SCREENSHOTS -> PRODUCT OWNER + CHATGPT REVIEW -> REFINEMENT LOOP (to tiniest detail) -> PHYSICAL ONEPLUS FINAL CHECK -> LOCK / VERIFIED COMPLETE
```

1. **SOURCE:** Verify implementation (diff, typecheck, lint, targeted tests, state/API). Maximum status: `SOURCE VERIFIED`.
2. **EMULATOR:** Run Android candidate on emulator. Maximum status: `EMULATOR VERIFIED`.
3. **SCREENSHOTS:** Capture actual emulator-rendered states of the proposed candidate outside Git.
4. **PRODUCT OWNER + CHATGPT REVIEW:** Return screenshots to Product Owner and ChatGPT project conversation. This is the mandatory visual refinement gate covering typography, hierarchy, spacing, alignment, margins, safe areas, geometry, image crop, icons, copy, buttons, visual balance, states, and CMS-fed presentation down to the smallest detail. If changes are requested, repeat `SOURCE -> EMULATOR -> SCREENSHOTS -> REVIEW` until approved. Maximum status: `VISUAL CANDIDATE APPROVED — READY FOR PHYSICAL FINAL CHECK`.
5. **PHYSICAL ONEPLUS:** Real hardware validation (OnePlus 13R / CPH2691 / USB `b94e2903`) verifies the already-approved visual candidate against real hardware, touch, navigation, playback, and network under bounded timeboxes. If hardware reveals a defect, return through the full refinement loop.
6. **LOCK:** Item becomes `VERIFIED COMPLETE` + `LOCKED BASELINE` only after: `SOURCE PASS` + `EMULATOR PASS` + `SCREENSHOTS REVIEWED` + `PRODUCT OWNER APPROVED` + `CHATGPT APPROVED` + `PHYSICAL ONEPLUS PASS`.

### B. CMS Acceptance Sequence

```
CMS SOURCE / CONFIG -> DEPLOYED QA BACKEND / API -> ACTUAL CMS WEBSITE RUNTIME CHECK -> SCREENSHOTS / EVIDENCE -> PRODUCT OWNER + CHATGPT REVIEW -> PRODUCT OWNER HANDS-ON CMS WEBSITE CHECK -> LOCK / VERIFIED COMPLETE
```

1. **CMS SOURCE / CONFIG:** Verify code, schema, config. Maximum status: `SOURCE VERIFIED`.
2. **DEPLOYED QA BACKEND / API:** Verify actual Cloud Run QA API responses, persistence, order, and metadata.
3. **CMS WEBSITE RUNTIME:** Run deployed QA CMS website (`/admin/login`, `/admin/home`, etc.), test real UI/controls/save/refresh. Maximum status: `CMS WEBSITE VERIFIED`.
4. **SCREENSHOTS / EVIDENCE + REVIEW:** Capture CMS website states for Product Owner + ChatGPT review.
5. **PRODUCT OWNER HANDS-ON CHECK:** Product Owner personally logs into deployed CMS website, performs operations, and validates persistence/behavior. Agents must never fabricate this human check.
6. **LOCK:** CMS item becomes `VERIFIED COMPLETE` + `LOCKED BASELINE` only after all gates including Owner hands-on pass.

### C. CMS -> Consumer App Integration

CMS lock does not automatically lock rendered Android UI. CMS data affecting the App must pass the full App sequence (`EMULATOR -> SCREENSHOTS -> OWNER+CHATGPT REVIEW -> REFINEMENT -> ONEPLUS -> LOCK`).

### D. Authority & Status Vocabulary

- **No AI agent** (Gemini, Kilo, Nemotron, Claude, Codex, etc.) or automated test runner has authority to grant final visual or CMS operational approval.
- Statuses: `SOURCE VERIFIED`, `EMULATOR VERIFIED`, `CMS/API VERIFIED`, `CMS WEBSITE VERIFIED`, `READY FOR OWNER/CHATGPT REVIEW`, `VISUAL CANDIDATE APPROVED — READY FOR PHYSICAL FINAL CHECK`, `PHYSICAL QA PASS`, `FINAL ACCEPTANCE PENDING`, `VERIFIED COMPLETE`, `LOCKED BASELINE`.

## Shared generic coding guidance

This file is the shared 0nya project and product authority. After the current task and all approved 0nya project, product, and technical authority in this file, agents may apply the generic guidance in [`KARPATHY_GUIDELINES.md`](KARPATHY_GUIDELINES.md). The generic guidance never overrides this file or its referenced authority documents.
