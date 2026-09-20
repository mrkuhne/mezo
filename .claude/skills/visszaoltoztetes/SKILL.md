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
   **Read §3.4 ("Depth and focus") before every design pass** — see the rule below.

## The one rule every slice has got wrong (§3.4)

**A wash tile is loud only next to something that isn't one.**

Every re-dress slice so far made the same first-pass mistake: turning *every* surface into a
§2.2 A wash tile. The result reads **flatter than the Titanium screen it replaced**, every
time. Titanium bought depth cheaply, with a dark ground and a glow; the restored world buys it
with **contrast between the three material grades** — which only works when all three are on
screen at once.

So the design pass ALWAYS starts by ranking, not by styling:

1. Name the ONE thing the screen says. That gets the loud treatment (the wash tile, or the
   `--gradient-cta` primary if it is an action).
2. Demote everything else by one grade: wash tile → house row (`--surface-1` +
   `inset 0 0 0 1px var(--border-subtle)`) → cell/chip. Empty/free states take the §4.4 dashed
   neutral outline and no shadow.
3. Let the hero's graphic be genuinely big — the §3.2 numeral at weight 200 *and* its drawing
   at real size. Decoration-sized art makes a hero read as a header.
4. Check 320px after any size or weight step-up (A.2 rule 5).

If a slice's before/after shows the new version reading flatter or quieter than the Titanium
one, this is why — do not reach for a darker ground, re-rank the surfaces.

Screens re-dressed BEFORE this rule existed still wear the flat all-wash pass; `mezo-ju4j6.19`
is the sweep that ranks them. Do not silently fix them inside another slice — note them there.

## Procedure

1. The epic is `mezo-ju4j6` (children `mezo-ju4j6.1`–`.19`; fallback lookup:
   `bd list --labels epic:boop-visszaoltoztetes`).
   Run `bd ready` and pick the epic child the plan's dependency order marks next; if several
   are unblocked, take the lowest phase number. `bd show <id>` for its instructions.
2. If NO child is unblocked but open children exist, report which bead blocks progress and
   stop. If ALL children are closed, run the plan's Task 9 close-out checks and close the epic.
3. `bd update <id> --claim`. Work in an isolated worktree on `feat/<topic>` (superpowers:using-git-worktrees).
4. Execute the plan section for that task with superpowers:executing-plans discipline. Re-dress
   tasks start with the in-session design pass (which opens with the §3.4 ranking above, not
   with styling); behavior is frozen — visual changes only.
   **Offer the owner a before/after prototype before writing code** when the slice changes how
   a screen reads — one HTML page, the SAME markup cloned into a "now" and a "proposed"
   column, so the comparison can only be about the skin. `docs/design_2.0/prototypes/redress/`
   holds them; `2026-09-20-terv-terheles-before-after.html` is the working pattern (it reads
   the real `prototype.css` and the real `bodyGeometry.gen.ts`, so what he sees is what ships).
   Two traps that cost a round each: `prototype.css` locks the document scroller
   (`html, body { overflow: hidden }`) — the lab has to unlock it or the page cannot scroll;
   and the clay sprite must be hidden with `position:absolute;width:0;height:0` rather than
   `display:none`, or its gradient fills never resolve.
5. Gates (house rules, non-negotiable): FE tests in both modes (`VITE_USE_MOCK` unset = mock,
   `=false` = real, `CI=true`), affected `frontend/tests/layout` specs, `verify`-skill runtime
   pass, reverse parity checklist pasted into the bd issue (re-dress tasks), CSS section +
   `prototypeCssStructure.test.ts` moved in the same commit, CODEMAP regen after moves and
   after every merge. Then merge per the **"no-wait, net stays"** flow (AGENTS.md §Git
   Workflow): local gates → `--no-ff` merge to main → push; no PR, no CI wait. CI runs on
   main as the safety net — if main is red at session start, fixing it comes first.
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
