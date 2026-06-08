You are ONE iteration of an autonomous overnight build loop for Kickback AI.
Your context is fresh every iteration — your memory lives on disk, not in this conversation.

## 1. Orient (always do this first)
- Read CLAUDE.md (rules + "Scope for tonight" task list) and sdk-and-env-reference.md.
- If PROGRESS.md does not exist, create it from CLAUDE.md's task list (all tasks unchecked).
- Read PROGRESS.md and `git log --oneline -15` to see what is already done.

## 2. Do EXACTLY ONE task
- Pick the SINGLE next unfinished task from the tonight scope. Do not start others. Do not redo or
  revert completed work.
- Implement only that task, following the Unlink reference tutorial and sdk-and-env-reference.md.
- VERIFY before claiming done: run `bun install` if needed, then build + any unit tests / typecheck.
  A task counts as done ONLY if it builds and its tests pass. If you cannot verify it, leave it
  unfinished and record exactly why. NOTE: the repo ROOT `bun test` is disabled on purpose —
  use `bun turbo typecheck`, and run unit tests INSIDE the specific package dir, never at the root.
- Do NOT run git yourself — the loop harness commits (unsigned) and pushes after you exit. Write a
  one-line conventional-commit subject (e.g. `feat(tui): add status-line ad slot`) to `.ralph/commit-msg.txt`.
- Update PROGRESS.md: mark the task done (or blocked + reason) and name the single next task.

## 3. Stop
- STOP after one task. Do not keep working into the next one.

## Hard rules (obey CLAUDE.md)
- Never fabricate chain IDs, addresses, keys, package names, or SDK signatures. Unknown -> TODO(human).
- HALT-AND-TODO on missing keys/funds; build against the mock providers instead. Never fake a working
  integration.
- Live testnet calls: AT MOST ONE end-to-end smoke test for the whole night, never inside the loop.
- Stay inside this directory. No destructive commands. Decimals: native gas 18, ERC-20 USDC 6.

## Completion
When — and ONLY when — every task in CLAUDE.md's tonight scope is done, builds, and tests pass,
print this exact token on its own line: ALL_TASKS_COMPLETE
