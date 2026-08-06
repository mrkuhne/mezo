# Session-length estimate while building — design

**Date:** 2026-08-06 · **Driving issue:** `mezo-oyhy.3` (child of the guided-meso-building epic) ·
**Status:** approved by Daniel (brainstorm 2026-08-06)

## Context

No reviewed market app estimates session length while the user BUILDS a plan
(`docs/research/comparisons/plan-builder-guidance-ux.md`) — this child ships that
differentiator. Today mezo's only duration figure is `durationEst`, a data-provided field
(mock seed hardcodes 78/62; real mode takes the backend value `?? 0`) consumed by three UIs
(prep pill via `prepStats`, TrainTodayPage chip, TodayPage facts). It is not computed from
the plan, is often 0 in real mode, and the meso editor has nothing. Target band: 45–90 min
(research: 20 min too short for meaningful stimulus, 3 h counterproductive; Nippard 60–90).

## Decisions (brainstorm)

1. **The client-side estimator is the single source.** All three existing `durationEst` UI
   reads switch to the estimator; the API/mock field stays (contract untouched) but no UI
   reads it. One formula everywhere; real mode always has a value; editor and prep can never
   disagree. Rejected: backend-wins-with-fallback (two sources, divergent numbers).
2. **Editor surface: hero stat + lint rule.** `MesoEditorHero` gains a per-day `~X perc`
   stat; the 45–90 band lands as the 8th `structureLint` rule (`session-length`) in the
   existing Struktúra card. Rejected: a separate time row on the day strip (more surfaces,
   more noise).

## The model

`estimateSessionMinutes(exercises)` — pure, constants in one exported table
(`SESSION_TIME`), input is a minimal structural type so both `GymExercise` and
`LoggedWorkoutExercise` satisfy it:
`{ type: ExerciseKind; workingSets: number; warmupSets: number; repMin: number; repMax: number }[]`.

Per exercise:
- **working set execution:** `avgReps × 3.5 s` (`avgReps = (repMin + repMax) / 2`); plyo:
  `avgReps × 2 s`
- **inter-set rest:** `restSecondsFor(type)` seconds between working sets —
  `(workingSets − 1)` rests (reuses the live rest engine's constants: compound 150 s,
  everything else 90 s — no new rest numbers)
- **warm-up sets:** `warmupSets × (20 s + 45 s rest)`
- **transition overhead:** 90 s per exercise (setup, plates, moving)

Per session: `+ 8 min` warm-up block (the prep screen's fixed block) when the exercise list
is non-empty. Empty list → 0. Result rounded to whole minutes.

Sanity anchor (mock Pull day, 5 exercises ≈ 16 working sets, mixed compound/isolation):
lands in the ~60–75 min range — same ballpark as the seed's hand-written 78/62, so the swap
is not a jarring UX change.

## Surfaces

1. **`MesoEditorHero`** — new `dayMinutes: number` prop; renders `~{dayMinutes} perc` next
   to the `{dayExerciseCount} gyakorlat` label (mono style, `·`-separated). 0 → the minutes
   fragment is omitted (off-days).
2. **`structureLint` rule 8 — `session-length`:** flags training days outside
   `SESSION_LENGTH_BAND = { min: 45, max: 90 }` minutes. Session-scoped finding
   (day-ordered with the others). Copy below. `StructureRuleId` union gains
   `'session-length'`. The rule calls `estimateSessionMinutes(d.exercises)`.
3. **Prep pill** — `prepStats` computes `durationEst: estimateSessionMinutes(W.exercises)`
   (the `W.durationEst` read is dropped). The `durationEst > 0` hide-guard stays (honest for
   truly empty plans).
4. **`TrainTodayPage` chip + `TodayPage` facts** — both switch from `workout.durationEst`
   to `estimateSessionMinutes(workout.exercises)` (TodayPage today would even render `~0
   perc` on a backend zero — the switch fixes that; guard `> 0` there too).

Cross-feature note: `TodayPage` (features/today) imports
`@/features/train/logic/sessionLength` — deep absolute import per the house convention.

## Copy (Hungarian, final)

- Hero stat fragment: `{n} gyakorlat · ~{m} perc`
- Lint short: `{Nap}: ~{m} perc.` → hosszú: `A produktív sáv 45–90 perc — 20 perc túl rövid az érdemi ingerhez, 3 óra már kontraproduktív.` (same detail for both under and over)
- Prep/Today chips keep their existing `~{m} perc` format.

## Testing

- `sessionLength.test.ts`: model cases hand-computed (single compound; compound+isolation
  mix; plyo pricing; warm-up sets; transition overhead; empty → 0; rounding).
- `structureLint.test.ts`: band boundaries via crafted days (a day just inside vs outside
  45 and 90 — construct by set counts, assert with the estimator itself to avoid magic
  numbers), rule id, day scoping; clean-week fixture may need rebalancing to stay clean.
- `MesoEditorHero.test.tsx` (+ `MesoEditor.test.tsx` wiring): `~X perc` renders, omitted at 0.
- `prepBriefing.test.ts`: durationEst now computed (mock W's exercises), not the seed's 78.
- `TrainTodayPage.test.tsx` / TodayPage coverage: chip shows computed value; zero-exercise
  guard.
- Gate: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` + `node scripts/lint-docs.mjs`.
- **Visual goldens WILL change** (`train-session` prep pill, `train` Mai chip, `today`
  facts): regenerate via `gh workflow run update-visual-baselines.yml -r <branch>` before
  merge (established flow).

## Non-goals

- No per-exercise time display, no live in-session countdown aggregation.
- No API change (`durationEst` stays in the contract; UI just stops reading it).
- No user-tunable pacing constants.
- Rep-zone hint (`mezo-oyhy.4`), generator integration (`mezo-oyhy.6`).
