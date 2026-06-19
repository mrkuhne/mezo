# Goal System — G5 Engine Implementation Plan (TDEE + segmented prescription + heuristic eval)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task (per-task implementer + reviewer, ledger in `.git/sdd/progress.md`). Steps use checkbox (`- [ ]`) syntax. **This plan is intentionally structural** (like G1/G3/G4b) — each task names files, behavior, interfaces, and references; the executing session does a short **pattern-extraction (Task 0)** first to ground the concrete code 1:1.

**Goal:** Build the goal **engine**: a backend EWMA weight-trend spine, a formula-TDEE bootstrap, a deterministic segmented projection over the goal timeline, a heuristic feasibility gate, and a persisted segmented `GoalPrescription` (kcal/protein/sleep/rest + guard status) — surfaced in the Cél command-center (recept card) and making the Súly-tab/hero trend **real** (today it's a hardcoded mock).

**Architecture:** Backend-heavy. New stateless services under `feature/goal/engine/` (TDEE bootstrap, projection, evaluation, orchestration) + a `WeightTrendService` under the weight feature. All tunable constants live in a `mezo.goal.*` `@ConfigurationProperties` record (never hardcoded). Two additive jsonb columns on `goal` (`prescription`, `tdee_bootstrap`) + one `activity_level` column on `biometric_profile`. Contract-first: a goal `evaluate` endpoint + `prescription`/`tdeeBootstrap` on `GoalResponse` + `activityLevel` on the biometric contract + a weight-trend response. FE: activity-level picker in the wizard, the real recept card replacing G4b's placeholder, and the Súly trend wired to the real backend trend.

**Tech Stack:** Spring Boot 4 · Java 21 · Maven · PostgreSQL 16 + Liquibase · MapStruct + Lombok · `@JdbcTypeCode(SqlTypes.JSON)` jsonb · integration-first ITs (Testcontainers/fixed `mezo_test`) · React 19 + TanStack Query + Vitest/MSW · contract-first OpenAPI.

**Driving issue:** `mezo-g1u` (G5), child of epic `mezo-2hp`. **Spec:** `docs/superpowers/specs/2026-06-18-goal-system-design.md` §4 (engine/projection D7), §5 (eval + prescription D10–D11), §6 (grounded constants), §3.1/§3.3/§3.4 (data shapes), §9 (open questions). **Grounded numbers (authoritative for every constant):** `docs/research/queries/2026-06-18-goal-engine-numbers.md`.

**Scope decisions (locked with the user at G5-start):**
- **Trajectories: ALL THREE** (cut + bulk + maintain) — symmetric model, rate sign by trajectory, guard differences. **Per spec §9.4, the bulk recept path gets explicit validation tests** before it's trusted.
- **PAL: activity-level picker** — a new `activity_level` field on `BiometricProfile` (entity + contract + GoalPlanner Step 2), mapping to a PAL band; `mezo.goal.pal.*` holds the band values.
- **Engine depth: gate-at-birth + real backend EWMA trend.** On-demand evaluation (a `request-eval` endpoint + auto on goal activation; recompute on link attach/detach + on weight-log write). Build the backend EWMA trend (the "spine") — this also replaces the FE's hardcoded mock `weightTrends`. **NO** weekly scheduled auto-recompute (deferred to Phase 3 alongside adaptive TDEE).
- **Adaptive TDEE: DEFERRED** (Phase 3, blocked on Fuel Slice C). Build **formula-only**; reserve `prescription.basis` = `"formula"`. The **protein leg** of the muscle guard is **partial/deferred** (needs Fuel intake) — ship the volume + rate + e1RM guards now; protein target is *prescribed* (a number) but not *monitored against intake*.

## Current state (what G5 builds on — verified post-G4b surface)

- **`GoalEntity`** (`backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/GoalEntity.java`): has `trajectory` (cut/bulk/maintain), `guards` text[] (subset of strength/muscle), window `startDate`/`targetDate` (window-weeks = `ChronoUnit.WEEKS.between`), `startWeightKg`/`targetWeightKg`, `rateTargetPctPerWeek`, `identityFrame`, lifecycle `status`. **Does NOT have** `prescription`/`tdee_bootstrap`/`ambient_baseline` jsonb — G5 ADDS `prescription` + `tdee_bootstrap` (additive migration). Single-active is enforced in Java (no DB partial-unique index).
- **`BiometricProfileEntity`** (`feature/biometrics/profile/`): one row per owner (`uq_biometric_profile_created_by`); fields `sex` (M/F), `heightCm`, `birthDate`, optional `bodyFatPct`. **No activity-level** — G5 ADDS `activity_level`.
- **e1RM EXISTS — reuse, don't rebuild:** `ExerciseRecordService` already computes Epley `weight×(30+reps)/30` grouped by lift identity (`catalogId ?: name`) over `ExerciseSetEntity{weightKg, reps, doneAt, exerciseId}`. Caveat: all-time aggregate, **no date-windowed finder** — G5 adds a windowed read (or computes the trend from the existing rows).
- **Volume EXISTS — reuse:** `MuscleGroupVolumeLogEntity.currentSets` per `muscle` (+ `mev/mav/mrv` landmarks) per meso, via `MuscleGroupVolumeLogRepository.findByCreatedByAndMesocycleIdInOrderByMuscleAsc`. Weekly modulation = `MesocycleEntity.phaseCurve` (text[], one MEV→MRV→deload label per week).
- **Linked-plan read EXISTS — extend:** `GoalPlanLinkService.resolvePlan(userId, planType, planId)` already fetches `MesocycleEntity`/`RunningBlockEntity` (ownership-checked, soft-delete-safe) for title/status/dates/weeks. `GoalTimelineService.getTimeline` walks `GoalPlanLinkRepository.findByGoalId...OrderByStartWeekAsc` → `(planType, planId, startWeek, endWeek)` in goal-week space. The engine mirrors this walk and extends `resolvePlan` to also read `phaseCurve` (meso) / `structure` (running).
- **Weight trend is a MOCK:** `frontend/src/data/goals.ts:55` `weightTrends` is a hardcoded static literal returned by `useWeight()` in both modes ("stays static until the G5 engine computes real trends"). Backend has the raw data only: `WeightLogRepository.findAllOwned(createdBy)` → `{date, weightKg}` date-ascending. G5 BUILDS the backend EWMA trend.
- **Config idiom:** `@Validated @ConfigurationProperties(prefix="…")` records auto-bound via `@ConfigurationPropertiesScan` on `MezoApplication` (real examples: `techcore/security/CorsProperties.java`, `feature/auth/OwnerProperties.java`); `mezo:` block in `backend/src/main/resources/application.yml`. **`@Value` forbidden** (`docs/references/configuration_conventions.md`).
- **jsonb idiom:** `@JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb")` onto a typed Java `record` — copy `RunningBlockEntity.structure` + `feature/train/entity/ProvenanceEnvelope.java` (nested sub-records). DDL column type plain `JSONB`.
- **Liquibase:** changesets in `db/changelog/1.0.0/`, registered by appending a `changeSet` include to `db/changelog/1.0.0/1.0.0_master.yml`. Latest: `202606181600_mezo-3sc_create_goal_plan_link.sql`; goal table `202606181200_mezo-2hp_create_goal.sql`. Naming `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql`; never modify released changesets.
- **FE recept placeholder to replace:** `frontend/src/features/me/components/GoalTimeline.tsx` (the static "G5 · hamarosan / a motor a G5-ben érkezik" card, ignores props). `useGoal()` (`frontend/src/data/goalHooks.ts`) exposes the raw `GoalResponse` as `goalResponse`; `prescription`/`guardStatus`/`feasibility` will surface there. `GoalResponse` contract type in `frontend/src/lib/api.gen.ts`.
- **Biometric capture (G4a):** `GoalPlanner.tsx` Step 2 captures sex/heightCm/birthDate/optional bodyFatPct → `BiometricProfileUpsertRequest`. **No activity-level** — G5 adds it here.

## Global Constraints

- **Grounded constants are authoritative** — every number comes from `docs/research/queries/2026-06-18-goal-engine-numbers.md` (and spec §6). Each ships as a `mezo.goal.*` property with the research **default**; ranges are the tuning band (comments). The load-bearing values: BMR MSJ `men: 10·kg+6.25·cm−5·yr+5 / women: −161`; Katch-McArdle `370+21.6·LBM`, `LBM=kg·(1−bf%/100)` (prefer when bf% known — MSJ underestimates trained); PAL bands `sedentary 1.2 / light 1.375 / moderate 1.55 (DEFAULT) / very 1.725 / extra 1.9`; `kcalPerKg 7700` (band 6000–7700, fat-loss asymptote); protein `2.0 g/kg BW` (floor 1.6, ceil 2.2; LBM path 2.3–3.1 g/kg LBM, take higher, cap 2.6 g/kg BW); rate cap target `0.7 %BW/wk` (band 0.5–1.0, warn >1.0, bias lower as leaner); maintenance volume `8 sets/muscle/wk` (band 6–10, warn <6); e1RM Epley `weight×(1+reps/30)` (discard reps>10), breach sustained `−5%` over 1–2 wk; EWMA `half-life 10 d` (band 10–14, `α≈1−0.5^(1/halfLife)`); MET session deltas `hypertrophy 325 / interval-run 500 / volleyball-rec 500 / volleyball-comp 1150` kcal; optional thermogenesis haircut `100–200 kcal/d`; treat bootstrap TDEE as `±300 kcal` seed.
- **Anti-double-count (spec §6.3, research §3):** PAL already bakes in average training energy. Do NOT add per-session MET kcal to a PAL-derived TDEE. MET deltas are used ONLY at block-boundary transitions (a running block turning on/off) and for the "why did my target move" explanation — never as a fresh addition to the steady-state bootstrap.
- **Spine = the scale:** the real rate is the slope of the **EWMA weight trend**, never a fixed deficit projected forward as truth. The constant `7700` only seeds week 1; the trend silently re-fits effective kcal/kg.
- **Guards are SOFT (D9):** the eval gate NEVER blocks. Verdict ∈ `feasible` / `feasible-with-warnings` / `aggressive`. Guards warn + shape the recept.
- **Trajectory symmetry:** the same machinery serves cut/bulk/maintain — rate sign flips (`cut`<0, `bulk`>0, `maintain`≈0), guard emphasis differs (cut: rate-cap + lean retention; bulk: rate-cap on fat-gain + volume; maintain: hold). **Bulk path gets explicit eval/prescription validation tests (§9.4).**
- **House standards (MANDATORY, `docs/references/`):** package layout `feature/goal/engine/{service,dto}` + reuse `techcore/` (`java_package_structure.md`); DI constructor + `@RequiredArgsConstructor`, `@Transactional` only on write methods (`spring_patterns.md`); errors via `SystemMessage` + `SystemRuntimeErrorException` (`error_handling.md`); migrations versioned + immutable + explicit constraint names, seed data in Java `@Profile` not SQL (`liquibase_conventions.md`); integration-first ITs extend `AbstractIntegrationTest`/`ApiIntegrationTest`, data via `*Populator` factories, new table → `ResetDatabase` TRUNCATE list, AssertJ only, no mocks/H2 (`testing_standards.md`, `integration_test_framework.md`); tunables in `mezo.*` properties, never `@Value` (`configuration_conventions.md`); contract-first, never hand-write boundary DTOs (`api_contract_conventions.md`). UUID PKs, `created_by` server-side, soft-delete.
- **Deploy gotcha (CRITICAL):** when merging to main, the **merge commit MUST be the push HEAD with NO `[skip ci]`** (GitHub skips the whole run if the head commit has `[skip ci]`). Order: merge → push (deploy) → THEN bd-close `[skip ci]` commits.
- **Gates (each task + final):** backend `cd backend && ./mvnw clean test` (always `clean`; Postgres :15432 via `cd backend && docker compose up -d`); contract changed → `cd api/generate && npm run generate:api` + `cd frontend && pnpm generate:api`; frontend `pnpm test` (real) + `VITE_USE_MOCK=true pnpm test` (mock) + `pnpm build`; `node scripts/lint-docs.mjs` PASS.
- **Scope boundary:** NO adaptive TDEE (Phase 3), NO weekly scheduled recompute, NO AI evaluator, NO Fuel/Sleep/Today cross-domain WIRING (the prescription is computed + surfaced in the Cél tab only; bridges light up when those backends land — spec §5.4). The protein guard is *prescribed but not monitored*.

**Natural checkpoint:** backend engine is complete + HTTP-verifiable at **Task 10**; Tasks 11–13 are FE surfacing + docs. Execution may pause for review at the Task 10 boundary (a de-facto G5a/G5b line).

---

### Task 0: Pattern-extraction (read-only, ground the concrete code)

Run a short pattern-extraction (parallel read-only agents or inline reads) capturing `file:line` + excerpts the later tasks need. Findings → a file the tasks reference (no commit):
1. **Config-properties idiom** — `CorsProperties`/`OwnerProperties` (full): the `@Validated @ConfigurationProperties` record shape, nested records, the `application.yml` `mezo:` block, `@ConfigurationPropertiesScan` wiring. (Task 1)
2. **jsonb typed-record idiom** — `RunningBlockEntity.structure` field mapping + `ProvenanceEnvelope` (a nested-record jsonb type) + how MapStruct/Jackson handle it. (Tasks 3–4, 9)
3. **`WeightLogEntity`/`WeightLogRepository.findAllOwned`** + the existing weight contract (`weightApi`) + how the FE `useWeight()` returns `weightLog`/`weightTrends` (the mock to replace). (Tasks 5, 11)
4. **`ExerciseRecordService`** e1RM compute (the Epley method + identity grouping + the finders it uses) + `ExerciseSetEntity`/`ExerciseEntity` (muscle field). (Task 8)
5. **`MuscleGroupVolumeLogEntity`/repo** + `MesocycleEntity.phaseCurve` + `RunningBlockEntity.structure` (sessions/weeks) — the projection + volume-guard inputs. (Tasks 7–8)
6. **`GoalPlanLinkService.resolvePlan` + `GoalTimelineService.getTimeline`** — the linked-plan read + the goal-week-space walk to mirror. (Task 7)
7. **`GoalController` + `goal.yml` contract** + the contract-first scaffold-stub pattern G3 used (`UnsupportedOperationException` stubs so the controller compiles between the contract task and the impl task). (Tasks 2, 10)
8. **`GoalPlanner.tsx` Step 2 + `BiometricProfileUpsertRequest`** + the `GoalTimeline.tsx` recept placeholder + `goalHooks.ts` `useGoal` return + `GoalResponse` in `api.gen.ts`. (Tasks 11–12)
9. **`AbstractIntegrationTest`/`ApiIntegrationTest`** + an existing `*Populator` (e.g. `RunningPopulator`/the goal populator) + `ResetDatabase` TRUNCATE list. (every backend task)

---

### Task 1: `mezo.goal.*` engine configuration properties

**Files:** Create `backend/.../feature/goal/engine/GoalEngineProperties.java` (`@Validated @ConfigurationProperties(prefix="mezo.goal")` record, per `CorsProperties` idiom). Modify `backend/src/main/resources/application.yml` (add the `mezo.goal:` block). Test: `GoalEnginePropertiesIT` (or a `@SpringBootTest` slice asserting binding + defaults).

**Interfaces — Produces:** `GoalEngineProperties` with nested records/maps for ALL constants from the Global Constraints: `pal` (Map<ActivityLevel,Double> or a record: sedentary/light/moderate/very/extra + `default`), `kcalPerKg` (7700), `protein` (gPerKgBwDefault 2.0, gPerKgBwFloor 1.6, gPerKgBwCeil 2.2, gPerKgLbmLow 2.3, gPerKgLbmHigh 3.1, gPerKgBwCap 2.6), `rate` (capPctPerWeek 1.0, targetPctPerWeek 0.7, bandLow 0.5, bandHigh 1.0), `volume` (maintenanceSets 8, warnBelow 6), `strength` (e1rmBreachPct -5.0), `ewma` (halfLifeDays 10), `met` (hypertrophyKcal 325, intervalRunKcal 500, volleyballRecKcal 500, volleyballCompKcal 1150), `thermogenesisHaircutKcalPerDay` (0 default; 100–200 optional band noted), `bootstrapUncertaintyKcal` (300). Each field documented with its research range as a comment.

- Bind under `mezo.goal:` in `application.yml` with the defaults; `@Validated` with `@Min/@Max`/`@NotNull` where sensible.
- Test: load context, assert `props.kcalPerKg()==7700`, `props.pal().moderate()==1.55`, `props.protein().gPerKgBwDefault()==2.0`, `props.rate().capPctPerWeek()==1.0`, `props.volume().maintenanceSets()==8`, `props.strength().e1rmBreachPct()==-5.0`, `props.ewma().halfLifeDays()==10`.
- `cd backend && ./mvnw clean test -Dtest=GoalEnginePropertiesIT` PASS. Commit `feat(goal): mezo.goal.* engine tunables (@ConfigurationProperties) (mezo-g1u)`.

---

### Task 2: Contract — activity-level, prescription/tdeeBootstrap, evaluate endpoint, weight-trend

**Files:** `api/feature/biometrics/*.yml` (add `activityLevel`), `api/feature/goal/goal.yml` (add `prescription`+`tdeeBootstrap`+`feasibility`+`guardStatus` schemas on/with `GoalResponse`; add `POST /api/goals/{id}/evaluate`), `api/feature/weight/*.yml` (add a `WeightTrendResponse` + `GET /api/weight/trend`). Merge: `cd api/generate && npm run generate:api` → `api/openapi.yml`; `cd frontend && pnpm generate:api` → `src/lib/api.gen.ts`; backend types regenerate in `./mvnw`.

**Interfaces — Produces (contract types, generated):**
- `BiometricProfileUpsertRequest`/`...Response` gain `activityLevel: enum [SEDENTARY, LIGHT, MODERATE, VERY, EXTRA]` (nullable on response; defaulted MODERATE if absent server-side).
- `GoalResponse` gains `tdeeBootstrap` (object: `bmr, tdee, pal, basis, computedAt, formula:"MSJ"|"KATCH"`) + `prescription` (`GoalPrescription`: `generatedAt, basis:"formula", segments[]{fromWeek,toWeek,label,kcal,proteinG,sleepTargetH,restDays[],projectedRateKgPerWk,rationale}, guardStatus{strength{…},muscle{…}}, feasibility{verdict:"feasible"|"feasible-with-warnings"|"aggressive", notes[]}`) — all nullable until evaluated.
- `POST /api/goals/{id}/evaluate` → `GoalResponse` (runs the engine, persists, returns the goal incl. prescription).
- `GET /api/weight/trend` → `WeightTrendResponse{ ewmaSeries[]{date, trendKg}, latestTrendKg, weeklyRateKgPerWeek, weeklyRatePctPerWeek, last4wRateKgPerWeek, dataSufficiency:"none"|"provisional"|"full" }`.

**CONTRACT-FIRST GOTCHA (G3 precedent):** adding methods to the generated `GoalApi`/`WeightApi`/biometric interfaces breaks the existing controllers' compile until implemented. Mitigate exactly as G3 did: in this task, add **scaffold stubs** (`throw new UnsupportedOperationException()`) to the affected controllers so the project compiles + boots, with a `// TODO Task N` marker; the impl task replaces them.
- Verify: `GoalContractIT`/`WeightContractIT` (or a boot smoke IT) confirm the app compiles + migration-less boot is green. `cd backend && ./mvnw clean test -Dtest=*ContractIT` PASS. Commit `feat(goal): G5 contract — activity-level + prescription + evaluate + weight-trend (+scaffold stubs) (mezo-g1u)`.

---

### Task 3: Liquibase migration + entity fields (goal jsonb + biometric activity-level)

**Files:** Create `backend/.../db/changelog/1.0.0/{YYYYMMDDHHMM}_mezo-g1u_goal_prescription_and_activity_level.sql`; register in `1.0.0_master.yml`. Modify `GoalEntity.java` (+`prescription`, +`tdeeBootstrap` jsonb fields), `BiometricProfileEntity.java` (+`activityLevel` text/enum). Create typed jsonb records `feature/goal/entity/GoalPrescriptionJson.java` + `feature/goal/entity/TdeeBootstrapJson.java` (nested records mirroring §3.3 + the contract). Tests: `GoalServiceIT`/`BiometricProfileServiceIT` round-trips (persist + read the jsonb / the enum); a migration boot IT.

**Interfaces — Consumes:** the contract shapes (Task 2). **Produces:** `GoalEntity.getPrescription()/getTdeeBootstrap()` (typed records), `BiometricProfileEntity.getActivityLevel()`.

- Migration: `ALTER TABLE goal ADD COLUMN prescription JSONB`, `ADD COLUMN tdee_bootstrap JSONB` (both nullable). `ALTER TABLE biometric_profile ADD COLUMN activity_level TEXT` (nullable; CHECK in `(SEDENTARY,LIGHT,MODERATE,VERY,EXTRA)`, explicit constraint name `ck_biometric_profile_activity_level`). Never modify released changesets.
- Entities: `@JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb")` onto the typed records (copy `RunningBlockEntity.structure`). `activityLevel` as a String/enum mapped field. Update the MapStruct mappers (`GoalMapper`, biometric mapper) to map the new fields to/from the contract DTOs.
- Tests: persist a goal with a `GoalPrescriptionJson` + read it back equal (jsonb round-trip); persist a biometric profile with `activityLevel=MODERATE` and read it back; assert the migration boots (Testcontainers/fixed DB). `cd backend && ./mvnw clean test -Dtest=GoalServiceIT,BiometricProfileServiceIT,GoalMapperTest` (or the relevant set) PASS. Commit `feat(goal): migration + entities for prescription/tdee_bootstrap jsonb + biometric activity_level (mezo-g1u)`.

---

### Task 4: `WeightTrendService` — the EWMA spine

**Files:** Create `backend/.../feature/weight/service/WeightTrendService.java` (stateless) + a `WeightTrend` DTO (or reuse the generated `WeightTrendResponse` model). Test: `WeightTrendServiceIT` with seeded `weight_log` rows (a `WeightLogPopulator`).

**Interfaces — Consumes:** `WeightLogRepository.findAllOwned(createdBy)` → `{date, weightKg}` ascending; `GoalEngineProperties.ewma().halfLifeDays()`. **Produces:** `WeightTrendService.computeTrend(userId) → WeightTrend{ ewmaSeries, latestTrendKg, weeklyRateKgPerWeek, weeklyRatePctPerWeek, last4wRateKgPerWeek, dataSufficiency }`.

- EWMA over daily weigh-ins: `α = 1 − 0.5^(1/halfLifeDays)` (default half-life 10 → α≈0.067). Smooth the series in date order; the **trend slope** = linear-fit (or first/last EWMA over days) of the EWMA series, expressed as kg/week and %BW/week (vs latest trend weight). `dataSufficiency`: `<14 d or <4 weigh-ins/wk → provisional`; `≥21–28 d → full`; none if empty.
- Pure deterministic compute, config-driven (no hardcoded half-life). Handle <2 points (rate 0, sufficiency none).
- Tests (the spine is load-bearing — test it hard): seed a known descending series, assert the EWMA slope matches a hand-computed expected weeklyRate within tolerance; assert smoothing kills a single-day spike (raw vs EWMA); assert `dataSufficiency` thresholds; empty/sparse → none/provisional. `cd backend && ./mvnw clean test -Dtest=WeightTrendServiceIT` PASS. Commit `feat(goal): WeightTrendService EWMA spine (mezo-g1u)`.

---

### Task 5: `TdeeBootstrapService` — formula TDEE

**Files:** Create `backend/.../feature/goal/engine/service/TdeeBootstrapService.java`. Test: `TdeeBootstrapServiceIT`.

**Interfaces — Consumes:** `BiometricProfileEntity` (sex/heightCm/birthDate→age/bodyFatPct/activityLevel), current weight (latest `weight_log` via the weight repo), `GoalEngineProperties.pal()`. **Produces:** `TdeeBootstrapService.compute(profile, currentWeightKg) → TdeeBootstrapJson{ bmr, tdee, pal, formula:"MSJ"|"KATCH", inputsSnapshot, computedAt }`.

- BMR: **Katch-McArdle when `bodyFatPct` present** (`LBM=kg·(1−bf/100)`, `BMR=370+21.6·LBM`), else **Mifflin-St Jeor** (`men: 10·kg+6.25·cm−5·age+5`; `women: −161`). Age from `birthDate`.
- PAL from `activityLevel` → `props.pal()` band (default MODERATE 1.55 if null). `TDEE = BMR × PAL`. **Do NOT add MET deltas here** (anti-double-count).
- Tests: the spec's worked example (84 kg, 180 cm, 35 yr) → MSJ BMR `1795`, ×1.55 ≈ `2782`; with 15% bf → Katch-McArdle BMR `≈1912`, ×1.55 ≈ `2964`; women MSJ constant `−161`; null activityLevel → MODERATE. `cd backend && ./mvnw clean test -Dtest=TdeeBootstrapServiceIT` PASS. Commit `feat(goal): formula-TDEE bootstrap (MSJ + Katch-McArdle × PAL) (mezo-g1u)`.

---

### Task 6: `GoalProjectionService` — segmented projection

**Files:** Create `backend/.../feature/goal/engine/service/GoalProjectionService.java` + segment DTOs. Test: `GoalProjectionServiceIT` (seeded goal + meso/running links via populators).

**Interfaces — Consumes:** the goal (trajectory, window, rateTargetPctPerWeek, startWeightKg), its plan-links + resolved plans (extend `GoalPlanLinkService.resolvePlan` to expose `phaseCurve` for mesos and `structure`/sessions for running), `TdeeBootstrapJson` (Task 5), `WeightTrend` (Task 4), `GoalEngineProperties` (kcalPerKg, met deltas). **Produces:** `GoalProjectionService.project(goal, links, bootstrap, trend) → List<ProjectionSegment>{ fromWeek, toWeek, label, tdeeEstimate, targetKcal, projectedRateKgPerWk, activeSystems[], rationale }`.

- Walk the goal window week-by-week in goal-week space (mirror `GoalTimelineService.getTimeline`). At each week determine the active load set (which meso phase via `phaseCurve[weekInMeso]`, whether a running block is active, volleyball = ambient constant → excluded from deltas). Each **contiguous run of identical active-load** = one segment.
- Per segment: `tdeeEstimate` starts from bootstrap TDEE; apply **MET deltas ONLY as block-boundary transitions** relative to the bootstrap's assumed activity (e.g. a running block present adds its weekly kcal delta as a feed-forward step; absent removes it) — never double-count the PAL baseline. `targetKcal` = `tdeeEstimate ± weeklyDeficitOrSurplus` derived from `rateTargetPctPerWeek × currentWeight × kcalPerKg / 7` (sign by trajectory: cut −, bulk +, maintain 0). `projectedRateKgPerWk` from the target vs tdee using `kcalPerKg`, **reconciled against the EWMA trend rate when sufficiency≥provisional** (the spine corrects the constant).
- All three trajectories: **maintain** → rate≈0, target≈tdee (segments still vary by activity deltas); **bulk** → surplus, positive rate; **cut** → deficit, negative rate.
- Tests: a cut goal with a meso (W1–8) + a running block (W1–4) → ≥2 segments (W1–4 run-active higher TDEE, W5–8 run-off lower TDEE), correct kcal step at the boundary, correct sign; a maintain goal → ~flat target; a **bulk** goal → positive rate + surplus (validate the numbers per §9.4); ambient volleyball does NOT create a segment boundary. `cd backend && ./mvnw clean test -Dtest=GoalProjectionServiceIT` PASS. Commit `feat(goal): segmented projection (block-boundary TDEE deltas, trend-reconciled, all trajectories) (mezo-g1u)`.

---

### Task 7: Guard evaluation — strength (e1RM) + muscle-volume

**Files:** Create `backend/.../feature/goal/engine/service/GuardEvaluationService.java`. Test: `GuardEvaluationServiceIT`.

**Interfaces — Consumes:** `goal.guards` (which guards active), `ExerciseRecordService` (reuse the existing e1RM compute — add a windowed read if needed for the trend), `MuscleGroupVolumeLogRepository` (per-muscle `currentSets` vs maintenance), `GoalEngineProperties` (strength.e1rmBreachPct, volume.maintenanceSets/warnBelow, rate.capPctPerWeek), the `WeightTrend` (for rate-cap). **Produces:** `GuardEvaluationService.evaluate(goal, links, trend) → GuardStatus{ strength{active, e1rmTrendPct, breached, notes}, muscle{active, minWeeklySetsPerMuscle, belowMaintenanceMuscles[], rateWithinCap, proteinMonitored:false, notes} }`.

- **Strength guard** (if `strength` in guards): e1RM trend on main lifts via `ExerciseRecordService` (Epley, reps>10 discarded); breach = sustained `≤ e1rmBreachPct` (−5%). Reuse the existing service; add a date-windowed e1RM finder only if the all-time aggregate is insufficient for a trend.
- **Muscle guard** (if `muscle` in guards): per-muscle weekly hard sets (from `MuscleGroupVolumeLog` across the linked mesos) vs `maintenanceSets`/`warnBelow`; rate ≤ `rate.capPctPerWeek` (from the trend). **Protein leg: `proteinMonitored=false`** (Fuel not built) — prescribe the target (Task 8) but do not monitor; note this explicitly in `notes`.
- Tests: a meso below maintenance volume → `belowMaintenanceMuscles` populated + warn; an e1RM series with a −6% main-lift trend → `breached=true`, a −3% series → not breached (noise band); rate over cap (from a seeded steep trend) → `rateWithinCap=false`; a goal without a given guard → that guard `active=false`. `cd backend && ./mvnw clean test -Dtest=GuardEvaluationServiceIT` PASS. Commit `feat(goal): guard evaluation — e1RM strength + maintenance-volume muscle (protein deferred) (mezo-g1u)`.

---

### Task 8: `GoalEvaluationService` — heuristic feasibility gate + prescription assembly

**Files:** Create `backend/.../feature/goal/engine/service/GoalEvaluationService.java` (the gate + recept assembly) + `GoalEngineService.java` (the orchestrator façade). Test: `GoalEvaluationServiceIT`.

**Interfaces — Consumes:** Tasks 4–7 outputs + `GoalEngineProperties`. **Produces:** `GoalEngineService.evaluate(goalId) → GoalPrescriptionJson` (the full §3.3 artifact) + persists it to `goal.prescription` (and `goal.tdeeBootstrap`).

- **Feasibility checks (§5.1, deterministic):** (1) **rate realism** — is `rateTargetPctPerWeek` within the safe band for the window + trajectory + bf% (cut: ≤ cap, bias lower as leaner; bulk: fat-gain cap; maintain: ≈0)? (2) **guard satisfiability** — with `muscle` guard, is the prescribed protein reachable (target only) and is volume ≥ maintenance across the timeline (from Task 7)? (3) **conflict detection** — aggressive rate + heavy running block + `strength` guard → flag likely strength breach; suggest easing the deficit / shifting the run block. Verdict ∈ `feasible`/`feasible-with-warnings`/`aggressive`. **Never blocks.**
- **Prescription assembly:** per projection segment (Task 6) set `kcal` (segment targetKcal), `proteinG` (max of `2.0 g/kg BW` and the LBM path when bf% known, cap 2.6 g/kg BW — from props), `sleepTargetH` (a config/default, e.g. 8h — note: Sleep backend bridge is future), `restDays` (from meso deload weeks / rest-day placement), `projectedRateKgPerWk`, `rationale` (human string, HU). `guardStatus` from Task 7. `feasibility` from the gate. `basis="formula"`, `generatedAt`.
- Tests: a realistic cut → `feasible` + segmented recept with descending kcal as TDEE falls; an aggressive cut (rate 1.5%/wk) → `aggressive` + a note; a cut + heavy run + strength guard → conflict note; **a bulk goal → a coherent surplus recept (validate kcal/protein/rate numbers, §9.4)**; a maintain goal → ~maintenance kcal. Assert the artifact persists to `goal.prescription` and reads back. `cd backend && ./mvnw clean test -Dtest=GoalEvaluationServiceIT` PASS. Commit `feat(goal): heuristic eval gate + segmented prescription assembly (all trajectories) (mezo-g1u)`.

---

### Task 9: Recompute triggers + lifecycle wiring

**Files:** Modify `GoalService` (recompute on activate + on link attach/detach), `WeightLogService`/the weight write path (recompute the active goal's prescription on a weight-log write), `GoalPlanLinkService`. Test: `GoalEngineRecomputeIT`.

**Interfaces — Consumes:** `GoalEngineService.evaluate` (Task 8). **Produces:** prescription kept fresh on the relevant writes (no scheduled job).

- On `GoalService.activate(goalId)` → call `evaluate` (gate at birth). On `attachPlan`/`detachPlan` (`GoalPlanLinkService`) for the active goal → recompute. On a weight-log write for the owner with an active goal → recompute (the spine moved). Guard against recompute when there's no active goal / no biometric profile (skip gracefully, leave prescription null + a note).
- Keep recompute on the write path transactional + cheap; if a biometric profile is missing, the evaluate returns a `feasibility` note "biometrics required" rather than throwing.
- Tests: activating a goal populates `prescription`; attaching a meso changes the segments; a new weight-log shifts the projected rate; no-profile → graceful null + note. `cd backend && ./mvnw clean test -Dtest=GoalEngineRecomputeIT` PASS. Commit `feat(goal): recompute prescription on activate/attach/detach/weight-log (mezo-g1u)`.

---

### Task 10: Controller + contract implementation (replace scaffold stubs)

**Files:** Modify `GoalController` (implement `POST /api/goals/{id}/evaluate`; `prescription`/`tdeeBootstrap` flow through `GoalResponse` via the mapper), `WeightController` (implement `GET /api/weight/trend` → `WeightTrendService`), the biometric controller (accept/return `activityLevel`). Replace the Task-2 scaffold stubs. Test: `GoalContractIT`, `WeightTrendContractIT` (extend `ApiIntegrationTest`).

**Interfaces — Consumes:** all engine services + the contract. **Produces:** the live HTTP surface.

- Wire the generated `<Tag>Api` methods to the services; map entities→DTOs via MapStruct (incl. the jsonb records → contract objects). Ownership/auth via `created_by` (server-side principal). Errors via `SystemMessage` (e.g. evaluate with no biometric profile → a 4xx field/`SystemMessage`, or a 200 with a feasibility note — pick per the "graceful" decision in Task 9 and assert it).
- Tests (HTTP round-trips, `ownerAuthHeaders()`): `POST /evaluate` returns a `GoalResponse` with a populated `prescription` (feasibility + segments); `GET /api/weight/trend` returns the EWMA series + rate; biometric upsert persists `activityLevel`. `cd backend && ./mvnw clean test` (full suite) PASS. Commit `feat(goal): wire evaluate + weight-trend + activity-level endpoints (mezo-g1u)`.

---

### Task 11: FE — activity-level in the wizard + real Súly/hero trend

**Files:** `frontend/src/features/me/GoalPlanner.tsx` (Step 2: add an activity-level select), the biometric request typing; `frontend/src/data/weightHooks.ts`/`goals.ts` (replace the hardcoded mock `weightTrends` — `useWeight()` consumes `GET /api/weight/trend` in real mode; mock keeps a static trend); any consumer of `weightTrends` (Súly tab `WeightView`, the goal hero "Tempó" stat). Tests: both modes.

**Interfaces — Consumes:** `WeightTrendResponse` + the biometric `activityLevel` (generated types). **Produces:** a real trend in real mode; activity-level captured at goal creation.

- Step 2 gains an activity-level picker (5 options → enum), feeding `BiometricProfileUpsertRequest.activityLevel`. Default MODERATE.
- `useWeight()` real mode fetches `/api/weight/trend` and returns `weeklyRate`/trend from the backend (the hero "Tempó" kg/hét + the Súly trend cells become REAL); mock mode keeps the static `weightTrends` shape (so the FE renders offline). Keep the hook signature stable (the views consume the same field names).
- Tests: Step 2 renders + sends `activityLevel`; real-mode `useWeight` surfaces the fetched trend (MSW); mock-mode unchanged; `WeightView`/hero render with the new source. Both modes + build green. Commit `feat(goal): activity-level wizard step + real backend weight trend (mezo-g1u)`.

---

### Task 12: FE — segmented recept card + guard status (replace the placeholder)

**Files:** Replace the recept placeholder in `frontend/src/features/me/components/GoalTimeline.tsx` (or a new `GoalRecept.tsx` rendered in `GoalsView`) with the real card; `frontend/src/data/goalHooks.ts` (surface `prescription`/`guardStatus`/`feasibility` from `goalResponse`); `frontend/src/data/goals.ts` (add a mock `prescription` to the mock goal). An "Értékelés"/evaluate affordance if the goal has no prescription yet (calls the evaluate endpoint via a `useGoalActions` addition / a mutation). Tests: both modes.

**Interfaces — Consumes:** `GoalResponse.prescription` + `feasibility` + `guardStatus` (generated). **Produces:** the visible recept finale of the command-center.

- Render per-segment recept (kcal/protein/sleep/rest + `projectedRateKgPerWk` + rationale), the feasibility verdict (feasible/with-warnings/aggressive — colored), and guard-status pills (strength e1RM trend, muscle volume/rate; protein shown as "Fuel-re vár"). HU labels; the inline-style + token idiom; `var(--warning)` for warnings, `var(--error)` for breaches.
- Mock mode: a static `prescription` in `goals.ts` so the card renders offline. If `prescription` is null (real, not yet evaluated) → an "Értékeld a célt" CTA that calls evaluate.
- Tests: card renders segments + verdict + guard pills from a mock prescription; null-prescription shows the evaluate CTA + clicking it calls the evaluate endpoint; both modes + build green. Commit `feat(goal): segmented recept card + guard status (replaces G5 placeholder) (mezo-g1u)`.

---

### Task 13: Full gates + docs + ship

- Backend `cd backend && ./mvnw clean test` SUCCESS (full suite). Contract regen clean (`api/generate` + `frontend pnpm generate:api` produce no diff beyond intended). Frontend `pnpm test` both modes + `pnpm build`. `node scripts/lint-docs.mjs` PASS.
- **Docs:** update `docs/features/me.md` (the Cél command-center now has a real recept + guard status; the Súly trend is real), `_platform-api-backend.md` (the engine services + evaluate/weight-trend endpoints + `mezo.goal.*` config), `_platform-data-layer.md` (the new useWeight trend source + useGoal prescription surface). Consider a dedicated `docs/features/goal-engine.md` (the 10-section feature doc for the engine: model, services, constants→config, projection, guards, prescription, file map). `file:line` pointers, no pasted code. Clear any stale flags honestly.
- Then the **final whole-branch review (opus)** + **merge to main (`--no-ff`, merge commit = push HEAD, NO `[skip ci]`) + deploy** + close `mezo-g1u`. File follow-ups for any deferred Minors. Commit `docs(goal): G5 engine feature + platform docs (mezo-g1u)`.

---

## Post-G5

- **Phase 3 — adaptive TDEE** (back-calc from Fuel intake + EWMA trend, formula→adaptive blend; `prescription.basis="adaptive"`) — **blocked on Fuel Slice C** (calorie logging). The protein guard's monitoring leg lights up here too.
- **Phase 3 — AI evaluator** (Spring AI) replacing the heuristic gate; living narrative recompute; weekly scheduled re-fit.
- **Cross-domain bridges** (spec §5.4): prescription kcal/protein → Fuel targets, sleepTargetH → Sleep, restDays/deload → Train/Today — wire as each target domain's backend lands.
- **Tuning:** the top empirical targets (research §7) — EWMA span + blend ramp, effective kcal/kg (trend re-fit), the −5% e1RM breach — are all `mezo.goal.*` properties; tune from real data.
