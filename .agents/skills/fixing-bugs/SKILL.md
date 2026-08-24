---
name: fixing-bugs
description: Use for any bug report or small behaviour fix ("X is wrong", "Y should also allow Z") — isolates, reproduces with a failing test, fixes minimally, ships a PR. Skip brainstorming/plans for these.
---

# Fixing Bugs (small, self-contained changes)

1. Isolate FIRST: run `/worktree new <topic>` (or start with `hermes -w`), then
   `git branch --show-current` must print a `feat/<topic>`-style branch — never `main`.
2. Track it: `bd create "<one-line bug title>" -t bug -p 2` and `bd update <id> --claim`.
   Commit subjects carry this id, e.g. `fix(sleep): … (mezo-xxxx)`.
3. Locate, don't grep: `grep -n "^### <feature>" docs/CODEMAP.md` (real feature name, e.g.
   `### sleep`), read that block, then the listed files that own the behaviour. Budget ≤ 8 tool
   calls before you write anything.
4. REPRODUCE before you touch code: write ONE failing test that shows the bug (colocated vitest
   for frontend; an IT extending AbstractIntegrationTest/ApiIntegrationTest for backend).
   Run it, paste the failure. If you cannot reproduce it, STOP and ask — never fix blind.
5. Write the root cause in one sentence as a bd comment, THEN make the minimal fix that turns
   the test green (tdd skill). No drive-by refactors, no unrelated cleanups.
6. Gates (verification-before-completion skill): frontend → `cd frontend && pnpm build && pnpm
   test && VITE_USE_MOCK=true pnpm test`; backend → `cd backend && ./mvnw clean test -Dtest=<ITs>`;
   any new/moved file → `node scripts/gen-codemap.mjs --check`. If the fix changes what a
   `docs/features/<x>.md` describes, edit that section + run `node scripts/lint-docs.mjs`.
7. Ship: `git push -u origin <branch>` and `gh pr create` — body: the bug, the root cause, the
   test that now guards it, gate output. Never merge; report the PR URL and stop.
