---
name: cseppesites
description: Session driver for the Cseppesítés programme (epic `cseppesites`, owner decision 2026-10-07) — re-dressing the whole app from the playful Üveg/Boop world onto the professional clinical look with the élő csepp signature (cool graphite dark + pure-white light, one steel-blue accent, colour = meaning, steel-tuned 3D icons, glass only as ranking, open lists). One slice per fresh session: living prototype edited in place → Artifact → owner OK → build → gates → merge to main → deploy → live check → Hungarian report. Use when the user invokes /cseppesites or asks to continue the cseppesítés / klinikai átépítés / csepp work.
---

# Cseppesítés session driver

**One fresh session = one slice.** Every slice runs the same loop, in this order:
**living prototype → Artifact → owner OK → build → gates → merge → deploy → live check → report.**
Never skip the OK; never merge without it; never ask for a second visual review after the
build. The owner set this rhythm on 2026-09-23 and re-confirmed it for this programme on
2026-10-07 ("meghívom a skillt és minden egyes oldalon artefact átalakítással végigmegyek,
vizuálisan iterálunk és utána deployolva lesz az az oldal").

## Owner decisions (2026-10-07): do not re-litigate

Spec: `docs/superpowers/specs/2026-10-07-csepp-irany-design.md` (§12 is the list). In short:

- **Direction:** professional, clinical, adult, unisex. The approved target is the **Ajánlott**
  variant and the **Jelek** sheet of `docs/design_2.0/prototypes/klinikai-iranyok.html`
  (Artifact https://claude.ai/artifact/Ax6faqjyEd6Xxw2J7MN45M).
- **The élő csepp is the signature.** One meaning only: *the user's day* (fill = signals in,
  colour + form + rhythm = state). Large on Nap, 40px in every header (replaces the DayOrb),
  36px on the TabBar domain mark (tinted `--dom`), inline 28px. Never a button for anything
  else, never decoration.
- **Boop = option B.** The persona roles stay (Szunya, Mocor, Falat, Derű, Mezo); the creature
  artwork goes. They become **sibling forms** of the csepp material (pebble, bean, drop, leaf,
  crystal). Final silhouettes get an owner round in C7.
- **Icons:** the Titanium 3D sprite stays, re-tuned to **one uniform steel family** — no
  per-category tint. Symbol ids and `CLAY_TO_3D` do not change. MuscleChip / BodyMap keep
  their region colours (the owner's explicit keep).
- **Themes:** dark (cool graphite `#0F1214`) **and** light (**pure white** `#FFFFFF`), both
  shipped, user-selectable, default follows the system. Light is not a tinted white.
- **Colour = meaning, otherwise grey.** One steel-blue accent (dark `#7FB2D0`, light
  `#2E6FA8`) on the primary action, active tab icon, glass frame, links. State colours
  (ok / warn / bad) only where something asks for attention. Muted **category** colours are
  allowed and stable (macros, muscle regions). Domain tint only on the TabBar mark and the
  selected day of a day strip.
- **Glass only as ranking:** 1–2 glass cards per screen carry the most important thing;
  everything else is an open section (mono eyebrow, hairline rows, no box, no background).
- **The five quiet rules** (spec §5): four text roles · a box only for glass · two shades ·
  colour = meaning · say a thing once (the csepp is "a napod"; a verdict sentence replaces a
  descriptive heading).
- **Chrome keeps its content** (wordmark, ?, settings, messages, notifications, day glyph;
  TabBar with domain mark + nav-model tabs). No day-part switcher. The header mark next to
  "boop" is a placeholder: the **name/logo decision is open** — raise it, do not decide it.
- **Behaviour is frozen.** Visual work only. Class renames and `data-*` hooks are fine; a
  changed route, hook, API contract, mutation or state machine is not. The one exception is
  C1's theme setting (un-parking light mode is in scope by owner decision).
- **The owner looks once per slice**, at the Artifact, before any code.

## Canon (read every session, in this order)

1. **`docs/design_2.0/<date>-csepp-style-bible.md`** — written in C1; after C1 it is THE
   styling reference (tokens, the csepp recipe, the quiet rules, icons, motion, both themes,
   and the slice-lesson appendix). Read the appendix fully.
   *Until C1 lands:* the spec above plus `klinikai-iranyok.html` (Ajánlott + Jelek) are the
   canon, in executable form.
2. **`docs/design_2.0/prototypes/klinikai-iranyok.html`** — when the bible and your eye
   disagree, open this (`#ajanlott-nap`, `#ajanlott-edzes`, `#ajanlott-jelek`; `?vilagos`
   for light, `?still` for reduced motion, `?ikon3d`, `&meleg` for the original icon colours).
3. **`docs/design_2.0/2026-09-23-uveg-style-bible.md`** stays canon for what the csepp bible
   does not override: §3.4 ranking, the `.glass` recipe mechanics, the sprite recipe (§4), the
   chrome contract (§7) and the 107-rule appendix — every rule there was paid for.
4. **`docs/design_2.0/2026-09-17-restored-world-style-bible.md`** Appendices A–E for
   per-surface traps.
5. For *what a screen must do*, read the feature doc (`docs/features/<feature>.md`) and the
   page components, never the old look. Grep every approved prototype for the route first.

## Procedure

### 0. Pick the slice
1. `gh run list --branch main --limit 3`. **A red main outranks everything.**
2. `bd list --label epic:cseppesites` (`--label`, singular). This listing is the authority.
   Take the lowest-numbered open `C<N>` whose blockers are closed (**C1 blocks everything**;
   C2–C6 are independent after C1; C7 and C8 after C2; C9 last). If the owner named a slice,
   take that one. `bd show <id>` lists the routes.
3. If everything is closed, say so in two sentences and stop.
4. `bd update <id> --claim`; work in an isolated worktree on `feat/csepp-<topic>`.
   Write the *Kész, ha…* checklist into the bead (`bd update <id> --acceptance "..."`)
   before any code (see `.agents/skills/owner-visible-frontend/SKILL.md`).

### 1. Prototype: ALWAYS, in the living file
- **Edit the domain's living prototype in place:** `docs/design_2.0/prototypes/elo/<domain>.html`
  (one file per domain, registry + fixed Artifact URLs in `elo/README.md`). Do not start a new
  file. The first slice that touches a domain re-skins the whole file's tokens, chrome and kit
  (copy them from `klinikai-iranyok.html`: the `.phone[data-v="ajanlott"]` tokens for both
  themes, `.csepp` + `csepp()`, the `.open`/`.ln` quiet primitives, the header and `nav()`),
  then re-ranks every route of the slice: name the one thing each screen says, give it the
  glass, open everything else.
- **Both themes** in every prototype: a theme toggle like `klinikai-iranyok.html`'s. Verify
  both.
- **The csepp** appears exactly where the spec says and nowhere else. Its states come from real
  data the screen has (check-in, signals); never invent a score the app cannot compute.
- **Icons:** the steel tint is a filter in the prototype (`.ic.td` rule); content icons keep
  their Titanium symbols. A new glyph still goes on an **"Új ikonok"** sheet for the OK, then
  into `docs/design_2.0/assets/titanium-custom.svg` → `node scripts/gen-titanium-sprite.mjs`.
- **Content:** real-looking Hungarian content of the real record types (read the page
  components); never production rows. Every control, state and field of the live screen must
  be present (reverse parity).
- **Verify yourself:** serve over HTTP (`python3 -m http.server <port> --bind 127.0.0.1`,
  background), click every route in the in-app browser, console clean, `?v=N` cache-bust,
  320px, `?still`, both themes.
- **Publish to the domain's fixed Artifact URL** (`Artifact` tool: `read` the URL first, then
  publish with `url`; `artifact-design` loaded first). A 4k-line read + publish is delegated
  to a subagent (memory: artifact republish needs a full read). The in-app browser cannot open
  Artifact URLs: verify over HTTP, publish for the owner.
- **Hand-off in Hungarian, business language** (CLAUDE.md §Communication): the link, what to
  click, what changed in everyday words, 1–2 genuine questions. **Then stop and wait.**
  Iterate in the same file on feedback. Commit the approved prototype with the slice.

### 2. Build (after the OK)
- Reuse the kit from C1: the theme roots, `Csepp` (`shared/ui/csepp/`), the quiet primitives,
  the glass recipe (one recipe, one palette — never fork a second). If the kit lacks
  something, extend the kit (`mozaik/index.tsx` `PageHead`/`PageHero` props before copies).
- Remove the old skin of the surfaces you touch in the same change; move the CSS block
  (`/* ── csepp <area> (<bead>) ── */ … /* ── /csepp <area> ── */`) and update
  `shared/ui/mozaik/prototypeCssStructure.test.ts` in the same commit. Plant block markers
  before dispatching parallel builders.
- Replace every `<Boop>` you meet per the slice's scope (C2 Nap, C7 csapatfal, C8 overlays)
  with the csepp / sibling form; the `Boop` component and `boop.svg` are deleted in C9, not
  before.
- Tests that assert the old skin are rewritten in the same commit to assert the new ranking
  (never deleted): `prototypeCssStructure.test.ts`, `mozaikCssTokens.test.ts` (every `--mz-*`
  token in both roots), `DayOrb.test.tsx` / `AppHeader.dayOrbTone.test.tsx` (C1 replaces
  them with csepp tests), `TabBar.test.tsx`, `tests/layout/*.spec.ts`,
  `AppLayout.lightFirst.test.tsx` / `ThemeProvider.test.tsx` (C1: light is no longer parked).
- Behaviour frozen: TDD only where logic changes (C1 theme setting).

### 3. Gates (non-negotiable)
- FE tests in **both** modes with `CI=true`: `VITE_USE_MOCK` unset (mock) and
  `VITE_USE_MOCK=false` (real). File filters after `--` are ignored; the full suite runs.
  Affected `frontend/tests/layout` specs. `pnpm build`.
- Runtime pass (`verify` skill): every route of the slice, **both themes**, 320px, reduced
  motion; header and TabBar exactly as after C1.
- **Reverse parity checklist** pasted into the bead.
- `node scripts/gen-codemap.mjs` after file moves **and after every merge**;
  `node scripts/lint-docs.mjs` 0 errors / 0 stale. Feature docs of the touched surfaces
  updated; `docs/features/README.md` row true.

### 4. Merge + deploy ("no-wait, net stays", AGENTS.md §Git Workflow)
1. `git pull --rebase` origin main onto the branch; re-run the quick gates if anything came in.
2. From the worktree: `git checkout --detach origin/main && git merge --no-ff feat/csepp-<topic>`,
   regenerate the codemap, `git push origin HEAD:main`. Subject:
   `feat(ui): csepp — <surface> (<bead id>)`.
3. Watch the `deploy` workflow for the pushed commit until green; open the production URL in
   the browser and check the slice's routes in both themes. `ci` red → fix before anything else.
4. Delete the feature branch.

### 5. Close
- Living prototype in sync with production (record any deviation), republished to its fixed
  URL, `elo/README.md` sync note updated.
- Append the slice's lessons to the csepp bible appendix as numbered rules (C1, C2, …).
- Close the bead with a result summary; `node scripts/check-beads-backup.mjs --fix` + commit,
  `bd dolt push`, `git push`, `git status` clean.
- Report to the owner **in Hungarian**: what is live in user-visible terms, what comes next,
  how many slices are left, and plainly what you did *not* do.

## The slices

| # | Slice | Scope (routes in the bead) |
|---|---|---|
| C1 | Alap + keret + kit | both theme roots + theme setting un-parked (system default, settings toggle; `theme.ts`, `index.html`, `vite.config.ts` manifest), steel sprite regeneration, `Csepp` component, header (mark + wordmark, csepp instead of DayOrb) + TabBar (csepp domain mark), quiet primitives, guard tests, **csepp style bible**, `CLAUDE.md` design banner + `docs/design_2.0/README.md`, stale-doc fixes (spec §10). Prototype approved; only chrome details need an OK. |
| C2 | Nap | Mai (approved), A napom, Beszélgetés, Rutin + sheets; `NapCompanion` Boop → csepp |
| C3 | Edzés | Mai (approved), Terv, Terhelés, Gyakorlatok |
| C4 | Edzés közben | session, eligazítás, review, ceremonies (pattern canon stays) |
| C5 | Fuel | four tabs + log flows (macro category colours per spec) |
| C6 | Én | Hol tartok, Test, Célok, Napló |
| C7 | Mezo + csapatfal | design round on the five sibling forms (owner OK), then feed, Rólad, Tudástár, karakter pages |
| C8 | Átfedők | kalauz, quick input, Hallgató Boop → csepp in `VoiceBubble`, settings, splash, PWA icon |
| C9 | Záró söprés | route audit (all routes, both themes), delete `Boop`/`boop.svg`, dead CSS, bible appendix consolidation, all five living prototypes republished, roadmap milestone entry |

## Traps carried over (the üveg bible appendix holds the rest)
- The sprite is hidden with `position:absolute;width:0;height:0`, never `display:none`.
- `.glass` comes last in the cascade and clips (`overflow:hidden`); publish `--c` on the element
  wearing the glass; never hoist a runtime hue into a shared property.
- A gradient that reads `var(--c)` inside a *shared* `<defs>` does not resolve per instance —
  the csepp fills with a direct `fill: var(--c)` and a white sheen gradient (learned in the
  prototype).
- The csepp's `clipPath` id must be unique per instance (`useId`), like Boop's gradients were.
- Dark lock lives in three places that must agree: `theme.ts`, `index.html`, `vite.config.ts`.
- `prototype.css` locks the document scroller; a lab page that links it must unlock it.
- A selector with no consumer is a page with no style; grep consumers of every rule you inherit.
- Two GlassBoxes exist on purpose (`shared/ui/mozaik`, fuel's `.fmx-glass`).
- Never `git checkout -- .` to tidy a worktree; commit first. No bare `git stash`.

## Model guidance
C1 (foundation, both themes, the csepp component, the sprite recolour) and C7 (the sibling
forms) carry the most design judgment. If the running model is weaker than the work asks,
say so to the owner before starting.
