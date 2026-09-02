---
name: 0nya-ui-compliance
description: Use whenever creating, modifying, reviewing, or visually validating 0nya UI, layouts, typography, spacing, artwork, CTAs, motion, screens, or responsive behavior.
---

# 0nya UI Compliance

Load:

- `0nya-execution`
- `0nya-current-state`

Read relevant product/UI authority documentation.

## Product decisions win

Never invent a redesign.

Never substitute generic "best practice" for a locked 0nya decision.

Explicit approved product direction outranks agent taste.

## Narrow visual fixes

A narrow UI task must not alter unrelated:

- geometry
- navigation
- neighboring components
- carousel behavior
- state
- data flow
- API behavior
- playback
- typography
- spacing

## Motion

Do not add decorative motion unless explicitly approved.

Do not independently introduce:

- auto carousels
- card scale animations
- entrance animation
- animated progress
- decorative transitions

## Dynamic values

CMS/backend-controlled values remain dynamic.

Do not replace them with hardcoded client decisions.

## Visual verification & Locked Final Acceptance Protocol

All consumer App UI visual acceptance must strictly adhere to the **Locked Final Acceptance Protocol** in `AGENTS.md`. This order must NEVER be reversed or bypassed:

```
SOURCE -> EMULATOR -> SCREENSHOTS -> PRODUCT OWNER + CHATGPT REVIEW -> REFINEMENT LOOP (to tiniest detail) -> PHYSICAL ONEPLUS FINAL CHECK -> LOCK / VERIFIED COMPLETE
```

1. **SOURCE:** Verify implementation (diff, typecheck, lint, targeted tests, state/API) -> `SOURCE VERIFIED`.
2. **EMULATOR:** Run candidate on emulator -> `EMULATOR VERIFIED`.
3. **SCREENSHOTS:** Capture actual emulator-rendered states of the candidate outside Git.
4. **PRODUCT OWNER + CHATGPT REVIEW:** Return screenshots to Product Owner and ChatGPT project conversation for visual refinement down to the smallest detail (typography, spacing, margins, crop, icons, copy, buttons, balance, states). If changes requested, iterate `SOURCE -> EMULATOR -> SCREENSHOTS -> REVIEW`. When approved -> `VISUAL CANDIDATE APPROVED — READY FOR PHYSICAL FINAL CHECK`.
5. **PHYSICAL ONEPLUS:** Real hardware validation (OnePlus 13R / CPH2691 / USB `b94e2903`) verifies the already-approved candidate on hardware under bounded timeboxes.
6. **LOCK:** Item becomes `VERIFIED COMPLETE` + `LOCKED BASELINE` only after: `SOURCE PASS` + `EMULATOR PASS` + `SCREENSHOTS REVIEWED` + `PRODUCT OWNER APPROVED` + `CHATGPT APPROVED` + `PHYSICAL ONEPLUS PASS`.

No AI agent (Gemini, Kilo, Nemotron, Claude, Codex, etc.) has authority to self-approve final visual acceptance.

Do not report visual PASS when required visual verification was not performed.