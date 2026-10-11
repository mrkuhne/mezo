---
name: folyadek
description: Session driver for the Folyadék programme (epic mezo-n4wf5, owner decisions 2026-10-08/09) — rebuilding the whole app from the dark Üveg/Boop world into the approved Folyadék identity (light only, structure-first page skeleton, everything is a level that fills, own outlined icon family, team named by field, five domains in the bottom bar) AND, since 2026-10-11, making it usable in English (language switch in Settings; screen texts, prompts, AI answers, chat and evaluations follow it — slices N1–N3, and every remaining F slice ships bilingual). One slice per fresh session, the same loop every time - prototype of the slice checked against the live app and iterated on the Artifact → owner OK → build → gates → merge to main → deploy → live check → Hungarian report. Use when the user invokes /folyadek or asks to continue the folyadék / új design / átépítés / angol nyelv / nyelvválasztó work.
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
- **Two languages (owner, 2026-10-11):** *"szeretném átfordítani az egészet angol nyelvűre …
  a beállításokban egy nyelvválasztó … mindennek angolul kéne mennie, szövegek, promptok,
  válaszok, chat, értékelések."* Hungarian stays, English is added; the switch lives in
  Settings and **everything** follows it — screen text, dates and numbers, server-written
  sentences, notifications, prompts and every AI answer. It runs inside this programme as the
  language track (N1–N3, see *The slices* and *Language*), because the remaining slices
  re-read every sentence of their screens anyway. The working language with the owner stays
  Hungarian (CLAUDE.md §Communication) — that rule is about us, not about the app.

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
2. `bd list --label epic:folyadek`. This listing is the authority. Take the first open slice
   whose blockers are closed, in this order: the lowest-numbered open `F<N>` or **N2**
   (**N1 is done, 2026-10-11** — F5–F7 are independent of each other and are built bilingual from
   their first line; F8 after F2; **N2** any time, F4 and N1 being done), **N3** after F7,
   **F9 last**. A slice another session holds in progress is not yours. If the owner
   named a slice, take that one. `bd show <id>`.
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
3. **Both languages (every slice after N1).** The prototype has a language switch (side-panel
   checkbox „English (angol szöveg)", `?lang=en`; `F.L(hu, en)` for a sentence, the kit's `FR_EN`
   table for the frame's words); write the
   English wording of every sentence, label and state of the slice next to the Hungarian, by
   the bible's English copy rules — written as English, not translated word by word (verdict
   sentences, team voice and empty states are where a literal translation reads wrong). The
   owner approves the English on the Artifact with the look. English runs longer or shorter:
   the 320 px pass is done in **both** languages.
4. **Edit in place** — `vilagos/<domain>.js` only (plus the kit when something is truly shared;
   a kit change needs a full re-sweep). Use the primitives before drawing a new one. New icon →
   draw it in the bible §5 recipe and add it to the icon sheet (`#w-nap-ikonok`).
5. **Verify yourself:** Playwright from `frontend/` (import the absolute path
   `frontend/node_modules/@playwright/test/index.mjs`), reload per route, **390 and 320 px**;
   console clean, no missing `<use>` ids, no horizontal overflow; **look at the screenshots** of
   every route, state variant and sheet of the slice, in Hungarian and in English — the sweep
   does not see ugliness, and it does not see a sentence left in the other language.
   Reduced motion: `reducedMotion:'reduce'`.
6. **Publish** to the fixed Artifact URL: `Artifact` publish with `file_path` = the shell,
   `url` = the fixed link, `files` = the changed `vilagos/*.js`. Verify over HTTP; the in-app
   browser cannot open Artifact URLs.
7. **Hand-off in Hungarian, business language** (CLAUDE.md §Communication): the link, exactly
   what to open (`#w-…`), what changed versus the last time he saw it, what is invented and
   was replaced, that the language switch shows the English wording to read through, 1–2
   genuine questions. **Then stop and wait.** Iterate in the same files on
   his feedback (he sends screenshots: fix exactly those, check by screenshot, answer).
8. Commit the approved prototype with the slice.

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
  machine — except F1's navigation change and light lock, and the language track (below).
  TDD only where logic changes.
- Copy: field names per the bible §2.3/§6; re-read every sentence you touch.
- **Bilingual from the first line (every slice after N1)** — see *Language*. No visible string
  of the slice stays a literal in a component; the slice's server-written sentences come in
  both languages in the same change.

### 3. Gates (non-negotiable)
- FE tests in **both** modes with `CI=true`: `VITE_USE_MOCK` unset (mock) and
  `VITE_USE_MOCK=false` (real). File filters after `--` are ignored; the full suite runs.
  Affected `frontend/tests/layout` specs. `pnpm build`.
- Backend focused tests (+ `ArchitectureTest`) whenever backend changed — after N1 that is
  most slices (the domain's server-written sentences), and always N1, N3 and F7.
- **Language gate (every slice after N1):** the four guards of `docs/features/_platform-language.md`
  §7 extended and green — (1) **catalog completeness** (`catalog.completeness.test.ts`: every key,
  leaf kind and arity in both languages; nothing to extend, it walks every registered area),
  (2) **no hard-coded Hungarian** (`hardcodedHungarian.guard.test.ts`: the slice's directories
  added to `TRANSLATED`, the hits moved into the catalog, the obsolete `ALLOWLIST` entries deleted),
  (3) the **formatting ratchet** (`format.ratchet.test.ts`: the converted files' lines removed),
  (4) the **English layout** spec (`tests/layout/language-en.spec.ts`: the slice's routes at 390 and
  320 px, non-empty sets) — plus the backend **bundle parity** test when server sentences moved.
  The guard sees accented Hungarian only: read the rest on the screen. Then the runtime pass below
  repeated with the switch on English — no Hungarian word on any route, state or sheet of the
  slice, dates and numbers in the English format, and one real AI answer per AI surface of the
  slice read in each language.
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
  live, what comes next, how many slices are left, and plainly what you did *not* do —
  including what still shows Hungarian when the app is set to English.

## The slices

The app is deliberately **mixed-look while the programme runs** (after F1 the frame is new and
the pages inside are converted domain by domain). That is expected; it is not a licence to add
more Üveg.

| # | Slice | Scope (details in the bead) |
|---|---|---|
| F1 | Alap + keret + készlet | light lock (un-park light, remove dark), tokens + fonts, the shared kit (`shared/ui/folyadek`: skeleton, hero vessel, liquid primitives, badge), the Folyadék-jel sprite replacing the Titanium/clay sprite with ids unchanged, **navigation: bottom bar = five domains, domain pages = top tabs, back = history**, guard tests, feature docs; **the opening animation / startup splash** (owner 2026-10-09: moved here from F8 — design 2–3 distinct liquid options on the Artifact first, reduced-motion branch). Owner OK needed on the opening animation and on what the frame looks like around not-yet-converted pages. |
| F2 | Nap | Mai, A napom, Beszélgetés, Rutin + builder + sheets, check-in, napzárás |
| F3 | Edzés | Mai, Terv, Terhelés, Gyakorlatok + their sub-pages and sheets |
| F4 | Edzés közben | eligazítás, session, review, ceremonies |
| F5 | Fuel | Mai, Kiegészítők, Trendek, Konyha + log flows, kímélő faces |
| F6 | Én | Hol tartok, Test, Célok, Napló, Emberek, Fejlődés + sheets; night mode decision |
| F7 | Mezo | Üzenőfal, A csapat, Rólad, Emlékek, Tudástár, chat, gépterem; **the team rename** in copy and, with the owner's OK on the wording, in the prompts |
| F8 | Átfedők | kalauz, quick input, voice bubble, settings, auth, admin; PWA icon; the name/logo question (the splash is in F1) |
| F9 | Záró söprés | every route audited, dead CSS + Boop + old sprite deleted, old `elo/*.html` retired, bible appendix consolidated, roadmap entry; **the same audit with the app set to English** — no Hungarian left anywhere, including errors, notifications and AI answers |

**The language track** (owner 2026-10-11; beads `mezo-n4wf5.11`–`.13`). From N1 on, F5–F8 each
also deliver their own screens and their domain's server-written sentences in English.

| # | Slice | Scope (details in the bead) |
|---|---|---|
| N1 | Nyelv alap | **Done 2026-10-11** (`mezo-n4wf5.11`; spec `2026-10-11-nyelv-alap-design.md`, doc `docs/features/_platform-language.md`). The language stored with the account and the switch in Settings; the typed client catalog and `LanguageProvider`; dates and numbers by language (`format.ts`); the output-language directive on every AI call; the server message bundles and `UserMessages`; the prototype's language switch and the bible's English copy rules; the frame, kit and Settings pages translated; the five guards. |
| N2 | Nyelv pótlás | Nap, Edzés and Edzés közben were converted before the decision: their screens, sheets, states and server-written sentences into both languages, English wording approved on the Artifact. No visual change. Split per domain if one session is not enough. |
| N3 | Az AI angolul | The prompts themselves, the team's voice, the context fed to the AI, notifications and the built-in catalogs in English; the evaluation run in both languages and side-by-side samples shown to the owner before switching; memory written in one language still found in the other. After F7 (the team rename). |

## Language (every slice after N1)

N1 is built. The mechanism, the resolution order, the formats, the server and LLM sides, the
guards and the **step-by-step recipe for translating an area** are in
`docs/features/_platform-language.md` (§7 *How a slice translates its area*); the design and the
owner decisions are in `docs/superpowers/specs/2026-10-11-nyelv-alap-design.md` (§2); the English
copy rules are in the bible §2.5; the lessons are N1.1–N1.14 in the bible appendix. The frame
around it:

- **Hungarian is the source language and the default**; English is the second. A new account
  takes the **device language** (a Hungarian device → `hu`, anything else → `en`); existing
  accounts stay `hu`. Existing tests keep asserting Hungarian — never mass-rewrite tests for this;
  add English-mode checks.
- **A slice owns its words end to end:** the screen text (a catalog area `messages/<area>.hu.ts`
  + `.en.ts`, read with `useM()` / `m()`), the sentences the server writes for those screens
  (bundle keys with arguments, rendered with `UserMessages`), the notifications it triggers, and
  the AI surfaces it shows. A screen is not done in English while the server still answers it in
  Hungarian.
- **Never translate what the user wrote or what was already said** (owner decision, confirmed
  2026-10-11). Journal entries, meal and exercise names the user typed, old AI messages and
  memories stay as written; only new output follows the switch. Server text that is persisted is
  rendered once, in the language of that moment, and stays.
- **English names (decided):** domains **Today · Training · Fuel · Mezo · Me**; team fields
  **Sleep · Movement · Food · Mood · Mezo · Skeptic**. Internal keys do not change. A field name
  is a label ("your sleep…", never "Sleep says…").
- **Built-in catalogs** (exercises, habits, quests, titles, pantry) are translated in **N3**;
  items the user created or renamed stay as written.
- **Formatting follows the language**, not the device: `shared/lib/format.ts` only (`hu-HU` /
  `en-GB`); no new hard-coded locale, no private month arrays. Units do not change: kg, km, cm and
  the 24-hour clock in both languages.
- **No translated text cached without the language in the cache key**; a sentence is one message
  with slots, never concatenated halves; label maps in `lib/` files are lookups on `m()`, not
  module constants.
- **English is written, not converted.** Short, plain, the same calm voice. A search-and-replace
  or a bulk machine pass is a draft — read every sentence in place, on the screen, at 320 px.
- **Scope:** another feature's page reached through a link is not yours to convert ad hoc; list
  it in the report (bible F2.12 / N1.5).
- **Size seen 2026-10-11, before any work:** ≈990 client files / 33k lines and ≈620 server
  files / 13.5k lines carry Hungarian text, ≈60 files hold Hungarian prompt blocks, 118 places
  hard-code the Hungarian date/number format, and built-in catalogs are Hungarian. This is why
  it is sliced by domain and never done in one pass.

## Open questions to raise at the right slice (never decide silently)
F3: body silhouette vs. dumbbell on Edzés · Mai; day cards vs. rows on Terv. F6: Én night mode
dark or light; the streak. F7: the separate "Rád vár" list; whether the rename also changes the
prompts' voice. F8: the "boop" name and logo. Any slice: invented numbers and sentences;
inconsistent dates across domains. N2: the English term for „kímélő mód" (provisionally "Gentle
mode" in the server bundle) and the other domain wording. N3: whether the English team voice
should sound the same as the Hungarian one or be re-tuned. (Decided in N1, 2026-10-11, no longer
open: stored Hungarian text is never translated; a new account takes the device language and
existing ones stay Hungarian; the English names of the domains and team fields; built-in
catalogs are translated in N3 and user-created items stay.)

## Traps
- The bible §8 list, plus the üveg bible appendix for everything structural.
- Never `git checkout -- .` to tidy a worktree; commit first. No bare `git stash`.
- A kit change after pages were converted needs every converted page looked at again.
- A search-and-replace on names or classes is a draft; read the result.
- Language: text hides outside components — `aria-label`s, placeholders, toasts, error
  messages from the server, notification bodies, chart axis labels, label maps in `lib/`
  files, the kalauz registry, mock fixtures (they are what the owner sees in mock mode).
  Concatenated sentence halves do not translate; make them one message with slots.

## Model guidance
F1 (the kit, the sprite, navigation), F7 (the rename, the largest domain), N1 (the mechanism
every later slice lives with) and N3 (the AI's voice in a second language) carry the most
judgment. If the running model is weaker than the work asks, say so to the owner before starting.
