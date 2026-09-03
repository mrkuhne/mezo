# Life-goal nightly eval job + XP award — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**bd:** `mezo-iizd.6` (epic `mezo-iizd`, depends on the merged `mezo-iizd.5`)
**Spec:** [`2026-09-03-lifegoal-slice2-motor-design.md`](../specs/2026-09-03-lifegoal-slice2-motor-design.md) §0 (`mezo-iizd.6`), §1 D-1, §4 (".6" test list) · base spec [`2026-09-02-lifegoal-system-design.md`](../specs/2026-09-02-lifegoal-system-design.md) §5, §8
**Feature doc to update in the same change:** [`docs/features/lifegoal.md`](../../features/lifegoal.md) (+ a one-line XP-source entry in [`growth.md`](../../features/growth.md) §5)

**Goal:** Make the life-goal motor run itself: a nightly cron re-evaluates the last 3 closed days for every active goal of every user, and every `hit` pillar-day grants deterministic, idempotent XP on that pillar's skill (`source_type = LIFE_GOAL`).

**Architecture:** Slice 2a already ships the writer — `LifeGoalProgressService.evaluate` upserts the last 3 closed `life_goal_pillar_day` rows. This slice (a) factors that writer out into a response-free `evaluateDays(userId, goal)` so a batch caller doesn't pay for the 28-day read-model assembly, (b) hangs a `LifeGoalXpService.awardIfHit(...)` call on every upserted day so **both** the manual `POST /{id}/evaluate` and the job award XP through the same seam, and (c) adds `LifeGoalEvalJob` on the `HabitJob` pattern (dual `@ConditionalOnProperty`, `@Scheduled` cron from config, per-user try/catch). Idempotency is carried entirely by the storage layer: `(pillar_id, day)` for the day row and the D-1 deterministic `sourceRefId` for the XP ledger — running the job twice, or after a manual evaluate, changes nothing. No new table, no new migration (the `level_up_event.source_type` CHECK was widened to `LIFE_GOAL` in slice 1), no API-contract change, no frontend change.

**Tech Stack:** Java 21, Spring Boot 4.x, Maven, JPA/Hibernate, Postgres; JUnit 5 + AssertJ integration tests on Testcontainers Postgres.

## Global Constraints

- **House rules are binding:** [`AGENTS.md`](../../../AGENTS.md) + [`CLAUDE.md`](../../../CLAUDE.md); backend references [`java_package_structure.md`](../../references/java_package_structure.md), [`spring_patterns.md`](../../references/spring_patterns.md), [`configuration_conventions.md`](../../references/configuration_conventions.md), [`testing_standards.md`](../../references/testing_standards.md), [`integration_test_framework.md`](../../references/integration_test_framework.md).
- **No `@Value`, no hardcoded tunables.** Every value lands in `application.yml` under `mezo:` and binds onto a `@Validated` `*Properties` record. Feature switches are `@ConditionalOnProperty` + a `FeaturesConfiguration` constant.
- **DI:** constructor injection via `@RequiredArgsConstructor` only. `@Transactional` on methods only.
- **Tests:** integration-first, `test{Method}_should{Result}_when{Condition}` (existing life-goal ITs also use the shorter `snake_case` behavioral style — match the file you are adding to), AssertJ only, data through `*Populator` factories, never mocks.
- **Focused backend test runs ALWAYS carry** `-Dmezo.test.use-testcontainers=true` and always `clean`. ArchUnit runs separately: `-Dtest='*Arch*Test'`.
- **Exact config keys** (verbatim from the spec/bd):
  - switch: `mezo.techcore.cron.life-goal-eval-job.enabled` (constant `FeaturesConfiguration.LIFE_GOAL_EVAL_JOB_SWITCH`)
  - cron: `mezo.lifegoal.eval-cron`, default value `0 20 0 * * *`
  - XP: `mezo.lifegoal.xp-per-hit`, default `5`
- **D-1 idempotency key (verbatim):** `UUID.nameUUIDFromBytes(("lifegoal:" + pillarId + ":" + day).getBytes(StandardCharsets.UTF_8))`.
- **XP guardrails (base spec ADR 0034):** only a `hit` pillar-day awards; `miss`/`partial`/`no_data` never subtract; the goal itself never awards; XP is feedback, never a penalty.
- **Naming deviation to note in the bd close comment:** the spec/bd name the wrapper `ProgressionService.awardLifeGoal`; the existing public family is `applyGym/applyRun/applyQuest/applyActivity/applyHabit/applyNeeds/applySport` with `award(...)` as the *private* shared tail. This plan uses **`applyLifeGoal`** to keep the family consistent — same behavior, house-conventional name.

---

## File Structure

**Create**
- `backend/src/main/java/io/mrkuhne/mezo/feature/progression/lifegoal/LifeGoalSignal.java` — the progression-side signal record (mirrors `progression/needs/NeedsSignal.java`).
- `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalXpService.java` — the single XP seam: decides whether a pillar-day awards, builds the D-1 key, calls progression through the `ProgressionGate` `ObjectProvider`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalEvalJob.java` — the nightly cron entry point.
- `backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionLifeGoalIT.java`
- `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalXpIT.java`
- `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalEvalJobIT.java`
- `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalEvalJobSwitchOffIT.java`

**Modify**
- `.../feature/progression/service/ProgressionService.java` — `SOURCE_LIFE_GOAL` constant + `applyLifeGoal(...)`.
- `.../feature/lifegoal/config/LifeGoalProperties.java` — `xpPerHit`, `evalCron`.
- `.../techcore/configuration/FeaturesConfiguration.java` — `LIFE_GOAL_EVAL_JOB_SWITCH`.
- `backend/src/main/resources/application.yml` — cron switch entry + `mezo.lifegoal.eval-cron` + `mezo.lifegoal.xp-per-hit`.
- `.../feature/lifegoal/service/LifeGoalProgressService.java` — extract `evaluateDays(...)`, award on each upserted day.
- `docs/features/lifegoal.md` §3/§4/§5/§8/§9/§10 · `docs/features/growth.md` §5 · `docs/CODEMAP.md` (regenerated, never hand-edited).

---

### Task 1: Progression seam — `LIFE_GOAL` award family

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/lifegoal/LifeGoalSignal.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/ProgressionService.java` (constant block around line 53-59; new method next to `applyNeeds`, ~line 235-247)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionLifeGoalIT.java`

**Interfaces:**
- Consumes: existing private `award(createdBy, sourceType, sourceRefId, deltas, kinds, label, durationMin, rpe, occurredOn)` tail.
- Produces: `record LifeGoalSignal(UUID sourceRefId, String skillKey, String skillKind, int xp, String label, LocalDate occurredOn)` and `ProgressionService.applyLifeGoal(UUID createdBy, LifeGoalSignal signal) -> LevelUpResult`, plus `public static final String SOURCE_LIFE_GOAL = "LIFE_GOAL"`.

- [ ] **Step 1: Write the failing test**

`backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionLifeGoalIT.java`:

```java
package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.lifegoal.LifeGoalSignal;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Life-goal pillar-hit XP rides the shared idempotent award tail (source LIFE_GOAL, mezo-iizd.6):
 * one award per (pillar, day) key, the business date is the evaluated day, never the run date.
 */
class ProgressionLifeGoalIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private LevelUpEventRepository levelUpEventRepository;
    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testApplyLifeGoal_shouldAwardOnce_whenTheSameKeyIsAppliedTwice() {
        UUID owner = userPopulator.createUser("lifegoal-xp@test.hu").getId();
        LocalDate day = LocalDate.now().minusDays(1);
        UUID refId = UUID.randomUUID();
        LifeGoalSignal signal =
            new LifeGoalSignal(refId, "recovery", "LIFE", 5, "Életcél · Alvás", day);

        LevelUpResult first = progressionService.applyLifeGoal(owner, signal);
        assertThat(first.source()).isEqualTo("LIFE_GOAL");
        assertThat(first.totalXp()).isEqualTo(5);

        progressionService.applyLifeGoal(owner, signal);

        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(owner, "recovery")
            .orElseThrow().getCumulativeXp()).isEqualTo(5);
        assertThat(levelUpEventRepository
            .findByCreatedByAndSourceTypeAndSourceRefId(owner, "LIFE_GOAL", refId)).isPresent();
        assertThat(levelUpEventRepository.findByCreatedByAndOccurredOn(owner, day)).hasSize(1);
    }

    @Test
    void testApplyLifeGoal_shouldAwardOnTheAthleticSkill_whenThePillarPointsAtOne() {
        UUID owner = userPopulator.createUser("lifegoal-xp-athletic@test.hu").getId();
        progressionService.applyLifeGoal(owner, new LifeGoalSignal(UUID.randomUUID(),
            "mobility", "ATHLETIC", 5, "Életcél · Mobilitás", LocalDate.now().minusDays(1)));

        var row = skillProgressRepository.findByCreatedByAndSkillKey(owner, "mobility").orElseThrow();
        assertThat(row.getCumulativeXp()).isEqualTo(5);
        assertThat(row.getSkillKind()).isEqualTo("ATHLETIC");
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='ProgressionLifeGoalIT'
```

Expected: compile error — `LifeGoalSignal` / `applyLifeGoal` do not exist.

- [ ] **Step 3: Write the signal record**

`backend/src/main/java/io/mrkuhne/mezo/feature/progression/lifegoal/LifeGoalSignal.java`:

```java
package io.mrkuhne.mezo.feature.progression.lifegoal;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Life-goal pillar-hit signal (mezo-iizd.6): one evaluated `hit` pillar-day grants deterministic
 * XP on that pillar's own skill. {@code sourceRefId} is the caller-computed D-1 key
 * ({@code UUID.nameUUIDFromBytes("lifegoal:<pillarId>:<day>")}) — stable across the nightly job's
 * 3-day rewrites and across a pillar-day delete + recompute, so a day can never award twice.
 * {@code occurredOn} is the evaluated DAY, never the run date.
 */
public record LifeGoalSignal(
    UUID sourceRefId, String skillKey, String skillKind, int xp, String label, LocalDate occurredOn) {}
```

- [ ] **Step 4: Add the constant and the wrapper to `ProgressionService`**

In the constant block (next to `SOURCE_NEEDS`, ~line 59):

```java
    public static final String SOURCE_LIFE_GOAL = "LIFE_GOAL";
```

Add the import `io.mrkuhne.mezo.feature.progression.lifegoal.LifeGoalSignal` and, directly after `applyNeeds`:

```java
    /**
     * Life-goal pillar-hit XP (mezo-iizd.6) → the pillar's own skill through the shared idempotent
     * tail (source LIFE_GOAL). Idempotency rides the caller's deterministic D-1 sourceRefId, so the
     * nightly job's 3-day rewrite window re-awards nothing. Never subtracts: a miss simply does not
     * call this (ADR 0034 guardrail).
     */
    @Transactional
    public LevelUpResult applyLifeGoal(UUID createdBy, LifeGoalSignal signal) {
        Map<String, Long> deltas = new LinkedHashMap<>();
        Map<String, String> kinds = new LinkedHashMap<>();
        if (signal.xp() > 0) {
            deltas.put(signal.skillKey(), (long) signal.xp());
            kinds.put(signal.skillKey(), signal.skillKind());
        }
        return award(createdBy, SOURCE_LIFE_GOAL, signal.sourceRefId(), deltas, kinds,
            signal.label(), null, null, signal.occurredOn());
    }
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='ProgressionLifeGoalIT'
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionLifeGoalIT.java
git commit -m "feat(progression): LIFE_GOAL award family a közös idempotens farkon (mezo-iizd.6)"
```

---

### Task 2: `LifeGoalXpService` + award on every evaluated day

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalXpService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/config/LifeGoalProperties.java`
- Modify: `backend/src/main/resources/application.yml` (`mezo.lifegoal` block, ~line 1437)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalProgressService.java` (`evaluate`, ~line 84-102; `upsertPillarDay`, ~line 336)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalXpIT.java`

**Interfaces:**
- Consumes: Task 1's `ProgressionService.applyLifeGoal` + `LifeGoalSignal`; existing `ProgressionGate` marker bean; `LifeGoalScorer.scoreDay`, `PillarDayScore.status()`.
- Produces:
  - `LifeGoalProperties` gains `@Min(1) @Max(100) int xpPerHit` (component order: `maxPillars, xpPerHit`; `evalCron` is added in Task 3).
  - `LifeGoalXpService.awardIfHit(LifeGoalPillarEntity pillar, LocalDate day, String status) -> void`
  - `LifeGoalXpService.refIdFor(UUID pillarId, LocalDate day) -> UUID` (static, the D-1 key; the tests assert against it)
  - `LifeGoalProgressService.evaluateDays(UUID userId, LifeGoalEntity goal) -> void` (public, `@Transactional`, response-free; Task 3's job calls it)

**Design notes for the implementer (do not deviate):**
- `robustness` never awards. The shared tail recomputes the `robustness` row to an absolute streak target, so a delta on that key is silently discarded — awarding onto it would write a ledger row that grants nothing. A pillar whose `skillKey` is `robustness` is skipped (debug log).
- The skill *kind* comes from `ProgressionTaxonomy` (`LIFE` / `ATHLETIC` / `MUSCLE`), because `LifeGoalPillarService` validates pillar skill keys against all three sets — never hardcode `"LIFE"`.
- Progression is optional: `ObjectProvider<ProgressionGate>.getIfAvailable() == null` (switch off) means no XP, no exception — the `NeedsService` precedent (`NeedsService.java:93`).
- The award happens inside `evaluate`/`evaluateDays`' transaction, per upserted day. `today`/`progress` (read paths) never award: they never write a pillar-day.

- [ ] **Step 1: Write the failing test**

`backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalXpIT.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.entity.ActivityExtract;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalProgressService;
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalXpService;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * XP side of the motor (mezo-iizd.6, spec D-1): every evaluated `hit` pillar-day grants
 * xp-per-hit on the pillar's skill, exactly once — the evaluate window's 3-day rewrite and a
 * second evaluate must not double-award; a non-hit day grants nothing.
 */
class LifeGoalXpIT extends AbstractIntegrationTest {

    private static final int XP_PER_HIT = 5;

    @Autowired private LifeGoalProgressService progressService;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private LevelUpEventRepository levelUpEventRepository;
    @Autowired private SkillProgressRepository skillProgressRepository;

    private final LocalDate today = LocalDate.now();

    /** "Fókusz" habit pillar: ≥30 productivity minutes a day → hit, on the recovery skill. */
    private LifeGoalPillarEntity focusPillar(LifeGoalEntity goal) {
        return lifeGoalPopulator.pillar(goal, "Fókusz", "habit",
            new PillarSourceJson("activity", null, "productivity", "minutes", null, null),
            new PillarRuleJson(new BigDecimal("30"), "gte", 4, null, null, null, null, null, null, null));
    }

    private void activity(UUID owner, LocalDate on, int durationMin) {
        ActivityLogEntity e = new ActivityLogEntity();
        e.setCreatedBy(owner);
        e.setOccurredOn(on);
        e.setText("fókuszblokk");
        e.setSkillKey("productivity");
        e.setExtracted(new ActivityExtract(durationMin, null));
        activityLogRepository.saveAndFlush(e);
    }

    @Test
    void testEvaluate_shouldAwardXpOncePerHitDay_whenRunTwice() {
        UUID owner = userPopulator.createUser("lifegoal-xp-evaluate@test.hu").getId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        LifeGoalPillarEntity pillar = focusPillar(goal);
        activity(owner, today.minusDays(1), 40);   // hit
        activity(owner, today.minusDays(2), 40);   // hit
        activity(owner, today.minusDays(3), 5);    // miss -> no XP

        progressService.evaluate(owner, goal.getId());
        progressService.evaluate(owner, goal.getId());

        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(owner, "recovery")
            .orElseThrow().getCumulativeXp()).isEqualTo(2L * XP_PER_HIT);
        assertThat(levelUpEventRepository.findByCreatedByAndSourceTypeAndSourceRefId(
            owner, "LIFE_GOAL", LifeGoalXpService.refIdFor(pillar.getId(), today.minusDays(1)))).isPresent();
        assertThat(levelUpEventRepository.findByCreatedByAndSourceTypeAndSourceRefId(
            owner, "LIFE_GOAL", LifeGoalXpService.refIdFor(pillar.getId(), today.minusDays(3)))).isEmpty();
    }

    @Test
    void testEvaluate_shouldStampTheEvaluatedDay_whenAwarding() {
        UUID owner = userPopulator.createUser("lifegoal-xp-date@test.hu").getId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        focusPillar(goal);
        activity(owner, today.minusDays(1), 40);

        progressService.evaluate(owner, goal.getId());

        assertThat(levelUpEventRepository.findByCreatedByAndOccurredOn(owner, today.minusDays(1)))
            .hasSize(1);
        assertThat(levelUpEventRepository.findByCreatedByAndOccurredOn(owner, today)).isEmpty();
    }

    @Test
    void testEvaluate_shouldAwardNothing_whenNoDayIsAHit() {
        UUID owner = userPopulator.createUser("lifegoal-xp-nodata@test.hu").getId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        focusPillar(goal);

        progressService.evaluate(owner, goal.getId());

        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(owner, "recovery")).isEmpty();
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoalXpIT'
```

Expected: compile error — `LifeGoalXpService` does not exist.

- [ ] **Step 3: Add `xpPerHit` to the properties record + `application.yml`**

`LifeGoalProperties.java` — add a second record component after `maxPillars` (keep the existing javadoc on `maxPillars` untouched):

```java
    @Min(1) @Max(5) int maxPillars,

    /**
     * XP granted per `hit` pillar-day (mezo-iizd.6, spec §.6) on the pillar's own skill. Feedback,
     * never a penalty: a miss subtracts nothing (ADR 0034). A `robustness`-keyed pillar grants
     * nothing at all — the progression tail recomputes that row to an absolute streak target.
     */
    @Min(1) @Max(100) int xpPerHit) {}
```

`application.yml`, the `mezo.lifegoal` block (~line 1437):

```yaml
  lifegoal:
    max-pillars: 5
    # XP per `hit` pillár-nap (mezo-iizd.6) — a pillér saját skill_key-ére, idempotensen
    # (source_type=LIFE_GOAL, kulcs: UUID.nameUUIDFromBytes("lifegoal:<pillarId>:<day>")).
    xp-per-hit: 5
```

- [ ] **Step 4: Write `LifeGoalXpService`**

`backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalXpService.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.feature.lifegoal.config.LifeGoalProperties;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.progression.ProgressionGate;
import io.mrkuhne.mezo.feature.progression.ProgressionTaxonomy;
import io.mrkuhne.mezo.feature.progression.lifegoal.LifeGoalSignal;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * The single XP seam of the life-goal motor (mezo-iizd.6): an evaluated `hit` pillar-day grants
 * {@code mezo.lifegoal.xp-per-hit} on the pillar's own skill through the shared idempotent
 * progression tail. Called from every pillar-day WRITE (manual evaluate + the nightly job), never
 * from a read path — {@code progress}/{@code today} compute days without storing them.
 *
 * <p>Idempotency is the D-1 deterministic key (spec §1 D-1): stable across the job's 3-day rewrite
 * window AND across a source/kind change that drops and recomputes the pillar-day rows.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalXpService {

    private static final String STATUS_HIT = "hit";

    private final LifeGoalProperties properties;
    private final ObjectProvider<ProgressionGate> progressionGate;
    private final ProgressionService progressionService;

    /** The D-1 XP idempotency key: {@code lifegoal:<pillarId>:<day>} hashed to a stable UUID. */
    public static UUID refIdFor(UUID pillarId, LocalDate day) {
        return UUID.nameUUIDFromBytes(("lifegoal:" + pillarId + ":" + day).getBytes(StandardCharsets.UTF_8));
    }

    /** Grants XP for one evaluated pillar-day; a no-op for every non-hit status. */
    public void awardIfHit(LifeGoalPillarEntity pillar, LocalDate day, String status) {
        if (!STATUS_HIT.equals(status) || properties.xpPerHit() <= 0) {
            return;
        }
        if (ProgressionTaxonomy.ROBUSTNESS.equals(pillar.getSkillKey())) {
            // The shared tail recomputes robustness to an absolute streak target: a delta there
            // is discarded, so the award would be a ledger row granting nothing.
            log.debug("Life-goal pillar {} is robustness-keyed — no XP", pillar.getId());
            return;
        }
        if (progressionGate.getIfAvailable() == null) {
            return;
        }
        String kind = skillKindOf(pillar.getSkillKey());
        if (kind == null) {
            log.warn("Life-goal pillar {} has unknown skill key {} — no XP",
                pillar.getId(), pillar.getSkillKey());
            return;
        }
        progressionService.applyLifeGoal(pillar.getCreatedBy(), new LifeGoalSignal(
            refIdFor(pillar.getId(), day), pillar.getSkillKey(), kind,
            properties.xpPerHit(), "Életcél · " + pillar.getLabel(), day));
    }

    private static String skillKindOf(String skillKey) {
        if (ProgressionTaxonomy.LIFE.contains(skillKey)) {
            return "LIFE";
        }
        if (ProgressionTaxonomy.ATHLETIC.contains(skillKey)) {
            return "ATHLETIC";
        }
        if (ProgressionTaxonomy.MUSCLE.contains(skillKey)) {
            return "MUSCLE";
        }
        return null;
    }
}
```

- [ ] **Step 5: Split `evaluate` into `evaluateDays` + response, and award per upserted day**

In `LifeGoalProgressService`: add `private final LifeGoalXpService xpService;` to the field block, then replace the body of `evaluate` and add `evaluateDays`:

```java
    /** Az utolsó 3 LEZÁRT nap (tegnap, −2, −3) upsertje minden aktív pillérre, majd 28 napos progress. */
    @Transactional
    public LifeGoalProgressResponse evaluate(UUID userId, UUID goalId) {
        LifeGoalEntity goal = lifeGoalService.requireOwned(userId, goalId);
        evaluateDays(userId, goal);
        LocalDate today = LocalDate.now();
        return buildProgress(userId, goal, activePillars(goal.getId()),
            today.minusDays(PROGRESS_WINDOW_DAYS - 1), today);
    }

    /**
     * The writer half, response-free (mezo-iizd.6): upserts the last 3 closed days of every active
     * pillar and grants pillar-hit XP. Ownership is the caller's business — the nightly job iterates
     * its own users' goals, the HTTP path goes through {@link #evaluate}.
     */
    @Transactional
    public void evaluateDays(UUID userId, LifeGoalEntity goal) {
        LocalDate today = LocalDate.now();
        List<LocalDate> closedDays = List.of(today.minusDays(1), today.minusDays(2), today.minusDays(3));
        LocalDate latestClosed = today.minusDays(1);
        LocalDate wideFrom = latestClosed.minusDays(PROGRESS_WINDOW_DAYS);
        for (LifeGoalPillarEntity pillar : activePillars(goal.getId())) {
            SignalWindow window = windowFor(userId, pillar, wideFrom, latestClosed);
            for (LocalDate day : closedDays) {
                PillarDayScore score = LifeGoalScorer.scoreDay(pillar.getKind(), pillar.getRule(), day, window);
                upsertPillarDay(pillar, day, score);
                xpService.awardIfHit(pillar, day, score.status());
            }
        }
    }
```

`upsertPillarDay` stays as-is but must become an instance method call site only — no signature change.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoalXpIT,LifeGoalEvaluateApiIT,LifeGoalProgressApiIT,LifeGoalTodayApiIT'
```

Expected: PASS — the three new XP tests plus the slice-2a evaluate/progress/today ITs (regression: the refactor must not change the response).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalXpIT.java
git commit -m "feat(lifegoal): pillér-hit XP a kiértékelés írási útján, D-1 kulccsal (mezo-iizd.6)"
```

---

### Task 3: `LifeGoalEvalJob` — the nightly cron

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalEvalJob.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (next to `LIFEGOAL_SWITCH`, ~line 224)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/config/LifeGoalProperties.java` (add `evalCron`)
- Modify: `backend/src/main/resources/application.yml` (`mezo.techcore.cron` block ~line 334 + `mezo.lifegoal` block)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalEvalJobIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalEvalJobSwitchOffIT.java`

**Interfaces:**
- Consumes: Task 2's `LifeGoalProgressService.evaluateDays(UUID userId, LifeGoalEntity goal)`; `LifeGoalRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(UUID)`; `AppUserRepository.findAll()`.
- Produces: `LifeGoalEvalJob.runEval()` — the cron entry point the ITs call directly.

- [ ] **Step 1: Write the failing tests**

`backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalEvalJobIT.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.entity.ActivityExtract;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarDayRepository;
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalEvalJob;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Nightly life-goal evaluation cron (mezo-iizd.6): every active goal of every user gets its last
 * 3 closed days rewritten and its hit-days awarded. Two runs must leave exactly the same rows and
 * the same XP (the Habitica double-cron lesson, spec §2); a closed/archived goal is skipped.
 */
class LifeGoalEvalJobIT extends AbstractIntegrationTest {

    private static final int XP_PER_HIT = 5;

    @Autowired private LifeGoalEvalJob job;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private LifeGoalPillarDayRepository dayRepository;
    @Autowired private SkillProgressRepository skillProgressRepository;

    private final LocalDate today = LocalDate.now();

    private LifeGoalPillarEntity focusPillar(LifeGoalEntity goal) {
        return lifeGoalPopulator.pillar(goal, "Fókusz", "habit",
            new PillarSourceJson("activity", null, "productivity", "minutes", null, null),
            new PillarRuleJson(new BigDecimal("30"), "gte", 4, null, null, null, null, null, null, null));
    }

    private void activity(UUID owner, LocalDate on, int durationMin) {
        ActivityLogEntity e = new ActivityLogEntity();
        e.setCreatedBy(owner);
        e.setOccurredOn(on);
        e.setText("fókuszblokk");
        e.setSkillKey("productivity");
        e.setExtracted(new ActivityExtract(durationMin, null));
        activityLogRepository.saveAndFlush(e);
    }

    @Test
    void testRunEval_shouldWriteTheSameRowsAndXp_whenRunTwice() {
        UUID owner = userPopulator.createUser("lifegoal-job@test.hu").getId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        LifeGoalPillarEntity pillar = focusPillar(goal);
        activity(owner, today.minusDays(1), 40);

        job.runEval();
        job.runEval();

        var rows = dayRepository.findByPillarIdInAndDayBetweenAndDeletedFalseOrderByDayAsc(
            List.of(pillar.getId()), today.minusDays(3), today.minusDays(1));
        assertThat(rows).hasSize(3);
        assertThat(rows).filteredOn(r -> "hit".equals(r.getStatus())).hasSize(1);
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(owner, "recovery")
            .orElseThrow().getCumulativeXp()).isEqualTo(XP_PER_HIT);
    }

    @Test
    void testRunEval_shouldSkipTheGoal_whenItIsNotActive() {
        UUID owner = userPopulator.createUser("lifegoal-job-draft@test.hu").getId();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "archived");
        LifeGoalPillarEntity pillar = focusPillar(goal);
        activity(owner, today.minusDays(1), 40);

        job.runEval();

        assertThat(dayRepository.findByPillarIdInAndDayBetweenAndDeletedFalseOrderByDayAsc(
            List.of(pillar.getId()), today.minusDays(3), today.minusDays(1))).isEmpty();
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(owner, "recovery")).isEmpty();
    }
}
```

`backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalEvalJobSwitchOffIT.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalEvalJob;
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalProgressService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/**
 * The cron switch is a bean boundary (mezo-iizd.6, HabitJob pattern): off ⇒ the job bean does not
 * exist at all, while the manual evaluate path (LifeGoalProgressService) stays fully wired.
 */
@TestPropertySource(properties = "mezo.techcore.cron.life-goal-eval-job.enabled=false")
class LifeGoalEvalJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testJobBean_shouldNotExist_whenTheCronSwitchIsOff() {
        assertThat(context.getBeanNamesForType(LifeGoalEvalJob.class)).isEmpty();
        assertThat(context.getBeanNamesForType(LifeGoalProgressService.class)).isNotEmpty();
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoalEvalJobIT,LifeGoalEvalJobSwitchOffIT'
```

Expected: compile error — `LifeGoalEvalJob` does not exist.

- [ ] **Step 3: Add the switch constant, the cron property and the yml entries**

`FeaturesConfiguration.java`, directly after `LIFEGOAL_SWITCH`:

```java
    /** Nightly life-goal evaluation cron (mezo-iizd.6) — schedule: mezo.lifegoal.eval-cron;
     *  off ⇒ the LifeGoalEvalJob bean does not exist (manual POST /{id}/evaluate stays on). */
    public static final String LIFE_GOAL_EVAL_JOB_SWITCH = "mezo.techcore.cron.life-goal-eval-job.enabled";
```

`LifeGoalProperties.java` — third component, after `xpPerHit`:

```java
    @Min(1) @Max(100) int xpPerHit,

    /**
     * Nightly evaluation schedule (Spring cron), default 00:20 — after the habit close (00:10) so
     * the day's habit metrics are already honest. The job bean itself is gated by
     * {@code mezo.techcore.cron.life-goal-eval-job.enabled}.
     */
    @NotBlank String evalCron) {}
```

(add the `jakarta.validation.constraints.NotBlank` import)

`application.yml`, in the `mezo.techcore.cron` block (keep the block's comment style):

```yaml
      # Életcél nightly evaluation pass (mezo-iizd.6, schedule: mezo.lifegoal.eval-cron);
      # off = the LifeGoalEvalJob bean does not exist (manual POST /{id}/evaluate stays on)
      life-goal-eval-job:
        enabled: true
```

`application.yml`, in the `mezo.lifegoal` block:

```yaml
    # 00:20 — a habit close (00:10) UTÁN, hogy a nap metrikái már véglegesek legyenek.
    eval-cron: "0 20 0 * * *"
```

- [ ] **Step 4: Write the job**

`backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalEvalJob.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Nightly life-goal evaluation cron (mezo-iizd.6, HabitJob pattern): rewrites the last 3 closed
 * days of every ACTIVE goal's pillars and grants pillar-hit XP. The rolling 3-day window is what
 * backfills late logging (spec §2, Exist.io); the whole pass is idempotent, so a double run (or a
 * manual evaluate in between) changes nothing. Failures are isolated per goal — one broken signal
 * source must not cost every other user their evaluation.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.LIFEGOAL_SWITCH, FeaturesConfiguration.LIFE_GOAL_EVAL_JOB_SWITCH},
        havingValue = "true")
public class LifeGoalEvalJob {

    private final AppUserRepository appUserRepository;
    private final LifeGoalRepository goalRepository;
    private final LifeGoalProgressService progressService;

    @Scheduled(cron = "${mezo.lifegoal.eval-cron}")
    public void runEval() {
        LocalDate today = LocalDate.now();
        int goals = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            for (LifeGoalEntity goal
                    : goalRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(user.getId())) {
                if (!"active".equals(goal.getStatus())) {
                    continue;
                }
                try {
                    progressService.evaluateDays(user.getId(), goal);
                    goals++;
                } catch (Exception e) {
                    log.warn("Life-goal evaluation failed for goal {} (user {}) on {}",
                        goal.getId(), user.getId(), today, e);
                }
            }
        }
        log.info("Life-goal evaluation run for {} complete — {} active goal(s)", today, goals);
    }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoalEvalJobIT,LifeGoalEvalJobSwitchOffIT,LifeGoalXpIT'
```

Expected: PASS (all three ITs).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal
git commit -m "feat(lifegoal): LifeGoalEvalJob éjszakai kiértékelés kettős kapcsolóval (mezo-iizd.6)"
```

---

### Task 4: Gates + docs

**Files:**
- Modify: `docs/features/lifegoal.md` (§3 flow, §4 config table if present, §5 Progression bullet + deferred-seams bullet, §8 testing, §9 "Shipped this slice"/deferred + a robustness gotcha, §10 key files)
- Modify: `docs/features/growth.md` §5 (a `↔ Life goals` XP-source bullet next to the Habit one, ~line 135)
- Modify: `docs/CODEMAP.md` (regenerated only)

- [ ] **Step 1: Run the ArchUnit suite separately**

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='*Arch*Test'
```

Expected: PASS. The new edge is `lifegoal → progression`, which already exists (`LifeGoalPillarService` imports `ProgressionTaxonomy`) and adds no cycle — `progression` never imports `lifegoal`. If the frozen cycle store changed, that is a failure to investigate, not to re-freeze.

- [ ] **Step 2: Update the feature docs**

Edit in place (living docs, no changelog sections):
- **§3** — the write path now has two callers: `POST /{id}/evaluate` and `LifeGoalEvalJob` (00:20, per-user/per-goal isolated), both through `evaluateDays`; `LifeGoalXpService` hangs off the day upsert.
- **§5 ← Progression** — replace "No write path yet — the XP award (slice 2) will call `ProgressionService.award`" with the shipped contract: `LifeGoalXpService` → `ProgressionService.applyLifeGoal(LifeGoalSignal)`, `source_type=LIFE_GOAL`, deterministic D-1 `sourceRefId`, gated by `ObjectProvider<ProgressionGate>`, `robustness`-keyed pillars grant nothing.
- **§5 deferred seams** — drop `LifeGoalEvalJob`'s nightly scheduling and the XP award from the deferred list (they ship here); keep the slice-3 items.
- **§8** — add the three new ITs and the focused run commands.
- **§9** — move `LifeGoalEvalJob` + XP out of "Not yet shipped" into a "Shipped this slice (mezo-iizd.6)" line; note D6 is now fully implemented (stored rows AND the nightly job); add the gotcha: a `robustness` pillar skill key awards nothing because the shared tail overwrites that row with an absolute streak target.
- **§10** — add `service/LifeGoalEvalJob.java`, `service/LifeGoalXpService.java`, `feature/progression/lifegoal/LifeGoalSignal.java` and the new test files.
- **`growth.md` §5** — one bullet: `↔ Life goals (mezo-iizd.6)`: the fourth idempotent award source (`LIFE_GOAL`), one award per `(pillar, day)` on the pillar's own skill (LIFE/ATHLETIC/MUSCLE), granted by the nightly evaluation, never reverted, `robustness` excluded.

- [ ] **Step 3: Regenerate the codemap and lint the docs**

```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only
```

Expected: codemap regenerated (new classes/tests listed); the doc lint reports **no errors** (the ~15 pre-existing staleness warnings are expected and are not errors).

- [ ] **Step 4: Commit**

```bash
git add docs/features/lifegoal.md docs/features/growth.md docs/CODEMAP.md
git commit -m "docs(lifegoal): éjszakai kiértékelés + XP a feature-doksiban (mezo-iizd.6)"
```

- [ ] **Step 5: Full local focused re-run before the PR**

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoal*IT,ProgressionLifeGoalIT,ProgressionHabitIT,HabitJobIT'
```

Expected: PASS. Frontend is untouched by this slice (no contract change, no hook change) — no FE gate needed; CI runs both modes anyway.

- [ ] **Step 6: Self-PR → CI green → merge**

```bash
git push -u origin feat/lifegoal-eval-job
```

Then open the self-PR (CI gate), wait for green, and merge with `--no-ff` on top of the **fresh** `origin/main`, push `main`, delete the branch, `bd close mezo-iizd.6`.

---

## Self-Review

**Spec coverage (§0 `mezo-iizd.6` + §4 ".6"):**
- dual `@ConditionalOnProperty` (LIFEGOAL_SWITCH + `mezo.techcore.cron.life-goal-eval-job.enabled`) → Task 3
- `@Scheduled(cron = "${mezo.lifegoal.eval-cron}")`, default `0 20 0 * * *` → Task 3
- per-user (here: per-goal, strictly finer) error isolation → Task 3
- last-3-closed-days idempotent upsert for every active goal's pillars → Task 3 (reusing Task 2's `evaluateDays`)
- `source_type = LIFE_GOAL`, D-1 deterministic `sourceRefId`, `mezo.lifegoal.xp-per-hit` (default 5), hit-only, on the pillar's `skill_key` → Tasks 1-2
- tests: job idempotency, XP idempotency on the D-1 key, switch test → Tasks 2-3
- codemap + docs-lint + `docs/features/lifegoal.md` in the same change → Task 4

**Type consistency:** `LifeGoalSignal(sourceRefId, skillKey, skillKind, xp, label, occurredOn)` is used identically in Tasks 1-2; `LifeGoalXpService.refIdFor(UUID, LocalDate)` is the only key builder and the ITs assert through it; `evaluateDays(UUID, LifeGoalEntity)` is produced in Task 2 and consumed in Task 3 with that exact signature.

**Known deviations from the spec's wording:** `applyLifeGoal` instead of `awardLifeGoal` (house family naming — see Global Constraints); error isolation is per goal rather than per user (a strictly finer granularity that still isolates users).
