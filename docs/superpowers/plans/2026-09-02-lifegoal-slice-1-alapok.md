# Életcél-rendszer · 1. szelet (Alapok) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `lifegoal` slice foundations — three tables, the contract, CRUD + status lifecycle, the closed signal catalog with pillar validation, the AI `propose` (LLM adapter + template fallback), demo seed, and the three Mozaik pages (Célok hub, cél-oldal, 5-step wizard) in both FE modes — so a user can create, activate, park and edit a life goal end to end. Scoring, the nightly job and the embeddings are slices 2–3.

**Architecture:** New backend slice `io.mrkuhne.mezo.feature.lifegoal` (entity/repository/service/mapper/controller/config/catalog), gated by `mezo.feature.lifegoal.enabled`. The AI proposal port lives in **companion** (`LifeGoalProposePort`) and is implemented there by `LifeGoalProposeLlmAdapter`; `lifegoal` consumes it via `ObjectProvider` and falls back to a rule-based template. Dependency direction is **lifegoal → companion, progression** only (never the reverse), so slice 2 can add `MetricSeriesService` reads without an ArchUnit cycle. FE: `data/lifegoal/*` dual-mode hooks + three `*Page`s under `/me/goals`, the weight goal moves to `/me/goals/weight`.

**Tech Stack:** Spring Boot 4 / JPA / Liquibase / Postgres jsonb · openapi-generator (contract-first, `api/feature/lifegoal/lifegoal.yml`) · React 19 + TanStack Query + `useDualQuery` + MSW · Vitest · JUnit 5 + AssertJ + Testcontainers.

**Spec:** `docs/superpowers/specs/2026-09-02-lifegoal-system-design.md` · **bd:** mezo-iizd (file a child `mezo-iizd.1` "Slice 1 · Alapok" before Task 1 and put its id in every commit subject).

## Global Constraints

- Branch: `feat/lifegoal-alapok` from `main`; self-PR → CI green → local `--no-ff` merge (CLAUDE.md flow). Commit subjects: `feat(lifegoal): … (mezo-iizd.1)`.
- Read `docs/references/{java_package_structure,spring_patterns,liquibase_conventions,api_contract_conventions,testing_standards,integration_test_framework,frontend_conventions}.md` before touching the matching layer. Non-negotiables repeated here: controllers `implements <Tag>Api`; `@Transactional` method-level only; no `@Value` (use `@ConfigurationProperties` records); no raw `RuntimeException` (`SystemRuntimeErrorException` + `SystemMessage`); entities in `..entity..`, services in `..service..`, repositories in `..repository..`; Liquibase file `<yyyymmddHHMM>_<bd-id>_<desc>.sql` registered in `1.0.0_master.yml`, constraint prefixes `pk_/fk_/ck_/uq_/idx_`, no seed SQL.
- Backend focused tests: `cd backend && ./mvnw -q test -Dtest='LifeGoal*' -Dmezo.test.use-testcontainers=true -Dsurefire.failIfNoSpecifiedTests=false`. ArchUnit runs only in the full `./mvnw test` — run it once at the end of the slice (Task 12).
- FE gate: `cd frontend && pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test` (an UNSET `VITE_USE_MOCK` means mock — always set it explicitly). Every feature imports hooks from `@/data/hooks` only; no relative imports; tests colocated.
- Contract drift gate: after any change to `api/feature/lifegoal/lifegoal.yml` run `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api` and commit `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts`.
- Hungarian UI copy verbatim from the spec/prototype: dimensions **Érzelem · Elmélyülés · Kapcsolatok · Értelem · Teljesítmény · Egészség**; statuses **tervezett · aktív · parkol · kész · archivált**; pillar kinds **szokás · átlag · cél-érték · baseline · kapcsolt**.
- Honesty rules: `no_data` is never a `miss`; nothing numeric is fabricated in real mode (`useDualQuery` `realEmpty`, never the mock seed).
- Docs: `docs/features/lifegoal.md` (10-section template, `key_files` frontmatter) written in Task 12; `node scripts/gen-codemap.mjs` regenerated and `node scripts/lint-docs.mjs` clean in the same change.

---

## File structure (the whole slice)

**Backend (`backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/`)**
- `entity/LifeGoalEntity.java`, `entity/LifeGoalPillarEntity.java`, `entity/LifeGoalPillarDayEntity.java` — JPA rows (pillar_day is created now, written by slice 2)
- `entity/IfThenPlanJson.java`, `entity/PlanTriggerJson.java`, `entity/PillarSourceJson.java`, `entity/PillarRuleJson.java` — typed jsonb records
- `repository/LifeGoalRepository.java`, `repository/LifeGoalPillarRepository.java`, `repository/LifeGoalPillarDayRepository.java`
- `catalog/SignalCatalog.java`, `catalog/SignalCatalogEntry.java` — the closed source catalog (validation + prompt text + `/signals`)
- `service/LifeGoalService.java` (CRUD + status), `service/LifeGoalPillarService.java` (pillar replace + validation), `service/LifeGoalProposeService.java` (port + fallback), `service/LifeGoalTemplateProposer.java`
- `mapper/LifeGoalMapper.java`, `controller/LifeGoalController.java`, `config/LifeGoalProperties.java`, `LifeGoalSeedData.java`
- `techcore/configuration/FeaturesConfiguration.java` — `LIFEGOAL_SWITCH`, `LIFEGOAL_AI_PROPOSE_SWITCH`
- `feature/companion/LifeGoalProposePort.java`, `feature/companion/llm/LifeGoalProposeLlmAdapter.java`, `feature/companion/llm/FakeCompanionLlm.java` (+ branch), `feature/companion/config/CompanionProperties.java` (+ `LifegoalPropose`)
- `resources/db/changelog/1.0.0/script/202609021000_mezo-iizd.1_create_life_goal.sql`, `…/202609021010_mezo-iizd.1_life_goal_source_type.sql`, `resources/db/changelog/1.0.0/1.0.0_master.yml`, `resources/application.yml`, `resources/messages.properties`
- tests: `support/ResetDatabase.java` (TRUNCATE list), `support/populator/LifeGoalPopulator.java`, `feature/lifegoal/LifeGoalEntityIT.java`, `feature/lifegoal/LifeGoalApiIT.java`, `feature/lifegoal/LifeGoalProposeIT.java`, `feature/lifegoal/LifeGoalSeedDataIT.java`

**Contract:** `api/feature/lifegoal/lifegoal.yml`, `api/generate/merge.yml`, `api/openapi.yml` (generated), `frontend/src/data/_client/api.gen.ts` (generated)

**Frontend (`frontend/src/`)**
- `data/lifegoal/lifegoalApi.ts`, `data/lifegoal/lifegoalHooks.ts`, `data/lifegoal/lifegoalMock.ts`, `data/lifegoal/lifegoalHooks.test.tsx`, `data/hooks.ts` (barrel lines), `test/msw/handlers.ts` (fixtures)
- `features/me/logic/lifegoalLabels.ts` — dimension/kind/status label + wash + icon tables
- `features/me/components/PermahRing.tsx`, `features/me/components/LifeGoalTile.tsx`, `features/me/components/PillarCard.tsx`
- `features/me/sheets/PillarCatalogSheet.tsx`
- `features/me/pages/CelokPage.tsx` (+ `.test.tsx`), `features/me/pages/CelPage.tsx` (+ `.test.tsx`), `features/me/pages/CelWizardPage.tsx` (+ `.test.tsx`)
- `app/router.tsx` (routes), `features/me/pages/GoalsPage.tsx` + `GoalPlannerPage.tsx` + `components/GoalGate.tsx` (navigate targets → `/me/goals/weight…`), `styles/prototype.css` (`.lg-*` block)

**Docs:** `docs/features/lifegoal.md` (new), `docs/features/goal-engine.md` (§2 route note), `docs/CODEMAP.md` (generated)

---

### Task 1: Migrations, entities, repositories, populator

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609021000_mezo-iizd.1_create_life_goal.sql`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609021010_mezo-iizd.1_life_goal_source_type.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append two changeSets)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/entity/{LifeGoalEntity,LifeGoalPillarEntity,LifeGoalPillarDayEntity,IfThenPlanJson,PlanTriggerJson,PillarSourceJson,PillarRuleJson}.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/repository/{LifeGoalRepository,LifeGoalPillarRepository,LifeGoalPillarDayRepository}.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (TRUNCATE list)
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/LifeGoalPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalEntityIT.java`

**Interfaces:**
- Produces: the three entities + `LifeGoalRepository.findByIdAndCreatedByAndDeletedFalse(UUID, UUID)`, `findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(UUID)`, `findByCreatedByAndStatusAndDeletedFalse(UUID, String)`; `LifeGoalPillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(UUID)`; `LifeGoalPopulator.goal(UUID owner, String status)` / `pillar(LifeGoalEntity, String label, String kind, PillarSourceJson, PillarRuleJson)`.

- [ ] **Step 1: Write the DDL**

`202609021000_mezo-iizd.1_create_life_goal.sql`:

```sql
-- Életcél-rendszer 1. szelet (mezo-iizd.1): a life goal, its 2–5 pillars and the per-pillar
-- daily evaluation row (written by the slice-2 nightly job; created now so the contract is whole).
create table life_goal (
    id                  uuid        not null default gen_random_uuid(),
    created_by          uuid        not null,
    is_deleted          boolean     not null default false,
    created_at          timestamptz not null default now(),
    title               text        not null,
    why_text            text,
    frame               text        not null default 'unset',
    dimension           text        not null,
    secondary_dimension text,
    status              text        not null default 'draft',
    start_date          date        not null,
    target_date         date,
    activated_at        timestamptz,
    closed_at           timestamptz,
    obstacle_text       text,
    if_then_plans       jsonb       not null default '[]'::jsonb,
    constraint pk_life_goal primary key (id),
    constraint fk_life_goal_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_life_goal_frame check (frame in ('intrinsic', 'extrinsic', 'unset')),
    constraint ck_life_goal_dimension check (dimension in
        ('positive_emotion', 'engagement', 'relationships', 'meaning', 'accomplishment', 'health')),
    constraint ck_life_goal_secondary_dimension check (secondary_dimension is null or secondary_dimension in
        ('positive_emotion', 'engagement', 'relationships', 'meaning', 'accomplishment', 'health')),
    constraint ck_life_goal_status check (status in ('draft', 'active', 'parked', 'done', 'archived')),
    constraint ck_life_goal_target_after_start check (target_date is null or target_date >= start_date)
);
create index idx_life_goal_created_by_status on life_goal (created_by, status) where is_deleted = false;

create table life_goal_pillar (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    goal_id     uuid        not null,
    label       text        not null,
    skill_key   text        not null,
    kind        text        not null,
    weight      smallint    not null default 1,
    position    smallint    not null default 0,
    is_active   boolean     not null default true,
    source      jsonb       not null,
    rule        jsonb       not null default '{}'::jsonb,
    constraint pk_life_goal_pillar primary key (id),
    constraint fk_life_goal_pillar_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_life_goal_pillar_goal_id_life_goal_id
        foreign key (goal_id) references life_goal (id) on delete cascade,
    constraint ck_life_goal_pillar_kind check (kind in ('habit', 'average', 'target', 'baseline', 'linked')),
    constraint ck_life_goal_pillar_weight check (weight between 1 and 3)
);
create index idx_life_goal_pillar_goal_id on life_goal_pillar (goal_id) where is_deleted = false;

create table life_goal_pillar_day (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    pillar_id   uuid        not null,
    day         date        not null,
    value       numeric(12, 3),
    target      numeric(12, 3),
    baseline    numeric(12, 3),
    status      text        not null,
    computed_at timestamptz not null default now(),
    constraint pk_life_goal_pillar_day primary key (id),
    constraint fk_life_goal_pillar_day_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_life_goal_pillar_day_pillar_id_life_goal_pillar_id
        foreign key (pillar_id) references life_goal_pillar (id) on delete cascade,
    constraint ck_life_goal_pillar_day_status check (status in ('hit', 'partial', 'miss', 'no_data'))
);
create unique index uq_life_goal_pillar_day_pillar_day
    on life_goal_pillar_day (pillar_id, day) where is_deleted = false;
```

`202609021010_mezo-iizd.1_life_goal_source_type.sql`:

```sql
-- Life-goal pillar-hit XP (mezo-iizd.1): relaxes level_up_event.source_type additively: += LIFE_GOAL.
-- Slice 2 awards through the shared idempotent tail; the CHECK is widened now so the schema is final.
alter table level_up_event drop constraint ck_level_up_event_source_type;
alter table level_up_event add constraint ck_level_up_event_source_type
    check (source_type in ('GYM', 'SPORT', 'RUN', 'QUEST', 'ACTIVITY', 'HABIT', 'NEEDS', 'LIFE_GOAL'));
```

Append to `1.0.0_master.yml` (same shape as the last entry):

```yaml
  - changeSet:
      id: "1.0.0:202609021000_mezo-iizd.1_create_life_goal"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609021000_mezo-iizd.1_create_life_goal.sql
  - changeSet:
      id: "1.0.0:202609021010_mezo-iizd.1_life_goal_source_type"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609021010_mezo-iizd.1_life_goal_source_type.sql
```

- [ ] **Step 2: Lint the migration**

Run: `node scripts/lint-liquibase.mjs`
Expected: no error lines for the two new files.

- [ ] **Step 3: Write the jsonb records**

`entity/PlanTriggerJson.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.entity;

/** A ha–akkor plan's machine-readable trigger (spec D9). {@code source} is a SignalCatalog trigger
 *  key (e.g. {@code sport_session_logged}, {@code checkin_energy_lte}); null trigger = manual plan. */
public record PlanTriggerJson(String source, String condition, Integer delayHours) {}
```

`entity/IfThenPlanJson.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.entity;

public record IfThenPlanJson(String ha, String akkor, PlanTriggerJson trigger) {}
```

`entity/PillarSourceJson.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.entity;

/** Closed-catalog signal source. {@code type} ∈ metric|activity|habit|weight_goal|needs_ring|social_mentions;
 *  {@code key} = MetricKey name for metric, {@code skillKey}+{@code measure} (minutes|count|huf) for activity,
 *  {@code habitKey} for habit, {@code ring} (energia|hidratacio|pihenes|mozgas|lelek|rend) for needs_ring. */
public record PillarSourceJson(String type, String key, String skillKey, String measure, String habitKey, String ring) {}
```

`entity/PillarRuleJson.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.entity;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Kind-specific rule (spec §4). Unused fields stay null; the scorer (slice 2) reads by kind. */
public record PillarRuleJson(
    BigDecimal threshold, String comparator, Integer daysPerWeek, Integer windowDays,
    BigDecimal startValue, BigDecimal targetValue, LocalDate startDate, LocalDate targetDate,
    String direction, Integer minDataDays) {}
```

- [ ] **Step 4: Write the entities**

`entity/LifeGoalEntity.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
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

/** One life goal (spec §4). Status lifecycle draft→active→parked/done/archived; NO active cap (D7). */
@Getter
@Setter
@Entity
@Table(name = "life_goal")
@SQLDelete(sql = "update life_goal set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class LifeGoalEntity extends OwnedEntity {

    @Id @GeneratedValue @Column(columnDefinition = "uuid") private UUID id;
    @NotNull @Column(nullable = false) private String title;
    @Column(name = "why_text") private String whyText;
    @NotNull @Column(nullable = false) private String frame = "unset";           // intrinsic|extrinsic|unset (CHECK)
    @NotNull @Column(nullable = false) private String dimension;                // PERMAH key (CHECK)
    @Column(name = "secondary_dimension") private String secondaryDimension;
    @NotNull @Column(nullable = false) private String status = "draft";         // draft|active|parked|done|archived (CHECK)
    @NotNull @Column(name = "start_date", nullable = false) private LocalDate startDate;
    @Column(name = "target_date") private LocalDate targetDate;
    @Column(name = "activated_at") private Instant activatedAt;
    @Column(name = "closed_at") private Instant closedAt;
    @Column(name = "obstacle_text") private String obstacleText;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "if_then_plans", columnDefinition = "jsonb", nullable = false)
    private List<IfThenPlanJson> ifThenPlans = new ArrayList<>();
}
```

`entity/LifeGoalPillarEntity.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/** A contributing pillar of a life goal — a catalog signal + a kind-specific rule + the skill it feeds. */
@Getter
@Setter
@Entity
@Table(name = "life_goal_pillar")
@SQLDelete(sql = "update life_goal_pillar set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class LifeGoalPillarEntity extends OwnedEntity {

    @Id @GeneratedValue @Column(columnDefinition = "uuid") private UUID id;
    @NotNull @Column(name = "goal_id", nullable = false, columnDefinition = "uuid") private UUID goalId;
    @NotNull @Column(nullable = false) private String label;
    @NotNull @Column(name = "skill_key", nullable = false) private String skillKey;
    @NotNull @Column(nullable = false) private String kind;                    // habit|average|target|baseline|linked
    @Min(1) @Max(3) @JdbcTypeCode(SqlTypes.SMALLINT) @Column(nullable = false) private int weight = 1;
    @JdbcTypeCode(SqlTypes.SMALLINT) @Column(nullable = false) private int position;
    @Column(name = "is_active", nullable = false) private boolean active = true;

    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false)
    private PillarSourceJson source;

    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false)
    private PillarRuleJson rule = new PillarRuleJson(null, null, null, null, null, null, null, null, null, null);
}
```

`entity/LifeGoalPillarDayEntity.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** The nightly evaluation row (slice 2 writes it): one per pillar+day, status hit|partial|miss|no_data. */
@Getter
@Setter
@Entity
@Table(name = "life_goal_pillar_day")
@SQLDelete(sql = "update life_goal_pillar_day set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class LifeGoalPillarDayEntity extends OwnedEntity {

    @Id @GeneratedValue @Column(columnDefinition = "uuid") private UUID id;
    @NotNull @Column(name = "pillar_id", nullable = false, columnDefinition = "uuid") private UUID pillarId;
    @NotNull @Column(nullable = false) private LocalDate day;
    @Column(precision = 12, scale = 3) private BigDecimal value;
    @Column(precision = 12, scale = 3) private BigDecimal target;
    @Column(precision = 12, scale = 3) private BigDecimal baseline;
    @NotNull @Column(nullable = false) private String status;
    @NotNull @Column(name = "computed_at", nullable = false) private Instant computedAt = Instant.now();
}
```

- [ ] **Step 5: Write the repositories**

```java
package io.mrkuhne.mezo.feature.lifegoal.repository;

import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LifeGoalRepository extends JpaRepository<LifeGoalEntity, UUID> {
    Optional<LifeGoalEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
    List<LifeGoalEntity> findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(UUID createdBy);
    List<LifeGoalEntity> findByCreatedByAndStatusAndDeletedFalse(UUID createdBy, String status);
}
```

```java
package io.mrkuhne.mezo.feature.lifegoal.repository;

import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LifeGoalPillarRepository extends JpaRepository<LifeGoalPillarEntity, UUID> {
    List<LifeGoalPillarEntity> findByGoalIdAndDeletedFalseOrderByPositionAsc(UUID goalId);
    List<LifeGoalPillarEntity> findByGoalIdInAndDeletedFalseOrderByPositionAsc(List<UUID> goalIds);
}
```

```java
package io.mrkuhne.mezo.feature.lifegoal.repository;

import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarDayEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LifeGoalPillarDayRepository extends JpaRepository<LifeGoalPillarDayEntity, UUID> {
    Optional<LifeGoalPillarDayEntity> findByPillarIdAndDayAndDeletedFalse(UUID pillarId, LocalDate day);
    List<LifeGoalPillarDayEntity> findByPillarIdInAndDayBetweenAndDeletedFalseOrderByDayAsc(
        List<UUID> pillarIds, LocalDate from, LocalDate to);
}
```

- [ ] **Step 6: Register the tables in `ResetDatabase`**

In the TRUNCATE string, before `"goal_plan_link, goal, biometric_profile, "` insert:

```java
+ "life_goal_pillar_day, life_goal_pillar, life_goal, "
```

- [ ] **Step 7: Write the populator**

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the life-goal aggregate — persists via saveAndFlush so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class LifeGoalPopulator {

    private final LifeGoalRepository goalRepository;
    private final LifeGoalPillarRepository pillarRepository;

    public LifeGoalEntity goal(UUID owner, String status) {
        LifeGoalEntity g = new LifeGoalEntity();
        g.setCreatedBy(owner);
        g.setTitle("Kockahas");
        g.setWhyText("Erős, egészséges test, ami bírja a röpit.");
        g.setFrame("intrinsic");
        g.setDimension("health");
        g.setSecondaryDimension("accomplishment");
        g.setStatus(status);
        g.setStartDate(LocalDate.of(2026, 8, 10));
        g.setTargetDate(LocalDate.of(2026, 11, 30));
        return goalRepository.saveAndFlush(g);
    }

    public LifeGoalPillarEntity pillar(LifeGoalEntity goal, String label, String kind,
            PillarSourceJson source, PillarRuleJson rule) {
        LifeGoalPillarEntity p = new LifeGoalPillarEntity();
        p.setCreatedBy(goal.getCreatedBy());
        p.setGoalId(goal.getId());
        p.setLabel(label);
        p.setSkillKey("recovery");
        p.setKind(kind);
        p.setSource(source);
        p.setRule(rule);
        return pillarRepository.saveAndFlush(p);
    }

    /** The canonical "Alvás ≥ 7 ó" average pillar on the sleep-duration metric. */
    public LifeGoalPillarEntity sleepPillar(LifeGoalEntity goal) {
        return pillar(goal, "Alvás", "average",
            new PillarSourceJson("metric", "SLEEP_DURATION_H", null, null, null, null),
            new PillarRuleJson(new BigDecimal("7.0"), "gte", null, 7, null, null, null, null, null, null));
    }
}
```

- [ ] **Step 8: Write the failing entity IT**

`feature/lifegoal/LifeGoalEntityIT.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class LifeGoalEntityIT extends AbstractIntegrationTest {

    @Autowired private LifeGoalPopulator populator;
    @Autowired private LifeGoalRepository goalRepository;
    @Autowired private LifeGoalPillarRepository pillarRepository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testSave_shouldRoundTripJsonb_whenPillarHasSourceAndRule() {
        LifeGoalEntity g = populator.goal(ownerId(), "draft");
        LifeGoalPillarEntity p = populator.sleepPillar(g);

        LifeGoalPillarEntity found = pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(g.getId()).get(0);
        assertThat(found.getId()).isEqualTo(p.getId());
        assertThat(found.getSource().type()).isEqualTo("metric");
        assertThat(found.getSource().key()).isEqualTo("SLEEP_DURATION_H");
        assertThat(found.getRule().threshold()).isEqualByComparingTo("7.0");
        assertThat(goalRepository.findByIdAndCreatedByAndDeletedFalse(g.getId(), ownerId())).isPresent();
    }

    @Test
    void testSave_shouldRejectUnknownDimension_whenCheckViolated() {
        LifeGoalEntity g = new LifeGoalEntity();
        g.setCreatedBy(ownerId());
        g.setTitle("x");
        g.setDimension("fame");
        g.setStartDate(java.time.LocalDate.of(2026, 9, 1));
        assertThatThrownBy(() -> goalRepository.saveAndFlush(g)).isInstanceOf(DataIntegrityViolationException.class);
    }
}
```

- [ ] **Step 9: Run it, expect FAIL (compile error: classes missing) → add the classes from Steps 3–7 → run again, expect PASS**

Run: `cd backend && ./mvnw -q test -Dtest='LifeGoalEntityIT' -Dmezo.test.use-testcontainers=true -Dsurefire.failIfNoSpecifiedTests=false`
Expected: 2 tests PASS.

- [ ] **Step 10: Commit**

```bash
git add backend/src/main/resources/db backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal backend/src/test/java/io/mrkuhne/mezo/support backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal
git commit -m "feat(lifegoal): tables, entities, repositories, populator (mezo-iizd.1)"
```

---

### Task 2: Contract fragment + generation

**Files:**
- Create: `api/feature/lifegoal/lifegoal.yml`
- Modify: `api/generate/merge.yml` (append input)
- Generated: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces (generated): `io.mrkuhne.mezo.api.controller.LifeGoalApi` with `listLifeGoals()`, `createLifeGoal(LifeGoalUpsertRequest)`, `getLifeGoal(UUID)`, `updateLifeGoal(UUID, LifeGoalUpsertRequest)`, `deleteLifeGoal(UUID)`, `changeLifeGoalStatus(UUID, LifeGoalStatusRequest)`, `replaceLifeGoalPillars(UUID, LifeGoalPillarsRequest)`, `proposeLifeGoal(LifeGoalProposeRequest)`, `listLifeGoalSignals()`; DTOs `LifeGoalResponse`, `LifeGoalUpsertRequest`, `LifeGoalPillarInput`, `LifeGoalPillarResponse`, `PillarSource`, `PillarRule`, `IfThenPlan`, `PlanTrigger`, `LifeGoalStatusRequest`, `LifeGoalPillarsRequest`, `LifeGoalProposeRequest`, `LifeGoalProposeResponse`, `SignalCatalogResponse`, `SignalCatalogEntry`. FE: `components['schemas'][...]` of the same names.

- [ ] **Step 1: Write the fragment**

```yaml
openapi: 3.0.3
info: { title: mezo lifegoal fragment, version: 1.0.0 }
tags:
  - name: LifeGoal
    description: Életcél-rendszer — PERMAH-dimenziós célok, pillérek a zárt jel-katalógusból, AI-javaslat (mezo-iizd)
paths:
  /api/life-goals:
    get:
      tags: [LifeGoal]
      operationId: listLifeGoals
      summary: Every non-deleted life goal of the caller, newest first (LifeGoal)
      responses:
        '200':
          description: Goals with their pillars
          content: { application/json: { schema: { type: array, items: { $ref: '#/components/schemas/LifeGoalResponse' } } } }
    post:
      tags: [LifeGoal]
      operationId: createLifeGoal
      summary: Create a life goal in draft with its pillars (LifeGoal)
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/LifeGoalUpsertRequest' } } }
      responses:
        '201':
          description: Created (status draft)
          content: { application/json: { schema: { $ref: '#/components/schemas/LifeGoalResponse' } } }
        '400':
          description: Validation error — unknown signal/skill, >5 pillars, target before start (LIFE_GOAL_*)
          content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } }
  /api/life-goals/signals:
    get:
      tags: [LifeGoal]
      operationId: listLifeGoalSignals
      summary: The closed signal catalog a pillar may point at (LifeGoal)
      responses:
        '200':
          description: Catalog entries
          content: { application/json: { schema: { $ref: '#/components/schemas/SignalCatalogResponse' } } }
  /api/life-goals/propose:
    post:
      tags: [LifeGoal]
      operationId: proposeLifeGoal
      summary: Propose-only AI draft — dimension, frame, pillars from the catalog, obstacles, ha–akkor (LifeGoal)
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/LifeGoalProposeRequest' } } }
      responses:
        '200':
          description: Proposal (template fallback when the AI is off or fails — never empty)
          content: { application/json: { schema: { $ref: '#/components/schemas/LifeGoalProposeResponse' } } }
  /api/life-goals/{id}:
    parameters:
      - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
    get:
      tags: [LifeGoal]
      operationId: getLifeGoal
      summary: One life goal with pillars (LifeGoal)
      responses:
        '200': { description: Goal, content: { application/json: { schema: { $ref: '#/components/schemas/LifeGoalResponse' } } } }
        '404': { description: Not found / not owned, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
    put:
      tags: [LifeGoal]
      operationId: updateLifeGoal
      summary: Replace the goal's editable fields (status and pillars untouched) (LifeGoal)
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/LifeGoalUpsertRequest' } } }
      responses:
        '200': { description: Updated, content: { application/json: { schema: { $ref: '#/components/schemas/LifeGoalResponse' } } } }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
    delete:
      tags: [LifeGoal]
      operationId: deleteLifeGoal
      summary: Soft-delete the goal and its pillars (LifeGoal)
      responses:
        '204': { description: Deleted }
        '404': { description: Not found, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/life-goals/{id}/status:
    parameters:
      - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
    post:
      tags: [LifeGoal]
      operationId: changeLifeGoalStatus
      summary: Lifecycle transition — activate / park / done / archive; no active-count cap (LifeGoal)
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/LifeGoalStatusRequest' } } }
      responses:
        '200': { description: New state, content: { application/json: { schema: { $ref: '#/components/schemas/LifeGoalResponse' } } } }
        '409': { description: Illegal transition (LIFE_GOAL_INVALID_STATUS_TRANSITION), content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/life-goals/{id}/pillars:
    parameters:
      - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
    put:
      tags: [LifeGoal]
      operationId: replaceLifeGoalPillars
      summary: Replace the goal's pillar list (max 5, catalog-validated) (LifeGoal)
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: '#/components/schemas/LifeGoalPillarsRequest' } } }
      responses:
        '200': { description: Goal with the new pillars, content: { application/json: { schema: { $ref: '#/components/schemas/LifeGoalResponse' } } } }
        '400': { description: Validation error, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
components:
  schemas:
    LifeGoalDimension:
      type: string
      enum: [positive_emotion, engagement, relationships, meaning, accomplishment, health]
    LifeGoalStatus:
      type: string
      enum: [draft, active, parked, done, archived]
    LifeGoalFrame:
      type: string
      enum: [intrinsic, extrinsic, unset]
    PillarKind:
      type: string
      enum: [habit, average, target, baseline, linked]
    PillarSource:
      type: object
      required: [type]
      properties:
        type: { type: string, enum: [metric, activity, habit, weight_goal, needs_ring, social_mentions] }
        key: { type: string, description: MetricKey name for type=metric }
        skillKey: { type: string, description: activity skill filter for type=activity }
        measure: { type: string, enum: [minutes, count, huf] }
        habitKey: { type: string }
        ring: { type: string, enum: [energia, hidratacio, pihenes, mozgas, lelek, rend] }
    PillarRule:
      type: object
      properties:
        threshold: { type: number }
        comparator: { type: string, enum: [gte, lte] }
        daysPerWeek: { type: integer, minimum: 1, maximum: 7 }
        windowDays: { type: integer, minimum: 1, maximum: 90 }
        startValue: { type: number }
        targetValue: { type: number }
        startDate: { type: string, format: date }
        targetDate: { type: string, format: date }
        direction: { type: string, enum: [up, down] }
        minDataDays: { type: integer, minimum: 1, maximum: 90 }
    PlanTrigger:
      type: object
      required: [source]
      properties:
        source: { type: string, maxLength: 60 }
        condition: { type: string, maxLength: 120 }
        delayHours: { type: integer, minimum: 0, maximum: 168 }
    IfThenPlan:
      type: object
      required: [ha, akkor]
      properties:
        ha: { type: string, minLength: 1, maxLength: 240 }
        akkor: { type: string, minLength: 1, maxLength: 240 }
        trigger: { $ref: '#/components/schemas/PlanTrigger' }
    LifeGoalPillarInput:
      type: object
      required: [label, skillKey, kind, source]
      properties:
        label: { type: string, minLength: 1, maxLength: 80 }
        skillKey: { type: string, maxLength: 40 }
        kind: { $ref: '#/components/schemas/PillarKind' }
        weight: { type: integer, minimum: 1, maximum: 3, default: 1 }
        active: { type: boolean, default: true }
        source: { $ref: '#/components/schemas/PillarSource' }
        rule: { $ref: '#/components/schemas/PillarRule' }
    LifeGoalPillarResponse:
      allOf:
        - $ref: '#/components/schemas/LifeGoalPillarInput'
        - type: object
          required: [id, position]
          properties:
            id: { type: string, format: uuid }
            position: { type: integer }
    LifeGoalUpsertRequest:
      type: object
      required: [title, dimension, startDate]
      properties:
        title: { type: string, minLength: 1, maxLength: 120 }
        whyText: { type: string, maxLength: 600 }
        frame: { $ref: '#/components/schemas/LifeGoalFrame' }
        dimension: { $ref: '#/components/schemas/LifeGoalDimension' }
        secondaryDimension: { $ref: '#/components/schemas/LifeGoalDimension' }
        startDate: { type: string, format: date }
        targetDate: { type: string, format: date }
        obstacleText: { type: string, maxLength: 300 }
        ifThenPlans: { type: array, maxItems: 5, items: { $ref: '#/components/schemas/IfThenPlan' } }
        pillars: { type: array, maxItems: 5, items: { $ref: '#/components/schemas/LifeGoalPillarInput' } }
    LifeGoalResponse:
      type: object
      required: [id, title, frame, dimension, status, startDate, ifThenPlans, pillars]
      properties:
        id: { type: string, format: uuid }
        title: { type: string }
        whyText: { type: string }
        frame: { $ref: '#/components/schemas/LifeGoalFrame' }
        dimension: { $ref: '#/components/schemas/LifeGoalDimension' }
        secondaryDimension: { $ref: '#/components/schemas/LifeGoalDimension' }
        status: { $ref: '#/components/schemas/LifeGoalStatus' }
        startDate: { type: string, format: date }
        targetDate: { type: string, format: date }
        activatedAt: { type: string, format: date-time }
        closedAt: { type: string, format: date-time }
        obstacleText: { type: string }
        ifThenPlans: { type: array, items: { $ref: '#/components/schemas/IfThenPlan' } }
        pillars: { type: array, items: { $ref: '#/components/schemas/LifeGoalPillarResponse' } }
    LifeGoalStatusRequest:
      type: object
      required: [status]
      properties:
        status: { $ref: '#/components/schemas/LifeGoalStatus' }
    LifeGoalPillarsRequest:
      type: object
      required: [pillars]
      properties:
        pillars: { type: array, maxItems: 5, items: { $ref: '#/components/schemas/LifeGoalPillarInput' } }
    LifeGoalProposeRequest:
      type: object
      required: [title]
      properties:
        title: { type: string, minLength: 1, maxLength: 120 }
        whyText: { type: string, maxLength: 600 }
        targetDate: { type: string, format: date }
    LifeGoalProposeResponse:
      type: object
      required: [dimension, frame, pillars, obstacles, ifThenPlans, source]
      properties:
        dimension: { $ref: '#/components/schemas/LifeGoalDimension' }
        secondaryDimension: { $ref: '#/components/schemas/LifeGoalDimension' }
        frame: { $ref: '#/components/schemas/LifeGoalFrame' }
        frameNote: { type: string, description: Mezo's one-sentence reading of the why (Hungarian) }
        reframedWhy: { type: string, description: the intrinsic reframing offered when frame=extrinsic }
        pillars: { type: array, items: { $ref: '#/components/schemas/LifeGoalPillarInput' } }
        obstacles: { type: array, items: { type: string } }
        ifThenPlans: { type: array, items: { $ref: '#/components/schemas/IfThenPlan' } }
        source: { type: string, enum: [ai, template] }
    SignalCatalogEntry:
      type: object
      required: [source, label, group, kinds, unit]
      properties:
        source: { $ref: '#/components/schemas/PillarSource' }
        label: { type: string }
        group: { type: string, description: Hungarian group label (Alvás · Fuel · Edzés · Elme · Activity · Emberek · Életjel) }
        kinds: { type: array, items: { $ref: '#/components/schemas/PillarKind' } }
        unit: { type: string }
        defaultSkillKey: { type: string }
    SignalCatalogResponse:
      type: object
      required: [entries]
      properties:
        entries: { type: array, items: { $ref: '#/components/schemas/SignalCatalogEntry' } }
```

- [ ] **Step 2: Register and generate**

Append to `api/generate/merge.yml` after the diagnosis line: `  - inputFile: ../feature/lifegoal/lifegoal.yml`

Run:
```bash
cd api/generate && npm ci && npm run generate:api && cd ../../frontend && pnpm install --frozen-lockfile && pnpm generate:api
```
Expected: `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` change; `grep -c LifeGoalResponse frontend/src/data/_client/api.gen.ts` ≥ 1.

- [ ] **Step 3: Verify the backend generates the interface**

Run: `cd backend && ./mvnw -q -DskipTests compile && ls target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/controller/ | grep LifeGoalApi`
Expected: `LifeGoalApi.java` listed; the build fails only if the interface has no implementation? No — an unimplemented interface compiles; Task 3 adds the controller.

- [ ] **Step 4: Commit**

```bash
git add api/feature/lifegoal/lifegoal.yml api/generate/merge.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git commit -m "feat(lifegoal): OpenAPI fragment — goals, status, pillars, propose, signals (mezo-iizd.1)"
```

---

### Task 3: Feature switch, signal catalog, CRUD + status lifecycle, controller

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (two constants)
- Modify: `backend/src/main/resources/application.yml` (`mezo.feature.lifegoal.enabled`, `mezo.feature.lifegoal-ai-propose.enabled`, `mezo.lifegoal.*` block)
- Modify: `backend/src/main/resources/messages.properties` (error codes)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/config/LifeGoalProperties.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/catalog/{SignalCatalogEntry,SignalCatalog}.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/mapper/LifeGoalMapper.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/controller/LifeGoalController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalApiIT.java`

**Interfaces:**
- Consumes: Task 1 entities/repositories, Task 2 DTOs.
- Produces: `FeaturesConfiguration.LIFEGOAL_SWITCH = "mezo.feature.lifegoal.enabled"`, `LIFEGOAL_AI_PROPOSE_SWITCH = "mezo.feature.lifegoal-ai-propose.enabled"`; `LifeGoalProperties(int maxPillars)`; `SignalCatalog.entries()`, `SignalCatalog.find(PillarSourceJson) → Optional<SignalCatalogEntry>`, `SignalCatalog.promptText()`; `LifeGoalService.{list,get,create,update,delete,changeStatus}(UUID userId, …)`; `LifeGoalMapper.toResponse(LifeGoalEntity, List<LifeGoalPillarEntity>)`, `toPillarEntity(LifeGoalPillarInput, LifeGoalEntity, int position)`; the pillar replace call `LifeGoalPillarService.replace(UUID userId, UUID goalId, List<LifeGoalPillarInput>)` (Task 4 — the create path calls it, so Task 3 ships a first version of `LifeGoalPillarService` with the catalog validation already inside).

- [ ] **Step 1: Switches, properties, messages**

`FeaturesConfiguration` (next to `NEEDS_SWITCH`):

```java
    /** Életcél-rendszer (bd mezo-iizd) — off ⇒ /api/life-goals 404s, no lifegoal beans. */
    public static final String LIFEGOAL_SWITCH = "mezo.feature.lifegoal.enabled";

    /** AI pillar proposal for life goals (propose-only, ADR 0019) — off ⇒ the template proposer answers. */
    public static final String LIFEGOAL_AI_PROPOSE_SWITCH = "mezo.feature.lifegoal-ai-propose.enabled";
```

`application.yml` — under `mezo.feature:` (after the `needs:` block):

```yaml
    # Életcél-rendszer (mezo-iizd) — off ⇒ the /api/life-goals surface 404s and no lifegoal beans exist.
    lifegoal:
      enabled: true
    # AI pillar proposal (propose-only): off ⇒ POST /api/life-goals/propose answers from the rule template.
    lifegoal-ai-propose:
      enabled: true
```

and under the top-level `mezo:` (next to `needs:` tuning):

```yaml
  # Binds feature/lifegoal/config/LifeGoalProperties (mezo-iizd) — pillar cap per goal.
  lifegoal:
    max-pillars: 5
```

`messages.properties` (append):

```properties
LIFE_GOAL_INVALID_STATUS_TRANSITION=Ez az állapotváltás nem lehetséges.
LIFE_GOAL_UNKNOWN_SIGNAL=Ismeretlen jel-forrás a pillérben.
LIFE_GOAL_UNKNOWN_SKILL=Ismeretlen skill-kulcs a pillérben.
LIFE_GOAL_TOO_MANY_PILLARS=Legfeljebb 5 pillér lehet egy célon.
LIFE_GOAL_KIND_NOT_ALLOWED=Ez a pillér-fajta nem illik a választott jelhez.
```

`config/LifeGoalProperties.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Life-goal tuning (mezo.lifegoal), never code (configuration_conventions.md). */
@Validated
@ConfigurationProperties(prefix = "mezo.lifegoal")
public record LifeGoalProperties(@Min(1) @Max(10) int maxPillars) {}
```

Register the record the way `NeedsProperties` is registered (find with `grep -rn "NeedsProperties.class" backend/src/main/java` and add `LifeGoalProperties.class` to the same `@EnableConfigurationProperties` list).

- [ ] **Step 2: The signal catalog**

`catalog/SignalCatalogEntry.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.catalog;

import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import java.util.List;

/** One row of the closed catalog: the source spec, Hungarian label/group, allowed kinds, unit, default skill. */
public record SignalCatalogEntry(String id, PillarSourceJson source, String label, String group,
    List<String> kinds, String unit, String defaultSkillKey) {}
```

`catalog/SignalCatalog.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.catalog;

import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * The closed signal catalog (spec D4): the ONLY sources a pillar may point at. The AI proposer
 * chooses from {@link #promptText()}; {@code LifeGoalPillarService} validates every pillar with
 * {@link #find(PillarSourceJson)}. Metric keys are MetricKey names (companion) — string-mirrored
 * here on purpose so this slice does not import companion until slice 2 needs the series.
 */
@Component
public class SignalCatalog {

    private static final List<String> HABIT_AVG = List.of("habit", "average");
    private static final List<String> AVG_BASE = List.of("average", "baseline");
    private static final List<String> HABIT_AVG_BASE = List.of("habit", "average", "baseline");
    private static final List<String> HABIT_BASE_TARGET = List.of("habit", "baseline", "target");

    private static PillarSourceJson metric(String key) { return new PillarSourceJson("metric", key, null, null, null, null); }
    private static PillarSourceJson activity(String skill, String measure) { return new PillarSourceJson("activity", null, skill, measure, null, null); }
    private static PillarSourceJson ring(String ring) { return new PillarSourceJson("needs_ring", null, null, null, null, ring); }

    private static final List<SignalCatalogEntry> ENTRIES = List.of(
        new SignalCatalogEntry("sleep_duration", metric("SLEEP_DURATION_H"), "Alváshossz", "Alvás", HABIT_AVG_BASE, "óra", "recovery"),
        new SignalCatalogEntry("sleep_quality", metric("SLEEP_QUALITY"), "Alvásminőség", "Alvás", AVG_BASE, "1–10", "recovery"),
        new SignalCatalogEntry("bedtime_variability", metric("BEDTIME_VARIABILITY"), "Lefekvés-szórás", "Alvás", AVG_BASE, "perc", "recovery"),
        new SignalCatalogEntry("protein", metric("DAILY_PROTEIN_G"), "Fehérje", "Fuel", HABIT_AVG_BASE, "g", "cooking"),
        new SignalCatalogEntry("kcal", metric("DAILY_KCAL"), "Kalória", "Fuel", AVG_BASE, "kcal", "cooking"),
        new SignalCatalogEntry("water", metric("DAILY_WATER_ML"), "Víz", "Fuel", HABIT_AVG, "ml", "recovery"),
        new SignalCatalogEntry("late_meal", metric("LATE_MEAL_HOUR"), "Utolsó étkezés ideje", "Fuel", HABIT_AVG, "óra", "mindset"),
        new SignalCatalogEntry("meal_score", metric("MEAL_SCORE"), "Étkezés-pontszám", "Fuel", AVG_BASE, "pont", "cooking"),
        new SignalCatalogEntry("gym_volume", metric("GYM_VOLUME_KG"), "Gym-volumen", "Edzés", HABIT_AVG_BASE, "kg", "max_strength"),
        new SignalCatalogEntry("sport_load", metric("SPORT_LOAD_MIN"), "Sportterhelés", "Edzés", HABIT_AVG_BASE, "perc", "aerobic_capacity"),
        new SignalCatalogEntry("acwr", metric("ACWR"), "Akut:krónikus terhelés", "Edzés", List.of("average"), "arány", "recovery"),
        new SignalCatalogEntry("hr_recovery", metric("RUN_HR_RECOVERY_S"), "Pulzus-visszaállás", "Edzés", AVG_BASE, "mp", "aerobic_capacity"),
        new SignalCatalogEntry("weight_goal", new PillarSourceJson("weight_goal", null, null, null, null, null), "Súlycél · ütem", "Edzés", List.of("linked"), "ítélet", "recovery"),
        new SignalCatalogEntry("checkin_energy", metric("CHECKIN_ENERGY"), "Check-in energia", "Elme", AVG_BASE, "1–10", "mindset"),
        new SignalCatalogEntry("checkin_mental", metric("CHECKIN_MENTAL"), "Check-in hangulat", "Elme", AVG_BASE, "1–10", "mindfulness"),
        new SignalCatalogEntry("checkin_stress", metric("CHECKIN_STRESS"), "Stressz", "Elme", AVG_BASE, "1–10", "mindfulness"),
        new SignalCatalogEntry("habits_done", metric("HABITS_DONE"), "Kész szokások", "Elme", HABIT_AVG, "db", "mindset"),
        new SignalCatalogEntry("ritual_closed", metric("RITUAL_CLOSED"), "Napzárás", "Elme", List.of("habit"), "igen/nem", "mindset"),
        new SignalCatalogEntry("daily_xp", metric("DAILY_XP"), "Napi XP", "Elme", AVG_BASE, "XP", "mindset"),
        new SignalCatalogEntry("activity_productivity", activity("productivity", "minutes"), "Produktivitás · perc", "Activity", HABIT_BASE_TARGET, "perc", "productivity"),
        new SignalCatalogEntry("activity_learning", activity("learning", "count"), "Tanulás · alkalom", "Activity", HABIT_BASE_TARGET, "alkalom", "learning"),
        new SignalCatalogEntry("activity_financial", activity("financial", "huf"), "Pénzügy · Ft", "Activity", List.of("target", "baseline"), "Ft", "financial"),
        new SignalCatalogEntry("activity_connection", activity("connection", "count"), "Kapcsolatok · alkalom", "Activity", HABIT_BASE_TARGET, "alkalom", "connection"),
        new SignalCatalogEntry("activity_cooking", activity("cooking", "count"), "Konyha · alkalom", "Activity", HABIT_BASE_TARGET, "alkalom", "cooking"),
        new SignalCatalogEntry("social_mentions", new PillarSourceJson("social_mentions", null, null, null, null, null), "Társas említések", "Emberek", HABIT_AVG_BASE, "ember", "connection"),
        new SignalCatalogEntry("ring_mozgas", ring("mozgas"), "Mozgás-gyűrű", "Életjel", AVG_BASE, "%", "recovery"),
        new SignalCatalogEntry("ring_pihenes", ring("pihenes"), "Pihenés-gyűrű", "Életjel", AVG_BASE, "%", "recovery"),
        new SignalCatalogEntry("ring_lelek", ring("lelek"), "Lélek-gyűrű", "Életjel", AVG_BASE, "%", "mindfulness"));

    public List<SignalCatalogEntry> entries() { return ENTRIES; }

    /** Exact-match lookup on the identifying fields of the source (type + key/skillKey+measure/ring). */
    public Optional<SignalCatalogEntry> find(PillarSourceJson s) {
        if (s == null || s.type() == null) return Optional.empty();
        return ENTRIES.stream().filter(e -> sameSource(e.source(), s)).findFirst();
    }

    public Optional<SignalCatalogEntry> byId(String id) {
        return ENTRIES.stream().filter(e -> e.id().equals(id)).findFirst();
    }

    /** One line per entry — the AI prompt's [Jelek] block. */
    public String promptText() {
        return ENTRIES.stream()
            .map(e -> e.id() + " · " + e.label() + " (" + e.group() + ", " + e.unit() + ", fajták: "
                + String.join("/", e.kinds()) + ", skill: " + e.defaultSkillKey() + ")")
            .collect(Collectors.joining("\n"));
    }

    private static boolean sameSource(PillarSourceJson a, PillarSourceJson b) {
        return Objects.equals(a.type(), b.type())
            && Objects.equals(a.key(), b.key())
            && Objects.equals(a.skillKey(), b.skillKey())
            && Objects.equals(a.measure(), b.measure())
            && Objects.equals(a.ring(), b.ring());
    }
}
```

(`habit` sources — `{type: habit, habitKey}` — are validated against the user's own `habit_def` keys in Task 4, not against this static list.)

- [ ] **Step 3: Mapper**

`mapper/LifeGoalMapper.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.mapper;

import io.mrkuhne.mezo.api.dto.IfThenPlan;
import io.mrkuhne.mezo.api.dto.LifeGoalDimension;
import io.mrkuhne.mezo.api.dto.LifeGoalFrame;
import io.mrkuhne.mezo.api.dto.LifeGoalPillarInput;
import io.mrkuhne.mezo.api.dto.LifeGoalPillarResponse;
import io.mrkuhne.mezo.api.dto.LifeGoalResponse;
import io.mrkuhne.mezo.api.dto.LifeGoalStatus;
import io.mrkuhne.mezo.api.dto.PillarKind;
import io.mrkuhne.mezo.api.dto.PillarRule;
import io.mrkuhne.mezo.api.dto.PillarSource;
import io.mrkuhne.mezo.api.dto.PlanTrigger;
import io.mrkuhne.mezo.feature.lifegoal.entity.IfThenPlanJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PlanTriggerJson;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class LifeGoalMapper {

    public LifeGoalResponse toResponse(LifeGoalEntity g, List<LifeGoalPillarEntity> pillars) {
        return LifeGoalResponse.builder()
            .id(g.getId()).title(g.getTitle()).whyText(g.getWhyText())
            .frame(LifeGoalFrame.fromValue(g.getFrame()))
            .dimension(LifeGoalDimension.fromValue(g.getDimension()))
            .secondaryDimension(g.getSecondaryDimension() == null ? null : LifeGoalDimension.fromValue(g.getSecondaryDimension()))
            .status(LifeGoalStatus.fromValue(g.getStatus()))
            .startDate(g.getStartDate()).targetDate(g.getTargetDate())
            .activatedAt(g.getActivatedAt() == null ? null : g.getActivatedAt().atOffset(ZoneOffset.UTC))
            .closedAt(g.getClosedAt() == null ? null : g.getClosedAt().atOffset(ZoneOffset.UTC))
            .obstacleText(g.getObstacleText())
            .ifThenPlans(g.getIfThenPlans().stream().map(this::toPlanDto).toList())
            .pillars(pillars.stream().map(this::toPillarResponse).toList())
            .build();
    }

    public LifeGoalPillarResponse toPillarResponse(LifeGoalPillarEntity p) {
        return LifeGoalPillarResponse.builder()
            .id(p.getId()).position(p.getPosition())
            .label(p.getLabel()).skillKey(p.getSkillKey()).kind(PillarKind.fromValue(p.getKind()))
            .weight(p.getWeight()).active(p.isActive())
            .source(toSourceDto(p.getSource())).rule(toRuleDto(p.getRule()))
            .build();
    }

    public LifeGoalPillarEntity toPillarEntity(LifeGoalPillarInput in, LifeGoalEntity goal, int position) {
        LifeGoalPillarEntity p = new LifeGoalPillarEntity();
        p.setCreatedBy(goal.getCreatedBy());
        p.setGoalId(goal.getId());
        p.setLabel(in.getLabel());
        p.setSkillKey(in.getSkillKey());
        p.setKind(in.getKind().getValue());
        p.setWeight(in.getWeight() == null ? 1 : in.getWeight());
        p.setActive(in.getActive() == null || in.getActive());
        p.setPosition(position);
        p.setSource(toSourceJson(in.getSource()));
        p.setRule(toRuleJson(in.getRule()));
        return p;
    }

    public PillarSourceJson toSourceJson(PillarSource s) {
        return new PillarSourceJson(s.getType().getValue(), s.getKey(), s.getSkillKey(),
            s.getMeasure() == null ? null : s.getMeasure().getValue(), s.getHabitKey(),
            s.getRing() == null ? null : s.getRing().getValue());
    }

    public PillarRuleJson toRuleJson(PillarRule r) {
        if (r == null) return new PillarRuleJson(null, null, null, null, null, null, null, null, null, null);
        return new PillarRuleJson(r.getThreshold(), r.getComparator() == null ? null : r.getComparator().getValue(),
            r.getDaysPerWeek(), r.getWindowDays(), r.getStartValue(), r.getTargetValue(), r.getStartDate(),
            r.getTargetDate(), r.getDirection() == null ? null : r.getDirection().getValue(), r.getMinDataDays());
    }

    public IfThenPlanJson toPlanJson(IfThenPlan p) {
        PlanTrigger t = p.getTrigger();
        return new IfThenPlanJson(p.getHa(), p.getAkkor(),
            t == null ? null : new PlanTriggerJson(t.getSource(), t.getCondition(), t.getDelayHours()));
    }

    private IfThenPlan toPlanDto(IfThenPlanJson j) {
        return IfThenPlan.builder().ha(j.ha()).akkor(j.akkor())
            .trigger(j.trigger() == null ? null : PlanTrigger.builder().source(j.trigger().source())
                .condition(j.trigger().condition()).delayHours(j.trigger().delayHours()).build())
            .build();
    }

    private PillarSource toSourceDto(PillarSourceJson s) {
        return PillarSource.builder().type(PillarSource.TypeEnum.fromValue(s.type())).key(s.key())
            .skillKey(s.skillKey()).measure(s.measure() == null ? null : PillarSource.MeasureEnum.fromValue(s.measure()))
            .habitKey(s.habitKey()).ring(s.ring() == null ? null : PillarSource.RingEnum.fromValue(s.ring())).build();
    }

    private PillarRule toRuleDto(PillarRuleJson r) {
        return PillarRule.builder().threshold(r.threshold())
            .comparator(r.comparator() == null ? null : PillarRule.ComparatorEnum.fromValue(r.comparator()))
            .daysPerWeek(r.daysPerWeek()).windowDays(r.windowDays()).startValue(r.startValue()).targetValue(r.targetValue())
            .startDate(r.startDate()).targetDate(r.targetDate())
            .direction(r.direction() == null ? null : PillarRule.DirectionEnum.fromValue(r.direction()))
            .minDataDays(r.minDataDays()).build();
    }
}
```

(Generated enum accessor names — `PillarSource.TypeEnum`, `LifeGoalFrame.fromValue`, `getValue()` — follow openapi-generator's Spring defaults used across this repo; check `target/generated-sources/openapi/.../PillarSource.java` after Task 2 and adjust names if the inner-enum naming differs.)

- [ ] **Step 4: Write the failing API IT**

`feature/lifegoal/LifeGoalApiIT.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LifeGoalDimension;
import io.mrkuhne.mezo.api.dto.LifeGoalPillarInput;
import io.mrkuhne.mezo.api.dto.LifeGoalResponse;
import io.mrkuhne.mezo.api.dto.LifeGoalStatus;
import io.mrkuhne.mezo.api.dto.LifeGoalStatusRequest;
import io.mrkuhne.mezo.api.dto.LifeGoalUpsertRequest;
import io.mrkuhne.mezo.api.dto.PillarKind;
import io.mrkuhne.mezo.api.dto.PillarRule;
import io.mrkuhne.mezo.api.dto.PillarSource;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class LifeGoalApiIT extends ApiIntegrationTest {

    static LifeGoalPillarInput sleepPillar() {
        return LifeGoalPillarInput.builder().label("Alvás").skillKey("recovery").kind(PillarKind.AVERAGE)
            .source(PillarSource.builder().type(PillarSource.TypeEnum.METRIC).key("SLEEP_DURATION_H").build())
            .rule(PillarRule.builder().threshold(new BigDecimal("7.0")).comparator(PillarRule.ComparatorEnum.GTE).windowDays(7).build())
            .build();
    }

    static LifeGoalUpsertRequest kockahas(List<LifeGoalPillarInput> pillars) {
        return LifeGoalUpsertRequest.builder().title("Kockahas").whyText("Erős, egészséges test.")
            .dimension(LifeGoalDimension.HEALTH).startDate(LocalDate.of(2026, 8, 10))
            .targetDate(LocalDate.of(2026, 11, 30)).pillars(pillars).build();
    }

    @Test
    void testCreateLifeGoal_shouldReturnDraftWithPillars_whenValid() {
        LifeGoalResponse res = postForBody("/api/life-goals", kockahas(List.of(sleepPillar())),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        assertThat(res.getStatus()).isEqualTo(LifeGoalStatus.DRAFT);
        assertThat(res.getPillars()).hasSize(1);
        assertThat(res.getPillars().get(0).getSource().getKey()).isEqualTo("SLEEP_DURATION_H");
        assertThat(getForList("/api/life-goals", ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class)).hasSize(1);
    }

    @Test
    void testChangeStatus_shouldActivateThenParkThenReactivate_whenTransitionsLegal() {
        LifeGoalResponse g = postForBody("/api/life-goals", kockahas(List.of(sleepPillar())),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        LifeGoalResponse active = postForBody("/api/life-goals/" + g.getId() + "/status",
            LifeGoalStatusRequest.builder().status(LifeGoalStatus.ACTIVE).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        assertThat(active.getStatus()).isEqualTo(LifeGoalStatus.ACTIVE);
        assertThat(active.getActivatedAt()).isNotNull();
        LifeGoalResponse parked = postForBody("/api/life-goals/" + g.getId() + "/status",
            LifeGoalStatusRequest.builder().status(LifeGoalStatus.PARKED).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        assertThat(parked.getStatus()).isEqualTo(LifeGoalStatus.PARKED);
        LifeGoalResponse again = postForBody("/api/life-goals/" + g.getId() + "/status",
            LifeGoalStatusRequest.builder().status(LifeGoalStatus.ACTIVE).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        assertThat(again.getStatus()).isEqualTo(LifeGoalStatus.ACTIVE);
    }

    @Test
    void testChangeStatus_shouldAllowFourActiveGoals_whenNoCap() {
        for (int i = 0; i < 4; i++) {
            LifeGoalResponse g = postForBody("/api/life-goals", kockahas(List.of(sleepPillar())),
                ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
            postForBody("/api/life-goals/" + g.getId() + "/status",
                LifeGoalStatusRequest.builder().status(LifeGoalStatus.ACTIVE).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        }
        List<LifeGoalResponse> all = getForList("/api/life-goals", ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        assertThat(all).extracting(LifeGoalResponse::getStatus).containsOnly(LifeGoalStatus.ACTIVE);
        assertThat(all).hasSize(4);
    }

    @Test
    void testChangeStatus_shouldReturn409_whenReopeningDoneGoal() {
        LifeGoalResponse g = postForBody("/api/life-goals", kockahas(List.of(sleepPillar())),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        postForBody("/api/life-goals/" + g.getId() + "/status",
            LifeGoalStatusRequest.builder().status(LifeGoalStatus.ACTIVE).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        postForBody("/api/life-goals/" + g.getId() + "/status",
            LifeGoalStatusRequest.builder().status(LifeGoalStatus.DONE).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        ResponseEntity<String> res = exchangeForResponse(org.springframework.http.HttpMethod.POST,
            "/api/life-goals/" + g.getId() + "/status",
            LifeGoalStatusRequest.builder().status(LifeGoalStatus.ACTIVE).build(), ownerAuthHeaders());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertHasRequestError(res.getBody(), "LIFE_GOAL_INVALID_STATUS_TRANSITION");
    }

    @Test
    void testCreateLifeGoal_shouldReturn400_whenPillarSourceUnknown() {
        LifeGoalPillarInput bad = LifeGoalPillarInput.builder().label("X").skillKey("recovery").kind(PillarKind.AVERAGE)
            .source(PillarSource.builder().type(PillarSource.TypeEnum.METRIC).key("NOT_A_METRIC").build()).build();
        ResponseEntity<String> res = exchangeForResponse(org.springframework.http.HttpMethod.POST, "/api/life-goals",
            kockahas(List.of(bad)), ownerAuthHeaders());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(res.getBody(), "pillars", "LIFE_GOAL_UNKNOWN_SIGNAL");
    }

    @Test
    void testGetLifeGoal_shouldReturn404_whenNotOwned() {
        getForBody("/api/life-goals/00000000-0000-0000-0000-000000000001", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }
}
```

(`exchangeForResponse(HttpMethod, String, Object, HttpHeaders)` — confirm the exact parameter order in `ApiIntegrationTest.java:109` and adapt.)

- [ ] **Step 5: Run it, expect FAIL (no controller → 404 on POST)**

Run: `cd backend && ./mvnw -q test -Dtest='LifeGoalApiIT' -Dmezo.test.use-testcontainers=true -Dsurefire.failIfNoSpecifiedTests=false`
Expected: FAIL.

- [ ] **Step 6: Service (CRUD + status) and the first pillar service**

`service/LifeGoalPillarService.java` (validation lives here; Task 4 only adds the habit-key check + tests):

```java
package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.api.dto.LifeGoalPillarInput;
import io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalog;
import io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalogEntry;
import io.mrkuhne.mezo.feature.lifegoal.config.LifeGoalProperties;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.mapper.LifeGoalMapper;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.progression.ProgressionTaxonomy;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Pillar list replace + the closed-catalog / skill / kind / cap validation (spec D4, D10). */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalPillarService {

    private static final Set<String> SKILLS = new HashSet<>();
    static {
        SKILLS.addAll(ProgressionTaxonomy.LIFE);
        SKILLS.addAll(ProgressionTaxonomy.ATHLETIC);
        SKILLS.addAll(ProgressionTaxonomy.MUSCLE);
        SKILLS.add(ProgressionTaxonomy.ROBUSTNESS);
    }

    private final LifeGoalPillarRepository pillarRepository;
    private final LifeGoalMapper mapper;
    private final SignalCatalog catalog;
    private final LifeGoalProperties props;

    /** Validates and persists the whole list, replacing the goal's current pillars. Returns the new rows. */
    @Transactional
    public List<LifeGoalPillarEntity> replace(LifeGoalEntity goal, List<LifeGoalPillarInput> inputs) {
        List<LifeGoalPillarInput> list = inputs == null ? List.of() : inputs;
        validate(list);
        pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(goal.getId()).forEach(pillarRepository::delete);
        List<LifeGoalPillarEntity> saved = new ArrayList<>();
        for (int i = 0; i < list.size(); i++) {
            saved.add(pillarRepository.save(mapper.toPillarEntity(list.get(i), goal, i)));
        }
        pillarRepository.flush();
        return saved;
    }

    public void validate(List<LifeGoalPillarInput> inputs) {
        if (inputs.size() > props.maxPillars()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("LIFE_GOAL_TOO_MANY_PILLARS", "pillars").build(), HttpStatus.BAD_REQUEST);
        }
        for (LifeGoalPillarInput in : inputs) {
            if (!SKILLS.contains(in.getSkillKey())) {
                throw new SystemRuntimeErrorException(
                    SystemMessage.field("LIFE_GOAL_UNKNOWN_SKILL", "pillars").build(), HttpStatus.BAD_REQUEST);
            }
            PillarSourceJson src = mapper.toSourceJson(in.getSource());
            if ("habit".equals(src.type())) {
                continue; // habit keys are checked against the user's habit_def rows (Task 4)
            }
            SignalCatalogEntry entry = catalog.find(src).orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.field("LIFE_GOAL_UNKNOWN_SIGNAL", "pillars").build(), HttpStatus.BAD_REQUEST));
            if (!entry.kinds().contains(in.getKind().getValue())) {
                throw new SystemRuntimeErrorException(
                    SystemMessage.field("LIFE_GOAL_KIND_NOT_ALLOWED", "pillars").build(), HttpStatus.BAD_REQUEST);
            }
        }
    }
}
```

`service/LifeGoalService.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.api.dto.LifeGoalResponse;
import io.mrkuhne.mezo.api.dto.LifeGoalStatus;
import io.mrkuhne.mezo.api.dto.LifeGoalUpsertRequest;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.mapper.LifeGoalMapper;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Life-goal CRUD + lifecycle (spec §4, D7): draft→active, active⇄parked, active/parked→done|archived,
 * done→archived. NO active-count cap. Ownership from the principal; foreign/missing rows are 404.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalService {

    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
        "draft", Set.of("active", "archived"),
        "active", Set.of("parked", "done", "archived"),
        "parked", Set.of("active", "done", "archived"),
        "done", Set.of("archived"),
        "archived", Set.of());

    private final LifeGoalRepository goalRepository;
    private final LifeGoalPillarRepository pillarRepository;
    private final LifeGoalPillarService pillarService;
    private final LifeGoalMapper mapper;

    @Transactional(readOnly = true)
    public List<LifeGoalResponse> list(UUID userId) {
        List<LifeGoalEntity> goals = goalRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId);
        Map<UUID, List<LifeGoalPillarEntity>> byGoal = goals.isEmpty() ? Map.of()
            : pillarRepository.findByGoalIdInAndDeletedFalseOrderByPositionAsc(goals.stream().map(LifeGoalEntity::getId).toList())
                .stream().collect(Collectors.groupingBy(LifeGoalPillarEntity::getGoalId));
        return goals.stream().map(g -> mapper.toResponse(g, byGoal.getOrDefault(g.getId(), List.of()))).toList();
    }

    @Transactional(readOnly = true)
    public LifeGoalResponse get(UUID userId, UUID id) {
        LifeGoalEntity g = requireOwned(userId, id);
        return mapper.toResponse(g, pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(id));
    }

    @Transactional
    public LifeGoalResponse create(UUID userId, LifeGoalUpsertRequest req) {
        validateWindow(req);
        LifeGoalEntity g = new LifeGoalEntity();
        g.setCreatedBy(userId);   // server-side ownership — never from the client
        g.setStatus("draft");
        apply(g, req);
        LifeGoalEntity saved = goalRepository.saveAndFlush(g);
        List<LifeGoalPillarEntity> pillars = pillarService.replace(saved, req.getPillars());
        return mapper.toResponse(saved, pillars);
    }

    @Transactional
    public LifeGoalResponse update(UUID userId, UUID id, LifeGoalUpsertRequest req) {
        validateWindow(req);
        LifeGoalEntity g = requireOwned(userId, id);
        apply(g, req);   // status + pillars are NOT touched here (their endpoints own them)
        return mapper.toResponse(g, pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(id));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        LifeGoalEntity g = requireOwned(userId, id);
        pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(id).forEach(pillarRepository::delete);
        goalRepository.delete(g);
    }

    @Transactional
    public LifeGoalResponse changeStatus(UUID userId, UUID id, LifeGoalStatus target) {
        LifeGoalEntity g = requireOwned(userId, id);
        String to = target.getValue();
        if (!TRANSITIONS.getOrDefault(g.getStatus(), Set.of()).contains(to)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("LIFE_GOAL_INVALID_STATUS_TRANSITION").build(), HttpStatus.CONFLICT);
        }
        g.setStatus(to);
        if ("active".equals(to) && g.getActivatedAt() == null) g.setActivatedAt(Instant.now());
        if ("done".equals(to) || "archived".equals(to)) g.setClosedAt(Instant.now());
        return mapper.toResponse(g, pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(id));
    }

    @Transactional
    public LifeGoalResponse replacePillars(UUID userId, UUID id, List<io.mrkuhne.mezo.api.dto.LifeGoalPillarInput> inputs) {
        LifeGoalEntity g = requireOwned(userId, id);
        return mapper.toResponse(g, pillarService.replace(g, inputs));
    }

    private void apply(LifeGoalEntity g, LifeGoalUpsertRequest req) {
        g.setTitle(req.getTitle());
        g.setWhyText(req.getWhyText());
        g.setFrame(req.getFrame() == null ? "unset" : req.getFrame().getValue());
        g.setDimension(req.getDimension().getValue());
        g.setSecondaryDimension(req.getSecondaryDimension() == null ? null : req.getSecondaryDimension().getValue());
        g.setStartDate(req.getStartDate());
        g.setTargetDate(req.getTargetDate());
        g.setObstacleText(req.getObstacleText());
        g.setIfThenPlans(req.getIfThenPlans() == null ? List.of()
            : req.getIfThenPlans().stream().map(mapper::toPlanJson).toList());
    }

    private static void validateWindow(LifeGoalUpsertRequest req) {
        if (req.getTargetDate() != null && req.getTargetDate().isBefore(req.getStartDate())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "targetDate").build(), HttpStatus.BAD_REQUEST);
        }
    }

    /** Ownership gate: missing and foreign rows are indistinguishable (404). */
    LifeGoalEntity requireOwned(UUID userId, UUID id) {
        return goalRepository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
```

- [ ] **Step 7: Controller**

```java
package io.mrkuhne.mezo.feature.lifegoal.controller;

import io.mrkuhne.mezo.api.controller.LifeGoalApi;
import io.mrkuhne.mezo.api.dto.LifeGoalPillarsRequest;
import io.mrkuhne.mezo.api.dto.LifeGoalProposeRequest;
import io.mrkuhne.mezo.api.dto.LifeGoalProposeResponse;
import io.mrkuhne.mezo.api.dto.LifeGoalResponse;
import io.mrkuhne.mezo.api.dto.LifeGoalStatusRequest;
import io.mrkuhne.mezo.api.dto.LifeGoalUpsertRequest;
import io.mrkuhne.mezo.api.dto.SignalCatalogResponse;
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalProposeService;
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalService;
import io.mrkuhne.mezo.feature.lifegoal.service.LifeGoalSignalService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/life-goals surface (bd mezo-iizd) — thin delegation, ownership from the principal; gated on LIFEGOAL_SWITCH. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalController implements LifeGoalApi {

    private final LifeGoalService lifeGoalService;
    private final LifeGoalProposeService proposeService;
    private final LifeGoalSignalService signalService;
    private final CurrentUserId currentUserId;

    @Override public List<LifeGoalResponse> listLifeGoals() { return lifeGoalService.list(currentUserId.get()); }
    @Override public LifeGoalResponse createLifeGoal(LifeGoalUpsertRequest req) { return lifeGoalService.create(currentUserId.get(), req); }
    @Override public LifeGoalResponse getLifeGoal(UUID id) { return lifeGoalService.get(currentUserId.get(), id); }
    @Override public LifeGoalResponse updateLifeGoal(UUID id, LifeGoalUpsertRequest req) { return lifeGoalService.update(currentUserId.get(), id, req); }
    @Override public void deleteLifeGoal(UUID id) { lifeGoalService.delete(currentUserId.get(), id); }
    @Override public LifeGoalResponse changeLifeGoalStatus(UUID id, LifeGoalStatusRequest req) { return lifeGoalService.changeStatus(currentUserId.get(), id, req.getStatus()); }
    @Override public LifeGoalResponse replaceLifeGoalPillars(UUID id, LifeGoalPillarsRequest req) { return lifeGoalService.replacePillars(currentUserId.get(), id, req.getPillars()); }
    @Override public LifeGoalProposeResponse proposeLifeGoal(LifeGoalProposeRequest req) { return proposeService.propose(currentUserId.get(), req); }
    @Override public SignalCatalogResponse listLifeGoalSignals() { return signalService.catalog(); }
}
```

For this task stub the two not-yet-built collaborators so the controller compiles (Task 4 fills `LifeGoalSignalService`, Task 5 fills `LifeGoalProposeService`):

```java
package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.api.dto.SignalCatalogResponse;
import io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalog;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalSignalService {
    private final SignalCatalog catalog;
    public SignalCatalogResponse catalog() { return SignalCatalogResponse.builder().entries(java.util.List.of()).build(); }
}
```

```java
package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.api.dto.LifeGoalProposeRequest;
import io.mrkuhne.mezo.api.dto.LifeGoalProposeResponse;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalProposeService {
    public LifeGoalProposeResponse propose(UUID userId, LifeGoalProposeRequest req) {
        throw new UnsupportedOperationException("Task 5");
    }
}
```

The 201 on create: the generated `LifeGoalApi` returns `ResponseEntity`-less bodies with the status from the contract's first 2xx code (`@ResponseStatus` is generated when `responses` starts with `'201'`); if the generator in this repo returns 200 instead, check how `createGoal` in `goal.yml` gets its 201 and mirror it.

- [ ] **Step 8: Run the IT, expect PASS**

Run: `cd backend && ./mvnw -q test -Dtest='LifeGoalApiIT,LifeGoalEntityIT' -Dmezo.test.use-testcontainers=true -Dsurefire.failIfNoSpecifiedTests=false`
Expected: 8 tests PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(lifegoal): switch, catalog, CRUD + lifecycle, controller (mezo-iizd.1)"
```

---

### Task 4: Pillar validation against the user's habits + the `/signals` catalog endpoint

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalPillarService.java` (habit-key check)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalSignalService.java` (real catalog mapping)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalPillarApiIT.java`

**Interfaces:**
- Consumes: `HabitCatalogService.activeOrderedWithoutBootstrap(UUID)` → `List<HabitDefEntity>` with `getHabitKey()` (feature/habit; gated `HABIT_SWITCH`, consumed via `ObjectProvider`).
- Produces: `GET /api/life-goals/signals` returning every `SignalCatalog` entry; `PUT /api/life-goals/{id}/pillars` rejecting unknown habit keys with `LIFE_GOAL_UNKNOWN_SIGNAL`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LifeGoalPillarInput;
import io.mrkuhne.mezo.api.dto.LifeGoalPillarsRequest;
import io.mrkuhne.mezo.api.dto.LifeGoalResponse;
import io.mrkuhne.mezo.api.dto.PillarKind;
import io.mrkuhne.mezo.api.dto.PillarSource;
import io.mrkuhne.mezo.api.dto.SignalCatalogResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class LifeGoalPillarApiIT extends ApiIntegrationTest {

    @Test
    void testListLifeGoalSignals_shouldReturnCatalog_whenCalled() {
        SignalCatalogResponse res = getForBody("/api/life-goals/signals", ownerAuthHeaders(), HttpStatus.OK, SignalCatalogResponse.class);
        assertThat(res.getEntries()).hasSizeGreaterThanOrEqualTo(25);
        assertThat(res.getEntries()).anySatisfy(e -> {
            assertThat(e.getLabel()).isEqualTo("Alváshossz");
            assertThat(e.getKinds()).contains(PillarKind.AVERAGE);
        });
    }

    @Test
    void testReplacePillars_shouldReturn400_whenHabitKeyUnknown() {
        LifeGoalResponse g = postForBody("/api/life-goals", LifeGoalApiIT.kockahas(List.of(LifeGoalApiIT.sleepPillar())),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        LifeGoalPillarInput habit = LifeGoalPillarInput.builder().label("Fókuszblokk").skillKey("productivity").kind(PillarKind.HABIT)
            .source(PillarSource.builder().type(PillarSource.TypeEnum.HABIT).habitKey("no-such-habit").build()).build();
        ResponseEntity<String> res = exchangeForResponse(HttpMethod.PUT, "/api/life-goals/" + g.getId() + "/pillars",
            LifeGoalPillarsRequest.builder().pillars(List.of(habit)).build(), ownerAuthHeaders());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(res.getBody(), "pillars", "LIFE_GOAL_UNKNOWN_SIGNAL");
    }

    @Test
    void testReplacePillars_shouldReturn400_whenSixPillars() {
        LifeGoalResponse g = postForBody("/api/life-goals", LifeGoalApiIT.kockahas(List.of()),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        List<LifeGoalPillarInput> six = java.util.Collections.nCopies(6, LifeGoalApiIT.sleepPillar());
        ResponseEntity<String> res = exchangeForResponse(HttpMethod.PUT, "/api/life-goals/" + g.getId() + "/pillars",
            LifeGoalPillarsRequest.builder().pillars(six).build(), ownerAuthHeaders());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(res.getBody(), "pillars", "LIFE_GOAL_TOO_MANY_PILLARS");
    }

    @Test
    void testReplacePillars_shouldReplaceList_whenValid() {
        LifeGoalResponse g = postForBody("/api/life-goals", LifeGoalApiIT.kockahas(List.of(LifeGoalApiIT.sleepPillar())),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        LifeGoalPillarInput protein = LifeGoalPillarInput.builder().label("Fehérje").skillKey("cooking").kind(PillarKind.AVERAGE)
            .source(PillarSource.builder().type(PillarSource.TypeEnum.METRIC).key("DAILY_PROTEIN_G").build()).build();
        LifeGoalResponse res = putForBody("/api/life-goals/" + g.getId() + "/pillars",
            LifeGoalPillarsRequest.builder().pillars(List.of(protein, LifeGoalApiIT.sleepPillar())).build(),
            ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        assertThat(res.getPillars()).extracting(p -> p.getLabel()).containsExactly("Fehérje", "Alvás");
        assertThat(res.getPillars()).extracting(p -> p.getPosition()).containsExactly(0, 1);
    }
}
```

- [ ] **Step 2: Run, expect FAIL (catalog empty; habit key accepted)**

- [ ] **Step 3: Implement**

`LifeGoalSignalService.catalog()`:

```java
    public SignalCatalogResponse catalog() {
        return SignalCatalogResponse.builder().entries(catalog.entries().stream().map(e -> SignalCatalogEntry.builder()
            .source(mapper.toSourceDto(e.source())).label(e.label()).group(e.group())
            .kinds(e.kinds().stream().map(PillarKind::fromValue).toList()).unit(e.unit())
            .defaultSkillKey(e.defaultSkillKey()).build()).toList()).build();
    }
```

(make `LifeGoalMapper.toSourceDto` public; inject `LifeGoalMapper mapper`.)

`LifeGoalPillarService` — add `private final ObjectProvider<HabitCatalogService> habitCatalog;` and replace the `continue` with:

```java
            if ("habit".equals(src.type())) {
                HabitCatalogService svc = habitCatalog.getIfAvailable();
                boolean known = svc != null && svc.activeOrderedWithoutBootstrap(userId).stream()
                    .anyMatch(d -> d.getHabitKey().equals(src.habitKey()));
                if (!known) {
                    throw new SystemRuntimeErrorException(
                        SystemMessage.field("LIFE_GOAL_UNKNOWN_SIGNAL", "pillars").build(), HttpStatus.BAD_REQUEST);
                }
                continue;
            }
```

`validate` and `replace` gain a `UUID userId` first parameter (`replace(goal.getCreatedBy() …)` from `LifeGoalService` — pass `goal.getCreatedBy()`). Confirm the habit def accessor name with `grep -n "getHabitKey\|habitKey" backend/src/main/java/io/mrkuhne/mezo/feature/habit/entity/HabitDefEntity.java`.

- [ ] **Step 4: Run, expect PASS**

Run: `cd backend && ./mvnw -q test -Dtest='LifeGoal*' -Dmezo.test.use-testcontainers=true -Dsurefire.failIfNoSpecifiedTests=false`

- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "feat(lifegoal): habit-key validation + signals catalog endpoint (mezo-iizd.1)"
```

---

### Task 5: AI propose — companion port + LLM adapter + fake branch + template fallback

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/LifeGoalProposePort.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/LifeGoalProposeLlmAdapter.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (sentinel + branch)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java` (+ `LifegoalPropose` record) and `application.yml` (`mezo.companion.lifegoal-propose.max-pillars: 5`)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalTemplateProposer.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalProposeService.java` (real body)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalProposeIT.java`

**Interfaces:**
- Produces (companion): `LifeGoalProposePort.propose(UUID userId, String title, String whyText, String catalogText, Set<String> skillKeys) → Optional<Proposal>` with `record Proposal(String dimension, String secondaryDimension, String frame, String frameNote, String reframedWhy, List<PillarProposal> pillars, List<String> obstacles, List<PlanProposal> plans)`, `record PillarProposal(String catalogId, String label, String kind, String skillKey, int weight, BigDecimal threshold, String comparator, Integer daysPerWeek, BigDecimal startValue, BigDecimal targetValue)`, `record PlanProposal(String ha, String akkor, String triggerSource, String triggerCondition, Integer delayHours)`.
- Produces (lifegoal): `LifeGoalProposeService.propose(UUID, LifeGoalProposeRequest) → LifeGoalProposeResponse` (never throws for AI failure; `source` = `ai` | `template`).
- Dependency direction: lifegoal → companion (port interface only). Companion never imports lifegoal.

- [ ] **Step 1: The port (in companion)**

```java
package io.mrkuhne.mezo.feature.companion;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Propose-only life-goal drafting (mezo-iizd, ADR 0019): the companion's smart model proposes a
 * dimension, an intrinsic/extrinsic frame reading, 3–5 pillars chosen ONLY from the catalog text
 * the caller hands over, obstacles and ha–akkor plans. Absent bean (any gating switch off) or an
 * empty Optional ⇒ the lifegoal slice answers from its rule template. Lives in companion so the
 * dependency stays lifegoal → companion (slice 2 reads MetricSeriesService the same way).
 */
public interface LifeGoalProposePort {

    record PillarProposal(String catalogId, String label, String kind, String skillKey, int weight,
        BigDecimal threshold, String comparator, Integer daysPerWeek, BigDecimal startValue, BigDecimal targetValue) {}

    record PlanProposal(String ha, String akkor, String triggerSource, String triggerCondition, Integer delayHours) {}

    record Proposal(String dimension, String secondaryDimension, String frame, String frameNote, String reframedWhy,
        List<PillarProposal> pillars, List<String> obstacles, List<PlanProposal> plans) {}

    Optional<Proposal> propose(UUID userId, String title, String whyText, String catalogText, Set<String> skillKeys);
}
```

- [ ] **Step 2: Properties + fake sentinel**

`CompanionProperties`: add `@NotNull @Valid LifegoalPropose lifegoalPropose,` to the record header and

```java
    /** AI life-goal proposer (mezo-iizd) — cap on pillars the adapter asks the model for / returns. */
    public record LifegoalPropose(@Min(1) @Max(10) int maxPillars) {}
```

`application.yml` under `mezo.companion:` next to `habit-suggest:`:

```yaml
    lifegoal-propose:
      # AI life-goal proposer (mezo-iizd) — smart-model, propose-only; max pillars per proposal.
      max-pillars: 5
```

`FakeCompanionLlm` — constants next to `SUGGEST_SENTINEL`:

```java
    /** Scripted life-goal proposal (mezo-iizd): {@code [fake-lifegoal-propose:{…}]} planted in the
     *  request TITLE. Greedy object alternative + raw-text fallback (a broken payload exercises the
     *  degrade-to-template path). Default = one valid minimal proposal. */
    public static final Pattern LIFEGOAL_PROPOSE_SENTINEL =
            Pattern.compile("\\[fake-lifegoal-propose:(\\{.*}|[^\\]]*)]", Pattern.DOTALL);
    public static final String LIFEGOAL_PROPOSE_DEFAULT =
            "{\"dimension\":\"health\",\"secondaryDimension\":\"accomplishment\",\"frame\":\"extrinsic\","
            + "\"frameNote\":\"FAKE-KERET\",\"reframedWhy\":\"Erős, egészséges test.\","
            + "\"pillars\":[{\"catalogId\":\"sleep_duration\",\"label\":\"Alvás\",\"kind\":\"average\",\"skillKey\":\"recovery\","
            + "\"weight\":2,\"threshold\":7.0,\"comparator\":\"gte\"}],"
            + "\"obstacles\":[\"Röpi-szezon\"],\"plans\":[{\"ha\":\"röpi-edzést logolsz\",\"akkor\":\"másnap laza kocogás\","
            + "\"triggerSource\":\"sport_session_logged\",\"delayHours\":10}]}";
```

and the branch in `complete(...)` next to the habit-suggest one:

```java
        if (systemPrompt.startsWith(LifeGoalProposeLlmAdapter.PROPOSE_MARKER)) {
            Matcher m = LIFEGOAL_PROPOSE_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : LIFEGOAL_PROPOSE_DEFAULT;
        }
```

- [ ] **Step 3: The adapter (in companion/llm)**

```java
package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.LifeGoalProposePort;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Smart-tier adapter for {@link LifeGoalProposePort} (mezo-iizd, ADR 0019 propose-only). Gated on
 * LIFEGOAL_AI_PROPOSE_SWITCH + COMPANION_SWITCH + LIFEGOAL_SWITCH; absent bean ⇒ template. Strict
 * validation: pillars whose catalogId/skillKey are not in the caller-supplied sets are dropped; the
 * dimension must be one of the six PERMAH keys. The {@code HabitSuggestLlmAdapter#propose} pattern:
 * a failed call or unparseable JSON degrades to {@code Optional.empty()}, never a 5xx.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.LIFEGOAL_AI_PROPOSE_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
        FeaturesConfiguration.LIFEGOAL_SWITCH},
    havingValue = "true")
public class LifeGoalProposeLlmAdapter implements LifeGoalProposePort {

    public static final String PROPOSE_MARKER = "[lifegoal-propose]";

    static final Set<String> DIMENSIONS =
        Set.of("positive_emotion", "engagement", "relationships", "meaning", "accomplishment", "health");
    static final Set<String> KINDS = Set.of("habit", "average", "target", "baseline", "linked");

    private static final String SYSTEM_PROMPT = PROPOSE_MARKER + """
            . Daniel életcél-tervezője vagy. Kapsz egy célt és egy „miért”-et. Feladatod:
            1) Sorold be egy PERMAH-dimenzióba (positive_emotion|engagement|relationships|meaning|accomplishment|health),
               opcionális másodlagossal.
            2) Ítéld meg a keretet: ha a „miért” külső (kinézet, pénz, státusz) → frame="extrinsic", és adj
               egy belső (egészség/képesség/kapcsolat) átfogalmazást reframedWhy-ban; különben frame="intrinsic",
               reframedWhy=null. frameNote: egy magyar mondat Mezo hangján.
            3) Javasolj legfeljebb %d pillért KIZÁRÓLAG a [Jelek] listából (catalogId), a listában engedett
               fajtával (kind) és skill-lel (skillKey a [Skillek] listából). threshold/comparator az átlag és
               szokás fajtához, daysPerWeek a szokáshoz, startValue/targetValue a cél-értékhez.
            4) 1–3 akadály és 1–3 ha–akkor terv; a triggerSource csak sport_session_logged, checkin_energy_lte,
               ritual_missed vagy null lehet.
            Válaszolj KIZÁRÓLAG egy JSON objektummal:
            {"dimension":"...","secondaryDimension":null,"frame":"...","frameNote":"...","reframedWhy":null,
             "pillars":[{"catalogId":"...","label":"...","kind":"...","skillKey":"...","weight":1,"threshold":null,
             "comparator":null,"daysPerWeek":null,"startValue":null,"targetValue":null}],
             "obstacles":["..."],"plans":[{"ha":"...","akkor":"...","triggerSource":null,"triggerCondition":null,"delayHours":null}]}""";

    private final CompanionLlm companionLlm;
    private final CompanionProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ObjectMapper objectMapper;

    @Override
    public Optional<Proposal> propose(UUID userId, String title, String whyText, String catalogText, Set<String> skillKeys) {
        String prompt = String.format(Locale.ROOT, SYSTEM_PROMPT, properties.lifegoalPropose().maxPillars());
        String context = "[Cél]\n" + title + "\n[Miért]\n" + (whyText == null ? "" : whyText)
            + "\n[Skillek]\n" + String.join(", ", skillKeys) + "\n[Jelek]\n" + catalogText;
        String raw;
        try {
            raw = llmCallContextHolder.runWith(
                new LlmCallContext("lifegoal_propose", "propose", null, null),
                () -> companionLlm.completeSmart(prompt, context));
        } catch (Exception e) {
            log.warn("Life-goal proposal LLM call failed for user {}", userId, e);
            return Optional.empty();
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) return Optional.empty();
        Proposal p;
        try {
            p = objectMapper.readValue(raw.substring(start, end + 1), Proposal.class);
        } catch (Exception e) {
            log.warn("Life-goal proposal was not parseable JSON — dropping: {}", raw, e);
            return Optional.empty();
        }
        if (p.dimension() == null || !DIMENSIONS.contains(p.dimension())) return Optional.empty();
        Set<String> catalogIds = Set.of(catalogText.split("\n")).stream()
            .map(line -> line.split(" · ", 2)[0].trim()).collect(java.util.stream.Collectors.toSet());
        List<PillarProposal> pillars = (p.pillars() == null ? List.<PillarProposal>of() : p.pillars()).stream()
            .filter(Objects::nonNull)
            .filter(x -> x.catalogId() != null && catalogIds.contains(x.catalogId()))
            .filter(x -> x.kind() != null && KINDS.contains(x.kind()))
            .filter(x -> x.skillKey() != null && skillKeys.contains(x.skillKey()))
            .filter(x -> x.label() != null && !x.label().isBlank())
            .limit(properties.lifegoalPropose().maxPillars())
            .toList();
        return Optional.of(new Proposal(p.dimension(),
            p.secondaryDimension() != null && DIMENSIONS.contains(p.secondaryDimension()) ? p.secondaryDimension() : null,
            "extrinsic".equals(p.frame()) ? "extrinsic" : "intrinsic", p.frameNote(), p.reframedWhy(), pillars,
            p.obstacles() == null ? List.of() : p.obstacles(), p.plans() == null ? List.of() : p.plans()));
    }
}
```

- [ ] **Step 4: The template proposer (in lifegoal)**

```java
package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.feature.companion.LifeGoalProposePort.PillarProposal;
import io.mrkuhne.mezo.feature.companion.LifeGoalProposePort.PlanProposal;
import io.mrkuhne.mezo.feature.companion.LifeGoalProposePort.Proposal;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Component;

/**
 * Rule-based fallback for the AI proposer (spec §7): picks a dimension from title/why keywords and
 * hands back that dimension's stock pillar set. Deterministic, never empty — the wizard always has
 * something to edit even with the LLM off. Not a @Service: it is pure and stateless.
 */
@Component
public class LifeGoalTemplateProposer {

    private static PillarProposal avg(String id, String label, String skill, String threshold) {
        return new PillarProposal(id, label, "average", skill, 1, new BigDecimal(threshold), "gte", null, null, null);
    }
    private static PillarProposal habit(String id, String label, String skill, int days) {
        return new PillarProposal(id, label, "habit", skill, 1, null, null, days, null, null);
    }
    private static PillarProposal base(String id, String label, String skill) {
        return new PillarProposal(id, label, "baseline", skill, 1, null, null, null, null, null);
    }

    public Proposal propose(String title, String whyText) {
        String t = ((title == null ? "" : title) + " " + (whyText == null ? "" : whyText)).toLowerCase(Locale.ROOT);
        String dim = dimensionOf(t);
        boolean extrinsic = t.contains("nézzek ki") || t.contains("kinéz") || t.contains("strand") || t.contains("pénz") || t.contains("státusz");
        List<PillarProposal> pillars = switch (dim) {
            case "health" -> List.of(avg("sleep_duration", "Alvás", "recovery", "7.0"), avg("protein", "Fehérje", "cooking", "160"),
                habit("gym_volume", "Edzés", "max_strength", 4), habit("ritual_closed", "Fegyelem · napzárás", "mindset", 6));
            case "accomplishment" -> List.of(base("activity_productivity", "Fejlesztés", "productivity"),
                habit("activity_learning", "Tanulás", "learning", 2), habit("ritual_closed", "Napzárás", "mindset", 5));
            case "relationships" -> List.of(base("social_mentions", "Társas élet", "connection"),
                habit("activity_connection", "Tudatos találkozó", "connection", 1), avg("ring_mozgas", "Mozgás-gyűrű", "recovery", "60"));
            case "engagement" -> List.of(base("activity_learning", "Elmélyülés", "learning"), habit("ritual_closed", "Napzárás", "mindset", 5));
            case "positive_emotion" -> List.of(avg("checkin_mental", "Hangulat", "mindfulness", "7"), avg("sleep_duration", "Alvás", "recovery", "7.0"));
            default -> List.of(habit("ritual_closed", "Napzárás", "mindset", 5), avg("checkin_mental", "Hangulat", "mindfulness", "7"));
        };
        return new Proposal(dim, null, extrinsic ? "extrinsic" : "intrinsic",
            extrinsic ? "Ez külső keret — a belső (egészség, képesség) tartósabb motiváció." : "Belső keret — ez tartós motiváció.",
            extrinsic ? "Erősebb, egészségesebb leszek — a kinézet ennek a jele, nem a célja." : null,
            pillars, List.of("Fáradt esték, kimaradó napzárás"),
            List.of(new PlanProposal("kimarad a napzárás", "másnap reggel 2 percben pótolom", "ritual_missed", null, 10)));
    }

    static String dimensionOf(String t) {
        if (t.contains("kockahas") || t.contains("fogy") || t.contains("egészség") || t.contains("maraton") || t.contains("alv")) return "health";
        if (t.contains("barát") || t.contains("kapcsolat") || t.contains("társ") || t.contains("család")) return "relationships";
        if (t.contains("hustle") || t.contains("bevétel") || t.contains("karrier") || t.contains("projekt") || t.contains("app")) return "accomplishment";
        if (t.contains("tanul") || t.contains("zene") || t.contains("flow") || t.contains("olvas")) return "engagement";
        if (t.contains("hangulat") || t.contains("nyugodt") || t.contains("öröm")) return "positive_emotion";
        return "meaning";
    }
}
```

- [ ] **Step 5: The service**

Replace the Task 3 stub:

```java
package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.api.dto.IfThenPlan;
import io.mrkuhne.mezo.api.dto.LifeGoalDimension;
import io.mrkuhne.mezo.api.dto.LifeGoalFrame;
import io.mrkuhne.mezo.api.dto.LifeGoalPillarInput;
import io.mrkuhne.mezo.api.dto.LifeGoalProposeRequest;
import io.mrkuhne.mezo.api.dto.LifeGoalProposeResponse;
import io.mrkuhne.mezo.api.dto.PillarKind;
import io.mrkuhne.mezo.api.dto.PillarRule;
import io.mrkuhne.mezo.api.dto.PlanTrigger;
import io.mrkuhne.mezo.feature.companion.LifeGoalProposePort;
import io.mrkuhne.mezo.feature.companion.LifeGoalProposePort.Proposal;
import io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalog;
import io.mrkuhne.mezo.feature.lifegoal.mapper.LifeGoalMapper;
import io.mrkuhne.mezo.feature.progression.ProgressionTaxonomy;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** AI port first, template second — never empty, never a 5xx on AI trouble (spec §7). */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalProposeService {

    private final ObjectProvider<LifeGoalProposePort> port;
    private final LifeGoalTemplateProposer template;
    private final SignalCatalog catalog;
    private final LifeGoalMapper mapper;

    public LifeGoalProposeResponse propose(UUID userId, LifeGoalProposeRequest req) {
        Set<String> skills = new HashSet<>(ProgressionTaxonomy.LIFE);
        skills.addAll(ProgressionTaxonomy.ATHLETIC);
        LifeGoalProposePort p = port.getIfAvailable();
        Optional<Proposal> ai = p == null ? Optional.empty()
            : p.propose(userId, req.getTitle(), req.getWhyText(), catalog.promptText(), skills);
        Proposal chosen = ai.filter(x -> !x.pillars().isEmpty()).orElseGet(() -> template.propose(req.getTitle(), req.getWhyText()));
        return toResponse(chosen, ai.isPresent() && !ai.get().pillars().isEmpty() ? "ai" : "template");
    }

    private LifeGoalProposeResponse toResponse(Proposal p, String source) {
        List<LifeGoalPillarInput> pillars = p.pillars().stream()
            .flatMap(x -> catalog.byId(x.catalogId()).stream().map(e -> LifeGoalPillarInput.builder()
                .label(x.label()).skillKey(x.skillKey()).kind(PillarKind.fromValue(x.kind())).weight(x.weight() < 1 ? 1 : Math.min(3, x.weight()))
                .active(true).source(mapper.toSourceDto(e.source()))
                .rule(PillarRule.builder().threshold(x.threshold())
                    .comparator(x.comparator() == null ? null : PillarRule.ComparatorEnum.fromValue(x.comparator()))
                    .daysPerWeek(x.daysPerWeek()).windowDays("average".equals(x.kind()) ? 7 : "baseline".equals(x.kind()) ? 28 : null)
                    .minDataDays("baseline".equals(x.kind()) ? 14 : null).startValue(x.startValue()).targetValue(x.targetValue()).build())
                .build()))
            .toList();
        return LifeGoalProposeResponse.builder()
            .dimension(LifeGoalDimension.fromValue(p.dimension()))
            .secondaryDimension(p.secondaryDimension() == null ? null : LifeGoalDimension.fromValue(p.secondaryDimension()))
            .frame(LifeGoalFrame.fromValue(p.frame())).frameNote(p.frameNote()).reframedWhy(p.reframedWhy())
            .pillars(pillars).obstacles(p.obstacles())
            .ifThenPlans(p.plans().stream().map(pl -> IfThenPlan.builder().ha(pl.ha()).akkor(pl.akkor())
                .trigger(pl.triggerSource() == null ? null : PlanTrigger.builder().source(pl.triggerSource())
                    .condition(pl.triggerCondition()).delayHours(pl.delayHours()).build()).build()).toList())
            .source(LifeGoalProposeResponse.SourceEnum.fromValue(source))
            .build();
    }
}
```

- [ ] **Step 6: Write the IT**

```java
package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LifeGoalDimension;
import io.mrkuhne.mezo.api.dto.LifeGoalFrame;
import io.mrkuhne.mezo.api.dto.LifeGoalProposeRequest;
import io.mrkuhne.mezo.api.dto.LifeGoalProposeResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** Runs against the companion-fake LLM profile (the test context's default). */
class LifeGoalProposeIT extends ApiIntegrationTest {

    @Test
    void testPropose_shouldReturnAiProposal_whenFakeAnswersDefault() {
        LifeGoalProposeResponse res = postForBody("/api/life-goals/propose",
            LifeGoalProposeRequest.builder().title("Kockahas").whyText("hogy jól nézzek ki").build(),
            ownerAuthHeaders(), HttpStatus.OK, LifeGoalProposeResponse.class);
        assertThat(res.getSource()).isEqualTo(LifeGoalProposeResponse.SourceEnum.AI);
        assertThat(res.getDimension()).isEqualTo(LifeGoalDimension.HEALTH);
        assertThat(res.getFrame()).isEqualTo(LifeGoalFrame.EXTRINSIC);
        assertThat(res.getPillars()).hasSize(1);
        assertThat(res.getPillars().get(0).getSource().getKey()).isEqualTo("SLEEP_DURATION_H");
        assertThat(res.getPillars().get(0).getRule().getWindowDays()).isEqualTo(7);
        assertThat(res.getIfThenPlans()).hasSize(1);
        assertThat(res.getIfThenPlans().get(0).getTrigger().getSource()).isEqualTo("sport_session_logged");
    }

    @Test
    void testPropose_shouldFallBackToTemplate_whenFakeAnswerBroken() {
        LifeGoalProposeResponse res = postForBody("/api/life-goals/propose",
            LifeGoalProposeRequest.builder().title("Kockahas [fake-lifegoal-propose:not-json]").build(),
            ownerAuthHeaders(), HttpStatus.OK, LifeGoalProposeResponse.class);
        assertThat(res.getSource()).isEqualTo(LifeGoalProposeResponse.SourceEnum.TEMPLATE);
        assertThat(res.getDimension()).isEqualTo(LifeGoalDimension.HEALTH);
        assertThat(res.getPillars()).hasSize(4);
    }

    @Test
    void testPropose_shouldDropUnknownCatalogId_whenFakeScriptsOne() {
        String script = "[fake-lifegoal-propose:{\"dimension\":\"health\",\"frame\":\"intrinsic\",\"pillars\":["
            + "{\"catalogId\":\"nope\",\"label\":\"X\",\"kind\":\"average\",\"skillKey\":\"recovery\",\"weight\":1},"
            + "{\"catalogId\":\"protein\",\"label\":\"Fehérje\",\"kind\":\"average\",\"skillKey\":\"cooking\",\"weight\":1,\"threshold\":160,\"comparator\":\"gte\"}],"
            + "\"obstacles\":[],\"plans\":[]}]";
        LifeGoalProposeResponse res = postForBody("/api/life-goals/propose",
            LifeGoalProposeRequest.builder().title("Kockahas " + script).build(),
            ownerAuthHeaders(), HttpStatus.OK, LifeGoalProposeResponse.class);
        assertThat(res.getSource()).isEqualTo(LifeGoalProposeResponse.SourceEnum.AI);
        assertThat(res.getPillars()).hasSize(1);
        assertThat(res.getPillars().get(0).getLabel()).isEqualTo("Fehérje");
    }
}
```

(The title is the sentinel channel — the fake matches `userMessage`, which carries `[Cél]\n<title>`; `LifeGoalProposeRequest.title` has `maxLength: 120`, so the scripted JSON in the third test must stay under that — shorten labels if the contract rejects it, or raise the fragment's `maxLength` to 400 and regenerate.)

- [ ] **Step 7: Run, expect PASS**

Run: `cd backend && ./mvnw -q test -Dtest='LifeGoalProposeIT' -Dmezo.test.use-testcontainers=true -Dsurefire.failIfNoSpecifiedTests=false`

- [ ] **Step 8: Commit**

```bash
git add backend/src
git commit -m "feat(lifegoal): AI propose port + adapter + template fallback (mezo-iizd.1)"
```

---

### Task 6: Demo seed (demofixtures) — the three goals

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalSeedData.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalSeedDataIT.java`

- [ ] **Step 1: Seed**

```java
package io.mrkuhne.mezo.feature.lifegoal;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.lifegoal.entity.IfThenPlanJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PlanTriggerJson;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import java.math.BigDecimal;
import java.time.Instant;
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
 * Seeds the three brainstorm goals (Kockahas · Side hustle · Az utolsó barátnő) + one parked
 * (Spanyol B2) for the owner as opt-in demo data — {@code @Profile("demofixtures")} only, the
 * {@code GoalSeedData} idiom. Idempotent: no-op if any life goal exists.
 */
@Component
@Profile("demofixtures")
@Order(125) // after GoalSeedData (120) — the Kockahas linked pillar reads the weight goal
@RequiredArgsConstructor
public class LifeGoalSeedData implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final OwnerProperties ownerProperties;
    private final LifeGoalRepository goalRepository;
    private final LifeGoalPillarRepository pillarRepository;

    @Override @Transactional public void run(String... args) { run(); }

    @Transactional
    public void run() {
        if (goalRepository.count() > 0) return;
        AppUserEntity owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow();
        UUID uid = owner.getId();

        LifeGoalEntity kockahas = goal(uid, "Kockahas", "Erős, egészséges test, ami bírja a röpit és a hétköznapokat — a kockahas ennek a jele, nem a célja.",
            "intrinsic", "health", "accomplishment", "active", LocalDate.of(2026, 8, 10), LocalDate.of(2026, 11, 30),
            "Késő esti nassolás",
            List.of(new IfThenPlanJson("21 után éhes vagyok", "túró + fahéj, nem nassolás", null),
                new IfThenPlanJson("lábnap után fáradt vagyok", "20:30 lefekvés, telefon a konyhában", new PlanTriggerJson("sport_session_logged", null, 4))));
        pillar(kockahas, 0, "Testkompozíció", "recovery", "linked", 2, new PillarSourceJson("weight_goal", null, null, null, null, null), empty());
        pillar(kockahas, 1, "Fehérje", "cooking", "average", 1, metric("DAILY_PROTEIN_G"), avg("160", "gte"));
        pillar(kockahas, 2, "Alvás", "recovery", "average", 2, metric("SLEEP_DURATION_H"), avg("7.0", "gte"));
        pillar(kockahas, 3, "Edzés", "max_strength", "habit", 1, metric("GYM_VOLUME_KG"), habit("1", 4));
        pillar(kockahas, 4, "Fegyelem · napzárás", "mindset", "habit", 1, metric("RITUAL_CLOSED"), habit("1", 6));

        LifeGoalEntity hustle = goal(uid, "Side hustle", "Egy saját termék, ami mások napját is rendbe teszi — és ami nem függ egy munkáltatótól.",
            "intrinsic", "accomplishment", "engagement", "active", LocalDate.of(2026, 8, 24), null, "Este nincs energia a mély munkára",
            List.of(new IfThenPlanJson("este 20:00 és nincs edzés", "90 perc mély munka, Slack lenémítva", null),
                new IfThenPlanJson("új ötlet jön", "a bd-be írom, nem kezdem el aznap", null)));
        pillar(hustle, 0, "Fejlesztés", "productivity", "baseline", 2, new PillarSourceJson("activity", null, "productivity", "minutes", null, null), base());
        pillar(hustle, 1, "Tanulás", "learning", "habit", 1, new PillarSourceJson("activity", null, "learning", "count", null, null), habit("1", 2));
        pillar(hustle, 2, "Bevétel", "financial", "target", 1, new PillarSourceJson("activity", null, "financial", "huf", null, null),
            new PillarRuleJson(null, null, null, null, BigDecimal.ZERO, new BigDecimal("50000"), LocalDate.of(2026, 9, 1), LocalDate.of(2026, 12, 31), "up", null));

        LifeGoalEntity baratno = goal(uid, "Az utolsó barátnő", "Olyan ember lenni, aki mellett jó lenni — és akkor jön, akinek jó.",
            "intrinsic", "relationships", "positive_emotion", "active", LocalDate.of(2026, 8, 1), null, "Hétvégi terv nélküli napok",
            List.of(new IfThenPlanJson("hétvégén nincs terv", "hívok valakit szombat délelőtt, nem várok", null),
                new IfThenPlanJson("tetszik valaki", "egy héten belül kérdezek, nem elemzek", null)));
        pillar(baratno, 0, "Társas élet", "connection", "baseline", 2, new PillarSourceJson("social_mentions", null, null, null, null, null), base());
        pillar(baratno, 1, "Tudatos ismerkedés", "connection", "habit", 1, new PillarSourceJson("activity", null, "connection", "count", null, null), habit("1", 1));
        pillar(baratno, 2, "Egészséges életmód", "recovery", "average", 1, new PillarSourceJson("needs_ring", null, null, null, null, "mozgas"), avg("60", "gte"));

        goal(uid, "Spanyol B2", "Hogy a nyaralás ne fordítóval menjen.", "intrinsic", "engagement", null, "parked",
            LocalDate.of(2026, 6, 1), null, null, List.of());
        pillarRepository.flush();
    }

    private LifeGoalEntity goal(UUID uid, String title, String why, String frame, String dim, String dim2, String status,
            LocalDate start, LocalDate target, String obstacle, List<IfThenPlanJson> plans) {
        LifeGoalEntity g = new LifeGoalEntity();
        g.setCreatedBy(uid); g.setTitle(title); g.setWhyText(why); g.setFrame(frame); g.setDimension(dim);
        g.setSecondaryDimension(dim2); g.setStatus(status); g.setStartDate(start); g.setTargetDate(target);
        g.setObstacleText(obstacle); g.setIfThenPlans(plans);
        if ("active".equals(status)) g.setActivatedAt(Instant.now());
        return goalRepository.save(g);
    }

    private void pillar(LifeGoalEntity g, int pos, String label, String skill, String kind, int weight, PillarSourceJson src, PillarRuleJson rule) {
        LifeGoalPillarEntity p = new LifeGoalPillarEntity();
        p.setCreatedBy(g.getCreatedBy()); p.setGoalId(g.getId()); p.setPosition(pos); p.setLabel(label);
        p.setSkillKey(skill); p.setKind(kind); p.setWeight(weight); p.setSource(src); p.setRule(rule);
        pillarRepository.save(p);
    }

    private static PillarSourceJson metric(String key) { return new PillarSourceJson("metric", key, null, null, null, null); }
    private static PillarRuleJson empty() { return new PillarRuleJson(null, null, null, null, null, null, null, null, null, null); }
    private static PillarRuleJson avg(String threshold, String cmp) { return new PillarRuleJson(new BigDecimal(threshold), cmp, null, 7, null, null, null, null, null, null); }
    private static PillarRuleJson habit(String threshold, int days) { return new PillarRuleJson(new BigDecimal(threshold), "gte", days, null, null, null, null, null, null, null); }
    private static PillarRuleJson base() { return new PillarRuleJson(null, null, null, 28, null, null, null, null, "up", 14); }
}
```

- [ ] **Step 2: IT**

```java
package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalPillarRepository;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles({"test", "demodata", "demofixtures"})
class LifeGoalSeedDataIT extends AbstractIntegrationTest {

    @Autowired private LifeGoalSeedData seed;
    @Autowired private LifeGoalRepository goals;
    @Autowired private LifeGoalPillarRepository pillars;

    @Test
    void testRun_shouldSeedFourGoalsElevenPillars_whenEmpty() {
        seed.run();
        assertThat(goals.count()).isEqualTo(4);
        assertThat(pillars.count()).isEqualTo(11);
        seed.run();
        assertThat(goals.count()).isEqualTo(4);
    }
}
```

(Check how `GoalSeedDataIT`/`RunningSeedData` tests activate `demofixtures` — mirror their `@ActiveProfiles` exactly instead of the list above if it differs.)

- [ ] **Step 3: Run, expect PASS; commit**

```bash
git add backend/src
git commit -m "feat(lifegoal): demofixtures seed — Kockahas, Side hustle, Az utolsó barátnő, Spanyol B2 (mezo-iizd.1)"
```

---

### Task 7: FE data layer — API client, dual-mode hooks, mock seed, MSW, labels

**Files:**
- Create: `frontend/src/data/lifegoal/lifegoalApi.ts`, `frontend/src/data/lifegoal/lifegoalMock.ts`, `frontend/src/data/lifegoal/lifegoalHooks.ts`
- Modify: `frontend/src/data/hooks.ts` (barrel), `frontend/src/test/msw/handlers.ts` (default fixtures)
- Create: `frontend/src/features/me/logic/lifegoalLabels.ts`
- Test: `frontend/src/data/lifegoal/lifegoalHooks.test.tsx`

**Interfaces:**
- Produces: `useLifeGoals(): { goals: LifeGoalResponse[]; isPending; isError; refetch }`, `useLifeGoal(id: string | undefined): { goal: LifeGoalResponse | null; isPending }`, `useLifeGoalMutations(): { create(req, opts?), update(id, req), changeStatus(id, status), replacePillars(id, pillars), remove(id), pending }`, `useLifeGoalPropose(): { propose(req) → Promise<LifeGoalProposeResponse>, pending }`, `useSignalCatalog(): { entries: SignalCatalogEntry[] }`; `LIFE_GOALS_KEY = ['lifeGoals']`; labels `DIMENSIONS: Record<LifeGoalDimension, { label; wash: MozaikWash; icon: ClayIconName; cssClass }>`, `KIND_LABEL`, `STATUS_LABEL`.

- [ ] **Step 1: API client**

```ts
// ============================================================
// Mezo · lifegoalApi — REST client for the life-goal slice (mezo-iizd.1).
// ============================================================
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

export type LifeGoalResponse = components['schemas']['LifeGoalResponse']
export type LifeGoalUpsertRequest = components['schemas']['LifeGoalUpsertRequest']
export type LifeGoalPillarInput = components['schemas']['LifeGoalPillarInput']
export type LifeGoalPillarResponse = components['schemas']['LifeGoalPillarResponse']
export type LifeGoalStatus = components['schemas']['LifeGoalStatus']
export type LifeGoalDimension = components['schemas']['LifeGoalDimension']
export type LifeGoalFrame = components['schemas']['LifeGoalFrame']
export type PillarKind = components['schemas']['PillarKind']
export type PillarSource = components['schemas']['PillarSource']
export type PillarRule = components['schemas']['PillarRule']
export type IfThenPlan = components['schemas']['IfThenPlan']
export type LifeGoalProposeRequest = components['schemas']['LifeGoalProposeRequest']
export type LifeGoalProposeResponse = components['schemas']['LifeGoalProposeResponse']
export type SignalCatalogEntry = components['schemas']['SignalCatalogEntry']
type SignalCatalogResponse = components['schemas']['SignalCatalogResponse']

const json = (body: unknown) => JSON.stringify(body)

export const lifegoalApi = {
  list: () => apiFetch<LifeGoalResponse[]>('/api/life-goals'),
  get: (id: string) => apiFetch<LifeGoalResponse>(`/api/life-goals/${id}`),
  create: (body: LifeGoalUpsertRequest) =>
    apiFetch<LifeGoalResponse>('/api/life-goals', { method: 'POST', body: json(body) }),
  update: (id: string, body: LifeGoalUpsertRequest) =>
    apiFetch<LifeGoalResponse>(`/api/life-goals/${id}`, { method: 'PUT', body: json(body) }),
  remove: (id: string) => apiFetch<void>(`/api/life-goals/${id}`, { method: 'DELETE' }),
  changeStatus: (id: string, status: LifeGoalStatus) =>
    apiFetch<LifeGoalResponse>(`/api/life-goals/${id}/status`, { method: 'POST', body: json({ status }) }),
  replacePillars: (id: string, pillars: LifeGoalPillarInput[]) =>
    apiFetch<LifeGoalResponse>(`/api/life-goals/${id}/pillars`, { method: 'PUT', body: json({ pillars }) }),
  propose: (body: LifeGoalProposeRequest) =>
    apiFetch<LifeGoalProposeResponse>('/api/life-goals/propose', { method: 'POST', body: json(body) }),
  signals: () => apiFetch<SignalCatalogResponse>('/api/life-goals/signals'),
}
```

- [ ] **Step 2: Mock seed** (`lifegoalMock.ts`) — the three prototype goals as `LifeGoalResponse[]`, ids `lg-kockahas`, `lg-hustle`, `lg-baratno`, `lg-spanyol` (parked), pillars mirroring `LifeGoalSeedData` field for field (labels, kinds, sources, rules, positions), `ifThenPlans` with the same texts; plus `MOCK_SIGNAL_CATALOG: SignalCatalogEntry[]` (the 28 catalog rows — copy `SignalCatalog.ENTRIES` label/group/kinds/unit/defaultSkillKey verbatim) and `mockPropose(req): LifeGoalProposeResponse` returning the template proposer's `health` branch for any title containing "kocka"/"maraton"/"fogy", `accomplishment` for "hustle"/"app", `relationships` for "barát", else `meaning`; `frame: 'extrinsic'` + `reframedWhy` when the why contains "nézzek ki" / "strand" / "pénz". Export `MOCK_LIFE_GOALS`.

- [ ] **Step 3: Hooks**

```ts
// ============================================================
// Mezo · lifegoalHooks — dual-mode reads + mutations for life goals (mezo-iizd.1).
// Mock mode keeps an in-memory list in the QueryClient cache so the wizard/status flows work
// without a backend; real mode invalidates ['lifeGoals'] after every write.
// ============================================================
import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { DEFAULT_QUERY_STALE_TIME_MS, useDualQuery } from '@/data/useDualQuery'
import {
  lifegoalApi, type LifeGoalPillarInput, type LifeGoalProposeRequest, type LifeGoalProposeResponse,
  type LifeGoalResponse, type LifeGoalStatus, type LifeGoalUpsertRequest, type SignalCatalogEntry,
} from '@/data/lifegoal/lifegoalApi'
import { MOCK_LIFE_GOALS, MOCK_SIGNAL_CATALOG, mockPropose } from '@/data/lifegoal/lifegoalMock'

export const LIFE_GOALS_KEY = ['lifeGoals'] as const
export const SIGNAL_CATALOG_KEY = ['lifeGoalSignals'] as const

export function useLifeGoals() {
  const q = useDualQuery<LifeGoalResponse[]>({
    queryKey: LIFE_GOALS_KEY, mockData: MOCK_LIFE_GOALS, realFetch: lifegoalApi.list, realEmpty: [],
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { goals: q.data, isPending: q.isPending, isError: q.isError, refetch: q.refetch }
}

export function useLifeGoal(id: string | undefined) {
  const { goals, isPending } = useLifeGoals()
  return { goal: id ? goals.find((g) => g.id === id) ?? null : null, isPending }
}

export function useSignalCatalog() {
  const q = useDualQuery<SignalCatalogEntry[]>({
    queryKey: SIGNAL_CATALOG_KEY, mockData: MOCK_SIGNAL_CATALOG,
    realFetch: async () => (await lifegoalApi.signals()).entries, realEmpty: [],
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { entries: q.data, isPending: q.isPending }
}

function mockId() { return `lg-${Math.random().toString(36).slice(2, 8)}` }

export function useLifeGoalMutations() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const patch = (fn: (list: LifeGoalResponse[]) => LifeGoalResponse[]) =>
    qc.setQueryData<LifeGoalResponse[]>(LIFE_GOALS_KEY, (cur) => fn(cur ?? MOCK_LIFE_GOALS))
  const invalidate = () => { if (!mock) void qc.invalidateQueries({ queryKey: LIFE_GOALS_KEY }) }

  const create = useMutation({
    mutationFn: async (req: LifeGoalUpsertRequest): Promise<LifeGoalResponse> => {
      if (mock) {
        const g: LifeGoalResponse = {
          id: mockId(), title: req.title, whyText: req.whyText, frame: req.frame ?? 'unset',
          dimension: req.dimension, secondaryDimension: req.secondaryDimension, status: 'draft',
          startDate: req.startDate, targetDate: req.targetDate, obstacleText: req.obstacleText,
          ifThenPlans: req.ifThenPlans ?? [],
          pillars: (req.pillars ?? []).map((p, i) => ({ ...p, id: mockId(), position: i, weight: p.weight ?? 1, active: p.active ?? true })),
        }
        patch((l) => [g, ...l]); return g
      }
      return lifegoalApi.create(req)
    },
    onSuccess: invalidate,
  })
  const changeStatus = useMutation({
    mutationFn: async (v: { id: string; status: LifeGoalStatus }) => {
      if (mock) {
        patch((l) => l.map((g) => (g.id === v.id ? { ...g, status: v.status,
          activatedAt: v.status === 'active' ? (g.activatedAt ?? new Date().toISOString()) : g.activatedAt } : g)))
        return
      }
      await lifegoalApi.changeStatus(v.id, v.status)
    },
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: async (v: { id: string; req: LifeGoalUpsertRequest }) => {
      if (mock) { patch((l) => l.map((g) => (g.id === v.id ? { ...g, ...v.req, ifThenPlans: v.req.ifThenPlans ?? [], pillars: g.pillars } : g))); return }
      await lifegoalApi.update(v.id, v.req)
    },
    onSuccess: invalidate,
  })
  const replacePillars = useMutation({
    mutationFn: async (v: { id: string; pillars: LifeGoalPillarInput[] }) => {
      if (mock) {
        patch((l) => l.map((g) => (g.id === v.id ? { ...g, pillars: v.pillars.map((p, i) => ({ ...p, id: mockId(), position: i, weight: p.weight ?? 1, active: p.active ?? true })) } : g)))
        return
      }
      await lifegoalApi.replacePillars(v.id, v.pillars)
    },
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => { if (mock) { patch((l) => l.filter((g) => g.id !== id)); return } await lifegoalApi.remove(id) },
    onSuccess: invalidate,
  })

  return {
    create: useCallback((req: LifeGoalUpsertRequest, opts?: { onSuccess?: (g: LifeGoalResponse) => void }) =>
      create.mutate(req, { onSuccess: opts?.onSuccess }), [create]),
    update: useCallback((id: string, req: LifeGoalUpsertRequest) => update.mutate({ id, req }), [update]),
    changeStatus: useCallback((id: string, status: LifeGoalStatus) => changeStatus.mutate({ id, status }), [changeStatus]),
    replacePillars: useCallback((id: string, pillars: LifeGoalPillarInput[]) => replacePillars.mutate({ id, pillars }), [replacePillars]),
    remove: useCallback((id: string) => remove.mutate(id), [remove]),
    pending: create.isPending || update.isPending || changeStatus.isPending || replacePillars.isPending || remove.isPending,
  }
}

export function useLifeGoalPropose() {
  const mock = isMockMode()
  const m = useMutation({
    mutationFn: async (req: LifeGoalProposeRequest): Promise<LifeGoalProposeResponse> =>
      mock ? new Promise((r) => setTimeout(() => r(mockPropose(req)), 600)) : lifegoalApi.propose(req),
  })
  return { propose: useCallback((req: LifeGoalProposeRequest) => m.mutateAsync(req), [m]), pending: m.isPending }
}
```

Barrel (`data/hooks.ts`, next to the goal line):

```ts
export { useLifeGoals, useLifeGoal, useLifeGoalMutations, useLifeGoalPropose, useSignalCatalog } from '@/data/lifegoal/lifegoalHooks'
```

- [ ] **Step 4: Labels** (`features/me/logic/lifegoalLabels.ts`)

```ts
import type { ClayIconName } from '@/shared/ui/clay'
import type { MozaikWash } from '@/shared/ui/mozaik'
import type { LifeGoalDimension, LifeGoalStatus, PillarKind } from '@/data/lifegoal/lifegoalApi'

// PERMAH → the six house domain colors (prototype celok-head.html .d-* tokens).
export const DIMENSIONS: Record<LifeGoalDimension, { label: string; wash: MozaikWash; icon: ClayIconName; cls: string }> = {
  positive_emotion: { label: 'Érzelem',      wash: 'gold', icon: 'i-life-tudatossag',  cls: 'lg-d-p' },
  engagement:       { label: 'Elmélyülés',   wash: 'lav',  icon: 'i-life-tanulas',     cls: 'lg-d-e' },
  relationships:    { label: 'Kapcsolatok',  wash: 'rose', icon: 'i-life-kapcsolatok', cls: 'lg-d-r' },
  meaning:          { label: 'Értelem',      wash: 'coral',icon: 'i-life-szemlelet',   cls: 'lg-d-m' },
  accomplishment:   { label: 'Teljesítmény', wash: 'sky',  icon: 'i-life-produktivitas', cls: 'lg-d-a' },
  health:           { label: 'Egészség',     wash: 'sage', icon: 'i-life-regeneracio', cls: 'lg-d-h' },
}
export const DIMENSION_ORDER: LifeGoalDimension[] = ['positive_emotion', 'engagement', 'relationships', 'meaning', 'accomplishment', 'health']
export const KIND_LABEL: Record<PillarKind, string> = { habit: 'szokás', average: 'átlag', target: 'cél-érték', baseline: 'baseline', linked: 'kapcsolt' }
export const STATUS_LABEL: Record<LifeGoalStatus, string> = { draft: 'tervezett', active: 'aktív', parked: 'parkol', done: 'kész', archived: 'archivált' }
```

- [ ] **Step 5: MSW defaults** — in `test/msw/handlers.ts` add `http.get(`${API_BASE}/api/life-goals`, () => HttpResponse.json(MOCK_LIFE_GOALS))`, `http.get(…/api/life-goals/signals, () => HttpResponse.json({ entries: MOCK_SIGNAL_CATALOG }))`, `http.post(…/api/life-goals/propose, async ({ request }) => HttpResponse.json(mockPropose(await request.json() as LifeGoalProposeRequest)))`, `http.post(…/api/life-goals, async ({ request }) => HttpResponse.json({ ...(await request.json() as object), id: 'lg-new', status: 'draft', frame: 'unset', ifThenPlans: [], pillars: [] }, { status: 201 }))`, `http.post(…/api/life-goals/:id/status, …)` echoing `MOCK_LIFE_GOALS[0]` with the requested status.

- [ ] **Step 6: Hook tests** (`lifegoalHooks.test.tsx`, the `needsHooks.test.tsx` shape)

```tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { API_BASE } from '@/data/_client/api'
import { useLifeGoals, useLifeGoalMutations } from '@/data/lifegoal/lifegoalHooks'
import { MOCK_LIFE_GOALS } from '@/data/lifegoal/lifegoalMock'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

describe('useLifeGoals (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('seeds the four prototype goals synchronously', () => {
    const { result } = renderHook(() => useLifeGoals(), { wrapper: makeHookWrapper() })
    expect(result.current.goals.map((g) => g.title)).toEqual(['Kockahas', 'Side hustle', 'Az utolsó barátnő', 'Spanyol B2'])
  })

  test('changeStatus parks a goal in the cache', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ q: useLifeGoals(), m: useLifeGoalMutations() }), { wrapper })
    act(() => result.current.m.changeStatus('lg-kockahas', 'parked'))
    await waitFor(() => expect(result.current.q.goals.find((g) => g.id === 'lg-kockahas')?.status).toBe('parked'))
  })
})

describe('useLifeGoals (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('honest-empty while unresolved, then the fetched list', async () => {
    server.use(http.get(`${API_BASE}/api/life-goals`, () => HttpResponse.json([MOCK_LIFE_GOALS[0]])))
    const { result } = renderHook(() => useLifeGoals(), { wrapper: makeHookWrapper() })
    expect(result.current.goals).toEqual([])
    await waitFor(() => expect(result.current.goals).toHaveLength(1))
  })
})
```

- [ ] **Step 7: Run both modes, expect PASS; commit**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/data/lifegoal && VITE_USE_MOCK=true pnpm test src/data/lifegoal && pnpm test src/data/dualMode.guard.test.ts`

```bash
git add frontend/src/data frontend/src/features/me/logic/lifegoalLabels.ts frontend/src/test/msw/handlers.ts
git commit -m "feat(lifegoal): FE data layer — api, dual-mode hooks, mock seed, MSW, labels (mezo-iizd.1)"
```

---

### Task 8: Move the weight goal to `/me/goals/weight`

**Files:**
- Modify: `frontend/src/app/router.tsx` (`me/goals` → `CelokPage` placeholder later; `me/goals/weight` → `GoalsPage`; `me/goals/weight/new` → `GoalPlannerPage`)
- Modify: `frontend/src/features/me/pages/GoalsPage.tsx` (`navigate('/me/goals/new')` → `/me/goals/weight/new`; back chip → `/me/goals`)
- Modify: `frontend/src/features/me/pages/GoalPlannerPage.tsx` (`backToGoals` and the `<Navigate to>` → `/me/goals/weight`)
- Modify: `frontend/src/features/me/components/GoalGate.tsx` and any `'/me/goals/new'` literal (`grep -rn "'/me/goals" frontend/src`) — every weight-goal destination becomes `/me/goals/weight…`; the Én hub goal card keeps `/me/goals` (it becomes the Célok hub in Task 9).
- Test: existing `GoalPlannerPage.test.tsx` / `GoalsPage*.test.tsx` route assertions updated to the new paths.

- [ ] **Step 1: Update routes**

In `router.tsx` replace the two lines:

```tsx
      { path: 'me/goals/weight', element: <GoalsPage /> },
      { path: 'me/goals/weight/new', element: <GoalPlannerPage /> },
```

and keep `me/goals` pointing at `GoalsPage` for now (Task 9 swaps it to `CelokPage`).

- [ ] **Step 2: Fix the navigate literals; run the affected tests**

Run: `cd frontend && grep -rn "'/me/goals" src | grep -v "/me/goals/weight" ; VITE_USE_MOCK=true pnpm test src/features/me/pages/GoalPlannerPage.test.tsx src/features/me/pages/GoalsPage`
Expected: only Én-hub/Célok references remain on `/me/goals`; tests PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src
git commit -m "refactor(me): weight goal moves to /me/goals/weight (mezo-iizd.1)"
```

---

### Task 9: Célok hub page (`/me/goals`)

**Files:**
- Create: `frontend/src/features/me/components/PermahRing.tsx`, `frontend/src/features/me/components/LifeGoalTile.tsx`
- Create: `frontend/src/features/me/pages/CelokPage.tsx`
- Modify: `frontend/src/app/router.tsx` (`me/goals` → `CelokPage`), `frontend/src/styles/prototype.css` (append the `.lg-*` block)
- Test: `frontend/src/features/me/pages/CelokPage.test.tsx`

**Interfaces:**
- Consumes: `useLifeGoals`, `useLifeGoalMutations` (Task 7), `DIMENSIONS`/`DIMENSION_ORDER`/`STATUS_LABEL` (Task 7), Mozaik `MozaikPage/PageHead/PageBody/Mosaic/Tile`, `EntranceGroup`.
- Produces: `<PermahRing counts={Record<LifeGoalDimension, number>} total={number} />`, `<LifeGoalTile goal={LifeGoalResponse} delayMs onClick />`. No scoring data yet: the tile's arrow slot renders the honest placeholder `—` with the eyebrow line "még nincs adat" and 7 dashed dots (slice 2 fills them).

- [ ] **Step 1: CSS** — append to `prototype.css`:

```css
/* ===== Életcél-rendszer (mezo-iizd) — PERMAH tokens + hub/goal-page family ===== */
.lg-d-p { --dc: #A8801F; --dw: #FDF0DA; --dw2: #FFFCF5; --ds: rgba(201,150,46,0.45); }
.lg-d-e { --dc: #5D4FA0; --dw: #EBE6F8; --dw2: #F9F6FE; --ds: rgba(93,79,160,0.4); }
.lg-d-r { --dc: #8E3F6F; --dw: #FAE3ED; --dw2: #FEF8FB; --ds: rgba(142,63,111,0.35); }
.lg-d-m { --dc: #A84A26; --dw: #FFE7DC; --dw2: #FFF7F2; --ds: rgba(216,72,31,0.35); }
.lg-d-a { --dc: #3E7396; --dw: #DFEDF5; --dw2: #F5FAFD; --ds: rgba(78,143,184,0.4); }
.lg-d-h { --dc: #4E6B42; --dw: #E9F1E2; --dw2: #F7FBF3; --ds: rgba(110,139,94,0.45); }
.lg-hero { display: flex; gap: 14px; align-items: center; padding: 13px 15px; border-radius: 21px;
  background: linear-gradient(140deg, #F2F7EC, #FFFFFF 72%); border: 0.5px solid rgba(43,33,24,0.06);
  box-shadow: 0 18px 32px -16px rgba(43,33,24,0.32), inset 0 1px 0 rgba(255,255,255,0.85); }
.lg-ring { width: 94px; height: 94px; position: relative; flex: none; display: grid; place-items: center; }
.lg-ring svg { position: absolute; inset: 0; transform: rotate(-90deg); }
.lg-ring .arc { fill: none; stroke: var(--dc); stroke-width: 5.5; stroke-dasharray: 0 188.5; opacity: 0.2; }
.lg-ring .arc.live { opacity: 1; stroke-width: 8; }
.play .lg-ring .arc { animation: lg-arcin 0.6s cubic-bezier(0.25,0.8,0.35,1) forwards; animation-delay: calc(260ms + var(--i) * 70ms); }
@keyframes lg-arcin { to { stroke-dasharray: 27.4 161.1; } }
.lg-ring .c { text-align: center; line-height: 1; }
.lg-ring .c b { font-size: 32px; font-weight: 200; display: block; letter-spacing: -0.02em; }
.lg-ring .c small { font-size: 7.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted, #A2958A); }
.lg-dimband { display: flex; gap: 5px; flex-wrap: wrap; }
.lg-dimchip { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 4px 10px 4px 7px;
  font-size: 9px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; background: var(--dw); color: var(--dc); border: none; font-family: inherit; }
.lg-dimchip i { width: 8px; height: 8px; border-radius: 50%; background: var(--dc); flex: none; }
.lg-dimchip.empty { background: rgba(43,33,24,0.05); color: #A2958A; }
.lg-dimchip.empty i { background: rgba(43,33,24,0.18); }
.lg-tile { background: linear-gradient(150deg, var(--dw), var(--dw2)) !important; box-shadow: 0 14px 26px -14px var(--ds), 0 2px 5px rgba(43,33,24,0.04), inset 0 1px 0 rgba(255,255,255,0.7) !important; }
.lg-tile .mz-eyebrow { color: var(--dc); }
.lg-tile .nm { font-size: 13px; font-weight: 700; text-align: left; }
.lg-arrow { display: inline-flex; align-items: baseline; gap: 4px; line-height: 1; font-variant-numeric: tabular-nums; }
.lg-arrow .g { font-size: 26px; font-weight: 300; }
.lg-arrow .v { font-size: 14px; font-weight: 600; }
.lg-arrow.up { color: #4E6B42; } .lg-arrow.flat { color: #6E6257; } .lg-arrow.down { color: #A8801F; } .lg-arrow.none { color: #A2958A; }
.lg-wk7 { display: flex; gap: 5px; align-items: center; }
.lg-wk7 i { width: 11px; height: 11px; border-radius: 50%; flex: none; background: rgba(43,33,24,0.12); transform: scale(0); }
.lg-wk7 i.h { background: linear-gradient(135deg, #8FAF7E, #6E8B5E); }
.lg-wk7 i.p { background: linear-gradient(135deg, #E5C46B, #C9962E); }
.lg-wk7 i.n { background: transparent; border: 1px dashed rgba(43,33,24,0.28); }
.play .lg-wk7 i { animation: lg-dotpop 0.35s cubic-bezier(0.3,1.4,0.5,1) forwards; animation-delay: calc(var(--d, 0ms) + 280ms + var(--i) * 45ms); }
@keyframes lg-dotpop { to { transform: scale(1); } }
.lg-wk7 .lbl { font-size: 8.5px; font-weight: 700; color: #A2958A; margin-left: auto; }
.lg-parkrow { display: flex; align-items: center; gap: 10px; padding: 10px 13px; border-radius: 17px; width: 100%; text-align: left;
  background: rgba(255,255,255,0.55); border: 0.5px dashed rgba(43,33,24,0.18); font-family: inherit; cursor: pointer; }
.lg-parkrow .nm { font-size: 12px; font-weight: 600; color: #6E6257; }
.lg-parkrow .sb { font-size: 9.5px; color: #A2958A; }
.lg-parkrow .act { margin-left: auto; font-size: 10px; font-weight: 700; color: #A84A26; border: 1px solid rgba(43,33,24,0.14); background: #fff; border-radius: 999px; padding: 4px 11px; flex: none; }
@media (prefers-reduced-motion: reduce) {
  .lg-ring .arc, .play .lg-ring .arc { stroke-dasharray: 27.4 161.1; animation: none; }
  .lg-wk7 i, .play .lg-wk7 i { transform: scale(1); animation: none; }
}
```

- [ ] **Step 2: Components**

`PermahRing.tsx`:

```tsx
import type { LifeGoalDimension } from '@/data/lifegoal/lifegoalApi'
import { DIMENSIONS, DIMENSION_ORDER } from '@/features/me/logic/lifegoalLabels'

// Six-arc PERMAH ring (prototype celok-body #ring6): one arc per dimension, live where an
// active goal exists, faint where none — the centre is the active-goal count.
export function PermahRing({ counts, total }: { counts: Record<LifeGoalDimension, number>; total: number }) {
  return (
    <div className="lg-ring" role="img" aria-label={`${total} aktív cél`}>
      <svg viewBox="0 0 80 80" width="94" height="94" aria-hidden="true">
        {DIMENSION_ORDER.map((d, i) => (
          <circle key={d} className={`arc ${DIMENSIONS[d].cls} ${counts[d] > 0 ? 'live' : ''}`}
            cx="40" cy="40" r="30" style={{ '--i': i, strokeDashoffset: -(i * 31.4) } as React.CSSProperties} />
        ))}
      </svg>
      <div className="c"><b>{total}</b><small>aktív cél</small></div>
    </div>
  )
}
```

`LifeGoalTile.tsx`:

```tsx
import { ClayIcon } from '@/shared/ui/clay'
import type { LifeGoalResponse } from '@/data/lifegoal/lifegoalApi'
import { DIMENSIONS } from '@/features/me/logic/lifegoalLabels'

// Goal tile (prototype .gtile): eyebrow = dimension, name, clay icon + the weekly arrow slot,
// seven dots. Slice 1 has no scorer yet, so the arrow is the honest `—` and the dots are dashed.
export function LifeGoalTile({ goal, delayMs, onClick }: { goal: LifeGoalResponse; delayMs: number; onClick: () => void }) {
  const dim = DIMENSIONS[goal.dimension]
  return (
    <button type="button" className={`mz-tile lg-tile rise ${dim.cls}`} style={{ '--d': `${delayMs}ms` } as React.CSSProperties}
      onClick={onClick} aria-label={goal.title}>
      <div className="mz-tile-top"><span className="mz-eyebrow">{dim.label}</span></div>
      <div className="nm">{goal.title}</div>
      <div className="row gap-sm" style={{ alignItems: 'center', marginTop: 4 }}>
        <ClayIcon name={dim.icon} size={34} />
        <span className="lg-arrow none"><span className="g">—</span></span>
      </div>
      <div className="lg-wk7" style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
        {Array.from({ length: 7 }, (_, i) => <i key={i} className="n" style={{ '--i': i } as React.CSSProperties} />)}
        <span className="lbl">még nincs adat</span>
      </div>
    </button>
  )
}
```

- [ ] **Step 3: The page**

```tsx
import { useNavigate } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody, Mosaic } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useLifeGoals, useLifeGoalMutations } from '@/data/hooks'
import type { LifeGoalDimension } from '@/data/lifegoal/lifegoalApi'
import { DIMENSIONS, DIMENSION_ORDER } from '@/features/me/logic/lifegoalLabels'
import { PermahRing } from '@/features/me/components/PermahRing'
import { LifeGoalTile } from '@/features/me/components/LifeGoalTile'

// Célok hub (mezo-iizd.1, prototype celok.html #panel): hero ring + companion line, the PERMAH
// chip band, one tile per active goal, the parked list, and the "Jelek" row (slice 2 page).
export function CelokPage() {
  const navigate = useNavigate()
  const { goals, isPending } = useLifeGoals()
  const { changeStatus } = useLifeGoalMutations()
  const active = goals.filter((g) => g.status === 'active')
  const parked = goals.filter((g) => g.status === 'parked' || g.status === 'draft')
  const counts = Object.fromEntries(DIMENSION_ORDER.map((d) => [d, active.filter((g) => g.dimension === d).length])) as Record<LifeGoalDimension, number>

  return (
    <MozaikPage tone="sage">
      <PageHead onBack={() => navigate('/me')} label="‹ Én">
        <button type="button" className="pgact" style={{ marginLeft: 'auto' }} onClick={() => navigate('/me/goals/new')}>＋ Új cél</button>
      </PageHead>
      <PageBody principle="Ami nincs naplózva, az nem nulla — az üres.">
        <EntranceGroup>
          <div className="rise" style={{ '--d': '0ms', padding: '4px 0 10px' } as React.CSSProperties}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>Célok</span>
            <div className="mz-eyebrow">{active.length} aktív · {parked.length} parkol</div>
          </div>
          {!isPending && (
            <div className="lg-hero rise" style={{ '--d': '40ms', marginBottom: 12 } as React.CSSProperties}>
              <PermahRing counts={counts} total={active.length} />
              <div style={{ flex: 1, fontSize: 13.5, fontWeight: 300 }}>
                {active.length === 0
                  ? <>Még nincs aktív célod. <strong>Egy cél, két-három pillér</strong> — a többit a naplód hozza.</>
                  : <>A pillérek a meglévő naplódból számolnak. <strong>Az irány-nyíl a 2. szelettel jön</strong> — addig a célok és pilléreik itt élnek.</>}
              </div>
            </div>
          )}
          <div className="lg-dimband rise" style={{ '--d': '90ms', marginBottom: 12 } as React.CSSProperties} aria-label="Életterületek">
            {DIMENSION_ORDER.map((d) => (
              <span key={d} className={`lg-dimchip ${DIMENSIONS[d].cls} ${counts[d] ? '' : 'empty'}`}>
                <i />{DIMENSIONS[d].label}{counts[d] ? <b> {counts[d]}</b> : null}
              </span>
            ))}
          </div>
          <Mosaic>
            {active.map((g, i) => <LifeGoalTile key={g.id} goal={g} delayMs={130 + i * 40} onClick={() => navigate(`/me/goals/${g.id}`)} />)}
            <button type="button" className="mz-tile mz-w-white rise" style={{ '--d': `${130 + active.length * 40}ms`, border: '1.2px dashed rgba(216,72,31,0.4)', background: 'transparent', boxShadow: 'none', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties}
              onClick={() => navigate('/me/goals/new')} aria-label="Új cél">
              <ClayIcon name="i-cel" size={30} />
              <b style={{ fontSize: 12, color: 'var(--coral-deep)' }}>＋ Új cél</b>
              <small style={{ fontSize: 9.5, color: 'var(--text-secondary)' }}>Mezo pilléreket javasol</small>
            </button>
          </Mosaic>
          {parked.map((g, i) => (
            <button key={g.id} type="button" className="lg-parkrow rise" style={{ '--d': `${300 + i * 40}ms`, marginTop: 10 } as React.CSSProperties}
              onClick={() => navigate(`/me/goals/${g.id}`)} aria-label={`${g.title} · parkol`}>
              <ClayIcon name={DIMENSIONS[g.dimension].icon} size={22} />
              <div style={{ flex: 1 }}><div className="nm">{g.title}</div><div className="sb">{g.status === 'draft' ? 'tervezett' : 'parkol'} · {DIMENSIONS[g.dimension].label}</div></div>
              <span className="act" role="button" onClick={(e) => { e.stopPropagation(); changeStatus(g.id, 'active') }}>Vissza</span>
            </button>
          ))}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
```

Route: `{ path: 'me/goals', element: <CelokPage /> }` (replacing the `GoalsPage` line; import `CelokPage`). Confirm `PageHead` accepts children on the right the way `GoalsPage`'s `NewGoalAction` is placed — if `PageHead` renders `children` after the back chip, this is correct; otherwise place the button inside `PageBody` top row.

- [ ] **Step 4: Test**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { CelokPage } from '@/features/me/pages/CelokPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function renderHub() {
  return render(<QueryWrapper><MemoryRouter initialEntries={['/me/goals']}>
    <Routes><Route path="/me/goals" element={<CelokPage />} /><Route path="/me/goals/:id" element={<div>GOAL PAGE</div>} /><Route path="/me/goals/new" element={<div>WIZARD</div>} /></Routes>
  </MemoryRouter></QueryWrapper>)
}

test('renders the three active goals as tiles, Spanyol B2 parked, three live dimension chips', () => {
  renderHub()
  expect(screen.getByRole('button', { name: 'Kockahas' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Side hustle' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Az utolsó barátnő' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Spanyol B2 · parkol/ })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '3 aktív cél' })).toBeInTheDocument()
  expect(document.querySelectorAll('.lg-dimchip:not(.empty)')).toHaveLength(3)
})

test('tile tap opens the goal page; ＋ Új cél opens the wizard', () => {
  renderHub()
  fireEvent.click(screen.getByRole('button', { name: 'Kockahas' }))
  expect(screen.getByText('GOAL PAGE')).toBeInTheDocument()
})

test('Vissza on a parked goal re-activates it', async () => {
  renderHub()
  fireEvent.click(screen.getByText('Vissza'))
  await waitFor(() => expect(screen.getByRole('img', { name: '4 aktív cél' })).toBeInTheDocument())
})
```

- [ ] **Step 5: Run both modes; commit**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/pages/CelokPage.test.tsx && VITE_USE_MOCK=false pnpm test src/features/me/pages/CelokPage.test.tsx`

```bash
git add frontend/src
git commit -m "feat(lifegoal): Célok hub — PERMAH ring, dimension band, goal tiles (mezo-iizd.1)"
```

---

### Task 10: Goal page (`/me/goals/:id`) with pillar cards, why/ha–akkor, status actions, pillar editor sheet

**Files:**
- Create: `frontend/src/features/me/components/PillarCard.tsx`, `frontend/src/features/me/sheets/PillarCatalogSheet.tsx`, `frontend/src/features/me/pages/CelPage.tsx`
- Modify: `frontend/src/app/router.tsx` (`me/goals/:id` — registered AFTER `me/goals/new` and `me/goals/weight*`, the `me/people/:id` precedent), `frontend/src/styles/prototype.css` (`.lg-pillar*`, `.lg-why`, `.lg-ifthen`)
- Test: `frontend/src/features/me/pages/CelPage.test.tsx`

**Interfaces:**
- Consumes: `useLifeGoal(id)`, `useLifeGoalMutations`, `useSignalCatalog`, `KIND_LABEL`, `DIMENSIONS`.
- Produces: `<PillarCard pillar delayMs />` (honest empty state: value `—`, dashed dots, "az első nyíl 5 adat-nap után"); `<PillarCatalogSheet open onClose onPick={(entry) => void} />` (catalog chips grouped by `group`); page actions Parkolás / Lezárás / Archiválás via `changeStatus`; `⋯` opens the pillar editor (toggle `active`, weight 1–3 stepper, ＋ from catalog → `replacePillars`).

- [ ] **Step 1: CSS** (append):

```css
.lg-pillar { border-radius: 18px; padding: 12px 14px 13px; margin-bottom: 10px; background: #fff; border: 0.5px solid rgba(43,33,24,0.06);
  box-shadow: 0 14px 26px -16px rgba(43,33,24,0.3), inset 0 1px 0 rgba(255,255,255,0.85); }
.lg-pillar.washed { background: linear-gradient(150deg, var(--dw), #FFFFFF 72%); }
.lg-pillar.off { opacity: 0.55; }
.lg-pillar .ph { display: flex; align-items: center; gap: 8px; }
.lg-pillar .ph .nm { font-size: 13px; font-weight: 700; }
.lg-kind { font-size: 8px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #6E6257; background: rgba(43,33,24,0.06); border-radius: 6px; padding: 2px 7px; flex: none; }
.lg-kind.link { color: #3E7396; background: rgba(78,143,184,0.14); }
.lg-pillar .val { display: flex; align-items: baseline; gap: 7px; margin-top: 7px; }
.lg-pillar .val b { font-size: 21px; font-weight: 200; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.lg-pillar .val small { font-size: 10px; color: #6E6257; }
.lg-why { border-radius: 18px; padding: 12px 14px; margin-bottom: 10px; background: linear-gradient(140deg, #FFF2EA, #FFFFFF 75%); border: 0.5px solid rgba(43,33,24,0.06); box-shadow: 0 12px 22px -15px rgba(43,33,24,0.3); }
.lg-why .q { font-family: var(--ff-display, "Fraunces", serif); font-style: italic; font-size: 13.5px; font-weight: 500; }
.lg-ifthen { display: flex; gap: 8px; align-items: flex-start; padding: 7px 0; font-size: 11px; }
.lg-ifthen + .lg-ifthen { border-top: 0.5px solid rgba(43,33,24,0.08); }
.lg-ifthen .ha { flex: none; width: 46px; text-align: center; font-size: 7.5px; font-weight: 800; letter-spacing: 0.12em; color: #A84A26; background: rgba(168,74,38,0.1); border-radius: 6px; padding: 3px 0; margin-top: 2px; }
.lg-ifthen .ha.akkor { color: #4E6B42; background: rgba(110,139,94,0.16); }
.lg-actrow { display: flex; gap: 8px; margin: 6px 0 10px; }
.lg-actrow button { flex: 1; border: 1px solid rgba(43,33,24,0.14); background: #fff; border-radius: 999px; padding: 8px 0; font-size: 11px; font-weight: 700; color: #6E6257; font-family: inherit; cursor: pointer; }
```

- [ ] **Step 2: `PillarCard.tsx`**

```tsx
import { ClayIcon } from '@/shared/ui/clay'
import type { LifeGoalPillarResponse } from '@/data/lifegoal/lifegoalApi'
import { KIND_LABEL } from '@/features/me/logic/lifegoalLabels'

function ruleLine(p: LifeGoalPillarResponse): string {
  const r = p.rule ?? {}
  switch (p.kind) {
    case 'habit': return `${r.daysPerWeek ?? '?'}× / hét`
    case 'average': return `${r.windowDays ?? 7} nap átlag · ${r.comparator === 'lte' ? '≤' : '≥'} ${r.threshold ?? '?'}`
    case 'target': return `${r.startValue ?? '?'} → ${r.targetValue ?? '?'} · ${r.targetDate ?? 'nincs határidő'}`
    case 'baseline': return `saját ${r.windowDays ?? 28} napos medián`
    case 'linked': return 'súlycél · ütem'
  }
}

export function PillarCard({ pillar, delayMs }: { pillar: LifeGoalPillarResponse; delayMs: number }) {
  return (
    <div className={`lg-pillar rise ${pillar.active ? '' : 'off'}`} style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
      <div className="ph">
        <ClayIcon name="i-cel" size={22} />
        <span className="nm">{pillar.label}</span>
        <span className={`lg-kind ${pillar.kind === 'linked' ? 'link' : ''}`}>{KIND_LABEL[pillar.kind]} · {ruleLine(pillar)}</span>
        <span className="lg-arrow none" style={{ marginLeft: 'auto' }}><span className="g" style={{ fontSize: 18 }}>—</span></span>
      </div>
      <div className="val"><b style={{ color: '#A2958A' }}>—</b><small>még nincs adat · az első nyíl 5 adat-nap után</small></div>
      <div className="lg-wk7" style={{ marginTop: 8, '--d': `${delayMs}ms` } as React.CSSProperties}>
        {Array.from({ length: 7 }, (_, i) => <i key={i} className="n" style={{ '--i': i } as React.CSSProperties} />)}
        <span className="lbl">skill · {pillar.skillKey}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `PillarCatalogSheet.tsx`** — a bottom sheet (`BottomSheet` from `@/shared/ui` — use whatever `EditGoalSheet.tsx` imports) listing `useSignalCatalog().entries` grouped by `group` as `.mz-chips` buttons; `onPick(entry)` returns the entry; `Mégse` closes.

- [ ] **Step 4: `CelPage.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useLifeGoal, useLifeGoalMutations } from '@/data/hooks'
import type { LifeGoalPillarInput, SignalCatalogEntry } from '@/data/lifegoal/lifegoalApi'
import { DIMENSIONS, STATUS_LABEL } from '@/features/me/logic/lifegoalLabels'
import { PillarCard } from '@/features/me/components/PillarCard'
import { PillarCatalogSheet } from '@/features/me/sheets/PillarCatalogSheet'
import { huMonthDay } from '@/shared/lib/dates'

// Cél-oldal (mezo-iizd.1, prototype celok.html #page-g1): hero, pillar cards, Miért · ha–akkor,
// status actions. Scores/arrows/heatmap arrive with slice 2 — every numeric slot is honest `—` now.
export function CelPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { goal, isPending } = useLifeGoal(id)
  const { changeStatus, replacePillars, pending } = useLifeGoalMutations()
  const [catalogOpen, setCatalogOpen] = useState(false)

  if (isPending) return <ScreenSkeleton />
  if (!goal) return <MozaikPage tone="sage"><PageHead onBack={() => navigate('/me/goals')} label="‹ Célok" /><PageBody><p className="mz-eyebrow" style={{ padding: 24 }}>Nincs ilyen cél.</p></PageBody></MozaikPage>

  const dim = DIMENSIONS[goal.dimension]
  const sub = [dim.label, goal.secondaryDimension ? DIMENSIONS[goal.secondaryDimension].label : null,
    `${huMonthDay(goal.startDate)} →${goal.targetDate ? ` ${huMonthDay(goal.targetDate)}` : ' nincs határidő'}`, STATUS_LABEL[goal.status]].filter(Boolean).join(' · ')

  const addPillar = (e: SignalCatalogEntry) => {
    const next: LifeGoalPillarInput[] = [
      ...goal.pillars.map(({ id: _id, position: _p, ...rest }) => rest),
      { label: e.label, skillKey: e.defaultSkillKey ?? 'mindset', kind: e.kinds[0], weight: 1, active: true, source: e.source, rule: e.kinds[0] === 'average' ? { windowDays: 7, comparator: 'gte' } : e.kinds[0] === 'baseline' ? { windowDays: 28, minDataDays: 14 } : {} },
    ]
    replacePillars(goal.id, next); setCatalogOpen(false)
  }

  return (
    <MozaikPage tone={dim.wash === 'coral' ? 'coral' : dim.wash === 'white' || dim.wash === 'most' ? 'sage' : dim.wash}>
      <PageHead onBack={() => navigate('/me/goals')} label="‹ Célok">
        <button type="button" className="pgact" style={{ marginLeft: 'auto' }} onClick={() => setCatalogOpen(true)} disabled={goal.pillars.length >= 5}>＋ Pillér</button>
      </PageHead>
      <PageHero icon={dim.icon} big={<span className="lg-arrow none"><span className="g" style={{ fontSize: 40 }}>—</span></span>} name={goal.title} sub={sub} />
      <PageBody principle="Az irány-nyíl 7 nap vs 21 nap · mindkettőben legalább 5 adat-nap kell.">
        <EntranceGroup replayKey={goal.pillars.length}>
          <div className="mz-eyebrow rise" style={{ '--d': '0ms', padding: '4px 2px 8px' } as React.CSSProperties}>Pillérek · {goal.pillars.length}</div>
          {goal.pillars.map((p, i) => <PillarCard key={p.id} pillar={p} delayMs={40 + i * 40} />)}
          {goal.pillars.length === 0 && <p className="mz-eyebrow rise" style={{ padding: '0 2px 10px' }}>Még nincs pillér — ＋ Pillér a katalógusból.</p>}
          {(goal.whyText || goal.ifThenPlans.length > 0) && (
            <>
              <div className="mz-eyebrow rise" style={{ '--d': '260ms', padding: '8px 2px 6px' } as React.CSSProperties}>Miért · ha–akkor</div>
              <div className="lg-why rise" style={{ '--d': '290ms' } as React.CSSProperties}>
                {goal.whyText && <div className="q">„{goal.whyText}”</div>}
                {goal.obstacleText && <div className="mz-eyebrow" style={{ marginTop: 8 }}>Akadály · {goal.obstacleText}</div>}
                <div style={{ marginTop: 8 }}>
                  {goal.ifThenPlans.map((pl, i) => (
                    <div key={i}>
                      <div className="lg-ifthen"><span className="ha">HA</span><span>{pl.ha}</span></div>
                      <div className="lg-ifthen" style={{ borderTop: 'none', paddingTop: 0 }}><span className="ha akkor">AKKOR</span><span>{pl.akkor}{pl.trigger ? <em style={{ color: '#A2958A', fontStyle: 'normal' }}> · Mezo figyeli ({pl.trigger.source})</em> : <em style={{ color: '#A2958A', fontStyle: 'normal' }}> · nincs hozzá jel</em>}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="lg-actrow rise" style={{ '--d': '330ms' } as React.CSSProperties}>
            {goal.status === 'active' && <button type="button" disabled={pending} onClick={() => changeStatus(goal.id, 'parked')}>Parkolás</button>}
            {(goal.status === 'parked' || goal.status === 'draft') && <button type="button" disabled={pending} onClick={() => changeStatus(goal.id, 'active')}>Aktiválás</button>}
            {(goal.status === 'active' || goal.status === 'parked') && <button type="button" disabled={pending} onClick={() => changeStatus(goal.id, 'done')}>Lezárás</button>}
            {goal.status !== 'archived' && <button type="button" disabled={pending} onClick={() => { changeStatus(goal.id, 'archived'); navigate('/me/goals') }}>Archiválás</button>}
          </div>
        </EntranceGroup>
      </PageBody>
      <PillarCatalogSheet open={catalogOpen} onClose={() => setCatalogOpen(false)} onPick={addPillar} />
    </MozaikPage>
  )
}
```

Route (after `me/goals/weight/new`): `{ path: 'me/goals/:id', element: <CelPage /> }`. Check `PageHero`'s `big` prop accepts a ReactNode (it does in `GoalsPage` usage — `PageHeroProps` at `mozaik/index.tsx:140`); otherwise pass `big="—"`.

- [ ] **Step 5: Test**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { CelPage } from '@/features/me/pages/CelPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderGoal = (id = 'lg-kockahas') => render(<QueryWrapper><MemoryRouter initialEntries={[`/me/goals/${id}`]}>
  <Routes><Route path="/me/goals/:id" element={<CelPage />} /><Route path="/me/goals" element={<div>HUB</div>} /></Routes>
</MemoryRouter></QueryWrapper>)

test('renders Kockahas with five pillars, the why quote and two ha–akkor plans, no fabricated numbers', () => {
  renderGoal()
  expect(screen.getByText('Kockahas')).toBeInTheDocument()
  expect(document.querySelectorAll('.lg-pillar')).toHaveLength(5)
  expect(screen.getAllByText(/még nincs adat/)).toHaveLength(5)
  expect(screen.getByText(/Erős, egészséges test/)).toBeInTheDocument()
  expect(screen.getAllByText('HA')).toHaveLength(2)
})

test('Parkolás parks the goal and swaps the action to Aktiválás', async () => {
  renderGoal()
  fireEvent.click(screen.getByRole('button', { name: 'Parkolás' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Aktiválás' })).toBeInTheDocument())
})

test('＋ Pillér is disabled at five pillars', () => {
  renderGoal()
  expect(screen.getByRole('button', { name: '＋ Pillér' })).toBeDisabled()
})

test('unknown id shows the empty state', () => {
  renderGoal('nope')
  expect(screen.getByText('Nincs ilyen cél.')).toBeInTheDocument()
})
```

- [ ] **Step 6: Run both modes; commit**

```bash
git add frontend/src
git commit -m "feat(lifegoal): cél-oldal — pillérek, miért · ha–akkor, státusz-műveletek, katalógus-sheet (mezo-iizd.1)"
```

---

### Task 11: The five-step wizard (`/me/goals/new`)

**Files:**
- Create: `frontend/src/features/me/pages/CelWizardPage.tsx`
- Modify: `frontend/src/app/router.tsx` (`me/goals/new` → `CelWizardPage`, BEFORE `me/goals/:id`), `frontend/src/styles/prototype.css` (`.lg-wiz*`, `.lg-plan*`, `.lg-frame*`)
- Test: `frontend/src/features/me/pages/CelWizardPage.test.tsx`

**Interfaces:**
- Consumes: `useLifeGoalPropose`, `useLifeGoalMutations`, `useSignalCatalog`, `DIMENSIONS`, `KIND_LABEL`, `PillarCatalogSheet` (Task 10).
- Produces: a page with steps `Cél → Keret → Pillérek → Ha–akkor → Összegzés` (titles `Mit építünk? · Miért fontos? · Miből mérjük? · Mi jön közbe? · Így indul`), the draft state `WizardDraft` below, and two terminal actions: **Mentés tervezettként** (`create` without status change → `/me/goals`) and **Aktiválás** (`create` then `changeStatus(id,'active')` → `/me/goals/:id`).

- [ ] **Step 1: CSS** (append):

```css
.lg-wprog { display: flex; gap: 5px; margin-bottom: 6px; }
.lg-wprog i { flex: 1; height: 4px; border-radius: 2px; background: rgba(43,33,24,0.1); }
.lg-wprog i.f { background: var(--gradient-cta, linear-gradient(90deg, #FF9A78, #E05535)); }
.lg-fcard { background: #fff; border-radius: 16px; padding: 11px 13px 12px; margin-bottom: 9px; border: 0.5px solid rgba(43,33,24,0.06); box-shadow: 0 10px 20px -14px rgba(43,33,24,0.28); }
.lg-flabel { font-size: 8.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #A2958A; margin-bottom: 5px; display: block; }
.lg-fin { width: 100%; border: 1px solid rgba(43,33,24,0.12); border-radius: 11px; padding: 8px 11px; font-family: inherit; font-size: 13px; background: #FDFAF4; color: #2B2118; resize: none; }
.lg-frame { border-radius: 16px; padding: 11px 13px; margin: 8px 0; background: linear-gradient(140deg, #FFF1D6, #FFFCF4); box-shadow: 0 12px 22px -14px rgba(181,126,20,0.45); }
.lg-frame.ok { background: linear-gradient(140deg, #E9F1E2, #FBFDF9); box-shadow: 0 12px 22px -14px rgba(110,139,94,0.45); }
.lg-frame .lb { font-size: 11px; font-weight: 800; color: #A8801F; } .lg-frame.ok .lb { color: #4E6B42; }
.lg-frame p { font-size: 11px; color: #6E6257; margin-top: 4px; }
.lg-pilcard { display: flex; align-items: center; gap: 10px; border-radius: 16px; padding: 10px 12px; margin-bottom: 8px; background: #fff; border: 1.5px solid rgba(43,33,24,0.08); box-shadow: 0 10px 20px -14px rgba(43,33,24,0.28); }
.lg-pilcard.on { border-color: #8FAF7E; background: linear-gradient(140deg, #EEF4E8, #FFFFFF 70%); }
.lg-pilcard.off { opacity: 0.5; }
.lg-pilcard b { font-size: 12.5px; display: block; } .lg-pilcard small { font-size: 10px; color: #6E6257; display: block; }
.lg-togg { width: 38px; height: 22px; border-radius: 999px; background: rgba(43,33,24,0.14); position: relative; flex: none; border: none; padding: 0; cursor: pointer; }
.lg-togg::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left 0.15s ease; }
.lg-togg.on { background: linear-gradient(135deg, #8FAF7E, #6E8B5E); } .lg-togg.on::after { left: 18px; }
.lg-plan { border-radius: 16px; padding: 10px 11px 9px; margin-bottom: 8px; background: #fff; border: 1.5px solid rgba(43,33,24,0.08); }
.lg-plan.on { border-color: #8FAF7E; background: linear-gradient(140deg, #EEF4E8, #FFFFFF 62%); }
.lg-plan.own { border-style: dashed; }
.lg-prow { display: flex; gap: 8px; align-items: flex-start; } .lg-prow + .lg-prow { margin-top: 5px; padding-top: 6px; border-top: 0.5px solid rgba(43,33,24,0.08); }
.lg-ptxt { flex: 1; min-width: 0; border: none; background: transparent; font-family: inherit; font-size: 12px; line-height: 1.4; color: #2B2118; resize: none; padding: 2px 0; }
.lg-pfoot { display: flex; align-items: center; gap: 6px; margin-top: 7px; padding-top: 6px; border-top: 0.5px solid rgba(43,33,24,0.08); font-size: 9.5px; font-weight: 700; color: #6E6257; }
.lg-addrow { width: 100%; border: 1.2px dashed rgba(43,33,24,0.2); background: none; border-radius: 12px; padding: 9px 0; font-size: 11px; font-weight: 700; color: #6E6257; cursor: pointer; font-family: inherit; margin-top: 4px; }
.lg-aiwait { display: flex; align-items: center; gap: 8px; padding: 12px; border-radius: 15px; background: rgba(255,255,255,0.7); margin-bottom: 8px; font-size: 11px; color: #6E6257; }
.lg-sumpil { display: flex; align-items: center; gap: 10px; padding: 9px 12px; margin-bottom: 6px; border-radius: 15px; background: #fff; border: 0.5px solid rgba(43,33,24,0.06); }
.lg-sumpil b { font-size: 12px; display: block; } .lg-sumpil small { font-size: 10px; color: #6E6257; display: block; }
```

- [ ] **Step 2: The page** — state + steps (the prototype's five steps, D8/D9 semantics):

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useLifeGoalMutations, useLifeGoalPropose } from '@/data/hooks'
import type { IfThenPlan, LifeGoalDimension, LifeGoalFrame, LifeGoalPillarInput, LifeGoalProposeResponse, SignalCatalogEntry } from '@/data/lifegoal/lifegoalApi'
import { DIMENSIONS, DIMENSION_ORDER, KIND_LABEL } from '@/features/me/logic/lifegoalLabels'
import { PillarCatalogSheet } from '@/features/me/sheets/PillarCatalogSheet'

const STEPS = ['Cél', 'Keret', 'Pillérek', 'Ha–akkor', 'Összegzés'] as const
const TITLES = ['Mit építünk?', 'Miért fontos?', 'Miből mérjük?', 'Mi jön közbe?', 'Így indul'] as const
const TRIGGER_LABEL: Record<string, string> = {
  sport_session_logged: 'sport-napló · másnap szólok', checkin_energy_lte: 'check-in · rögtön utána szólok', ritual_missed: 'napzárás · másnap reggel szólok',
}

interface WizardDraft {
  title: string; whyText: string; targetDate: string
  dimension: LifeGoalDimension; secondaryDimension?: LifeGoalDimension; frame: LifeGoalFrame
  frameNote?: string; reframedWhy?: string; useReframe: boolean
  pillars: (LifeGoalPillarInput & { on: boolean })[]
  obstacle: string; obstacles: string[]; plans: (IfThenPlan & { own: boolean })[]
  source: 'ai' | 'template' | null
}

export function CelWizardPage() {
  const navigate = useNavigate()
  const { propose, pending: proposing } = useLifeGoalPropose()
  const { create, changeStatus, pending: saving } = useLifeGoalMutations()
  const [step, setStep] = useState(0)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [d, setD] = useState<WizardDraft>({
    title: '', whyText: '', targetDate: '', dimension: 'health', frame: 'unset', useReframe: false,
    pillars: [], obstacle: '', obstacles: [], plans: [], source: null,
  })
  const patch = (p: Partial<WizardDraft>) => setD((cur) => ({ ...cur, ...p }))

  // Step 1 → 2 runs the proposal ONCE (title + why); later steps only edit its result.
  const goToFrame = async () => {
    setStep(1)
    if (d.source) return
    const res: LifeGoalProposeResponse = await propose({ title: d.title, whyText: d.whyText || undefined, targetDate: d.targetDate || undefined })
    patch({
      dimension: res.dimension, secondaryDimension: res.secondaryDimension, frame: res.frame, frameNote: res.frameNote, reframedWhy: res.reframedWhy,
      pillars: res.pillars.map((p) => ({ ...p, on: true })), obstacles: res.obstacles, obstacle: res.obstacles[0] ?? '',
      plans: res.ifThenPlans.map((p) => ({ ...p, own: false })), source: res.source,
    })
  }

  const activePillars = d.pillars.filter((p) => p.on).map(({ on: _on, ...rest }) => rest)
  const canNext = [d.title.trim().length > 0, true, activePillars.length > 0, true, true][step]

  const save = (activate: boolean) => {
    create({
      title: d.title, whyText: d.useReframe && d.reframedWhy ? d.reframedWhy : d.whyText || undefined, frame: d.useReframe ? 'intrinsic' : d.frame,
      dimension: d.dimension, secondaryDimension: d.secondaryDimension, startDate: new Date().toISOString().slice(0, 10),
      targetDate: d.targetDate || undefined, obstacleText: d.obstacle || undefined,
      ifThenPlans: d.plans.filter((p) => p.ha.trim() && p.akkor.trim()).map(({ own: _o, ...rest }) => rest), pillars: activePillars,
    }, { onSuccess: (g) => { if (activate) { changeStatus(g.id, 'active'); navigate(`/me/goals/${g.id}`) } else navigate('/me/goals') } })
  }

  const addFromCatalog = (e: SignalCatalogEntry) => {
    patch({ pillars: [...d.pillars, { label: e.label, skillKey: e.defaultSkillKey ?? 'mindset', kind: e.kinds[0], weight: 1, active: true, source: e.source,
      rule: e.kinds[0] === 'average' ? { windowDays: 7, comparator: 'gte' } : e.kinds[0] === 'baseline' ? { windowDays: 28, minDataDays: 14 } : {}, on: true }] })
    setCatalogOpen(false)
  }

  return (
    <MozaikPage tone="coral">
      <PageHead onBack={() => (step > 0 ? setStep(step - 1) : navigate('/me/goals'))} label={step === 0 ? '‹ Célok' : `‹ ${STEPS[step - 1]}`} />
      <PageBody>
        <EntranceGroup replayKey={step}>
          <div className="rise" style={{ '--d': '0ms', padding: '6px 24px 0' } as React.CSSProperties}>
            <div className="lg-wprog">{STEPS.map((_, i) => <i key={i} className={i <= step ? 'f' : ''} />)}</div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="eyebrow">{String(step + 1).padStart(2, '0')} / 05</span><span className="eyebrow" style={{ color: 'var(--coral-deep)' }}>{STEPS[step]}</span>
            </div>
          </div>
          <div className="rise" style={{ '--d': '40ms', padding: '6px 24px 4px' } as React.CSSProperties}>
            <span className="mz-eyebrow">Én · Új cél</span>
            <h1 style={{ fontFamily: 'var(--ff-display)', fontSize: 24, fontWeight: 600, margin: '4px 0 0' }}>{TITLES[step]}</h1>
          </div>

          <div className="rise" style={{ '--d': '80ms', padding: '8px 24px' } as React.CSSProperties}>
            {step === 0 && (<>
              <div className="lg-fcard"><label className="lg-flabel" htmlFor="lg-title">A cél, a te szavaiddal</label>
                <textarea id="lg-title" className="lg-fin" rows={2} value={d.title} onChange={(e) => patch({ title: e.target.value })} placeholder="pl. Félmaraton tavasszal" /></div>
              <div className="lg-fcard"><label className="lg-flabel" htmlFor="lg-why">Miért fontos? · egy mondat</label>
                <textarea id="lg-why" className="lg-fin" rows={2} value={d.whyText} onChange={(e) => patch({ whyText: e.target.value })} /></div>
              <div className="lg-fcard"><label className="lg-flabel" htmlFor="lg-date">Határidő · opcionális</label>
                <input id="lg-date" className="lg-fin" type="date" value={d.targetDate} onChange={(e) => patch({ targetDate: e.target.value })} /></div>
            </>)}

            {step === 1 && (proposing || !d.source ? <div className="lg-aiwait">Mezo olvassa a célt…</div> : (<>
              <div className="lg-fcard"><span className="lg-flabel">Mezo olvasata</span><div style={{ fontSize: 12.5, fontWeight: 300 }}>{d.frameNote}</div></div>
              {d.frame === 'extrinsic' && d.reframedWhy && (
                <div className={`lg-frame ${d.useReframe ? 'ok' : ''}`}>
                  <div className="lb">{d.useReframe ? '✓ Belső keret · egészség + képesség' : '⚠ Külső keret'}</div>
                  <p>{d.useReframe ? 'A célod mondata: ' : 'Javaslat: '}<b>„{d.reframedWhy}”</b></p>
                  <div className="row gap-xs" style={{ marginTop: 8 }}>
                    <button type="button" className={`mz-chip ${d.useReframe ? 'on' : ''}`} onClick={() => patch({ useReframe: true })}>Egészség-keret · elfogadom</button>
                    <button type="button" className={`mz-chip ${!d.useReframe ? 'on' : ''}`} onClick={() => patch({ useReframe: false })}>Maradjon</button>
                  </div>
                </div>
              )}
              <div className="lg-fcard"><span className="lg-flabel">Életterület · Mezo javaslata, átírhatod</span>
                <div className="lg-dimband">{DIMENSION_ORDER.map((dim) => (
                  <button key={dim} type="button" className={`lg-dimchip ${DIMENSIONS[dim].cls} ${d.dimension === dim || d.secondaryDimension === dim ? '' : 'empty'}`}
                    aria-pressed={d.dimension === dim} onClick={() => patch({ dimension: dim, secondaryDimension: d.secondaryDimension === dim ? undefined : d.secondaryDimension })}>
                    <i />{DIMENSIONS[dim].label}{d.secondaryDimension === dim ? <b> 2.</b> : null}
                  </button>))}</div>
              </div>
            </>))}

            {step === 2 && (<>
              {d.pillars.map((p, i) => (
                <div key={i} className={`lg-pilcard ${p.on ? 'on' : 'off'}`}>
                  <ClayIcon name={DIMENSIONS[d.dimension].icon} size={26} />
                  <div style={{ flex: 1 }}><b>{p.label}</b><small>{KIND_LABEL[p.kind]} · skill: {p.skillKey}</small></div>
                  <button type="button" className={`lg-togg ${p.on ? 'on' : ''}`} aria-label={`${p.label} ${p.on ? 'ki' : 'be'}`}
                    onClick={() => patch({ pillars: d.pillars.map((x, j) => (j === i ? { ...x, on: !x.on } : x)) })} />
                </div>))}
              <button type="button" className="lg-addrow" onClick={() => setCatalogOpen(true)} disabled={d.pillars.length >= 5}>＋ Pillér a katalógusból</button>
              <p className="mz-eyebrow" style={{ marginTop: 8 }}>Az AI csak a zárt jel-katalógusból választhat · 5 pillér a felső határ.</p>
            </>)}

            {step === 3 && (<>
              <div className="lg-fcard"><span className="lg-flabel">Akadály · Mezo javaslatai vagy a sajátod</span>
                <div className="row gap-xs" style={{ flexWrap: 'wrap' }}>{d.obstacles.map((o) => (
                  <button key={o} type="button" className={`mz-chip ${d.obstacle === o ? 'on' : ''}`} onClick={() => patch({ obstacle: o })}>{o}</button>))}</div>
                <input className="lg-fin" style={{ marginTop: 8 }} value={d.obstacle} onChange={(e) => patch({ obstacle: e.target.value })} placeholder="Mi fog közbejönni?" aria-label="Akadály" />
              </div>
              {d.plans.map((p, i) => (
                <div key={i} className={`lg-plan ${p.own ? 'own' : 'on'}`}>
                  <div className="lg-prow"><span className="lg-ifthen ha" style={{ width: 46 }}>HA</span>
                    <textarea className="lg-ptxt" rows={2} value={p.ha} aria-label={`Ha ${i + 1}`} onChange={(e) => patch({ plans: d.plans.map((x, j) => (j === i ? { ...x, ha: e.target.value } : x)) })} /></div>
                  <div className="lg-prow"><span className="lg-ifthen ha akkor" style={{ width: 46 }}>AKKOR</span>
                    <textarea className="lg-ptxt" rows={2} value={p.akkor} aria-label={`Akkor ${i + 1}`} onChange={(e) => patch({ plans: d.plans.map((x, j) => (j === i ? { ...x, akkor: e.target.value } : x)) })} /></div>
                  <div className="lg-pfoot">{p.trigger ? TRIGGER_LABEL[p.trigger.source] ?? p.trigger.source : 'nincs hozzá jelem · ezt te tartod'}<span style={{ marginLeft: 'auto' }}>{p.own ? 'saját' : 'Mezo javaslata'}</span></div>
                </div>))}
              <button type="button" className="lg-addrow" onClick={() => patch({ plans: [...d.plans, { ha: '', akkor: '', own: true }] })} disabled={d.plans.length >= 5}>＋ Még egy ha–akkor</button>
            </>)}

            {step === 4 && (<>
              <div className={`lg-fcard ${DIMENSIONS[d.dimension].cls}`} style={{ background: 'linear-gradient(140deg, var(--dw), #FFFFFF 72%)' }}>
                <div className="row gap-md" style={{ alignItems: 'flex-start' }}>
                  <ClayIcon name={DIMENSIONS[d.dimension].icon} size={34} />
                  <div style={{ flex: 1 }}><b style={{ fontSize: 15 }}>{d.title}</b>
                    <div className="lg-dimband" style={{ marginTop: 4 }}><span className={`lg-dimchip ${DIMENSIONS[d.dimension].cls}`}><i />{DIMENSIONS[d.dimension].label}</span>
                      {d.secondaryDimension && <span className={`lg-dimchip ${DIMENSIONS[d.secondaryDimension].cls}`}><i />{DIMENSIONS[d.secondaryDimension].label}</span>}</div></div>
                </div>
                {(d.useReframe ? d.reframedWhy : d.whyText) && <div className="lg-why q" style={{ margin: '8px 0 0', padding: 0, background: 'none', boxShadow: 'none', border: 'none' }}>„{d.useReframe ? d.reframedWhy : d.whyText}”</div>}
                <div className="mz-eyebrow" style={{ marginTop: 8 }}>{d.targetDate ? `határidő ${d.targetDate}` : 'nincs határidő'} · {activePillars.length} pillér</div>
              </div>
              <div className="mz-eyebrow" style={{ padding: '6px 2px' }}>Így mérjük · a cél-oldalad így fog kinézni</div>
              {activePillars.map((p, i) => <div key={i} className="lg-sumpil"><ClayIcon name="i-cel" size={22} /><div><b>{p.label}</b><small>{KIND_LABEL[p.kind]} · skill {p.skillKey}</small></div></div>)}
              <div className="mz-eyebrow" style={{ padding: '6px 2px' }}>Amire Mezo figyel · {d.plans.filter((p) => p.ha && p.akkor).length} szabály</div>
              {d.plans.filter((p) => p.ha && p.akkor).map((p, i) => <div key={i} className="lg-sumpil"><div><b>HA {p.ha}</b><small>AKKOR {p.akkor}{p.trigger ? ` · ${TRIGGER_LABEL[p.trigger.source] ?? p.trigger.source}` : ' · nincs hozzá jel'}</small></div></div>)}
              <div className="lg-fcard" style={{ marginTop: 8 }}><span className="lg-flabel">Aktiválás után</span>
                <div style={{ fontSize: 11.5, fontWeight: 300 }}>Holnaptól a Nap „Célok · ma” csempéjén számol · hétfőnként a Hetiben nyíl + egy mondat · teljesült pillér-nap → XP a skillre. Nincs felső korlát az aktív célokra — ha kettő ugyanazt a pihenőt kéri, Mezo szól.</div></div>
            </>)}
          </div>

          <div className="rise row gap-sm" style={{ '--d': '120ms', padding: '8px 24px 16px' } as React.CSSProperties}>
            {step < 4 && <button type="button" className="cta-primary" style={{ flex: 1 }} disabled={!canNext || (step === 1 && !d.source)} onClick={() => (step === 0 ? void goToFrame() : setStep(step + 1))}>{step === 0 ? 'Tovább →' : `${STEPS[step + 1]} →`}</button>}
            {step === 4 && (<>
              <button type="button" className="cta-ghost" style={{ flex: 1 }} disabled={saving} onClick={() => save(false)}>Mentés tervezettként</button>
              <button type="button" className="cta-primary" style={{ flex: 1 }} disabled={saving} onClick={() => save(true)}>Aktiválás</button>
            </>)}
          </div>
        </EntranceGroup>
      </PageBody>
      <PillarCatalogSheet open={catalogOpen} onClose={() => setCatalogOpen(false)} onPick={addFromCatalog} />
    </MozaikPage>
  )
}
```

(`cta-primary` / `cta-ghost` / `mz-chip` are the house classes `GoalPlannerPage` and the Fuel sheets use — confirm the exact names with `grep -n "cta-primary\|mz-chip" frontend/src/styles/prototype.css` and substitute if they differ.)

Route: `{ path: 'me/goals/new', element: <CelWizardPage /> }` placed before `me/goals/:id`.

- [ ] **Step 3: Test**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { CelWizardPage } from '@/features/me/pages/CelWizardPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderWiz = () => render(<QueryWrapper><MemoryRouter initialEntries={['/me/goals/new']}>
  <Routes><Route path="/me/goals/new" element={<CelWizardPage />} /><Route path="/me/goals" element={<div>HUB</div>} /><Route path="/me/goals/:id" element={<div>GOAL PAGE</div>} /></Routes>
</MemoryRouter></QueryWrapper>)

test('walks all five steps: extrinsic why gets the reframe offer, proposal pillars toggle, activation lands on the goal page', async () => {
  renderWiz()
  expect(screen.getByRole('button', { name: 'Tovább →' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('A cél, a te szavaiddal'), { target: { value: 'Félmaraton tavasszal' } })
  fireEvent.change(screen.getByLabelText('Miért fontos? · egy mondat'), { target: { value: 'hogy jobban nézzek ki a strandon' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tovább →' }))
  await waitFor(() => expect(screen.getByText('⚠ Külső keret')).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Egészség-keret · elfogadom' }))
  expect(screen.getByText('✓ Belső keret · egészség + képesség')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Pillérek →' }))
  const toggles = screen.getAllByRole('button', { name: / ki$/ })
  expect(toggles.length).toBeGreaterThanOrEqual(2)
  fireEvent.click(toggles[0])
  fireEvent.click(screen.getByRole('button', { name: 'Ha–akkor →' }))
  expect(screen.getAllByText('HA').length).toBeGreaterThanOrEqual(1)
  fireEvent.click(screen.getByRole('button', { name: 'Összegzés →' }))
  expect(screen.getByText('Így indul')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Aktiválás' }))
  await waitFor(() => expect(screen.getByText('GOAL PAGE')).toBeInTheDocument())
})

test('Mentés tervezettként returns to the hub', async () => {
  renderWiz()
  fireEvent.change(screen.getByLabelText('A cél, a te szavaiddal'), { target: { value: 'Spanyol C1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tovább →' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pillérek →' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Pillérek →' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ha–akkor →' }))
  fireEvent.click(screen.getByRole('button', { name: 'Összegzés →' }))
  fireEvent.click(screen.getByRole('button', { name: 'Mentés tervezettként' }))
  await waitFor(() => expect(screen.getByText('HUB')).toBeInTheDocument())
})
```

- [ ] **Step 4: Run both modes; commit**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/pages/CelWizardPage.test.tsx && VITE_USE_MOCK=false pnpm test src/features/me/pages/CelWizardPage.test.tsx`

```bash
git add frontend/src
git commit -m "feat(lifegoal): ötlépéses cél-varázsló — keret-nudge, AI-pillérek, ha–akkor, előnézet (mezo-iizd.1)"
```

---

### Task 12: Feature doc, codemap, full gates, self-PR

**Files:**
- Create: `docs/features/lifegoal.md`
- Modify: `docs/features/goal-engine.md` (§2/§10: the weight goal now lives at `/me/goals/weight`, and is the `linked` pillar source of a life goal), `docs/features/me.md` (§3 route map: `/me/goals` = Célok hub), `docs/CODEMAP.md` (generated), `docs/design_2.0/prototypes/README.md` (celok row already there — add "implemented: slice 1" note)

- [ ] **Step 1: Write `docs/features/lifegoal.md`** with the frontmatter

```markdown
---
title: Life goals
type: feature-domain
status: in-progress
updated: 2026-09-XX
tags: [me, growth, companion, backend, data-layer, frontend]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/LifeGoalProposePort.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/LifeGoalProposeLlmAdapter.java
  - api/feature/lifegoal/lifegoal.yml
  - frontend/src/data/lifegoal
  - frontend/src/features/me/pages/CelokPage.tsx
  - frontend/src/features/me/pages/CelPage.tsx
  - frontend/src/features/me/pages/CelWizardPage.tsx
  - frontend/src/features/me/logic/lifegoalLabels.ts
related: [goal-engine, growth, companion, me, today]
---
```

and the ten sections of the template (`docs/features/README.md §5`): §1 summary (PERMAH + pillars + honest empty state), §2 user-facing behavior (hub, goal page, wizard with the five steps, status actions), §3 architecture (slice, port direction lifegoal→companion, catalog validation, template fallback), §4 data model & API (the three tables, the jsonb shapes, the nine operations, error codes), §5 integrations (companion port, progression taxonomy, habit catalog for habit keys; slice 2/3 seams listed as deferred), §6 how to consume (hooks), §7 how to extend (add a catalog entry = one `SignalCatalog` row + mock catalog row), §8 testing (the five ITs + three page tests + hook tests, commands), §9 decisions/gotchas (D1–D10 pointers to the spec, no cap, `no_data ≠ miss`, title is the fake sentinel channel), §10 key files. Link the spec and the prototype.

- [ ] **Step 2: Regenerate + lint docs**

Run: `node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs && node scripts/lint-liquibase.mjs`
Expected: CODEMAP has a `lifegoal` block; lint clean.

- [ ] **Step 3: Full local gates**

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true
cd ../frontend && pnpm build && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test
cd .. && git diff --exit-code -- api/openapi.yml frontend/src/data/_client/api.gen.ts
```
Expected: ArchUnit `feature_slices_are_cycle_free` green (no new lifegoal↔companion cycle); both FE modes green; no contract drift.

- [ ] **Step 4: Commit docs, push, self-PR**

```bash
git add docs
git commit -m "docs(lifegoal): feature doc + codemap + goal-engine/me route notes (mezo-iizd.1)"
git push -u origin feat/lifegoal-alapok
gh pr create --title "feat(lifegoal): 1. szelet — Alapok (mezo-iizd.1)" --body "$(cat <<'EOF'
Életcél-rendszer 1. szelet: tábla + kontrakt + CRUD/lifecycle + jel-katalógus + AI propose (port + template fallback) + demofixtures seed + Célok hub / cél-oldal / varázsló (mindkét FE mód). Spec: docs/superpowers/specs/2026-09-02-lifegoal-system-design.md · terv: docs/superpowers/plans/2026-09-02-lifegoal-slice-1-alapok.md.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Wait for CI green → `git checkout main && git pull --rebase && git merge --no-ff feat/lifegoal-alapok && git push && git branch -d feat/lifegoal-alapok` → `bd close mezo-iizd.1` with a one-line handoff note naming slice 2 (`LifeGoalScorer`, `SignalSource` port, `LifeGoalEvalJob`, `progress`/`today`/`signals`-liveness endpoints, `JelekPage`).

---

## Self-review (done while writing)

- **Spec coverage, slice 1:** §4 tables (T1) · §6 contract (T2) · §4 lifecycle + D7 no-cap (T3, tested with four active goals) · D4 closed catalog + skill/kind/cap validation (T3–T4) · §7 propose with SDT frame + template fallback (T5) · demofixtures seed of the three goals (T6) · §6 hooks/mock/MSW (T7) · D5 route move (T8) · §6 CelokPage/CelPage/CelWizardPage incl. D8 five steps + D9 trigger footer (T9–T11) · docs mandate + gates (T12). Deferred to slice 2 by design: scorer, job, `progress`/`today`, signals liveness (`JelekPage`), XP award, trigger evaluation; slice 3: Nap tile, Heti card, `[Célok]` prompt block, graph node, Growth chip, Én hub hero.
- **Placeholders:** none — every step carries code or an exact command; the two "confirm the generated name" notes point at a concrete file to check rather than leaving a blank.
- **Type consistency:** `LifeGoalPillarService.replace(goal, inputs)` in T3 becomes `replace(userId, goal, inputs)` in T4 — T4 says so explicitly and T3's caller passes `goal.getCreatedBy()`; hook names (`useLifeGoals`, `useLifeGoal`, `useLifeGoalMutations`, `useLifeGoalPropose`, `useSignalCatalog`) match between T7's barrel and T9–T11 imports; `DIMENSIONS[..].cls` ↔ `.lg-d-*` CSS in T9; `PillarKind` values match the DB CHECK and the catalog `kinds` lists.
