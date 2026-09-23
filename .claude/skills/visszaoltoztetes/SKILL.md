---
name: visszaoltoztetes
description: SUPERSEDED 2026-09-23 by /uvegesites (the Üveg direction, epic mezo-me75u) — use /uvegesites for any re-dress work. Historical: session driver for the surfaces the Boop visszaöltöztetés (Titanium visual rollback) did not reach. The epic mezo-ju4j6 itself CLOSED 2026-09-21 — this skill now drives the leftover re-dress beads labelled epic:boop-visszaoltoztetes. Use when the user invokes /visszaoltoztetes or asks to continue the visszaöltöztetés / Titanium rollback work.
---

# Visszaöltöztetés session driver — the remaining surfaces

> **SUPERSEDED 2026-09-23.** The owner moved the direction to **Üveg** (Mozaik colors +
> Titanium material, dark only). Use **`/uvegesites`**. `mezo-z5lov` (emoji) is folded into
> slice U11 of epic `mezo-me75u`; `mezo-17vnf` (dead module) is a plain chore anyone can take.

> **The programme is finished; the app is not uniformly finished.** Epic `mezo-ju4j6`
> (19 beads, 2026-09-17 → 2026-09-21) closed: shell, navigation, GlassBox, all of Fuel,
> Nap/Mai, all of Train, both ceremonies, the Boop character, and the app-wide §3.4 ranking
> sweep are in the restored Mozaik/Clay world, with no functionality lost. **Do not re-run the
> programme, and do not re-close the epic.**
>
> What is left is a short list of surfaces that were never in any slice's scope. This skill
> drives those, under the same rules that made the programme work.

Re-dress means: move a surface off the rejected Titanium skin onto the restored pre-Titanium
design_2.0 (Mozaik/Clay) world, **keeping every piece of functionality**. Forward-fix only —
never revert functional code, never `git revert` a Titanium-period commit.

## Canon (read in this order, every session)

1. **Style bible: `docs/design_2.0/2026-09-17-restored-world-style-bible.md`** — the ONLY
   styling reference. Never restyle from memory, and never from a Titanium doc.
   **Read §3.4 ("Depth and focus") before every design pass** — the rule below.
   Appendices **A–E** are the accumulated slice lessons (A = Fuel, B = Nap, C/C.1/C.2 = Train,
   D = the ranking sweep, E = the quick-log surface). Read the appendix nearest your surface: each one exists because a
   slice paid for it.
2. **Spec: `docs/superpowers/specs/2026-09-17-boop-visszaoltoztetes-design.md`** — the
   keep-list / kill-list / traps. Still the authority on *what must not be lost*.
3. **`docs/design_2.0/README.md`** — the index: which docs are living canon and which are
   history-only parity sources. It also names the surfaces the rollback did not reach.

**The programme plan (`docs/superpowers/plans/2026-09-17-boop-visszaoltoztetes.md`) is DONE.**
Read it for precedent, never for instructions: your instructions are in the bead.

## The one rule every slice got wrong (§3.4)

**A wash tile is loud only next to something that isn't one.**

Every re-dress slice's first pass made the same mistake: turning *every* surface into a §2.2 A
wash tile. The result read **flatter than the Titanium screen it replaced**, every time.
Titanium bought depth cheaply, with a dark ground and a glow; the restored world buys it with
**contrast between the three material grades** — which only works when all three are on screen.

So the design pass ALWAYS starts by ranking, not by styling:

1. Name the ONE thing the screen says. That gets the loud treatment (the wash tile, or the
   `--gradient-cta` primary if it is an action).
2. Demote everything else by one grade: wash tile → house row (`--surface-1` +
   `inset 0 0 0 1px var(--border-subtle)`) → cell/chip. Empty/free states take the §4.4 dashed
   neutral outline and no shadow.
3. Let the hero's graphic be genuinely big — the §3.2 numeral at weight 200 *and* its drawing
   at real size. Decoration-sized art makes a hero read as a header.
4. Check 320px after any size or weight step-up (A.2 rule 5).

If your before/after shows the new version reading flatter or quieter than the Titanium one,
this is why — do not reach for a darker ground, re-rank the surfaces.

**Two corollaries from the sweep** (Appendix D rules 23–24), both likely on the surfaces that
are left:

- **The hierarchy can be a state, not a place.** When a screen has no privileged item (a list
  of equal things), rank by the state that separates them — done vs. still ahead, due vs. later.
- **A wash tile nested inside a wash tile makes both disappear.** Anything inside a §2.2 A
  surface is a cell or a shield, never a second washed, bordered box.

## What is left (the beads this skill drives)

`bd list --label epic:boop-visszaoltoztetes` — note **`--label`, singular**; `--labels` is not
a flag and fails.

| Bead | Surface | Shape of the work |
| --- | --- | --- |
| `mezo-z5lov` (P2) | emoji still rendered on Nap/Én surfaces (`Island`, `ChainEditSheet`, `GoalRecept`, the needs/itemIcon maps) | §2.3 says every glyph is a clay symbol. The needs map is the hard part: six needs, and there the **colour already carries meaning**. |
| `mezo-17vnf` (P3) | dead module `features/train/logic/weeklyLoad.ts` | Pure cleanup; no design pass. Confirm no importer, then delete it with `SPORT_EMOJI` and the two comments that name it. |

**Related but NOT this skill's:** `mezo-n6yqh` (P0) — the level-up overlay and the pre-workout
prep mosaic. Its fix direction changes **behaviour** (fold the level-up content into the
ceremony, retire the prep screen), and this skill's rule is that behaviour is frozen. Its emoji
are a symptom, not the job. If the owner raises it, say so plainly and treat it as its own
piece of work with its own decision, not as a re-dress slice.

## Procedure

1. `bd list --label epic:boop-visszaoltoztetes` — **that listing is the authority**, not
   `bd ready`, which hides `chore`-type beads and would silently drop `mezo-17vnf`. Take the
   lowest-priority-number open bead unless the owner named one. `bd show <id>` —
   **the bead carries the instructions**, the old programme plan does not.
2. **If nothing is open:** the work this skill covers is done. Say so in one or two sentences,
   name `mezo-n6yqh` if it is still open, and stop. Do **not** invent a slice, re-audit finished
   screens, or reopen the epic.
3. `bd update <id> --claim`. Work in an isolated worktree on `feat/<topic>`
   (superpowers:using-git-worktrees). Check `gh run list --branch main --limit 1` first —
   **a red main outranks everything** and is fixed before new work.
4. Execute with superpowers:executing-plans discipline. A re-dress starts with the in-session
   design pass, which opens with the §3.4 **ranking**, not with styling. **Behaviour is frozen:
   visual changes only.** A class rename or a `data-*` styling hook is fine; a changed route,
   hook, contract, mutation or state machine is not — if the bead seems to need one, stop and
   ask the owner.
5. **Offer the owner a before/after lab before writing code**, whenever the slice changes how a
   screen reads. One HTML page under `docs/design_2.0/prototypes/redress/`, the **same markup
   cloned** into a "most" and a "javasolt" column so the comparison can only be about the skin.
   `2026-09-20-gyakorlatok-sport-ceremonia-before-after.html` is the pattern to copy: it keeps
   the markup in `<template>` elements and clones them into both columns with a three-line
   script, which makes identical markup structural rather than a promise. The "most" column
   gets **no special ground** — what ships today is Titanium CSS on the restored light page,
   and that is the honest comparison.
   **If the surface is mostly inline styles** (the capture sheets were), cloned markup is not an
   honest comparison: shoot real screenshots of `main` and of the branch instead, with a
   throwaway spec under `frontend/tests/layout` (bible E.1 rule 34), and get the owner's yes
   before the merge.
   Four traps, each of which cost a round:
   - `prototype.css` locks the document scroller (`html, body { overflow: hidden }`) — the lab
     must unlock it or the page cannot scroll at all.
   - The clay sprite must be hidden with `position:absolute;width:0;height:0`, never
     `display:none`, or its gradient fills never resolve.
   - The in-app preview renders a `file://` page as a **snapshot and drops the `<link>` to
     `prototype.css`** — the lab then shows unstyled markup. Verify it over a local HTTP server
     from the repo root instead (`python3 -m http.server`), which resolves the relative link.
   - Check the real class a component renders (`cn('muscle-chip', className)`) before hand-
     writing markup into the lab; a missing class silently changes the size of the thing you
     are asking the owner to judge.
6. Gates (house rules, non-negotiable): FE tests in **both** modes (`VITE_USE_MOCK` unset =
   mock, `=false` = real, `CI=true`), affected `frontend/tests/layout` specs, `verify`-skill
   runtime pass **in light AND dark**, reverse parity checklist pasted into the bd issue, CSS
   section + `prototypeCssStructure.test.ts` moved in the same commit, `node scripts/gen-codemap.mjs`
   after moves **and after every merge** (the merge silently drops entries). If a slice touches
   docs, `node scripts/lint-docs.mjs` must stay at 0 stale / 0 error. Then merge per the
   **"no-wait, net stays"** flow (AGENTS.md §Git Workflow): local gates → `--no-ff` merge to
   main → push; no PR, no CI wait.
7. Close the bead with a result summary. Session close:
   `node scripts/check-beads-backup.mjs --fix`, `bd dolt push`, `git push`, `git status` clean.
8. Report to the owner **in Hungarian**, business language (CLAUDE.md §Communication): what got
   done in user-visible terms, what is next, how much is left. Say plainly what you did **not**
   do and why — the programme's own close-out named its three gaps rather than claiming
   completeness, and that is the standard.

## Model guidance

The remaining beads carry no `model:` label. `mezo-z5lov` is mostly pattern work, but
the needs-symbol set needs drawing to the §6.1 recipe. `mezo-17vnf` is a chore any model can do.
If the running model is weaker than the work asks, say so to the owner before starting.

## Traps (short list — full list in the spec, and the bible's appendices)

- Never restore whole directories from git history; GlassBox (keep!) lives in the mozaik kit.
- prototype.css line anchors drift — locate by section markers, never by line number.
- The tutorial registry anchors the DOM you are changing. `anchors.test.tsx` now carries a
  registry-wide reverse lint, so an orphaned anchor fails the suite — but grep the registry for
  the page you touch anyway, so you learn it before the test does.
- The old Fuel/Train page code exists only in git history (≤ v2.243) — reference, not restore.
- **A runtime-hue wash/lift formula must not be hoisted into a shared custom property** (bible
  C.2/20): a custom property's own `var()`s are substituted on the element that *declares* it,
  so the hue freezes at its fallback and every tile below comes out coral. Write the formula
  per rule.
- **A selector with no consumer is a page with no style** (C.2/22): `.sp-foot`'s CTA was scoped
  out of every `.wo-close-cta` arm and rendered as a bare button, and no guard caught it because
  every guard asked what the CSS *says*, not what the page *gets*. When your surface inherits a
  scoped rule, grep its consumers for ancestors the scope does not cover.
- **A guard can outrank the rule.** Two slice guards had frozen the flat all-wash pass as a
  *requirement*. If a demotion fails an existing test, read the test: it may be asserting the
  mistake. Rewrite it to assert the ranking, in the same commit.
- **Never `git checkout -- .` to tidy a worktree.** It silently discards uncommitted work;
  commit first, then clean. (Learned here, by losing this file once.)
