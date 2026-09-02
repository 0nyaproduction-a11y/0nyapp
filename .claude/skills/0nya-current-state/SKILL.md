---
name: 0nya-current-state
description: Use before significant 0nya implementation to load the latest verified repository state, completed systems, pending work, system map, and subsystem handovers without re-discovering the project.
---

# 0nya Current State

Before significant implementation, read the relevant documents under:

`docs/agent-state/`

Always start with:

`docs/agent-state/SYSTEM_MAP.md`

Then load only the relevant current-state document:

- Android: `ANDROID_CURRENT_STATE.md`
- CMS/backend: `CMS_BACKEND_CURRENT_STATE.md`
- Coins/subscription/access: `MONETIZATION_CURRENT_STATE.md`
- release/readiness: `RELEASE_CURRENT_STATE.md`

## Current-state documents are navigation aids

They do NOT override:

1. explicit current user decisions
2. `AGENTS.md`
3. authority documents referenced by `AGENTS.md`
4. actual current code

If a current-state document conflicts with current code:

inspect the discrepancy.

Do not blindly trust stale status documentation.

## Before editing

Confirm the relevant documented state against:

- current source
- current git diff
- current configuration

Do not redo completed systems merely because the current task touches nearby code.

## Updating current state

After a significant milestone:

update ONLY the relevant agent-state document when the repository's actual
state has materially changed.

Never record planned work as completed.

Use:

- SOURCE VERIFIED
- EMULATOR VERIFIED
- CMS/API VERIFIED
- CMS WEBSITE VERIFIED
- READY FOR OWNER/CHATGPT REVIEW
- VISUAL CANDIDATE APPROVED — READY FOR PHYSICAL FINAL CHECK
- PHYSICAL QA PASS
- FINAL ACCEPTANCE PENDING
- VERIFIED COMPLETE
- LOCKED BASELINE
- PARTIAL
- PENDING
- BLOCKED
- UNVERIFIED

precisely, per the **Locked Final Acceptance Protocol** in `AGENTS.md`.