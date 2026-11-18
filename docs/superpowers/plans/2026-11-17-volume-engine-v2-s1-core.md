# Volume engine v2 — S1: the engine's core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the set count on a run's exercise the amount the workout prescribes, replace the weekly rollover with
a per-exercise proposal applied automatically, and migrate runs in flight without changing what they prescribe.

**Architecture:** Three pure units (`VolumeBands`, `SetSlots`, `VolumeDecider` v2) decide; thin services gather
signals, persist a `meso_week_proposal`, write `exercise.working_sets` and re-derive `muscle_group_volume_log`
(`VolumeLedger`). `WorkoutService.effectiveWorkingSets` is deleted; its logic survives only inside a one-time
migration runner. No contract change in this slice.

**Tech Stack:** Java 21, Spring Boot, JPA/Hibernate, Liquibase (`1.1.0/`), PostgreSQL, JUnit 5 + Testcontainers.

**Spec:** `docs/superpowers/specs/2026-11-17-train-volume-engine-v2-design.md` (§6.1, §6.2 without `sportGroups`,
§6.4 set lines + auto mode, §6.5 kímélő paragraph, §6.8, §6.9 guard, §9 S1, §11). The companion
`2026-11-17-train-style-and-techniques-design.md` is **not** in this slice.

Related research landed on `main` the same day: `docs/research/queries/muscle-ladder-mezo-development-digest.md`
(its §3 asks for exactly this — one source for "this many sets, and why", weekly changes with a reason and the
owner's decision) and its audit issue `mezo-1z4jc`; nothing in it contradicts the spec.

This is plan 1 of 8 (v2 S1–S3, techniques T1–T4, the Boop slice). Each later slice gets its own plan when the one
before it has shipped. The Boop slice builds on the Edzés room now on `main` (`ios/Boop/Edzes/**`, merged
2026-11-17, `mezo-r36n9.15`).

## Global Constraints

- Direct sets only (ADR 0021). A template is a jsonb document, only a run has exercise rows (ADR 0027).
- `api/feature/train/train.yml` and `api/openapi.yml` do not change in S1. Every existing response keeps its shape.
- Tunables live in `@Validated` config records (`VolumeProperties`), never as literals.
- Everything new sits behind the existing `VolumeProgressionGate` marker bean. With the switch off: no ledger rows,
  no proposals, and `getToday` prescribes `exercise.working_sets` (which is also what it does with the switch on).
- Band formulas (spec §6.2): Tartás `⌈mev/3⌉ … mev−1`; Építés `mev … mav`; Hangsúly `mav−2 … mrv`; `limit = mrv`.
- Caps: 5 working sets per exercise, 8 per muscle group per day.
- Weekly step (spec §6.4): Hangsúly +2, Építés +1, **both +1 in a deficit**; Tartás never; deload `⌈sets/2⌉`, min 1,
  restored the week after.
- "Deficit" = the owner's active weight goal aims at losing weight; no active goal → not a deficit.
- Proposal mode `mezo.volume.weekly-review.mode` = `auto` (the only mode built here).
- Exempt exercises (`counts_toward_volume = false`) are outside everything in this plan.
- History is by exercise identity, never by row id; a day edit re-mints exercise UUIDs.
- Backend test command, per task: `./mvnw -q test -Dmezo.test.use-testcontainers=true -Dtest=<Class>` from
  `backend/`. Before merge: `-Dtest='ArchitectureTest'` and the full suite with the same flag.
- Liquibase SQL: no bare `?` in jsonb expressions (use `jsonb_exists`).
- Conventional commits carrying `(mezo-r36n9.65)`.

## Review Focus

1. **A run mid-week at deploy** that already rolled over this week under the old engine: it must not be stepped a
   second time, and today's prescription must equal yesterday's. → Task 10 test `runAlreadyRolledOverIsNotSteppedAgain`.
2. **A plan with one exercise for a muscle** (the production failure): three leg-press sets stay three, in week 1 and
   after a rollover of a Tartás muscle. → Task 5 test `oneQuadExerciseKeepsItsThreeSets`.
3. **A proposal line whose exercise row vanished** (the owner edited the day between generation and apply — possible
   once manual mode exists, and already possible if apply fails half-way): dropped, never a 500. → Task 8 test
   `lineForAVanishedExerciseIsDropped`.
4. **A week with nothing logged** (ill, travelling): no step up, no step down, no exception. → Task 8 test
   `nothingLoggedLastWeekHolds`.
5. **A group with no landmark entry** (core, traps) and a group the plan stopped training: no ledger row is
   fabricated, a stale one is removed. → Task 4 tests `coreGetsNoRow`, `rowOfAnUntrainedGroupIsRemoved`.

## File structure

Created under `backend/src/main/java/io/mrkuhne/mezo/feature/train/`:

| File | Responsibility |
|---|---|
| `service/VolumeBands.java` | pure: the band of (group landmarks, tier) |
| `service/SetSlots.java` | pure: which exercise takes or gives a set, within the caps |
| `service/VolumeLedger.java` | derive `muscle_group_volume_log` from the run's plan |
| `service/WeeklySignalReader.java` | last week's logged sets and feedback per muscle group |
| `service/WeekProposalService.java` | generate, persist and (auto) apply the weekly proposal |
| `service/EnergyBalancePort.java` | consumer-owned port: is the owner in a deficit |
| `entity/MesoWeekProposalEntity.java`, `entity/json/WeekProposalLineJson.java`, `repository/MesoWeekProposalRepository.java` | the proposal |
| `runner/VolumeAmountMigrationRunner.java` | one-time: effective sets → amounts |

Created elsewhere: `feature/goal/.../EnergyBalanceAdapter.java` (in the goal slice's adapter package, next to the
existing `GoalRecomputePort` adapter); `db/changelog/1.1.0/script/202611171000_mezo-r36n9.65_volume_engine_v2.sql`.

Modified: `service/VolumeDecider.java` (rewritten), `service/VolumeProgressionService.java` (seeding and rollover
removed, delegating), `service/PriorityTier.java` (`weekOneStart` and `ceiling` deleted), `service/TrainService.java`,
`service/WorkoutService.java`, `service/WorkoutExerciseChangeService.java`, `service/RecoveryReturnService.java`,
`service/VolumeArcService.java` (reads the ledger as before — compile fixes only), `config/VolumeProperties.java`,
`entity/MuscleGroupVolumeLogEntity.java`, `entity/MesocycleEntity.java`, `application.yml`,
`feature/goal/engine/service/GuardEvaluationService.java`, `backend/src/test/.../support/ResetDatabase.java`.

---

### Task 1: `VolumeBands`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/VolumeBands.java`
- Modify: `config/VolumeProperties.java`, `backend/src/main/resources/application.yml` (the `mezo.volume` block)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/VolumeBandsTest.java`

**Interfaces:**
- Produces: `VolumeBands.Band(int low, int high, int limit)`;
  `static Band band(VolumeProperties.Baseline landmarks, PriorityTier tier, VolumeProperties.Bands cfg)`;
  `VolumeProperties.Bands(Integer maintainLowDivisor, Integer emphasizeLowOffset, Integer exerciseCap, Integer sessionCap)`
  at `mezo.volume.bands` = `3`, `2`, `5`, `8`; `VolumeProperties.WeeklyReview(String mode)` at
  `mezo.volume.weekly-review.mode` = `auto`; `VolumeProperties.stepEmphasize` = `2`, `stepGrow` = `1`,
  `stepDeficit` = `1` (the old `step` key is removed with its last reader in Task 9).

- [ ] **Step 1: Write the failing test**

```java
@Test void backBands() {
    var back = new VolumeProperties.Baseline(10, 16, 22);
    assertThat(VolumeBands.band(back, PriorityTier.MAINTAIN, CFG)).isEqualTo(new Band(4, 9, 22));
    assertThat(VolumeBands.band(back, PriorityTier.GROW, CFG)).isEqualTo(new Band(10, 16, 22));
    assertThat(VolumeBands.band(back, PriorityTier.EMPHASIZE, CFG)).isEqualTo(new Band(14, 22, 22));
}
@Test void bicepsBands() {
    var biceps = new VolumeProperties.Baseline(6, 10, 14);
    assertThat(VolumeBands.band(biceps, PriorityTier.MAINTAIN, CFG)).isEqualTo(new Band(2, 5, 14));
    assertThat(VolumeBands.band(biceps, PriorityTier.EMPHASIZE, CFG)).isEqualTo(new Band(8, 14, 14));
}
@Test void lowNeverAboveHigh() {   // a degenerate table must still give a usable band
    var tiny = new VolumeProperties.Baseline(1, 1, 1);
    for (var tier : PriorityTier.values()) {
        var b = VolumeBands.band(tiny, tier, CFG);
        assertThat(b.low()).isBetween(1, b.high());
    }
}
```

- [ ] **Step 2:** Run `-Dtest=VolumeBandsTest`. Expected: compile failure.
- [ ] **Step 3:** Implement `VolumeBands` (pure, static, clamps `low ≥ 1`, `high ≥ low`) and the new config records
  with their `application.yml` values.
- [ ] **Step 4:** Run `-Dtest='VolumeBandsTest,VolumePropertiesIT'`. Expected: PASS (extend `VolumePropertiesIT` with
  the new keys).
- [ ] **Step 5:** Commit `feat(train): tier bands as a pure function (mezo-r36n9.65)`.

### Task 2: `SetSlots`

**Files:**
- Create: `service/SetSlots.java`
- Test: `service/SetSlotsTest.java`

**Interfaces:**
- Produces: `SetSlots.Slot(UUID exerciseId, int dayIndex, int sets)`;
  `static Optional<UUID> pickUp(List<Slot> group, int exerciseCap, int sessionCap)` — the slot that takes one more set;
  `static Optional<UUID> pickDown(List<Slot> group)` — the slot that gives one up (never below 1).
  `group` = the counting exercises of **one** muscle group across the week.

- [ ] **Step 1: Write the failing test**

```java
@Test void upGoesToTheFewestSetsThenTheLighterDay() {
    var a = slot(0, 4); var b = slot(0, 2); var c = slot(3, 2);        // Monday 4+2, Thursday 2
    assertThat(SetSlots.pickUp(List.of(a, b, c), 5, 8)).contains(c.exerciseId());
}
@Test void upSkipsAnExerciseAtFive() {
    var a = slot(0, 5); var b = slot(3, 3);
    assertThat(SetSlots.pickUp(List.of(a, b), 5, 8)).contains(b.exerciseId());
}
@Test void upSkipsADayAtEight() {
    var a = slot(0, 4); var b = slot(0, 4); var c = slot(3, 5);
    assertThat(SetSlots.pickUp(List.of(a, b, c), 5, 8)).isEmpty();       // Monday full, c at the exercise cap
}
@Test void downTakesFromTheMostSets() {
    var a = slot(0, 4); var b = slot(3, 2);
    assertThat(SetSlots.pickDown(List.of(a, b))).contains(a.exerciseId());
}
@Test void downNeverEmptiesAnExercise() {
    assertThat(SetSlots.pickDown(List.of(slot(0, 1)))).isEmpty();
}
```

- [ ] **Step 2:** Run `-Dtest=SetSlotsTest`. Expected: compile failure.
- [ ] **Step 3:** Implement. Ties in `pickUp`: fewest sets, then lower day total for the group, then list order;
  in `pickDown`: most sets, then list order.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(train): the slot rule for moving one set (mezo-r36n9.65)`.

### Task 3: `VolumeDecider` v2

**Files:**
- Modify (rewrite): `service/VolumeDecider.java`
- Test (rewrite): `service/VolumeDeciderTest.java`

**Interfaces:**
- Consumes: `VolumeBands.Band`.
- Produces:
  `enum Lever { NONE, UP, DOWN, HOLD, DELOAD }`;
  `enum Reason { ALL_SETS_DONE, FELT_EASY, DEFICIT_PACE, ROOM_IN_BAND, SORENESS_CLEARED, GRIND, TOO_MUCH, SETS_MISSED, JOINT_PAIN, SORENESS, TIER_MAINTAIN, DELOAD, NO_SLOT, AT_CEILING }`;
  `record Input(int week, PriorityTier tier, Band band, int plannedSets, int loggedLastWeek, boolean grind, boolean tooMuch, boolean jointPain, boolean sorenessHigh, boolean deficit, boolean deloadPhase, int stepEmphasize, int stepGrow, int stepDeficit)`;
  `record Result(Lever lever, int delta, List<Reason> reasons)` — `delta` is the wanted change in the group's weekly
  sets (`DELOAD` carries `delta = 0`: the halving is per exercise and is done by the caller);
  `static Result decide(Input in)`.

- [ ] **Step 1: Write the failing tests** (one per rule of spec §6.4, in its order)

```java
@Test void weekOneLeavesThePlanAlone()        { assertThat(decide(in().week(1)).lever()).isEqualTo(NONE); }
@Test void deloadPhaseIsADeload()             { assertThat(decide(in().deloadPhase(true)).lever()).isEqualTo(DELOAD); }
@Test void maintainNeverMoves()               { var r = decide(in().tier(MAINTAIN)); assertThat(r.lever()).isEqualTo(HOLD); assertThat(r.reasons()).containsExactly(TIER_MAINTAIN); }
@Test void atTheTopWithAGrindStepsDown()      { var r = decide(in().planned(22).grind(true)); assertThat(r.delta()).isEqualTo(-1); assertThat(r.lever()).isEqualTo(DOWN); }
@Test void grindBelowTheTopHolds()            { assertThat(decide(in().planned(15).grind(true)).lever()).isEqualTo(HOLD); }
@Test void missedSetsHold()                   { var r = decide(in().planned(15).logged(13)); assertThat(r.reasons()).contains(SETS_MISSED); }
@Test void jointPainHolds()                   { assertThat(decide(in().jointPain(true)).reasons()).contains(JOINT_PAIN); }
@Test void sorenessHolds()                    { assertThat(decide(in().sorenessHigh(true)).reasons()).contains(SORENESS); }
@Test void emphasizeStepsTwo()                { assertThat(decide(in().tier(EMPHASIZE).planned(15).logged(15)).delta()).isEqualTo(2); }
@Test void growStepsOne()                     { assertThat(decide(in().tier(GROW).band(new Band(10,16,22)).planned(12).logged(12)).delta()).isEqualTo(1); }
@Test void deficitStepsOneEvenOnEmphasize()   { var r = decide(in().tier(EMPHASIZE).planned(15).logged(15).deficit(true)); assertThat(r.delta()).isEqualTo(1); assertThat(r.reasons()).contains(DEFICIT_PACE); }
@Test void neverPastTheBandsTop()             { assertThat(decide(in().tier(EMPHASIZE).planned(21).logged(21)).delta()).isEqualTo(1); }
@Test void atTheTopHolds()                    { var r = decide(in().tier(EMPHASIZE).planned(22).logged(22)); assertThat(r.lever()).isEqualTo(HOLD); assertThat(r.reasons()).contains(AT_CEILING); }
@Test void aPlanAboveItsBandIsNotPulledBack() { assertThat(decide(in().tier(GROW).band(new Band(10,16,22)).planned(19).logged(19)).delta()).isZero(); }
```
(`in()` is a test builder defaulting to week 3, EMPHASIZE, back's band 14–22, planned = logged = 15, every flag
false, steps 2 / 1 / 1.)

- [ ] **Step 2:** Run `-Dtest=VolumeDeciderTest`. Expected: FAIL (old signatures).
- [ ] **Step 3:** Rewrite `VolumeDecider`. Order: week 1 → deload → maintain → step-down → holds → step-up clamp.
- [ ] **Step 4:** Run. Expected: PASS. The old decider's callers no longer compile — fixed in Task 8; until then keep
  the build green by having `VolumeProgressionService.rolloverIfDue` body removed in **this** commit and replaced
  with a `// Task 8` no-op that only stamps `currentWeek` (the pinned ITs that fail are deleted or `@Disabled` with
  the task number, and are re-created in Tasks 4, 5 and 8).
- [ ] **Step 5:** Commit `feat(train)!: weekly volume decision v2 (mezo-r36n9.65)`.

### Task 4: `VolumeLedger` — the volume log becomes derived

**Files:**
- Create: `service/VolumeLedger.java`
- Modify: `entity/MuscleGroupVolumeLogEntity.java` (`bandLow`, `bandHigh`), `service/VolumeProgressionService.java`
  (delete `seedBaselines`), `service/TrainService.java` (delete `seedPlanBaselines`; `stampRun`,
  `activateMesocycle`, `updateMusclePriorities`, the day-exercise replace path call the ledger),
  `service/WorkoutExerciseChangeService.java` (`addPlanWorkingSets`, `writePlan`), `service/PriorityTier.java`
  (delete `weekOneStart`, `ceiling`)
- Liquibase: this task creates the file with its first changeset — `band_low`, `band_high` on
  `muscle_group_volume_log`, both nullable `integer`. Task 6 adds a **second changeset** to the same file (never
  edits this one).
- Modify also: `service/MesoPlanGeneratorService.java` — it stops writing `volumePerMuscle` into the template.
- Test: `VolumeLedgerIT.java` (replaces `VolumeBaselineSeedIT`, `MesoStartTierSeedIT`, `VolumeBaselineSeedSwitchOffIT`)

**Interfaces:**
- Consumes: `VolumeBands.band`.
- Produces: `void VolumeLedger.sync(UUID createdBy, UUID mesocycleId)` — idempotent; for an **active** run with the
  gate on: one row per trained counting group that has a landmark entry, `currentSets` = Σ `working_sets` of that
  group's counting exercises on the run's template days, `mev/mav/mrv` from config, `bandLow/bandHigh` from the
  group's tier; rows of groups no longer trained are deleted; a planned run or the gate off → no rows.
  Provenance: `ProvenanceEnvelope.Baseline("A terv szerint", mev, mav, mrv)`, existing adjustments preserved.

- [ ] **Step 1: Write the failing IT** — cases and their exact expectations:
  - `rowsAreTheSumOfThePlan`: back exercises 4 + 2 + 3 + 2 → back `currentSets` 11.
  - `tierSetsTheBand`: back Hangsúly → `bandLow` 14, `bandHigh` 22; quad Tartás → 3 / 7.
  - `coreGetsNoRow`; `rowOfAnUntrainedGroupIsRemoved` (delete the only chest exercise, sync, no chest row).
  - `exemptExercisesAreNotSummed` (`counts_toward_volume = false`).
  - `plannedRunHasNoRows`; `gateOffHasNoRows` (`@TestPropertySource` turning the switch off).
  - `addingAPlanSetMovesTheRow`: `addPlanWorkingSets(+1)` on a back exercise → 12.
  - `aTemplatesOwnLandmarksAreIgnored`: template `volume_per_muscle` quad mev 3 → row mev still 8.
- [ ] **Step 2:** Run `-Dtest=VolumeLedgerIT`. Expected: FAIL.
- [ ] **Step 3:** Implement `VolumeLedger` and wire the seven call sites.
- [ ] **Step 4:** Run `-Dtest='VolumeLedgerIT,MusclePrioritiesCarryIT,WorkoutExerciseChangeIT,PriorityTierTest'`.
  Expected: PASS (`PriorityTierTest` loses the two deleted methods' cases).
- [ ] **Step 5:** Commit `feat(train): the volume log is derived from the plan (mezo-r36n9.65)`.

### Task 5: The plan is the amount

**Files:**
- Modify: `service/WorkoutService.java` (delete `effectiveWorkingSets`, `weekTemplateExercises` if unused, and the
  `effectiveSets` block in `getToday`; every later overlay reads `exercise.getWorkingSets()`)
- Test: `WorkoutTodayAmountIT.java` (replaces `VolumeEffectiveSetsIT`, `VolumeEffectiveSetsSwitchOffIT`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `getToday`'s `TodayExercise.workingSets` = the row's `working_sets` (then day delta, comeback, readiness).
  Before deleting the method, **move its body verbatim** to `runner/LegacySetDistribution.java`
  (`static Map<UUID,Integer> effective(List<ExerciseEntity>, List<MuscleGroupVolumeLogEntity>)`) — Task 10 needs it.

- [ ] **Step 1: Write the failing IT**
  - `oneQuadExerciseKeepsItsThreeSets`: a run whose only quad exercise has 3 sets → today's leg press shows 3.
  - `anEmphasizedBicepsKeepsItsTen`: biceps 3 + 2 + 3 + 2 → each exercise shows its own count.
  - `lightenDeltaStillApplies`: a day delta of −1 on top of 3 → 2 (the overlay order is unchanged).
  - `gateOffIsIdentical`: same run, switch off → the same numbers.
- [ ] **Step 2:** Run. Expected: `oneQuadExerciseKeepsItsThreeSets` FAILS with 8.
- [ ] **Step 3:** Move the method, delete the block.
- [ ] **Step 4:** Run `-Dtest='WorkoutTodayAmountIT,WorkoutTodayPrescriptionIT,WorkoutTodayProgressionIT,ReadinessLightenIT'`.
  Expected: PASS.
- [ ] **Step 5:** Commit `feat(train)!: the workout prescribes the plan's own sets (mezo-r36n9.65)`.

### Task 6: The proposal's storage

**Files:**
- Create: `entity/MesoWeekProposalEntity.java`, `entity/json/WeekProposalLineJson.java`,
  `repository/MesoWeekProposalRepository.java`
- Modify: `entity/MesocycleEntity.java` (`volumeModel`), the Task 4 changeset **file** (a second changeset),
  `1.1.0_master.yml`, `ResetDatabase.java`
- Test: `MesoWeekProposalRepositoryIT.java`

**Interfaces:**
- Produces:
  table `meso_week_proposal` (`id uuid pk`, `created_by uuid not null fk app_user`, `mesocycle_id uuid not null fk
  mesocycle on delete cascade`, `week int not null`, `kind text not null check in ('weekly','tier_change')`,
  `status text not null check in ('pending','applied','auto_applied','expired','superseded')`, `lines jsonb not null`,
  `plan_after jsonb`, `restore jsonb`, `created_at`, `decided_at`, `is_deleted`), unique partial index on
  `(mesocycle_id, week) where kind = 'weekly' and is_deleted = false`;
  `mesocycle.volume_model smallint not null default 1`;
  `WeekProposalLineJson(String id, UUID exerciseId, String exerciseName, int dayIndex, String muscleGroup, String kind, Integer from, Integer to, List<String> reasons, String decision)`
  — `kind` here only `"sets"`, `decision` `null | "accepted" | "kept"`;
  `Optional<MesoWeekProposalEntity> findWeekly(UUID createdBy, UUID mesocycleId, int week)`;
  `Optional<MesoWeekProposalEntity> findLatestApplied(UUID createdBy, UUID mesocycleId, int beforeWeek)`.

- [ ] **Step 1:** Write `MesoWeekProposalRepositoryIT`: `aSecondWeeklyProposalForTheSameWeekIsRefused`
  (expects `DataIntegrityViolationException`), `linesRoundTrip`, `deletingTheRunDeletesItsProposals`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Changeset, entity, repository, `ResetDatabase` entry.
- [ ] **Step 4:** Run `-Dtest='MesoWeekProposalRepositoryIT,ArchitectureTest'`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(train): weekly proposal storage (mezo-r36n9.65)`.

### Task 7: Last week's signals

**Files:**
- Create: `service/WeeklySignalReader.java`, `service/EnergyBalancePort.java`, the goal-slice adapter
- Modify: `config/VolumeProperties.java` + `application.yml` (`mezo.volume.signals`: `workload-too-much`,
  `joint-pain-hold`, `soreness-high`)
- Test: `WeeklySignalReaderIT.java`, `EnergyBalanceAdapterIT.java`

**Interfaces:**
- Produces:
  `record GroupSignals(int logged, boolean grind, boolean tooMuch, boolean jointPain, boolean sorenessHigh)`;
  `Map<String, GroupSignals> WeeklySignalReader.read(UUID createdBy, MesocycleEntity meso, int week)` — the week
  **before** `week`; empty for week 1;
  `boolean EnergyBalancePort.isInDeficit(UUID userId, LocalDate date)`.
- Rules:
  - `logged` = working, not skipped, reps not null sets of the run's **completed** sessions in the previous week,
    grouped by `MuscleGroup.of(<the logged row's own exercise>.muscle)` — the exercise is looked up **by the set's
    `exerciseId` directly**, so instance-scoped rows (today-only swaps, additions) count. Exempt exercises do not.
  - `grind` = as today (latest logged working set's RIR ≤ target − `grindRirGap`).
  - `tooMuch` / `jointPain` from `exercise_feedback` of those sessions; thresholds are the config values. Read the
    scale's direction from `WorkoutService.saveFeedback` and `FeedbackModal.tsx` and set the defaults to the top
    answer of `workload` and to `2` for joint pain.
  - `sorenessHigh`: the check-in soreness on the date of the group's **next** session after its last one of that
    week, via `DayCheckInPort`; no check-in → false. Default threshold = the scale's top two values.
  - Deficit: the adapter answers from the active weight goal's direction (target below start weight → true).

- [ ] **Step 1: Write the failing ITs**
  - `aTodayOnlySwapIsCounted`: 3 sets logged on a swapped-in row of a back exercise → back `logged` 3.
  - `exemptSetsAreNotCounted`; `skippedSetsAreNotCounted`; `weekOneIsEmpty`; `nothingLoggedIsAllZero`.
  - `topWorkloadAnswerIsTooMuch`; `jointPainTwoHolds`; `sorenessOnTheNextSessionDay`.
  - `EnergyBalanceAdapterIT`: `aCuttingGoalIsADeficit`, `noGoalIsNotADeficit`, `aGainingGoalIsNotADeficit`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. `EnergyBalancePort` follows `GoalRecomputePort`'s package and adapter pattern exactly.
- [ ] **Step 4:** Run `-Dtest='WeeklySignalReaderIT,EnergyBalanceAdapterIT,ArchitectureTest'`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(train): last week's signals per muscle, swaps and feedback included (mezo-r36n9.65)`.

### Task 8: The weekly proposal, applied automatically

**Files:**
- Create: `service/WeekProposalService.java`
- Modify: `service/VolumeProgressionService.java` (`rolloverIfDue` delegates; `lastWeekSignals` deleted)
- Test: `WeekProposalAutoIT.java` (replaces `VolumeProgressionServiceIT`, `VolumeProgressionTierIT`)

**Interfaces:**
- Consumes: `VolumeDecider.decide`, `SetSlots.pickUp/pickDown`, `WeeklySignalReader.read`,
  `EnergyBalancePort.isInDeficit`, `VolumeLedger.sync`, `MesoWeekProposalRepository`.
- Produces: `void WeekProposalService.generateIfDue(UUID createdBy, MesocycleEntity meso)` — called from
  `rolloverIfDue` (so still lazily from `getToday`), idempotent per calendar week via `volume_recompute.lastRun`
  **and** the unique index.
- Behaviour:
  1. Week ≤ `lastRun` → return.
  2. If the latest applied proposal carries `restore`, write those amounts back first (the week after a deload).
  3. Per trained counting group: `decide`. `UP`/`DOWN` deltas become one line per moved set via `SetSlots`, applied
     to a working copy so consecutive picks see each other; no slot → no line, the group's change is recorded with
     reason `NO_SLOT`. `DELOAD` → a line per counting exercise `sets → ⌈sets/2⌉` (min 1) and `restore` = the
     pre-deload amounts.
  4. Persist the proposal; in `auto` mode set every line `accepted`, write `exercise.working_sets`, fill
     `plan_after`, status `auto_applied`, `decidedAt = now`.
  5. `VolumeLedger.sync`; append a `ProvenanceEnvelope` adjustment per changed group as today; write
     `volume_recompute` (`lastRun`, `nextRun`, trigger `weekly-rollover`, `changes`) so the web readers keep working;
     set `currentWeek`.

- [ ] **Step 1: Write the failing IT** — each case builds a run, logs last week, moves the clock, calls `getToday`:
  - `weekOneChangesNothing`.
  - `emphasizedBackGainsTwo`: back 11 (4, 2, 3, 2), all done → 13; the two sets land on the 2-set exercises.
  - `inADeficitItGainsOne`.
  - `maintainedQuadStaysThree`.
  - `nothingLoggedLastWeekHolds`.
  - `noSlotIsReportedNotDropped`: every back exercise at 5 → no line, `volume_recompute.changes` carries the reason.
  - `deloadHalvesAndTheNextWeekRestores`: 4 → 2 in the deload week, 4 again the week after.
  - `aSecondOpenOfTheSameWeekChangesNothing`.
  - `lineForAVanishedExerciseIsDropped`: delete an exercise between generation and apply (call the two halves
    through a package-private seam) → that line `kept`, the others applied, no exception.
  - `gateOffNeverGenerates`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `-Dtest='WeekProposalAutoIT,VolumeArcContractIT,VolumeArcVolumeFlagIT,WorkoutTodayAmountIT'`.
  Expected: PASS.
- [ ] **Step 5:** Commit `feat(train): weekly per-exercise proposal, applied automatically (mezo-r36n9.65)`.

### Task 9: Kímélő step-back on amounts

**Files:**
- Modify: `service/RecoveryReturnService.java` (`apply` STEP_BACK branch and `revert`), `config/VolumeProperties.java`
  (remove the now-unread `step`)
- Test: the existing recovery-return IT (find it with `grep -rl "STEP_BACK" backend/src/test`) — its step-back and
  revert cases are rewritten to assert on `exercise.working_sets`.

**Interfaces:**
- Consumes: `SetSlots.pickDown`, `VolumeLedger.sync`.
- Produces: unchanged public behaviour. `RecoveryPeriodEntity.prevSets` (a `Map<String,Integer>`) now holds
  **exercise row id → sets before the step-back**; a pre-existing period whose map is keyed by muscle is detected by
  a key that is not a UUID and is reverted as a no-op for sets (its meso dates still revert).

- [ ] **Step 1:** Rewrite the two IT cases: `stepBackTakesOneSetPerTrainedGroup` (each group loses one set from its
  biggest exercise, never below 1, ledger follows), `revertRestoresEveryExercise`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the recovery ITs + `ArchitectureTest`. Expected: PASS.
- [ ] **Step 5:** Commit `fix(train): the kímélő step-back cuts exercise amounts (mezo-r36n9.65)`.

### Task 10: Migrating runs in flight

**Files:**
- Create: `runner/VolumeAmountMigrationRunner.java` (uses `runner/LegacySetDistribution.java` from Task 5)
- Modify: `service/TrainService.java` (`stampRun` stamps `volumeModel = 2`)
- Test: `VolumeAmountMigrationRunnerIT.java`

**Interfaces:**
- Produces: an `ApplicationRunner` (no profile, `@Order` after Liquibase, gated on `VolumeProgressionGate`): for
  every run with `volume_model = 1` and status `active` or `planned` — for an active one with ledger rows, write
  `LegacySetDistribution.effective(...)` into `exercise.working_sets`; then `VolumeLedger.sync`; set
  `volume_model = 2`. One transaction per run. Idempotent.

- [ ] **Step 1: Write the failing IT**
  - `effectiveSetsBecomeAmounts`: old-model run, quad log `current_sets` 8 with one 3-set exercise → after the
    runner the exercise has 8 and `getToday` shows 8 (what he saw yesterday).
  - `runAlreadyRolledOverIsNotSteppedAgain`: `volume_recompute.lastRun` = this week → after the runner and a
    `getToday`, no proposal exists for this week and the amounts are unchanged.
  - `secondRunIsANoOp`; `archivedRunsAreUntouched`; `newRunsAreStampedTwo`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `-Dtest='VolumeAmountMigrationRunnerIT,ArchitectureTest'`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(train): one-time migration of runs to the amount model (mezo-r36n9.65)`.

### Task 11: The goal guard reads the band

**Files:**
- Modify: `feature/goal/engine/service/GuardEvaluationService.java` (`evaluateMuscle`)
- Test: the guard's existing IT/unit test for the muscle leg (find with `grep -rl "belowMaintenance\|warnBelow" backend/src/test`)

**Interfaces:**
- Consumes: `MuscleGroupVolumeLogEntity.getBandLow()`.
- Produces: a muscle is "below maintenance" when `currentSets < bandLow`; a row with a null `bandLow` (a run not yet
  synced) falls back to today's `warn-below`. The note's wording keeps its shape, naming the band's low instead of
  the fixed 6.

- [ ] **Step 1:** Add `aMaintainedQuadAtThreeIsNotFlagged` (band 3–7, 3 sets → no note) and
  `aMuscleUnderItsBandIsFlagged` (band 14–22, 11 sets → note).
- [ ] **Step 2:** Run. Expected: the first FAILS (flagged at 3 < 6).
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the guard tests. Expected: PASS.
- [ ] **Step 5:** Commit `fix(goal): the muscle guard measures against the tier's band (mezo-r36n9.65)`.

### Task 12: Docs, gates, ship

**Files:**
- Modify: `docs/features/train.md` (§4 engines: the amount model, bands, the weekly proposal, the ledger; §9 traps;
  the stale lines named in the spec §7), `docs/features/README.md` row, `docs/milestones/roadmap.md` (dated entry),
  `docs/boop-handbook/07-edzes/{04-progresszio-motor,05-heti-volumen}.md`, `docs/boop-handbook/_jegyek.json`,
  `_kiadasok.json`, `_dontesek.json` (the eight owner decisions of spec §3), `docs/CODEMAP.md` (generated)

- [ ] **Step 1:** `./mvnw -q clean test -Dmezo.test.use-testcontainers=true` from `backend/`. Expected: BUILD
  SUCCESS, no `@Disabled` left with a task number of this plan.
- [ ] **Step 2:** `cd frontend && CI=true pnpm test` in both modes (`VITE_USE_MOCK` unset and `=false`) and
  `pnpm build`. Expected: green — nothing in the FE changed, this proves the unchanged contract.
- [ ] **Step 3:** Write the docs; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` → 0 errors, 0 stale.
- [ ] **Step 4:** Merge per AGENTS.md (`--no-ff`, push main), fast-forward the primary checkout, watch the `deploy`
  workflow to green, confirm the pod runs the release.
- [ ] **Step 5: Production check** (reads only):
  ```sql
  select volume_model from mesocycle where status = 'active';                       -- 2
  select e.name, e.working_sets from exercise e join workout_session ws on ws.id = e.workout_session_id
   join mesocycle m on m.id = ws.mesocycle_id where m.status = 'active' and ws.template_session_id is null
   and not e.is_deleted order by ws.order_index, e.order_index;                      -- unchanged from before deploy
  select muscle, current_sets, band_low, band_high from muscle_group_volume_log v
   join mesocycle m on m.id = v.mesocycle_id where m.status = 'active';              -- sums of the plan, bands by tier
  ```
  Capture the second query's output **before** the deploy and diff it after.
- [ ] **Step 6:** `node scripts/boop-notion-sync.mjs plan` → apply → `check` exits 0; `node
  scripts/check-beads-backup.mjs --fix`; commit; push; Hungarian report walking the list below.

## Kész, ha…

- A tulaj futó blokkjában az élesítés után minden gyakorlat pontosan annyi sorozatot ír ki, mint előtte (lekérdezéssel
  igazolva, előtte–utána).
- Egy izomra egyetlen, 3 sorozatos gyakorlatot tartalmazó terv 3 sorozatot ír ki, nem 8-at.
- A Hangsúly izom hétről hétre +2 (fogyásban +1) sorozatot kap a sávja tetejéig, a Tartás izom nem változik, a
  könnyített hét felez, és utána visszaáll.
- Az aznapra cserélt gyakorlat sorozatai beszámítanak a heti döntésbe.
- A webes app változatlanul működik: a frontend tesztek mindkét módban zöldek, kódváltozás nélkül.
- A teljes backend tesztkészlet zöld; `ArchitectureTest`, kódtérkép és dokumentum-ellenőrzés hibátlan.
- `train.md`, a kézikönyv két oldala, a mérföldkő-napló és a Notion tükör a kiadott állapotot írja le.
