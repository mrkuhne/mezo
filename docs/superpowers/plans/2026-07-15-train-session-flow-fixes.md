# Train Session Flow Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the four approved Train session fixes (spec `docs/superpowers/specs/2026-07-15-train-session-flow-fixes-design.md`, bd `mezo-cd8s`): logged-set RIR display, free exercise navigation, explicit finish with a summary screen, and done-day review with weekly gating.

**Architecture:** Backend first (done-semantics switch → stale auto-close → detail endpoint → challenge guard), then frontend (pure session-model rework → navigation UI → summary screen → data hooks → review route → gating). One branch, one PR; each task is independently green.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven, PostgreSQL 16 (compose on :15432), OpenAPI contract-first codegen, React 19 + Vite + TanStack Query + Vitest.

## Global Constraints

- Branch: `feat/train-session-flow-fixes`. Conventional commit subjects carry the bd id, e.g. `feat(api): ... (mezo-cd8s)`.
- **Read before coding** (house standards, non-negotiable): `docs/references/frontend_conventions.md` before any `frontend/src` change; `docs/references/api_contract_conventions.md` before any `api/feature/*.yml` change; `docs/references/spring_patterns.md`, `error_handling.md`, `testing_standards.md`, `integration_test_framework.md` before backend code/tests.
- Contract-first: edit `api/feature/train/train.yml` (or `proactive.yml`) BEFORE code, then `cd api/generate && npm run generate:api` and `cd frontend && pnpm generate:api`. Backend Java types regenerate during `./mvnw` builds.
- Backend tests locally are **focused only** (16 GB box; full suite OOMs — CI runs it): `cd backend && docker compose up -d && ./mvnw clean test -Dtest=<ITClass>`. ALWAYS `clean`.
- Frontend gates per FE task: `cd frontend && pnpm test <changed test files>` in **both** modes (`VITE_USE_MOCK=true pnpm test <files>` too); full `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` in Task 12.
- Test naming: backend `test{Method}_should{Result}_when{Condition}`, AssertJ only, no mocks/H2 in ITs (extend `ApiIntegrationTest`, data via `*Populator`). FE tests colocated.
- No new frontend dependencies (swipe = pointer events). UI copy Hungarian; code/comments/commits English.
- No DDL, no Liquibase changes anywhere in this plan.
- Imports: deep + absolute `@/*`; the only FE barrel is `src/data/hooks.ts`.

---

### Task 1: Done-semantics switch — `completed` status is the only "done" (backend)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/WorkoutSessionRepository.java:40-67`
- Modify: `api/feature/train/train.yml:461` (listWorkouts summary) and `:1460-1469` (weekDoneDates description) — description-only, no schema change
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutDoneSemanticsIT.java` (new)
- Possibly modify: existing ITs that create "done" fixtures via logged sets on `active` instances (found by grep in Step 5)

**Interfaces:**
- Consumes: `TrainPopulator.createWorkoutInstance(UUID createdBy, WorkoutSessionEntity template, LocalDate date, String status)`, `TrainPopulator.createLoggedSet(UUID, UUID exerciseId, UUID workoutSessionId, int setIndex, String weightKg, int reps, int rir)`, `TrainPopulator.createActiveMeso`, `createTemplateDay`, `createExercise`.
- Produces: `findDoneInstanceDates` / `findDoneInstancesBetween` now mean `status = 'completed'` (all downstream consumers — QuestEvaluator, TrainingCommitmentCalculator, Insights listWorkouts, companion tools — inherit the new meaning with no signature change).

- [ ] **Step 1: Create the branch**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git checkout -b feat/train-session-flow-fixes
```

- [ ] **Step 2: Write the failing IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutDoneSemanticsIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Done = explicitly completed (spec 2026-07-15): ≥1-set active instances no longer count. */
class WorkoutDoneSemanticsIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private WorkoutSessionRepository workoutSessionRepository;

    private record Fixture(UUID owner, WorkoutSessionEntity template, ExerciseEntity exercise) {}

    private Fixture fixture() {
        UUID owner = databasePopulator.populateUser("done-semantics@test.hu");
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Hét");
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        return new Fixture(owner, template, exercise);
    }

    @Test
    void testFindDoneInstanceDates_shouldExcludeInstance_whenActiveWithLoggedSet() {
        Fixture f = fixture();
        WorkoutSessionEntity active = trainPopulator.createWorkoutInstance(
            f.owner(), f.template(), LocalDate.now(), "active");
        trainPopulator.createLoggedSet(f.owner(), f.exercise().getId(), active.getId(), 0, "80", 8, 1);

        assertThat(workoutSessionRepository.findDoneInstanceDates(
            f.owner(), LocalDate.now().minusDays(6), LocalDate.now())).isEmpty();
    }

    @Test
    void testFindDoneInstanceDates_shouldIncludeInstance_whenCompleted() {
        Fixture f = fixture();
        trainPopulator.createWorkoutInstance(f.owner(), f.template(), LocalDate.now(), "completed");

        assertThat(workoutSessionRepository.findDoneInstanceDates(
            f.owner(), LocalDate.now().minusDays(6), LocalDate.now()))
            .containsExactly(LocalDate.now());
    }

    @Test
    void testFindDoneInstancesBetween_shouldReturnOnlyCompleted_whenMixedStatuses() {
        Fixture f = fixture();
        WorkoutSessionEntity active = trainPopulator.createWorkoutInstance(
            f.owner(), f.template(), LocalDate.now().minusDays(1), "active");
        trainPopulator.createLoggedSet(f.owner(), f.exercise().getId(), active.getId(), 0, "80", 8, 1);
        WorkoutSessionEntity completed = trainPopulator.createWorkoutInstance(
            f.owner(), f.template(), LocalDate.now(), "completed");
        trainPopulator.createWorkoutInstance(f.owner(), f.template(), LocalDate.now(), "skipped");

        assertThat(workoutSessionRepository.findDoneInstancesBetween(
            f.owner(), LocalDate.now().minusDays(6), LocalDate.now()))
            .extracting(WorkoutSessionEntity::getId)
            .containsExactly(completed.getId());
    }
}
```

- [ ] **Step 3: Run it to verify it fails**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && docker compose up -d && ./mvnw clean test -Dtest=WorkoutDoneSemanticsIT
```
Expected: FAIL — test 1 finds a date (old ≥1-set semantics), test 3 returns the active instance too.

- [ ] **Step 4: Switch the two JPQL queries to status-based**

In `WorkoutSessionRepository.java` replace both `EXISTS (SELECT 1 FROM ExerciseSetEntity …)` predicates with `AND s.status = 'completed'`, and update both javadoc blocks:

```java
    /**
     * Distinct dates of the owner's gym workout INSTANCES (templateSessionId not null) within
     * [from, to] with status 'completed' — the "gym done that day" signal driving the Mai
     * done-state. Done = EXPLICITLY FINISHED (spec 2026-07-15): a started-but-unclosed
     * instance (any number of logged sets) is NOT done; the lazy auto-close settles stale ones.
     */
    @Query("""
        SELECT DISTINCT s.date FROM WorkoutSessionEntity s
        WHERE s.createdBy = :createdBy
          AND s.templateSessionId IS NOT NULL
          AND s.date BETWEEN :from AND :to
          AND s.status = 'completed'
        """)
    List<LocalDate> findDoneInstanceDates(
        @Param("createdBy") UUID createdBy, @Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * The owner's COMPLETED gym workout instances within [from, to] —
     * {@link #findDoneInstanceDates} returning the entities instead of dates (companion
     * get_recent_workouts + Insights listWorkouts). Same completed-only semantics.
     */
    @Query("""
        SELECT s FROM WorkoutSessionEntity s
        WHERE s.createdBy = :createdBy
          AND s.templateSessionId IS NOT NULL
          AND s.date BETWEEN :from AND :to
          AND s.status = 'completed'
        ORDER BY s.date ASC
        """)
    List<WorkoutSessionEntity> findDoneInstancesBetween(
        @Param("createdBy") UUID createdBy, @Param("from") LocalDate from, @Param("to") LocalDate to);
```

Leave `findInstanceDates` (robustness streak) untouched — it is a different signal, out of scope.

In `api/feature/train/train.yml` update the two prose descriptions (no schema change):
- line 461: `summary: Completed workout instances in the inclusive date range — same "done = explicitly finished" semantics as weekDoneDates`
- lines 1462-1466 (weekDoneDates description): `ISO dates within the current Mon–Sun week that have a COMPLETED gym workout instance (explicit finish). Drives the Mai gym done-state (today) and the weekly-row done chips (past days). Present even on rest days and when today is not a gym day.`

Then regenerate: `cd /Users/daniel.kuhne/MrKuhne/mezo/api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`.

- [ ] **Step 5: Find and fix ITs that encoded the old semantics**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && grep -rln "findDoneInstanceDates\|findDoneInstancesBetween\|weekDoneDates\|WeekDoneDates" src/test/java
```
For every hit, read the fixture: where a test expects "done" from an `active` instance + `createLoggedSet`, either pass `"completed"` to `createWorkoutInstance(...)` or add `instance.setStatus("completed")` + save via the repository. Where a test asserts an active-with-sets instance IS done, flip the expectation (that is exactly the semantics we are changing). Likely files: `WorkoutServiceIT`, `WorkoutContractIT`, quest ITs under `feature/quest`, `feature/train/signal` commitment ITs, companion `TrainTools` ITs, insights weekly ITs.

- [ ] **Step 6: Run the affected suites**

```bash
./mvnw clean test -Dtest='WorkoutDoneSemanticsIT,WorkoutServiceIT,WorkoutContractIT'
# then, per Step 5 grep hits, e.g.:
./mvnw clean test -Dtest='<EveryTestClassTouchedInStep5>'
```
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add -A && git commit -m "feat(api): gym done-state = completed status only, not >=1 logged set (mezo-cd8s)"
```

---

### Task 2: Stale open instances auto-close lazily (backend)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutAutoCloseService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/WorkoutSessionRepository.java` (one derived finder)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java:87-100` (call at the top of `getToday`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutAutoCloseIT.java` (new)

**Interfaces:**
- Produces: `WorkoutAutoCloseService.autoCloseStale(UUID createdBy)` — `@Transactional`, idempotent. After it runs, only today-dated instances can be `active`.
- Produces (repo): `List<WorkoutSessionEntity> findByCreatedByAndStatusAndDateBeforeAndTemplateSessionIdIsNotNull(UUID createdBy, String status, LocalDate date)`.

- [ ] **Step 1: Write the failing IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutAutoCloseIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutAutoCloseService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Lazy settle of abandoned instances: past active + sets -> completed; past empty -> skipped. */
class WorkoutAutoCloseIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private WorkoutSessionRepository workoutSessionRepository;
    @Autowired private WorkoutAutoCloseService workoutAutoCloseService;

    private record Fixture(UUID owner, WorkoutSessionEntity template, ExerciseEntity exercise) {}

    private Fixture fixture() {
        UUID owner = databasePopulator.populateUser("auto-close@test.hu");
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Hét");
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        return new Fixture(owner, template, exercise);
    }

    @Test
    void testAutoCloseStale_shouldComplete_whenPastActiveInstanceHasLoggedSet() {
        Fixture f = fixture();
        WorkoutSessionEntity stale = trainPopulator.createWorkoutInstance(
            f.owner(), f.template(), LocalDate.now().minusDays(1), "active");
        trainPopulator.createLoggedSet(f.owner(), f.exercise().getId(), stale.getId(), 0, "80", 8, 1);

        workoutAutoCloseService.autoCloseStale(f.owner());

        assertThat(workoutSessionRepository.findById(stale.getId()).orElseThrow().getStatus())
            .isEqualTo("completed");
        // the retroactively completed day now counts as done on ITS date
        assertThat(workoutSessionRepository.findDoneInstanceDates(
            f.owner(), LocalDate.now().minusDays(6), LocalDate.now()))
            .containsExactly(LocalDate.now().minusDays(1));
    }

    @Test
    void testAutoCloseStale_shouldSkip_whenPastActiveInstanceHasOnlySkipMarkerOrNothing() {
        Fixture f = fixture();
        WorkoutSessionEntity empty = trainPopulator.createWorkoutInstance(
            f.owner(), f.template(), LocalDate.now().minusDays(2), "active");

        workoutAutoCloseService.autoCloseStale(f.owner());

        assertThat(workoutSessionRepository.findById(empty.getId()).orElseThrow().getStatus())
            .isEqualTo("skipped");
        assertThat(workoutSessionRepository.findDoneInstanceDates(
            f.owner(), LocalDate.now().minusDays(6), LocalDate.now())).isEmpty();
    }

    @Test
    void testAutoCloseStale_shouldLeaveUntouched_whenActiveInstanceIsToday() {
        Fixture f = fixture();
        WorkoutSessionEntity today = trainPopulator.createWorkoutInstance(
            f.owner(), f.template(), LocalDate.now(), "active");

        workoutAutoCloseService.autoCloseStale(f.owner());

        assertThat(workoutSessionRepository.findById(today.getId()).orElseThrow().getStatus())
            .isEqualTo("active");
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=WorkoutAutoCloseIT
```
Expected: FAIL to compile — `WorkoutAutoCloseService` does not exist.

- [ ] **Step 3: Implement the service + finder + getToday call**

Add to `WorkoutSessionRepository.java` (below the existing derived finders):

```java
    /** The owner's ACTIVE instances dated strictly before a day — the lazy auto-close scan set. */
    List<WorkoutSessionEntity> findByCreatedByAndStatusAndDateBeforeAndTemplateSessionIdIsNotNull(
        UUID createdBy, String status, LocalDate date);
```

Create `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutAutoCloseService.java`:

```java
package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lazily settles abandoned workout instances (spec 2026-07-15): an 'active' instance whose
 * calendar day has passed closes as 'completed' when it carries >=1 non-skipped logged set
 * (the work counts — feeds done-dates, lastWeek refs and the prescription engine), else as
 * 'skipped' (a started-but-empty session never counts as done). Invoked from getToday; a
 * SEPARATE bean because getToday is a plain read and a same-class @Transactional
 * self-invocation would bypass the proxy (mirrors ClosingBlockService). Idempotent.
 */
@Service
@RequiredArgsConstructor
public class WorkoutAutoCloseService {

    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseSetRepository exerciseSetRepository;

    @Transactional
    public void autoCloseStale(UUID createdBy) {
        List<WorkoutSessionEntity> stale = workoutSessionRepository
            .findByCreatedByAndStatusAndDateBeforeAndTemplateSessionIdIsNotNull(
                createdBy, "active", LocalDate.now());
        if (stale.isEmpty()) {
            return;
        }
        for (WorkoutSessionEntity instance : stale) {
            boolean hasLoggedSet = exerciseSetRepository
                .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instance.getId())
                .stream().anyMatch(s -> !s.isSkipped());
            instance.setStatus(hasLoggedSet ? "completed" : "skipped");
        }
        workoutSessionRepository.saveAll(stale);
    }
}
```

In `WorkoutService.java`: add `private final WorkoutAutoCloseService workoutAutoCloseService;` to the injected fields, and insert as the FIRST statement of `getToday` (before the `empty` response is built):

```java
    public WorkoutTodayResponse getToday(UUID createdBy) {
        // Settle abandoned instances FIRST (own @Transactional bean — getToday is a read):
        // after this, only a today-dated instance can be 'active', so the open-instance
        // lookup below can never resurrect last week's abandoned session.
        workoutAutoCloseService.autoCloseStale(createdBy);
        WorkoutTodayResponse empty = new WorkoutTodayResponse();
        ...
```

- [ ] **Step 4: Run tests**

```bash
./mvnw clean test -Dtest='WorkoutAutoCloseIT,WorkoutServiceIT,WorkoutContractIT'
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add -A && git commit -m "feat(api): lazily auto-close stale active workout instances (mezo-cd8s)"
```

---

### Task 3: Contract + `completedWorkout` in /today + workout-detail endpoint (backend)

**Files:**
- Modify: `api/feature/train/train.yml` (WorkoutTodayResponse property; new path `/api/train/workouts/{id}`; two new schemas)
- Modify: `backend/.../repository/WorkoutSessionRepository.java` (one derived finder)
- Modify: `backend/.../service/WorkoutService.java` (`getToday` + new `getWorkoutDetail`)
- Modify: `backend/.../controller/TrainController.java` (implement the generated method)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutDetailContractIT.java` (new)

**Interfaces:**
- Produces (wire): `WorkoutTodayResponse.completedWorkout?: WorkoutInstanceResponse`; `GET /api/train/workouts/{id}` → `WorkoutDetailResponse { id, templateSessionId, date, status: active|completed|skipped, title, dayLabel, durationEst?, exercises: WorkoutDetailExercise[] }`, `WorkoutDetailExercise { exerciseId, name, muscle, type, warmupSets, workingSets, repMin, repMax, targetRIR, skipped, sets: ExerciseSetResponse[] }`.
- Produces (repo): `Optional<WorkoutSessionEntity> findFirstByCreatedByAndTemplateSessionIdAndStatusAndDateOrderByCreatedAtDesc(UUID, UUID, String, LocalDate)`.
- Produces (service): `WorkoutDetailResponse getWorkoutDetail(UUID createdBy, UUID workoutId)` — 404 on foreign/missing/template rows (same `OwnershipGuard.notFound()` as the other instance reads).

- [ ] **Step 1: Contract first — edit `api/feature/train/train.yml`**

Under `WorkoutTodayResponse.properties`, after `openWorkout`:

```yaml
        completedWorkout:
          allOf:
            - $ref: '#/components/schemas/WorkoutInstanceResponse'
          description: >-
            Today's most recent COMPLETED instance of today's template day (null when none) —
            drives the Mai hero "Kész + Megnézem" state and the session-route review redirect.
```

New path (insert after the `/api/train/workouts` block, before `/api/train/workouts/{id}/sets`):

```yaml
  /api/train/workouts/{id}:
    get:
      tags: [Train]
      operationId: getWorkoutDetail
      summary: One workout instance with its logged sets joined onto the template day's exercises — the done-day review source
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: The workout detail
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WorkoutDetailResponse'
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '404':
          description: Not found, not owned, or a template row
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
```

New schemas (next to `WorkoutSummaryResponse`):

```yaml
    WorkoutDetailResponse:
      type: object
      required: [id, templateSessionId, date, status, title, dayLabel, exercises]
      properties:
        id: { type: string, format: uuid }
        templateSessionId: { type: string, format: uuid }
        date: { type: string, format: date }
        status: { type: string, enum: [active, completed, skipped] }
        title: { type: string, description: "The day type, e.g. 'Pull Day'" }
        dayLabel: { type: string, description: "'Hét'..'Vas'" }
        durationEst: { type: integer }
        exercises:
          type: array
          items:
            $ref: '#/components/schemas/WorkoutDetailExercise'
    WorkoutDetailExercise:
      type: object
      required: [exerciseId, name, muscle, type, warmupSets, workingSets, repMin, repMax, targetRIR, skipped, sets]
      properties:
        exerciseId: { type: string, format: uuid }
        name: { type: string }
        muscle: { type: string }
        type: { type: string, enum: [compound, isolation, plyo] }
        warmupSets: { type: integer }
        workingSets: { type: integer }
        repMin: { type: integer }
        repMax: { type: integer }
        targetRIR: { type: integer }
        skipped: { type: boolean, description: A skip-marker set exists for this exercise in this instance }
        sets:
          type: array
          description: Non-skipped logged sets, setIndex ascending
          items:
            $ref: '#/components/schemas/ExerciseSetResponse'
```

Regenerate:

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```

- [ ] **Step 2: Write the failing IT**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutDetailContractIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WorkoutDetailResponse;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** HTTP round-trips of GET /api/train/workouts/{id} + WorkoutTodayResponse.completedWorkout. */
class WorkoutDetailContractIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testGetWorkoutDetail_shouldReturn401_whenUnauthenticated() {
        getForBody("/api/train/workouts/" + UUID.randomUUID(), null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testGetWorkoutDetail_shouldReturnSetsAndSkipFlag_whenOwnedInstance() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Hét");
        ExerciseEntity rowEx = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        ExerciseEntity curlEx = trainPopulator.createExercise(owner, template.getId(), "Curl", 1);
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(
            owner, template, LocalDate.now(), "completed");
        trainPopulator.createLoggedSet(owner, rowEx.getId(), instance.getId(), 0, "80", 8, 1);
        trainPopulator.createLoggedSet(owner, rowEx.getId(), instance.getId(), 1, "82.5", 7, 1);

        WorkoutDetailResponse detail = getForBody("/api/train/workouts/" + instance.getId(),
            ownerAuthHeaders(), HttpStatus.OK, WorkoutDetailResponse.class);

        assertThat(detail.getId()).isEqualTo(instance.getId());
        assertThat(detail.getStatus()).isEqualTo(WorkoutDetailResponse.StatusEnum.COMPLETED);
        assertThat(detail.getExercises()).hasSize(2);
        assertThat(detail.getExercises().get(0).getName()).isEqualTo("Row");
        assertThat(detail.getExercises().get(0).getSets()).hasSize(2);
        assertThat(detail.getExercises().get(0).getSets().get(0).getRir()).isEqualTo(1);
        assertThat(detail.getExercises().get(1).getSets()).isEmpty();
        assertThat(detail.getExercises().get(1).getSkipped()).isFalse();
    }

    @Test
    void testGetWorkoutDetail_shouldReturn404_whenTemplateRowOrUnknown() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Hét");

        getForBody("/api/train/workouts/" + template.getId(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        getForBody("/api/train/workouts/" + UUID.randomUUID(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testGetTodayWorkout_shouldCarryCompletedWorkout_whenTodayInstanceCompleted() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createWorkoutSession(
            owner, meso.getId(), WorkoutServiceIT.todayLabel(), "Pull Day", 0, "planned");
        trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        WorkoutSessionEntity done = trainPopulator.createWorkoutInstance(
            owner, template, LocalDate.now(), "completed");

        WorkoutTodayResponse today = getForBody("/api/train/workouts/today",
            ownerAuthHeaders(), HttpStatus.OK, WorkoutTodayResponse.class);

        assertThat(today.getCompletedWorkout()).isNotNull();
        assertThat(today.getCompletedWorkout().getId()).isEqualTo(done.getId());
        assertThat(today.getOpenWorkout()).isNull();
    }
}
```

- [ ] **Step 3: Run it to verify it fails**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=WorkoutDetailContractIT
```
Expected: FAIL to compile (`getCompletedWorkout` missing) until regen ran; after regen, controller abstract-method compile error or 404/500 — the endpoint is unimplemented.

- [ ] **Step 4: Implement repository finder + service + controller**

`WorkoutSessionRepository.java`:

```java
    Optional<WorkoutSessionEntity> findFirstByCreatedByAndTemplateSessionIdAndStatusAndDateOrderByCreatedAtDesc(
        UUID createdBy, UUID templateSessionId, String status, LocalDate date);
```

`WorkoutService.java` — in `getToday`, after the `open` lookup add:

```java
        WorkoutSessionEntity completedToday = workoutSessionRepository
            .findFirstByCreatedByAndTemplateSessionIdAndStatusAndDateOrderByCreatedAtDesc(
                createdBy, day.getId(), "completed", LocalDate.now())
            .orElse(null);
```
and in the builder, after `.openWorkout(...)`:

```java
            .completedWorkout(completedToday != null ? toInstanceResponse(createdBy, completedToday) : null)
```

`WorkoutService.java` — new public read (place next to `listWorkouts`; imports: `io.mrkuhne.mezo.api.dto.WorkoutDetailResponse`, `io.mrkuhne.mezo.api.dto.WorkoutDetailExercise`, `java.util.Comparator`):

```java
    /**
     * One instance joined with its template day's exercises + this instance's logged sets —
     * the done-day review source (spec 2026-07-15). Pure read; owned instance only (404
     * otherwise, template rows included). Skip markers set `skipped` and are excluded from sets.
     */
    public WorkoutDetailResponse getWorkoutDetail(UUID createdBy, UUID workoutId) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        List<ExerciseEntity> exercises = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
                createdBy, List.of(instance.getTemplateSessionId()));
        Map<UUID, List<ExerciseSetEntity>> setsByExercise = exerciseSetRepository
            .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instance.getId()).stream()
            .collect(Collectors.groupingBy(ExerciseSetEntity::getExerciseId));
        return WorkoutDetailResponse.builder()
            .id(instance.getId())
            .templateSessionId(instance.getTemplateSessionId())
            .date(instance.getDate())
            .status(WorkoutDetailResponse.StatusEnum.fromValue(instance.getStatus()))
            .title(instance.getType())
            .dayLabel(instance.getDayLabel())
            .durationEst(instance.getDurationEst())
            .exercises(exercises.stream().map(e -> {
                List<ExerciseSetEntity> all = setsByExercise.getOrDefault(e.getId(), List.of());
                return WorkoutDetailExercise.builder()
                    .exerciseId(e.getId())
                    .name(e.getName())
                    .muscle(e.getMuscle())
                    .type(WorkoutDetailExercise.TypeEnum.fromValue(e.getType()))
                    .warmupSets(e.getWarmupSets())
                    .workingSets(e.getWorkingSets())
                    .repMin(e.getRepMin())
                    .repMax(e.getRepMax())
                    .targetRIR(e.getTargetRir())
                    .skipped(all.stream().anyMatch(ExerciseSetEntity::isSkipped))
                    .sets(all.stream().filter(s -> !s.isSkipped())
                        .sorted(Comparator.comparingInt(ExerciseSetEntity::getSetIndex))
                        .map(mapper::toSetResponse).toList())
                    .build();
            }).toList())
            .build();
    }
```
NOTE: verify the exact entity getter names in `ExerciseEntity.java:49-70` (`getTargetRir` vs `getTargetRIR`) and adjust.

`TrainController.java`:

```java
    @Override
    public WorkoutDetailResponse getWorkoutDetail(UUID id) {
        return workoutService.getWorkoutDetail(currentUserId.get(), id);
    }
```
(+ import `io.mrkuhne.mezo.api.dto.WorkoutDetailResponse`.)

- [ ] **Step 5: Run tests**

```bash
./mvnw clean test -Dtest='WorkoutDetailContractIT,WorkoutContractIT,WorkoutServiceIT'
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add -A && git commit -m "feat(api): workout detail endpoint + completedWorkout in /today (mezo-cd8s)"
```

---

### Task 4: Challenge generation guard + evaluator fix + structured targets (backend, proactive)

**Files:**
- Modify: `api/feature/proactive/proactive.yml:456-485` (ChallengeResponse — 4 additive optional fields)
- Modify: `backend/.../feature/proactive/service/ProactiveChallengeService.java:41-58`
- Modify: `backend/.../feature/proactive/service/ChallengeOutcomeEvaluator.java:66-67`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ChallengeOutcomeIT.java` and `ChallengePersistenceIT.java` (or the IT that exercises `getChallenges` — check both, put the guard test where `getChallenges` is already driven)

**Interfaces:**
- Produces (wire, additive): `ChallengeResponse.targetWeightKg?: number|null`, `targetReps?: integer|null`, `targetSets?: integer|null`, `targetRir?: integer|null` — MapStruct maps by name from `ChallengeEntity`.
- Behavior: `getChallenges` generates nothing for a (templateSessionId, date) whose latest instance is completed; an accepted challenge on a completed instance with zero logged sets resolves `inconclusive` immediately.

- [ ] **Step 1: Contract — add the structured targets to `proactive.yml` ChallengeResponse properties**

```yaml
        targetWeightKg:
          type: number
          nullable: true
          description: Structured target — kg (PR type only); feeds the FE pre-finish outcome preview
        targetReps:
          type: integer
          nullable: true
          description: Structured target — reps (PR type only)
        targetSets:
          type: integer
          nullable: true
          description: Structured target — set count (Volume type only)
        targetRir:
          type: integer
          nullable: true
          description: Structured target — RIR ceiling (Depth type only)
```
Regenerate: `cd /Users/daniel.kuhne/MrKuhne/mezo/api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`.

- [ ] **Step 2: Write the failing ITs**

In `ChallengeOutcomeIT.java` add:

```java
    @Test
    void testEvaluate_shouldResolveInconclusive_whenInstanceCompletedWithNoLoggedSets() {
        // Arrange exactly like this IT's existing accepted-challenge fixtures, but:
        // instance status "completed", date = today, and NO logged sets for the exercise.
        // Act: outcomeEvaluator.evaluate(challenge, LocalDate.now());
        // Assert: status == ChallengeEntity.STATUS_INCONCLUSIVE, outcomeGood == null.
    }
```
(Adapt the fixture helpers already present in that file — it already builds accepted challenges against instances.)

In the IT that drives `ProactiveChallengeService.getChallenges` (grep: `grep -rln "getChallenges" backend/src/test/java/io/mrkuhne/mezo/feature/proactive`) add:

```java
    @Test
    void testGetChallenges_shouldNotGenerate_whenTodayInstanceCompleted() {
        // Arrange: template day + instance(status "completed", date today), NO challenge rows.
        // Act: proactiveChallengeService.getChallenges(userId, templateSessionId, LocalDate.now());
        // Assert: returns empty list AND challengeRepository count for (template, today) == 0
        //         (the lazy generator did NOT run).
    }
```
Also extend one existing wire-level challenge assert with the new structured field (e.g. a PR challenge response carries `targetWeightKg` non-null).

- [ ] **Step 3: Run to verify they fail**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest='ChallengeOutcomeIT,<GetChallengesITClass>'
```
Expected: FAIL — inconclusive test sees status stay `accepted`; guard test sees generated rows.

- [ ] **Step 4: Implement**

`ChallengeOutcomeEvaluator.java` — in `evaluate`, the empty-logged branch currently reads:

```java
        if (logged.isEmpty()) {
            if (!dayPassed) { return false; }                        // today, not logged yet — leave accepted
            c.setStatus(ChallengeEntity.STATUS_INCONCLUSIVE);
```
Delete the `if (!dayPassed) { return false; }` line (this branch is only reachable when `instanceDone || dayPassed` — a completed instance with no logged sets must resolve inconclusive NOW, not wait out the day; spec 2026-07-15) and keep the rest.

`ProactiveChallengeService.java` — inject the train repo and guard the lazy generation:

```java
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
...
    private final WorkoutSessionRepository workoutSessionRepository;
...
        if (rows.isEmpty() && date.equals(LocalDate.now())
                && !instanceCompleted(userId, templateSessionId, date)) {
            rows = generator.generate(userId, templateSessionId, date);   // lazy first proposal
        }
...
    /** A completed instance for the day means the workout is over — never propose new challenges. */
    private boolean instanceCompleted(UUID userId, UUID templateSessionId, LocalDate date) {
        return workoutSessionRepository
            .findFirstByCreatedByAndTemplateSessionIdAndDateOrderByCreatedAtDesc(
                userId, templateSessionId, date)
            .map(w -> "completed".equals(w.getStatus()))
            .orElse(false);
    }
```
(Proactive already reads train repositories — `ChallengeOutcomeEvaluator` does; this stays one-directional.)

MapStruct: the generated `ChallengeResponse` gains the four properties; `ProactiveMapper.toChallengeResponse` maps them by name from `ChallengeEntity` automatically. Verify the entity getters (`getTargetWeightKg()` is `BigDecimal` — if the YAML `number` generates `BigDecimal`, it maps 1:1; if it generates `Double`, add an explicit `@Mapping` with MapStruct's built-in conversion).

- [ ] **Step 5: Run tests**

```bash
./mvnw clean test -Dtest='ChallengeOutcomeIT,ChallengeGeneratorIT,ChallengePersistenceIT,<GetChallengesITClass>'
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add -A && git commit -m "feat(proactive): gate challenge generation on completed day + structured targets on the wire (mezo-cd8s)"
```

---

### Task 5: Logged-set RIR chip in the read-only set list (frontend — user fix 1)

**Files:**
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx:953-957`
- Test: `frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx` (one new test)

**Interfaces:** none (visual only).

- [ ] **Step 1: Write the failing test**

Append to `ActiveWorkoutPage.test.tsx` (uses the existing `setup()` helper; mock-mode default of the file):

```tsx
test('a logged working set shows its RIR chip in the read-only set list', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  // ex1 has 2 warmups first: log 3 sets so ONE working set (index 2) is done.
  await user.click(screen.getByText('Szett kész ✓'))
  await user.click(screen.getByText('Szett kész ✓'))
  // the current (3rd) set is a working set — select RIR 1, then log it
  await user.click(screen.getByRole('button', { name: 'RIR 1' }))
  await user.click(screen.getByText('Szett kész ✓'))
  // read-only list: the DONE working row carries the logged RIR chip
  const rows = container.querySelectorAll('.col.gap-sm .row.gap-sm')
  const doneWorking = Array.from(rows).find((r) => r.textContent?.includes('Working') && r.textContent?.includes('RIR 1'))
  expect(doneWorking).toBeTruthy()
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test src/features/train/pages/ActiveWorkoutPage.test.tsx
```
Expected: the new test FAILS (done rows render only a check icon).

- [ ] **Step 3: Implement**

In the read-only list of `ActiveWorkoutPage.tsx`, replace:

```tsx
                  {isDone ? (
                    <Icon name="check" size={13} color="var(--coral)" />
                  ) : warm ? null : (
                    <span className="chip" style={{ fontSize: 9, padding: '2px 6px' }}>RIR {rr ?? current.targetRIR}</span>
                  )}
```
with:

```tsx
                  {/* Logged working sets show their ACTUAL RIR (user fix 1); warmups log none. */}
                  {isDone ? (
                    <span className="row gap-xs" style={{ alignItems: 'center' }}>
                      {!warm && (
                        <span className="chip" style={{ fontSize: 9, padding: '2px 6px' }}>RIR {rr ?? '–'}</span>
                      )}
                      <Icon name="check" size={13} color="var(--coral)" />
                    </span>
                  ) : warm ? null : (
                    <span className="chip" style={{ fontSize: 9, padding: '2px 6px' }}>RIR {rr ?? current.targetRIR}</span>
                  )}
```

- [ ] **Step 4: Run both modes**

```bash
pnpm test src/features/train/pages/ActiveWorkoutPage.test.tsx && VITE_USE_MOCK=true pnpm test src/features/train/pages/ActiveWorkoutPage.test.tsx
```
Expected: PASS ×2.

- [ ] **Step 5: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add -A && git commit -m "fix(fe): show logged RIR on done sets in the session set list (mezo-cd8s)"
```

---

### Task 6: Free-navigation session model + page wiring (frontend)

**Files:**
- Modify: `frontend/src/features/train/logic/workoutState.ts`
- Modify: `frontend/src/features/train/logic/workoutState.test.ts`
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (replace `session.setIdx` usage with a `viewedId`-derived cursor)
- Test: `frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx` (existing tests must stay green — the default flow is unchanged)

**Interfaces:**
- Produces (model — later tasks use these exact names):
  - `Session` loses the `setIdx` field.
  - `completeSet(s: Session, exerciseId: string, set: LoggedSet): Session` — appends to the GIVEN exercise.
  - `nextSetIdx(s: Session, id: string): number` — `s.logged[id]?.length ?? 0` (the per-exercise cursor).
  - `nextUnfinishedAfter(s: Session, id: string): string | null` — first non-skipped, not-fully-logged exercise strictly after `id` in `s.order`, wrapping around; `null` when none remain.
  - `advance` is DELETED. `currentExerciseId`, `effectiveSetCount`, `prescribedAt`, `addExtraSet`, `skipExercise`, `mergePlan`, `makeSession`, `seedFromOpen` keep their signatures (minus `setIdx` bookkeeping).
- Produces (page): `viewedId: string` React state — the logging target; `setViewedId` is what Task 7's nav UI calls.

- [ ] **Step 1: Rewrite the model tests for the new API**

In `workoutState.test.ts`: update every construction/assert that references `setIdx` (delete those asserts), change `completeSet(s, set)` call sites to `completeSet(s, currentExerciseId(s), set)`, delete `advance` tests, and ADD:

```ts
describe('nextSetIdx', () => {
  it('is the logged count for the exercise', () => {
    let s = makeSession([ex('a', 1, 2), ex('b', 0, 3)])
    expect(nextSetIdx(s, 'a')).toBe(0)
    s = completeSet(s, 'a', { weight: 50, reps: 10, rir: 2 })
    expect(nextSetIdx(s, 'a')).toBe(1)
    expect(nextSetIdx(s, 'b')).toBe(0)
  })
})

describe('completeSet (by exercise id)', () => {
  it('logs into the GIVEN exercise, not the linear cursor', () => {
    let s = makeSession([ex('a', 0, 2), ex('b', 0, 2)])
    s = completeSet(s, 'b', { weight: 40, reps: 12, rir: 1 })
    expect(s.logged['b']).toHaveLength(1)
    expect(s.logged['a']).toBeUndefined()
    expect(currentExerciseId(s)).toBe('a') // linear "first unfinished" is unaffected
  })
})

describe('nextUnfinishedAfter', () => {
  it('finds the next unfinished after the given id, wrapping around', () => {
    let s = makeSession([ex('a', 0, 1), ex('b', 0, 1), ex('c', 0, 1)])
    s = completeSet(s, 'b', { weight: 40, reps: 12, rir: 1 })
    expect(nextUnfinishedAfter(s, 'a')).toBe('c')
    expect(nextUnfinishedAfter(s, 'c')).toBe('a') // wraps
  })
  it('skips skipped exercises and returns null when everything is resolved', () => {
    let s = makeSession([ex('a', 0, 1), ex('b', 0, 1)])
    s = skipExercise(s, 'b')
    expect(nextUnfinishedAfter(s, 'b')).toBe('a')
    s = completeSet(s, 'a', { weight: 40, reps: 12, rir: 1 })
    expect(nextUnfinishedAfter(s, 'a')).toBeNull()
  })
})
```
(`ex(id, warmupSets, workingSets)` — reuse/extend the test file's existing fixture helper for `SessionExerciseInput`; if it has none, add `const ex = (id: string, warmupSets: number, workingSets: number): SessionExerciseInput => ({ id, warmupSets, workingSets, prescribedSets: null })`.)

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test src/features/train/logic/workoutState.test.ts
```
Expected: FAIL — new functions missing, changed signatures.

- [ ] **Step 3: Implement the model**

In `workoutState.ts`:
- Remove `setIdx` from `Session` and from `makeSession`'s return.
- Replace `completeSet`/`advance` with:

```ts
/** Append a completed set to the GIVEN exercise (the on-screen one — free navigation). */
export function completeSet(s: Session, exerciseId: string, set: LoggedSet): Session {
  return { ...s, logged: { ...s.logged, [exerciseId]: [...(s.logged[exerciseId] ?? []), set] } }
}

/** Per-exercise cursor: the next set index to log for an exercise. */
export function nextSetIdx(s: Session, id: string): number {
  return s.logged[id]?.length ?? 0
}

/**
 * The next non-skipped, not-fully-logged exercise STRICTLY AFTER `id` in `order`,
 * wrapping around to the list start; null when every exercise is resolved.
 * Auto-advance target after a debrief/skip.
 */
export function nextUnfinishedAfter(s: Session, id: string): string | null {
  const start = s.order.indexOf(id)
  for (let step = 1; step <= s.order.length; step++) {
    const candidate = s.order[(start + step) % s.order.length]
    if (candidate === id) continue
    if (s.skipped.includes(candidate)) continue
    if ((s.logged[candidate]?.length ?? 0) < effectiveSetCount(s, candidate)) return candidate
  }
  // the given exercise itself may still be unfinished (single-exercise session)
  if (!s.skipped.includes(id) && (s.logged[id]?.length ?? 0) < effectiveSetCount(s, id)) return id
  return null
}
```
- In `seedFromOpen`, drop the final `setIdx` line: `return { ...base, logged, skipped }`.

- [ ] **Step 4: Wire the page onto `viewedId`**

In `ActiveWorkoutPage.tsx` (session component):
- Imports: replace `advance` / old `completeSet as completeSetModel` usage; import `nextSetIdx`, `nextUnfinishedAfter`.
- Add state after `initialSession`: `const [viewedId, setViewedId] = useState<string>(() => currentExerciseId(initialSession))`.
- Replace the derived `current` line with:

```tsx
  // On-screen exercise: the pinned feedback target while debriefing, else the FREELY
  // NAVIGATED viewed exercise (the logging target — spec 2026-07-15 free navigation).
  const current = feedbackEx ?? W.exercises.find((e) => e.id === viewedId) ?? W.exercises[0]
```
- Add `const cursor = nextSetIdx(session, current.id)` right below, then replace EVERY `session.setIdx` read with `cursor` (prefill effect body + its dep array `[current.id, cursor]`, `isWarmupSet`/`currentTarget` lookups, set-dot `cls` ternary, the kind-tag copy, the read-only list's `isDone = i < cursor`).
- `completeSet` handler: `wasSetIdx` becomes `const wasSetIdx = nextSetIdx(session, finishing.id)`; the model call becomes `const next = completeSetModel(session, finishing.id, { weight, reps, rir })`; the rest-start condition keeps `wasSetIdx + 1 >= effectiveSetCount(session, finishing.id)` and the island `next:` ternary uses `wasSetIdx + 1 < currentSetCount ? current.name : (nextEx?.name ?? null)`.
- `advanceAfterFeedback`: replace `setSession(advance(session))` with:

```tsx
    const nextId = feedbackEx ? nextUnfinishedAfter(session, feedbackEx.id) : nextUnfinishedAfter(session, current.id)
    if (nextId) setViewedId(nextId)
```
(the `allDone` branch is unchanged in this task — still `finishAndCelebrate(); setPhase('complete')`; Task 8 rewires it).
- `handleSkip`: after computing `afterSkip`, replace the `advance` else-branch with `const nextId = nextUnfinishedAfter(afterSkip, exId); setSession(afterSkip); if (nextId) setViewedId(nextId)` — and skip the VIEWED exercise: `const exId = current.id` (not `currentExerciseId(session)`).
- `onAddSet` in the sheet: use `current.id` instead of `currentExerciseId(session)` (both the model call and the prompt payload).
- Header exdots: replace the `orderPos` comparison classing with resolved-state classing:

```tsx
          <div className="exdots" aria-hidden="true">
            {W.exercises.map((e) => {
              const resolved = session.skipped.includes(e.id)
                ? 'skp'
                : (session.logged[e.id]?.length ?? 0) >= effectiveSetCount(session, e.id)
                  ? 'don'
                  : undefined
              return <i key={e.id} className={e.id === current.id ? 'cur' : resolved} />
            })}
          </div>
```
(delete the now-unused `orderPos` helper).
- `remaining` (reorder segment) keeps its definition but anchors on the viewed exercise: `const ci = session.order.indexOf(current.id)` (and the same inside `handleReorder`).
- Resume path: `resumeExercise` already uses `currentExerciseId(initialSession)` — unchanged (`viewedId` initializes from the same).

- [ ] **Step 5: Run the model + page tests, both modes**

```bash
pnpm test src/features/train/logic/workoutState.test.ts src/features/train/pages/ActiveWorkoutPage.test.tsx && VITE_USE_MOCK=true pnpm test src/features/train/logic/workoutState.test.ts src/features/train/pages/ActiveWorkoutPage.test.tsx && pnpm build
```
Expected: PASS ×2 + clean build (the default linear flow is behavior-identical).

- [ ] **Step 6: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add -A && git commit -m "refactor(fe): exercise-keyed session cursor — viewed exercise is the logging target (mezo-cd8s)"
```

---

### Task 7: Navigation UI — two-way pager bar, overview sheet, swipe, tappable dots (frontend)

**Files:**
- Create: `frontend/src/features/train/sheets/ExerciseOverviewSheet.tsx`
- Create: `frontend/src/features/train/sheets/ExerciseOverviewSheet.test.tsx`
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (pager bar replaces `.nextex`; header counter opens the sheet; dots tappable; swipe)
- Modify: `frontend/src/styles/prototype.css` (`.pagerbar` styles)
- Test: `frontend/src/features/train/pages/ActiveWorkoutPage.test.tsx`

**Interfaces:**
- Consumes: `viewedId`/`setViewedId`, `nextSetIdx`, `effectiveSetCount` from Task 6.
- Produces: `ExerciseOverviewSheet` props:

```ts
export interface OverviewExercise {
  id: string
  name: string
  state: 'done' | 'progress' | 'todo' | 'skipped'
  done: number
  total: number
}
interface ExerciseOverviewSheetProps {
  exercises: OverviewExercise[]
  currentId: string
  onJump: (id: string) => void
  onClose: () => void
}
```

- [ ] **Step 1: Write the failing tests**

`ExerciseOverviewSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ExerciseOverviewSheet } from '@/features/train/sheets/ExerciseOverviewSheet'

const exercises = [
  { id: 'a', name: 'Bench Press', state: 'done' as const, done: 4, total: 4 },
  { id: 'b', name: 'Chest Row', state: 'progress' as const, done: 2, total: 4 },
  { id: 'c', name: 'Face Pull', state: 'todo' as const, done: 0, total: 3 },
  { id: 'd', name: 'Dead Hang', state: 'skipped' as const, done: 0, total: 2 },
]

describe('ExerciseOverviewSheet', () => {
  it('lists every exercise with its status and jumps on tap', async () => {
    const user = userEvent.setup()
    const onJump = vi.fn()
    render(<ExerciseOverviewSheet exercises={exercises} currentId="b" onJump={onJump} onClose={() => {}} />)
    expect(screen.getByText('Bench Press')).toBeInTheDocument()
    expect(screen.getByText('kihagyva')).toBeInTheDocument()
    expect(screen.getByText('2/4')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Face Pull/ }))
    expect(onJump).toHaveBeenCalledWith('c')
  })
})
```

Append to `ActiveWorkoutPage.test.tsx`:

```tsx
test('the pager bar navigates to the next and previous exercise', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  expect(container.querySelector('.excard h2')).toHaveTextContent('Chest Supported Row')
  await user.click(screen.getByRole('button', { name: /Következő/ }))
  expect(container.querySelector('.excard h2')).not.toHaveTextContent('Chest Supported Row')
  await user.click(screen.getByRole('button', { name: /Előző/ }))
  expect(container.querySelector('.excard h2')).toHaveTextContent('Chest Supported Row')
})

test('the header counter opens the exercise overview and a row jump switches the card', async () => {
  const user = userEvent.setup()
  const { container } = setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByRole('button', { name: 'Gyakorlatlista' }))
  // jump to the LAST exercise from the list (mock plan has 5)
  const rows = screen.getAllByRole('button', { name: /ugrás/i })
  await user.click(rows[rows.length - 1])
  expect(container.querySelector('.excard h2')).not.toHaveTextContent('Chest Supported Row')
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test src/features/train/sheets/ExerciseOverviewSheet.test.tsx src/features/train/pages/ActiveWorkoutPage.test.tsx
```
Expected: FAIL (component missing; page has no pager/list).

- [ ] **Step 3: Implement `ExerciseOverviewSheet`**

```tsx
// ============================================================
// Mezo · ExerciseOverviewSheet — mid-workout exercise overview + jump
// (spec 2026-07-15 free navigation, mockup "B · Áttekintő lista").
// Opens from the wk-top counter; every row shows the exercise's live
// state (✓ kész · ● folyamatban n/m · ○ hátravan · ⊘ kihagyva) and
// tapping a row jumps the execution card to it.
// ============================================================
import { Sheet } from '@/shared/ui/Sheet'
import { Display } from '@/shared/ui/Display'

export interface OverviewExercise {
  id: string
  name: string
  state: 'done' | 'progress' | 'todo' | 'skipped'
  done: number
  total: number
}

const STATE_GLYPH: Record<OverviewExercise['state'], string> = {
  done: '✓', progress: '●', todo: '○', skipped: '⊘',
}

export function ExerciseOverviewSheet({
  exercises,
  currentId,
  onJump,
  onClose,
}: {
  exercises: OverviewExercise[]
  currentId: string
  onJump: (id: string) => void
  onClose: () => void
}) {
  return (
    <Sheet onClose={onClose} labelledBy="exercise-overview-title">
      {(close) => (
        <>
          <div className="col" style={{ marginBottom: 14 }}>
            <span className="eyebrow" style={{ color: 'var(--coral-deep)' }}>Gyakorlatsor · tap = ugrás</span>
            <div id="exercise-overview-title" style={{ marginTop: 6 }}>
              <Display size="md">Hol tartasz</Display>
            </div>
          </div>
          <div className="col gap-sm">
            {exercises.map((e) => (
              <button
                key={e.id}
                type="button"
                aria-label={`${e.name} · ugrás`}
                onClick={() => { onJump(e.id); close() }}
                className="card notch-4 row gap-sm"
                style={{
                  padding: '11px 12px', alignItems: 'center', width: '100%', textAlign: 'left',
                  background: e.id === currentId ? 'color-mix(in srgb, var(--coral) 6%, transparent)' : 'var(--surface-1)',
                  borderColor: e.id === currentId ? 'var(--border-brand)' : 'var(--border-subtle)',
                }}
              >
                <span
                  className="label-mono"
                  style={{
                    width: 22, height: 22, borderRadius: '50%', display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 11, flex: 'none',
                    color: e.state === 'done' || e.state === 'progress' ? 'var(--coral)' : 'var(--text-tertiary)',
                    background: e.state === 'progress' ? 'color-mix(in srgb, var(--coral) 14%, transparent)' : 'var(--surface-2)',
                    border: e.state === 'skipped' ? '1.5px dashed var(--border-subtle)' : 'none',
                  }}
                >
                  {STATE_GLYPH[e.state]}
                </span>
                <span
                  style={{
                    flex: 1, fontSize: 13,
                    color: e.state === 'skipped' ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    textDecoration: e.state === 'skipped' ? 'line-through' : 'none',
                  }}
                >
                  {e.name}
                </span>
                <span className="label-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  {e.state === 'skipped' ? 'kihagyva' : `${e.done}/${e.total}`}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 4: Implement pager bar + counter button + tappable dots + swipe in `ActiveWorkoutPage.tsx`**

State + derivations (active phase):

```tsx
  const [overviewOpen, setOverviewOpen] = useState(false)
  // Two-way pager: plain order-neighbours of the viewed exercise (not skipping done ones —
  // browsing is free; mockup "B · pager-sáv"). Ends disable at the list edges.
  const viewedPos = session.order.indexOf(current.id)
  const prevEx = viewedPos > 0 ? W.exercises.find((e) => e.id === session.order[viewedPos - 1]) ?? null : null
  const nextEx = viewedPos < session.order.length - 1 ? W.exercises.find((e) => e.id === session.order[viewedPos + 1]) ?? null : null
  const overviewRows: OverviewExercise[] = session.order.map((id) => {
    const e = W.exercises.find((x) => x.id === id)!
    const done = session.logged[id]?.length ?? 0
    const total = effectiveSetCount(session, id)
    const state = session.skipped.includes(id) ? 'skipped' as const
      : done >= total ? 'done' as const
      : done > 0 ? 'progress' as const
      : 'todo' as const
    return { id, name: e.name, state, done, total }
  })
```
(NOTE: Task 6's `nextEx` derivation from `remaining[0]` is REPLACED by the pager `nextEx` above; delete the old one.)

Swipe on the card — pointer-event pair on the `.excard` div (no dependency; ignores taps on buttons because only large horizontal drags fire):

```tsx
  const swipeStart = useRef<number | null>(null)
  const jumpTo = (id: string | undefined | null) => { if (id && !feedbackEx) setViewedId(id) }
  // on the .excard element:
  onPointerDown={(e) => { swipeStart.current = e.clientX }}
  onPointerUp={(e) => {
    if (swipeStart.current == null) return
    const dx = e.clientX - swipeStart.current
    swipeStart.current = null
    if (dx <= -60) jumpTo(nextEx?.id)
    else if (dx >= 60) jumpTo(prevEx?.id)
  }}
```
(`import { useRef } from 'react'` alongside the existing react imports.)

Header — make the counter a button and the dots tappable:

```tsx
          <button type="button" className="tt" aria-label="Gyakorlatlista" onClick={() => setOverviewOpen(true)} style={{ textAlign: 'left' }}>
            <div className="t1">{W.title}</div>
            <div className="t2">▾ {currentIdx + 1}/{W.exercises.length} gyakorlat · {doneSets}/{totalSets} szett</div>
          </button>
          <div className="exdots">
            {W.exercises.map((e) => {
              const resolved = session.skipped.includes(e.id) ? 'skp'
                : (session.logged[e.id]?.length ?? 0) >= effectiveSetCount(session, e.id) ? 'don' : undefined
              return (
                <button key={e.id} type="button" aria-label={`Ugrás: ${e.name}`} onClick={() => jumpTo(e.id)} style={{ padding: 2, lineHeight: 0 }}>
                  <i className={e.id === current.id ? 'cur' : resolved} />
                </button>
              )
            })}
          </div>
```
(remove `aria-hidden` from the dots container.)

Replace the `.nextex` block with the two-way pager bar:

```tsx
        {/* Two-way pager bar (mockup B) — big tap targets, neighbour name + live n/m. */}
        <div className="pagerbar">
          <button type="button" className="pg" disabled={!prevEx} aria-label={prevEx ? `Előző: ${prevEx.name}` : 'Előző'} onClick={() => jumpTo(prevEx?.id)}>
            <span className="ar" aria-hidden="true">‹</span>
            <span className="lbl">
              <span className="k">Előző</span>
              <span className="n">{prevEx ? `${prevEx.name} · ${(session.logged[prevEx.id]?.length ?? 0)}/${effectiveSetCount(session, prevEx.id)}` : '—'}</span>
            </span>
          </button>
          <button type="button" className="pg next" disabled={!nextEx} aria-label={nextEx ? `Következő: ${nextEx.name}` : 'Következő'} onClick={() => jumpTo(nextEx?.id)}>
            <span className="lbl">
              <span className="k">Következő</span>
              <span className="n">{nextEx ? `${nextEx.name} · ${(session.logged[nextEx.id]?.length ?? 0)}/${effectiveSetCount(session, nextEx.id)}` : '—'}</span>
            </span>
            <span className="ar" aria-hidden="true">›</span>
          </button>
        </div>
```
Mount the sheet next to the other sheets:

```tsx
      {overviewOpen && (
        <ExerciseOverviewSheet
          exercises={overviewRows}
          currentId={current.id}
          onJump={(id) => setViewedId(id)}
          onClose={() => setOverviewOpen(false)}
        />
      )}
```
(+ `import { ExerciseOverviewSheet, type OverviewExercise } from '@/features/train/sheets/ExerciseOverviewSheet'`.)

`prototype.css` — add next to the existing `.nextex` rules (keep `.nextex` CSS, other screens don't use it — delete it ONLY if grep shows no other consumer):

```css
/* Active workout · two-way pager bar (spec 2026-07-15, mockup B) */
.pagerbar { display: flex; gap: 8px; margin: 10px 24px 6px; }
.pagerbar .pg { flex: 1; display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border-subtle); border-radius: 14px; padding: 10px 12px; min-width: 0; }
.pagerbar .pg:disabled { opacity: .35; }
.pagerbar .pg.next { justify-content: flex-end; text-align: right; }
.pagerbar .ar { color: var(--coral-deep); font-size: 16px; font-weight: 700; flex: none; }
.pagerbar .lbl { display: flex; flex-direction: column; min-width: 0; }
.pagerbar .k { font-size: 8px; letter-spacing: .12em; text-transform: uppercase; color: var(--text-tertiary); font-family: var(--ff-mono); }
.pagerbar .n { font-size: 11px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

- [ ] **Step 5: Run both modes + build**

```bash
pnpm test src/features/train/sheets/ExerciseOverviewSheet.test.tsx src/features/train/pages/ActiveWorkoutPage.test.tsx && VITE_USE_MOCK=true pnpm test src/features/train/sheets/ExerciseOverviewSheet.test.tsx src/features/train/pages/ActiveWorkoutPage.test.tsx && pnpm build
```
Expected: PASS ×2 + build. NOTE: existing tests asserting the old `.nextex` row must be updated to the pager bar (`Következő` still appears — adjust selectors if any fail).

- [ ] **Step 6: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add -A && git commit -m "feat(fe): free exercise navigation — swipe, two-way pager bar, overview sheet, tappable dots (mezo-cd8s)"
```

---

### Task 8: Challenge preview + WorkoutSummary + explicit finish (frontend)

**Files:**
- Create: `frontend/src/features/train/logic/challengeOutcome.ts` + `challengeOutcome.test.ts`
- Create: `frontend/src/features/train/components/WorkoutSummary.tsx` + `WorkoutSummary.test.tsx`
- Modify: `frontend/src/data/types.ts` (Challenge structured targets), `frontend/src/data/train/challengeApi.ts` (map them)
- Modify: `frontend/src/features/train/sheets/ExerciseActionSheet.tsx` (+ finish row)
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (phase `'summary'`, finish CTA drives `finishWorkout`)
- Delete: `frontend/src/features/train/components/WorkoutComplete.tsx` + `WorkoutComplete.test.tsx`
- Test: `ActiveWorkoutPage.test.tsx` flow updates

**Interfaces:**
- Consumes: Task 4's wire fields (`targetWeightKg`, `targetReps`, `targetSets`, `targetRir` on ChallengeWire), Task 6's model.
- Produces:

```ts
// logic/challengeOutcome.ts
export type ChallengePreviewOutcome = 'hit' | 'miss' | 'inconclusive'
export function evaluateChallenge(c: Challenge, logged: LoggedSet[]): ChallengePreviewOutcome

// components/WorkoutSummary.tsx
export interface SummaryExercise { id: string; name: string; plannedSets: number; sets: LastWeekSet[]; skipped: boolean }
export interface SummaryChallenge { id: string; typeLabel: string; exercise?: string; target: string; state: 'hit' | 'miss' | 'skipped' | 'inconclusive'; detail?: string }
export function WorkoutSummary(props: {
  title: string
  eyebrow: string
  mode: 'closing' | 'closed'
  exercises: SummaryExercise[]
  challenges: SummaryChallenge[]
  hadPR?: boolean
  showSetLines?: boolean          // closed/review mode renders per-set lines
  onFinish?: () => void           // closing only — "Edzés lezárása ✓"
  finishPending?: boolean
  onBack?: () => void             // closing only — "← Vissza az edzéshez"
  onExit: () => void              // closed: "Vissza"; also the top-left close
})
```
- Produces: `ExerciseActionSheet` new optional prop `onFinishWorkout?: () => void` → renders the fifth row `Edzés befejezése…`.

- [ ] **Step 1: FE Challenge type + wire mapping**

`data/types.ts` — extend `Challenge` (after `outcomeGood`):

```ts
  // Structured targets (live wire; mock seed may omit) — feed the pre-finish outcome preview.
  targetWeightKg?: number | null
  targetReps?: number | null
  targetSets?: number | null
  targetRir?: number | null
```
`data/train/challengeApi.ts` — in `toChallenge` add:

```ts
    targetWeightKg: w.targetWeightKg ?? null,
    targetReps: w.targetReps ?? null,
    targetSets: w.targetSets ?? null,
    targetRir: w.targetRir ?? null,
```

- [ ] **Step 2: Write the failing preview-logic test**

`logic/challengeOutcome.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { evaluateChallenge } from '@/features/train/logic/challengeOutcome'
import type { Challenge } from '@/data/types'

const base: Challenge = {
  id: 'c1', type: 'PR', typeLabel: 'PR kísérlet', exerciseId: 'e1', target: '85 kg × 8',
  risk: 'low', why: '', refs: [], glory: '', targetWeightKg: 85, targetReps: 8,
}

describe('evaluateChallenge (FE mirror of ChallengeOutcomeEvaluator)', () => {
  it('is inconclusive with no logged sets', () => {
    expect(evaluateChallenge(base, [])).toBe('inconclusive')
  })
  it('PR: any set at/above target weight AND reps hits', () => {
    expect(evaluateChallenge(base, [{ weight: 85, reps: 9, rir: 0 }])).toBe('hit')
    expect(evaluateChallenge(base, [{ weight: 85, reps: 7, rir: 0 }])).toBe('miss')
    expect(evaluateChallenge({ ...base, targetWeightKg: null }, [{ weight: 85, reps: 9, rir: 0 }])).toBe('miss')
  })
  it('Depth: the LAST set at/below target RIR hits', () => {
    const depth: Challenge = { ...base, type: 'Depth', targetRir: 0 }
    expect(evaluateChallenge(depth, [{ weight: 40, reps: 12, rir: 2 }, { weight: 40, reps: 10, rir: 0 }])).toBe('hit')
    expect(evaluateChallenge(depth, [{ weight: 40, reps: 10, rir: 0 }, { weight: 40, reps: 12, rir: 2 }])).toBe('miss')
  })
  it('Volume: logged set count at/above target hits', () => {
    const vol: Challenge = { ...base, type: 'Volume', targetSets: 3 }
    const s = { weight: 40, reps: 12, rir: 2 }
    expect(evaluateChallenge(vol, [s, s, s])).toBe('hit')
    expect(evaluateChallenge(vol, [s, s])).toBe('miss')
  })
})
```

- [ ] **Step 3: Run to verify failure, then implement**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test src/features/train/logic/challengeOutcome.test.ts
```
Expected: FAIL (module missing). Then create `logic/challengeOutcome.ts`:

```ts
// ============================================================
// Mezo · challengeOutcome — FE preview of the backend
// ChallengeOutcomeEvaluator (same rules over session-local sets).
// Authoritative outcomes come from the server AFTER finish; this
// only pre-renders the summary screen before the finish POST.
// ============================================================
import type { Challenge } from '@/data/types'
import type { LoggedSet } from '@/features/train/logic/workoutState'

export type ChallengePreviewOutcome = 'hit' | 'miss' | 'inconclusive'

export function evaluateChallenge(c: Challenge, logged: LoggedSet[]): ChallengePreviewOutcome {
  if (logged.length === 0) return 'inconclusive'
  switch (c.type) {
    case 'PR':
      return logged.some(
        (s) => c.targetWeightKg != null && c.targetReps != null && s.weight >= c.targetWeightKg && s.reps >= c.targetReps,
      ) ? 'hit' : 'miss'
    case 'Depth': {
      const last = logged[logged.length - 1]
      return c.targetRir != null && last.rir <= c.targetRir ? 'hit' : 'miss'
    }
    case 'Volume':
      return c.targetSets != null && logged.length >= c.targetSets ? 'hit' : 'miss'
    default:
      return 'inconclusive'
  }
}
```
Re-run: PASS.

- [ ] **Step 4: Write the WorkoutSummary test, then the component**

`WorkoutSummary.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WorkoutSummary } from '@/features/train/components/WorkoutSummary'

const exercises = [
  { id: 'a', name: 'Bench Press', plannedSets: 4, sets: [{ weight: 80, reps: 8, rir: 1 }], skipped: false },
  { id: 'b', name: 'Dead Hang', plannedSets: 2, sets: [], skipped: true },
]
const challenges = [
  { id: 'c1', typeLabel: 'PR', exercise: 'Bench Press', target: '85 kg × 8', state: 'hit' as const },
  { id: 'c2', typeLabel: 'Depth', exercise: 'Face Pull', target: 'RIR 0', state: 'skipped' as const },
]

describe('WorkoutSummary', () => {
  it('closing mode: stats + challenge outcomes + the finish CTA', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    render(<WorkoutSummary title="Pull Day A" eyebrow="Edzés vége · Pull Day A" mode="closing"
      exercises={exercises} challenges={challenges} onFinish={onFinish} onBack={() => {}} onExit={() => {}} />)
    expect(screen.getByText('Mai mérleg')).toBeInTheDocument()
    expect(screen.getByText('megcsináltad')).toBeInTheDocument()
    expect(screen.getByText('skippelted')).toBeInTheDocument()
    expect(screen.getByText('kihagyva')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Edzés lezárása/ }))
    expect(onFinish).toHaveBeenCalledOnce()
  })
  it('closed mode: no finish CTA, set lines render', () => {
    render(<WorkoutSummary title="Pull Day A" eyebrow="Lezárva · ma" mode="closed" showSetLines
      exercises={exercises} challenges={challenges} onExit={() => {}} />)
    expect(screen.queryByRole('button', { name: /Edzés lezárása/ })).toBeNull()
    expect(screen.getByText(/80.*×.*8.*@RIR 1/)).toBeInTheDocument()
  })
})
```

Create `components/WorkoutSummary.tsx` (replaces `WorkoutComplete` — the demo companion copy + fake ToolChips are deliberately NOT carried over):

```tsx
// ============================================================
// Mezo · WorkoutSummary — the explicit-finish summary / review screen
// (spec 2026-07-15, mockups finish-screen + done-day-review).
// mode 'closing': pre-finish — stats + challenge outcome preview +
//   per-exercise recap + "Edzés lezárása ✓" (the ONLY thing that
//   completes the workout) + "← Vissza az edzéshez".
// mode 'closed': the same layout read-only (post-finish + review route).
// ============================================================
import type { LastWeekSet } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'

export interface SummaryExercise {
  id: string
  name: string
  plannedSets: number
  sets: LastWeekSet[]
  skipped: boolean
}

export interface SummaryChallenge {
  id: string
  typeLabel: string
  exercise?: string
  target: string
  state: 'hit' | 'miss' | 'skipped' | 'inconclusive'
  detail?: string
}

const CHALLENGE_COPY: Record<SummaryChallenge['state'], { glyph: string; label: string; color: string }> = {
  hit: { glyph: '✓', label: 'megcsináltad', color: 'var(--success)' },
  miss: { glyph: '◯', label: 'nem jött össze', color: 'var(--warning)' },
  skipped: { glyph: '⊘', label: 'skippelted', color: 'var(--text-tertiary)' },
  inconclusive: { glyph: '◌', label: 'nem értékelhető', color: 'var(--text-tertiary)' },
}

function Stat({ label, val }: { label: string; val: string }) {
  return (
    <div className="flex-1 card notch-4" style={{ padding: 14, textAlign: 'center', background: 'var(--surface-1)' }}>
      <div className="label-mono" style={{ fontSize: 9 }}>{label}</div>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 26, fontWeight: 600, marginTop: 4, color: 'var(--text-primary)' }}>{val}</div>
    </div>
  )
}

export function WorkoutSummary({
  title, eyebrow, mode, exercises, challenges, hadPR = false, showSetLines = false,
  onFinish, finishPending = false, onBack, onExit,
}: {
  title: string
  eyebrow: string
  mode: 'closing' | 'closed'
  exercises: SummaryExercise[]
  challenges: SummaryChallenge[]
  hadPR?: boolean
  showSetLines?: boolean
  onFinish?: () => void
  finishPending?: boolean
  onBack?: () => void
  onExit: () => void
}) {
  const doneSets = exercises.reduce((a, e) => a + e.sets.length, 0)
  const plannedSets = exercises.reduce((a, e) => a + e.plannedSets, 0)
  const volumeT = exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.weight * s.reps, 0), 0) / 1000
  const doneEx = exercises.filter((e) => e.sets.length > 0).length

  return (
    <div>
      <div style={{ padding: '20px 24px 8px' }}>
        <button className="row gap-sm" onClick={onExit} style={{ marginBottom: 16 }}>
          <Icon name="x" size={16} color="var(--text-secondary)" />
          <span className="eyebrow">{mode === 'closing' ? 'Bezárás' : 'Vissza'}</span>
        </button>
        <span className="eyebrow" style={{ color: 'var(--coral-deep)' }}>{eyebrow}</span>
        <h2 style={{ fontFamily: 'var(--ff-display)', fontSize: 26, fontWeight: 600, marginTop: 6, color: 'var(--text-primary)' }}>
          {title}{hadPR ? ' · PR ✨' : ''}
        </h2>
      </div>

      {/* Mai mérleg */}
      <div style={{ padding: '8px 24px 16px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Mai mérleg</div>
        <div className="row gap-sm">
          <Stat label="Szett" val={`${doneSets}/${plannedSets}`} />
          <Stat label="Volumen" val={`${volumeT.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} t`} />
          <Stat label="Gyakorlat" val={`${doneEx}/${exercises.length}`} />
        </div>
      </div>

      {/* Kihívások */}
      {challenges.length > 0 && (
        <div style={{ padding: '0 24px 16px' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Kihívások</div>
          <div className="col gap-sm">
            {challenges.map((c) => {
              const copy = CHALLENGE_COPY[c.state]
              return (
                <div key={c.id} className="card notch-4 row gap-sm" style={{ padding: 12, alignItems: 'center' }}>
                  <span aria-hidden="true" style={{ color: copy.color, fontSize: 14, width: 20, textAlign: 'center' }}>{copy.glyph}</span>
                  <span className="col flex-1" style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{c.typeLabel}{c.exercise ? ` · ${c.exercise}` : ''}</span>
                    <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>{c.detail ?? c.target}</span>
                  </span>
                  <span className="label-mono" style={{ fontSize: 9, color: copy.color }}>{copy.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Gyakorlatonként */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Gyakorlatonként</div>
        <div className="col gap-sm">
          {exercises.map((e) => {
            const best = e.sets.reduce<LastWeekSet | null>((b, s) => (s.weight > (b?.weight ?? -1) ? s : b), null)
            const abandoned = e.sets.length === 0
            return (
              <div key={e.id} className="card notch-4" style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, color: abandoned ? 'var(--text-tertiary)' : 'var(--text-primary)', flex: 1, paddingRight: 8, textDecoration: abandoned ? 'line-through' : 'none' }}>
                    {e.name}
                  </span>
                  {abandoned ? (
                    <span className="label-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>kihagyva</span>
                  ) : (
                    <span className="row gap-xs" style={{ alignItems: 'baseline' }}>
                      <span className="label-mono" style={{ fontSize: 10, color: 'var(--coral-deep)' }}>{e.sets.length}/{e.plannedSets} szet</span>
                      {e.skipped && <span className="label-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>· kihagyva</span>}
                    </span>
                  )}
                </div>
                {showSetLines && e.sets.length > 0 ? (
                  <div className="label-mono" style={{ fontSize: 10, marginTop: 6, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {e.sets.map((s, i) => `${i + 1}: ${s.weight.toLocaleString('hu-HU')} × ${s.reps} @RIR ${s.rir}`).join(' · ')}
                  </div>
                ) : best ? (
                  <div className="row gap-md mt-sm" style={{ fontFamily: 'var(--ff-mono)', fontSize: 11 }}>
                    <span><span style={{ color: 'var(--text-tertiary)' }}>top</span> <span style={{ color: 'var(--text-primary)' }}>{best.weight.toLocaleString('hu-HU')}kg × {best.reps}</span></span>
                    <span><span style={{ color: 'var(--text-tertiary)' }}>RIR</span> <span style={{ color: 'var(--text-primary)' }}>{best.rir}</span></span>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {/* Note (presentational, as before) + actions */}
      {mode === 'closing' && (
        <div style={{ padding: '0 24px 16px' }}>
          <div className="card notch-12" style={{ padding: 14 }}>
            <span className="label-mono" style={{ fontSize: 9 }}>Edzés-jegyzet · opcionális</span>
            <textarea aria-label="Edzés-jegyzet · opcionális" placeholder='pl. "pumpa brutális volt"'
              style={{ width: '100%', marginTop: 8, minHeight: 52, resize: 'none', fontSize: 13, lineHeight: 1.45 }} />
          </div>
        </div>
      )}
      <div style={{ padding: '0 24px 28px' }}>
        <div className="col gap-sm">
          {mode === 'closing' ? (
            <>
              <button className="cta-primary notch-8" disabled={finishPending} onClick={onFinish}>
                <Icon name="check" size={16} />
                <span>Edzés lezárása ✓</span>
              </button>
              <button type="button" className="cta-ghost notch-4" style={{ padding: 12 }} onClick={onBack}>
                ← Vissza az edzéshez
              </button>
            </>
          ) : (
            <button className="cta-ghost notch-4" style={{ padding: 12 }} onClick={onExit}>
              ← Vissza
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```
Run: `pnpm test src/features/train/components/WorkoutSummary.test.tsx` → PASS.

- [ ] **Step 5: ⋯ sheet finish row**

`ExerciseActionSheet.tsx`: add `onFinishWorkout?: () => void` to the props interface and destructure it; append after the Jegyzet row:

```tsx
              <ActionRow icon="check" label="Edzés befejezése…" onClick={fire(onFinishWorkout)} disabled={!onFinishWorkout} />
```

- [ ] **Step 6: Rewire `ActiveWorkoutPage` to the summary phase**

- `type Phase = 'prep' | 'active' | 'summary' | 'complete'`.
- `advanceAfterFeedback` and `handleSkip`: in their `allDone` branches replace `finishAndCelebrate(); setPhase('complete')` with `setPhase('summary')` (keep `setSession(afterSkip)` in the skip path).
- `finishAndCelebrate` gains the phase flip + challenge refetch (server evaluates lazily on the next list read):

```tsx
  const qc = useQueryClient()   // import { useQueryClient } from '@tanstack/react-query'
  const [finishPending, setFinishPending] = useState(false)
  const finishAndCelebrate = () => {
    setFinishPending(true)
    finishWorkout(workoutId ?? 'mock', {
      onSuccess: (r) => {
        if (r?.levelUp) {
          setHadPrFromSignal(r.levelUp.levelUps.includes('max_strength'))
          showLevelUp(r.levelUp)
        }
        if (!isMock) qc.invalidateQueries({ queryKey: ['challenges', templateSessionId, localToday] })
        setPhase('complete')
        setFinishPending(false)
      },
    })
  }
```
(import `isMockMode` is NOT needed — reuse the existing `isMock` from the challenge hook block.)
- Build the summary rows once (used by both phases; place above the phase returns):

```tsx
  const summaryExercises: SummaryExercise[] = W.exercises.map((e) => ({
    id: e.id,
    name: e.name,
    plannedSets: effectiveSetCount(session, e.id),
    sets: session.logged[e.id] ?? [],
    skipped: session.skipped.includes(e.id),
  }))
  // Challenge rows: dismissed/undecided -> skippelted; accepted -> live server outcome when
  // resolved, else the FE preview over the session's logged sets (pre-finish).
  const summaryChallenges: SummaryChallenge[] = challenges.map((c) => {
    const accepted = acceptedMap[c.id]
    const resolved = c.status === 'hit' || c.status === 'miss' || c.status === 'inconclusive'
    const state = !accepted && !resolved
      ? 'skipped' as const
      : resolved
        ? (c.status as 'hit' | 'miss' | 'inconclusive')
        : evaluateChallenge(c, session.logged[c.exerciseId] ?? [])
    return { id: c.id, typeLabel: c.typeLabel, exercise: c.exercise, target: c.target, state, detail: c.outcome ?? undefined }
  })
```
- Replace the `'complete'` phase block and add the `'summary'` one (delete the `completedByIdx` adapter and the `WorkoutComplete` import):

```tsx
  if (phase === 'summary' || phase === 'complete') {
    const closing = phase === 'summary'
    return (
      <WorkoutSummary
        title={W.title}
        eyebrow={closing ? `Edzés vége · ${W.title}` : 'Lezárva · ma'}
        mode={closing ? 'closing' : 'closed'}
        exercises={summaryExercises}
        challenges={summaryChallenges}
        hadPR={!!showPR || hadPrFromSignal}
        showSetLines={!closing}
        onFinish={finishAndCelebrate}
        finishPending={finishPending}
        onBack={() => setPhase('active')}
        onExit={onExit}
      />
    )
  }
```
(the summary/complete return must come BEFORE the active-phase derivations that use `current` — keep it where the old `complete` block sat; `summaryExercises`/`summaryChallenges` must be computed above it.)
- Wire the sheet: `onFinishWorkout={() => setPhase('summary')}` on `ExerciseActionSheet`; also `clearRest()` when entering summary (add `if (phase === 'summary') clearRest()` to the existing phase-complete effect: `if (phase === 'complete' || phase === 'summary') clearRest()`).
- Imports: `WorkoutSummary, type SummaryChallenge, type SummaryExercise` from `@/features/train/components/WorkoutSummary`; `evaluateChallenge` from `@/features/train/logic/challengeOutcome`.
- Delete `frontend/src/features/train/components/WorkoutComplete.tsx` and `WorkoutComplete.test.tsx` (`git rm`).

- [ ] **Step 7: Update the page flow tests**

In `ActiveWorkoutPage.test.tsx`: the old auto-finish tests (level-up overlay appearing right after the last debrief, `Edzés vége` recap appearing directly) must be updated: after the last exercise's debrief resolves, EXPECT the summary screen (`Mai mérleg` + `Edzés lezárása ✓`), click `Edzés lezárása ✓`, THEN expect the level-up overlay (mock finish returns the seeded fixture) and after its `Tovább` the closed summary. Also add:

```tsx
test('the ⋯ menu offers early finish and it lands on the summary screen', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Edzés befejezése…'))
  expect(screen.getByText('Mai mérleg')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Edzés lezárása/ })).toBeInTheDocument()
})

test('leaving the summary via Vissza az edzéshez resumes the active phase without finishing', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText(/Kezdjük el/))
  await user.click(screen.getByRole('button', { name: 'Gyakorlat műveletek' }))
  await user.click(screen.getByText('Edzés befejezése…'))
  await user.click(screen.getByText('← Vissza az edzéshez'))
  expect(screen.getByText('Szett kész ✓')).toBeInTheDocument()
})
```

- [ ] **Step 8: Run everything touched, both modes + build**

```bash
pnpm test src/features/train && VITE_USE_MOCK=true pnpm test src/features/train && pnpm build
```
Expected: PASS ×2 + build.

- [ ] **Step 9: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add -A && git commit -m "feat(fe): explicit finish — WorkoutSummary screen with challenge outcomes replaces auto-finish (mezo-cd8s)"
```

---

### Task 9: Data layer — completedWorkout, detail + week hooks, mock fixtures (frontend)

**Files:**
- Modify: `frontend/src/data/train/trainApi.ts` (types + `getWorkout`)
- Modify: `frontend/src/data/train/trainHooks.ts` (`completedTodayWorkout`)
- Create: `frontend/src/data/train/workoutDetailHooks.ts`
- Modify: `frontend/src/data/train/train.ts` (append `workoutDetailMock`)
- Modify: `frontend/src/data/hooks.ts` (barrel re-export)
- Test: `frontend/src/data/train/workoutDetailHooks.test.ts` (new)

**Interfaces:**
- Produces:
  - `trainApi.getWorkout(id: string): Promise<WorkoutDetailResponse>`; exported types `WorkoutDetailResponse`, `WorkoutDetailExercise`.
  - `useTrain().completedTodayWorkout: WorkoutInstanceResponse | null` (mock: always `null`).
  - `useWorkoutDetail(id: string | null): { detail: WorkoutDetailResponse | null; pending: boolean; error: boolean }` (mock: returns `workoutDetailMock`).
  - `useWeekWorkouts(): { workouts: WorkoutSummaryResponse[] }` — current Mon–Sun via `trainApi.listWorkouts` (mock: `[]`).

- [ ] **Step 1: trainApi**

```ts
export type WorkoutDetailResponse = components['schemas']['WorkoutDetailResponse']
export type WorkoutDetailExercise = components['schemas']['WorkoutDetailExercise']
...
  getWorkout: (id: string): Promise<WorkoutDetailResponse> =>
    apiFetch<WorkoutDetailResponse>(`/api/train/workouts/${id}`),
```

- [ ] **Step 2: trainHooks — completedTodayWorkout**

`TrainData` gains (after `todaySession`):

```ts
  /** Today's COMPLETED instance of today's template day (real mode) — drives the Kész/Megnézem hero + the session-route review redirect. */
  completedTodayWorkout: WorkoutInstanceResponse | null
```
and the return object (after `todaySession: ...`):

```ts
    completedTodayWorkout: mock ? null : (todayData?.completedWorkout ?? null),
```

- [ ] **Step 3: Mock fixture — append to `frontend/src/data/train/train.ts`**

```ts
// Done-day review fixture (mock mode) — lets /train/review/:id render offline.
export const workoutDetailMock = {
  id: 'wd-mock-1',
  templateSessionId: 'ts-mock-1',
  date: new Date().toISOString().slice(0, 10),
  status: 'completed',
  title: 'Pull Day',
  dayLabel: 'Hét',
  durationEst: 62,
  exercises: [
    {
      exerciseId: 'ex0', name: 'Chest Supported Row', muscle: 'hát', type: 'compound',
      warmupSets: 2, workingSets: 3, repMin: 6, repMax: 9, targetRIR: 1, skipped: false,
      sets: [
        { id: 's1', exerciseId: 'ex0', setIndex: 0, weightKg: 60, reps: 10, kind: 'warmup' },
        { id: 's2', exerciseId: 'ex0', setIndex: 1, weightKg: 80, reps: 8, rir: 2, kind: 'working' },
        { id: 's3', exerciseId: 'ex0', setIndex: 2, weightKg: 85, reps: 8, rir: 1, kind: 'working' },
      ],
    },
    {
      exerciseId: 'ex1', name: 'Lat Pulldown', muscle: 'hát', type: 'compound',
      warmupSets: 1, workingSets: 3, repMin: 8, repMax: 12, targetRIR: 1, skipped: true, sets: [],
    },
  ],
} satisfies import('@/data/train/trainApi').WorkoutDetailResponse
```
(adjust field values to satisfy the generated type exactly — the `satisfies` will flag drift.)

- [ ] **Step 4: workoutDetailHooks + barrel + test**

Create `frontend/src/data/train/workoutDetailHooks.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { localDateString } from '@/shared/lib/dates'
import { trainApi, type WorkoutDetailResponse, type WorkoutSummaryResponse } from '@/data/train/trainApi'
import { workoutDetailMock } from '@/data/train/train'

/** One workout instance for the done-day review screen. Mock serves a static fixture. */
export function useWorkoutDetail(id: string | null) {
  const mock = isMockMode()
  const q = useQuery<WorkoutDetailResponse>({
    queryKey: ['train', 'workoutDetail', id],
    queryFn: mock ? async () => workoutDetailMock : () => trainApi.getWorkout(id as string),
    enabled: mock || !!id,
    initialData: mock ? workoutDetailMock : undefined,
    retry: false,
  })
  return { detail: q.data ?? null, pending: !mock && q.isPending, error: !mock && q.isError }
}

/** This Mon–Sun week's COMPLETED workout summaries — maps weekly-row dates to instance ids. */
export function useWeekWorkouts() {
  const mock = isMockMode()
  const now = new Date()
  const mondayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const monday = localDateString(mondayDate)
  const sunday = localDateString(new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate() + 6))
  const q = useQuery<WorkoutSummaryResponse[]>({
    queryKey: ['train', 'weekWorkouts', monday],
    queryFn: mock ? async () => [] : () => trainApi.listWorkouts(monday, sunday),
    initialData: mock ? [] : undefined,
  })
  return { workouts: q.data ?? [] }
}
```
Barrel (`data/hooks.ts`, next to the other train exports):

```ts
export { useWorkoutDetail, useWeekWorkouts } from '@/data/train/workoutDetailHooks'
```
Test `frontend/src/data/train/workoutDetailHooks.test.ts` (mirror an existing hook test's `QueryWrapper`/msw idiom — e.g. grep `renderHook` under `src/data` for the house pattern):

```ts
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { useWorkoutDetail } from '@/data/train/workoutDetailHooks'
import { workoutDetailMock } from '@/data/train/train'

afterEach(() => vi.unstubAllEnvs())

describe('useWorkoutDetail', () => {
  it('mock mode: serves the static fixture synchronously', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useWorkoutDetail('anything'), { wrapper: QueryWrapper })
    expect(result.current.detail).toEqual(workoutDetailMock)
  })
  it('real mode: fetches the detail by id', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(http.get(`${API_BASE}/api/train/workouts/w1`, () => HttpResponse.json(workoutDetailMock)))
    const { result } = renderHook(() => useWorkoutDetail('w1'), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.detail).not.toBeNull())
    expect(result.current.pending).toBe(false)
  })
})
```

- [ ] **Step 5: Run both modes**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test src/data/train/workoutDetailHooks.test.ts && VITE_USE_MOCK=true pnpm test src/data/train/workoutDetailHooks.test.ts && pnpm build
```
Expected: PASS ×2 + build.

- [ ] **Step 6: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add -A && git commit -m "feat(fe): workout detail + week-summaries hooks, completedTodayWorkout (mezo-cd8s)"
```

---

### Task 10: Review route + WorkoutReviewPage (frontend)

**Files:**
- Create: `frontend/src/features/train/pages/WorkoutReviewPage.tsx`
- Create: `frontend/src/features/train/pages/WorkoutReviewPage.test.tsx`
- Modify: `frontend/src/app/router.tsx:67` (sibling route)

**Interfaces:**
- Consumes: `useWorkoutDetail`, `useChallenges` (`@/data/hooks`), `WorkoutSummary`/`SummaryExercise`/`SummaryChallenge` (Task 8).
- Produces: route `/train/review/:workoutId` (full page, TabBar stays — only `/train/session` hides it).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { WorkoutReviewPage } from '@/features/train/pages/WorkoutReviewPage'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function setup() {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={['/train/review/wd-mock-1']}>
        <Routes>
          <Route path="/train/review/:workoutId" element={<WorkoutReviewPage />} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('renders the closed summary from the workout detail (mock fixture)', () => {
  setup()
  expect(screen.getByText('Pull Day')).toBeInTheDocument()
  expect(screen.getByText('Mai mérleg')).toBeInTheDocument()
  // per-set lines render in review mode, with RIR (user fix 1 shows here too)
  expect(screen.getByText(/85.*×.*8.*@RIR 1/)).toBeInTheDocument()
  // the abandoned exercise is struck "kihagyva"
  expect(screen.getByText('kihagyva')).toBeInTheDocument()
  // no finish CTA in review
  expect(screen.queryByRole('button', { name: /Edzés lezárása/ })).toBeNull()
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && VITE_USE_MOCK=true pnpm test src/features/train/pages/WorkoutReviewPage.test.tsx
```
Expected: FAIL (page missing).

- [ ] **Step 3: Implement the page + route**

`WorkoutReviewPage.tsx`:

```tsx
// ============================================================
// Mezo · WorkoutReviewPage — read-only review of a COMPLETED workout
// (/train/review/:workoutId — spec 2026-07-15 done-day review, option B).
// Data: GET /api/train/workouts/{id} + the day's challenges (server
// outcomes). Renders the shared WorkoutSummary in 'closed' mode.
// ============================================================
import { useNavigate, useParams } from 'react-router-dom'
import { useChallenges, useWorkoutDetail } from '@/data/hooks'
import { huMonthDayDow } from '@/shared/lib/dates'
import { GhostState } from '@/shared/ui/GhostState'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { WorkoutSummary, type SummaryChallenge, type SummaryExercise } from '@/features/train/components/WorkoutSummary'

export function WorkoutReviewPage() {
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const { detail, pending, error } = useWorkoutDetail(workoutId ?? null)
  const { challenges } = useChallenges(detail?.templateSessionId ?? null, detail?.date ?? '')

  if (pending) return <ScreenSkeleton />
  if (error || !detail) {
    return (
      <div style={{ padding: 24 }}>
        <GhostState lines={3} message="Ez az edzés nem található." ctaLabel="← Vissza az edzésekhez" onCta={() => navigate('/train')} />
      </div>
    )
  }

  const exercises: SummaryExercise[] = detail.exercises.map((e) => ({
    id: e.exerciseId,
    name: e.name,
    plannedSets: e.warmupSets + e.workingSets,
    sets: e.sets.map((s) => ({ weight: Number(s.weightKg ?? 0), reps: s.reps ?? 0, rir: s.rir ?? 0 })),
    skipped: e.skipped,
  }))
  // Server-resolved outcomes; anything not accepted/resolved reads as skippelted.
  const challengeRows: SummaryChallenge[] = challenges.map((c) => ({
    id: c.id,
    typeLabel: c.typeLabel,
    exercise: c.exercise,
    target: c.target,
    state: c.status === 'hit' || c.status === 'miss' || c.status === 'inconclusive' ? c.status : 'skipped',
    detail: c.outcome ?? undefined,
  }))

  return (
    <WorkoutSummary
      title={detail.title}
      eyebrow={`Lezárva · ${huMonthDayDow(detail.date)}`}
      mode="closed"
      showSetLines
      exercises={exercises}
      challenges={challengeRows}
      onExit={() => navigate('/train')}
    />
  )
}
```
`router.tsx` — after the `train/session` entry:

```tsx
      { path: 'train/review/:workoutId', element: <WorkoutReviewPage /> },
```
(+ import.)

- [ ] **Step 4: Run both modes + build**

```bash
pnpm test src/features/train/pages/WorkoutReviewPage.test.tsx && VITE_USE_MOCK=true pnpm test src/features/train/pages/WorkoutReviewPage.test.tsx && pnpm build
```
Expected: PASS ×2 + build.

- [ ] **Step 5: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add -A && git commit -m "feat(fe): done-day review route /train/review/:id over the workout detail (mezo-cd8s)"
```

---

### Task 11: Gating — hero three-state, weekly rows, day sheet, session redirect (frontend)

**Files:**
- Modify: `frontend/src/features/train/pages/TrainTodayPage.tsx` (hero states + weekly review taps)
- Modify: `frontend/src/features/train/components/WeeklyDayRow.tsx` (+ `gymInProgress`, `onReviewGym`)
- Modify: `frontend/src/features/train/sheets/GymDaySheet.tsx` + `frontend/src/features/train/pages/GymPage.tsx`
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx:69-93` (guard redirect)
- Test: `TrainTodayPage.test.tsx`, `WeeklyDayRow.test.tsx`, `GymPage.test.tsx`, `ActiveWorkoutPage.test.tsx`

**Interfaces:**
- Consumes: `useTrain().completedTodayWorkout` + `todaySession.openWorkout`, `useWeekWorkouts` (Task 9), route `/train/review/:workoutId` (Task 10).
- Produces: `WeeklyDayRowProps` gains `gymInProgress?: boolean` and `onReviewGym?: () => void`; `GymDaySheet` gains `completedWorkoutId?: string | null`.

- [ ] **Step 1: Write the failing tests**

`TrainTodayPage.test.tsx` — add (mirror the file's existing real-mode msw fixture idiom; extend the `/api/train/workouts/today` handler payload):

```tsx
test('real mode: a completed today instance renders the Kész hero with Megnézem', async () => {
  // handler: workoutToday returns completedWorkout {id: 'w-done', status: 'completed', sets: [...]}
  // and weekDoneDates containing today; openWorkout null.
  // assert: '✓ Kész' chip + 'Megnézem →' button present, 'Indítsuk →' absent.
})

test('real mode: an open instance renders the Folyamatban hero with Folytassuk', async () => {
  // handler: workoutToday returns openWorkout {id: 'w-open', status: 'active', sets: [two logged sets]}.
  // assert: '● Folyamatban' + 'Folytassuk →' present, 'Indítsuk →' absent.
})
```
`WeeklyDayRow.test.tsx` — add:

```tsx
it('a done gym day is tappable and calls onReviewGym (not onStartGym)', async () => {
  // render a NON-today agenda day with gym + gymLogged + onReviewGym spy; click the gym row;
  // expect onReviewGym called, onStartGym not called.
})
it('shows the folyamatban chip when gymInProgress', () => {
  // render today's row with gymInProgress; expect text 'folyamatban'.
})
```
`ActiveWorkoutPage.test.tsx` — add a real-mode test:

```tsx
test('real mode: a completed today instance redirects the session route to the review', async () => {
  // msw: /api/train/workouts/today -> { templateSessionId, exercises: [...], openWorkout: null,
  //       completedWorkout: { id: 'w-done', ... }, weekDoneDates: [today] }
  // render inside <Routes> with a probe element at /train/review/:workoutId
  // assert the probe renders (redirect happened).
})
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test src/features/train/pages/TrainTodayPage.test.tsx src/features/train/components/WeeklyDayRow.test.tsx src/features/train/pages/ActiveWorkoutPage.test.tsx
```
Expected: the new tests FAIL.

- [ ] **Step 3: Implement**

`WeeklyDayRow.tsx` — props + gym branch:

```tsx
  /** Today's gym instance is open (started, unfinished) — shows the folyamatban chip. */
  gymInProgress?: boolean
  /** A completed (non-today or today) gym day was tapped — open its review. */
  onReviewGym?: () => void
```
```tsx
            return (
              <button
                key="gym"
                type="button"
                className="s"
                onClick={gymLogged ? onReviewGym : isToday ? onStartGym : undefined}
              >
                <span className="stag stag-gym">GYM</span>
                {isToday ? <b>{gym.type}</b> : gym.type}
                <span className="meta">{meta}</span>
                {gymLogged && <span className="done-chip">kész</span>}
                {!gymLogged && gymInProgress && isToday && <span className="log-chip stag-gym">folyamatban</span>}
              </button>
            )
```
`TrainTodayPage.tsx`:
- Destructure `todaySession, completedTodayWorkout` from `useTrain()`; add `const { workouts: weekWorkouts } = useWeekWorkouts()` (import from `@/data/hooks`).
- Replace the `loggedGym` hero branch with the three-state render:

```tsx
              {completedTodayWorkout ? (
                <button
                  type="button"
                  onClick={() => navigate(`/train/review/${completedTodayWorkout.id}`)}
                  className="row notch-4 mt-md"
                  style={{
                    width: '100%', justifyContent: 'center', gap: 6, padding: '10px 12px',
                    background: 'rgba(52, 211, 153, 0.08)',
                    border: '1px solid color-mix(in srgb, var(--success) 35%, transparent)',
                    color: 'var(--success)', fontSize: 11, fontFamily: 'var(--ff-mono)',
                  }}
                >
                  <Icon name="check" size={12} />
                  <span>Kész · {completedTodayWorkout.sets.filter((s) => !s.skipped).length} szett — Megnézem →</span>
                </button>
              ) : todaySession?.openWorkout ? (
                <div className="np-ctarow">
                  <button type="button" className="np-cta np-press" onClick={openSession}>
                    Folytassuk → · {todaySession.openWorkout.sets.filter((s) => !s.skipped).length} szett kész
                  </button>
                </div>
              ) : (
                <div className="np-ctarow">
                  <button type="button" className="np-cta np-press" onClick={openSession}>Indítsuk →</button>
                </div>
              )}
```
and the `MA` chip variant for in-progress (in the hero eyebrow row, where applicable — add a `● Folyamatban` chip when `todaySession?.openWorkout && !completedTodayWorkout`).
- Weekly rows: build `const workoutIdByDate = Object.fromEntries(weekWorkouts.filter((w) => w.status === 'completed').map((w) => [w.date, w.id]))` and pass:

```tsx
              gymInProgress={Boolean(a.isToday && todaySession?.openWorkout)}
              onReviewGym={workoutIdByDate[a.date!] ? () => navigate(`/train/review/${workoutIdByDate[a.date!]}`) : undefined}
```
(the `loggedGym` const is no longer needed for the hero — delete it if unused.)

`GymDaySheet.tsx` — new prop + footer branch:

```tsx
interface GymDaySheetProps {
  day: MesoDay
  /** Today's completed instance id (null when none) — flips the start CTA to review. */
  completedWorkoutId?: string | null
  onClose: () => void
}
...
          {canStart && completedWorkoutId ? (
            <CtaPrimary onClick={() => { navigate(`/train/review/${completedWorkoutId}`); close() }}>
              <Icon name="check" size={14} /> Kész · Megnézem →
            </CtaPrimary>
          ) : canStart ? (
            <CtaPrimary onClick={() => { navigate('/train/session'); close() }}>
              <Icon name="train" size={14} /> Indítsuk · most
            </CtaPrimary>
          ) : ( ...view-mode note unchanged... )}
```
`GymPage.tsx`: `const { activeMeso, gymSlots, saveGymSchedule, workoutPending, completedTodayWorkout } = useTrain()` and `<GymDaySheet day={openDay} completedWorkoutId={completedTodayWorkout?.id ?? null} onClose={...} />`.

`ActiveWorkoutPage.tsx` guard (in the outer `ActiveWorkoutPage`, after the pending/null checks):

```tsx
  const { workout, activeMeso, todaySession, completedTodayWorkout, workoutPending, ... } = useTrain()
  ...
  // Completed today + nothing open -> the session is over; review instead of restart
  // (spec 2026-07-15 gating — the prep screen must be unreachable, challenges included).
  if (completedTodayWorkout && !todaySession?.openWorkout) {
    return <Navigate to={`/train/review/${completedTodayWorkout.id}`} replace />
  }
```

- [ ] **Step 4: Run the touched suites, both modes + build**

```bash
pnpm test src/features/train && VITE_USE_MOCK=true pnpm test src/features/train && pnpm build
```
Expected: PASS ×2 + build (mock mode: `completedTodayWorkout` is always null → behavior identical to Phase 1).

- [ ] **Step 5: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add -A && git commit -m "feat(fe): done-day gating — Kész/Folyamatban hero, weekly review taps, session redirect (mezo-cd8s)"
```

---

### Task 12: Docs, full gates, ship

**Files:**
- Modify: `docs/features/train.md` (§2 active workout + Mai; §4 workout-execution endpoints/DTOs + done-semantics; §5 challenge seam row; §9 if it lists auto-finish)
- Modify: `docs/features/proactive.md` (generation guard + evaluator zero-set fix + ChallengeResponse structured targets)
- Modify: `docs/features/insights.md` (weekly "done" counts now mean completed)
- Verify: `node scripts/lint-docs.mjs`

- [ ] **Step 1: Update the three feature docs**

train.md content changes (edit in place, no changelog): the active-workout section documents the free navigation (viewed exercise = logging target; swipe + pager bar + `ExerciseOverviewSheet` + tappable dots), the `summary` phase + `WorkoutSummary` (closing/closed) + the ⋯ `Edzés befejezése…` row + finish-on-CTA (level-up after the press), the three hero states, the `/train/review/:workoutId` route; §4 documents `completedWorkout`, `GET /api/train/workouts/{id}` (+ `WorkoutDetailResponse`/`WorkoutDetailExercise`), the completed-only semantics of `weekDoneDates`/`listWorkouts`/`findDoneInstance*`, and `WorkoutAutoCloseService`. proactive.md: the §HBWI lifecycle gains the generation guard + the zero-set-completed inconclusive rule + the structured target fields. insights.md §2.2: one sentence on the semantics shift.

- [ ] **Step 2: Lint docs**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && node scripts/lint-docs.mjs
```
Expected: no errors, no stale flags for train/proactive/insights.

- [ ] **Step 3: Full frontend gate + focused backend gate**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
cd ../backend && ./mvnw clean test -Dtest='WorkoutDoneSemanticsIT,WorkoutAutoCloseIT,WorkoutDetailContractIT,WorkoutContractIT,WorkoutServiceIT,ChallengeOutcomeIT,ChallengeGeneratorIT'
```
Expected: all green. (The FULL backend suite runs in CI — do not run it locally.)

- [ ] **Step 4: Visual verification (mandatory per project memory)**

Run the app (`cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata,demofixtures` + `cd frontend && pnpm dev`) and walk the flow on http://localhost:5180: start today's workout → swipe/pager/list navigation → log sets (RIR chip visible on done rows) → ⋯ Edzés befejezése → summary screen → Edzés lezárása ✓ → level-up → closed summary → back on Mai the hero shows ✓ Kész · Megnézem → review renders → /train/session redirects to review → GymDaySheet shows Kész · Megnézem.

- [ ] **Step 5: Commit docs, push, PR, merge (per CLAUDE.md git workflow)**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && git add -A && git commit -m "docs(train): session flow fixes — navigation, explicit finish, review, done semantics (mezo-cd8s)"
git push -u origin feat/train-session-flow-fixes
gh pr create --fill --title "Train session flow fixes: RIR display, free navigation, explicit finish, done-day review (mezo-cd8s)"
# wait for CI green, then:
git checkout main && git pull --rebase && git merge --no-ff feat/train-session-flow-fixes && git push
git branch -d feat/train-session-flow-fixes && git push origin --delete feat/train-session-flow-fixes
bd close mezo-cd8s && bd dolt push && git status
```
Expected: CI green before merge; `git status` shows "up to date with origin".
