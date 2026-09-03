# Karakter MINDENT-be Round 1 (Edzés & test) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the training-and-body domain into the Karakter detector pipeline: widen `DetectorInput`/`CharacterSignalReads` with gym sets, sport sessions, run logs, sleep and mesocycle context, add eight pure-code detectors, and flip the Gépterem inventory round-1 rows to "bekötve".

**Architecture:** `CharacterSignalReads` stays the single cross-feature read composer; `DetectorInput` gains a 14-day detailed slice (gym/sport/run/sleep/meso) plus raw 8-week series for the two trend detectors. Detectors are stateless `@Component`s discovered by `DetectorRegistry`; overfiring is prevented by a stateless new-data gate (fire only when data dated `day` exists for the detector's source family) and, for trends, a band-change gate computed by double evaluation (as-of `day` vs as-of `day-1`). No contract or schema change.

**Tech Stack:** Spring Boot 4 / Hibernate 7 backend, JUnit (plain unit tests for detectors, Testcontainers IT for reads), React+Vitest FE.

**Spec:** `docs/superpowers/specs/2026-08-31-character-round1-edzes-test-design.md`

## Global Constraints

- Branch `feat/character-s10-edzes-test`; work ONLY in the worktree `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba`.
- Backend gates: focused tests only, ALWAYS `-Dmezo.test.use-testcontainers=true`; never the full suite locally. `ArchitectureTest` MUST be in the focused run of any task adding cross-feature imports.
- Detector summaries are Hungarian, numbers computed in code, decimal comma via the `huNumber` idiom (`value.toPlainString().replace('.', ',')`) — never locale-dependent formatting.
- No raw generic exceptions outside techcore (ArchUnit). `@Transactional` method-level only. No new jsonb; no bare `List<String>` + `SqlTypes.JSON` anywhere.
- Salience is an int 1..5. Expert keys used: `edzo`, `doki`, `szomnologus`, `drill` (must match `CharacterExpertCatalog`).
- FE: views import only `@/data/hooks`; tests must pass in BOTH modes (`pnpm test` and `VITE_USE_MOCK=false pnpm test`); mock numbers derived, not hardcoded.
- Regenerate `docs/CODEMAP.md` in the final task (`node scripts/gen-codemap.mjs`).
- Commit messages: conventional, carrying `(mezo-1gim.15)`.
- `hrRecoverySec` semantics: LOWER seconds = better recovery (verified: `RunningPage.tsx:325` "lower mp = better recovery").
- Sleep row semantics: a `SleepLogEntity` dated `D` is treated as the night leading into day `D` (the companion snapshot's "last night" convention — `SleepLogRepository.findFirstBy...OrderByDateDesc` javadoc); pair it with day-`D` training. State this assumption in a code comment where used.

---

### Task 1: Read layer — DetectorInput widening + CharacterSignalReads + IT

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/DetectorInput.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterSignalReads.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/RunSessionLogRepository.java` (add range finder)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/ExerciseFeedbackRepository.java` (add `In` finder)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/character/detector/DetectorTest.java` (extend the `input(...)` helper so existing tests compile)
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterSignalReadsIT.java`

**Interfaces:**
- Produces the widened `DetectorInput` every later task consumes — copy these records EXACTLY:

```java
public record DetectorInput(LocalDate day,
                            Set<LocalDate> mealDates,
                            Map<LocalDate, Integer> checkinCounts,
                            List<WeightPoint> weights,
                            Map<LocalDate, List<String>> journalTexts,
                            List<GymDay> gymDays,
                            List<SportPoint> sportSessions,
                            List<RunPoint> runLogs,
                            List<SleepPoint> sleepPoints,
                            MesoContext meso,
                            TrendWindow trend) {
    public record WeightPoint(LocalDate date, BigDecimal kg) {}
    /** One completed gym instance day with per-exercise aggregates (working sets only). */
    public record GymDay(LocalDate date, List<ExerciseWork> exercises) {}
    /** Per-exercise aggregate for one session. Nullable aggregates mean "no data", never zero. */
    public record ExerciseWork(String exerciseName,
                               int workingSets,
                               int skippedSets,
                               List<SetPoint> sets,
                               Integer worstJointPain,
                               Integer pump,
                               Integer workload) {}
    /** One logged working set, ordered by setIndex. Nullable fields were not logged. */
    public record SetPoint(int setIndex, BigDecimal weightKg, Integer reps, Integer rir,
                           BigDecimal targetWeightKg, Integer targetReps, boolean skipped) {}
    public record SportPoint(LocalDate date, String sport, BigDecimal rpe,
                             Integer shoulderStrain, Integer jumpCount, Integer intensity) {}
    public record RunPoint(LocalDate date, Integer rpeActual, Integer hrRecoverySec,
                           Integer completedRounds) {}
    /** date = the night leading into that day (companion "last night" convention). */
    public record SleepPoint(LocalDate date, Integer quality, BigDecimal durationH,
                             Integer awakenings) {}
    /** Active mesocycle context; null when no active meso. plannedDays from gym schedule slots. */
    public record MesoContext(String title, int currentWeek, int totalWeeks, boolean deloadWeek,
                              Set<DayOfWeek> plannedDays, Set<LocalDate> doneDays) {}
    /** Raw 8-week series ending at day — trend detectors aggregate these themselves so they can
     *  recompute the band both as-of day and as-of day-1 (stateless band-change gate). */
    public record TrendWindow(List<RunPoint> runsEightWeeks, List<GymDay> gymEightWeeks) {}
}
```

- `CharacterSignalReads.gather(UUID owner, LocalDate day)` keeps its signature and fills every new component. New constants: `WINDOW_DAYS = 14` (existing), `TREND_WEEKS = 8`.

**Details for gather():**
- Gym days (14-day AND 8-week): `workoutSessionRepository.findDoneInstancesBetween(owner, trendStart, day)` (trendStart = `day.minusWeeks(8).plusDays(1)`); for their ids: `exerciseSetRepository.findWorkingSetsInSessions(owner, sessionIds)` (batched, one call), `exerciseFeedbackRepository.findByCreatedByAndWorkoutSessionIdIn(owner, sessionIds)` (NEW finder: `List<ExerciseFeedbackEntity> findByCreatedByAndWorkoutSessionIdIn(UUID createdBy, Collection<UUID> workoutSessionIds);`), exercise names via `exerciseRepository.findAllById(exerciseIds)` filtered to `createdBy.equals(owner)` (ownership check in code — findAllById is the JpaRepository built-in). Group sets per session per exercise → `ExerciseWork` with sets sorted by setIndex; `skippedSets` = count of `skipped==true` sets among ALL that exercise's sets in the session (fetch those with `findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc` — one extra call per gather is fine, filter in memory; working+skipped both come from this one list, drop `findWorkingSetsInSessions` if simpler — implementer's choice, but ONE strategy, commented). `worstJointPain/pump/workload` from the matching feedback row (nullable). GymDays with `date` in the last 14 days go to `gymDays`; the full 8-week list goes to `trend.gymEightWeeks`.
- Sport: `sportSessionRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(owner, windowStart, day)` → `SportPoint` (14-day only).
- Runs: NEW finder on `RunSessionLogRepository`: `List<RunSessionLogEntity> findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(UUID createdBy, LocalDate from, LocalDate to);` — call once with the 8-week window; 14-day slice filtered in memory into `runLogs`, full list into `trend.runsEightWeeks`.
- Sleep: `sleepLogRepository.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(owner, windowStart, day)` → `SleepPoint` (14-day).
- Meso: `mesocycleRepository.findByCreatedByAndStatusAndDeletedFalse(owner, "active")` → first or null context. `deloadWeek`: copy the `VolumeProgressionService.isDeloadPhase` logic (phaseCurve, `"Deload"` equalsIgnoreCase, currentWeek−1 index, bounds-checked). `plannedDays`: `gymScheduleSlotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(owner)` mapped `DayOfWeek.of(slot.getDayOfWeek() + 1)` (slots are 0=Mon..6=Sun). `doneDays`: `workoutSessionRepository.findMesoDoneInstanceDates(owner, windowStart, day)` as a Set.
- **Catch-up honesty:** every read is bounded above by `day` via the range finders themselves (Between/…LessThanEqual); where a finder only bounds below, filter `!x.getDate().isAfter(day)` in memory like the existing weight read. State it in the class javadoc.

**Steps:**

- [ ] **Step 1: Extend `DetectorInput`** with the records above (imports: `java.time.DayOfWeek`). Extend `DetectorTest`'s private `input(...)` helper to pass empty new components (`List.of(), List.of(), List.of(), List.of(), null, new DetectorInput.TrendWindow(List.of(), List.of())`) so the 6 existing tests compile unchanged. Add a second helper for later tasks:

```java
/** Full-control builder for the round-1 detectors; existing helper delegates here. */
private DetectorInput input(Set<LocalDate> mealDates, Map<LocalDate, Integer> checkins,
        List<DetectorInput.WeightPoint> weights, Map<LocalDate, List<String>> journal,
        List<DetectorInput.GymDay> gymDays, List<DetectorInput.SportPoint> sport,
        List<DetectorInput.RunPoint> runs, List<DetectorInput.SleepPoint> sleep,
        DetectorInput.MesoContext meso, DetectorInput.TrendWindow trend) {
    return new DetectorInput(DAY, mealDates, checkins, weights, journal,
            gymDays, sport, runs, sleep, meso, trend);
}
```

- [ ] **Step 2: Run existing detector tests** — `cd backend && ./mvnw test -Dtest='DetectorTest' -Dmezo.test.use-testcontainers=true` → 6 green (compile proof).
- [ ] **Step 3: Add the two new repository finders** (signatures above, with one-line javadoc each naming the character read as the consumer).
- [ ] **Step 4: Write the failing IT** `CharacterSignalReadsIT extends ApiIntegrationTest` (`@ActiveProfiles("companion-fake")`, autowire `CharacterSignalReads`, `DatabasePopulator`, `TrainPopulator`, `SleepLogPopulator`, `OwnerProperties`). `DAY = LocalDate.of(2026, 8, 26)`. Tests:
  - `gather_fillsTrainSleepAndMesoSlices`: seed an active meso via `trainPopulator.createActiveMeso(owner)`; a template day + completed instance on DAY with sets (use `completedInstanceWithSets`-family helpers; if none fits exactly, compose `createTemplateDay` + `createWorkoutInstance(owner, template, DAY, "completed")` + direct `ExerciseEntity`/`ExerciseSetEntity` saves through the populator's repositories); `createSportSessionWithRpe(owner, DAY.minusDays(1), 8)`; a run log row on DAY.minusDays(2) (save via `RunSessionLogRepository` directly if `TrainPopulator` has no helper — set `createdBy`, date, `rpeActual 7`, `hrRecoverySec 90`); `sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("6.5"), 5)`. Assert: `gymDays` has the DAY entry with the exercise name and set count; `sportSessions` size 1 with shoulder/rpe carried; `runLogs` size 1; `sleepPoints` size 1; `meso != null` with `deloadWeek` matching the seeded phase; `trend.runsEightWeeks` contains the run.
  - `gather_boundsAboveByDay_forCatchUp`: additionally seed a sport session, a run log, a sleep row and a completed instance dated `DAY.plusDays(1)`; call `gather(owner, DAY)`; assert none of them appear in any slice (incl. `trend.*`).
  - `gather_nullMeso_whenNoActive`: fresh owner (populate a second user), no meso → `meso` null, lists empty, no exception.
- [ ] **Step 5: Run IT to verify it fails** — `./mvnw test -Dtest='CharacterSignalReadsIT' -Dmezo.test.use-testcontainers=true` → compile/assert failures expected.
- [ ] **Step 6: Implement `gather()` widening** per Details above.
- [ ] **Step 7: Run the focused gate** — `./mvnw test -Dtest='CharacterSignalReadsIT,DetectorTest,CharacterObservationServiceIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true` → all green (ArchitectureTest proves the new one-way `character→train` edge opens no cycle — verified in exploration: train never imports character).
- [ ] **Step 8: Commit** — `git add -A backend && git commit -m "feat(character): widen DetectorInput + CharacterSignalReads with train/sleep/meso reads (mezo-1gim.15)"`

---

### Task 2: Edző detectors I — `rir-calibration` + `niggle-map`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/RirCalibrationDetector.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/NiggleMapDetector.java`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/character/detector/DetectorTest.java`

**Interfaces:**
- Consumes Task 1's `DetectorInput` records exactly as defined there.
- Produces `DetectorSignal`s with `expertKey = "edzo"`.

**Shared new-data gate idiom (used by every round-1 detector; write it as a tiny package-private helper class so all eight share one definition):**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/RoundOneGates.java`:

```java
package io.mrkuhne.mezo.feature.character.detector;

import java.time.LocalDate;

/**
 * Stateless overfiring protection for the round-1 (edzés & test) detectors, spec §5 of
 * 2026-08-31-character-round1-edzes-test-design.md: a sliding window recomputed nightly must not
 * re-announce an unchanged state, so a detector only fires when NEW data for its source family
 * arrived on the observed day. No table, no "last fired" state — pure date checks.
 */
final class RoundOneGates {
    private RoundOneGates() {}

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

    static boolean onDay(LocalDate date, DetectorInput in) {
        return date.equals(in.day());
    }
}
```

**`RirCalibrationDetector` — full implementation:**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * RIR-calibration miss events (round 1, spec §4): within one exercise in one session, a logged
 * RIR should predict the next same-weight set. rir >= 2 followed by a reps collapse (>= 3 fewer)
 * means the RIR was OVERestimated (closer to failure than claimed); rir == 0 followed by reps
 * holding (drop <= 1) means UNDERestimated. Fires on >= 3 events in the 14-day window with a
 * dominant direction, gated on new gym data (RoundOneGates).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class RirCalibrationDetector implements CharacterDetector {

    private static final int MIN_EVENTS = 3;

    @Override
    public String key() {
        return "rir-calibration";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!RoundOneGates.newGymData(in)) {
            return List.of();
        }
        int over = 0;
        int under = 0;
        for (DetectorInput.GymDay day : in.gymDays()) {
            for (DetectorInput.ExerciseWork work : day.exercises()) {
                List<DetectorInput.SetPoint> sets = work.sets();
                for (int i = 0; i + 1 < sets.size(); i++) {
                    DetectorInput.SetPoint a = sets.get(i);
                    DetectorInput.SetPoint b = sets.get(i + 1);
                    if (a.rir() == null || a.reps() == null || b.reps() == null
                            || a.skipped() || b.skipped()
                            || a.weightKg() == null || b.weightKg() == null
                            || a.weightKg().compareTo(b.weightKg()) != 0) {
                        continue;
                    }
                    int drop = a.reps() - b.reps();
                    if (a.rir() >= 2 && drop >= 3) {
                        over++;
                    } else if (a.rir() == 0 && drop <= 1) {
                        under++;
                    }
                }
            }
        }
        int total = over + under;
        if (total < MIN_EVENTS || over == under) {
            return List.of();
        }
        String summary = over > under
                ? "A RIR-becslés felfelé csúszik: " + over + " szettpárnál a mondott 2+ RIR után "
                        + "összeomlott a következő szett (14 nap)."
                : "A RIR-becslés lefelé csúszik: " + under + " szettpárnál a mondott 0 RIR után is "
                        + "tartotta a repset a következő szett (14 nap).";
        return List.of(new DetectorSignal(key(), "edzo", summary, Math.min(2 + total / 2, 5)));
    }
}
```

**`NiggleMapDetector` — full implementation:**

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Niggle map (round 1, spec §4). There is NO niggle entity — niggle truth is scattered across
 * ExerciseFeedbackEntity.jointPain (1..3, per exercise per session) and
 * SportSessionEntity.shoulderStrain (1..10). Fires when jointPain >= 2 repeats on the same
 * exercise (>= 2 sessions in the window) or shoulderStrain >= 6 on >= 2 sport sessions; the
 * summary carries the body map. Gated on new gym OR sport data.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class NiggleMapDetector implements CharacterDetector {

    private static final int JOINT_PAIN_MIN = 2;
    private static final int SHOULDER_STRAIN_MIN = 6;
    private static final int MIN_REPEATS = 2;

    @Override
    public String key() {
        return "niggle-map";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!RoundOneGates.newGymData(in) && !RoundOneGates.newSportData(in)) {
            return List.of();
        }
        Map<String, Integer> painCounts = new LinkedHashMap<>();
        for (DetectorInput.GymDay day : in.gymDays()) {
            for (DetectorInput.ExerciseWork work : day.exercises()) {
                if (work.worstJointPain() != null && work.worstJointPain() >= JOINT_PAIN_MIN) {
                    painCounts.merge(work.exerciseName(), 1, Integer::sum);
                }
            }
        }
        List<String> parts = new ArrayList<>();
        for (Map.Entry<String, Integer> e : painCounts.entrySet()) {
            if (e.getValue() >= MIN_REPEATS) {
                parts.add(e.getKey() + ": ízület-jelzés " + e.getValue() + "×");
            }
        }
        long strained = in.sportSessions().stream()
                .filter(s -> s.shoulderStrain() != null && s.shoulderStrain() >= SHOULDER_STRAIN_MIN)
                .count();
        if (strained >= MIN_REPEATS) {
            parts.add("váll-terhelés " + SHOULDER_STRAIN_MIN + "+ a sportnapokon " + strained + "×");
        }
        if (parts.isEmpty()) {
            return List.of();
        }
        String summary = "Niggle-térkép (14 nap): " + String.join(" · ", parts) + ".";
        return List.of(new DetectorSignal(key(), "edzo", summary, Math.min(2 + parts.size(), 5)));
    }
}
```

**Steps:**

- [ ] **Step 1: Write the failing tests** in `DetectorTest` (plain JUnit, use the full-control `input(...)` helper; build `GymDay`s inline). Cases:
  - `rirCalibration_firesOnOverestimation_directionInSummary`: one GymDay dated DAY with one exercise, 4 same-weight `SetPoint`s producing 3 over-events (e.g. reps 10→6 with rir 2, 10→7 with rir 3, 9→5 with rir 2 across pairs — construct 4 sets so 3 adjacent pairs each qualify); assert 1 signal, expert `edzo`, summary contains `"felfelé"`.
  - `rirCalibration_quietWithoutNewGymData`: same sets but GymDay dated `DAY.minusDays(1)` and no DAY entry → empty.
  - `rirCalibration_quietOnBalancedDirections`: 2 over + 2 under events → empty (no dominant direction... note over==under). Use ≥3 total.
  - `niggleMap_mapsRepeatedJointPain_andShoulderStrain`: two GymDays (one dated DAY) each with `ExerciseWork("Hack squat", …, worstJointPain 2)`, plus two SportPoints shoulderStrain 7 → 1 signal containing `"Hack squat"` and `"váll"`.
  - `niggleMap_quietOnSingleOccurrence`: one pain, one strained session → empty.
- [ ] **Step 2: Run to verify failure** — `./mvnw test -Dtest='DetectorTest' -Dmezo.test.use-testcontainers=true` → new tests fail to compile/assert.
- [ ] **Step 3: Implement** `RoundOneGates`, `RirCalibrationDetector`, `NiggleMapDetector` (code above verbatim; adjust only if compilation demands).
- [ ] **Step 4: Run to verify pass** — same command, all green.
- [ ] **Step 5: Commit** — `git add -A backend && git commit -m "feat(character): rir-calibration + niggle-map detectors (mezo-1gim.15)"`

---

### Task 3: Edző detectors II — `sport-interference`, `meso-adherence`, `progression-adherence`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/SportInterferenceDetector.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/MesoAdherenceDetector.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/ProgressionAdherenceDetector.java`
- Test: extend `DetectorTest.java`

**Interfaces:** consumes Task 1 records; `expertKey = "edzo"` for all three.

**`SportInterferenceDetector`:** fires when ≥2 pairs in the window of: sport day with (`shoulderStrain >= 6` OR `rpe >= 8`) followed by a gym day at `date+1` whose average reps-vs-target delta ≤ −1 (computed from `SetPoint`s: for sets with both `reps` and `targetReps`, mean of `reps - targetReps` across the day's sets; skip days with no target data). Gate: `newGymData || newSportData`. Summary pattern: `"Sport-interferencia: N alkalommal esett vissza a gym a nagy terhelésű sportnap után (14 nap)."` Salience `Math.min(2 + pairs, 5)`.

```java
// Core pair loop (inside detect, after the gate):
int pairs = 0;
for (DetectorInput.SportPoint sp : in.sportSessions()) {
    boolean heavy = (sp.shoulderStrain() != null && sp.shoulderStrain() >= 6)
            || (sp.rpe() != null && sp.rpe().compareTo(new BigDecimal("8")) >= 0);
    if (!heavy) continue;
    LocalDate next = sp.date().plusDays(1);
    Double delta = avgRepsVsTargetDelta(in, next); // null when no gym day / no targets that day
    if (delta != null && delta <= -1.0) pairs++;
}
if (pairs < 2) return List.of();
```

with the shared private helper (duplicate it per detector class — detectors stay self-contained, matching the existing five):

```java
private static Double avgRepsVsTargetDelta(DetectorInput in, LocalDate date) {
    int n = 0;
    int sum = 0;
    for (DetectorInput.GymDay g : in.gymDays()) {
        if (!g.date().equals(date)) continue;
        for (DetectorInput.ExerciseWork w : g.exercises()) {
            for (DetectorInput.SetPoint s : w.sets()) {
                if (s.reps() != null && s.targetReps() != null && !s.skipped()) {
                    sum += s.reps() - s.targetReps();
                    n++;
                }
            }
        }
    }
    return n == 0 ? null : (double) sum / n;
}
```

**`MesoAdherenceDetector`:** requires `in.meso() != null`. Per spec §5 the deload week suppresses the alarm entirely: `if (in.meso().deloadWeek()) return List.of();`. Count, over the last 7 days (`day-6 .. day`), dates whose `DayOfWeek` ∈ `plannedDays` but ∉ `doneDays` and are not after `day`. Fires on `missed >= 2` with new gym data OR when the observed day itself is a missed planned day (a miss IS the new information — checking only `newGymData` would make missed days unreportable; comment this). Summary: `"A heti tervből N edzésnap kimaradt (hét: currentWeek/totalWeeks)."` with real numbers. Salience `Math.min(1 + missed, 4)`.

**`ProgressionAdherenceDetector`:** deload-week days are excluded from the stats when `meso != null && meso.deloadWeek()` — in that case skip the whole current week's days; simplest faithful rule: when `deloadWeek` is true, return empty (reduced load is plan-conform; comment cites the spec). Otherwise over the 14-day window collect sets with `weightKg` and `targetWeightKg` both present, not skipped: undershoot event = `weightKg <= targetWeightKg - 2.5`; overshoot = `weightKg >= targetWeightKg + 2.5` (kg, BigDecimal compare). Fires on ≥4 events with a dominant direction (strictly more of one kind), gate `newGymData`. Summary: `"Terhelés-követés: a beírt súly N szettnél maradt el 2,5+ kg-mal a targettől (14 nap)."` (or "lőtt túl" direction). Use the `huNumber` idiom for the `2,5` literal (write it as a constant string `"2,5"`). Salience `Math.min(2 + events / 2, 5)`.

**Steps:**

- [ ] **Step 1: Failing tests** in `DetectorTest`:
  - `sportInterference_firesOnRepeatedNextDayDecline`: 2 heavy SportPoints (strain 7) at DAY−3 and DAY−1, gym days at DAY−2 and DAY with sets reps 6/target 8 → 1 signal (expert edzo, summary contains `"Sport-interferencia"`); also asserts the DAY gym day satisfies the gate.
  - `sportInterference_quietWhenGymHolds`: same sports but gym reps == target → empty.
  - `mesoAdherence_firesOnMissedPlannedDays` : meso context `new DetectorInput.MesoContext("Hyper", 3, 6, false, Set.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY), Set.of())`, DAY chosen so ≥2 planned days in the last 7 are missed and DAY itself is a planned day → signal with the miss count.
  - `mesoAdherence_deloadSuppresses`: same but `deloadWeek true` → empty.
  - `progressionAdherence_firesOnSystematicUndershoot`: gym day at DAY with 4 sets weight 80 target 85 → signal containing `"maradt el"`.
  - `progressionAdherence_deloadWeekQuiet`: same sets + deload meso → empty.
- [ ] **Step 2: Verify failure** — `./mvnw test -Dtest='DetectorTest' -Dmezo.test.use-testcontainers=true`.
- [ ] **Step 3: Implement the three detectors** (structure per sketches; every class carries the standard `@Component` + `@ConditionalOnProperty(CHARACTER_SWITCH)` + javadoc citing the spec).
- [ ] **Step 4: Verify pass** — same command.
- [ ] **Step 5: Commit** — `git commit -m "feat(character): sport-interference + meso/progression-adherence detectors (mezo-1gim.15)"`

---

### Task 4: Trend + chain detectors — `hr-recovery-trend` (doki), `sleep-performance-chain` (szomnologus), `avoidance-pattern` (drill)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/HrRecoveryTrendDetector.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/SleepPerformanceChainDetector.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/AvoidancePatternDetector.java`
- Test: extend `DetectorTest.java`

**`HrRecoveryTrendDetector`** — the band-change gate, stateless double computation:

```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * 8-week HR-recovery trend (round 1, spec §4-5). hrRecoverySec: LOWER = better recovery
 * (RunningPage's pulzus-megnyugvás chart is built on the same field). Weekly averages over
 * trend.runsEightWeeks; band = JAVUL (first-half avg - last-half avg >= 10s), ROMLIK (<= -10s),
 * KOZOMBOS otherwise; needs >= 4 weeks with data. Fires ONLY when a run was logged on the
 * observed day AND the band as-of day differs from the band as-of day-1 (stateless band-change
 * gate — the same trend is never re-announced).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class HrRecoveryTrendDetector implements CharacterDetector {

    private static final int MIN_WEEKS = 4;
    private static final double BAND_DELTA_SEC = 10.0;

    private enum Band { JAVUL, ROMLIK, KOZOMBOS, NINCS_ADAT }

    @Override
    public String key() {
        return "hr-recovery-trend";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!RoundOneGates.newRunData(in)) {
            return List.of();
        }
        Band today = band(in.trend().runsEightWeeks(), in.day());
        Band yesterday = band(in.trend().runsEightWeeks(), in.day().minusDays(1));
        if (today == Band.NINCS_ADAT || today == yesterday) {
            return List.of();
        }
        String direction = today == Band.JAVUL ? "javul" : today == Band.ROMLIK ? "romlik" : "kiegyenlítődött";
        String summary = "A futás utáni pulzus-megnyugvás trendje " + direction
                + " (8 hetes heti átlagok alapján).";
        return List.of(new DetectorSignal(key(), "doki", summary, today == Band.ROMLIK ? 4 : 3));
    }

    private static Band band(List<DetectorInput.RunPoint> runs, LocalDate asOf) {
        Map<LocalDate, double[]> weekly = new TreeMap<>(); // weekStart -> [sum, count]
        for (DetectorInput.RunPoint r : runs) {
            if (r.hrRecoverySec() == null || r.date().isAfter(asOf)) {
                continue;
            }
            LocalDate weekStart = r.date().minusDays(r.date().getDayOfWeek().getValue() - 1L);
            weekly.computeIfAbsent(weekStart, k -> new double[2]);
            weekly.get(weekStart)[0] += r.hrRecoverySec();
            weekly.get(weekStart)[1]++;
        }
        if (weekly.size() < MIN_WEEKS) {
            return Band.NINCS_ADAT;
        }
        List<Double> avgs = weekly.values().stream().map(a -> a[0] / a[1]).toList();
        int half = avgs.size() / 2;
        double firstHalf = avgs.subList(0, half).stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double lastHalf = avgs.subList(avgs.size() - half, avgs.size()).stream()
                .mapToDouble(Double::doubleValue).average().orElse(0);
        double delta = firstHalf - lastHalf; // positive = getting faster to recover = improving
        if (delta >= BAND_DELTA_SEC) {
            return Band.JAVUL;
        }
        if (delta <= -BAND_DELTA_SEC) {
            return Band.ROMLIK;
        }
        return Band.KOZOMBOS;
    }
}
```

**`SleepPerformanceChainDetector`:** poor night = `quality <= 4` OR `durationH < 6` (null-safe: a null field simply doesn't qualify that clause). Decline on the SAME day `D` as the sleep row (the row dated D is the night leading into D — comment the assumption per Global Constraints): gym `avgRepsVsTargetDelta(D) <= -1` (reuse the private helper pattern from Task 3) OR a run with `rpeActual >= 8` on D OR a sport with `rpe >= 8` on D. Fires on ≥2 such pairs in the window; gate: `newSleepData || newGymData || newRunData || newSportData`. Expert `szomnologus`, summary `"Rossz alvás után visszaesik a teljesítmény: N ilyen nap 14 napon belül."`, salience `Math.min(2 + pairs, 5)`.

**`AvoidancePatternDetector`:** group `skippedSets` per exercise name across the window; fires when one exercise has skipped sets on ≥2 different days OR ≥3 skipped sets total; gate `newGymData`. Expert `drill`, summary `"Kihagyás-minta: a(z) NAME szettjei N alkalommal maradtak ki (14 nap)."` listing the top exercise (and up to 2 more joined with `" · "`). Salience `3`.

**Steps:**

- [ ] **Step 1: Failing tests**:
  - `hrRecoveryTrend_firesOnBandFlip_only`: build 8 weeks of RunPoints (2/week, hrRecoverySec declining from 120 to 70) where the run dated DAY is exactly the point that flips the band vs DAY−1 (construct: weeks 1-4 avg ~120; weeks 5-8 avg ~110 → KOZOMBOS as of DAY−1; the DAY run at 40s pushes lastHalf below the 10s delta → JAVUL). Assert fires with `"javul"`. Then the same input with the DAY run removed → empty (no new data). Then with an extra DAY−0 run that does NOT change the band → empty (band-change gate).
  - `hrRecoveryTrend_quietUnderFourWeeks`: 3 weeks of runs incl. one on DAY → empty.
  - `sleepChain_firesOnRepeatedPoorSleepDecline`: SleepPoints (quality 3) at DAY−3 and DAY, runs rpeActual 9 on DAY−3 and DAY → fires, expert szomnologus.
  - `sleepChain_quietWithGoodSleep`: quality 8 nights, same runs → empty.
  - `avoidance_firesOnRepeatedSkips`: GymDays at DAY and DAY−2, both with `ExerciseWork("Tricepsznyújtás", …, skippedSets 2 …)` → fires, expert drill, summary contains the name.
  - `avoidance_quietOnOneOff`: single day, 1 skipped set → empty.
- [ ] **Step 2: Verify failure**, **Step 3: implement**, **Step 4: verify pass** — `./mvnw test -Dtest='DetectorTest' -Dmezo.test.use-testcontainers=true`; then the wider focused gate `./mvnw test -Dtest='DetectorTest,CharacterSignalReadsIT,CharacterObservationServiceIT,CharacterApiIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`.
- [ ] **Step 5: Commit** — `git commit -m "feat(character): hr-recovery-trend + sleep-performance-chain + avoidance-pattern detectors (mezo-1gim.15)"`

---

### Task 5: Gépterem flip + FE + docs

**Files:**
- Modify: `frontend/src/features/character/inventory.ts`
- Modify: `frontend/src/features/character/pages/DetektorokPage.tsx` (+ its test)
- Modify: `frontend/src/data/character/characterMock.ts`
- Modify: `docs/features/character.md` (§ detector catalog + §9 ledger)
- Regenerate: `docs/CODEMAP.md`

**Steps:**

- [ ] **Step 1: inventory.ts flip.** Delete the round-1 object (`n: 1, title: 'Edzés & test'`) from `INVENTORY_ROUNDS` entirely. Append to `INVENTORY_READS` (after the existing four rows, keeping their order):

```ts
  { w: 'Gym szettek + feedback (RIR, target, ízület)', chips: ['14 nap'] },
  { w: 'Sport-sessionök (váll-skála, RPE)', chips: ['14 nap'] },
  { w: 'Futás-logok (HR-megnyugvás)', chips: ['14 nap', '8 hét'] },
  { w: 'Alvás (minőség, hossz)', chips: ['14 nap'] },
  { w: 'Mezociklus-kontextus (terv-napok, deload)', chips: ['aktív meso'] },
```

Update the file's header comment: round 1 landed via mezo-1gim.15 (this change is the header's own contract in action).
- [ ] **Step 2: DetektorokPage.** Add the eight entries to `DETECTORS` (order: after the existing five), with the verified owners:

```ts
  { key: 'rir-calibration', who: 'edzo', line: 'Szettpárokon nézi: a mondott RIR megjósolja-e a következő szettet — az irányt is jelzi.' },
  { key: 'niggle-map', who: 'edzo', line: 'Ismétlődő ízület-jelzés ugyanannál a gyakorlatnál, vagy váll-terhelés sorozat a sportnapokon.' },
  { key: 'sport-interference', who: 'edzo', line: 'Nagy terhelésű sportnap után visszaesik-e a másnapi gym-teljesítmény.' },
  { key: 'meso-adherence', who: 'edzo', line: 'Kihagyott edzésnapok a heti terv ellen — deload-héten nem riaszt.' },
  { key: 'progression-adherence', who: 'edzo', line: 'A beírt súly szisztematikusan alá- vagy túllövi-e a targetet.' },
  { key: 'hr-recovery-trend', who: 'doki', line: '8 hetes pulzus-megnyugvás trend — csak sávváltáskor szólal meg.' },
  { key: 'sleep-performance-chain', who: 'szomnologus', line: 'Rossz alvás utáni napokon visszaesik-e az edzés-teljesítmény.' },
  { key: 'avoidance-pattern', who: 'drill', line: 'Ugyanannál a gyakorlatnál ismétlődő szett-kihagyások.' },
```

Update `DetektorokPage.test.tsx`: the key list grows to 13; `Edző` appears ≥ 5×... (assert `Edző` count 5, `Doki` 1, `Szomnológus` 1, `Drill` 4 — derive expected counts from the `DETECTORS` array itself rather than literals where the existing test style allows).
- [ ] **Step 3: characterMock.ts.** Add one realistic `ChainSeed` per new detector across the existing `CHAIN_POOL` days (spread over 2-3 days; `refs: []` — production carries none; `who` MUST match the backend owners above; e.g. a `rir-calibration`/`edzo` chain with a code line like `"3 szettpárnál 2+ RIR után reps-összeomlás"`). Counts stay derived (nightlyRun derives from CHAIN_POOL) — verify no test pins the old totals; update any that do by deriving.
- [ ] **Step 4: FE gates** — `cd frontend && pnpm test src/features/character src/app/navigation.test.tsx src/data/character && VITE_USE_MOCK=false pnpm test src/features/character src/app/navigation.test.tsx src/data/character && pnpm build`.
- [ ] **Step 5: Docs.** `docs/features/character.md`: extend the detector-catalog section with the eight new rows (key/owner/gate summary), note the two-window read and the stateless gates in the §architecture, and shrink the §9 "narrower than spec" ledger accordingly. Then `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs --errors-only`.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(character): Gépterem round-1 flip — inventory bekötve, 13 detektor, mock chains, docs (mezo-1gim.15)"`

---

## Ship (orchestrator, after final review)

Self-PR → CI green → in the main checkout `git -C /Users/mrkuhne/Applications/Personal/Mezo/mezo pull --rebase`, `merge --no-ff`, push, delete branch → mezo-1gim.15 stays OPEN (rounds 2-4 remain); add a round-1-done progress note via `bd update mezo-1gim.15 --notes` → `bd dolt push`.
