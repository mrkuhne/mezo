---
name: folyadek
description: Session driver for the Folyadék programme (epic mezo-n4wf5, owner decisions 2026-10-08/09) — rebuilding the whole app from the dark Üveg/Boop world into the approved Folyadék identity (light only, structure-first page skeleton, everything is a level that fills, own outlined icon family, team named by field, five domains in the bottom bar). One slice per fresh session, the same loop every time - prototype of the slice checked against the live app and iterated on the Artifact → owner OK → build → gates → merge to main → deploy → live check → Hungarian report. Use when the user invokes /folyadek or asks to continue the folyadék / új design / átépítés work.
---

# Folyadék session driver

**One fresh session = one slice.** Every slice runs the same loop, in this order:
**prototype → Artifact → owner OK → build → gates → merge → deploy → live check → report.**
Never skip the OK; never merge without it; never ask for a second visual review after the
build. This is the owner's rhythm from the Üvegesítés programme (2026-09-23), restated for
this one on 2026-10-09: *"a skill mint az uvegesites kell, hogy menjen: az artifact prototype-ot
építjük"* — he opens the skill, walks a page on the Artifact, iterates visually, and then that
page ships.

## Owner decisions — do not re-litigate

Full text: `docs/superpowers/specs/2026-10-09-folyadek-irany-design.md` §9. Journey and what
was rejected: `docs/design_2.0/prototypes/vilagos/HANDOFF.md` (read it once; it explains why
the "obvious" alternatives are wrong).

- **The look is settled:** "a mostani design nagyon tetszik … így kell kinéznie." The build
  matches the prototype; it does not reinterpret it.
- **Light only.** No dark theme.
- **Page skeleton on every screen:** title bar → the domain's pages as top tabs → one hero with
  a verdict sentence and one primary button → 3–5 numbered card sections (do now → numbers →
  insight → log) → deeper things behind rows.
- **Bottom bar = the five domains, always.** The domain's own pages are top tabs. No hidden
  switcher. **Back = where you came from.** These two are the only approved behaviour changes.
- **Folyadék:** everything is a level that fills; one strong graphic per screen from its own
  data; no progress rings; averages never without the days behind them.
- **Icons:** the Folyadék-jel family (outlined glyph, half-filled with the domain liquid).
  The Titanium 3D sprite and the clay icons are retired.
- **The team** is named by field — Alvás, Mozgás, Étkezés, Közérzet, Mezo, Szkeptikus — and
  shown as the field glyph badge. No Boop creatures, no nicknames, no "szoba", no "karakter".
- **Kept:** MuscleChip/BodyMap graphics, the Fuel · Mai content, the in-workout layout.
- **Behaviour frozen** otherwise: every control, state, sheet and data field of the live app
  stays.
- **The owner looks once per slice**, at the Artifact, before any code.

## Canon (read every session, in this order)

1. **`docs/design_2.0/2026-10-09-folyadek-style-bible.md`** — THE styling reference: the
   skeleton, tokens, the liquid primitives, icons, the team, copy rules, traps, and the
   slice-lesson appendix (read the appendix fully; every rule was paid for).
2. **The prototype** — the approved look in executable form:
   `docs/design_2.0/prototypes/klinikai-iranyok.html` (shell) + `vilagos/kit.js` (structure),
   `vilagos/foly.js` (look + primitives), `vilagos/ikon.js` (icons, badges),
   `vilagos/{nap,edzes,fuel,mezo,en}.js` (one file per domain). Agent brief: `vilagos/README.md`.
   Serve: `python3 -m http.server 8731 --bind 127.0.0.1` in `docs/design_2.0/prototypes/`.
   Open `#w-<domain>-<route>[.<arg>]`; `#j-<domain>-<route>` shows today's app look in the same
   frame. Fixed Artifact: https://claude.ai/artifact/Ax6faqjyEd6Xxw2J7MN45M
3. **For what a screen must DO:** the feature doc (`docs/features/<feature>.md`), the page
   components, and the old living prototype `docs/design_2.0/prototypes/elo/<domain>.html`
   (parity source only — never for how it looks).
4. `docs/design_2.0/2026-09-23-uveg-style-bible.md` appendix and
   `2026-09-17-restored-world-style-bible.md` Appendices A–E: per-surface traps that survive a
   re-skin (scroll locks, sheet portals, sprite hiding). Their materials are superseded.

## Procedure

### 0. Pick the slice
1. `gh run list --branch main --limit 3`. **A red main outranks everything.**
2. `bd list --label epic:folyadek`. This listing is the authority. Take the lowest-numbered
   open `F<N>` whose blockers are closed (**F1 blocks everything**; F2–F7 are independent after
   F1; F8 after F2; F9 last). If the owner named a slice, take that one. `bd show <id>`.
3. If everything is closed, say so in two sentences and stop.
4. `bd update <id> --claim`; work in an isolated worktree on `feat/folyadek-<topic>`.
5. Write the *Kész, ha…* checklist into the bead (`bd update <id> --acceptance "..."`) before
   any code — CLAUDE.md §Kész, ha….

### 1. Prototype — ALWAYS first, in the living Folyadék prototype
The whole app is already drawn (≈360 screens, 200 state variants, 140 sheets). A slice does not
start from zero; it **proves its part against reality** and gets the owner's OK on it.

1. **Parity pass.** List every route, tab, sheet, state (empty / loading / error / skipped /
   kímélő…), control and data field of the slice's live screens (read the page components and
   `elo/<domain>.html`). Tick each against the prototype's domain file. Anything missing is
   added to the prototype now — in the liquid language, not as a leftover old card.
2. **Reality pass.** The prototype contains invented numbers and sentences (HANDOFF "open
   questions"). For each graphic in the slice, name the real field that feeds it. If the app
   cannot compute it, replace the graphic with one it can, and tell the owner. Query
   production read-only if you need to see real shapes (CLAUDE.md §Production database);
   never copy real rows into the prototype.
3. **Edit in place** — `vilagos/<domain>.js` only (plus the kit when something is truly shared;
   a kit change needs a full re-sweep). Use the primitives before drawing a new one. New icon →
   draw it in the bible §5 recipe and add it to the icon sheet (`#w-nap-ikonok`).
4. **Verify yourself:** Playwright from `frontend/` (import the absolute path
   `frontend/node_modules/@playwright/test/index.mjs`), reload per route, **390 and 320 px**;
   console clean, no missing `<use>` ids, no horizontal overflow; **look at the screenshots** of
   every route, state variant and sheet of the slice — the sweep does not see ugliness.
   Reduced motion: `reducedMotion:'reduce'`.
5. **Publish** to the fixed Artifact URL: `Artifact` publish with `file_path` = the shell,
   `url` = the fixed link, `files` = the changed `vilagos/*.js`. Verify over HTTP; the in-app
   browser cannot open Artifact URLs.
6. **Hand-off in Hungarian, business language** (CLAUDE.md §Communication): the link, exactly
   what to open (`#w-…`), what changed versus the last time he saw it, what is invented and
   was replaced, 1–2 genuine questions. **Then stop and wait.** Iterate in the same files on
   his feedback (he sends screenshots: fix exactly those, check by screenshot, answer).
7. Commit the approved prototype with the slice.

### 2. Build (after the OK)
- **Match the prototype exactly.** Same order, same graphic, same copy, same states.
- **Reuse the kit from F1** (`frontend/src/shared/ui/folyadek/`): page skeleton, hero vessel,
  the liquid primitives, the glyph sprite, the badge. If something is missing, extend the kit —
  one recipe per thing, never a local copy.
- **Remove the old skin of the surfaces you touch in the same change** (glass cards, Titanium
  icons, Boop, rings). Move/replace the CSS block for the area and update the structure guard
  tests in the same commit. Plant block markers before dispatching parallel builders.
- **Tests that assert the old skin are rewritten** in the same commit to assert the new
  structure — never deleted.
- **Behaviour frozen.** No changed route semantics, hook, API contract, mutation or state
  machine — except F1's navigation change and light lock. TDD only where logic changes.
- Copy: field names per the bible §2.3/§6; re-read every sentence you touch.

### 3. Gates (non-negotiable)
- FE tests in **both** modes with `CI=true`: `VITE_USE_MOCK` unset (mock) and
  `VITE_USE_MOCK=false` (real). File filters after `--` are ignored; the full suite runs.
  Affected `frontend/tests/layout` specs. `pnpm build`.
- Backend focused tests (+ `ArchitectureTest`) only if backend changed (F7's rename).
- Runtime pass (`verify` skill): every route of the slice at 390 and 320 px, reduced motion;
  title bar, top tabs and bottom bar exactly as after F1; side by side with the prototype.
- **Reverse parity checklist** pasted into the bead.
- `node scripts/gen-codemap.mjs` after file moves **and after every merge**;
  `node scripts/lint-docs.mjs --errors-only` clean. Feature docs of the touched surfaces
  updated; `docs/features/README.md` row true.

### 4. Merge + deploy ("no-wait, net stays", AGENTS.md §Git Workflow)
1. `git pull --rebase` origin main onto the branch; re-run the quick gates if anything came in.
2. From the worktree: `git checkout --detach origin/main && git merge --no-ff feat/folyadek-<topic>`,
   regenerate the codemap, `git push origin HEAD:main`. Subject:
   `feat(ui): folyadék — <surface> (<bead id>)`. Never end the push on a `[skip ci]` commit.
3. Watch the `deploy` workflow for the pushed commit until green; open the production URL and
   check the slice's routes. `ci` red → fix before anything else.
4. Delete the feature branch.

### 5. Close
- Prototype in sync with production (record any deviation in `vilagos/HANDOFF.md`), republished.
- Append the slice's lessons to the bible appendix as numbered rules (F1.1, F1.2, …).
- Close the bead with a result summary; `node scripts/check-beads-backup.mjs --fix` + commit,
  `bd dolt push`, `git push`, `git status` clean.
- Report to the owner **in Hungarian**, walking the *Kész, ha…* list in everyday words: what is
  live, what comes next, how many slices are left, and plainly what you did *not* do.

## The slices

The app is deliberately **mixed-look while the programme runs** (after F1 the frame is new and
the pages inside are converted domain by domain). That is expected; it is not a licence to add
more Üveg.

| # | Slice | Scope (details in the bead) |
|---|---|---|
| F1 | Alap + keret + készlet | light lock (un-park light, remove dark), tokens + fonts, the shared kit (`shared/ui/folyadek`: skeleton, hero vessel, liquid primitives, badge), the Folyadék-jel sprite replacing the Titanium/clay sprite with ids unchanged, **navigation: bottom bar = five domains, domain pages = top tabs, back = history**, guard tests, feature docs. Owner OK needed only on what the frame looks like around not-yet-converted pages. |
| F2 | Nap | Mai, A napom, Beszélgetés, Rutin + builder + sheets, check-in, napzárás |
| F3 | Edzés | Mai, Terv, Terhelés, Gyakorlatok + their sub-pages and sheets |
| F4 | Edzés közben | eligazítás, session, review, ceremonies |
| F5 | Fuel | Mai, Kiegészítők, Trendek, Konyha + log flows, kímélő faces |
| F6 | Én | Hol tartok, Test, Célok, Napló, Emberek, Fejlődés + sheets; night mode decision |
| F7 | Mezo | Üzenőfal, A csapat, Rólad, Emlékek, Tudástár, chat, gépterem; **the team rename** in copy and, with the owner's OK on the wording, in the prompts |
| F8 | Átfedők | kalauz, quick input, voice bubble, settings, splash, auth, admin; PWA icon; the name/logo question |
| F9 | Záró söprés | every route audited, dead CSS + Boop + old sprite deleted, old `elo/*.html` retired, bible appendix consolidated, roadmap entry |

## Open questions to raise at the right slice (never decide silently)
F3: body silhouette vs. dumbbell on Edzés · Mai; day cards vs. rows on Terv. F6: Én night mode
dark or light; the streak. F7: the separate "Rád vár" list; whether the rename also changes the
prompts' voice. F8: the "boop" name and logo. Any slice: invented numbers and sentences;
inconsistent dates across domains.

## Traps
- The bible §8 list, plus the üveg bible appendix for everything structural.
- Never `git checkout -- .` to tidy a worktree; commit first. No bare `git stash`.
- A kit change after pages were converted needs every converted page looked at again.
- A search-and-replace on names or classes is a draft; read the result.

## Model guidance
F1 (the kit, the sprite, navigation) and F7 (the rename, the largest domain) carry the most
judgment. If the running model is weaker than the work asks, say so to the owner before starting.
