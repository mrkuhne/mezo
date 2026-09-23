---
name: uvegesites
description: Session driver for the Üvegesítés programme (epic mezo-me75u, 2026-09-23) — re-dressing the whole app onto the dark glass material (Mozaik colors + Titanium material: 3D icon set, glass cards with a gradient frame, sheen, glow) on the warm-graphite dark ground, dark-only. One slice per fresh session: clickable prototype → owner OK → implementation → gates → merge to main → deploy check. Use when the user invokes /uvegesites or asks to continue the üvegesítés / glass re-dress work.
---

# Üvegesítés session driver

**One fresh session = one slice.** Every slice follows the same five steps, in this order:
**prototype → owner OK → build → merge → deploy.** Never skip the OK and never merge without
it. The owner set this flow on 2026-09-23.

## Owner decisions (2026-09-23): do not re-litigate

- **Material** is Titanium's: the 3D icon sprite, glass cards, the colored gradient frame, the
  light sweep (sheen), and the color glow around cards.
- **Colors** are Mozaik's: the `--dv-*` accents and the `--macro-*` band. **Ground** is the app's
  own warm graphite dark `#191614`, never the cold Titanium graphite.
- **Dark only.** Light mode is parked, not deleted. Do not design, prototype or verify light.
- **The bottom menu is untouched.** `app/TabBar.tsx`, the domain switcher, the small Boop
  characters and the fixed position stay exactly as they ship. Do not restyle, glass or move
  them, even though the reference prototype shows a glass tab bar (that bar is a placeholder).
- **Behavior is frozen.** This is visual work only. A class rename or a `data-*` styling hook is
  fine. A changed route, hook, API contract, mutation or state machine is not. If a slice seems
  to need one, stop and ask the owner.
- **The owner looks once per slice**, at the clickable prototype, before any code.

## Canon (read every session, in this order)

1. **`docs/design_2.0/2026-09-23-uveg-style-bible.md`** is THE styling reference: ground,
   palette, the `.glass` recipe, icons, data graphics, motion, what stays, and the slice-lesson
   appendix. Read the appendix fully; every rule in it was paid for by an earlier slice.
2. **`docs/design_2.0/prototypes/fuel-uveg.html`** (Sötét) is the approved look, in executable
   form. When the bible and your eye disagree, open this.
3. **`docs/design_2.0/2026-09-17-restored-world-style-bible.md`** stays canon for everything
   the üveg bible does not override: card anatomy, **§3.4 ranking**, data graphics, and
   Appendices A–E (per-surface traps). Where the two conflict, the üveg bible wins.
4. For *what a screen must do*, use the Titanium parity docs listed in
   `docs/design_2.0/README.md`, never the old look.

## Procedure

### 0. Pick the slice
1. `gh run list --branch main --limit 3`. **A red main outranks everything:** fix it first.
2. `bd list --label epic:uvegesites` (**`--label`, singular**). This listing is the authority,
   not `bd ready`. Take the lowest-numbered open `mezo-me75u.N` whose blockers are closed
   (`U1` blocks everything). If the owner named a slice, take that one. Run `bd show <id>`: the
   bead lists the routes.
3. **If everything is closed**, say so in two sentences and stop. Do not invent a slice.
4. Run `bd update <id> --claim`, then work in an isolated worktree on `feat/uveg-<topic>`.

### 1. Prototype (skip only where the bead says "PROTOTÍPUS: már JÓVÁHAGYVA")
- One self-contained HTML page: `docs/design_2.0/prototypes/uveg-<topic>.html`. **Start by
  copying `fuel-uveg.html`**: it carries the sprite, the `.glass` recipe, aurora, rings, sheet,
  motion and the side-notes panel. Delete its light theme and its toggle; the new page is dark only.
- **Clickable**: the main routes of the slice are reachable by tapping, with a hash router,
  back buttons and the key sheets/dialogs. Non-scope taps show a toast. Use real-looking
  Hungarian content that mirrors what the live screen shows (read the page components for
  the actual fields; never invent features).
- Apply the **§3.4 ranking first**. Name the one thing each screen says, and give that thing
  the loudest treatment. Not everything is glass (bible §3).
- Keep the bottom area honest: draw the live Boop TabBar as a **plain placeholder strip
  labelled "alsó menü: változatlan"** so the owner never thinks it is being redesigned.
- Verify it yourself before showing it:
  - Serve it over HTTP from the prototypes dir (`python3 -m http.server <port> --bind 127.0.0.1`,
    run in the background). A `file://` page renders as a script-less snapshot in the in-app
    browser.
  - Click through every route in the in-app browser, and check the console for errors.
  - A cache-busting `?v=N` is needed after edits. Hash-only navigation does not reload the page.
- Hand it to the owner **in Hungarian, business language** (CLAUDE.md §Communication): the link,
  what to click, what changed in everyday words, and 1–2 concrete questions if there are
  genuine choices. **Then stop and wait for the OK.** Iterate on feedback in the same file.
- Commit the approved prototype with the slice. It becomes the slice's parity reference.

### 2. Build (after the OK)
- Reuse the kit from U1: the glass primitive, the sprite symbols, and the ring/bar/halo recipes
  in `frontend/src/shared/ui/mozaik` + `shared/ui/clay` + the `prototype.css` sections. **Never
  fork a second glass recipe or a second palette.** If the kit lacks something, extend the kit.
- Remove the old skin of the surfaces you touch in the same change (Mozaik wash tiles →
  glass/flat per ranking). Move the CSS section and `prototypeCssStructure.test.ts` in the same
  commit.
- Remove emoji you meet: each becomes a sprite symbol (draw missing glyphs per bible §4).
- Write TDD where logic changes (it rarely should). Update any test that asserts the old skin, in
  the same commit, making it assert the new ranking instead.

### 3. Gates (house rules, non-negotiable)
- FE tests in **both** modes, with `CI=true`: `VITE_USE_MOCK` unset (mock) and
  `VITE_USE_MOCK=false` (real). The affected `frontend/tests/layout` specs. `pnpm build`.
- A runtime pass with the `verify` skill, **dark only**. Click every route in the slice. Check
  320px width. Check reduced motion. Confirm the TabBar is pixel-identical to before.
- A **reverse parity checklist** pasted into the bd issue: every control, state, empty/error/
  loading state and data field of each touched screen, ticked as still present.
- Run `node scripts/gen-codemap.mjs` after file moves **and after every merge**. If docs changed,
  `node scripts/lint-docs.mjs` must report 0 stale and 0 errors.

### 4. Merge + deploy ("no-wait, net stays", AGENTS.md §Git Workflow)
1. `git pull --rebase` origin main onto the branch, then re-run the quick gates if anything came in.
2. From the worktree: `git checkout --detach origin/main && git merge --no-ff feat/uveg-<topic>`,
   regenerate the codemap, then `git push origin HEAD:main`. Conventional subject carrying the
   bead id: `feat(ui): üveg-anyag — <surface> (mezo-me75u.N)`.
3. **Deploy is push-driven.** Watch the `deploy` workflow for the pushed commit
   (`gh run list --workflow deploy --limit 1`, then `gh run watch <id>`) until it succeeds.
   `ci` runs alongside: you do not wait for it before merging, but **if it goes red, fixing it
   comes before anything else.**
4. Delete the feature branch.

### 5. Close
- Append this slice's lessons to the üveg bible's appendix as numbered rules (U1, U2, …): only
  what a later slice would otherwise pay for again.
- Close the bead with a result summary: what changed, parity checklist link, and prototype path.
- Close the session: `node scripts/check-beads-backup.mjs --fix` + commit, `bd dolt push`,
  `git push`, and `git status` clean.
- Report to the owner **in Hungarian**: what is now live in user-visible terms, what comes
  next, and how many slices are left. Say plainly what you did *not* do and why.

## Traps carried over from the visszaöltöztetés (bible Appendices A–E hold the rest)
- The sprite is hidden with `position:absolute;width:0;height:0`, never `display:none`.
- The ring svg needs `overflow: visible`, otherwise the glow `drop-shadow` clips to a square
  box around the ring.
- `prototype.css` locks the document scroller (`html, body { overflow: hidden }`). A lab page
  that links it must unlock it.
- A runtime-hue formula must not be hoisted into a shared custom property. `--c` is read per
  rule, never baked into another variable on an ancestor (bible C.2/20).
- A selector with no consumer is a page with no style (C.2/22). Grep the consumers of every
  scoped rule you inherit.
- There are two GlassBox components (`shared/ui/mozaik` and fuel's `.fmx-glass`). Both are
  kept and deliberately not merged.
- Never restore whole directories from git history. Never `git checkout -- .` to tidy a
  worktree; commit first.
- The tutorial registry anchors DOM. Grep it for the page you touch.

## Model guidance
U1 (the foundation) and U10 (overlays and ceremonies) carry the most design judgment. If the
running model is weaker than the work asks, say so to the owner before starting.
