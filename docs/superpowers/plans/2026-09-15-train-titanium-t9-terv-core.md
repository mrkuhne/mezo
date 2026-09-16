# Train Titanium T9 — Terv Core Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** the Terv tab speaks the owner-approved language — the running mesocycle IS the
landing (poster + full-name day cards + quiet doorways), the day page opens on a body-map
hero, the week review ranks muscles by room-to-ceiling in words, and the one-muscle page
carries the gauge with merged labels and the versus-previous bars. The library moves intact
behind a quiet entry (its FACE rebuild is T10).

**Architecture:** frontend-only. The landing inverts: `MesocycleLibraryPage` becomes the
active-meso poster page; the current library sections move VERBATIM (markup + tests) to a new
`/train/mesocycles/konyvtar` page so nothing loses its entry (the T4 lesson). The three
detail pages reface onto the Mozaik/Titanium scaffold with a new `pl-`* CSS section; all view
math stays in the existing `logic/` modules (mesoBands, mesoWeek, dayTiles) extended only
where the prototype needs a derivation that is missing. `MesoExercises` (the PUT save-path
owner) and the arrow-based reorder are untouched.

**Tech stack:** React, existing hooks (`useTrain`, `useMesocycleVolumeArc`, `useMesoTemplates`,
`useTimingProfile`), vitest/RTL, prototype.css tokens, BodyMap/MuscleChip from T3.

**Driving artifacts:** approved prototype `plan-pages.js`/`plan-state.js`/`plan.css`; recon
2026-09-15 (Terv anchors); bd `mezo-88iwa.10`; branch `feat/train-titanium-terv-core`.

## Global Constraints

Everything in `2026-09-15-train-titanium-slices.md` §Global Constraints, plus binding:

- Owner decision 2026-09-13: the running mesocycle is the page, not a row in a library.
- The wire tier enum (`emphasize|grow|maintain`, `train.yml:2188`, sparse — absent = grow)
  NEVER changes; Hungarian is a display map only (Tartás/Építés/Hangsúly), ONE shared map.
- Language rules: one plain sentence per page; the jargon ban (soha: plafon/optimum/rámpa/
  tier/blokk mid-sentence → felső érték/szett/szinten tartod/pihenőhét/terv); explanations
  behind clay ⓘ (the app's detail-sheet idiom); percent drawn, never text-only; em dash for
  missing data; down/deload never red.
- Reachability: every tile/section of today's library page stays reachable after the
  inversion (the konyvtar page carries them; the landing's quiet doorway reaches it; the
  `overview` redirect at `router.tsx:293` survives).
- `MesoExercises`, `MesoWeekEditor`, `MesoDayEditor` are shared with the planner/template
  editor — reface around them, never fork; reorder stays arrow-based.
- Real-mode T0: null arc is NOT an error (`MesoMusclePage.tsx:44-52` idiom);
  skeleton-before-ghost everywhere.
- Test honesty: the landing's 24 tests move with their sections (library page) or adapt to
  the poster (landing); the detail pages' 10/11/8/11 pinned contracts adapt, never vanish —
  every deletion justified line-by-line in the report.

Verified anchors: `MesocycleLibraryPage.tsx` sections `:107/:129-177/:190/:207-248` (+stale
comments `:5-6,71-74` to clean); `MesoWeekPage.tsx` (+`TIER_LABEL :24`), `MesoMusclePage.tsx`
(raw English tier at `:98`, tone idiom `:77`, T0 arc `:44-52`), `MesoDayPage.tsx` (tone `:26`,
skeleton comment `:28-41`, `MesoExercises` mount `:47-50`); `logic/mesoBands.ts`
(`weekDots/phaseChip/runBands/nextRolloverChips/deciderSentence`), `logic/mesoWeek.ts`
(`muscleTiles/peakWeek/weekSummary/whereItWorks/previousBlock`), `wizard/dayTiles.ts`
(`dayTileData`); volume-arc contract `train.yml:204/:1995-2075`; profile mev/mav/mrv
`train.yml:1907`; routes `router.tsx:267/:285/:288/:291-293`; prototype `planHome:60`,
`planDay:133`, `planWeek:192`, `planMuscle:231`.

---

### Task 1: The shared tier vocabulary + the `pl-` CSS section

**Files:**
- Create: `frontend/src/features/train/logic/tierLabel.ts` + test
- Modify: `frontend/src/features/train/pages/MesoWeekPage.tsx:24` (drop the local map),
  `frontend/src/features/train/pages/MesoMusclePage.tsx:98` (raw English → the map)
- Modify: `frontend/src/styles/prototype.css` (new `/* — terv (Titanium, T9) — */` section)
  + `frontend/src/shared/ui/mozaik/prototypeCssStructure.test.ts` registration

**Interfaces:**
- Produces: `export const TIER_LABEL: Record<'maintain'|'grow'|'emphasize', string> =
  { maintain: 'Tartás', grow: 'Építés', emphasize: 'Hangsúly' }` and
  `export function tierLabel(tier: string | null | undefined): string` (unknown/absent →
  'Építés', the wire's sparse-default).
- Produces the CSS families the later tasks consume, ported from the prototype `plan.css`
  with `--mz-*`/train-tone tokens and a `tr9-` uniqueness check against Tailwind utilities
  (the T5 `.overline` lesson — prefix everything `pl-` → verify none of the ported class
  names collide with a Tailwind v4 utility by grepping the built CSS in the task's build
  step; rename with a `plx-` prefix on any collision): the landing poster
  (`.pl-poster` family: week numeral, ring, sheen, week arc), day cards (`.pl-day*`: full
  name + MA chip + boxed facts + muscle bars), dest tiles (`.pl-dest*`), day-page hero
  (`.pl-dhero*` incl. the body-map slot), exercise view cells (`.pl-ex*` 4-cell grid), week
  rows (`.pl-item*`), muscle gauge (`.pl-scale*` with pin + `--nudge` label clamping),
  versus bars (`.pl-versus*`), reveal hooks reuse the app's `EntranceGroup` (no new
  IntersectionObserver — the `.rise`/`--d` idiom).

- [ ] **Step 1:** tierLabel test (three labels, sparse default) → FAIL → implement → PASS;
swap the two pages onto it (their tests keep passing — adapt the week page's label query if
it pinned the local map's strings; the muscle page's English-tier rendering gets a NEW
assertion: 'Hangsúly' renders, 'Emphasize' never).
- [ ] **Step 2:** structure-gate registration (failing) → port the CSS → mozaik suite PASS →
`pnpm build` + grep dist css for collisions with the ported names (document the check).
- [ ] **Step 3:** Commit `feat(train): shared Hungarian tier vocabulary + the pl- Titanium section (mezo-88iwa.10)`.

### Task 2: The library moves intact to `/train/mesocycles/konyvtar`

**Files:**
- Create: `frontend/src/features/train/pages/MesoKonyvtarPage.tsx` (+ test file, MOVED from
  the landing's library-section tests)
- Modify: `frontend/src/app/router.tsx` (add the route beside `:267`),
  `frontend/src/app/navModel.ts` (the Terv tab's `owns` gains `/train/mesocycles` deep
  routes ALREADY — verify `konyvtar` lights Terv via the prefix rule; add nothing unless the
  test proves otherwise)
- Modify: `MesocycleLibraryPage.tsx` — the Sablonok/Új blokk/Futóblokkok/Tervezett/Történet+
  Összevetés sections and their handlers CUT here (the page keeps ONLY what Task 3 rebuilds)

The move is verbatim: same components, same copy, same test assertions re-hosted (the 24
landing tests split: library-section tests move to the new page's file; the poster tests
arrive in Task 3). The new page uses the MozaikPage scaffold with `PageHead onBack` →
`/train/mesocycles`, title "Edzéstervek", and keeps the DS-era section faces as-is (T10
refaces them).

- [ ] **Step 1:** failing route/render test for the new page (each moved section renders;
Futóblokkok still navigates `/train/futas`; Összevetés selection mode works re-hosted).
- [ ] **Step 2:** move; the landing temporarily renders the ActiveMesoCard + a plain doorway
button "Edzéstervek" → `/train/mesocycles/konyvtar` (Task 3 replaces the face). Clean the
stale `:5-6,:71-74` comments while the file is open.
- [ ] **Step 3:** `CI=true npx vitest run src/features/train/pages src/app` + tsc PASS.
- [ ] **Step 4:** Commit `feat(train): the plan library moves intact behind /train/mesocycles/konyvtar (mezo-88iwa.10)`.

### Task 3: The landing becomes the running block's poster page

**Files:**
- Modify: `MesocycleLibraryPage.tsx` → rename to `MesoTervPage.tsx` (route entry + imports;
  `git mv` so history follows) + its test file
- Test: the poster face per the prototype `planHome:60`

Anatomy (prototype `planHome`, app data): full-bleed `.pl-poster` — big `currentWeek`
numeral + "hét / {weeks}" + phase pill (`phaseChip`), the meso name, ONE plain sentence
("A hat hétből a {n}. héten jársz." style), the week arc (`weekDots`-fed, deload hatched);
then "A heted" — one card per template day with FULL weekday name + MA chip on today
(`dayTileData`; rest days as slim rows), boxed facts (szett/perc/gyakorlat via clay icons)
and per-muscle mini bars; then two `.pl-dest` tiles — "Melyik izmod hol tart" →
`.../week` and "Edzéstervek" → `.../konyvtar`; then the quiet close row (opens the existing
`MesoCloseSheet` the builder page uses — reuse, don't fork); no-active-meso → the page
renders the konyvtar doorway + the existing planned/ghost affordances honestly (the
`Tervezett` list stays reachable on the konyvtar page).

Behavior contracts preserved: `Heti vizsgálat` reachability (the dest tile), the builder
deep-link (`/train/mesocycles/:id`) still reachable — the poster itself navigates there on
tap of the header area exactly as `ActiveMesoCard` did (`:190` whole-card idiom).

- [ ] **Step 1:** adapt/write the failing poster tests (week numeral + phase pill text; MA
chip on the mock's today; dest routes; close row opens the sheet; no-active state).
- [ ] **Step 2:** rebuild. **Step 3:** pages+app suites + tsc PASS. **Step 4:** Commit
`feat(train): the running block IS the Terv landing — poster, day cards, quiet doorways (mezo-88iwa.10)`.

### Task 4: MesoDayPage — the day opens on a body-map hero

**Files:** `MesoDayPage.tsx` + test; (BodyMap's first in-plan consumer)

Anatomy (prototype `planDay:133`): full-bleed `.pl-dhero` in the day's tone — `BodyMap`
(`views="auto"`, heat = the day's muscles at 'in') floating in the art slot, big working-set
numeral, pills (perc via `timingProfile`, "a heted {p}%-a" drawn as a mini bar + words,
never bare text); the per-muscle one-line rows (`.pl-mrow`, 8-set marker); the exercise VIEW
cells above the editor: per exercise a `.pl-ex` card — index + `MuscleChip` + name + the
4-cell labelled grid (szett×ismétlés tinted, RIR, kg induló — 0 kg = "saját testsúly", 
bemelegítő; plank-style hold = "tartás" when repMin/max are 0) — rendered from the SAME rows
`MesoExercises` edits (read-only summary above, the editor below unchanged).

- [ ] **Step 1:** failing tests (hero numeral, bodyweight/tartás cell words, week-share bar
present as graphic, editor still mounted + save path untouched — the existing 8 contracts
adapted). **Step 2:** implement. **Step 3:** suites + tsc. **Step 4:** Commit
`feat(train): the plan day opens on a body-map hero with labelled exercise cells (mezo-88iwa.10)`.

### Task 5: MesoWeekPage + MesoMusclePage Titanium faces

**Files:** `MesoWeekPage.tsx`, `MesoMusclePage.tsx` + tests

Week (`planWeek:192`): full-bleed hero with `BodyMap views="both"` (heat from
`muscleTiles`' status), ranked `.pl-item` rows by room-to-ceiling with the verdict sentence
per muscle ("Még {n} szett fér bele." / "Ezt most szinten tartod." / "Elérte a felső
értéket ebben a tervben.") — the tier words via `tierLabel`; rollover banner stays.
Muscle (`planMuscle:231`): hero in the muscle tone; the say/next sentences; the
`.pl-scale` gauge replacing `VolumeBand` ON THIS PAGE ONLY (VolumeBand remains for other
consumers): zone + pin + landmarks with the merged-label rule (when the lower landmark
equals the ceiling → ONE caption "ennyitől fejlődik — és itt tartod") and `--nudge`
edge-clamping; the week arc; the where-rows; the previous-block versus bars (`.pl-versus`,
never red on down). T0 null arc keeps the existing honest branch.

- [ ] **Step 1:** failing tests incl. the merged-label case (a maintain muscle renders the
single caption) and the never-red assertion (class check on a negative delta). **Step 2:**
implement. **Step 3:** suites + tsc. **Step 4:** Commit
`feat(train): week review and one-muscle pages speak the Titanium language (mezo-88iwa.10)`.

### Task 6: Gates, docs, ship

- [ ] Full FE both modes, build (chunk + collision grep), layout suite; docs/features/
train.md Terv sections rewritten (incl. the 5-tile → konyvtar/doorway reality and the tile
count staleness at §2); CODEMAP regen + check; commit docs + this plan file; push
`feat/train-titanium-terv-core`; PR; CI; detached merge; close `mezo-88iwa.10`.

## Self-review notes

- Owner-decision coverage: landing inversion (T3), library reachability (T2), day hero +
  4-cell exercise view (T4), week ranking + muscle gauge with merged labels/versus (T5),
  tier vocabulary Hungarian-only display (T1). T10 owns the library FACE, report, compare.
- The T5 `.overline` lesson is a named check in Task 1 (built-CSS collision grep).
- Type consistency: `tierLabel` consumed in T3/T5; `dayTileData`/`muscleTiles` signatures
  unchanged; BodyMap heat levels from `weekZone` statuses as typed in T3's component.
