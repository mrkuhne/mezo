---
name: executing-plans
description: Use when a checkboxed implementation plan exists. Executes it task by task with verification gates and per-task commits.
---

# Executing Plans

1. Work in a git worktree on a feat/<topic> branch, never on main.
2. Load the plan file. Execute ONE task at a time, steps in order, checking off boxes
   in the plan file as you go.
3. Follow steps EXACTLY. If a step conflicts with reality (file moved, API differs),
   STOP the task, state the conflict, and ask before improvising.
4. Run every verification command a step names; paste the actual output before claiming
   the step done. A test that was expected to fail MUST be seen failing first.
5. Commit exactly where the plan says. Never batch multiple tasks into one commit.
6. ESCALATION RULE: two stalls on the same task, or the same failure twice → stop,
   summarize the blocker, log a bd comment. Do not thrash.
7. After the last task: run the full local gates from AGENTS.md (Build & Test section),
   then follow the Git Workflow (push → self-PR → CI green).
