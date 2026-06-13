#!/usr/bin/env bash
# Ralph loop for Kickback AI. Run from INSIDE the cloned opencode fork repo,
# with CLAUDE.md, sdk-and-env-reference.md, ralph-prompt.md, .env at the repo root.
# Launch awake-all-night with:  caffeinate -dims ./ralph.sh 40
set -uo pipefail

MAX_ITERS=${1:-40}
SENTINEL="ALL_TASKS_COMPLETE"
PROMPT_FILE="ralph-prompt.md"
LOG_DIR=".ralph/logs"
mkdir -p "$LOG_DIR"

prev_head=""
stall=0

for i in $(seq 1 "$MAX_ITERS"); do
  echo "=== Ralph iteration $i / $MAX_ITERS @ $(date) ==="
  out="$LOG_DIR/iter-$i.log"

  # ONE fresh agent: headless (-p), bypass prompts, auto-reads CLAUDE.md
  cat "$PROMPT_FILE" | claude -p --dangerously-skip-permissions 2>&1 | tee "$out"

  # The LOOP owns git (the agent is told NOT to commit, per CLAUDE.md): stage
  # everything, commit UNSIGNED so GPG can't hang the unattended loop, then push.
  # .env and .ralph/ are gitignored, so secrets and logs never get committed.
  if [ -n "$(git status --porcelain)" ]; then
    msg=$(head -n 1 .ralph/commit-msg.txt 2>/dev/null)
    [ -z "$msg" ] && msg="chore(ralph): iteration $i autosave"
    git add -A
    git commit --no-gpg-sign -m "$msg" 2>&1 | tee -a "$out"
    git push origin main 2>&1 | tee -a "$out"
    rm -f .ralph/commit-msg.txt
  fi

  # completion: agent prints the sentinel ALONE ON A LINE only when all tasks pass.
  # Whole-line match (grep -x) so a mere MENTION in prose ("not printing X yet")
  # can't false-trigger completion.
  if grep -qxE "[[:space:]]*${SENTINEL}[[:space:]]*" "$out"; then
    echo ">>> Sentinel found. Ralph complete at iteration $i."
    break
  fi

  # thrash guard: stop if two iterations in a row produce no new commit
  head=$(git rev-parse HEAD 2>/dev/null || echo "nogit")
  if [ "$head" = "$prev_head" ]; then
    stall=$((stall + 1))
    echo ">>> No new commit (stall=$stall)."
    [ "$stall" -ge 2 ] && { echo ">>> Stalled with no progress. Stopping for human review."; break; }
  else
    stall=0
  fi
  prev_head="$head"

  sleep 5
done
echo "=== Ralph ended @ $(date). Read PROGRESS.md and $LOG_DIR/ in the morning. ==="
