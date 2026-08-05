# Live zone unification — prep card + GYM tab summary — design

**Date:** 2026-08-04 · **Driving issue:** `mezo-oyhy.7` (child of the guided-meso-building epic) ·
**Status:** approved by Daniel (brainstorm 2026-08-04)

## Context

`mezo-oyhy.1` shipped the optimal-zone language (green MEV→100% band, `'under'` level,
why-explanations) — but it lives only on planning surfaces (`SetBudgetCard` in the meso editor
and `MuscleWeekSheet`). Two mid-cycle surfaces still speak the old "excess-only" language or
none at all:

- the **workout prep screen** (`ActiveWorkoutPage` `'prep'` phase) shows XP forecast and stats
  but zero zone/budget context;
- the **GYM tab meta card** (`GymPage`) shows a per-head muscle pill grid whose only signal is
  a red ⚠ on over-budget groups.

Mid-cycle we know more than at planning time: the completed workouts of the current Mon–Sun
week (`listWorkouts` + per-instance details). This child unifies the visualization AND upgrades
it to a *live* week view.

## Decisions (brainstorm, in order)

1. **Prep semantics — live weekly context.** The prep card shows, per muscle group trained
   today: sets already completed this week + today's planned contribution + the rest of the
   week's plan, all projected onto the budget/zone scale. Rejected: static plan mirror (adds
   nothing new), session-only view (answers no zone question).
2. **GYM tab — live zone bars REPLACE the pill grid.** Group-level (≤11 rows) compact bars;
   per-head detail stays one tap away (`MuscleWeekSheet`). Rejected: keeping both (long card,
   two number systems), pill recoloring only (no band, no progress).
3. **Prep bar form — variant A, three segments** (mockup 2026-08-04): done (solid muscle
   color) → TODAY (half-tone + dashed inset border) → remaining plan (ghost ~22% opacity),
   over a green zone underlay. Rejected: done-bar + "▾ ma" jump marker (plan invisible).
4. **GYM card form — variant C:** two-column mini zone bars (done solid + plan ghost, `4/10`
   numerics with ↓/⚠ marks) + the stat row goes live (`Szetek 31/74`, `Gym napok 2/4`).

## Architecture — three new units + one refactor

### 1. `ZoneTrack` — shared presentational primitive

`frontend/src/features/train/components/ZoneTrack.tsx`. Props: `zoneStart: number | null`
(0..1), `segments: { pct: number; kind: 'solid' | 'today' | 'ghost' | 'overflow' }[]`
(cumulative left-to-right, pct in 0..1 of the track), `height?: number`. Renders the
`--surface-2` track, the sage 28% zone underlay from `zoneStart` to the right edge, and the
segments in order (solid = full color, today = 55% opacity + 1.5px dashed inset border in the
deep shade, ghost = 22% opacity, overflow = coral→error gradient). Color family comes via a
`color` prop (rail + deep pair) so the primitive stays data-free.

**`SetBudgetCard` refactors onto `ZoneTrack`** (single solid segment + zone) with ZERO visual
change — its tests must pass unchanged (except swapping the internal DOM assertions if any).
This is what makes the language single-sourced.

### 2. `weekZone.ts` — live week logic

`frontend/src/features/train/logic/weekZone.ts`. Pure functions; reuses `GROUP_MEV`,
`budgetOf`, `budgetGroup`, `setStyle`, `BUDGET_GROUP_LABELS` from `setBudget.ts`.

Inputs:
- `plannedDays: MesoDay[]` (the active meso week),
- `completed: WorkoutDetailResponse[]` (this week's completed instances, meso AND custom),
- `todayPlan: { muscle: string; type: ExerciseKind; workingSets: number; targetRIR: number }[] | null`
  (the session about to start; null on the GYM tab).

Output per group (`WeekZoneRow`): `group`, `label`, `colorMuscle`, `mev`, `zoneStart`,
`doneSets`, `todaySets`, `plannedSets`, `doneBudget`, `todayBudget`, `planBudget` (all in the
0..1 budget unit), and `status: 'below' | 'entering' | 'in' | 'over'`:

- **done** — logged sets from completed instances, priced per **logged set's own RIR**
  (`setStyle(set.rir)`), skipped exercises contribute only their logged sets, plyo exercises
  excluded;
- **today** — the today-plan exercises priced by `targetRIR` (plyo excluded);
- **plan** — `muscleBudgets(plannedDays)` totals (unchanged pricing);
- `status`: `over` when done+today > 1; `entering` when done < zone floor but done+today
  reaches it (floor = MEV compared in sets: `doneSets < mev && doneSets + todaySets >= mev`);
  `in` when the floor is already reached; `below` otherwise. Groups with `mev === null`
  (traps/core) never report `entering/below` — only `in`/`over`.
- Custom-workout sets belong to whatever group their exercise's muscle maps to — they count.
- Completed sets may exceed the plan; segment math caps the drawn total at 100% with the
  `overflow` kind carrying the excess.

Row selection: **prep card** = groups present in `todayPlan`, ordered by `todaySets` desc;
**GYM card** = all groups with `plannedSets > 0` OR `doneSets > 0`, ordered by `planBudget` desc.

### 3. `useWeekMuscleLog` — data hook

`frontend/src/data/train/weekMuscleLogHooks.ts`, re-exported from `data/hooks.ts`. Composes
`useWeekWorkouts()` (already exists: this week's summaries) with `useQueries` over
`trainApi.getWorkout(id)` for instances with `status === 'completed'` (both origins). Returns
`{ details: WorkoutDetailResponse[], pending: boolean }`. Mock mode: empty array (no persisted
instances — documented behavior), pending false. Query keys `['train','workoutDetail', id]` so
they share the cache with `useWorkoutDetail`. No new backend endpoint — conscious v1 decision;
an aggregate endpoint is a later optimization if ≤6 cached fetches ever hurt.

### 4. Surface integrations

**Prep screen** (`ActiveWorkoutPage`, `'prep'` phase): new `WeekZoneCard` component
(`features/train/components/WeekZoneCard.tsx`) rendered directly below `PrepHero`. Header:
eyebrow `Heti zóna-kontextus` + sub-line `kész {n}/{m} edzés` (completed vs planned gym days).
Rows per the prep selection: name + `kész {d} · ma +{t} · terv {p}` numerics + full-width
`ZoneTrack` + status hint line (`▲ a mai edzéssel zónába érsz` sage-deep / `✓ zónában`
sage-deep / `⚠ a mai edzéssel túlmennél a kereten` error / `↓ a heti terv is a zóna alatt marad`
text-tertiary). Hidden entirely while the data hook is pending or when there is no active meso.

**GYM tab** (`GymPage` meta card): the region-grouped pill grid (mezo-ly27) is replaced by a
`ZoneMiniGrid` component (`features/train/components/ZoneMiniGrid.tsx`): two-column CSS grid,
each cell = group name + `{done}/{plan}` numeric (marks describe the WEEKLY PLAN, mirroring
the old grid's semantics: ` ↓` suffix when `plannedSets < mev`, ` ⚠` in red when
`planBudget > 1`) + a 7px `ZoneTrack` with done solid + plan-remainder ghost. Stat row updates:
`Szetek` shows `{doneSets}/{planSets}`, `Gym napok` shows `{doneDays}/{planDays}`. The card
stays a button → `MuscleWeekSheet`; `Fázis`/`Split` stats unchanged. The `overGroups` ⚠
logic and `MUSCLE_LABELS` pill code go away with the grid.

## Copy (Hungarian, final)

- Card eyebrow: `Heti zóna-kontextus` · sub: `kész {n}/{m} edzés`
- Row numerics (prep): `kész {d} · ma +{t} · terv {p}`
- Hints: `▲ a mai edzéssel zónába érsz` · `✓ zónában` · `⚠ a mai edzéssel túlmennél a kereten`
  · `↓ a heti terv is a zóna alatt marad`
- GYM cell numeric: `{done}/{plan}` (+ ` ↓` / ` ⚠`)

## Testing

- `weekZone.test.ts`: per-set-RIR pricing (mixed RIR within one exercise), plyo exclusion,
  custom-workout inclusion, skipped-exercise partial sets, status boundaries (entering at
  exactly MEV, over past 1.0), traps/core never below/entering, row selection rules for both
  surfaces, overflow capping.
- `ZoneTrack.test.tsx`: zone underlay position, segment kinds/order, null zoneStart.
- `WeekZoneCard.test.tsx`: header counts, row rendering, all four hint variants, hidden when
  no meso.
- `ZoneMiniGrid.test.tsx` + `GymPage.test.tsx` update: grid replaced, live stats, ⚠/↓ marks.
- `SetBudgetCard.test.tsx`: must stay green through the `ZoneTrack` refactor (only internal
  DOM assertions may be touched, visible copy/testids unchanged).
- Gate: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` + `node scripts/lint-docs.mjs`.

## Non-goals

- No backend aggregate endpoint (client-side over cached detail fetches).
- No change to `SetBudgetCard` semantics (plan-only surface) or `MuscleWeekSheet`.
- No zone treatment on `GymDayCard` / `DayBreakdownCard` (session-level surfaces).
- Active-session live updating (bar moving set-by-set DURING the workout) — future child.
- Volume counting stays direct-only (fractional = `mezo-oyhy.5`).
