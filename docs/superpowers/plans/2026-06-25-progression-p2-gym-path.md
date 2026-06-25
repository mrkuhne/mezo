# Progression P2 — Gym Path End-to-End Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the gym workout-finish into the progression engine: a completed gym instance grants XP to the muscle levels + `max_strength` + `strength_endurance` + `robustness`, detects level-ups, unlocks perks, persists a `level_up_event` (idempotent), and returns a `levelUp` payload on the gym finish response — behind a feature switch.

**Architecture:** A new `ProgressionService.applyWorkout(createdBy, GymSignal)` (idempotent on `(GYM, instanceId)` via the P1 `LevelUpEventRepository`) consumes a `GymSignal` (per-muscle Σ volume + best Epley e1RM + set count) computed from the finished instance's logged sets. It adds config-weighted XP to `skill_progress`, recomputes levels via the P1 `ProgressionCurve`, resolves perks via the P1 `PerkCatalog`, recomputes streak-only robustness, writes one `level_up_event`, and returns a `LevelUpResult`. `WorkoutService.finishWorkout` calls it (when the `mezo.feature.progression.enabled` switch is on) and attaches the `levelUp` to the contract-extended `WorkoutInstanceResponse`.

**Tech Stack:** Java 21, Spring Boot 4.x, Maven, Hibernate/JPA, PostgreSQL 16, BigDecimal math, OpenAPI (contract-first), Lombok, AssertJ, JUnit 5.

## Global Constraints

- Base package `io.mrkuhne.mezo`. Driving bd: **mezo-8e4**. Build/test from `backend/`: `./mvnw clean test` (ALWAYS `clean`). Postgres via `docker compose -f backend/compose.yaml up -d` (port 15432).
- **P1 is shipped (on main):** reuse `ProgressionCurve` (`xpThreshold/levelFor/progressPct`), `ProgressionProperties` (prefix `mezo.progression`, nested `Curve`), `SkillProgressEntity`/`SkillProgressRepository` (`findByCreatedByAndSkillKey`, `findByCreatedByOrderBySkillKeyAsc`), `LevelUpEventEntity`/`LevelUpEventRepository` (`findByCreatedByAndSourceTypeAndSourceRefId`), `PerkUnlockEntity`/`PerkUnlockRepository`, `LevelUpResult` (record in `feature/progression/entity`), `PerkCatalog` (`find(skillKey, milestoneLevel) → Optional<PerkDef>`).
- **Skill keys:** athletic `max_strength`, `strength_endurance`, `robustness` (kind `ATHLETIC`); muscle keys are the EXACT 13 train tokens with hyphens: `back-mid, lats, chest, shoulder, rear-delt, biceps, triceps, quad, ham, glute, calf, core, traps` (kind `MUSCLE`).
- **Config:** extend the EXISTING `ProgressionProperties` record (do NOT create a new `*Properties`); nested records with JSR-303 + default in a trailing `//` comment; NO `java.util.Map` (use named nested records, the house idiom). YAML under the single `mezo:` root. `@Value` forbidden; auto-registered by `@ConfigurationPropertiesScan`.
- **Feature switch:** create `io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration` (`@NoArgsConstructor(access = PRIVATE)`) with `public static final String PROGRESSION_SWITCH = "mezo.feature.progression.enabled"`; declare `mezo.feature.progression.enabled: true` in `application.yml` (NO `matchIfMissing`). This is the repo's FIRST production feature switch.
- **e1RM (Epley) is BigDecimal, exact:** `weightKg.multiply(BigDecimal.valueOf(30L + reps)).divide(new BigDecimal("30"), 4, RoundingMode.HALF_UP)`. Volume Σ over weighted (`weightKg != null`) sets only; bodyweight/plyo sets (null weight) excluded from e1RM/volume but counted for set-XP. Filter out `skipped == true` sets.
- **Service:** `@Service @RequiredArgsConstructor`; method-level `@Transactional` (`org.springframework.transaction.annotation.Transactional`) on writes ONLY, never on the class.
- **Idempotency:** `applyWorkout` MUST short-circuit if a `level_up_event` already exists for `(GYM, instanceId)` — read back its stored `LevelUpResult` and return it, NEVER re-insert (re-finish/resume must not double-award).
- **Contract-first:** edit `api/feature/train/train.yml` FIRST (add `LevelUpResult` schema + an optional `levelUp` on `WorkoutInstanceResponse`), then `cd api/generate && npm run generate:api`, then `cd frontend && pnpm generate:api`, then backend regen is automatic on `./mvnw clean test`. Commit `api/openapi.yml` + `frontend/src/lib/api.gen.ts` together. `$ref` is same-file `#/components/schemas/Name` (the merge tool flattens fragments). `merge.yml` needs NO edit (train.yml is already an input).
- **Tests:** integration-first, REAL Postgres, no mocks/H2. Service ITs extend `AbstractIntegrationTest` + class `@Transactional`; HTTP ITs extend `ApiIntegrationTest` (NOT `@Transactional`), use `ownerAuthHeaders()`. Data via populators (`TrainPopulator` for instances/sets, `SkillProgressPopulator`/`LevelUpEventPopulator` from P1). AssertJ; `test{Method}_should{Result}_when{Condition}`. Run focused tests while iterating; full `./mvnw clean test` before the final commit of the slice.

---

### Task 1: Extend ProgressionProperties with gym XP config

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/config/ProgressionProperties.java`
- Modify: `backend/src/main/resources/application.yml` (extend the `mezo.progression` block)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionPropertiesIT.java`

**Interfaces:**
- Produces: `ProgressionProperties.gym()` → `Gym(Integer volumeUnit, Integer volumeXpPerUnit, Integer e1rmXpPerKg, Integer prBonusXp, Integer strengthEnduranceXpPerSet, Integer bodyweightXpPerRep, Robustness robustness)`; `Gym.robustness()` → `Robustness(Integer perWeekXp)`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.config.ProgressionProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class ProgressionPropertiesIT extends AbstractIntegrationTest {

    @Autowired private ProgressionProperties properties;

    @Test
    void testGymConfig_shouldBindFromYaml_whenContextStarts() {
        ProgressionProperties.Gym gym = properties.gym();
        assertThat(gym.volumeUnit()).isEqualTo(100);
        assertThat(gym.volumeXpPerUnit()).isEqualTo(10);
        assertThat(gym.e1rmXpPerKg()).isEqualTo(2);
        assertThat(gym.prBonusXp()).isEqualTo(40);
        assertThat(gym.strengthEnduranceXpPerSet()).isEqualTo(8);
        assertThat(gym.bodyweightXpPerRep()).isEqualTo(1);
        assertThat(gym.robustness().perWeekXp()).isEqualTo(25);
    }

    @Test
    void testCurveConfig_shouldStillBind_whenContextStarts() {
        assertThat(properties.curve().base()).isEqualTo(100);
        assertThat(properties.curve().exp()).isEqualTo(1.6);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionPropertiesIT`
Expected: FAIL — `properties.gym()` does not exist (compile error).

- [ ] **Step 3: Extend the record**

Replace the body of `ProgressionProperties.java` with (keeping the existing `Curve`, adding `gym` + nested records):

```java
package io.mrkuhne.mezo.feature.progression.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Progression tuning (mezo.progression). P1: level curve. P2: gym XP weights. */
@Validated
@ConfigurationProperties(prefix = "mezo.progression")
public record ProgressionProperties(
    @NotNull @Valid Curve curve,
    @NotNull @Valid Gym gym
) {
    /** Level threshold curve: xpThreshold(n) = round(base * (n-1)^exp), xpThreshold(1)=0. */
    public record Curve(
        @NotNull @Positive Integer base,  // 100
        @NotNull @Positive Double exp     // 1.6
    ) {}

    /** Gym-path XP weights (volume → muscle levels; e1RM → max_strength; sets → strength_endurance). */
    public record Gym(
        @NotNull @Positive Integer volumeUnit,                // 100 (kg·reps per XP unit)
        @NotNull @Positive Integer volumeXpPerUnit,           // 10 (muscle XP per volume unit)
        @NotNull @PositiveOrZero Integer e1rmXpPerKg,         // 2 (max_strength XP per best-e1RM kg)
        @NotNull @PositiveOrZero Integer prBonusXp,           // 40 (bonus when e1RM beats prior best)
        @NotNull @PositiveOrZero Integer strengthEnduranceXpPerSet, // 8 (per logged work set)
        @NotNull @PositiveOrZero Integer bodyweightXpPerRep,  // 1 (flat XP per bodyweight rep)
        @NotNull @Valid Robustness robustness
    ) {}

    /** Streak-only robustness (v1): perWeekXp × consecutive training weeks. */
    public record Robustness(
        @NotNull @Positive Integer perWeekXp  // 25
    ) {}
}
```

- [ ] **Step 4: Extend the YAML**

In `application.yml`, replace the existing `progression:` block with:

```yaml
  progression:
    # Level threshold curve: xpThreshold(n) = round(base * (n-1)^exp); Lv2=100, Lv3≈303, Lv5≈919.
    curve:
      base: 100
      exp: 1.6
    # Gym-path XP weights (display-only economy in v1; tune freely without touching code).
    gym:
      volume-unit: 100          # kg·reps that equal one volume XP unit
      volume-xp-per-unit: 10    # muscle XP per volume unit (per the day's logged muscles)
      e1rm-xp-per-kg: 2         # max_strength XP per kg of best Epley e1RM
      pr-bonus-xp: 40           # one-off bonus when the session's best e1RM beats the prior best
      strength-endurance-xp-per-set: 8  # per logged work set (non-skipped, reps present)
      bodyweight-xp-per-rep: 1  # flat XP per rep for weightless sets (no e1RM/volume)
      robustness:
        per-week-xp: 25         # robustness XP per consecutive training week (streak-only v1)
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionPropertiesIT`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression/config/ProgressionProperties.java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionPropertiesIT.java
git commit -m "feat(progression): gym XP weights config (mezo-8e4)"
```

---

### Task 2: GymSignal + its calculator (per-muscle volume + best e1RM)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/gym/GymSignal.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/gym/GymSignalCalculator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/gym/GymSignalCalculatorIT.java`

**Interfaces:**
- Consumes: `ExerciseSetRepository.findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instanceId)`; `ExerciseRepository.findIdentityRowsIncludingDeleted(createdBy)` (projection `ExerciseIdentityRow` with `getId/getMuscle/getCatalogId`); `ExerciseCatalogRepository.findAll()`.
- Produces: `GymSignal(UUID instanceId, Map<String, Long> volumeByMuscle, java.math.BigDecimal bestE1rm, int workSetCount, int bodyweightRepCount)` (record); `GymSignalCalculator.compute(UUID createdBy, UUID instanceId) → GymSignal`. `volumeByMuscle` keys are muscle tokens (unknown/empty bucketed under `"other"`), values Σ(weight×reps) rounded to whole kg. `bestE1rm` is the max Epley over weighted sets (null if none).

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.progression.gym;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class GymSignalCalculatorIT extends AbstractIntegrationTest {

    @Autowired private GymSignalCalculator calculator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private ExerciseRepository exerciseRepository;
    @Autowired private ExerciseSetRepository exerciseSetRepository;

    @Test
    void testCompute_shouldAggregateVolumeAndE1rmPerMuscle_whenInstanceHasWeightedSets() {
        UUID user = databasePopulator.populateUser("gym@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Hyp 04", "active");
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutSession(user, meso.getId(), "Hétfő", "push", 0, "completed");
        // chest exercise (free-typed muscle, no catalog) with two weighted sets
        ExerciseEntity bench = trainPopulator.createExercise(user, instance.getId(), "Fekvenyomás", 0);
        bench.setMuscle("chest");
        exerciseRepository.saveAndFlush(bench);
        trainPopulator.createExerciseSetFull(user, bench.getId(), instance.getId(), 0,
            new BigDecimal("100.00"), 10, false); // weight 100 × 10 = 1000; e1rm 100*(40/30)=133.3333
        trainPopulator.createExerciseSetFull(user, bench.getId(), instance.getId(), 1,
            new BigDecimal("80.00"), 8, false);    // 640
        // a skipped set must be ignored
        trainPopulator.createExerciseSetFull(user, bench.getId(), instance.getId(), 2,
            new BigDecimal("60.00"), 5, true);

        GymSignal signal = calculator.compute(user, instance.getId());

        assertThat(signal.instanceId()).isEqualTo(instance.getId());
        assertThat(signal.volumeByMuscle()).containsEntry("chest", 1640L); // 1000 + 640, skip ignored
        assertThat(signal.bestE1rm()).isEqualByComparingTo(new BigDecimal("133.3333"));
        assertThat(signal.workSetCount()).isEqualTo(2); // skipped excluded
        assertThat(signal.bodyweightRepCount()).isZero();
    }

    @Test
    void testCompute_shouldCountBodyweightRepsAndSkipE1rm_whenSetsHaveNoWeight() {
        UUID user = databasePopulator.populateUser("bw@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Hyp 04", "active");
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutSession(user, meso.getId(), "Hétfő", "pull", 0, "completed");
        ExerciseEntity pullup = trainPopulator.createExercise(user, instance.getId(), "Húzódzkodás", 0);
        pullup.setMuscle("lats");
        exerciseRepository.saveAndFlush(pullup);
        trainPopulator.createExerciseSetFull(user, pullup.getId(), instance.getId(), 0, null, 12, false);

        GymSignal signal = calculator.compute(user, instance.getId());

        assertThat(signal.volumeByMuscle()).doesNotContainKey("lats"); // no weighted volume
        assertThat(signal.bestE1rm()).isNull();
        assertThat(signal.workSetCount()).isEqualTo(1);
        assertThat(signal.bodyweightRepCount()).isEqualTo(12);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=GymSignalCalculatorIT`
Expected: FAIL — `GymSignalCalculator`/`GymSignal` don't exist, and `TrainPopulator.createExerciseSetFull(...)` doesn't exist yet (you'll add it in Step 3).

- [ ] **Step 3: Add the populator factory the test needs**

In `backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java`, add a factory that builds a fully-specified set (the existing `createExerciseSet` hardcodes values). Add this method:

```java
    public io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity createExerciseSetFull(
        UUID createdBy, UUID exerciseId, UUID workoutSessionId, int setIndex,
        java.math.BigDecimal weightKg, Integer reps, boolean skipped) {
        io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity s =
            new io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity();
        s.setCreatedBy(createdBy);
        s.setExerciseId(exerciseId);
        s.setWorkoutSessionId(workoutSessionId);
        s.setSetIndex(setIndex);
        s.setWeightKg(weightKg);
        s.setReps(reps);
        s.setSkipped(skipped);
        return exerciseSetRepository.saveAndFlush(s);
    }
```

(`exerciseSetRepository` is already an injected field of `TrainPopulator`.)

- [ ] **Step 4: Write GymSignal**

```java
// GymSignal.java
package io.mrkuhne.mezo.feature.progression.gym;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

/**
 * The progression-relevant signal extracted from one completed gym instance.
 * volumeByMuscle: Σ(weight×reps) per muscle token (whole kg). bestE1rm: max Epley over weighted
 * sets (null if the instance had no weighted set). workSetCount/bodyweightRepCount drive
 * strength_endurance / bodyweight XP.
 */
public record GymSignal(
    UUID instanceId,
    Map<String, Long> volumeByMuscle,
    BigDecimal bestE1rm,
    int workSetCount,
    int bodyweightRepCount
) {}
```

- [ ] **Step 5: Write GymSignalCalculator**

```java
// GymSignalCalculator.java
package io.mrkuhne.mezo.feature.progression.gym;

import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository.ExerciseIdentityRow;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Computes a GymSignal from a finished instance's logged sets (Epley + per-muscle Σ volume). */
@Component
@RequiredArgsConstructor
public class GymSignalCalculator {

    private static final BigDecimal THIRTY = new BigDecimal("30");
    private static final String OTHER_MUSCLE = "other";

    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseCatalogRepository exerciseCatalogRepository;

    public GymSignal compute(UUID createdBy, UUID instanceId) {
        List<ExerciseSetEntity> sets = exerciseSetRepository
            .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instanceId);

        // set → exercise → muscle resolution (catalog when linked, else the exercise's own muscle)
        Map<UUID, ExerciseIdentityRow> exercises = new HashMap<>();
        exerciseRepository.findIdentityRowsIncludingDeleted(createdBy)
            .forEach(r -> exercises.put(r.getId(), r));
        Map<UUID, ExerciseCatalogEntity> catalog = new HashMap<>();
        exerciseCatalogRepository.findAll().forEach(c -> catalog.put(c.getId(), c));

        Map<String, Long> volumeByMuscle = new HashMap<>();
        BigDecimal bestE1rm = null;
        int workSetCount = 0;
        int bodyweightRepCount = 0;

        for (ExerciseSetEntity s : sets) {
            if (s.isSkipped() || s.getReps() == null) {
                continue; // skip markers + no-rep rows carry no work
            }
            workSetCount++;
            if (s.getWeightKg() == null) {
                bodyweightRepCount += s.getReps();
                continue; // bodyweight/plyo: no e1RM, no volume
            }
            String muscle = muscleOf(s.getExerciseId(), exercises, catalog);
            long vol = s.getWeightKg().multiply(BigDecimal.valueOf(s.getReps()))
                .setScale(0, RoundingMode.HALF_UP).longValueExact();
            volumeByMuscle.merge(muscle, vol, Long::sum);
            BigDecimal e1rm = epley(s.getWeightKg(), s.getReps());
            if (bestE1rm == null || e1rm.compareTo(bestE1rm) > 0) {
                bestE1rm = e1rm;
            }
        }
        return new GymSignal(instanceId, volumeByMuscle, bestE1rm, workSetCount, bodyweightRepCount);
    }

    private String muscleOf(UUID exerciseId, Map<UUID, ExerciseIdentityRow> exercises,
        Map<UUID, ExerciseCatalogEntity> catalog) {
        ExerciseIdentityRow row = exercises.get(exerciseId);
        if (row == null) {
            return OTHER_MUSCLE;
        }
        String muscle = row.getCatalogId() != null && catalog.containsKey(row.getCatalogId())
            ? catalog.get(row.getCatalogId()).getMuscle()
            : row.getMuscle();
        return (muscle == null || muscle.isBlank()) ? OTHER_MUSCLE : muscle;
    }

    /** Epley e1RM: weight × (30 + reps) / 30, scale 4 HALF_UP (matches ExerciseRecordService). */
    private BigDecimal epley(BigDecimal weightKg, int reps) {
        return weightKg.multiply(BigDecimal.valueOf(30L + reps)).divide(THIRTY, 4, RoundingMode.HALF_UP);
    }
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=GymSignalCalculatorIT`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression/gym backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java backend/src/test/java/io/mrkuhne/mezo/feature/progression/gym/GymSignalCalculatorIT.java
git commit -m "feat(progression): GymSignal calculator (per-muscle volume + Epley e1RM) (mezo-8e4)"
```

---

### Task 3: ProgressionService.applyWorkout (XP, levels, perks, robustness, idempotency)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/ProgressionService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/RobustnessCalculator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/repository/SkillProgressRepository.java` (already has the finders — no change unless missing)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/service/ProgressionServiceIT.java`

**Interfaces:**
- Consumes: `GymSignal` (Task 2); `ProgressionProperties.Gym` (Task 1); P1 `ProgressionCurve`, `PerkCatalog`, `SkillProgressRepository`, `LevelUpEventRepository`, `PerkUnlockRepository`, `LevelUpResult`.
- Produces: `ProgressionService.applyGym(UUID createdBy, GymSignal signal) → LevelUpResult` (idempotent on `(GYM, signal.instanceId())`). `RobustnessCalculator.streakWeeks(UUID createdBy) → int` (consecutive ISO weeks ending this week with ≥1 logged gym/sport/run session).

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.progression.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.gym.GymSignal;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.SkillProgressPopulator;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ProgressionServiceIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private SkillProgressPopulator skillProgressPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testApplyGym_shouldGrantMuscleAndStrengthXpAndLevelUp_whenFirstApplied() {
        UUID user = databasePopulator.populateUser("apply@test.local");
        UUID instance = UUID.randomUUID();
        // chest volume 1640 → 1640/100*10 = 164 XP; bestE1rm 133 → 133*2 = 266 + 40 PR bonus (no prior) = 306;
        // 2 work sets → strength_endurance 16. With base=100 exp=1.6: max_strength 306 → Lv3 (>=303).
        GymSignal signal = new GymSignal(instance, Map.of("chest", 1640L), new BigDecimal("133.3333"), 2, 0);

        LevelUpResult result = progressionService.applyGym(user, signal);

        assertThat(result.source()).isEqualTo("GYM");
        assertThat(result.totalXp()).isEqualTo(164L + 306L + 16L + result.robustness().xpGained());
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "chest"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(164L));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "max_strength"))
            .get().satisfies(s -> {
                assertThat(s.getCumulativeXp()).isEqualTo(306L);
                assertThat(s.getCurrentLevel()).isEqualTo(3); // 306 >= xpThreshold(3)=303
            });
        assertThat(result.levelUps()).contains("max_strength");
        assertThat(result.gains()).anySatisfy(g -> {
            assertThat(g.skillKey()).isEqualTo("max_strength");
            assertThat(g.levelBefore()).isEqualTo(1);
            assertThat(g.levelAfter()).isEqualTo(3);
        });
    }

    @Test
    void testApplyGym_shouldBeIdempotent_whenSameInstanceAppliedTwice() {
        UUID user = databasePopulator.populateUser("idem@test.local");
        UUID instance = UUID.randomUUID();
        GymSignal signal = new GymSignal(instance, Map.of("quad", 500L), new BigDecimal("100.0000"), 1, 0);

        LevelUpResult first = progressionService.applyGym(user, signal);
        LevelUpResult second = progressionService.applyGym(user, signal);

        assertThat(second.totalXp()).isEqualTo(first.totalXp()); // stored payload, not re-awarded
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "quad"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(50L)); // 500/100*10, once
    }

    @Test
    void testApplyGym_shouldAwardPrBonusOnlyWhenBeatingPrior_whenMaxStrengthExists() {
        UUID user = databasePopulator.populateUser("pr@test.local");
        skillProgressPopulator.createSkill(user, "max_strength", "ATHLETIC", 200L, 2);
        UUID instance = UUID.randomUUID();
        // bestE1rm 100 → 200 XP; prior max_strength cumulative 200 means prior best e1RM unknown here,
        // so PR bonus is driven by whether this e1RM exceeds the stored best-e1RM marker (see impl).
        GymSignal signal = new GymSignal(instance, Map.of(), new BigDecimal("100.0000"), 1, 0);

        LevelUpResult result = progressionService.applyGym(user, signal);

        assertThat(result.gains()).anySatisfy(g -> assertThat(g.skillKey()).isEqualTo("max_strength"));
    }
}
```

> **Implementer note for the PR-bonus:** to keep P1's schema unchanged, derive the PR bonus from whether `signal.bestE1rm()` rounded-to-whole exceeds the prior `max_strength` *level's* implied e1RM is NOT reliable. Instead: award the `prBonusXp` when the instance has a non-null `bestE1rm` AND there is **no prior `max_strength` row** OR the new e1RM (in kg) is greater than the prior row's `cumulative_xp / e1rmXpPerKg` reconstruction is also unreliable. **Simplest correct rule for v1 (use this):** award `prBonusXp` whenever `signal.bestE1rm() != null` AND the `max_strength` row did not exist before this workout (first-ever weighted session). Document this as the v1 PR rule; a true per-exercise PR diff is deferred (it belongs with the ExerciseRecord PR feed). Adjust the third test's expectation to assert the gain exists (not the bonus) accordingly.

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionServiceIT`
Expected: FAIL — `ProgressionService` doesn't exist.

- [ ] **Step 3: Write RobustnessCalculator**

```java
// RobustnessCalculator.java
package io.mrkuhne.mezo.feature.progression.service;

import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.IsoFields;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Streak-only robustness (v1): consecutive ISO weeks (Europe/Budapest) ending at the current week,
 * each with ≥1 logged session of any family (completed gym instance / sport / run). A week with no
 * session breaks the streak. The set of training dates is gathered from the three session families.
 */
@Component
@RequiredArgsConstructor
public class RobustnessCalculator {

    private static final ZoneId TZ = ZoneId.of("Europe/Budapest");

    private final WorkoutSessionRepository workoutSessionRepository;
    private final SportSessionRepository sportSessionRepository;
    private final RunSessionLogRepository runSessionLogRepository;

    /** Consecutive training weeks ending this week (0 if the current week has no logged session). */
    public int streakWeeks(UUID createdBy) {
        Set<Long> trainingWeeks = new HashSet<>();
        workoutSessionRepository.findInstanceDates(createdBy).forEach(d -> trainingWeeks.add(weekKey(d)));
        sportSessionRepository.findByCreatedByAndDeletedFalseOrderByDateDesc(createdBy)
            .forEach(s -> trainingWeeks.add(weekKey(s.getDate())));
        runSessionLogRepository.findByCreatedByOrderByDateDesc(createdBy)
            .forEach(r -> trainingWeeks.add(weekKey(r.getDate())));

        long current = weekKey(LocalDate.now(TZ));
        int streak = 0;
        while (trainingWeeks.contains(current - streak)) {
            streak++;
        }
        return streak;
    }

    /** Monotonic week id = isoYear*100 + isoWeek, so consecutive weeks differ by 1 within a year. */
    private long weekKey(LocalDate date) {
        return date.get(IsoFields.WEEK_BASED_YEAR) * 100L + date.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
    }
}
```

> **Implementer note:** the three repository finders used here may need adding if absent: `WorkoutSessionRepository.findInstanceDates(UUID)` (instances with a date — derive from existing `findDoneInstanceDates`/`findInstancesByCreatedBy` if a date list isn't already exposed; a `@Query("select s.date from WorkoutSessionEntity s where s.createdBy = :createdBy and s.templateSessionId is not null and s.date is not null")` returning `List<LocalDate>` is the minimal addition). `SportSessionRepository.findByCreatedByAndDeletedFalseOrderByDateDesc` exists (verify); `RunSessionLogRepository.findByCreatedByOrderByDateDesc` — verify the exact name and adapt. The week-key arithmetic (`current - streak`) only steps correctly within an ISO year; for v1's short streaks this is acceptable, but note it as a known limitation (year-boundary streaks may under-count). If a finder name differs, use the real one and keep the date-gathering shape.

- [ ] **Step 4: Write ProgressionService**

```java
// ProgressionService.java
package io.mrkuhne.mezo.feature.progression.service;

import io.mrkuhne.mezo.feature.progression.PerkCatalog;
import io.mrkuhne.mezo.feature.progression.ProgressionCurve;
import io.mrkuhne.mezo.feature.progression.config.ProgressionProperties;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.entity.PerkUnlockEntity;
import io.mrkuhne.mezo.feature.progression.entity.SkillProgressEntity;
import io.mrkuhne.mezo.feature.progression.gym.GymSignal;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import io.mrkuhne.mezo.feature.progression.repository.PerkUnlockRepository;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpEventEntity;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Grants XP from a finished workout, recomputes levels/perks/robustness, and records one
 * level_up_event. Idempotent per (source_type, source_ref_id): a re-applied workout returns the
 * stored payload without re-awarding. P2 implements the GYM family only.
 */
@Service
@RequiredArgsConstructor
public class ProgressionService {

    private static final String SOURCE_GYM = "GYM";
    private static final int[] MILESTONES = {5, 10, 15, 20, 25, 30};

    private final SkillProgressRepository skillProgressRepository;
    private final LevelUpEventRepository levelUpEventRepository;
    private final PerkUnlockRepository perkUnlockRepository;
    private final ProgressionCurve curve;
    private final PerkCatalog perkCatalog;
    private final RobustnessCalculator robustnessCalculator;
    private final ProgressionProperties properties;

    @Transactional
    public LevelUpResult applyGym(UUID createdBy, GymSignal signal) {
        // Idempotency: a workout grants XP once — return the stored payload on re-apply.
        var existing = levelUpEventRepository
            .findByCreatedByAndSourceTypeAndSourceRefId(createdBy, SOURCE_GYM, signal.instanceId());
        if (existing.isPresent()) {
            return existing.get().getPayload();
        }

        ProgressionProperties.Gym g = properties.gym();
        // skillKey → xp delta for this workout (LinkedHashMap to keep a stable order in the payload)
        Map<String, Long> deltas = new LinkedHashMap<>();
        Map<String, String> kinds = new LinkedHashMap<>();

        // muscle volume → per-muscle XP
        signal.volumeByMuscle().forEach((muscle, volume) -> {
            long xp = volume / g.volumeUnit() * g.volumeXpPerUnit();
            if (xp > 0) {
                deltas.merge(muscle, xp, Long::sum);
                kinds.put(muscle, "MUSCLE");
            }
        });
        // best e1RM → max_strength XP (+ PR bonus on the first-ever weighted session, v1 rule)
        if (signal.bestE1rm() != null) {
            boolean firstEver = skillProgressRepository
                .findByCreatedByAndSkillKey(createdBy, "max_strength").isEmpty();
            long xp = (long) signal.bestE1rm().intValue() * g.e1rmXpPerKg()
                + (firstEver ? g.prBonusXp() : 0L);
            deltas.merge("max_strength", xp, Long::sum);
            kinds.put("max_strength", "ATHLETIC");
        }
        // work sets → strength_endurance; bodyweight reps → flat strength_endurance too
        long enduranceXp = (long) signal.workSetCount() * g.strengthEnduranceXpPerSet()
            + (long) signal.bodyweightRepCount() * g.bodyweightXpPerRep();
        if (enduranceXp > 0) {
            deltas.merge("strength_endurance", enduranceXp, Long::sum);
            kinds.put("strength_endurance", "ATHLETIC");
        }

        // apply deltas → skill_progress, build gains + level-ups + perks
        List<LevelUpResult.Gain> gains = new ArrayList<>();
        List<String> levelUps = new ArrayList<>();
        List<LevelUpResult.Perk> perks = new ArrayList<>();
        long totalXp = 0;
        for (Map.Entry<String, Long> e : deltas.entrySet()) {
            String key = e.getKey();
            long delta = e.getValue();
            totalXp += delta;
            SkillProgressEntity row = upsert(createdBy, key, kinds.get(key), delta);
            int before = levelBefore(row.getCumulativeXp() - delta);
            int after = curve.levelFor(row.getCumulativeXp());
            gains.add(new LevelUpResult.Gain(key, kinds.get(key), key, null, delta, before, after,
                curve.progressPct(row.getCumulativeXp() - delta, before),
                curve.progressPct(row.getCumulativeXp(), after)));
            if (after > before) {
                levelUps.add(key);
                perks.addAll(resolvePerks(createdBy, key, before, after));
            }
        }

        // robustness (streak-only, absolute target → idempotent within a week)
        int streak = robustnessCalculator.streakWeeks(createdBy);
        long robustnessTarget = (long) streak * properties.gym().robustness().perWeekXp();
        SkillProgressEntity rob = skillProgressRepository
            .findByCreatedByAndSkillKey(createdBy, "robustness").orElseGet(() -> {
                SkillProgressEntity r = new SkillProgressEntity();
                r.setCreatedBy(createdBy);
                r.setSkillKey("robustness");
                r.setSkillKind("ATHLETIC");
                return r;
            });
        long robustnessDelta = Math.max(0, robustnessTarget - rob.getCumulativeXp());
        rob.setCumulativeXp(robustnessTarget);
        rob.setCurrentLevel(curve.levelFor(robustnessTarget));
        skillProgressRepository.save(rob);
        totalXp += robustnessDelta;

        LevelUpResult payload = new LevelUpResult(SOURCE_GYM, "Klasszik kondi", null, null, totalXp,
            gains, levelUps, perks, new LevelUpResult.Robustness(robustnessDelta, streak));

        LevelUpEventEntity event = new LevelUpEventEntity();
        event.setCreatedBy(createdBy);
        event.setSourceType(SOURCE_GYM);
        event.setSourceRefId(signal.instanceId());
        event.setTotalXp(totalXp);
        event.setPayload(payload);
        levelUpEventRepository.save(event);

        return payload;
    }

    private SkillProgressEntity upsert(UUID createdBy, String key, String kind, long delta) {
        SkillProgressEntity row = skillProgressRepository
            .findByCreatedByAndSkillKey(createdBy, key).orElseGet(() -> {
                SkillProgressEntity r = new SkillProgressEntity();
                r.setCreatedBy(createdBy);
                r.setSkillKey(key);
                r.setSkillKind(kind);
                return r;
            });
        row.setCumulativeXp(row.getCumulativeXp() + delta);
        row.setCurrentLevel(curve.levelFor(row.getCumulativeXp()));
        return skillProgressRepository.save(row);
    }

    private int levelBefore(long cumBefore) {
        return curve.levelFor(Math.max(0, cumBefore));
    }

    /** Every milestone strictly crossed by before→after unlocks its perk (if catalogued, once). */
    private List<LevelUpResult.Perk> resolvePerks(UUID createdBy, String key, int before, int after) {
        List<LevelUpResult.Perk> out = new ArrayList<>();
        for (int m : MILESTONES) {
            if (m > before && m <= after) {
                perkCatalog.find(key, m).ifPresent(def -> {
                    if (perkUnlockRepository.findByCreatedByOrderByUnlockedAtAsc(createdBy).stream()
                        .noneMatch(p -> p.getPerkKey().equals(def.perkKey()))) {
                        PerkUnlockEntity unlock = new PerkUnlockEntity();
                        unlock.setCreatedBy(createdBy);
                        unlock.setSkillKey(key);
                        unlock.setPerkKey(def.perkKey());
                        unlock.setMilestoneLevel(m);
                        perkUnlockRepository.save(unlock);
                        out.add(new LevelUpResult.Perk(key, def.perkKey(), def.name(),
                            def.effectCopy(), m));
                    }
                });
            }
        }
        return out;
    }
}
```

> **Implementer note:** read the actual `SportSessionRepository` / `RunSessionLogRepository` / `WorkoutSessionRepository` finder names before writing `RobustnessCalculator` and adapt. If `WorkoutSessionRepository` has no date-list finder, add the minimal `@Query` shown in the Task-3 Step-3 note. Verify `SkillProgressEntity` getters/setters (`getCumulativeXp/setCumulativeXp/setCurrentLevel/setSkillKind`) from P1.

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionServiceIT`
Expected: PASS (3 tests). Adjust the third test per the PR-rule note if needed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression/service backend/src/test/java/io/mrkuhne/mezo/feature/progression/service/ProgressionServiceIT.java backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/WorkoutSessionRepository.java
git commit -m "feat(progression): applyGym engine — XP, levels, perks, robustness, idempotency (mezo-8e4)"
```

---

### Task 4: Feature switch (FeaturesConfiguration + application.yml)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Modify: `backend/src/main/resources/application.yml` (add `mezo.feature.progression.enabled`)
- Test: covered by Task 6's wiring IT (the switch is exercised where it gates the trigger). No standalone test here — the constant + YAML are config, verified by Task 6 booting with the switch on and a focused off-state assertion there.

**Interfaces:**
- Produces: `FeaturesConfiguration.PROGRESSION_SWITCH` (constant `"mezo.feature.progression.enabled"`).

- [ ] **Step 1: Create FeaturesConfiguration**

```java
// FeaturesConfiguration.java
package io.mrkuhne.mezo.techcore.configuration;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/** Central registry of feature-switch property keys (consumed via @ConditionalOnProperty). */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class FeaturesConfiguration {

    /** Gamified progression (post-workout level-up + XP). First production feature switch. */
    public static final String PROGRESSION_SWITCH = "mezo.feature.progression.enabled";
}
```

- [ ] **Step 2: Declare the switch in application.yml**

Add to `application.yml` under the `mezo:` root (a new `feature:` zone, e.g. above `progression:`):

```yaml
  feature:
    # Gamified progression engine (post-workout level-up + XP). No matchIfMissing — declared explicitly.
    progression:
      enabled: true
```

- [ ] **Step 3: Verify context still boots**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionPropertiesIT`
Expected: PASS — the new YAML keys bind cleanly (the switch is a plain boolean property, no binding target needed yet).

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java backend/src/main/resources/application.yml
git commit -m "feat(progression): first feature switch (mezo.feature.progression.enabled) (mezo-8e4)"
```

---

### Task 5: Contract — LevelUpResult schema + WorkoutInstanceResponse.levelUp + regen + mapper

**Files:**
- Modify: `api/feature/train/train.yml` (add `LevelUpResult` schema + nested DTOs + `levelUp` on `WorkoutInstanceResponse`)
- Modify (generated, committed): `api/openapi.yml`, `frontend/src/lib/api.gen.ts`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/mapper/LevelUpResultMapper.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/mapper/LevelUpResultMapperTest.java`

**Interfaces:**
- Produces: generated `io.mrkuhne.mezo.api.dto.LevelUpResult` (+ nested `Gain`/`Perk`/`Robustness` DTOs); `LevelUpResultMapper.toDto(io.mrkuhne.mezo.feature.progression.entity.LevelUpResult) → io.mrkuhne.mezo.api.dto.LevelUpResult`.

- [ ] **Step 1: Add the schema to train.yml**

In `api/feature/train/train.yml`, under `components: schemas:`, add `levelUp` to `WorkoutInstanceResponse.properties` (NOT to `required`):

```yaml
        levelUp:
          $ref: '#/components/schemas/LevelUpResult'
```

Then add these sibling schemas in the same `components/schemas` map:

```yaml
    LevelUpResult:
      type: object
      required: [source, totalXp, gains, levelUps, perks, robustness]
      properties:
        source: { type: string, enum: [GYM, SPORT, RUN] }
        workoutLabel: { type: string }
        durationMin: { type: integer }
        rpe: { type: integer }
        totalXp: { type: integer, format: int64 }
        gains:
          type: array
          items: { $ref: '#/components/schemas/LevelUpGain' }
        levelUps:
          type: array
          items: { type: string }
        perks:
          type: array
          items: { $ref: '#/components/schemas/LevelUpPerk' }
        robustness: { $ref: '#/components/schemas/LevelUpRobustness' }
    LevelUpGain:
      type: object
      required: [skillKey, kind, name, xpGained, levelBefore, levelAfter, progressFromPct, progressToPct]
      properties:
        skillKey: { type: string }
        kind: { type: string, enum: [ATHLETIC, MUSCLE] }
        name: { type: string }
        icon: { type: string }
        xpGained: { type: integer, format: int64 }
        levelBefore: { type: integer }
        levelAfter: { type: integer }
        progressFromPct: { type: number }
        progressToPct: { type: number }
    LevelUpPerk:
      type: object
      required: [skillKey, perkKey, name, effectCopy, milestoneLevel]
      properties:
        skillKey: { type: string }
        perkKey: { type: string }
        name: { type: string }
        effectCopy: { type: string }
        milestoneLevel: { type: integer }
    LevelUpRobustness:
      type: object
      required: [xpGained, streakWeeks]
      properties:
        xpGained: { type: integer, format: int64 }
        streakWeeks: { type: integer }
```

- [ ] **Step 2: Regenerate the contract artifacts**

Run:
```bash
cd api/generate && npm run generate:api          # merges fragments → api/openapi.yml
cd ../../frontend && pnpm generate:api           # FE types → src/lib/api.gen.ts
```
Expected: `api/openapi.yml` and `frontend/src/lib/api.gen.ts` updated with the new schemas. Verify `grep -c LevelUpResult api/openapi.yml` ≥ 1.

- [ ] **Step 3: Write the failing mapper test**

```java
package io.mrkuhne.mezo.feature.progression.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class LevelUpResultMapperTest {

    private final LevelUpResultMapper mapper = new LevelUpResultMapper();

    @Test
    void testToDto_shouldCopyAllFields_whenGivenEntityPayload() {
        var entity = new io.mrkuhne.mezo.feature.progression.entity.LevelUpResult(
            "GYM", "Klasszik kondi", 58, 8, 480L,
            List.of(new io.mrkuhne.mezo.feature.progression.entity.LevelUpResult.Gain(
                "max_strength", "ATHLETIC", "Maximális erő", null, 120L, 6, 7, 70.0, 12.0)),
            List.of("max_strength"),
            List.of(new io.mrkuhne.mezo.feature.progression.entity.LevelUpResult.Perk(
                "max_strength", "iron_core_2", "Vas-törzs II", "+6%", 5)),
            new io.mrkuhne.mezo.feature.progression.entity.LevelUpResult.Robustness(25L, 5));

        io.mrkuhne.mezo.api.dto.LevelUpResult dto = mapper.toDto(entity);

        assertThat(dto.getSource()).isEqualTo(io.mrkuhne.mezo.api.dto.LevelUpResult.SourceEnum.GYM);
        assertThat(dto.getTotalXp()).isEqualTo(480L);
        assertThat(dto.getGains()).hasSize(1);
        assertThat(dto.getGains().get(0).getSkillKey()).isEqualTo("max_strength");
        assertThat(dto.getPerks().get(0).getName()).isEqualTo("Vas-törzs II");
        assertThat(dto.getRobustness().getStreakWeeks()).isEqualTo(5);
    }
}
```

> **Implementer note:** the generated DTO enum/getter names (`SourceEnum.GYM`, `getSkillKey`, `KindEnum`) come from the openapi-generator. After Step 2, READ `backend/target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/LevelUpResult.java` (and `LevelUpGain`/`LevelUpPerk`/`LevelUpRobustness`) to confirm the exact enum constant + getter/builder names, and align the test + mapper to them (e.g. `kind` may generate a `KindEnum`).

- [ ] **Step 4: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=LevelUpResultMapperTest`
Expected: FAIL — `LevelUpResultMapper` doesn't exist (the generated DTO exists after Step 2's `./mvnw` regen).

- [ ] **Step 5: Write the mapper**

```java
// LevelUpResultMapper.java
package io.mrkuhne.mezo.feature.progression.mapper;

import io.mrkuhne.mezo.api.dto.LevelUpGain;
import io.mrkuhne.mezo.api.dto.LevelUpPerk;
import io.mrkuhne.mezo.api.dto.LevelUpRobustness;
import org.springframework.stereotype.Component;

/** Maps the internal progression LevelUpResult (jsonb record) to the generated API DTO. */
@Component
public class LevelUpResultMapper {

    public io.mrkuhne.mezo.api.dto.LevelUpResult toDto(
        io.mrkuhne.mezo.feature.progression.entity.LevelUpResult r) {
        if (r == null) {
            return null;
        }
        return io.mrkuhne.mezo.api.dto.LevelUpResult.builder()
            .source(io.mrkuhne.mezo.api.dto.LevelUpResult.SourceEnum.fromValue(r.source()))
            .workoutLabel(r.workoutLabel())
            .durationMin(r.durationMin())
            .rpe(r.rpe())
            .totalXp(r.totalXp())
            .gains(r.gains().stream().map(g -> LevelUpGain.builder()
                .skillKey(g.skillKey())
                .kind(LevelUpGain.KindEnum.fromValue(g.kind()))
                .name(g.name())
                .icon(g.icon())
                .xpGained(g.xpGained())
                .levelBefore(g.levelBefore())
                .levelAfter(g.levelAfter())
                .progressFromPct(java.math.BigDecimal.valueOf(g.progressFromPct()))
                .progressToPct(java.math.BigDecimal.valueOf(g.progressToPct()))
                .build()).toList())
            .levelUps(r.levelUps())
            .perks(r.perks().stream().map(p -> LevelUpPerk.builder()
                .skillKey(p.skillKey())
                .perkKey(p.perkKey())
                .name(p.name())
                .effectCopy(p.effectCopy())
                .milestoneLevel(p.milestoneLevel())
                .build()).toList())
            .robustness(LevelUpRobustness.builder()
                .xpGained(r.robustness().xpGained())
                .streakWeeks(r.robustness().streakWeeks())
                .build())
            .build();
    }
}
```

> **Implementer note:** `progressFromPct`/`progressToPct` are `number` in OpenAPI → generated as `BigDecimal` (or `Double` depending on config). Read the generated `LevelUpGain` to confirm the field type and adjust the `.progressFromPct(...)` argument (BigDecimal vs double) accordingly.

- [ ] **Step 6: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=LevelUpResultMapperTest`
Expected: PASS.

- [ ] **Step 7: Commit (contract + mapper together)**

```bash
git add api/feature/train/train.yml api/openapi.yml frontend/src/lib/api.gen.ts backend/src/main/java/io/mrkuhne/mezo/feature/progression/mapper backend/src/test/java/io/mrkuhne/mezo/feature/progression/mapper/LevelUpResultMapperTest.java
git commit -m "feat(progression): contract — levelUp on gym finish response + mapper (mezo-8e4)"
```

---

### Task 6: Wire finishWorkout → applyGym (behind the switch) + contract IT

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java` (inject the progression collaborators, compute + attach levelUp in `finishWorkout`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutFinishLevelUpApiIT.java`

**Interfaces:**
- Consumes: `GymSignalCalculator.compute` (Task 2), `ProgressionService.applyGym` (Task 3), `LevelUpResultMapper.toDto` (Task 5), `FeaturesConfiguration.PROGRESSION_SWITCH` (Task 4), the generated DTO `levelUp` setter on `WorkoutInstanceResponse.builder()`.

- [ ] **Step 1: Write the failing contract IT**

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

class WorkoutFinishLevelUpApiIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private ExerciseRepository exerciseRepository;

    @Test
    void testFinishWorkout_shouldReturnLevelUp_whenActiveInstanceHasLoggedSets() {
        UUID owner = ownerId(); // the demodata owner (see ApiIntegrationTest helpers)
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hyp 04", "active");
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "active");
        ExerciseEntity bench = trainPopulator.createExercise(owner, instance.getId(), "Fekvenyomás", 0);
        bench.setMuscle("chest");
        exerciseRepository.saveAndFlush(bench);
        trainPopulator.createExerciseSetFull(owner, bench.getId(), instance.getId(), 0,
            new BigDecimal("100.00"), 10, false);

        WorkoutInstanceResponse body = postForBody(
            "/api/train/workouts/" + instance.getId() + "/finish", null,
            ownerAuthHeaders(), HttpStatus.OK, WorkoutInstanceResponse.class);

        assertThat(body.getStatus()).isEqualTo(WorkoutInstanceResponse.StatusEnum.COMPLETED);
        assertThat(body.getLevelUp()).isNotNull();
        assertThat(body.getLevelUp().getSource())
            .isEqualTo(io.mrkuhne.mezo.api.dto.LevelUpResult.SourceEnum.GYM);
        assertThat(body.getLevelUp().getTotalXp()).isGreaterThan(0L);
        assertThat(body.getLevelUp().getGains()).anySatisfy(
            gn -> assertThat(gn.getSkillKey()).isEqualTo("chest"));
    }
}
```

> **Implementer note:** confirm `ApiIntegrationTest` exposes an owner id helper (e.g. `ownerId()` / derive from `ownerAuthHeaders()` flow); if not, fetch the owner UUID the way other `*ApiIT` tests do (look at an existing Train `*ApiIT`). Confirm `postForBody(path, body, headers, status, type)` signature against `ApiIntegrationTest`.

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=WorkoutFinishLevelUpApiIT`
Expected: FAIL — `getLevelUp()` is null (the wiring doesn't exist yet).

- [ ] **Step 3: Wire the trigger in WorkoutService**

In `WorkoutService.java`: add the injected collaborators (the class is already `@RequiredArgsConstructor`, so add `private final` fields) and a `@org.springframework.beans.factory.annotation.Value`-free switch read via `Environment` is FORBIDDEN — instead inject the flag with `@org.springframework.beans.factory.annotation.Autowired(required=false)` is also wrong. **Use a constructor-injected `org.springframework.core.env.Environment` is forbidden too.** The house pattern is `@ConditionalOnProperty` at a bean boundary — so gate via a small collaborator bean that only exists when the switch is on. Add fields + change `finishWorkout`:

```java
    private final io.mrkuhne.mezo.feature.progression.gym.GymSignalCalculator gymSignalCalculator;
    private final io.mrkuhne.mezo.feature.progression.service.ProgressionService progressionService;
    private final io.mrkuhne.mezo.feature.progression.mapper.LevelUpResultMapper levelUpResultMapper;
    private final org.springframework.beans.factory.ObjectProvider<ProgressionGate> progressionGate;
```

```java
    @Transactional
    public WorkoutInstanceResponse finishWorkout(UUID createdBy, UUID workoutId) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        boolean wasActive = "active".equals(instance.getStatus());
        if (wasActive) {
            instance.setStatus("completed");
        }
        WorkoutInstanceResponse base = toInstanceResponse(createdBy, instance);
        // progression runs only when the feature is on; idempotent on the instance id
        if (progressionGate.getIfAvailable() != null) {
            var signal = gymSignalCalculator.compute(createdBy, instance.getId());
            var levelUp = progressionService.applyGym(createdBy, signal);
            return base.toBuilder().levelUp(levelUpResultMapper.toDto(levelUp)).build();
        }
        return base;
    }
```

> **Implementer note:** the gate. Create a trivial bean `ProgressionGate` annotated `@org.springframework.stereotype.Component` + `@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration.PROGRESSION_SWITCH, havingValue = "true")` (empty class). Inject it via `ObjectProvider<ProgressionGate>`; `getIfAvailable() != null` ⇔ the switch is on. This keeps progression OFF cleanly when the property is false/absent (no `matchIfMissing`), per the house @ConditionalOnProperty rule, without `@Value`/`Environment`. Put `ProgressionGate` in `feature/progression/`. ALSO: confirm the generated `WorkoutInstanceResponse` exposes `toBuilder()` (openapi-generator with `@lombok.Builder` does; if not, rebuild the full builder including `.levelUp(...)`).

- [ ] **Step 4: Create the gate bean**

```java
// ProgressionGate.java
package io.mrkuhne.mezo.feature.progression;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Marker bean present only when mezo.feature.progression.enabled=true; gates the gym trigger. */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.PROGRESSION_SWITCH, havingValue = "true")
public class ProgressionGate {
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=WorkoutFinishLevelUpApiIT`
Expected: PASS — the gym finish returns a populated `levelUp` (chest gain present, totalXp > 0).

- [ ] **Step 6: Full-suite regression gate**

Run: `cd backend && ./mvnw clean test`
Expected: ALL green. Existing `WorkoutService`/finish tests must still pass — `toInstanceResponse` is unchanged (levelUp is attached only in `finishWorkout`, so `startWorkout` is unaffected). If an existing finish test asserts the exact response shape, it remains valid (levelUp is an added optional field).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java backend/src/main/java/io/mrkuhne/mezo/feature/progression/ProgressionGate.java backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutFinishLevelUpApiIT.java
git commit -m "feat(progression): wire gym finish → applyGym behind feature switch (mezo-8e4)"
```

---

## P2 → P3 handoff

P2 makes the gym finish award XP and return a `levelUp`. P3 adds the SPORT + RUN signal calculators + the new sport/run completion flows (and the sport-session generalization for cross/TRX), reusing `ProgressionService` (add `applySport`/`applyRun` siblings to `applyGym`, sharing the upsert/level/perk/robustness core — refactor the shared tail of `applyGym` into a private `award(createdBy, sourceType, refId, deltas, label)` when the second caller lands). P4 adds `GET /api/progression/profile` (radar + streak via `RobustnessCalculator`). The robustness streak already includes sport/run dates, so it will be correct once those flows persist sessions.

## Self-review notes

- Spec coverage (P2 scope, spec §8 + §2/§3): GymSignal incl. net-new e1RM ✓(T2); applyWorkout idempotent + XP/level/perk/robustness ✓(T3); config-driven weights ✓(T1); feature switch via FeaturesConfiguration ✓(T4); contract levelUp on finish ✓(T5); finishWorkout trigger ✓(T6). Robustness ships streak-only per §2 v1 (load-quality deferred to v1.1).
- Type consistency: `GymSignal` (T2) consumed verbatim by `ProgressionService.applyGym` (T3) and `WorkoutService` (T6). `LevelUpResult` (P1 entity record) flows T3→T5 mapper→T6 DTO. `FeaturesConfiguration.PROGRESSION_SWITCH` (T4) used by `ProgressionGate` (T6). Repo finders are P1's verbatim.
- Known deferrals flagged inline: the v1 PR-bonus rule (first-weighted-session, not a true per-exercise PR diff), the ISO-year-boundary streak limitation, and the muscle `"other"` bucket for free-typed/unknown muscle tokens.
- Implementer must verify real finder names (`RobustnessCalculator`'s three repos, the `ApiIntegrationTest` owner helper, generated DTO enum/getter names) before coding each — flagged in the relevant implementer notes.
