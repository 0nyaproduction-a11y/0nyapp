# 0nya Agent Workflow & Division of Labor

Operational guidance for which agent does what, plus the verified Groq Qwen
limitation that shapes prompt design. This supplements the skills in
`.claude/skills/` and the authority hierarchy in `README.md` of this
directory. It never overrides explicit user-approved product decisions,
`AGENTS.md`, or the authority documents.

## Groq Qwen 3.8 27B — verified limitation (tested inside Continue)

The Groq account has a large daily token allowance, but the current tier has
a much smaller practical per-request/per-minute token ceiling.

### Observed failure: 413 Request too large

- Groq reported approximately: TPM limit ~8,000, requested ~32,867.
- Continue also injects tool/context/history, so large repository prompts can
  exceed the Groq limit before Qwen even begins inference.

### Observed failure: "continue" is not reliable

When Qwen hits its output/completion limit:

- the context must stay small to fit the Groq token ceiling,
- so the next request may no longer contain enough of the previous
  conversation/tool history,
- the user sends "continue",
- Qwen cannot recover enough prior context and behaves as if starting a fresh
  task or re-audits the repository.

CONSEQUENCE: do not design Qwen work that depends on multi-turn
continuation.

## Qwen role change

Groq Qwen must NOT be treated as:

- primary long-context full-app agent
- autonomous whole-repository completion agent
- multi-hour Android debugging agent
- long multi-stage release agent
- agent that must preserve state over many "continue" turns

Qwen is instead a FAST ATOMIC SPECIALIST / REVIEWER.

Good Qwen tasks:

- inspect one screen
- review one diff
- identify one UI gap
- fix one bounded bug
- audit one endpoint
- inspect one CMS form
- review one backend function
- write/test one small unit
- review Nemotron/Kilo changes
- perform one small release/config audit

Bad Qwen tasks:

- audit the whole 0nya repository in one request
- complete Build 15
- finish several screens together
- carry a long Android build/debug investigation
- own a task requiring many continuation messages
- read all authority documents every turn

## Qwen prompt discipline

Every Qwen task must be ATOMIC and independently completable in one turn.

Prompts should explicitly say:

- DO NOT narrate repository exploration.
- DO NOT produce a long plan.
- Use tools silently.
- Complete ONLY this task.
- Keep the final answer concise.
- Do not rely on a later "continue" message.
- If the task cannot be completed in this turn, STOP before broad edits and
  report BLOCKED.

Each task prompt should contain only:

- relevant authority rule/section
- relevant file(s)
- exact task
- prohibited changes
- validation
- short fixed report format

Do NOT send the entire 0nya history or all authority documents unless
absolutely necessary.

## Recommended Continue config for Groq Qwen

Use conservative limits appropriate to the observed Groq ceiling. Approximate
target:

- contextLength: ~4500
- maxTokens: ~2500
- temperature: 0.1

If requests still hit Groq token/rate limits, reduce context/output further.

Do not return to very large values (e.g. contextLength 131000, maxTokens
16384) for this Groq tier. The exact model capability may be larger, but the
CURRENT GROQ ACCOUNT/RATE TIER is the practical constraint.

## Updated agent division

| Agent | Role |
| --- | --- |
| Nemotron 3 Ultra / Continue | PRIMARY ANDROID COMPLETION AGENT — long-context Android work, multi-stage debugging, physical-device verification, ADB/Gradle/Logcat, UI implementation across controlled batches, tasks requiring continuity across turns |
| Kilo | PRIMARY BACKEND/CMS/SUPABASE AGENT — CMS/admin, backend/API, database/migrations, remote QA deployment, server monetization/configuration |
| Groq Qwen 3.8 27B | FAST ATOMIC SPECIALIST / SECOND-OPINION REVIEWER — short code audits, targeted fixes, small backend/CMS checks, diff review, regression review, focused debugging |
| ChatGPT coordinator | product/architecture scope, task sequencing, prompt creation, report review, visual candidate review, conflict prevention between agents |
| Product Owner (User) + ChatGPT | MANDATORY FINAL VISUAL CANDIDATE APPROVAL (per Locked Final Acceptance Protocol in `AGENTS.md`) — no AI coding agent may self-approve final UI or operational CMS state |
| Product Owner (User) | FINAL PRACTICAL HANDS-ON CMS ACCEPTANCE & FINAL PRODUCT DECISIONS |

## Parallel-work safety

- Never let Qwen and Nemotron modify the same files at the same time.
- Never let Qwen and Kilo modify the same backend/CMS files at the same time.
- Qwen is especially useful AFTER another agent makes a patch:

```
authority rule
+ relevant current file
+ git diff
→ Qwen performs a concise regression / product-rule review
```

This is preferred over asking Qwen to retain the entire application context.

## Current verdict

Qwen is still useful for 0nya. Its limitation is CONTEXT/SESSION CONTINUITY
under the current Groq tier, not necessarily coding intelligence.

Treat it as:

ATOMIC TASK AGENT — NOT — FULL-PROJECT MEMORY AGENT.

Do not plan future 0nya completion around Qwen maintaining long
conversations.

## Cross-reference

- Prompt/output discipline for Claude/OpenCode agents: `.claude/skills/0nya-execution/SKILL.md`.
- Session handover (for continuation-capable agents):
  `.claude/skills/0nya-handover/SKILL.md`.
- Repository map and authority: `SYSTEM_MAP.md` and this directory's
  `README.md`.