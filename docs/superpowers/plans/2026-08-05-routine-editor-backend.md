# Routine Editor Backend (mezo-n5e9.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The habit catalog moves from the static JSON loader into DB tables (`habit_chain` + `habit_def`) with a lazy per-user bootstrap and admin CRUD endpoints — behavior of the existing day/check/summary surface stays byte-identical for the seed catalog.

**Architecture:** Two new owned tables; `HabitCatalog` (JSON loader) is demoted to the validated **seed source**; a new `HabitCatalogService` bootstraps missing rows lazily on first read (the `ensureRows` race-guard idiom) and becomes the only catalog read path for `HabitService`/`HabitMapper`. Contract grows an admin surface (`GET /api/habit/catalog`, chain/def CRUD + reorder); `HabitResponse.chain` widens from enum to string (seed chains keep emitting exactly `MORNING`/`EVENING`, so the FE is behavior-unchanged).

**Tech Stack:** Spring Boot 4 / Java 21 / Maven, Liquibase (SQL changesets), JPA + `OwnedEntity` soft-delete idiom, contract-first OpenAPI (`api/feature/habit/habit.yml` → merge → generated `HabitApi` + `api.dto`), integration-first testing per `docs/references/testing_standards.md` + `integration_test_framework.md`.

**Spec:** `docs/superpowers/specs/2026-08-05-routine-editor-design.md` (§3 data model, §4 API, D1–D5) · **bd:** `mezo-n5e9.1` · **Branch:** `feat/routine-editor-backend`

## Global Constraints

- Work in this worktree (`…/.claude/worktrees/parallel-session-2`), branch `feat/routine-editor-backend`. Never switch branch, never touch the primary checkout.
- **NEVER run the full backend suite locally** (`./mvnw clean test` bare) — OOM. Focused per-task runs only; ALWAYS `clean`. Compose Postgres is already up on :15432.
- Focused gates: per-task commands are named in each task; final backend gate is `cd backend && ./mvnw clean test -Dtest='Habit*IT,ProgressionHabitIT,QuestApiIT' -DargLine=-Xmx3g`.
- **Key stability (spec D2):** `habit_day.habit_key` joins by key; built-in keys never change; seed `chain_key` values are exactly `MORNING` / `EVENING` (continuity with the retired enum). Custom keys are server-generated (`custom_`/`chain_` + 8 hex chars), never client-supplied.
- **Metric palette (spec D4):** custom DERIVED metrics must come from `HabitEvaluator`'s known set; no new metric types.
- Validation invariants (write-time, spec D5): title required ≤80, xp 5–15, mode ∈ {DERIVED, MANUAL}, MANUAL ⇔ `metric == "manual"`, `skillKind` fixed `LIFE`, chain must exist + belong to the user; seed chains are not deletable; a chain with live defs is not deletable.
- Errors via `SystemRuntimeErrorException` + `SystemMessage.error("<KEY>")` + `messages.properties` (the `IntentionService` precedent); never hardcoded user text.
- Contract-first: edit `api/feature/habit/habit.yml`, then `cd api/generate && npm run generate:api`, then FE types `cd frontend && pnpm generate:api`. Backend Java types regenerate inside `./mvnw`.
- Commits: conventional subject with the bd id `(mezo-n5e9.1)`; **explicit `git add <paths>` + `git commit --no-verify`**; never `git add -A`.
- After backend runs, check `git status` for an unexpectedly emptied `frozen archunit store` file — if `backend/archunit_store/*` shows as modified-to-empty, restore it (`git checkout -- backend/archunit_store`) and re-run; never commit an emptied store.
- Code/comments English; match surrounding idiom.

---

### Task 1: Tables + entities + repositories (+ ResetDatabase)

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608051400_mezo-n5e9.1_create_habit_chain.sql`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608051410_mezo-n5e9.1_create_habit_def.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append two changesets, same shape as the existing entries: `id: "1.0.0:<stem>"`, `author: daniel.kuhne`, `sqlFile` with `relativeToChangelogFile: true`)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/entity/HabitChainEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/entity/HabitDefEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/repository/HabitChainRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/repository/HabitDefRepository.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (add `habit_def`, `habit_chain` to the TRUNCATE list — growth rule in its doc comment)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitChainDefEntityIT.java`

**Interfaces:**
- Consumes: `OwnedEntity` base (created_by/is_deleted/created_at), the `HabitDayEntity` entity idiom (`@SQLDelete`/`@SQLRestriction`, `@Getter @Setter`).
- Produces: `HabitChainEntity` (fields `id: UUID`, `chainKey: String`, `title: String`, `daypart: String`, `position: Integer`, `active: Boolean` mapped to `is_active`; constants `DAYPART_MORNING/DAY/EVENING`), `HabitDefEntity` (fields `id: UUID`, `habitKey: String`, `chainId: UUID`, `position: Integer`, `title: String`, `why: String`, `anchorCopy: String`, `mode: String`, `metric: String`, `skillKey: String`, `skillKind: String`, `xp: Integer`, `linkUrl: String`, `active: Boolean`), `HabitChainRepository.findByCreatedByAndDeletedFalseOrderByPositionAsc(UUID)`, `findByIdAndCreatedByAndDeletedFalse(UUID, UUID)`, `findByCreatedByAndChainKeyAndDeletedFalse(UUID, String)`, `HabitDefRepository.findByCreatedByAndDeletedFalseOrderByPositionAsc(UUID)`, `findByIdAndCreatedByAndDeletedFalse(UUID, UUID)`, `findByCreatedByAndHabitKeyAndDeletedFalse(UUID, String)`, `findByChainIdAndDeletedFalse(UUID)`.

- [ ] **Step 1: Write the two migrations**

`202608051400_mezo-n5e9.1_create_habit_chain.sql`:

```sql
create table habit_chain (
    id uuid primary key default gen_random_uuid(),
    created_by uuid not null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    chain_key varchar(40) not null,
    title varchar(80) not null,
    daypart varchar(8) not null,
    position int not null,
    is_active boolean not null default true,
    constraint ck_habit_chain_daypart check (daypart in ('MORNING', 'DAY', 'EVENING')),
    constraint ck_habit_chain_position check (position >= 1)
);

create unique index uq_habit_chain_user_key
    on habit_chain (created_by, chain_key) where is_deleted = false;
create index idx_habit_chain_user on habit_chain (created_by);
```

`202608051410_mezo-n5e9.1_create_habit_def.sql`:

```sql
create table habit_def (
    id uuid primary key default gen_random_uuid(),
    created_by uuid not null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    habit_key varchar(40) not null,
    chain_id uuid not null,
    position int not null,
    title varchar(80) not null,
    why text,
    anchor_copy varchar(120),
    mode varchar(7) not null,
    metric varchar(40) not null,
    skill_key varchar(40) not null,
    skill_kind varchar(4) not null default 'LIFE',
    xp int not null,
    link_url text,
    is_active boolean not null default true,
    constraint fk_habit_def_chain foreign key (chain_id) references habit_chain (id),
    constraint ck_habit_def_mode check (mode in ('DERIVED', 'MANUAL')),
    constraint ck_habit_def_skill_kind check (skill_kind = 'LIFE'),
    constraint ck_habit_def_xp check (xp between 5 and 15),
    constraint ck_habit_def_position check (position >= 1)
);

create unique index uq_habit_def_user_key
    on habit_def (created_by, habit_key) where is_deleted = false;
create index idx_habit_def_user_chain on habit_def (created_by, chain_id);
```

- [ ] **Step 2: Write the entities + repositories**

`HabitChainEntity.java` (mirror `HabitDayEntity`'s idiom exactly — `OwnedEntity` base, `@SQLDelete`/`@SQLRestriction`):

```java
package io.mrkuhne.mezo.feature.habit.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** One routine chain (Reggeli/Esti + user-created). Its daypart anchors the Today face. */
@Getter
@Setter
@Entity
@Table(name = "habit_chain")
@SQLDelete(sql = "update habit_chain set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class HabitChainEntity extends OwnedEntity {

    public static final String DAYPART_MORNING = "MORNING";
    public static final String DAYPART_DAY = "DAY";
    public static final String DAYPART_EVENING = "EVENING";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "chain_key", nullable = false, length = 40)
    private String chainKey;

    @Column(nullable = false, length = 80)
    private String title;

    @Column(nullable = false, length = 8)
    private String daypart;

    @Column(nullable = false)
    private Integer position;

    @Column(name = "is_active", nullable = false)
    private Boolean active = true;
}
```

`HabitDefEntity.java`:

```java
package io.mrkuhne.mezo.feature.habit.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** One catalog habit (seed-imported or user-created). habit_day joins it by habit_key (D2). */
@Getter
@Setter
@Entity
@Table(name = "habit_def")
@SQLDelete(sql = "update habit_def set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class HabitDefEntity extends OwnedEntity {

    public static final String MODE_DERIVED = "DERIVED";
    public static final String MODE_MANUAL = "MANUAL";
    public static final String METRIC_MANUAL = "manual";
    public static final String SKILL_KIND_LIFE = "LIFE";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "habit_key", nullable = false, length = 40)
    private String habitKey;

    @Column(name = "chain_id", nullable = false, columnDefinition = "uuid")
    private UUID chainId;

    @Column(nullable = false)
    private Integer position;

    @Column(nullable = false, length = 80)
    private String title;

    @Column
    private String why;

    @Column(name = "anchor_copy", length = 120)
    private String anchorCopy;

    @Column(nullable = false, length = 7)
    private String mode;

    @Column(nullable = false, length = 40)
    private String metric;

    @Column(name = "skill_key", nullable = false, length = 40)
    private String skillKey;

    @Column(name = "skill_kind", nullable = false, length = 4)
    private String skillKind = SKILL_KIND_LIFE;

    @Column(nullable = false)
    private Integer xp;

    @Column(name = "link_url")
    private String linkUrl;

    @Column(name = "is_active", nullable = false)
    private Boolean active = true;
}
```

Repositories (derived queries only — `spring_patterns.md` ladder):

```java
package io.mrkuhne.mezo.feature.habit.repository;

import io.mrkuhne.mezo.feature.habit.entity.HabitChainEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitChainRepository extends JpaRepository<HabitChainEntity, UUID> {

    List<HabitChainEntity> findByCreatedByAndDeletedFalseOrderByPositionAsc(UUID createdBy);

    Optional<HabitChainEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<HabitChainEntity> findByCreatedByAndChainKeyAndDeletedFalse(UUID createdBy, String chainKey);
}
```

```java
package io.mrkuhne.mezo.feature.habit.repository;

import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitDefRepository extends JpaRepository<HabitDefEntity, UUID> {

    List<HabitDefEntity> findByCreatedByAndDeletedFalseOrderByPositionAsc(UUID createdBy);

    Optional<HabitDefEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<HabitDefEntity> findByCreatedByAndHabitKeyAndDeletedFalse(UUID createdBy, String habitKey);

    List<HabitDefEntity> findByChainIdAndDeletedFalse(UUID chainId);
}
```

NOTE for the implementer: `OwnedEntity` presumably exposes `createdBy`/`deleted` properties (the existing `HabitDayRepository` derives `…CreatedByAndDeletedFalse…` names from it — copy its exact property spelling if a derived name fails to boot).

- [ ] **Step 3: Add the two tables to `ResetDatabase`**

In the TRUNCATE list, add `habit_def, habit_chain` immediately after `habit_day` (CASCADE handles the FK; keeping the family adjacent matches the list's grouping style).

- [ ] **Step 4: Write the failing entity IT**

`HabitChainDefEntityIT.java` (the `HabitDayEntityIT` pattern — extends `AbstractIntegrationTest`):

```java
package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.habit.entity.HabitChainEntity;
import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitChainRepository;
import io.mrkuhne.mezo.feature.habit.repository.HabitDefRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class HabitChainDefEntityIT extends AbstractIntegrationTest {

    @Autowired private HabitChainRepository chainRepository;
    @Autowired private HabitDefRepository defRepository;
    @Autowired private UserPopulator userPopulator;

    private UUID owner() {
        return userPopulator.createUser("habit-chain@test.hu").getId();
    }

    @Test
    void testSave_shouldRoundTripChainAndDef_whenLinked() {
        UUID owner = owner();
        HabitChainEntity chain = new HabitChainEntity();
        chain.setCreatedBy(owner);
        chain.setChainKey("MORNING");
        chain.setTitle("Reggeli rutin");
        chain.setDaypart(HabitChainEntity.DAYPART_MORNING);
        chain.setPosition(1);
        chain = chainRepository.saveAndFlush(chain);

        HabitDefEntity def = new HabitDefEntity();
        def.setCreatedBy(owner);
        def.setHabitKey("morning_sunlight");
        def.setChainId(chain.getId());
        def.setPosition(2);
        def.setTitle("Reggeli napfény");
        def.setMode(HabitDefEntity.MODE_MANUAL);
        def.setMetric(HabitDefEntity.METRIC_MANUAL);
        def.setSkillKey("recovery");
        def.setXp(10);
        def = defRepository.saveAndFlush(def);

        assertThat(defRepository.findByCreatedByAndHabitKeyAndDeletedFalse(owner, "morning_sunlight"))
            .isPresent();
        assertThat(defRepository.findByChainIdAndDeletedFalse(chain.getId())).hasSize(1);
        assertThat(def.getSkillKind()).isEqualTo(HabitDefEntity.SKILL_KIND_LIFE);
        assertThat(def.getActive()).isTrue();
    }

    @Test
    void testDelete_shouldSoftDelete_whenRepositoryDelete() {
        UUID owner = owner();
        HabitChainEntity chain = new HabitChainEntity();
        chain.setCreatedBy(owner);
        chain.setChainKey("chain_ab12cd34");
        chain.setTitle("Munka előtti");
        chain.setDaypart(HabitChainEntity.DAYPART_DAY);
        chain.setPosition(3);
        chain = chainRepository.saveAndFlush(chain);

        chainRepository.delete(chain);
        chainRepository.flush();

        assertThat(chainRepository.findByCreatedByAndChainKeyAndDeletedFalse(owner, "chain_ab12cd34"))
            .isEmpty();
    }
}
```

- [ ] **Step 5: Run it — verify it fails** (tables/classes don't exist yet if you wrote the test first; otherwise it fails on missing migration)

Run: `cd backend && ./mvnw clean test -Dtest='HabitChainDefEntityIT' -DargLine=-Xmx3g`
Expected: FAIL before the migrations/entities are in place; PASS after. (If you authored migrations before the first run, the RED evidence is the compile failure on the missing entities — note which form you observed.)

- [ ] **Step 6: Make it pass, then guard the sibling suite**

Run: `cd backend && ./mvnw clean test -Dtest='HabitChainDefEntityIT,HabitDayEntityIT' -DargLine=-Xmx3g`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/resources/db/changelog/1.0.0/script/202608051400_mezo-n5e9.1_create_habit_chain.sql \
        backend/src/main/resources/db/changelog/1.0.0/script/202608051410_mezo-n5e9.1_create_habit_def.sql \
        backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml \
        backend/src/main/java/io/mrkuhne/mezo/feature/habit/entity/HabitChainEntity.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/habit/entity/HabitDefEntity.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/habit/repository/HabitChainRepository.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/habit/repository/HabitDefRepository.java \
        backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitChainDefEntityIT.java
git commit --no-verify -m "feat(habit): habit_chain + habit_def tables, entities, repositories (mezo-n5e9.1)"
```

---

### Task 2: HabitCatalogService — lazy bootstrap + catalog read path; rewire HabitService/HabitMapper

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitCatalogService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/HabitCatalog.java` (class javadoc only: it is now the SEED source, not the runtime catalog)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitService.java` (all 6 catalog call sites)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/mapper/HabitMapper.java` (`toResponse` takes `HabitDefEntity`)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/HabitPopulator.java` (reads defs via `HabitCatalogService` after ensuring the catalog)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitCatalogBootstrapIT.java`

**Interfaces:**
- Consumes: Task 1's entities/repositories; the JSON loader `HabitCatalog` (`all()`, record `HabitDef` with `key/chain/position/title/why/anchorCopy/mode/metric/skillKey/skillKind/xp/linkUrl`).
- Produces: `HabitCatalogService` with exactly:
  - `@Transactional public List<HabitDefEntity> ensureCatalog(UUID userId)` — bootstraps missing seed rows, returns **active defs of active chains**, ordered by chain position then def position;
  - `public Optional<HabitDefEntity> byKey(UUID userId, String key)`;
  - `public List<HabitDefEntity> activeForChainKey(UUID userId, String chainKey)` — active defs of that chain (empty when the chain is missing/inactive);
  - `public List<HabitChainEntity> chains(UUID userId)` — all live chains ordered by position (incl. inactive; the admin/catalog view needs them).
  - Seed chain constants: `SEED_CHAINS` = MORNING → („MORNING", „Reggeli rutin", daypart MORNING, position 1), EVENING → („EVENING", „Esti rutin", daypart EVENING, position 2).

- [ ] **Step 1: Write the failing bootstrap IT**

```java
package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitChainRepository;
import io.mrkuhne.mezo.feature.habit.service.HabitCatalogService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class HabitCatalogBootstrapIT extends AbstractIntegrationTest {

    @Autowired private HabitCatalogService catalogService;
    @Autowired private HabitChainRepository chainRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testEnsureCatalog_shouldImportSeed_whenUserHasNoRows() {
        UUID owner = userPopulator.createUser("habit-boot@test.hu").getId();

        List<HabitDefEntity> defs = catalogService.ensureCatalog(owner);

        assertThat(defs).hasSize(15); // the full seed catalog
        assertThat(chainRepository.findByCreatedByAndDeletedFalseOrderByPositionAsc(owner))
            .extracting("chainKey").containsExactly("MORNING", "EVENING");
        // Ordered chain-major: all 9 MORNING defs precede the 6 EVENING defs.
        assertThat(defs.subList(0, 9)).allMatch(d ->
            catalogService.activeForChainKey(owner, "MORNING").contains(d));
    }

    @Test
    void testEnsureCatalog_shouldBeIdempotent_whenCalledTwice() {
        UUID owner = userPopulator.createUser("habit-boot2@test.hu").getId();
        catalogService.ensureCatalog(owner);
        List<HabitDefEntity> second = catalogService.ensureCatalog(owner);
        assertThat(second).hasSize(15);
    }

    @Test
    void testEnsureCatalog_shouldReimportMissingDefOnly_whenOneWasNeverImported() {
        UUID owner = userPopulator.createUser("habit-boot3@test.hu").getId();
        List<HabitDefEntity> defs = catalogService.ensureCatalog(owner);
        // Soft-deleting a def keeps it deleted (user intent) — bootstrap must NOT resurrect it…
        HabitDefEntity gone = defs.get(0);
        // (delete via repository to engage @SQLDelete)
        // …so after a re-ensure the count drops by one and stays there.
        // Deleting through the service API arrives in Task 4; the repository is the seam here.
        assertThat(defs).hasSize(15);
    }

    @Test
    void testByKey_shouldFindSeedDef_afterBootstrap() {
        UUID owner = userPopulator.createUser("habit-boot4@test.hu").getId();
        catalogService.ensureCatalog(owner);
        assertThat(catalogService.byKey(owner, "morning_sunlight")).isPresent();
        assertThat(catalogService.byKey(owner, "nope")).isEmpty();
    }
}
```

Finish the third test honestly: inject `HabitDefRepository`, `defRepository.delete(gone); defRepository.flush();` then `assertThat(catalogService.ensureCatalog(owner)).hasSize(14);` — a soft-deleted seed def must NOT be resurrected (the partial-unique index ignores deleted rows, so the guard is an explicit live-key check against ALL live keys, not the index).

**Design note (spec D5/D2):** bootstrap inserts (a) each `SEED_CHAINS` entry whose `chain_key` has no LIVE row, (b) each JSON def whose `habit_key` has no row AT ALL for the user — live **or soft-deleted** (`existsByCreatedByAndHabitKey…` including deleted — use a small `@Query`/derived method that ignores the `@SQLRestriction` via a native query: `select count(*) from habit_def where created_by = ?1 and habit_key = ?2` — the entity-level restriction does not apply to native SQL). This is what makes a user's deletion of a built-in stick.
Race guard: wrap the insert batch in try/catch `DataIntegrityViolationException` → re-read (the `ensureRows` precedent).

- [ ] **Step 2: Run it — verify it fails** (`HabitCatalogService` doesn't exist)

Run: `cd backend && ./mvnw clean test -Dtest='HabitCatalogBootstrapIT' -DargLine=-Xmx3g`

- [ ] **Step 3: Implement `HabitCatalogService`**

```java
package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.feature.habit.HabitCatalog;
import io.mrkuhne.mezo.feature.habit.entity.HabitChainEntity;
import io.mrkuhne.mezo.feature.habit.entity.HabitDefEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitChainRepository;
import io.mrkuhne.mezo.feature.habit.repository.HabitDefRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The DB-backed habit catalog (mezo-n5e9.1). HabitCatalog (the JSON loader) is only the SEED
 * source now: the first read for a user lazily imports missing chains/defs (the ensureRows
 * race-guard idiom), then every runtime read is repository-backed. A def the user soft-deleted
 * is never resurrected — absence of a LIVE-or-DELETED row is what triggers a seed import.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitCatalogService {

    /** chainKey, title, daypart, position — continuity keys match the retired enum values. */
    private record SeedChain(String key, String title, String daypart, int position) {}

    private static final List<SeedChain> SEED_CHAINS = List.of(
        new SeedChain("MORNING", "Reggeli rutin", HabitChainEntity.DAYPART_MORNING, 1),
        new SeedChain("EVENING", "Esti rutin", HabitChainEntity.DAYPART_EVENING, 2));

    private final HabitChainRepository chainRepository;
    private final HabitDefRepository defRepository;
    private final HabitCatalog seedCatalog;

    @Transactional
    public List<HabitDefEntity> ensureCatalog(UUID userId) {
        try {
            bootstrapMissing(userId);
        } catch (DataIntegrityViolationException lostRace) {
            // A concurrent read imported the same seed rows first — theirs win, just re-read.
        }
        return activeOrdered(userId);
    }

    public Optional<HabitDefEntity> byKey(UUID userId, String key) {
        return defRepository.findByCreatedByAndHabitKeyAndDeletedFalse(userId, key);
    }

    public List<HabitDefEntity> activeForChainKey(UUID userId, String chainKey) {
        return chainRepository.findByCreatedByAndChainKeyAndDeletedFalse(userId, chainKey)
            .filter(c -> Boolean.TRUE.equals(c.getActive()))
            .map(c -> defRepository.findByChainIdAndDeletedFalse(c.getId()).stream()
                .filter(d -> Boolean.TRUE.equals(d.getActive()))
                .sorted(Comparator.comparing(HabitDefEntity::getPosition))
                .toList())
            .orElse(List.of());
    }

    public List<HabitChainEntity> chains(UUID userId) {
        return chainRepository.findByCreatedByAndDeletedFalseOrderByPositionAsc(userId);
    }

    private void bootstrapMissing(UUID userId) {
        Map<String, HabitChainEntity> byKey = chains(userId).stream()
            .collect(Collectors.toMap(HabitChainEntity::getChainKey, Function.identity()));
        for (SeedChain seed : SEED_CHAINS) {
            if (!byKey.containsKey(seed.key())) {
                HabitChainEntity c = new HabitChainEntity();
                c.setCreatedBy(userId);
                c.setChainKey(seed.key());
                c.setTitle(seed.title());
                c.setDaypart(seed.daypart());
                c.setPosition(seed.position());
                byKey.put(seed.key(), chainRepository.saveAndFlush(c));
            }
        }
        for (HabitCatalog.HabitDef def : seedCatalog.all()) {
            if (defRepository.countEverByCreatedByAndHabitKey(userId, def.key()) == 0) {
                HabitDefEntity e = new HabitDefEntity();
                e.setCreatedBy(userId);
                e.setHabitKey(def.key());
                e.setChainId(byKey.get(def.chain()).getId());
                e.setPosition(def.position());
                e.setTitle(def.title());
                e.setWhy(def.why());
                e.setAnchorCopy(def.anchorCopy());
                e.setMode(def.mode());
                e.setMetric(def.metric());
                e.setSkillKey(def.skillKey());
                e.setSkillKind(def.skillKind());
                e.setXp(def.xp());
                e.setLinkUrl(def.linkUrl());
                defRepository.save(e);
            }
        }
        defRepository.flush();
    }

    private List<HabitDefEntity> activeOrdered(UUID userId) {
        Map<UUID, HabitChainEntity> chainById = chains(userId).stream()
            .collect(Collectors.toMap(HabitChainEntity::getId, Function.identity()));
        return defRepository.findByCreatedByAndDeletedFalseOrderByPositionAsc(userId).stream()
            .filter(d -> Boolean.TRUE.equals(d.getActive()))
            .filter(d -> {
                HabitChainEntity c = chainById.get(d.getChainId());
                return c != null && Boolean.TRUE.equals(c.getActive());
            })
            .sorted(Comparator
                .comparing((HabitDefEntity d) -> chainById.get(d.getChainId()).getPosition())
                .thenComparing(HabitDefEntity::getPosition))
            .toList();
    }
}
```

Add to `HabitDefRepository` the deleted-inclusive existence probe (native — the `@SQLRestriction` does not apply to native SQL):

```java
@org.springframework.data.jpa.repository.Query(value =
    "select count(*) from habit_def where created_by = :userId and habit_key = :habitKey",
    nativeQuery = true)
long countEverByCreatedByAndHabitKey(@org.springframework.data.repository.query.Param("userId") UUID userId,
    @org.springframework.data.repository.query.Param("habitKey") String habitKey);
```

(Move the imports to the top of the file in real code.)

- [ ] **Step 4: Rewire `HabitService` + `HabitMapper` + `HabitPopulator`**

- `HabitService`: inject `HabitCatalogService catalogService` (drop the `HabitCatalog catalog` field). Replace:
  - `getDay` L75 + `ensureRows` L229: `catalog.all()` → `catalogService.ensureCatalog(userId)`
  - `requireDef` L273: `catalog.byKey(key)` → `catalogService.byKey(userId, key)` (pass `userId` through — `check`/`uncheck` already have it)
  - `closePast` L158 + `evaluateIntraday` L198: `catalog.byKey(row.getHabitKey())` → `catalogService.byKey(userId, row.getHabitKey())`
  - `summary`/`perfectDays` L138/264: `catalog.forChain(HabitCatalog.CHAIN_MORNING)` → `catalogService.activeForChainKey(userId, "MORNING")` (same for EVENING); the strengths list iterates `catalogService.ensureCatalog(userId)`.
  - Everywhere a `HabitCatalog.HabitDef` local was used, the type becomes `HabitDefEntity` (accessors: `def.key()` → `def.getHabitKey()`, `def.mode()` → `def.getMode()`, `def.metric()` → `def.getMetric()`, `def.xp()` → `def.getXp()`).
- `HabitMapper.toResponse(HabitCatalog.HabitDef def, …)` → `toResponse(HabitDefEntity def, HabitDayEntity row, Integer strengthPct)`; field reads become getters (`def.getHabitKey()`, `def.getChainId()` is NOT what the response needs — the response's `chain` field gets the CHAIN KEY, so `toResponse` gains a `String chainKey` parameter supplied by `HabitService` from its chain map, OR simpler: pass the whole `HabitChainEntity`; pick the `String chainKey` parameter — smallest surface). `HabitResponse.chain` still receives `HabitResponse.ChainEnum.fromValue(chainKey)` in this task (the enum widens only in Task 3 — keep compiling against the current generated type).
- `HabitPopulator`: it called `catalog.all()`; now `catalogService.ensureCatalog(owner)` first, then read via the service. Keep its public method signatures unchanged so its callers don't move.

- [ ] **Step 5: Run the full focused habit gate — the regression proof of the rewiring**

Run: `cd backend && ./mvnw clean test -Dtest='Habit*IT,ProgressionHabitIT,QuestApiIT' -DargLine=-Xmx3g`
Expected: ALL PASS, including the untouched `HabitApiIT` (day still has 15 habits for a fresh owner), `HabitServiceIT`, `HabitJobIT`, `HabitCatalogIT` (still asserts the JSON loader), and the new `HabitCatalogBootstrapIT`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitCatalogService.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/habit/HabitCatalog.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitService.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/habit/mapper/HabitMapper.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/habit/repository/HabitDefRepository.java \
        backend/src/test/java/io/mrkuhne/mezo/support/populator/HabitPopulator.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitCatalogBootstrapIT.java
git commit --no-verify -m "feat(habit): DB-backed catalog service with lazy seed bootstrap (mezo-n5e9.1)"
```

---

### Task 3: Contract — admin surface + chain widening + regeneration (both sides)

**Files:**
- Modify: `api/feature/habit/habit.yml`
- Modify: `api/openapi.yml` (generated by the merge — commit the regenerated file)
- Modify: `frontend/src/data/_client/api.gen.ts` (generated — commit)
- Possibly modify: nothing else on the FE — `habitApi.ts:20` already casts `w.chain as HabitChain`, which stays valid when the generated type widens to `string`.

**Interfaces:**
- Produces (generated): `HabitApi` grows `getHabitCatalog`, `createHabitChain`, `updateHabitChain`, `deleteHabitChain`, `reorderHabitChain`, `createHabitDef`, `updateHabitDef`, `deleteHabitDef`; new `api.dto` models `HabitCatalogResponse`, `HabitChainAdmin`, `HabitDefAdmin`, `HabitChainCreateRequest`, `HabitChainUpdateRequest`, `HabitDefCreateRequest`, `HabitDefUpdateRequest`, `HabitReorderRequest`. `HabitResponse.chain` becomes `type: string` (no enum).

- [ ] **Step 1: Edit `api/feature/habit/habit.yml`**

(a) In `HabitResponse`, change `chain: { type: string, enum: [MORNING, EVENING] }` → `chain: { type: string, description: "Chain key (seed chains: MORNING / EVENING)" }`. Leave `mode`/`status` enums untouched.

(b) Append the admin paths (tag `Habit` throughout):

```yaml
  /api/habit/catalog:
    get:
      tags: [Habit]
      operationId: getHabitCatalog
      summary: Full catalog for the editor — chains with their defs, inactive included
      responses:
        "200":
          description: The catalog
          content:
            application/json:
              schema: { $ref: "#/components/schemas/HabitCatalogResponse" }
  /api/habit/chain:
    post:
      tags: [Habit]
      operationId: createHabitChain
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/HabitChainCreateRequest" }
      responses:
        "200":
          description: The created chain
          content:
            application/json:
              schema: { $ref: "#/components/schemas/HabitChainAdmin" }
  /api/habit/chain/{id}:
    patch:
      tags: [Habit]
      operationId: updateHabitChain
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/HabitChainUpdateRequest" }
      responses:
        "200":
          description: The updated chain
          content:
            application/json:
              schema: { $ref: "#/components/schemas/HabitChainAdmin" }
    delete:
      tags: [Habit]
      operationId: deleteHabitChain
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        "204": { description: Soft-deleted }
  /api/habit/chain/{id}/order:
    put:
      tags: [Habit]
      operationId: reorderHabitChain
      summary: Full-order replacement of the chain's def positions
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/HabitReorderRequest" }
      responses:
        "200":
          description: The chain with defs in the new order
          content:
            application/json:
              schema: { $ref: "#/components/schemas/HabitChainAdmin" }
  /api/habit/def:
    post:
      tags: [Habit]
      operationId: createHabitDef
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/HabitDefCreateRequest" }
      responses:
        "200":
          description: The created def
          content:
            application/json:
              schema: { $ref: "#/components/schemas/HabitDefAdmin" }
  /api/habit/def/{id}:
    patch:
      tags: [Habit]
      operationId: updateHabitDef
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/HabitDefUpdateRequest" }
      responses:
        "200":
          description: The updated def
          content:
            application/json:
              schema: { $ref: "#/components/schemas/HabitDefAdmin" }
    delete:
      tags: [Habit]
      operationId: deleteHabitDef
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        "204": { description: Soft-deleted }
```

(c) Append the schemas:

```yaml
    HabitChainAdmin:
      type: object
      required: [id, chainKey, title, daypart, position, isActive, defs]
      properties:
        id: { type: string, format: uuid }
        chainKey: { type: string }
        title: { type: string }
        daypart: { type: string, enum: [MORNING, DAY, EVENING] }
        position: { type: integer }
        isActive: { type: boolean }
        defs:
          type: array
          items: { $ref: "#/components/schemas/HabitDefAdmin" }
    HabitDefAdmin:
      type: object
      required: [id, habitKey, chainKey, position, title, mode, metric, skillKey, xp, isActive]
      properties:
        id: { type: string, format: uuid }
        habitKey: { type: string }
        chainKey: { type: string }
        position: { type: integer }
        title: { type: string }
        why: { type: string, nullable: true }
        anchorCopy: { type: string, nullable: true }
        mode: { type: string, enum: [DERIVED, MANUAL] }
        metric: { type: string }
        skillKey: { type: string }
        xp: { type: integer }
        linkUrl: { type: string, nullable: true }
        isActive: { type: boolean }
    HabitCatalogResponse:
      type: object
      required: [chains]
      properties:
        chains:
          type: array
          items: { $ref: "#/components/schemas/HabitChainAdmin" }
    HabitChainCreateRequest:
      type: object
      required: [title, daypart]
      properties:
        title: { type: string, minLength: 1, maxLength: 80 }
        daypart: { type: string, enum: [MORNING, DAY, EVENING] }
    HabitChainUpdateRequest:
      type: object
      properties:
        title: { type: string, minLength: 1, maxLength: 80 }
        daypart: { type: string, enum: [MORNING, DAY, EVENING] }
        position: { type: integer, minimum: 1 }
        isActive: { type: boolean }
    HabitDefCreateRequest:
      type: object
      required: [chainKey, title, mode, skillKey, xp]
      properties:
        chainKey: { type: string }
        title: { type: string, minLength: 1, maxLength: 80 }
        why: { type: string, nullable: true }
        anchorCopy: { type: string, nullable: true, maxLength: 120 }
        mode: { type: string, enum: [DERIVED, MANUAL] }
        metric: { type: string, description: "Required for DERIVED; ignored for MANUAL (forced to \"manual\")" }
        skillKey: { type: string }
        xp: { type: integer, minimum: 5, maximum: 15 }
        linkUrl: { type: string, nullable: true }
        position: { type: integer, minimum: 1, description: "Defaults to end of chain" }
    HabitDefUpdateRequest:
      type: object
      properties:
        title: { type: string, minLength: 1, maxLength: 80 }
        why: { type: string, nullable: true }
        anchorCopy: { type: string, nullable: true, maxLength: 120 }
        chainKey: { type: string }
        position: { type: integer, minimum: 1 }
        xp: { type: integer, minimum: 5, maximum: 15 }
        linkUrl: { type: string, nullable: true }
        isActive: { type: boolean }
    HabitReorderRequest:
      type: object
      required: [defIds]
      properties:
        defIds:
          type: array
          items: { type: string, format: uuid }
```

- [ ] **Step 2: Merge + regenerate both sides**

Run: `cd api/generate && npm run generate:api`
Run: `cd frontend && pnpm generate:api`
After the regen, `HabitMapper`'s Task-2-era line `HabitResponse.ChainEnum.fromValue(chainKey)` no longer compiles (the enum is gone — `chain` is a plain `String` now): change it to set `chainKey` directly. Then:
Run: `cd backend && ./mvnw clean compile -q` — proves the generated `HabitApi` compiles; `HabitController` will now FAIL to compile (it implements `HabitApi` but lacks the new methods). That failure is expected and is Task 4's RED — to keep Task 3 committable, add the eight `@Override` stubs to `HabitController` each throwing `new UnsupportedOperationException("mezo-n5e9.1 Task 4")`? **NO — do not commit stubs.** Instead Task 3 and Task 4's first step land in ONE commit boundary: finish Step 3 below, then continue straight into Task 4 and commit them together per Task 4's commit step. (Task 3 has no standalone commit — this is deliberate: the repo must never hold a red-compiling commit.)

- [ ] **Step 3: FE gate (type-widen must be behavior-neutral)**

Run: `cd frontend && pnpm build && pnpm test src/data/habit && VITE_USE_MOCK=true pnpm test src/data/habit`
Expected: green with ZERO frontend source changes (`habitApi.ts:20`'s `as HabitChain` cast absorbs the widened generated type). If the build breaks on the generated types, fix ONLY by adjusting the yml (e.g. missing `required`) and regenerating — never hand-edit `api.gen.ts`.

---

### Task 4: Admin CRUD — service + validation + controller + messages + API ITs

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitAdminService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/controller/HabitController.java` (implement the 8 new `HabitApi` methods — one-liner delegations, the house pattern)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/mapper/HabitMapper.java` (add `toChainAdmin(HabitChainEntity, List<HabitDefAdmin>)` + `toDefAdmin(HabitDefEntity, String chainKey)`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitEvaluator.java` (add `public static final Set<String> SUPPORTED_METRICS` = union of `INTRADAY_METRICS` + `END_OF_DAY_METRICS` + `METRIC_BED_NEXT_DAY`)
- Modify: `backend/src/main/resources/messages.properties` (new keys, after line 33)
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/HabitChainPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitAdminApiIT.java`

**Interfaces:**
- Consumes: Task 2's `HabitCatalogService` (`ensureCatalog`, `chains`, `byKey`), Task 1's repositories, Task 3's generated `api.dto` request/response models.
- Produces: `HabitAdminService` with `catalog(UUID)`, `createChain(UUID, HabitChainCreateRequest)`, `updateChain(UUID, UUID, HabitChainUpdateRequest)`, `deleteChain(UUID, UUID)`, `reorder(UUID, UUID, HabitReorderRequest)`, `createDef(UUID, HabitDefCreateRequest)`, `updateDef(UUID, UUID, HabitDefUpdateRequest)`, `deleteDef(UUID, UUID)`.

**Validation + message keys** (append to `messages.properties`):

```properties
HABIT_CHAIN_UNKNOWN=Unknown routine chain.
HABIT_CHAIN_NOT_EMPTY=The chain still has habits; move or delete them first.
HABIT_CHAIN_SEED=The built-in morning/evening chains cannot be deleted.
HABIT_DEF_UNKNOWN_CHAIN=The referenced chain does not exist.
HABIT_METRIC_UNKNOWN=Unknown habit metric.
HABIT_MODE_METRIC_MISMATCH=MANUAL habits use the "manual" metric; DERIVED habits need a real metric.
HABIT_REORDER_MISMATCH=The reorder list must contain exactly the chain's habits.
```

Rules (all thrown as `SystemRuntimeErrorException(SystemMessage.error("<KEY>").build(), <status>)` — the `IntentionService` precedent):
- `updateChain`/`deleteChain`/`reorder` on an id that isn't the user's live chain → 404 `HABIT_CHAIN_UNKNOWN`; `updateDef`/`deleteDef` similarly → 404 `HABIT_UNKNOWN` (reuse the existing key).
- `deleteChain` on `chainKey` MORNING/EVENING → 409 `HABIT_CHAIN_SEED`; on a chain with live defs → 409 `HABIT_CHAIN_NOT_EMPTY`.
- `createDef` with unknown `chainKey` → 400 `HABIT_DEF_UNKNOWN_CHAIN`; DERIVED with `metric` missing or ∉ `HabitEvaluator.SUPPORTED_METRICS` or `== "manual"` → 400 `HABIT_METRIC_UNKNOWN`; MANUAL always stores `metric = "manual"` (any client value ignored). `HABIT_MODE_METRIC_MISMATCH` guards a DERIVED create whose metric is `"manual"`.
- `reorder` whose `defIds` is not a permutation of the chain's live def ids → 400 `HABIT_REORDER_MISMATCH`; on success positions become 1..n in list order.
- Key generation: `"custom_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8)` for defs, `"chain_" + …` for chains.
- `createChain` position = `chains(userId).size() + 1`; `createDef` default position = live defs of that chain + 1.
- Length/range checks (`title` ≤80 required, `xp` 5..15) arrive via the contract's bean validation (`@Valid` on generated models) — do not duplicate them in the service; the entity CKs are the last line.
- `catalog(UUID)` first calls `catalogService.ensureCatalog(userId)` (bootstrap), then maps ALL live chains + ALL live defs (inactive included — the editor needs them), chains ordered by position, defs by position.

- [ ] **Step 1: Write the failing API IT**

`HabitAdminApiIT extends ApiIntegrationTest` — cover, with the existing verb helpers + `ownerAuthHeaders()` + `assertHasRequestError`:

```java
package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.HabitCatalogResponse;
import io.mrkuhne.mezo.api.dto.HabitChainAdmin;
import io.mrkuhne.mezo.api.dto.HabitChainCreateRequest;
import io.mrkuhne.mezo.api.dto.HabitChainUpdateRequest;
import io.mrkuhne.mezo.api.dto.HabitDefAdmin;
import io.mrkuhne.mezo.api.dto.HabitDefCreateRequest;
import io.mrkuhne.mezo.api.dto.HabitDefUpdateRequest;
import io.mrkuhne.mezo.api.dto.HabitReorderRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class HabitAdminApiIT extends ApiIntegrationTest {

    private HabitCatalogResponse catalog() {
        return getForBody("/api/habit/catalog", ownerAuthHeaders(), HttpStatus.OK, HabitCatalogResponse.class);
    }

    @Test
    void testGetCatalog_shouldBootstrapSeed_whenFirstCall() {
        HabitCatalogResponse cat = catalog();
        assertThat(cat.getChains()).extracting(HabitChainAdmin::getChainKey)
            .containsExactly("MORNING", "EVENING");
        assertThat(cat.getChains().get(0).getDefs()).hasSize(9);
        assertThat(cat.getChains().get(1).getDefs()).hasSize(6);
    }

    @Test
    void testCreateChain_shouldAppend_withGeneratedKeyAndDaypart() {
        HabitChainAdmin created = postForBody("/api/habit/chain",
            HabitChainCreateRequest.builder().title("Munka előtti").daypart(HabitChainCreateRequest.DaypartEnum.DAY).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitChainAdmin.class);
        assertThat(created.getChainKey()).startsWith("chain_");
        assertThat(created.getPosition()).isEqualTo(3);
    }

    @Test
    void testCreateDef_shouldRejectUnknownMetric_whenDerived() {
        catalog();
        String err = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Hidegzuhany")
                .mode(HabitDefCreateRequest.ModeEnum.DERIVED).metric("cold_shower_logged")
                .skillKey("recovery").xp(10).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_METRIC_UNKNOWN");
    }

    @Test
    void testCreateDef_shouldCreateManual_forcingManualMetric() {
        catalog();
        HabitDefAdmin created = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Hidegzuhany")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("recovery").xp(10).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);
        assertThat(created.getHabitKey()).startsWith("custom_");
        assertThat(created.getMetric()).isEqualTo("manual");
        assertThat(created.getPosition()).isEqualTo(10); // after the 9 seed MORNING defs
    }

    @Test
    void testUpdateDef_shouldToggleInactive_andDayViewShrinks() {
        HabitCatalogResponse cat = catalog();
        HabitDefAdmin sunlight = cat.getChains().get(0).getDefs().stream()
            .filter(d -> d.getHabitKey().equals("morning_sunlight")).findFirst().orElseThrow();
        patchForBody("/api/habit/def/" + sunlight.getId(),
            HabitDefUpdateRequest.builder().isActive(false).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDefAdmin.class);
        var day = getForBody("/api/habit/day/" + java.time.LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, io.mrkuhne.mezo.api.dto.HabitDayResponse.class);
        assertThat(day.getHabits()).extracting("key").doesNotContain("morning_sunlight");
    }

    @Test
    void testDeleteChain_shouldRejectSeed_and_NonEmpty() {
        HabitCatalogResponse cat = catalog();
        String morningId = cat.getChains().get(0).getId().toString();
        String err = deleteAndExpect("/api/habit/chain/" + morningId, ownerAuthHeaders(), HttpStatus.CONFLICT);
        assertHasRequestError(err, "HABIT_CHAIN_SEED");
    }

    @Test
    void testDeleteChain_shouldSoftDelete_whenCustomAndEmpty() {
        HabitChainAdmin created = postForBody("/api/habit/chain",
            HabitChainCreateRequest.builder().title("Ürítendő").daypart(HabitChainCreateRequest.DaypartEnum.DAY).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitChainAdmin.class);
        deleteAndExpect("/api/habit/chain/" + created.getId(), ownerAuthHeaders(), HttpStatus.NO_CONTENT);
        assertThat(catalog().getChains()).extracting(HabitChainAdmin::getChainKey)
            .doesNotContain(created.getChainKey());
    }

    @Test
    void testReorder_shouldRewritePositions_andRejectPartialList() {
        HabitCatalogResponse cat = catalog();
        HabitChainAdmin evening = cat.getChains().get(1);
        List<UUID> reversed = evening.getDefs().stream().map(HabitDefAdmin::getId).toList().reversed();
        HabitChainAdmin after = putForBody("/api/habit/chain/" + evening.getId() + "/order",
            HabitReorderRequest.builder().defIds(reversed).build(),
            ownerAuthHeaders(), HttpStatus.OK, HabitChainAdmin.class);
        assertThat(after.getDefs().get(0).getId()).isEqualTo(reversed.get(0));

        String err = putForBody("/api/habit/chain/" + evening.getId() + "/order",
            HabitReorderRequest.builder().defIds(reversed.subList(0, 2)).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_REORDER_MISMATCH");
    }

    @Test
    void testChainUnknown_should404_onForeignId() {
        String err = patchForBody("/api/habit/chain/" + UUID.randomUUID(),
            HabitChainUpdateRequest.builder().title("X").build(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(err, "HABIT_CHAIN_UNKNOWN");
    }
}
```

Adjust helper-method names/signatures to `ApiIntegrationTest`'s actual ones (`deleteAndExpect` returning body vs status-only — mirror how `HabitApiIT` and other admin-ish ITs call them; if `deleteAndExpect` returns void, fetch the error body with `exchangeForBody`). If the generated request builders differ (e.g. enum inner-class names), follow the generated code.

- [ ] **Step 2: Run it — verify it fails** (controller methods missing → compile fails; that is Task 3+4's shared RED)

Run: `cd backend && ./mvnw clean test -Dtest='HabitAdminApiIT' -DargLine=-Xmx3g`

- [ ] **Step 3: Implement `HabitAdminService` + controller delegations + mapper additions + `SUPPORTED_METRICS`**

Controller: 8 one-liner `@Override`s delegating to `HabitAdminService` with `currentUserId.get()` (the existing 4 methods' pattern; `delete*` return `ResponseEntity.noContent().build()`).

`HabitAdminService` skeleton (constructor-injected `HabitCatalogService`, `HabitChainRepository`, `HabitDefRepository`, `HabitMapper`; `@Transactional` method-level; `@ConditionalOnProperty(HABIT_SWITCH)`):
- `catalog`: `catalogService.ensureCatalog(userId)` then map `catalogService.chains(userId)` + per-chain `defRepository.findByChainIdAndDeletedFalse(...)` sorted by position → `HabitCatalogResponse`.
- `createChain`: build entity (generated key, title, daypart from request enum's `.getValue()`, position = live count + 1), save, map.
- `updateChain`: load via `findByIdAndCreatedByAndDeletedFalse` orElseThrow 404 `HABIT_CHAIN_UNKNOWN`; apply non-null request fields; save; map.
- `deleteChain`: load (404); seed-key guard (409 `HABIT_CHAIN_SEED` for `MORNING`/`EVENING`); live-defs guard (409 `HABIT_CHAIN_NOT_EMPTY`); `chainRepository.delete(chain)` (soft via `@SQLDelete`).
- `reorder`: load chain (404); live defs; permutation check (`new HashSet<>(request.getDefIds())` equals live-id set AND same size) else 400; write positions 1..n in list order; return mapped chain.
- `createDef`: resolve chain by `chainKey` (400 `HABIT_DEF_UNKNOWN_CHAIN`); mode/metric rules as specified; build + save; map.
- `updateDef`: load def (404 `HABIT_UNKNOWN`); if `chainKey` present resolve target chain (400 `HABIT_DEF_UNKNOWN_CHAIN`) and reassign `chainId` + position to end of the target chain unless `position` was also sent; apply other non-null fields; save; map.
- `deleteDef`: load (404); `defRepository.delete(def)`.

- [ ] **Step 4: Run the admin IT green, then the full focused gate**

Run: `cd backend && ./mvnw clean test -Dtest='HabitAdminApiIT' -DargLine=-Xmx3g`
Run: `cd backend && ./mvnw clean test -Dtest='Habit*IT,ProgressionHabitIT,QuestApiIT' -DargLine=-Xmx3g`
Expected: ALL PASS.

- [ ] **Step 5: Commit (Tasks 3+4 together — the contract and its implementation)**

```bash
git add api/feature/habit/habit.yml api/openapi.yml \
        frontend/src/data/_client/api.gen.ts \
        backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitAdminService.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitEvaluator.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/habit/controller/HabitController.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/habit/mapper/HabitMapper.java \
        backend/src/main/resources/messages.properties \
        backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitAdminApiIT.java
git commit --no-verify -m "feat(habit): admin catalog contract + CRUD API — chains, defs, reorder (mezo-n5e9.1)"
```

(If a `HabitChainPopulator` proved unnecessary because the API ITs bootstrap through `/api/habit/catalog`, do NOT create it — YAGNI; note that in your report.)

---

### Task 5: ADR + living docs

**Files:**
- Create: `docs/decisions/0019-user-editable-habit-catalog-propose-only-ai.md`
- Modify: `docs/features/habit.md` (§3 architecture flow, §4 data model & API, §7 how-to-extend, §10 key files)

**Steps:**

- [ ] **Step 1: Write ADR 0019** — title "User-editable habit catalog in DB; AI suggestions are propose-only". Context: v1 shipped a fixed JSON catalog (ADR-less, spec D1/D2 of the 2026-07-19 habit spec); the routine editor needs user edits. Decision: (a) full DB catalog (`habit_chain`+`habit_def`), JSON demoted to seed, lazy per-user bootstrap, keys stable, soft-deleted seed defs never resurrected; (b) the AI suggester (upcoming `.3`) never writes — strict-JSON proposals accepted through the normal create endpoint. Consequences: loader invariants become write-time validation; `HabitResponse.chain` is a string key; custom chains carry a `daypart` that will drive Today-face bucketing in `.2`. Follow the existing ADR file format (check `docs/decisions/0018-*.md` for the header shape).
- [ ] **Step 2: Update `docs/features/habit.md`**: §3 flow diagram line `HabitController → HabitService` gains `HabitCatalogService → habit_chain/habit_def (lazy seed bootstrap)`; §4 documents the two tables + the 8 admin endpoints table; §7 "Add a habit" now says: through the editor API (or seed JSON for new BUILT-IN defaults — new JSON entries appear for users who never had that key); §10 lists the new files. Overwrite in place, keep voice, link ADR 0019 + the routine-editor spec.
- [ ] **Step 3: Lint**: `node scripts/lint-docs.mjs` — habit.md must be clean (its key_files got later commits than the doc; committing the doc last clears it).
- [ ] **Step 4: Commit**

```bash
git add docs/decisions/0019-user-editable-habit-catalog-propose-only-ai.md docs/features/habit.md
git commit --no-verify -m "docs(habit): ADR 0019 + living doc for the DB-backed catalog (mezo-n5e9.1)"
```

---

### Task 6: Ship (maintainer/main-loop task — NOT for a subagent)

- [ ] Re-run the final backend focused gate + FE both modes + build on the final tree
- [ ] `git fetch origin` — if origin/main moved, `git merge origin/main` (union `.beads/issues.jsonl` via `bd import` + re-export if it conflicts)
- [ ] Push branch, `gh pr create`, verify MERGEABLE, wait CI, read `gh pr checks` table
- [ ] Worktree-safe merge: `git checkout -b tmp origin/main && git merge --no-ff --no-verify feat/routine-editor-backend && git push origin tmp:main`, verify bd ids + memories on main, `bd close mezo-n5e9.1` + export commit, delete branches, back to detached origin/main
