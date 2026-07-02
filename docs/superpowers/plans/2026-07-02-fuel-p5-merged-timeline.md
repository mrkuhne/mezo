# Fuel P5 — Day-Planner Timeline Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> v2 — rewritten for the spec's v2 planner design (Daniel's direction); v1 of this file is in git history.

**Goal:** Replace the static Mai timeline + Today preview with a deterministic day-planner: meal/supplement windows planned around real training blocks (gym/volleyball/running) and the goal's wake/bed/meals-per-day settings, per-slot kcal/macro budgets from the Goal prescription, and a fitting-recipe suggestion per un-logged slot.

**Architecture:** One small backend extension (3 nullable goal fields) + pure FE planner logic (`buildDayPlan`) + dual-mode hook composition. Mock keeps the hand-authored seed; real composes.

**Tech Stack:** React 19 + TanStack Query + MSW; Spring Boot 4 + Liquibase (Task 1–2 only); OpenAPI contract-first.

**Driving bd:** `mezo-9ys`. Spec: `docs/superpowers/specs/2026-07-02-fuel-p5-merged-timeline-design.md` (v2).
**Branch:** `feat/fuel-p5-planner` (from `main`; mezo-9ys already claimed).

## Global Constraints

- FE house standard `docs/references/frontend_conventions.md`; backend references per `CLAUDE.md` table (contract-first, `@Validated` config, constructor injection, `./mvnw clean test`, integration-first tests, populators). Commits carry `(mezo-9ys)` + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; bd hook auto-stages `.beads/issues.jsonl`.
- **Hook signatures stable:** `useFuelTimeline(): { plan: FuelPlanToday; getScoredMeal }`, `useFuelPreview(): { visible; nextStack }`. `FuelSlot` gains ONLY additive `mealId?: string` + `suggestedRecipeId?: string`.
- **Pinned planner constants** (single source `frontend/src/data/fuel/fuelConfig.ts`; unit-test-pinned; Daniel may retune later): defaults `mealsPerDay 4 / wake 06:00 / bed 23:00`; `eatingStart = wake+45min`; `kitchenClose = bed−90min`; pre-workout snap `block−75min`; post-workout snap `blockEnd+45min` (`blockEnd = time + (durationMin ?? 60)`); min slot spacing 90min; slot weights main 2 / snack 1 / post-workout main 2.5; recipe-fit kcal tolerance ±20%; C/F derivation `fat = kcal×0.275/9`, `carbs = (kcal − p×4 − fat×9)/4`; caffeine cutoff `'14:00'`.
- Real mode: no seed fallback, no fabricated prose; suggestions always labeled (`ajánlott`). Mock: seed byte-parity.
- Gates: backend `cd backend && ./mvnw clean test` (compose up, :15432); FE `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green. Time in tests via `vi.setSystemTime`.

---

### Task 1: Contract — goal planner settings

**Files:** Modify `api/feature/goal/goal.yml`; generated `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`.

- [ ] **Step 1:** In `goal.yml`, add to BOTH `GoalRequest` and `GoalResponse` schemas (optional, not in `required`):

```yaml
        mealsPerDay: { type: integer, minimum: 3, maximum: 6, description: 'Day-planner: eating occasions per day' }
        wakeTime: { type: string, pattern: '^\d{2}:\d{2}$', description: 'Day-planner wake anchor, HH:mm' }
        bedTime: { type: string, pattern: '^\d{2}:\d{2}$', description: 'Day-planner bed anchor, HH:mm' }
```

(Match the file's existing formatting style; read it first.)
- [ ] **Step 2:** `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`; verify `grep -n "mealsPerDay" api/openapi.yml frontend/src/data/_client/api.gen.ts`. Backend still compiles (optional DTO fields add no abstract methods; MapStruct unmapped-target warnings are non-fatal) — sanity `cd backend && ./mvnw clean compile -q`.
- [ ] **Step 3:** Commit `feat(api): goal planner settings — mealsPerDay + wake/bed times (mezo-9ys)`.

---

### Task 2: Backend — goal columns + round-trip (TDD)

**Files:** Create `backend/src/main/resources/db/changelog/1.0.0/script/202607021500_mezo-9ys_goal_planner_settings.sql`; modify `1.0.0_master.yml`, the goal entity (`feature/goal/entity/GoalEntity.java` — verify name), the goal mapper/service write+read paths (locate: `grep -rn "rateTargetPctPerWeek" backend/src/main/java` to find the request-apply site); test: extend the existing goal API IT (locate `feature/goal/*ApiIT.java` or `GoalContractIT`).

**Migration SQL:**

```sql
-- Fuel P5 day-planner settings on the goal (mezo-9ys): eating-occasion count + wake/bed anchors.
alter table goal add column meals_per_day smallint;
alter table goal add column wake_time varchar(5);
alter table goal add column bed_time varchar(5);
alter table goal add constraint ck_goal_meals_per_day check (meals_per_day is null or meals_per_day between 3 and 6);
```

- [ ] **Step 1: Failing IT** — extend the goal IT: `testCreateGoal_shouldRoundTripPlannerSettings_whenProvided` (POST with `mealsPerDay 4, wakeTime "06:00", bedTime "23:00"` → 201 echoes them; GET echoes them), `testUpdateGoal_shouldKeepPlannerSettingsNull_whenOmitted` (round-trip null), `testCreateGoal_shouldReject_whenWakeTimeMalformed` (`"6:00"` → 400 field error `wakeTime`; the OpenAPI `pattern` generates bean validation — if it does NOT, add service-side HH:mm validation with `SystemMessage.field("VALIDATION_INVALID_VALUE","wakeTime")` and adjust the assertion; run first to see).
- [ ] **Step 2:** Register the migration in `1.0.0_master.yml` (append-only, id `"1.0.0:202607021500_mezo-9ys_goal_planner_settings"`, author daniel.kuhne).
- [ ] **Step 3:** Entity fields (`Integer mealsPerDay` @Column(name="meals_per_day"), `String wakeTime`, `String bedTime`) + map them in the goal apply/toResponse paths (follow how an existing optional scalar like `identityFrame` flows).
- [ ] **Step 4:** `./mvnw clean test -Dtest='*Goal*'` green, then full `./mvnw clean test` green. Commit `feat(be): goal planner settings columns + round-trip (mezo-9ys)`.

---

### Task 3: FE — goal settings surface

**Files:** Modify `frontend/src/data/types.ts` (Goal + GoalInput), `frontend/src/data/me/goalApi.ts` (map fields), `frontend/src/data/me/goalHooks.ts` (`toGoal`), `frontend/src/data/me/goals.ts` (seed values `4/'06:00'/'23:00'` on the active goal), `frontend/src/features/me/sheets/EditGoalSheet.tsx` (+ its test); tests: `goalHooks`/`goalApi` test files.

**Interfaces (produces):** `Goal` gains `mealsPerDay: number | null; wakeTime: string | null; bedTime: string | null`; `GoalInput` likewise; `useGoal().goal` carries them.

- [ ] **Step 1: Failing tests** — goalApi mapper round-trips the three fields (toRequest/fromResponse); EditGoalSheet renders a "Napi ritmus" section (stepper `3–6` labeled `Étkezés/nap`, two `<input type="time">` for `Ébredés`/`Lefekvés`) and submits them in the payload.
- [ ] **Step 2: Implement** — additive; the sheet's fields default from the loaded goal (`?? 4 / '06:00' / '23:00'`). Follow the sheet's existing field-row idiom.
- [ ] **Step 3:** Both-mode FE tests green; commit `feat(fe): goal planner settings — EditGoalSheet Napi ritmus (mezo-9ys)`.

---

### Task 4: FE — `fuelConfig` + additive `FuelSlot` fields + id-based `getScoredMeal`

**Files:** Create `frontend/src/data/fuel/fuelConfig.ts`; modify `frontend/src/data/types.ts`, `frontend/src/data/fuel/fuel.ts`; test `fuelData.test.tsx`.

- [ ] **Step 1:** `fuelConfig.ts` exports every pinned constant from Global Constraints (`PLANNER_DEFAULTS = { mealsPerDay: 4, wake: '06:00', bed: '23:00' }`, `CAFFEINE_CUTOFF = '14:00'`, `EATING_START_OFFSET_MIN = 45`, `KITCHEN_CLOSE_OFFSET_MIN = 90`, `PRE_WORKOUT_SNAP_MIN = 75`, `POST_WORKOUT_SNAP_MIN = 45`, `DEFAULT_BLOCK_MIN = 60`, `MIN_SLOT_GAP_MIN = 90`, `SLOT_WEIGHT = { main: 2, snack: 1, postWorkoutMain: 2.5 }`, `RECIPE_FIT_TOLERANCE = 0.2`, `FAT_KCAL_SHARE = 0.275`) + time helpers `toMin('HH:mm'): number` / `toHHmm(min): string` (clamped 0..1439).
- [ ] **Step 2:** `FuelSlot` gains `mealId?: string; suggestedRecipeId?: string`. Seed slots `'Túrós zabkása · áfonyával'` → `mealId: 'm1'`, `'Csirke + édesburgonya + spenót'` → `mealId: 'm2'` (verify ids `grep -n "id: 'm" frontend/src/data/fuel/fuel.ts`). `getScoredMeal` → `slot.mealId ? meals.find(m => m.id === slot.mealId && m.breakdown) ?? null : null`; failing-test-first on both behaviors (id hit; no-mealId → null even with matching title).
- [ ] **Step 3:** Green (`fuelData` + `FuelMaiPage` score-sheet test) + commit `feat(fe): fuelConfig planner constants + id-based getScoredMeal (mezo-9ys)`.

---

### Task 5: FE — `buildProtocol` anchor-aware times (additive)

**Files:** Modify `frontend/src/features/fuel/logic/buildProtocol.ts`, `frontend/src/data/types.ts` if a type is needed; test `buildProtocol.test.ts`.

- [ ] **Step 1: Failing tests** — new optional 3rd param `anchors?: { wake: string; preWorkout?: string; bedtime: string }`: with anchors `{wake:'06:30', preWorkout:'17:15', bedtime:'22:30'}` the wake slot time is `06:30`, the pre-workout slot `17:15`, the evening slot `20:30` (bed−120); WITHOUT anchors every existing test stays green unchanged (hardcoded times preserved).
- [ ] **Step 2: Implement** — thread times: wake slot `anchors?.wake ?? '05:50'`; pre-workout `anchors?.preWorkout ?? '06:50'`; pre-fuel snack stays relative to pre-workout (−30min via `toMin`/`toHHmm`) when anchored, else `06:20`; midday unchanged `12:30`; evening `anchors ? toHHmm(toMin(anchors.bedtime) − 120) : '21:00'`.
- [ ] **Step 3:** Green + commit `feat(fe): buildProtocol anchor-aware slot times (mezo-9ys)`.

---

### Task 6: FE — `buildDayPlan` pure planner (the core)

**Files:** Create `frontend/src/features/fuel/logic/buildDayPlan.ts`; test `buildDayPlan.test.ts`.

**Interfaces (produces):**

```ts
export interface PlannerBlock { kind: 'gym' | 'sport' | 'run'; time: string; durationMin: number | null; label: string }
export interface DayPlanInput {
  wake: string; bed: string; mealsPerDay: number
  blocks: PlannerBlock[]
  budget: { kcal: number; p: number; c: number; f: number }
  meals: FuelMeal[]
  recipes: Recipe[]
  protocolSlots: ProtocolSlotData[]
  intakes: Intake[]
  nowHHmm: string
}
export function buildDayPlan(input: DayPlanInput): FuelPlanToday
export function deriveDailyBudget(segment: { kcal: number; proteinG: number } | null, fallback: MacroSet): { kcal: number; p: number; c: number; f: number }
```

- [ ] **Step 1: Verify literals** — real `FuelMeal.slot` format from `mealApi.ts` `fromResponse` (enum vs display string) → write `mealSlotKey(m): 'breakfast'|'lunch'|'dinner'|'snack'|null` handling both real + mock formats; `ProtocolSlotData.kind` literals from `buildProtocol.ts` → `PROTOCOL_KIND` map onto `FuelKind` (wake→wake, pre-workout→preworkout, midday→midday, evening→evening, the pre-fuel/pre-snack literal→snack).
- [ ] **Step 2: Failing unit tests** (fixtures only, cover): window placement 3/4/5/6 meals across `wake+45 → bed−90` (exact expected times asserted for the default 06:00/23:00 case); evening-volleyball day (18:15+90) → a slot snaps to 17:00 (pre) and dinner to 20:15 (post) clamped to kitchenClose; morning-gym day (07:30, duration null → end 08:30) → breakfast at 09:15; ≥90min spacing enforced by forward-push; budget split sums EXACTLY to the daily budget per macro (rounding remainder lands on dinner); post-workout main weighs 2.5; `deriveDailyBudget` from a segment `{kcal:2150, proteinG:163}` → `f = round(2150×0.275/9)`, `c = round((2150 − 163×4 − f×9)/4)`, and from `null` → the fallback MacroSet passthrough; recipe fit: category match + per-serving kcal within ±20% of the slot budget, rank |Δkcal| → starred → |Δp|, winner sets `suggestedRecipeId` + `mealName` + the RECIPE's per-serving macros on the slot; no candidate → budget macros on the slot, no `suggestedRecipeId`; logged meals render done with `mealId` + real macros and consume their window (multi-snack matching in time order); intake pips done-state; now-flag = LAST slot with `time <= nowHHmm && state !== 'done'`; blocks render as workout/sport slots (`run` → kind `sport`, label carries `Futás`).
- [ ] **Step 3: Implement** (structure — helpers small and pure):
  1. `windows = placeWindows(wake, bed, mealsPerDay, blocks)` → `{ slotKey, kind: 'meal'|'snack', label, time, weight }[]`: mains `['Reggeli','Ebéd','Vacsora']` at span fractions 0/0.5/1, snacks at midpoints (4→after Ebéd; 5→both gaps; 6→+pre-Reggeli snack at span 0.1... pin: 6th = an extra evening snack between Vacsora−90 and Vacsora); apply block snaps (nearest earlier slot → `block−75`; first main after `blockEnd` → `+45`); clamp to `[eatingStart, kitchenClose]`; forward-push to keep 90min gaps; post-workout main gets `weight 2.5`.
  2. `budgets = splitBudget(budget, windows)` (weights; per-macro whole rounding; remainder → dinner).
  3. `fillWindows(windows, meals, recipes, budgets)` → FuelSlots (logged → done; else suggestion/budget slot).
  4. protocol slots + block slots + sort + now-flag (reuse the v1 rules).
  5. Top fields: `workout` from the gym block (type from label), `volleyball` from the sport block, `bedtime`/`kitchenClose` derived, `caffeineCutoff` const.
- [ ] **Step 4:** Green + commit `feat(fe): buildDayPlan deterministic planner + tests (mezo-9ys)`.

---

### Task 7: FE — dual-mode `useFuelTimeline` + `useFuelPreview`

**Files:** Create `frontend/src/data/fuel/timelineHooks.ts` (+ test); modify `frontend/src/data/fuel/stackHooks.ts` (export `useIntakes`), `fuelReadHooks.ts` (drop `useFuelTimeline`), `frontend/src/data/hooks.ts`, `frontend/src/data/today/todayHooks.ts` (`useFuelPreview` composes the hook) + its tests; MSW handlers if a default is missing.

- [ ] **Step 1: Failing hook tests** — mock: `plan` === seed byte-parity + id-based getScoredMeal; real (MSW: goal with settings+prescription segment, one logged meal, one intake, schedules): plan contains planner windows with budgets, the logged meal done, a recipe suggestion when the recipes handler returns a fitting one; cold-load → planner windows from defaults with config-fallback budget (never the seed); `useFuelPreview` slices the same plan (shape unchanged).
- [ ] **Step 2: Implement** — real branch composes: `useFuelDay(date)`, `useGoal()` (active goal → settings + current-week prescription segment: `week = clamp(floor(daysBetween(goal start?, today)/7)+1)` — read how `GoalRecept`/timeline derive the current week and reuse; if no derivation exists, pick the segment whose `fromWeek..toWeek` contains the goal's `currentWeek` field if present, else the FIRST segment — pin choice in a comment + test), `useRecipes()`, `useProtocol()`/`useStack()`/`useIntakes(date)`, `useTrain()` (gym today + sport today), running (read `runningHooks`/`runningAgenda.ts` for the existing today-session derivation and reuse) → `blocks[]`; `buildProtocol(selection, stash, anchors)` with anchors from settings + first block; `buildDayPlan({...})`. All hooks called unconditionally; only the return branches on `isMockMode()`.
- [ ] **Step 3:** Both-mode green + commit `feat(fe): dual-mode planner timeline + Today preview composition (mezo-9ys)`.

---

### Task 8: FE — rendering (ajánlott chip, budget line, tap-to-log, real context strip)

**Files:** Modify `SlotCard.tsx`, `TimelineSlot.tsx`/`FuelTimeline.tsx` (prop threading), `FuelMaiPage.tsx`, `FuelTimelinePreview.tsx`, `LogMealSheet.tsx` (optional `initialSlot?: MealSlot`); colocated tests.

- [ ] **Step 1: Failing tests** — SlotCard: pending slot with `suggestedRecipeId` shows the recipe name + an `ajánlott` chip + tap fires `onLogMeal(slot)` (page prefills `{source:'recipe', recipeId}`); pending slot without suggestion shows label + `~{kcal} kcal · P{p} C{c} F{f}` + `Logolás` affordance (`aria-label={`${label} logolása`}`) → `onLogMeal(slot)` (page opens LogMealSheet with `initialSlot`); workout slot without `duration` renders no `· perc` suffix. FuelMaiPage real mode: context strip shows schedule-derived values; preview renders placeholder labels.
- [ ] **Step 2: Implement** — additive `onLogMeal?: (slot: FuelSlot) => void` threaded FuelTimeline→TimelineSlot→SlotCard; `LogMealSheet` `initialSlot` seeds its slot segmented state; FuelMaiPage maps slot→`MealSlot` via label match against the planner windows (export `slotKeyOfLabel` from fuelConfig) and passes prefill; context strip switches to `plan.workout.*` (duration cell only when > 0).
- [ ] **Step 3:** Both-mode green + build + commit `feat(fe): planner slots on Mai + Today — suggestions, budgets, tap-to-log (mezo-9ys)`.

---

### Task 9: Docs + gates + close + merge

- [ ] **Step 1:** Update `docs/features/fuel.md` (§2 Mai planner, §3 timelineHooks, §4 goal fields note, §5 Goal/Train/Recipes seams), `docs/features/goal-engine.md` + `me.md` (settings), `today.md` (preview), roadmap plan P5 ✅ note (planner scope + v2 spec pointer), `docs/milestones/roadmap.md`; `node scripts/lint-docs.mjs` PASS (reconcile rippled docs per precedent).
- [ ] **Step 2:** Full gates: `./mvnw clean test` + both FE modes + build.
- [ ] **Step 3 (controller):** docs commit; `bd close mezo-9ys`; bd sync commit; `git checkout main && git pull --rebase && git merge --no-ff feat/fuel-p5-planner -m "Merge feat/fuel-p5-planner: Mai day-planner timeline (mezo-9ys)" && git branch -d feat/fuel-p5-planner && bd dolt push && git push`.
