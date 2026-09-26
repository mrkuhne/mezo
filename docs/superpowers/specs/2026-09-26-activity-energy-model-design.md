# Egységes mozgás-energia modell + „Célod” sor (design)

- **Bead:** `mezo-32m82`
- **Date:** 2026-09-26 · **Status:** owner-approved direction (brainstorm 2026-09-26)
- **Trigger:** the owner's sport page showed a volleyball session at 1172 kcal while the Fuel
  equation credited +922 for the same session. The live data showed a deeper problem: the app's
  maintenance estimate for the owner is ~3180 kcal/day, yet his weight went 82.1 → 87.8 kg in
  3 weeks on ~2950 kcal logged days. The observed maintenance is roughly 2500–2700.
- **Scope rule (owner):** fix it **in general, for every future user**, not for the owner's
  numbers.

## 1. Goal

One realistic, conservative exercise-energy model owns every movement kcal in the app. It feeds
the sport/run log, the Train page, the gym ceremony, the weekly plan (goal TDEE) and the Fuel
daily target. Every surface shows the **same** daily target. The Fuel equation box adds up
visibly because it gains a „Célod” row.

## 2. Owner decisions (do not re-litigate)

| # | Question | Decision |
|---|---|---|
| D1 | Which formula wins, sport page or Fuel? | Neither. Both are replaced by one new model that is net of resting energy and uses measured Compendium 2024 values (§4). |
| D2 | How the daily target reacts to movement | **Even weekly base from the plan + small training-day shift.** The weekly plan's movement is spread across the week (the existing `trainingDayKcal`/`restDayKcal` split does the shift). Planned sessions are NOT credited again on the day. |
| D3 | Unplanned movement | **Credited the same day** (net, new model). |
| D4 | Planned session that did not happen | **Not deducted** that day. Systematic drift is caught by the existing weekly adaptive suggestion (`AdaptiveCorrectionService`, user-approved). |
| D5 | Cap on unplanned credit | None for now. The model is already conservative. Revisit if data says otherwise. |
| D6 | Existing goals | Recomputed automatically once, on deploy (§7). |
| D7 | Equation box | Gains a „Célod” row (goal deficit or surplus), so Alap + Mozgás ± Célod − Étel = Marad adds up. |

## 3. What is wrong today (evidence)

There are four calculators, and all of them use **gross** MET.

| Calculator | Used by | Formula |
|---|---|---|
| `train/service/SportEnergyCalculator` (BE) | persisted `sport_session.kcal`, `run_session_log.kcal` | `MET(sport, RPE) × 3.5 × kg / 200 × min × personalFactor`; volleyball RPE 7 → 5.3 MET |
| `train/service/WeeklyScheduledActivityService` (BE) | goal `tdee_bootstrap.weeklyEatKcalPerDay` → segment kcal | flat `mezo.train.met` gym 6.0 / sport 4.5 / run 9.5 × kg × h, gym fixed 60′ |
| FE `features/fuel/logic/buildDayPlan.ts` `blockKcal` | Fuel Mai target + „Mozgás” | flat `MET_BY_KIND` × kg × h; drops the BE session kcal |
| FE `features/train/logic/trainDayEnergy.ts` | Train page, gym ceremony, `loadWeek` | same flat table |

Consequences:

- **Double counting.** BMR × NEAT already covers all 24 hours, including the training hours. Gross MET adds the resting part again: about 1 MET × kg per hour.
- **Vigorous values as defaults.** Gym 6.0 is the Compendium's *vigorous powerlifting* code. A normal hypertrophy session measures 3.5. Recreational volleyball measures 3.0–4.0.
- **Three different daily targets.**
  - Fuel Mai: FE `deriveDailyBudget`, adding today's logged flat MET.
  - Fuel week, Napló, meal scorer, MealCoach and adherence: BE `DayTargetProjector`, the weekly average plus a day-type pick.
  - Character detectors: the uniform `seg.kcal`, which skips the split (`CharacterSignalReads.java:724`).

Owner, week-averaged: the plan credits 828 kcal/day of movement. The new model credits about 570 (§8).

## 4. The model

One pure backend unit, `ActivityEnergyModel`, sits in `feature/train/service` next to where `SportEnergyCalculator` lives today and replaces it.

```
netKcal = (MET − 1) × restKcalPerHour × hours
restKcalPerHour = BMR / 24            (BMR from the biometric profile, Katch or Mifflin as today)
                  fallback: 1.0 × weightKg   (no profile, weight known)
                  fallback: empty            (neither → honest null, never 0)
```

- **The personal factor is dropped.** Scaling by the person's own BMR already covers sex, age and lean mass. This is the Compendium's "corrected MET" approach (Byrne 2005), and it replaces the ad-hoc sex/age/lean multipliers.
- **Duration:** whole-session time. The Compendium session codes already include rests between sets and rallies, so there is no extra duty-cycle discount.
  - Logged gym: `workout_session.active_seconds`, falling back to `finished_at − started_at` clamped to ≤ 150′.
  - Planned gym: the timing-profile estimate, else 60′.
  - Sport: the logged or slot duration.
  - Run: the logged duration, else 45′ (one default everywhere; the stray 40′ constants go).
- **Intensity band from the felt effort (RPE 1–10):** 1–4 könnyű, 5–7 közepes, 8–10 kemény. A missing RPE and every planned slot count as közepes.
- **MET table.** These are starting values from the 2024 Adult Compendium. Plan task 1 verifies each one on pacompendium.com and records the code number in the config comment.

| Kind | könnyű | közepes | kemény | Compendium basis |
|---|---|---|---|---|
| gym | 3.5 | 3.5 | 5.0 | 02054 multiple exercises 8–15 reps (3.5); 02052 squats/deadlifts (5.0) |
| volleyball | 3.0 | 4.0 | 6.0 | 15720 non-competitive / 15710 general / 15711 competitive |
| football | 5.0 | 7.0 | 9.5 | soccer casual / general / competitive |
| basketball | 4.5 | 6.5 | 8.0 | shooting / general / game |
| tennis | 5.0 | 7.0 | 8.0 | doubles / general / singles |
| trx | 3.0 | 4.5 | 6.5 | bodyweight general / moderate / high intensity |
| cross | 4.0 | 5.8 | 8.0 | circuit training light / supersets / vigorous |
| swim | 5.8 | 8.3 | 9.8 | leisurely / freestyle moderate / vigorous |
| bike | 5.8 | 6.8 | 8.0 | <16 / 16–19 / 19–22 km/h |
| hike | 5.3 | 6.0 | 7.8 | hiking general / moderate / steep |
| run | 7.5 | 9.3 | 10.5 | jogging / 6:13 per km / running self-paced; pace-based `runMet` when a pace is known |
| other | 3.0 | 4.0 | 6.0 | generic light / moderate / vigorous |

- **Config:** the table is a `@ConfigurationProperties` record (`mezo.train.energy`). It replaces `mezo.train.met`.
- **User override:** a user-typed kcal (for example from a watch) counts as **active (net) kcal**, stored verbatim with `kcal_is_estimate=false`. The sport log sheet's field label says so: „aktív kalória (pl. az órád szerint)”.

**Frontend mirror.** Planned previews (Train today, gym ceremony, `loadWeek`, `dayZones`) need the numbers before anything is logged. So one FE module, `shared/lib/activityEnergy.ts` (or `data/train`, whichever the plan finds fits the layering), implements the same formula. It replaces `blockKcal`, `activityKcal` and `trainDayEnergy`'s maths, and `MET_BY_KIND` goes.

**Two-sided drift guard.** A golden-vector file, `api/fixtures/activity-energy-vectors.json`, holds the inputs and expected kcal. Both a BE unit test and an FE vitest assert against it, so the one-sided `metDriftGuard.test.ts` goes. Logged sessions always display the **BE-persisted** kcal; the FE never re-estimates a logged session.

## 5. The weekly plan and the served daily target

**Weekly plan (goal engine):** `WeeklyScheduledActivityService` computes each scheduled slot with `ActivityEnergyModel` at the közepes band:
- gym slots at the planned gym duration;
- sport slots at their own duration and sport kind;
- runs at 45′ per session.

`weeklyEatKcalPerDay = Σ / 7`. The TDEE, the segment kcal and the `trainingDayKcal`/`restDayKcal` split follow unchanged from the existing `TdeeBootstrapService`, `GoalProjectionService` and `DayTypeShiftCalculator`.

**Served target for a date** (`nutrition/service/DayTargetProjector`, the single rule):

```
dayKcal   = trainingDayKcal  if the date has ≥1 logged session MATCHED to a planned one
            restDayKcal      otherwise
            (segment kcal when the segment carries no split)
extraKcal = Σ netKcal of the date's logged sessions NOT matched to a planned one
target    = max(BMR, dayKcal + extraKcal)
carbs     = segment carbs + day-type delta/4 + extraKcal/4   (carbs absorb, as today)
```

**Matching planned and logged** is a pure `PlannedSessionMatcher` in train. It is the backend twin of the FE `resolveSportBlocks` reconciliation, and it replaces `hasLoggedTrainingOn` for this purpose. For each date:
- Take the weekday's scheduled slots: gym slots, sport slots, and the active run block's sessions on that weekday.
- **Gym:** a completed `meso`-origin workout on a weekday with a gym slot is planned. A `custom`-origin workout, or any workout on a weekday with no gym slot, is extra.
- **Sport:** logged sessions, earliest first, each consume the planned occurrence nearest in time (weekday slots minus skips, plus dated one-off events). This is the same rule `WorkoutWindowQueryService.addSportWindowsForDay` already applies. Leftovers are extra.
- **Run:** a logged run consumes a scheduled run session on that weekday. Leftovers are extra.

**Energy breakdown on the wire.** The contract-first change goes in `api/feature/meal/meal.yml`. The Fuel day response gains:

```
energy: { baseKcal, plannedMovementKcal, extraMovementKcal, balanceKcal, targetKcal }
```

| Field | Meaning |
|---|---|
| `baseKcal` | BMR × NEAT |
| `plannedMovementKcal` | `dayKcal − baseKcal − balanceKcal`: the plan's share for today, including the day-type shift |
| `extraMovementKcal` | the unplanned credit |
| `balanceKcal` | `target − base − planned − extra`: the goal's deficit or surplus. The rare BMR floor lands here too, so the equation always closes |

All five fields are null on the static path (no biometric profile).

**Every consumer reads this one rule:**
- **Fuel Mai** drops the FE `deriveDailyBudget` dynamic path and uses the served `targets` and `energy`. The FE keeps the static fallback only for when there is no goal.
- Fuel week, Napló, meal scorer, MealCoach and adherence already use it.
- **Character:** `CharacterSignalReads.kcalTarget` switches to `DayTargetProjector`, which fixes its stale Javadoc claim.

## 6. The Fuel equation box („Célod” sor)

`keretHero.heroEquationLines` becomes: **Alap · + Mozgás · ± Célod · − Étel · = Marad**.

- **Mozgás** = planned + extra. Sub copy:
  - „a heti edzésterved mai része”
  - with an extra credit: „a heti edzésterved mai része + terven kívüli mozgás”
- **Célod** = `balanceKcal`, carrying its own sign: `− 327` for a cut, `+ 250` for a bulk.
  - Sub copy depends on the trajectory: „a fogyási célod napi része”, „a tömegelési célod napi része”, or „tartás” with 0.
  - The row is hidden when the balance is 0 and the trajectory is maintain.
  - Past days: like the other chips, `asPastDayHero` nulls it, which honestly shows „—”.
- **Look:** follows the Üveg bible and the existing `fmx-node` anatomy: one accent token and one existing Titanium sprite, never an emoji. `i-cel` (target) moves to Célod; Alap takes a body or metabolism sprite from the existing catalogue, which the plan picks. It is not a new component, so no separate prototype round is needed.
- **Detailed sheet:** the shared `EnergyBreakdownSheet`, which already has a deficit section, is fed from the same served `energy`. It shows the extra-movement line when non-zero and fixes the 40′ vs 45′ run mismatch.

## 7. Rollout of the existing data

The model change triggers no recompute on its own: `GoalReevaluateRunner` runs in demofixtures only. So a prod-enabled, idempotent `ActivityModelMigrationRunner` does the following, **once**:

1. A Liquibase changeset nulls `kcal`/`kcal_is_estimate` on rows where `kcal_is_estimate = true`, so it runs exactly once and user overrides are untouched. Every boot, the runner then re-estimates rows with `kcal IS NULL AND duration_min > 0`. This is cheap and idempotent: only rows with an unknown body stay null.
2. Calls `GoalEngineService.recomputeActiveGoal` for every non-deleted goal whose `tdee_bootstrap` lacks the marker `activityModel: 2`, and writes the marker.

It logs counts. Pending adaptive suggestions go stale through the existing fingerprint, which is acceptable because the next weekly review re-suggests.

**Past days:** served targets for past dates recompute from the new prescription, so history shifts to the new model. This is accepted: it is the honest number.

## 8. Worked example (owner, 2026-09-26)

- **Owner:** BMR 1963, so `restKcalPerHour` is 81.8; NEAT 1.2 gives base 2356; balance −327.
- **Weekly plan:** 5 × gym at 60′ and 4 × volleyball at 120′ (közepes).
  - Gym: (3.5−1) × 81.8 × 1 = 205 per session.
  - Volleyball: (4.0−1) × 81.8 × 2 = 491 per session.
  - Σ = 3 989/week, which is **570/day**.
  - Previously 828.
- **Resulting numbers:** TDEE 2 926, target **2 599** (previously 2 856 → served 2 830). The segment has no day-type split for him (6 training days).
- **Today's 140′ RPE 7 volleyball** falls on a Saturday, which has no sport slot, so it is **extra**: (4.0−1) × 81.8 × 2.33 = **572**, compared with 1 172 on the sport page and 922 in Fuel today. That gives target 2 599 + 572 = 3 171.

The spec's earlier chat estimate (≈430/day) assumed volleyball at 3.0. The közepes 4.0 is the honest default for a 2-hour training session, and the adaptive weekly correction is the safety net if it is still high.

## 9. Out of scope (follow-up beads)

- **Adaptive TDEE from logged intake plus trend weight** (MacroFactor-style, EWMA, about 7 700 kcal/kg, pause when more than 3 of 7 days are unlogged). This is the long-term answer to model error. It is filed as a follow-up.
- A cap on unplanned credit (D5).
- Changing the NEAT levels.
- Per-exercise gym intensity.

## 10. Testing

**Backend:**
- Unit tests: the `ActivityEnergyModel` table and fallbacks, band mapping and honest-null; the `PlannedSessionMatcher` cases (planned, extra, custom gym, second sport session, run); and `DayTargetProjector` with extra credit, the floor and no split.
- Golden-vector test.
- ITs: `FuelDayServiceIT` (energy block), `GoalProjectionServiceIT` / `WeeklyScheduledActivityServiceIT` (new numbers), `SportServiceIT` (net estimate, override verbatim), a runner IT (idempotent, overrides untouched, marker), and `CharacterSignalReads` target.

**Frontend:**
- The golden-vector vitest.
- `keretHero` Célod lines: cut, bulk, maintain hidden, past day, and equation closure.
- Fuel Mai uses the served target.
- Train and ceremony use the mirror.
- Mock fixtures regenerated consistently: `data/me/goals.ts`, `test/msw/handlers.ts`, `trainHooks` `mockSportKcal`, `running.ts` `mockRunKcal`, and the `train.ts` sport sessions. Tests run in both modes.

**Gates:**
- CODEMAP regeneration.
- Docs updated: fuel.md, train.md, goal-engine.md, me.md, including the stale fuel.md:534 `hasScheduledTrainingOn` claim.
- ArchUnit: the matcher lives in train; nutrition already depends on train, so no new cycle.

## Prior art

- **Net over gross (adopted).** ACSM's net-cost convention and Cronometer's handling: exercise replaces the baseline for its minutes, and device "active" kcal is net. Adding gross on top of BMR × activity is the documented double-count. [Cronometer forum](https://forums.cronometer.com/discussion/5133/fitbit-exercise-activity-calories-include-bmr-but-bmr-portion-not-deducted-in-cronometer), [Apple Health thread](https://forums.cronometer.com/discussion/1216/if-i-m-tracking-activity-in-apple-health-and-have-it-synced-to-cronometer-am-i-double-counting-base).
- **Compendium 2024 measured codes (adopted)** as the MET source. Whole-session codes include the rests, so no extra duty-cycle discount. [pacompendium.com](https://pacompendium.com/conditioning-exercise/), [paper](https://pubmed.ncbi.nlm.nih.gov/38242596/).
- **RMR-corrected MET (adopted, as BMR/24 scaling).** The standard 3.5 ml/kg/min overestimates resting VO₂ by about 35% on average, and more in heavier people. [Byrne 2005](https://pubmed.ncbi.nlm.nih.gov/15831804/).
- **No per-session eat-back, weekly average instead (adopted in spirit, D2).** MacroFactor sets exercise through the expenditure estimate, not a daily credit. [MacroFactor](https://macrofactor.com/macrofactors-algorithms-and-core-philosophy/).
- **Adaptive expenditure (deferred, §9).** [MacroFactor V3](https://macrofactor.com/expenditure-v3/), [Hacker's Diet](https://www.fourmilab.ch/hackdiet/e4/signalnoise.html).
- **"Eat back 50%" (rejected).** Undocumented folklore that corrects the gross-MET error by accident.

## Codebase terrain

- **BE energy:**
  - `train/service/SportEnergyCalculator.java:62-102` (replaced)
  - `train/service/SportService.java:98-115` (`applyKcal`)
  - `train/service/RunningService.java:158-170`
  - `train/service/WeeklyScheduledActivityService.java:41-102`
  - `application.yml:2643-2651` (`mezo.train.met`)
  - `train/service/AthleteBodyPort` (body seam; needs BMR, or biometrics exposes it)
- **BE goal:** `goal/engine/service/TdeeBootstrapService.java:74-95`, `GoalPrescriptionCalculator.java:72`, `GoalProjectionService.java:286-330`, `GoalEngineService.java:62,117` (recompute), `GoalReevaluateRunner` (demofixtures-only).
- **BE target:** `nutrition/service/DayTargetProjector.java:33-58`, `meal/service/FuelDayService.java:200,218-231`, `train/service/WorkoutWindowQueryService.java:215` (`hasLoggedTrainingOn`), `character/service/CharacterSignalReads.java:724`, `proactive/service/WeightDecompositionInputsAssembler.java:137` (follows automatically).
- **FE:**
  - `data/fuel/fuelConfig.ts:39` (`MET_BY_KIND`, removed)
  - `data/fuel/metDriftGuard.test.ts` (replaced)
  - `features/fuel/logic/buildDayPlan.ts:115-196`
  - `data/fuel/timelineHooks.ts:105-146`
  - `features/fuel/logic/buildProtocol.ts:86-123`
  - `features/fuel/logic/keretHero.ts:29,111,121,207,228`
  - `features/fuel/components/FuelEnergyHero.tsx`
  - `features/fuel/logic/buildEnergyBreakdown.ts:5`
  - `features/fuel/logic/dayZones.ts:74`
  - `features/train/logic/trainDayEnergy.ts`
  - `features/train/pages/TrainTodayPage.tsx:307-332`
  - `features/train/pages/ActiveWorkoutPage.tsx:802`
  - `features/train/logic/loadWeek.ts:183-205`
  - `features/me/logic/buildTdeeBreakdown.ts`
- **Traps:**
  - The one-sided drift guard.
  - Snapshot staleness of `tdee_bootstrap`/`prescription`.
  - Mock and MSW fixtures encode the old model.
  - `VITE_USE_MOCK` unset means mock mode.
  - ArchUnit layering and cycles.
  - CODEMAP drops entries on merge.
  - Testcontainers for the full suite.
  - Sport slots only allow volleyball, cross and trx.
