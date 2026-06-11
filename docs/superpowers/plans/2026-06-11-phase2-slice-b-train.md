# Phase 2 Slice B — Train Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real backend for the Train domain — `mesocycle` + `muscle_group_volume_log` (provenance envelope **jsonb**, the load-bearing pattern Fuel reuses) + `workout_session` + `exercise` + `exercise_set` + `sport_session` — served read-only through the OpenAPI contract, seeded from the Phase 1 mock fixtures, with `useTrain` swapped to dual-mode without changing its signature.

**Architecture:** Contract-first (api/feature/train/train.yml → generated `TrainApi` + `api.dto` models + FE types). Flat entities with UUID FK columns (no JPA object relations), service-level aggregate assembly into the nested `MesocycleResponse`. The provenance envelope is a typed Java record persisted via `@JdbcTypeCode(SqlTypes.JSON)` — proven by an early round-trip IT before anything depends on it. `useTrain` keeps its return shape; ISO dates from the API are formatted to the Hungarian display strings inside the hook.

**Tech Stack:** Spring Boot 4.0 / Java 21 / Maven, PostgreSQL 16 + Liquibase, MapStruct + Lombok, openapi-generator 7.17 (spring, interfaceOnly), TanStack Query + openapi-typescript, Vitest + MSW, JUnit + AssertJ + the `support/` IT framework.

**Driving bd issue (epic):** `mezo-n5q` — the Liquibase changeset id segment.

**Mandatory reading for every task:** the trigger table in `CLAUDE.md` → `docs/references/*.md`. Slice A reference implementations: `feature/biometrics/weight/**` (vertical), `support/**` (test framework), `api/feature/weight/weight.yml` (contract style).

## Scope decisions (locked)

1. **Read-only API.** `useTrain()` returns `{ mesocycles, activeMeso, workout, gymSchedule, sport, exerciseLibrary }` and has NO mutations → Slice B ships `GET /api/train/mesocycles` + `GET /api/train/sport-sessions` only. `exercise_set` gets a table + entity (spec requires it; Fuel-era writes will need it) but no endpoint.
2. **`workout`, `gymSchedule`, `exerciseLibrary` stay static** in both modes — they are AI-derived/UI fixtures (challenges, niggle warnings, catalog) that Phase 3 owns. Only `mesocycles`/`activeMeso` and `sport.sessions` go real.
3. **DB stores ISO dates; the hook formats display strings.** Mock fixtures carry display dates (`'Máj 1'`, `'Máj 20 · Kedd'`). Real mode computes them from ISO via a new `lib/dates.ts` helper. Note: some mock day-of-week strings are factually wrong (2026-05-20 is `Sze`, mock says `Kedd`); real mode computes the TRUE day — do not replicate mock inconsistencies.
4. **`days` are normalized** into `workout_session` (one row per template day) + `exercise` rows; `exerciseCount` is computed; `current` derives from `workout_session.status = 'active'`. `volumePerMuscle` lives in `muscle_group_volume_log` rows (`source` = provenance jsonb). `volumeRecompute` is stored verbatim as jsonb on `mesocycle`.
5. **Deviations from the handoff DDL** (it is "schema intent"): `workout_session` gains `order_index`, `muscle`, `muscle_accent`, `note`; `sport_session` gains `jump_count` and stores `time` as `varchar(5)` ('18:15'); `muscle_group_volume_log.current` column is named `current_sets` (avoids the SQL keyword); house columns (`created_by`, `is_deleted`, `created_at`) on every table.

## File structure

```
api/feature/train/train.yml                                  (NEW — contract)
api/generate/merge.yml                                       (MODIFY — add fragment)
backend/src/main/resources/db/changelog/1.0.0/script/
  202606111400_mezo-n5q_create_train.sql                     (NEW)
backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml (MODIFY — include)
backend/src/main/java/io/mrkuhne/mezo/feature/train/
  entity/{ProvenanceEnvelope,VolumeRecomputeJson,MesocycleEntity,
          MuscleGroupVolumeLogEntity,WorkoutSessionEntity,
          ExerciseEntity,ExerciseSetEntity,SportSessionEntity}.java
  repository/{MesocycleRepository,MuscleGroupVolumeLogRepository,
          WorkoutSessionRepository,ExerciseRepository,
          ExerciseSetRepository,SportSessionRepository}.java
  mapper/TrainMapper.java
  service/TrainService.java
  controller/TrainController.java
  TrainSeedData.java
backend/src/test/java/io/mrkuhne/mezo/
  support/ResetDatabase.java                                 (MODIFY — TRUNCATE list)
  support/populator/TrainPopulator.java                      (NEW)
  feature/train/{ProvenanceRoundTripIT,TrainServiceIT,
                 TrainContractIT,TrainSeedDataIT}.java        (NEW)
frontend/src/lib/dates.ts                                    (MODIFY — HU display helpers)
frontend/src/lib/trainApi.ts                                 (NEW)
frontend/src/lib/api.gen.ts                                  (REGENERATED)
frontend/src/data/hooks.ts                                   (MODIFY — useTrain dual-mode)
frontend/src/test/msw/handlers.ts                            (MODIFY — train handlers)
frontend/src/data/trainHooks.test.tsx                        (NEW)
```

---

### Task 1: Contract — `api/feature/train/train.yml`

**Files:**
- Create: `api/feature/train/train.yml`
- Modify: `api/generate/merge.yml`
- Regenerate: `api/openapi.yml`, `frontend/src/lib/api.gen.ts`

- [ ] **Step 1: Create branch + claim epic**

```bash
git checkout -b feat/phase2-slice-b && bd update mezo-n5q --claim
```

- [ ] **Step 2: Write the fragment** — `api/feature/train/train.yml`:

```yaml
openapi: 3.0.3
info:
  title: ''
  version: ''
tags:
  - name: Train
    description: Training domain — mesocycles (with volume provenance) and sport sessions
paths:
  /api/train/mesocycles:
    get:
      tags: [Train]
      operationId: listMesocycles
      summary: All mesocycles of the current user with volume provenance and template days, start date ascending
      responses:
        '200':
          description: Mesocycles
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/MesocycleResponse'
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
  /api/train/sport-sessions:
    get:
      tags: [Train]
      operationId: listSportSessions
      summary: Sport (volleyball) sessions of the current user, date descending
      responses:
        '200':
          description: Sport sessions
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/SportSessionResponse'
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
components:
  schemas:
    MesocycleResponse:
      type: object
      required: [id, title, shortTitle, status, startDate, endDate, weeks, currentWeek, split, style, phaseCurve]
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        shortTitle: { type: string }
        status: { type: string, enum: [active, planned, archived] }
        goal: { type: string }
        startDate: { type: string, format: date }
        endDate: { type: string, format: date }
        weeks: { type: integer }
        currentWeek: { type: integer }
        split: { type: string }
        style: { type: string }
        phaseCurve:
          type: array
          items: { type: string, enum: [MEV, MAV, MRV, Deload] }
        notes: { type: string }
        summary: { type: string }
        volumeRecompute: { $ref: '#/components/schemas/VolumeRecompute' }
        volumePerMuscle:
          type: object
          description: Per-muscle volume profile keyed by muscle id (chest, back, ...)
          additionalProperties: { $ref: '#/components/schemas/VolumeProfile' }
        days:
          type: array
          items: { $ref: '#/components/schemas/MesoDay' }
    VolumeRecompute:
      type: object
      required: [lastRun, nextRun, trigger, changes]
      properties:
        lastRun: { type: string }
        nextRun: { type: string }
        trigger: { type: string }
        changes:
          type: array
          items: { $ref: '#/components/schemas/VolumeChange' }
    VolumeChange:
      type: object
      required: [muscle, change, reason]
      properties:
        muscle: { type: string }
        change: { type: string }
        reason: { type: string }
        warning: { type: boolean }
    VolumeProfile:
      type: object
      required: [mev, mav, mrv, current, source]
      properties:
        mev: { type: integer }
        mav: { type: integer }
        mrv: { type: integer }
        current: { type: integer }
        source: { $ref: '#/components/schemas/VolumeSource' }
    VolumeSource:
      type: object
      description: Provenance envelope — baseline -> adjustments -> confidence -> override
      required: [baseline, adjustments, confidence]
      properties:
        baseline: { $ref: '#/components/schemas/VolumeBaseline' }
        adjustments:
          type: array
          items: { $ref: '#/components/schemas/VolumeAdjustment' }
        confidence: { type: number }
        note: { type: string }
        userOverride: { $ref: '#/components/schemas/VolumeUserOverride' }
    VolumeBaseline:
      type: object
      required: [name, mev, mav, mrv]
      properties:
        name: { type: string }
        mev: { type: integer }
        mav: { type: integer }
        mrv: { type: integer }
    VolumeAdjustment:
      type: object
      required: [kind, label, delta]
      properties:
        kind: { type: string, pattern: '^(pattern|recovery|niggle|sport-cross)$' }
        label: { type: string }
        delta:
          type: object
          description: Partial mev/mav/mrv deltas
          additionalProperties: { type: integer }
        warning: { type: boolean }
    VolumeUserOverride:
      type: object
      required: [mev, mav, mrv, at]
      properties:
        mev: { type: integer }
        mav: { type: integer }
        mrv: { type: integer }
        at: { type: string, format: date-time }
    MesoDay:
      type: object
      required: [day, type, muscle, exerciseCount, exercises]
      properties:
        day: { type: string, description: "'Hét'..'Vas'" }
        type: { type: string }
        muscle: { type: string }
        exerciseCount: { type: integer }
        exercises:
          type: array
          items: { $ref: '#/components/schemas/GymExercise' }
        note: { type: string }
        current: { type: boolean }
        muscleAccent: { type: boolean }
    GymExercise:
      type: object
      required: [id, name, muscle, sets, targetReps, targetRIR, type]
      properties:
        id: { type: string, format: uuid }
        name: { type: string }
        muscle: { type: string }
        sets: { type: integer }
        targetReps: { type: string }
        targetRIR: { type: integer }
        type: { type: string, enum: [compound, isolation] }
        warning: { type: string }
    SportSessionResponse:
      type: object
      required: [id, sport, date, time, duration, setsPlayed, intensity, rpe, shoulderStrain, jumpCount]
      properties:
        id: { type: string, format: uuid }
        sport: { type: string }
        date: { type: string, format: date }
        time: { type: string, description: "HH:mm", example: '18:15' }
        duration: { type: integer, description: minutes }
        setsPlayed: { type: integer }
        intensity: { type: integer }
        rpe: { type: number }
        shoulderStrain: { type: integer }
        jumpCount: { type: integer }
        notes: { type: string }
```

- [ ] **Step 3: Register the fragment** in `api/generate/merge.yml` — append after the checkin line:

```yaml
  - inputFile: ../feature/train/train.yml
```

- [ ] **Step 4: Merge + regenerate FE types**

```bash
cd api/generate && npx openapi-merge-cli --config merge.yml && cd ../..
cd frontend && pnpm generate:api && cd ..
```
Expected: `api/openapi.yml` contains `/api/train/mesocycles`; `frontend/src/lib/api.gen.ts` contains `MesocycleResponse`.

- [ ] **Step 5: Verify backend generation compiles** (interfaces only, nothing implements them yet — `interfaceOnly` generation must succeed)

```bash
cd backend && ./mvnw clean compile -q && cd ..
```
Expected: BUILD SUCCESS; `backend/target/generated-sources/openapi/.../api/controller/TrainApi.java` exists.

- [ ] **Step 6: Commit**

```bash
git add api/ frontend/src/lib/api.gen.ts
git commit -m "feat(api): Train contract — mesocycles + sport-sessions with provenance envelope (mezo-n5q)"
```

---

### Task 2: Liquibase migration — six Train tables

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202606111400_mezo-n5q_create_train.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append include — mirror how the checkin script is included)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (growth rule!)

- [ ] **Step 1: Write the migration SQL** (`--liquibase formatted sql` header + changeset comment style — copy the exact header pattern from `202606101320_mezo-v67_create_check_in.sql`):

```sql
--liquibase formatted sql
--changeset mezo-n5q:202606111400-create-train

create table mesocycle (
    id            uuid primary key default gen_random_uuid(),
    created_by    uuid not null,
    title         text not null,
    short_title   text not null,
    status        text not null,
    goal          text,
    start_date    date not null,
    end_date      date not null,
    weeks         int  not null,
    current_week  int  not null default 0,
    split         text not null,
    style         text not null,
    phase_curve   text[] not null,
    notes         text,
    summary       text,
    volume_recompute jsonb,
    is_deleted    boolean not null default false,
    created_at    timestamptz not null default now(),
    constraint fk_mesocycle_created_by foreign key (created_by) references app_user (id),
    constraint ck_mesocycle_status check (status in ('active','planned','archived'))
);
create index idx_mesocycle_created_by on mesocycle (created_by);

create table muscle_group_volume_log (
    id            uuid primary key default gen_random_uuid(),
    created_by    uuid not null,
    mesocycle_id  uuid not null,
    muscle        text not null,
    mev int not null, mav int not null, mrv int not null, current_sets int not null,
    source        jsonb not null,
    computed_at   timestamptz not null default now(),
    is_deleted    boolean not null default false,
    created_at    timestamptz not null default now(),
    constraint fk_muscle_group_volume_log_created_by foreign key (created_by) references app_user (id),
    constraint fk_muscle_group_volume_log_mesocycle_id foreign key (mesocycle_id) references mesocycle (id) on delete cascade,
    constraint uq_muscle_group_volume_log_mesocycle_id_muscle unique (mesocycle_id, muscle)
);
create index idx_muscle_group_volume_log_mesocycle_id on muscle_group_volume_log (mesocycle_id);

create table workout_session (
    id            uuid primary key default gen_random_uuid(),
    created_by    uuid not null,
    mesocycle_id  uuid,
    day_label     text not null,
    type          text not null,
    muscle        text not null default '',
    muscle_accent boolean not null default false,
    note          text,
    date          date,
    status        text not null default 'planned',
    duration_est  int,
    order_index   int not null default 0,
    is_deleted    boolean not null default false,
    created_at    timestamptz not null default now(),
    constraint fk_workout_session_created_by foreign key (created_by) references app_user (id),
    constraint fk_workout_session_mesocycle_id foreign key (mesocycle_id) references mesocycle (id) on delete set null,
    constraint ck_workout_session_status check (status in ('planned','active','completed','skipped'))
);
create index idx_workout_session_mesocycle_id on workout_session (mesocycle_id);

create table exercise (
    id                 uuid primary key default gen_random_uuid(),
    created_by         uuid not null,
    workout_session_id uuid not null,
    name        text not null,
    muscle      text not null default '',
    sets        int  not null,
    target_reps text not null,
    target_rir  int  not null,
    type        text not null,
    warning     text,
    order_index int not null default 0,
    is_deleted  boolean not null default false,
    created_at  timestamptz not null default now(),
    constraint fk_exercise_created_by foreign key (created_by) references app_user (id),
    constraint fk_exercise_workout_session_id foreign key (workout_session_id) references workout_session (id) on delete cascade,
    constraint ck_exercise_type check (type in ('compound','isolation'))
);
create index idx_exercise_workout_session_id on exercise (workout_session_id);

create table exercise_set (
    id          uuid primary key default gen_random_uuid(),
    created_by  uuid not null,
    exercise_id uuid not null,
    set_index   int not null,
    weight_kg   numeric(6,2),
    reps        int,
    rir         int,
    side        text,
    voice_note  text,
    done_at     timestamptz,
    is_deleted  boolean not null default false,
    created_at  timestamptz not null default now(),
    constraint fk_exercise_set_created_by foreign key (created_by) references app_user (id),
    constraint fk_exercise_set_exercise_id foreign key (exercise_id) references exercise (id) on delete cascade,
    constraint ck_exercise_set_side check (side is null or side in ('L','B','R'))
);
create index idx_exercise_set_exercise_id on exercise_set (exercise_id);

create table sport_session (
    id              uuid primary key default gen_random_uuid(),
    created_by      uuid not null,
    sport           text not null default 'volleyball',
    date            date not null,
    time            varchar(5),
    duration_min    int,
    sets_played     int,
    intensity       int,
    rpe             numeric(3,1),
    shoulder_strain int,
    jump_count      int,
    notes           text,
    is_deleted      boolean not null default false,
    created_at      timestamptz not null default now(),
    constraint fk_sport_session_created_by foreign key (created_by) references app_user (id),
    constraint ck_sport_session_intensity check (intensity is null or intensity between 1 and 10),
    constraint ck_sport_session_shoulder_strain check (shoulder_strain is null or shoulder_strain between 1 and 10)
);
create index idx_sport_session_created_by_date on sport_session (created_by, date);
```

- [ ] **Step 2: Include it in the version master** (`1.0.0_master.yml`) following the existing include pattern.

- [ ] **Step 3: ResetDatabase growth rule** — in `ResetDatabase.resetExceptMasterData()` replace the TRUNCATE statement with:

```java
entityManager.createNativeQuery(
    "TRUNCATE TABLE weight_log, sleep_log, check_in, "
        + "exercise_set, exercise, workout_session, muscle_group_volume_log, mesocycle, "
        + "sport_session CASCADE").executeUpdate();
```

- [ ] **Step 4: Run the suite to apply + verify the migration**

```bash
cd backend && ./mvnw clean test 2>&1 | grep -E "Tests run: [0-9]+, F|BUILD"
```
Expected: existing 15/15 PASS (Liquibase applies the new changeset against `mezo_test`).

- [ ] **Step 5: Inspect tables 1:1** (fixed test DB advantage)

```bash
docker exec backend-postgres-1 psql -U mezo -d mezo_test -c "\d mesocycle" -c "\d muscle_group_volume_log" | head -40
```
Expected: columns/constraints as above.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/resources/db backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java
git commit -m "feat(train): Liquibase migration for six Train tables + ResetDatabase growth (mezo-n5q)"
```

---

### Task 3: Provenance envelope — typed jsonb round-trip (THE risk item, do early)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/ProvenanceEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/MuscleGroupVolumeLogEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/MuscleGroupVolumeLogRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/ProvenanceRoundTripIT.java`

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ProvenanceRoundTripIT extends AbstractIntegrationTest {

    @Autowired private MuscleGroupVolumeLogRepository repository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    void testSave_shouldRoundTripProvenanceEnvelope_whenPersistedAsJsonb() {
        UUID user = databasePopulator.populateUser("a@test.local");
        ProvenanceEnvelope source = new ProvenanceEnvelope(
            new ProvenanceEnvelope.Baseline("RP guidelines · intermediate", 8, 12, 18),
            List.of(
                new ProvenanceEnvelope.Adjustment("pattern", "Q1 retro: pumpa stabil", Map.of("mrv", 2), null),
                new ProvenanceEnvelope.Adjustment("niggle", "Jobb váll niggle", Map.of("mav", -2, "mrv", -2), true)),
            0.78,
            "Daniel-personalizált MRV.",
            null);

        MuscleGroupVolumeLogEntity e = new MuscleGroupVolumeLogEntity();
        e.setCreatedBy(user);
        e.setMesocycleId(null); // FK nullable not allowed -> this test uses a meso created in Task 4;
        // UNTIL MesocycleEntity exists, insert the parent row directly:
        UUID mesoId = jdbcTemplate.queryForObject(
            "insert into mesocycle (created_by, title, short_title, status, start_date, end_date, weeks, split, style, phase_curve) "
                + "values (?, 't', 't', 'active', '2026-05-01', '2026-06-12', 6, 's', 's', '{MEV}') returning id",
            UUID.class, user);
        e.setMesocycleId(mesoId);
        e.setMuscle("chest");
        e.setMev(8); e.setMav(14); e.setMrv(20); e.setCurrentSets(14);
        e.setSource(source);
        repository.saveAndFlush(e);

        MuscleGroupVolumeLogEntity reloaded = repository.findById(e.getId()).orElseThrow();
        assertThat(reloaded.getSource()).isEqualTo(source); // records -> deep equality

        String jsonType = jdbcTemplate.queryForObject(
            "select jsonb_typeof(source) from muscle_group_volume_log where id = ?", String.class, e.getId());
        assertThat(jsonType).isEqualTo("object"); // stored as real jsonb, not text
    }
}
```

- [ ] **Step 2: Run it — expect compile failure** (`ProvenanceEnvelope` does not exist):

```bash
./mvnw clean test -Dtest=ProvenanceRoundTripIT 2>&1 | tail -5
```

- [ ] **Step 3: Implement the envelope record**

```java
package io.mrkuhne.mezo.feature.train.entity;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * The signature provenance envelope (design handoff §4): baseline -> adjustments ->
 * confidence -> optional user override. Persisted as a single jsonb column via
 * {@code @JdbcTypeCode(SqlTypes.JSON)}; Fuel reuses this pattern for meal score.
 */
public record ProvenanceEnvelope(
    Baseline baseline,
    List<Adjustment> adjustments,
    Double confidence,
    String note,
    UserOverride userOverride
) {
    public record Baseline(String name, Integer mev, Integer mav, Integer mrv) {}

    /** kind ∈ pattern | recovery | niggle | sport-cross; delta keys ∈ mev|mav|mrv. */
    public record Adjustment(String kind, String label, Map<String, Integer> delta, Boolean warning) {}

    public record UserOverride(Integer mev, Integer mav, Integer mrv, OffsetDateTime at) {}
}
```

- [ ] **Step 4: Implement the entity + repository**

```java
package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

@Getter
@Setter
@Entity
@Table(name = "muscle_group_volume_log")
@SQLDelete(sql = "update muscle_group_volume_log set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MuscleGroupVolumeLogEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "mesocycle_id", nullable = false)
    private UUID mesocycleId;

    @NotNull
    @Column(nullable = false)
    private String muscle;

    @NotNull @Column(nullable = false) private Integer mev;
    @NotNull @Column(nullable = false) private Integer mav;
    @NotNull @Column(nullable = false) private Integer mrv;
    @NotNull @Column(name = "current_sets", nullable = false) private Integer currentSets;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private ProvenanceEnvelope source;

    @CreationTimestamp
    @Column(name = "computed_at", nullable = false, updatable = false)
    private Instant computedAt;
}
```

```java
package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MuscleGroupVolumeLogRepository extends JpaRepository<MuscleGroupVolumeLogEntity, UUID> {
    List<MuscleGroupVolumeLogEntity> findByCreatedByAndMesocycleIdInOrderByMuscleAsc(UUID createdBy, Collection<UUID> mesocycleIds);
}
```

- [ ] **Step 5: Run the IT — expect PASS**

```bash
./mvnw clean test -Dtest=ProvenanceRoundTripIT 2>&1 | grep -E "Tests run|BUILD"
```
Contingency (STOP and surface if hit): if the context fails with a missing JSON `FormatMapper`, Hibernate on SB4 needs the Jackson 3 mapper — check `hibernate.type.json_format_mapper`; do NOT silently fall back to `String` columns.

- [ ] **Step 6: Full suite + commit**

```bash
./mvnw clean test 2>&1 | grep -E "Tests run: [0-9]+, F|BUILD"
git add backend/src && git commit -m "feat(train): provenance envelope as typed jsonb + round-trip proof (mezo-n5q)"
```

---

### Task 4: Mesocycle entity + repository + populator

**Files:**
- Create: `entity/VolumeRecomputeJson.java`, `entity/MesocycleEntity.java`, `repository/MesocycleRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/TrainServiceIT.java` (started here, grows in Tasks 5–7)

- [ ] **Step 1: Failing test** — in a new `TrainServiceIT` (extends `AbstractIntegrationTest`, `@Transactional`): `testSaveMesocycle_shouldRoundTripArrayAndRecomputeJson_whenPersisted` — create a mesocycle via `TrainPopulator.createMesocycle(user, "Hypertrophy 04", "active")`, reload, assert `phaseCurve` contains `MEV, MAV` in order and `volumeRecompute.changes()` has 1 element.

- [ ] **Step 2: VolumeRecomputeJson record**

```java
package io.mrkuhne.mezo.feature.train.entity;

import java.util.List;

/** Weekly recompute audit, stored verbatim as jsonb on mesocycle (display strings included). */
public record VolumeRecomputeJson(String lastRun, String nextRun, String trigger, List<Change> changes) {
    public record Change(String muscle, String change, String reason, Boolean warning) {}
}
```

- [ ] **Step 3: MesocycleEntity** — same skeleton as `MuscleGroupVolumeLogEntity` (OwnedEntity base, `@SQLDelete`/`@SQLRestriction` on `mesocycle`), fields:

```java
    @NotNull @Column(nullable = false) private String title;
    @NotNull @Column(name = "short_title", nullable = false) private String shortTitle;
    @NotNull @Column(nullable = false) private String status;          // active|planned|archived (DB CHECK)
    @Column private String goal;
    @NotNull @Column(name = "start_date", nullable = false) private LocalDate startDate;
    @NotNull @Column(name = "end_date", nullable = false) private LocalDate endDate;
    @NotNull @Column(nullable = false) private Integer weeks;
    @NotNull @Column(name = "current_week", nullable = false) private Integer currentWeek = 0;
    @NotNull @Column(nullable = false) private String split;
    @NotNull @Column(nullable = false) private String style;
    @NotNull
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "phase_curve", nullable = false, columnDefinition = "text[]")
    private String[] phaseCurve;
    @Column private String notes;
    @Column private String summary;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "volume_recompute", columnDefinition = "jsonb")
    private VolumeRecomputeJson volumeRecompute;
```

- [ ] **Step 4: MesocycleRepository** (date-less entity → own finder, NOT `OwnedRepository`):

```java
public interface MesocycleRepository extends JpaRepository<MesocycleEntity, UUID> {
    List<MesocycleEntity> findByCreatedByAndDeletedFalseOrderByStartDateAsc(UUID createdBy);
}
```

- [ ] **Step 5: TrainPopulator** (`@TestComponent`, registered via `@Import` on `AbstractIntegrationTest` — add it to the existing `@Import` list):

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.ProvenanceEnvelope;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class TrainPopulator {

    private final MesocycleRepository mesocycleRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;

    public MesocycleEntity createMesocycle(UUID createdBy, String title, String status) {
        MesocycleEntity m = new MesocycleEntity();
        m.setCreatedBy(createdBy);
        m.setTitle(title);
        m.setShortTitle(title);
        m.setStatus(status);
        m.setStartDate(LocalDate.parse("2026-05-01"));
        m.setEndDate(LocalDate.parse("2026-06-12"));
        m.setWeeks(6);
        m.setCurrentWeek(3);
        m.setSplit("Pull / Push / Legs · 5×/hét");
        m.setStyle("RP · 6 hét");
        m.setPhaseCurve(new String[] {"MEV", "MAV", "Deload"});
        m.setVolumeRecompute(new VolumeRecomputeJson("Vasárnap", "Vasárnap", "batch",
            List.of(new VolumeRecomputeJson.Change("back", "MRV +2", "stabil", null))));
        return mesocycleRepository.saveAndFlush(m);
    }

    public MuscleGroupVolumeLogEntity createVolumeLog(UUID createdBy, UUID mesocycleId, String muscle) {
        MuscleGroupVolumeLogEntity v = new MuscleGroupVolumeLogEntity();
        v.setCreatedBy(createdBy);
        v.setMesocycleId(mesocycleId);
        v.setMuscle(muscle);
        v.setMev(8); v.setMav(14); v.setMrv(20); v.setCurrentSets(14);
        v.setSource(new ProvenanceEnvelope(
            new ProvenanceEnvelope.Baseline("RP guidelines · intermediate", 8, 12, 18),
            List.of(new ProvenanceEnvelope.Adjustment("pattern", "test", Map.of("mrv", 2), null)),
            0.78, null, null));
        return volumeLogRepository.saveAndFlush(v);
    }
}
```

(Once `TrainPopulator` exists, simplify Task 3's IT to use it instead of the raw `jdbcTemplate` insert.)

- [ ] **Step 6: Run, pass, full suite, commit**

```bash
./mvnw clean test 2>&1 | grep -E "Tests run: [0-9]+, F|BUILD"
git add backend/src && git commit -m "feat(train): mesocycle entity with text[] phase curve + recompute jsonb (mezo-n5q)"
```

---

### Task 5: WorkoutSession + Exercise + ExerciseSet entities

**Files:** entities + repositories for all three; extend `TrainPopulator`; grow `TrainServiceIT`.

- [ ] **Step 1: Failing test** — `testWorkoutDays_shouldReturnExercisesInOrder_whenOrderIndexSet`: populate a meso, 2 workout sessions (`order_index` 0/1, second with `status='active'`), 2 exercises on the first (order_index 1 then 0 — inserted out of order), assert the repository finder returns them 0,1.

- [ ] **Step 2: Entities** — same OwnedEntity skeleton (`@SQLDelete`/`@SQLRestriction` per table):
  - `WorkoutSessionEntity` (`workout_session`): `mesocycleId UUID` (nullable), `dayLabel`, `type`, `muscle` (default `""`), `muscleAccent boolean`, `note`, `date LocalDate` (nullable), `status` (default `"planned"`), `durationEst Integer`, `orderIndex Integer` (default 0).
  - `ExerciseEntity` (`exercise`): `workoutSessionId UUID @NotNull`, `name`, `muscle`, `sets Integer`, `targetReps String`, `targetRir Integer` (column `target_rir`), `type`, `warning`, `orderIndex`.
  - `ExerciseSetEntity` (`exercise_set`): `exerciseId UUID @NotNull`, `setIndex Integer`, `weightKg BigDecimal` (precision 6, scale 2), `reps`, `rir`, `side String`, `voiceNote String` (column `voice_note`), `doneAt Instant`.

- [ ] **Step 3: Repositories**

```java
public interface WorkoutSessionRepository extends JpaRepository<WorkoutSessionEntity, UUID> {
    List<WorkoutSessionEntity> findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(UUID createdBy, Collection<UUID> mesocycleIds);
}
public interface ExerciseRepository extends JpaRepository<ExerciseEntity, UUID> {
    List<ExerciseEntity> findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(UUID createdBy, Collection<UUID> workoutSessionIds);
}
public interface ExerciseSetRepository extends JpaRepository<ExerciseSetEntity, UUID> {
    List<ExerciseSetEntity> findByCreatedByAndExerciseIdOrderBySetIndexAsc(UUID createdBy, UUID exerciseId);
}
```

- [ ] **Step 4: TrainPopulator additions** — `createWorkoutSession(createdBy, mesocycleId, dayLabel, type, orderIndex, status)` and `createExercise(createdBy, workoutSessionId, name, orderIndex)` and `createExerciseSet(createdBy, exerciseId, setIndex)` following the same saveAndFlush pattern with sensible defaults (sets=3, targetReps="8-10", targetRir=1, type="compound"; weightKg=82.50, reps=8, rir=1).

- [ ] **Step 5: ExerciseSet round-trip assertion** in the same IT: create one set, reload, assert weightKg comparable to `82.50`.

- [ ] **Step 6: Run, pass, full suite, commit**

```bash
git commit -m "feat(train): workout_session/exercise/exercise_set entities + ordered finders (mezo-n5q)"
```

---

### Task 6: SportSession entity

**Files:** `entity/SportSessionEntity.java`, `repository/SportSessionRepository.java`; extend `TrainPopulator` + `TrainServiceIT`.

- [ ] **Step 1: Failing test** — `testSportSessions_shouldReturnDateDescending_whenListed`: populate 3 sessions (dates 05-11, 05-20, 05-15), assert finder returns 20,15,11; plus ownership: user B sees 0.

- [ ] **Step 2: Entity** — OwnedEntity skeleton on `sport_session`: `sport` (default `"volleyball"`), `date LocalDate @NotNull`, `time String` (length 5), `durationMin Integer` (column `duration_min`), `setsPlayed Integer`, `intensity Integer`, `rpe BigDecimal` (precision 3 scale 1), `shoulderStrain Integer`, `jumpCount Integer`, `notes String`.

- [ ] **Step 3: Repository**

```java
public interface SportSessionRepository extends JpaRepository<SportSessionEntity, UUID> {
    List<SportSessionEntity> findByCreatedByAndDeletedFalseOrderByDateDesc(UUID createdBy);
}
```

- [ ] **Step 4: Populator** — `createSportSession(createdBy, LocalDate date)` (time "18:15", duration 90, setsPlayed 5, intensity 7, rpe 6.8, shoulderStrain 6, jumpCount 38).

- [ ] **Step 5: Run, pass, full suite, commit** — `feat(train): sport_session entity + date-desc finder (mezo-n5q)`

---

### Task 7: TrainService + TrainMapper + TrainController (generated `TrainApi`)

**Files:**
- Create: `mapper/TrainMapper.java`, `service/TrainService.java`, `controller/TrainController.java`
- Test: grow `TrainServiceIT` + create `TrainContractIT`

- [ ] **Step 1: Failing service test** — `testListMesocycles_shouldAssembleNestedResponse_whenVolumeAndDaysExist`: populate user A: 1 meso + volume logs (chest, back) + 2 workout sessions (second `status='active'`, `muscleAccent=true`) + 2 exercises on session 1; user B: 1 meso. Assert for user A: 1 response; `volumePerMuscle` keys {chest, back}; `source.baseline.name == "RP guidelines · intermediate"`; `days` size 2 ordered by orderIndex; `days[1].current == true`; `days[0].exerciseCount == 2`; user B sees only their own.

- [ ] **Step 2: TrainMapper** (MapStruct, componentModel spring):

```java
package io.mrkuhne.mezo.feature.train.mapper;

import io.mrkuhne.mezo.api.dto.GymExercise;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.api.dto.VolumeProfile;
import io.mrkuhne.mezo.api.dto.VolumeRecompute;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import java.util.Arrays;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface TrainMapper {

    // days/volumePerMuscle are assembled in the service; statuses to enums via generated fromValue
    @Mapping(target = "status", expression = "java(MesocycleResponse.StatusEnum.fromValue(entity.getStatus()))")
    @Mapping(target = "phaseCurve", expression = "java(phaseCurve(entity.getPhaseCurve()))")
    @Mapping(target = "volumePerMuscle", ignore = true)
    @Mapping(target = "days", ignore = true)
    MesocycleResponse toResponse(MesocycleEntity entity);

    @Mapping(target = "current", source = "currentSets")
    VolumeProfile toProfile(MuscleGroupVolumeLogEntity entity);

    @Mapping(target = "targetRIR", source = "targetRir")
    @Mapping(target = "type", expression = "java(GymExercise.TypeEnum.fromValue(entity.getType()))")
    GymExercise toGymExercise(ExerciseEntity entity);

    @Mapping(target = "duration", source = "durationMin")
    SportSessionResponse toResponse(SportSessionEntity entity);

    VolumeRecompute toRecompute(VolumeRecomputeJson json);

    default List<MesocycleResponse.PhaseCurveEnum> phaseCurve(String[] curve) {
        return Arrays.stream(curve).map(MesocycleResponse.PhaseCurveEnum::fromValue).toList();
    }
}
```
NOTE: verify the generated enum type names after Task 1 (`MesocycleResponse.StatusEnum`, `PhaseCurveEnum`, `GymExercise.TypeEnum`) in `target/generated-sources/openapi` and adjust if the generator named them differently. MapStruct maps `ProvenanceEnvelope` → generated `VolumeSource` automatically (matching names/records); if a nested mapping is ambiguous, add explicit `toSource(ProvenanceEnvelope)` methods rather than hand-rolling.

- [ ] **Step 3: TrainService** (read-only → NO `@Transactional`):

```java
package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.MesoDay;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.api.dto.VolumeProfile;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TrainService {

    private final MesocycleRepository mesocycleRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final SportSessionRepository sportSessionRepository;
    private final TrainMapper mapper;

    public List<MesocycleResponse> listMesocycles(UUID createdBy) {
        List<MesocycleEntity> mesos = mesocycleRepository.findByCreatedByAndDeletedFalseOrderByStartDateAsc(createdBy);
        List<UUID> mesoIds = mesos.stream().map(MesocycleEntity::getId).toList();
        if (mesoIds.isEmpty()) {
            return List.of();
        }

        Map<UUID, Map<String, VolumeProfile>> volumeByMeso = volumeLogRepository
            .findByCreatedByAndMesocycleIdInOrderByMuscleAsc(createdBy, mesoIds).stream()
            .collect(Collectors.groupingBy(v -> v.getMesocycleId(), LinkedHashMap::new,
                Collectors.toMap(v -> v.getMuscle(), mapper::toProfile, (a, b) -> a, LinkedHashMap::new)));

        List<WorkoutSessionEntity> sessions =
            workoutSessionRepository.findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, mesoIds);
        Map<UUID, List<ExerciseEntity>> exercisesBySession = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
                createdBy, sessions.stream().map(WorkoutSessionEntity::getId).toList())
            .stream().collect(Collectors.groupingBy(ExerciseEntity::getWorkoutSessionId));

        Map<UUID, List<MesoDay>> daysByMeso = sessions.stream()
            .filter(s -> s.getMesocycleId() != null)
            .collect(Collectors.groupingBy(WorkoutSessionEntity::getMesocycleId, LinkedHashMap::new,
                Collectors.mapping(s -> toDay(s, exercisesBySession.getOrDefault(s.getId(), List.of())),
                    Collectors.toList())));

        return mesos.stream().map(m -> {
            MesocycleResponse r = mapper.toResponse(m);
            Map<String, VolumeProfile> volume = volumeByMeso.get(m.getId());
            List<MesoDay> days = daysByMeso.get(m.getId());
            if (volume != null && !volume.isEmpty()) r.setVolumePerMuscle(volume);
            if (days != null && !days.isEmpty()) r.setDays(days);
            return r;
        }).toList();
    }

    public List<SportSessionResponse> listSportSessions(UUID createdBy) {
        return sportSessionRepository.findByCreatedByAndDeletedFalseOrderByDateDesc(createdBy)
            .stream().map(mapper::toResponse).toList();
    }

    private MesoDay toDay(WorkoutSessionEntity s, List<ExerciseEntity> exercises) {
        return MesoDay.builder()
            .day(s.getDayLabel())
            .type(s.getType())
            .muscle(s.getMuscle())
            .exerciseCount(exercises.size())
            .exercises(exercises.stream().map(mapper::toGymExercise).toList())
            .note(s.getNote())
            .current("active".equals(s.getStatus()) ? Boolean.TRUE : null)
            .muscleAccent(s.isMuscleAccent() ? Boolean.TRUE : null)
            .build();
    }
}
```
(`muscleAccent` field is `boolean` → Lombok getter is `isMuscleAccent()`.)

- [ ] **Step 4: TrainController** — Slice A pattern (`WeightLogController`):

```java
package io.mrkuhne.mezo.feature.train.controller;

import io.mrkuhne.mezo.api.controller.TrainApi;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated contract interface — mappings come from {@link TrainApi}. */
@RestController
@RequiredArgsConstructor
public class TrainController implements TrainApi {

    private final TrainService service;
    private final CurrentUserId currentUserId;

    @Override
    public List<MesocycleResponse> listMesocycles() {
        return service.listMesocycles(currentUserId.get());
    }

    @Override
    public List<SportSessionResponse> listSportSessions() {
        return service.listSportSessions(currentUserId.get());
    }
}
```

- [ ] **Step 5: Contract IT** — `TrainContractIT extends ApiIntegrationTest` (Biometrics pattern): unauthenticated GET → 401; with `ownerAuthHeaders()` after `TrainPopulator` creates a meso+volume for the OWNER user (`databasePopulator.populateUser` with the owner email — reuse the id returned by `populateUser("owner@mezo.local")`): `getForList("/api/train/mesocycles", headers, OK, MesocycleResponse.class)` has size 1 and `getVolumePerMuscle()` non-null; `getForList("/api/train/sport-sessions", ...)` round-trips one populated session.

- [ ] **Step 6: Run all, pass, commit** — `feat(train): TrainService aggregate assembly + generated TrainApi controller (mezo-n5q)`

---

### Task 8: Demodata seed — port the train.ts fixtures

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/TrainSeedData.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/TrainSeedDataIT.java`

**Source of truth for ALL values:** `frontend/src/data/train.ts` — mesocycles lines 39–268, sport sessions lines 380–386. Port them **verbatim** (every muscle, every adjustment label, every note — the seed must render identically to mock mode). Display dates map to ISO with year 2026: `'Máj 1'→2026-05-01`, `'Jún 12'→2026-06-12`, `'Jún 16'→2026-06-16`, `'Aug 4'→2026-08-04`, `'Aug 7'→2026-08-07`, `'Aug 28'→2026-08-28`, `'Feb 12'→2026-02-12`, `'Ápr 23'→2026-04-23`. Sport session dates come from the fixture ids (`vb-2026-05-20` → 2026-05-20 …), times from the fixtures.

- [ ] **Step 1: Failing IT**

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.TrainSeedData;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("demodata")
class TrainSeedDataIT extends AbstractIntegrationTest {

    @Autowired private TrainSeedData trainSeedData;
    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private MuscleGroupVolumeLogRepository volumeLogRepository;
    @Autowired private WorkoutSessionRepository workoutSessionRepository;
    @Autowired private SportSessionRepository sportSessionRepository;

    @Test
    void testSeed_shouldPortAllTrainFixtures_whenRun() {
        trainSeedData.run(); // ResetDatabase wiped the startup seed -> run inside the test
        assertThat(mesocycleRepository.count()).isEqualTo(4);   // hyp-04, str-02, maint-01, rec-03
        assertThat(volumeLogRepository.count()).isEqualTo(8);   // 8 muscles on the active meso
        assertThat(workoutSessionRepository.count()).isEqualTo(7); // Hét..Vas template days
        assertThat(sportSessionRepository.count()).isEqualTo(5);
    }

    @Test
    void testSeed_shouldStaySame_whenRunTwice() {
        trainSeedData.run();
        trainSeedData.run();
        assertThat(mesocycleRepository.count()).isEqualTo(4);
    }
}
```

- [ ] **Step 2: TrainSeedData** — `@Component @Profile("demodata") @RequiredArgsConstructor`, `CommandLineRunner`-style like `OwnerSeedData` but with a public no-arg `run()` overload for the IT. Skeleton + one fully-worked example; port the REST verbatim from the fixture lines above:

```java
package io.mrkuhne.mezo.feature.train;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.train.entity.*;
import io.mrkuhne.mezo.feature.train.repository.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** Ports frontend/src/data/train.ts fixtures 1:1 so real mode renders what mock mode renders. */
@Component
@Profile("demodata")
@RequiredArgsConstructor
public class TrainSeedData implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final MesocycleRepository mesocycleRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final SportSessionRepository sportSessionRepository;
    private final OwnerProperties ownerProperties;

    @Override
    public void run(String... args) {
        run();
    }

    public void run() {
        if (mesocycleRepository.count() > 0) return; // idempotent
        UUID owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();

        // --- active meso: Hypertrophy 04 · Tavasz (train.ts:40-225) ---
        MesocycleEntity hyp = meso(owner, "Hypertrophy 04 · Tavasz", "Hypertrophy 04", "active",
            "Felsőtest hypertrophy · izomtömeg építés", "2026-05-01", "2026-06-12", 6, 3,
            "Pull / Push / Legs · 5×/hét", "RP · 6 hét",
            new String[] {"MEV", "MEV", "MAV", "MAV", "MRV", "Deload"}, null, null);
        hyp.setVolumeRecompute(new VolumeRecomputeJson(
            "Vasárnap · Máj 18 · 21:00", "Vasárnap · Máj 25 · 21:00", "Heti pattern engine batch",
            List.of(
                new VolumeRecomputeJson.Change("back", "MRV +2 (20 → 22)", "Pull Day pumpa-tolerancia 4 héten át stabil RIR 1-en", null),
                new VolumeRecomputeJson.Change("shoulder", "MRV -2 (20 → 18)", "Jobb váll niggle reaktivált · Máj 14", true),
                new VolumeRecomputeJson.Change("chest", "MAV +2 (12 → 14)", "Bench Press progresszió Q1 retro óta", null))));
        hyp = mesocycleRepository.save(hyp);

        // volumePerMuscle — ALL 8 muscles from train.ts:64-151. Worked example (chest):
        volume(owner, hyp.getId(), "chest", 8, 14, 20, 14, new ProvenanceEnvelope(
            new ProvenanceEnvelope.Baseline("RP guidelines · intermediate", 8, 12, 18),
            List.of(
                new ProvenanceEnvelope.Adjustment("pattern", "Múlt Q1 retro: pumpa 18-20 szet körül stabil maradt", Map.of("mrv", 2), null),
                new ProvenanceEnvelope.Adjustment("recovery", "7.2h alvás átlag · stabil", Map.of("mav", 2), null)),
            0.78,
            "Daniel-personalizált MRV. Bench Press + Incline DB + Cable Fly historikusan jól tolerál — 22-re is felmehetnénk, de Reta cycle alatt 20 a felső limit.",
            null));
        // ... port back, shoulder, biceps, triceps, quad, ham, glute the same way (train.ts:77-151)

        // days — 7 workout sessions + exercises from train.ts:152-225. Worked example (Csü = the current day):
        WorkoutSessionEntity csu = session(owner, hyp.getId(), "Csü", "Pull", "back+bicep", true,
            null, "active", 3);
        exercise(owner, csu.getId(), "Chest Supported Row", "back-mid", 4, "8-10", 1, "compound", null, 0);
        exercise(owner, csu.getId(), "Lat Pulldown · Pronated", "lats", 3, "10-12", 2, "compound", "Pronated grif · csukló-kíméletes", 1);
        exercise(owner, csu.getId(), "Cable Pull-Around", "back-mid", 3, "12-15", 1, "isolation", null, 2);
        exercise(owner, csu.getId(), "Hammer Curl", "biceps", 3, "10-12", 1, "isolation", null, 3);
        exercise(owner, csu.getId(), "Face Pull", "rear-delt", 3, "15-20", 1, "isolation", null, 4);
        // ... port Hét(0)/Kedd(1)/Sze(2)/Pén(4)/Szo(5)/Vas(6) the same way; Szo+Vas have no exercises,
        //     status stays "planned" everywhere except Csü.

        // --- planned/archived mesos (train.ts:226-268), no volume/days ---
        meso(owner, "Strength 02 · Nyár", "Strength 02", "planned",
            "Maximális erő · 1RM növelés Squat/Bench/Deadlift", "2026-06-16", "2026-08-04", 7, 0,
            "Upper / Lower · 4×/hét", "Linear · 7 hét",
            new String[] {"MEV", "MEV", "MAV", "MAV", "MRV", "MRV", "Deload"},
            "Daniel: 'Idő egy erő-blokkra is.' Reta cycle befejezésével szinkronban indul.", null);
        // ... maint-01 + rec-03 verbatim (rec-03 has summary, not notes)

        // --- sport sessions (train.ts:380-386) — worked example: ---
        sport(owner, "2026-05-20", "18:00", 90, 5, 7, "6.8", 6, 38,
            "Smashek tisztábbak, jobb váll után érzem délután");
        // ... port the remaining 4 (2026-05-18 10:00 120' ..., 2026-05-15 19:30, 2026-05-13 18:00, 2026-05-11 10:00)
    }

    // private helpers: meso(...), volume(...), session(...), exercise(...), sport(...) — plain
    // builders that set every field + createdBy and save via the repositories; sport rpe via new BigDecimal(s).
}
```
The `meso/volume/session/exercise/sport` private helpers each take the full field list, instantiate the entity, set `createdBy`, save, and return it — write them out (≈8 lines each), no reflection tricks.

- [ ] **Step 3: Run the IT — expect PASS; full suite; commit** — `feat(train): demodata seed ports train.ts fixtures 1:1 (mezo-n5q)`

---

### Task 9: Frontend — `useTrain` dual-mode + HU date display

**Files:**
- Modify: `frontend/src/lib/dates.ts`
- Create: `frontend/src/lib/trainApi.ts`
- Modify: `frontend/src/data/hooks.ts` (`useTrain` only)
- Modify: `frontend/src/test/msw/handlers.ts`
- Test: `frontend/src/data/trainHooks.test.tsx`

- [ ] **Step 1: Failing hook test** (`trainHooks.test.tsx`, real-mode block mirrors `sleepHooks.test.tsx` structure with `makeHookWrapper`):

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useTrain } from './hooks'
import { makeHookWrapper } from '@/test/queryWrapper'

vi.mock('@/lib/mode', () => ({ isMockMode: () => false }))

describe('useTrain (real mode)', () => {
  it('fetches mesocycles, formats display dates, derives activeMeso', async () => {
    const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.mesocycles.length).toBeGreaterThan(0))
    const active = result.current.activeMeso
    expect(active.title).toBe('Hypertrophy 04 · Tavasz')
    expect(active.startDate).toBe('Máj 1')        // ISO 2026-05-01 -> HU display
    expect(active.volumePerMuscle?.chest.source.confidence).toBe(0.78)
  })

  it('fetches sport sessions with computed HU date labels', async () => {
    const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.sport.sessions.length).toBeGreaterThan(0))
    expect(result.current.sport.sessions[0].date).toBe('Máj 20 · Sze') // TRUE day-of-week
    expect(result.current.sport.sessions[0].notes).toBeNull()
  })

  it('keeps static parts (workout, gymSchedule, exerciseLibrary)', async () => {
    const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
    expect(result.current.workout.exercises.length).toBeGreaterThan(0)
    expect(result.current.exerciseLibrary.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: `lib/dates.ts` additions**

```ts
const HU_MONTHS = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec']
const HU_DOW = ['Vas', 'Hét', 'Kedd', 'Sze', 'Csü', 'Pén', 'Szo']

/** '2026-05-01' -> 'Máj 1' (Hungarian month abbrev, no leading zero). */
export function huMonthDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${HU_MONTHS[m - 1]} ${d}`
}

/** '2026-05-20' -> 'Máj 20 · Sze' (TRUE day-of-week — mock fixtures are not authoritative here). */
export function huMonthDayDow(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${huMonthDay(iso)} · ${HU_DOW[new Date(y, m - 1, d).getDay()]}`
}
```

- [ ] **Step 3: `lib/trainApi.ts`**

```ts
import { apiFetch } from './api'
import type { components } from './api.gen'

export type MesocycleResponse = components['schemas']['MesocycleResponse']
export type SportSessionResponse = components['schemas']['SportSessionResponse']

export const trainApi = {
  mesocycles: () => apiFetch<MesocycleResponse[]>('/api/train/mesocycles'),
  sportSessions: () => apiFetch<SportSessionResponse[]>('/api/train/sport-sessions'),
}
```

- [ ] **Step 4: `useTrain` dual-mode swap** in `hooks.ts` (mock branch byte-identical via `initialData` — Slice A pattern):

```ts
import { trainApi, type MesocycleResponse, type SportSessionResponse } from '@/lib/trainApi'
import { huMonthDay, huMonthDayDow } from '@/lib/dates'
import type { Mesocycle, SportSession } from './types'

function toMesocycle(r: MesocycleResponse): Mesocycle {
  return {
    ...r,
    startDate: huMonthDay(r.startDate),
    endDate: huMonthDay(r.endDate),
    goal: r.goal ?? '',
  } as Mesocycle
}

function toSportSession(r: SportSessionResponse): SportSession {
  return {
    id: r.id, sport: r.sport, date: huMonthDayDow(r.date), time: r.time,
    duration: r.duration, setsPlayed: r.setsPlayed, intensity: r.intensity,
    rpe: r.rpe, shoulderStrain: r.shoulderStrain, jumpCount: r.jumpCount,
    notes: r.notes ?? null,
  }
}

export function useTrain() {
  const mock = isMockMode()
  const mesoQuery = useQuery({
    queryKey: ['train', 'mesocycles'],
    queryFn: mock ? async () => mesocycles : () => trainApi.mesocycles().then(rs => rs.map(toMesocycle)),
    ...(mock ? { initialData: mesocycles } : {}),
  })
  const sportQuery = useQuery({
    queryKey: ['train', 'sportSessions'],
    queryFn: mock ? async () => sport.sessions : () => trainApi.sportSessions().then(rs => rs.map(toSportSession)),
    ...(mock ? { initialData: sport.sessions } : {}),
  })
  const mesos = mesoQuery.data ?? []
  return {
    mesocycles: mesos,
    // static fallback while real data loads -> components never see undefined (no component edits allowed)
    activeMeso: mesos.find(m => m.status === 'active') ?? activeMeso,
    workout: trainWorkout,
    gymSchedule: trainGymSchedule,
    sport: { ...sport, sessions: sportQuery.data ?? [] },
    exerciseLibrary,
  }
}
```
(Adjust the import aliases to whatever `hooks.ts` already uses for the train statics — it imports them today for the mock return.)

- [ ] **Step 5: MSW handlers** — add to `src/test/msw/handlers.ts` (fixtures mirror the seed; keep them SMALL — one active meso with chest volume + one day, plus two sport sessions):

```ts
http.get(`${API_BASE}/api/train/mesocycles`, () =>
  HttpResponse.json([{
    id: 'b6f3a0e2-0000-4000-8000-000000000001',
    title: 'Hypertrophy 04 · Tavasz', shortTitle: 'Hypertrophy 04', status: 'active',
    goal: 'Felsőtest hypertrophy · izomtömeg építés',
    startDate: '2026-05-01', endDate: '2026-06-12', weeks: 6, currentWeek: 3,
    split: 'Pull / Push / Legs · 5×/hét', style: 'RP · 6 hét',
    phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
    volumePerMuscle: {
      chest: {
        mev: 8, mav: 14, mrv: 20, current: 14,
        source: {
          baseline: { name: 'RP guidelines · intermediate', mev: 8, mav: 12, mrv: 18 },
          adjustments: [{ kind: 'pattern', label: 'Q1 retro stabil', delta: { mrv: 2 } }],
          confidence: 0.78,
        },
      },
    },
    days: [{ day: 'Csü', type: 'Pull', muscle: 'back+bicep', exerciseCount: 1, current: true,
      exercises: [{ id: 'c1f3a0e2-0000-4000-8000-000000000002', name: 'Chest Supported Row',
        muscle: 'back-mid', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound' }] }],
  }]),
),
http.get(`${API_BASE}/api/train/sport-sessions`, () =>
  HttpResponse.json([
    { id: 'd1f3a0e2-0000-4000-8000-000000000003', sport: 'volleyball', date: '2026-05-20',
      time: '18:00', duration: 90, setsPlayed: 5, intensity: 7, rpe: 6.8, shoulderStrain: 6, jumpCount: 38 },
    { id: 'd1f3a0e2-0000-4000-8000-000000000004', sport: 'volleyball', date: '2026-05-18',
      time: '10:00', duration: 120, setsPlayed: 6, intensity: 8, rpe: 7.2, shoulderStrain: 7, jumpCount: 52,
      notes: 'Hosszú meccs · maradt erő utána' },
  ]),
),
```

- [ ] **Step 6: Run FE tests in BOTH modes + build**

```bash
cd frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```
Expected: all green in both modes (mock-mode train tests untouched; new real-mode tests pass).

- [ ] **Step 7: Commit** — `feat(train): useTrain dual-mode with HU display-date mapping (mezo-n5q)`

---

### Task 10: Gates, docs, merge

- [ ] **Step 1: Full backend gates** (both DB modes)

```bash
cd backend && ./mvnw clean test && ./mvnw clean test -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 2: Parity** — `cd frontend && pnpm parity` → 45/45 (mock-visual, must stay untouched).

- [ ] **Step 3: Live smoke** — compose up + `./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata`, then:

```bash
TOKEN=$(curl -s localhost:8090/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"owner@mezo.local","password":"owner"}' | python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')
curl -s localhost:8090/api/train/mesocycles -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -30
```
Expected: 4 mesocycles, the active one with `volumePerMuscle` (8 muscles) and 7 `days`.

- [ ] **Step 4: CLAUDE.md** — Architecture Overview slice status: `Slice A + B ✅ done; slices C (Fuel) → D (Insights seed) → E (People) remain.`

- [ ] **Step 5: Close + merge per Git Workflow** (rebase main BEFORE merging):

```bash
bd close mezo-n5q --reason="Slice B shipped: 6 Train tables, provenance jsonb proven, contract-first GETs, demodata seed, useTrain dual-mode; all gates green"
git checkout main && git pull --rebase
git merge --no-ff feat/phase2-slice-b -m "Merge feat/phase2-slice-b: Train backend + provenance envelope (mezo-n5q)"
git branch -d feat/phase2-slice-b
bd dolt push && git push && git status
```

---

## Self-review notes (done at plan time)

- **Spec coverage:** all 6 spec tables present (Task 2); provenance jsonb proven early (Task 3, before service work); `useTrain` is the only hook touched, signature preserved (Task 9); parity checkpoint (Task 10). Read-only scope justified in "Scope decisions".
- **Type consistency:** contract schema names (Task 1) = generated `api.dto` names used in Tasks 7–9; `currentSets` ↔ contract `current` mapped explicitly; `targetRir` ↔ `targetRIR` mapped explicitly; `durationMin` ↔ `duration` mapped explicitly.
- **Known verify-at-execution points:** generated enum inner-class names (Task 7 note); `MesoDay.builder()` availability (generated models carry Lombok `@Builder`); Hibernate jsonb FormatMapper on SB4/Jackson 3 (Task 3 contingency); `String[]`→`text[]` ARRAY mapping (Task 4 — if it fights, `List<String>` with the same annotation is the fallback).
