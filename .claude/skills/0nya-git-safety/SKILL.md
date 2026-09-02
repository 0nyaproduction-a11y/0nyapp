---
name: 0nya-git-safety
description: Use whenever inspecting or modifying the 0nya git working tree, reviewing diffs, cleaning changes, preparing commits, or working around concurrent agent changes.
---

# 0nya Git Safety

The working tree may contain user work or concurrent agent work.

Never assume an unfamiliar modification is disposable.

## Safe inspection

May run:

- `git status`
- `git status --short`
- `git diff`
- `git diff --check`
- `git diff --stat`
- `git log`
- `git show`
- `git branch`
- `git rev-parse`
- `git ls-files`
- `git grep`

## Explicit approval required

Never automatically:

- `git push`
- force push
- `git reset --hard`
- `git clean`
- `git checkout -- .`
- `git restore .`
- rewrite history
- delete branches
- mass-delete work

Do not commit unless explicitly requested.

## Concurrent work

Before editing:

1. inspect status
2. inspect relevant diff
3. identify pre-existing changes
4. preserve compatible changes

If ownership is ambiguous:

STOP and report overlap.

"Clean the repository" never means blindly delete untracked files.

Classify first.