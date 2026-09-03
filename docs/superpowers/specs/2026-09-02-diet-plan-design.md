# Diet Plan — customizable macro split, goal-driven dynamic macros, and the training/check-in/sleep bridges

**Date:** 2026-09-02
**Status:** approved (design), implementation pending
**Driving decision:** the Cél (goal) aggregate grows into the diet plan — no separate DietPlan entity.

## 1. Problem

The goal engine already prescribes kcal + protein per segment and recomputes on every
weigh-in, but the rest of the diet is frozen:

- **Carbs/fat are not prescribed.** The wire always carries the static `mezo.nutrition`
  constants (c 380 / f 95); the FE re-derives them view-only with a hardcoded
  `FAT_KCAL_SHARE = 0.275`. There is no user-facing macro-split preference anywhere.
- **Two energy models diverge.** BE `FuelDayService.targetSet` uses the weekly-average
  scheduled EAT (same number every day of a segment); FE `deriveDailyBudget` uses
  today's actual MET blocks. The same day can show different targets on different
  surfaces.
- **Meal scoring ignores the goal.** `MealScoringService.macroDim` scores against the
  static 220/380/95 g and kcal 3100 regardless of cut/bulk.
- **The training–diet bridges are missing.** `goalPreset` (cut-prep, hypertrophy…)
  never reaches nutrition; deload weeks are a deliberate zero-kcal segment boundary;
  logged sport sessions and schedule edits never move the energy model
  (schedule edits don't even trigger a re-evaluate — stale EAT);
  `prescription.sleepTargetH` is a hardcoded 8.0 seed, never the user's sleep goal.
- **No adaptive correction.** `prescription.basis` is always `"formula"`; the
  long-deferred "Phase 3 adaptive TDEE" blocker (no Fuel intake logging) no longer
  exists — meal logging is real.

## 2. Goals

1. User-customizable macro split: full P/C/F presets + custom percentages, clamped by
   evidence-based floors (protein g/kg, fat minimum).
2. Goal-driven dynamic macro targets: the engine prescribes carbs/fat per segment, so
   all consumers (rings, day targets, meal score, quests, companion) see one truth
   that tracks body weight.
3. Bridges, all as **suggest + approve** (never silent auto-apply):
   - training-day vs rest-day kcal/carb shifting within an unchanged weekly budget,
   - mesocycle phase → diet-phase suggestions (cut-prep meso → cut, deload →
     maintenance-leaning week),
   - weekly check-in review: observed trend vs plan → smoothed kcal correction
     (adaptive TDEE),
   - sleep as a guard input: a poor sleep trend argues for a more conservative
     deficit suggestion.

## 3. Non-goals

- No per-meal nutrient-timing engine (RP-style carb placement per meal) — the existing
  pre/post-workout slot roles and scoring rubric overlay already cover this.
- No full carb-cycling engine — day-type kcal shifting is the ceiling.
- No automatic target rewriting: every engine-driven change beyond the existing
  weigh-in recompute is a suggestion the owner accepts or dismisses.
- No multi-user considerations; mezo stays single-owner.
- Sleep remains an input/guard — never a target the diet plan writes.

## 4. Prior art

Researcher recon (5 sources), what we adopt and reject:

- **MacroFactor program styles** ([help.macrofactorapp.com/91](https://help.macrofactorapp.com/en/articles/91-program-styles)) —
  the algorithm owns the weekly kcal budget; the user owns the split within it.
  **Adopted** as the core contract ("collaborative" autonomy = suggest + approve).
  Full "coached" auto-apply **rejected** per owner decision.
- **MacroFactor coached options** ([help.macrofactorapp.com/34](https://help.macrofactorapp.com/en/articles/34-what-are-the-different-program-options-in-coached-mode)) —
  diet-structure presets (Balanced / Low-fat / Low-carb / Keto) + protein tiers in
  g/kg so protein auto-tracks weight; calorie shifting moves kcal between weekdays
  while the weekly budget holds. **Adopted**: presets + custom % (owner picked full
  P/C/F control), protein floor stays g/kg-anchored; calorie shifting is the
  training-day/rest-day mechanism.
- **RP Diet Coach phases** ([feastgood.com review](https://feastgood.com/rp-diet-app-reviews/)) —
  explicit time-bounded phases (cut/maintain/gain) with rate targets and steered
  transitions. **Adopted** as the meso→diet-phase suggestion model. Its unsmoothed
  step adjustments (200 g → 50 g carbs) are the **anti-pattern** we avoid via
  bounded, smoothed corrections.
- **ISSN position stand** ([tandfonline 12970-017-0174-y](https://www.tandfonline.com/doi/full/10.1186/s12970-017-0174-y)) —
  protein 1.6–2.2 g/kg BW (floor holds on rest days), fat minimum ~15–20 % kcal
  (~0.5 g/kg), carbs absorb adjustments, loss rate 0.5–1.0 %/week. **Adopted** as
  the validation clamps on user input and correction sizing.
- **Carb periodization literature** ([PMC6286987](https://pmc.ncbi.nlm.nih.gov/articles/PMC6286987/)) —
  elite practice is a loose two-tier train-high/rest-lower energy split
  (200–600 kcal swing), protein constant. **Adopted**: supports day-type shifting;
  argues against meal-level periodization complexity.

## 5. Codebase terrain

Investigator recon, the load-bearing facts:

- **The one real pipe:** gym/sport slots + running block → `WeeklyScheduledActivityService`
  (MET × kg × h ÷ 7) → `TdeeBootstrapService` → `GoalProjectionService` →
  `GoalEvaluationService` → `goal.prescription` jsonb → `FuelDayService.targetSet`
  (BE) and `deriveDailyBudget` (FE).
- **Segment extension is cheap:** `GoalPrescriptionJson.Segment` is jsonb-additive —
  adding `carbsG`/`fatG` (and later day-type variants) needs no DB migration; recipe
  in `goal-engine.md` §7.
- **Preference home:** the `fuel_settings` idiom (per-user singleton, config ghost,
  GET never 404s, `useDualQuery` + mock cache-patch) — the repo already ruled
  (mezo-53su) that user cadence preferences belong in a settings singleton, not on
  goal columns (`goal.mealsPerDay`/wake/bed are orphaned precisely for this).
- **Recompute triggers** (6 today): weigh-in, profile save, goal activate, plan
  attach/detach, explicit evaluate, demodata boot runner. New inputs must call
  `goalEngineService.evaluate` from the triggering `@Transactional` method.
- **Known traps:** contract-drift CI gate (regenerate BE + FE clients in the same
  commit); CODEMAP freshness gate; frozen ArchUnit store can silently empty; dual FE
  test modes (real + `VITE_USE_MOCK=true`) with mock-fixture parity; demodata
  runners re-evaluate at boot; full backend suite must not run locally (16 GB OOM);
  ADR 0012 consumer-owned ports for cross-feature reads; both budget derivations
  (FE/BE) must change together or surfaces diverge (mezo-gst9 precedent);
  `FAT_KCAL_SHARE`-style shared constants need a drift-guard test
  (`metDriftGuard.test.ts` pattern).
- **Naming collision:** the in-flight `feat/logged-macro-split` branch (mezo-tjua)
  uses `macroSplit.ts` for a logged meal's own composition — the target-split code
  must use a distinct name (`dietSplit` / `macroTargets`).

## 6. Design

### 6.1 Data model

**New per-user singleton `diet_settings`** (entity + table, `feature/nutrition` or new
`feature/diet` package — follow the `fuel_settings` idiom exactly):

| field | type | notes |
|---|---|---|
| `splitPreset` | text | `balanced` \| `low_fat` \| `low_carb` \| `high_carb` \| `custom` |
| `proteinPctX10` / `carbsPctX10` / `fatPctX10` | int | the custom split, tenths of a percent, must sum to 1000; null unless `custom` |
| `proteinTier` | text | `moderate` (default) \| `high` — maps to the existing `mezo.goal.protein` band endpoints |
| `dayTypeShiftKcal` | int | slice 3: kcal moved from each rest day onto training days, 0 = off |
| `waterMl`, `fiberG` | int | sweeps up the remaining hardcoded targets (4000 / 30) as editable prefs |

Config ghost from a new `DietSettingsProperties` (`mezo.diet.*`), feature-gated
`mezo.feature.diet-settings.enabled`. Presets resolve to fat-share/carb-share numbers in
engine config, not in the DB.

**Prescription segment gains** (jsonb-additive): `carbsG`, `fatG`, and in slice 3
`trainingDayKcal` / `restDayKcal` (nullable — absent means uniform).

**New `goal_suggestion` entity** (slices 4–5, `feature/goal`): `goalId`, `kind`
(`phase_change` \| `weekly_correction`), `status` (`proposed` \| `accepted` \|
`dismissed` \| `superseded`), `payload` jsonb (deltas + rationale), `createdAt`,
`decidedAt`. One open suggestion per kind per goal; a newer proposal supersedes the
open one.

### 6.2 Engine: macro assembly (slices 1–2)

In `GoalEvaluationService.assemble`, after protein:

```
proteinG  = existing g/kg logic (tier picks band endpoint), clamped as today
fatG      = max(fatShare × segmentKcal / 9, fatFloorGPerKg × currentWeightKg)
carbsG    = max(0, (segmentKcal − 4·proteinG − 9·fatG) / 4)
```

- `fatShare` comes from the resolved split (preset table or custom %); a custom split's
  protein % is advisory — the g/kg floor wins and the surplus/deficit lands in carbs.
  The UI shows the clamp when it bites ("a fehérje-padló felülírta: 172 g").
- Validation on save: percentages sum to 100.0, fat ≥ the ISSN minimum share
  (config `mezo.diet.fat-floor-*`), protein % below a sanity ceiling.
- `DietSettingsService.save` triggers `evaluate` on the active goal (7th trigger).
- `FuelDayService.targetSet` serves `seg.carbsG`/`seg.fatG` (fallback: config, as
  today); FE `deriveDailyBudget` replaces `FAT_KCAL_SHARE` with the segment's fat
  grams and keeps carbs as the absorber of the day's activity bonus. A drift-guard
  test pins the preset table FE↔BE.

### 6.3 Consistency repairs (slice 2)

- `MealScoringService.rubricFor` reads the active goal's current segment
  (kcal/p/c/f) instead of raw `NutritionTargetsProperties`; static config remains the
  no-goal fallback. Pre/post role overlays keep applying on top.
- `SportService.replaceSchedule`, `GymScheduleService` mutations, and running-block
  activate/close call `recomputeActiveGoal` (same pattern as `WeightLogService`).
- `GoalEvaluationService` seeds `sleepTargetH` from `sleep_goal.targetMinutes` via a
  consumer-owned port (ADR 0012), config 8.0 stays the ghost.
- Quest `protein_target` threshold and companion snapshot already read the segment —
  they pick up carbs/fat for free once present.

### 6.4 Training-day vs rest-day shifting (slice 3)

- Engine computes each segment's weekly training-day count from the same schedule
  data it already reads; with `dayTypeShiftKcal > 0` it emits
  `trainingDayKcal = kcal + shift × restDays/7 × 7/trainingDays` (weekly sum
  unchanged), `restDayKcal = kcal − shift`. Protein constant; the delta is carbs
  (ISSN pattern).
- BE `targetSet` and FE `deriveDailyBudget` pick the day's number via the existing
  `resolveDayType` (FE) / workout-window (BE) day classification; this also
  *reduces* the FE/BE divergence because both now vary by day type explicitly.
- Clamp: rest-day kcal never below BMR (existing FE floor becomes shared).

### 6.5 Meso-phase → diet-phase suggestions (slice 4)

- On mesocycle activate/close and on entering a deload week (`phaseCurve` boundary —
  the engine already detects it as a segment split), the engine emits a
  `goal_suggestion(kind=phase_change)` when the meso's `goalPreset` disagrees with
  the goal's `trajectory` (e.g. `cut-prep` meso + `bulk`/`maintain` goal → suggest
  cut) or a deload week begins (suggest a maintenance-leaning week: balance → 0 for
  that segment).
- Accepting applies the payload (trajectory change via the normal goal upsert path,
  or a per-segment balance override) and re-evaluates; dismissing records the
  decision so the same trigger doesn't re-propose until the input changes.
- Surfaces on the GoalRecept card + a Fuel banner; push via the existing
  notification anchors.

### 6.6 Weekly check-in review — adaptive correction (slice 5)

- A weekly job (existing scheduler infrastructure; anchored to the owner's week
  boundary) compares `trend.last4wRateKgPerWeek` (already computed) against the
  goal's target rate once `dataSufficiency ≥ provisional`.
- Correction: `deltaKcal = clamp((observedRate − targetRate) × 7700 / 7, ±maxStep)`
  with `maxStep` config (~120 kcal) and a dead-band (no suggestion when the gap is
  within tolerance) — the smoothing RP lacks. Emits
  `goal_suggestion(kind=weekly_correction)` with the rationale (observed vs target,
  the math, and intake-adherence context from Fuel logging where available).
- **Sleep guard:** when the 7-day sleep debt flag condition holds (reuse
  `FlagEvaluator.sleepDebt` logic via a port), a deficit-*increasing* suggestion is
  damped to half and the rationale says why; a deficit-decreasing one is unaffected.
- Accepting writes a kcal-balance adjustment onto the goal (new
  `balanceAdjustmentKcal` column or jsonb field, applied inside
  `GoalProjectionService.dailyEnergyBalance`) and re-evaluates. This sets
  `prescription.basis = "adaptive"` — the long-deferred Phase 3.

### 6.7 UI

- **FuelSettingsSheet** grows a "Diéta" section (slice 1): preset picker, custom
  P/C/F sliders (sum-locked), protein tier, later day-type shift. Water/fiber move
  here too.
- **GoalRecept** renders c/f per segment next to kcal/p, and hosts the suggestion
  cards (accept/dismiss) from slices 4–5.
- **KeretHero/MacroPanel** need no structural change — they render whatever the
  budget says; mock fixtures gain the new fields.

### 6.8 Error handling

- Missing biometric profile: engine skips macro assembly exactly as it skips today
  (static fallback path unchanged).
- Invalid custom split: 400 with a `SystemMessage` key; UI blocks save client-side
  first.
- Suggestion races (goal edited after proposal): accept validates the goal's
  `updatedAt` snapshot in the payload; stale → `superseded`, UI asks to regenerate.

### 6.9 Testing

- Engine unit tests per slice: split resolution + clamps (property-style around the
  sum/floor invariants), day-type math (weekly sum invariance), correction
  clamp/dead-band/sleep-damping, suggestion lifecycle (supersede, dismiss memory).
- Focused ITs only locally (BE suite is CI's job): `diet_settings` CRUD + evaluate
  trigger, `targetSet` day-type selection, suggestion accept path.
- FE: both modes; mock fixtures extended (goalMock segments gain c/f, diet-settings
  ghost); drift-guard test for the preset table; keretHero/buildDayPlan logic tests
  updated where `FAT_KCAL_SHARE` dies.
- Contract: regenerate clients in the same commit as each yml change.

## 7. Slices (one bd issue + branch each, in order)

1. **mezo — Diet split foundations:** `diet_settings` singleton (BE+API+FE sheet),
   engine prescribes `carbsG/fatG`, FE/BE target unification, drift guard.
2. **mezo — Consistency repairs:** goal-aware meal-score rubric, schedule-edit
   recompute triggers, real sleep-goal seed for `sleepTargetH`.
3. **mezo — Day-type kcal shifting:** engine day-type numbers, `targetSet` +
   `deriveDailyBudget` day selection, settings knob.
4. **mezo — Meso→diet phase suggestions:** `goal_suggestion` entity + lifecycle,
   meso/deload triggers, GoalRecept + Fuel surfaces.
5. **mezo — Weekly adaptive review:** weekly comparison job, smoothed correction
   suggestions, sleep-guard damping, `basis="adaptive"`.

Slices 1–2 are independent of 3–5; 4 and 5 share the suggestion entity (4 builds it).

## 8. Open questions (deferred, not blockers)

- Whether logged (vs scheduled) sport sessions should ever feed EAT — out of scope
  here; the stale-schedule trigger fix in slice 2 is the near-term win.
- Cleanup migration for the orphaned `goal.mealsPerDay`/wake/bed columns — separate
  chore.
- Whether `goalPreset` vocabulary should move to a backend enum once slice 4 reads
  it — decide during slice 4.
