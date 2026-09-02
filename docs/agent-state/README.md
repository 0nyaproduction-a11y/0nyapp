# 0nya Agent State Documentation

Purpose of this directory: give a new Claude Code or OpenCode agent a
verified, evidence-backed understanding of what 0nya is, what exists, what
works, what is pending, and where authority lives — without re-discovering
the repository.

These documents are **navigation aids and snapshots**, not authority.

## Authority hierarchy

Never override, in order:

1. explicitly approved current product decisions
2. root `AGENTS.md`
3. authority documents referenced by `AGENTS.md`:
   - `docs/0nya_PRODUCT_UIUX_BIBLE_v3.0.md`
   - `docs/0nya_MASTER_USER_FLOW_v1.1_ALL_IN_ONE.md`
   - supporting: `docs/0nya_APP_ARCHITECTURE_v1.0.md`,
     `docs/0nya_BACKEND_API_CONTRACT_v1.0.md`,
     `docs/0nya_CMS_PRODUCT_CONTRACT_v1.0.md`,
     `docs/0nya_DESIGN_SYSTEM_v1.0.md`,
     `docs/0nya_UI_WIREFRAMES_ALL_SCREENS_v1.0.md`,
     `docs/0nya_SECURITY_PRIVACY_COMPLIANCE_RELEASE_v1.0.md`,
     `docs/0nya_VIDEO_PLAYBACK_ARCHITECTURE_v1.0.md`
4. current verified implementation

If a state document conflicts with current code or a higher authority,
inspect the discrepancy. Correct the state document; never assume the code
is wrong without evidence.

## Status vocabulary

Use these terms precisely, adhering to the **Locked Final Acceptance Protocol** in `AGENTS.md`:

- **SOURCE VERIFIED** — verified at code, lint, typecheck, and unit test level
- **EMULATOR VERIFIED** — verified on Android emulator
- **CMS/API VERIFIED** — verified on deployed QA API/database
- **CMS WEBSITE VERIFIED** — verified on deployed CMS web runtime
- **READY FOR OWNER/CHATGPT REVIEW** — screenshots captured, awaiting review
- **VISUAL CANDIDATE APPROVED — READY FOR PHYSICAL FINAL CHECK** — approved by Product Owner + ChatGPT down to smallest detail
- **PHYSICAL QA PASS** — verified on real OnePlus 13R hardware
- **FINAL ACCEPTANCE PENDING** — awaiting required human acceptance gate
- **VERIFIED COMPLETE** / **LOCKED BASELINE** — all protocol gates satisfied
- **PARTIAL** — implemented but incomplete or not fully verified
- **PENDING** — planned or in progress, not yet implemented/landed
- **BLOCKED** / **EXTERNALLY BLOCKED** — cannot proceed due to a specific blocker
- **UNVERIFIED** / **UNKNOWN FROM REPOSITORY** — cannot be confirmed from repository evidence

Never mark work `VERIFIED COMPLETE` or `LOCKED BASELINE` without satisfying every stage of the locked sequence. No AI agent has authority to self-approve final visual or operational deliverables.

Sources of evidence, in priority order:

1. explicit product decisions in `AGENTS.md`
2. authority documents referenced by `AGENTS.md`
3. current source code
4. tests
5. configuration
6. git history where useful
7. current git working tree
8. existing handover/status documents
9. comments only when consistent with implementation

If something cannot be verified, write `UNVERIFIED` or `UNKNOWN FROM
REPOSITORY`. Do not guess, and do not turn assumptions into documentation.

## When and how to update

- Load the relevant documents before significant implementation (see
  `.claude/skills/0nya-current-state/SKILL.md`).
- After a significant milestone, update ONLY the relevant document(s) when
  the repository's actual state has materially changed.
- Never record planned work as completed.
- Keep `SYSTEM_MAP.md` and the per-subsystem snapshots consistent with one
  another and with the current working tree.
- Generate updates from repository evidence, not from memory.

## Index

| Document | When to read |
| --- | --- |
| `SYSTEM_MAP.md` | Always first — repo structure, flows, authority map, entry points, API surface, env names |
| `ANDROID_CURRENT_STATE.md` | Android consumer app, navigation, Home, Player, auth, deep links, wallet/subscription UI, rewarded-ads client |
| `CMS_BACKEND_CURRENT_STATE.md` | CMS/admin, backend APIs, Supabase integration, editorial controls |
| `MONETIZATION_CURRENT_STATE.md` | Free access, coins, wallet, unlocks, subscriptions, rewarded ads, entitlements, payment verification, playback authorization |
| `RELEASE_CURRENT_STATE.md` | Builds, tests, device validation, branch state, release blockers |