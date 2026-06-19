---
title: Goal Engine (G5)
type: feature-domain
status: done
updated: 2026-06-19
tags: [goal, engine, backend, tdee, projection, guards]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/GoalEngineProperties.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEngineService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalProjectionService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GuardEvaluationService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/TdeeBootstrapService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/weight/service/WeightTrendService.java
  - backend/src/main/resources/application.yml
related: [me, _platform-api-backend, _platform-data-layer]
---

# Goal Engine (G5) — Feature Documentation

> One-line: the backend **TDEE-bootstrap → segmented projection → soft-guards → feasibility-graded prescription** engine that turns a `Cél` goal + its plan timeline + the EWMA weight trend into a per-segment "recept". **Status: ✅ backend done (goal-system G5, `mezo-g1u`)**; FE surfacing is the recept card in Me/`Cél` (see [`me.md`](me.md) §2). This is a *domain* feature with no route of its own — it produces data the `Cél` surface renders. Phase-3 (adaptive TDEE, AI evaluator) is deferred (§9).

## 1. Summary

The G5 engine is the analytical core behind a body-weight goal: given the goal (trajectory, target rate, guards, window), the owner's biometric profile, the linked Train plans (mesocycles / running blocks), and the live EWMA weight trend, it computes a **segmented prescription** — per stretch of the goal window, a daily kcal target, a protein target, a sleep-target seed, a projected weekly rate, and a Hungarian rationale — plus a **soft-guard status** (strength + muscle volume) and a **feasibility verdict**. The result is persisted onto the goal as two jsonb columns (`tdee_bootstrap`, `prescription`) and surfaced read-only via `GoalResponse`.

The engine is **heuristic + formula-based, never blocking**: guards WARN, the verdict only colours the surface, and a missing biometric profile yields a graceful "profil szükséges" prescription rather than an error (so the recompute triggers in §3 never break a weigh-in/activation).

- **Backend:** ✅ real — five engine services + the weight-trend spine, all config-driven, all integration-tested.
- **FE:** ✅ the recept card (`GoalRecept.tsx`), the `evaluate` action, and the real weight trend — see [`me.md`](me.md) §2/§4 and [`_platform-data-layer.md`](_platform-data-layer.md) §2.

Driving design: [`docs/superpowers/specs/2026-06-18-goal-system-design.md`](../superpowers/specs/2026-06-18-goal-system-design.md) — **§4** (the EWMA-spine projection model, hybrid projection D7) and **§5** (engine services, soft guards D9, feasibility gate D10, prescription assembly §5.4). The grounded numbers (PAL bands, kcal/kg, protein g/kg, rate bands, MET deltas, EWMA half-life) come from the research note [`docs/research/queries/2026-06-18-goal-engine-numbers.md`](../research/queries/2026-06-18-goal-engine-numbers.md).

## 2. User-facing behavior

The engine has **no screen of its own**. Its output appears on `/me/goals` (`Cél`) as the **recept card** (`GoalRecept.tsx`): a feasibility-verdict banner ("Reális" / "Reális, figyelmeztetésekkel" / "Agresszív"), per-segment recept cards (week range, label, kcal / protein g / sleep h / signed kg-per-week, HU rationale), and guard-status pills (strength e1RM trend, muscle weekly-volume floor + rate-cap, and a muted "Fehérje: Fuel-re vár" pill). When a goal has not yet been evaluated (`prescription === null`), the card shows an **"⚡ Értékeld a célt" CTA** that fires the `evaluate` action. Full UX detail and the Hungarian labels live in [`me.md`](me.md) §2 (`Recept — the G5 engine finale`).

The engine also runs **invisibly** on the recompute triggers (§3) — logging a weigh-in, activating a goal, or attaching/detaching a plan all silently refresh the active goal's prescription, so the recept the user next opens is current without an explicit re-evaluate.

## 3. Architecture & data flow

The orchestrator is **`GoalEngineService.evaluate(userId, goalId)`** (`feature/goal/engine/service/GoalEngineService.java:77`, `@Transactional`) — it owns all I/O and chains the pure services:

```
evaluate(userId, goalId)                              GoalEngineService.java:77
 ├─ goalRepository.findByIdAndCreatedByAndDeletedFalse → 404 if foreign/missing (ownership-gated)
 ├─ GuardEvaluationService.evaluate(goal, linkedMesoIds, trend)        engine/service/GuardEvaluationService.java:85
 ├─ profile = BiometricProfileRepository.findByCreatedByAndDeletedFalse  ── null? ─► GoalEvaluationService.missingProfile(guards)
 │                                                                                    (graceful note, no bootstrap, persist, return)
 ├─ TdeeBootstrapService.compute(profile, currentWeightKg)             engine/service/TdeeBootstrapService.java:71   → goal.tdeeBootstrap
 ├─ WeightTrendService.computeTrend(userId)                            biometrics/weight/service/WeightTrendService.java:75 (EWMA spine)
 ├─ GoalProjectionService.project(goal, userId, bootstrap, trend)      engine/service/GoalProjectionService.java:117  → segments
 └─ GoalEvaluationService.assemble(goal, weightKg, bodyFatPct, segments, guards)  engine/service/GoalEvaluationService.java:80
                                                                       → goal.prescription  (dirty-check flushes both jsonb cols)
```

Service responsibilities (all `@Service`, constructor-injected, stateless):

- **`WeightTrendService`** (`biometrics/weight/service/WeightTrendService.java`) — the **spine**. Collapses same-day weigh-ins to a daily mean, runs an EWMA (`α = 1 − 0.5^(1/halfLifeDays)`), and computes the OLS weekly rate (whole-window + trailing-4w) and a `dataSufficiency` grade (`none` / `provisional` / `full`). Read-only, no `@Transactional`. Reused by the projection (reconciliation) and the muscle guard (rate-cap), and exposed verbatim at `GET /api/biometrics/weight/trend`.
- **`TdeeBootstrapService`** (`engine/service/TdeeBootstrapService.java`) — the **formula TDEE**. Katch-McArdle when body-fat % is known (`BMR = 370 + 21.6·LBM`, `formula="KATCH"`), else Mifflin-St Jeor (`formula="MSJ"`); `TDEE = BMR × PAL` with PAL from `activityLevel` (default MODERATE 1.55). Pure; the caller supplies current weight, so it needs no repository. **Anti-double-count:** PAL already bakes in average activity → no per-session MET deltas here (that's the projection's job).
- **`GoalProjectionService`** (`engine/service/GoalProjectionService.java`) — the **segmented projection** (spec §4). Walks the window week-by-week in goal-week space, resolves the active load per week (meso phase class from `phaseCurve` + running on/off), collapses contiguous identical loads into `ProjectionSegment`s, and computes per segment the TDEE, daily kcal target, and projected rate for all three trajectories. **Block-boundary TDEE delta policy (§6.3):** running on/off is the *only* TDEE delta (`intervalRunKcal × sessions ÷ 7`); a meso-phase change splits a segment but is a *zero* TDEE delta (its effect is on volume, the muscle guard); volleyball is ambient and never a boundary. **Reconciliation:** once the trend is ≥ `provisional`, the observed trailing-4w rate becomes the spine, replacing the formula seed.
- **`GuardEvaluationService`** (`engine/service/GuardEvaluationService.java`) — the **soft guards** (spec §5.3, D9 — WARN, never block). Strength: reuses the `ExerciseRecordService` aggregation idiom (group sets by lift identity = `catalog_id` else `name`, Epley e1RM `weight × (30 + reps)/30`, reps ≤ 10), main lift = the identity with the most sets, `breached` when its e1RM trend % drops to `strength.e1rmBreachPct` (−5%). Muscle: per-muscle weekly hard sets from `MuscleGroupVolumeLog` across the linked mesos vs `volume.warnBelow` (6), plus a rate-cap on the trailing-4w EWMA slope vs `rate.capPctPerWeek`. **Protein leg deferred** — `proteinMonitored=false` always (Fuel intake not built).
- **`GoalEvaluationService`** (`engine/service/GoalEvaluationService.java`) — the **heuristic feasibility gate + prescription assembly** (spec §5.1/§5.4). Grades rate realism (band vs cap), guard satisfiability, and a conflict rule (aggressive rate + active running + active strength guard); folds segments + guards + a protein target (`proteinTargetGrams`, BW path vs LBM path, capped) into the `GoalPrescriptionJson`. Pure, no I/O, never throws.

`GoalEngineService` is the *only* `@Transactional` link (it writes the goal); every other service is pure/read-only so it is trivially testable in isolation.

### Recompute triggers

`evaluate` is called from **four** places (every event that moves a model input), all in the same transaction as the triggering write, all graceful on a missing profile:

| Trigger | Caller | Scope |
|---|---|---|
| **Goal activated** | `GoalService.activateGoal` (`feature/goal/service/GoalService.java:87`) | the just-activated goal (its prescription at birth) |
| **Plan attached** | `GoalPlanLinkService.attachPlan` (`:62`) | the goal whose links changed (regardless of status) |
| **Plan detached** | `GoalPlanLinkService.detachPlan` (`:74`) | same |
| **Weigh-in logged** | `WeightLogService.log` → `recomputeActiveGoal` (`feature/biometrics/weight/service/WeightLogService.java:43,48`) | the owner's single **active** goal (no-op when none) |
| **Explicit** | `GoalController.evaluateGoal` → `POST /api/goals/{id}/evaluate` (`:71`) | the addressed goal |

**Transaction note:** because each trigger's enclosing method is already `@Transactional`, `evaluate` joins the same transaction — the recompute is part of the triggering write's atomic unit (a failed evaluate would roll back the weigh-in/attach). The weigh-in path deliberately depends on **no** goal: if the owner has no active goal, `recomputeActiveGoal` returns without calling `evaluate` (a weigh-in must never require a goal).

## 4. Data model & API

**Persistence** — two jsonb columns added to `goal` + one column on `biometric_profile` by migration `backend/src/main/resources/db/changelog/1.0.0/script/202606191000_mezo-g1u_goal_prescription_and_activity_level.sql` (additive only — existing rows carry none until first evaluate):

- `goal.tdee_bootstrap jsonb` → `TdeeBootstrapJson` (`feature/goal/entity/TdeeBootstrapJson.java`: `bmr`, `tdee`, `pal`, `formula` MSJ|KATCH, `computedAt`). Field `GoalEntity.tdeeBootstrap` (`:59`, `@JdbcTypeCode(SqlTypes.JSON)`).
- `goal.prescription jsonb` → `GoalPrescriptionJson` (`feature/goal/entity/GoalPrescriptionJson.java`: `generatedAt`, `basis`, `segments[]` {fromWeek, toWeek, label, kcal, proteinG, sleepTargetH, restDays[], projectedRateKgPerWk, rationale}, `guardStatus` {strength, muscle}, `feasibility` {verdict, notes[]}). Field `GoalEntity.prescription` (`:63`).
- `biometric_profile.activity_level text` (CHECK `ck_biometric_profile_activity_level IN (SEDENTARY|LIGHT|MODERATE|VERY|EXTRA)`) → `BiometricProfileEntity.activityLevel` (`:56`, nullable). The PAL lookup input.

Both jsonb records are **plain records, no Jackson/Hibernate annotations** — the app `ObjectMapper` serializes them via `@JdbcTypeCode(SqlTypes.JSON)` (the `ProvenanceEnvelope` idiom). `GoalMapper` (`feature/goal/mapper/GoalMapper.java:39-41`) projects them to the contract DTOs (`TdeeBootstrap`/`GoalPrescription`), mapping the `String` `formula`/`verdict` to the generated enums.

**Endpoints** (contract-first — `api/feature/goal/goal.yml`, `api/feature/weight/weight.yml`, `api/feature/biometrics-profile/biometrics-profile.yml`):

| Verb | Path | Returns | Notes |
|---|---|---|---|
| POST | `/api/goals/{id}/evaluate` | `GoalResponse` (with `prescription`/`tdeeBootstrap`) | runs the engine, persists, re-fetches via `getGoal`. No-profile → **200 + graceful feasibility note** (never 4xx, so triggers don't break); foreign/missing → **404**. |
| GET | `/api/biometrics/weight/trend` | `WeightTrendResponse` {`ewmaSeries[]`, `latestTrendKg`, `weeklyRateKgPerWeek`, `weeklyRatePctPerWeek`, `last4wRateKgPerWeek`, `dataSufficiency`} | the EWMA spine, exposed for the FE. |
| PUT | `/api/biometrics/profile` | `BiometricProfileResponse` | now carries `activityLevel` (the `GoalPlanner` wizard sends it). |

`GoalResponse` additively gained `prescription` + `tdeeBootstrap` (both `nullable` — null until first evaluate). The HTTP surface and these contract shapes are documented in [`_platform-api-backend.md`](_platform-api-backend.md) §3 (the Goal/Biometrics rows) and [`me.md`](me.md) §4.

### Config — `mezo.goal.*` (the grounded constants)

**Every** engine number lives in `application.yml` under `mezo.goal:` (`:28`), bound by `GoalEngineProperties` (`feature/goal/engine/GoalEngineProperties.java`, a `@Validated @ConfigurationProperties` record). No `@Value`, no hardcoded tunable downstream — per [`docs/references/configuration_conventions.md`](../references/configuration_conventions.md). The defaults and where each is consumed:

| Property | Default | Consumed by |
|---|---|---|
| `pal.{sedentary,light,moderate,very,extra}` | 1.2 / 1.375 / **1.55** / 1.725 / 1.9 | `TdeeBootstrapService` (PAL lookup; moderate = default) |
| `kcalPerKg` | 7700 (band 6000–7700) | `GoalProjectionService` (energy balance ↔ rate) |
| `protein.gPerKgBwDefault/…/gPerKgBwCap` | 2.0 … 2.6 | `GoalEvaluationService.proteinTargetGrams` |
| `rate.{capPctPerWeek,bandLow,bandHigh}` | 1.0 / 0.5 / 1.0 | `GoalEvaluationService` (rate realism) + `GuardEvaluationService` (rate-cap) |
| `volume.{maintenanceSets,warnBelow}` | 8 / 6 | `GuardEvaluationService` (muscle guard) |
| `strength.e1rmBreachPct` | −5.0 | `GuardEvaluationService` (strength breach gate) |
| `ewma.halfLifeDays` | 10 (band 10–14) | `WeightTrendService` (α) |
| `met.{hypertrophy,intervalRun,volleyballRec,volleyballComp}Kcal` | 325 / 500 / 500 / 1150 (84 kg basis) | `GoalProjectionService` (running block-boundary delta) |
| `thermogenesisHaircutKcalPerDay` | 0 (off; band 100–200) | reserved (adaptive haircut) |
| `bootstrapUncertaintyKcal` | 300 | uncertainty band |

**Reserved / tuning surface (defined but not yet consumed):** `rate.targetPctPerWeek` (0.7), `protein.gPerKgLbmLow`, `protein.gPerKgBwFloor`/`gPerKgBwCeil`, the non-`intervalRun` MET deltas (`hypertrophy`/`volleyballRec`/`volleyballComp`Kcal — only `intervalRunKcal` is read by the running block-boundary delta), `thermogenesisHaircutKcalPerDay`, and `bootstrapUncertaintyKcal` are wired into `GoalEngineProperties` ahead of the slices that will read them; no service consumes them today.

These are the empirical-tuning surface (research §7): EWMA half-life, kcal/kg, the −5% e1RM breach, and the rate bands are all tunable from real data without a code change.

## 5. Integrations

The engine is a **consumer hub** — it reads three other domains and writes one:

- **← Biometrics/weight (the spine).** *Contract:* `WeightTrendResponse` (EWMA series + rates + sufficiency) from `WeightTrendService.computeTrend(userId)`. The projection uses it for rate reconciliation; the muscle guard uses `last4wRateKgPerWeek` for the rate-cap. The same service backs `GET /api/biometrics/weight/trend`, which the FE `useWeight` folds into `weightTrends` ([`_platform-data-layer.md`](_platform-data-layer.md) §4).
- **← Biometrics/profile.** *Contract:* `BiometricProfileEntity` (sex, heightCm, birthDate, bodyFatPct, **activityLevel**) → the TDEE bootstrap. A missing profile is the graceful path (no throw).
- **← Train (mesocycles + running blocks).** *Contract:* the goal's `GoalPlanLinkEntity` rows + the linked `MesocycleEntity.phaseCurve` (the per-week phase class) / `RunningBlockEntity.structure` (sessions-per-week) read via the Train repos (ownership-checked), and `MuscleGroupVolumeLogEntity` + `ExerciseSetEntity`/`ExerciseRepository` for the guards (the strength leg deliberately reuses the `ExerciseRecordService` Epley/identity idiom). See [`train.md`](train.md) for those aggregates.
- **→ Goal (writes).** *Contract:* `tdeeBootstrap` + `prescription` jsonb persisted onto `GoalEntity`, surfaced via `GoalResponse` → the FE `GoalRecept` card ([`me.md`](me.md) §2).

**Deferred / future bridges (spec §5.4, narrated but not wired):** `prescription.kcal/proteinG` → Fuel targets; `sleepTargetH` (seeded at 8.0) → Sleep; `restDays`/deload → Train/Today. These are emitted as fields today but consumed by no other domain yet.

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
- Per-service ITs: `feature/goal/engine/service/TdeeBootstrapServiceIT` (MSJ vs Katch branch, PAL lookup), `GoalProjectionServiceIT` (segment collapse, running boundary delta, meso-phase zero-delta, trend reconciliation), `GuardEvaluationServiceIT` (e1RM trend + breach, muscle floor, rate-cap, deferred protein), `GoalEvaluationServiceIT` (rate grading, conflict rule, protein target, missing-profile artifact).
- `feature/goal/engine/GoalEnginePropertiesIT` — the `mezo.goal.*` binding + validation.
- `feature/goal/GoalEngineRecomputeIT` — the four recompute triggers fire `evaluate` (activate / attach / detach / weigh-in) and the no-active-goal weigh-in is a no-op.
- `feature/goal/GoalContractIT` — the HTTP `POST /api/goals/{id}/evaluate` surface (200 + prescription, 200 graceful no-profile, 404 foreign).

**Frontend** — `frontend/src/features/me/components/GoalRecept.test.tsx` (verdict labels, segment metrics, guard pills incl. a breached strength guard, the null-prescription evaluate CTA) + the recept assertions in `GoalsView.test.tsx`; the trend fold in `data/weightHooks.test.tsx`. Both `pnpm test` (real) and `VITE_USE_MOCK=true pnpm test` (mock) must pass — see [`me.md`](me.md) §8.

## 9. Decisions, gotchas & deferred

**Key decisions** (spec [`2026-06-18-goal-system-design.md`](../superpowers/specs/2026-06-18-goal-system-design.md)):
- **EWMA trend is the rate spine, not a fixed projected deficit** (§4) — once data is sufficient, the observed trailing-4w slope replaces the formula seed.
- **Block-boundary TDEE deltas only; running is the one delta** (§6.3) — meso phase is a zero-TDEE segment boundary, volleyball is ambient. Prevents double-counting against the PAL baseline.
- **Soft guards (D9) + heuristic gate (D10) never block** — the verdict only colours the surface; `evaluate` never throws on a model-shape problem.
- **Graceful no-profile path** — `missingProfile` returns a real prescription with a feasibility note (Task-9 recompute triggers rely on this).

**Gotchas:**
- Age/`computedAt` use `LocalDate.now()`/`OffsetDateTime.now()` directly (no `Clock` bean — codebase convention); the services are otherwise pure.
- `pal` is stored unrounded (it's a multiplier, not kcal); only `bmr`/`tdee` are rounded.
- `proteinMonitored` is **always false** — the protein TARGET is prescribed, but Fuel intake logging doesn't exist to monitor it; a note records this and it must **not** downgrade the verdict.

**Deferred to Phase 3** (post-G5, blocked on later slices):
- **Adaptive TDEE** (back-calc from Fuel intake + EWMA trend, `prescription.basis="adaptive"`) — blocked on **Fuel Slice C** (calorie logging). The protein-guard monitoring leg lights up here too.
- **AI evaluator** (Spring AI) replacing the heuristic gate; a living-narrative recompute; a **weekly scheduled re-fit** (only event-driven recompute today).
- **Cross-domain bridges** (§5) — prescription kcal/protein → Fuel, `sleepTargetH` → Sleep, restDays/deload → Train/Today — wired as each target domain's backend lands.

## 10. Key files

**Engine (backend, `feature/goal/engine/`):**
- `GoalEngineProperties.java` — the `mezo.goal.*` config record (PAL/kcalPerKg/protein/rate/volume/strength/ewma/met).
- `service/GoalEngineService.java` — the `@Transactional` orchestrator (`evaluate`) — the only entry point.
- `service/TdeeBootstrapService.java` — formula TDEE (MSJ / Katch-McArdle × PAL).
- `service/GoalProjectionService.java` — the segmented projection (block-boundary deltas, trend reconciliation, all 3 trajectories).
- `service/GuardEvaluationService.java` — strength (e1RM) + muscle-volume + rate-cap soft guards.
- `service/GoalEvaluationService.java` — heuristic feasibility gate + prescription assembly (pure).

**Spine / inputs:**
- `backend/.../feature/biometrics/weight/service/WeightTrendService.java` — the EWMA weight-trend spine (`GET /api/biometrics/weight/trend`).
- `backend/.../feature/biometrics/weight/service/WeightLogService.java` — the weigh-in recompute trigger.
- `backend/.../feature/goal/service/{GoalService,GoalPlanLinkService}.java` — activate / attach / detach recompute triggers.
- `backend/.../feature/goal/controller/GoalController.java` — `evaluateGoal` (`POST /api/goals/{id}/evaluate`).

**Persistence / contract:**
- `backend/.../feature/goal/entity/{GoalEntity,GoalPrescriptionJson,TdeeBootstrapJson}.java` — the jsonb columns + records.
- `backend/.../feature/goal/mapper/GoalMapper.java` — jsonb → contract DTO projection.
- `backend/src/main/resources/db/changelog/1.0.0/script/202606191000_mezo-g1u_goal_prescription_and_activity_level.sql` — the migration.
- `api/feature/goal/goal.yml`, `api/feature/weight/weight.yml`, `api/feature/biometrics-profile/biometrics-profile.yml` — the contract fragments.
- `backend/src/main/resources/application.yml` — the `mezo.goal:` config block (`:28`).

**Frontend (the recept surface):**
- `frontend/src/features/me/components/GoalRecept.tsx` (+ `.test.tsx`) — the recept card + evaluate CTA.
- `frontend/src/data/goalHooks.ts` — `useGoalActions().evaluate`; `frontend/src/data/weightHooks.ts` — the real trend fold.

**Tests:** `backend/.../feature/goal/engine/**` (per-service ITs + properties IT), `feature/goal/{GoalEngineRecomputeIT,GoalContractIT}.java`.

**Related docs (link, don't duplicate):** [`me.md`](me.md) (the `Cél` recept surface + the wizard activity picker), [`_platform-api-backend.md`](_platform-api-backend.md) (the contract/HTTP surface + jsonb conventions), [`_platform-data-layer.md`](_platform-data-layer.md) (the `useGoalActions().evaluate` + `useWeight` trend wiring), [`train.md`](train.md) (the meso/running/volume aggregates the guards + projection read), spec [`2026-06-18-goal-system-design.md`](../superpowers/specs/2026-06-18-goal-system-design.md), research [`2026-06-18-goal-engine-numbers.md`](../research/queries/2026-06-18-goal-engine-numbers.md), and the house standards in [`docs/references/`](../references/).
