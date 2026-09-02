---
name: 0nya-handover
description: Use when ending a session, approaching context pressure, switching agents/models, or transferring partially completed 0nya work.
---

# 0nya Session Handover

Do not retell the chat chronologically.

Create an evidence-based continuation package.

Target roughly 500–1000 words.

Include:

```
# STATUS
PASS | PARTIAL | BLOCKED

# Objective

# Verified current state

# Relevant locked decisions

# Root cause
only when established

# Relevant files/symbols

# Files changed

# Exact implementation completed

# Acceptance Gates (Locked Protocol)

For consumer App/UI:
- SOURCE: [PASS / FAIL / N/A]
- EMULATOR: [PASS / FAIL / N/A]
- SCREENSHOTS: [CAPTURED / N/A]
- PRODUCT OWNER REVIEW: [APPROVED / REVISIONS REQUESTED / PENDING]
- CHATGPT REVIEW: [APPROVED / REVISIONS REQUESTED / PENDING]
- REFINEMENT COMPLETE: [YES / NO / N/A]
- PHYSICAL ONEPLUS: [PASS / FAIL / PENDING / N/A]
- FINAL LOCK: [LOCKED BASELINE / PENDING]

For CMS:
- SOURCE/CONFIG: [PASS / FAIL / N/A]
- DEPLOYED QA/API: [PASS / FAIL / N/A]
- CMS WEBSITE: [PASS / FAIL / N/A]
- SCREENSHOTS: [CAPTURED / N/A]
- PRODUCT OWNER REVIEW: [APPROVED / REVISIONS REQUESTED / PENDING]
- CHATGPT REVIEW: [APPROVED / REVISIONS REQUESTED / PENDING]
- OWNER HANDS-ON CMS CHECK: [PASS / PENDING / N/A] (Never fabricate)
- FINAL LOCK: [LOCKED BASELINE / PENDING]

# Verification

# Physical-device evidence
when applicable

# Git state

# Remaining work

# Exact next action

# Do not revisit
```

The next agent must not reimplement items listed under **Do not revisit** unless
new evidence proves regression.