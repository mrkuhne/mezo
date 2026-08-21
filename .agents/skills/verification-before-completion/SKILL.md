---
name: verification-before-completion
description: Use before claiming ANY work finished, fixed, or passing — evidence before assertions, always.
---

# Verification Before Completion

1. Never say "done/fixed/passing" without having just run the proving command.
2. Minimum gates (from AGENTS.md): backend change → cd backend && ./mvnw clean test;
   frontend change → cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test;
   docs change → node scripts/lint-docs.mjs; any new/moved source file → node
   scripts/gen-codemap.mjs --check (regenerate and commit docs/CODEMAP.md if it changed).
3. Paste the command's tail output (summary lines) with the claim.
4. If a gate fails: report the failure honestly, do NOT rationalize it as unrelated
   without proof (git stash the change, re-run, compare).
5. Work is complete only when: gates green + bd issue updated + docs/ obligations met
   (feature doc touched if behavior changed) + pushed per Git Workflow.
6. Closing reflection (one line each): did this task repeat a 5+ step procedure you will
   do again? → propose a skill (don't create it silently). Did you learn a durable fact
   about the environment? → `bd remember` it (facts), never a skill (procedures).
