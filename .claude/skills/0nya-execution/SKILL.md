---
name: 0nya-execution
description: Mandatory execution discipline for implementation, debugging, audits, fixes, refactors, and verification in the 0nya repository. Use for every engineering task in this project.
---

# 0nya Execution Discipline

Read root `AGENTS.md` before engineering work.

`AGENTS.md` and the authority documents it references outrank this skill.

## Required loop

INSPECT → TRACE → ACT → VERIFY → REPORT

Never implement from assumption.

Before modifying code:

1. Inspect current implementation.
2. Inspect `git status` and relevant diff.
3. Trace existing execution/data flow.
4. Identify root cause when applicable.
5. Choose the smallest production-safe change.
6. Preserve unrelated working behavior.

## No reimplementation

Never:

- rebuild a working system from scratch
- create parallel implementations
- introduce duplicate state/storage/network/authority systems
- broadly refactor to solve a narrow issue
- replace architecture merely because another architecture seems cleaner
- silently discard existing behavior

Existing working implementation wins unless evidence proves it must change.

## Scope

Modify only files required by the current task.

Expand scope only when evidence requires it.

## Execution behavior

You are an execution agent, not a narration agent.

Do not repeatedly narrate future actions.

Maximum two short sentences before a required tool call.

If a tool can answer something, use it.

Do not repeatedly say:

- I will inspect
- let me check
- next I will
- now I need to
- I should verify

If the next action is known, execute it.

## Failure handling

If a command fails:

1. read the actual error
2. change the command or approach
3. retry

Never repeat the identical failed command without changing approach.

After two materially different failures:

STOP.

Report:

BLOCKED: <specific reason>

Then state one concrete next action.

## Completion

Code written != task complete.

Verify relevant behavior according to the **Locked Final Acceptance Protocol** in `AGENTS.md`. No AI agent or automated test runner may grant final visual or CMS operational approval.

Final report:

```
STATUS: PASS | PARTIAL | BLOCKED
Root cause:
Files changed:
Exact implementation:
Verification:
Physical-device evidence if relevant:
Git state:
Remaining/unverified:
```