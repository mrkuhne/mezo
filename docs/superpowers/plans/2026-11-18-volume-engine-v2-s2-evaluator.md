# Volume engine v2 — S2: bands and the evaluator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One server-side evaluator tells the block builder how a plan sits against each muscle's band (with
sport-lowered leg bands and the deficit pace), proposes cap-respecting fixes, estimates each day's minutes, and
projects the block week by week — and the volume arc's planned line comes from that same projection.

**Architecture:** Two pure units decide — `VolumePath` (week-by-week projection: deload halves, the week after
restores, otherwise the tier step, deficit pace, band top and caps) and `PlanEvaluator` (fit / diff / spread /
proposal per group, minutes and cap warnings per day, the path). A thin `MesoPlanEvaluateService` gathers the
per-user facts (deficit through `EnergyBalancePort`, sport days from `sport_schedule_slot`) and maps the contract.
`VolumeArcService` stops computing its own line: past weeks come from the proposal history, the current and future
weeks from `VolumePath`. `sportGroups` is persisted on template and run and moves the band everywhere the band is
computed. The S1 leftovers (`PriorityTier.ceiling/weekOneStart`, `mezo.volume.step`, `baselinesOf`) go.

**Tech Stack:** Java 21, Spring Boot, JPA/Hibernate, Liquibase (`1.1.0/`), PostgreSQL, OpenAPI contract-first,
JUnit 5 + Testcontainers.

**Spec:** `docs/superpowers/specs/2026-11-17-train-volume-engine-v2-design.md` §6.2 (sport modifiers), §6.3 (the
evaluator), §6.4 (step rules and deficit pace, reused by the path), §9 slice 2, §12 (as built — the truth where it
differs). Follow-ups folded in: `mezo-r36n9.72` (arc after a mid-run deload), `mezo-r36n9.74` (S1 cleanup).
Issue: `mezo-r36n9.77`. Plan 2 of 8 (hand-over `2026-11-18-volume-engine-programme-handover.md`).

## How the evaluator serves owner decision #49 (plan intake inside the block builder)

Decision #49 (2026-11-17, `_dontesek.json` / `14-decisions.md`): the builder asks session time and experience, offers
2–3 candidate splits with an estimated time, and experience picks the starting band. S2 gives that screen its
measuring instrument, not the intake itself:

- **Estimated time per candidate.** Every day carries `minutesEstimate`; the request takes an optional
  `sessionMinutesTarget` and each day reports `overTarget`. The builder evaluates each candidate (generator output or
  hand edit) with the same call and shows them side by side — fit per muscle, minutes per day, the block's path.
- **One source of truth for candidates.** Generated plans start inside their bands (Task 8), so a fresh candidate
  evaluates as `inside` for every trained group — the generator and the evaluator cannot disagree.
- **Experience → starting point** is *not* in S2: it needs the intake fields and the owner's wording of the levels,
  which belong to the builder slice (`mezo-r36n9.83`). It will plug in as the generator's starting position inside
  the band (low / middle), which Task 8 makes a single, named place (`MesoPlanSkeleton.startSets`).

## Global Constraints

- Direct sets only (ADR 0021). A template is a jsonb document, only a run has exercise rows (ADR 0027).
- The evaluator never writes. `POST /api/train/meso-plans/evaluate` is deterministic for a given request **and** the
  user's state at that moment (deficit, sport schedule); no LLM; it never blocks a save.
- Every contract change is **additive** (new operation, new optional fields). No existing response changes shape.
- Tunables in `@Validated` `VolumeProperties`, never literals: `bands.sport-low-shift` 1, `bands.sport-high-shift` 2,
  `evaluator.minutes-per-working-set` 2.4, `evaluator.minutes-per-warmup-set` 1.0, `evaluator.session-overhead-minutes`
  6, `sport-groups-by-sport.volleyball` `[quad, ham, glute, calf]`. `step` is removed.
- Sport band (spec §6.2): `low = max(1, low − sportLowShift)`, `high = max(low + 1, high − sportHighShift)`.
- Caps: 5 working sets per exercise, 8 per muscle group per day (`bands.exercise-cap`, `bands.session-cap`).
- Path step = the weekly decider's step (Hangsúly 2, Építés 1, **both 1 in a deficit**, Tartás 0), from **one**
  helper `VolumeDecider.step(tier, deficit, props-steps)` that `VolumeDecider.decide` itself calls.
- Groups without a landmark entry (core, traps) are never judged and never pathed; their sets still count toward a
  day's minutes. Exempt exercises (`countsTowardVolume = false`) count toward minutes only.
- `SetRecommendationService`, `ProgressionDecider` (T1) and `ResetDatabase` are not touched. `WeekProposalService`
  changes by its band call only.
- Hot spots shared with T1 (`mezo-r36n9.79`): `train.yml` + `openapi.yml` + `merge.yml`, the 1.1.0 master,
  `VolumeProperties` + the `mezo.volume` yml block. Agreed on bd comments of both issues; rebase on `main` right
  before merging and regenerate `docs/CODEMAP.md` after it.
- Backend test command, per task: `./mvnw -q test -Dmezo.test.use-testcontainers=true -Dtest=<Class>` from
  `backend/`. One Maven process per tree. Before merge: `ArchitectureTest` and the full suite with the same flag.
- Conventional commits carrying `(mezo-r36n9.77)`.

## Review Focus

1. **The owner's real block** (Tartás legs, four volleyball days a week, biceps saved above its band): quad's band
   becomes 2–5 with the sport switch on; biceps 11 vs 6–10 is `above` with a down proposal, yet no weekly proposal
   ever pulls it back (S1 rule kept). → Task 3 test `ownersBlockShape`, Task 5 test `sportLowersTheLegBandOnTheRun`.
2. **A proposal never crosses a cap**, even when the band asks for more (one exercise for a group, already at 5 on a
   day at 8): `proposalBlocked = true`, nothing proposed. → Task 3 test `capsBlockTheProposal`.
3. **Arc after a mid-run deload**: the current week is a deload (amounts halved) → the weeks after it plan from the
   restored amounts, not from the halves; past weeks show what was really prescribed. → Task 7 test
   `deloadMidRunPlansFromTheRestoredAmounts` in `VolumeArcContractIT`.
4. **Arc = evaluator**: for an active run, `GET …/evaluation`'s `path` and the arc's `planned` agree for every week
   from the current one on. → Task 7 test `arcAndEvaluationAgree`.
5. **Legacy archived runs** (ledger rows without `band_high`, no proposals) still get a planned line after
   `ceiling`/`step` are deleted, and the close report still freezes. → Task 7 test `legacyRowKeepsAScaffold`.

## File structure

Created under `backend/src/main/java/io/mrkuhne/mezo/feature/train/`:

| File | Responsibility |
|---|---|
| `service/VolumePath.java` | pure: week-by-week projection of a plan's per-group sets over the block |
| `service/PlanEvaluator.java` | pure: fit, diff, spread, proposal per group; minutes, cap warnings per day; the path |
| `service/MesoPlanEvaluateService.java` | per-user facts (deficit, sport days) + contract mapping; run evaluation |
| `db/changelog/1.1.0/script/202611181000_mezo-r36n9.77_sport_groups.sql` | `sport_groups jsonb` on `meso_template`, `mesocycle` |

Modified: `config/VolumeProperties.java` (+ `application.yml`), `service/VolumeBands.java`, `service/VolumeDecider.java`
(step helper), `service/VolumeLedger.java`, `service/WeekProposalService.java` (band call), `service/VolumeArcService.java`,
`service/PriorityTier.java`, `service/MesoPlanSkeleton.java`, `service/MesoTemplateService.java`,
`service/TrainService.java`, `entity/{MesocycleEntity,MesoTemplateEntity}.java`, `mapper/TrainMapper.java`,
`controller/TrainController.java`, `api/feature/train/train.yml`, `api/openapi.yml` (generated merge),
`frontend/src/data/_client/api.gen.ts` (regenerated only — no FE code change), `1.1.0_master.yml`.

---

### Task 1: Sport-adjusted bands and the new config

**Files:**
- Modify: `config/VolumeProperties.java`, `application.yml` (`mezo.volume`), `service/VolumeBands.java`
- Test: `service/VolumeBandsTest.java`, `config/VolumePropertiesIT.java`

**Interfaces:**
- Produces: `VolumeBands.Band(int low, int high, int limit, boolean sportAdjusted)`;
  `static Band band(Baseline landmarks, PriorityTier tier, boolean sportLoaded, VolumeProperties.Bands cfg)` (the
  3-arg overload is deleted; callers pass `false` until Task 5); `Bands` gains `@NotNull @PositiveOrZero Integer
  sportLowShift, sportHighShift`; new `VolumeProperties.Evaluator(BigDecimal minutesPerWorkingSet, BigDecimal
  minutesPerWarmupSet, Integer sessionOverheadMinutes)`; new `Map<String, List<String>> sportGroupsBySport`.
  `step` stays until Task 8.

- [ ] **Step 1: Write the failing test**

```java
@Test void sportLowersQuad() {   // quad 8/12/18
    var quad = new VolumeProperties.Baseline(8, 12, 18);
    assertThat(VolumeBands.band(quad, PriorityTier.MAINTAIN, true, CFG)).isEqualTo(new Band(2, 5, 18, true));
    assertThat(VolumeBands.band(quad, PriorityTier.GROW, true, CFG)).isEqualTo(new Band(7, 10, 18, true));
    assertThat(VolumeBands.band(quad, PriorityTier.GROW, false, CFG)).isEqualTo(new Band(8, 12, 18, false));
}
@Test void sportNeverCollapsesTheBand() {   // high stays at least low + 1
    var tiny = new VolumeProperties.Baseline(2, 3, 4);
    var b = VolumeBands.band(tiny, PriorityTier.GROW, true, CFG);
    assertThat(b.high()).isGreaterThanOrEqualTo(b.low() + 1);
    assertThat(b.low()).isGreaterThanOrEqualTo(1);
}
```

- [ ] **Step 2:** Run `-Dtest=VolumeBandsTest`. Expected: compile failure.
- [ ] **Step 3:** Implement; fix the two callers (`VolumeLedger`, `WeekProposalService`) to pass `false`; add the yml
  keys; extend `VolumePropertiesIT`.
- [ ] **Step 4:** Run `-Dtest='VolumeBandsTest,VolumePropertiesIT,VolumeLedgerIT,WeekProposalAutoIT'`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(train): sport-adjusted bands and evaluator config (mezo-r36n9.77)`.

### Task 2: `VolumePath` — the block, week by week

**Files:**
- Create: `service/VolumePath.java`
- Modify: `service/VolumeDecider.java` (extract `step`)
- Test: `service/VolumePathTest.java`, `service/VolumeDeciderTest.java` (unchanged behaviour)

**Interfaces:**
- Produces: `VolumeDecider.step(PriorityTier tier, boolean deficit, int stepEmphasize, int stepGrow, int stepDeficit)`
  (`decide` calls it); `VolumePath.Exercise(Object key, String group, int dayIndex, int sets)` (key = row id or
  `dayIndex:exerciseIndex`); `VolumePath.Group(PriorityTier tier, Band band)`; `VolumePath.Input(int weeks,
  List<String> phaseCurve, int fromWeek, List<Exercise> amounts, Map<Object,Integer> restoreTo, Map<String,Group>
  groups, boolean deficit, int stepEmphasize, int stepGrow, int stepDeficit, BigDecimal deloadFraction, int
  exerciseCap, int sessionCap)`; `List<VolumePath.Week> project(Input)` with `Week(int week, String phase, int total,
  Map<String,Integer> sets)` for weeks `fromWeek..weeks`.
- Rules: week `fromWeek` = `amounts` as given. Each later week: phase `Deload` → every exercise ⌈sets × fraction⌉
  (min 1), remembering the pre-deload amounts; the week after a deload → those amounts back (as much as fits the caps,
  never below the current); otherwise per group (tier ≠ Tartás, sets < `band.high`): `min(step, high − sets)` single
  sets via `SetSlots.pickUp` on the working copy; no slot → the group holds. A group at or above `high` holds (a plan
  saved above its band is never pulled back). `restoreTo` (non-empty only when `fromWeek` itself is a deload) seeds
  "the pre-deload amounts" so the week after restores from them. "Everything goes as planned": no hold signals.

- [ ] **Step 1: Write the failing tests** — `growRampsByOneUpToTheTop` (back 10 sets, Építés 10–16, 6 weeks MEV MAV MAV
  MAV MAV Deload → 10 11 12 13 14 7); `emphasizeRampsByTwoAndDeficitSlowsIt` (deficit → +1); `maintainNeverMoves`;
  `deloadHalvesPerExerciseAndTheWeekAfterRestores` (8-week curve with a mid deload); `fromADeloadWeekRestoresFromRestoreTo`;
  `capsStopTheRamp` (one exercise at 5 → holds); `aboveTheBandHolds`; `step` tests in `VolumeDeciderTest` pin
  the existing values.
- [ ] **Step 2:** Run `-Dtest='VolumePathTest,VolumeDeciderTest'`. Expected: compile failure.
- [ ] **Step 3:** Implement (pure, no Spring).
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(train): VolumePath projects a block week by week (mezo-r36n9.77)`.

### Task 3: `PlanEvaluator` — the pure core of the evaluator

**Files:**
- Create: `service/PlanEvaluator.java`
- Test: `service/PlanEvaluatorTest.java`

**Interfaces:**
- Consumes: `VolumeBands`, `SetSlots`, `VolumePath`, `VolumeDecider.step`.
- Produces: `PlanEvaluator.PlanExercise(String group /* coarse, may be null */, int workingSets, int warmupSets,
  boolean counts)`; `PlanDay(String day, List<PlanExercise> exercises)`; `Input(int weeks, List<String> phaseCurve,
  List<PlanDay> days, Map<String,String> priorities, Set<String> sportGroups, boolean deficit, Integer
  sessionMinutesTarget, Set<Integer> sportWeekdays /* 0=Hét */, VolumeProperties props)`;
  `Result(List<MuscleResult> muscles, List<DayResult> days, List<VolumePath.Week> path)`;
  `MuscleResult(String muscle, PriorityTier tier, Band band, int weeklySets, Fit fit /* BELOW|INSIDE|ABOVE */, int
  diff /* sets to the nearest band edge, signed; 0 inside */, List<DaySets> spread, List<ProposalEdit> proposal,
  boolean proposalBlocked)`; `ProposalEdit(int dayIndex, int exerciseIndex, int delta)`; `DayResult(int dayIndex,
  String day, int minutesEstimate, Boolean overTarget, List<CapWarning> sessionCapWarnings, boolean sportSameDay)`.
- Rules: muscles = landmark groups the plan trains with counting exercises **plus** groups named in `priorities`
  (an emphasized group with no exercise is `below`, `proposalBlocked`); sorted by the landmark table's order.
  Proposal: below → single sets up via `SetSlots.pickUp` until `low`; above → down via `SetSlots.pickDown` until
  `high`; never above `exercise-cap` / `session-cap`; repeated moves of one exercise merge into one edit; below with
  no slot left before `low` → `proposalBlocked`. Minutes = round(working × per-working + warmups × per-warmup +
  overhead) for a day with at least one exercise, else 0. Cap warning = a group above `session-cap` on a day. Path =
  `VolumePath` from week 1 over the plan as given.

- [ ] **Step 1: Write the failing tests** — `insideBandNoProposal`; `belowProposesOntoTheFewestSetsExercise`;
  `aboveProposesDownFromTheBiggest`; `capsBlockTheProposal`; `emphasizedButUntrainedIsBlocked`;
  `coreIsNeverJudgedButCountsForMinutes`; `minutesAndOverTarget` (2 × 3 working, 2 warmups, target 20 →
  round(14.4+2+6) = 22, over); `sessionCapWarning` (9 back sets on one day); `sportSameDay`;
  `ownersBlockShape` (biceps 11 Építés → above, diff −1, one down edit; quad 3 Tartás + sport → band 2–5 inside;
  chest 2 Tartás → below 3, one up edit); `pathStartsFromThePlan`.
- [ ] **Step 2:** Run `-Dtest=PlanEvaluatorTest`. Expected: compile failure.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(train): PlanEvaluator measures a plan against its bands (mezo-r36n9.77)`.

### Task 4: `sportGroups` in the schema and the contract

**Files:**
- Create: `db/changelog/1.1.0/script/202611181000_mezo-r36n9.77_sport_groups.sql` (+ master entry)
- Modify: `api/feature/train/train.yml`, `api/openapi.yml` (regenerated per `api/README` merge step),
  `frontend/src/data/_client/api.gen.ts` (`pnpm generate:api`), `entity/{MesocycleEntity,MesoTemplateEntity}.java`,
  `mapper/TrainMapper.java`, `service/TrainService.java` (`StampSource`, `stampRun`, response assembly,
  `updateMusclePriorities`), `service/MesoTemplateService.java` (create/update/start/rerun)
- Test: `MesoTemplateSportGroupsIT.java` (new), `MesoTemplateIT` (still green)

**Interfaces:**
- Produces: column `sport_groups jsonb null` on both tables (no backfill: null = none). Contract: `sportGroups:
  string[]` (nullable, items = coarse group keys) on `MesoTemplateUpsertRequest`, `MesoTemplateResponse`,
  `MesocycleResponse`, `MusclePrioritiesUpdateRequest`. Validation: every value must be a key of
  `mezo.volume.baselines` → 400 `TRAIN_SPORT_GROUP_INVALID` (new `SystemMessage` key with its hu/en text). Storage
  normalised: de-duplicated, landmark-table order, empty → null. On `PUT …/muscle-priorities`, `sportGroups` absent =
  unchanged, `[]` = cleared. Start copies template → run; rerun copies run → template.
- Also the two new operations are **declared** here (handlers in Task 6) so the contract lands in one commit:
  `POST /api/train/meso-plans/evaluate` (`evaluateMesoPlan`, body `MesoPlanEvaluateRequest {weeks, phaseCurve, days:
  MesoDayInput[], musclePriorities?, sportGroups?, sessionMinutesTarget?}`) and `GET
  /api/train/mesocycles/{id}/evaluation` (`getMesocycleEvaluation`), both → `MesoPlanEvaluation {deficit,
  sportDays: int[], suggestedSportGroups: string[], muscles: MuscleEvaluation[], days: DayEvaluation[], path:
  VolumePathWeek[]}` with the field names of Task 3 (`fit` enum `below|inside|above`, `band {low, high, limit,
  sportAdjusted}`, `spread [{dayIndex, sets}]`, `proposal [{dayIndex, exerciseIndex, delta}]`, `sessionCapWarnings
  [{muscle, sets}]`, `VolumePathWeek {week, phase, total, muscles: {group: sets}}`). Errors 400 / 401 / 404 (run).

- [ ] **Step 1: Write the failing IT** — `templateRoundTripsSportGroups`; `startCopiesSportGroupsToTheRun`;
  `rerunCopiesThemBack`; `prioritiesRequestSetsAndClearsSportGroups` (absent keeps, `[]` clears);
  `unknownGroupIs400`; `duplicatesAndOrderAreNormalised`.
- [ ] **Step 2:** Run `-Dtest=MesoTemplateSportGroupsIT`. Expected: FAIL.
- [ ] **Step 3:** Implement (contract first, then generate, then code). Controller methods for the two new
  operations throw nothing yet — they return through a stub `MesoPlanEvaluateService` that Task 6 fills (or the
  delegate is added with Task 6 if the generated interface allows a default 501).
- [ ] **Step 4:** Run `-Dtest='MesoTemplateSportGroupsIT,MesoTemplateIT,ContractDriftTest'` (the drift test's real
  name: `grep -rl "openapi" backend/src/test | head`) and `cd frontend && CI=true pnpm build`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(train): sportGroups on templates and runs (mezo-r36n9.77)`.

### Task 5: The run's band follows its sport groups

**Files:**
- Modify: `service/VolumeLedger.java`, `service/WeekProposalService.java` (the `VolumeBands.band` call only)
- Test: `VolumeLedgerIT` (+1 case), `service/WeekProposalAutoIT` (+1 case)

**Interfaces:**
- Consumes: `MesocycleEntity.getSportGroups()`.
- Produces: `band_low`/`band_high` on the ledger and the weekly decider's band use `sportLoaded =
  sportGroups.contains(group)`; `PUT …/muscle-priorities` with new `sportGroups` re-syncs the ledger at once (it
  already does for tiers). The goal guard follows automatically (it reads `band_low`).

- [ ] **Step 1:** Add `sportLowersTheLegBandOnTheRun` (Tartás quad 3 sets, sport on → ledger band 2–5) and
  `emphasizedQuadStopsAtTheSportTop` (the weekly step stops at the lowered `high`).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `-Dtest='VolumeLedgerIT,WeekProposalAutoIT,GuardEvaluationServiceIT'`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(train): sport-loaded groups lower the run's band (mezo-r36n9.77)`.

### Task 6: The evaluate endpoint and the run evaluation

**Files:**
- Create: `service/MesoPlanEvaluateService.java`
- Modify: `controller/TrainController.java`
- Test: `MesoPlanEvaluateContractIT.java` (new)

**Interfaces:**
- Consumes: `PlanEvaluator`, `EnergyBalancePort.isInDeficit(userId, today)`, `SportScheduleSlotRepository
  .findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc`, `ExerciseCatalogRepository` is **not** needed (a
  plan exercise's group is `MuscleGroup.of(input.muscle)`, exactly as `stampRun` stores it).
- Produces: `MesoPlanEvaluation evaluate(UUID userId, MesoPlanEvaluateRequest)` — validates tiers
  (`PriorityTier.normalize`) and sport groups (Task 4 rule), `deficit` from the port, `sportDays` = distinct weekdays
  of the user's sport slots, `suggestedSportGroups` = union of `sport-groups-by-sport` over the user's sports when
  the request's `sportGroups` is null (else empty), `sportSameDay` per day by matching `MesoDayInput.day`
  ('Hét'..'Vas') to the slot weekday. `MesoPlanEvaluation evaluateRun(UUID userId, UUID mesoId)` — the run's
  template-day rows as the plan, its tiers and sport groups; its `path` is the arc's planned line from Task 7
  (`VolumeArcService.plannedPath` — one computation, two readers). Owner-scoped; foreign/missing run → 404.
  Read-only transactions.

- [ ] **Step 1: Write the failing IT** — `evaluatesAPlanAndNeverWrites` (row counts of `mesocycle`, `meso_template`,
  `exercise`, `meso_week_proposal` unchanged); `deficitSlowsThePath` (an active cut goal via the goal populator → the
  path's Hangsúly step is 1); `sportScheduleSuggestsLegGroups` (a volleyball slot, request without `sportGroups`);
  `explicitSportGroupsLowerTheBand`; `invalidTierIs400`; `runEvaluationOfAForeignRunIs404`;
  `runEvaluationUsesTheRunsPlan`.
- [ ] **Step 2:** Run `-Dtest=MesoPlanEvaluateContractIT`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run with `ArchitectureTest`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(train): POST meso-plans/evaluate and the run evaluation (mezo-r36n9.77)`.

### Task 7: The arc's planned line from the path

**Files:**
- Modify: `service/VolumeArcService.java`
- Test: `VolumeArcContractIT.java` (rewritten planned-line cases), `MesocycleCloseReportIT` (still green)

**Interfaces:**
- Produces: package-visible `Map<String,int[]> plannedPath(UUID createdBy, MesocycleEntity run)` used by `arc` and
  by `MesoPlanEvaluateService.evaluateRun`. For a model-2 run with derived rows:
  - **past weeks** (`< currentWeek`): what that week really prescribed — the group sums of the week's applied
    proposal `plan_after` (exercise rows resolved owner-scoped **including soft-deleted rows**, so a day edit does not
    lose them); a week with no proposal (week 1, a stamped-only week) takes the state before the next proposal (its
    `plan_after` with its accepted lines turned back to `from`), else the current plan;
  - **current and future weeks**: `VolumePath.project` from the current amounts at `currentWeek`, with `restoreTo` =
    the current deload proposal's `restore` when the current week is a deload; the run's deficit via the port.
  - **legacy rows** (no `band_high`: archived model-1 runs): `VolumePath` over one synthetic exercise starting at
    MEV with the caps off, band from `VolumeBands` — the old shape (week 1 MEV, ramp, deload) without `ceiling`/`step`.
  `plannedFromPlan` and `plannedScaffold` are deleted.

- [ ] **Step 1: Write the failing tests** — `deloadMidRunPlansFromTheRestoredAmounts`; `pastWeeksShowWhatWasPrescribed`
  (two auto proposals applied, then a day edit re-mints ids → past weeks unchanged); `arcAndEvaluationAgree`;
  `legacyRowKeepsAScaffold`.
- [ ] **Step 2:** Run `-Dtest=VolumeArcContractIT`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `-Dtest='VolumeArcContractIT,MesocycleCloseReportIT,MesoPlanEvaluateContractIT'`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(train): the volume arc plans from the evaluator's path (mezo-r36n9.77)`.

### Task 8: Generator on bands; the S1 leftovers removed

**Files:**
- Modify: `service/MesoPlanSkeleton.java`, `service/MesoPlanGeneratorService.java` (if it reads `ceilings`),
  `service/PriorityTier.java`, `service/MesoTemplateService.java`, `config/VolumeProperties.java`, `application.yml`
- Test: `MesoPlanSkeletonTest`, `PriorityTierTest` (the two method tests deleted), `MesoPlanGenerateContractIT`
  (+1 case), `MesoTemplateIT` (rerun no longer writes `volumePerMuscle`)

**Interfaces:**
- Produces: `MesoPlanSkeleton.startSets(Band band, PriorityTier tier)` — the single place a generated plan's week-1
  amount is chosen, **owner decision 2026-11-18 "Sáv széle"** (Építés at the band's low
  = MEV as today, Hangsúly at the band's low = MAV − 2, Tartás at the band's top = MEV − 1); `Skeleton` loses
  `ceilings` and keeps `weekOneSets`. `PriorityTier.ceiling`/`weekOneStart` deleted; `VolumeProperties.step` and
  `mezo.volume.step` deleted; `MesoTemplateService.baselinesOf` and its rerun write deleted (rerun stores
  `volumePerMuscle = null`; column and wire field stay, tolerated and ignored).

- [ ] **Step 1:** Add `generatedPlanIsInsideItsBands` to `MesoPlanGenerateContractIT` (generate for 4 days with one
  emphasized and one maintained group, then `POST /evaluate` the returned template → every trained group `inside`).
- [ ] **Step 2:** Run. Expected: FAIL (today Hangsúly back starts at 12 < 14 and Tartás at MEV > MEV − 1).
- [ ] **Step 3:** Implement and delete.
- [ ] **Step 4:** Run `-Dtest='MesoPlanSkeletonTest,PriorityTierTest,MesoPlanGenerateContractIT,MesoPlanGenerateAiIT,MesoTemplateIT,VolumePropertiesIT,ArchitectureTest'`.
  `grep -rn "weekOneStart\|\.ceiling(\|props.step()\|baselinesOf" backend/src` → nothing. Expected: PASS.
- [ ] **Step 5:** Commit `refactor(train): generator starts inside the bands; S1 leftovers removed (mezo-r36n9.77)`.

### Task 9: Docs, gates, ship

**Files:**
- Modify: `docs/features/train.md` (§4 `#### Volume engine v2`: sport bands, the evaluator, the arc; §4 `#### Plan
  generator`; §9 traps — remove the `ceiling`/`step`/`volumePerMuscle` leftovers item; §10 file list), the spec's §12
  (an "S2 as built" block), `docs/features/README.md` row, `docs/milestones/roadmap.md` (dated entry),
  `docs/boop-handbook/07-edzes/{02-mezociklus-terv,05-heti-volumen}.md`, `docs/boop-handbook/_jegyek.json`,
  `_kiadasok.json`, `_dontesek.json` (the owner's starting-point answer, if new), `docs/CODEMAP.md` (generated).

- [ ] **Step 1:** Independent whole-branch review (with the deferred-findings list of the hand-over); fix findings.
- [ ] **Step 2:** `./mvnw -q clean test -Dmezo.test.use-testcontainers=true` from `backend/` → BUILD SUCCESS.
- [ ] **Step 3:** `cd frontend && CI=true pnpm test` (`VITE_USE_MOCK` unset, then `=false`) and `pnpm build` — the
  regenerated client only; no FE code change.
- [ ] **Step 4:** Docs; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` → 0 errors, 0 stale.
- [ ] **Step 5:** Rebase on `origin/main` (T1 may have landed: resolve hot spots, regenerate `openapi.yml`,
  `api.gen.ts`, codemap), re-run the focused ITs + `ArchitectureTest`, merge `--no-ff` from a detached HEAD, push,
  watch `deploy` to green, confirm the pod runs the release.
- [ ] **Step 6: Production check** (reads; the API calls through the signed-in app session if one is available,
  else the evaluator replayed locally on the run's plan shape):
  ```sql
  select sport_groups from mesocycle where status = 'active';                                 -- null (nothing set yet)
  select muscle, current_sets, band_low, band_high from muscle_group_volume_log v
   join mesocycle m on m.id = v.mesocycle_id where m.status = 'active' order by muscle;      -- unchanged by the deploy
  select count(*) from meso_week_proposal;                                                    -- unchanged by the deploy
  ```
  `GET /api/train/mesocycles/{active}/evaluation` answers 200; its `path` for weeks ≥ current equals the arc's
  `planned`; the week-1 totals equal the ledger's `current_sets`.
- [ ] **Step 7:** `node scripts/boop-notion-sync.mjs plan` → apply → `check` exits 0; `node
  scripts/check-beads-backup.mjs --fix`; commit; push; close `mezo-r36n9.77`, `.72`, `.74`; Hungarian report.

## Kész, ha…

- Egy összerakott tervre a szerver megmondja izmonként: a sávja (a röplabdás lábaknál lejjebb tolva), hány sorozat
  van benne, a sávon belül, alatta vagy fölötte van-e, és ha kell, konkrét, a korlátokat (gyakorlatonként 5, izmonként
  egy napon 8) soha át nem lépő javítást ad — vagy kimondja, hogy új gyakorlat kell.
- Naponként becsült edzésidőt ad, jelzi, ha egy nap túllépi a megadott időt, ha egy izom egy napon 8 fölött van, és
  ha aznap sport is van.
- Hétről hétre kirajzolja a blokkot (a könnyített hét felez, utána visszaáll; fogyásban lassabb az emelés), és a
  futó blokk volumen-íve pontosan ugyanezt a vonalat mutatja — egy könnyített hét közepén is.
- A „röplabda: a láb sávja lejjebb” beállítás elmenthető a tervre és a futó blokkra, és azonnal a láb sávját mozgatja.
- A generált terv minden izma a saját sávján belül indul.
- A tulaj futó blokkján az élesítés semmit nem változtat (sorozatok, sávok, javaslatok ugyanazok — lekérdezéssel
  igazolva), és a futó blokk kiértékelése válaszol.
- A régi, már nem használt számítások (heti +2 alapértelmezés, plafon, hét-1 kezdőérték, a sablon halott volumenmezője)
  eltűntek.
- A teljes backend tesztkészlet zöld; `ArchitectureTest`, kódtérkép, dokumentum-ellenőrzés hibátlan; a webes app
  tesztjei mindkét módban zöldek, a webes kód változatlan.
- `train.md`, a kézikönyv két oldala, a mérföldkő-napló és a Notion tükör a kiadott állapotot írja le.
