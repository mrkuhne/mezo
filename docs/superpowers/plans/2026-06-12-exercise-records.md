# Exercise Records / Achievements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-exercise all-time records (best set, Epley e1RM, volumes, counters, rep records, recent top sets) served by an on-the-fly aggregation endpoint and browsed on a new 5th Train tab "Gyakorlatok" with catalog search and a record sheet.

**Architecture:** `GET /api/train/exercise-records` aggregates the owner's logged sets (`exercise_set`) grouped by exercise identity (`exercise.catalog_id`, name fallback) — including sets whose template exercise row was soft-deleted by day edits (native identity query bypasses `@SQLRestriction`). FE: new `/train/exercises` route + tab; `ExercisesView` (top list + catalog ghost search) + `ExerciseRecordSheet` (mockup variant A).

**Tech Stack:** Spring Boot 4 / Java 21, contract-first OpenAPI codegen, React 19 + TanStack Query + MSW/Vitest.

**Spec:** `docs/superpowers/specs/2026-06-12-exercise-records-design.md` · **bd:** mezo-wua

**Conventions:** docs/references/ house rules bind every task (`spring_patterns.md`, `testing_standards.md`, `integration_test_framework.md`, `api_contract_conventions.md`). Always `./mvnw clean test`. Absolute `cd` paths (shell cwd resets). Generated `TrainApi` methods are abstract ⇒ every contract edit ships with at least a controller stub in the same compiling commit.

---

### Task 0: Branch + claim

- [ ] **Step 0.1:**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git checkout -b feat/exercise-records
bd update mezo-wua --claim
```

---

### Task 1: Contract + repositories + populators + ExerciseRecordService (TDD)

**Files:**
- Modify: `api/feature/train/train.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/ExerciseRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/ExerciseSetRepository.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/ExerciseRecordService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java` (stub)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseRecordServiceIT.java`

- [ ] **Step 1.1: Contract — new path** in `api/feature/train/train.yml`, insert between the `/api/train/exercises` block and `/api/train/sport-sessions:`:

```yaml
  /api/train/exercise-records:
    get:
      tags: [Train]
      operationId: getExerciseRecords
      summary: Per-exercise all-time records aggregated from logged sets, sessionCount desc then name
      responses:
        '200':
          description: Exercise records (empty array when nothing is logged yet)
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ExerciseRecordResponse'
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
```

- [ ] **Step 1.2: Contract — new schemas**, append after `ExerciseCatalogItem` (before `WorkoutTodayResponse`):

```yaml
    RecordSetRef:
      type: object
      description: One logged set as a record reference; weightKg absent on bodyweight sets
      required:
        - reps
        - date
      properties:
        weightKg:
          type: number
        reps:
          type: integer
        date:
          type: string
          format: date
    E1rmRecord:
      type: object
      required:
        - value
        - set
      properties:
        value:
          type: number
          description: Epley estimate weight×(1+reps/30), 1 decimal
        set:
          $ref: '#/components/schemas/RecordSetRef'
    SessionVolumeRecord:
      type: object
      required:
        - volumeKg
        - date
      properties:
        volumeKg:
          type: number
        date:
          type: string
          format: date
    ExerciseRecordResponse:
      type: object
      required:
        - name
        - muscle
        - type
        - totalVolume
        - totalSets
        - totalReps
        - sessionCount
        - repRecords
        - recentTopSets
      properties:
        catalogId:
          type: string
          format: uuid
          description: Identity when the exercise is catalog-linked; absent for name-grouped legacy rows
        name:
          type: string
        muscle:
          type: string
        type:
          type: string
          enum: [compound, isolation, plyo]
        bestSet:
          $ref: '#/components/schemas/RecordSetRef'
        bestE1rm:
          $ref: '#/components/schemas/E1rmRecord'
        bestSessionVolume:
          $ref: '#/components/schemas/SessionVolumeRecord'
        totalVolume:
          type: number
          description: Σ weight×reps all-time, whole kg (0 for bodyweight-only exercises)
        totalSets:
          type: integer
        totalReps:
          type: integer
        sessionCount:
          type: integer
        repRecords:
          type: array
          description: Max reps at the top 3 distinct weights, weight descending
          items:
            $ref: '#/components/schemas/RecordSetRef'
        recentTopSets:
          type: array
          description: Top set of the last 5 sessions, oldest first (sparkline order), max 5
          items:
            $ref: '#/components/schemas/RecordSetRef'
```

- [ ] **Step 1.3: Regenerate both sides**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/api/generate && npm run generate:api
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm generate:api
```

- [ ] **Step 1.4: Controller stub** (codegen makes `getExerciseRecords` abstract — nothing compiles without it). In `TrainController.java` add import `io.mrkuhne.mezo.api.dto.ExerciseRecordResponse` and, right after `getExerciseCatalog()`:

```java
    @Override
    public List<ExerciseRecordResponse> getExerciseRecords() {
        return List.of(); // stub — replaced by ExerciseRecordService in Task 2
    }
```

- [ ] **Step 1.5: Repository finders.**

`ExerciseSetRepository.java` — add:

```java
    /** Every logged (reps present) set of the owner — record aggregation input. */
    List<ExerciseSetEntity> findByCreatedByAndRepsNotNull(UUID createdBy);
```

`ExerciseRepository.java` — add imports `org.springframework.data.jpa.repository.Query`, `org.springframework.data.repository.query.Param`, `java.time.Instant`, and:

```java
    /**
     * Identity projection over ALL exercise rows of the owner — including soft-deleted ones.
     * Day-edit full-replace soft-deletes template rows while their logged sets stay live, so
     * record aggregation must resolve identity past {@code @SQLRestriction}; hence native SQL.
     */
    interface ExerciseIdentityRow {
        UUID getId();
        String getName();
        String getMuscle();
        String getType();
        UUID getCatalogId();
        Instant getCreatedAt();
    }

    @Query(value = "SELECT id, name, muscle, type, catalog_id AS \"catalogId\", created_at AS \"createdAt\" "
        + "FROM exercise WHERE created_by = :createdBy", nativeQuery = true)
    List<ExerciseIdentityRow> findIdentityRowsIncludingDeleted(@Param("createdBy") UUID createdBy);
```

- [ ] **Step 1.6: Populator overloads** in `TrainPopulator.java` (add import `java.time.Instant`):

```java
    /** Catalog-linked exercise with explicit muscle/type — record-aggregation tests. */
    public ExerciseEntity createExercise(UUID createdBy, UUID workoutSessionId, String name,
        int orderIndex, String muscle, String type, UUID catalogId) {
        ExerciseEntity e = new ExerciseEntity();
        e.setCreatedBy(createdBy);
        e.setWorkoutSessionId(workoutSessionId);
        e.setName(name);
        e.setMuscle(muscle);
        e.setSets(3);
        e.setTargetReps("8-10");
        e.setTargetRir(1);
        e.setType(type);
        e.setCatalogId(catalogId);
        e.setOrderIndex(orderIndex);
        return exerciseRepository.saveAndFlush(e);
    }

    /** Logged set with explicit doneAt (record date/ordering tests); weightKg null = bodyweight. */
    public ExerciseSetEntity createLoggedSet(UUID createdBy, UUID exerciseId, UUID workoutSessionId,
        int setIndex, String weightKg, int reps, int rir, Instant doneAt) {
        ExerciseSetEntity set = new ExerciseSetEntity();
        set.setCreatedBy(createdBy);
        set.setExerciseId(exerciseId);
        set.setWorkoutSessionId(workoutSessionId);
        set.setSetIndex(setIndex);
        set.setWeightKg(weightKg != null ? new BigDecimal(weightKg) : null);
        set.setReps(reps);
        set.setRir(rir);
        set.setDoneAt(doneAt);
        return exerciseSetRepository.saveAndFlush(set);
    }
```

- [ ] **Step 1.7: Write the failing service IT** — `ExerciseRecordServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseRecordResponse;
import io.mrkuhne.mezo.api.dto.RecordSetRef;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.service.ExerciseRecordService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Aggregation rules for per-exercise records: identity (catalog_id, name fallback,
 * soft-deleted template rows), best-set/e1RM tie-breaks, session volume grouping,
 * bodyweight handling, rep records, recent-top-sets ordering, owner isolation.
 */
@Transactional
class ExerciseRecordServiceIT extends AbstractIntegrationTest {

    @Autowired private ExerciseRecordService service;
    @Autowired private ExerciseRepository exerciseRepository;
    @Autowired private ExerciseCatalogRepository catalogRepository;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private static Instant day(int offset) {
        return Instant.parse("2026-06-01T10:00:00Z").plusSeconds(offset * 86_400L);
    }

    /** meso + template day + instance; returns the instance for set linkage. */
    private WorkoutSessionEntity instanceFor(UUID by, String title) {
        MesocycleEntity meso = trainPopulator.createMesocycle(by, title, "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(by, meso.getId(), "Hét", "Push", 0, "planned");
        return trainPopulator.createWorkoutInstance(by, template, LocalDate.parse("2026-06-01"), "completed");
    }

    @Test
    void testList_shouldComputeBestSetAndE1rm_whenTieBreaksApply() {
        UUID by = databasePopulator.populateUser("rec1@test.local");
        WorkoutSessionEntity w = instanceFor(by, "R1");
        UUID catalogId = catalogRepository.findBySlug("barbell-bench-press").orElseThrow().getId();
        ExerciseEntity ex = trainPopulator.createExercise(by, w.getId(), "Barbell Bench Press", 0,
            "chest", "compound", catalogId);
        // same weight, fewer reps, earlier — must lose both tie-breaks
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 0, "110", 4, 1, day(0));
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 1, "110", 5, 1, day(1));
        // lighter but high-rep set wins e1RM: 100×(1+12/30)=140 > 110×(1+5/30)=128.3
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 2, "100", 12, 1, day(2));

        List<ExerciseRecordResponse> records = service.list(by);

        assertThat(records).hasSize(1);
        ExerciseRecordResponse r = records.get(0);
        assertThat(r.getCatalogId()).isEqualTo(catalogId);
        assertThat(r.getName()).isEqualTo("Barbell Bench Press");
        assertThat(r.getMuscle()).isEqualTo("chest"); // catalog-sourced display
        assertThat(r.getBestSet().getWeightKg()).isEqualByComparingTo("110");
        assertThat(r.getBestSet().getReps()).isEqualTo(5);
        assertThat(r.getBestE1rm().getValue()).isEqualByComparingTo("140.0");
        assertThat(r.getBestE1rm().getSet().getWeightKg()).isEqualByComparingTo("100");
    }

    @Test
    void testList_shouldAggregateAcrossMesos_whenSameCatalogId() {
        UUID by = databasePopulator.populateUser("rec2@test.local");
        UUID catalogId = catalogRepository.findBySlug("barbell-squat").orElseThrow().getId();
        WorkoutSessionEntity w1 = instanceFor(by, "Old meso");
        WorkoutSessionEntity w2 = instanceFor(by, "New meso");
        ExerciseEntity e1 = trainPopulator.createExercise(by, w1.getId(), "Barbell Squat", 0, "quad", "compound", catalogId);
        ExerciseEntity e2 = trainPopulator.createExercise(by, w2.getId(), "Barbell Squat", 0, "quad", "compound", catalogId);
        trainPopulator.createLoggedSet(by, e1.getId(), w1.getId(), 0, "140", 3, 1, day(0));
        trainPopulator.createLoggedSet(by, e2.getId(), w2.getId(), 0, "150", 3, 1, day(7));

        List<ExerciseRecordResponse> records = service.list(by);

        assertThat(records).hasSize(1); // ONE identity across two mesos
        assertThat(records.get(0).getSessionCount()).isEqualTo(2);
        assertThat(records.get(0).getBestSet().getWeightKg()).isEqualByComparingTo("150");
    }

    @Test
    void testList_shouldKeepHistory_whenTemplateExerciseSoftDeleted() {
        UUID by = databasePopulator.populateUser("rec3@test.local");
        UUID catalogId = catalogRepository.findBySlug("romanian-deadlift").orElseThrow().getId();
        WorkoutSessionEntity w = instanceFor(by, "R3");
        ExerciseEntity ex = trainPopulator.createExercise(by, w.getId(), "Romanian Deadlift", 0, "ham", "compound", catalogId);
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 0, "120", 8, 1, day(0));
        exerciseRepository.delete(ex); // @SQLDelete -> is_deleted=true, the set survives
        exerciseRepository.flush();

        List<ExerciseRecordResponse> records = service.list(by);

        assertThat(records).hasSize(1);
        assertThat(records.get(0).getBestSet().getWeightKg()).isEqualByComparingTo("120");
    }

    @Test
    void testList_shouldGroupByName_whenNoCatalogLink() {
        UUID by = databasePopulator.populateUser("rec4@test.local");
        WorkoutSessionEntity w1 = instanceFor(by, "R4a");
        WorkoutSessionEntity w2 = instanceFor(by, "R4b");
        // legacy rows: no catalogId — same name must merge into one identity
        ExerciseEntity e1 = trainPopulator.createExercise(by, w1.getId(), "Mystery Row", 0);
        ExerciseEntity e2 = trainPopulator.createExercise(by, w2.getId(), "Mystery Row", 0);
        trainPopulator.createLoggedSet(by, e1.getId(), w1.getId(), 0, "80", 10, 1, day(0));
        trainPopulator.createLoggedSet(by, e2.getId(), w2.getId(), 0, "85", 10, 1, day(1));

        List<ExerciseRecordResponse> records = service.list(by);

        assertThat(records).hasSize(1);
        assertThat(records.get(0).getCatalogId()).isNull();
        assertThat(records.get(0).getName()).isEqualTo("Mystery Row");
        assertThat(records.get(0).getSessionCount()).isEqualTo(2);
    }

    @Test
    void testList_shouldComputeSessionVolumeAndTotals_whenMultipleSessions() {
        UUID by = databasePopulator.populateUser("rec5@test.local");
        UUID catalogId = catalogRepository.findBySlug("leg-press").orElseThrow().getId();
        WorkoutSessionEntity w1 = instanceFor(by, "R5a");
        WorkoutSessionEntity w2 = instanceFor(by, "R5b");
        ExerciseEntity e1 = trainPopulator.createExercise(by, w1.getId(), "Leg Press", 0, "quad", "compound", catalogId);
        ExerciseEntity e2 = trainPopulator.createExercise(by, w2.getId(), "Leg Press", 0, "quad", "compound", catalogId);
        trainPopulator.createLoggedSet(by, e1.getId(), w1.getId(), 0, "200", 10, 1, day(0)); // 2000
        trainPopulator.createLoggedSet(by, e1.getId(), w1.getId(), 1, "200", 8, 1, day(0));  // 1600 -> 3600
        trainPopulator.createLoggedSet(by, e2.getId(), w2.getId(), 0, "210", 9, 1, day(7));  // 1890

        ExerciseRecordResponse r = service.list(by).get(0);

        assertThat(r.getBestSessionVolume().getVolumeKg()).isEqualByComparingTo("3600");
        assertThat(r.getTotalVolume()).isEqualByComparingTo("5490");
        assertThat(r.getTotalSets()).isEqualTo(3);
        assertThat(r.getTotalReps()).isEqualTo(27);
        assertThat(r.getSessionCount()).isEqualTo(2);
    }

    @Test
    void testList_shouldServeCountersWithoutWeightPrs_whenBodyweightOnly() {
        UUID by = databasePopulator.populateUser("rec6@test.local");
        UUID catalogId = catalogRepository.findBySlug("box-jump").orElseThrow().getId();
        WorkoutSessionEntity w = instanceFor(by, "R6");
        ExerciseEntity ex = trainPopulator.createExercise(by, w.getId(), "Box Jump", 0, "quad", "plyo", catalogId);
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 0, null, 10, 2, day(0));
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 1, null, 12, 2, day(0));

        ExerciseRecordResponse r = service.list(by).get(0);

        assertThat(r.getType().getValue()).isEqualTo("plyo");
        assertThat(r.getBestSet()).isNull();
        assertThat(r.getBestE1rm()).isNull();
        assertThat(r.getBestSessionVolume()).isNull();
        assertThat(r.getTotalVolume()).isEqualByComparingTo("0");
        assertThat(r.getTotalReps()).isEqualTo(22);
        assertThat(r.getRepRecords()).isEmpty();
        assertThat(r.getRecentTopSets()).hasSize(1); // one session -> its top set (12 reps)
        assertThat(r.getRecentTopSets().get(0).getReps()).isEqualTo(12);
    }

    @Test
    void testList_shouldRankRepRecords_whenManyWeightsUsed() {
        UUID by = databasePopulator.populateUser("rec7@test.local");
        UUID catalogId = catalogRepository.findBySlug("overhead-press").orElseThrow().getId();
        WorkoutSessionEntity w = instanceFor(by, "R7");
        ExerciseEntity ex = trainPopulator.createExercise(by, w.getId(), "Overhead Press", 0, "shoulder", "compound", catalogId);
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 0, "60", 6, 1, day(0));
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 1, "60", 8, 1, day(1)); // better at 60
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 2, "55", 10, 1, day(0));
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 3, "50", 12, 1, day(0));
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 4, "45", 15, 1, day(0)); // 4th weight -> cut

        List<RecordSetRef> reps = service.list(by).get(0).getRepRecords();

        assertThat(reps).hasSize(3);
        assertThat(reps.get(0).getWeightKg()).isEqualByComparingTo("60");
        assertThat(reps.get(0).getReps()).isEqualTo(8);
        assertThat(reps.get(1).getWeightKg()).isEqualByComparingTo("55");
        assertThat(reps.get(2).getWeightKg()).isEqualByComparingTo("50");
    }

    @Test
    void testList_shouldReturnLastFiveSessionsOldestFirst_whenSixSessionsExist() {
        UUID by = databasePopulator.populateUser("rec8@test.local");
        UUID catalogId = catalogRepository.findBySlug("hip-thrust").orElseThrow().getId();
        MesocycleEntity meso = trainPopulator.createMesocycle(by, "R8", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(by, meso.getId(), "Hét", "Push", 0, "planned");
        for (int i = 0; i < 6; i++) {
            WorkoutSessionEntity w = trainPopulator.createWorkoutInstance(
                by, template, LocalDate.parse("2026-06-01").plusDays(i), "completed");
            ExerciseEntity ex = trainPopulator.createExercise(by, w.getId(), "Hip Thrust", 0, "glute", "compound", catalogId);
            trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 0, String.valueOf(100 + i), 8, 1, day(i));
        }

        List<RecordSetRef> recent = service.list(by).get(0).getRecentTopSets();

        assertThat(recent).hasSize(5);
        // session 0 (100kg) dropped; oldest-first: 101..105
        assertThat(recent.get(0).getWeightKg()).isEqualByComparingTo("101");
        assertThat(recent.get(4).getWeightKg()).isEqualByComparingTo("105");
    }

    @Test
    void testList_shouldIsolateOwners_whenOtherUserHasRecords() {
        UUID owner = databasePopulator.populateUser("rec9a@test.local");
        UUID other = databasePopulator.populateUser("rec9b@test.local");
        WorkoutSessionEntity w = instanceFor(other, "R9");
        ExerciseEntity ex = trainPopulator.createExercise(other, w.getId(), "Barbell Curl", 0);
        trainPopulator.createLoggedSet(other, ex.getId(), w.getId(), 0, "40", 10, 1, day(0));

        assertThat(service.list(owner)).isEmpty();
        assertThat(service.list(other)).hasSize(1);
    }

    @Test
    void testList_shouldSortBySessionCountThenName_whenMultipleExercises() {
        UUID by = databasePopulator.populateUser("rec10@test.local");
        WorkoutSessionEntity w1 = instanceFor(by, "R10a");
        WorkoutSessionEntity w2 = instanceFor(by, "R10b");
        // "B Exercise": 2 sessions; "A Exercise" + "C Exercise": 1 session each
        ExerciseEntity b1 = trainPopulator.createExercise(by, w1.getId(), "B Exercise", 0);
        ExerciseEntity b2 = trainPopulator.createExercise(by, w2.getId(), "B Exercise", 0);
        ExerciseEntity a = trainPopulator.createExercise(by, w1.getId(), "A Exercise", 1);
        ExerciseEntity c = trainPopulator.createExercise(by, w1.getId(), "C Exercise", 2);
        trainPopulator.createLoggedSet(by, b1.getId(), w1.getId(), 0, "50", 8, 1, day(0));
        trainPopulator.createLoggedSet(by, b2.getId(), w2.getId(), 0, "50", 8, 1, day(1));
        trainPopulator.createLoggedSet(by, a.getId(), w1.getId(), 0, "50", 8, 1, day(0));
        trainPopulator.createLoggedSet(by, c.getId(), w1.getId(), 0, "50", 8, 1, day(0));

        List<ExerciseRecordResponse> records = service.list(by);

        assertThat(records).extracting(ExerciseRecordResponse::getName)
            .containsExactly("B Exercise", "A Exercise", "C Exercise");
    }
}
```

- [ ] **Step 1.8: Run to verify red**

Run: `cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=ExerciseRecordServiceIT`
Expected: COMPILE FAILURE (`ExerciseRecordService` does not exist) — red for a new class.

- [ ] **Step 1.9: Implement** `ExerciseRecordService.java`:

```java
package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.E1rmRecord;
import io.mrkuhne.mezo.api.dto.ExerciseRecordResponse;
import io.mrkuhne.mezo.api.dto.RecordSetRef;
import io.mrkuhne.mezo.api.dto.SessionVolumeRecord;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository.ExerciseIdentityRow;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * On-the-fly per-exercise record aggregation (spec 2026-06-12-exercise-records-design.md).
 * Identity = {@code exercise.catalog_id} when present, else the exercise name — resolved over
 * ALL exercise rows including soft-deleted templates (day edits must not erase history). A set
 * counts when {@code reps} is logged; weight-based records additionally need {@code weight_kg}.
 * Single-user data volume keeps this in-memory aggregation trivially fast; records can never
 * drift from the underlying sets (no materialized table — YAGNI until a PR feed exists).
 */
@Service
@RequiredArgsConstructor
public class ExerciseRecordService {

    private static final BigDecimal THIRTY = new BigDecimal("30");

    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseCatalogRepository exerciseCatalogRepository;

    public List<ExerciseRecordResponse> list(UUID createdBy) {
        List<ExerciseSetEntity> sets = exerciseSetRepository.findByCreatedByAndRepsNotNull(createdBy);
        if (sets.isEmpty()) {
            return List.of();
        }
        Map<UUID, ExerciseIdentityRow> exercises =
            exerciseRepository.findIdentityRowsIncludingDeleted(createdBy).stream()
                .collect(Collectors.toMap(ExerciseIdentityRow::getId, r -> r));

        Map<String, List<ExerciseSetEntity>> setsByIdentity = new LinkedHashMap<>();
        Map<String, ExerciseIdentityRow> displayByIdentity = new HashMap<>();
        for (ExerciseSetEntity set : sets) {
            ExerciseIdentityRow row = exercises.get(set.getExerciseId());
            if (row == null) {
                continue;
            }
            String key = row.getCatalogId() != null ? "c:" + row.getCatalogId() : "n:" + row.getName();
            setsByIdentity.computeIfAbsent(key, k -> new ArrayList<>()).add(set);
            // display fields come from the most recent occurrence of the exercise
            displayByIdentity.merge(key, row,
                (a, b) -> a.getCreatedAt().isAfter(b.getCreatedAt()) ? a : b);
        }

        List<UUID> linkedIds = displayByIdentity.values().stream()
            .map(ExerciseIdentityRow::getCatalogId).filter(Objects::nonNull).toList();
        Map<UUID, ExerciseCatalogEntity> catalog = exerciseCatalogRepository.findAllById(linkedIds)
            .stream().collect(Collectors.toMap(ExerciseCatalogEntity::getId, c -> c));

        return setsByIdentity.entrySet().stream()
            .map(e -> toRecord(displayByIdentity.get(e.getKey()), catalog, e.getValue()))
            .sorted(Comparator.comparing(ExerciseRecordResponse::getSessionCount).reversed()
                .thenComparing(ExerciseRecordResponse::getName))
            .toList();
    }

    private ExerciseRecordResponse toRecord(ExerciseIdentityRow display,
        Map<UUID, ExerciseCatalogEntity> catalog, List<ExerciseSetEntity> sets) {
        ExerciseCatalogEntity cat =
            display.getCatalogId() != null ? catalog.get(display.getCatalogId()) : null;
        List<ExerciseSetEntity> weighted =
            sets.stream().filter(s -> s.getWeightKg() != null).toList();

        ExerciseSetEntity bestSet = weighted.stream().max(
            Comparator.comparing(ExerciseSetEntity::getWeightKg)
                .thenComparing(ExerciseSetEntity::getReps)
                .thenComparing(this::setInstant)).orElse(null);
        ExerciseSetEntity bestE1rmSet = weighted.stream().max(
            Comparator.comparing(this::epley).thenComparing(this::setInstant)).orElse(null);

        // session = workout instance; legacy sets without instance group by exercise row
        Map<UUID, List<ExerciseSetEntity>> bySession = sets.stream().collect(Collectors.groupingBy(
            s -> s.getWorkoutSessionId() != null ? s.getWorkoutSessionId() : s.getExerciseId(),
            LinkedHashMap::new, Collectors.toList()));

        SessionVolumeRecord bestSessionVolume = bySession.values().stream()
            .map(g -> Map.entry(sessionVolume(g), sessionDate(g)))
            .filter(en -> en.getKey().signum() > 0)
            .max(Map.Entry.comparingByKey())
            .map(en -> SessionVolumeRecord.builder()
                .volumeKg(en.getKey().setScale(0, RoundingMode.HALF_UP))
                .date(en.getValue()).build())
            .orElse(null);

        Map<BigDecimal, ExerciseSetEntity> bestByWeight = new HashMap<>();
        for (ExerciseSetEntity s : weighted) {
            bestByWeight.merge(s.getWeightKg().stripTrailingZeros(), s,
                (a, b) -> b.getReps() > a.getReps()
                    || (b.getReps().equals(a.getReps()) && setInstant(b).isAfter(setInstant(a)))
                    ? b : a);
        }
        List<RecordSetRef> repRecords = bestByWeight.entrySet().stream()
            .sorted(Map.Entry.<BigDecimal, ExerciseSetEntity>comparingByKey().reversed())
            .limit(3).map(en -> toRef(en.getValue())).toList();

        List<RecordSetRef> recentTopSets = bySession.values().stream()
            .map(g -> Map.entry(sessionDate(g), topSet(g)))
            .sorted(Map.Entry.<LocalDate, ExerciseSetEntity>comparingByKey().reversed())
            .limit(5)
            .sorted(Map.Entry.comparingByKey())
            .map(en -> toRef(en.getValue()))
            .toList();

        BigDecimal totalVolume = weighted.stream()
            .map(s -> s.getWeightKg().multiply(BigDecimal.valueOf(s.getReps())))
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(0, RoundingMode.HALF_UP);

        return ExerciseRecordResponse.builder()
            .catalogId(display.getCatalogId())
            .name(cat != null ? cat.getName() : display.getName())
            .muscle(cat != null ? cat.getMuscle() : display.getMuscle())
            .type(ExerciseRecordResponse.TypeEnum.fromValue(
                cat != null ? cat.getType() : display.getType()))
            .bestSet(bestSet != null ? toRef(bestSet) : null)
            .bestE1rm(bestE1rmSet != null ? E1rmRecord.builder()
                .value(epley(bestE1rmSet).setScale(1, RoundingMode.HALF_UP))
                .set(toRef(bestE1rmSet)).build() : null)
            .bestSessionVolume(bestSessionVolume)
            .totalVolume(totalVolume)
            .totalSets(sets.size())
            .totalReps(sets.stream().mapToInt(ExerciseSetEntity::getReps).sum())
            .sessionCount(bySession.size())
            .repRecords(repRecords)
            .recentTopSets(recentTopSets)
            .build();
    }

    /** Epley estimated 1RM: weight × (1 + reps/30) = weight × (30 + reps) / 30. */
    private BigDecimal epley(ExerciseSetEntity s) {
        return s.getWeightKg().multiply(BigDecimal.valueOf(30L + s.getReps()))
            .divide(THIRTY, 4, RoundingMode.HALF_UP);
    }

    private Instant setInstant(ExerciseSetEntity s) {
        return s.getDoneAt() != null ? s.getDoneAt() : s.getCreatedAt();
    }

    private LocalDate setDate(ExerciseSetEntity s) {
        return setInstant(s).atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private LocalDate sessionDate(List<ExerciseSetEntity> group) {
        return group.stream().map(this::setInstant).max(Comparator.naturalOrder())
            .map(i -> i.atZone(ZoneId.systemDefault()).toLocalDate()).orElseThrow();
    }

    private BigDecimal sessionVolume(List<ExerciseSetEntity> group) {
        return group.stream().filter(s -> s.getWeightKg() != null)
            .map(s -> s.getWeightKg().multiply(BigDecimal.valueOf(s.getReps())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Top set of a session: max weight then reps; bodyweight-only groups fall back to max reps. */
    private ExerciseSetEntity topSet(List<ExerciseSetEntity> group) {
        return group.stream().max(Comparator
            .comparing((ExerciseSetEntity s) ->
                s.getWeightKg() != null ? s.getWeightKg() : BigDecimal.valueOf(-1))
            .thenComparing(ExerciseSetEntity::getReps)
            .thenComparing(this::setInstant)).orElseThrow();
    }

    private RecordSetRef toRef(ExerciseSetEntity s) {
        return RecordSetRef.builder()
            .weightKg(s.getWeightKg()).reps(s.getReps()).date(setDate(s)).build();
    }
}
```

- [ ] **Step 1.10: Run to verify green**

Run: `cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=ExerciseRecordServiceIT`
Expected: 10/10 PASS. (If the native projection fails to convert `created_at` to `Instant`, switch `ExerciseIdentityRow.getCreatedAt()` to `java.sql.Timestamp` and call `.toInstant()` in the service merge.)

- [ ] **Step 1.11: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add api backend/src frontend/src/lib/api.gen.ts && git commit -m "feat(train): exercise-records contract + on-the-fly aggregation service (mezo-wua)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Controller + contract IT (TDD)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/ExerciseRecordContractIT.java`

- [ ] **Step 2.1: Write the failing contract IT** — `ExerciseRecordContractIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseRecordResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** HTTP-level contract for GET /api/train/exercise-records. */
class ExerciseRecordContractIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private ExerciseCatalogRepository catalogRepository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    @Test
    void testGetExerciseRecords_shouldReturn401_whenNoToken() {
        getForBody("/api/train/exercise-records", null, HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void testGetExerciseRecords_shouldReturnEmptyList_whenNothingLogged() {
        List<ExerciseRecordResponse> records = getForList(
            "/api/train/exercise-records", ownerAuthHeaders(), HttpStatus.OK, ExerciseRecordResponse.class);
        assertThat(records).isEmpty();
    }

    @Test
    void testGetExerciseRecords_shouldServeComputedRecords_whenOwnerHasHistory() {
        UUID by = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
        ExerciseCatalogEntity cat = catalogRepository.findBySlug("barbell-bench-press").orElseThrow();
        MesocycleEntity meso = trainPopulator.createMesocycle(by, "Records meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(by, meso.getId(), "Hét", "Push", 0, "planned");
        WorkoutSessionEntity w = trainPopulator.createWorkoutInstance(
            by, template, LocalDate.parse("2026-06-01"), "completed");
        ExerciseEntity ex = trainPopulator.createExercise(by, w.getId(), "Barbell Bench Press", 0,
            "chest", "compound", cat.getId());
        trainPopulator.createLoggedSet(by, ex.getId(), w.getId(), 0, "110", 5, 1,
            Instant.parse("2026-06-01T10:00:00Z"));

        List<ExerciseRecordResponse> records = getForList(
            "/api/train/exercise-records", ownerAuthHeaders(), HttpStatus.OK, ExerciseRecordResponse.class);

        assertThat(records).hasSize(1);
        ExerciseRecordResponse r = records.get(0);
        assertThat(r.getCatalogId()).isEqualTo(cat.getId());
        assertThat(r.getBestSet().getWeightKg()).isEqualByComparingTo("110");
        assertThat(r.getBestE1rm().getValue()).isEqualByComparingTo("128.3");
        assertThat(r.getSessionCount()).isEqualTo(1);
        assertThat(r.getRecentTopSets()).hasSize(1);
    }

    @Test
    void testGetExerciseRecords_shouldIsolateOwners_whenAnotherUserLogged() {
        UUID other = databasePopulator.populateUser("stranger@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(other, "Foreign", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(other, meso.getId(), "Hét", "Push", 0, "planned");
        WorkoutSessionEntity w = trainPopulator.createWorkoutInstance(
            other, template, LocalDate.parse("2026-06-01"), "completed");
        ExerciseEntity ex = trainPopulator.createExercise(other, w.getId(), "Foreign Press", 0);
        trainPopulator.createLoggedSet(other, ex.getId(), w.getId(), 0, "100", 5, 1,
            Instant.parse("2026-06-01T10:00:00Z"));

        List<ExerciseRecordResponse> records = getForList(
            "/api/train/exercise-records", ownerAuthHeaders(), HttpStatus.OK, ExerciseRecordResponse.class);

        assertThat(records).isEmpty();
    }
}
```

- [ ] **Step 2.2: Run to verify red**

Run: `cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=ExerciseRecordContractIT`
Expected: `…shouldServeComputedRecords…` FAILS (stub returns `[]`); 401 + empty-list tests already pass.

- [ ] **Step 2.3: Swap the stub** in `TrainController.java`: add field `private final ExerciseRecordService exerciseRecordService;` (+ import `io.mrkuhne.mezo.feature.train.service.ExerciseRecordService`) and replace the stub body:

```java
    @Override
    public List<ExerciseRecordResponse> getExerciseRecords() {
        return exerciseRecordService.list(currentUserId.get());
    }
```

- [ ] **Step 2.4: Run green + full backend suite both DB modes**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=ExerciseRecordContractIT
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true
```

Expected: 4/4 PASS, then ALL (110 + 14 = 124) PASS in both modes.

- [ ] **Step 2.5: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add backend/src && git commit -m "feat(train): GET /api/train/exercise-records endpoint (mezo-wua)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: FE data layer — API client, hook, MSW (TDD)

**Files:**
- Modify: `frontend/src/lib/trainApi.ts`
- Modify: `frontend/src/test/msw/handlers.ts`
- Modify: `frontend/src/data/trainHooks.ts`
- Test: `frontend/src/data/trainHooks.test.tsx`

- [ ] **Step 3.1: MSW default fixture** — in `handlers.ts`, after the `/api/train/exercises` catalog handler add:

```ts
  // Exercise records fixture — one full weighted record + one bodyweight (plyo) record.
  http.get(`${API_BASE}/api/train/exercise-records`, () =>
    HttpResponse.json([
      {
        catalogId: 'f1e3a0e2-0000-4000-8000-000000000070',
        name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound',
        bestSet: { weightKg: 102.5, reps: 9, date: '2026-06-02' },
        bestE1rm: { value: 133.3, set: { weightKg: 102.5, reps: 9, date: '2026-06-02' } },
        bestSessionVolume: { volumeKg: 4920, date: '2026-05-26' },
        totalVolume: 182450, totalSets: 342, totalReps: 2814, sessionCount: 21,
        repRecords: [
          { weightKg: 102.5, reps: 9, date: '2026-06-02' },
          { weightKg: 100, reps: 9, date: '2026-05-19' },
          { weightKg: 90, reps: 13, date: '2026-04-28' },
        ],
        recentTopSets: [
          { weightKg: 95, reps: 8, date: '2026-05-12' },
          { weightKg: 100, reps: 9, date: '2026-05-19' },
          { weightKg: 100, reps: 8, date: '2026-05-23' },
          { weightKg: 102.5, reps: 8, date: '2026-05-26' },
          { weightKg: 102.5, reps: 9, date: '2026-06-02' },
        ],
      },
      {
        catalogId: 'f1e3a0e2-0000-4000-8000-000000000072',
        name: 'Box Jump', muscle: 'quad', type: 'plyo',
        totalVolume: 0, totalSets: 18, totalReps: 186, sessionCount: 6,
        repRecords: [],
        recentTopSets: [
          { reps: 10, date: '2026-05-26' },
          { reps: 12, date: '2026-06-02' },
        ],
      },
    ]),
  ),
```

- [ ] **Step 3.2: Write the failing hook tests** — append to `trainHooks.test.tsx`:

```ts
test('useTrain (real mode) serves exercise records from the endpoint', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.exerciseRecords.length).toBe(2))
  const row = result.current.exerciseRecords[0]
  expect(row.name).toBe('Chest Supported Row')
  expect(row.bestSet?.weightKg).toBe(102.5)
  expect(row.bestE1rm?.value).toBe(133.3)
  expect(result.current.exerciseRecords[1].bestSet).toBeUndefined() // bodyweight record
})

test('useTrain (mock mode) serves no exercise records (Phase-1 has no set history)', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  expect(result.current.exerciseRecords).toEqual([])
})
```

- [ ] **Step 3.3: Run to verify red**

Run: `cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test -- src/data/trainHooks.test.tsx`
Expected: both new tests FAIL (`exerciseRecords` undefined / type error).

- [ ] **Step 3.4: Implement.**

`trainApi.ts` — add type export + client method:

```ts
export type ExerciseRecordResponse = components['schemas']['ExerciseRecordResponse']
```

```ts
  exerciseRecords: (): Promise<ExerciseRecordResponse[]> =>
    apiFetch<ExerciseRecordResponse[]>('/api/train/exercise-records'),
```

`trainHooks.ts` — import `type ExerciseRecordResponse` from `@/lib/trainApi`; add the query after the `exerciseCatalog` query:

```ts
  // Per-exercise records — computed server-side from logged sets; mock mode has no
  // set history (Phase 1), so it serves an empty list and the view ghost-guards.
  const { data: recordsData } = useQuery({
    queryKey: ['train', 'exerciseRecords'],
    queryFn: mock ? async () => [] as ExerciseRecordResponse[] : () => trainApi.exerciseRecords(),
    initialData: mock ? [] : undefined,
  })
```

Extend the `TrainData` type (after `exerciseLibrary`):

```ts
  exerciseRecords: ExerciseRecordResponse[]
```

and the return object (after the `exerciseLibrary` line):

```ts
    exerciseRecords: recordsData ?? [],
```

- [ ] **Step 3.5: Run green (both modes)**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test -- src/data/trainHooks.test.tsx
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && VITE_USE_MOCK=true pnpm test -- src/data/trainHooks.test.tsx
```

Expected: PASS in both.

- [ ] **Step 3.6: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add frontend/src && git commit -m "feat(train): exerciseRecords query in the train data layer (mezo-wua)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: ExerciseRecordSheet (variant A) (TDD)

**Files:**
- Create: `frontend/src/features/train/components/ExerciseRecordSheet.tsx`
- Test: `frontend/src/features/train/components/ExerciseRecordSheet.test.tsx`

- [ ] **Step 4.1: Write the failing tests** — `ExerciseRecordSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import type { ExerciseRecordResponse } from '@/lib/trainApi'
import { ExerciseRecordSheet } from './ExerciseRecordSheet'

const fullRecord: ExerciseRecordResponse = {
  catalogId: 'f1e3a0e2-0000-4000-8000-000000000070',
  name: 'Chest Supported Row', muscle: 'back-mid', type: 'compound',
  bestSet: { weightKg: 102.5, reps: 9, date: '2026-06-02' },
  bestE1rm: { value: 133.3, set: { weightKg: 102.5, reps: 9, date: '2026-06-02' } },
  bestSessionVolume: { volumeKg: 4920, date: '2026-05-26' },
  totalVolume: 182450, totalSets: 342, totalReps: 2814, sessionCount: 21,
  repRecords: [
    { weightKg: 102.5, reps: 9, date: '2026-06-02' },
    { weightKg: 100, reps: 9, date: '2026-05-19' },
    { weightKg: 90, reps: 13, date: '2026-04-28' },
  ],
  recentTopSets: [
    { weightKg: 95, reps: 8, date: '2026-05-12' },
    { weightKg: 102.5, reps: 9, date: '2026-06-02' },
  ],
}

const bodyweightRecord: ExerciseRecordResponse = {
  name: 'Box Jump', muscle: 'quad', type: 'plyo',
  totalVolume: 0, totalSets: 18, totalReps: 186, sessionCount: 6,
  repRecords: [],
  recentTopSets: [{ reps: 12, date: '2026-06-02' }],
}

test('renders hero best set, stat grid, rep records and recent sets', () => {
  render(<ExerciseRecordSheet record={fullRecord} onClose={() => {}} />)
  expect(screen.getByRole('heading', { name: 'Chest Supported Row' })).toBeInTheDocument()
  expect(screen.getByText('102.5 kg × 9')).toBeInTheDocument()       // hero
  expect(screen.getByText('133.3 kg')).toBeInTheDocument()           // e1RM
  expect(screen.getByText('4 920 kg')).toBeInTheDocument()           // best session volume
  expect(screen.getByText('182,5 t')).toBeInTheDocument()            // total volume >= 10t
  expect(screen.getByText('342 · 2814')).toBeInTheDocument()         // sets · reps
  expect(screen.getByText('13 REP')).toBeInTheDocument()             // rep record row (90 kg)
  expect(screen.getByText('Máj 12')).toBeInTheDocument()             // sparkline date label
})

test('bodyweight record shows rep hero and dashes for weight stats', () => {
  render(<ExerciseRecordSheet record={bodyweightRecord} onClose={() => {}} />)
  expect(screen.getByText('186 rep')).toBeInTheDocument()            // hero = total reps
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)  // e1RM + session volume cells
  expect(screen.queryByText(/REP-REKORD/i)).not.toBeInTheDocument()  // table hidden when empty
})
```

- [ ] **Step 4.2: Run to verify red**

Run: `cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test -- src/features/train/components/ExerciseRecordSheet.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 4.3: Implement** — `ExerciseRecordSheet.tsx` (mockup variant A; house Sheet with render-fn child like `ExercisePickerSheet`):

```tsx
// ============================================================
// Mezo · ExerciseRecordSheet — per-exercise records (mockup variant A):
// hero best set → 2×2 stat grid (e1RM, best session volume, total volume,
// sets·reps) → rep-PR table (top 3 weights) → last-5 sparkline. Bodyweight
// records (no weighted sets) hero the total-rep counter and dash the
// weight-based cells. Pure read view — data comes in as a prop.
// ============================================================
import { useTrain } from '@/data/hooks'
import { MUSCLE_LABELS } from '@/data/train'
import { huMonthDay } from '@/lib/dates'
import type { ExerciseRecordResponse } from '@/lib/trainApi'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'

// 102.5 -> "102.5", 100.0 -> "100"
const num = (n: number) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, '')
// whole-kg volumes get HU thousands grouping; >= 10 t switches to tonnes
const fmtVolume = (kg: number) =>
  kg >= 10000
    ? `${((Math.round(kg / 100) / 10).toFixed(1)).replace('.', ',')} t`
    : `${Math.round(kg).toLocaleString('hu-HU')} kg`

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card notch-4" style={{ padding: 12 }}>
      <span className="eyebrow">{label}</span>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 20, fontWeight: 600, marginTop: 6 }}>
        {value}
      </div>
      {sub && (
        <span className="label-mono text-tertiary" style={{ fontSize: 8, display: 'block', marginTop: 3 }}>
          {sub}
        </span>
      )}
    </div>
  )
}

interface ExerciseRecordSheetProps {
  record: ExerciseRecordResponse
  onClose: () => void
}

export function ExerciseRecordSheet({ record, onClose }: ExerciseRecordSheetProps) {
  // useTrain only for consistency with other sheets is NOT needed here — pure prop view.
  void useTrain
  const r = record
  const maxRecent = Math.max(...r.recentTopSets.map((s) => s.weightKg ?? s.reps), 1)

  return (
    <Sheet onClose={onClose} labelledBy="exercise-record-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <div className="col">
              <span className="eyebrow brand">Rekordok</span>
              <span
                role="heading"
                aria-level={2}
                id="exercise-record-title"
                style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, marginTop: 4, lineHeight: 1.15 }}
              >
                {r.name}
              </span>
              <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 9 }}>
                {[MUSCLE_LABELS[r.muscle] ?? r.muscle, r.type, `${r.sessionCount} alkalom`].join(' · ')}
              </span>
            </div>
            <button className="chip notch-4" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Hero — best set, or the rep counter for bodyweight exercises */}
          <div
            className="card notch-12"
            style={{
              padding: 16, margin: '12px 0',
              background: 'linear-gradient(180deg, rgba(94, 234, 212, 0.07) 0%, var(--surface-1) 100%)',
              borderColor: 'var(--border-brand)',
            }}
          >
            <span className="eyebrow brand">{r.bestSet ? 'Legjobb szett' : 'Összes rep'}</span>
            <div style={{ fontFamily: 'var(--ff-display)', fontSize: 32, fontWeight: 600, margin: '6px 0 2px' }}>
              {r.bestSet ? `${num(r.bestSet.weightKg!)} kg × ${r.bestSet.reps}` : `${r.totalReps} rep`}
            </div>
            <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>
              {r.bestSet ? huMonthDay(r.bestSet.date) : `${r.sessionCount} alkalom alatt`}
            </span>
          </div>

          {/* 2×2 stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <Stat
              label="Becsült 1RM"
              value={r.bestE1rm ? `${num(r.bestE1rm.value)} kg` : '—'}
              sub={r.bestE1rm ? `EPLEY · ${huMonthDay(r.bestE1rm.set.date)}` : undefined}
            />
            <Stat
              label="Legjobb session"
              value={r.bestSessionVolume ? fmtVolume(r.bestSessionVolume.volumeKg) : '—'}
              sub={r.bestSessionVolume ? `VOLUMEN · ${huMonthDay(r.bestSessionVolume.date)}` : undefined}
            />
            <Stat label="Össz-volumen" value={r.totalVolume > 0 ? fmtVolume(r.totalVolume) : '—'} sub="ALL-TIME" />
            <Stat label="Szett · rep" value={`${r.totalSets} · ${r.totalReps}`} sub="ALL-TIME" />
          </div>

          {/* Rep records (weighted exercises only) */}
          {r.repRecords.length > 0 && (
            <>
              <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>
                Rep-rekord · top súlyok
              </span>
              <div className="card notch-4" style={{ marginBottom: 12 }}>
                {r.repRecords.map((rr, i) => (
                  <div
                    key={i}
                    className="row"
                    style={{
                      justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px',
                      borderBottom: i < r.repRecords.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <span className="label-mono" style={{ fontSize: 12 }}>{num(rr.weightKg!)} kg</span>
                    <span className="label-mono" style={{ fontSize: 11, color: 'var(--brand-glow)' }}>{rr.reps} REP</span>
                    <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>{huMonthDay(rr.date)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Last-5 sparkline */}
          {r.recentTopSets.length > 0 && (
            <>
              <span className="eyebrow" style={{ display: 'block' }}>Utolsó {r.recentTopSets.length} alkalom · top szett</span>
              <div className="row" style={{ alignItems: 'flex-end', gap: 6, height: 42, padding: '0 4px', marginTop: 8 }}>
                {r.recentTopSets.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${Math.max(18, Math.round(((s.weightKg ?? s.reps) / maxRecent) * 100))}%`,
                      background: 'color-mix(in srgb, var(--brand-glow) 30%, transparent)',
                      borderTop: '2px solid var(--brand-glow)',
                    }}
                  />
                ))}
              </div>
              <div className="row" style={{ justifyContent: 'space-between', padding: '4px 4px 0' }}>
                {r.recentTopSets.map((s, i) => (
                  <span key={i} className="label-mono text-tertiary" style={{ fontSize: 8 }}>{huMonthDay(s.date)}</span>
                ))}
              </div>
            </>
          )}

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}
```

Remove the `void useTrain` line and its import if the linter flags them — the sheet is a pure prop view (the import exists only if needed; prefer NOT importing `useTrain` at all).

- [ ] **Step 4.4: Run green**

Run: `cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test -- src/features/train/components/ExerciseRecordSheet.test.tsx`
Expected: 2/2 PASS. (If the total-volume assertion fails on formatting, align `fmtVolume` output with the test: `182450 → '182,5 t'`, `4920 → '4 920 kg'` — `toLocaleString('hu-HU')` uses NBSP for thousands; assert with `screen.getByText((t) => t.replace(/ /g, ' ') === '4 920 kg')` if needed.)

- [ ] **Step 4.5: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add frontend/src && git commit -m "feat(train): ExerciseRecordSheet — hero, stat grid, rep records, sparkline (mezo-wua)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Gyakorlatok tab — shared filters, ExercisesView, route (TDD)

**Files:**
- Create: `frontend/src/features/train/muscleFilters.ts`
- Modify: `frontend/src/features/train/components/ExercisePickerSheet.tsx` (import the shared consts)
- Modify: `frontend/src/features/train/tabs.ts`
- Modify: `frontend/src/app/router.tsx`
- Create: `frontend/src/features/train/views/ExercisesView.tsx`
- Test: `frontend/src/features/train/views/ExercisesView.test.tsx`
- Modify: `frontend/src/features/train/TrainSubNav.test.tsx`

- [ ] **Step 5.1: Extract shared filter consts** — create `muscleFilters.ts`:

```ts
// Muscle filter tokens shared by ExercisePickerSheet and ExercisesView — the
// prototype's curated order, 'all' first; 'plyo' is a TYPE filter (vertical-jump
// block), the rest filter by muscle.
export const MUSCLE_FILTERS = ['all', 'plyo', 'back-mid', 'lats', 'chest', 'shoulder', 'biceps', 'triceps', 'quad', 'ham', 'glute', 'calf', 'rear-delt', 'core', 'traps']
export const FILTER_LABELS: Record<string, string> = { all: 'Összes', plyo: 'Plyo' }

export const matchesMuscleFilter = (muscle: string, type: string, filter: string) =>
  filter === 'all' || (filter === 'plyo' ? type === 'plyo' : muscle === filter)
```

In `ExercisePickerSheet.tsx` DELETE the local `MUSCLE_FILTERS` + `FILTER_LABELS` consts (and their comment) and import instead:

```ts
import { MUSCLE_FILTERS, FILTER_LABELS, matchesMuscleFilter } from '../muscleFilters'
```

and simplify its filter predicate to use the helper:

```ts
  const filtered = exerciseLibrary.filter(
    (e) =>
      matchesMuscleFilter(e.muscle, e.type, filter) &&
      (search === '' || e.name.toLowerCase().includes(search.toLowerCase())),
  )
```

Run: `cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test -- src/features/train/components/ExercisePickerSheet.test.tsx`
Expected: 4/4 still PASS (pure refactor).

- [ ] **Step 5.2: Tab + route.**

`tabs.ts` — insert before the mesocycles entry:

```ts
  { id: 'exercises', to: '/train/exercises', label: 'Gyakorlatok' },
```

`router.tsx` — import `ExercisesView` alongside the other train views and add the child route after `sport`:

```tsx
          { path: 'exercises', element: <ExercisesView /> },
```

Update `TrainSubNav.test.tsx` first test:

```ts
test('renders all five sub-nav items with verbatim labels', () => {
  renderAt('/train')
  for (const label of ['Mai', 'GYM', 'Sport', 'Gyakorlatok', 'Mesociklusok']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  }
})
```

- [ ] **Step 5.3: Write the failing view tests** — `ExercisesView.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { ExercisesView } from './ExercisesView'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// Real-mode view: records + catalog come from the MSW fixtures.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => vi.unstubAllEnvs())

const renderView = () =>
  render(<QueryWrapper><MemoryRouter><ExercisesView /></MemoryRouter></QueryWrapper>)

test('default state ranks top exercises with best set and e1RM chip', async () => {
  renderView()
  expect(await screen.findByText('Top gyakorlatok · rekordjaid')).toBeInTheDocument()
  const row = screen.getByRole('button', { name: /Chest Supported Row/ })
  expect(within(row).getByText('01')).toBeInTheDocument()
  expect(within(row).getByText('102.5×9')).toBeInTheDocument()
  expect(within(row).getByText('e1RM 133.3')).toBeInTheDocument()
  // bodyweight record rows surface the rep counter instead
  const plyoRow = screen.getByRole('button', { name: /Box Jump/ })
  expect(within(plyoRow).getByText('186 rep')).toBeInTheDocument()
})

test('search merges record rows with catalog ghost rows', async () => {
  renderView()
  await screen.findByText('Top gyakorlatok · rekordjaid')
  await userEvent.type(screen.getByPlaceholderText('Keresés · pl. bench, squat, row'), 'r')
  expect(screen.getByText('Találatok · teljes katalógus')).toBeInTheDocument()
  // record match still a button; catalog-only match renders as a ghost row
  expect(screen.getByRole('button', { name: /Chest Supported Row/ })).toBeInTheDocument()
  expect(screen.getByText('Lateral Raise')).toBeInTheDocument()
  expect(screen.getByText(/MÉG NINCS REKORD/i)).toBeInTheDocument()
})

test('plyo chip filters records and ghosts by type', async () => {
  renderView()
  await screen.findByText('Top gyakorlatok · rekordjaid')
  await userEvent.click(screen.getByRole('button', { name: 'Plyo' }))
  expect(screen.getByRole('button', { name: /Box Jump/ })).toBeInTheDocument()
  expect(screen.queryByText('Chest Supported Row')).not.toBeInTheDocument()
})

test('tapping a record row opens the record sheet', async () => {
  renderView()
  await screen.findByText('Top gyakorlatok · rekordjaid')
  await userEvent.click(screen.getByRole('button', { name: /Chest Supported Row/ }))
  expect(await screen.findByRole('heading', { name: 'Chest Supported Row' })).toBeInTheDocument()
  expect(screen.getByText('102.5 kg × 9')).toBeInTheDocument()
})

test('empty records show the ghost state while the catalog search stays usable', async () => {
  server.use(
    http.get(`${API_BASE}/api/train/exercise-records`, () => HttpResponse.json([])),
  )
  renderView()
  expect(await screen.findByText(/Az első logolt edzés után itt nőnek a rekordjaid/)).toBeInTheDocument()
  await userEvent.type(screen.getByPlaceholderText('Keresés · pl. bench, squat, row'), 'calf')
  expect(screen.getByText('Standing Calf Raise')).toBeInTheDocument()
})
```

- [ ] **Step 5.4: Run to verify red**

Run: `cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test -- src/features/train/views/ExercisesView.test.tsx src/features/train/TrainSubNav.test.tsx`
Expected: view tests FAIL (module not found); subnav test FAILS (no Gyakorlatok link) until 5.2 applied — apply 5.2 before this run, then only the view tests stay red.

- [ ] **Step 5.5: Implement** — `ExercisesView.tsx`:

```tsx
// ============================================================
// Mezo · ExercisesView (Gyakorlatok) — searchable exercise explorer + records.
// Default state: "Top gyakorlatok" ranked by sessionCount (backend order).
// Active search/filter switches to full-catalog results: record rows first,
// then dashed ghost rows for catalog items without history (STIM meter).
// Tapping a record row opens ExerciseRecordSheet (mockup variant A). Mock mode
// has no set history -> records are empty, the catalog search still works
// over the static library. Mockup-validated (visual companion, mezo-wua).
// ============================================================
import { useState } from 'react'
import { useTrain } from '@/data/hooks'
import { MUSCLE_LABELS } from '@/data/train'
import { MUSCLE_FILTERS, FILTER_LABELS, matchesMuscleFilter } from '../muscleFilters'
import type { ExerciseRecordResponse } from '@/lib/trainApi'
import type { ExerciseLibraryItem } from '@/data/types'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { GhostState } from '@/components/ui/GhostState'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { ExerciseRecordSheet } from '../components/ExerciseRecordSheet'

const num = (n: number) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, '')

function RecordRow({ record, rank, onOpen }: {
  record: ExerciseRecordResponse; rank: number | null; onOpen: () => void
}) {
  const r = record
  return (
    <button className="card notch-4 row" onClick={onOpen}
      style={{ padding: 12, alignItems: 'center', textAlign: 'left', width: '100%' }}>
      {rank != null && (
        <span className="label-mono" style={{ fontSize: 10, color: 'var(--brand-glow)', width: 22, flexShrink: 0 }}>
          {String(rank).padStart(2, '0')}
        </span>
      )}
      <div className="col flex-1">
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{r.name}</span>
        <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 9 }}>
          {(MUSCLE_LABELS[r.muscle] ?? r.muscle).toUpperCase()} · {r.sessionCount} ALKALOM
        </span>
      </div>
      <div className="col" style={{ alignItems: 'flex-end' }}>
        <span className="label-mono" style={{ fontSize: 12, color: 'var(--text-primary)' }}>
          {r.bestSet ? `${num(r.bestSet.weightKg!)}×${r.bestSet.reps}` : `${r.totalReps} rep`}
        </span>
        <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 8 }}>
          {r.bestSet ? 'LEGJOBB SZETT' : 'ÖSSZES REP'}
        </span>
      </div>
      <span className={cn('chip', 'notch-4', r.bestE1rm && 'brand')} style={{ fontSize: 9, marginLeft: 12, flexShrink: 0 }}>
        {r.bestE1rm ? `e1RM ${num(r.bestE1rm.value)}` : r.type.toUpperCase()}
      </span>
    </button>
  )
}

function GhostRow({ item }: { item: ExerciseLibraryItem }) {
  return (
    <div className="row" style={{
      padding: 12, alignItems: 'center', background: 'var(--surface-1)',
      border: '1px dashed var(--border-strong)', opacity: 0.75,
    }}>
      <div className="col flex-1">
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.name}</span>
        <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 9 }}>
          {(MUSCLE_LABELS[item.muscle] ?? item.muscle).toUpperCase()} · MÉG NINCS REKORD
        </span>
      </div>
      <div className="col" style={{ alignItems: 'flex-end' }}>
        <span className="label-mono" style={{ fontSize: 8, color: 'var(--brand-glow)' }}>STIM</span>
        <div className="row gap-xs mt-xs">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} style={{
              width: 4, height: 8,
              background: n / 5 <= item.stim ? 'var(--brand-glow)' : 'var(--surface-2)',
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ExercisesView() {
  const { exerciseRecords, exerciseLibrary } = useTrain()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [openRecord, setOpenRecord] = useState<ExerciseRecordResponse | null>(null)

  const searching = search !== '' || filter !== 'all'
  const q = search.toLowerCase()

  const records = exerciseRecords.filter(
    (r) => matchesMuscleFilter(r.muscle, r.type, filter) && (q === '' || r.name.toLowerCase().includes(q)),
  )
  // catalog items with no record yet (identity match by catalogId, then by name)
  const recordKeys = new Set(
    exerciseRecords.flatMap((r) => [r.catalogId, r.name.toLowerCase()].filter(Boolean) as string[]),
  )
  const ghosts = searching
    ? exerciseLibrary.filter(
        (e) =>
          !recordKeys.has(e.catalogId ?? '') && !recordKeys.has(e.name.toLowerCase()) &&
          matchesMuscleFilter(e.muscle, e.type, filter) &&
          (q === '' || e.name.toLowerCase().includes(q)),
      )
    : []

  return (
    <>
      <div className="page-header">
        <div className="col gap-xs">
          <Eyebrow brand>Train · Gyakorlatok</Eyebrow>
          <PageTitle>Gyakorlatok</PageTitle>
        </div>
      </div>

      <div style={{ padding: '0 24px 8px' }}>
        {/* Search */}
        <div className="card notch-4" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Icon name="search" size={14} color="var(--text-tertiary)" />
          <input
            placeholder="Keresés · pl. bench, squat, row"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, fontSize: 13, padding: '6px 0' }}
          />
        </div>
        {/* Muscle / plyo filter chips */}
        <div className="row gap-xs" style={{ overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 4, paddingBottom: 4 }}>
          {MUSCLE_FILTERS.map((m) => (
            <button
              key={m}
              onClick={() => setFilter(m)}
              aria-pressed={filter === m}
              className={cn('chip', 'notch-4', filter === m && 'brand')}
              style={{ fontSize: 9, padding: '6px 10px', flexShrink: 0 }}
            >
              {FILTER_LABELS[m] ?? MUSCLE_LABELS[m] ?? m}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 24px 32px' }}>
        <div className="row" style={{ justifyContent: 'space-between', margin: '10px 0' }}>
          <span className="eyebrow">{searching ? 'Találatok · teljes katalógus' : 'Top gyakorlatok · rekordjaid'}</span>
          <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>
            {searching ? `${records.length + ghosts.length} / ${exerciseLibrary.length}` : `${exerciseRecords.length} PR`}
          </span>
        </div>

        {!searching && records.length === 0 ? (
          <GhostState lines={3} message="Az első logolt edzés után itt nőnek a rekordjaid — keresni már most tudsz a katalógusban." />
        ) : (
          <div className="col gap-sm">
            {records.map((r, i) => (
              <RecordRow
                key={r.catalogId ?? r.name}
                record={r}
                rank={searching ? null : i + 1}
                onOpen={() => setOpenRecord(r)}
              />
            ))}
            {ghosts.map((g) => (
              <GhostRow key={g.id} item={g} />
            ))}
            {searching && records.length + ghosts.length === 0 && (
              <p className="text-tertiary" style={{ fontSize: 12, textAlign: 'center', padding: 20 }}>
                Nincs találat ezzel a szűrővel.
              </p>
            )}
          </div>
        )}
      </div>

      {openRecord && <ExerciseRecordSheet record={openRecord} onClose={() => setOpenRecord(null)} />}
    </>
  )
}
```

- [ ] **Step 5.6: Run green (both modes)**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test -- src/features/train/views/ExercisesView.test.tsx src/features/train/TrainSubNav.test.tsx src/features/train/train.nav.test.tsx src/features/train/components/ExercisePickerSheet.test.tsx
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && VITE_USE_MOCK=true pnpm test -- src/features/train/views/ExercisesView.test.tsx src/features/train/TrainSubNav.test.tsx src/features/train/train.nav.test.tsx
```

Expected: ALL PASS. The ExercisesView tests pin real mode explicitly, so they are green in both runs; if `train.nav.test.tsx` enumerates tabs, update its expectations the same way as TrainSubNav.test.

- [ ] **Step 5.7: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add frontend/src && git commit -m "feat(train): Gyakorlatok tab — top records list + catalog ghost search (mezo-wua)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Full gates

- [ ] **Step 6.1: Backend both DB modes**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true
```

Expected: ALL PASS (124).

- [ ] **Step 6.2: Frontend both modes + build + parity**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && VITE_USE_MOCK=true pnpm test
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm build
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm parity
```

Expected: ALL PASS (~332 FE tests), build clean, parity 45/45 (capture-only — the 5th tab appears on train shots; that is the documented, accepted change).

- [ ] **Step 6.3: Sweep beads ledger churn** — `git status --short`; commit `.beads` reorder noise with `chore(beads): sync issue ledger` until clean.

---

### Task 7: Live smoke + finish

- [ ] **Step 7.1: Start the stack** (background): compose up; `./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata` (:8090); `pnpm dev` (:5180).
- [ ] **Step 7.2: Browser smoke** (chrome-devtools MCP, clicks via `evaluate_script` textContent, screenshots to repo `.smoke/`):
  1. Train → Gyakorlatok tab → empty state ghost + working catalog search ('press' → ghost rows).
  2. Create a meso (wizard, aktiválás most) → start today's workout (`/train/session`) → log 2-3 sets with weights → finish.
  3. Back to Gyakorlatok → the exercise appears in the top list with best set + e1RM → tap → sheet shows hero/stats/recent → cross-check e1RM by hand (weight×(1+reps/30)).
  4. DB check: `docker exec backend-postgres-1 psql -U mezo -d mezo -c "SELECT count(*) FROM exercise_set WHERE reps IS NOT NULL"`.
  5. Hard reload → records persist.
- [ ] **Step 7.3: Cleanup** — truncate smoke Train rows (keep `exercise_catalog`), TaskStop dev servers, `rm -rf .smoke`:

```bash
docker exec backend-postgres-1 psql -U mezo -d mezo -c "TRUNCATE TABLE exercise_feedback, exercise_set, exercise, workout_session, muscle_group_volume_log, mesocycle CASCADE"
```

- [ ] **Step 7.4: Spec as-built note** — append an "As built" section to `docs/superpowers/specs/2026-06-12-exercise-records-design.md` with anything that shifted during implementation (at minimum: native identity query rationale — soft-deleted template rows keep history; shared `muscleFilters.ts` extraction).
- [ ] **Step 7.5: Merge + push + close** (pull --rebase BEFORE the merge ONLY — the post-merge sync must not rebase, see bd memory `session-zaras-git-csapda…`):

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git checkout main && git pull --rebase
git merge --no-ff feat/exercise-records -m "feat(train): exercise records — Gyakorlatok tab, on-the-fly PR aggregation, record sheet (mezo-wua)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git branch -d feat/exercise-records
bd close mezo-wua --reason="Exercise records shipped: GET /api/train/exercise-records aggregation (best set, Epley e1RM, volumes, counters, rep records, recent top sets; catalog_id identity incl. soft-deleted templates), Gyakorlatok tab with top list + catalog ghost search, record sheet variant A; all gates green"
bd dolt push && git push
git status   # MUST be "up to date with origin"
```

---

## Self-review notes

- **Spec coverage:** §1 semantics → Task 1 service + ServiceIT (identity incl. soft-deleted rows, eligibility, every metric row of the spec table has a test); §2 endpoint → Tasks 1–2 (contract schemas, sorting, rounding); §3 FE → Tasks 3–5 (tab both modes, top list ranking, ghost search, sheet variant A, GhostState copy, shared muscleFilters); §4 testing → ITs in Tasks 1–2, FE tests in Tasks 3–5, gates Task 6.
- **Type consistency:** `ExerciseRecordResponse`/`RecordSetRef`/`E1rmRecord`/`SessionVolumeRecord` names used identically in contract, service, ITs, trainApi, view and sheet; `exerciseRecords` field name consistent across hook/type/tests; `matchesMuscleFilter(muscle, type, filter)` signature identical at both call sites.
- **Known risks called out in-line:** native projection `Instant` conversion (Step 1.10 fallback), HU thousands NBSP in volume formatting (Step 4.4 note), `train.nav.test.tsx` tab enumeration (Step 5.6 note).
