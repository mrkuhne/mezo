# Magától tanuló energiaigény — learned expenditure (design)

- **Bead:** `mezo-zz91i`
- **Date:** 2026-09-26 · **Status:** owner-approved direction (brainstorm 2026-09-26)
- **Builds on:** `mezo-32m82` (one net movement model, one served-target rule, „Célod” row),
  spec `2026-09-26-activity-energy-model-design.md`.
- **Scope rule (owner):** general for every user, never tuned to the owner's numbers.

## 1. Goal

The app learns each user's real expenditure from what actually happens: logged intake against
the weight trend. The served daily target moves gradually from the formula
(BMR × NEAT + planned movement) to the learned value. It is honest about incomplete logging,
damped against water and glycogen swings, and explains what it learned and how sure it is.

## 2. Owner decisions (do not re-litigate)

| # | Question | Decision |
|---|---|---|
| L1 | Who applies a change | **Automatic, explained.** The target moves once a week by itself, and a short message says what changed and why. A switch turns learning off (then the target falls back to the formula). |
| L2 | Incomplete logging days | **Suspicious days + confirm.** Days far below the user's own usual intake are flagged and excluded by default. The weekly card asks "were these incomplete?"; one tap includes one back. Any day can be marked incomplete by hand. Unanswered = excluded. |
| L3 | Movement once expenditure is learned | **Learned weekly total, the daily rhythm stays.** The learned quantity is the *Alap* (non-exercise base); planned and extra movement keep working on top exactly as today, so there is no double count and the training-day shift survives. |
| L4 | The existing Monday suggestion | **Replaced, kept as fallback.** A user who logs food gets learning and no weekly_correction suggestion; a user who never logs food keeps the weight-only suggestion. Never both. Accepted corrections fold into the starting base, so the target does not jump. |
| L5 | How fast the target may move | **Balanced, two-step.** At most ±150 kcal a week. A new direction moves half a step first; the full step comes only when the next week confirms it. |
| L6 | Transparency | **Weekly card on Fuel + detail page.** Confidence is shown as a word and a band: „Még tanulok” / „Közepesen biztos” / „Biztos”, „±… kcal”. |
| L7 | Engine | **One continuous learning estimator** (a small Kalman filter) seeded with the formula, rather than a windowed average blended on a fixed schedule. |
| L8 | Delivery | **Two parts.** Part 1: the engine, the served Alap, one confidence line. Part 2: the weekly card, detail page and switch (üveg prototype → owner OK first). |

Decisions the owner delegated (engineering calls, recorded here):

- Retroactive learning on launch: the first run replays the user's existing history.
- 1 kg of weight change = `mezo.goal.kcal-per-kg` (7700 kcal), symmetric, as the goal engine
  already uses.
- Safety rails: the served target never goes below BMR (existing floor); the applied base never
  leaves formula base ±35 % and never drops below BMR × 1.10 (a lower base is physiologically
  implausible and means the data is wrong, e.g. the owner's +5.7 kg in 3 weeks on ~2950 kcal).

## 3. Prior art

Researcher report, filtered:

- **Adopted: MacroFactor partial-logging coaching** — flag days far below the user's own norm,
  let the user untick a false flag, and exclude the rest from both sides of the equation. One
  missed partial day distorts a 21-day window for three weeks, so the default is to exclude.
  https://help.macrofactorapp.com/en/articles/248-coaching-module-partial-logging
- **Adopted: hedged weekly updates and an honest holding state** — the first week of a deviation
  moves only part-way ("more likely the scale is slow than that expenditure changed"). Too little
  data means the estimate holds instead of guessing.
  https://help.macrofactorapp.com/en/articles/26-how-should-i-interpret-changes-to-my-energy-expenditure
- **Adapted: no exercise eat-back once learned** — MacroFactor never adds exercise kcal on top of
  learned expenditure. We keep our daily movement rhythm (L3), but the filter learns the *base*
  with the observed movement as a known input, so the sum stays calibrated. No double count.
  https://macrofactor.com/expenditure-modifiers/
- **Adopted: Kalman filter with a formula prior and a reported SD** — adaptive-macro uses the
  states `[mass, expenditure]` and Δmass = (intake − expenditure)/7700. A day without a food log
  runs the prediction step only, with extra noise. The SD is bucketed into confidence levels.
  Estimates converge in about 4 weeks. https://github.com/cramnivek/adaptive-macro
- **Adopted: a water state** — gainz models water as an AR(1) state that absorbs scale
  transients, which also fixes the over-optimistic SD above.
  https://github.com/marcusklaas/gainz/pull/24
- **Added by us: a carb-driven glycogen input** — a sustained carb change moves glycogen and its
  water by 1–2 kg and then *stays*. An AR(1) water state would slowly re-read that step as tissue.
  The owner's 09-14 carb jump (+~220 g/day → +1.5 kg) is exactly this case.
- **Rejected:** per-user MLE fitting of noise constants (overkill at first; global config), and
  step-count modifiers (no wearable integration yet).

## 4. Codebase terrain

Investigator report, filtered:

- **The served target chain:** `GoalPrescriptionCalculator.calculate` (goal/engine/service :63) →
  `TdeeBootstrapService.compute` (the formula) → `GoalProjectionService.buildSegment`
  (`tdee = neatBaselineKcal + scheduled EAT + runEat`, `target = tdee + balance`) →
  `DayTargetProjector.project/energy` (nutrition), where `EnergyBase.neatBaselineKcal` is the
  „Alap” row. **One served-target rule:** a learned value enters *only* by replacing
  `neatBaselineKcal` in the goal's `tdeeBootstrap`. Everything downstream (Fuel day and week,
  scorer, character reads, diet preview) follows automatically.
- **Double-correction trap:** `goal.balanceAdjustmentKcal` (accepted weekly_correction deltas) is
  added in `GoalProjectionService.dailyEnergyBalance` (:377) for every trajectory. Once the base
  is learned, that adjustment must stop being added (it is folded into the starting base, §7).
- **Existing Monday loop:** `AdaptiveReviewJob` (cron `mezo.goal.adaptive.cron`, per-user
  try/catch, `ADAPTIVE_REVIEW_JOB_SWITCH`) → `AdaptiveReviewService.reviewUser` → weekly_correction
  suggestion (user-approved). It never reads intake. It becomes the fallback path (L4).
- **Intake:** `FuelDayService` week rollup; logged = `consumed.kcal > 0`; there is no
  day-complete flag anywhere. Goal reads meal data only through a consumer-owned port (ADR 0012),
  like `IntakeAdherencePort` / `GoalIntakeAdherenceAdapter`.
- **Movement:** `WorkoutWindowQueryService.movementBetween` (batched per-day `DayMovement(plannedDone,
  extraKcal)`); `WeeklyScheduledActivityService.totalWeeklyEatKcalPerDay` (the plan's daily
  average).
- **Weight:** `weight_log`; `WeightTrendService` averages same-day weigh-ins (EWMA, half-life 10 d).
  The filter replaces neither: it is a separate estimator that reads the raw daily means.
- **Unused config:** `GoalEngineProperties.bootstrapUncertaintyKcal` (300) is validated and
  consumed nowhere. It becomes the filter's prior SD.
- **Patterns:** pure services plus one `@Transactional` orchestrator; every tunable in
  `GoalEngineProperties` + `application.yml`; additive jsonb fields need no migration; the
  contract-first order `api/*.yml` → `npm run generate:api` → `pnpm generate:api`; Liquibase in
  `db/changelog/1.1.0/`; a new owned table joins `ResetDatabase` TRUNCATE; regenerate CODEMAP.
- **Traps:** a weigh-in recomputes the goal inside its transaction, so the filter must not run
  there (the calculator reads a persisted result only); the suggestion fingerprint covers goal
  inputs; the ArchUnit feature-cycle store is frozen; midnight-fragile fixtures; FE mock
  `fuelDayEnergy` mirrors the projector by hand (`frontend/src/data/fuel/fuel.ts`).

## 5. The model

### 5.1 What is learned

The filter learns **B**, the user's *base* expenditure: kcal/day excluding movement (it covers
BMR, NEAT and thermic effect — the same quantity the formula calls `bmr × neat`). Movement is a
known daily input:

```
movement_d = planEatPerDay + extraKcal_d
  planEatPerDay = WeeklyScheduledActivityService.totalWeeklyEatKcalPerDay (current plan, daily average)
  extraKcal_d   = WorkoutWindowQueryService.movementBetween(...)[d].extraKcal (unplanned, net)
```

This is exactly the movement the served target credits. So the learned B is the base that makes
*served maintenance* match reality: if the user skips planned sessions every week, B learns
lower and the target corrects (this closes `mezo-0zu7b` item 11 and 32m82 D4's "systematic drift").
The plan's current schedule is used for the whole window (there is no schedule history). This is
a documented approximation.

### 5.2 State and daily step

One day = one step, from the window start to **yesterday** (today is never used). State
`x = [m, w, B]`:

- `m` — tissue mass (kg), the energy-driven part of scale weight
- `w` — transient water (kg), AR(1) toward 0
- `B` — base expenditure (kcal/day), slow random walk

Prediction for day d, with ρ = `kcalPerKg`:

```
usable intake I_d known:   m ← m + (I_d − B − movement_d)/ρ      Q_m = σ_tissue² + (ε·I_d/ρ)²
intake unknown/excluded:   m ← m + balance_d/ρ                    Q_m = σ_tissue² + (σ_unknown/ρ)²
                           (balance_d = the goal's daily balance, so an unlogged day drifts as planned;
                            B does not enter → the day carries no information about B)
w ← φ·w                                                            Q_w = σ_water²
B ← B                                                              Q_B = σ_base²
```

Update on a day with weigh-ins (the daily mean z_d):

```
z_d = m + w + G_d + v,   v ~ N(0, σ_scale²)
G_d = clamp(γ · (Ĉ_d − Cref), ±gMax)        glycogen-water input, deterministic
  Ĉ_d  = EWMA of carbs over usable days (α = glycogen-alpha 0.4 ≈ a 2–3 day fill; carried forward)
  Cref = median carbs over the usable days of the whole window
```

Initialisation at the window start (the first weigh-in day inside the window):
`m₀ = z₀`, `var 0.5²`; `w₀ = 0`, `var σ_w0²`; `B₀ = formula base (current neatBaselineKcal)`,
`var = bootstrapUncertaintyKcal²`. The window starts at `max(first weigh-in, yesterday − windowDays)`.

**Starting constants** (config; each is covered by a synthetic scenario test, §9):

| Key | Value | Meaning |
|---|---|---|
| `window-days` | 120 | history replayed each run |
| `sigma-scale-kg` | 0.35 | scale noise (gut, clothes, timing) |
| `sigma-tissue-kg` | 0.02 | daily tissue process noise |
| `intake-error-pct` | 0.10 | logged intake error (ε) |
| `sigma-unknown-kcal` | 800 | unknown intake day |
| `water-phi` | 0.90 | water AR(1) per day (half-life ≈ 6.5 d: salt, cycle, a big meal) |
| `sigma-water-kg` | 0.20 | water process noise |
| `sigma-base-kcal` | 12 | base drift per day |
| `glycogen-kg-per-g` | 0.007 | γ: +200 g/day carbs → +1.4 kg |
| `glycogen-max-kg` | 2.0 | gMax |
| `glycogen-alpha` | 0.4 | carb EWMA per usable day |

Design-time simulation (30 seeds, `sim` in the brainstorm): 400 kcal prior error → mean |error|
133 at day 28, 71 at day 42; σ̂ ≈ 160 at day 28; the carb step stays at control-level noise.

Output: posterior mean B̂ and SD σ̂ of `B` at the end of yesterday.

### 5.3 Usable intake days (L2)

A day's logged kcal is **usable** unless:

1. nothing is logged (`kcal ≤ 0`) → *unlogged*;
2. it is **suspicious** — `kcal < suspicious-ratio (0.60) × refMedian`, where `refMedian` is the
   median logged kcal of the 28 days before it (logged days only, needs ≥ 5; with fewer, the
   reference is the day's served target) → *excluded, pending* unless the user confirmed the day
   complete;
3. the user marked it incomplete (Part 2) → *excluded*.

A user confirmation beats rule 2 in both directions (Part 2 table `intake_day_mark`). Part 1 has
no marks: every suspicious day is excluded.

### 5.4 The weekly step (L1, L5)

Runs every Monday for the week that just ended (`weekStart` = that Monday − 7).

```
eligible  = learning enabled AND (a previous estimate exists OR ≥ min-usable-days (10) usable days in the last 28)
holding   = usable days in the ended week < 4 OR weigh-in days < 2
prevApplied = previous week's appliedBase, else (formula base + goal.balanceAdjustmentKcal)   ← §7 fold-in
delta     = B̂ − prevApplied
if holding or |delta| < dead-band (30):  step = 0
else if sign(delta) == prev.direction:   step = clamp(delta,     ±max-step (150))
else:                                    step = clamp(delta / 2, ±max-step)       ← hedged first move
appliedBase = clamp(prevApplied + step,
                    lo = max(formulaBase × (1 − max-deviation 0.35), BMR × min-base-bmr-ratio 1.10),
                    hi = formulaBase × (1 + max-deviation))
direction   = step == 0 ? prev.direction : sign(step)
```

Status per week: `LEARNING` (σ̂ > 200: still mostly formula), `UPDATED` (a non-zero step),
`STABLE` (below the dead band), `HOLDING` (too little data). Confidence from σ̂: ≤ 100 `HIGH`
„Biztos”, ≤ 200 `MEDIUM` „Közepesen biztos”, else `LOW` „Még tanulok”. The band is shown as
„±σ̂” rounded to 10.

A run is an **idempotent upsert** of `(user, weekStart)`: re-running the same week (deploy run,
a day mark in Part 2) recomputes from the previous week's row and replaces the row. After a
changed `appliedBase` the goal is recomputed (`GoalEngineService.recomputeActiveGoal`).

### 5.5 Persistence

New table `expenditure_estimate` (goal-owned, one row per user per week):

| Column | |
|---|---|
| `id`, audit columns, `created_by` | standard owned-entity columns |
| `week_start date` | unique with `created_by` |
| `status` | LEARNING / UPDATED / STABLE / HOLDING |
| `formula_base_kcal int` | the formula's `neatBaselineKcal` at run time |
| `posterior_base_kcal int`, `posterior_sd_kcal int` | B̂, σ̂ |
| `applied_base_kcal int`, `step_kcal int`, `direction smallint` | the served base and how it moved |
| `confidence` | LOW / MEDIUM / HIGH |
| `usable_days int`, `weigh_in_days int` | the ended week's data |
| `excluded_days jsonb` | `[{date, kcal, reason: suspicious|marked}]` for the ended week |

Part 2 adds `intake_day_mark(created_by, date, status COMPLETE|INCOMPLETE)` and the switch
(`learning_enabled` on the diet preferences, default true).

### 5.6 Serving

`GoalPrescriptionCalculator.calculate` reads the latest `expenditure_estimate` row (when learning
is enabled and one exists) and hands the projection a bootstrap copy:

```
neatBaselineKcal = appliedBase;  tdee = appliedBase + weeklyEatKcalPerDay
new additive jsonb fields: baseSource "learned"|"formula", formulaNeatBaselineKcal,
                           learnedSdKcal, learnedConfidence
```

`GoalProjectionService.dailyEnergyBalance` does **not** add `balanceAdjustmentKcal` when
`baseSource = learned` (it lives inside the base now). No filter runs on the request path.
`DayTargetProjector` is unchanged; `EnergyBase` and `DailyTargets.Energy` carry
`baseSource`/`confidence`/`sdKcal` through to `FuelDayEnergy` (three new nullable contract fields).

## 6. What the owner sees

**Part 1:** the Fuel equation's Alap row now shows the learned base. The energy breakdown sheet
gains one line under Alap: „Tanult alap · Közepesen biztos · ±150 kcal” (or „Képlet alapján” for
formula users). No other UI.

**Part 2 (üveg prototype → owner OK before build):**

- **Weekly card** on Fuel Mai from Monday until dismissed: what was learned (B̂ ± σ̂, the word),
  what changed (step), the excluded days with a one-tap „teljes volt” each, or a holding
  explanation („kevés adat volt a héten: 3 teljes nap, 1 mérlegelés”). The bell gets a short
  notice.
- **Detail page** (from the Alap row and the card): formula vs learned base over the weeks with
  the confidence band, and the last 14 days' intake with a status each (számít / hiányosnak
  tűnt / kihagyva) and a toggle.
- **Switch** in the diet settings: „Tanulás a súlyomból és az evésemből” (on by default). Off:
  the target returns to the formula (+ any accepted corrections), and the Monday fallback
  suggestion resumes.

## 7. Rollout and the fallback

- **Fold-in:** a user's first estimate starts from `formula base + balanceAdjustmentKcal`, the
  base they are served today. From then on, the adjustment is ignored while `baseSource = learned`
  (it stays stored, so switching learning off restores it).
- **Deploy run:** a boot runner (the `ActivityModelMigrationRunner` pattern) runs the weekly step
  once for the last completed week for every eligible user who has no row yet. It is idempotent.
- **Monday job:** `AdaptiveReviewJob` becomes the weekly energy review. For each user: eligible
  for learning → learning step; otherwise → the existing `AdaptiveReviewService` suggestion
  (unchanged). The two are exclusive by construction.
- **A learning user who stops logging** stays on learning in HOLDING; the base freezes. They do
  not revert to the suggestion path (a known limitation; revisit if it matters).

## 8. Units

| Unit | Where | Kind |
|---|---|---|
| `ExpenditureFilter` | goal/engine/service | pure: days in → (B̂, σ̂) |
| `IntakeDayClassifier` | goal/engine/service | pure: usable / unlogged / suspicious / marked |
| `ExpenditureStepPolicy` | goal/engine/service | pure: prev row + B̂/σ̂ + week counts → step, status, confidence |
| `ExpenditureLearningService` | goal/engine/service | `@Transactional` orchestrator: gather, run, upsert, recompute |
| `DailyIntakePort` → `GoalDailyIntakeAdapter` | goal/engine/port → meal/service | per-day kcal + carbs for a range |
| `ExpenditureEstimateEntity` + repository | goal/entity, goal/repository | persistence |
| `ExpenditureRolloutRunner` | goal | deploy run |
| `GoalEngineProperties.Expenditure` | goal/engine | all tunables (§5.2–5.4) |

## 9. Testing

- **Filter scenarios** (plain JUnit, synthetic, deterministic noise):
  - a constant true base 400 kcal away from the prior is recovered within ±150 after 28 days and
    ±100 after 42 days of complete logs and daily weigh-ins (mean over seeds);
  - a +220 g/day carb step with a +1.5 kg scale step moves B̂ no more than the no-step control
    run plus 50 kcal (without the glycogen input the design sim showed ~470 vs ~180);
  - 1-meal days (600 kcal against a 2900 norm) are classified as suspicious and do not pull B̂;
  - σ̂ shrinks with data and grows through a gap without logs;
  - an unlogged fortnight leaves B̂ unchanged.
- **Step policy:** hedge then full; dead band; holding; clamps; the fold-in start.
- **Integration:** a populated user, one Monday run → row persisted, goal recomputed, Fuel day
  energy serves the learned base with `baseSource=learned`; the non-logging user gets the
  weekly_correction suggestion instead; a re-run is idempotent; the adjustment is not
  double-applied.
- **Owner check at deploy (owner decision):** no pre-merge replay on the owner's data. The deploy
  run is the check: the owner's first row (B̂ ± σ̂, step, excluded days) is reported to him and
  compared with the bd-recorded evidence (09-13/19/20/24 excluded as suspicious).
- FE: the breakdown line in both modes; the mock `fuelDayEnergy` gains the new fields.

## 10. Out of scope

Wearables and step counts; body-composition-aware energy density; a per-user noise fit; menstrual
cycle modelling beyond the water state; the goal-change "metabolic shift" modifier.
