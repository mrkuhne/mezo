# A napi keret a valódi mozgást követi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Fuel budget's Mozgás row credits the day's actually logged movement, plus a faint "még jön" pending preview. The Edzés energy card shows the same served number. The weekly learning engine consumes the same per-day movement. The Edzőnap-shift is retired.

**Architecture:**
- `WorkoutWindowQueryService.DayMovement` gains the logged planned-session kcal and today's pending kcal.
- `DayTargetProjector` serves `max(BMR, base + planned + extra + balance)` whenever an `EnergyBase` exists.
- `FuelDayEnergy` gains a nullable `pendingMovementKcal`.
- `ExpenditureLearningService` feeds `planned + extra` into the filter instead of the plan average.
- Rollout rides the existing `ActivityModelMigrationRunner` with `ActivityEnergyModel.VERSION` bumped to 3.
- The frontend reads the served numbers only. The Edzés card switches from its client-side estimate to `useFuelDay(today).fuel.energy`.

**Tech Stack:** Spring Boot 3 / Java 21, Liquibase (no changeset needed), OpenAPI contract-first (`api/`), React + TS + Vitest, MSW mocks.

**Spec:** [`docs/superpowers/specs/2026-09-28-actual-movement-budget-design.md`](../specs/2026-09-28-actual-movement-budget-design.md) · **Bead:** `mezo-tb3s2` · **Branch:** `feat/actual-movement-budget`

## Global Constraints

- **M1:** Mozgás = net kcal of the date's LOGGED sessions (planned + unplanned). Gym: `netKcal("gym", null, gymMinutes)`. Sport/run: the persisted `kcal`, where null contributes 0. An in-progress gym session does not count.
- **M2:** Pending is display-only. It is never added to the target, and it is computed only for `date >= LocalDate.now()`.
- **M3:** No damping factor. 100 % of the estimate.
- **M4:** Segments no longer carry `trainingDayKcal`/`restDayKcal`. `dayTypeShiftKcal` is accepted and ignored. The column stays.
- **M5:** The learning filter's `movementKcal(d)` = the served `plannedKcal + extraKcal`. The classifier fallback reference = `prevApplied + movement(d) + balance(d)`.
- **Target:** `target = max(BMR, base + movement + balance)`. `seg.kcal` stays only the carb-delta anchor: `carbs = seg.carbsG + (target − seg.kcal)/4`.
- **No base** (settings preview / config path): keep the old `seg.kcal + extra` behaviour.
- **Equation closes:** `base + planned + extra + balance = target`. The floor folds into `balance`.
- **User-facing copy:** Hungarian, verbatim from the spec §4 / the approved prototype. Never emoji; icons from the existing sprite.
- **FE:** takes numbers verbatim from the wire and never re-derives the target.
- **Gates:**
  - FE tests: `CI=true pnpm test`, and `CI=true VITE_USE_MOCK=false pnpm test`.
  - `pnpm build`.
  - Backend focused ITs, then the full suite with `-Dmezo.test.use-testcontainers=true`.
  - `node scripts/gen-codemap.mjs`.
  - `node scripts/lint-docs.mjs`.
- **Parallel session:** the kihagyás S1 (mezo-q4xt2.1) branch edits `docs/design_2.0/prototypes/elo/edzes.html`'s energy-card `E` line. On conflict, merge to `const E=dayState==='done'?[190,SK.volley?0:460]:[0,SK.volley?190:650];`.

---

### Task 1: `DayMovement` carries logged planned kcal and today's pending kcal

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutWindowQueryService.java:227-382`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/WorkoutWindowQueryServiceIT.java` (the `movementOn` nested block at ~:458-640)

**Interfaces:**
- Produces: `record DayMovement(boolean plannedDone, int plannedKcal, int extraKcal, int pendingKcal)` with `NONE = new DayMovement(false, 0, 0, 0)` and `int movementKcal()` returning `plannedKcal + extraKcal`.

- [ ] **Step 1: Write the failing ITs.** Add them to the existing `movementOn` nested class. Reuse its fixtures, and follow the existing tests at :485-564 for populator calls.

```java
@Test
void testMovementOn_shouldCreditPlannedGymKcal_whenMesoInstanceDone() {
    // planned meso gym on wed, 60 active minutes, body known (same setup as the (a) case)
    WorkoutWindowQueryService.DayMovement m = service.movementOn(owner, wed);
    assertThat(m.plannedDone()).isTrue();
    assertThat(m.plannedKcal()).isEqualTo(expectedGymNet60);   // ActivityEnergyModel.netKcal("gym", null, 60, rest)
    assertThat(m.movementKcal()).isEqualTo(m.plannedKcal() + m.extraKcal());
}

@Test
void testMovementOn_shouldCreditPlannedSportPersistedKcal() {
    // recurring volleyball slot on wed, logged session kcal=490
    assertThat(service.movementOn(owner, wed).plannedKcal()).isEqualTo(490);
}

@Test
void testMovementOn_shouldReportPendingOnlyForTodayOrLater() {
    LocalDate today = LocalDate.now();
    // gym slot + 120' volleyball slot on today's weekday, nothing logged
    WorkoutWindowQueryService.DayMovement now = service.movementOn(owner, today);
    assertThat(now.plannedKcal()).isZero();
    assertThat(now.pendingKcal()).isEqualTo(gymDefaultNet + volleyball120Net);
    assertThat(service.movementOn(owner, today.minusWeeks(1)).pendingKcal()).isZero();
}

@Test
void testMovementOn_shouldCountNullKcalSportAsZero() {
    // recurring slot matched by a session whose kcal is null (unknown body)
    WorkoutWindowQueryService.DayMovement m = service.movementOn(owner, wed);
    assertThat(m.plannedDone()).isTrue();
    assertThat(m.plannedKcal()).isZero();
}
```

Rewrite every existing assertion that constructs a 2-arg `DayMovement` (:606-607) to the 4-arg form with the now-known planned kcal.

- [ ] **Step 2: Run and confirm the tests fail.**
  - Run: `cd backend && ./mvnw -q test -Dtest=WorkoutWindowQueryServiceIT -Dmezo.test.use-testcontainers=true`
  - Expected: compile FAIL, because `plannedKcal()` is undefined.

- [ ] **Step 3: Implement.** Replace the record and its javadoc:

```java
/**
 * One date's movement (mezo-tb3s2, spec §2): the net kcal of the LOGGED sessions matched to a plan
 * ({@code plannedKcal}) and not matched ({@code extraKcal}); {@code pendingKcal} previews the date's
 * still-unlogged planned sessions at the moderate band — display only, and only for today or later.
 * {@code plannedDone} is kept for callers that only need adherence.
 */
public record DayMovement(boolean plannedDone, int plannedKcal, int extraKcal, int pendingKcal) {
    public static final DayMovement NONE = new DayMovement(false, 0, 0, 0);

    /** The served Mozgás: everything logged, planned or not (M1). */
    public int movementKcal() {
        return plannedKcal + extraKcal;
    }
}
```

In `movementForDay`:
- Keep `int plannedKcal = 0;`.
- **Gym, planned branch:** add `plannedKcal += activityEnergyModel.netKcal("gym", null, gymMinutes(instance), restKcalPerHour.get()).orElse(0);` before `continue`.
- **Sport, planned branch:** `plannedKcal += session.getKcal() != null ? session.getKcal() : 0;`
- **Run, planned branch:** `plannedKcal += run.getKcal() != null ? run.getKcal() : 0;`
- **Pending**, computed after the three loops:

```java
int pendingKcal = 0;
if (!date.isBefore(LocalDate.now())) {
    long gymLeft = Math.max(0, gymSlotCount - plannedGymCount);
    int gymEach = activityEnergyModel.netKcal("gym", null, props.gymDefaultMinutes(), restKcalPerHour.get()).orElse(0);
    pendingKcal += (int) gymLeft * gymEach;
    for (PlannedSport left : unmatchedSport) {
        int minutes = left.durationMin() != null ? left.durationMin() : props.gymDefaultMinutes();
        pendingKcal += activityEnergyModel.netKcal(left.sport(), null, minutes, restKcalPerHour.get()).orElse(0);
    }
    long runsLeft = Math.max(0, prescribedRunCount - plannedRunCount);
    int runEach = activityEnergyModel.netKcal("run", null, props.runDefaultMinutes(), restKcalPerHour.get()).orElse(0);
    pendingKcal += (int) runsLeft * runEach;
}
return new DayMovement(plannedDone, plannedKcal, extraKcal, pendingKcal);
```

Also:
- Update the `movementOn` javadoc: planned sessions now also credit their kcal, and pending is display-only. Remove the "D2–D4 … already priced into the weekly base" sentence.
- Update the rest-supplier comment. The supplier is now also used for planned gym and pending.

- [ ] **Step 4: Run and confirm the tests pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit.**
  - `feat(train): DayMovement credits logged planned kcal + today's pending preview (mezo-tb3s2)`
  - The build still fails in callers. Commit together with Task 2 if the compile is red: tasks 1–2 form one compile unit.

---

### Task 2: The served target follows the logged movement; the wire gains `pendingMovementKcal`

**Files:**
- Modify:
  - `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/DayTargetProjector.java`
  - `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/DailyTargets.java`
  - `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/FuelDayService.java:225-261` (the `energy()` mapper and javadocs)
  - `api/feature/meal/meal.yml:561-585`
  - regenerated `api/openapi.yml`
  - `frontend/src/data/_client/api.gen.ts`
  - `frontend/src/data/types.ts:325-340`
  - `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterSignalReads.java:847` (compile only)
- Test:
  - `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/DayTargetProjectorTest.java`
  - `backend/src/test/java/io/mrkuhne/mezo/feature/meal/FuelDayServiceIT.java`
  - `backend/src/test/java/io/mrkuhne/mezo/feature/meal/FuelDayDayTypeIT.java`

**Interfaces:**
- Consumes: `DayMovement(plannedDone, plannedKcal, extraKcal, pendingKcal)` from Task 1.
- Produces:
  - `DailyTargets.Energy(int baseKcal, int plannedMovementKcal, int extraMovementKcal, int balanceKcal, int targetKcal, Integer pendingMovementKcal, String baseSource, Integer formulaBaseKcal, Integer baseSdKcal, String baseConfidence)`
  - wire `FuelDayEnergy.pendingMovementKcal: integer, nullable`
  - FE `FuelDayEnergy.pendingMovementKcal?: number | null`

- [ ] **Step 1: Write the failing projector tests.** Replace the day-type/`planned(boolean)` cases in `DayTargetProjectorTest`. Setup:
  - Keep the existing `seg(...)` / `base(...)` helpers.
  - Add a helper `mv(int planned, int extra, int pending)` → `() -> new DayMovement(planned+extra>0, planned, extra, pending)`.
  - `base(bmr=1961, neat=2159)`; `seg(kcal=1816, balance=-769, carbs=161)`.

```java
@Test
void testProject_shouldServeBasePlusLoggedMovementPlusBalance() {
    DailyTargets t = DayTargetProjector.project(seg, base, mv(300, 490, 0), FALLBACK);
    assertThat(t.kcal()).isEqualTo(2159 + 790 - 769);            // 2180
    assertThat(t.energy().plannedMovementKcal()).isEqualTo(300);
    assertThat(t.energy().extraMovementKcal()).isEqualTo(490);
    assertThat(t.energy().balanceKcal()).isEqualTo(-769);
    assertThat(t.c()).isEqualTo(161 + Math.round((2180 - 1816) / 4f));
}

@Test
void testProject_shouldFloorAtBmrAndFoldIntoBalance_whenNothingLogged() {
    DailyTargets t = DayTargetProjector.project(seg, base, mv(0, 0, 650), FALLBACK);
    assertThat(t.kcal()).isEqualTo(1961);
    assertThat(t.energy().plannedMovementKcal() + t.energy().extraMovementKcal()).isZero();
    assertThat(t.energy().balanceKcal()).isEqualTo(1961 - 2159);   // −198
    assertThat(t.energy().pendingMovementKcal()).isEqualTo(650);
}

@Test
void testProject_shouldIgnoreLegacySplit() {
    // segment carrying trainingDayKcal=2000/restDayKcal=1700 must serve exactly as without them
}

@Test
void testProject_shouldKeepSegKcalPlusExtra_whenNoEnergyBase() {
    DailyTargets t = DayTargetProjector.project(seg, null, mv(300, 490, 0), FALLBACK);
    assertThat(t.kcal()).isEqualTo(1816 + 490);
    assertThat(t.energy()).isNull();
}
```

Keep the laziness test at :57 (no base and no segment → supplier untouched).

- [ ] **Step 2: Run and confirm the tests fail.**
  - Run: `cd backend && ./mvnw -q test -Dtest=DayTargetProjectorTest`
  - Expected: FAIL.

- [ ] **Step 3: Implement `DayTargetProjector.project`.** Keep the null / legacy early returns.

```java
WorkoutWindowQueryService.DayMovement m = movement.get();
int segBalance = seg.dailyEnergyBalanceKcal() != null ? seg.dailyEnergyBalanceKcal() : 0;
int kcal;
if (base != null) {
    int baseKcal = base.neatBaselineKcal().setScale(0, RoundingMode.HALF_UP).intValueExact();
    kcal = Math.max(baseKcal + m.movementKcal() + segBalance,
        base.bmr().setScale(0, RoundingMode.HALF_UP).intValueExact());
} else {
    kcal = seg.kcal() + m.extraKcal();   // no base (settings preview): the pre-mezo-tb3s2 shape
}
int carbDeltaG = Math.round((kcal - seg.kcal()) / 4f);
return new DailyTargets(kcal,
    seg.proteinG() != null ? seg.proteinG() : fallback.p(),
    (seg.carbsG() != null ? seg.carbsG() : fallback.c()) + carbDeltaG,
    seg.fatG() != null ? seg.fatG() : fallback.f(),
    "goal", energy(base, m, kcal));
```

```java
/** Alap + Mozgás (logged planned + extra) + Célod = target; the BMR floor lands in Célod. */
private static DailyTargets.Energy energy(EnergyBase base, WorkoutWindowQueryService.DayMovement m, int target) {
    if (base == null) {
        return null;
    }
    int baseKcal = base.neatBaselineKcal().setScale(0, RoundingMode.HALF_UP).intValueExact();
    int balance = target - baseKcal - m.plannedKcal() - m.extraKcal();
    return new DailyTargets.Energy(baseKcal, m.plannedKcal(), m.extraKcal(), balance, target,
        m.pendingKcal() > 0 ? m.pendingKcal() : null,
        base.baseSource(), base.formulaBaseKcal(), base.sdKcal(), base.confidence());
}
```

Then:
- Rewrite the class javadoc formula block to the spec §2 form.
- Add `Integer pendingMovementKcal` to `DailyTargets.Energy` after `targetKcal`, and update its javadoc.
- Fix every `new DailyTargets.Energy(` call site. Find them with `grep -rn "new DailyTargets.Energy(" backend/src`.

- [ ] **Step 4: Contract.** In `api/feature/meal/meal.yml` `FuelDayEnergy`:
  - Add `pendingMovementKcal: { type: integer, nullable: true, description: 'Today''s planned but not yet logged sessions at the moderate band (mezo-tb3s2) — display only, never in targetKcal.' }`.
  - Rewrite the description: plannedMovementKcal is "the LOGGED planned sessions' net kcal" (no longer the weekly share).
  - Regenerate with the repo's bundling script (see `api/README.md`, "regenerate" section). Then run `cd frontend && pnpm gen:api` (or the script named in `frontend/package.json` that writes `src/data/_client/api.gen.ts`).
  - Add `pendingMovementKcal?: number | null` to `frontend/src/data/types.ts` `FuelDayEnergy`, with its jsdoc.
  - Map it in `FuelDayService.energy()`: `.pendingMovementKcal(e.pendingMovementKcal())`.
  - Update the `FuelDayService` javadocs at :54 and :247 (no day-type pick; logged movement credited).

- [ ] **Step 5: ITs.**
  - Rewrite `FuelDayDayTypeIT` into `FuelDayMovementIT`, with a class javadoc that points at the spec. Delete the day-type assertions and assert:
    - (a) a done planned meso gym plus a logged 490-kcal planned volleyball give energy planned = gym net + 490, extra 0, target = base + planned + balance;
    - (b) today with nothing logged: target = max(BMR, base + balance) and `pendingMovementKcal` > 0;
    - (c) a past day carries null pending.
  - In `FuelDayServiceIT`, update the energy expectations the same way.
  - Run: `./mvnw -q test -Dtest='DayTargetProjectorTest,FuelDayMovementIT,FuelDayServiceIT,WorkoutWindowQueryServiceIT' -Dmezo.test.use-testcontainers=true`
  - Expected: PASS.

- [ ] **Step 6: Commit.**
  - `feat(fuel): served target = base + logged movement + balance; pendingMovementKcal on the wire (mezo-tb3s2)`

---

### Task 3: Retire the day-type split and refresh the rationale

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalProjectionService.java:130-180,280-334,440-446`
- Delete:
  - `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/DayTypeShiftCalculator.java`
  - `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/DayTypeShiftCalculatorTest.java`
- Test:
  - `GoalProjectionServiceIT`
  - `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/DietSettingsDayTypeShiftIT.java`
  - `DietSettingsApiIT`

**Interfaces:**
- Produces: segments with `trainingDayKcal == null && restDayKcal == null` always, and the new rationale strings.

- [ ] **Step 1: Failing tests.**
  - In `GoalProjectionServiceIT`, replace the split assertions with: every segment has null `trainingDayKcal`/`restDayKcal`, even with `dayTypeShiftKcal = 200` and 5 training days.
  - Assert the rationale equals `"Nincs futóblokk → a napi keret az Alapod + az aznapi mozgásod (amit logolsz) + a célod."`.
  - With a run block, assert the rationale equals `"Futóblokk aktív → a napi keret az Alapod + az aznapi mozgásod (amit logolsz, a futást is) + a célod."`.
  - Rename `DietSettingsDayTypeShiftIT` to assert that saving `dayTypeShiftKcal = 300` persists the value and leaves the recomputed segments split-free.

- [ ] **Step 2: Run and confirm they fail.**
  - `./mvnw -q test -Dtest='GoalProjectionServiceIT,DietSettingsDayTypeShiftIT' -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implement.** In `buildSegment`:
  - Delete the `trainingDays` / `DayTypeShiftCalculator.split` block (:309-317).
  - Pass `null, null` for `trainingDayKcal, restDayKcal` into `ProjectionSegment`.
  - Remove the now-unused `scheduledDays` / `links` / `runs` / `dayTypeShiftKcal` parameters. Also remove `runDayOfWeeks` if it becomes unused. Keep the public `project(...)` signature's `dayTypeShiftKcal` parameter only if an external caller needs it; otherwise remove it and fix `GoalPrescriptionCalculator.java:83` and `GoalEngineService.previewActiveGoalSegment`.
  - Replace `rationale(...)`:

```java
private String rationale(WeekLoad ld, BigDecimal runEat) {
    if (ld.runActive()) {
        return "Futóblokk aktív → a napi keret az Alapod + az aznapi mozgásod (amit logolsz, a futást is) + a célod.";
    }
    return "Nincs futóblokk → a napi keret az Alapod + az aznapi mozgásod (amit logolsz) + a célod.";
}
```

  - Update the class javadoc (:37-67). Segment TDEE stays base + expected weekly movement as the planning number, and the day is served from logged movement (spec §2).
  - Delete `DayTypeShiftCalculator` and its test.
  - Keep `DietPreferences.dayTypeShiftKcal` and the entity column. Add a javadoc line to `DietPreferences`: "accepted and ignored since mezo-tb3s2 (M4); column drop is a follow-up".

- [ ] **Step 4: Run and confirm they pass.** Same command, plus `-Dtest=DietSettingsApiIT`.

- [ ] **Step 5: Commit.**
  - `feat(goal): retire the day-type kcal split; rationale names the day's logged movement (mezo-tb3s2)`

---

### Task 4: Learning consumes the served movement

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/ExpenditureLearningService.java:176-240,276-300`
- Modify (javadoc only): `ExpenditureFilter.java:28-32`, `ExpenditureExplainer.java:58`
- Test:
  - `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/ExpenditureLearningServiceIT.java`
  - `ExpenditureLearningServiceTest`

**Interfaces:**
- Consumes: `DayMovement.movementKcal()` (Task 1).

- [ ] **Step 1: Failing IT.** Add to `ExpenditureLearningServiceIT`:

```java
@Test
void testReviewWeek_shouldFeedLoggedMovement_notPlanAverage() {
    // learner with a goal whose bootstrap weeklyEat = 426; a week with a scheduled but SKIPPED gym
    // day and a logged 490-kcal volleyball day
    ExpenditureEstimateEntity row = service.reviewWeek(owner, weekStart).orElseThrow();
    // the explanation's per-day movement equals the served movement: 0 on the skipped day, 490 + gym on the logged day
    assertThat(row.getExplanation().avgMovementKcal()).isEqualTo(expectedAvgOfServedMovement);
}

@Test
void testReviewWeek_shouldNotLowerBase_whenPlannedSessionSkipped() {
    // two otherwise-identical weeks, one with a skipped planned session:
    // appliedBaseKcal must be equal (the skip no longer charges 426 unspent kcal to B)
}
```

Use the existing IT fixtures for intake and weigh-ins. Follow the pattern of the nearest current `reviewWeek` test in the file.

- [ ] **Step 2: Run and confirm it fails.**
  - `./mvnw -q test -Dtest=ExpenditureLearningServiceIT -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implement.** In `replay`:
  - Fetch `movement` via `workoutWindows.movementBetween(userId, windowStart.minusDays(e.referenceDays()), weekEnd)` **before** the classifier call, so the classifier can read it.
  - Change the classifier reference lambda to `d -> prevApplied + movement.getOrDefault(d, DayMovement.NONE).movementKcal() + balanceOn(goal, d)`.
  - Change the filter day's movement argument from `planEat + m.extraKcal()` to `m.movementKcal()`.
  - In `dayStatuses`, fetch `movementBetween(userId, refWindowStart, to)` inside the `basis.isPresent()` branch, and set `fallbackRefKcal = d -> fallbackBase + mv.getOrDefault(d, DayMovement.NONE).movementKcal();`.
  - Remove `planEat` from `GoalBasis` if it becomes unused.
  - Update the javadocs:
    - `ExpenditureFilter.Day.movementKcal`: "the day's served logged movement (planned + extra, mezo-tb3s2)".
    - `ExpenditureExplainer.avgMovementKcal`: "daily average of the logged movement".

- [ ] **Step 4: Run.**
  - `./mvnw -q test -Dtest='ExpenditureLearningServiceIT,ExpenditureLearningServiceTest,ExpenditureFilterTest,ExpenditureExplainerTest,LearnedBaseResolverTest' -Dmezo.test.use-testcontainers=true`
  - Expected: PASS. Update any expectation that pinned `planEat`-based numbers, with a comment citing mezo-tb3s2.

- [ ] **Step 5: Commit.**
  - `feat(goal): learned expenditure consumes the served logged movement (mezo-tb3s2)`

---

### Task 5: Rollout — VERSION 3 re-chains learning and re-evaluates goals

**Files:**
- Modify:
  - `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/ActivityEnergyModel.java:26`
  - `backend/src/main/java/io/mrkuhne/mezo/feature/goal/ActivityModelMigrationRunner.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/ActivityModelMigrationRunnerIT.java`

**Interfaces:**
- Consumes: `ExpenditureLearningService.rechainFrom(UUID, LocalDate)` and `ExpenditureEstimateRepository.findByCreatedByAndWeekStartGreaterThanEqualAndDeletedFalseOrderByWeekStartAsc(UUID, LocalDate)`.

- [ ] **Step 1: Failing IT.** Add to `ActivityModelMigrationRunnerIT`:
  - A goal whose bootstrap has `activityModel = 2` and a trainingDayKcal split, plus two `expenditure_estimate` rows. After `runner.run()`:
    - `activityModel == 3`;
    - the segments are split-free;
    - both estimate rows were re-fitted: `updatedAt` advanced, or `appliedBaseKcal` equals a fresh `replay` result.
  - A second `runner.run()` evaluates 0 goals. Assert via the log counts, or by spying that the goal's `computedAt` did not change.
  - One goal whose owner's re-chain throws is skipped, and the other goal is still migrated.

- [ ] **Step 2: Run and confirm it fails.**
  - `./mvnw -q test -Dtest=ActivityModelMigrationRunnerIT -Dmezo.test.use-testcontainers=true`

- [ ] **Step 3: Implement.** Bump the version, with a comment:

```java
/** 3 = mezo-tb3s2: the served day credits logged movement and learning consumes it (re-chain on rollout). */
public static final int VERSION = 3;
```

Inject `ExpenditureLearningService expenditureLearning` and `ExpenditureEstimateRepository estimates` into the runner. Inside the per-goal try, before `evaluate`:

```java
estimates.findByCreatedByAndWeekStartGreaterThanEqualAndDeletedFalseOrderByWeekStartAsc(
        g.getCreatedBy(), LocalDate.of(2000, 1, 1)).stream()
    .findFirst()
    .ifPresent(first -> expenditureLearning.rechainFrom(g.getCreatedBy(), first.getWeekStart()));
goalEngineService.evaluate(g.getCreatedBy(), g.getId());
```

  - Add `rechained` to the log line.
  - Update the class javadoc (v3 = mezo-tb3s2).
  - ArchUnit: the runner lives in `feature/goal` and `ExpenditureLearningService` in `feature/goal/engine/service`. That is the same feature, so no port is needed.
  - Check for a circular bean with `ExpenditureLearningService → GoalEngineService`. The runner depends on both, and neither depends on the runner, so there is no cycle.

- [ ] **Step 4: Run and confirm it passes.** Same command, then `-Dtest=ArchitectureTest`, or whatever the ArchUnit test class is called (find it with `grep -rl ArchRule backend/src/test | head -1`).

- [ ] **Step 5: Commit.**
  - `feat(goal): activity model v3 rollout re-chains learning and re-evaluates goals (mezo-tb3s2)`

---

### Task 6: Fuel budget hero — Mozgás = ma logolt, the pending line and the footer

**Files:**
- Modify:
  - `frontend/src/features/fuel/logic/buildDayPlan.ts:136-160` (`DayBudget.energy.pending`, `servedBudget`)
  - `frontend/src/features/fuel/logic/keretHero.ts:29-31,127-131`
  - `frontend/src/features/fuel/components/FuelEnergyHero.tsx:54-80,150-166`
  - the FuelEnergyHero stylesheet (the file that defines `.fmx-node`; find it with `grep -rl "fmx-node" frontend/src --include=*.css`)
- Test:
  - `frontend/src/features/fuel/logic/keretHero.test.ts`
  - `frontend/src/features/fuel/components/FuelEnergyHero.test.tsx`
  - `frontend/src/features/fuel/logic/buildDayPlan.test.ts`

**Interfaces:**
- Consumes: `FuelDayEnergy.pendingMovementKcal` (Task 2).
- Produces:
  - `DayBudget.energy.pending: number` (0 when absent)
  - `KeretHeroVM.chips.pending: number`

- [ ] **Step 1: Failing tests.**
  - `buildDayPlan.test.ts`: `servedBudget(targets, {…, pendingMovementKcal: 650})` → `energy.pending === 650`; with it absent → 0.
  - `keretHero.test.ts`: the chips carry `pending`.
  - `FuelEnergyHero.test.tsx`:

```tsx
it('names the Mozgás row as today\'s logged movement and previews the pending sessions', () => {
  renderHero({ chips: { base: 2480, activity: 190, extra: 0, balance: -400, pending: 460 } })
  expect(screen.getByText('ma logolt mozgásod')).toBeInTheDocument()
  expect(screen.getByText('még jön +460, ha megcsinálod')).toBeInTheDocument()
})
it('hides the pending line when nothing is pending and on a past day', () => { /* pending 0 → queryByText(/még jön/) null */ })
it('appends the unplanned credit wording', () => { /* extra 95 → 'ma logolt mozgásod + terven kívüli' */ })
it('reads the new footer', () => {
  expect(screen.getByText(/a mai mozgásod együtt adja — a keret akkor nő, amikor logolod az edzést/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run and confirm they fail.**
  - `cd frontend && CI=true pnpm vitest run src/features/fuel/components/FuelEnergyHero.test.tsx src/features/fuel/logic/keretHero.test.ts src/features/fuel/logic/buildDayPlan.test.ts`
  - Note: if the file filters do not scope (known trap), run the whole suite and read the FuelEnergyHero results.

- [ ] **Step 3: Implement.**
  - `servedBudget`: `pending: energy.pendingMovementKcal ?? 0`. The static branch sets `pending: 0`. Add `pending: number` to `DayBudget.energy`.
  - `keretHero.ts`: add `pending: budget.energy.pending` to the chips, and update the type comment.
  - `FuelEnergyHero.tsx`:

```tsx
activity: { color: 'var(--sage)', icon: 'i-edzes', sub: 'ma logolt mozgásod' },
```

```tsx
if (line.key === 'activity' && vm.chips?.extra) return `${NODE.activity.sub} + terven kívüli`
```

In the non-weekly node render, after `<small>{nodeSub(...)}</small>`:

```tsx
{line.key === 'activity' && !past && (vm.chips?.pending ?? 0) > 0 && (
  <small className="fmx-node-pend">még jön +{huInt(vm.chips!.pending)}, ha megcsinálod</small>
)}
```

Footer:

```tsx
<p className="fmx-glass-note">
  A keretet az alapigényed, a súlycélod és a mai mozgásod együtt adja — a keret akkor nő, amikor
  logolod az edzést.
</p>
```

CSS, matching the prototype's `.node small.pend`:

```css
.fmx-node-pend{margin-top:3px;display:inline-block;padding:1px 7px;border-radius:999px;
  border:1px dashed color-mix(in srgb,var(--node-color) 45%,transparent);
  color:color-mix(in srgb,var(--node-color) 60%,var(--faint))}
```

- [ ] **Step 4: Run and confirm they pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit.**
  - `feat(fuel): budget hero names today's logged movement + pending preview (mezo-tb3s2)`

---

### Task 7: The "Részletesen" sheet — logged sessions and pending tiles

**Files:**
- Modify:
  - `frontend/src/features/fuel/logic/buildEnergyBreakdown.ts:17-75`
  - `frontend/src/features/fuel/sheets/EnergyBreakdownSheet.tsx:40-50,130-240`
  - `frontend/src/data/fuel/timelineHooks.ts` (the `buildEnergyBreakdown` caller: pass the done flags)
- Test:
  - `frontend/src/features/fuel/logic/buildEnergyBreakdown.test.ts`
  - `frontend/src/features/fuel/sheets/EnergyBreakdownSheet.test.tsx`

**Interfaces:**
- Consumes: `DayBudget.energy.pending` (Task 6).
- Produces: `EnergyBreakdown.movement = { kcal, isWeeklyAvg: false, parts, pending: number, blocks }`. Each `EnergyBlock` gains `done: boolean`.

- [ ] **Step 1: Failing tests.**
  - `buildEnergyBreakdown.test.ts`:
    - `movement.isWeeklyAvg === false`;
    - parts = `[{key:'planned', label:'Tervezett edzés · logolva', kcal: planned}]`, plus an extra part when `extra > 0`;
    - `movement.pending === energy.pending`.
  - `EnergyBreakdownSheet.test.tsx`:
    - the lead reads `A napi cél nem statikus — az alapigényedből, a ma logolt mozgásodból és a célodból áll össze.`;
    - with pending > 0, the label `Még jön, ha megcsinálod · a keretben még nincs benne` is shown;
    - the why-copy contains `akkor nő, amikor rögzíted`.

- [ ] **Step 2: Run and confirm they fail.**
  - `CI=true pnpm vitest run src/features/fuel/logic/buildEnergyBreakdown.test.ts src/features/fuel/sheets/EnergyBreakdownSheet.test.tsx`

- [ ] **Step 3: Implement.**
  - `buildEnergyBreakdown` input `blocks: (PlannerBlock & { done?: boolean })[]`. Set:
    - `isWeeklyAvg: false`
    - `pending: energy.pending ?? 0`
    - parts label `'Tervezett edzés · logolva'`
    - each block `done: Boolean(b.done)`
  - Update the function javadoc.
  - In `timelineHooks.ts`, pass `done` for each block from the same done-state the Fuel timeline already derives for its blocks (`deriveBlocks`; see `timelineHooks.ts:109,151-153`).
  - `EnergyBreakdownSheet`:
    - The lead copy uses the `!isWeeklyAvg` wording above.
    - The movement section header is `Mozgás · ma logolva`.
    - The info row shows done blocks as normal tiles and not-done blocks as `is-pending` tiles (`name={b.label}`, `sub={`tervezett · ${b.min} perc`}`, `value={`+${nf(b.kcal)}`}`), under the einfo label `Még jön, ha megcsinálod · a keretben még nincs benne`. The pending group renders only when `movement.pending > 0`.
    - Replace the why-copy with the prototype text: `A keret <b>akkor nő, amikor rögzíted</b> az edzést — a tervezett, még meg nem csinált edzés csak halványan látszik. A becslés a nyugalmi energiád feletti többletet számolja; ha rendszeresen túl- vagy alábecsül, a heti tanulás kiigazítja az alapodat.`
    - CSS: `.flp-etile.is-pending{opacity:.55;background:none;box-shadow:inset 0 0 0 1px rgba(245,239,230,.14)}`.
  - Remove the now-dead `movement.parts ? 'a heti edzésterved mai részéből'` branch. Keep the Én-page `isWeeklyAvg: true` path intact if the Én TDEE sheet still uses it: `grep -rn "isWeeklyAvg" frontend/src`.

- [ ] **Step 4: Run and confirm they pass.** Same command.

- [ ] **Step 5: Commit.**
  - `feat(fuel): energy sheet lists today's logged sessions and pending ones (mezo-tb3s2)`

---

### Task 8: The Edzés card reads the served energy

**Files:**
- Modify:
  - `frontend/src/features/train/pages/TrainTodayPage.tsx:303-345,710-745`
  - the Train page stylesheet containing `.trm-energy-split` (find it with `grep -rl "trm-energy-split" frontend/src`)
- Modify or delete: `frontend/src/features/train/logic/trainDayEnergy.ts`. Delete it only if the page is its sole importer: `grep -rn "trainDayEnergy" frontend/src`.
- Test:
  - `frontend/src/features/train/pages/TrainTodayPage.test.tsx`
  - `frontend/src/features/train/logic/trainDayEnergy.test.ts` (delete with the module)

**Interfaces:**
- Consumes: `useFuelDay()` from `@/data/hooks` → `fuel.energy` (the FE `FuelDayEnergy`, including `pendingMovementKcal`).

- [ ] **Step 1: Failing tests** in `TrainTodayPage.test.tsx`. Never hard-code the kcal numbers. Derive the expected values from the fixture the mode serves: mock mode reads `fuelDayEnergy` from `@/data/fuel/fuel`, real mode reads the `test/msw/handlers.ts` fuel-day fixture (planned 190, extra 0, pending 460). For the pending case, override the MSW handler with `server.use(...)` so it returns `pendingMovementKcal: 460`. The literals below illustrate the real-mode fixture.

```tsx
it('shows the served logged movement and the pending preview on the energy card', async () => {
  renderPage()
  const card = await screen.findByRole('region', { name: /Amit a mozgásod hozzáad/ })
  expect(within(card).getByText('+190')).toBeInTheDocument()
  expect(within(card).getByText(/190 kcal/)).toBeInTheDocument()
  expect(within(card).getByText(/már a keretedben/)).toBeInTheDocument()
  expect(within(card).getByText(/\+460 kcal/)).toBeInTheDocument()
  expect(within(card).getByText(/még jön, ha megcsinálod/)).toBeInTheDocument()
  expect(within(card).getByText(/Ugyanez a szám áll a Fuel keretében\. Becslés, nem mérés\./)).toBeInTheDocument()
})
it('adds the in-progress note while a gym session is open', () => { /* open workout → 'A folyamatban lévő edzés a befejezéskor kerül a keretedbe.' */ })
it('shows no card when there is no served energy and no pending/logged movement', () => { /* static path → card absent */ })
```

If the section has no accessible name, add `aria-label="Amit a mozgásod hozzáad"` to the `<section>`.

- [ ] **Step 2: Run and confirm they fail.** Run the whole suite (`CI=true pnpm test`) and read the TrainTodayPage results.

- [ ] **Step 3: Implement.** In `TrainTodayPage`:
  - `const { fuel: fuelToday } = useFuelDay()`
  - `const served = isTodayShown ? fuelToday.energy : null`
  - `const earned = served ? served.plannedMovementKcal + served.extraMovementKcal : 0`
  - `const pending = served?.pendingMovementKcal ?? 0`
  - Render the card when `isTodayShown && served && (earned > 0 || pending > 0)`.
  - Remove `energyBlocks`, `dayEnergy`, `energyCardPendingGym` and the now-unused gym-minutes/restPerHour code, but only where nothing else uses them. `restPerHour` and `gymMinutesToday` may feed the muscle card or the poster, so check before deleting.

```tsx
<section className="trm-energy glass" aria-label="Amit a mozgásod hozzáad" style={{ '--c': 'var(--dv-amber)', '--i': 1 } as CSSProperties}>
  <div className="trm-chead">…unchanged…</div>
  <div className="trm-energy-main"><b>+</b><strong>{earned}</strong><small>kcal</small></div>
  <div className="trm-esplit" aria-hidden="true">
    <b style={{ width: `${earned + pending > 0 ? (earned / (earned + pending)) * 100 : 0}%` }} />
    <i />
  </div>
  <div className="trm-energy-split">
    <span><i className="done" /><b>{earned} kcal</b> már a keretedben</span>
    {pending > 0 && <span><i className="plan" /><b>+{pending} kcal</b> még jön, ha megcsinálod</span>}
  </div>
  <p className="trm-energy-note">
    {todaySession?.openWorkout ? 'A folyamatban lévő edzés a befejezéskor kerül a keretedbe. ' : ''}
    Ugyanez a szám áll a Fuel keretében. Becslés, nem mérés.
  </p>
</section>
```

  - Drop the "Ha megadod a súlyod…" empty branch. The static path now hides the card, per the spec (the card appears only with served energy).
  - Update the card comment to cite mezo-tb3s2.

- [ ] **Step 4: Run and confirm they pass.** `CI=true pnpm test`, then `CI=true VITE_USE_MOCK=false pnpm test`.

- [ ] **Step 5: Commit.**
  - `feat(train): energy card shows the served logged movement + pending (mezo-tb3s2)`

---

### Task 9: Settings, labels and mocks

**Files:**
- Modify:
  - `frontend/src/features/fuel/pages/FuelSettingsPage.tsx:92-140,340-352`
  - `frontend/src/features/fuel/sheets/LearnedBaseExplainer.tsx:127`
  - `frontend/src/features/me/sheets/BiometricSheet.tsx:160`
  - `frontend/src/features/me/logic/buildTdeeBreakdown.ts:18`
  - `frontend/src/features/me/logic/goalOverviewCopy.ts:34`
  - `frontend/src/data/fuel/fuel.ts:424-452`
  - `frontend/src/test/msw/handlers.ts:87`
  - `frontend/src/data/me/goals.ts:145-165,452-455`
  - `frontend/src/data/fuel/fuelConfig.ts` or wherever the mock diet settings live (`grep -rn "dayTypeShiftKcal" frontend/src/data`)
- Test:
  - `FuelSettingsPage.test.tsx`
  - `LearnedBaseExplainer.test.tsx`
  - `buildTdeeBreakdown.test.ts`
  - `timelineHooks.test.tsx`
  - `buildDayPlan.test.ts`
  - `frontend/tests/layout/*` specs that touch the Fuel settings or the equation box (`grep -rln "Edzőnap\|heti edzésterved" frontend/tests`)

- [ ] **Step 1: Failing tests.**
  - `FuelSettingsPage.test.tsx`: `expect(screen.queryByText('Edzőnap-shift')).toBeNull()`, and save still sends the stored `dayTypeShiftKcal` unchanged.
  - `LearnedBaseExplainer.test.tsx`: the label `logolt mozgás, napi átlag`.
  - `buildTdeeBreakdown.test.ts`: the label `Tervezett mozgás · heti átlag`.

- [ ] **Step 2: Run and confirm they fail.** Run the full suite.

- [ ] **Step 3: Implement.**
  - `FuelSettingsPage`:
    - Remove the `NumberStepper label="Edzőnap-shift"` block and its help text.
    - Keep the `dayTypeShiftKcal` state only as a pass-through of `diet.dayTypeShiftKcal`: send the stored value on save, with no UI.
    - Remove it from the dirty check.
  - `LearnedBaseExplainer.tsx:127`: replace the sub copy `edzések + terven kívüli mozgás, napi átlag` with `logolt mozgás, napi átlag`.
  - `BiometricSheet.tsx:160` label and `buildTdeeBreakdown.ts:18`: `Tervezett mozgás · heti átlag`.
  - `goalOverviewCopy.ts:34`: the sentence reads `…az alapigényed, a súlycélod és az aznapi mozgásod együtt adja`. Keep the surrounding wording.
  - Mock served day in `data/fuel/fuel.ts`. Replace the derivation block with:

```ts
// The served day (mezo-tb3s2) for the mock, derived the way DayTargetProjector serves it: base (the
// learned seed) + today's LOGGED movement (the done meso gym, 58′ net, + 90′ RPE 6.6 volleyball as
// off-plan extra) + the segment's balance, floored at BMR; the still-unlogged sessions are pending.
const MOCK_BASE_KCAL = LAST_WEEK.appliedBaseKcal
const MOCK_REST = restKcalPerHour(MOCK_BMR)
const MOCK_PLANNED_KCAL = netKcal('gym', null, 58, MOCK_REST) ?? 0
const MOCK_EXTRA_KCAL = netKcal('volleyball', 6.6, 90, MOCK_REST) ?? 0
const MOCK_BALANCE_RAW = MOCK_SEGMENT.dailyEnergyBalanceKcal ?? 0
const MOCK_TARGET_KCAL = Math.max(MOCK_BMR, MOCK_BASE_KCAL + MOCK_PLANNED_KCAL + MOCK_EXTRA_KCAL + MOCK_BALANCE_RAW)
export const fuelDayEnergy: FuelDayEnergy = {
  baseKcal: MOCK_BASE_KCAL,
  plannedMovementKcal: MOCK_PLANNED_KCAL,
  extraMovementKcal: MOCK_EXTRA_KCAL,
  balanceKcal: MOCK_TARGET_KCAL - MOCK_BASE_KCAL - MOCK_PLANNED_KCAL - MOCK_EXTRA_KCAL,
  targetKcal: MOCK_TARGET_KCAL,
  pendingMovementKcal: null,
  baseSource: 'learned',
  formulaBaseKcal: LAST_WEEK.formulaBaseKcal,
  baseSdKcal: LAST_WEEK.posteriorSdKcal,
  baseConfidence: LAST_WEEK.confidence,
}
```

  Also apply the carb derivation (`segment carbs + (target − segment kcal)/4`) wherever the file computes mock carbs.
  - Update the `test/msw/handlers.ts:87` fixture comment and values so the equation closes. Base 2579, planned 190, extra 0, balance 331, target 3100, `pendingMovementKcal: 460`. Balance 331 because 2579 + 190 + 331 = 3100.
  - In `data/me/goals.ts`, set the mock segments' `trainingDayKcal` / `restDayKcal` to `null` at :145-165 and :452-455. Also set `dayTypeShiftKcal` in the mock diet settings to 0, with the M4 comment.
  - Fix every test that pinned the old mock numbers. Recompute expected values from the new derivation; do not hard-code guesses.

- [ ] **Step 4: Run and confirm everything passes.**
  - `CI=true pnpm test`
  - `CI=true VITE_USE_MOCK=false pnpm test`
  - `pnpm build`
  - the affected `frontend/tests/layout` specs (see `frontend/tests/layout/README.md` or `package.json` for the run command)

- [ ] **Step 5: Commit.**
  - `feat(fuel): retire the Edzőnap-shift control; movement labels and mocks follow logged movement (mezo-tb3s2)`

---

### Task 10: Docs, codemap and the living prototypes

**Files:**
- Modify:
  - `docs/features/fuel.md`: §4 energy contract (~:356), §5 served-target rule (~:432, :450), §8 testing (~:537-539), §9 (~:582-583, :628)
  - `docs/features/goal-engine.md`: §3 (~:54-55), TdeeBootstrap/Projection (~:67-68), rollout (~:113), learned expenditure (~:160, :168, :172), §4 (~:213), §5 (~:296). Also fix the stale lines recon flagged: the signature takes `restKcalPerHour`, the "MET×kg×óra" wording, and the skipped-session "correctly lowers B" claim.
  - `docs/features/train.md`: the energy card section
  - `docs/features/me.md`: the TDEE label
  - `docs/features/README.md`: the fuel/goal rows (status + route)
  - `docs/milestones/roadmap.md`: a dated entry, 2026-09-28 (or the ship date)
  - `docs/design_2.0/prototypes/elo/README.md`: the Fuel and Edzés rows' "Last synced" note
  - `docs/CODEMAP.md`: regenerate it

- [ ] **Step 1: Update each doc section.** State the new rule in one place (`fuel.md` §5, which cites the spec) and link to it from the others. Record the removal of `DayTypeShiftCalculator` and the M4 retirement.

- [ ] **Step 2: Run.**
  - `node scripts/gen-codemap.mjs`
  - `node scripts/lint-docs.mjs`
  - Expected: `0 errors / 0 stale`.

- [ ] **Step 3: Commit.**
  - `docs: actual-movement budget in fuel/goal-engine/train/me docs, index, roadmap, codemap (mezo-tb3s2)`

---

### Task 11: Ship

- [ ] **Step 1:** Full backend suite:
  - `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true`
  - Expected: BUILD SUCCESS.
- [ ] **Step 2:** FE gates, again after the rebase:
  - `CI=true pnpm test`
  - `CI=true VITE_USE_MOCK=false pnpm test`
  - `pnpm build`
- [ ] **Step 3:** Merge and push:
  - `git fetch && git rebase origin/main`
  - `node scripts/gen-codemap.mjs` (commit it if changed)
  - `git checkout --detach origin/main && git merge --no-ff feat/actual-movement-budget`
  - `node scripts/gen-codemap.mjs` again (commit it if changed)
  - `git push origin HEAD:main`
- [ ] **Step 4:** Deploy: watch the `deploy` workflow for the merge commit with `gh run list --branch main --limit 3`. Expected: green.
- [ ] **Step 5:** Verify live:
  - The production DB shows `tdee_bootstrap->>'activityModel' = '3'` for the active goal, segments with null `trainingDayKcal`, and the new rationale.
  - `expenditure_estimate` rows show `updated_at` after the deploy.
  - In the browser at `https://46.225.112.172.sslip.io/`:
    - Fuel → Miből jön össze? shows `ma logolt mozgásod` with today's logged movement.
    - Edzés → the energy card shows the same number.
    - Fuel beállítások has no Edzőnap-shift.
- [ ] **Step 6:** Republish the living prototypes if the build deviated. Close `mezo-tb3s2` with the evidence. Refresh the tracker backup:
  - `node scripts/check-beads-backup.mjs --fix` (commit it)
  - `git pull --rebase && bd dolt push && git push`

---

## Kész, ha…

**Amit a tulaj lát**
- [ ] Fuel → „Miből jön össze?”:
  - the Mozgás row reads „ma logolt mozgásod” (plus „+ terven kívüli” when there is extra movement) with today's logged kcal;
  - the faint „még jön +X, ha megcsinálod” appears only today and only with pending > 0;
  - Célod = the goal's daily share with the floor folded in;
  - the footer is the new sentence.
- [ ] Fuel → „Részletesen” sheet: the lead copy, „Mozgás · ma logolva”, the logged session tiles, the faint pending tiles under „Még jön, ha megcsinálod · a keretben még nincs benne”, and the new why-copy.
- [ ] Edzés → „Amit a mozgásod hozzáad”:
  - the big number = the served logged movement, and „már a keretedben” carries the same number;
  - „+X kcal még jön, ha megcsinálod” appears when pending;
  - the in-progress note appears while a workout is open;
  - „Ugyanez a szám áll a Fuel keretében. Becslés, nem mérés.”
- [ ] Fuel beállítások: no Edzőnap-shift, and save still works.
- [ ] Labels: the Én TDEE „Tervezett mozgás · heti átlag”; the learning explainer „logolt mozgás, napi átlag”; the goal rationale is the new sentence.
- [ ] Empty and edge states: nothing logged gives +0 plus pending; a past day has no pending line; the static path (no goal) has no chips and no Edzés card; the layout holds at 320 px; reduced motion is unaffected.
- [ ] No new icons; the existing sprite only.

**Parity**
- [ ] Every other control and data field on the Fuel Mai hero, the energy sheet, Fuel settings and TrainTodayPage is still present.
- [ ] The meal zones and pre/post-workout meals are unchanged (they read planned blocks).
- [ ] Fuel week, meal scorer, MealCoach, character detectors and adaptive review read the new served target with no errors.

**Gates**
- [ ] FE tests pass in both modes: `CI=true`, mock and `VITE_USE_MOCK=false`.
- [ ] The affected `tests/layout` specs and `pnpm build` pass.
- [ ] Backend focused ITs (Tasks 1–5) and the full suite with Testcontainers pass.
- [ ] `node scripts/gen-codemap.mjs` has been run; `node scripts/lint-docs.mjs` reports 0 errors / 0 stale.

**Docs**
- [ ] `fuel.md`, `goal-engine.md` (including the stale lines), `train.md` and `me.md` are updated.
- [ ] The feature index rows are true.
- [ ] The milestone log has a dated entry.

**Shipped**
- [ ] Merged to main; the `deploy` workflow is green for that commit; the new version is live on the production URL (checked in the browser).
- [ ] The production DB shows activityModel = 3, split-free segments, the new rationale, and re-fitted estimate rows.

**Living prototype**
- [ ] `elo/fuel.html` and `elo/edzes.html` match the build and are republished to their fixed URLs; the README dates are updated.
