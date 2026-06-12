# T2 · Workout Execution (Edzés-végrehajtás) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Today's workout becomes real: `GET /today` serves the template day + last-week refs + open instance, the user starts an instance, logs sets (weight/reps/RIR/side/note), persists RP feedback, finishes — and the frontend ActiveWorkoutSession + TrainTodayView run on real data in real mode.

**Architecture:** Workout instances live in the existing `workout_session` table (`template_session_id` self-FK distinguishes instance rows from date-less template rows). `exercise_set` gains a `workout_session_id` FK to the instance (the exercise itself stays on the template). New `exercise_feedback` table persists the RP debrief per (instance, exercise). Contract-first: `api/feature/train/train.yml` grows 5 endpoints; a new `WorkoutService` implements them (TrainService stays meso-focused); `useTrain` grows additively (one query + 4 mutations), TrainTodayView/ActiveWorkoutScreen get wired.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven, PostgreSQL 16 + Liquibase, openapi-generator (contract-first), MapStruct + Lombok, React 19 + TanStack Query + MSW/Vitest.

**Driving bd issue:** `mezo-tod` (epic `mezo-ogv`). Spec: `docs/superpowers/specs/2026-06-11-train-write-clean-slate-design.md`.

**Branch:** `feat/t2-workout-execution` (created in Task 1, merged `--no-ff` in Task 12).

**Conventions that bind every task** (read the matching `docs/references/*.md` before coding):
- `./mvnw clean test` — ALWAYS `clean` (Lombok+MapStruct incremental compile is flaky). Compose Postgres must be up (`cd backend && docker compose up -d`).
- IDE/Eclipse diagnostics on `target/generated-sources` + Lombok are noise — Maven CLI is truth.
- Frontend tests run in BOTH modes: `pnpm test` (real, default) and `VITE_USE_MOCK=true pnpm test`.
- Commit messages: English, conventional, carry `(mezo-tod)`, end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

**Spec deviation (locked here, documented in Task 11):** the spec named the feedback columns `soreness/pump/joint_pain` (1–3). The shipped FeedbackModal asks Pump (4 options) / Joint pain (3) / "Akarunk még?" (3) — RP's pump / joint-pain / workload trio. Columns are therefore `pump smallint 1–4`, `joint_pain smallint 1–3`, `workload smallint 1–3`.

---

## File structure (what's created/modified where)

**Backend**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202606120900_mezo-tod_t2_workout_execution.sql` (migration)
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (register changeset)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/WorkoutSessionEntity.java` (+templateSessionId)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/ExerciseSetEntity.java` (voiceNote→note, +workoutSessionId)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/ExerciseFeedbackEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/ExerciseFeedbackRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/WorkoutSessionRepository.java`, `.../ExerciseSetRepository.java` (new finders)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java` (today/start/logSet/feedback/finish)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TrainService.java` (instance-row exclusion in day stitching)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java` (5 new endpoint delegations)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/mapper/TrainMapper.java` (toTodayExercise, toSetResponse)
- Modify: `backend/src/main/resources/message.properties` (+TRAIN_WORKOUT_NOT_ACTIVE)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (+exercise_feedback)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java` (instance/set/feedback factories)
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutServiceIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutContractIT.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/train/TrainServiceIT.java` (instance-exclusion regression)

**Contract**
- Modify: `api/feature/train/train.yml` (5 paths + 8 schemas), regenerate `api/openapi.yml` + FE `src/lib/api.gen.ts` (backend Java regenerates in Maven).

**Frontend**
- Modify: `frontend/src/lib/trainApi.ts` (5 new calls + types)
- Modify: `frontend/src/data/trainHooks.ts` (today query, workout mapping, derived gymSchedule, 4 mutations, todaySession)
- Modify: `frontend/src/data/types.ts` (`LoggedWorkoutExercise.lastWeek` nullable)
- Modify: `frontend/src/test/msw/handlers.ts` (today + workout write defaults)
- Modify: `frontend/src/features/train/views/TrainTodayView.tsx` (real-mode agenda, guards)
- Modify: `frontend/src/features/train/components/WeeklyDayRow.tsx` (null time/duration guards)
- Modify: `frontend/src/features/train/ActiveWorkoutScreen.tsx` (start/resume/logSet/side/note/feedback/finish wiring)
- Modify: `frontend/src/features/train/components/FeedbackModal.tsx` (lift values, onSave)
- Modify: `frontend/src/features/train/components/ChallengesCarousel.tsx` (empty guard)
- Modify: `frontend/src/data/trainHooks.test.tsx`, `frontend/src/features/train/views/TrainTodayView.test.tsx`, `frontend/src/features/train/ActiveWorkoutScreen.test.tsx`, `frontend/src/features/train/train.emptyStates.test.tsx`

---

### Task 1: Migration + entities + test-framework growth

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202606120900_mezo-tod_t2_workout_execution.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/WorkoutSessionEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/ExerciseSetEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/ExerciseFeedbackEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/ExerciseFeedbackRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/WorkoutSessionRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/ExerciseSetRepository.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutServiceIT.java` (persistence round-trip only; service tests grow in Tasks 3–6)

- [ ] **Step 1: Create the branch**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git checkout -b feat/t2-workout-execution
```

- [ ] **Step 2: Write the migration SQL**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202606120900_mezo-tod_t2_workout_execution.sql`:

```sql
-- DDL: T2 (workout execution) — instance self-FK, set->instance FK, voice_note->note rename,
-- exercise_feedback (RP debrief: pump 1-4, joint_pain 1-3, workload 1-3)
ALTER TABLE workout_session ADD COLUMN template_session_id UUID;
ALTER TABLE workout_session ADD CONSTRAINT fk_workout_session_template_session_id_workout_session_id
    FOREIGN KEY (template_session_id) REFERENCES workout_session(id) ON DELETE SET NULL;
CREATE INDEX idx_workout_session_template_session_id ON workout_session (template_session_id);

ALTER TABLE exercise_set ADD COLUMN workout_session_id UUID;
ALTER TABLE exercise_set ADD CONSTRAINT fk_exercise_set_workout_session_id_workout_session_id
    FOREIGN KEY (workout_session_id) REFERENCES workout_session(id) ON DELETE CASCADE;
CREATE INDEX idx_exercise_set_workout_session_id ON exercise_set (workout_session_id);

ALTER TABLE exercise_set RENAME COLUMN voice_note TO note;

CREATE TABLE exercise_feedback (
    id                 UUID DEFAULT gen_random_uuid(),
    created_by         UUID NOT NULL,
    workout_session_id UUID NOT NULL,
    exercise_id        UUID NOT NULL,
    pump               SMALLINT NOT NULL,
    joint_pain         SMALLINT NOT NULL,
    workload           SMALLINT NOT NULL,
    is_deleted         BOOLEAN NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_exercise_feedback_id PRIMARY KEY (id),
    CONSTRAINT fk_exercise_feedback_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_exercise_feedback_workout_session_id_workout_session_id
        FOREIGN KEY (workout_session_id) REFERENCES workout_session(id) ON DELETE CASCADE,
    CONSTRAINT fk_exercise_feedback_exercise_id_exercise_id
        FOREIGN KEY (exercise_id) REFERENCES exercise(id) ON DELETE CASCADE,
    CONSTRAINT ck_exercise_feedback_pump CHECK (pump BETWEEN 1 AND 4),
    CONSTRAINT ck_exercise_feedback_joint_pain CHECK (joint_pain BETWEEN 1 AND 3),
    CONSTRAINT ck_exercise_feedback_workload CHECK (workload BETWEEN 1 AND 3),
    CONSTRAINT uq_exercise_feedback_workout_session_id_exercise_id UNIQUE (workout_session_id, exercise_id)
);
CREATE INDEX idx_exercise_feedback_workout_session_id ON exercise_feedback (workout_session_id);
```

- [ ] **Step 3: Register the changeset**

Append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202606120900_mezo-tod_t2_workout_execution"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202606120900_mezo-tod_t2_workout_execution.sql
```

- [ ] **Step 4: Update entities**

`WorkoutSessionEntity.java` — add below the `mesocycleId` field:

```java
    /** Instance discriminator: NULL on template rows; on instance rows the template's id. */
    @Column(name = "template_session_id")
    private UUID templateSessionId;
```

`ExerciseSetEntity.java` — rename the `voiceNote` field and add the instance FK below `exerciseId`:

```java
    /** The concrete workout instance this set was logged in (NULL on legacy/template-less rows). */
    @Column(name = "workout_session_id")
    private UUID workoutSessionId;
```

```java
    @Column
    private String note;
```

(delete the old `@Column(name = "voice_note") private String voiceNote;` — nothing in main/seed code references it; only the entity itself changes.)

Create `ExerciseFeedbackEntity.java`:

```java
package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * RP-style post-exercise debrief for one (workout instance, exercise) pair — UNIQUE per pair,
 * upserted by {@code WorkoutService}. Scales (DB CHECKs): pump 1–4, jointPain 1–3, workload 1–3.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "exercise_feedback")
@SQLDelete(sql = "update exercise_feedback set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ExerciseFeedbackEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "workout_session_id", nullable = false)
    private UUID workoutSessionId;

    @NotNull
    @Column(name = "exercise_id", nullable = false)
    private UUID exerciseId;

    @NotNull
    @Column(nullable = false)
    private Integer pump; // 1–4 (DB CHECK)

    @NotNull
    @Column(name = "joint_pain", nullable = false)
    private Integer jointPain; // 1–3 (DB CHECK)

    @NotNull
    @Column(nullable = false)
    private Integer workload; // 1–3 (DB CHECK)
}
```

- [ ] **Step 5: Repository growth**

Create `ExerciseFeedbackRepository.java`:

```java
package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link ExerciseFeedbackEntity}. Extends {@link JpaRepository} directly (no
 * {@code date} field for the house {@code OwnedRepository} ordering); rows are unique per
 * (workout instance, exercise) and looked up exactly that way for the upsert.
 */
public interface ExerciseFeedbackRepository extends JpaRepository<ExerciseFeedbackEntity, UUID> {

    Optional<ExerciseFeedbackEntity> findByCreatedByAndWorkoutSessionIdAndExerciseId(
        UUID createdBy, UUID workoutSessionId, UUID exerciseId);
}
```

Add to `WorkoutSessionRepository.java`:

```java
    Optional<WorkoutSessionEntity> findFirstByCreatedByAndTemplateSessionIdAndStatusOrderByDateDescCreatedAtDesc(
        UUID createdBy, UUID templateSessionId, String status);
```

(import `java.util.Optional`.)

Add to `ExerciseSetRepository.java`:

```java
    List<ExerciseSetEntity> findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(
        UUID createdBy, UUID workoutSessionId);
```

- [ ] **Step 6: ResetDatabase growth rule**

In `ResetDatabase.resetExceptMasterData()` add `exercise_feedback` to the TRUNCATE (child tables first by convention):

```java
        entityManager.createNativeQuery(
            "TRUNCATE TABLE weight_log, sleep_log, check_in, "
                + "exercise_feedback, exercise_set, exercise, workout_session, muscle_group_volume_log, mesocycle, "
                + "sport_session CASCADE").executeUpdate();
```

- [ ] **Step 7: TrainPopulator growth**

Add to `TrainPopulator.java` (new imports: `io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity`, `io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository`; new constructor field `private final ExerciseFeedbackRepository exerciseFeedbackRepository;`):

```java
    /** Instance row: copies the template's day fields, links back via templateSessionId. */
    public WorkoutSessionEntity createWorkoutInstance(UUID createdBy, WorkoutSessionEntity template,
        LocalDate date, String status) {
        WorkoutSessionEntity s = new WorkoutSessionEntity();
        s.setCreatedBy(createdBy);
        s.setMesocycleId(template.getMesocycleId());
        s.setTemplateSessionId(template.getId());
        s.setDayLabel(template.getDayLabel());
        s.setType(template.getType());
        s.setMuscle(template.getMuscle());
        s.setMuscleAccent(template.isMuscleAccent());
        s.setOrderIndex(template.getOrderIndex());
        s.setDate(date);
        s.setStatus(status);
        return workoutSessionRepository.saveAndFlush(s);
    }

    /** Logged set inside an instance (T2 path — workoutSessionId set, side/note carried). */
    public ExerciseSetEntity createLoggedSet(UUID createdBy, UUID exerciseId, UUID workoutSessionId,
        int setIndex, String weightKg, int reps, int rir) {
        ExerciseSetEntity set = new ExerciseSetEntity();
        set.setCreatedBy(createdBy);
        set.setExerciseId(exerciseId);
        set.setWorkoutSessionId(workoutSessionId);
        set.setSetIndex(setIndex);
        set.setWeightKg(new BigDecimal(weightKg));
        set.setReps(reps);
        set.setRir(rir);
        return exerciseSetRepository.saveAndFlush(set);
    }

    public ExerciseFeedbackEntity createFeedback(UUID createdBy, UUID workoutSessionId, UUID exerciseId) {
        ExerciseFeedbackEntity f = new ExerciseFeedbackEntity();
        f.setCreatedBy(createdBy);
        f.setWorkoutSessionId(workoutSessionId);
        f.setExerciseId(exerciseId);
        f.setPump(3);
        f.setJointPain(1);
        f.setWorkload(2);
        return exerciseFeedbackRepository.saveAndFlush(f);
    }
```

- [ ] **Step 8: Write the failing persistence round-trip test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service/repository-level tests for the T2 workout-execution flows. Starts by pinning the new
 * persistence shapes (instance self-FK, set→instance FK + renamed note, feedback CHECK/UNIQUE);
 * grows with WorkoutService in Tasks 3–6.
 */
@Transactional
class WorkoutServiceIT extends AbstractIntegrationTest {

    @Autowired private WorkoutSessionRepository workoutSessionRepository;
    @Autowired private ExerciseSetRepository exerciseSetRepository;
    @Autowired private ExerciseFeedbackRepository exerciseFeedbackRepository;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    /** JPA-managed shared EntityManager — the one allowed exception to constructor injection. */
    @PersistenceContext private EntityManager entityManager;

    /** Server-side HU day label for today — mirrors WorkoutService's mapping (Task 6). */
    static String todayLabel() {
        return List.of("Hét", "Kedd", "Sze", "Csü", "Pén", "Szo", "Vas")
            .get(LocalDate.now().getDayOfWeek().getValue() - 1);
    }

    @Test
    void testCreateWorkoutInstance_shouldRoundTripTemplateLink_whenPersisted() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");

        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(user, template, LocalDate.now(), "active");
        entityManager.clear();

        WorkoutSessionEntity reloaded = workoutSessionRepository.findById(instance.getId()).orElseThrow();
        assertThat(reloaded.getTemplateSessionId()).isEqualTo(template.getId());
        assertThat(reloaded.getDate()).isEqualTo(LocalDate.now());
        assertThat(reloaded.getStatus()).isEqualTo("active");
        assertThat(reloaded.getType()).isEqualTo("Pull Day");
    }

    @Test
    void testCreateLoggedSet_shouldRoundTripInstanceFkAndNote_whenPersisted() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(user, template.getId(), "Row", 0);
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(user, template, LocalDate.now(), "active");

        ExerciseSetEntity set = trainPopulator.createLoggedSet(user, exercise.getId(), instance.getId(),
            0, "102.50", 9, 2);
        set.setNote("note survives the rename");
        set.setSide("L");
        exerciseSetRepository.saveAndFlush(set);
        entityManager.clear();

        ExerciseSetEntity reloaded = exerciseSetRepository.findById(set.getId()).orElseThrow();
        assertThat(reloaded.getWorkoutSessionId()).isEqualTo(instance.getId());
        assertThat(reloaded.getNote()).isEqualTo("note survives the rename");
        assertThat(reloaded.getSide()).isEqualTo("L");
    }

    @Test
    void testCreateFeedback_shouldRejectDuplicate_whenSamePairInsertedTwice() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(user, template.getId(), "Row", 0);
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(user, template, LocalDate.now(), "active");

        ExerciseFeedbackEntity first = trainPopulator.createFeedback(user, instance.getId(), exercise.getId());
        assertThat(first.getId()).isNotNull();
        assertThatThrownBy(() -> trainPopulator.createFeedback(user, instance.getId(), exercise.getId()))
            .hasMessageContaining("uq_exercise_feedback");
    }
}
```

- [ ] **Step 9: Run it — verify it fails first, then passes**

Run before adding the migration/entities (or just verify compile errors reference the new members), then after everything above:

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=WorkoutServiceIT
```

Expected: 3/3 PASS (with the migration applied; the duplicate-feedback test proves the UNIQUE fires).

- [ ] **Step 10: Full backend suite still green**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test
```

Expected: all tests pass (ResetDatabase now truncates `exercise_feedback`; rename breaks nothing — nothing referenced `voiceNote`).

- [ ] **Step 11: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add backend/src/main/resources/db backend/src/main/java/io/mrkuhne/mezo/feature/train backend/src/test/java/io/mrkuhne/mezo
git commit -m "feat(train): T2 schema — workout instances, set->instance FK, note rename, exercise_feedback (mezo-tod)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: API contract growth + regen + controller stubs

**Files:**
- Modify: `api/feature/train/train.yml`
- Generated: `api/openapi.yml`, `frontend/src/lib/api.gen.ts`, backend `target/generated-sources` (automatic)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java` (temporary stubs — T1 lesson: the controller implements the generated interface, so new methods break compile without stubs)

- [ ] **Step 1: Add paths to `api/feature/train/train.yml`** (after the `/api/train/sport-sessions` path, before `components`):

```yaml
  /api/train/workouts/today:
    get:
      tags: [Train]
      operationId: getTodayWorkout
      summary: Today's workout — active meso's template day, exercises with last-week refs, open instance
      responses:
        '200':
          description: Today's workout context (empty object when no active meso or rest day)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WorkoutTodayResponse'
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
  /api/train/workouts:
    post:
      tags: [Train]
      operationId: startWorkout
      summary: Start (or resume) a workout instance for a template day — an open instance is returned, never duplicated
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/WorkoutStartRequest'
      responses:
        '201':
          description: The active instance (created, or the resumed open one)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WorkoutInstanceResponse'
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '404':
          description: Template day not found or not owned
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
  /api/train/workouts/{id}/sets:
    post:
      tags: [Train]
      operationId: logWorkoutSet
      summary: Log one set into an active workout instance
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SetLogRequest'
      responses:
        '201':
          description: Logged set
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ExerciseSetResponse'
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '404':
          description: Workout/exercise not found or not owned
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '409':
          description: Workout already completed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
  /api/train/workouts/{id}/feedback:
    post:
      tags: [Train]
      operationId: saveWorkoutFeedback
      summary: Persist RP debrief rows for the instance (upsert per exercise)
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/WorkoutFeedbackInput'
      responses:
        '204':
          description: Feedback stored
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '404':
          description: Workout/exercise not found or not owned
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
  /api/train/workouts/{id}/finish:
    post:
      tags: [Train]
      operationId: finishWorkout
      summary: Complete a workout instance (idempotent)
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: The completed instance with its logged sets
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WorkoutInstanceResponse'
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '404':
          description: Workout not found or not owned
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
```

- [ ] **Step 2: Add schemas** (under `components.schemas`):

```yaml
    WorkoutTodayResponse:
      type: object
      description: All fields absent when there is no active meso or today is a rest day
      properties:
        templateSessionId:
          type: string
          format: uuid
        dayLabel:
          type: string
          description: "'Hét'..'Vas'"
        title:
          type: string
          description: The day type, e.g. 'Pull Day'
        durationEst:
          type: integer
        exercises:
          type: array
          items:
            $ref: '#/components/schemas/TodayExercise'
        openWorkout:
          $ref: '#/components/schemas/WorkoutInstanceResponse'
    TodayExercise:
      type: object
      required:
        - id
        - name
        - muscle
        - sets
        - targetReps
        - targetRIR
        - type
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        muscle:
          type: string
        sets:
          type: integer
        targetReps:
          type: string
        targetRIR:
          type: integer
        type:
          type: string
          enum: [compound, isolation]
        warning:
          type: string
        lastWeek:
          $ref: '#/components/schemas/LastWeekRef'
    LastWeekRef:
      type: object
      description: Top set of the previous completed instance of the same template day
      required:
        - weightKg
        - reps
        - rir
      properties:
        weightKg:
          type: number
        reps:
          type: integer
        rir:
          type: integer
    WorkoutInstanceResponse:
      type: object
      required:
        - id
        - templateSessionId
        - date
        - status
        - sets
      properties:
        id:
          type: string
          format: uuid
        templateSessionId:
          type: string
          format: uuid
        date:
          type: string
          format: date
        status:
          type: string
          enum: [active, completed]
        sets:
          type: array
          items:
            $ref: '#/components/schemas/ExerciseSetResponse'
    ExerciseSetResponse:
      type: object
      required:
        - id
        - exerciseId
        - setIndex
      properties:
        id:
          type: string
          format: uuid
        exerciseId:
          type: string
          format: uuid
        setIndex:
          type: integer
        weightKg:
          type: number
        reps:
          type: integer
        rir:
          type: integer
        side:
          type: string
          description: L|B|R
        note:
          type: string
    WorkoutStartRequest:
      type: object
      required:
        - templateSessionId
      properties:
        templateSessionId:
          type: string
          format: uuid
    SetLogRequest:
      type: object
      required:
        - exerciseId
        - setIndex
        - weightKg
        - reps
        - rir
      properties:
        exerciseId:
          type: string
          format: uuid
        setIndex:
          type: integer
          minimum: 0
          maximum: 49
        weightKg:
          type: number
          minimum: 0
          maximum: 999
        reps:
          type: integer
          minimum: 1
          maximum: 100
        rir:
          type: integer
          minimum: 0
          maximum: 5
        side:
          type: string
          pattern: '^[LBR]$'
        note:
          type: string
          maxLength: 500
    WorkoutFeedbackInput:
      type: object
      required:
        - exerciseId
        - pump
        - jointPain
        - workload
      properties:
        exerciseId:
          type: string
          format: uuid
        pump:
          type: integer
          minimum: 1
          maximum: 4
        jointPain:
          type: integer
          minimum: 1
          maximum: 3
        workload:
          type: integer
          minimum: 1
          maximum: 3
```

(Note: `side` uses `pattern`, not `enum` — request enums fail in Jackson deser → 500; pattern fails bean validation → 400. Response enums like `WorkoutInstanceResponse.status` are safe.)

- [ ] **Step 3: Merge fragments + regenerate FE types**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/api/generate && npm run generate:api
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm generate:api
```

Expected: `api/openapi.yml` rewritten with the 5 new paths; `frontend/src/lib/api.gen.ts` gains `WorkoutTodayResponse`, `SetLogRequest`, etc.

- [ ] **Step 4: Controller stubs (keep backend compiling)**

`TrainController.java` — add imports (`io.mrkuhne.mezo.api.dto.ExerciseSetResponse`, `.SetLogRequest`, `.WorkoutFeedbackInput`, `.WorkoutInstanceResponse`, `.WorkoutStartRequest`, `.WorkoutTodayResponse`) and methods:

```java
    // T2 stubs — replaced by WorkoutService delegations in Tasks 3–6.
    @Override
    public WorkoutTodayResponse getTodayWorkout() {
        throw new UnsupportedOperationException("T2 Task 6");
    }

    @Override
    public WorkoutInstanceResponse startWorkout(WorkoutStartRequest workoutStartRequest) {
        throw new UnsupportedOperationException("T2 Task 3");
    }

    @Override
    public ExerciseSetResponse logWorkoutSet(UUID id, SetLogRequest setLogRequest) {
        throw new UnsupportedOperationException("T2 Task 4");
    }

    @Override
    public void saveWorkoutFeedback(UUID id, List<WorkoutFeedbackInput> workoutFeedbackInput) {
        throw new UnsupportedOperationException("T2 Task 5");
    }

    @Override
    public WorkoutInstanceResponse finishWorkout(UUID id) {
        throw new UnsupportedOperationException("T2 Task 5");
    }
```

(If the generated parameter names differ, mirror the generated `TrainApi` exactly — check `backend/target/generated-sources/openapi/.../TrainApi.java` after the next step.)

- [ ] **Step 5: Verify build + tests**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm build
```

Expected: both green (stubs satisfy the interface; FE types compile unused).

- [ ] **Step 6: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add api/ frontend/src/lib/api.gen.ts backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java
git commit -m "feat(api): T2 workout-execution contract — today/start/sets/feedback/finish (mezo-tod)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: WorkoutService.startWorkout (create + resume + ownership)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/mapper/TrainMapper.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutServiceIT.java`

- [ ] **Step 1: Write the failing tests** — add to `WorkoutServiceIT` (new imports: `io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse`, `io.mrkuhne.mezo.api.dto.WorkoutStartRequest`, `io.mrkuhne.mezo.feature.train.service.WorkoutService`, `io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException`; autowire `@Autowired private WorkoutService workoutService;`):

```java
    @Test
    void testStartWorkout_shouldCreateActiveInstance_whenTemplateOwned() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");

        WorkoutInstanceResponse started =
            workoutService.startWorkout(user, new WorkoutStartRequest(template.getId()));

        assertThat(started.getTemplateSessionId()).isEqualTo(template.getId());
        assertThat(started.getDate()).isEqualTo(LocalDate.now());
        assertThat(started.getStatus()).isEqualTo(WorkoutInstanceResponse.StatusEnum.ACTIVE);
        assertThat(started.getSets()).isEmpty();
        WorkoutSessionEntity row = workoutSessionRepository.findById(started.getId()).orElseThrow();
        assertThat(row.getCreatedBy()).isEqualTo(user); // ownership stamped server-side
        assertThat(row.getType()).isEqualTo("Pull Day"); // day fields copied from the template
        assertThat(row.getMesocycleId()).isEqualTo(meso.getId());
    }

    @Test
    void testStartWorkout_shouldResumeOpenInstance_whenStartFiresAgain() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");

        WorkoutInstanceResponse first =
            workoutService.startWorkout(user, new WorkoutStartRequest(template.getId()));
        WorkoutInstanceResponse second =
            workoutService.startWorkout(user, new WorkoutStartRequest(template.getId()));

        assertThat(second.getId()).isEqualTo(first.getId()); // resumed, not duplicated
        long instances = workoutSessionRepository.findAll().stream()
            .filter(s -> template.getId().equals(s.getTemplateSessionId())).count();
        assertThat(instances).isEqualTo(1);
    }

    @Test
    void testStartWorkout_shouldThrowNotFound_whenTemplateForeign() {
        UUID owner = databasePopulator.populateUser("workout@test.local");
        UUID stranger = databasePopulator.populateUser("stranger@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(owner, meso.getId(), todayLabel(), "Pull Day", 0, "planned");

        assertThatThrownBy(() -> workoutService.startWorkout(stranger, new WorkoutStartRequest(template.getId())))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testStartWorkout_shouldThrowNotFound_whenTargetIsInstanceRow() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(user, template, LocalDate.now(), "active");

        assertThatThrownBy(() -> workoutService.startWorkout(user, new WorkoutStartRequest(instance.getId())))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=WorkoutServiceIT
```

Expected: compile FAILS (`WorkoutService` does not exist) — that's the red state.

- [ ] **Step 3: Implement WorkoutService (start + shared helpers)**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java`:

```java
package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.WorkoutStartRequest;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Workout-execution slice service (T2): today's workout context, instance start/resume, set
 * logging, RP feedback, finish. Template rows in {@code workout_session} are date-less with
 * {@code templateSessionId == null}; instances carry {@code date}, {@code status} and the
 * template back-link. All finders are scoped by {@code createdBy}; child writes verify the
 * parent chain belongs to the caller. Per house rule (spring_patterns.md) only the write
 * methods carry method-level {@code @Transactional}.
 */
@Service
@RequiredArgsConstructor
public class WorkoutService {

    /** DayOfWeek (MONDAY..SUNDAY) → the HU day labels the frontend's DAY_ORDER uses. */
    static final List<String> HU_DAY_LABELS =
        List.of("Hét", "Kedd", "Sze", "Csü", "Pén", "Szo", "Vas");

    private final MesocycleRepository mesocycleRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final TrainMapper mapper;

    @Transactional
    public WorkoutInstanceResponse startWorkout(UUID createdBy, WorkoutStartRequest req) {
        WorkoutSessionEntity template = workoutSessionRepository.findById(req.getTemplateSessionId())
            .filter(s -> createdBy.equals(s.getCreatedBy()) && s.getTemplateSessionId() == null)
            .orElseThrow(WorkoutService::notFound);
        // Spec rule: an open instance is resumed, never duplicated.
        WorkoutSessionEntity open = workoutSessionRepository
            .findFirstByCreatedByAndTemplateSessionIdAndStatusOrderByDateDescCreatedAtDesc(
                createdBy, template.getId(), "active")
            .orElse(null);
        if (open != null) {
            return toInstanceResponse(createdBy, open);
        }
        WorkoutSessionEntity instance = new WorkoutSessionEntity();
        instance.setCreatedBy(createdBy); // server-side ownership — never from the client
        instance.setMesocycleId(template.getMesocycleId());
        instance.setTemplateSessionId(template.getId());
        instance.setDayLabel(template.getDayLabel());
        instance.setType(template.getType());
        instance.setMuscle(template.getMuscle());
        instance.setMuscleAccent(template.isMuscleAccent());
        instance.setDurationEst(template.getDurationEst());
        instance.setOrderIndex(template.getOrderIndex());
        instance.setDate(LocalDate.now());
        instance.setStatus("active");
        return toInstanceResponse(createdBy, workoutSessionRepository.save(instance));
    }

    private WorkoutInstanceResponse toInstanceResponse(UUID createdBy, WorkoutSessionEntity instance) {
        return WorkoutInstanceResponse.builder()
            .id(instance.getId())
            .templateSessionId(instance.getTemplateSessionId())
            .date(instance.getDate())
            .status(WorkoutInstanceResponse.StatusEnum.fromValue(instance.getStatus()))
            .sets(exerciseSetRepository
                .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instance.getId())
                .stream().map(mapper::toSetResponse).toList())
            .build();
    }

    /** Ownership gate: a missing row and a foreign row are indistinguishable to the caller (404). */
    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
```

- [ ] **Step 4: Mapper growth** — add to `TrainMapper.java` (imports: `io.mrkuhne.mezo.api.dto.ExerciseSetResponse`, `io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity`):

```java
    ExerciseSetResponse toSetResponse(ExerciseSetEntity entity);
```

- [ ] **Step 5: Wire the controller** — replace the start stub in `TrainController`:

```java
    private final WorkoutService workoutService;
```

(new constructor field next to `service`; import `io.mrkuhne.mezo.feature.train.service.WorkoutService`)

```java
    @Override
    public WorkoutInstanceResponse startWorkout(WorkoutStartRequest workoutStartRequest) {
        return workoutService.startWorkout(currentUserId.get(), workoutStartRequest);
    }
```

- [ ] **Step 6: Run tests**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=WorkoutServiceIT
```

Expected: PASS (7/7 so far). Reminder for assertions on dirty-checked mutations later: `entityManager.flush()` before `entityManager.clear()`.

- [ ] **Step 7: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add backend/src
git commit -m "feat(train): start/resume workout instance with ownership chain (mezo-tod)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: WorkoutService.logSet

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java`
- Modify: `backend/src/main/resources/message.properties`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutServiceIT.java`

- [ ] **Step 1: Write the failing tests** (new imports: `io.mrkuhne.mezo.api.dto.ExerciseSetResponse`, `io.mrkuhne.mezo.api.dto.SetLogRequest`, `java.math.BigDecimal`):

```java
    @Test
    void testLogSet_shouldPersistSetIntoInstance_whenWorkoutActive() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(user, template.getId(), "Row", 0);
        WorkoutInstanceResponse started =
            workoutService.startWorkout(user, new WorkoutStartRequest(template.getId()));

        SetLogRequest req = new SetLogRequest(exercise.getId(), 0, new BigDecimal("105.0"), 8, 1);
        req.setSide("L");
        req.setNote("pumpa brutális");
        ExerciseSetResponse logged = workoutService.logSet(user, started.getId(), req);

        assertThat(logged.getId()).isNotNull();
        ExerciseSetEntity row = exerciseSetRepository.findById(logged.getId()).orElseThrow();
        assertThat(row.getWorkoutSessionId()).isEqualTo(started.getId());
        assertThat(row.getExerciseId()).isEqualTo(exercise.getId());
        assertThat(row.getWeightKg()).isEqualByComparingTo("105.0");
        assertThat(row.getSide()).isEqualTo("L");
        assertThat(row.getNote()).isEqualTo("pumpa brutális");
        assertThat(row.getDoneAt()).isNotNull();
        assertThat(row.getCreatedBy()).isEqualTo(user);
    }

    @Test
    void testLogSet_shouldThrowNotFound_whenExerciseNotInTemplateDay() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        WorkoutSessionEntity otherDay =
            trainPopulator.createWorkoutSession(user, meso.getId(), "Pén", "Push Day", 1, "planned");
        ExerciseEntity foreignExercise = trainPopulator.createExercise(user, otherDay.getId(), "Bench", 0);
        WorkoutInstanceResponse started =
            workoutService.startWorkout(user, new WorkoutStartRequest(template.getId()));

        assertThatThrownBy(() -> workoutService.logSet(user, started.getId(),
            new SetLogRequest(foreignExercise.getId(), 0, new BigDecimal("60"), 10, 2)))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testLogSet_shouldThrowConflict_whenWorkoutCompleted() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(user, template.getId(), "Row", 0);
        WorkoutSessionEntity completed =
            trainPopulator.createWorkoutInstance(user, template, LocalDate.now(), "completed");

        assertThatThrownBy(() -> workoutService.logSet(user, completed.getId(),
            new SetLogRequest(exercise.getId(), 0, new BigDecimal("100"), 8, 1)))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .extracting(e -> ((SystemRuntimeErrorException) e).getHttpStatus())
            .isEqualTo(org.springframework.http.HttpStatus.CONFLICT);
    }
```

(If `SystemRuntimeErrorException` exposes its status under a different accessor, mirror how `GlobalExceptionHandler` reads it — check the class before running.)

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=WorkoutServiceIT
```

Expected: compile FAIL (`logSet` missing).

- [ ] **Step 3: Add the error code** to `backend/src/main/resources/message.properties`:

```properties
TRAIN_WORKOUT_NOT_ACTIVE=The workout is already completed.
```

- [ ] **Step 4: Implement logSet** — add to `WorkoutService` (imports: `io.mrkuhne.mezo.api.dto.ExerciseSetResponse`, `io.mrkuhne.mezo.api.dto.SetLogRequest`, `io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity`, `java.time.Instant`):

```java
    @Transactional
    public ExerciseSetResponse logSet(UUID createdBy, UUID workoutId, SetLogRequest req) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        if (!"active".equals(instance.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_WORKOUT_NOT_ACTIVE").build(), HttpStatus.CONFLICT);
        }
        // The exercise must hang off the instance's template day — child writes verify the chain.
        exerciseRepository.findById(req.getExerciseId())
            .filter(e -> createdBy.equals(e.getCreatedBy())
                && instance.getTemplateSessionId().equals(e.getWorkoutSessionId()))
            .orElseThrow(WorkoutService::notFound);
        ExerciseSetEntity set = new ExerciseSetEntity();
        set.setCreatedBy(createdBy);
        set.setExerciseId(req.getExerciseId());
        set.setWorkoutSessionId(instance.getId());
        set.setSetIndex(req.getSetIndex());
        set.setWeightKg(req.getWeightKg());
        set.setReps(req.getReps());
        set.setRir(req.getRir());
        set.setSide(req.getSide());
        set.setNote(req.getNote());
        set.setDoneAt(Instant.now());
        return mapper.toSetResponse(exerciseSetRepository.save(set));
    }

    /** Instance gate: owned AND an instance row (template rows are not loggable targets). */
    private WorkoutSessionEntity ownedInstanceOrThrow(UUID createdBy, UUID workoutId) {
        return workoutSessionRepository.findById(workoutId)
            .filter(s -> createdBy.equals(s.getCreatedBy()) && s.getTemplateSessionId() != null)
            .orElseThrow(WorkoutService::notFound);
    }
```

- [ ] **Step 5: Wire the controller** — replace the stub:

```java
    @Override
    public ExerciseSetResponse logWorkoutSet(UUID id, SetLogRequest setLogRequest) {
        return workoutService.logSet(currentUserId.get(), id, setLogRequest);
    }
```

- [ ] **Step 6: Run tests**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=WorkoutServiceIT
```

Expected: PASS (10/10).

- [ ] **Step 7: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add backend/src
git commit -m "feat(train): set logging into active workout instances (mezo-tod)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: WorkoutService feedback (upsert) + finish (idempotent)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutServiceIT.java`

- [ ] **Step 1: Write the failing tests** (new imports: `io.mrkuhne.mezo.api.dto.WorkoutFeedbackInput`):

```java
    @Test
    void testSaveFeedback_shouldUpsertPerExercise_whenSavedTwice() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(user, template.getId(), "Row", 0);
        WorkoutInstanceResponse started =
            workoutService.startWorkout(user, new WorkoutStartRequest(template.getId()));

        workoutService.saveFeedback(user, started.getId(),
            List.of(new WorkoutFeedbackInput(exercise.getId(), 3, 1, 2)));
        workoutService.saveFeedback(user, started.getId(),
            List.of(new WorkoutFeedbackInput(exercise.getId(), 4, 2, 3)));
        entityManager.flush();
        entityManager.clear();

        List<ExerciseFeedbackEntity> rows = exerciseFeedbackRepository.findAll().stream()
            .filter(f -> started.getId().equals(f.getWorkoutSessionId())).toList();
        assertThat(rows).hasSize(1); // upsert — UNIQUE pair, second save updates
        assertThat(rows.get(0).getPump()).isEqualTo(4);
        assertThat(rows.get(0).getJointPain()).isEqualTo(2);
        assertThat(rows.get(0).getWorkload()).isEqualTo(3);
    }

    @Test
    void testSaveFeedback_shouldThrowNotFound_whenExerciseNotInTemplateDay() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        WorkoutSessionEntity otherDay =
            trainPopulator.createWorkoutSession(user, meso.getId(), "Pén", "Push Day", 1, "planned");
        ExerciseEntity foreignExercise = trainPopulator.createExercise(user, otherDay.getId(), "Bench", 0);
        WorkoutInstanceResponse started =
            workoutService.startWorkout(user, new WorkoutStartRequest(template.getId()));

        assertThatThrownBy(() -> workoutService.saveFeedback(user, started.getId(),
            List.of(new WorkoutFeedbackInput(foreignExercise.getId(), 3, 1, 2))))
            .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testFinishWorkout_shouldCompleteAndStayCompleted_whenCalledTwice() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(user, template.getId(), "Row", 0);
        WorkoutInstanceResponse started =
            workoutService.startWorkout(user, new WorkoutStartRequest(template.getId()));
        workoutService.logSet(user, started.getId(),
            new SetLogRequest(exercise.getId(), 0, new BigDecimal("100"), 8, 1));

        WorkoutInstanceResponse finished = workoutService.finishWorkout(user, started.getId());
        WorkoutInstanceResponse again = workoutService.finishWorkout(user, started.getId());
        entityManager.flush();
        entityManager.clear();

        assertThat(finished.getStatus()).isEqualTo(WorkoutInstanceResponse.StatusEnum.COMPLETED);
        assertThat(finished.getSets()).hasSize(1); // response carries the logged sets (summary)
        assertThat(again.getStatus()).isEqualTo(WorkoutInstanceResponse.StatusEnum.COMPLETED);
        WorkoutSessionEntity row = workoutSessionRepository.findById(started.getId()).orElseThrow();
        assertThat(row.getStatus()).isEqualTo("completed");
    }
```

(If the generated `WorkoutFeedbackInput` all-args constructor ordering differs, use the no-arg + setters form: `new WorkoutFeedbackInput().exerciseId(...).pump(3).jointPain(1).workload(2)` — check the generated class.)

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=WorkoutServiceIT
```

Expected: compile FAIL (`saveFeedback`/`finishWorkout` missing).

- [ ] **Step 3: Implement** — add to `WorkoutService` (imports: `io.mrkuhne.mezo.api.dto.WorkoutFeedbackInput`, `io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity`, `io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository`; constructor field `private final ExerciseFeedbackRepository exerciseFeedbackRepository;`):

```java
    @Transactional
    public void saveFeedback(UUID createdBy, UUID workoutId, List<WorkoutFeedbackInput> items) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        for (WorkoutFeedbackInput in : items) {
            exerciseRepository.findById(in.getExerciseId())
                .filter(e -> createdBy.equals(e.getCreatedBy())
                    && instance.getTemplateSessionId().equals(e.getWorkoutSessionId()))
                .orElseThrow(WorkoutService::notFound);
            // Upsert per (instance, exercise) — the DB UNIQUE backs this invariant.
            ExerciseFeedbackEntity row = exerciseFeedbackRepository
                .findByCreatedByAndWorkoutSessionIdAndExerciseId(createdBy, instance.getId(), in.getExerciseId())
                .orElseGet(() -> {
                    ExerciseFeedbackEntity f = new ExerciseFeedbackEntity();
                    f.setCreatedBy(createdBy);
                    f.setWorkoutSessionId(instance.getId());
                    f.setExerciseId(in.getExerciseId());
                    return f;
                });
            row.setPump(in.getPump());
            row.setJointPain(in.getJointPain());
            row.setWorkload(in.getWorkload());
            exerciseFeedbackRepository.save(row);
        }
    }

    @Transactional
    public WorkoutInstanceResponse finishWorkout(UUID createdBy, UUID workoutId) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        if ("active".equals(instance.getStatus())) {
            instance.setStatus("completed"); // dirty-checked, flushed at commit
        }
        return toInstanceResponse(createdBy, instance);
    }
```

- [ ] **Step 4: Wire the controller** — replace both stubs:

```java
    @Override
    public void saveWorkoutFeedback(UUID id, List<WorkoutFeedbackInput> workoutFeedbackInput) {
        workoutService.saveFeedback(currentUserId.get(), id, workoutFeedbackInput);
    }

    @Override
    public WorkoutInstanceResponse finishWorkout(UUID id) {
        return workoutService.finishWorkout(currentUserId.get(), id);
    }
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=WorkoutServiceIT
```

Expected: PASS (13/13).

- [ ] **Step 6: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add backend/src
git commit -m "feat(train): RP feedback upsert + idempotent workout finish (mezo-tod)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: GET /today (template day + last-week refs + open instance) + instance-row exclusion

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TrainService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/mapper/TrainMapper.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutServiceIT.java`, `.../TrainServiceIT.java`

- [ ] **Step 1: Write the failing tests** — add to `WorkoutServiceIT` (new import: `io.mrkuhne.mezo.api.dto.WorkoutTodayResponse`):

```java
    @Test
    void testGetToday_shouldReturnEmpty_whenNoActiveMeso() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        trainPopulator.createMesocycle(user, "Planned only", "planned");

        WorkoutTodayResponse today = workoutService.getToday(user);

        assertThat(today.getTemplateSessionId()).isNull();
        assertThat(today.getExercises()).isNull();
    }

    @Test
    void testGetToday_shouldReturnEmpty_whenTodayIsRestDay() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        // a template day exists for today but has NO exercises -> rest day
        trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Rest", 0, "planned");

        WorkoutTodayResponse today = workoutService.getToday(user);

        assertThat(today.getTemplateSessionId()).isNull();
    }

    @Test
    void testGetToday_shouldReturnTemplateDayWithExercises_whenTodayHasGymDay() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        trainPopulator.createExercise(user, template.getId(), "Chest Supported Row", 0);
        trainPopulator.createExercise(user, template.getId(), "Lat Pulldown", 1);

        WorkoutTodayResponse today = workoutService.getToday(user);

        assertThat(today.getTemplateSessionId()).isEqualTo(template.getId());
        assertThat(today.getTitle()).isEqualTo("Pull Day");
        assertThat(today.getDayLabel()).isEqualTo(todayLabel());
        assertThat(today.getExercises()).hasSize(2);
        assertThat(today.getExercises().get(0).getName()).isEqualTo("Chest Supported Row");
        assertThat(today.getExercises().get(0).getLastWeek()).isNull(); // first-ever workout
        assertThat(today.getOpenWorkout()).isNull();
    }

    @Test
    void testGetToday_shouldDeriveLastWeekTopSet_whenPreviousCompletedInstanceExists() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(user, template.getId(), "Row", 0);
        WorkoutSessionEntity lastWeekInstance =
            trainPopulator.createWorkoutInstance(user, template, LocalDate.now().minusDays(7), "completed");
        trainPopulator.createLoggedSet(user, exercise.getId(), lastWeekInstance.getId(), 0, "100.0", 8, 2);
        trainPopulator.createLoggedSet(user, exercise.getId(), lastWeekInstance.getId(), 1, "102.5", 9, 2);

        WorkoutTodayResponse today = workoutService.getToday(user);

        assertThat(today.getExercises().get(0).getLastWeek()).isNotNull();
        assertThat(today.getExercises().get(0).getLastWeek().getWeightKg())
            .isEqualByComparingTo(new BigDecimal("102.5")); // top set wins
        assertThat(today.getExercises().get(0).getLastWeek().getReps()).isEqualTo(9);
    }

    @Test
    void testGetToday_shouldCarryOpenWorkoutWithSets_whenInstanceActive() {
        UUID user = databasePopulator.populateUser("workout@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(user, template.getId(), "Row", 0);
        WorkoutInstanceResponse started =
            workoutService.startWorkout(user, new WorkoutStartRequest(template.getId()));
        workoutService.logSet(user, started.getId(),
            new SetLogRequest(exercise.getId(), 0, new BigDecimal("100"), 8, 1));

        WorkoutTodayResponse today = workoutService.getToday(user);

        assertThat(today.getOpenWorkout()).isNotNull();
        assertThat(today.getOpenWorkout().getId()).isEqualTo(started.getId());
        assertThat(today.getOpenWorkout().getSets()).hasSize(1);
    }
```

And the regression in `TrainServiceIT`:

```java
    @Test
    void testListMesocycles_shouldExcludeInstanceRows_whenInstancesExist() {
        UUID user = databasePopulator.populateUser("train@test.local");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "T2 meso", "active");
        WorkoutSessionEntity template =
            trainPopulator.createWorkoutSession(user, meso.getId(), "Csü", "Pull Day", 0, "planned");
        trainPopulator.createWorkoutInstance(user, template, LocalDate.now(), "active");

        List<MesocycleResponse> mesos = trainService.listMesocycles(user);

        assertThat(mesos).hasSize(1);
        // only the template day appears — the started instance must not duplicate it
        assertThat(mesos.get(0).getDays()).hasSize(1);
        assertThat(mesos.get(0).getDays().get(0).getId()).isEqualTo(template.getId());
    }
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest='WorkoutServiceIT,TrainServiceIT'
```

Expected: compile FAIL (`getToday` missing); the TrainServiceIT regression FAILS with `days` size 2.

- [ ] **Step 3: Mapper growth** — add to `TrainMapper.java` (imports: `io.mrkuhne.mezo.api.dto.TodayExercise`):

```java
    @Mapping(target = "targetRIR", source = "targetRir")
    @Mapping(target = "type", expression = "java(TodayExercise.TypeEnum.fromValue(entity.getType()))")
    @Mapping(target = "lastWeek", ignore = true)
    TodayExercise toTodayExercise(ExerciseEntity entity);
```

- [ ] **Step 4: Implement getToday** — add to `WorkoutService` (imports: `io.mrkuhne.mezo.api.dto.LastWeekRef`, `io.mrkuhne.mezo.api.dto.TodayExercise`, `io.mrkuhne.mezo.api.dto.WorkoutTodayResponse`, `io.mrkuhne.mezo.feature.train.entity.ExerciseEntity`, `io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity`, `io.mrkuhne.mezo.feature.train.entity.MesocycleEntity`, `java.util.Map`, `java.util.stream.Collectors`):

```java
    public WorkoutTodayResponse getToday(UUID createdBy) {
        WorkoutTodayResponse empty = new WorkoutTodayResponse();
        MesocycleEntity activeMeso = mesocycleRepository
            .findByCreatedByAndStatusAndDeletedFalse(createdBy, "active")
            .stream().findFirst().orElse(null);
        if (activeMeso == null) {
            return empty;
        }
        String todayLabel = HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        WorkoutSessionEntity day = workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(activeMeso.getId()))
            .stream()
            .filter(s -> s.getTemplateSessionId() == null && todayLabel.equals(s.getDayLabel()))
            .findFirst().orElse(null);
        if (day == null) {
            return empty;
        }
        List<ExerciseEntity> exercises = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, List.of(day.getId()));
        if (exercises.isEmpty()) {
            return empty; // rest day
        }
        Map<UUID, LastWeekRef> lastWeek = lastWeekRefs(createdBy, day.getId());
        WorkoutSessionEntity open = workoutSessionRepository
            .findFirstByCreatedByAndTemplateSessionIdAndStatusOrderByDateDescCreatedAtDesc(
                createdBy, day.getId(), "active")
            .orElse(null);
        return WorkoutTodayResponse.builder()
            .templateSessionId(day.getId())
            .dayLabel(day.getDayLabel())
            .title(day.getType())
            .durationEst(day.getDurationEst())
            .exercises(exercises.stream().map(e -> {
                TodayExercise t = mapper.toTodayExercise(e);
                t.setLastWeek(lastWeek.get(e.getId()));
                return t;
            }).toList())
            .openWorkout(open != null ? toInstanceResponse(createdBy, open) : null)
            .build();
    }

    /**
     * "Last week" reference per exercise: the TOP set (max weight, ties broken by insertion order)
     * of the most recent COMPLETED instance of the same template day.
     */
    private Map<UUID, LastWeekRef> lastWeekRefs(UUID createdBy, UUID templateSessionId) {
        return workoutSessionRepository
            .findFirstByCreatedByAndTemplateSessionIdAndStatusOrderByDateDescCreatedAtDesc(
                createdBy, templateSessionId, "completed")
            .map(prev -> exerciseSetRepository
                .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, prev.getId()).stream()
                .filter(s -> s.getWeightKg() != null && s.getReps() != null && s.getRir() != null)
                .collect(Collectors.toMap(ExerciseSetEntity::getExerciseId, this::toLastWeekRef,
                    (a, b) -> b.getWeightKg().compareTo(a.getWeightKg()) > 0 ? b : a)))
            .orElse(Map.of());
    }

    private LastWeekRef toLastWeekRef(ExerciseSetEntity set) {
        return LastWeekRef.builder()
            .weightKg(set.getWeightKg())
            .reps(set.getReps())
            .rir(set.getRir())
            .build();
    }
```

- [ ] **Step 5: Exclude instance rows from the meso day stitching** — in `TrainService.listMesocycles` change the sessions load to:

```java
        List<WorkoutSessionEntity> sessions =
            workoutSessionRepository.findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, mesoIds)
                .stream().filter(s -> s.getTemplateSessionId() == null).toList();
```

and in `TrainService.assembleResponse` the same:

```java
        List<WorkoutSessionEntity> sessions =
            workoutSessionRepository.findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(m.getId()))
                .stream().filter(s -> s.getTemplateSessionId() == null).toList();
```

- [ ] **Step 6: Wire the controller** — replace the last stub:

```java
    @Override
    public WorkoutTodayResponse getTodayWorkout() {
        return workoutService.getToday(currentUserId.get());
    }
```

- [ ] **Step 7: Run the full backend suite**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test
```

Expected: all green (WorkoutServiceIT 18/18, TrainServiceIT +1, everything else untouched).

- [ ] **Step 8: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add backend/src
git commit -m "feat(train): GET /today with last-week top-set refs and open instance; exclude instances from meso days (mezo-tod)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: HTTP-level contract tests (WorkoutContractIT)

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutContractIT.java`

- [ ] **Step 1: Write the tests**

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.api.dto.WorkoutFeedbackInput;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.WorkoutStartRequest;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the GENERATED T2 workout contract (api/openapi.yml). */
class WorkoutContractIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private OwnerProperties ownerProperties;

    /** Find-or-create yields the demodata-seeded owner's id — the principal behind ownerAuthHeaders(). */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private WorkoutSessionEntity templateDayForToday(UUID owner) {
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Contract T2 meso", "active");
        return trainPopulator.createWorkoutSession(
            owner, meso.getId(), WorkoutServiceIT.todayLabel(), "Pull Day", 0, "planned");
    }

    @Test
    void testGetTodayWorkout_shouldReturn401_whenUnauthenticated() {
        getForBody("/api/train/workouts/today", null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testStartWorkout_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/train/workouts", new WorkoutStartRequest(UUID.randomUUID()),
            null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testLogWorkoutSet_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/train/workouts/" + UUID.randomUUID() + "/sets",
            new SetLogRequest(UUID.randomUUID(), 0, new BigDecimal("100"), 8, 1),
            null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testSaveWorkoutFeedback_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/train/workouts/" + UUID.randomUUID() + "/feedback",
            List.of(new WorkoutFeedbackInput(UUID.randomUUID(), 3, 1, 2)),
            null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testFinishWorkout_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/train/workouts/" + UUID.randomUUID() + "/finish", null,
            null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testGetTodayWorkout_shouldReturnTodayContext_whenGymDayExists() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        trainPopulator.createExercise(owner, template.getId(), "Chest Supported Row", 0);

        WorkoutTodayResponse today = getForBody("/api/train/workouts/today",
            ownerAuthHeaders(), HttpStatus.OK, WorkoutTodayResponse.class);

        assertThat(today.getTemplateSessionId()).isEqualTo(template.getId());
        assertThat(today.getTitle()).isEqualTo("Pull Day");
        assertThat(today.getExercises()).hasSize(1);
    }

    @Test
    void testStartWorkout_shouldReturn201AndResumeOnSecondCall_whenTemplateOwned() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();

        WorkoutInstanceResponse first = postForBody("/api/train/workouts",
            new WorkoutStartRequest(template.getId()), headers, HttpStatus.CREATED, WorkoutInstanceResponse.class);
        WorkoutInstanceResponse second = postForBody("/api/train/workouts",
            new WorkoutStartRequest(template.getId()), headers, HttpStatus.CREATED, WorkoutInstanceResponse.class);

        assertThat(first.getStatus()).isEqualTo(WorkoutInstanceResponse.StatusEnum.ACTIVE);
        assertThat(second.getId()).isEqualTo(first.getId());
    }

    @Test
    void testStartWorkout_shouldReturn404_whenTemplateUnknown() {
        ownerId();
        String body = postForBody("/api/train/workouts", new WorkoutStartRequest(UUID.randomUUID()),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testLogWorkoutSet_shouldReturn400WithFieldError_whenRepsMissing() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = postForBody("/api/train/workouts",
            new WorkoutStartRequest(template.getId()), headers, HttpStatus.CREATED, WorkoutInstanceResponse.class);

        SetLogRequest invalid = new SetLogRequest(exercise.getId(), 0, new BigDecimal("100"), null, 1);
        String body = postForBody("/api/train/workouts/" + started.getId() + "/sets",
            invalid, headers, HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "reps", "VALIDATION_REQUIRED_FIELD");
    }

    @Test
    void testLogWorkoutSet_shouldReturn409_whenWorkoutCompleted() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        WorkoutSessionEntity completed =
            trainPopulator.createWorkoutInstance(owner, template, LocalDate.now(), "completed");

        String body = postForBody("/api/train/workouts/" + completed.getId() + "/sets",
            new SetLogRequest(exercise.getId(), 0, new BigDecimal("100"), 8, 1),
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "TRAIN_WORKOUT_NOT_ACTIVE");
    }

    @Test
    void testSaveWorkoutFeedback_shouldReturn400WithFieldError_whenPumpOutOfRange() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();
        WorkoutInstanceResponse started = postForBody("/api/train/workouts",
            new WorkoutStartRequest(template.getId()), headers, HttpStatus.CREATED, WorkoutInstanceResponse.class);

        String body = postForBody("/api/train/workouts/" + started.getId() + "/feedback",
            List.of(new WorkoutFeedbackInput(exercise.getId(), 5, 1, 2)),
            headers, HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "pump", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testWorkoutFlow_shouldPersistSetsFeedbackAndComplete_whenDrivenOverHttp() {
        UUID owner = ownerId();
        WorkoutSessionEntity template = templateDayForToday(owner);
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        HttpHeaders headers = ownerAuthHeaders();

        WorkoutInstanceResponse started = postForBody("/api/train/workouts",
            new WorkoutStartRequest(template.getId()), headers, HttpStatus.CREATED, WorkoutInstanceResponse.class);
        SetLogRequest set = new SetLogRequest(exercise.getId(), 0, new BigDecimal("102.5"), 9, 2);
        set.setSide("B");
        set.setNote("kontrakt teszt");
        postForBody("/api/train/workouts/" + started.getId() + "/sets",
            set, headers, HttpStatus.CREATED, String.class);
        postForBody("/api/train/workouts/" + started.getId() + "/feedback",
            List.of(new WorkoutFeedbackInput(exercise.getId(), 3, 1, 2)),
            headers, HttpStatus.NO_CONTENT, Void.class);
        WorkoutInstanceResponse finished = postForBody(
            "/api/train/workouts/" + started.getId() + "/finish",
            null, headers, HttpStatus.OK, WorkoutInstanceResponse.class);

        assertThat(finished.getStatus()).isEqualTo(WorkoutInstanceResponse.StatusEnum.COMPLETED);
        assertThat(finished.getSets()).hasSize(1);
        assertThat(finished.getSets().get(0).getSide()).isEqualTo("B");
        assertThat(finished.getSets().get(0).getNote()).isEqualTo("kontrakt teszt");
    }
}
```

(Field-error field names on array bodies may be prefixed by the generator/handler — e.g. `workoutFeedbackInput[0].pump`. If `assertHasFieldError(body, "pump", ...)` fails on the field name, inspect the failure-message body and assert the exact reported `fieldName`. The generated DTO constructors take the `required` fields in declaration order — adjust to setter style if the signature differs.)

- [ ] **Step 2: Run**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dtest=WorkoutContractIT
```

Expected: 12/12 PASS.

- [ ] **Step 3: Full backend suite (both DB modes)**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true
```

Expected: all green in both.

- [ ] **Step 4: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add backend/src/test
git commit -m "test(train): T2 workout contract ITs — 401s, validation, conflict, full HTTP flow (mezo-tod)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: FE data layer — trainApi, MSW, trainHooks (query + mapping + mutations + derived gymSchedule)

**Files:**
- Modify: `frontend/src/lib/trainApi.ts`
- Modify: `frontend/src/data/types.ts`
- Modify: `frontend/src/data/trainHooks.ts`
- Modify: `frontend/src/test/msw/handlers.ts`
- Test: `frontend/src/data/trainHooks.test.tsx`

- [ ] **Step 1: types.ts — lastWeek becomes nullable** (first-ever workout has no last week):

```ts
export interface LoggedWorkoutExercise {
  id: string
  name: string
  sets: number
  targetReps: string
  targetRIR: number
  type: ExerciseKind
  muscle: string
  lastWeek: LastWeekSet | null
}
```

- [ ] **Step 2: MSW defaults** — append to `handlers` in `frontend/src/test/msw/handlers.ts`:

```ts
  // T2 workout-execution endpoints — happy-path defaults; tests override with spies.
  http.get(`${API_BASE}/api/train/workouts/today`, () =>
    HttpResponse.json({
      templateSessionId: 'a1f3a0e2-0000-4000-8000-000000000010',
      dayLabel: 'Csü',
      title: 'Pull Day',
      durationEst: 78,
      exercises: [
        {
          id: 'c1f3a0e2-0000-4000-8000-000000000002', name: 'Chest Supported Row',
          muscle: 'back-mid', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound',
          lastWeek: { weightKg: 102.5, reps: 9, rir: 2 },
        },
      ],
      openWorkout: null,
    }),
  ),
  http.post(`${API_BASE}/api/train/workouts`, () =>
    HttpResponse.json(
      {
        id: 'e1f3a0e2-0000-4000-8000-000000000020',
        templateSessionId: 'a1f3a0e2-0000-4000-8000-000000000010',
        date: '2026-06-12', status: 'active', sets: [],
      },
      { status: 201 },
    ),
  ),
  http.post(`${API_BASE}/api/train/workouts/:id/sets`, ({ params }) =>
    HttpResponse.json(
      { id: 'f1f3a0e2-0000-4000-8000-000000000030', exerciseId: String(params.id), setIndex: 0 },
      { status: 201 },
    ),
  ),
  http.post(`${API_BASE}/api/train/workouts/:id/feedback`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API_BASE}/api/train/workouts/:id/finish`, ({ params }) =>
    HttpResponse.json({
      id: String(params.id),
      templateSessionId: 'a1f3a0e2-0000-4000-8000-000000000010',
      date: '2026-06-12', status: 'completed', sets: [],
    }),
  ),
```

- [ ] **Step 3: Write the failing hook tests** — add to `frontend/src/data/trainHooks.test.tsx`:

```ts
test('useTrain (real mode) maps /today into the WorkoutPlan shape with lastWeek refs', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.workout).not.toBeNull())
  expect(result.current.workout!.title).toBe('Pull Day')
  expect(result.current.workout!.exercises[0].name).toBe('Chest Supported Row')
  expect(result.current.workout!.exercises[0].lastWeek).toEqual({ weight: 102.5, reps: 9, rir: 2 })
  expect(result.current.workout!.challenges).toEqual([]) // AI challenges are Phase 3
  expect(result.current.todaySession).toEqual({
    templateSessionId: 'a1f3a0e2-0000-4000-8000-000000000010',
    openWorkout: null,
  })
})

test('useTrain (real mode) derives the gym weekly schedule from the active meso days', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.gymSchedule).not.toBeNull())
  const rows = result.current.gymSchedule!.weeklyTimes
  expect(rows).toHaveLength(7)
  const csu = rows.find((r) => r.day === 'Csü')!
  expect(csu.active).toBe(true) // the meso fixture's only day with exercises
  expect(csu.type).toBe('Pull')
  expect(rows.filter((r) => r.active)).toHaveLength(1)
})

test('useTrain (real mode) workout write mutations hit the T2 endpoints', async () => {
  const calls: string[] = []
  server.use(
    http.post(`${API_BASE}/api/train/workouts`, async ({ request }) => {
      const body = (await request.json()) as { templateSessionId: string }
      calls.push(`start:${body.templateSessionId}`)
      return HttpResponse.json(
        { id: 'w-1', templateSessionId: body.templateSessionId, date: '2026-06-12', status: 'active', sets: [] },
        { status: 201 },
      )
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/sets`, ({ params }) => {
      calls.push(`set:${params.id}`)
      return HttpResponse.json({ id: 'st-1', exerciseId: 'ex-1', setIndex: 0 }, { status: 201 })
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/feedback`, ({ params }) => {
      calls.push(`feedback:${params.id}`)
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/finish`, ({ params }) => {
      calls.push(`finish:${params.id}`)
      return HttpResponse.json({ id: String(params.id), templateSessionId: 't-1', date: '2026-06-12', status: 'completed', sets: [] })
    }),
  )
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  const started = vi.fn()
  result.current.startWorkout('t-1', { onSuccess: started })
  await waitFor(() => expect(started).toHaveBeenCalled())
  expect(started.mock.calls[0][0].id).toBe('w-1')
  result.current.logSet('w-1', { exerciseId: 'ex-1', setIndex: 0, weightKg: 102.5, reps: 9, rir: 2 })
  result.current.saveWorkoutFeedback('w-1', [{ exerciseId: 'ex-1', pump: 3, jointPain: 1, workload: 2 }])
  result.current.finishWorkout('w-1')
  await waitFor(() =>
    expect(calls).toEqual(expect.arrayContaining(['start:t-1', 'set:w-1', 'feedback:w-1', 'finish:w-1'])),
  )
})
```

Also UPDATE the existing `returns nulls (no static fallback) when the backend is empty` test: add a `/today` override so "empty backend" stays truthful now that a default fixture exists, and assert the derived gymSchedule stays null:

```ts
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
  )
```

(the assertions in that test stay as they are — `workout` null, `gymSchedule` null, etc.; add `expect(result.current.todaySession).toBeNull()`.)

And the existing mesocycles fixture in `handlers.ts` needs an `id` on its day (deriveGymSchedule does not need it, but the day-fixture should mirror the real contract now) — add `id: 'a1f3a0e2-0000-4000-8000-000000000010'` to the `days[0]` object of the GET mesocycles fixture.

- [ ] **Step 4: Run to verify failure**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test src/data/trainHooks.test.tsx
```

Expected: FAIL — `workout` is null in real mode, `todaySession`/`startWorkout` don't exist.

- [ ] **Step 5: trainApi growth** — extend `frontend/src/lib/trainApi.ts`:

```ts
export type WorkoutTodayResponse = components['schemas']['WorkoutTodayResponse']
export type WorkoutInstanceResponse = components['schemas']['WorkoutInstanceResponse']
export type WorkoutStartRequest = components['schemas']['WorkoutStartRequest']
export type SetLogRequest = components['schemas']['SetLogRequest']
export type ExerciseSetResponse = components['schemas']['ExerciseSetResponse']
export type WorkoutFeedbackInput = components['schemas']['WorkoutFeedbackInput']
```

and inside the `trainApi` object:

```ts
  workoutToday: (): Promise<WorkoutTodayResponse> =>
    apiFetch<WorkoutTodayResponse>('/api/train/workouts/today'),
  startWorkout: (templateSessionId: string): Promise<WorkoutInstanceResponse> =>
    apiFetch<WorkoutInstanceResponse>('/api/train/workouts', {
      method: 'POST',
      body: JSON.stringify({ templateSessionId } satisfies WorkoutStartRequest),
    }),
  logSet: (workoutId: string, body: SetLogRequest): Promise<ExerciseSetResponse> =>
    apiFetch<ExerciseSetResponse>(`/api/train/workouts/${workoutId}/sets`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  saveWorkoutFeedback: (workoutId: string, body: WorkoutFeedbackInput[]): Promise<void> =>
    apiFetch<void>(`/api/train/workouts/${workoutId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  finishWorkout: (workoutId: string): Promise<WorkoutInstanceResponse> =>
    apiFetch<WorkoutInstanceResponse>(`/api/train/workouts/${workoutId}/finish`, { method: 'POST' }),
```

- [ ] **Step 6: trainHooks growth** — in `frontend/src/data/trainHooks.ts`:

New imports: `DAY_ORDER` from `'./train'`, the new types from `'@/lib/trainApi'` (`SetLogRequest`, `WorkoutFeedbackInput`, `WorkoutInstanceResponse`, `WorkoutTodayResponse`), and `WorkoutPlan` is already imported.

Mapping helpers (below `toSportSession`):

```ts
// /today -> the Phase-1 WorkoutPlan shape. AI extras (challenges, niggleWarning)
// are Phase 3 — empty/absent in real mode. `tag` is display-derived elsewhere.
function toWorkoutPlan(r: WorkoutTodayResponse | null | undefined): WorkoutPlan | null {
  if (!r?.templateSessionId || !r.exercises?.length) return null
  return {
    title: r.title ?? '',
    tag: '',
    durationEst: r.durationEst ?? 0,
    exercises: r.exercises.map((e) => ({
      id: e.id, name: e.name, muscle: e.muscle, sets: e.sets,
      targetReps: e.targetReps, targetRIR: e.targetRIR, type: e.type,
      lastWeek: e.lastWeek
        ? { weight: Number(e.lastWeek.weightKg), reps: e.lastWeek.reps, rir: e.lastWeek.rir }
        : null,
    })),
    challenges: [],
  }
}

// Gym weekly row derived from the active meso's template days (no schedule
// template in Phase 2 — FR-2.1.12 is out of scope, so time/duration are null).
function deriveGymSchedule(meso: Mesocycle | null): GymSchedule | null {
  const days = meso?.days
  if (!days?.length) return null
  const todayLabel = DAY_ORDER[(new Date().getDay() + 6) % 7]
  return {
    weeklyTimes: DAY_ORDER.map((d) => {
      const md = days.find((x) => x.day === d && x.exerciseCount > 0)
      return md
        ? { day: d, type: md.type, time: null, duration: null, active: true, today: d === todayLabel }
        : { day: d, type: null, time: null, duration: null, active: false }
    }),
  }
}
```

Extend the `TrainData` type:

```ts
  todaySession: { templateSessionId: string; openWorkout: WorkoutInstanceResponse | null } | null
  startWorkout: (templateSessionId: string, opts?: { onSuccess?: (w: WorkoutInstanceResponse) => void }) => void
  logSet: (workoutId: string, set: SetLogRequest) => void
  saveWorkoutFeedback: (workoutId: string, items: WorkoutFeedbackInput[]) => void
  finishWorkout: (workoutId: string) => void
```

Inside `useTrain()` add the query (after the sportSessions query):

```ts
  const { data: todayData } = useQuery({
    queryKey: ['train', 'workoutToday'],
    queryFn: mock ? async () => null : () => trainApi.workoutToday(),
    initialData: mock ? null : undefined,
  })
```

Mutations (mock no-ops, real persists + refetches /today so a reload resumes correctly):

```ts
  const invalidateToday = () => {
    if (!mock) qc.invalidateQueries({ queryKey: ['train', 'workoutToday'] })
  }
  const startMutation = useMutation<WorkoutInstanceResponse | undefined, Error, string>({
    mutationFn: mock ? async () => undefined : (templateSessionId) => trainApi.startWorkout(templateSessionId),
    onSuccess: invalidateToday,
  })
  const logSetMutation = useMutation({
    mutationFn: mock
      ? async (_args: { workoutId: string; set: SetLogRequest }) => undefined
      : (args: { workoutId: string; set: SetLogRequest }) => trainApi.logSet(args.workoutId, args.set),
    onSuccess: invalidateToday,
  })
  const feedbackMutation = useMutation({
    mutationFn: mock
      ? async (_args: { workoutId: string; items: WorkoutFeedbackInput[] }) => undefined
      : (args: { workoutId: string; items: WorkoutFeedbackInput[] }) =>
          trainApi.saveWorkoutFeedback(args.workoutId, args.items),
  })
  const finishMutation = useMutation({
    mutationFn: mock ? async (_id: string) => undefined : (id: string) => trainApi.finishWorkout(id),
    onSuccess: invalidateToday,
  })

  const startWorkout = useCallback(
    (templateSessionId: string, opts?: { onSuccess?: (w: WorkoutInstanceResponse) => void }) =>
      startMutation.mutate(templateSessionId, {
        onSuccess: (w) => { if (w) opts?.onSuccess?.(w) },
      }),
    [startMutation],
  )
  const logSet = useCallback(
    (workoutId: string, set: SetLogRequest) => logSetMutation.mutate({ workoutId, set }),
    [logSetMutation],
  )
  const saveWorkoutFeedback = useCallback(
    (workoutId: string, items: WorkoutFeedbackInput[]) => feedbackMutation.mutate({ workoutId, items }),
    [feedbackMutation],
  )
  const finishWorkout = useCallback(
    (workoutId: string) => finishMutation.mutate(workoutId),
    [finishMutation],
  )
```

Return-shape changes (replace the T1 placeholder lines):

```ts
  const realActiveMeso = mesos.find((m) => m.status === 'active') ?? null
  return {
    mesocycles: mesos,
    activeMeso: realActiveMeso ?? (mock ? activeMeso : null),
    workout: mock ? trainWorkout : toWorkoutPlan(todayData),
    gymSchedule: mock ? trainGymSchedule : deriveGymSchedule(realActiveMeso),
    todaySession: !mock && todayData?.templateSessionId
      ? { templateSessionId: todayData.templateSessionId, openWorkout: todayData.openWorkout ?? null }
      : null,
    ...
```

(keep `sport`, `exerciseLibrary`, the T1 mutations and `mesoMutationPending` exactly as they are; just add the new keys.)

- [ ] **Step 7: Run hook tests + both-mode suite**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test src/data/trainHooks.test.tsx
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: hook tests pass; full suite may surface view-test fallout ONLY if a view consumed the changed keys — fix forward in Tasks 9–10 if the failure is in TrainTodayView/ActiveWorkoutScreen tests, otherwise nothing else may break here.

- [ ] **Step 8: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add frontend/src
git commit -m "feat(train-fe): /today query, workout mutations, derived gym schedule in useTrain (mezo-tod)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: TrainTodayView real mode + WeeklyDayRow guards

**Files:**
- Modify: `frontend/src/features/train/views/TrainTodayView.tsx`
- Modify: `frontend/src/features/train/components/WeeklyDayRow.tsx`
- Modify: `frontend/src/features/train/train.emptyStates.test.tsx`
- Test: `frontend/src/features/train/views/TrainTodayView.test.tsx`

- [ ] **Step 1: Write the failing tests** — add to `TrainTodayView.test.tsx` (mirror the file's existing render helper; if it renders in mock mode today, add a real-mode block):

```tsx
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { DAY_ORDER } from '@/data/train'

const todayLabel = () => DAY_ORDER[(new Date().getDay() + 6) % 7]

// Real-mode: the weekly agenda derives from the active meso; today's gym day
// surfaces the /today workout with the start CTA.
test('real mode renders the today card and agenda from the active meso + /today', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () =>
      HttpResponse.json([{
        id: 'm-1', title: 'T2 meso', shortTitle: 'T2', status: 'active',
        startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 2,
        split: 'Pull / Push · 2×/hét', style: 'RP · 6 hét', phaseCurve: ['MEV', 'MAV'],
        days: [{
          id: 'd-1', day: todayLabel(), type: 'Pull Day', muscle: 'back', exerciseCount: 1,
          exercises: [{ id: 'e-1', name: 'Row', muscle: 'back', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound' }],
        }],
      }]),
    ),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () =>
      HttpResponse.json({
        templateSessionId: 'd-1', dayLabel: todayLabel(), title: 'Pull Day', durationEst: 0,
        exercises: [{ id: 'e-1', name: 'Row', muscle: 'back', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound' }],
        openWorkout: null,
      }),
    ),
  )
  renderToday() // the file's existing helper that mounts TrainTodayView with QueryWrapper+router
  expect(await screen.findByRole('button', { name: /Indítsuk/ })).toBeInTheDocument()
  expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0)
  expect(screen.getByText(/1 session/)).toBeInTheDocument() // agenda count: 1 gym day, no volleyball yet
})

test('real mode shows the rest-day note when /today is empty but a meso is active', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () =>
      HttpResponse.json([{
        id: 'm-1', title: 'T2 meso', shortTitle: 'T2', status: 'active',
        startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 2,
        split: 'Pull / Push · 2×/hét', style: 'RP · 6 hét', phaseCurve: ['MEV', 'MAV'],
        days: [{ id: 'd-2', day: 'NEMNAP', type: 'Pull Day', muscle: 'back', exerciseCount: 1, exercises: [] }],
      }]),
    ),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
  )
  renderToday()
  expect(await screen.findByText(/Ma pihenőnap/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Indítsuk/ })).not.toBeInTheDocument()
})
```

(Adapt the imports/`renderToday` helper to the file's existing structure — keep the existing mock-mode tests untouched. `vi.unstubAllEnvs()` must run in `afterEach`, matching the file's pattern.)

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test src/features/train/views/TrainTodayView.test.tsx
```

Expected: FAIL — the current guard ghosts the whole view when `sport.schedule` is null.

- [ ] **Step 3: Restructure TrainTodayView**

In `TrainTodayView.tsx`:

(a) The ghost guard shrinks to **no active meso only**:

```tsx
  // T0/T2: without an active meso the whole view ghosts. With one, the agenda
  // derives from the meso (gymSchedule) and /today drives the hero card;
  // volleyball columns stay empty until T3 (sport.schedule is null until then).
  if (!activeMeso) {
    return (
      <>
        <div className="page-header">
          <div className="col gap-xs">
            <Eyebrow brand>Train · Mai</Eyebrow>
            <PageTitle>Edzés</PageTitle>
          </div>
        </div>
        <div style={{ padding: '0 24px 12px' }}>
          <GhostState
            lines={4}
            message="Itt fog élni a mai edzésed — előbb tervezz egy mesociklust."
            ctaLabel="+ Tervezz mesociklust"
            onCta={() => navigate('/train/mesocycles/new')}
          />
        </div>
        <div style={{ padding: '0 24px 16px' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="eyebrow">Heti terv · gym + sport</span>
          </div>
          <GhostState lines={2} message="A heti rended itt jelenik majd meg." />
        </div>
      </>
    )
  }
```

(b) Null-tolerant agenda sources:

```tsx
  const gymTimes = gymSchedule?.weeklyTimes ?? []
  const vbSessions = sport.schedule?.volleyball.sessions ?? []
```

(c) The today gym card requires BOTH the agenda slot and the /today workout; `totalSets` moves inside; null-safe time/duration label; the `~p` chip hides at 0:

```tsx
      {todayHasGym && workout && (
        <div style={{ padding: '0 24px 12px' }}>
          <div className="card notch-12" style={{ padding: 18 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="col">
                <span className="eyebrow brand">Week {activeMeso.currentWeek} · {currentPhase}</span>
                <div style={{ marginTop: 8 }}>
                  <Display size="lg">{workout.title}</Display>
                </div>
                {(todayHasGym.time || todayHasGym.duration) && (
                  <span className="label-mono text-tertiary mt-sm" style={{ fontSize: 10 }}>
                    {[todayHasGym.time, todayHasGym.duration ? `${todayHasGym.duration}p` : null]
                      .filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
              <span className="chip brand notch-4" style={{ fontSize: 9 }}>MA</span>
            </div>
            <div className="row gap-sm mt-md">
              <span className="chip notch-4">{workout.exercises.length} gyakorlat</span>
              <span className="chip notch-4">{workout.exercises.reduce((acc, e) => acc + e.sets, 0)} szet</span>
              {workout.durationEst > 0 && <span className="chip notch-4">~{workout.durationEst}p</span>}
            </div>
            <CtaPrimary className="mt-md" onClick={startWorkout}>
              <span>Indítsuk</span>
              <span style={{ opacity: 0.5, fontWeight: 400 }}>·</span>
              <span>{workout.title}</span>
            </CtaPrimary>
          </div>
        </div>
      )}

      {/* Rest day (real mode): no gym slot and no volleyball today */}
      {!todayHasGym && !todayHasVb && (
        <div style={{ padding: '0 24px 12px' }}>
          <div className="card notch-12" style={{ padding: 18 }}>
            <span className="eyebrow">Ma pihenőnap</span>
            <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Nincs tervezett edzés mára — a heti rended lent találod.
            </p>
          </div>
        </div>
      )}
```

(d) Rename the local `const startWorkout = () => navigate('/train/session')` to `const openSession = () => navigate('/train/session')` and update both call sites (`onClick={openSession}`, `onStartGym={openSession}`) — the name now collides with the hook mutation. The `currentPhase`/`tag` line stays derived from `activeMeso` as today. Remove the now-unused `totalSets` top-level computation and keep everything else (volleyball block, agenda map, note, SportLogSheet) unchanged.

(e) `currentPhase` guard for `currentWeek` ≥ 1 stays as-is (`phaseCurve[activeMeso.currentWeek - 1]`).

- [ ] **Step 4: WeeklyDayRow null guards** — in the gym button of `WeeklyDayRow.tsx`:

```tsx
                <div className="row gap-xs" style={{ alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 500 }}>{gym.type}</span>
                  {gym.time && (
                    <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>· {gym.time}</span>
                  )}
                </div>
                <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 9 }}>
                  {gym.duration ? `${gym.duration}p · gym` : 'gym'}
                </span>
```

- [ ] **Step 5: emptyStates coherence** — in `train.emptyStates.test.tsx`'s `beforeEach`, add the /today override so "empty backend" includes the new endpoint:

```ts
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
```

- [ ] **Step 6: Run the tests in both modes**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test src/features/train
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && VITE_USE_MOCK=true pnpm test src/features/train
```

Expected: PASS — including the untouched mock-mode TrainTodayView tests (mock data still has time/duration, so the rendered output is byte-identical there).

- [ ] **Step 7: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add frontend/src
git commit -m "feat(train-fe): TrainTodayView real-mode agenda from meso days, rest-day state, null-safe rows (mezo-tod)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: ActiveWorkoutScreen wiring (start/resume/logSet/side/note/feedback/finish)

**Files:**
- Modify: `frontend/src/features/train/ActiveWorkoutScreen.tsx`
- Modify: `frontend/src/features/train/components/FeedbackModal.tsx`
- Modify: `frontend/src/features/train/components/ChallengesCarousel.tsx`
- Test: `frontend/src/features/train/ActiveWorkoutScreen.test.tsx`

- [ ] **Step 1: Write the failing real-mode tests** — add to `ActiveWorkoutScreen.test.tsx` (keep the 5 mock-mode tests untouched; they pin Phase-1 behavior):

```tsx
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// ---- real-mode block: the session drives the T2 write endpoints ----

const REAL_MESO = {
  id: 'm-1', title: 'T2 meso', shortTitle: 'T2', status: 'active',
  startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 2,
  split: 'Pull / Push · 2×/hét', style: 'RP · 6 hét', phaseCurve: ['MEV', 'MAV'],
}
const REAL_TODAY = {
  templateSessionId: 'd-1', dayLabel: 'Ma', title: 'Pull Day', durationEst: 60,
  exercises: [
    { id: 'e-1', name: 'Chest Supported Row', muscle: 'back', sets: 2, targetReps: '8-10', targetRIR: 1, type: 'compound', lastWeek: { weightKg: 102.5, reps: 9, rir: 2 } },
  ],
  openWorkout: null,
}

function useRealHandlers(today: typeof REAL_TODAY | Record<string, never>, calls: string[]) {
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([REAL_MESO])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json(today)),
    http.post(`${API_BASE}/api/train/workouts`, async ({ request }) => {
      const body = (await request.json()) as { templateSessionId: string }
      calls.push(`start:${body.templateSessionId}`)
      return HttpResponse.json({ id: 'w-1', templateSessionId: body.templateSessionId, date: '2026-06-12', status: 'active', sets: [] }, { status: 201 })
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/sets`, async ({ params, request }) => {
      const body = (await request.json()) as { exerciseId: string; setIndex: number; weightKg: number }
      calls.push(`set:${params.id}:${body.exerciseId}:${body.setIndex}:${body.weightKg}`)
      return HttpResponse.json({ id: 'st-' + body.setIndex, exerciseId: body.exerciseId, setIndex: body.setIndex }, { status: 201 })
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/feedback`, async ({ params }) => {
      calls.push(`feedback:${params.id}`)
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${API_BASE}/api/train/workouts/:id/finish`, ({ params }) => {
      calls.push(`finish:${params.id}`)
      return HttpResponse.json({ id: String(params.id), templateSessionId: 'd-1', date: '2026-06-12', status: 'completed', sets: [] })
    }),
  )
}

test('real mode: starting creates the instance and Set kész posts the set', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(REAL_TODAY, calls)
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(screen.getByText('Set kész'))
  await waitFor(() => expect(calls).toContain('set:w-1:e-1:0:102.5')) // prefill = last week
})

test('real mode: an open instance resumes mid-workout with seeded sets', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    {
      ...REAL_TODAY,
      openWorkout: {
        id: 'w-9', templateSessionId: 'd-1', date: '2026-06-12', status: 'active',
        sets: [{ id: 's-1', exerciseId: 'e-1', setIndex: 0, weightKg: 100, reps: 8, rir: 2 }],
      },
    },
    calls,
  )
  const user = userEvent.setup()
  setup()
  // no prep screen — jumps straight into the active phase at set 2
  expect(await screen.findByText('Set kész')).toBeInTheDocument()
  expect(screen.getByText(/Set 2\//)).toBeInTheDocument()
  await user.click(screen.getByText('Set kész'))
  await waitFor(() => expect(calls.some((c) => c.startsWith('set:w-9:e-1:1'))).toBe(true))
})

test('real mode: the last set debrief persists feedback and finish fires', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const calls: string[] = []
  useRealHandlers(
    { ...REAL_TODAY, exercises: [{ ...REAL_TODAY.exercises[0], sets: 1 }] },
    calls,
  )
  const user = userEvent.setup()
  setup()
  await user.click(await screen.findByText(/Kezdjük el/))
  await waitFor(() => expect(calls).toContain('start:d-1'))
  await user.click(screen.getByText('Set kész')) // only set -> FeedbackModal
  await user.click(await screen.findByText('Edzés vége →'))
  await waitFor(() => expect(calls).toContain('feedback:w-1'))
  await waitFor(() => expect(calls).toContain('finish:w-1'))
  expect(await screen.findByText(/Edzés vége ·/)).toBeInTheDocument() // WorkoutComplete
})
```

(The FeedbackModal close animation is async — `await screen.findBy...` / `waitFor` everywhere a Sheet closes, per the Sheet house memory.)

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test src/features/train/ActiveWorkoutScreen.test.tsx
```

Expected: real-mode tests FAIL (no start call is made; resume not implemented).

- [ ] **Step 3: ChallengesCarousel empty guard** — first line of the component body:

```tsx
  // Real mode has no AI challenges until Phase 3 — render nothing instead of an empty rail.
  if (challenges.length === 0) return null
```

Wait — `useState`/`useRef` are above; place the guard AFTER the hook calls so the hook order stays render-stable:

```tsx
  const acceptedCount = Object.values(accepted).filter(Boolean).length
  if (challenges.length === 0) return null
```

- [ ] **Step 4: FeedbackModal — lift values + onSave**

Replace `FeedbackRow` with a controlled version and thread the three values:

```tsx
function FeedbackRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: number
  onChange: (idx: number) => void
}) {
  return (
    <div className="col gap-sm">
      <span className="label-mono">{label}</span>
      <div className="row gap-xs">
        {options.map((o, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={value === i}
            className={'chip flex-1 ' + (value === i ? 'brand' : '')}
            style={{ justifyContent: 'center', padding: '10px 6px', fontSize: 11 }}
            onClick={() => onChange(i)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

export interface ExerciseFeedbackValues {
  pump: number // 1–4
  jointPain: number // 1–3
  workload: number // 1–3
}

export function FeedbackModal({
  ex,
  isLastExercise,
  onResolve,
  onSave,
}: {
  ex: LoggedWorkoutExercise
  isLastExercise: boolean
  // Both skip and save (and any Sheet dismissal — backdrop / drag / esc)
  // resolve the same way: advance the workout. Feedback is non-blocking;
  // only the explicit save button persists (onSave fires with 1-based scales).
  onResolve: () => void
  onSave?: (values: ExerciseFeedbackValues) => void
}) {
  const [pump, setPump] = useState(2)
  const [joint, setJoint] = useState(0)
  const [workload, setWorkload] = useState(1)
  const resolved = useRef(false)
  const resolveOnce = () => {
    if (resolved.current) return
    resolved.current = true
    onResolve()
  }

  return (
    <Sheet onClose={resolveOnce}>
      {(close) => (
        <>
          <div className="col">
            <Eyebrow brand>Set debrief · RP feedback</Eyebrow>
            <div style={{ marginTop: 6 }}>
              <Display size="md">{ex.name}</Display>
            </div>
          </div>
          <div className="col gap-lg mt-lg">
            <FeedbackRow label="Pump · érzed?" options={['Semmi', 'Enyhe', 'Jó', 'Brutális']} value={pump} onChange={setPump} />
            <FeedbackRow label="Joint pain" options={['Nincs', 'Enyhe', 'Erős']} value={joint} onChange={setJoint} />
            <FeedbackRow label="Akarunk még?" options={['Kevés volt', 'Pont jó', 'Sok volt']} value={workload} onChange={setWorkload} />
          </div>
          <div className="row gap-sm mt-xl">
            <CtaGhost className="notch-4 flex-1" onClick={close}>
              Hagyjuk
            </CtaGhost>
            <CtaPrimary
              className="notch-4 flex-1"
              onClick={() => {
                onSave?.({ pump: pump + 1, jointPain: joint + 1, workload: workload + 1 })
                close()
              }}
            >
              {isLastExercise ? 'Edzés vége →' : 'Mentés · tovább'}
            </CtaPrimary>
          </div>
        </>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 5: ActiveWorkoutScreen wiring**

(a) Wrapper passes the T2 pieces (and hardens the empty-exercise edge):

```tsx
export function ActiveWorkoutScreen() {
  const { workout, activeMeso, todaySession, startWorkout, logSet, saveWorkoutFeedback, finishWorkout } = useTrain()
  // T0 clean slate: never render the session without a workout (and at least one exercise).
  if (!workout || workout.exercises.length === 0 || !activeMeso) return <Navigate to="/train" replace />
  return (
    <ActiveWorkoutSession
      workout={workout}
      activeMeso={activeMeso}
      todaySession={todaySession}
      startWorkout={startWorkout}
      logSet={logSet}
      saveWorkoutFeedback={saveWorkoutFeedback}
      finishWorkout={finishWorkout}
    />
  )
}
```

(b) Session props + prefill helper + resume seeding (new imports: `useMemo` from react; `SetLogRequest`, `WorkoutFeedbackInput`, `WorkoutInstanceResponse` types from `@/lib/trainApi`; `LoggedWorkoutExercise` from `@/data/types`):

```tsx
type Side = 'L' | 'B' | 'R'

interface SessionProps {
  workout: WorkoutPlan
  activeMeso: Mesocycle
  todaySession: { templateSessionId: string; openWorkout: WorkoutInstanceResponse | null } | null
  startWorkout: (templateSessionId: string, opts?: { onSuccess?: (w: WorkoutInstanceResponse) => void }) => void
  logSet: (workoutId: string, set: SetLogRequest) => void
  saveWorkoutFeedback: (workoutId: string, items: WorkoutFeedbackInput[]) => void
  finishWorkout: (workoutId: string) => void
}

// First-ever workout has no last week: prefill from the exercise targets instead.
function prefill(e: LoggedWorkoutExercise): LastWeekSet {
  return e.lastWeek ?? { weight: 0, reps: parseInt(e.targetReps, 10) || 10, rir: e.targetRIR }
}

// Resume: rebuild the local completed-set map (+cursor) from the open instance's logged sets.
function seedFromOpen(open: WorkoutInstanceResponse | null, exercises: LoggedWorkoutExercise[]) {
  if (!open) return { completed: {} as CompletedSets, exerciseIdx: 0, setIdx: 0, phase: 'prep' as Phase }
  const completed: CompletedSets = {}
  for (const s of open.sets) {
    const i = exercises.findIndex((e) => e.id === s.exerciseId)
    if (i < 0) continue
    const k = 'ex' + i
    completed[k] = [...(completed[k] ?? []), { weight: Number(s.weightKg ?? 0), reps: s.reps ?? 0, rir: s.rir ?? 0 }]
  }
  let exerciseIdx = exercises.findIndex((e, i) => (completed['ex' + i]?.length ?? 0) < e.sets)
  if (exerciseIdx < 0) exerciseIdx = exercises.length - 1
  const setIdx = Math.min(completed['ex' + exerciseIdx]?.length ?? 0, exercises[exerciseIdx].sets - 1)
  return { completed, exerciseIdx, setIdx, phase: 'active' as Phase }
}

function ActiveWorkoutSession({
  workout, activeMeso, todaySession, startWorkout, logSet, saveWorkoutFeedback, finishWorkout,
}: SessionProps) {
```

(c) Replace the state initialization block:

```tsx
  const open = todaySession?.openWorkout ?? null
  // Seed once on mount — resume mid-workout after a reload lands in 'active'.
  const seeded = useMemo(() => seedFromOpen(open, W.exercises), []) // eslint-disable-line react-hooks/exhaustive-deps
  const startPrefill = prefill(W.exercises[seeded.exerciseIdx])

  const [phase, setPhase] = useState<Phase>(seeded.phase)
  const [exerciseIdx, setExerciseIdx] = useState(seeded.exerciseIdx)
  const [setIdx, setSetIdx] = useState(seeded.setIdx)
  const [weight, setWeight] = useState(startPrefill.weight)
  const [reps, setReps] = useState(startPrefill.reps)
  const [rir, setRir] = useState(startPrefill.rir)
  const [completedSets, setCompletedSets] = useState<CompletedSets>(seeded.completed)
  const [workoutId, setWorkoutId] = useState<string | null>(open?.id ?? null)
  const [side, setSide] = useState<Side | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
```

(delete the old `const firstLastWeek = W.exercises[0].lastWeek` line — `prefill` replaces every use; the PR-toast delta below switches to `W.exercises[0].lastWeek` guarded.)

(d) Start CTA — replace `onClick={() => setPhase('active')}`:

```tsx
  const beginWorkout = () => {
    if (!todaySession) {
      setPhase('active') // mock mode keeps the Phase-1 local behavior
      return
    }
    startWorkout(todaySession.templateSessionId, {
      onSuccess: (w) => {
        setWorkoutId(w.id)
        setPhase('active')
      },
    })
  }
```

```tsx
          <CtaPrimary onClick={beginWorkout}>
```

(e) completeSet — persist + PR guard + note reset:

```tsx
  const completeSet = () => {
    const k = 'ex' + exerciseIdx
    setCompletedSets((prev) => ({
      ...prev,
      [k]: [...(prev[k] ?? []), { weight, reps, rir }],
    }))
    if (workoutId) {
      logSet(workoutId, {
        exerciseId: ex.id, setIndex: setIdx, weightKg: weight, reps, rir,
        ...(side ? { side } : {}), ...(note.trim() ? { note: note.trim() } : {}),
      })
    }
    setNote('')

    // PR demo: only set 3 of the first exercise at/above the threshold counts,
    // and only when a last-week reference exists to compare against.
    const firstLastWeek = W.exercises[0].lastWeek
    if (exerciseIdx === 0 && setIdx === 2 && firstLastWeek && weight >= PR_DEMO_THRESHOLD_KG) {
      setShowPR({
        delta: (weight - firstLastWeek.weight).toFixed(1),
        prev: firstLastWeek.weight,
        prevReps: firstLastWeek.reps,
      })
    }

    if (setIdx + 1 >= ex.sets) {
      setShowFeedback(true)
    } else {
      setSetIdx(setIdx + 1)
    }
  }
```

(f) advance + feedback + finish:

```tsx
  const saveFeedback = (vals: ExerciseFeedbackValues) => {
    if (workoutId) saveWorkoutFeedback(workoutId, [{ exerciseId: ex.id, ...vals }])
  }

  const advanceAfterFeedback = () => {
    setShowFeedback(false)
    setSide(null)
    if (exerciseIdx + 1 < W.exercises.length) {
      const next = prefill(W.exercises[exerciseIdx + 1])
      setExerciseIdx(exerciseIdx + 1)
      setSetIdx(0)
      setWeight(next.weight)
      setReps(next.reps)
      setRir(next.rir)
    } else {
      if (workoutId) finishWorkout(workoutId)
      setPhase('complete')
    }
  }
```

```tsx
        <FeedbackModal
          ex={ex}
          isLastExercise={exerciseIdx + 1 >= W.exercises.length}
          onResolve={advanceAfterFeedback}
          onSave={saveFeedback}
        />
```

(import `ExerciseFeedbackValues` from `./components/FeedbackModal`.)

(g) "Múlt hét" hero block renders only with a reference — wrap it:

```tsx
            {ex.lastWeek && (
              <div className="mt-lg" style={{ ... }}>  {/* the existing block, unchanged inside */}
```

and in the history rows: `const delta = ex.lastWeek ? s.weight - ex.lastWeek.weight : 0`.

(h) Side buttons go live (isolation block):

```tsx
                    {(['L', 'B', 'R'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={side === s}
                        className={'chip' + (side === s ? ' brand' : '')}
                        style={{ fontSize: 9, padding: '5px 8px' }}
                        onClick={() => setSide(side === s ? null : s)}
                      >
                        {s}
                      </button>
                    ))}
```

(i) Note chip goes live (tool row):

```tsx
            <button
              type="button"
              className={'chip flex-1' + (noteOpen ? ' brand' : '')}
              style={{ justifyContent: 'center', padding: '8px', fontSize: 9 }}
              onClick={() => setNoteOpen(!noteOpen)}
            >
              <Icon name="tool" size={11} /> Note
            </button>
```

and under the tool row:

```tsx
        {noteOpen && (
          <div style={{ padding: '8px 24px 0' }}>
            <input
              aria-label="Szet megjegyzés"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Megjegyzés a következő szethez"
              style={{ width: '100%', fontSize: 13, padding: '10px 12px', background: 'var(--surface-2)' }}
            />
          </div>
        )}
```

(90s and Voice chips stay inert — Phase 3.)

- [ ] **Step 6: Run all Train tests in both modes**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test src/features/train src/data
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && VITE_USE_MOCK=true pnpm test src/features/train src/data
```

Expected: PASS — the 5 mock-mode ActiveWorkoutScreen tests still pin Phase-1 behavior (no todaySession in mock → `beginWorkout` falls through to `setPhase('active')`, mutations no-op).

- [ ] **Step 7: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add frontend/src
git commit -m "feat(train-fe): live workout session — start/resume, set+side+note logging, RP feedback, finish (mezo-tod)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Full gates + spec as-built note

**Files:**
- Modify: `docs/superpowers/specs/2026-06-11-train-write-clean-slate-design.md` (feedback-column deviation note)

- [ ] **Step 1: Spec as-built note** — in the data-model section, change the `exercise_feedback` bullet to:

```markdown
- **New `exercise_feedback`:** `workout_session_id` (instance, FK CASCADE), `exercise_id`
  (FK), **as built (T2):** `pump` smallint 1–4, `joint_pain` smallint 1–3, `workload`
  smallint 1–3 (the shipped FeedbackModal asks pump/joint/“Akarunk még?” — RP workload —
  so the planned `soreness` column became `workload`, and pump carries 4 options),
  house columns, UNIQUE (workout_session_id, exercise_id).
```

- [ ] **Step 2: Run every gate**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm test
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && VITE_USE_MOCK=true pnpm test
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm build
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm parity
```

Expected: backend green in BOTH DB modes; FE green in BOTH modes; build clean; parity 45/45 (mock mode untouched).

- [ ] **Step 3: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add docs/superpowers/specs/2026-06-11-train-write-clean-slate-design.md
git commit -m "docs(spec): T2 as-built note — exercise_feedback pump/joint_pain/workload scales (mezo-tod)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Live browser smoke + merge + push

No new code — runtime verification through the real UI (the T1 invariant bug was ONLY caught here), then finishing.

- [ ] **Step 1: Start the stack**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && docker compose up -d
cd /Users/daniel.kuhne/MrKuhne/mezo/backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata   # owner only, clean slate
cd /Users/daniel.kuhne/MrKuhne/mezo/frontend && pnpm dev   # real mode by default on :5180
```

- [ ] **Step 2: Drive the flow in the browser** (chrome-devtools MCP; use `evaluate_script` DOM `.click()` by textContent — `take_snapshot` uids go stale):

1. Login-bootstrapped app on a clean slate → Train Mai shows the ghost hero.
2. Create a meso in the wizard with **today as a gym day** (the generated template includes today), "Aktiválás most".
3. Mai: today's card appears with "Indítsuk · …" → start → prep screen → "Kezdjük el".
4. Log 2 sets (adjust weight; on an isolation exercise tap a side chip; add a note via the Note chip).
5. **Reload the page mid-workout** → /train/session re-entered via Mai → the session resumes at the correct set count (openWorkout seeding).
6. Finish the remaining sets → FeedbackModal "Mentés · tovább"/"Edzés vége →" → WorkoutComplete renders.
7. Verify in the DB:

```bash
docker exec -i mezo_pg psql -U mezo -d mezo -c "SELECT status, date, template_session_id IS NOT NULL AS is_instance FROM workout_session WHERE date IS NOT NULL;"
docker exec -i mezo_pg psql -U mezo -d mezo -c "SELECT set_index, weight_kg, reps, rir, side, note FROM exercise_set ORDER BY created_at;"
docker exec -i mezo_pg psql -U mezo -d mezo -c "SELECT pump, joint_pain, workload FROM exercise_feedback;"
```

Expected: one completed instance; the logged sets with side/note; feedback rows within the CHECK ranges.
8. Start the same day again → a NEW instance starts (the previous one is completed, so nothing to resume) — and the meso library still shows exactly 7 template days (no instance leakage).

(If the smoke finds a bug: failing test first, fix, full gates again — the T1 way.)

- [ ] **Step 3: Clean the dev DB back to the clean slate**

```bash
docker exec -i mezo_pg psql -U mezo -d mezo -c "TRUNCATE TABLE exercise_feedback, exercise_set, exercise, workout_session, muscle_group_volume_log, mesocycle CASCADE;"
```

- [ ] **Step 4: Finish the branch** (superpowers:finishing-a-development-branch — Option 1, the house single-dev flow):

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git checkout main && git pull --rebase
git merge --no-ff feat/t2-workout-execution -m "feat(train): T2 workout execution — instances, /today, set/feedback/finish, live session (mezo-tod)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
cd backend && ./mvnw clean test && cd ../frontend && pnpm test && cd ..
git branch -d feat/t2-workout-execution
bd close mezo-tod --reason="T2 shipped: workout instances + today/start/sets/feedback/finish + live session UI, all gates green, live smoke passed"
git pull --rebase && bd dolt push && git push
git status   # MUST show "up to date with origin"
```

---

## Self-review checklist (done at plan time)

- **Spec coverage:** GET /today (Task 6), start instance (Task 3), set logging +L/B/R+note (Tasks 4, 10), RP feedback persist (Tasks 5, 10), finish (Tasks 5, 10), instance-in-same-table model (Task 1), open-instance resume rule (Tasks 3, 10), statuses within existing CHECKs (instances only use active/completed), gym weekly row derives from active meso (Tasks 8–9), `workout` ghost disappears in real mode (Tasks 8–9), soft delete untouched, ownership chain on child writes (Tasks 3–5). Out of scope per spec: voice recording, 90s timer, drag-reorder, volleyball schedule (T3).
- **Known deviations (intentional):** feedback columns pump/joint_pain/workload (documented, Task 11); resume returns 201 (generator emits one @ResponseStatus per operation); challenges/niggle empty in real mode (Phase 3).
- **Type consistency:** `todaySession` shape, `SetLogRequest` field names (`exerciseId/setIndex/weightKg/reps/rir/side/note`), `WorkoutFeedbackInput` (`exerciseId/pump/jointPain/workload`), `seedFromOpen`/`prefill` helpers, `beginWorkout`/`openSession` naming — checked across Tasks 2/8/9/10.
