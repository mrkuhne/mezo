# Fuel P4 — Weekly Plan / Rhythm (Terv) — implementation plan

- **Design:** [`../specs/2026-07-04-fuel-p4-weekly-plan-design.md`](../specs/2026-07-04-fuel-p4-weekly-plan-design.md)
- **bd:** `mezo-kpo` · branch `feat/fuel-p4-weekly-plan`

## Task 1 — Contract: weekly rollup endpoint
1. `api/feature/meal/meal.yml`: add `GET /api/fuel/week/{start}` (`getFuelWeek`, tag Meal) →
   `FuelWeekResponse { start: date, days: FuelDayRollup[] }`, `FuelDayRollup { date, targets: MacroSet, consumed: MacroSet }` (all required); 401 like `getFuelDay`.
2. `cd api/generate && npm run generate:api`; `cd frontend && pnpm generate:api`.
3. Backend types regen happens in `./mvnw generate-sources` (verify `FuelWeekResponse` exists after Task 2 test run).

## Task 2 — Backend: `FuelDayService.getWeek` (TDD)
1. IT first (`FuelWeekApiIT` extends `ApiIntegrationTest`, mirror the existing FuelDay/Meal IT):
   - empty week → 7 rollups `start..start+6`, zero consumed, config targets;
   - meals populated on 2 days (+ a water log) → per-day consumed sums correct, other days zero;
   - ownership isolation → another user's meals/water not counted.
2. Implement: `getWeek(UUID, LocalDate)` in `FuelDayService` (loop 7 × existing day rollup; extract a private `consumedFor(userId, date)` shared with `getDay`); `MealController.getFuelWeek`.
3. `./mvnw clean test` green.

## Task 3 — FE data layer (TDD)
1. `mealApi.getWeek(start)` → `FuelWeekData { start, days: { date, targets: MacroSet, consumed: MacroSet }[] }`.
2. `data/types.ts`: `WeeklyStats { kcalTarget: number; kcalAvgFactor: number; proteinHitDays: number; supplementsAdherence: number | null }`; type the mock const.
3. New `data/fuel/fuelWeekHooks.ts`:
   - pure helpers + unit tests: `deriveWeeklyStats(days)`, `gymDaysToSlots(days)` (active+time only, DAY_ORDER index, skip unknown), `toRetaCells(week)`, `weekTitle(mondayIso)` + `mondayIso()`;
   - `useFuelWeek()` dual-mode composing hook — return keys unchanged + additive `title`, `weeklyNote`; mock = exact seeds; real = Train/medication/`['fuelWeek', monday]` query compositions, honest-empty `patterns`/`weeklySupplements`, `weeklyNote: null`;
   - `useFuelWeekActions()` → `{ saveGymSchedule(days) }` via `useTrain().saveGymSchedule`.
   - remove `useFuelWeek` from `fuelReadHooks.ts`; re-export from `data/hooks.ts` (barrel unchanged surface).
4. Hook tests both modes (mock parity incl. existing `fuelWeekData.test.tsx`; real mode with spied `trainApi`/`medicationApi`/`mealApi` following the timeline/stack hook test precedent).

## Task 4 — FE page wiring
1. `FuelPlanPage`: `gymOverride ?? gymSchedule` local state; save handler = `setGymOverride(next)` + `saveGymSchedule(next)`; `title` from hook; guards — Reta card on `retaWeek.length`, patterns/supplement sections on length, Mezo-note row on `weeklyNote`, `—` for null adherence / zero kcal-avg.
2. Update `FuelPlanPage.test.tsx` (mode-aware where honest states differ; write-through asserted via `trainApi.replaceGymSchedule` spy in real mode).

## Task 5 — Gates + docs + close
1. `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`; backend `./mvnw clean test`.
2. `docs/features/fuel.md` (§2 Terv, §3 data-flow exception, §4 contract, §5 Train integration, §9 known gaps), `docs/features/train.md` (Fuel-as-secondary-editor seam), `docs/milestones/roadmap.md` row; `node scripts/lint-docs.mjs`.
3. `git pull --rebase` on main BEFORE merge; `--no-ff` merge; `bd dolt push && git push`; `bd close mezo-kpo` + notes.
