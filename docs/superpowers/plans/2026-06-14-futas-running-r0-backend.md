# Futás R0 — Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the backend for plan-centric interval running — `RunningBlock` ("Terv") + `RunSessionLog` actuals — as REST endpoints with integration tests, no frontend.

**Architecture:** Mirror the existing mesocycle aggregate. A `running_block` table stores high-level fields + the week→session→segment tree as **typed jsonb** (`@JdbcTypeCode(SqlTypes.JSON)`, exactly the `MesocycleEntity.volumeRecompute` pattern). A `run_session_log` table stores logged actuals. Both extend `OwnedEntity` (server-side `created_by`, soft delete). Contract-first OpenAPI under the `Train` tag; `TrainController` implements the generated methods and delegates to a new `RunningService`. Integration-first tests via `ApiIntegrationTest`.

**Tech Stack:** Spring Boot 4.x, Java 21, Maven, PostgreSQL 16, Liquibase, MapStruct, Lombok, openapi-generator, Testcontainers/fixed `mezo_test`.

**Driving bd:** mezo-b4n (under mezo-dy6). **Spec:** `docs/superpowers/specs/2026-06-14-train-running-slice-design.md`.

**House standards (read before coding):** `docs/references/api_contract_conventions.md`, `liquibase_conventions.md`, `spring_patterns.md`, `error_handling.md`, `integration_test_framework.md`, `testing_standards.md`, `java_package_structure.md`. Project overrides: base package `io.mrkuhne.mezo`, UUID PKs, bd-id as the Liquibase feature segment, jsonb via `@JdbcTypeCode(SqlTypes.JSON)` onto typed records.

**Pre-flight:**
```bash
cd backend && docker compose up -d   # Postgres 16 on :15432 (mezo + mezo_test)
```

---

## File map

**Create (main):**
- `backend/.../feature/train/entity/RunningBlockStructure.java` — typed jsonb record tree
- `backend/.../feature/train/entity/RunningBlockEntity.java`
- `backend/.../feature/train/entity/RunSessionLogEntity.java`
- `backend/.../feature/train/repository/RunningBlockRepository.java`
- `backend/.../feature/train/repository/RunSessionLogRepository.java`
- `backend/.../feature/train/service/RunningService.java`
- `backend/.../feature/train/mapper/RunningMapper.java`
- `backend/.../feature/train/RunningSeedData.java` — `@Profile("demodata")`
- `backend/src/main/resources/db/changelog/1.0.0/script/202606141200_mezo-b4n_create_running_block.sql`
- `backend/src/main/resources/db/changelog/1.0.0/script/202606141210_mezo-b4n_create_run_session_log.sql`

**Modify (main):**
- `api/feature/train/train.yml` — add running paths + schemas
- `api/generate/merge.yml` — no change (running rides the Train fragment)
- `backend/.../feature/train/controller/TrainController.java` — implement new generated methods
- `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` — register 2 changesets

**Create (test):**
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/RunningPopulator.java`
- `backend/src/test/java/io/mrkuhne/mezo/feature/train/RunningApiIT.java`

**Modify (test):**
- `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` — add `running_block, run_session_log` to TRUNCATE

---

## Task 1: OpenAPI contract — running endpoints + schemas

**Files:**
- Modify: `api/feature/train/train.yml`
- Regenerate: `api/openapi.yml`, backend `target/generated-sources`, FE `src/lib/api.gen.ts`

- [ ] **Step 1: Add the running paths to `api/feature/train/train.yml`**

Append under `paths:` (after the last mesocycle/sport path, before `components:`):

```yaml
  /api/train/running-blocks:
    get:
      tags: [Train]
      operationId: listRunningBlocks
      summary: All running blocks of the current user (any status), start date ascending
      responses:
        '200':
          description: Running blocks
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/RunningBlockResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    post:
      tags: [Train]
      operationId: createRunningBlock
      summary: Create a running block (Builder save)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/RunningBlockUpsertRequest' }
      responses:
        '201':
          description: Created running block
          content:
            application/json:
              schema: { $ref: '#/components/schemas/RunningBlockResponse' }
        '400':
          description: Validation error
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/train/running-blocks/{id}:
    put:
      tags: [Train]
      operationId: updateRunningBlock
      summary: Full-replace a running block incl. structure
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/RunningBlockUpsertRequest' }
      responses:
        '200':
          description: Updated running block
          content:
            application/json:
              schema: { $ref: '#/components/schemas/RunningBlockResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    delete:
      tags: [Train]
      operationId: deleteRunningBlock
      summary: Soft-delete a running block
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '204': { description: Deleted }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/train/running-blocks/{id}/activate:
    post:
      tags: [Train]
      operationId: activateRunningBlock
      summary: Activate a running block — archives any other active one (idempotent)
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '200':
          description: Activated running block
          content:
            application/json:
              schema: { $ref: '#/components/schemas/RunningBlockResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/train/running-blocks/{id}/close:
    post:
      tags: [Train]
      operationId: closeRunningBlock
      summary: Close (archive) a running block
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '200':
          description: Archived running block
          content:
            application/json:
              schema: { $ref: '#/components/schemas/RunningBlockResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/train/run-sessions:
    get:
      tags: [Train]
      operationId: listRunSessions
      summary: Logged run-session actuals of the current user, newest first
      responses:
        '200':
          description: Run sessions
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/RunSessionLogResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    post:
      tags: [Train]
      operationId: logRunSession
      summary: Log run-session actuals against a prescribed session
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/RunSessionLogRequest' }
      responses:
        '201':
          description: Logged run session
          content:
            application/json:
              schema: { $ref: '#/components/schemas/RunSessionLogResponse' }
        '400':
          description: Validation error
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

- [ ] **Step 2: Add the running schemas to `train.yml`**

Append under `components: schemas:` (alongside the Mesocycle schemas):

```yaml
    RunSegment:
      type: object
      required: [type, durationSec]
      properties:
        type: { type: string, enum: [warmup, work, rest, cooldown] }
        durationSec: { type: integer }
        label: { type: string, nullable: true }
    RpeTarget:
      type: object
      required: [min, max]
      properties:
        min: { type: integer }
        max: { type: integer }
    RunPrescribedSession:
      type: object
      required: [key, dayOfWeek, label, kind, rpeTarget, segments]
      properties:
        key: { type: string }
        dayOfWeek: { type: integer, description: '0=Hét..6=Vas' }
        label: { type: string }
        kind: { type: string, enum: [sprint, pyramid, steady] }
        rpeTarget: { $ref: '#/components/schemas/RpeTarget' }
        rounds: { type: integer, nullable: true }
        segments:
          type: array
          items: { $ref: '#/components/schemas/RunSegment' }
    RunWeek:
      type: object
      required: [weekNumber, phaseLabel, sessions]
      properties:
        weekNumber: { type: integer }
        phaseLabel: { type: string }
        sessions:
          type: array
          items: { $ref: '#/components/schemas/RunPrescribedSession' }
    RunningBlockStructureDto:
      type: object
      required: [weeks]
      properties:
        weeks:
          type: array
          items: { $ref: '#/components/schemas/RunWeek' }
    RunningBlockResponse:
      type: object
      required: [id, title, kind, status, startDate, endDate, weeks, currentWeek, structure]
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        goal: { type: string, nullable: true }
        kind: { type: string }
        status: { type: string, enum: [planned, active, archived] }
        startDate: { type: string, format: date }
        endDate: { type: string, format: date }
        weeks: { type: integer }
        currentWeek: { type: integer }
        summary: { type: string, nullable: true }
        structure: { $ref: '#/components/schemas/RunningBlockStructureDto' }
    RunningBlockUpsertRequest:
      type: object
      required: [title, kind, startDate, endDate, weeks, structure]
      properties:
        title: { type: string }
        goal: { type: string, nullable: true }
        kind: { type: string }
        startDate: { type: string, format: date }
        endDate: { type: string, format: date }
        weeks: { type: integer }
        currentWeek: { type: integer, nullable: true }
        summary: { type: string, nullable: true }
        structure: { $ref: '#/components/schemas/RunningBlockStructureDto' }
    RunSessionLogResponse:
      type: object
      required: [id, blockId, weekNumber, sessionKey, date]
      properties:
        id: { type: string, format: uuid }
        blockId: { type: string, format: uuid }
        weekNumber: { type: integer }
        sessionKey: { type: string }
        date: { type: string, format: date }
        completedRounds: { type: integer, nullable: true }
        rpeActual: { type: integer, nullable: true }
        hrRecoverySec: { type: integer, nullable: true }
        sprintLandmark: { type: string, nullable: true }
        durationMin: { type: integer, nullable: true }
        notes: { type: string, nullable: true }
    RunSessionLogRequest:
      type: object
      required: [blockId, weekNumber, sessionKey, date]
      properties:
        blockId: { type: string, format: uuid }
        weekNumber: { type: integer }
        sessionKey: { type: string }
        date: { type: string, format: date }
        completedRounds: { type: integer, nullable: true }
        rpeActual: { type: integer, nullable: true }
        hrRecoverySec: { type: integer, nullable: true }
        sprintLandmark: { type: string, nullable: true }
        durationMin: { type: integer, nullable: true }
        notes: { type: string, nullable: true }
```

- [ ] **Step 3: Regenerate the merged contract + FE types**

Run:
```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```
Expected: `api/openapi.yml` now contains the running paths; `frontend/src/lib/api.gen.ts` gains the new types. No errors.

- [ ] **Step 4: Generate backend sources, verify the contract interface compiles**

Run:
```bash
cd backend && ./mvnw -q generate-sources
ls target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/ | grep -i running
```
Expected: `RunningBlockResponse.java`, `RunningBlockUpsertRequest.java`, `RunWeek.java`, etc. present; `TrainApi.java` now declares `listRunningBlocks()`, `createRunningBlock(...)`, etc.

- [ ] **Step 5: Commit**

```bash
git add api/ frontend/src/lib/api.gen.ts
git commit -m "feat(api): running-blocks + run-sessions contract (mezo-b4n)"
```

---

## Task 2: Typed jsonb structure record

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/RunningBlockStructure.java`

This is the in-DB representation (separate from the generated `api.dto` tree so the entity layer owns its own type — same split the codebase uses elsewhere). The mapper (Task 8) converts between them.

- [ ] **Step 1: Write the record tree**

```java
package io.mrkuhne.mezo.feature.train.entity;

import java.util.List;

/**
 * The week→session→segment plan tree, stored verbatim as jsonb on {@code running_block}
 * (the {@link VolumeRecomputeJson} pattern). Authored/read as a whole; never queried by
 * a single segment.
 */
public record RunningBlockStructure(List<RunWeek> weeks) {

    public record RunWeek(Integer weekNumber, String phaseLabel, List<RunPrescribedSession> sessions) {}

    public record RunPrescribedSession(
        String key,
        Integer dayOfWeek,            // 0=Hét..6=Vas
        String label,
        String kind,                  // sprint|pyramid|steady
        RpeTarget rpeTarget,
        Integer rounds,               // sprint kind only; null otherwise
        List<RunSegment> segments) {}

    public record RunSegment(String type, Integer durationSec, String label) {} // type: warmup|work|rest|cooldown

    public record RpeTarget(Integer min, Integer max) {}
}
```

- [ ] **Step 2: Compile**

Run: `cd backend && ./mvnw -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/RunningBlockStructure.java
git commit -m "feat(train): RunningBlockStructure typed jsonb record (mezo-b4n)"
```

---

## Task 3: Entities

**Files:**
- Create: `backend/.../feature/train/entity/RunningBlockEntity.java`
- Create: `backend/.../feature/train/entity/RunSessionLogEntity.java`

- [ ] **Step 1: `RunningBlockEntity`**

```java
package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * A running "Terv" — the interval-plan block, mirroring {@link MesocycleEntity}. The
 * week→session→segment tree is typed jsonb ({@link RunningBlockStructure}). Lifecycle
 * status planned|active|archived; at most one active per owner (enforced in service).
 *
 * <p>{@code createdBy}, {@code is_deleted}, {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "running_block")
@SQLDelete(sql = "update running_block set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class RunningBlockEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private String title;

    @Column
    private String goal;

    @NotNull
    @Column(nullable = false)
    private String kind = "interval"; // DB CHECK

    @NotNull
    @Column(nullable = false)
    private String status; // planned|active|archived (DB CHECK)

    @NotNull
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @NotNull
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @NotNull
    @Column(nullable = false)
    private Integer weeks;

    @NotNull
    @Column(name = "current_week", nullable = false)
    private Integer currentWeek = 0;

    @Column
    private String summary;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private RunningBlockStructure structure;
}
```

- [ ] **Step 2: `RunSessionLogEntity`**

```java
package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * Logged actuals for one run session, recorded against a prescribed session in a
 * {@link RunningBlockEntity} (the {@code WorkoutSessionEntity} analog). Named *Log to avoid
 * clashing with the prescribed {@code RunPrescribedSession} record inside the block jsonb.
 *
 * <p>{@code createdBy}, {@code is_deleted}, {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "run_session_log")
@SQLDelete(sql = "update run_session_log set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class RunSessionLogEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "block_id", nullable = false, columnDefinition = "uuid")
    private UUID blockId;

    @NotNull
    @Column(name = "week_number", nullable = false)
    private Integer weekNumber;

    @NotNull
    @Column(name = "session_key", nullable = false)
    private String sessionKey;

    @NotNull
    @Column(nullable = false)
    private LocalDate date;

    @Column(name = "completed_rounds")
    private Integer completedRounds;

    @Column(name = "rpe_actual")
    private Integer rpeActual; // null or 1..10 (DB CHECK)

    @Column(name = "hr_recovery_sec")
    private Integer hrRecoverySec;

    @Column(name = "sprint_landmark")
    private String sprintLandmark;

    @Column(name = "duration_min")
    private Integer durationMin;

    @Column
    private String notes;
}
```

- [ ] **Step 3: Compile**

Run: `cd backend && ./mvnw -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/RunningBlockEntity.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/RunSessionLogEntity.java
git commit -m "feat(train): RunningBlock + RunSessionLog entities (mezo-b4n)"
```

---

## Task 4: Liquibase migrations + register + ResetDatabase

**Files:**
- Create: `.../1.0.0/script/202606141200_mezo-b4n_create_running_block.sql`
- Create: `.../1.0.0/script/202606141210_mezo-b4n_create_run_session_log.sql`
- Modify: `.../1.0.0/1.0.0_master.yml`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`

- [ ] **Step 1: `202606141200_mezo-b4n_create_running_block.sql`**

```sql
-- DDL: Futás R0 — running_block (interval-plan "Terv" with typed jsonb structure)
CREATE TABLE running_block (
    id           UUID DEFAULT gen_random_uuid(),
    created_by   UUID NOT NULL,
    title        TEXT NOT NULL,
    goal         TEXT,
    kind         TEXT NOT NULL DEFAULT 'interval',
    status       TEXT NOT NULL,
    start_date   DATE NOT NULL,
    end_date     DATE NOT NULL,
    weeks        INT  NOT NULL,
    current_week INT  NOT NULL DEFAULT 0,
    summary      TEXT,
    structure    JSONB NOT NULL,
    is_deleted   BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_running_block_id PRIMARY KEY (id),
    CONSTRAINT fk_running_block_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_running_block_status CHECK (status IN ('planned','active','archived')),
    CONSTRAINT ck_running_block_kind CHECK (kind IN ('interval'))
);
CREATE INDEX idx_running_block_created_by ON running_block (created_by);
```

- [ ] **Step 2: `202606141210_mezo-b4n_create_run_session_log.sql`**

```sql
-- DDL: Futás R0 — run_session_log (logged actuals vs a prescribed session)
CREATE TABLE run_session_log (
    id               UUID DEFAULT gen_random_uuid(),
    created_by       UUID NOT NULL,
    block_id         UUID NOT NULL,
    week_number      INT  NOT NULL,
    session_key      TEXT NOT NULL,
    date             DATE NOT NULL,
    completed_rounds INT,
    rpe_actual       INT,
    hr_recovery_sec  INT,
    sprint_landmark  TEXT,
    duration_min     INT,
    notes            TEXT,
    is_deleted       BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_run_session_log_id PRIMARY KEY (id),
    CONSTRAINT fk_run_session_log_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_run_session_log_block
        FOREIGN KEY (block_id) REFERENCES running_block(id) ON DELETE CASCADE,
    CONSTRAINT ck_run_session_log_rpe CHECK (rpe_actual IS NULL OR rpe_actual BETWEEN 1 AND 10)
);
CREATE INDEX idx_run_session_log_created_by ON run_session_log (created_by);
CREATE INDEX idx_run_session_log_block ON run_session_log (block_id);
```

- [ ] **Step 3: Register both changesets in `1.0.0_master.yml`** (append at the end)

```yaml
  - changeSet:
      id: "1.0.0:202606141200_mezo-b4n_create_running_block"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202606141200_mezo-b4n_create_running_block.sql
  - changeSet:
      id: "1.0.0:202606141210_mezo-b4n_create_run_session_log"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202606141210_mezo-b4n_create_run_session_log.sql
```

- [ ] **Step 4: Add the two tables to `ResetDatabase.resetExceptMasterData()` TRUNCATE list**

In `ResetDatabase.java`, extend the TRUNCATE string — add `run_session_log, running_block` (child before parent is irrelevant under CASCADE, but keep child first):

```java
        entityManager.createNativeQuery(
            "TRUNCATE TABLE weight_log, sleep_log, check_in, "
                + "exercise_feedback, exercise_set, exercise, workout_session, muscle_group_volume_log, mesocycle, "
                + "sport_schedule_slot, sport_session, run_session_log, running_block CASCADE").executeUpdate();
```

- [ ] **Step 5: Boot the app against the migration to verify the DDL applies**

Run:
```bash
cd backend && ./mvnw -q spring-boot:run -Dspring-boot.run.profiles=demodata &
sleep 25 && curl -s localhost:8090/actuator/health ; kill %1
```
Expected: `{"status":"UP"}` and no Liquibase error in the log (tables created). (If `actuator/health` is unavailable, instead check the log shows the two changesets ran.)

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java
git commit -m "feat(train): running_block + run_session_log migrations (mezo-b4n)"
```

---

## Task 5: Repositories

**Files:**
- Create: `.../feature/train/repository/RunningBlockRepository.java`
- Create: `.../feature/train/repository/RunSessionLogRepository.java`

Follow the existing repos (e.g. `SportSessionRepository`): extend `OwnedRepository<Entity>` (check its signature — it provides owner-scoped helpers) or `JpaRepository`. Use the same base the sibling repos use.

- [ ] **Step 1: `RunningBlockRepository`**

```java
package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RunningBlockRepository extends JpaRepository<RunningBlockEntity, UUID> {

    List<RunningBlockEntity> findByCreatedByOrderByStartDateAsc(UUID createdBy);

    Optional<RunningBlockEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);

    List<RunningBlockEntity> findByCreatedByAndStatus(UUID createdBy, String status);
}
```

- [ ] **Step 2: `RunSessionLogRepository`**

```java
package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RunSessionLogRepository extends JpaRepository<RunSessionLogEntity, UUID> {

    List<RunSessionLogEntity> findByCreatedByOrderByDateDesc(UUID createdBy);
}
```

> Verify against `SportSessionRepository` whether the codebase standardises on `OwnedRepository`; if so, extend that instead and drop the redundant `createdBy` finders it already provides.

- [ ] **Step 3: Compile**

Run: `cd backend && ./mvnw -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/RunningBlockRepository.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/RunSessionLogRepository.java
git commit -m "feat(train): running repositories (mezo-b4n)"
```

---

## Task 6: Mapper (entity ↔ generated dto)

**Files:**
- Create: `.../feature/train/mapper/RunningMapper.java`

MapStruct interface, `componentModel = "spring"`, mirroring `TrainMapper`. Maps `RunningBlockEntity` ↔ `RunningBlockResponse`, `RunSessionLogEntity` ↔ `RunSessionLogResponse`, and the entity `RunningBlockStructure` record tree ↔ the generated `RunningBlockStructureDto` tree (MapStruct maps records field-by-field automatically when names match).

- [ ] **Step 1: Write the mapper**

```java
package io.mrkuhne.mezo.feature.train.mapper;

import io.mrkuhne.mezo.api.dto.RunSessionLogResponse;
import io.mrkuhne.mezo.api.dto.RunningBlockResponse;
import io.mrkuhne.mezo.api.dto.RunningBlockStructureDto;
import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface RunningMapper {

    RunningBlockResponse toResponse(RunningBlockEntity entity);

    RunSessionLogResponse toResponse(RunSessionLogEntity entity);

    RunningBlockStructure toEntityStructure(RunningBlockStructureDto dto);

    RunningBlockStructureDto toDtoStructure(RunningBlockStructure structure);
}
```

- [ ] **Step 2: Generate sources + compile (MapStruct generates the impl)**

Run: `cd backend && ./mvnw -q clean compile`
Expected: BUILD SUCCESS; `target/generated-sources/.../RunningMapperImpl.java` exists. If MapStruct complains about an unmapped enum/field, add explicit `@Mapping` (e.g. enum `RunSegment.type` is `String` in the entity but a generated enum in the dto — map via `.getValue()`/`fromValue`; add a `default` method if needed).

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/mapper/RunningMapper.java
git commit -m "feat(train): RunningMapper entity<->dto (mezo-b4n)"
```

---

## Task 7: Service (ownership + lifecycle)

**Files:**
- Create: `.../feature/train/service/RunningService.java`

Constructor injection (`@RequiredArgsConstructor`), method-level `@Transactional` on writes, app-level ownership (`createdBy = currentUser`), no client-supplied owner. Errors via `SystemRuntimeErrorException` + a `SystemMessage` code (see `error_handling.md`; reuse the existing "not found" message code the meso service uses — grep `TrainService` for it).

- [ ] **Step 1: Write the service**

```java
package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.RunSessionLogRequest;
import io.mrkuhne.mezo.api.dto.RunSessionLogResponse;
import io.mrkuhne.mezo.api.dto.RunningBlockResponse;
import io.mrkuhne.mezo.api.dto.RunningBlockUpsertRequest;
import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.mapper.RunningMapper;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RunningService {

    private final RunningBlockRepository blockRepository;
    private final RunSessionLogRepository logRepository;
    private final RunningMapper mapper;

    public List<RunningBlockResponse> listBlocks(UUID userId) {
        return blockRepository.findByCreatedByOrderByStartDateAsc(userId).stream()
            .map(mapper::toResponse).toList();
    }

    @Transactional
    public RunningBlockResponse createBlock(UUID userId, RunningBlockUpsertRequest req) {
        RunningBlockEntity e = new RunningBlockEntity();
        e.setCreatedBy(userId);
        e.setStatus("planned");
        applyUpsert(e, req);
        return mapper.toResponse(blockRepository.save(e));
    }

    @Transactional
    public RunningBlockResponse updateBlock(UUID userId, UUID id, RunningBlockUpsertRequest req) {
        RunningBlockEntity e = requireOwned(userId, id);
        applyUpsert(e, req);
        return mapper.toResponse(blockRepository.save(e));
    }

    @Transactional
    public RunningBlockResponse activateBlock(UUID userId, UUID id) {
        RunningBlockEntity target = requireOwned(userId, id);
        for (RunningBlockEntity other : blockRepository.findByCreatedByAndStatus(userId, "active")) {
            if (!other.getId().equals(id)) {
                other.setStatus("archived");
                blockRepository.save(other);
            }
        }
        target.setStatus("active");
        return mapper.toResponse(blockRepository.save(target));
    }

    @Transactional
    public RunningBlockResponse closeBlock(UUID userId, UUID id) {
        RunningBlockEntity e = requireOwned(userId, id);
        e.setStatus("archived");
        return mapper.toResponse(blockRepository.save(e));
    }

    @Transactional
    public void deleteBlock(UUID userId, UUID id) {
        blockRepository.delete(requireOwned(userId, id)); // @SQLDelete soft-deletes
    }

    public List<RunSessionLogResponse> listSessions(UUID userId) {
        return logRepository.findByCreatedByOrderByDateDesc(userId).stream()
            .map(mapper::toResponse).toList();
    }

    @Transactional
    public RunSessionLogResponse logSession(UUID userId, RunSessionLogRequest req) {
        requireOwned(userId, req.getBlockId()); // ownership of the referenced block
        RunSessionLogEntity e = new RunSessionLogEntity();
        e.setCreatedBy(userId);
        e.setBlockId(req.getBlockId());
        e.setWeekNumber(req.getWeekNumber());
        e.setSessionKey(req.getSessionKey());
        e.setDate(req.getDate());
        e.setCompletedRounds(req.getCompletedRounds());
        e.setRpeActual(req.getRpeActual());
        e.setHrRecoverySec(req.getHrRecoverySec());
        e.setSprintLandmark(req.getSprintLandmark());
        e.setDurationMin(req.getDurationMin());
        e.setNotes(req.getNotes());
        return mapper.toResponse(logRepository.save(e));
    }

    private void applyUpsert(RunningBlockEntity e, RunningBlockUpsertRequest req) {
        e.setTitle(req.getTitle());
        e.setGoal(req.getGoal());
        e.setKind(req.getKind());
        e.setStartDate(req.getStartDate());
        e.setEndDate(req.getEndDate());
        e.setWeeks(req.getWeeks());
        e.setCurrentWeek(req.getCurrentWeek() != null ? req.getCurrentWeek() : 0);
        e.setSummary(req.getSummary());
        e.setStructure(mapper.toEntityStructure(req.getStructure()));
    }

    private RunningBlockEntity requireOwned(UUID userId, UUID id) {
        return blockRepository.findByIdAndCreatedBy(id, userId)
            .orElseThrow(() -> new io.mrkuhne.mezo.techcore.error.SystemRuntimeErrorException(
                io.mrkuhne.mezo.techcore.error.SystemMessage.RESOURCE_NOT_FOUND)); // use the actual code from TrainService
    }
}
```

> **Before coding `requireOwned`:** grep `TrainService.java` for how it throws not-found (`SystemRuntimeErrorException` + which `SystemMessage` constant) and copy that exact pattern — do not invent a `SystemMessage` constant. Adjust imports to match.

- [ ] **Step 2: Compile**

Run: `cd backend && ./mvnw -q compile`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/RunningService.java
git commit -m "feat(train): RunningService (blocks lifecycle + session log) (mezo-b4n)"
```

---

## Task 8: Controller wiring

**Files:**
- Modify: `.../feature/train/controller/TrainController.java`

The generated `TrainApi` now declares the running methods (Task 1). `TrainController implements TrainApi`, so it must implement them. Inject `RunningService` and delegate, exactly like the existing `service`/`workoutService` fields.

- [ ] **Step 1: Add the field + import**

In `TrainController`, add to the constructor-injected fields:
```java
    private final RunningService runningService;
```
and the import `import io.mrkuhne.mezo.feature.train.service.RunningService;` plus the new dto imports (`RunningBlockResponse`, `RunningBlockUpsertRequest`, `RunSessionLogResponse`, `RunSessionLogRequest`).

- [ ] **Step 2: Implement the methods** (append in the class body)

```java
    @Override
    public List<RunningBlockResponse> listRunningBlocks() {
        return runningService.listBlocks(currentUserId.get());
    }

    @Override
    public RunningBlockResponse createRunningBlock(RunningBlockUpsertRequest runningBlockUpsertRequest) {
        return runningService.createBlock(currentUserId.get(), runningBlockUpsertRequest);
    }

    @Override
    public RunningBlockResponse updateRunningBlock(UUID id, RunningBlockUpsertRequest runningBlockUpsertRequest) {
        return runningService.updateBlock(currentUserId.get(), id, runningBlockUpsertRequest);
    }

    @Override
    public void deleteRunningBlock(UUID id) {
        runningService.deleteBlock(currentUserId.get(), id);
    }

    @Override
    public RunningBlockResponse activateRunningBlock(UUID id) {
        return runningService.activateBlock(currentUserId.get(), id);
    }

    @Override
    public RunningBlockResponse closeRunningBlock(UUID id) {
        return runningService.closeBlock(currentUserId.get(), id);
    }

    @Override
    public List<RunSessionLogResponse> listRunSessions() {
        return runningService.listSessions(currentUserId.get());
    }

    @Override
    public RunSessionLogResponse logRunSession(RunSessionLogRequest runSessionLogRequest) {
        return runningService.logSession(currentUserId.get(), runSessionLogRequest);
    }
```

> If the generated method signatures differ (e.g. `ResponseEntity<Void> deleteRunningBlock(...)`), match the generated `TrainApi` interface exactly — open `target/generated-sources/.../api/controller/TrainApi.java` and copy the signatures.

- [ ] **Step 3: Compile**

Run: `cd backend && ./mvnw -q compile`
Expected: BUILD SUCCESS (class fully implements `TrainApi`).

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java
git commit -m "feat(train): wire running endpoints into TrainController (mezo-b4n)"
```

---

## Task 9: Test populator + demodata seed

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/RunningPopulator.java`
- Create: `backend/.../feature/train/RunningSeedData.java`

- [ ] **Step 1: `RunningPopulator`** (one aggregate factory; persists via `saveAndFlush` so constraints fire)

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure.RpeTarget;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure.RunPrescribedSession;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure.RunSegment;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure.RunWeek;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class RunningPopulator {

    private final RunningBlockRepository blockRepository;
    private final RunSessionLogRepository logRepository;

    public RunningBlockEntity createBlock(UUID createdBy, String title, String status) {
        RunningBlockEntity e = new RunningBlockEntity();
        e.setCreatedBy(createdBy);
        e.setTitle(title);
        e.setKind("interval");
        e.setStatus(status);
        e.setStartDate(LocalDate.parse("2026-06-16"));
        e.setEndDate(LocalDate.parse("2026-08-11"));
        e.setWeeks(8);
        e.setCurrentWeek(3);
        e.setStructure(sampleStructure());
        return blockRepository.saveAndFlush(e);
    }

    public RunSessionLogEntity createLog(UUID createdBy, UUID blockId, int week, String key) {
        RunSessionLogEntity e = new RunSessionLogEntity();
        e.setCreatedBy(createdBy);
        e.setBlockId(blockId);
        e.setWeekNumber(week);
        e.setSessionKey(key);
        e.setDate(LocalDate.parse("2026-06-30"));
        e.setCompletedRounds(6);
        e.setRpeActual(9);
        return logRepository.saveAndFlush(e);
    }

    public static RunningBlockStructure sampleStructure() {
        RunPrescribedSession sprint = new RunPrescribedSession(
            "tue-sprint", 1, "Sprint-intervallum", "sprint", new RpeTarget(9, 10), 6,
            List.of(new RunSegment("warmup", 300, null),
                    new RunSegment("work", 15, null),
                    new RunSegment("rest", 45, null),
                    new RunSegment("cooldown", 300, null)));
        RunWeek w3 = new RunWeek(3, "Alapozás", List.of(sprint));
        return new RunningBlockStructure(List.of(w3));
    }
}
```

- [ ] **Step 2: `RunningSeedData`** — production demodata seed (the user's real 8-week plan)

Mirror `TrainSeedData` (grep it for the `@Profile("demodata")` + owner-id resolution + idempotency guard pattern). Build one `active` block ("Robbanékonyság 01", 8 weeks: Kedd sprint rounds 5→5→6→6→8→8→8→8, Péntek pyramid small→big with rest tightening across the 2 months), one `planned` ("5K-alapozó"), one `archived` ("Téli base 02", summary "7/10 · pulzus-megnyugvás −18mp javult"). Reuse `RunningPopulator.sampleStructure()`-style builders but as production code in the seed class. Skeleton:

```java
package io.mrkuhne.mezo.feature.train;

import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@Profile("demodata")
@RequiredArgsConstructor
public class RunningSeedData {

    private final RunningBlockRepository blockRepository;
    // inject whatever TrainSeedData uses to resolve the owner UUID (e.g. OwnerProperties + AppUserRepository)

    @EventListener(ApplicationReadyEvent.class)
    public void seed() {
        // 1. resolve owner id exactly as TrainSeedData does
        // 2. if blockRepository.findByCreatedByOrderByStartDateAsc(ownerId) is non-empty, return (idempotent)
        // 3. save the active + planned + archived blocks built from full 8-week structures
    }
}
```

> Build the full 8-week `RunningBlockStructure` here verbatim from the spec's plan table. Keep it deterministic (no random/now()).

- [ ] **Step 3: Compile (tests)**

Run: `cd backend && ./mvnw -q test-compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/support/populator/RunningPopulator.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/train/RunningSeedData.java
git commit -m "feat(train): running test populator + demodata seed (mezo-b4n)"
```

---

## Task 10: Integration tests (HTTP-level)

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/train/RunningApiIT.java`

Extend `ApiIntegrationTest` (HTTP verb helpers, `ownerAuthHeaders()`, SystemMessage asserts). AssertJ only. Names `test{Method}_should{Result}_when{Condition}`. **First grep `SportApiIT`/an existing `*ApiIT`** for the exact base-class helper names (`get`, `post`, `put`, `delete`, status assertions) and copy them — the snippets below assume `getOk`/`postCreated`-style helpers; adjust to the real API.

- [ ] **Step 1: Write the failing tests**

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;

class RunningApiIT extends ApiIntegrationTest {

    @Test
    void testListRunningBlocks_shouldReturnEmpty_whenNoneCreated() {
        var blocks = getList("/api/train/running-blocks", RunningBlockResponse.class);
        assertThat(blocks).isEmpty();
    }

    @Test
    void testCreateRunningBlock_shouldPersistAsPlanned_whenValid() {
        var req = sampleUpsertRequest("Robbanékonyság 01");
        var created = postCreated("/api/train/running-blocks", req, RunningBlockResponse.class);
        assertThat(created.getStatus()).isEqualTo("planned");
        assertThat(created.getStructure().getWeeks()).hasSize(1);
        assertThat(getList("/api/train/running-blocks", RunningBlockResponse.class)).hasSize(1);
    }

    @Test
    void testActivateRunningBlock_shouldArchiveOtherActive_whenSecondActivated() {
        var a = postCreated("/api/train/running-blocks", sampleUpsertRequest("A"), RunningBlockResponse.class);
        var b = postCreated("/api/train/running-blocks", sampleUpsertRequest("B"), RunningBlockResponse.class);
        postOk("/api/train/running-blocks/" + a.getId() + "/activate", null, RunningBlockResponse.class);
        postOk("/api/train/running-blocks/" + b.getId() + "/activate", null, RunningBlockResponse.class);
        var blocks = getList("/api/train/running-blocks", RunningBlockResponse.class);
        assertThat(blocks).filteredOn(x -> x.getStatus().equals("active")).hasSize(1);
    }

    @Test
    void testUpdateRunningBlock_shouldReplaceStructure_whenPut() {
        var created = postCreated("/api/train/running-blocks", sampleUpsertRequest("X"), RunningBlockResponse.class);
        var req = sampleUpsertRequest("X renamed");
        var updated = putOk("/api/train/running-blocks/" + created.getId(), req, RunningBlockResponse.class);
        assertThat(updated.getTitle()).isEqualTo("X renamed");
    }

    @Test
    void testLogRunSession_shouldPersist_whenBlockOwned() {
        var block = postCreated("/api/train/running-blocks", sampleUpsertRequest("X"), RunningBlockResponse.class);
        var logReq = sampleLogRequest(block.getId());
        var logged = postCreated("/api/train/run-sessions", logReq, RunSessionLogResponse.class);
        assertThat(logged.getRpeActual()).isEqualTo(9);
        assertThat(getList("/api/train/run-sessions", RunSessionLogResponse.class)).hasSize(1);
    }

    @Test
    void testListRunningBlocks_shouldReturn401_whenNoToken() {
        assertUnauthorizedWithoutToken("/api/train/running-blocks"); // copy the exact helper name from an existing *ApiIT
    }

    // helpers: build RunningBlockUpsertRequest / RunSessionLogRequest with the generated dto setters,
    // structure = RunningPopulator.sampleStructure() mapped to RunningBlockStructureDto (or hand-build the dto tree).
}
```

- [ ] **Step 2: Run the tests, verify they FAIL**

Run: `cd backend && ./mvnw -q clean test -Dtest=RunningApiIT`
Expected: compile/assert failures (helpers/endpoints exercised). Fix helper names to match the real `ApiIntegrationTest` base until they compile, then they should drive real behavior.

- [ ] **Step 3: Make them pass**

With Tasks 1–9 in place the endpoints already exist — iterate on the test helper wiring (request builders, base-class verb method names) until green. No production change should be needed; if a test reveals a gap (e.g. structure round-trips wrong), fix the mapper/service and re-run.

- [ ] **Step 4: Run the full backend suite (regression)**

Run: `cd backend && ./mvnw clean test`
Expected: all green (existing Train ITs unaffected; `ResetDatabase` now truncates the new tables).

- [ ] **Step 5: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/train/RunningApiIT.java
git commit -m "test(train): running blocks + session log API ITs (mezo-b4n)"
```

---

## Done-when (R0 acceptance)

- `./mvnw clean test` green (compose up), including `RunningApiIT`.
- App boots under `demodata`; `GET /api/train/running-blocks` (owner token) returns the seeded active + planned + archived blocks with full structure.
- `running_block` + `run_session_log` exist with the documented constraints; `ResetDatabase` truncates them.
- Contract committed; `frontend/src/lib/api.gen.ts` carries the new types (FE consumes them in R1).
- `bd close mezo-b4n`; next: R1 plan (mock hooks + read-only Futás tab).

## Self-review notes (author)

- **Spec coverage:** entities + jsonb structure (spec §1) ✓; 8 endpoints (spec §2) ✓; Liquibase + seed + ResetDatabase (spec §1) ✓; ownership/soft-delete (spec overrides) ✓. Mai/Builder/cross-load/mock-hooks are explicitly R1–R4, not R0.
- **Grep-before-invent flags** intentionally left where the exact codebase symbol must be copied, not guessed: `OwnedRepository` base (Task 5), `SystemMessage` not-found constant (Task 7), generated `TrainApi` signatures (Task 8), `TrainSeedData` owner-resolution + idempotency (Task 9), `ApiIntegrationTest` verb/auth helper names (Task 10). These are lookups, not placeholders — the surrounding code is complete.
