# Karakter round 2 (fuel & ciklus) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Karakter detector pipeline into the fuel-and-medication domain — meals/macros/NOVA, water, supplement stack, medication cycle × check-ins — as seven new pure-code detectors fed by a widened `CharacterSignalReads`.

**Architecture:** `CharacterSignalReads` gathers five new per-day series into `DetectorInput.TrendWindow` over an 8-week window (raw rows, never pre-aggregated); each of the seven new detectors computes a `String` state **as of a date** by windowing that series to the trailing 14 days, and fires only when the state as of `day` is non-null and differs from the state as of `day − 1`. No new tables, no new endpoints, no contract change.

**Tech Stack:** Java 21 / Spring Boot 4 (backend), JUnit 5 + AssertJ + Testcontainers (tests), React + TypeScript + Vitest (frontend).

Driving spec: `docs/superpowers/specs/2026-09-01-character-round2-fuel-ciklus-design.md`. Driving bd: **mezo-1gim.15**.

## Global Constraints

- Every commit subject carries the bd id: `feat(character): ... (mezo-1gim.15)`, and every commit message ends with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Work only inside the worktree `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba`. Never `cd` to the primary repo.
- Backend focused tests only, always with Testcontainers: `./mvnw test -Dtest='...' -Dmezo.test.use-testcontainers=true` from `backend/`. NEVER run the full suite locally.
- Every new detector is `@Component` + `@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")` and is auto-discovered by `DetectorRegistry` — do not register anything manually.
- Hungarian summary strings use the decimal-comma idiom: format with `BigDecimal`/`String.format` then `.replace('.', ',')`. Never let a raw `.` decimal separator reach a summary.
- Nullable aggregate = "no data". Never substitute zero for a missing measurement.
- Every read in `CharacterSignalReads` is bounded above by the observed `day` (catch-up honesty), via the finder's upper bound or an in-memory filter.
- No OpenAPI/contract change anywhere in this plan.

---

### Task 1: `DetectorInput` round-2 records + `DetectorGates`

Foundation task: widen the input record, rename and extend the gate helper, and keep every existing caller compiling. No behavior change to the 13 existing detectors.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/DetectorInput.java`
- Rename + modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/RoundOneGates.java` → `DetectorGates.java`
- Modify (call sites of `RoundOneGates`): `RirCalibrationDetector.java`, `NiggleMapDetector.java`, `SportInterferenceDetector.java`, `MesoAdherenceDetector.java`, `ProgressionAdherenceDetector.java`, `HrRecoveryTrendDetector.java`, `SleepPerformanceChainDetector.java`, `AvoidancePatternDetector.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterSignalReads.java` (construct the widened `TrendWindow` with empty round-2 lists for now)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/detector/DetectorTest.java`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `DetectorInput.TrendWindow(runsEightWeeks, gymEightWeeks, mealDays, waterDays, stack, checkinDays, med)`; the nested records `MealDayPoint`, `MealPoint`, `WaterDayPoint`, `StackContext`, `StackItem`, `StackDayPoint`, `CheckinDayPoint`, `MedContext`, `MedCycleDayPoint`; and `DetectorGates` with `newGymData/newSportData/newRunData/newSleepData/onDay` (unchanged) plus `newMealData/newWaterData/newStackData/newCheckinData/newDoseData`.

- [ ] **Step 1: Widen `DetectorInput`**

Append these nested records inside `DetectorInput` (after `MesoContext`, before `TrendWindow`), and replace the `TrendWindow` record:

```java
    /** One day's meal aggregate. kcal/macros are sums over the day's meal item snapshots.
     *  {@code nova4KcalShare} is null when {@code novaCoveragePct} is below the detector-side
     *  coverage gate's input threshold — a partly-unclassified day must not fake a share. */
    public record MealDayPoint(LocalDate date,
                               BigDecimal kcal,
                               BigDecimal proteinG,
                               BigDecimal carbsG,
                               BigDecimal fatG,
                               BigDecimal nova4KcalShare,
                               BigDecimal novaCoveragePct,
                               BigDecimal kcalTarget,
                               BigDecimal proteinTarget,
                               List<MealPoint> meals) {}

    /** One logged meal. {@code loggedAtLocalTime} is {@code loggedAt} in the JVM default zone —
     *  the same clock the character jobs take {@code LocalDate.now()} from. */
    public record MealPoint(String slot, LocalTime loggedAtLocalTime, BigDecimal kcal, Integer nova) {}

    /** A day with at least one water log; an absent date means "not logged", never 0 ml. */
    public record WaterDayPoint(LocalDate date, int amountMl, int targetMl) {}

    /** The active supplement protocol plus per-day intake facts; null when no active protocol. */
    public record StackContext(List<StackItem> items, List<StackDayPoint> days) {}
    /** One planned protocol item. {@code restDayFallback} is a zone key or null (null = the item
     *  is deliberately dropped on a rest day rather than displaced). */
    public record StackItem(UUID pantryItemId, String name, String slotKey, String restDayFallback) {}
    public record StackDayPoint(LocalDate date, Set<UUID> takenPantryItemIds) {}

    /** Per-day means of the day's logged check-in slots; a null scale means nobody logged it.
     *  energy/body/mental: higher = better. stress: higher = worse. All 1..10. */
    public record CheckinDayPoint(LocalDate date, int count,
                                  BigDecimal energy, BigDecimal stress,
                                  BigDecimal body, BigDecimal mental) {}

    /** Active medication cycle context; null when the owner has no active medication. */
    public record MedContext(int cycleLengthDays, List<MedCycleDayPoint> days) {}
    /** One day projected onto the medication cycle. {@code stale} marks a day whose last dose is
     *  older than one full cycle — {@code MedicationCycleService} CLAMPS those to the last cycle
     *  day for the Fuel UI, which would pile no-dose weeks into one bucket, so covariance drops
     *  them. {@code daysSinceDose} is null when there is no dose at all. */
    public record MedCycleDayPoint(LocalDate date, int cycleDay, String phaseKey,
                                   Integer daysSinceDose, boolean stale) {}

    /** Raw 8-week series ending at day — detectors aggregate these themselves so they can
     *  recompute their state both as-of day and as-of day-1 (stateless state-change gate).
     *  Round-2 series (mealDays..med) live ONLY here: every round-2 detector windows them to a
     *  trailing 14 days by an {@code asOf} parameter, so a duplicated 14-day copy would be dead
     *  weight (round-2 spec §4). */
    public record TrendWindow(List<RunPoint> runsEightWeeks, List<GymDay> gymEightWeeks,
                              List<MealDayPoint> mealDays, List<WaterDayPoint> waterDays,
                              StackContext stack, List<CheckinDayPoint> checkinDays,
                              MedContext med) {}
```

Add the imports `java.time.LocalTime` and `java.util.UUID` to `DetectorInput.java` (`java.util.Set`, `java.util.List`, `java.math.BigDecimal`, `java.time.LocalDate` are already imported).

- [ ] **Step 2: Rename `RoundOneGates` → `DetectorGates` and add the round-2 gates**

```bash
git mv backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/RoundOneGates.java \
       backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/DetectorGates.java
```

Replace the file's content with:

```java
package io.mrkuhne.mezo.feature.character.detector;

import java.time.LocalDate;

/**
 * Stateless overfiring protection for the detector framework — pure date checks, no table and no
 * "last fired" state.
 *
 * <p>Round 1 (2026-08-31-character-round1-edzes-test-design.md §5) used these as the PRIMARY gate:
 * gym/sport/run/sleep data is episodic, so "new data for this family arrived on the observed day"
 * is genuinely selective. Round 2's sources (meals, water, stack, check-ins) arrive EVERY day, so
 * for those the same gate is nearly always open and the round-2 detectors rely primarily on their
 * own state-change gate (round-2 spec §6) — these methods stay as a cheap pre-filter.
 */
final class DetectorGates {
    private DetectorGates() {}

    static boolean newGymData(DetectorInput in) {
        return in.gymDays().stream().anyMatch(g -> g.date().equals(in.day()));
    }

    static boolean newSportData(DetectorInput in) {
        return in.sportSessions().stream().anyMatch(s -> s.date().equals(in.day()));
    }

    static boolean newRunData(DetectorInput in) {
        return in.runLogs().stream().anyMatch(r -> r.date().equals(in.day()));
    }

    static boolean newSleepData(DetectorInput in) {
        return in.sleepPoints().stream().anyMatch(s -> s.date().equals(in.day()));
    }

    static boolean newMealData(DetectorInput in) {
        return in.trend().mealDays().stream().anyMatch(m -> m.date().equals(in.day()));
    }

    static boolean newWaterData(DetectorInput in) {
        return in.trend().waterDays().stream().anyMatch(w -> w.date().equals(in.day()));
    }

    static boolean newStackData(DetectorInput in) {
        return in.trend().stack() != null && in.trend().stack().days().stream()
                .anyMatch(d -> d.date().equals(in.day()) && !d.takenPantryItemIds().isEmpty());
    }

    static boolean newCheckinData(DetectorInput in) {
        return in.trend().checkinDays().stream()
                .anyMatch(c -> c.date().equals(in.day()) && c.count() > 0);
    }

    static boolean newDoseData(DetectorInput in) {
        return in.trend().med() != null && in.trend().med().days().stream()
                .anyMatch(d -> d.date().equals(in.day())
                        && d.daysSinceDose() != null && d.daysSinceDose() == 0);
    }

    static boolean onDay(LocalDate date, DetectorInput in) {
        return date.equals(in.day());
    }
}
```

- [ ] **Step 3: Update the eight round-1 detector call sites**

In each of `RirCalibrationDetector.java`, `NiggleMapDetector.java`, `SportInterferenceDetector.java`, `MesoAdherenceDetector.java`, `ProgressionAdherenceDetector.java`, `HrRecoveryTrendDetector.java`, `SleepPerformanceChainDetector.java`, `AvoidancePatternDetector.java`, replace every occurrence of the identifier `RoundOneGates` with `DetectorGates`. Do not change any other logic. Verify none remain:

```bash
grep -rn "RoundOneGates" backend/src/main backend/src/test
```

Expected: no output.

- [ ] **Step 4: Keep `CharacterSignalReads` compiling**

In `CharacterSignalReads.gather()`, the final `return` currently builds `new DetectorInput.TrendWindow(runsEightWeeks, gymEightWeeks)`. Change it to:

```java
        return new DetectorInput(day, mealDates, checkinCounts, weights, journalTexts,
                gymDays, sportSessions, runLogs, sleepPoints, meso,
                new DetectorInput.TrendWindow(runsEightWeeks, gymEightWeeks,
                        List.of(), List.of(), null, List.of(), null));
```

(Task 2 and Task 3 replace these placeholders with real reads.)

- [ ] **Step 5: Update the `DetectorTest` helper and add gate tests**

In `DetectorTest.java`, replace the two `new DetectorInput.TrendWindow(List.of(), List.of())` occurrences with `emptyTrend()`, and add these helpers plus tests to the class:

```java
    static DetectorInput.TrendWindow emptyTrend() {
        return new DetectorInput.TrendWindow(List.of(), List.of(), List.of(), List.of(),
                null, List.of(), null);
    }

    /** Full-control builder for the round-2 detectors: only the trend window varies. */
    private DetectorInput trendInput(DetectorInput.TrendWindow trend) {
        return new DetectorInput(DAY, Set.of(), Map.of(), List.of(), Map.of(),
                List.of(), List.of(), List.of(), List.of(), null, trend);
    }

    @Test
    void detectorGates_roundTwoFamilies_seeOnlyDataDatedOnTheObservedDay() {
        DetectorInput.TrendWindow todayMeal = new DetectorInput.TrendWindow(
                List.of(), List.of(),
                List.of(new DetectorInput.MealDayPoint(DAY, new BigDecimal("2000"),
                        new BigDecimal("150"), new BigDecimal("200"), new BigDecimal("60"),
                        null, null, new BigDecimal("3100"), new BigDecimal("220"), List.of())),
                List.of(), null, List.of(), null);
        assertThat(DetectorGates.newMealData(trendInput(todayMeal))).isTrue();

        DetectorInput.TrendWindow yesterdayMeal = new DetectorInput.TrendWindow(
                List.of(), List.of(),
                List.of(new DetectorInput.MealDayPoint(DAY.minusDays(1), new BigDecimal("2000"),
                        new BigDecimal("150"), new BigDecimal("200"), new BigDecimal("60"),
                        null, null, new BigDecimal("3100"), new BigDecimal("220"), List.of())),
                List.of(), null, List.of(), null);
        assertThat(DetectorGates.newMealData(trendInput(yesterdayMeal))).isFalse();
    }

    @Test
    void detectorGates_absentRoundTwoContexts_areQuietNotCrashing() {
        DetectorInput in = trendInput(emptyTrend());
        assertThat(DetectorGates.newMealData(in)).isFalse();
        assertThat(DetectorGates.newWaterData(in)).isFalse();
        assertThat(DetectorGates.newStackData(in)).isFalse();
        assertThat(DetectorGates.newCheckinData(in)).isFalse();
        assertThat(DetectorGates.newDoseData(in)).isFalse();
    }
```

- [ ] **Step 6: Compile and run the detector tests**

```bash
cd backend && ./mvnw -q test -Dtest='DetectorTest' -Dmezo.test.use-testcontainers=true
```

Expected: PASS, all existing round-1 tests still green.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character backend/src/test/java/io/mrkuhne/mezo/feature/character
git commit -m "feat(character): round-2 DetectorInput records + DetectorGates (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Read layer part 1 — meals (macros + NOVA + real targets) and water

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/repository/MealRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/repository/WaterLogRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterSignalReads.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterSignalReadsIT.java`

**Interfaces:**
- Consumes: `DetectorInput.MealDayPoint`, `MealPoint`, `WaterDayPoint`, `TrendWindow` (Task 1).
- Produces: `CharacterSignalReads` fills `trend().mealDays()` and `trend().waterDays()`; new finders `MealRepository.findWithItemsBetween(UUID, LocalDate, LocalDate)` and `WaterLogRepository.sumsBetween(UUID, LocalDate, LocalDate)`.

- [ ] **Step 1: Add the join-fetch meal range finder**

In `MealRepository.java`, add (keeping the existing imports; add `java.util.List` if absent):

```java
    /**
     * Meals with their item lines in {@code [from, to]}, one query, no N+1 (Karakter round 2 —
     * the character read layer needs every day's macro/NOVA aggregate over an 8-week window).
     * {@code distinct} is required because the fetch join multiplies the meal row per item.
     */
    @Query("select distinct m from MealEntity m left join fetch m.items "
        + "where m.createdBy = :createdBy and m.deleted = false "
        + "and m.mealDate between :from and :to order by m.mealDate asc, m.loggedAt asc")
    List<MealEntity> findWithItemsBetween(@Param("createdBy") UUID createdBy,
                                          @Param("from") LocalDate from,
                                          @Param("to") LocalDate to);
```

- [ ] **Step 2: Add the grouped water range finder**

In `WaterLogRepository.java`, add (add imports `java.util.List` and `org.springframework.data.jpa.repository.query.Param` if absent):

```java
    /**
     * Per-day water totals in {@code [from, to]} — one grouped query instead of a per-day
     * {@link #sumAmountForDay} loop (Karakter round 2). Each row is {@code [LocalDate, Long]};
     * days with no log are simply absent (never a 0 row).
     */
    @Query("select w.logDate, sum(w.amountMl) from WaterLogEntity w "
        + "where w.createdBy = :userId and w.deleted = false "
        + "and w.logDate between :from and :to group by w.logDate order by w.logDate asc")
    List<Object[]> sumsBetween(@Param("userId") UUID userId,
                               @Param("from") LocalDate from,
                               @Param("to") LocalDate to);
```

- [ ] **Step 3: Wire meals + water into `CharacterSignalReads`**

Add these fields to the class (after `gymScheduleSlotRepository`):

```java
    private final WaterLogRepository waterLogRepository;
    private final GoalRepository goalRepository;
    private final NutritionTargetsProperties nutritionTargets;
```

Add the imports:

```java
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.WaterLogRepository;
import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
```

Replace the existing per-day meal-presence loop. The current code is:

```java
        Set<LocalDate> mealDates = new HashSet<>();
        Map<LocalDate, Integer> checkinCounts = new HashMap<>();
        for (LocalDate d = windowStart; !d.isAfter(day); d = d.plusDays(1)) {
            if (!mealRepository
                    .findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(owner, d)
                    .isEmpty()) {
                mealDates.add(d);
            }
            int count = checkInRepository.findByCreatedByAndDateOrderBySlotTime(owner, d).size();
            checkinCounts.put(d, count);
        }
```

Replace it with (the check-in half is rewritten in Task 3; keep it as-is for now):

```java
        List<DetectorInput.MealDayPoint> mealDays = gatherMealDays(owner, trendStart, day);
        Set<LocalDate> mealDates = mealDays.stream()
                .map(DetectorInput.MealDayPoint::date)
                .filter(d -> !d.isBefore(windowStart))
                .collect(java.util.stream.Collectors.toCollection(HashSet::new));

        Map<LocalDate, Integer> checkinCounts = new HashMap<>();
        for (LocalDate d = windowStart; !d.isAfter(day); d = d.plusDays(1)) {
            checkinCounts.put(d, checkInRepository.findByCreatedByAndDateOrderBySlotTime(owner, d).size());
        }

        List<DetectorInput.WaterDayPoint> waterDays = gatherWaterDays(owner, trendStart, day);
```

and pass `mealDays` / `waterDays` into the `TrendWindow` constructor call:

```java
                new DetectorInput.TrendWindow(runsEightWeeks, gymEightWeeks,
                        mealDays, waterDays, null, List.of(), null));
```

Add these private methods to the class:

```java
    private static final BigDecimal NOVA_COVERAGE_SCALE = new BigDecimal("100");

    /**
     * One meal-aggregate row per day that has at least one logged meal. Macros are sums over the
     * frozen item snapshots; the NOVA-4 share is kcal-weighted over the LINE level
     * ({@code MealItemEntity.snapshotNova}) rather than the meal-level {@code breakdown.nova}
     * envelope, because {@code breakdown} can be NULL on legacy/manual meals while the line
     * snapshots are written for every line (round-2 spec §4.1). Targets mirror
     * {@code FuelDayService}'s precedence exactly: the active goal's week segment prescribes kcal
     * and protein, everything else comes from the config.
     */
    private List<DetectorInput.MealDayPoint> gatherMealDays(UUID owner, LocalDate from, LocalDate to) {
        List<MealEntity> meals = mealRepository.findWithItemsBetween(owner, from, to);
        if (meals.isEmpty()) {
            return List.of();
        }
        GoalEntity goal = goalRepository.findByCreatedByAndStatusAndDeletedFalse(owner, "active")
                .stream().findFirst().orElse(null);

        Map<LocalDate, List<MealEntity>> byDate = new LinkedHashMap<>();
        for (MealEntity m : meals) {
            byDate.computeIfAbsent(m.getMealDate(), k -> new ArrayList<>()).add(m);
        }
        List<DetectorInput.MealDayPoint> out = new ArrayList<>();
        for (Map.Entry<LocalDate, List<MealEntity>> e : byDate.entrySet()) {
            LocalDate date = e.getKey();
            BigDecimal kcal = BigDecimal.ZERO;
            BigDecimal protein = BigDecimal.ZERO;
            BigDecimal carbs = BigDecimal.ZERO;
            BigDecimal fat = BigDecimal.ZERO;
            BigDecimal classifiedKcal = BigDecimal.ZERO;
            BigDecimal nova4Kcal = BigDecimal.ZERO;
            List<DetectorInput.MealPoint> mealPoints = new ArrayList<>();
            for (MealEntity m : e.getValue()) {
                BigDecimal mealKcal = BigDecimal.ZERO;
                Integer dominantNova = null;
                BigDecimal dominantKcal = BigDecimal.ZERO;
                for (MealItemEntity item : m.getItems()) {
                    BigDecimal lineKcal = nz(item.getSnapshotKcal());
                    mealKcal = mealKcal.add(lineKcal);
                    protein = protein.add(nz(item.getSnapshotProteinG()));
                    carbs = carbs.add(nz(item.getSnapshotCarbsG()));
                    fat = fat.add(nz(item.getSnapshotFatG()));
                    if (item.getSnapshotNova() != null) {
                        classifiedKcal = classifiedKcal.add(lineKcal);
                        if (item.getSnapshotNova() >= 4) {
                            nova4Kcal = nova4Kcal.add(lineKcal);
                        }
                        if (lineKcal.compareTo(dominantKcal) > 0) {
                            dominantKcal = lineKcal;
                            dominantNova = item.getSnapshotNova().intValue();
                        }
                    }
                }
                kcal = kcal.add(mealKcal);
                mealPoints.add(new DetectorInput.MealPoint(
                        m.getSlot(),
                        LocalTime.from(m.getLoggedAt().atZone(ZoneId.systemDefault())),
                        mealKcal, dominantNova));
            }
            BigDecimal coverage = kcal.signum() == 0 ? null
                    : classifiedKcal.divide(kcal, 4, RoundingMode.HALF_UP);
            BigDecimal nova4Share = classifiedKcal.signum() == 0 ? null
                    : nova4Kcal.divide(classifiedKcal, 4, RoundingMode.HALF_UP);
            out.add(new DetectorInput.MealDayPoint(date, kcal, protein, carbs, fat,
                    nova4Share, coverage, kcalTarget(goal, date), proteinTarget(goal, date),
                    List.copyOf(mealPoints)));
        }
        return List.copyOf(out);
    }

    /** {@code FuelDayService#targetSet} precedence: goal-week segment kcal, else config. */
    private BigDecimal kcalTarget(GoalEntity goal, LocalDate date) {
        GoalPrescriptionJson.Segment seg = segmentFor(goal, date);
        return BigDecimal.valueOf(seg != null && seg.kcal() != null ? seg.kcal() : nutritionTargets.kcal());
    }

    /** {@code FuelDayService#targetSet} precedence: goal-week segment protein, else config. */
    private BigDecimal proteinTarget(GoalEntity goal, LocalDate date) {
        GoalPrescriptionJson.Segment seg = segmentFor(goal, date);
        return BigDecimal.valueOf(seg != null && seg.proteinG() != null ? seg.proteinG() : nutritionTargets.p());
    }

    private GoalPrescriptionJson.Segment segmentFor(GoalEntity goal, LocalDate date) {
        if (goal == null || goal.getStartDate() == null) {
            return null;
        }
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), date) / 7 + 1;
        return GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
    }

    /** Per-day water totals; a day with no log is ABSENT, never a 0 ml row. */
    private List<DetectorInput.WaterDayPoint> gatherWaterDays(UUID owner, LocalDate from, LocalDate to) {
        List<DetectorInput.WaterDayPoint> out = new ArrayList<>();
        for (Object[] row : waterLogRepository.sumsBetween(owner, from, to)) {
            out.add(new DetectorInput.WaterDayPoint((LocalDate) row[0],
                    ((Number) row[1]).intValue(), nutritionTargets.water()));
        }
        return List.copyOf(out);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
```

- [ ] **Step 4: Write the failing IT**

Append to `CharacterSignalReadsIT.java` (add `@Autowired private MealPopulator mealPopulator;` and `@Autowired private WaterLogPopulator waterLogPopulator;` plus their imports; check each populator's real method signature with `grep -n "public " backend/src/test/java/io/mrkuhne/mezo/support/populator/MealPopulator.java` and adapt the calls below to it — the assertions, not the populator call shapes, are what this test pins):

```java
    @Test
    void gather_fillsMealAndWaterSeries_withRealTargetsAndNovaShare() {
        UUID owner = owner();

        mealPopulator.createMealWithItems(owner, DAY, "dinner",
                List.of(new MealPopulator.Line("Csirke", "600", "50", "10", "20", (short) 1),
                        new MealPopulator.Line("Chips", "400", "5", "40", "25", (short) 4)));
        waterLogPopulator.createWaterLog(owner, DAY, 2500);

        DetectorInput input = signalReads.gather(owner, DAY);

        assertThat(input.trend().mealDays()).singleElement().satisfies(m -> {
            assertThat(m.date()).isEqualTo(DAY);
            assertThat(m.kcal()).isEqualByComparingTo("1000");
            assertThat(m.proteinG()).isEqualByComparingTo("55");
            // both lines carry a NOVA class -> full coverage; 400 of 1000 kcal are NOVA-4
            assertThat(m.novaCoveragePct()).isEqualByComparingTo("1.0000");
            assertThat(m.nova4KcalShare()).isEqualByComparingTo("0.4000");
            // no active goal -> config fallback (mezo.nutrition.kcal / .p)
            assertThat(m.kcalTarget()).isEqualByComparingTo("3100");
            assertThat(m.proteinTarget()).isEqualByComparingTo("220");
            assertThat(m.meals()).singleElement().satisfies(p ->
                    assertThat(p.slot()).isEqualTo("dinner"));
        });
        assertThat(input.trend().waterDays()).singleElement().satisfies(w -> {
            assertThat(w.date()).isEqualTo(DAY);
            assertThat(w.amountMl()).isEqualTo(2500);
            assertThat(w.targetMl()).isEqualTo(4000);
        });
        // the 14-day mealDates presence set is still derived correctly from the same read
        assertThat(input.mealDates()).contains(DAY);
    }

    @Test
    void gather_boundsMealAndWaterAboveByDay_forCatchUp() {
        UUID owner = owner();

        mealPopulator.createMealWithItems(owner, DAY.plusDays(1), "lunch",
                List.of(new MealPopulator.Line("Későbbi", "500", "30", "40", "15", (short) 2)));
        waterLogPopulator.createWaterLog(owner, DAY.plusDays(1), 3000);

        DetectorInput input = signalReads.gather(owner, DAY);

        assertThat(input.trend().mealDays()).isEmpty();
        assertThat(input.trend().waterDays()).isEmpty();
        assertThat(input.mealDates()).isEmpty();
    }
```

If `MealPopulator` has no items-aware factory, add one to the populator in this task (it is test support, not production code) following the populator's existing style.

- [ ] **Step 5: Run the IT and watch it fail, then pass**

```bash
cd backend && ./mvnw -q test -Dtest='CharacterSignalReadsIT' -Dmezo.test.use-testcontainers=true
```

Expected before Step 3's code is in place: FAIL. After: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(character): round-2 read layer — meal macros/NOVA + water series (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Read layer part 2 — supplement stack, check-in scales, medication cycle

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterSignalReads.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterSignalReadsIT.java`

**Interfaces:**
- Consumes: `DetectorInput.StackContext`, `StackItem`, `StackDayPoint`, `CheckinDayPoint`, `MedContext`, `MedCycleDayPoint` (Task 1).
- Produces: `CharacterSignalReads` fills `trend().stack()`, `trend().checkinDays()`, `trend().med()`; `checkinCounts` keeps its exact existing semantics (an entry for every day of the 14-day window, zeros included).

- [ ] **Step 1: Add the dependencies**

Add to `CharacterSignalReads`'s field list:

```java
    private final ProtocolRepository protocolRepository;
    private final ProtocolItemRepository protocolItemRepository;
    private final SupplementIntakeRepository supplementIntakeRepository;
    private final PantryItemRepository pantryItemRepository;
    private final MedicationRepository medicationRepository;
    private final MedicationCycleService medicationCycleService;
```

with imports:

```java
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.fuel.entity.ProtocolEntity;
import io.mrkuhne.mezo.feature.fuel.entity.ProtocolItemEntity;
import io.mrkuhne.mezo.feature.fuel.entity.SupplementIntakeEntity;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolItemRepository;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolRepository;
import io.mrkuhne.mezo.feature.fuel.repository.SupplementIntakeRepository;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
```

Verify `PantryItemRepository`'s owner-scoped finder name before use:

```bash
grep -n "find" backend/src/main/java/io/mrkuhne/mezo/feature/pantry/repository/PantryItemRepository.java
```

Use whichever owner-scoped, non-deleted list finder exists; do not add a new one if one already fits.

- [ ] **Step 2: Replace the check-in loop with a range read**

Replace the `checkinCounts` loop added in Task 2 with:

```java
        List<CheckInEntity> checkins =
                checkInRepository.findByCreatedByAndDeletedFalseAndDateBetween(owner, trendStart, day);
        Map<LocalDate, Integer> checkinCounts = new HashMap<>();
        for (LocalDate d = windowStart; !d.isAfter(day); d = d.plusDays(1)) {
            checkinCounts.put(d, 0); // an entry for EVERY day of the 14-day window, zeros included
        }
        for (CheckInEntity c : checkins) {
            if (!c.getDate().isBefore(windowStart) && !c.getDate().isAfter(day)) {
                checkinCounts.merge(c.getDate(), 1, Integer::sum);
            }
        }
        List<DetectorInput.CheckinDayPoint> checkinDays = toCheckinDays(checkins);
```

and add:

```java
    /** Per-day means of the day's logged check-in slots; a scale nobody logged stays null. */
    private List<DetectorInput.CheckinDayPoint> toCheckinDays(List<CheckInEntity> checkins) {
        Map<LocalDate, List<CheckInEntity>> byDate = new TreeMap<>();
        for (CheckInEntity c : checkins) {
            byDate.computeIfAbsent(c.getDate(), k -> new ArrayList<>()).add(c);
        }
        List<DetectorInput.CheckinDayPoint> out = new ArrayList<>();
        for (Map.Entry<LocalDate, List<CheckInEntity>> e : byDate.entrySet()) {
            out.add(new DetectorInput.CheckinDayPoint(e.getKey(), e.getValue().size(),
                    mean(e.getValue(), CheckInEntity::getEnergy),
                    mean(e.getValue(), CheckInEntity::getStress),
                    mean(e.getValue(), CheckInEntity::getBody),
                    mean(e.getValue(), CheckInEntity::getMental)));
        }
        return List.copyOf(out);
    }

    private static BigDecimal mean(List<CheckInEntity> rows,
                                   java.util.function.Function<CheckInEntity, Integer> field) {
        int sum = 0;
        int n = 0;
        for (CheckInEntity c : rows) {
            Integer v = field.apply(c);
            if (v != null) {
                sum += v;
                n++;
            }
        }
        return n == 0 ? null : BigDecimal.valueOf(sum).divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP);
    }
```

Add the import `java.util.TreeMap` if absent.

- [ ] **Step 3: Gather the stack context**

```java
    /**
     * The active supplement protocol plus per-day intakes; null when there is no active protocol
     * (absent, never "zero compliance"). The intake finder bounds only BELOW, so the upper bound
     * is applied in memory — the round-1 weight-read precedent for catch-up honesty. Whether an
     * item was EXPECTED on a given day is deliberately NOT decided here: it depends on that day's
     * training, which the detector resolves from {@code trend().gymEightWeeks()} as of two
     * different dates (round-2 spec §4.3).
     */
    private DetectorInput.StackContext gatherStack(UUID owner, LocalDate from, LocalDate to) {
        ProtocolEntity protocol = protocolRepository
                .findByCreatedByAndStatusAndDeletedFalse(owner, "active").orElse(null);
        if (protocol == null) {
            return null;
        }
        Map<UUID, String> names = new HashMap<>();
        for (PantryItemEntity p : pantryItemRepository.findAllOwned(owner)) {
            names.put(p.getId(), p.getName());
        }
        List<DetectorInput.StackItem> items = new ArrayList<>();
        for (ProtocolItemEntity pi : protocolItemRepository
                .findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(protocol.getId())) {
            items.add(new DetectorInput.StackItem(pi.getPantryItemId(),
                    names.getOrDefault(pi.getPantryItemId(), "ismeretlen kiegészítő"),
                    pi.getSlotKey(), pi.getRestDayFallback()));
        }

        Map<LocalDate, Set<UUID>> takenByDate = new TreeMap<>();
        for (SupplementIntakeEntity si : supplementIntakeRepository
                .findByCreatedByAndDeletedFalseAndTakenDateGreaterThanEqualOrderByTakenDateAscTakenAtAsc(
                        owner, from)) {
            if (si.getTakenDate().isAfter(to)) {
                continue; // catch-up upper bound (the finder only bounds below)
            }
            takenByDate.computeIfAbsent(si.getTakenDate(), k -> new HashSet<>())
                    .add(si.getPantryItemId());
        }
        List<DetectorInput.StackDayPoint> days = new ArrayList<>();
        for (Map.Entry<LocalDate, Set<UUID>> e : takenByDate.entrySet()) {
            days.add(new DetectorInput.StackDayPoint(e.getKey(), Set.copyOf(e.getValue())));
        }
        return new DetectorInput.StackContext(List.copyOf(items), List.copyOf(days));
    }
```

If `PantryItemRepository` has no `findAllOwned`, use whatever owner-scoped list finder Step 1's grep revealed.

- [ ] **Step 4: Gather the medication cycle**

```java
    /**
     * The active medication's cycle projected onto every day of the window, reusing
     * {@link MedicationCycleService} rather than reimplementing the cycle-day formula — that
     * formula must have exactly one home. {@code derive} queries the latest dose at-or-before its
     * own date, so it is catch-up-safe by construction.
     *
     * <p>{@code stale} is the round-2 precision guard: {@code derive} CLAMPS a cycle day when the
     * last dose is older than a full cycle (a deliberate Fuel-UI behaviour), which for covariance
     * would pile weeks of no-dose days into the last bucket. The flag lets the detector drop them.
     */
    private DetectorInput.MedContext gatherMedCycle(UUID owner, LocalDate from, LocalDate to) {
        MedicationEntity med = medicationRepository
                .findFirstByCreatedByAndActiveTrueAndDeletedFalse(owner).orElse(null);
        if (med == null || med.getCycle() == null) {
            return null;
        }
        int cycleLength = med.getCycle().cycleLengthDays();
        List<DetectorInput.MedCycleDayPoint> days = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            MedicationCycle cycle = medicationCycleService.derive(owner, med, d);
            if (cycle.cycleDay() == 0 || cycle.lastDoseAt() == null) {
                continue; // honest zero: no dose at or before this day
            }
            // cycle.cycleDay() is CLAMPED, so it is NOT a usable days-since-dose once the clamp
            // bites — derive the true distance from the dose instant the cycle carries.
            LocalDate lastDose = cycle.lastDoseAt().atZone(ZoneId.systemDefault()).toLocalDate();
            int daysSince = (int) ChronoUnit.DAYS.between(lastDose, d);
            boolean stale = daysSince + 1 > cycleLength;
            days.add(new DetectorInput.MedCycleDayPoint(d, cycle.cycleDay(), cycle.phaseKey(),
                    daysSince, stale));
        }
        return new DetectorInput.MedContext(cycleLength, List.copyOf(days));
    }
```

Before writing this, confirm `MedicationCycle`'s real accessor names (`cycleDay`, `phaseKey`, `lastDoseAt` at the time of writing) and adapt if they differ:

```bash
cat backend/src/main/java/io/mrkuhne/mezo/feature/medication/service/dto/MedicationCycle.java
```

- [ ] **Step 5: Wire all three into the returned `TrendWindow`**

```java
        DetectorInput.StackContext stack = gatherStack(owner, trendStart, day);
        DetectorInput.MedContext medCycle = gatherMedCycle(owner, trendStart, day);

        return new DetectorInput(day, mealDates, checkinCounts, weights, journalTexts,
                gymDays, sportSessions, runLogs, sleepPoints, meso,
                new DetectorInput.TrendWindow(runsEightWeeks, gymEightWeeks,
                        mealDays, waterDays, stack, checkinDays, medCycle));
```

- [ ] **Step 6: Write the failing ITs**

Append to `CharacterSignalReadsIT.java` (autowire `SupplementIntakePopulator`, `MedicationPopulator`, `MedicationDosePopulator`, `CheckInPopulator`, and whatever populator creates a protocol + pantry item; check each one's real method signatures with `grep -n "public " backend/src/test/java/io/mrkuhne/mezo/support/populator/<Name>.java` and adapt the call shapes — the assertions are what this test pins):

```java
    @Test
    void gather_fillsCheckinScales_andKeepsCheckinCountSemantics() {
        UUID owner = owner();
        checkInPopulator.createCheckIn(owner, DAY, "06:30", 8, 3, 7, 8);
        checkInPopulator.createCheckIn(owner, DAY, "18:00", 6, 5, 7, 6);

        DetectorInput input = signalReads.gather(owner, DAY);

        assertThat(input.trend().checkinDays()).singleElement().satisfies(c -> {
            assertThat(c.date()).isEqualTo(DAY);
            assertThat(c.count()).isEqualTo(2);
            assertThat(c.energy()).isEqualByComparingTo("7.00");
            assertThat(c.stress()).isEqualByComparingTo("4.00");
        });
        // unchanged legacy semantics: an entry for every day of the 14-day window, zeros included
        assertThat(input.checkinCounts()).hasSize(14);
        assertThat(input.checkinCounts().get(DAY)).isEqualTo(2);
        assertThat(input.checkinCounts().get(DAY.minusDays(1))).isZero();
    }

    @Test
    void gather_medCycle_marksStaleDays_andBoundsAboveByDay() {
        UUID owner = owner();
        var med = medicationPopulator.createActiveWeeklyMedication(owner);
        medicationDosePopulator.createDose(owner, med.getId(), DAY.minusDays(2));
        medicationDosePopulator.createDose(owner, med.getId(), DAY.plusDays(1)); // must not leak

        DetectorInput input = signalReads.gather(owner, DAY);

        assertThat(input.trend().med()).isNotNull();
        assertThat(input.trend().med().days()).anySatisfy(d -> {
            assertThat(d.date()).isEqualTo(DAY);
            assertThat(d.cycleDay()).isEqualTo(3);      // dose 2 days ago -> day 3, 1-based
            assertThat(d.daysSinceDose()).isEqualTo(2);
            assertThat(d.stale()).isFalse();
        });
        assertThat(input.trend().med().days()).noneMatch(d -> d.date().isAfter(DAY));
        // days more than one cycle after the last dose are marked stale, not silently clamped
        DetectorInput later = signalReads.gather(owner, DAY.plusDays(20));
        assertThat(later.trend().med().days()).anySatisfy(d -> {
            assertThat(d.date()).isEqualTo(DAY.plusDays(20));
            assertThat(d.stale()).isTrue();
        });
    }

    @Test
    void gather_absentStackAndMedication_readAsNull_notZero() {
        UUID owner = owner();

        DetectorInput input = signalReads.gather(owner, DAY);

        assertThat(input.trend().stack()).isNull();
        assertThat(input.trend().med()).isNull();
        assertThat(input.trend().mealDays()).isEmpty();
        assertThat(input.trend().waterDays()).isEmpty();
    }

    @Test
    void gather_stack_readsProtocolItemsAndIntakes_boundedAboveByDay() {
        UUID owner = owner();
        var creatine = pantryPopulator.createSupplement(owner, "Kreatin");
        var protocol = fuelPopulator.createActiveProtocol(owner);
        fuelPopulator.createProtocolItem(owner, protocol.getId(), creatine.getId(), "wake", null);
        supplementIntakePopulator.createIntake(owner, creatine.getId(), DAY, "wake");
        supplementIntakePopulator.createIntake(owner, creatine.getId(), DAY.plusDays(1), "wake");

        DetectorInput input = signalReads.gather(owner, DAY);

        assertThat(input.trend().stack()).isNotNull();
        assertThat(input.trend().stack().items()).singleElement().satisfies(i -> {
            assertThat(i.name()).isEqualTo("Kreatin");
            assertThat(i.slotKey()).isEqualTo("wake");
        });
        assertThat(input.trend().stack().days()).singleElement().satisfies(d -> {
            assertThat(d.date()).isEqualTo(DAY);
            assertThat(d.takenPantryItemIds()).containsExactly(creatine.getId());
        });
    }
```

- [ ] **Step 7: Run the ITs**

```bash
cd backend && ./mvnw -q test -Dtest='CharacterSignalReadsIT' -Dmezo.test.use-testcontainers=true
```

Expected: PASS.

- [ ] **Step 8: Run ArchUnit — the new cross-feature edges must be cycle-free**

```bash
cd backend && ./mvnw -q test -Dtest='ArchitectureTest' -Dmezo.test.use-testcontainers=true
```

Expected: PASS. `character → fuel`, `character → medication`, `character → nutrition`, `character → pantry`, `character → goal` are new one-way edges; nothing outside `feature/character` imports `feature.character`, so no cycle should form. If `feature_slices_are_cycle_free` fails, STOP and report — do not regenerate the freeze store to make it pass.

- [ ] **Step 9: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(character): round-2 read layer — stack, check-in scales, medication cycle (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: The four nutrition detectors

`comfort-eating`, `macro-adherence`, `hydration-consistency`, `protein-training-mismatch` — all owned by `taplalkozo`, all state-change gated.

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/ComfortEatingDetector.java`
- Create: `.../detector/MacroAdherenceDetector.java`
- Create: `.../detector/HydrationConsistencyDetector.java`
- Create: `.../detector/ProteinTrainingMismatchDetector.java`
- Create: `.../detector/RoundTwoWindow.java` (shared windowing helpers)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/detector/DetectorTest.java`

**Interfaces:**
- Consumes: `DetectorInput.TrendWindow` round-2 series and `DetectorGates` (Task 1); real data from Tasks 2–3.
- Produces: `RoundTwoWindow.WINDOW_DAYS` (int 14), `RoundTwoWindow.inWindow(LocalDate date, LocalDate asOf)`, `RoundTwoWindow.hu(BigDecimal, int scale)`, `RoundTwoWindow.pct(double)` — used by Task 5's detectors too.

- [ ] **Step 1: Create the shared helper**

```java
package io.mrkuhne.mezo.feature.character.detector;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

/**
 * Shared windowing + Hungarian number formatting for the round-2 detectors (round-2 spec §4, §6).
 *
 * <p>Every round-2 detector computes its finding as a {@code String} state AS OF a date, over the
 * trailing {@link #WINDOW_DAYS} days of the 8-week series, and fires only when the state as of
 * {@code day} is non-null and differs from the state as of {@code day - 1}. Round-2 sources arrive
 * daily, so the new-data gate alone would re-announce an unchanged pattern every night.
 */
final class RoundTwoWindow {
    private RoundTwoWindow() {}

    static final int WINDOW_DAYS = 14;

    /** True when {@code date} falls in the trailing WINDOW_DAYS days ending at (and including) asOf. */
    static boolean inWindow(LocalDate date, LocalDate asOf) {
        return !date.isAfter(asOf) && !date.isBefore(asOf.minusDays(WINDOW_DAYS - 1L));
    }

    /** Hungarian decimal comma — never let a raw '.' separator reach a summary. */
    static String hu(BigDecimal v, int scale) {
        return v.setScale(scale, RoundingMode.HALF_UP).toPlainString().replace('.', ',');
    }

    /** A 0..1 ratio rendered as a whole-percent string. */
    static String pct(double ratio) {
        return String.valueOf(Math.round(ratio * 100));
    }
}
```

- [ ] **Step 2: Write the failing tests for all four detectors**

Add to `DetectorTest.java` (the `trendInput` helper from Task 1 supplies the input; add a small builder for meal days):

```java
    private static DetectorInput.MealDayPoint meal(LocalDate d, String kcal, String protein,
                                                   String nova4Share) {
        return new DetectorInput.MealDayPoint(d, new BigDecimal(kcal), new BigDecimal(protein),
                new BigDecimal("200"), new BigDecimal("60"),
                nova4Share == null ? null : new BigDecimal(nova4Share),
                nova4Share == null ? null : new BigDecimal("1.0000"),
                new BigDecimal("3100"), new BigDecimal("220"), List.of());
    }

    private static DetectorInput.CheckinDayPoint checkin(LocalDate d, String energy, String stress,
                                                         String mental) {
        return new DetectorInput.CheckinDayPoint(d, 1, new BigDecimal(energy), new BigDecimal(stress),
                new BigDecimal("7"), new BigDecimal(mental));
    }

    private static DetectorInput.TrendWindow trend(List<DetectorInput.MealDayPoint> meals,
                                                   List<DetectorInput.WaterDayPoint> water,
                                                   DetectorInput.StackContext stack,
                                                   List<DetectorInput.CheckinDayPoint> checkins,
                                                   DetectorInput.MedContext med,
                                                   List<DetectorInput.GymDay> gym) {
        return new DetectorInput.TrendWindow(List.of(), gym, meals, water, stack, checkins, med);
    }

    @Test
    void macroAdherence_firesOnSystematicUndershoot_quietWhenUnchangedYesterday() {
        MacroAdherenceDetector d = new MacroAdherenceDetector();
        // 15 consecutive days at 2200 kcal against a 3100 target = a stable ~29% undershoot:
        // the state is the same as of DAY and DAY-1, so a stable pattern stays QUIET.
        List<DetectorInput.MealDayPoint> stable = new java.util.ArrayList<>();
        for (int i = 0; i < 15; i++) {
            stable.add(meal(DAY.minusDays(i), "2200", "180", null));
        }
        assertThat(d.detect(trendInput(trend(stable, List.of(), null, List.of(), null, List.of()))))
                .isEmpty();

        // a window that CROSSES the threshold exactly on DAY: 14 days at 2700 kcal against a
        // 3100 target is a ~13% undershoot, but as of DAY-1 the window still contains a 4500 kcal
        // day (offset 14) that pulls the mean back inside the band -> yesterday null, today fires.
        List<DetectorInput.MealDayPoint> flipping = new java.util.ArrayList<>();
        for (int i = 0; i < 14; i++) {
            flipping.add(meal(DAY.minusDays(i), "2700", "220", null));
        }
        flipping.add(meal(DAY.minusDays(14), "4500", "220", null));
        assertThat(d.detect(trendInput(trend(flipping, List.of(), null, List.of(), null, List.of()))))
                .singleElement().satisfies(s -> {
                    assertThat(s.detectorKey()).isEqualTo("macro-adherence");
                    assertThat(s.expertKey()).isEqualTo("taplalkozo");
                    assertThat(s.summary()).contains("alálövi");
                    // HU decimal comma: a digit.digit pair must never appear (the closing period is fine)
                    assertThat(s.summary()).doesNotMatch(".*\\d\\.\\d.*");
                });
    }

    @Test
    void hydrationConsistency_firesOnBandChangeOnly() {
        HydrationConsistencyDetector d = new HydrationConsistencyDetector();
        // 14 days all on target -> band JO both as of DAY and DAY-1 -> quiet
        List<DetectorInput.WaterDayPoint> good = new java.util.ArrayList<>();
        for (int i = 0; i < 15; i++) {
            good.add(new DetectorInput.WaterDayPoint(DAY.minusDays(i), 4000, 4000));
        }
        assertThat(d.detect(trendInput(trend(List.of(), good, null, List.of(), null, List.of()))))
                .isEmpty();

        // three low days at offsets 0-2: as of DAY the 14-day window (offsets 0-13) holds all
        // three -> 11/14 = 79% -> INGADOZO; as of DAY-1 (offsets 1-14) it holds only two ->
        // 12/14 = 86% -> JO. Exactly one band change, on DAY.
        List<DetectorInput.WaterDayPoint> crossing = new java.util.ArrayList<>();
        for (int i = 0; i < 3; i++) {
            crossing.add(new DetectorInput.WaterDayPoint(DAY.minusDays(i), 500, 4000));
        }
        for (int i = 3; i < 15; i++) {
            crossing.add(new DetectorInput.WaterDayPoint(DAY.minusDays(i), 4200, 4000));
        }
        assertThat(d.detect(trendInput(trend(List.of(), crossing, null, List.of(), null, List.of()))))
                .hasSize(1);
    }

    @Test
    void comfortEating_silentBelowMinimumPairedDays() {
        ComfortEatingDetector d = new ComfortEatingDetector();
        List<DetectorInput.MealDayPoint> meals = List.of(
                meal(DAY, "3000", "200", "0.70"),
                meal(DAY.minusDays(1), "2900", "200", "0.20"));
        List<DetectorInput.CheckinDayPoint> checkins = List.of(
                checkin(DAY, "3", "9", "3"),
                checkin(DAY.minusDays(1), "8", "2", "8"));
        assertThat(d.detect(trendInput(trend(meals, List.of(), null, checkins, null, List.of()))))
                .isEmpty();
    }

    @Test
    void comfortEating_firesWhenHighNovaDaysClusterOnLowMoodDays() {
        ComfortEatingDetector d = new ComfortEatingDetector();
        List<DetectorInput.MealDayPoint> meals = new java.util.ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new java.util.ArrayList<>();
        // 24 paired days: every 4th day is a low-mood day AND a high-NOVA day; the rest are calm
        // and clean. Day 0 (DAY) is one of the low-mood/high-NOVA days, so the state turns on today.
        for (int i = 0; i < 24; i++) {
            boolean bad = i % 4 == 0;
            meals.add(meal(DAY.minusDays(i), bad ? "3600" : "2900", "200", bad ? "0.75" : "0.15"));
            checkins.add(bad ? checkin(DAY.minusDays(i), "3", "9", "3")
                             : checkin(DAY.minusDays(i), "8", "2", "8"));
        }
        assertThat(d.detect(trendInput(trend(meals, List.of(), null, checkins, null, List.of()))))
                .singleElement().satisfies(s -> {
                    assertThat(s.detectorKey()).isEqualTo("comfort-eating");
                    assertThat(s.expertKey()).isEqualTo("taplalkozo");
                    // HU decimal comma: a digit.digit pair must never appear (the closing period is fine)
                    assertThat(s.summary()).doesNotMatch(".*\\d\\.\\d.*");
                });
    }

    @Test
    void comfortEating_ignoresDaysWithoutNovaCoverage() {
        ComfortEatingDetector d = new ComfortEatingDetector();
        List<DetectorInput.MealDayPoint> meals = new java.util.ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new java.util.ArrayList<>();
        for (int i = 0; i < 24; i++) {
            boolean bad = i % 4 == 0;
            meals.add(meal(DAY.minusDays(i), bad ? "3600" : "2900", "200", null)); // no NOVA class
            checkins.add(bad ? checkin(DAY.minusDays(i), "3", "9", "3")
                             : checkin(DAY.minusDays(i), "8", "2", "8"));
        }
        assertThat(d.detect(trendInput(trend(meals, List.of(), null, checkins, null, List.of()))))
                .isEmpty();
    }

    @Test
    void proteinTrainingMismatch_firesWhenProteinIsMissedOnGymDaysSpecifically() {
        ProteinTrainingMismatchDetector d = new ProteinTrainingMismatchDetector();
        List<DetectorInput.MealDayPoint> meals = new java.util.ArrayList<>();
        List<DetectorInput.GymDay> gym = new java.util.ArrayList<>();
        for (int i = 0; i < 14; i++) {
            boolean gymDay = i % 2 == 0;
            meals.add(meal(DAY.minusDays(i), "2900", gymDay ? "120" : "230", null));
            if (gymDay) {
                gym.add(new DetectorInput.GymDay(DAY.minusDays(i), List.of()));
            }
        }
        assertThat(d.detect(trendInput(trend(meals, List.of(), null, List.of(), null, gym))))
                .singleElement().satisfies(s -> {
                    assertThat(s.detectorKey()).isEqualTo("protein-training-mismatch");
                    assertThat(s.expertKey()).isEqualTo("taplalkozo");
                    assertThat(s.summary()).contains("edzésnap");
                });
    }
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd backend && ./mvnw -q test -Dtest='DetectorTest' -Dmezo.test.use-testcontainers=true
```

Expected: FAIL — the four detector classes do not exist yet.

- [ ] **Step 4: Implement `MacroAdherenceDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Macro adherence (round 2, spec §5): over the trailing 14 logged days, does kcal or protein
 * systematically miss the day's REAL target? Targets follow {@code FuelDayService}'s precedence
 * (the active goal's week segment prescribes kcal + protein, config fills the rest), resolved in
 * {@code CharacterSignalReads}.
 *
 * <p>State = "{metric}:{direction}" over the window as of a date; fires only when the state as of
 * {@code day} is non-null and differs from the state as of {@code day - 1} (round-2 spec §6), so a
 * stable multi-week deficit is announced ONCE, not every night.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class MacroAdherenceDetector implements CharacterDetector {

    private static final int MIN_LOGGED_DAYS = 7;
    private static final double KCAL_THRESHOLD = 0.10;    // 10% mean deviation
    private static final double PROTEIN_THRESHOLD = 0.15; // 15% mean deviation

    @Override
    public String key() {
        return "macro-adherence";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newMealData(in)) {
            return List.of();
        }
        Finding today = finding(in, in.day());
        Finding yesterday = finding(in, in.day().minusDays(1));
        if (today == null || today.state().equals(yesterday == null ? "" : yesterday.state())) {
            return List.of();
        }
        String metric = today.protein() ? "fehérje" : "kalória";
        String direction = today.deviation() < 0 ? "alálövi" : "túllövi";
        String summary = "A " + metric + "-cél szisztematikus eltérése: " + today.days()
                + " logolt napon átlagosan " + RoundTwoWindow.pct(Math.abs(today.deviation()))
                + "%-kal " + direction + " a napi célt (14 nap).";
        return List.of(new DetectorSignal(key(), "taplalkozo", summary, 3));
    }

    private record Finding(String state, boolean protein, double deviation, int days) {}

    private static Finding finding(DetectorInput in, LocalDate asOf) {
        List<DetectorInput.MealDayPoint> window = new ArrayList<>();
        for (DetectorInput.MealDayPoint m : in.trend().mealDays()) {
            if (RoundTwoWindow.inWindow(m.date(), asOf) && m.kcal().signum() > 0) {
                window.add(m);
            }
        }
        if (window.size() < MIN_LOGGED_DAYS) {
            return null;
        }
        double kcalDev = meanDeviation(window, true);
        double proteinDev = meanDeviation(window, false);
        // kcal wins ties: it is the target the user actually steers by
        if (Math.abs(kcalDev) >= KCAL_THRESHOLD) {
            return new Finding("kcal:" + (kcalDev < 0 ? "under" : "over"), false, kcalDev, window.size());
        }
        if (Math.abs(proteinDev) >= PROTEIN_THRESHOLD) {
            return new Finding("protein:" + (proteinDev < 0 ? "under" : "over"), true, proteinDev,
                    window.size());
        }
        return null;
    }

    private static double meanDeviation(List<DetectorInput.MealDayPoint> window, boolean kcal) {
        double sum = 0;
        int n = 0;
        for (DetectorInput.MealDayPoint m : window) {
            BigDecimal actual = kcal ? m.kcal() : m.proteinG();
            BigDecimal target = kcal ? m.kcalTarget() : m.proteinTarget();
            if (target == null || target.signum() == 0) {
                continue;
            }
            sum += actual.subtract(target).doubleValue() / target.doubleValue();
            n++;
        }
        return n == 0 ? 0 : sum / n;
    }
}
```

- [ ] **Step 5: Implement `HydrationConsistencyDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Hydration consistency (round 2, spec §5): over the trailing 14 days with any water log, what
 * share of days reached 90% of the daily target? Bands: JO (>= 80%), INGADOZO (40-80%), ALACSONY
 * (< 40%). Deliberately NOT a streak/gamification signal (round-2 spec §2) — the analytically
 * useful half is the on-target day rate.
 *
 * <p>Days with no water log at all are ABSENT from the series, so they neither count as 0 ml nor
 * as an on-target day; the rate is computed over logged days only, and needs at least
 * {@link #MIN_LOGGED_DAYS} of them. Fires only on a band change (round-2 spec §6).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class HydrationConsistencyDetector implements CharacterDetector {

    private static final int MIN_LOGGED_DAYS = 7;
    private static final double ON_TARGET_FRACTION = 0.90;
    private static final double JO_MIN = 0.80;
    private static final double INGADOZO_MIN = 0.40;

    @Override
    public String key() {
        return "hydration-consistency";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newWaterData(in)) {
            return List.of();
        }
        Band today = band(in, in.day());
        Band yesterday = band(in, in.day().minusDays(1));
        if (today == null || today.name().equals(yesterday == null ? "" : yesterday.name())) {
            return List.of();
        }
        String phrase = switch (today.name()) {
            case "JO" -> "stabilan tartja a napi vízcélt";
            case "INGADOZO" -> "ingadozik a napi vízcél körül";
            default -> "rendszeresen elmarad a napi vízcéltól";
        };
        String summary = "A hidratáltság " + phrase + ": " + today.loggedDays()
                + " logolt napból " + today.onTargetDays() + " napon teljesült a cél (14 nap).";
        int salience = "ALACSONY".equals(today.name()) ? 4 : 3;
        return List.of(new DetectorSignal(key(), "taplalkozo", summary, salience));
    }

    private record Band(String name, int loggedDays, int onTargetDays) {}

    private static Band band(DetectorInput in, LocalDate asOf) {
        List<DetectorInput.WaterDayPoint> window = new ArrayList<>();
        for (DetectorInput.WaterDayPoint w : in.trend().waterDays()) {
            if (RoundTwoWindow.inWindow(w.date(), asOf)) {
                window.add(w);
            }
        }
        if (window.size() < MIN_LOGGED_DAYS) {
            return null;
        }
        int onTarget = 0;
        for (DetectorInput.WaterDayPoint w : window) {
            if (w.targetMl() > 0 && w.amountMl() >= w.targetMl() * ON_TARGET_FRACTION) {
                onTarget++;
            }
        }
        double rate = (double) onTarget / window.size();
        String name = rate >= JO_MIN ? "JO" : rate >= INGADOZO_MIN ? "INGADOZO" : "ALACSONY";
        return new Band(name, window.size(), onTarget);
    }
}
```

- [ ] **Step 6: Implement `ComfortEatingDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Comfort eating (round 2, spec §2 and §5) — a WITHIN-PERSON covariance, never a population rule:
 * on days where both a check-in and NOVA-classified meals exist, does an intake spike (a NOVA-4
 * kcal share well above the user's OWN 8-week baseline, or a kcal spike above it) land
 * disproportionately on low-mood days?
 *
 * <p>The deterministic proxy is the NOVA-4 share of the day's kcal (nutrition epidemiology's
 * measure), computed at line level and null on days whose coverage was too thin to trust — such
 * days are simply not paired. Needs {@link #MIN_PAIRED_DAYS} paired days; below that the detector
 * is silent rather than noisy, which is the honest reading of a thin sample.
 *
 * <p>The summary states an observed co-occurrence and nothing more — no cause, no diagnosis.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class ComfortEatingDetector implements CharacterDetector {

    private static final int MIN_PAIRED_DAYS = 14;
    private static final int MIN_COOCCURRENCES = 3;
    private static final BigDecimal NOVA_SPIKE_OVER_BASELINE = new BigDecimal("0.15");
    private static final double KCAL_SPIKE_FACTOR = 1.20;
    private static final double RATE_RATIO = 1.5;
    private static final int LOW_STRESS_MIN = 7;   // stress: higher = worse
    private static final int LOW_MENTAL_MAX = 4;   // mental/energy: higher = better
    private static final int LOW_ENERGY_MAX = 4;

    @Override
    public String key() {
        return "comfort-eating";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newMealData(in) && !DetectorGates.newCheckinData(in)) {
            return List.of();
        }
        Finding today = finding(in, in.day());
        Finding yesterday = finding(in, in.day().minusDays(1));
        if (today == null || today.state().equals(yesterday == null ? "" : yesterday.state())) {
            return List.of();
        }
        String summary = "Rossz közérzetű napokon feljebb megy a feldolgozott étel aránya: "
                + today.cooccurrences() + " ilyen nap a " + today.pairedDays()
                + " összepárosított napból (8 hét, saját átlaghoz mérve).";
        return List.of(new DetectorSignal(key(), "taplalkozo", summary, 3));
    }

    private record Finding(String state, int cooccurrences, int pairedDays) {}

    /**
     * Pairs the whole 8-week series (a covariance needs the long window), and the STATE encodes
     * the co-occurrence count, so a new qualifying day changes the state and re-announces once.
     */
    private static Finding finding(DetectorInput in, LocalDate asOf) {
        Map<LocalDate, DetectorInput.CheckinDayPoint> checkins = new HashMap<>();
        for (DetectorInput.CheckinDayPoint c : in.trend().checkinDays()) {
            if (!c.date().isAfter(asOf)) {
                checkins.put(c.date(), c);
            }
        }
        List<DetectorInput.MealDayPoint> paired = new ArrayList<>();
        for (DetectorInput.MealDayPoint m : in.trend().mealDays()) {
            if (!m.date().isAfter(asOf) && m.nova4KcalShare() != null && checkins.containsKey(m.date())) {
                paired.add(m);
            }
        }
        if (paired.size() < MIN_PAIRED_DAYS) {
            return null;
        }
        BigDecimal shareBaseline = mean(paired, DetectorInput.MealDayPoint::nova4KcalShare);
        BigDecimal kcalBaseline = mean(paired, DetectorInput.MealDayPoint::kcal);
        BigDecimal spikeThreshold = shareBaseline.add(NOVA_SPIKE_OVER_BASELINE);

        int lowMoodDays = 0;
        int lowMoodSpikes = 0;
        int otherDays = 0;
        int otherSpikes = 0;
        for (DetectorInput.MealDayPoint m : paired) {
            boolean spike = m.nova4KcalShare().compareTo(spikeThreshold) >= 0
                    || m.kcal().doubleValue() >= kcalBaseline.doubleValue() * KCAL_SPIKE_FACTOR;
            if (lowMood(checkins.get(m.date()))) {
                lowMoodDays++;
                if (spike) {
                    lowMoodSpikes++;
                }
            } else {
                otherDays++;
                if (spike) {
                    otherSpikes++;
                }
            }
        }
        if (lowMoodDays == 0 || lowMoodSpikes < MIN_COOCCURRENCES) {
            return null;
        }
        double lowMoodRate = (double) lowMoodSpikes / lowMoodDays;
        double otherRate = otherDays == 0 ? 0 : (double) otherSpikes / otherDays;
        if (otherRate > 0 && lowMoodRate < otherRate * RATE_RATIO) {
            return null;
        }
        return new Finding("cooc:" + lowMoodSpikes + "/" + paired.size(), lowMoodSpikes, paired.size());
    }

    private static boolean lowMood(DetectorInput.CheckinDayPoint c) {
        return (c.stress() != null && c.stress().doubleValue() >= LOW_STRESS_MIN)
                || (c.mental() != null && c.mental().doubleValue() <= LOW_MENTAL_MAX)
                || (c.energy() != null && c.energy().doubleValue() <= LOW_ENERGY_MAX);
    }

    private static BigDecimal mean(List<DetectorInput.MealDayPoint> rows,
                                   java.util.function.Function<DetectorInput.MealDayPoint, BigDecimal> f) {
        BigDecimal sum = BigDecimal.ZERO;
        int n = 0;
        for (DetectorInput.MealDayPoint m : rows) {
            BigDecimal v = f.apply(m);
            if (v != null) {
                sum = sum.add(v);
                n++;
            }
        }
        return n == 0 ? BigDecimal.ZERO
                : sum.divide(BigDecimal.valueOf(n), 4, java.math.RoundingMode.HALF_UP);
    }
}
```

- [ ] **Step 7: Implement `ProteinTrainingMismatchDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Protein × training mismatch (round 2, spec §5): the protein target is missed specifically on
 * TRAINING days at a materially higher rate than on rest days — protein missing exactly when it
 * matters most. Gym days come from {@code trend().gymEightWeeks()} (round 1 gathered that field
 * but never read it; this detector and {@code stack-skip-pattern} are its first consumers), which
 * is what lets the state be recomputed as of {@code day - 1} too.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class ProteinTrainingMismatchDetector implements CharacterDetector {

    private static final int MIN_DAYS_PER_GROUP = 3;
    private static final double MISS_FRACTION = 0.90; // below 90% of target = a miss
    private static final double MIN_RATE_GAP = 0.30;

    @Override
    public String key() {
        return "protein-training-mismatch";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newMealData(in) && !DetectorGates.newGymData(in)) {
            return List.of();
        }
        Finding today = finding(in, in.day());
        Finding yesterday = finding(in, in.day().minusDays(1));
        if (today == null || today.state().equals(yesterday == null ? "" : yesterday.state())) {
            return List.of();
        }
        String summary = "A fehérje-cél az edzésnapokon marad el: " + today.gymMisses() + "/"
                + today.gymDays() + " edzésnapon, szemben a pihenőnapok " + today.restMisses() + "/"
                + today.restDays() + " arányával (14 nap).";
        return List.of(new DetectorSignal(key(), "taplalkozo", summary, 3));
    }

    private record Finding(String state, int gymMisses, int gymDays, int restMisses, int restDays) {}

    private static Finding finding(DetectorInput in, LocalDate asOf) {
        Set<LocalDate> gymDates = new HashSet<>();
        for (DetectorInput.GymDay g : in.trend().gymEightWeeks()) {
            if (RoundTwoWindow.inWindow(g.date(), asOf)) {
                gymDates.add(g.date());
            }
        }
        List<DetectorInput.MealDayPoint> window = new ArrayList<>();
        for (DetectorInput.MealDayPoint m : in.trend().mealDays()) {
            if (RoundTwoWindow.inWindow(m.date(), asOf) && m.kcal().signum() > 0
                    && m.proteinTarget() != null && m.proteinTarget().signum() > 0) {
                window.add(m);
            }
        }
        int gymDays = 0;
        int gymMisses = 0;
        int restDays = 0;
        int restMisses = 0;
        for (DetectorInput.MealDayPoint m : window) {
            boolean miss = m.proteinG().doubleValue()
                    < m.proteinTarget().doubleValue() * MISS_FRACTION;
            if (gymDates.contains(m.date())) {
                gymDays++;
                if (miss) {
                    gymMisses++;
                }
            } else {
                restDays++;
                if (miss) {
                    restMisses++;
                }
            }
        }
        if (gymDays < MIN_DAYS_PER_GROUP || restDays < MIN_DAYS_PER_GROUP) {
            return null;
        }
        double gymRate = (double) gymMisses / gymDays;
        double restRate = (double) restMisses / restDays;
        if (gymRate - restRate < MIN_RATE_GAP) {
            return null;
        }
        return new Finding("gap:" + gymMisses + "/" + gymDays + ":" + restMisses + "/" + restDays,
                gymMisses, gymDays, restMisses, restDays);
    }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

```bash
cd backend && ./mvnw -q test -Dtest='DetectorTest' -Dmezo.test.use-testcontainers=true
```

Expected: PASS. If a threshold in a test fixture does not trip the detector, adjust the FIXTURE to be unambiguous, not the production threshold — unless the threshold itself is provably wrong, in which case say so in the commit message.

- [ ] **Step 9: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(character): comfort-eating, macro-adherence, hydration-consistency, protein-training-mismatch (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `late-eating-pattern`, `stack-skip-pattern`, `med-cycle-covariance`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/LateEatingPatternDetector.java`
- Create: `.../detector/StackSkipPatternDetector.java`
- Create: `.../detector/MedCycleCovarianceDetector.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/detector/DetectorTest.java`

**Interfaces:**
- Consumes: `RoundTwoWindow` (Task 4), `DetectorGates` and the `DetectorInput` round-2 records (Task 1), the `trend(...)`/`meal(...)`/`checkin(...)` test builders (Task 4).
- Produces: nothing consumed by later tasks (Task 6 only needs the seven detector keys and owners).

- [ ] **Step 1: Write the failing tests**

Add to `DetectorTest.java`:

```java
    @Test
    void lateEating_firesOnRepeatedLateMealsFollowedByWorseSleep() {
        LateEatingPatternDetector d = new LateEatingPatternDetector();
        List<DetectorInput.MealDayPoint> meals = new java.util.ArrayList<>();
        List<DetectorInput.SleepPoint> sleep = new java.util.ArrayList<>();
        for (int i = 0; i < 8; i++) {
            LocalDate date = DAY.minusDays(i);
            boolean late = i % 2 == 0;
            meals.add(new DetectorInput.MealDayPoint(date, new BigDecimal("2900"),
                    new BigDecimal("200"), new BigDecimal("200"), new BigDecimal("60"),
                    null, null, new BigDecimal("3100"), new BigDecimal("220"),
                    List.of(new DetectorInput.MealPoint("snack",
                            late ? java.time.LocalTime.of(22, 30) : java.time.LocalTime.of(19, 0),
                            new BigDecimal("600"), null))));
            // SleepPoint dated D = the night leading INTO D, so day D's night is dated D+1
            sleep.add(new DetectorInput.SleepPoint(date.plusDays(1),
                    late ? 4 : 8, new BigDecimal(late ? "5.5" : "8.0"), 1));
        }
        DetectorInput in = new DetectorInput(DAY, Set.of(), Map.of(), List.of(), Map.of(),
                List.of(), List.of(), List.of(), sleep, null,
                trend(meals, List.of(), null, List.of(), null, List.of()));
        assertThat(d.detect(in)).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("late-eating-pattern");
            assertThat(s.expertKey()).isEqualTo("szomnologus");
        });
    }

    @Test
    void stackSkip_ignoresPeriWorkoutItemsOnRestDays() {
        StackSkipPatternDetector d = new StackSkipPatternDetector();
        UUID pwo = UUID.randomUUID();
        DetectorInput.StackContext stack = new DetectorInput.StackContext(
                List.of(new DetectorInput.StackItem(pwo, "PWO", "pre_workout", null)),
                List.of(new DetectorInput.StackDayPoint(DAY, Set.of())));
        // no gym days anywhere -> the pre-workout item was never EXPECTED -> quiet
        assertThat(d.detect(trendInput(trend(List.of(), List.of(), stack, List.of(), null, List.of()))))
                .isEmpty();
    }

    @Test
    void stackSkip_firesOnRepeatedMissesOfAnEverydayItem() {
        StackSkipPatternDetector d = new StackSkipPatternDetector();
        UUID creatine = UUID.randomUUID();
        List<DetectorInput.StackDayPoint> days = new java.util.ArrayList<>();
        for (int i = 0; i < 10; i++) {
            // taken on odd offsets, missed on even ones (5 misses, DAY itself among them)
            days.add(new DetectorInput.StackDayPoint(DAY.minusDays(i),
                    i % 2 == 0 ? Set.of() : Set.of(creatine)));
        }
        DetectorInput.StackContext stack = new DetectorInput.StackContext(
                List.of(new DetectorInput.StackItem(creatine, "Kreatin", "wake", null)), days);
        assertThat(d.detect(trendInput(trend(List.of(), List.of(), stack, List.of(), null, List.of()))))
                .singleElement().satisfies(s -> {
                    assertThat(s.detectorKey()).isEqualTo("stack-skip-pattern");
                    assertThat(s.expertKey()).isEqualTo("drill");
                    assertThat(s.summary()).contains("Kreatin");
                });
    }

    @Test
    void medCycleCovariance_silentBelowMinimumCycles_andDropsStaleDays() {
        MedCycleCovarianceDetector d = new MedCycleCovarianceDetector();
        List<DetectorInput.MedCycleDayPoint> days = new java.util.ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new java.util.ArrayList<>();
        for (int i = 0; i < 20; i++) {
            // every day marked stale -> nothing usable, regardless of how strong the pattern is
            days.add(new DetectorInput.MedCycleDayPoint(DAY.minusDays(i), (i % 7) + 1, "peak",
                    i + 10, true));
            checkins.add(checkin(DAY.minusDays(i), i % 7 >= 5 ? "3" : "8", "4", "7"));
        }
        DetectorInput.MedContext med = new DetectorInput.MedContext(7, days);
        assertThat(d.detect(trendInput(trend(List.of(), List.of(), null, checkins, med, List.of()))))
                .isEmpty();
    }

    @Test
    void medCycleCovariance_firesOnACycleDayBucketThatDivergesFromTheCycleMean() {
        MedCycleCovarianceDetector d = new MedCycleCovarianceDetector();
        List<DetectorInput.MedCycleDayPoint> days = new java.util.ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new java.util.ArrayList<>();
        for (int i = 0; i < 28; i++) {
            int cycleDay = (i % 7) + 1;
            days.add(new DetectorInput.MedCycleDayPoint(DAY.minusDays(i), cycleDay, "peak",
                    cycleDay - 1, false));
            // energy collapses on cycle days 6-7 in every cycle
            checkins.add(checkin(DAY.minusDays(i), cycleDay >= 6 ? "3" : "8", "4", "7"));
        }
        DetectorInput.MedContext med = new DetectorInput.MedContext(7, days);
        assertThat(d.detect(trendInput(trend(List.of(), List.of(), null, checkins, med, List.of()))))
                .singleElement().satisfies(s -> {
                    assertThat(s.detectorKey()).isEqualTo("med-cycle-covariance");
                    assertThat(s.expertKey()).isEqualTo("doki");
                    // descriptive only: no advice, no diagnosis verbs
                    assertThat(s.summary()).doesNotContain("javaslom").doesNotContain("kellene");
                    // HU decimal comma: a digit.digit pair must never appear (the closing period is fine)
                    assertThat(s.summary()).doesNotMatch(".*\\d\\.\\d.*");
                });
    }
```

Add `import java.util.UUID;` to `DetectorTest.java` if absent.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend && ./mvnw -q test -Dtest='DetectorTest' -Dmezo.test.use-testcontainers=true
```

Expected: FAIL — the three classes do not exist.

- [ ] **Step 3: Implement `LateEatingPatternDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Late-eating pattern (round 2, spec §5): a substantial meal logged late in the evening, repeatedly
 * followed by a worse night. A {@link DetectorInput.SleepPoint} dated {@code D} is the night
 * leading INTO day {@code D} (the companion "last night" convention), so the night AFTER a late
 * meal on day {@code D} is the sleep point dated {@code D + 1} — the off-by-one that matters here.
 *
 * <p>Owned by {@code szomnologus}: this is a rhythm signal ("alvásminőség és -ritmus"), not a
 * nutrition-quality one.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class LateEatingPatternDetector implements CharacterDetector {

    private static final LocalTime LATE_FROM = LocalTime.of(21, 30);
    private static final BigDecimal SUBSTANTIAL_KCAL = new BigDecimal("300");
    private static final int POOR_QUALITY_MAX = 5;
    private static final BigDecimal SHORT_DURATION_H = new BigDecimal("6.5");
    private static final int MIN_PAIRS = 2;

    @Override
    public String key() {
        return "late-eating-pattern";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newMealData(in) && !DetectorGates.newSleepData(in)) {
            return List.of();
        }
        Integer today = pairs(in, in.day());
        Integer yesterday = pairs(in, in.day().minusDays(1));
        if (today == null || today.equals(yesterday)) {
            return List.of();
        }
        String summary = "Késő esti evés után rosszabb az éjszaka: " + today
                + " ilyen nap 14 napon belül (21:30 után legalább 300 kcal).";
        return List.of(new DetectorSignal(key(), "szomnologus", summary, 3));
    }

    /** Null when below the minimum; otherwise the pair count, which doubles as the state. */
    private static Integer pairs(DetectorInput in, LocalDate asOf) {
        Map<LocalDate, DetectorInput.SleepPoint> nights = new HashMap<>();
        for (DetectorInput.SleepPoint sp : in.sleepPoints()) {
            nights.put(sp.date(), sp);
        }
        int pairs = 0;
        for (DetectorInput.MealDayPoint m : in.trend().mealDays()) {
            if (!RoundTwoWindow.inWindow(m.date(), asOf) || !hasLateMeal(m)) {
                continue;
            }
            DetectorInput.SleepPoint night = nights.get(m.date().plusDays(1));
            if (night != null && poor(night)) {
                pairs++;
            }
        }
        return pairs < MIN_PAIRS ? null : pairs;
    }

    private static boolean hasLateMeal(DetectorInput.MealDayPoint m) {
        for (DetectorInput.MealPoint p : m.meals()) {
            if (p.loggedAtLocalTime() != null && !p.loggedAtLocalTime().isBefore(LATE_FROM)
                    && p.kcal() != null && p.kcal().compareTo(SUBSTANTIAL_KCAL) >= 0) {
                return true;
            }
        }
        return false;
    }

    private static boolean poor(DetectorInput.SleepPoint sp) {
        return (sp.quality() != null && sp.quality() <= POOR_QUALITY_MAX)
                || (sp.durationH() != null && sp.durationH().compareTo(SHORT_DURATION_H) < 0);
    }
}
```

- [ ] **Step 4: Implement `StackSkipPatternDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Supplement-stack skip pattern (round 2, spec §4.3, §5). There is NO skip row in the domain — a
 * skip is derived, and the derivation must respect the product's own rest-day rule: an item placed
 * in a peri-workout zone on a day with no training is not a miss, it is either displaced to its
 * {@code restDayFallback} zone or deliberately dropped (FE precedent:
 * {@code features/fuel/logic/projectStackDay.ts}). Training days come from
 * {@code trend().gymEightWeeks()}.
 *
 * <p>Overfiring: the state is the offending item plus its miss count, so an unchanged pattern is
 * silent. ONE documented widening, mirroring {@code MesoAdherenceDetector}'s shape: the detector
 * also fires when the observed day itself carries a miss for that item, so a second consecutive
 * skipped day is not swallowed by an unchanged state string.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class StackSkipPatternDetector implements CharacterDetector {

    private static final int MIN_MISSED_DAYS = 3;
    private static final Set<String> PERI_WORKOUT_ZONES = Set.of("pre_workout", "post_workout");

    @Override
    public String key() {
        return "stack-skip-pattern";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (in.trend().stack() == null) {
            return List.of();
        }
        Finding today = finding(in, in.day());
        if (today == null) {
            return List.of();
        }
        Finding yesterday = finding(in, in.day().minusDays(1));
        boolean changed = yesterday == null || !today.state().equals(yesterday.state());
        if (!changed && !today.missedOnDayItself()) {
            return List.of();
        }
        String summary = "Kiegészítő-kihagyás: a(z) " + today.name() + " " + today.missedDays()
                + " napon maradt ki a tervezett " + today.expectedDays() + " napból (14 nap).";
        return List.of(new DetectorSignal(key(), "drill", summary, 3));
    }

    private record Finding(String state, String name, int missedDays, int expectedDays,
                           boolean missedOnDayItself) {}

    private static Finding finding(DetectorInput in, LocalDate asOf) {
        DetectorInput.StackContext stack = in.trend().stack();
        Set<LocalDate> gymDates = new HashSet<>();
        for (DetectorInput.GymDay g : in.trend().gymEightWeeks()) {
            gymDates.add(g.date());
        }
        Map<LocalDate, Set<UUID>> takenByDate = new HashMap<>();
        for (DetectorInput.StackDayPoint d : stack.days()) {
            takenByDate.put(d.date(), d.takenPantryItemIds());
        }

        Finding best = null;
        for (DetectorInput.StackItem item : stack.items()) {
            int expected = 0;
            int missed = 0;
            boolean missedToday = false;
            for (LocalDate d = asOf.minusDays(RoundTwoWindow.WINDOW_DAYS - 1L); !d.isAfter(asOf);
                    d = d.plusDays(1)) {
                if (!expectedOn(item, d, gymDates)) {
                    continue;
                }
                expected++;
                if (!takenByDate.getOrDefault(d, Set.of()).contains(item.pantryItemId())) {
                    missed++;
                    if (d.equals(asOf)) {
                        missedToday = true;
                    }
                }
            }
            if (missed < MIN_MISSED_DAYS) {
                continue;
            }
            if (best == null || missed > best.missedDays()) {
                best = new Finding(item.pantryItemId() + ":" + missed + "/" + expected,
                        item.name(), missed, expected, missedToday);
            }
        }
        return best;
    }

    /**
     * A peri-workout item is expected only on a day with a completed gym session; on a rest day it
     * either displaces to its {@code restDayFallback} zone or is deliberately dropped — either way
     * it is not a compliance miss. Every other item is expected daily.
     */
    private static boolean expectedOn(DetectorInput.StackItem item, LocalDate date,
                                      Set<LocalDate> gymDates) {
        if (item.slotKey() != null && PERI_WORKOUT_ZONES.contains(item.slotKey())) {
            return gymDates.contains(date);
        }
        return true;
    }
}
```

Note on imports: this class does not use `java.util.ArrayList` — do not add an unused import.

- [ ] **Step 5: Implement `MedCycleCovarianceDetector`**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Medication-cycle covariance (round 2, spec §2, §5) — ÉRZÉKENY. Buckets the daily check-in scales
 * by CYCLE DAY (days since the last dose, dose-anchored, never calendar-anchored) and reports the
 * bucket that diverges most from the cycle mean. This is the day-since-dose analysis GLP-1 trackers
 * productise, and it inherits their framing discipline: context, not measurement; description, not
 * diagnosis, and never anything resembling dosing advice.
 *
 * <p>Days whose last dose is older than a full cycle are marked {@code stale} by the read layer
 * (because {@code MedicationCycleService} clamps them for the Fuel UI) and are dropped here — a
 * clamped day would otherwise pile weeks of no-dose days into the last bucket.
 *
 * <p>Sensitivity is enforced at CLAIM level: the konzílium proposal prompt already marks
 * gyógyszerciklus topics {@code sensitive=true}, and the portrait writer / prompt assembler render
 * the ÉRZÉKENY marker. There is no code-level gate, so this summary's own wording must already be
 * neutral and purely descriptive.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class MedCycleCovarianceDetector implements CharacterDetector {

    private static final int MIN_USABLE_DAYS = 14;
    private static final int MIN_DAYS_PER_BUCKET = 2;
    private static final double MIN_DELTA_POINTS = 1.0;

    private record Metric(String key, String label, boolean higherIsBetter) {}

    private static final List<Metric> METRICS = List.of(
            new Metric("energy", "energia", true),
            new Metric("stress", "stressz", false),
            new Metric("body", "testi közérzet", true),
            new Metric("mental", "mentális tisztaság", true));

    @Override
    public String key() {
        return "med-cycle-covariance";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (in.trend().med() == null) {
            return List.of();
        }
        if (!DetectorGates.newCheckinData(in) && !DetectorGates.newDoseData(in)) {
            return List.of();
        }
        Finding today = finding(in, in.day());
        Finding yesterday = finding(in, in.day().minusDays(1));
        if (today == null || today.state().equals(yesterday == null ? "" : yesterday.state())) {
            return List.of();
        }
        String direction = today.delta() < 0 ? "alacsonyabb" : "magasabb";
        String summary = "A gyógyszerciklus " + today.cycleDay() + ". napján a(z) " + today.label()
                + " átlaga " + RoundTwoWindow.hu(BigDecimal.valueOf(Math.abs(today.delta())), 1)
                + " ponttal " + direction + " a ciklus átlagánál (" + today.bucketDays()
                + " ilyen nap, 8 hét).";
        return List.of(new DetectorSignal(key(), "doki", summary, 3));
    }

    private record Finding(String state, int cycleDay, String label, double delta, int bucketDays) {}

    private static Finding finding(DetectorInput in, LocalDate asOf) {
        Map<LocalDate, DetectorInput.CheckinDayPoint> checkins = new HashMap<>();
        for (DetectorInput.CheckinDayPoint c : in.trend().checkinDays()) {
            checkins.put(c.date(), c);
        }
        // cycleDay -> the day's check-ins, stale days dropped
        Map<Integer, List<DetectorInput.CheckinDayPoint>> buckets = new TreeMap<>();
        int usable = 0;
        for (DetectorInput.MedCycleDayPoint d : in.trend().med().days()) {
            if (d.stale() || d.date().isAfter(asOf)) {
                continue;
            }
            DetectorInput.CheckinDayPoint c = checkins.get(d.date());
            if (c == null) {
                continue;
            }
            buckets.computeIfAbsent(d.cycleDay(), k -> new ArrayList<>()).add(c);
            usable++;
        }
        if (usable < MIN_USABLE_DAYS) {
            return null;
        }
        Finding best = null;
        for (Metric metric : METRICS) {
            Double overall = mean(buckets.values().stream().flatMap(List::stream).toList(), metric);
            if (overall == null) {
                continue;
            }
            for (Map.Entry<Integer, List<DetectorInput.CheckinDayPoint>> e : buckets.entrySet()) {
                if (e.getValue().size() < MIN_DAYS_PER_BUCKET) {
                    continue;
                }
                Double bucketMean = mean(e.getValue(), metric);
                if (bucketMean == null) {
                    continue;
                }
                double delta = bucketMean - overall;
                if (Math.abs(delta) < MIN_DELTA_POINTS) {
                    continue;
                }
                if (best == null || Math.abs(delta) > Math.abs(best.delta())) {
                    best = new Finding(metric.key() + ":" + e.getKey() + ":"
                            + Math.round(delta * 10), e.getKey(), metric.label(), delta,
                            e.getValue().size());
                }
            }
        }
        return best;
    }

    private static Double mean(List<DetectorInput.CheckinDayPoint> rows, Metric metric) {
        double sum = 0;
        int n = 0;
        for (DetectorInput.CheckinDayPoint c : rows) {
            BigDecimal v = switch (metric.key()) {
                case "energy" -> c.energy();
                case "stress" -> c.stress();
                case "body" -> c.body();
                default -> c.mental();
            };
            if (v != null) {
                sum += v.doubleValue();
                n++;
            }
        }
        return n == 0 ? null : sum / n;
    }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd backend && ./mvnw -q test -Dtest='DetectorTest' -Dmezo.test.use-testcontainers=true
```

Expected: PASS (all round-1 and round-2 tests).

- [ ] **Step 7: Verify all 20 detectors are discovered**

```bash
cd backend && ./mvnw -q test -Dtest='*Character*' -Dmezo.test.use-testcontainers=true
```

Expected: PASS. If a `DetectorRegistry`-count assertion exists anywhere, update it to 20 in this task.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(character): late-eating-pattern, stack-skip-pattern, med-cycle-covariance (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Gépterem flip, mocks, docs

**Files:**
- Modify: `frontend/src/features/character/inventory.ts`
- Modify: `frontend/src/features/character/pages/DetektorokPage.tsx`
- Modify: `frontend/src/data/character/characterMock.ts`
- Modify: `docs/features/character.md`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/MealEntity.java` (stale javadoc line only)
- Modify: `docs/CODEMAP.md` (generated)
- Test: the existing `DetektorokPage.test.tsx`, `GeptermPage.test.tsx`, `AdatforrasokPage.test.tsx` must stay green

**Interfaces:**
- Consumes: the seven detector keys and their real owners from Tasks 4–5: `comfort-eating`/taplalkozo, `macro-adherence`/taplalkozo, `hydration-consistency`/taplalkozo, `protein-training-mismatch`/taplalkozo, `late-eating-pattern`/szomnologus, `stack-skip-pattern`/drill, `med-cycle-covariance`/doki.
- Produces: nothing (final task).

- [ ] **Step 1: Flip the inventory**

In `inventory.ts`, DELETE the entire `n: 2` object from `INVENTORY_ROUNDS`, and append to `INVENTORY_READS`:

```ts
  { w: 'Étkezés-napok (makrók, NOVA-arány, étkezés-időpont)', chips: ['8 hét'] },
  { w: 'Makró-célok (aktív cél receptje, különben config)', chips: ['napi'] },
  { w: 'Víz-logok (napi mennyiség vs cél)', chips: ['8 hét'] },
  { w: 'Kiegészítő-stack (aktív protokoll + bevitelek)', chips: ['8 hét', 'aktív protokoll'] },
  { w: 'Check-in skálák (energia, stressz, testi, mentális)', chips: ['8 hét'] },
  { w: 'Gyógyszerciklus (ciklusnap, fázis)', chips: ['8 hét', 'aktív gyógyszer'] },
```

Update the file's header comment: round 2 ("Fuel & ciklus") landed the same way round 1 did — its four items are gone from `rounds`, its six data sources are the last six `reads` rows, its seven detectors are in `DetektorokPage.tsx`, and the catalog is now 20 detectors.

- [ ] **Step 2: Extend the detector catalog**

In `DetektorokPage.tsx`, append to `DETECTORS`:

```ts
  { key: 'comfort-eating', who: 'taplalkozo', line: 'Rossz közérzetű napokon feljebb megy-e a feldolgozott étel aránya — saját átlaghoz mérve, 8 hét.' },
  { key: 'macro-adherence', who: 'taplalkozo', line: 'A kalória- vagy fehérje-cél szisztematikus alul-/túllövése a valós napi célhoz képest.' },
  { key: 'hydration-consistency', who: 'taplalkozo', line: 'A napi vízcélt teljesítő napok aránya — csak sávváltáskor szólal meg.' },
  { key: 'protein-training-mismatch', who: 'taplalkozo', line: 'A fehérje pont az edzésnapokon marad-e el, a pihenőnapokhoz képest.' },
  { key: 'late-eating-pattern', who: 'szomnologus', line: 'Késő esti nagyobb étkezés után rosszabb-e az azt követő éjszaka.' },
  { key: 'stack-skip-pattern', who: 'drill', line: 'Ismétlődő kiegészítő-kihagyások — a pihenőnapi elhagyás nem számít kihagyásnak.' },
  { key: 'med-cycle-covariance', who: 'doki', line: 'A check-in skálák ciklusnap szerinti eltérése a ciklus átlagától — érzékeny, leíró jel.' },
```

Update the header comment and the `DETECTORS` javadoc from "13 real detectors" to 20, naming the seven round-2 detectors and stating that each `who` was verified against its own `DetectorSignal(key(), who, ...)` call in `backend/.../character/detector/{ComfortEating,MacroAdherence,HydrationConsistency,ProteinTrainingMismatch,LateEatingPattern,StackSkipPattern,MedCycleCovariance}Detector.java`.

- [ ] **Step 3: Add mock chains**

In `characterMock.ts`, add one `ChainSeed` per new detector to `CHAIN_POOL`, spread across days as round 1 did (do NOT touch day 15 — it is a pinned dedup fixture). Every entry: `refs: []`, `who` matching the real owner from Step 2, and `code` paraphrasing the real backend summary string. Example shape for one of them:

```ts
    {
      detector: 'hydration-consistency',
      code: '12 logolt napból 4 napon teljesült a vízcél — a sáv ma váltott',
      refs: [],
      who: 'taplalkozo',
      obs: 'A vízbevitel ingadozóra váltott ezen a héten — nem a mennyiség, a ritmus csúszott el.',
    },
```

Extend the `CHAIN_POOL` header comment with a round-2 paragraph mirroring the round-1 one.

- [ ] **Step 4: Run the FE gates in BOTH modes**

```bash
cd frontend && pnpm test
```

```bash
cd frontend && VITE_USE_MOCK=false pnpm test
```

```bash
cd frontend && pnpm build
```

Expected: all PASS. If a test asserts a detector count, update it to derive from the `DETECTORS` array rather than hardcoding a number.

- [ ] **Step 5: Update the domain doc**

In `docs/features/character.md`: extend the detector catalog table with the seven new rows (key, owner, what it watches, when it fires), document the round-2 read widening (the 8-week-only round-2 series and why, the state-change gate as round 2's primary overfiring protection, the `stale` cycle-day guard, the derived stack-skip semantics), record that `TrendWindow.gymEightWeeks` now has real consumers, and shrink the §9 "detector catalog is narrower than spec" ledger by the round-2 entries.

- [ ] **Step 6: Fix the stale `MealEntity` javadoc**

In `MealEntity.java`, the `breakdown` field javadoc claims the column is "always NULL in v1 — the score is deferred to Phase-3". That is contradicted by the same javadoc's later line and by the shipped `MealScoringService`. Delete only the stale sentence; change nothing else in the file.

- [ ] **Step 7: Regenerate CODEMAP and lint docs**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
```

```bash
node scripts/lint-docs.mjs --errors-only
```

Expected: both PASS. Run `lint-docs` exactly with `--errors-only` — the bare form fails on a pre-existing stale-doc baseline that also exists on origin/main and is not a merge blocker.

- [ ] **Step 8: Commit**

```bash
git add frontend/src docs backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/MealEntity.java
git commit -m "feat(character): Gépterem round-2 flip — inventory, 20 detectors, mock chains, docs (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Final gates (after Task 6, before the PR)

```bash
cd backend && ./mvnw -q test -Dtest='*Character*,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```

```bash
cd frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

```bash
node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs --errors-only
```

Then: push the branch, open the self-PR, wait for CI green, merge `--no-ff` locally into main, push, delete the branch, `bd update mezo-1gim.15 --notes` (the issue stays OPEN for rounds 3–4), `bd dolt push`.
