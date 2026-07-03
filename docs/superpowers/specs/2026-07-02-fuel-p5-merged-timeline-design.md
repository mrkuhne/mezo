# Fuel P5 — Mai merged timeline + deterministic day-planner design

- **Date:** 2026-07-02 (v2 — same-day rewrite on Daniel's direction: planned slots instead of
  generic placeholders; v1 of this file is in git history)
- **Status:** designed — awaiting Daniel's spec review before implementation
- **Driving bd:** `mezo-9ys` (roadmap P5)
- **Parent roadmap:** [`docs/superpowers/plans/2026-06-26-fuel-completion-roadmap.md`](../plans/2026-06-26-fuel-completion-roadmap.md) §P5
- **Depends on (all shipped):** P2 supplement_intake + protocol (mezo-09g), P3 medication, meal-logging,
  Train gym/sport schedules + running blocks, Goal engine G-series (prescription segments), sleep logs.
- **Living docs to update on ship:** `docs/features/fuel.md`, `docs/features/today.md`, `docs/features/goal-engine.md` (settings), `docs/features/me.md` (Goal edit)

## 1. Problem & direction

The Mai pacing timeline and Today's preview are hand-authored fiction (static `fuelPlan.today`,
title-string meal join, Train-disconnected blocks). Daniel's direction (2026-07-02): instead of
honest-but-empty generic placeholders, build a **deterministic day-planner** — plan the day's meal
and supplement windows around the REAL training blocks (gym, volleyball, running) and the user's
wake/sleep times; give every planned meal slot a kcal/macro budget derived from the **Goal
prescription** (the Cél section's daily targets); suggest a **fitting recipe** for each un-logged
slot, or show the recommended kcal/macro split when no recipe fits. Deterministic rules + math —
the AI prose/replan layer stays P8.

## 2. Decisions

1. **Client-side composition** (unchanged from v1): a pure `buildTimeline()` merges the sources;
   the only backend work in this slice is the small Goal-settings extension (below). The protocol
   slots stay FE-computed (P2 selection-only persistence).
2. **Planner settings live on the Goal** (Daniel: "a célnál lehessen megadni"): the goal gains
   three nullable fields — `mealsPerDay` (3–6), `wakeTime` (HH:mm), `bedTime` (HH:mm) — with
   FE defaults `4 / 06:00 / 23:00` when unset. Sleep-log-derived wake/bed refinement is a P8 note
   (the data exists: `sleep_log.bedtime/wakeup`).
3. **Daily budget source — fallback chain:** the ACTIVE goal's prescription segment for the current
   goal-week (`prescription.segments[]`: `kcal` + `proteinG`) → else the config `FuelDay.targets`
   (`mezo.nutrition.*`). Carbs/fat are not in the prescription, so a fixed split rule derives them:
   **fat = 27.5% of kcal ÷ 9, carbs = remainder ÷ 4** (matches the `mezo.nutrition` ratio).
4. **Mock mode keeps the hand-authored seed**; real mode composes. Real mode fabricates no prose —
   a suggested recipe is labeled as a suggestion (`ajánlott`), never presented as a done fact.
5. `getScoredMeal` becomes id-based via the additive `FuelSlot.mealId` (unchanged from v1).

## 3. The planner: `buildDayPlan` (pure logic)

`features/fuel/logic/buildDayPlan.ts` — deterministic, fixture-tested; inputs injected, no clock/IO:

```
input: {
  wake, bed: 'HH:mm'                    // goal settings (defaults applied by the hook)
  mealsPerDay: 3..6
  blocks: { kind: 'gym'|'sport'|'run'; time: 'HH:mm'; durationMin: number|null; label: string }[]
  budget: { kcal: number; p: number; c: number; f: number }   // daily, after the fallback chain
  meals: FuelMeal[]                      // the day's logged meals
  recipes: Recipe[]                      // for suggestions
  protocolSlots: ProtocolSlotData[]      // buildProtocol output (anchor-aware, see §5)
  intakes: Intake[]
  nowHHmm: string
}
output: FuelPlanToday                    // existing shape; FuelSlot gains mealId? + suggestedRecipeId? + slotKey?
```

**Meal-window placement.** `mealsPerDay` maps to a structure: 3 = Reggeli/Ebéd/Vacsora; 4 = +1 snack;
5 = +2 snacks; 6 = +3 snacks. Windows spread across the eating span (`wake+45min` → `kitchenClose`,
where `kitchenClose = bed − 90min`), main meals at proportional positions, snacks between. Training
adjustments (v1 rules, unit-test-pinned): the nearest meal/snack BEFORE a block snaps to `block − 75min`
(pre-workout fueling); the main meal NEAREST the block snaps to `block end + 45min` (post-workout);
windows keep ≥ 90min spacing and never cross `kitchenClose`.

**Per-slot budgets.** Slot weights: main meal 2, snack 1; the post-workout main meal weighs 2.5.
Each slot's budget = daily budget × weight/Σweights, whole-number rounded. Budgets are FIXED for the
day (no consumed-based rebalancing in v1 — that is P8 replan territory); the MacroHero keeps showing
the day-level remaining.

**Slot filling.** For each planned window: logged meals of that slot render as `done` slots (time =
`loggedAt`, real macros, `mealId`). An un-logged window renders `pending` with its budget in the
existing `kcal/p/c/f` fields plus a **recipe suggestion** when one fits: candidates = recipes of the
window's category (`breakfast|lunch|dinner|snack`), per-serving kcal within **±20%** of the slot
budget; rank by |Δkcal|, tie-break `starred` then |Δprotein|; top 1 becomes `suggestedRecipeId` +
`mealName` = recipe name (SlotCard shows an `ajánlott` chip). No fit → budget-only slot
(label + "~620 kcal · P42 C64 F19" line). Tap: suggestion → `LogMealSheet` prefilled
`{source:'recipe', recipeId}`; budget-only → `LogMealSheet` with the slot preselected.

## 4. Goal-settings extension (the only backend work)

- Migration: `goal` gains `meals_per_day smallint`, `wake_time varchar(5)`, `bed_time varchar(5)`
  (all nullable; CHECK `meals_per_day between 3 and 6`).
- Contract: `GoalRequest`/`GoalResponse` gain the three optional fields (`api/feature/goal/goal.yml`
  edit → merge → regen; backend maps them through, validation: HH:mm pattern + range).
- FE: `EditGoalSheet` (Me → Goals) gains a "Napi ritmus" row (meals-per-day stepper 3–6 + wake/bed
  time inputs); `useGoal()` exposes them; the planner reads with defaults `4 / 06:00 / 23:00`.

## 5. Supplement + block integration

- `buildProtocol` gains an optional `anchors` param `{ wake, preWorkout?: 'HH:mm', bedtime }` so its
  slot times derive from reality (wake slot at `wake`, pre-workout at `firstBlock − 40min` when a
  block exists, evening at `bedtime − 120min`); omitted → current hardcoded times (mock parity).
- Training blocks: gym (`useTrain().gymSchedule` today row), volleyball (sport schedule today),
  running (active `running_block` current-week session for today: `dayOfWeek` + `timeOfDay`) — all
  render as `workout`/`sport` slots; done when start (+duration) passed.
- Intake pips: unchanged from v1 (`done` = the day's intakes by `refId`).
- Anchors: `caffeineCutoff` stays the `fuelConfig` constant `'14:00'`; `kitchenClose`/`bedtime`
  derive from the goal settings.

## 6. Hook & consumer wiring (signatures stable)

`useFuelTimeline()` (new `data/fuel/timelineHooks.ts`) keeps `{ plan, getScoredMeal }`: mock = seed;
real composes `useFuelDay` + `useGoal` (settings + prescription) + `useRecipes` + `useProtocol`/
`useStack`/`useIntakes` + `useTrain` (+ running hooks) into `buildDayPlan`. `useFuelPreview` slices
the same plan. `FuelMaiPage` context strip reads the real `plan.workout/volleyball/caffeineCutoff/
kitchenClose`; `SlotCard` learns the `ajánlott` chip + budget line + tap-to-log affordances
(additive props only).

## 7. Out of scope

Consumed-based intra-day rebalancing, real replan, prose (`mezoNote`/`windowTip`), sleep-log-derived
wake/bed, learned timing → P8. Meal score → P7. Terv page → P4. Reta pip on the timeline → later.

## 8. Testing

`buildDayPlan` unit tests (fixtures: rest day / gym morning / evening volleyball / run day / 3-6
meals / budget split sums exactly to the daily budget / recipe fit picks & ties / no-fit budget slot /
now-flag rules / kitchenClose clamp). Goal-settings: backend IT (round-trip + validation) + EditGoalSheet
test. Hook tests both modes (mock seed byte-parity; real composed via MSW). Page tests updated.
Full gates both FE modes + `./mvnw clean test`.

## 9. Size

L — FE planner logic + small Goal backend extension (the v1 client-merge M grew by the planner and
the Goal settings).
