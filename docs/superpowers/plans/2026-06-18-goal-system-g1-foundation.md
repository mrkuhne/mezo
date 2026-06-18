# Goal System — G1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `Goal` aggregate (trajectory + guards + window, CRUD + planned/active/archived lifecycle with one-active-per-owner) and a `BiometricProfile` aggregate (TDEE inputs), contract-first, and split the frontend `useGoals()` into a real `useGoal()` + `useWeight()` — without restructuring `GoalsView` (that is slice G4).

**Architecture:** Two new owned backend aggregates under `feature/goal/` and `feature/biometrics/profile/`, each following the `running_block` template (OwnedEntity, soft-delete, lowercase-String status with DB CHECK, service-enforced single-active, generated `<Tag>Api` controller, MapStruct mapper, SystemMessage errors). Contract authored in new OpenAPI fragments → generated DTOs. Frontend adds two `lib/*Api.ts` modules and splits the dual-mode hook, mapping the new `GoalResponse` to the **existing** `Goal` domain type so consumers stay unchanged.

**Tech Stack:** Spring Boot 4.x · Java 21 · Maven · PostgreSQL 16 · Liquibase · MapStruct · Lombok · openapi-generator (spring) · React 19 · TanStack Query · openapi-typescript · Vitest + MSW.

**Driving issue:** `mezo-2hp` (file G1 as a child issue before starting). **Spec:** `docs/superpowers/specs/2026-06-18-goal-system-design.md`.

## Global Constraints

- **Base package:** `io.mrkuhne.mezo`. New packages: `feature/goal/{entity,repository,service,mapper,controller}`, `feature/biometrics/profile/{entity,repository,service,mapper,controller}`.
- **PKs UUID** (`gen_random_uuid()`); every owned table has `created_by uuid NOT NULL` (FK→`app_user(id)` ON DELETE CASCADE), `is_deleted boolean NOT NULL DEFAULT false`, `created_at timestamptz NOT NULL DEFAULT now()`. Entities extend `techcore.persistence.OwnedEntity`.
- **Status is a lowercase `String` with a DB CHECK** (`planned|active|archived`), NOT a JPA enum. The String↔generated `StatusEnum` conversion lives only in the mapper.
- **Soft delete** via `@SQLDelete` + `@SQLRestriction("is_deleted = false")`; `repository.delete()` issues the UPDATE.
- **`@Transactional` on write methods only** (method-level). Read/list methods are NOT annotated.
- **Single-active-per-owner enforced in the SERVICE** (loop + dirty-checking), NOT a DB unique index — matches `running_block`.
- **Ownership stamped server-side** from `CurrentUserId.get()`; never trust owner/derived fields from the request body. Missing row and foreign row both → 404 `RESOURCE_NOT_FOUND`.
- **Errors only via** `SystemRuntimeErrorException(SystemMessage.error(code).build(), HttpStatus)`. Reuse `RESOURCE_NOT_FOUND`; validation codes come from bean-validation on generated DTOs.
- **Contract-first, immutable migrations.** Author the OpenAPI yml BEFORE Java; never edit a released changeset (DROP+ADD / ALTER in a NEW changeset). Changeset filename `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql` (12-digit UTC, minute granularity); register in `1.0.0_master.yml`.
- **Constraint naming:** `pk_`/`fk_`/`uq_`/`ck_`/`idx_` `{type}_{table}_{column}`.
- **Tests integration-first:** `*ServiceIT extends AbstractIntegrationTest` (`@Transactional`), `*ContractIT extends ApiIntegrationTest` (NOT `@Transactional`). AssertJ only, real Postgres, no mocks/H2. Naming `test{Method}_should{Result}_when{Condition}`. A new owned table MUST be added to `ResetDatabase`'s TRUNCATE list AND get a `*Populator` registered in `AbstractIntegrationTest`'s `@Import`.
- **String/enum literals stay lowercase English** (DB CHECK + OpenAPI enum); Hungarian only in comments/labels.
- **Build commands:** backend `cd backend && ./mvnw clean test` (always `clean`); contract `cd api/generate && npm run generate:api` then `cd frontend && pnpm generate:api`; frontend `cd frontend && pnpm test` (real mode) + `VITE_USE_MOCK=true pnpm test` (mock) + `pnpm build`. Local DB: `cd backend && docker compose up -d` (PG on :15432).
- **Slice boundary:** G1 does NOT add `goal_plan_link`, the TDEE/prescription jsonb columns, the timeline UI, or the Súly-tab move. Those are G3/G4/G5 and arrive via additive migrations.

---

### Task 1: Contract — `goal.yml` + `biometrics-profile.yml` fragments

**Files:**
- Create: `api/feature/goal/goal.yml`
- Create: `api/feature/biometrics-profile/biometrics-profile.yml`
- Modify: `api/generate/merge.yml` (append two inputs)
- Regenerate: `api/openapi.yml`, `frontend/src/lib/api.gen.ts`

**Interfaces:**
- Produces (generated): `io.mrkuhne.mezo.api.controller.GoalApi`, `BiometricProfileApi`; DTOs `GoalResponse` (+ nested `StatusEnum`, `TrajectoryEnum`), `GoalUpsertRequest`, `BiometricProfileResponse`, `BiometricProfileUpsertRequest`. Frontend: `components['schemas']['GoalResponse'|'GoalUpsertRequest'|'BiometricProfileResponse'|'BiometricProfileUpsertRequest']`.

- [ ] **Step 1: Write `api/feature/goal/goal.yml`**

```yaml
openapi: 3.0.3
info:
  title: ''
  version: ''
tags:
  - name: Goal
    description: Goal domain — goal-rooted timeline (trajectory + quality guards + window)
paths:
  /api/goals:
    get:
      tags: [Goal]
      operationId: listGoals
      summary: List the owner's goals (active first)
      responses:
        '200':
          description: Goals
          content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/GoalResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
    post:
      tags: [Goal]
      operationId: createGoal
      summary: Create a goal (status = planned)
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/GoalUpsertRequest' } } }
      responses:
        '201': { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/GoalResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/goals/{id}:
    get:
      tags: [Goal]
      operationId: getGoal
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      responses:
        '200': { description: Goal, content: { application/json: { schema: { $ref: '#/components/schemas/GoalResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
    put:
      tags: [Goal]
      operationId: updateGoal
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/GoalUpsertRequest' } } }
      responses:
        '200': { description: Updated, content: { application/json: { schema: { $ref: '#/components/schemas/GoalResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
    delete:
      tags: [Goal]
      operationId: deleteGoal
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      responses:
        '204': { description: Deleted }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/goals/{id}/activate:
    post:
      tags: [Goal]
      operationId: activateGoal
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      responses:
        '200': { description: Activated, content: { application/json: { schema: { $ref: '#/components/schemas/GoalResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/goals/{id}/archive:
    post:
      tags: [Goal]
      operationId: archiveGoal
      parameters: [ { name: id, in: path, required: true, schema: { type: string, format: uuid } } ]
      responses:
        '200': { description: Archived, content: { application/json: { schema: { $ref: '#/components/schemas/GoalResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
components:
  schemas:
    GoalResponse:
      type: object
      required: [id, title, trajectory, guards, status, startDate, targetDate, startWeightKg, rateTargetPctPerWeek]
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        trajectory: { type: string, enum: [cut, bulk, maintain] }
        guards: { type: array, items: { type: string, enum: [strength, muscle] } }
        status: { type: string, enum: [planned, active, archived] }
        startDate: { type: string, format: date }
        targetDate: { type: string, format: date }
        startWeightKg: { type: number }
        targetWeightKg: { type: number, nullable: true }
        rateTargetPctPerWeek: { type: number }
        identityFrame: { type: string, nullable: true }
    GoalUpsertRequest:
      type: object
      required: [title, trajectory, startDate, targetDate, startWeightKg, rateTargetPctPerWeek]
      properties:
        title: { type: string, minLength: 1 }
        trajectory: { type: string, pattern: '^(cut|bulk|maintain)$' }
        guards: { type: array, items: { type: string, pattern: '^(strength|muscle)$' } }
        startDate: { type: string, format: date }
        targetDate: { type: string, format: date }
        startWeightKg: { type: number, minimum: 0 }
        targetWeightKg: { type: number, nullable: true, minimum: 0 }
        rateTargetPctPerWeek: { type: number, minimum: 0 }
        identityFrame: { type: string, nullable: true }
```

> Note: `trajectory` is `enum` in the Response (generates a `TrajectoryEnum`, mapped from the entity String like `status`) but `pattern` in the Request (an invalid value yields HTTP 400 FIELD, not a 500 Jackson failure — per the contract gotcha). `guards` items are `enum` in the response and `pattern` in the request for the same reason.

- [ ] **Step 2: Write `api/feature/biometrics-profile/biometrics-profile.yml`**

```yaml
openapi: 3.0.3
info:
  title: ''
  version: ''
tags:
  - name: BiometricProfile
    description: Body-composition profile — the TDEE bootstrap inputs (one per owner)
paths:
  /api/biometrics/profile:
    get:
      tags: [BiometricProfile]
      operationId: getBiometricProfile
      summary: The owner's biometric profile
      responses:
        '200': { description: Profile, content: { application/json: { schema: { $ref: '#/components/schemas/BiometricProfileResponse' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '404': { description: No profile yet, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
    put:
      tags: [BiometricProfile]
      operationId: upsertBiometricProfile
      summary: Create or replace the owner's biometric profile
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/BiometricProfileUpsertRequest' } } }
      responses:
        '200': { description: Upserted, content: { application/json: { schema: { $ref: '#/components/schemas/BiometricProfileResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
components:
  schemas:
    BiometricProfileResponse:
      type: object
      required: [sex, heightCm, birthDate]
      properties:
        sex: { type: string, enum: [M, F] }
        heightCm: { type: number }
        birthDate: { type: string, format: date }
        bodyFatPct: { type: number, nullable: true }
    BiometricProfileUpsertRequest:
      type: object
      required: [sex, heightCm, birthDate]
      properties:
        sex: { type: string, pattern: '^(M|F)$' }
        heightCm: { type: number, minimum: 50, maximum: 260 }
        birthDate: { type: string, format: date }
        bodyFatPct: { type: number, nullable: true, minimum: 0, maximum: 75 }
```

- [ ] **Step 3: Register both fragments in `api/generate/merge.yml`** — append after the `train` line:

```yaml
  - inputFile: ../feature/train/train.yml
  - inputFile: ../feature/goal/goal.yml
  - inputFile: ../feature/biometrics-profile/biometrics-profile.yml
output: ../openapi.yml
```

- [ ] **Step 4: Regenerate the merged + frontend contract**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: `api/openapi.yml` updated (now contains `GoalResponse`, `BiometricProfileResponse`, `/api/goals` paths); `frontend/src/lib/api.gen.ts` updated. Verify: `grep -c "GoalResponse" ../api/openapi.yml` ≥ 1 and `grep -c "GoalResponse" src/lib/api.gen.ts` ≥ 1.

- [ ] **Step 5: Commit**

```bash
git add api/feature/goal api/feature/biometrics-profile api/generate/merge.yml api/openapi.yml frontend/src/lib/api.gen.ts
git commit -m "feat(api): goal + biometric-profile contract fragments (mezo-2hp)"
```

---

### Task 2: Liquibase migration — `goal` + `biometric_profile` tables

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202606181200_mezo-2hp_create_goal.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeset)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (TRUNCATE list)

- [ ] **Step 1: Write the changeset SQL** (`...202606181200_mezo-2hp_create_goal.sql`)

```sql
CREATE TABLE goal (
    id                       UUID DEFAULT gen_random_uuid(),
    created_by               UUID NOT NULL,
    title                    TEXT NOT NULL,
    trajectory               TEXT NOT NULL,
    guards                   TEXT[] NOT NULL DEFAULT '{}',
    status                   TEXT NOT NULL,
    start_date               DATE NOT NULL,
    target_date              DATE NOT NULL,
    start_weight_kg          NUMERIC(5,2) NOT NULL,
    target_weight_kg         NUMERIC(5,2),
    rate_target_pct_per_week NUMERIC(4,2) NOT NULL,
    identity_frame           TEXT,
    is_deleted               BOOLEAN NOT NULL DEFAULT false,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_goal_id PRIMARY KEY (id),
    CONSTRAINT fk_goal_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_goal_trajectory CHECK (trajectory IN ('cut','bulk','maintain')),
    CONSTRAINT ck_goal_status CHECK (status IN ('planned','active','archived'))
);
CREATE INDEX idx_goal_created_by ON goal (created_by);

CREATE TABLE biometric_profile (
    id            UUID DEFAULT gen_random_uuid(),
    created_by    UUID NOT NULL,
    sex           TEXT NOT NULL,
    height_cm     NUMERIC(5,2) NOT NULL,
    birth_date    DATE NOT NULL,
    body_fat_pct  NUMERIC(4,2),
    is_deleted    BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_biometric_profile_id PRIMARY KEY (id),
    CONSTRAINT fk_biometric_profile_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_biometric_profile_sex CHECK (sex IN ('M','F')),
    CONSTRAINT uq_biometric_profile_created_by UNIQUE (created_by)
);
```

> `guards TEXT[]` mirrors `mesocycle.phase_curve` (the entity maps it as `List<String>` via `@JdbcTypeCode(SqlTypes.ARRAY)`). `uq_biometric_profile_created_by` is a real single-column UNIQUE (one profile per owner) — distinct from the goal's single-active rule, which is service-enforced (no partial unique index exists in this repo).

- [ ] **Step 2: Register the changeset in `1.0.0_master.yml`** (append at the end of `databaseChangeLog:`):

```yaml
  - changeSet:
      id: "1.0.0:202606181200_mezo-2hp_create_goal"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202606181200_mezo-2hp_create_goal.sql
```

- [ ] **Step 3: Add both tables to `ResetDatabase` TRUNCATE list** — edit the single `TRUNCATE TABLE ...` native query in `resetExceptMasterData()` to include `goal` and `biometric_profile` (child-before-parent is for readability; CASCADE handles FKs):

```java
entityManager.createNativeQuery(
    "TRUNCATE TABLE weight_log, sleep_log, check_in, "
        + "exercise_feedback, exercise_set, exercise, workout_session, muscle_group_volume_log, mesocycle, "
        + "gym_schedule_slot, sport_schedule_slot, sport_session, run_session_log, running_block, "
        + "goal, biometric_profile CASCADE").executeUpdate();
```

- [ ] **Step 4: Verify migration applies (DB must be up: `cd backend && docker compose up -d`)**

Run: `cd backend && ./mvnw clean test -Dtest=CorsConfigIT`
Expected: PASS — the context boots, which means Liquibase applied both new changesets cleanly. (A targeted existing IT is the cheapest boot smoke-test.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java
git commit -m "feat(db): goal + biometric_profile tables (mezo-2hp)"
```

---

### Task 3: `GoalEntity` + repository + populator + persistence IT

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/GoalEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/repository/GoalRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/GoalPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java` (`@Import`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalServiceIT.java`

**Interfaces:**
- Produces: `GoalEntity` (getters/setters via Lombok), `GoalRepository.findByCreatedByAndDeletedFalseOrderByStatusAscStartDateAsc(UUID)`, `findByIdAndCreatedByAndDeletedFalse(UUID,UUID)`, `findByCreatedByAndStatusAndDeletedFalse(UUID,String)`. `GoalPopulator.createGoal(UUID owner, String trajectory, String status)`.

- [ ] **Step 1: Write `GoalEntity`**

```java
package io.mrkuhne.mezo.feature.goal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * A Cél: a goal-rooted timeline. {@code trajectory} (cut|bulk|maintain) + {@code guards}
 * (strength|muscle, typed text[]) + a window (start..target). Lifecycle status
 * planned|active|archived; at most one active per owner (enforced in {@code GoalService}).
 *
 * <p>{@code createdBy}, {@code is_deleted}, {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "goal")
@SQLDelete(sql = "update goal set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class GoalEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Column(nullable = false) private String title;
    @NotNull @Column(nullable = false) private String trajectory; // cut|bulk|maintain (DB CHECK)

    @NotNull
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "text[]")
    private List<String> guards = new ArrayList<>(); // strength|muscle

    @NotNull @Column(nullable = false) private String status; // planned|active|archived (DB CHECK)
    @NotNull @Column(name = "start_date", nullable = false) private LocalDate startDate;
    @NotNull @Column(name = "target_date", nullable = false) private LocalDate targetDate;
    @NotNull @Column(name = "start_weight_kg", nullable = false) private BigDecimal startWeightKg;
    @Column(name = "target_weight_kg") private BigDecimal targetWeightKg;
    @NotNull @Column(name = "rate_target_pct_per_week", nullable = false) private BigDecimal rateTargetPctPerWeek;
    @Column(name = "identity_frame") private String identityFrame;
}
```

- [ ] **Step 2: Write `GoalRepository`**

```java
package io.mrkuhne.mezo.feature.goal.repository;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoalRepository extends JpaRepository<GoalEntity, UUID> {

    // No 'date' base field => extend JpaRepository directly (not OwnedRepository).
    // Active-first ordering: 'active' < 'archived' < 'planned' alphabetically is wrong,
    // so the service sorts; here we order by start_date and let the service hoist active.
    List<GoalEntity> findByCreatedByAndDeletedFalseOrderByStartDateDesc(UUID createdBy);

    Optional<GoalEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** All owned goals in one status — drives the single-active invariant on activate. */
    List<GoalEntity> findByCreatedByAndStatusAndDeletedFalse(UUID createdBy, String status);
}
```

- [ ] **Step 3: Write `GoalPopulator`** (test support)

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class GoalPopulator {

    private final GoalRepository goalRepository;

    /** Full-control factory: persists a goal for {@code owner} and flushes so DB CHECKs fire. */
    public GoalEntity createGoal(UUID owner, String trajectory, String status) {
        GoalEntity g = new GoalEntity();
        g.setCreatedBy(owner);
        g.setTitle("Nyári cut");
        g.setTrajectory(trajectory);
        g.setGuards(List.of("strength", "muscle"));
        g.setStatus(status);
        g.setStartDate(LocalDate.of(2026, 6, 1));
        g.setTargetDate(LocalDate.of(2026, 7, 27));
        g.setStartWeightKg(new BigDecimal("84.20"));
        g.setTargetWeightKg(new BigDecimal("80.00"));
        g.setRateTargetPctPerWeek(new BigDecimal("0.70"));
        g.setIdentityFrame("Erő megtartva a cut alatt.");
        return goalRepository.saveAndFlush(g);
    }
}
```

- [ ] **Step 4: Register `GoalPopulator` in `AbstractIntegrationTest`'s `@Import`**

```java
@Import({TestcontainersConfiguration.class, DatabasePopulator.class, UserPopulator.class,
    TrainPopulator.class, GoalPopulator.class, ResetDatabase.class})
```

- [ ] **Step 5: Write the failing persistence IT** (`feature/goal/GoalServiceIT.java`)

```java
package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class GoalServiceIT extends AbstractIntegrationTest {

    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @PersistenceContext private EntityManager entityManager;

    @Test
    void testCreateGoal_shouldRoundTripTrajectoryAndGuards_whenPersisted() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        GoalEntity saved = goalPopulator.createGoal(user, "cut", "planned");
        entityManager.clear();
        GoalEntity reloaded = goalRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getTrajectory()).isEqualTo("cut");
        assertThat(reloaded.getGuards()).containsExactlyInAnyOrder("strength", "muscle");
        assertThat(reloaded.getCreatedBy()).isEqualTo(user);
    }

    @Test
    void testCreateGoal_shouldRejectRow_whenTrajectoryNotInCheck() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        assertThatThrownBy(() -> goalPopulator.createGoal(user, "recomp", "planned"))
            .hasMessageContaining("ck_goal_trajectory");
    }

    @Test
    void testFindByOwner_shouldExcludeOtherOwners_whenQueried() {
        UUID me = databasePopulator.populateUser("me@test.local");
        UUID other = databasePopulator.populateUser("other@test.local");
        goalPopulator.createGoal(me, "cut", "active");
        goalPopulator.createGoal(other, "bulk", "active");
        List<GoalEntity> mine = goalRepository.findByCreatedByAndDeletedFalseOrderByStartDateDesc(me);
        assertThat(mine).hasSize(1).allMatch(g -> g.getCreatedBy().equals(me));
    }
}
```

- [ ] **Step 6: Run the IT to verify it fails, then passes**

Run: `cd backend && ./mvnw clean test -Dtest=GoalServiceIT`
Expected after Steps 1–5: PASS. (If `GoalEntity`/repo were missing it would not compile — write them first; the CHECK-rejection test is the behavioral assertion.)

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal backend/src/test/java/io/mrkuhne/mezo/support backend/src/test/java/io/mrkuhne/mezo/feature/goal
git commit -m "feat(goal): GoalEntity + repository + persistence IT (mezo-2hp)"
```

---

### Task 4: `GoalMapper` + `GoalService` CRUD

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/mapper/GoalMapper.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalService.java`
- Test: extend `GoalServiceIT` with CRUD cases.

**Interfaces:**
- Consumes: `GoalEntity`, `GoalRepository`, generated `GoalResponse`/`GoalUpsertRequest`, `CurrentUserId`, `SystemMessage`/`SystemRuntimeErrorException`.
- Produces: `GoalService.listGoals(UUID)`, `getGoal(UUID,UUID)`, `createGoal(UUID,GoalUpsertRequest)`, `updateGoal(UUID,UUID,GoalUpsertRequest)`, `deleteGoal(UUID,UUID)` — all returning `GoalResponse` except delete (void). Active goal sorted first in the list.

- [ ] **Step 1: Write `GoalMapper`**

```java
package io.mrkuhne.mezo.feature.goal.mapper;

import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface GoalMapper {

    @Mapping(target = "trajectory",
        expression = "java(GoalResponse.TrajectoryEnum.fromValue(entity.getTrajectory()))")
    @Mapping(target = "status",
        expression = "java(GoalResponse.StatusEnum.fromValue(entity.getStatus()))")
    @Mapping(target = "guards",
        expression = "java(toGuardEnums(entity.getGuards()))")
    GoalResponse toResponse(GoalEntity entity);

    default List<GoalResponse.GuardsEnum> toGuardEnums(List<String> guards) {
        return guards == null ? List.of()
            : guards.stream().map(GoalResponse.GuardsEnum::fromValue).toList();
    }
}
```

> If the generator names the inner guard enum differently (it derives from the property name `guards` + `enum`), adjust `GoalResponse.GuardsEnum` to the generated name — inspect `backend/target/generated-sources/openapi/.../api/dto/GoalResponse.java` after Task 1's build. MapStruct cannot auto-map `List<String>`→`List<Enum>`, hence the explicit `default` method.

- [ ] **Step 2: Write `GoalService` (CRUD only; lifecycle added in Task 5)**

```java
package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.api.dto.GoalUpsertRequest;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.mapper.GoalMapper;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GoalService {

    private final GoalRepository goalRepository;
    private final GoalMapper goalMapper;

    /** Active goal first, then by start date desc. */
    public List<GoalResponse> listGoals(UUID userId) {
        return goalRepository.findByCreatedByAndDeletedFalseOrderByStartDateDesc(userId).stream()
            .sorted(Comparator.comparing((GoalEntity g) -> !"active".equals(g.getStatus())))
            .map(goalMapper::toResponse)
            .toList();
    }

    public GoalResponse getGoal(UUID userId, UUID id) {
        return goalMapper.toResponse(requireOwned(userId, id));
    }

    @Transactional
    public GoalResponse createGoal(UUID userId, GoalUpsertRequest req) {
        GoalEntity e = new GoalEntity();
        e.setCreatedBy(userId);   // server-side ownership — never from the client
        e.setStatus("planned");
        applyUpsert(e, req);
        return goalMapper.toResponse(goalRepository.save(e));
    }

    @Transactional
    public GoalResponse updateGoal(UUID userId, UUID id, GoalUpsertRequest req) {
        GoalEntity e = requireOwned(userId, id);
        applyUpsert(e, req);   // status is NOT touched here (lifecycle endpoints own it)
        return goalMapper.toResponse(e);
    }

    @Transactional
    public void deleteGoal(UUID userId, UUID id) {
        goalRepository.delete(requireOwned(userId, id)); // @SQLDelete soft-deletes
    }

    private void applyUpsert(GoalEntity e, GoalUpsertRequest req) {
        e.setTitle(req.getTitle());
        e.setTrajectory(req.getTrajectory());
        e.setGuards(req.getGuards() == null ? List.of() : req.getGuards());
        e.setStartDate(req.getStartDate());
        e.setTargetDate(req.getTargetDate());
        e.setStartWeightKg(req.getStartWeightKg());
        e.setTargetWeightKg(req.getTargetWeightKg());
        e.setRateTargetPctPerWeek(req.getRateTargetPctPerWeek());
        e.setIdentityFrame(req.getIdentityFrame());
    }

    /** Ownership gate: missing and foreign rows are indistinguishable (404). */
    private GoalEntity requireOwned(UUID userId, UUID id) {
        return goalRepository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
```

> `req.getStartWeightKg()` returns `BigDecimal` (OpenAPI `number` → `BigDecimal` with the spring generator's default). If the generated type is `Double`, convert via `BigDecimal.valueOf(...)` — confirm against the generated `GoalUpsertRequest`.

- [ ] **Step 3: Add CRUD ITs to `GoalServiceIT`** (append; uses the generated request type)

```java
    @Autowired private io.mrkuhne.mezo.feature.goal.service.GoalService goalService;

    @Test
    void testCreateGoal_shouldDefaultStatusToPlanned_whenCreated() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        var res = goalService.createGoal(user, upsertReq());
        assertThat(res.getStatus()).isEqualTo(io.mrkuhne.mezo.api.dto.GoalResponse.StatusEnum.PLANNED);
        assertThat(res.getTrajectory()).isEqualTo(io.mrkuhne.mezo.api.dto.GoalResponse.TrajectoryEnum.CUT);
    }

    @Test
    void testGetGoal_shouldThrow404_whenForeignOwner() {
        UUID me = databasePopulator.populateUser("me@test.local");
        UUID other = databasePopulator.populateUser("other@test.local");
        var foreign = goalPopulator.createGoal(other, "cut", "planned");
        assertThatThrownBy(() -> goalService.getGoal(me, foreign.getId()))
            .isInstanceOf(io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException.class)
            .hasMessageContaining("RESOURCE_NOT_FOUND");
    }

    private static io.mrkuhne.mezo.api.dto.GoalUpsertRequest upsertReq() {
        return io.mrkuhne.mezo.api.dto.GoalUpsertRequest.builder()
            .title("Nyári cut").trajectory("cut").guards(java.util.List.of("strength", "muscle"))
            .startDate(java.time.LocalDate.of(2026, 6, 1)).targetDate(java.time.LocalDate.of(2026, 7, 27))
            .startWeightKg(new java.math.BigDecimal("84.20")).targetWeightKg(new java.math.BigDecimal("80.00"))
            .rateTargetPctPerWeek(new java.math.BigDecimal("0.70")).identityFrame("Erő megtartva.").build();
    }
```

- [ ] **Step 4: Run**

Run: `cd backend && ./mvnw clean test -Dtest=GoalServiceIT`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal backend/src/test/java/io/mrkuhne/mezo/feature/goal
git commit -m "feat(goal): GoalService CRUD + mapper (mezo-2hp)"
```

---

### Task 5: `GoalService` lifecycle — activate (single-active) + archive

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalService.java`
- Test: extend `GoalServiceIT`.

**Interfaces:**
- Produces: `GoalService.activateGoal(UUID,UUID)`, `archiveGoal(UUID,UUID)` → `GoalResponse`.

- [ ] **Step 1: Add lifecycle methods to `GoalService`**

```java
    @Transactional
    public GoalResponse activateGoal(UUID userId, UUID id) {
        GoalEntity target = requireOwned(userId, id);
        // Single-active invariant: activating archives every other active goal (dirty-checking flushes).
        for (GoalEntity other : goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")) {
            if (!other.getId().equals(id)) {
                other.setStatus("archived");
            }
        }
        if (!"active".equals(target.getStatus())) {
            target.setStatus("active");
        }
        return goalMapper.toResponse(target);
    }

    @Transactional
    public GoalResponse archiveGoal(UUID userId, UUID id) {
        GoalEntity e = requireOwned(userId, id);
        if (!"archived".equals(e.getStatus())) {
            e.setStatus("archived");
        }
        return goalMapper.toResponse(e);
    }
```

- [ ] **Step 2: Add the single-active IT to `GoalServiceIT`**

```java
    @Test
    void testActivateGoal_shouldArchivePreviousActive_whenAnotherIsActivated() {
        UUID user = databasePopulator.populateUser("goal@test.local");
        var first = goalPopulator.createGoal(user, "cut", "active");
        var second = goalPopulator.createGoal(user, "bulk", "planned");
        goalService.activateGoal(user, second.getId());
        entityManager.flush();
        entityManager.clear();
        assertThat(goalRepository.findById(first.getId()).orElseThrow().getStatus()).isEqualTo("archived");
        assertThat(goalRepository.findById(second.getId()).orElseThrow().getStatus()).isEqualTo("active");
    }
```

- [ ] **Step 3: Run**

Run: `cd backend && ./mvnw clean test -Dtest=GoalServiceIT`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal backend/src/test/java/io/mrkuhne/mezo/feature/goal
git commit -m "feat(goal): activate (single-active) + archive lifecycle (mezo-2hp)"
```

---

### Task 6: `GoalController` + `GoalContractIT`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/controller/GoalController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalContractIT.java`

**Interfaces:**
- Consumes: generated `GoalApi`, `GoalService`, `CurrentUserId`.
- Produces: HTTP endpoints `/api/goals*`.

- [ ] **Step 1: Write `GoalController`**

```java
package io.mrkuhne.mezo.feature.goal.controller;

import io.mrkuhne.mezo.api.controller.GoalApi;
import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.api.dto.GoalUpsertRequest;
import io.mrkuhne.mezo.feature.goal.service.GoalService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated {@link GoalApi}; mappings/validation come from the interface. */
@RestController
@RequiredArgsConstructor
public class GoalController implements GoalApi {

    private final GoalService goalService;
    private final CurrentUserId currentUserId;

    @Override public List<GoalResponse> listGoals() { return goalService.listGoals(currentUserId.get()); }
    @Override public GoalResponse getGoal(UUID id) { return goalService.getGoal(currentUserId.get(), id); }
    @Override public GoalResponse createGoal(GoalUpsertRequest req) { return goalService.createGoal(currentUserId.get(), req); }
    @Override public GoalResponse updateGoal(UUID id, GoalUpsertRequest req) { return goalService.updateGoal(currentUserId.get(), id, req); }
    @Override public void deleteGoal(UUID id) { goalService.deleteGoal(currentUserId.get(), id); }
    @Override public GoalResponse activateGoal(UUID id) { return goalService.activateGoal(currentUserId.get(), id); }
    @Override public GoalResponse archiveGoal(UUID id) { return goalService.archiveGoal(currentUserId.get(), id); }
}
```

- [ ] **Step 2: Write `GoalContractIT`**

```java
package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.api.dto.GoalUpsertRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

class GoalContractIT extends ApiIntegrationTest {

    private static GoalUpsertRequest.GoalUpsertRequestBuilder req() {
        return GoalUpsertRequest.builder()
            .title("Nyári cut").trajectory("cut").guards(List.of("strength", "muscle"))
            .startDate(LocalDate.of(2026, 6, 1)).targetDate(LocalDate.of(2026, 7, 27))
            .startWeightKg(new BigDecimal("84.20")).targetWeightKg(new BigDecimal("80.00"))
            .rateTargetPctPerWeek(new BigDecimal("0.70")).identityFrame("Erő megtartva.");
    }

    @Test
    void testCreateGoal_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/goals", req().build(), null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testCreateGoal_shouldReturn201AndAppearInList_whenValid() {
        HttpHeaders auth = ownerAuthHeaders();
        GoalResponse created = postForBody("/api/goals", req().build(), auth, HttpStatus.CREATED, GoalResponse.class);
        assertThat(created.getId()).isNotNull();
        assertThat(created.getStatus()).isEqualTo(GoalResponse.StatusEnum.PLANNED);
        List<GoalResponse> goals = getForList("/api/goals", auth, HttpStatus.OK, GoalResponse.class);
        assertThat(goals).extracting(GoalResponse::getId).contains(created.getId());
    }

    @Test
    void testCreateGoal_shouldReturn400_whenTitleMissing() {
        String body = postForBody("/api/goals", req().title(null).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "title", "VALIDATION_REQUIRED_FIELD");
    }

    @Test
    void testActivateGoal_shouldFlipStatusToActive_whenCalled() {
        HttpHeaders auth = ownerAuthHeaders();
        GoalResponse created = postForBody("/api/goals", req().build(), auth, HttpStatus.CREATED, GoalResponse.class);
        GoalResponse activated = postForBody("/api/goals/" + created.getId() + "/activate", null, auth,
            HttpStatus.OK, GoalResponse.class);
        assertThat(activated.getStatus()).isEqualTo(GoalResponse.StatusEnum.ACTIVE);
    }

    @Test
    void testGetGoal_shouldReturn404_whenUnknownId() {
        getForBody("/api/goals/" + java.util.UUID.randomUUID(), ownerAuthHeaders(),
            HttpStatus.NOT_FOUND, String.class);
    }
}
```

- [ ] **Step 3: Run**

Run: `cd backend && ./mvnw clean test -Dtest=GoalContractIT`
Expected: PASS. (If `VALIDATION_REQUIRED_FIELD` is not the exact code emitted for a missing `title`, read `messages.properties` + an existing `*ContractIT` 400 case and use the matching code — the assertion is the contract, not a guess.)

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/controller backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalContractIT.java
git commit -m "feat(goal): GoalController + contract IT (mezo-2hp)"
```

---

### Task 7: Demodata goal seed

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/GoalSeedData.java`

**Interfaces:**
- Consumes: `GoalRepository`, `AppUserRepository`, `OwnerProperties`. Mirrors `feature/train/RunningSeedData.java` exactly (owner resolution + idempotency + `@Order` + test-only no-arg `run()` overload).

- [ ] **Step 1: Write the seed bean** (verbatim mirror of `RunningSeedData`'s owner resolution + idempotency)

```java
package io.mrkuhne.mezo.feature.goal;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds ONE active demo goal for the owner under {@code @Profile("demodata")} so the Cél hero
 * renders in REAL mode. Mirrors {@link io.mrkuhne.mezo.feature.train.RunningSeedData}'s owner
 * resolution + idempotency. Idempotent: no-op if any goal already exists.
 */
@Component
@Profile("demodata")
@Order(120) // after OwnerSeedData (and after the train/running seeds at 100/110)
@RequiredArgsConstructor
public class GoalSeedData implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final OwnerProperties ownerProperties;
    private final GoalRepository goalRepository;

    @Override
    @Transactional
    public void run(String... args) { run(); }

    /** No-arg overload — used by integration tests to re-seed into a reset DB. */
    @Transactional
    public void run() {
        if (goalRepository.count() > 0) return;
        AppUserEntity owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow();
        GoalEntity g = new GoalEntity();
        g.setCreatedBy(owner.getId());
        g.setTitle("Nyári cut");
        g.setTrajectory("cut");
        g.setGuards(List.of("strength", "muscle"));
        g.setStatus("active");
        g.setStartDate(LocalDate.of(2026, 6, 1));
        g.setTargetDate(LocalDate.of(2026, 7, 27));
        g.setStartWeightKg(new BigDecimal("84.20"));
        g.setTargetWeightKg(new BigDecimal("80.00"));
        g.setRateTargetPctPerWeek(new BigDecimal("0.70"));
        g.setIdentityFrame("Erő megtartva a cut alatt — nem csak a szám.");
        goalRepository.save(g);
    }
}
```

> Named `GoalSeedData` to match the `*SeedData` convention (`OwnerSeedData`/`RunningSeedData`). `goalRepository.count()` is the idempotency guard (mirrors `RunningSeedData`); the `@SQLRestriction` makes `count()` see only non-deleted rows.

- [ ] **Step 2: Verify the app boots with the seed under demodata**

Run: `cd backend && ./mvnw clean test -Dtest=GoalContractIT` (ApiIntegrationTest runs under `@ActiveProfiles("demodata")`, so the seed executes; `ResetDatabase` truncates `goal` between tests, so the seed-vs-test interaction is clean because the seed runs once at startup before the per-test reset).
Expected: PASS, no startup failure.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/GoalSeedData.java
git commit -m "feat(goal): demodata active goal seed (mezo-2hp)"
```

---

### Task 8: `BiometricProfile` aggregate (entity → service)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/profile/entity/BiometricProfileEntity.java`
- Create: `.../profile/repository/BiometricProfileRepository.java`
- Create: `.../profile/mapper/BiometricProfileMapper.java`
- Create: `.../profile/service/BiometricProfileService.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/BiometricProfilePopulator.java`
- Modify: `AbstractIntegrationTest` `@Import`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/profile/BiometricProfileServiceIT.java`

**Interfaces:**
- Produces: `BiometricProfileService.getProfile(UUID)` → `BiometricProfileResponse` (404 if none), `upsertProfile(UUID, BiometricProfileUpsertRequest)` → `BiometricProfileResponse` (one per owner).

- [ ] **Step 1: Write `BiometricProfileEntity`** (owned, soft-delete, `sex` String + CHECK)

```java
package io.mrkuhne.mezo.feature.biometrics.profile.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@Entity
@Table(name = "biometric_profile")
@SQLDelete(sql = "update biometric_profile set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class BiometricProfileEntity extends OwnedEntity {

    @Id @GeneratedValue @Column(columnDefinition = "uuid") private UUID id;
    @NotNull @Column(nullable = false) private String sex; // M|F (DB CHECK)
    @NotNull @Column(name = "height_cm", nullable = false) private BigDecimal heightCm;
    @NotNull @Column(name = "birth_date", nullable = false) private LocalDate birthDate;
    @Column(name = "body_fat_pct") private BigDecimal bodyFatPct;
}
```

- [ ] **Step 2: Write repository + mapper**

```java
// repository/BiometricProfileRepository.java
package io.mrkuhne.mezo.feature.biometrics.profile.repository;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import java.util.Optional; import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface BiometricProfileRepository extends JpaRepository<BiometricProfileEntity, UUID> {
    Optional<BiometricProfileEntity> findByCreatedByAndDeletedFalse(UUID createdBy);
}
```

```java
// mapper/BiometricProfileMapper.java
package io.mrkuhne.mezo.feature.biometrics.profile.mapper;
import io.mrkuhne.mezo.api.dto.BiometricProfileResponse;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import org.mapstruct.Mapper; import org.mapstruct.Mapping;
@Mapper(componentModel = "spring")
public interface BiometricProfileMapper {
    @Mapping(target = "sex",
        expression = "java(BiometricProfileResponse.SexEnum.fromValue(entity.getSex()))")
    BiometricProfileResponse toResponse(BiometricProfileEntity entity);
}
```

- [ ] **Step 3: Write `BiometricProfileService`** (upsert = one per owner)

```java
package io.mrkuhne.mezo.feature.biometrics.profile.service;

import io.mrkuhne.mezo.api.dto.BiometricProfileResponse;
import io.mrkuhne.mezo.api.dto.BiometricProfileUpsertRequest;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.profile.mapper.BiometricProfileMapper;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BiometricProfileService {

    private final BiometricProfileRepository repository;
    private final BiometricProfileMapper mapper;

    public BiometricProfileResponse getProfile(UUID userId) {
        return repository.findByCreatedByAndDeletedFalse(userId)
            .map(mapper::toResponse)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }

    @Transactional
    public BiometricProfileResponse upsertProfile(UUID userId, BiometricProfileUpsertRequest req) {
        BiometricProfileEntity e = repository.findByCreatedByAndDeletedFalse(userId)
            .orElseGet(() -> { BiometricProfileEntity x = new BiometricProfileEntity(); x.setCreatedBy(userId); return x; });
        e.setSex(req.getSex());
        e.setHeightCm(req.getHeightCm());
        e.setBirthDate(req.getBirthDate());
        e.setBodyFatPct(req.getBodyFatPct());
        return mapper.toResponse(repository.save(e));
    }
}
```

- [ ] **Step 4: Write `BiometricProfilePopulator`, register in `@Import`, write `BiometricProfileServiceIT`**

```java
// support/populator/BiometricProfilePopulator.java
@org.springframework.boot.test.context.TestComponent
@lombok.RequiredArgsConstructor
public class BiometricProfilePopulator {
    private final io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository repo;
    public io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity create(java.util.UUID owner) {
        var e = new io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity();
        e.setCreatedBy(owner); e.setSex("M");
        e.setHeightCm(new java.math.BigDecimal("180.0"));
        e.setBirthDate(java.time.LocalDate.of(1991, 3, 1));
        e.setBodyFatPct(new java.math.BigDecimal("15.0"));
        return repo.saveAndFlush(e);
    }
}
```

Add `BiometricProfilePopulator.class` to `AbstractIntegrationTest`'s `@Import` array. Then:

```java
// feature/biometrics/profile/BiometricProfileServiceIT.java
package io.mrkuhne.mezo.feature.biometrics.profile;
import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.api.dto.BiometricProfileResponse;
import io.mrkuhne.mezo.api.dto.BiometricProfileUpsertRequest;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.feature.biometrics.profile.service.BiometricProfileService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.math.BigDecimal; import java.time.LocalDate; import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class BiometricProfileServiceIT extends AbstractIntegrationTest {
    @Autowired private BiometricProfileService service;
    @Autowired private BiometricProfileRepository repository;
    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;

    @Test
    void testUpsertProfile_shouldReplaceNotDuplicate_whenCalledTwice() {
        UUID user = databasePopulator.populateUser("bp@test.local");
        service.upsertProfile(user, req("M"));
        BiometricProfileResponse second = service.upsertProfile(user, req("F"));
        assertThat(second.getSex()).isEqualTo(BiometricProfileResponse.SexEnum.F);
        assertThat(repository.findByCreatedByAndDeletedFalse(user)).isPresent();
        assertThat(repository.findAll()).hasSize(1); // one per owner — upsert, not insert
    }

    private static BiometricProfileUpsertRequest req(String sex) {
        return BiometricProfileUpsertRequest.builder()
            .sex(sex).heightCm(new BigDecimal("180.0")).birthDate(LocalDate.of(1991, 3, 1))
            .bodyFatPct(new BigDecimal("15.0")).build();
    }
}
```

- [ ] **Step 5: Run**

Run: `cd backend && ./mvnw clean test -Dtest=BiometricProfileServiceIT`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/profile backend/src/test/java/io/mrkuhne/mezo/support backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/profile
git commit -m "feat(biometrics): BiometricProfile aggregate (entity..service) (mezo-2hp)"
```

---

### Task 9: `BiometricProfileController` + contract IT

**Files:**
- Create: `.../profile/controller/BiometricProfileController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/profile/BiometricProfileContractIT.java`

- [ ] **Step 1: Write the controller**

```java
package io.mrkuhne.mezo.feature.biometrics.profile.controller;
import io.mrkuhne.mezo.api.controller.BiometricProfileApi;
import io.mrkuhne.mezo.api.dto.BiometricProfileResponse;
import io.mrkuhne.mezo.api.dto.BiometricProfileUpsertRequest;
import io.mrkuhne.mezo.feature.biometrics.profile.service.BiometricProfileService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class BiometricProfileController implements BiometricProfileApi {
    private final BiometricProfileService service;
    private final CurrentUserId currentUserId;
    @Override public BiometricProfileResponse getBiometricProfile() { return service.getProfile(currentUserId.get()); }
    @Override public BiometricProfileResponse upsertBiometricProfile(BiometricProfileUpsertRequest req) {
        return service.upsertProfile(currentUserId.get(), req);
    }
}
```

- [ ] **Step 2: Write `BiometricProfileContractIT`**

```java
package io.mrkuhne.mezo.feature.biometrics.profile;
import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.api.dto.BiometricProfileResponse;
import io.mrkuhne.mezo.api.dto.BiometricProfileUpsertRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal; import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders; import org.springframework.http.HttpStatus;

class BiometricProfileContractIT extends ApiIntegrationTest {
    @Test
    void testGetProfile_shouldReturn404_whenNoneYet() {
        getForBody("/api/biometrics/profile", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }
    @Test
    void testUpsertThenGet_shouldRoundTrip_whenValid() {
        HttpHeaders auth = ownerAuthHeaders();
        var body = BiometricProfileUpsertRequest.builder()
            .sex("M").heightCm(new BigDecimal("180.0")).birthDate(LocalDate.of(1991, 3, 1))
            .bodyFatPct(new BigDecimal("15.0")).build();
        putForBody("/api/biometrics/profile", body, auth, HttpStatus.OK, BiometricProfileResponse.class);
        BiometricProfileResponse got = getForBody("/api/biometrics/profile", auth, HttpStatus.OK, BiometricProfileResponse.class);
        assertThat(got.getHeightCm()).isEqualByComparingTo(new BigDecimal("180.0"));
    }
    @Test
    void testUpsert_shouldReturn400_whenSexInvalid() {
        var body = BiometricProfileUpsertRequest.builder()
            .sex("X").heightCm(new BigDecimal("180.0")).birthDate(LocalDate.of(1991, 3, 1)).build();
        String resp = putForBody("/api/biometrics/profile", body, ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(resp, "sex", "VALIDATION_INVALID_VALUE");
    }
}
```

- [ ] **Step 3: Run** — `cd backend && ./mvnw clean test -Dtest=BiometricProfileContractIT` → PASS. (Confirm the exact code for a `pattern` violation against an existing pattern-validated field; adjust `VALIDATION_INVALID_VALUE` if the repo uses another key.)

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/profile/controller backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/profile/BiometricProfileContractIT.java
git commit -m "feat(biometrics): BiometricProfile controller + contract IT (mezo-2hp)"
```

---

### Task 10: Frontend api-modules — `goalApi.ts` + `biometricProfileApi.ts`

**Files:**
- Create: `frontend/src/lib/goalApi.ts`
- Create: `frontend/src/lib/biometricProfileApi.ts`

**Interfaces:**
- Produces: `goalApi.{ list, get(id), create(body), update(id,body), remove(id), activate(id), archive(id) }`; types `GoalResponse`, `GoalUpsertRequest` re-exported. `biometricProfileApi.{ get, upsert(body) }`.

- [ ] **Step 1: Write `goalApi.ts`** (mirror `runningApi.ts`/`trainApi.ts`)

```ts
import { apiFetch } from './api'
import type { components } from './api.gen'

export type GoalResponse = components['schemas']['GoalResponse']
export type GoalUpsertRequest = components['schemas']['GoalUpsertRequest']

export const goalApi = {
  list: (): Promise<GoalResponse[]> => apiFetch<GoalResponse[]>('/api/goals'),
  get: (id: string): Promise<GoalResponse> => apiFetch<GoalResponse>(`/api/goals/${id}`),
  create: (body: GoalUpsertRequest): Promise<GoalResponse> =>
    apiFetch<GoalResponse>('/api/goals', { method: 'POST', body: JSON.stringify(body satisfies GoalUpsertRequest) }),
  update: (id: string, body: GoalUpsertRequest): Promise<GoalResponse> =>
    apiFetch<GoalResponse>(`/api/goals/${id}`, { method: 'PUT', body: JSON.stringify(body satisfies GoalUpsertRequest) }),
  remove: (id: string): Promise<void> => apiFetch<void>(`/api/goals/${id}`, { method: 'DELETE' }),
  activate: (id: string): Promise<GoalResponse> => apiFetch<GoalResponse>(`/api/goals/${id}/activate`, { method: 'POST' }),
  archive: (id: string): Promise<GoalResponse> => apiFetch<GoalResponse>(`/api/goals/${id}/archive`, { method: 'POST' }),
}
```

- [ ] **Step 2: Write `biometricProfileApi.ts`**

```ts
import { apiFetch } from './api'
import type { components } from './api.gen'

export type BiometricProfileResponse = components['schemas']['BiometricProfileResponse']
export type BiometricProfileUpsertRequest = components['schemas']['BiometricProfileUpsertRequest']

export const biometricProfileApi = {
  get: (): Promise<BiometricProfileResponse> => apiFetch<BiometricProfileResponse>('/api/biometrics/profile'),
  upsert: (body: BiometricProfileUpsertRequest): Promise<BiometricProfileResponse> =>
    apiFetch<BiometricProfileResponse>('/api/biometrics/profile', {
      method: 'PUT', body: JSON.stringify(body satisfies BiometricProfileUpsertRequest),
    }),
}
```

- [ ] **Step 3: Type-check** — `cd frontend && pnpm build` (tsc -b) → succeeds (proves the generated types exist and the modules compile).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/goalApi.ts frontend/src/lib/biometricProfileApi.ts
git commit -m "feat(fe): goalApi + biometricProfileApi modules (mezo-2hp)"
```

---

### Task 11: Frontend — split `useGoals` into `useWeight` + real `useGoal`

**Files:**
- Create: `frontend/src/data/weightHooks.ts`
- Create: `frontend/src/data/goalHooks.ts`
- Modify: `frontend/src/data/hooks.ts` (remove old `useGoals` body, add re-exports)
- Modify: `frontend/src/features/me/views/GoalsView.tsx` (call both hooks)
- Modify: `frontend/src/features/fuel/views/FuelStackView.tsx` (`linkedMesocycles` from `useGoal`)
- Modify: `frontend/src/data/goals.ts` (keep mock statics; `goal` stays the mock fallback)

**Interfaces:**
- Produces: `useWeight(): { weightLog, weightTrends, logWeight }`; `useGoal(): { goal: Goal; linkedMesocycles: Record<string, LinkedMeso> }`. Both re-exported from `@/data/hooks`. `useGoals` is removed; consumers call the two hooks.
- Consumes: `goalApi`, `weightApi`, `isMockMode`, the mock statics, and a `toGoal(res, weightLog)` mapper.

- [ ] **Step 1: Write `weightHooks.ts`** (lift the weight half of the old `useGoals` verbatim — same `['weightLog']` key, same mock/real branches; `weightTrends` stays the mock static for now)

```ts
import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { weightApi } from '@/lib/biometricsApi'
import { isMockMode } from '@/lib/mode'
import { weightLog as initialWeightLog, weightTrends } from './goals'
import type { WeightEntry, WeightLogInput } from './types'

export function useWeight() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const { data: weightLog = [] } = useQuery({
    queryKey: ['weightLog'],
    queryFn: mock ? async () => initialWeightLog : weightApi.list,
    initialData: mock ? initialWeightLog : undefined,
  })
  const mutation = useMutation({
    mutationFn: mock
      ? async (input: WeightLogInput): Promise<WeightEntry> =>
          ({ date: input.date, value: input.weightKg, note: input.note })
      : weightApi.log,
    onSuccess: (entry) => {
      if (mock) qc.setQueryData<WeightEntry[]>(['weightLog'], prev => [...(prev ?? []), entry])
      else qc.invalidateQueries({ queryKey: ['weightLog'] })
    },
  })
  const logWeight = useCallback((input: WeightLogInput) => mutation.mutate(input), [mutation])
  // weightTrends stays the static mock until the G5 engine computes real trends.
  return { weightLog, weightTrends, logWeight }
}
```

- [ ] **Step 2: Write `goalHooks.ts`** with the real `useGoal` + `toGoal` mapper

```ts
import { useQuery } from '@tanstack/react-query'
import { goalApi, type GoalResponse } from '@/lib/goalApi'
import { isMockMode } from '@/lib/mode'
import { huMonthDay } from '@/lib/dates'
import { goal as mockGoal, linkedMesocycles } from './goals'
import type { Goal, GoalKind, WeightEntry } from './types'

// GoalResponse (new contract) -> existing Goal domain shape, so GoalsView is untouched (G4 restructures it).
function toGoal(res: GoalResponse, weightLog: WeightEntry[]): Goal {
  const latest = weightLog.length ? weightLog[weightLog.length - 1].value : Number(res.startWeightKg)
  const kind: GoalKind = res.trajectory === 'maintain' ? 'maintenance' : res.trajectory
  return {
    id: res.id,
    title: res.title,
    kind,
    status: res.status,
    startWeight: Number(res.startWeightKg),
    currentWeight: latest,
    targetWeight: Number(res.targetWeightKg ?? res.startWeightKg),
    unit: 'kg',
    startDate: huMonthDay(res.startDate),
    targetDate: huMonthDay(res.targetDate),
    rateTarget: { value: Number(res.rateTargetPctPerWeek), unit: '%/hét', direction: res.trajectory === 'bulk' ? 'up' : 'down' },
    mesocycles: [], // populated by GoalPlanLink in slice G3
    identityFrame: res.identityFrame ?? '',
  }
}

export function useGoal() {
  const mock = isMockMode()
  const { data: weightLog = [] } = useQuery({
    queryKey: ['weightLog'], // shares the cache with useWeight (same key)
    enabled: !mock,
  })
  const { data: goals } = useQuery({
    queryKey: ['goals'],
    queryFn: mock ? async () => null : goalApi.list,
    initialData: mock ? null : undefined,
  })
  const goal: Goal = mock
    ? mockGoal
    : (() => {
        const active = (goals ?? []).find(g => g.status === 'active') ?? (goals ?? [])[0]
        return active ? toGoal(active, (weightLog as WeightEntry[]) ?? []) : mockGoal
      })()
  return { goal, linkedMesocycles }
}
```

> `huMonthDay` exists in `frontend/src/lib/dates.ts` (used by running). `linkedMesocycles` stays the mock static (real linking is G3). The `['weightLog']` query in `useGoal` is `enabled: !mock` with no `queryFn` — it only reads the cache populated by `useWeight`; since `GoalsView` also mounts `useWeight`, the data is present. If a consumer mounts `useGoal` without `useWeight`, `currentWeight` falls back to `startWeightKg` — acceptable for G1.

- [ ] **Step 3: Rewrite `hooks.ts` — drop `useGoals`, add re-exports**

Remove the entire `useGoals` function (hooks.ts:80-102) and its now-unused imports (`goal`, `weightApi` if unused elsewhere, `initialWeightLog`, `weightTrends`, `linkedMesocycles`, `WeightEntry`/`WeightLogInput` if unused). Add:

```ts
export { useWeight } from './weightHooks'
export { useGoal } from './goalHooks'
```

(Mirror the existing `export { useTrain } from './trainHooks'` / `export { useRunning } from './runningHooks'` lines.)

- [ ] **Step 4: Update the two consumers**

`GoalsView.tsx` line 36 — replace:
```ts
const { goal, weightLog, weightTrends, linkedMesocycles, logWeight } = useGoals()
```
with:
```ts
const { goal, linkedMesocycles } = useGoal()
const { weightLog, weightTrends, logWeight } = useWeight()
```
and update the import: `import { useGoal, useWeight } from '@/data/hooks'`.

`FuelStackView.tsx` (~line 55) — replace `const { linkedMesocycles } = useGoals()` with `const { linkedMesocycles } = useGoal()` and fix the import.

- [ ] **Step 5: Build + type-check**

Run: `cd frontend && pnpm build`
Expected: PASS (no `useGoals` references remain — `grep -rn "useGoals" src` returns nothing except possibly the renamed test, handled in Task 12).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/weightHooks.ts frontend/src/data/goalHooks.ts frontend/src/data/hooks.ts frontend/src/features/me/views/GoalsView.tsx frontend/src/features/fuel/views/FuelStackView.tsx
git commit -m "feat(fe): split useGoals into useWeight + real useGoal (mezo-2hp)"
```

---

### Task 12: Frontend tests + full gates

**Files:**
- Rename/rewrite: `frontend/src/data/goalsHooks.test.tsx` → `frontend/src/data/weightHooks.test.tsx` (preserve the weight behavior) + add `goalHooks.test.tsx`

**Interfaces:**
- Consumes: the existing MSW harness (`makeHookWrapper`), `vi.stubEnv('VITE_USE_MOCK','false')`.

- [ ] **Step 1: Port the weight test to `useWeight`** (keep the exact behavioral contract: real-mode loads from `GET /api/biometrics/weight`, `logWeight` POSTs then re-fetches)

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useWeight } from './weightHooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => vi.unstubAllEnvs())

test('useWeight (real mode) loads the weight log from the API', async () => {
  server.use(http.get(`${API_BASE}/api/biometrics/weight`, () =>
    HttpResponse.json([{ date: '2026-06-01', value: 82.5 }])))
  const { result } = renderHook(() => useWeight(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.weightLog.length).toBe(1))
  expect(result.current.weightLog[0]).toMatchObject({ date: '2026-06-01', value: 82.5 })
})
```

> The harness imports above are the real ones (verified in `goalsHooks.test.tsx`: `@/test/msw/server`, `@/test/msw/handlers`, `@/test/queryWrapper`). Also port the original's **logWeight POST-then-invalidate** test verbatim (it uses `act` + a stateful MSW handler that returns the appended list after the POST) — that behavioral contract must keep passing under `useWeight`.

- [ ] **Step 2: Add `goalHooks.test.tsx`** (real mode loads the active goal)

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useGoal } from './goalHooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => vi.unstubAllEnvs())

test('useGoal (real mode) maps the active GoalResponse to the Goal shape', async () => {
  server.use(
    http.get(`${API_BASE}/api/goals`, () => HttpResponse.json([{
      id: 'g1', title: 'Nyári cut', trajectory: 'cut', guards: ['strength'], status: 'active',
      startDate: '2026-06-01', targetDate: '2026-07-27', startWeightKg: 84.2, targetWeightKg: 80, rateTargetPctPerWeek: 0.7,
    }])),
    http.get(`${API_BASE}/api/biometrics/weight`, () => HttpResponse.json([])),
  )
  const { result } = renderHook(() => useGoal(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.goal.title).toBe('Nyári cut'))
  expect(result.current.goal.kind).toBe('cut')
  expect(result.current.goal.targetWeight).toBe(80)
})
```

- [ ] **Step 3: Run both modes + build (the full frontend gate)**

```bash
cd frontend
pnpm test               # real mode (default)
VITE_USE_MOCK=true pnpm test
pnpm build
```
Expected: all PASS. (Delete the old `goalsHooks.test.tsx` once its weight assertions are ported to `weightHooks.test.tsx` and its goal assertions to `goalHooks.test.tsx` — `grep -rn "useGoals" src` must return nothing.)

- [ ] **Step 4: Run the full backend gate**

Run: `cd backend && ./mvnw clean test`
Expected: BUILD SUCCESS (all ITs green, including the new Goal + BiometricProfile suites).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data
git commit -m "test(fe): port weight test, add useGoal test; G1 green both modes (mezo-2hp)"
```

---

## Post-G1 (not in this plan)

- **G2** (Súly tab IA move) inherits `useWeight` and adds the `/me/weight` route + `MeSubNav` tab.
- **G3** adds `goal_plan_link` (timeline coupling) → populates `goal.mesocycles`.
- **G4** restructures `GoalsView` into the command-center timeline (retires the `toGoal` back-compat mapper).
- **G5** adds the engine (formula TDEE from `BiometricProfile`, segmented projection, `GoalPrescription`, guard monitoring) and the `tdee_bootstrap`/`prescription` jsonb columns via additive migration.

## Docs to update on completion (per CLAUDE.md)

- `docs/features/me.md` (new Goal + BiometricProfile backend; useGoals→useGoal/useWeight split) — run `node scripts/lint-docs.mjs` after.
- `docs/features/_platform-data-layer.md` / `_platform-api-backend.md` if they enumerate hooks/endpoints.
