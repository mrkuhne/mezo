# A napi keret a valódi mozgást követi (design)

- **Bead:** `mezo-tb3s2`
- **Date:** 2026-09-28 · **Status:** owner-approved direction (brainstorm 2026-09-28)
- **Trigger:** on 2026-09-28 the owner logged a meso gym session (~300 kcal net) and a 120′ volleyball session (490 kcal). The Edzés energy card said **+790**. The Fuel budget's Mozgás row said **+426**. The 426 is `tdee_bootstrap.weeklyEatKcalPerDay` (5 × gym + 4 × volleyball per week ÷ 7), which is served the same on every day, rest days included. Both sessions were planned, so `extraKcal` was 0.
- **Supersedes:** decisions **D2** and **D4** of [`2026-09-26-activity-energy-model-design.md`](2026-09-26-activity-energy-model-design.md) §2 ("even weekly base from the plan", "a missed planned session is not deducted"). The owner confirmed the reversal explicitly. The rest of that spec stands: the net `ActivityEnergyModel`, the MET table, the golden vectors, and the „Célod” row.

## 1. Owner decisions (do not re-litigate)

| # | Question | Decision |
|---|---|---|
| M1 | What the Mozgás row credits | **The day's actually logged movement**, as the net kcal of every logged session (planned or not). The weekly plan average is no longer credited per day. |
| M2 | Before today's session is logged | **Only earned counts ("A").** A planned but not yet logged session is shown faintly as „még jön +X, ha megcsinálod”. It is not in the budget, and there is no advance. |
| M3 | How much of the estimate is credited | **100 %.** There is no damping factor. The weekly learned-expenditure engine absorbs any systematic estimate bias into the base. A 75 % factor is a possible later follow-up if rest days feel too tight. |
| M4 | The Edzőnap-shift setting | **Retired.** The budget now follows the real training days, so moving kcal between days is meaningless. |
| M5 | The learning engine | **Receives exactly the same per-day movement number as the budget.** When the change goes live, past weeks are re-fitted with the new rule, so the learned base does not jump. |
| M6 | Surfaces | The Fuel budget hero and its detail sheet, and the Edzés card „Amit a mozgásod hozzáad”, show **the same served number**. The goal rationale copy is updated. |

## 2. The served daily target

`DayTargetProjector` stays the single rule. New form:

```
movement  = Σ net kcal of the date's LOGGED sessions        (planned + unplanned, M1)
target    = max(BMR, base + movement + balance)             (base = served EnergyBase.neatBaselineKcal)
carbs     = segment carbs + (target − seg.kcal) / 4         (unchanged idiom: the delta lands in carbs)
pending   = Σ moderate-band net kcal of today's planned sessions not yet logged (display only, M2)
```

- **`balance`** is the segment's `dailyEnergyBalanceKcal`, meaning the goal pace plus any accepted adjustment or deload override. It is unchanged and independent of movement (`GoalProjectionService.dailyEnergyBalance`). The BMR floor still folds into the Célod row, so the equation always closes.
- **Segment `kcal` / `tdeeEstimate`** keep the expected weekly movement average. They remain the *planning* numbers: macro split basis, guards, the projected pace and profile TDEE. Only the per-day serve changes. A week that goes to plan therefore eats exactly the same weekly total as before.
- **`trainingDayKcal` / `restDayKcal`** are no longer produced (`DayTypeShiftCalculator` is retired, per M4). Served targets ignore them if an old prescription still carries them.
- **Without an EnergyBase** (the settings preview path and the static config path), the old behaviour is kept: `seg.kcal + extra`, with no breakdown. This path has no base, so it cannot compose base + movement.

### Per-day movement (train-owned)

`WorkoutWindowQueryService.DayMovement` gains the logged totals. The existing matcher (`movementForDay`) already walks every logged session and classifies it as planned or extra. It now keeps the planned sessions' kcal instead of discarding it:

| Field | Meaning |
|---|---|
| `plannedDone` | kept (legacy callers) |
| `plannedKcal` | net kcal of logged sessions matched to a plan slot |
| `extraKcal` | net kcal of logged sessions not matched (unchanged) |
| `pendingKcal` | today's planned-not-yet-logged sessions at the moderate band. Only for `date == today`, otherwise 0. |

Sources, the same as today:
- **Gym:** `netKcal("gym", null, gymMinutes)`, where `gymMinutes` comes from `active_seconds`, else the clamped span, else the default.
- **Sport and run:** the persisted `kcal`. A null kcal (unknown body) contributes 0.

An in-progress gym session does not count until it is finished.

### Wire contract (additive)

`FuelDayEnergy` in `api/feature/meal/meal.yml`:

| Field | Meaning |
|---|---|
| `plannedMovementKcal` | now means **logged planned-session kcal** (M1), no longer the weekly-average share |
| `extraMovementKcal` | unchanged |
| `pendingMovementKcal` | **new**, nullable, display only |
| `baseKcal`, `balanceKcal`, `targetKcal` | unchanged meaning |

`base + planned + extra + balance = target` still closes.

## 3. Learning engine (M5)

- **Filter input.** `ExpenditureLearningService.replay` stops feeding `planEat + extra` into the filter. Each day's `movementKcal` becomes `plannedKcal + extraKcal` from the same `movementBetween` batch.
- **Classifier reference.** The fallback reference (`prevApplied + planEat + balance`, `:224` and `:289`) becomes `prevApplied + movement(d) + balance(d)`.
- **Explanation label.** `ExpenditureExplainer.avgMovementKcal` keeps its name. Its meaning is now the "logged movement, daily average". The FE label in `LearnedBaseExplainer` reads „logolt mozgás, napi átlag”.
- **Why this is better.** Today a skipped planned session charges 426 kcal of energy that was never spent to the learned base, so it biases the base low. An extra-hard day inflates it. With identical movement on both sides, the base is the pure non-exercise need. A systematic model over-estimate is absorbed into the base (M3), so the weekly total stays right.
- **Rollout.** An idempotent prod runner, `MovementModelMigrationRunner`, follows the `ActivityModelMigrationRunner` precedent: a version marker in `tdee_bootstrap` (`movementModel: 1`), a per-user try/catch, and logged counts. For each learning user it does two things:
  1. Re-runs `reviewWeek` for every stored `expenditure_estimate` week, oldest first, so each row is re-fitted under the new movement input. Upsert semantics are already in place.
  2. Recomputes the active goal, which drops the day-type split and refreshes the rationale.

  The plan must verify that `reviewWeek` over an existing row reproduces the same row when the inputs are unchanged. This is the idempotency test.

## 4. What the owner sees (prototype targets)

**Fuel, budget hero (`FuelEnergyHero`)**
- The Mozgás row value is `planned + extra` of the served energy.
- Sub copy is „ma logolt mozgásod”. With nothing logged yet, the value reads `+ 0`.
- When `pending > 0`, a faint second line appears: „még jön +X, ha megcsinálod”. It uses the existing faint/plan visual token, like the Edzés card's „a tervben”.
- The footer copy becomes: „A keretet az alapigényed, a súlycélod és a mai mozgásod együtt adja — a számítás minden nap újraszületik.”

**Fuel, „Részletesen, honnan jön a keret” sheet (`EnergyBreakdownSheet`)**
- The movement section uses the existing `!isWeeklyAvg` branch: „a ma rögzített edzéseid… a keret akkor nő, amikor rögzíted”.
- The per-session lines show the logged sessions. Pending sessions are listed faint.

**Edzés, „Amit a mozgásod hozzáad” card**
- It reads the **served** Fuel day energy for today instead of the client-side `trainDayEnergy`:
  - big number `planned + extra`
  - „már megszolgálva” = the same number
  - „a tervben” = `pending`
- Unplanned sessions are included. The card and the budget cannot disagree any more.
- The card is shown whenever today has any logged or pending movement.

**Other changes**
- **Goal rationale copy** (`GoalProjectionService.rationale`): „a napi keret az Alapod + az aznapi mozgásod (amit logolsz)”. The run-block variant is rephrased the same way.
- **Diet settings.** The Edzőnap-shift stepper is removed. The backend accepts and ignores the field, and the column stays. Dropping the column is a follow-up bead.
- **Én, TDEE breakdown** („Betábl. mozgás”). It stays as the planning average, relabelled „tervezett mozgás, heti átlag”.

**Unchanged:** peri-workout meal zones, snack thresholds and the day plan's pre/post-workout meals still read the planned blocks (`dayZones`, `buildDayPlan`, `windowsFor`).

## 5. Worked example (owner, 2026-09-28, live numbers)

- **Inputs:** base 2159 (learned), balance −769 (−0.41 %/wk), BMR 1961.
- **Morning,** nothing logged, gym and volleyball pending: target = max(1961, 2159 + 0 − 769) = **1961**. The Célod row shows −198 because the floor folds into it. Pending shows „még jön +~700”.
- **After both sessions:** target = max(1961, 2159 + 790 − 769) = **2180**, compared with 1961 served today.
- **Sunday rest day:** **1961**, the floor.
- **Why the floor dominates:** the goal pace asks for more deficit than the BMR floor allows on low-movement days. This is not changed here. The owner was told in the brainstorm and may adjust the goal pace himself.

## 6. Traps (from recon)

- **Double counting.** The served target must not add `movement` on top of `seg.kcal`, because `seg.kcal` already contains the weekly average. Serve from `base + movement + balance`. `seg.kcal` is only the carb-delta anchor.
- **Consumers that re-read the target shift automatically**, which is intended:
  - `GoalIntakeAdherenceAdapter` → `AdaptiveReviewService`
  - `CharacterSignalReads.kcalTarget`
  - meal scorer
  - MealCoach
  - companion tools, `LoadFuelMismatchRule`

  Their ITs pin numbers and need new expectations.
- **Past days re-serve** under the new rule. This is accepted: it is the honest number, the same precedent as 2026-09-26 §7.
- **`bootstrap.weeklyEatKcalPerDay` vs segment EAT** can differ (week-1 run count vs per-segment). After this change, learning no longer reads `planEat` at all, which removes that discrepancy from the learning path.
- **Contract drift.** Regenerate `api/openapi.yml`, `data/_client/api.gen.ts` and `data/types.ts`. Mocks must derive the served day with the same arithmetic: `data/fuel/fuel.ts:424-452`, `test/msw/handlers.ts:87`, `data/me/goals.ts`.
- **Liquibase jsonb `?` trap** if any changeset touches jsonb. None is planned: the marker is written by the runner.
- **Stale docs flagged by recon:** `goal-engine.md:54,160,296` (signature, "MET×kg×óra", the skipped-session "correctly lowers B" claim). Fix them in the same change.

## 7. Testing

**Backend**
- `DayTargetProjectorTest`:
  - movement credited
  - floor folds into balance
  - nothing logged
  - no-base legacy path
  - old prescription carrying a split is ignored
- `WorkoutWindowQueryServiceIT`: `plannedKcal`, `extraKcal` and `pendingKcal`, including gym from `active_seconds`, sport with null kcal, in-progress gym, and pending only for today.
- `FuelDayServiceIT` / `FuelDayDayTypeIT`: rewritten to the new rule.
- Learning:
  - `ExpenditureLearningServiceIT` / `Test`: movement input equals the served movement.
  - A skipped session no longer lowers the base.
  - Replay is idempotent.
- `MovementModelMigrationRunnerIT`: marker set, re-fit once, per-user failure isolated.
- `GoalProjectionServiceIT`: no split, new rationale.
- `DietSettingsDayTypeShiftIT`: the field is accepted and ignored.

**Frontend** (both modes)
- `keretHero` / `FuelEnergyHero`: the new sub copy and the pending line.
- `EnergyBreakdownSheet`.
- `TrainTodayPage`: the card reads the served energy.
- `FuelSettingsPage`: the stepper is gone.
- `LearnedBaseExplainer` label, `buildTdeeBreakdown` label.
- Affected `tests/layout` specs.

**Gates:** CODEMAP, `lint-docs`, and the docs listed below.

**Docs:** `fuel.md` §4/§5/§8/§9, `goal-engine.md` (§3, learned expenditure, rollout, stale lines), `train.md` (energy card), `me.md` (TDEE label), feature index, milestone log.

## Prior art

- **Scale-only adaptive TDEE (adopted for the learning layer).** MacroFactor and Carbon learn expenditure from intake plus the weight trend and trust that over device burn. It reacts to more exercise within about 2 weeks, and exercise adds less than its nominal burn. We keep the learned base anchored to intake and weight. Feeding it the identical movement number lets it absorb estimate bias. [MacroFactor – exercising more](https://help.macrofactorapp.com/en/articles/256-i-ve-started-exercising-more-why-isn-t-my-expenditure-increasing), [MacroFactor – Expenditure](https://help.macrofactorapp.com/en/articles/20-expenditure), [Carbon review](https://feastgood.com/carbon-diet-coach-review/).
- **Weekly budget with day-type skew (rejected, M4).** RP Diet Coach and Carbon skew the weekly total toward planned training days. For this owner (5 training days, 2 rest days, a goal already at the BMR floor) the skew had no room to act: at most ~+80 kcal per training day, with the pace nearly halved. [RP Diet Coach 1.5](https://rpstrength.com/blogs/articles/rp-diet-coach-app-update-1-5).
- **Per-day logged-exercise add-back (adopted for the daily serve).** Cronometer and MyFitnessPal add logged exercise on top of a baseline. We adopt this, and avoid their documented pitfalls in three ways:
  - The net model already removes the resting share, so the baseline minutes are not counted twice.
  - Pre-workout, the budget is honestly small, and the pending line explains why.
  - No negative "step adjustments".

  [Cronometer Energy Summary](https://support.cronometer.com/hc/en-us/articles/360060616191-Energy-Summary), [MFP thread](https://community.myfitnesspal.com/en/discussion/10619852/wth-apple-watch-workouts-and-negative-step-calorie-adjustments).
- **Estimated burn skews high (acknowledged, M3).** Trackers are off by 27–93 %, mostly over. We rejected a fixed "eat back 50–75 %" factor in favour of the learning engine absorbing the bias. The factor stays a possible follow-up. [Stronger by Science](https://www.strongerbyscience.com/research-spotlight-wearables/).
- **Transitioning a learned TDEE:** no vendor guidance was found. We re-fit past weeks under the new rule rather than applying a one-off offset.

## Codebase terrain

- **Weekly average enters:**
  - `train/service/WeeklyScheduledActivityService.java:42,59,83`
  - `goal/engine/service/GoalPrescriptionCalculator.java:74-81`
  - `goal/engine/service/GoalProjectionService.java:283-334` (segment TDEE, split at `:309-317`, rationale `:440-446`)
  - `DayTypeShiftCalculator.java:30`
  - `LearnedBaseResolver.java:55-57`
- **Serve:**
  - `nutrition/service/DayTargetProjector.java:44-76`
  - `DailyTargets.java:26`
  - `train/service/WorkoutWindowQueryService.java:233` (`DayMovement`), `:261`, `:279`, `:329-382` (per-day rules; planned kcal discarded today)
  - `meal/service/FuelDayService.java:113-135,225-261`
  - contract `api/feature/meal/meal.yml:561`
- **Other target consumers:**
  - `DietSettingsService.java:105` (no base)
  - `CharacterSignalReads.java:774,834-849`
  - `MealService.java:255`, `MealCoachService.java:194`
  - `TeamEditionReads.java:142`
  - `GoalIntakeAdherenceAdapter.java:25-41`
  - companion `FuelTools` / `DailySummaryService` / `LoadFuelMismatchRule`
- **Learning:**
  - `ExpenditureLearningService.java:180-192` (`planEat`), `:224`, `:235`, `:286-289`
  - `ExpenditureFilter.java:28-32,111`
  - `ExpenditureExplainer.java:58`
  - rollout precedents `ActivityModelMigrationRunner` (@Order 207) and `ExpenditureRolloutRunner` (208)
- **FE:**
  - `features/fuel/logic/keretHero.ts:127-131,245-258`
  - `components/FuelEnergyHero.tsx:56,70,164`
  - `logic/buildEnergyBreakdown.ts:57-70`
  - `sheets/EnergyBreakdownSheet.tsx:135-236`
  - `logic/buildDayPlan.ts:136-157`
  - `features/train/logic/trainDayEnergy.ts:23-35`
  - `pages/TrainTodayPage.tsx:303-344,710-745` (client-side, planned blocks only; misses unplanned sessions)
  - `sheets/LearnedBaseExplainer.tsx:127`
  - `features/me/sheets/BiometricSheet.tsx:160`, `me/logic/buildTdeeBreakdown.ts:18`
  - `pages/FuelSettingsPage.tsx:348`
- **Patterns:**
  - one served rule through the projector with a lazy `Supplier<DayMovement>`
  - batch ranges via `movementBetween`
  - the equation closes by construction
  - honest-null
  - golden vectors bind the FE mirror
  - idempotent marker-versioned `CommandLineRunner` for rollout
- **Traps:** see §6. Also:
  - FE tests: unset `VITE_USE_MOCK` means mock mode, so run the real-mode suite explicitly with `VITE_USE_MOCK=false`
  - ArchUnit layer subpackages
  - regenerate CODEMAP after every merge
