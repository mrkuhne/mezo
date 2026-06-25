# Progression P1 — Domain Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend progression domain foundation — the level curve, config, three owned tables with entities/repositories, the in-memory perk catalog, and the test-infra wiring — with NO triggers and NO HTTP yet, so later slices (P2 gym path onward) plug into a tested base.

**Architecture:** A new Spring Boot feature module `io.mrkuhne.mezo.feature.progression`. A pure `ProgressionCurve` derives a skill's level + within-level progress from cumulative XP via a config-driven threshold function. Three `OwnedEntity` tables (`skill_progress`, `level_up_event`, `perk_unlock`) created in one Liquibase script. A profile-independent `PerkCatalog` loads static perk content from a classpath JSON. All XP-granting logic (applyWorkout) is deferred to P2.

**Tech Stack:** Java 21, Spring Boot 4.x, Maven, Hibernate/JPA, Liquibase, PostgreSQL 16, Lombok, AssertJ, JUnit 5, Testcontainers/compose Postgres.

## Global Constraints

- Base package is `io.mrkuhne.mezo` (NOT io.mezo/com.mrkuhne). Driving bd: **mezo-8e4**.
- Build/test: `cd backend && ./mvnw clean test` (ALWAYS `clean` — Lombok+MapStruct incremental compile is flaky). Local Postgres via `docker compose up -d` (port 15432, DBs `mezo`+`mezo_test`).
- **UUID PKs** everywhere: `@Id @GeneratedValue @Column(columnDefinition = "uuid") private UUID id;` — bare `@GeneratedValue`, never `@UuidGenerator` or `strategy=`.
- **Owned tables** extend `OwnedEntity` (supplies `createdBy`, `deleted`→`is_deleted`, `createdAt`). Header stack: `@Getter @Setter @Entity @Table(name="…") @SQLDelete(sql="update <table> set is_deleted = true where id = ?") @SQLRestriction("is_deleted = false")`.
- **Enum-valued columns = plain `String`** + trailing `// a|b|c (DB CHECK)` comment + a DB CHECK constraint. `@Enumerated` is NEVER used here.
- **Required columns** get BOTH `@jakarta.validation.constraints.NotNull` AND `@Column(nullable = false)`.
- **jsonb** = `@JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb")` onto a plain Java record.
- **Liquibase:** filename `{YYYYMMDDHHMM}_mezo-8e4_{desc}.sql` under `1.0.0/script/`; register a `changeSet` in `1.0.0/1.0.0_master.yml` with id `"1.0.0:{filename-without-.sql}"`, author `daniel.kuhne`. ALL constraints NAMED (`pk_/fk_/uq_/ck_/idx_`). Never modify released changesets.
- **Config:** `@Validated @ConfigurationProperties(prefix="mezo.progression")` record; YAML under the `mezo:` root in `application.yml`; auto-registered by `@ConfigurationPropertiesScan` (already on `MezoApplication` — do NOT add `@EnableConfigurationProperties`). `@Value`/`Environment.getProperty` FORBIDDEN.
- **Tests:** integration-first against REAL Postgres — NO mocks, NO `@MockBean`, NO H2. Service/repo ITs extend `AbstractIntegrationTest` + class-level `@Transactional`; data via `*Populator` (`@TestComponent`, `saveAndFlush`); AssertJ only; method names `test{Method}_should{Result}_when{Condition}`. Pure-logic classes may use a plain JUnit unit test (no Spring).
- **New owned table → add to `ResetDatabase` TRUNCATE list in the same change.** Master-data tables (perk catalog is in-memory here, so N/A) are excluded.
- Lombok: `@Getter`/`@Setter` on entities, `@RequiredArgsConstructor` for constructor injection. Never field injection (except `@PersistenceContext EntityManager` in tests).
- Imports: `jakarta.persistence.*` (entity), `org.hibernate.annotations.*` (`@SQLDelete/@SQLRestriction/@CreationTimestamp/@UpdateTimestamp/@JdbcTypeCode`), `org.hibernate.type.SqlTypes`, `jakarta.validation.constraints.*`. SB4 Jackson 3 `ObjectMapper` from `tools.jackson.databind`.

---

### Task 1: Progression config + level curve

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/config/ProgressionProperties.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/ProgressionCurve.java`
- Modify: `backend/src/main/resources/application.yml` (add `mezo.progression` block)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionCurveTest.java`

**Interfaces:**
- Produces: `ProgressionProperties` (record, prefix `mezo.progression`) with nested `Curve(Integer base, Double exp)`; accessor `curve()`. `ProgressionCurve` (`@Component`, ctor-injects `ProgressionProperties`) with: `long xpThreshold(int level)`, `int levelFor(long cumulativeXp)`, `double progressPct(long cumulativeXp, int level)`.

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.progression.config.ProgressionProperties;
import org.junit.jupiter.api.Test;

class ProgressionCurveTest {

    // Pure logic: no Spring context. Defaults base=100, exp=1.6.
    private final ProgressionCurve curve =
        new ProgressionCurve(new ProgressionProperties(new ProgressionProperties.Curve(100, 1.6)));

    @Test
    void testXpThreshold_shouldFollowGrowingCurve_whenComputedPerLevel() {
        assertThat(curve.xpThreshold(1)).isZero();
        assertThat(curve.xpThreshold(2)).isEqualTo(100L);
        assertThat(curve.xpThreshold(3)).isEqualTo(303L);
        assertThat(curve.xpThreshold(4)).isEqualTo(580L);
        assertThat(curve.xpThreshold(5)).isEqualTo(919L);
    }

    @Test
    void testLevelFor_shouldReturnHighestReachedLevel_whenGivenCumulativeXp() {
        assertThat(curve.levelFor(0L)).isEqualTo(1);
        assertThat(curve.levelFor(99L)).isEqualTo(1);
        assertThat(curve.levelFor(100L)).isEqualTo(2);
        assertThat(curve.levelFor(302L)).isEqualTo(2);
        assertThat(curve.levelFor(303L)).isEqualTo(3);
        assertThat(curve.levelFor(1000L)).isEqualTo(5);
    }

    @Test
    void testProgressPct_shouldReturnWithinLevelFill_whenPartwayThroughBand() {
        // level 2 band is [100, 303); 200 is 100/203 of the way
        assertThat(curve.progressPct(200L, 2)).isCloseTo(49.26, within(0.1));
        assertThat(curve.progressPct(100L, 2)).isCloseTo(0.0, within(0.01));
    }

    @Test
    void testProgressPct_shouldClampToHundred_whenAtOrBeyondNextThreshold() {
        assertThat(curve.progressPct(303L, 2)).isEqualTo(100.0);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionCurveTest`
Expected: FAIL — compile error, `ProgressionProperties` / `ProgressionCurve` do not exist.

- [ ] **Step 3: Write the config record**

```java
// ProgressionProperties.java
package io.mrkuhne.mezo.feature.progression.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Progression tuning (mezo.progression). P1 ships the level curve; P2+ adds signal weights. */
@Validated
@ConfigurationProperties(prefix = "mezo.progression")
public record ProgressionProperties(
    @NotNull @Valid Curve curve
) {
    /** Level threshold curve: xpThreshold(n) = round(base * (n-1)^exp), xpThreshold(1)=0. */
    public record Curve(
        @NotNull @Positive Integer base,  // 100
        @NotNull @Positive Double exp     // 1.6
    ) {}
}
```

- [ ] **Step 4: Write the curve**

```java
// ProgressionCurve.java
package io.mrkuhne.mezo.feature.progression;

import io.mrkuhne.mezo.feature.progression.config.ProgressionProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Pure level math derived from cumulative XP. A skill with 0 XP is level 1; xpThreshold(n)
 * is the cumulative XP required to BE at level n. No state, no DB.
 */
@Component
@RequiredArgsConstructor
public class ProgressionCurve {

    private static final int MAX_LEVEL = 200; // safety cap for the levelFor scan

    private final ProgressionProperties properties;

    /** Cumulative XP required to be AT {@code level}. xpThreshold(1) = 0. */
    public long xpThreshold(int level) {
        if (level <= 1) {
            return 0L;
        }
        ProgressionProperties.Curve c = properties.curve();
        return Math.round(c.base() * Math.pow(level - 1, c.exp()));
    }

    /** Highest level n whose threshold ≤ cumulativeXp (≥ 1). */
    public int levelFor(long cumulativeXp) {
        int level = 1;
        while (level < MAX_LEVEL && xpThreshold(level + 1) <= cumulativeXp) {
            level++;
        }
        return level;
    }

    /** Within-level fill 0..100 for a skill at {@code level} holding {@code cumulativeXp}. */
    public double progressPct(long cumulativeXp, int level) {
        long floor = xpThreshold(level);
        long ceil = xpThreshold(level + 1);
        if (ceil <= floor) {
            return 100.0;
        }
        double pct = (double) (cumulativeXp - floor) / (ceil - floor) * 100.0;
        return Math.max(0.0, Math.min(100.0, pct));
    }
}
```

- [ ] **Step 5: Add the YAML block**

Add under the existing `mezo:` root in `backend/src/main/resources/application.yml` (e.g. after the `nutrition:` block):

```yaml
  progression:
    # Level threshold curve: xpThreshold(n) = round(base * (n-1)^exp); Lv2=100, Lv3≈303, Lv5≈919.
    curve:
      base: 100
      exp: 1.6
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionCurveTest`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionCurveTest.java
git commit -m "feat(progression): level curve + config (mezo-8e4)"
```

---

### Task 2: Liquibase migration — three owned tables

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202606251200_mezo-8e4_create_progression.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append a changeSet)

**Interfaces:**
- Produces: tables `skill_progress`, `level_up_event`, `perk_unlock` with the named constraints Task 3's entities + Task 4's tests rely on.

- [ ] **Step 1: Write the SQL migration**

Create the file with exactly:

```sql
-- Progression domain (mezo-8e4): per-skill XP accumulator, XP-grant event ledger, perk unlocks.

CREATE TABLE skill_progress (
    id             UUID DEFAULT gen_random_uuid(),
    created_by     UUID NOT NULL,
    skill_key      TEXT NOT NULL,
    skill_kind     TEXT NOT NULL,        -- ATHLETIC|MUSCLE (DB CHECK)
    cumulative_xp  BIGINT NOT NULL DEFAULT 0,
    current_level  INTEGER NOT NULL DEFAULT 1,
    is_deleted     BOOLEAN NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_skill_progress_id PRIMARY KEY (id),
    CONSTRAINT fk_skill_progress_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_skill_progress_kind CHECK (skill_kind IN ('ATHLETIC', 'MUSCLE')),
    CONSTRAINT ck_skill_progress_level CHECK (current_level >= 1),
    CONSTRAINT uq_skill_progress_created_by_skill_key UNIQUE (created_by, skill_key)
);
CREATE INDEX idx_skill_progress_created_by ON skill_progress (created_by);

-- One row per XP-granting workout regardless of whether a level was crossed (levelUps[] may be empty).
CREATE TABLE level_up_event (
    id             UUID DEFAULT gen_random_uuid(),
    created_by     UUID NOT NULL,
    source_type    TEXT NOT NULL,        -- GYM|SPORT|RUN (DB CHECK)
    source_ref_id  UUID NOT NULL,        -- polymorphic ref to gym instance / sport / run session; intentionally NOT an FK
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_xp       BIGINT NOT NULL,
    payload        JSONB NOT NULL,
    is_deleted     BOOLEAN NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_level_up_event_id PRIMARY KEY (id),
    CONSTRAINT fk_level_up_event_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_level_up_event_source_type CHECK (source_type IN ('GYM', 'SPORT', 'RUN')),
    CONSTRAINT uq_level_up_event_created_by_source UNIQUE (created_by, source_type, source_ref_id)
);
CREATE INDEX idx_level_up_event_created_by ON level_up_event (created_by);

CREATE TABLE perk_unlock (
    id              UUID DEFAULT gen_random_uuid(),
    created_by      UUID NOT NULL,
    skill_key       TEXT NOT NULL,
    perk_key        TEXT NOT NULL,
    milestone_level INTEGER NOT NULL,
    unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_perk_unlock_id PRIMARY KEY (id),
    CONSTRAINT fk_perk_unlock_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_perk_unlock_milestone CHECK (milestone_level >= 1),
    CONSTRAINT uq_perk_unlock_created_by_perk UNIQUE (created_by, perk_key)
);
CREATE INDEX idx_perk_unlock_created_by ON perk_unlock (created_by);
```

- [ ] **Step 2: Register the changeSet**

Append to the end of the `databaseChangeLog:` list in `1.0.0/1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202606251200_mezo-8e4_create_progression"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202606251200_mezo-8e4_create_progression.sql
```

- [ ] **Step 3: Apply + verify the migration runs clean**

Run: `cd backend && docker compose up -d && ./mvnw clean test -Dtest=ProgressionCurveTest`
Expected: PASS — the app context boots (Liquibase applies the new changeSet against `mezo_test` with no checksum/SQL error). A Liquibase or DDL error fails context startup here.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/changelog/1.0.0/script/202606251200_mezo-8e4_create_progression.sql backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml
git commit -m "feat(progression): create skill_progress, level_up_event, perk_unlock tables (mezo-8e4)"
```

---

### Task 3: Entities, jsonb payload, repositories + round-trip ITs

**Files:**
- Create: `…/feature/progression/entity/SkillProgressEntity.java`
- Create: `…/feature/progression/entity/LevelUpEventEntity.java`
- Create: `…/feature/progression/entity/PerkUnlockEntity.java`
- Create: `…/feature/progression/entity/LevelUpResult.java` (jsonb payload record)
- Create: `…/feature/progression/repository/SkillProgressRepository.java`
- Create: `…/feature/progression/repository/LevelUpEventRepository.java`
- Create: `…/feature/progression/repository/PerkUnlockRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionPersistenceIT.java`

**Interfaces:**
- Consumes: the three tables from Task 2; `OwnedEntity`.
- Produces: `SkillProgressEntity` (fields `id, skillKey, skillKind, cumulativeXp, currentLevel, updatedAt`), `LevelUpEventEntity` (`id, sourceType, sourceRefId, occurredAt, totalXp, payload:LevelUpResult`), `PerkUnlockEntity` (`id, skillKey, perkKey, milestoneLevel, unlockedAt`), `LevelUpResult` record (§5 of the spec). Repos: `SkillProgressRepository.findByCreatedByAndSkillKey(UUID, String)` + `findByCreatedByOrderBySkillKeyAsc(UUID)`; `LevelUpEventRepository.findByCreatedByAndSourceTypeAndSourceRefId(UUID, String, UUID)`; `PerkUnlockRepository.findByCreatedByOrderByUnlockedAtAsc(UUID)`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpEventEntity;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.entity.SkillProgressEntity;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ProgressionPersistenceIT extends AbstractIntegrationTest {

    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private LevelUpEventRepository levelUpEventRepository;
    @Autowired private DatabasePopulator databasePopulator;
    @PersistenceContext private EntityManager entityManager;

    @Test
    void testSaveSkillProgress_shouldRoundTrip_whenReloaded() {
        UUID user = databasePopulator.populateUser("prog@test.local");
        SkillProgressEntity row = new SkillProgressEntity();
        row.setCreatedBy(user);
        row.setSkillKey("anaerobic_capacity");
        row.setSkillKind("ATHLETIC");
        row.setCumulativeXp(303L);
        row.setCurrentLevel(3);
        SkillProgressEntity saved = skillProgressRepository.saveAndFlush(row);

        entityManager.clear();

        SkillProgressEntity reloaded = skillProgressRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getSkillKey()).isEqualTo("anaerobic_capacity");
        assertThat(reloaded.getCumulativeXp()).isEqualTo(303L);
        assertThat(reloaded.getCurrentLevel()).isEqualTo(3);
        assertThat(reloaded.getUpdatedAt()).isNotNull();
    }

    @Test
    void testSaveSkillProgress_shouldRejectDuplicate_whenSameCreatedByAndSkillKey() {
        UUID user = databasePopulator.populateUser("dup@test.local");
        SkillProgressEntity a = new SkillProgressEntity();
        a.setCreatedBy(user);
        a.setSkillKey("chest");
        a.setSkillKind("MUSCLE");
        skillProgressRepository.saveAndFlush(a);

        SkillProgressEntity b = new SkillProgressEntity();
        b.setCreatedBy(user);
        b.setSkillKey("chest");
        b.setSkillKind("MUSCLE");

        assertThatThrownBy(() -> skillProgressRepository.saveAndFlush(b))
            .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test
    void testSaveLevelUpEvent_shouldRoundTripJsonbPayload_whenReloaded() {
        UUID user = databasePopulator.populateUser("evt@test.local");
        UUID workoutRef = UUID.randomUUID();
        LevelUpResult payload = new LevelUpResult(
            "GYM", "Klasszik kondi · Push", 58, 8, 480L,
            List.of(new LevelUpResult.Gain("max_strength", "ATHLETIC", "Maximális erő", null,
                120L, 6, 7, 70.0, 12.0)),
            List.of("max_strength"),
            List.of(new LevelUpResult.Perk("max_strength", "iron_core_2", "Vas-törzs II",
                "push-volumen tűrés +6%", 5)),
            new LevelUpResult.Robustness(25L, 5));

        LevelUpEventEntity evt = new LevelUpEventEntity();
        evt.setCreatedBy(user);
        evt.setSourceType("GYM");
        evt.setSourceRefId(workoutRef);
        evt.setTotalXp(480L);
        evt.setPayload(payload);
        LevelUpEventEntity saved = levelUpEventRepository.saveAndFlush(evt);

        entityManager.clear();

        LevelUpEventEntity reloaded = levelUpEventRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getPayload().source()).isEqualTo("GYM");
        assertThat(reloaded.getPayload().gains()).hasSize(1);
        assertThat(reloaded.getPayload().gains().get(0).skillKey()).isEqualTo("max_strength");
        assertThat(reloaded.getPayload().perks().get(0).name()).isEqualTo("Vas-törzs II");
        assertThat(reloaded.getPayload().robustness().streakWeeks()).isEqualTo(5);
    }

    @Test
    void testFindByCreatedByAndSourceRefId_shouldReturnEvent_whenIdempotencyKeyMatches() {
        UUID user = databasePopulator.populateUser("idem@test.local");
        UUID workoutRef = UUID.randomUUID();
        LevelUpEventEntity evt = new LevelUpEventEntity();
        evt.setCreatedBy(user);
        evt.setSourceType("RUN");
        evt.setSourceRefId(workoutRef);
        evt.setTotalXp(120L);
        evt.setPayload(new LevelUpResult("RUN", "Futás", 40, 6, 120L,
            List.of(), List.of(), List.of(), new LevelUpResult.Robustness(0L, 5)));
        levelUpEventRepository.saveAndFlush(evt);

        entityManager.clear();

        assertThat(levelUpEventRepository
            .findByCreatedByAndSourceTypeAndSourceRefId(user, "RUN", workoutRef)).isPresent();
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionPersistenceIT`
Expected: FAIL — compile error, entities/repos/`LevelUpResult` don't exist.

- [ ] **Step 3: Write the jsonb payload record**

```java
// LevelUpResult.java
package io.mrkuhne.mezo.feature.progression.entity;

import java.util.List;

/** The level-up payload persisted into level_up_event.payload (jsonb) and returned to the FE (P2+). */
public record LevelUpResult(
    String source,            // GYM|SPORT|RUN
    String workoutLabel,
    Integer durationMin,
    Integer rpe,
    long totalXp,
    List<Gain> gains,
    List<String> levelUps,
    List<Perk> perks,
    Robustness robustness
) {
    public record Gain(String skillKey, String kind, String name, String icon,
        long xpGained, int levelBefore, int levelAfter, double progressFromPct, double progressToPct) {}

    public record Perk(String skillKey, String perkKey, String name, String effectCopy, int milestoneLevel) {}

    public record Robustness(long xpGained, int streakWeeks) {}
}
```

- [ ] **Step 4: Write the three entities**

```java
// SkillProgressEntity.java
package io.mrkuhne.mezo.feature.progression.entity;

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
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;

@Getter
@Setter
@Entity
@Table(name = "skill_progress")
@SQLDelete(sql = "update skill_progress set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class SkillProgressEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "skill_key", nullable = false)
    private String skillKey;

    @NotNull
    @Column(name = "skill_kind", nullable = false)
    private String skillKind; // ATHLETIC|MUSCLE (DB CHECK)

    // primitive long/int are never null → @Column(nullable=false) only (mirrors OwnedEntity.deleted)
    @Column(name = "cumulative_xp", nullable = false)
    private long cumulativeXp = 0L;

    @Column(name = "current_level", nullable = false)
    private int currentLevel = 1;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
```

```java
// LevelUpEventEntity.java
package io.mrkuhne.mezo.feature.progression.entity;

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
@Table(name = "level_up_event")
@SQLDelete(sql = "update level_up_event set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class LevelUpEventEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "source_type", nullable = false)
    private String sourceType; // GYM|SPORT|RUN (DB CHECK)

    @NotNull
    @Column(name = "source_ref_id", nullable = false)
    private UUID sourceRefId;

    @CreationTimestamp
    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    @Column(name = "total_xp", nullable = false)
    private long totalXp;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private LevelUpResult payload;
}
```

```java
// PerkUnlockEntity.java
package io.mrkuhne.mezo.feature.progression.entity;

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
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@Entity
@Table(name = "perk_unlock")
@SQLDelete(sql = "update perk_unlock set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PerkUnlockEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "skill_key", nullable = false)
    private String skillKey;

    @NotNull
    @Column(name = "perk_key", nullable = false)
    private String perkKey;

    @Column(name = "milestone_level", nullable = false)
    private int milestoneLevel;

    @CreationTimestamp
    @Column(name = "unlocked_at", nullable = false, updatable = false)
    private Instant unlockedAt;
}
```

- [ ] **Step 5: Write the three repositories**

```java
// SkillProgressRepository.java
package io.mrkuhne.mezo.feature.progression.repository;

import io.mrkuhne.mezo.feature.progression.entity.SkillProgressEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Date-less owned entity → extend JpaRepository directly (not the date-ordered OwnedRepository);
// all finders are createdBy-scoped for ownership isolation.
public interface SkillProgressRepository extends JpaRepository<SkillProgressEntity, UUID> {

    Optional<SkillProgressEntity> findByCreatedByAndSkillKey(UUID createdBy, String skillKey);

    List<SkillProgressEntity> findByCreatedByOrderBySkillKeyAsc(UUID createdBy);
}
```

```java
// LevelUpEventRepository.java
package io.mrkuhne.mezo.feature.progression.repository;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpEventEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LevelUpEventRepository extends JpaRepository<LevelUpEventEntity, UUID> {

    // Idempotency lookup: a workout grants XP once per (source_type, source_ref_id).
    Optional<LevelUpEventEntity> findByCreatedByAndSourceTypeAndSourceRefId(
        UUID createdBy, String sourceType, UUID sourceRefId);
}
```

```java
// PerkUnlockRepository.java
package io.mrkuhne.mezo.feature.progression.repository;

import io.mrkuhne.mezo.feature.progression.entity.PerkUnlockEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PerkUnlockRepository extends JpaRepository<PerkUnlockEntity, UUID> {

    List<PerkUnlockEntity> findByCreatedByOrderByUnlockedAtAsc(UUID createdBy);
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionPersistenceIT`
Expected: PASS (4 tests) — the jsonb payload and unique constraint round-trip correctly.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionPersistenceIT.java
git commit -m "feat(progression): entities, jsonb payload + repositories (mezo-8e4)"
```

---

### Task 4: Test-infra wiring — ResetDatabase + populators

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (TRUNCATE list)
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/SkillProgressPopulator.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/LevelUpEventPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java` (@Import list)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionPopulatorIT.java`

**Interfaces:**
- Consumes: entities/repos from Task 3.
- Produces: `SkillProgressPopulator.createSkill(UUID createdBy, String skillKey, String kind, long cumXp, int level)`; `LevelUpEventPopulator.createEvent(UUID createdBy, String sourceType, UUID sourceRefId, LevelUpResult payload)`. Both autowirable in any IT.

- [ ] **Step 1: Add the three tables to the TRUNCATE list**

In `ResetDatabase.java`, in `resetExceptMasterData()`, extend the `TRUNCATE TABLE …` string to include the new tables (add them to the leading line so CASCADE handles order):

```java
        entityManager.createNativeQuery(
            "TRUNCATE TABLE skill_progress, level_up_event, perk_unlock, "
                + "meal_item, meal, recipe_ingredient, recipe, pantry_item, weight_log, sleep_log, check_in, "
                + "exercise_feedback, exercise_set, exercise, workout_session, muscle_group_volume_log, mesocycle, "
                + "gym_schedule_slot, sport_schedule_slot, sport_session, run_session_log, running_block, "
                + "goal_plan_link, goal, biometric_profile CASCADE").executeUpdate();
```

- [ ] **Step 2: Write the two populators**

```java
// SkillProgressPopulator.java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.progression.entity.SkillProgressEntity;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class SkillProgressPopulator {

    private final SkillProgressRepository repository;

    public SkillProgressEntity createSkill(UUID createdBy, String skillKey, String kind,
        long cumulativeXp, int level) {
        SkillProgressEntity e = new SkillProgressEntity();
        e.setCreatedBy(createdBy);
        e.setSkillKey(skillKey);
        e.setSkillKind(kind);
        e.setCumulativeXp(cumulativeXp);
        e.setCurrentLevel(level);
        return repository.saveAndFlush(e);
    }
}
```

```java
// LevelUpEventPopulator.java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpEventEntity;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class LevelUpEventPopulator {

    private final LevelUpEventRepository repository;

    public LevelUpEventEntity createEvent(UUID createdBy, String sourceType, UUID sourceRefId,
        LevelUpResult payload) {
        LevelUpEventEntity e = new LevelUpEventEntity();
        e.setCreatedBy(createdBy);
        e.setSourceType(sourceType);
        e.setSourceRefId(sourceRefId);
        e.setTotalXp(payload.totalXp());
        e.setPayload(payload);
        return repository.saveAndFlush(e);
    }
}
```

- [ ] **Step 3: Register the populators in the @Import list**

In `AbstractIntegrationTest.java`, add `SkillProgressPopulator.class, LevelUpEventPopulator.class` to the `@Import({…})` list (e.g. after `MealPopulator.class`):

```java
@Import({TestcontainersConfiguration.class, DatabasePopulator.class, UserPopulator.class,
    TrainPopulator.class, RunningPopulator.class, GoalPopulator.class, GoalPlanLinkPopulator.class,
    BiometricProfilePopulator.class, WeightLogPopulator.class, PantryItemPopulator.class,
    RecipePopulator.class, MealPopulator.class,
    SkillProgressPopulator.class, LevelUpEventPopulator.class, ResetDatabase.class})
```

- [ ] **Step 4: Write the populator IT**

```java
package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.SkillProgressPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ProgressionPopulatorIT extends AbstractIntegrationTest {

    @Autowired private SkillProgressPopulator skillProgressPopulator;
    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testCreateSkill_shouldPersistSeededProgress_whenInvoked() {
        UUID user = databasePopulator.populateUser("pop@test.local");
        skillProgressPopulator.createSkill(user, "quad", "MUSCLE", 580L, 4);

        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "quad"))
            .get()
            .satisfies(s -> {
                assertThat(s.getCumulativeXp()).isEqualTo(580L);
                assertThat(s.getCurrentLevel()).isEqualTo(4);
            });
    }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionPopulatorIT`
Expected: PASS — populators are autowirable (proves the @Import wiring) and seed rows.

- [ ] **Step 6: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/support backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionPopulatorIT.java
git commit -m "test(progression): ResetDatabase + populators wiring (mezo-8e4)"
```

---

### Task 5: In-memory perk catalog

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/PerkCatalog.java`
- Create: `backend/src/main/resources/content/progression-perks.json`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/PerkCatalogIT.java`

**Interfaces:**
- Produces: `PerkCatalog` (`@Component`, loads at startup) with `Optional<PerkDef> find(String skillKey, int milestoneLevel)` and `PerkDef` record `(String skillKey, int milestoneLevel, String perkKey, String name, String effectCopy)`. Used by P2's applyWorkout to resolve unlocked perks. Catalog content is in-memory (master content, no table) — NOT added to ResetDatabase.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class PerkCatalogIT extends AbstractIntegrationTest {

    @Autowired private PerkCatalog perkCatalog;

    @Test
    void testFind_shouldReturnPerk_whenSkillAndMilestoneMatchContent() {
        assertThat(perkCatalog.find("max_strength", 5))
            .get()
            .satisfies(p -> {
                assertThat(p.perkKey()).isNotBlank();
                assertThat(p.name()).isNotBlank();
                assertThat(p.effectCopy()).isNotBlank();
            });
    }

    @Test
    void testFind_shouldBeEmpty_whenNoPerkAtThatMilestone() {
        assertThat(perkCatalog.find("max_strength", 4)).isEmpty();
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=PerkCatalogIT`
Expected: FAIL — `PerkCatalog` doesn't exist.

- [ ] **Step 3: Write the perk content JSON**

Create `backend/src/main/resources/content/progression-perks.json`:

```json
[
  { "skillKey": "max_strength", "milestoneLevel": 5, "perkKey": "iron_core_2", "name": "Vas-törzs II", "effectCopy": "push-volumen tűrés +6%" },
  { "skillKey": "anaerobic_capacity", "milestoneLevel": 5, "perkKey": "lactate_buffer_2", "name": "Tejsav-puffer II", "effectCopy": "becsült munkakapacitás +8%" },
  { "skillKey": "vertical_jump", "milestoneLevel": 5, "perkKey": "spring_loaded_1", "name": "Rugós láb", "effectCopy": "becsült vertikál +3 cm" },
  { "skillKey": "aerobic_capacity", "milestoneLevel": 5, "perkKey": "big_lungs_1", "name": "Nagy tüdő", "effectCopy": "regeneráció két kör közt +5%" },
  { "skillKey": "sprint_speed", "milestoneLevel": 10, "perkKey": "afterburner_1", "name": "Utánégő", "effectCopy": "becsült csúcssebesség +4%" },
  { "skillKey": "robustness", "milestoneLevel": 10, "perkKey": "armor_plating_1", "name": "Páncélzat", "effectCopy": "10 hét töretlen — sérülésállóság nő" }
]
```

- [ ] **Step 4: Write the perk catalog loader (in-memory)**

```java
// PerkCatalog.java
package io.mrkuhne.mezo.feature.progression;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Static perk content (skillKey + milestone → perk title + estimated-effect copy), loaded at
 * startup from a classpath JSON. In-memory master content (no table, no created_by) — the
 * per-user unlocks live in the perk_unlock table. Invalid content fails startup fast.
 */
@Component
@RequiredArgsConstructor
public class PerkCatalog {

    /** One perk as authored in content/progression-perks.json. */
    public record PerkDef(String skillKey, int milestoneLevel, String perkKey, String name, String effectCopy) {}

    private final ObjectMapper objectMapper; // SB4 Jackson 3 (tools.jackson)
    private final Map<String, PerkDef> byKey = new HashMap<>();

    @jakarta.annotation.PostConstruct
    void load() {
        for (PerkDef p : readContent()) {
            validate(p);
            byKey.put(key(p.skillKey(), p.milestoneLevel()), p);
        }
    }

    /** The perk defined for a skill at a milestone level, if any. */
    public Optional<PerkDef> find(String skillKey, int milestoneLevel) {
        return Optional.ofNullable(byKey.get(key(skillKey, milestoneLevel)));
    }

    private static String key(String skillKey, int milestoneLevel) {
        return skillKey + "#" + milestoneLevel;
    }

    private List<PerkDef> readContent() {
        try (InputStream in = new ClassPathResource("content/progression-perks.json").getInputStream()) {
            return objectMapper.readValue(in,
                objectMapper.getTypeFactory().constructCollectionType(List.class, PerkDef.class));
        } catch (IOException e) {
            throw new IllegalStateException("content/progression-perks.json is unreadable", e);
        }
    }

    private void validate(PerkDef p) {
        boolean valid = p.skillKey() != null && !p.skillKey().isBlank()
            && p.perkKey() != null && !p.perkKey().isBlank()
            && p.name() != null && !p.name().isBlank()
            && p.effectCopy() != null && !p.effectCopy().isBlank()
            && p.milestoneLevel() >= 1;
        if (!valid) {
            throw new IllegalStateException("Invalid progression-perks item: " + p.perkKey());
        }
    }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=PerkCatalogIT`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the full backend suite (regression gate)**

Run: `cd backend && ./mvnw clean test`
Expected: PASS — all existing ITs still green (the new TRUNCATE entries + entities don't disturb them).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression/PerkCatalog.java backend/src/main/resources/content/progression-perks.json backend/src/test/java/io/mrkuhne/mezo/feature/progression/PerkCatalogIT.java
git commit -m "feat(progression): in-memory perk catalog (mezo-8e4)"
```

---

## P1 → P2 handoff

P1 leaves a tested foundation: the curve (`ProgressionCurve`), config (`ProgressionProperties`), three persisted aggregates with repos + populators, and the perk catalog. **No XP is granted yet.** P2 adds `ProgressionService.applyWorkout(...)` (idempotent on `(source_type, source_ref_id)` via `LevelUpEventRepository.findByCreatedByAndSourceTypeAndSourceRefId`), the GymSignal + the net-new e1RM/PR computation, the `mezo.feature.progression.enabled` switch (new `techcore/configuration/FeaturesConfiguration` — first switch in the repo), and wires `WorkoutService.finishWorkout` to attach `LevelUpResult` to the gym finish response.

## Self-review notes

- Spec coverage (P1 scope from spec §8): curve ✓(T1), config ✓(T1), 3 tables ✓(T2), entities/repos ✓(T3), ResetDatabase registration ✓(T4), populators ✓(T4), perk catalog ✓(T5). Triggers/HTTP correctly absent (P2+).
- Type consistency: `LevelUpResult` (+ nested `Gain`/`Perk`/`Robustness`) defined in T3, reused verbatim by T4 populator and T3 IT. `SkillProgressEntity` setters used identically in T3/T4. Repo method names match between definition (T3) and use (T3/T4 tests).
- Decisions locked: perk catalog is **in-memory** (not a 4th table) — simpler, still gives stable `perkKey`; `level_up_event` stores ALL XP grants (levelUps[] may be empty); `skill_progress` carries its own `updated_at` via `@UpdateTimestamp` (not from OwnedEntity).
