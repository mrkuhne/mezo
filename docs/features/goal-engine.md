---
title: Goal Engine (G5–G6)
type: feature-domain
status: done
updated: 2026-09-03
tags: [goal, engine, backend, tdee, projection, guards]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/GoalEngineProperties.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WeeklyScheduledActivityService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEngineService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalProjectionService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GuardEvaluationService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalFeasibilityService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/TdeeBootstrapService.java
related: [me, lifegoal, _platform-api-backend, _platform-data-layer]
---

# Goal Engine (G5–G6) — Feature Documentation

> One-line: the backend **TDEE-bootstrap → segmented projection → soft-guards → feasibility-graded prescription** engine that turns a `Cél` goal + its plan timeline + the EWMA weight trend into a per-segment "recept". **Status: ✅ backend done (goal-system G5, `mezo-g1u`)**; FE surfacing is the recept card in Me/`Cél` (see [`me.md`](me.md) §2). This is a *domain* feature with no route of its own — it produces data the `Cél` surface renders. Phase-3 (adaptive TDEE, AI evaluator) is deferred (§9).

## 1. Summary

The G5 engine is the analytical core behind a body-weight goal: given the goal (trajectory, target rate, guards, window), the owner's biometric profile, the linked Train plans (mesocycles / running blocks), and the live EWMA weight trend, it computes a **segmented prescription** — per stretch of the goal window, a daily kcal target, a protein target, a sleep-target seed, a projected weekly rate, and a Hungarian rationale — plus a **soft-guard status** (strength + muscle volume) and a **feasibility verdict**. The result is persisted onto the goal as two jsonb columns (`tdee_bootstrap`, `prescription`) and surfaced read-only via `GoalResponse`.

The engine is **heuristic + formula-based, never blocking**: guards WARN, the verdict only colours the surface, and a missing biometric profile yields a graceful "profil szükséges" prescription rather than an error (so the recompute triggers in §3 never break a weigh-in/activation).

- **Backend:** ✅ real — five engine services + the weight-trend spine, all config-driven, all integration-tested.
- **FE:** ✅ the recept card (`GoalRecept.tsx`), the `evaluate` action, and the real weight trend — see [`me.md`](me.md) §2/§4 and [`_platform-data-layer.md`](_platform-data-layer.md) §2.

Driving design: [`docs/superpowers/specs/2026-06-18-goal-system-design.md`](../superpowers/specs/2026-06-18-goal-system-design.md) — **§4** (the EWMA-spine projection model, hybrid projection D7) and **§5** (engine services, soft guards D9, feasibility gate D10, prescription assembly §5.4). The grounded numbers (NEAT bands, kcal/kg, protein g/kg, rate bands, the MET model, EWMA half-life) come from the research note [`docs/research/queries/2026-06-18-goal-engine-numbers.md`](../research/queries/2026-06-18-goal-engine-numbers.md).

## 2. User-facing behavior

The engine has **no screen of its own**. Its output appears on `/me/goals/weight` (`Cél`) — moved off `/me/goals` in `mezo-iizd.1` Task 8 so that route could become the general-purpose Célok (life-goals) hub, see [`lifegoal.md`](lifegoal.md) — as the **recept card** (`GoalRecept.tsx`): a feasibility-verdict banner ("Reális" / "Reális, figyelmeztetésekkel" / "Agresszív"), per-segment recept cards (week range, label, kcal / protein g / sleep h / signed kg-per-week, HU rationale), and guard-status pills (strength e1RM trend, muscle weekly-volume floor + rate-cap, and a muted "Fehérje: Fuel-re vár" pill). When a goal has not yet been evaluated (`prescription === null`), the card shows an **"⚡ Értékeld a célt" CTA** that fires the `evaluate` action. Full UX detail and the Hungarian labels live in [`me.md`](me.md) §2 (`Recept — the G5 engine finale`).

The engine also runs **invisibly** on the recompute triggers (§3) — logging a weigh-in, activating a goal, or attaching/detaching a plan all silently refresh the active goal's prescription, so the recept the user next opens is current without an explicit re-evaluate.

## 3. Architecture & data flow

The orchestrator is **`GoalEngineService.evaluate(userId, goalId)`** (`feature/goal/engine/service/GoalEngineService.java:77`, `@Transactional`) — it owns all I/O and chains the pure services:

```
evaluate(userId, goalId)                              GoalEngineService.java:77
 ├─ goalRepository.findByIdAndCreatedByAndDeletedFalse → 404 if foreign/missing (ownership-gated)
 ├─ GuardEvaluationService.evaluate(goal, linkedMesoIds, trend)        engine/service/GuardEvaluationService.java:85
 ├─ profile = BiometricProfileRepository.findByCreatedByAndDeletedFalse  ── null? ─► GoalEvaluationService.missingProfile(guards)
 │                                                                                    (graceful note, no bootstrap, persist, return)
 ├─ weeklyEat = WeeklyScheduledActivityService.totalWeeklyEatKcalPerDay(userId, currentWeightKg)  train/service (MET×kg×óra ÷ 7)
 ├─ TdeeBootstrapService.compute(profile, currentWeightKg, weeklyEat)  engine/service/TdeeBootstrapService.java:75   → goal.tdeeBootstrap (BMR×neat + weeklyEat)
 ├─ WeightTrendService.computeTrend(userId)                            biometrics/weight/service/WeightTrendService.java:75 (EWMA spine)
 ├─ GoalProjectionService.project(goal, userId, bootstrap, trend)      engine/service/GoalProjectionService.java:117  → segments
 └─ GoalEvaluationService.assemble(goal, weightKg, bodyFatPct, segments, guards)  engine/service/GoalEvaluationService.java:80
                                                                       → goal.prescription  (dirty-check flushes both jsonb cols)
```

Service responsibilities (all `@Service`, constructor-injected, stateless):

- **`WeightTrendService`** (`biometrics/weight/service/WeightTrendService.java`) — the **spine**. Collapses same-day weigh-ins to a daily mean, runs an EWMA (`α = 1 − 0.5^(1/halfLifeDays)`), and computes the OLS weekly rate (whole-window + trailing-4w) and a `dataSufficiency` grade (`none` / `provisional` / `full`). Read-only, no `@Transactional`. Reused by the projection (reconciliation) and the muscle guard (rate-cap), and exposed verbatim at `GET /api/biometrics/weight/trend`.
- **`TdeeBootstrapService`** (`engine/service/TdeeBootstrapService.java`) — the **formula TDEE**. Katch-McArdle when body-fat % is known (`BMR = 370 + 21.6·LBM`, `formula="KATCH"`), else Mifflin-St Jeor (`formula="MSJ"`); then **`neatBaselineKcal = BMR × NEAT`** (the NEAT lifestyle multiplier from `activityLevel` — DESK/MIXED/PHYSICAL, default MIXED 1.35) and **`TDEE = neatBaselineKcal + weeklyEatKcalPerDay`**, where the caller supplies the weekly scheduled training energy from the train-port `WeeklyScheduledActivityService` (gym+sport+active-run, MET×kg×óra ÷ 7). Pure; the caller supplies current weight + weekly EAT, so it needs no repository. **Anti-double-count (§6.3, mezo-eujg):** the NEAT multiplier covers ONLY non-exercise daily life; training energy is added **explicitly** via `weeklyEatKcalPerDay`, never baked into the multiplier (the old `BMR × PAL` folded average activity into the multiplier — retired).
- **`GoalProjectionService`** (`engine/service/GoalProjectionService.java`) — the **segmented projection** (spec §4). Walks the window week-by-week in goal-week space, resolves the active load per week (meso phase class from `phaseCurve` + running on/off), collapses contiguous identical loads into `ProjectionSegment`s, and computes per segment the TDEE, daily kcal target, and projected rate for all three trajectories. **Segment maintenance (§6.3, mezo-eujg):** each segment's TDEE = the NEAT baseline + the scheduled gym+sport EAT (segment-independent) + this segment's running EAT — every training term MET×kg×óra via `WeeklyScheduledActivityService`. Running on/off is the *only* per-segment TDEE delta (`runWeeklyEatKcalPerDay(sessions, weightKg)`); a meso-phase change splits a segment but is a *zero* TDEE delta (its effect is on volume, the muscle guard); gym + volleyball are scheduled + segment-independent (volleyball now counts **explicitly through the weekly schedule**, no longer modelled as ambient). Each segment also carries the goal's **`dailyEnergyBalanceKcal`** = `sign(trajectory) × rate%/100 × kg × kcalPerKg ÷ 7`, with `targetKcal = tdee + dailyEnergyBalance` — the explicit per-day deficit/surplus Fuel now reads straight off the wire ([`fuel.md`](fuel.md) §5). **Reconciliation:** once the trend is ≥ `provisional`, the observed trailing-4w rate becomes the spine, replacing the formula seed.
- **`GuardEvaluationService`** (`engine/service/GuardEvaluationService.java`) — the **soft guards** (spec §5.3, D9 — WARN, never block). Strength: reuses the `ExerciseRecordService` aggregation idiom (group sets by lift identity = `catalog_id` else `name`, Epley e1RM `weight × (30 + reps)/30`, reps ≤ 10), main lift = the identity with the most sets, `breached` when its e1RM trend % drops to `strength.e1rmBreachPct` (−5%). Muscle: per-muscle weekly hard sets from `MuscleGroupVolumeLog` across the linked mesos vs `volume.warnBelow` (6), plus a rate-cap on the trailing-4w EWMA slope vs `rate.capPctPerWeek`. **Protein leg deferred** — `proteinMonitored=false` always (Fuel intake not built).
- **`GoalEvaluationService`** (`engine/service/GoalEvaluationService.java`) — the **heuristic feasibility gate + prescription assembly** (spec §5.1/§5.4). Grades rate realism, guard satisfiability, and a conflict rule (`grade(...)`, `GoalEvaluationService.java:145-149`); folds segments + guards + a protein target (`proteinTargetGrams`, BW path vs LBM path, capped) into the `GoalPrescriptionJson`. Pure, no I/O, never throws. Its `gradeRate` delegates the cap/band → verdict classification to `GoalFeasibilityService.verdictForRate` so the eval gate and the wizard preview share **one** band definition. **Conflict escalation:** the rule's rate trigger is `RateGrade.overBand()`, which is true for **both** the 0.7–1.0 warnings band **and** the over-cap aggressive band — so a rate that on its own would only be `feasible-with-warnings` (0.7–1.0 %BW/wk) **escalates to `aggressive`** when it coincides with an active running block (a segment whose `activeSystems` contains `"run"`) **and** an active `strength` guard (likely strength breach; adds the "enyhítsd a deficitet vagy told arrébb a futóblokkot" note). Covered by `GoalEvaluationServiceIT`.
- **`GoalFeasibilityService`** (`engine/service/GoalFeasibilityService.java`, G6 `mezo-06n`) — the **stateless realism core**: the single source of (a) the rate-magnitude derivation `deriveRatePctPerWeek` = `|startW − targetW| / startW * 100 / weeks` (maintain/null-target/weeks≤0 → 0; `GoalService.applyUpsert` delegates here so the persisted rate equals the previewed rate), (b) the `verdictForRate` band mapping, and (c) `preview(FeasibilityPreviewRequest)` which derives + grades a draft and — only over the cap — suggests `startDate + ceil(weeksAtCap)` (`weeksAtCap = magnitude / capPctPerWeek`). Pure, config-driven (`GoalEngineProperties`), no I/O.

**Derived weekly rate (G6 `mezo-06n`).** `rateTargetPctPerWeek` is **server-derived**, not a client input: `GoalService.applyUpsert` calls `GoalFeasibilityService.deriveRatePctPerWeek(...)` on every create/update (stored as an unsigned magnitude; the G5 engine applies the trajectory sign). It was dropped from `GoalUpsertRequest` and stays on `GoalResponse`.

`GoalEngineService` is the *only* `@Transactional` link (it writes the goal); every other service is pure/read-only so it is trivially testable in isolation.

### Recompute triggers

`evaluate` is called from **five** places (every event that moves a model input), all in the same transaction as the triggering write, all graceful on a missing profile:

| Trigger | Caller | Scope |
|---|---|---|
| **Goal activated** | `GoalService.activateGoal` (`feature/goal/service/GoalService.java:87`) | the just-activated goal (its prescription at birth) |
| **Plan attached** | `GoalPlanLinkService.attachPlan` (`:62`) | the goal whose links changed (regardless of status) |
| **Plan detached** | `GoalPlanLinkService.detachPlan` (`:74`) | same |
| **Weigh-in logged** | `WeightLogService.log` → `recomputeActiveGoal` (`feature/biometrics/weight/service/WeightLogService.java:43,48`) | the owner's single **active** goal (no-op when none) |
| **Biometric profile changed** (G6, `mezo-06n`) | `BiometricProfileService.upsertProfile` → `recomputeActiveGoal` (`feature/biometrics/profile/service/BiometricProfileService.java`) | the owner's single **active** goal (no-op when none) — the profile feeds BMR + the NEAT band, so a change must refresh the prescription |
| **Explicit** | `GoalController.evaluateGoal` → `POST /api/goals/{id}/evaluate` (`:75`) | the addressed goal |

**Transaction note:** because each trigger's enclosing method is already `@Transactional`, `evaluate` joins the same transaction — the recompute is part of the triggering write's atomic unit (a failed evaluate would roll back the weigh-in/profile-save). The weigh-in and profile-change paths deliberately depend on **no** goal: if the owner has no active goal, `recomputeActiveGoal` returns without calling `evaluate` (a weigh-in/profile-save must never require a goal).

**Startup reconciliation (Fuel Layer C, `mezo-eujg`).** A **sixth**, batch caller sits outside the write-triggered five: `GoalReevaluateRunner` (`feature/goal/GoalReevaluateRunner.java`) — a `CommandLineRunner`, `@Profile("demodata")` (the prod-active profile), `@Order(200)` so it runs after the seed runners — re-`evaluate`s **every non-archived owner goal** at boot. It exists because the NEAT/weekly-EAT migration made any goal's stored prescription stale (old BMR×PAL numbers, no `dailyEnergyBalanceKcal`); the runner refreshes them so the recept the user next opens carries the new model. Idempotent (`evaluate` overwrites both jsonb columns each run, and the graceful no-profile path is safe); ITs annotate `@ActiveProfiles("demodata")` and drive the no-arg `run()` overload against a reset DB.

## 4. Data model & API

**Persistence** — two jsonb columns added to `goal` + one column on `biometric_profile` by migration `backend/src/main/resources/db/changelog/1.0.0/script/202606191000_mezo-g1u_goal_prescription_and_activity_level.sql` (additive only — existing rows carry none until first evaluate):

- `goal.tdee_bootstrap jsonb` → `TdeeBootstrapJson` (`feature/goal/entity/TdeeBootstrapJson.java`: `bmr`, `neat`, `neatBaselineKcal`, `weeklyEatKcalPerDay`, `tdee`, `formula` MSJ|KATCH, `computedAt` — reframed from the old `{bmr, tdee, pal, …}` to the NEAT + weekly-scheduled-EAT model in mezo-eujg; `tdee = neatBaselineKcal + weeklyEatKcalPerDay`). Field `GoalEntity.tdeeBootstrap` (`:61`, `@JdbcTypeCode(SqlTypes.JSON)`).
- `goal.prescription jsonb` → `GoalPrescriptionJson` (`feature/goal/entity/GoalPrescriptionJson.java`: `generatedAt`, `basis`, `segments[]` {fromWeek, toWeek, label, kcal, proteinG, sleepTargetH, restDays[], projectedRateKgPerWk, **`dailyEnergyBalanceKcal`** (the explicit per-day goal deficit/surplus, mezo-eujg), rationale}, `guardStatus` {strength, muscle}, `feasibility` {verdict, notes[]}). Field `GoalEntity.prescription` (`:65`).
- `biometric_profile.activity_level text` (CHECK `ck_biometric_profile_activity_level IN (DESK|MIXED|PHYSICAL)` since mezo-eujg — the old 5-band `SEDENTARY|LIGHT|MODERATE|VERY|EXTRA` constraint was dropped and existing rows remapped in place by migration `202607261200_mezo-eujg_activity_level_desk_mixed_physical.sql`) → `BiometricProfileEntity.activityLevel` (`:56`, nullable). The NEAT lifestyle-band lookup input.

Both jsonb records are **plain records, no Jackson/Hibernate annotations** — the app `ObjectMapper` serializes them via `@JdbcTypeCode(SqlTypes.JSON)` (the `ProvenanceEnvelope` idiom). `GoalMapper` (`feature/goal/mapper/GoalMapper.java:39-41`) projects them to the contract DTOs (`TdeeBootstrap`/`GoalPrescription`), mapping the `String` `formula`/`verdict` to the generated enums.

**Day-planner settings (Fuel P5, `mezo-9ys`) — non-engine goal fields.** The `goal` table additionally gained three plain nullable columns — `meals_per_day smallint` (CHECK `between 3 and 6`), `wake_time`/`bed_time varchar(5)` — via migration `202607021500_mezo-9ys_goal_planner_settings.sql`, surfaced additively on `GoalRequest`/`GoalResponse` (`mealsPerDay`/`wakeTime`/`bedTime`). **The engine neither reads nor writes them** — they are pure contract passthrough (`GoalService.applyUpsert` maps them straight through) consumed by Fuel's Mai day-planner timeline (see [`fuel.md`](fuel.md) §4/§5). They ride this aggregate for storage only and do not touch the TDEE/projection/guard/prescription pipeline. (The reverse bridge — `prescription.kcal/proteinG` → Fuel's daily budget — is the §5 deferred bridge that Fuel P5 now consumes.)

**Endpoints** (contract-first — `api/feature/goal/goal.yml`, `api/feature/weight/weight.yml`, `api/feature/biometrics-profile/biometrics-profile.yml`):

| Verb | Path | Returns | Notes |
|---|---|---|---|
| POST | `/api/goals/{id}/evaluate` | `GoalResponse` (with `prescription`/`tdeeBootstrap`) | runs the engine, persists, re-fetches via `getGoal`. No-profile → **200 + graceful feasibility note** (never 4xx, so triggers don't break); foreign/missing → **404**. |
| POST | `/api/goals/feasibility-preview` (G6, `mezo-06n`) | `FeasibilityPreviewResponse` {`derivedRatePctPerWeek`, `withinSafeBand`, `verdict`, `suggestedTargetDate?`} | **stateless** realism preview for the 2-step wizard from a `FeasibilityPreviewRequest` draft {`trajectory`, `startWeightKg`, `targetWeightKg?`, `startDate`, `targetDate`} — derive + grade BEFORE the goal is saved. No persistence/ownership (principal resolved per convention, compute ignores it). `suggestedTargetDate` present only when over the cap (`startDate + ceil(weeksAtCap)`). |
| GET | `/api/biometrics/weight/trend` | `WeightTrendResponse` {`ewmaSeries[]`, `latestTrendKg`, `weeklyRateKgPerWeek`, `weeklyRatePctPerWeek`, `last4wRateKgPerWeek`, `dataSufficiency`} | the EWMA spine, exposed for the FE. |
| GET | `/api/biometrics/profile` (G6, `mezo-06n`) | `BiometricProfileResponse` (with a **derived** `tdeeBootstrap`) | the profile screen's base-TDEE. `tdeeBootstrap` is computed on read from the profile + the latest weigh-in + the owner's **weekly scheduled EAT** (`WeeklyScheduledActivityService`, so the card's `Betábl. mozgás` line is live even with no goal, mezo-eujg) via `TdeeBootstrapService.compute` (cross-`$ref` to the goal fragment's `TdeeBootstrap` schema) — **NOT persisted** (no column); **null** when there is no weigh-in. |
| PUT | `/api/biometrics/profile` | `BiometricProfileResponse` (with derived `tdeeBootstrap`) | now carries `activityLevel` (the 3-band NEAT lifestyle; the Profile `BiometricSheet` sends it); the save **recomputes the active goal** (trigger above). |

`GoalResponse` additively gained `prescription` + `tdeeBootstrap` (both `nullable` — null until first evaluate). The HTTP surface and these contract shapes are documented in [`_platform-api-backend.md`](_platform-api-backend.md) §3 (the Goal/Biometrics rows) and [`me.md`](me.md) §4.

### Config — `mezo.goal.*` (the grounded constants)

**Every** engine number lives in `application.yml` under `mezo.goal:` (`:28`), bound by `GoalEngineProperties` (`feature/goal/engine/GoalEngineProperties.java`, a `@Validated @ConfigurationProperties` record). No `@Value`, no hardcoded tunable downstream — per [`docs/references/configuration_conventions.md`](../references/configuration_conventions.md). The defaults and where each is consumed:

| Property | Default | Consumed by |
|---|---|---|
| `neat.{desk,mixed,physical}` | 1.20 / **1.35** / 1.50 | `TdeeBootstrapService` (NEAT lifestyle-band lookup; mixed = default) |
| `kcalPerKg` | 7700 (band 6000–7700) | `GoalProjectionService` (energy balance ↔ rate) |
| `protein.gPerKgBwDefault/…/gPerKgBwCap` | 2.0 … 2.6 | `GoalEvaluationService.proteinTargetGrams` |
| `rate.{targetPctPerWeek,capPctPerWeek,bandLow,bandHigh}` | 0.7 / 1.0 / 0.5 / 1.0 | `GoalFeasibilityService` (`verdictForRate` band: ≤target → feasible, ≤cap → with-warnings, else aggressive; `withinSafeBand`/`suggestedTargetDate` key off cap) — reused by `GoalEvaluationService` (rate realism) + `GuardEvaluationService` (rate-cap) |
| `volume.{maintenanceSets,warnBelow}` | 8 / 6 | `GuardEvaluationService` (muscle guard) |
| `strength.e1rmBreachPct` | −5.0 | `GuardEvaluationService` (strength breach gate) |
| `ewma.halfLifeDays` | 10 (band 10–14) | `WeightTrendService` (α) |
| *(training EAT — moved out of `mezo.goal.*` in mezo-eujg)* | gym 6.0 / sport 4.5 / run 9.5 MET | now `mezo.train.met` (`TrainProperties`), summed MET×kg×óra by the train-port `WeeklyScheduledActivityService`; a drift-guard test binds this table to the FE `fuelConfig.MET_BY_KIND` |
| `thermogenesisHaircutKcalPerDay` | 0 (off; band 100–200) | reserved (adaptive haircut) |
| `bootstrapUncertaintyKcal` | 300 | uncertainty band |

**Reserved / tuning surface (defined but not yet consumed):** `protein.gPerKgLbmLow`, `protein.gPerKgBwFloor`/`gPerKgBwCeil`, `thermogenesisHaircutKcalPerDay`, and `bootstrapUncertaintyKcal` are wired into `GoalEngineProperties` ahead of the slices that will read them; no service consumes them today. (The session-kcal `met.*` deltas that used to live here were **retired in mezo-eujg** — training EAT is now the train-owned MET×kg×óra model, `mezo.train.met`, consumed via `WeeklyScheduledActivityService`.)

These are the empirical-tuning surface (research §7): EWMA half-life, kcal/kg, the −5% e1RM breach, and the rate bands are all tunable from real data without a code change.

## 5. Integrations

The engine is a **consumer hub** — it reads three other domains and writes one:

- **← Biometrics/weight (the spine).** *Contract:* `WeightTrendResponse` (EWMA series + rates + sufficiency) from `WeightTrendService.computeTrend(userId)`. The projection uses it for rate reconciliation; the muscle guard uses `last4wRateKgPerWeek` for the rate-cap. The same service backs `GET /api/biometrics/weight/trend`, which the FE `useWeight` folds into `weightTrends` ([`_platform-data-layer.md`](_platform-data-layer.md) §4).
- **← Biometrics/profile.** *Contract:* `BiometricProfileEntity` (sex, heightCm, birthDate, bodyFatPct, **activityLevel**) → the TDEE bootstrap. A missing profile is the graceful path (no throw).
- **← Train (mesocycles + running blocks).** *Contract:* the goal's `GoalPlanLinkEntity` rows + the linked `MesocycleEntity.phaseCurve` (the per-week phase class) / `RunningBlockEntity.structure` (sessions-per-week) read via the Train repos (ownership-checked), and `MuscleGroupVolumeLogEntity` + `ExerciseSetEntity`/`ExerciseRepository` for the guards (the strength leg deliberately reuses the `ExerciseRecordService` Epley/identity idiom). See [`train.md`](train.md) for those aggregates.
- **← Train weekly scheduled EAT (the training-energy port, mezo-eujg).** *Contract:* the train-owned **`WeeklyScheduledActivityService`** (`feature/train/service`) — `totalWeeklyEatKcalPerDay(userId, weightKg)` (the bootstrap's `weeklyEatKcalPerDay`) + `scheduledWeeklyEatKcalPerDay` / `runWeeklyEatKcalPerDay(sessions, weightKg)` (the projection's per-segment gym+sport vs running EAT). Train owns the recurring gym/sport slots + the MET model (`mezo.train.met`, MET×kg×óra ÷ 7); a drift-guard test binds that MET table to the FE `fuelConfig.MET_BY_KIND`. This replaced the retired goal-side `met.*` deltas (§4 config) so training energy is one source across Train, the engine, and Fuel.
- **→ Goal (writes).** *Contract:* `tdeeBootstrap` + `prescription` jsonb persisted onto `GoalEntity`, surfaced via `GoalResponse` → the FE `GoalRecept` card ([`me.md`](me.md) §2).

**Cross-domain bridges (spec §5.4):** `prescription.kcal/proteinG` → Fuel is **now wired twice** — Fuel P5 (`mezo-9ys`) reads the current-week segment as the Mai day-planner's daily budget (`deriveDailyBudget`; see [`fuel.md`](fuel.md) §5), and **since mezo-najo the backend `FuelDayService` day/week `targets` kcal + protein come from the date's goal-week segment too** (config `mezo.nutrition.*` as fallback — so the MacroHero, the chat snapshot and `get_fuel_log` all carry the recept number). Still emitted-but-unconsumed: `sleepTargetH` (seeded at 8.0) → Sleep; `restDays`/deload → Train/Today.

## 6. How to use it (consume)

**Backend** — never call a single engine service to "get the prescription"; call the orchestrator so the artifact is assembled + persisted atomically:

```java
goalEngineService.evaluate(userId, goalId);   // @Transactional; assembles + persists; graceful on no profile
```

Read the result off the goal via the normal `GoalService.getGoal` path (the `GoalMapper` projects the jsonb into `GoalResponse.prescription`/`tdeeBootstrap`). The individual services (`WeightTrendService`, `TdeeBootstrapService`, …) are public and pure — reuse them directly only for a *read-only* derivation (e.g. another feature wanting the EWMA trend), never to mutate goal state.

**Frontend** — read the prescription from `useGoal().goalResponse.prescription` (it rides the goal, no separate hook), and trigger a fresh compute with `useGoalActions().evaluate(goalId)` (POST `/evaluate`, invalidates `['goals']` + the goal timeline). See [`_platform-data-layer.md`](_platform-data-layer.md) §2/§4 for the dual-mode wiring; never call the API client directly from a view.

## 7. How to extend it

Add a tunable, a guard leg, or a projection input — always config-first, contract-first, integration-tested:

1. **New tunable** → add the field to `GoalEngineProperties` (with its validation + a `//` research-range comment) and a default to `mezo.goal.*` in `application.yml`. Never hardcode or `@Value` it ([`configuration_conventions.md`](../references/configuration_conventions.md)).
2. **New engine output field** → contract-first: edit `api/feature/goal/goal.yml` (`GoalPrescription`/`…Segment`), `cd api/generate && npm run generate:api`, then mirror the field on `GoalPrescriptionJson`/`Segment` and project it in `GoalMapper`. An additive jsonb field needs **no migration** (it rides the existing column).
3. **New guard / projection logic** → extend the pure service (`GuardEvaluationService` / `GoalProjectionService`); keep it side-effect-free and config-driven so it stays unit-testable, and add the assembly hook in `GoalEvaluationService`. Follow [`spring_patterns.md`](../references/spring_patterns.md) (constructor DI, `@Transactional` only on the orchestrator).
4. **New recompute trigger** → call `goalEngineService.evaluate(userId, goalId)` from the triggering `@Transactional` service method; rely on the graceful no-profile path (never guard with "only if a profile exists").
5. **Test** integration-first ([`testing_standards.md`](../references/testing_standards.md)) against real Postgres; add data via populators; both FE test modes stay green.

## 8. Testing

**Backend (integration-first, real Postgres — `cd backend && ./mvnw clean test`):**
- Per-service ITs: `feature/goal/engine/service/TdeeBootstrapServiceIT` (MSJ vs Katch branch, NEAT-band lookup + weekly-EAT add), `GoalProjectionServiceIT` (segment collapse, running boundary delta, meso-phase zero-delta, `dailyEnergyBalanceKcal`, trend reconciliation), `GuardEvaluationServiceIT` (e1RM trend + breach, muscle floor, rate-cap, deferred protein), `GoalEvaluationServiceIT` (rate grading, conflict rule, protein target, missing-profile artifact), `GoalFeasibilityServiceIT` (G6 — shared rate derivation, `verdictForRate` band boundaries, over-cap suggested date). The HTTP preview round-trip is in `GoalContractIT`.
- `feature/goal/engine/GoalEnginePropertiesIT` — the `mezo.goal.*` binding + validation.
- `feature/goal/GoalEngineRecomputeIT` — the recompute triggers fire `evaluate` (activate / attach / detach / weigh-in) and the no-active-goal weigh-in is a no-op.
- `feature/biometrics/profile/BiometricProfileServiceIT` / `BiometricProfileContractIT` (G6) — the GET carries a derived `tdeeBootstrap` (profile + weigh-in → non-null, matches `TdeeBootstrapService.compute`; no weigh-in → null) and the profile upsert recomputes the active goal (prescription was null → populated) yet succeeds with no active goal.
- `feature/goal/GoalContractIT` — the HTTP `POST /api/goals/{id}/evaluate` surface (200 + prescription, 200 graceful no-profile, 404 foreign).

**Frontend** — `frontend/src/features/me/components/GoalRecept.test.tsx` (verdict labels, segment metrics, guard pills incl. a breached strength guard, the null-prescription evaluate CTA) + the recept assertions in `GoalsPage.test.tsx`; the trend fold in `data/me/weightHooks.test.tsx`. Both `pnpm test` (real) and `VITE_USE_MOCK=true pnpm test` (mock) must pass — see [`me.md`](me.md) §8.

## 9. Decisions, gotchas & deferred

**Key decisions** (spec [`2026-06-18-goal-system-design.md`](../superpowers/specs/2026-06-18-goal-system-design.md)):
- **EWMA trend is the rate spine, not a fixed projected deficit** (§4) — once data is sufficient, the observed trailing-4w slope replaces the formula seed.
- **Training energy is explicit scheduled EAT, not a multiplier** (§6.3, mezo-eujg) — maintenance = BMR×NEAT (non-exercise only) + weekly scheduled gym+sport EAT + per-segment running EAT (all MET×kg×óra via `WeeklyScheduledActivityService`); meso phase is a zero-TDEE segment boundary, volleyball now counts through the weekly schedule. Adding training explicitly (rather than via a `BMR × PAL` multiplier that bakes it in) is what lets Fuel add the day's live MET burn on top without double-counting.
- **Soft guards (D9) + heuristic gate (D10) never block** — the verdict only colours the surface; `evaluate` never throws on a model-shape problem.
- **Graceful no-profile path** — `missingProfile` returns a real prescription with a feasibility note (Task-9 recompute triggers rely on this).

**Gotchas:**
- Age/`computedAt` use `LocalDate.now()`/`OffsetDateTime.now()` directly (no `Clock` bean — codebase convention); the services are otherwise pure.
- `neat` is stored unrounded (a multiplier, not kcal); `bmr`/`neatBaselineKcal`/`weeklyEatKcalPerDay`/`tdee` are rounded (2 dp).
- `proteinMonitored` is **always false** — the protein TARGET is prescribed, but Fuel intake logging doesn't exist to monitor it; a note records this and it must **not** downgrade the verdict.

**Deferred to Phase 3** (post-G5, blocked on later slices):
- **Adaptive TDEE** (back-calc from Fuel intake + EWMA trend, `prescription.basis="adaptive"`) — blocked on **Fuel Slice C** (calorie logging). The protein-guard monitoring leg lights up here too.
- **AI evaluator** (Spring AI) replacing the heuristic gate; a living-narrative recompute; a **weekly scheduled re-fit** (only event-driven recompute today).
- **Cross-domain bridges** (§5) — prescription kcal/protein → Fuel, `sleepTargetH` → Sleep, restDays/deload → Train/Today — wired as each target domain's backend lands.

## 10. Key files

**Engine (backend, `feature/goal/engine/`):**
- `GoalEngineProperties.java` — the `mezo.goal.*` config record (NEAT bands/kcalPerKg/protein/rate/volume/strength/ewma; the session-kcal `met` deltas were retired in mezo-eujg — training EAT is train-owned, `mezo.train.met`).
- `service/GoalEngineService.java` — the `@Transactional` orchestrator (`evaluate`) — the only entry point (pulls the weekly EAT from `WeeklyScheduledActivityService`, then calls `TdeeBootstrapService.compute`).
- `service/TdeeBootstrapService.java` — formula TDEE (MSJ / Katch-McArdle BMR × NEAT baseline + weekly scheduled EAT).
- `../GoalReevaluateRunner.java` (`feature/goal/`) — the `@Profile("demodata")` startup runner that re-`evaluate`s every non-archived owner goal so stale prescriptions pick up the NEAT/weekly-EAT model (mezo-eujg, §3).
- `../../train/service/WeeklyScheduledActivityService.java` — the train-owned weekly scheduled EAT (MET×kg×óra ÷ 7) the bootstrap + projection consume (mezo-eujg, §5).
- `service/GoalProjectionService.java` — the segmented projection (block-boundary deltas, trend reconciliation, all 3 trajectories).
- `service/GuardEvaluationService.java` — strength (e1RM) + muscle-volume + rate-cap soft guards.
- `service/GoalEvaluationService.java` — heuristic feasibility gate + prescription assembly (pure); delegates the band → verdict to `GoalFeasibilityService`.
- `service/GoalFeasibilityService.java` (G6) — the stateless realism core: shared `deriveRatePctPerWeek` + `verdictForRate` + `preview` (`POST /api/goals/feasibility-preview`).

**Spine / inputs:**
- `backend/.../feature/biometrics/weight/service/WeightTrendService.java` — the EWMA weight-trend spine (`GET /api/biometrics/weight/trend`).
- `backend/.../feature/biometrics/weight/service/WeightLogService.java` — the weigh-in recompute trigger.
- `backend/.../feature/goal/service/{GoalService,GoalPlanLinkService}.java` — activate / attach / detach recompute triggers.
- `backend/.../feature/goal/controller/GoalController.java` — `evaluateGoal` (`POST /api/goals/{id}/evaluate`) + `feasibilityPreview` (`POST /api/goals/feasibility-preview`, G6).

**Persistence / contract:**
- `backend/.../feature/goal/entity/{GoalEntity,GoalPrescriptionJson,TdeeBootstrapJson}.java` — the jsonb columns + records.
- `backend/.../feature/goal/mapper/GoalMapper.java` — jsonb → contract DTO projection.
- `backend/src/main/resources/db/changelog/1.0.0/script/202606191000_mezo-g1u_goal_prescription_and_activity_level.sql` — the G5 migration (jsonb columns + the original 5-band `activity_level`).
- `backend/src/main/resources/db/changelog/1.0.0/script/202607261200_mezo-eujg_activity_level_desk_mixed_physical.sql` — the mezo-eujg reframe (5-band PAL → 3-band NEAT CHECK + in-place row remap).
- `api/feature/goal/goal.yml`, `api/feature/weight/weight.yml`, `api/feature/biometrics-profile/biometrics-profile.yml` — the contract fragments.
- `backend/src/main/resources/application.yml` — the `mezo.goal:` config block (`:28`).

**Frontend (the recept surface):**
- `frontend/src/features/me/components/GoalRecept.tsx` (+ `.test.tsx`) — the recept card + evaluate CTA.
- `frontend/src/data/me/goalHooks.ts` — `useGoalActions().evaluate`; `frontend/src/data/me/weightHooks.ts` — the real trend fold.

**Tests:** `backend/.../feature/goal/engine/**` (per-service ITs + properties IT), `feature/goal/{GoalEngineRecomputeIT,GoalContractIT}.java`.

**Related docs (link, don't duplicate):** [`me.md`](me.md) (the `Cél` recept surface + the wizard activity picker), [`lifegoal.md`](lifegoal.md) (the general-purpose life-goal system at `/me/goals`, whose closed signal catalog carries a `weight_goal` entry referencing this goal as a `linked` pillar — today a labeled placeholder, the actual on-pace read is a slice-2 seam), [`_platform-api-backend.md`](_platform-api-backend.md) (the contract/HTTP surface + jsonb conventions), [`_platform-data-layer.md`](_platform-data-layer.md) (the `useGoalActions().evaluate` + `useWeight` trend wiring), [`train.md`](train.md) (the meso/running/volume aggregates the guards + projection read), spec [`2026-06-18-goal-system-design.md`](../superpowers/specs/2026-06-18-goal-system-design.md), research [`2026-06-18-goal-engine-numbers.md`](../research/queries/2026-06-18-goal-engine-numbers.md), and the house standards in [`docs/references/`](../references/).
