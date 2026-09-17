---
name: visszaoltoztetes
description: Session driver for the Boop visszaöltöztetés program (Titanium visual rollback, functionality kept). Use when the user invokes /visszaoltoztetes or asks to continue the visszaöltöztetés / Titanium rollback work — picks the next unblocked bead of the boop-visszaoltoztetes epic, loads its context, and executes it through the house gates.
---

# Visszaöltöztetés session driver

You are continuing a multi-session program: re-dress the app from the rejected Titanium skin
back to the pre-Titanium design_2.0 (Mozaik/Clay) world while keeping ALL functionality
shipped during the Titanium period. Forward-fix only — never revert functional code.

## Canon (read in this order, every session)

1. Spec: `docs/superpowers/specs/2026-09-17-boop-visszaoltoztetes-design.md` (keep-list /
   kill-list / traps)
2. Program plan: `docs/superpowers/plans/2026-09-17-boop-visszaoltoztetes.md` (your task's
   section = your instructions)
3. Style bible (once Task 1 has merged):
   `docs/design_2.0/2026-09-17-restored-world-style-bible.md` — the ONLY styling reference
   for re-dress work. Do not restyle from memory or from Titanium docs.

## Procedure

1. The epic is `mezo-ju4j6` (children `mezo-ju4j6.1`–`.16`; fallback lookup:
   `bd list --labels epic:boop-visszaoltoztetes`).
   Run `bd ready` and pick the epic child the plan's dependency order marks next; if several
   are unblocked, take the lowest phase number. `bd show <id>` for its instructions.
2. If NO child is unblocked but open children exist, report which bead blocks progress and
   stop. If ALL children are closed, run the plan's Task 9 close-out checks and close the epic.
3. `bd update <id> --claim`. Work in an isolated worktree on `feat/<topic>` (superpowers:using-git-worktrees).
4. Execute the plan section for that task with superpowers:executing-plans discipline. Re-dress
   tasks start with the in-session design pass; behavior is frozen — visual changes only.
5. Gates (house rules, non-negotiable): FE tests in both modes (`VITE_USE_MOCK` unset = mock,
   `=false` = real, `CI=true`), affected `frontend/tests/layout` specs, `verify`-skill runtime
   pass, reverse parity checklist pasted into the bd issue (re-dress tasks), CSS section +
   `prototypeCssStructure.test.ts` moved in the same commit, CODEMAP regen after moves and
   after every merge. Self-PR → CI green → `gh workflow run premerge.yml -f pr=<n>` →
   `--no-ff` local merge → push main → delete branch.
6. Close the bead with a result summary. Session close: `node scripts/check-beads-backup.mjs --fix`,
   `bd dolt push`, `git push`, `git status` up to date.
7. Report to the owner IN HUNGARIAN, business language (CLAUDE.md §Communication): what got
   done in user-visible terms, what comes next, roughly how many steps remain.

## Model guidance

Beads are labeled `model:strong` (Opus/Fable — design judgment, first-of-kind exemplars) or
`model:fast` (Sonnet — repeating an established pattern). If the running session's model is
weaker than the label asks, say so to the owner before starting instead of silently proceeding.

## Traps (short list — full list in the spec)

- Never restore whole directories from git history; GlassBox (keep!) lives in the mozaik kit.
- prototype.css line anchors drift — locate by section markers.
- Tutorial registry anchors the DOM you are changing — grep it per touched page.
- The old Fuel/Train page code exists only in git history (≤ v2.243) — reference, not restore.
