---
name: 0nya-android
description: Use for 0nya consumer Android, React Native, Expo, navigation, Home, Series, Player, Wallet, Profile, playback UI, Android builds, ADB, and physical-device work.
---

# 0nya Android Consumer Application

Load:

- `0nya-execution`
- `0nya-current-state`

Read relevant product/UI/user-flow authority documents.

## Boundary

This skill owns Android consumer implementation.

Do NOT silently modify:

- CMS
- backend
- Supabase schema
- RLS
- authoritative monetization state
- production data

If Android investigation proves a server problem:
report the cross-boundary requirement.

## Preserve

Preserve existing:

- navigation
- API contracts
- playback history
- resume behavior
- storage systems
- config systems
- authentication boundaries
- deep linking
- working UI behavior

Do not create duplicate systems.

## Client authority

Android must never become authoritative for:

- identity
- balances
- coin credits
- subscription state
- entitlements
- pricing
- purchase verification
- rewarded-ad rewards
- playback authorization

## Expo version note

`apps/android/AGENTS.md` requires reading the versioned Expo docs for the
installed SDK before writing Expo code. Read it before any Expo work.

## Native/dependency discipline

Before adding packages or native code:

inspect whether existing capability already exists

(e.g. `billing/`, `adMob.tsx`, `expo-video`, `expo-secure-store`).

Do not add dependencies without explicit justification and approval where
repository rules require approval.

## Verification & Final Acceptance

Android consumer acceptance strictly obeys the **Locked Final Acceptance Protocol** in `AGENTS.md`:

`SOURCE -> EMULATOR -> SCREENSHOTS -> PRODUCT OWNER + CHATGPT REVIEW -> REFINEMENT -> PHYSICAL ONEPLUS -> LOCK`

Use relevant:

- TypeScript
- lint
- tests
- `git diff --check`
- Android build
- ADB
- Logcat
- UIAutomator
- emulator
- physical Android device

Filter logs.

Do not inject giant Logcat streams into context.

## Physical-device QA

Any physical Android-device work must load:

`0nya-qa-device`

and follow its mandatory bounded timer rules (timeboxes, anti-loop, build
identity, no-hallucination evidence, mandatory timer report). Physical testing verifies the visual candidate *after* Owner + ChatGPT visual approval.

Do not replicate or loosen those timeboxes here.