# Train 1:1 parity — P1: retire the pre-Titanium layers

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** the finished Titanium screens stop being wrapped in pre-Titanium ones — the
workout's prep mosaic and the level-up overlay go, the day page's welded old editor and the
report's old tail go, the recap loses its foreign rows and regains the prototype's two-act
shape, and the Kalauz coach-marks stop auto-opening over Titanium pages.

**Architecture:** removal-first. Every task deletes or relocates a layer and proves the
screen underneath is the prototype's. Nothing here builds a new screen (P2 does that) and
nothing re-designs a shipped Titanium body (P3 does that). Where a removal would take a
WORKING FEATURE with it, the feature gets a Titanium-idiom home in the same task — never a
silent deletion.

**Tech stack:** React + RTL, the shipped `wo-`/`cer-` CSS, existing hooks.

**Driving artifacts:** `docs/design_2.0/2026-09-16-train-parity-matrix.md` (measured live,
2026-09-16 — §21 rows 1, 2, 5, 7, 8, 10 and §19), the prototype
`docs/design_2.0/prototypes/companion-titanium/` (`session.js` is the binding source for the
workout flow), owner directive 2026-09-16 ("a régi tűnjön el, 1:1 azt építsük meg"), bd
`mezo-e1ii9`, branch `feat/train-parity-p1`.

## Global Constraints

Everything in `2026-09-15-train-titanium-slices.md` §Global Constraints, plus:

- **The prototype is the specification.** Where production and the prototype disagree about
  what belongs on a screen, the prototype wins — including where an earlier slice
  deliberately diverged (T7 collapsed the ceremony's two steps into one screen citing the
  ceremony-pattern doc; the owner's 1:1 directive overrides that, and the doc gets corrected
  in the same change).
- **Owner decision 2026-09-16 (A):** the global shell stays as production has it (the boop
  header, its icon buttons and the seven-day strip). This plan touches NO app-wide chrome.
  Matrix §0 and §21 row 9 are explicitly OUT of scope.
- **No feature dies silently.** A removal that would strand a working capability must give
  it a home in the same task and say so in the report. Known case: challenge accept/dismiss
  (`useChallengeActions().decide`) is reachable ONLY from the prep mosaic's Küldetések tile
  — see Task 1.
- **The level-up overlay is app-wide.** `LevelUpProvider` serves Fuel and sport logging too.
  This plan stops it for the WORKOUT CLOSE only and fixes its route-persistence bug; it does
  not remove the provider.
- **Honesty rules unchanged:** no fabricated numbers, estimates labelled, em dash for
  missing data, clay icons never emojis, Hungarian copy free of the banned jargon.
- **Every task ends with a WHOLE-SCREEN check, not a component check:** open the real screen
  in a browser, drive the flow, and diff the full frame against the prototype's same screen
  (shell excluded per the owner decision). This is the gate whose absence caused the matrix.

Verified anchors (live-measured or read on the current tree): `ActiveWorkoutPage.tsx:82`
(`Phase`), `:245` (`initialPhase = open ? 'active' : 'prep'`), `:288` (`prepTile`), `:361`
(`useChallengeActions(...).decide`), `:715` (the prep render), `:75-80` (the six
`pages/prep/*` imports); `pages/prep/` = `PrepGyakorlatokPage` 58 / `PrepFejlodesPage` 102
(+test) / `PrepHetiZonaPage` 37 / `PrepKuldetesekPage` 48 (+test) / `PrepBemelegitesPage`
(WarmupRow) / `PrepNigglePage` 45; the `.levelup` overlay measured `position: absolute`,
`z-index: 250`, `416×932` — the whole frame — and **surviving route changes** (still painted
over `/train/mesocycles/new` and `/train/gym`); prototype `session.js` `summary()` /
`detailsStep()` / `recap()` / `runCeremony()` (the two-act structure, `+N szerzett XP`,
`N′ a pulton töltött idő`, `Részletek · Izomcsoportok és a nyert kalória`, `Vissza az
értékeléshez`); matrix §3 (the day editor welded under `MesoDayPage`), §10 (the
`MesoReportPage` tail), §19, §21.

---

### Task 1: The workout starts in the card list

**Files:**
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (drop the `prep` phase
  and `prepTile`; `Phase` becomes `'active' | 'summary'`; the initial phase is always
  `active`), `frontend/src/features/train/components/WorkoutMenuGlass.tsx` or a sibling (the
  challenges home — see below)
- Delete (grep-verify each has no other consumer): `pages/prep/PrepGyakorlatokPage.tsx`,
  `PrepFejlodesPage.tsx` (+test), `PrepHetiZonaPage.tsx`, `PrepKuldetesekPage.tsx` (+test),
  `PrepNigglePage.tsx`; `PrepBemelegitesPage.tsx` ONLY if `WarmupRow` moves with its
  consumers (the card list imports the type — relocate it to `logic/` rather than keep a
  page alive for a type)
- Test: `ActiveWorkoutPage.test.tsx` (the prep-phase blocks retire; new assertions below)

**The challenges home (no silent deletion).** `decide` currently lives behind the prep
mosaic's Küldetések tile. Move accept/dismiss into a GlassBox opened from the workout's
header `⋯` menu (the header already has one — read it), titled `Küldetések`, listing the
day's challenges with their accept/dismiss actions and the same copy the tile used. The
accepted-challenge chip T6 put on each card stays as-is. If the header has no `⋯` menu,
add the entry to the existing per-card menu's sibling — do NOT invent a new screen.

Everything else the prep mosaic showed already has a home and simply goes: the exercise
count and set total are the card list itself; the XP forecast is answered by the ceremony's
real `+XP`; the weekly zone is the Terhelés tab; the warmup is the B-rows in the cards; the
niggle is the banner the card list already renders.

- [ ] **Step 1: Failing tests** — entering `/train/session` with a planned-but-not-started
  day renders `.wo-list` immediately (no `⚡ Kezdjük el →`, no `várható XP`, none of the six
  tile labels); the `⋯` menu opens a Küldetések glass whose accept button fires `decide`
  with the right arguments; dismiss likewise; an accepted challenge still shows its chip on
  the exercise's card.
- [ ] **Step 2:** FAIL. **Step 3:** Implement: delete the prep branch and the tile state,
  make `startWorkout` fire on entry the way `Kezdjük el` did (read `:404-413` — the mock and
  real paths differ; preserve BOTH), move the challenges, delete the prep pages, relocate
  `WarmupRow`.
- [ ] **Step 4:** Rewrite the prep-phase tests in `ActiveWorkoutPage.test.tsx` to the new
  reality — re-express the behaviour they covered (challenge decide, warmup presence, niggle
  surface) against the new homes rather than deleting the coverage.
- [ ] **Step 5:** WHOLE-SCREEN check: prototype Mai CTA → card list vs production
  `/train/mai` CTA → card list; the first frame after the tap must match.
- [ ] **Step 6:** Commit `feat(train): the workout opens in the card list — the prep mosaic retires (mezo-e1ii9)`.

### Task 2: The ceremony is the only thing on screen at the close

**Files:**
- Modify: `ActiveWorkoutPage.tsx` (`finishAndCelebrate` stops calling `showLevelUp` for the
  workout close), `frontend/src/features/train/components/WorkoutCeremony.tsx` (carry
  whatever of the level-up content the prototype's ceremony carries — it carries `+N szerzett
  XP` and nothing else; the skill/level detail has no prototype counterpart at this moment
  and therefore leaves this screen), the LevelUp provider/overlay file (the
  route-persistence bug — find it: the overlay stayed painted over `/train/mesocycles/new`
  and `/train/gym` after a close)
- Test: `ActiveWorkoutPage.test.tsx`, the provider's own test

Two distinct fixes, both required:
1. **The workout close no longer raises the overlay.** The ceremony already shows the real
   `+N SZERZETT XP` from the finish response. Other domains keep the overlay untouched —
   assert that in a test (a Fuel/sport close still raises it).
2. **The overlay must not survive a route change** (a real bug, not a parity matter): it is
   dismissible only by its own CTA today, so a user who navigates away keeps a full-frame
   overlay until reload. Dismiss it on route change (or make it route-scoped) and test it.

Where the skill/level detail goes: nowhere new in P1 — it remains available wherever the
progression surfaces already show it. Say so plainly in the report so the owner can ask for
a home if he wants one.

- [ ] **Step 1: Failing tests** — after a workout close the `.levelup` overlay is absent and
  the ceremony's `+N SZERZETT XP` shows the response's real value; a non-workout XP event
  still raises the overlay; navigating away from a page with the overlay open leaves no
  overlay behind.
- [ ] **Step 2-3:** FAIL → implement. **Step 4:** WHOLE-SCREEN check: close a workout and
  confirm the frame contains the ceremony and nothing above it.
- [ ] **Step 5:** Commit `fix(train): the closing ceremony owns the screen — no level-up overlay on top (mezo-e1ii9)`.

### Task 3: The ceremony's two acts, and only the prototype's content

**Files:**
- Modify: `WorkoutCeremony.tsx` (+test), `ActiveWorkoutPage.tsx` (the recap wiring),
  `docs/design_2.0/2026-09-15-ceremony-pattern.md` (the trigger table's Train row and the
  two-act wording — the prototype's Train ceremony is two SCREENS, not one screen in two
  acts; correct the doc to match what ships)

Per prototype `session.js`:
- **Step 1 `summary()`**: eyebrow, the five-star ignition, the comet bar, the three counters
  (szett / ismétlés / kg × rep), the sr-only star heading, the stats **`N′ a pulton töltött
  idő`** and **`+N szerzett XP`**, the optional `Új rekord` row, and ONE way on:
  **`Részletek · Izomcsoportok és a nyert kalória`**.
- **Step 2 `detailsStep()`**: `Izomcsoportok fejlődése a mai edzésen` (the per-muscle rows
  with mini-stars and the zone track), the kcal tile, the close CTA, and
  `Vissza az értékeléshez`.
- **Remove from the recap** the rows with no prototype counterpart: the küldetés lines
  (`PR-attempt · … SKIPPELTED`, `⚡ Túlterhelés · …`, `Mélység · …`, `Volumen · …`) and the
  streak line (`🔥 7 napos sorozat — +50 🪙`). Challenge OUTCOMES keep the home T7 gave them
  ONLY if the prototype's details step has them — it does not, so they go with the rest;
  the outcomes remain visible on the review page.
- **`a pulton töltött idő`**: production passes `minutes={null}` on a documented rationale
  (no measured duration is available pre-refetch). The prototype shows it. Resolve honestly:
  if a real measured value can be had at this moment (check whether the finish response or a
  cheap refetch carries `activeSeconds`), show it; if it genuinely cannot, keep the tile
  absent and record WHY in the report and the docs — do not print an estimate as if measured.

- [ ] **Step 1: Failing tests** — step one shows exactly the prototype's elements and the
  single `Részletek` CTA; step two shows the muscle rows + kcal + close + `Vissza az
  értékeléshez`; no küldetés or streak row anywhere; the XP tile is the response's value.
- [ ] **Step 2-3:** FAIL → implement (the rAF pass stays one-shot and reduced-motion-safe).
- [ ] **Step 4:** WHOLE-SCREEN check against the prototype's two steps. **Step 5:** Commit
  `feat(train): the closing ceremony regains its two steps (mezo-e1ii9)`.

### Task 4: The day page is only the Titanium day page

**Files:**
- Modify: `frontend/src/features/train/pages/MesoDayPage.tsx` (+test) — remove the
  pre-Titanium editor welded below the Titanium content (matrix §3: `⠿` drag handles, `🔥`
  per row, English `Grow`/`Maintain`/`Emphasize`, the `HETI SZETEK` typo, `⚠ 1 jelzés`,
  `CSÚCSHÉT · IDŐBECSLÉS`, `STRUKTÚRA`, a duplicate exercise list and a duplicate add-CTA)
- Delete any component that loses its last consumer (grep-verify)

The Titanium day page (hero + the four-cell view + the exercise cells) is what the prototype
has; everything below it is the old screen. Editing a plan day belongs to the plan editor
route, which stays reachable from the template/plan surfaces — verify that path still exists
before removing the inline editor, and say so in the report.

- [ ] Failing tests (the page renders the Titanium sections and NONE of the old markers;
  the editor route is still reachable from where it was reachable before) → implement →
  whole-screen check → commit
  `feat(train): the plan day page sheds the old editor welded under it (mezo-e1ii9)`.

### Task 5: The closed-run report ends where the prototype ends

**Files:**
- Modify: `frontend/src/features/train/pages/MesoReportPage.tsx` (+test) — remove the tail
  with no prototype counterpart: the `ÉLETMÓD-KONTEXTUS` emoji row (😴🍽⚡😰⚖️🏐🏃), the
  W1–W8 spreadsheet table, the MEV/MAV/MRV jargon block and the four-paragraph AI evaluation

The AI evaluation is a real feature with real data behind it. The prototype's closed-run
story does not show it. Give it a quiet, collapsed home at the end of the page (a `details`
the reader may open) rather than deleting it — and say so; a feature with a backend behind it
is not a design leftover. The emoji row, the spreadsheet table and the jargon block ARE
leftovers and go.

- [ ] Failing tests (no emoji row, no W1–W8 table, no MEV/MAV/MRV block; the AI evaluation
  is present but collapsed; the Titanium star hero and versus block unchanged) → implement →
  whole-screen check → commit
  `feat(train): the closed-run report keeps the story, drops the spreadsheet (mezo-e1ii9)`.

### Task 6: Kalauz stops covering Titanium pages

**Files:**
- Modify: the tutorial/Kalauz auto-open logic (find it — the matrix saw dialogs
  auto-opening over `/train/mesocycles`, `/train/sport`, `/train/medals`, `/train/futas`,
  `/train/review/:id`) + its tests

Coach-marks stay available on demand (the header `?`), but must not auto-open over a
Titanium screen. Scope the change to the Train domain's routes; do not disable the feature
elsewhere.

- [ ] Failing tests (entering those routes opens no dialog; the `?` still opens it) →
  implement → commit `fix(train): Kalauz no longer auto-opens over the Titanium pages (mezo-e1ii9)`.

### Task 7: Sweep, docs, gates, ship

- [ ] **Sweep:** every component/CSS family that lost its last consumer in Tasks 1-6,
  grep-verified on the final tree; conservative in doubt.
- [ ] **Docs:** `docs/features/train.md` — the workout flow (no prep screen, challenges in
  the glass), the ceremony's two steps and what left it, the day page and report sections;
  `docs/design_2.0/2026-09-15-ceremony-pattern.md` corrected per Task 3; update
  `docs/design_2.0/2026-09-16-train-parity-matrix.md` — tick off every row this plan closed
  so the matrix stays the live scoreboard for P2 and P3. CODEMAP regen.
- [ ] **Gates FOREGROUND:** both-mode full `pnpm test`, `npx tsc -b`, `pnpm build`,
  `pnpm test:layout`.
- [ ] **The parity gate (new, mandatory):** walk the whole workout flow and the two touched
  pages in a real browser beside the prototype, and record in the report, per screen,
  that the full frame matches (shell excluded).
- [ ] Ship (controller): push, PR (`--body-file`), CI, detached merge, post-merge CODEMAP,
  close `mezo-e1ii9`.

## Self-review notes

- Three removals would have stranded something: challenges (Task 1 → the glass), the
  skill/level detail (Task 2 → stays on the progression surfaces, owner told), and the AI
  evaluation (Task 5 → collapsed, not deleted). Everything else in this plan is a genuine
  leftover with a home elsewhere.
- P1 deliberately does NOT touch: the global shell (owner decision A), the in-card
  differences of the workout list (matrix §21 row 11 — P3), and any missing screen (P2).
- The ceremony-pattern doc is corrected rather than obeyed: the prototype is the
  specification now, and a doc that contradicts it is stale by definition.
