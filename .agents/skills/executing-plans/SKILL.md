---
name: executing-plans
description: Use when a checkboxed implementation plan exists. Executes it task by task with verification gates and per-task commits.
---

# Executing Plans

1. Isolate FIRST, before reading the plan: run `/worktree new <topic>` (or start the session
   with `hermes -w`), then verify with `git branch --show-current` — it must print a
   `feat/<topic>`-style branch, never `main`. If it prints `main`, STOP and create the
   worktree; a pre-commit guard rejects commits on main anyway.
2. Before the first task, register the plan's gates as goal gates so the harness enforces
   them: `/goal gate add "<exact gate command from the plan>"` for each gate (backend
   `cd backend && ./mvnw clean test -Dtest=...`, frontend `cd frontend && pnpm test`, docs
   `node scripts/lint-docs.mjs`). A failing gate's output becomes your next instruction.
3. Load the plan file. Execute ONE task at a time, steps in order, checking off boxes
   in the plan file as you go. Orient with the plan's file list — not by grepping the tree.
   Context budget: at most TWO tasks per session; after committing a task, if the
   conversation is long (many test outputs), run `/compress` before the next task or stop
   and hand off — a local model past ~100K tokens slows to a crawl and derails.
4. Follow steps EXACTLY. If a step conflicts with reality (file moved, API differs),
   STOP the task, state the conflict, and ask before improvising.
5. Run every verification command a step names; paste the actual output before claiming
   the step done. A test that was expected to fail MUST be seen failing first.
6. Tasks that are independent of each other (no shared files, no produced/consumed
   interface between them) may be delegated in parallel with `delegate_task` — pass the
   full task text as the goal. Dependent tasks: never.
7. Keep every file-writing tool call ≤ ~150 lines (write the skeleton, then `patch` in
   sections) — the local server buffers tool-call arguments until complete; long writes look
   like a dead stream. Commit exactly where the plan says. Never batch multiple tasks into one commit.
8. ESCALATION RULE: two stalls on the same task, or the same failure twice → stop,
   summarize the blocker, log a bd comment. Do not thrash.
9. After the last task: run the full local gates from the house-rules doc (AGENTS, repo root;
   Build & Test section), then `git push -u origin <branch>` and OPEN A PULL REQUEST with
   `gh pr create` — title = the driving bd id + one line; body = what changed (per task, with
   commit hashes), the actual gate output (test counts, both FE modes), every deviation from
   the plan and why, and anything a human must still do. **Never merge.** Daniel reviews the
   PR and merges it himself; report the PR URL and stop.
