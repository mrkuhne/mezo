# Habit Engine (reggeli & esti rutin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A lean habit engine with fixed MORNING + EVENING chains: catalog-driven habits, DERIVED completion over existing logs, per-habit LIFE-skill XP via a new idempotent `HABIT` progression source, 28-day habit strength, a daypart-aware `RoutineCard` on Today and a „Rutin" tab on `/me/growth`.

**Architecture:** New backend `feature/habit` mirroring `feature/quest` (fail-fast JSON catalog + `habit_day` table + evaluator of pure repo reads + lazy read-time evaluation + nightly close cron). Contract-first (`api/feature/habit/habit.yml`). FE `data/habit/` dual-mode hooks + two new surfaces. Spec: `docs/superpowers/specs/2026-07-19-morning-evening-routine-habit-engine-design.md` (bd `mezo-d1jb`).

**Tech Stack:** Spring Boot 4 / Java 21 / Maven, Liquibase, PostgreSQL (compose on :15432), MapStruct/Lombok, OpenAPI (openapi-merge-cli + openapi-generator), React 19 + TanStack Query + Vitest/MSW.

## Global Constraints

- Base package `io.mrkuhne.mezo`; UUID PKs; owned tables carry `created_by`/`is_deleted`/`created_at`; soft delete via `@SQLDelete`/`@SQLRestriction`.
- Backend tests: `cd backend && ./mvnw clean test -Dtest=<Class>` (compose must be up; ALWAYS `clean` — Lombok+MapStruct incremental is flaky). NEVER run the full suite locally (16 GB box OOM) — CI is the full gate.
- FE gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (both modes green).
- Errors: `SystemRuntimeErrorException` + `SystemMessage.error("CODE").build()` — no hardcoded user text.
- Config: everything under `mezo:` in `application.yml`; switches via `FeaturesConfiguration` constants + `@ConditionalOnProperty`; tunables via `@Validated` `*Properties` records; **never `@Value`**.
- All user-facing copy Hungarian; code/comments English. Conventional commits with bd id `(mezo-d1jb)`.
- Worktree commits: use `git -c core.hooksPath=/dev/null commit` (bd pre-commit hook would stage `.beads/issues.jsonl`).
- ADR 0010: XP is feedback — every amount deterministic from the catalog; `missed` is quiet (no red).
- Meal slots are English tokens (`breakfast|lunch|dinner|snack`); pantry kinds are `food|supplement|stim|med`; LIFE skill keys include `recovery|mindset|productivity|cooking|mindfulness`.

---

### Task 1: API contract — habit fragment + HABIT level-up source

**Files:**
- Create: `api/feature/habit/habit.yml`
- Modify: `api/generate/merge.yml` (append input), `api/feature/train/train.yml:1702` (`LevelUpResult.source` enum)
- Generated: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: generated `HabitApi` interface (tag `Habit`) + DTOs `HabitResponse`, `HabitDayResponse`, `HabitWriteResponse`, `HabitSummaryResponse`, `HabitStrength`, `HabitCheckRequest` in `io.mrkuhne.mezo.api.dto`; FE wire types under `paths['/api/habit/...']`.
- Produces: `LevelUpResult.source` may now be `HABIT` (backend enum + FE union both regenerate).

- [ ] **Step 1: Write the fragment**

Create `api/feature/habit/habit.yml`:

```yaml
openapi: 3.0.3
info: { title: mezo habit fragment, version: 1.0.0 }
paths:
  /api/habit/day/{date}:
    get:
      tags: [Habit]
      operationId: getHabitDay
      summary: Day view of both routine chains; lazily creates + evaluates today's rows (Habits)
      parameters:
        - { name: date, in: path, required: true, schema: { type: string, format: date } }
      responses:
        '200':
          description: The day's habits (rerolled concept does not exist here)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/HabitDayResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/habit/{key}/check:
    post:
      tags: [Habit]
      operationId: checkHabit
      summary: Manually check a MANUAL habit for today (Habits)
      parameters:
        - { name: key, in: path, required: true, schema: { type: string } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/HabitCheckRequest' }
      responses:
        '200':
          description: Checked; XP awarded
          content:
            application/json:
              schema: { $ref: '#/components/schemas/HabitWriteResponse' }
        '404':
          description: HABIT_UNKNOWN
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '409':
          description: HABIT_NOT_MANUAL | HABIT_NOT_TODAY | HABIT_ALREADY_DONE
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    delete:
      tags: [Habit]
      operationId: uncheckHabit
      summary: Same-day un-check of a MANUAL habit; reverses the XP (Habits)
      parameters:
        - { name: key, in: path, required: true, schema: { type: string } }
        - { name: date, in: query, required: true, schema: { type: string, format: date } }
      responses:
        '200':
          description: Un-checked
          content:
            application/json:
              schema: { $ref: '#/components/schemas/HabitResponse' }
        '404':
          description: HABIT_UNKNOWN
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '409':
          description: HABIT_NOT_MANUAL | HABIT_NOT_TODAY | HABIT_NOT_DONE
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/habit/summary:
    get:
      tags: [Habit]
      operationId: getHabitSummary
      summary: 28-day strengths + 30-day perfect-day counters (Habits)
      responses:
        '200':
          description: Summary
          content:
            application/json:
              schema: { $ref: '#/components/schemas/HabitSummaryResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    HabitResponse:
      type: object
      required: [key, chain, position, title, why, anchorCopy, mode, status, xp]
      properties:
        id: { type: string, format: uuid }
        key: { type: string }
        chain: { type: string, enum: [MORNING, EVENING] }
        position: { type: integer }
        title: { type: string }
        why: { type: string }
        anchorCopy: { type: string }
        mode: { type: string, enum: [DERIVED, MANUAL] }
        status: { type: string, enum: [pending, done, missed] }
        doneAt: { type: string, format: date-time, nullable: true }
        xp: { type: integer }
        strengthPct: { type: integer, nullable: true, description: trailing-28d done ratio, null under min-sample }
    HabitDayResponse:
      type: object
      required: [date, habits, levelUps]
      properties:
        date: { type: string, format: date }
        habits:
          type: array
          items: { $ref: '#/components/schemas/HabitResponse' }
        levelUps:
          type: array
          items: { $ref: '#/components/schemas/LevelUpResult' }
    HabitWriteResponse:
      type: object
      required: [habit, levelUps]
      properties:
        habit: { $ref: '#/components/schemas/HabitResponse' }
        levelUps:
          type: array
          items: { $ref: '#/components/schemas/LevelUpResult' }
    HabitCheckRequest:
      type: object
      required: [date]
      properties:
        date: { type: string, format: date }
    HabitStrength:
      type: object
      required: [key, done28, missed28]
      properties:
        key: { type: string }
        strengthPct: { type: integer, nullable: true }
        done28: { type: integer }
        missed28: { type: integer }
    HabitSummaryResponse:
      type: object
      required: [perfectMorningDays30, perfectEveningDays30, habits]
      properties:
        perfectMorningDays30: { type: integer }
        perfectEveningDays30: { type: integer }
        habits:
          type: array
          items: { $ref: '#/components/schemas/HabitStrength' }
```

- [ ] **Step 2: Register the fragment + extend the LevelUpResult source enum**

In `api/generate/merge.yml` append after the activity input:

```yaml
  - inputFile: ../feature/habit/habit.yml
```

In `api/feature/train/train.yml` line ~1702 change:

```yaml
        source: { type: string, enum: [GYM, SPORT, RUN, QUEST, ACTIVITY, HABIT] }
```

- [ ] **Step 3: Merge + regenerate FE types**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: `api/openapi.yml` now contains `/api/habit/day/{date}` and the source enum lists `HABIT`; `git diff --stat frontend/src/data/_client/api.gen.ts` shows changes.

- [ ] **Step 4: Verify backend generation compiles**

Run: `cd backend && ./mvnw -q clean generate-sources 2>&1 | tail -3 && ls target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/controller/HabitApi.java`
Expected: the `HabitApi.java` path prints.

- [ ] **Step 5: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(api): habit fragment — day/check/uncheck/summary + HABIT level-up source (mezo-d1jb)"
```

---

### Task 2: Migration, entity, repository, config scaffolding

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607192100_mezo-d1jb_create_habit_day.sql`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/entity/HabitDayEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/repository/HabitDayRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/config/HabitProperties.java`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeSet)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (two constants)
- Modify: `backend/src/main/resources/application.yml` (switch + cron switch + `mezo.habit` block)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (TRUNCATE list)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitDayEntityIT.java`

**Interfaces:**
- Produces: `HabitDayEntity` (constants `STATUS_PENDING|STATUS_DONE|STATUS_MISSED`, `SOURCE_DERIVED|SOURCE_MANUAL`; fields `habitDate`, `habitKey`, `status`, `doneAt`, `xpAwarded`, `source`), `HabitDayRepository` finders (listed below), `HabitProperties` (prefix `mezo.habit`), `FeaturesConfiguration.HABIT_SWITCH` / `HABIT_JOB_SWITCH`.

- [ ] **Step 1: Write the migration**

`202607192100_mezo-d1jb_create_habit_day.sql`:

```sql
-- Habit engine (bd mezo-d1jb): fixed morning/evening routine chains. One row per (user, day, habit).
-- Also relaxes the released level_up_event.source_type CHECK additively: += HABIT (habit XP rides
-- the shared idempotent award tail — ADR 0010, deterministic catalog amounts).

alter table level_up_event drop constraint ck_level_up_event_source_type;
alter table level_up_event add constraint ck_level_up_event_source_type
    check (source_type in ('GYM', 'SPORT', 'RUN', 'QUEST', 'ACTIVITY', 'HABIT'));

create table habit_day (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    habit_date  date        not null,
    habit_key   varchar(40) not null,
    status      varchar(8)  not null default 'pending',
    done_at     timestamptz,
    xp_awarded  integer     not null default 0,
    source      varchar(7),
    constraint pk_habit_day_id primary key (id),
    constraint fk_habit_day_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_habit_day_status check (status in ('pending', 'done', 'missed')),
    constraint ck_habit_day_source check (source is null or source in ('DERIVED', 'MANUAL')),
    constraint ck_habit_day_xp check (xp_awarded >= 0)
);

create index idx_habit_day_user_date on habit_day (created_by, habit_date) where is_deleted = false;
create unique index uq_habit_day_user_date_key on habit_day (created_by, habit_date, habit_key)
    where is_deleted = false;
```

Append to `1.0.0_master.yml` (same shape as the daily_quest entry):

```yaml
  - changeSet:
      id: "1.0.0:202607192100_mezo-d1jb_create_habit_day"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607192100_mezo-d1jb_create_habit_day.sql
```

- [ ] **Step 2: Entity + repository**

`HabitDayEntity.java`:

```java
package io.mrkuhne.mezo.feature.habit.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** One habit × day row. Chain/position/title/xp live in the static catalog, not here. */
@Getter
@Setter
@Entity
@Table(name = "habit_day")
@SQLDelete(sql = "update habit_day set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class HabitDayEntity extends OwnedEntity {

    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_DONE = "done";
    public static final String STATUS_MISSED = "missed";
    public static final String SOURCE_DERIVED = "DERIVED";
    public static final String SOURCE_MANUAL = "MANUAL";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "habit_date", nullable = false)
    private LocalDate habitDate;

    @Column(name = "habit_key", nullable = false, length = 40)
    private String habitKey;

    @Column(nullable = false, length = 8)
    private String status = STATUS_PENDING;

    @Column(name = "done_at")
    private Instant doneAt;

    @Column(name = "xp_awarded", nullable = false)
    private Integer xpAwarded = 0;

    @Column(length = 7)
    private String source;
}
```

`HabitDayRepository.java`:

```java
package io.mrkuhne.mezo.feature.habit.repository;

import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitDayRepository extends JpaRepository<HabitDayEntity, UUID> {

    List<HabitDayEntity> findByCreatedByAndHabitDate(UUID createdBy, LocalDate habitDate);

    Optional<HabitDayEntity> findByCreatedByAndHabitDateAndHabitKey(
        UUID createdBy, LocalDate habitDate, String habitKey);

    List<HabitDayEntity> findByCreatedByAndStatusAndHabitDateBefore(
        UUID createdBy, String status, LocalDate before);

    List<HabitDayEntity> findByCreatedByAndHabitDateBetween(
        UUID createdBy, LocalDate from, LocalDate to);
}
```

- [ ] **Step 3: Config**

`FeaturesConfiguration.java` — append next to the quest pair:

```java
    /** Habit engine (morning/evening routine chains, mezo-d1jb). Gates /api/habit + services. */
    public static final String HABIT_SWITCH = "mezo.feature.habit.enabled";

    /** Nightly habit close cron (end-of-day + next-day metrics) — schedule: mezo.habit.close-cron. */
    public static final String HABIT_JOB_SWITCH = "mezo.techcore.cron.habit-job.enabled";
```

`application.yml` — under `mezo.feature` add `habit: { enabled: true }` (expanded style matching neighbors); under `mezo.techcore.cron` add:

```yaml
      # Nightly habit close: evaluates end-of-day metrics (caffeine cutoff, kitchen close) and
      # quietly marks the rest missed; off = the HabitJob bean does not exist (reads still close lazily)
      habit-job:
        enabled: true
```

Top-level `mezo.habit` block (sibling of `mezo.quest`):

```yaml
  habit:
    close-cron: "0 10 0 * * *"    # 00:10 — after the quest finalize
    wake-window-min: 45
    weigh-in-cutoff: "09:00"
    morning-window-end: "10:00"
    workout-cutoff: "12:00"
    protein-target-g: 25
    caffeine-cutoff: "14:00"
    bed-grace-min: 30
    kitchen-close-offset-min: 90
    default-wake: "06:00"
    default-bed: "23:00"
    strength-window-days: 28
    min-sample: 5
    summary-days: 30
```

`HabitProperties.java`:

```java
package io.mrkuhne.mezo.feature.habit.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Habit tuning (mezo.habit): every target window/cutoff is config, never code (ADR 0010). */
@Validated
@ConfigurationProperties(prefix = "mezo.habit")
public record HabitProperties(
    @NotBlank String closeCron,
    @Min(0) int wakeWindowMin,
    @NotBlank String weighInCutoff,
    @NotBlank String morningWindowEnd,
    @NotBlank String workoutCutoff,
    @Min(1) int proteinTargetG,
    @NotBlank String caffeineCutoff,
    @Min(0) int bedGraceMin,
    @Min(0) int kitchenCloseOffsetMin,
    @NotBlank String defaultWake,
    @NotBlank String defaultBed,
    @Min(1) int strengthWindowDays,
    @Min(1) int minSample,
    @Min(1) int summaryDays) {}
```

`ResetDatabase.java` — prepend `habit_day, ` to the TRUNCATE list (before `activity_log`).

- [ ] **Step 4: Write the entity IT**

`HabitDayEntityIT.java`:

```java
package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class HabitDayEntityIT extends AbstractIntegrationTest {

    @Autowired
    private HabitDayRepository repository;

    @Test
    void testSave_shouldRoundTripAndSoftDelete_whenPersisted() {
        UUID owner = databasePopulator.ensureOwner();
        HabitDayEntity e = new HabitDayEntity();
        e.setCreatedBy(owner);
        e.setHabitDate(LocalDate.now());
        e.setHabitKey("morning_sunlight");
        repository.saveAndFlush(e);

        var found = repository.findByCreatedByAndHabitDate(owner, LocalDate.now());
        assertThat(found).hasSize(1);
        assertThat(found.getFirst().getStatus()).isEqualTo(HabitDayEntity.STATUS_PENDING);
        assertThat(found.getFirst().getXpAwarded()).isZero();

        repository.delete(found.getFirst());
        repository.flush();
        assertThat(repository.findByCreatedByAndHabitDate(owner, LocalDate.now())).isEmpty();
    }
}
```

Note: check how sibling entity ITs obtain the owner (`databasePopulator.ensureOwner()` vs a `UserPopulator` method) and mirror that exact idiom — copy it from `DailyQuestEntityIT`.

- [ ] **Step 5: Run the IT**

Run: `cd backend && ./mvnw clean test -Dtest=HabitDayEntityIT -DargLine=-Xmx3g`
Expected: PASS (migration applied, entity round-trips, partial-unique + soft delete hold).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main backend/src/test
git -c core.hooksPath=/dev/null commit -m "feat(habit): habit_day table + entity/repository + config scaffolding (mezo-d1jb)"
```

---

### Task 3: Habit catalog — content JSON + fail-fast loader

**Files:**
- Create: `backend/src/main/resources/content/habit-catalog.json`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/HabitCatalog.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitCatalogIT.java`

**Interfaces:**
- Produces: `HabitCatalog` (`@Component`, gated on `HABIT_SWITCH`) with `record HabitDef(String key, String chain, int position, String title, String why, String anchorCopy, String mode, String metric, String skillKey, String skillKind, int xp)`; methods `List<HabitDef> all()` (chain+position ordered), `Optional<HabitDef> byKey(String key)`, `List<HabitDef> forChain(String chain)`. Constants `CHAIN_MORNING = "MORNING"`, `CHAIN_EVENING = "EVENING"`, `MODE_DERIVED`, `MODE_MANUAL`.

- [ ] **Step 1: Write the catalog JSON**

`content/habit-catalog.json` (10 entries, spec §3; MANUAL entries use `metric: "manual"`):

```json
[
  { "key": "wake_on_time", "chain": "MORNING", "position": 1,
    "title": "Ébredés időben", "why": "A napfelkeltéhez igazított ébredés indítja az esti melatonint — a mély alvás reggel kezdődik.",
    "anchorCopy": "a lánc kezdete", "mode": "DERIVED", "metric": "sleep_wake_window",
    "skillKey": "recovery", "skillKind": "LIFE", "xp": 10 },
  { "key": "morning_sunlight", "chain": "MORNING", "position": 2,
    "title": "Reggeli napfény", "why": "10 perc reggeli fény a szemednek — este pontosabban érkezik az álmosság.",
    "anchorCopy": "ébredés után", "mode": "MANUAL", "metric": "manual",
    "skillKey": "recovery", "skillKind": "LIFE", "xp": 5 },
  { "key": "morning_weigh_in", "chain": "MORNING", "position": 3,
    "title": "Reggeli súlymérés", "why": "Ugyanakkor mérve a reggeli súly a valódi alapvonal — azonnali visszajelzés a hétre.",
    "anchorCopy": "fogmosás után", "mode": "DERIVED", "metric": "weight_logged_before",
    "skillKey": "mindset", "skillKind": "LIFE", "xp": 10 },
  { "key": "morning_coffee", "chain": "MORNING", "position": 4,
    "title": "Gombakávé", "why": "A korai koffein a mélymunkát fűti — és estére már nyoma sincs.",
    "anchorCopy": "súlymérés után", "mode": "DERIVED", "metric": "stim_intake_before",
    "skillKey": "productivity", "skillKind": "LIFE", "xp": 5 },
  { "key": "morning_workout", "chain": "MORNING", "position": 5,
    "title": "Reggeli edzés", "why": "A reggeli mozgás előrébb tolja a belső órát — este könnyebben alszol el.",
    "anchorCopy": "kávé után", "mode": "DERIVED", "metric": "training_done_today",
    "skillKey": "mindset", "skillKind": "LIFE", "xp": 15 },
  { "key": "protein_breakfast", "chain": "MORNING", "position": 6,
    "title": "Fehérjés reggeli", "why": "Legalább 25 g fehérje reggel — az éjszakai lebontás után építésbe fordulsz.",
    "anchorCopy": "edzés után", "mode": "DERIVED", "metric": "breakfast_protein",
    "skillKey": "cooking", "skillKind": "LIFE", "xp": 10 },
  { "key": "caffeine_cutoff", "chain": "EVENING", "position": 1,
    "title": "Koffein-cutoff", "why": "A koffein felezési ideje ~6 óra — a délutáni kávé az éjszakádból vesz el.",
    "anchorCopy": "a lánc kezdete", "mode": "DERIVED", "metric": "no_stim_after",
    "skillKey": "recovery", "skillKind": "LIFE", "xp": 10 },
  { "key": "kitchen_close", "chain": "EVENING", "position": 2,
    "title": "Konyha zárva", "why": "Az utolsó falat és a lefekvés közti 90 perc a mély alvásod védőzónája.",
    "anchorCopy": "vacsora után", "mode": "DERIVED", "metric": "last_meal_before",
    "skillKey": "recovery", "skillKind": "LIFE", "xp": 10 },
  { "key": "wind_down", "chain": "EVENING", "position": 3,
    "title": "Wind-down, képernyő le", "why": "A tompuló fény jelzi az agyadnak: jöhet a melatonin.",
    "anchorCopy": "konyhazárás után", "mode": "MANUAL", "metric": "manual",
    "skillKey": "mindfulness", "skillKind": "LIFE", "xp": 5 },
  { "key": "bed_on_time", "chain": "EVENING", "position": 4,
    "title": "Lefekvés időben", "why": "A fix lefekvés a teljes lánc záróköve — ettől lesz holnap is reggeled.",
    "anchorCopy": "wind-down után", "mode": "DERIVED", "metric": "bedtime_next_day",
    "skillKey": "recovery", "skillKind": "LIFE", "xp": 15 }
]
```

- [ ] **Step 2: Write the loader**

`HabitCatalog.java` (mirror `QuestCatalog` — SB4 Jackson is `tools.jackson.databind.ObjectMapper`):

```java
package io.mrkuhne.mezo.feature.habit;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/** Static habit content, loaded fail-fast at startup (the QuestCatalog pattern). */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitCatalog {

    public static final String CHAIN_MORNING = "MORNING";
    public static final String CHAIN_EVENING = "EVENING";
    public static final String MODE_DERIVED = "DERIVED";
    public static final String MODE_MANUAL = "MANUAL";

    private static final Set<String> CHAINS = Set.of(CHAIN_MORNING, CHAIN_EVENING);
    private static final Set<String> MODES = Set.of(MODE_DERIVED, MODE_MANUAL);

    public record HabitDef(String key, String chain, int position, String title, String why,
        String anchorCopy, String mode, String metric, String skillKey, String skillKind, int xp) {}

    private final ObjectMapper objectMapper;
    private List<HabitDef> defs;

    @PostConstruct
    void load() {
        List<HabitDef> read = readCatalog();
        read.forEach(this::validate);
        defs = read.stream()
            .sorted(Comparator.comparing(HabitDef::chain).thenComparing(HabitDef::position))
            .toList();
    }

    private List<HabitDef> readCatalog() {
        try (InputStream in = new ClassPathResource("content/habit-catalog.json").getInputStream()) {
            return List.of(objectMapper.readValue(in, HabitDef[].class));
        } catch (IOException e) {
            throw new IllegalStateException("content/habit-catalog.json is unreadable", e);
        }
    }

    private void validate(HabitDef d) {
        boolean ok = d.key() != null && !d.key().isBlank()
            && CHAINS.contains(d.chain())
            && MODES.contains(d.mode())
            && d.position() >= 1
            && "LIFE".equals(d.skillKind())
            && d.xp() >= 5 && d.xp() <= 15
            && d.metric() != null && !d.metric().isBlank()
            && (MODE_MANUAL.equals(d.mode()) == "manual".equals(d.metric()));
        if (!ok) {
            throw new IllegalStateException("Invalid habit-catalog item: key=" + d.key());
        }
    }

    public List<HabitDef> all() {
        return defs;
    }

    public Optional<HabitDef> byKey(String key) {
        return defs.stream().filter(d -> d.key().equals(key)).findFirst();
    }

    public List<HabitDef> forChain(String chain) {
        return defs.stream().filter(d -> d.chain().equals(chain)).toList();
    }
}
```

Note: mirror `QuestCatalog`'s actual read idiom if it differs (e.g. `objectMapper.readValue(in, new TypeReference<...>)` under Jackson 3) — copy the exact call shape from `feature/quest/QuestCatalog.java:46-53`.

- [ ] **Step 3: Write the IT**

`HabitCatalogIT.java`:

```java
package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class HabitCatalogIT extends AbstractIntegrationTest {

    @Autowired
    private HabitCatalog catalog;

    @Test
    void testLoad_shouldExposeTenOrderedHabits_whenContextBoots() {
        assertThat(catalog.all()).hasSize(10);
        assertThat(catalog.forChain(HabitCatalog.CHAIN_MORNING)).hasSize(6);
        assertThat(catalog.forChain(HabitCatalog.CHAIN_EVENING)).hasSize(4);
        assertThat(catalog.forChain(HabitCatalog.CHAIN_MORNING))
            .extracting(HabitCatalog.HabitDef::position)
            .containsExactly(1, 2, 3, 4, 5, 6);
        assertThat(catalog.byKey("morning_weigh_in")).isPresent();
        assertThat(catalog.byKey("nope")).isEmpty();
    }
}
```

- [ ] **Step 4: Run it**

Run: `cd backend && ./mvnw clean test -Dtest=HabitCatalogIT -DargLine=-Xmx3g`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git -c core.hooksPath=/dev/null commit -m "feat(habit): habit catalog content + fail-fast loader (mezo-d1jb)"
```

---

### Task 4: Progression — HABIT source (applyHabit + revertHabit)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/habit/HabitSignal.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/ProgressionService.java` (constant + 2 methods)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionHabitIT.java`

**Interfaces:**
- Consumes: the existing private idempotent `award(...)` tail, `LevelUpEventRepository.findByCreatedByAndSourceTypeAndSourceRefId`, `SkillProgressRepository.findByCreatedByAndSkillKey`, `curve.levelFor`.
- Produces: `record HabitSignal(UUID habitDayId, String skillKey, int xp, String label)`; `ProgressionService.SOURCE_HABIT = "HABIT"`; `LevelUpResult applyHabit(UUID createdBy, HabitSignal signal)`; `void revertHabit(UUID createdBy, UUID habitDayId, String skillKey, long xp)`.

- [ ] **Step 1: Write the failing IT**

`ProgressionHabitIT.java`:

```java
package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.habit.HabitSignal;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class ProgressionHabitIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private LevelUpEventRepository levelUpEventRepository;
    @Autowired private SkillProgressRepository skillProgressRepository;

    @Test
    void testApplyHabit_shouldAwardOnceAndRevertCleanly_whenCalledTwiceThenReverted() {
        UUID owner = databasePopulator.ensureOwner();
        UUID habitDayId = UUID.randomUUID();
        HabitSignal signal = new HabitSignal(habitDayId, "recovery", 10, "Reggeli napfény");

        LevelUpResult first = progressionService.applyHabit(owner, signal);
        assertThat(first.source()).isEqualTo("HABIT");
        assertThat(first.totalXp()).isEqualTo(10);

        // idempotent re-apply returns the stored payload, no double XP
        progressionService.applyHabit(owner, signal);
        var row = skillProgressRepository.findByCreatedByAndSkillKey(owner, "recovery").orElseThrow();
        assertThat(row.getCumulativeXp()).isEqualTo(10);

        // revert: event deleted + XP decremented -> a re-apply awards again
        progressionService.revertHabit(owner, habitDayId, "recovery", 10);
        assertThat(levelUpEventRepository
            .findByCreatedByAndSourceTypeAndSourceRefId(owner, "HABIT", habitDayId)).isEmpty();
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(owner, "recovery")
            .orElseThrow().getCumulativeXp()).isZero();

        LevelUpResult again = progressionService.applyHabit(owner, signal);
        assertThat(again.totalXp()).isEqualTo(10);
    }
}
```

(Adapt the owner-acquisition + any record-vs-getter accessor mismatches to the actual `LevelUpResult` API — it is a record, so `first.source()` is correct; copy the idiom from `QuestApiIT` / existing progression ITs.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionHabitIT -DargLine=-Xmx3g`
Expected: COMPILE FAILURE (`HabitSignal`/`applyHabit` missing).

- [ ] **Step 3: Implement**

`feature/progression/habit/HabitSignal.java`:

```java
package io.mrkuhne.mezo.feature.progression.habit;

import java.util.UUID;

/** Completion signal from the habit feature — all habits land on LIFE skills in v1. */
public record HabitSignal(UUID habitDayId, String skillKey, int xp, String label) {}
```

`ProgressionService.java` — add next to `SOURCE_ACTIVITY`:

```java
    public static final String SOURCE_HABIT = "HABIT";
```

Add the two methods next to `applyActivity` / `moveActivityXp`:

```java
    /** Habit completion XP — catalog-deterministic, LIFE kind, idempotent per habit_day row. */
    @Transactional
    public LevelUpResult applyHabit(UUID createdBy, HabitSignal signal) {
        Map<String, Long> deltas = new LinkedHashMap<>();
        Map<String, String> kinds = new LinkedHashMap<>();
        if (signal.xp() > 0) {
            deltas.put(signal.skillKey(), (long) signal.xp());
            kinds.put(signal.skillKey(), "LIFE");
        }
        return award(createdBy, SOURCE_HABIT, signal.habitDayId(), deltas, kinds,
            signal.label(), null, null);
    }

    /**
     * Same-day manual un-check: delete the award event (so a re-check can re-award) and
     * decrement the skill row directly — the moveActivityXp precedent, no new level_up_event.
     */
    @Transactional
    public void revertHabit(UUID createdBy, UUID habitDayId, String skillKey, long xp) {
        levelUpEventRepository
            .findByCreatedByAndSourceTypeAndSourceRefId(createdBy, SOURCE_HABIT, habitDayId)
            .ifPresent(levelUpEventRepository::delete);
        skillProgressRepository.findByCreatedByAndSkillKey(createdBy, skillKey).ifPresent(row -> {
            row.setCumulativeXp(Math.max(0, row.getCumulativeXp() - xp));
            row.setCurrentLevel(curve.levelFor(row.getCumulativeXp()));
            skillProgressRepository.save(row);
        });
    }
```

Import `io.mrkuhne.mezo.feature.progression.habit.HabitSignal`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionHabitIT -DargLine=-Xmx3g`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git -c core.hooksPath=/dev/null commit -m "feat(progression): HABIT source — applyHabit + revertHabit on the idempotent award tail (mezo-d1jb)"
```

---

### Task 5: HabitEvaluator + populator extensions

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitTargets.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitEvaluator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/SleepLogPopulator.java` (overload with bedtime/wakeup)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/WeightLogPopulator.java` (backdated created_at overload)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/PantryItemPopulator.java` (`createStim`)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/MealPopulator.java` (explicit loggedAt overload)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitEvaluatorIT.java`

**Interfaces:**
- Consumes: repos/services listed below; `HabitProperties`; `GoalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")`.
- Produces: `HabitTargets` (`@Component`, gated `HABIT_SWITCH`) with `record Resolved(LocalTime wake, LocalTime bed)` and `Resolved resolve(UUID userId)`; `HabitEvaluator` (`@Service`, gated `HABIT_SWITCH`) with `boolean satisfied(String metric, UUID userId, LocalDate date)`. Metric set: `sleep_wake_window | weight_logged_before | stim_intake_before | training_done_today | breakfast_protein | no_stim_after | last_meal_before | bedtime_next_day` (`manual` never reaches the evaluator; unknown → warn + false).

- [ ] **Step 1: Populator extensions**

`SleepLogPopulator` — add:

```java
    /** Full sleep log incl. bed/wake clock strings (habit wake-window / bed-on-time tests). */
    public SleepLogEntity createSleepLog(UUID owner, LocalDate date, String bedtime, String wakeup,
        BigDecimal durationH) {
        SleepLogEntity e = new SleepLogEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setBedtime(bedtime);
        e.setWakeup(wakeup);
        e.setDurationH(durationH);
        e.setQuality(7);
        return sleepLogRepository.saveAndFlush(e);
    }
```

`WeightLogPopulator` — add a backdating overload (`@CreationTimestamp` cannot be set through JPA; use a native update — inject `jakarta.persistence.EntityManager em`):

```java
    /** Weight log with a controlled created_at (habit weigh-in-cutoff tests). */
    public WeightLogEntity createWeightLogAt(UUID owner, LocalDate date, BigDecimal weightKg,
        Instant createdAt) {
        WeightLogEntity e = createWeightLog(owner, date, weightKg);
        em.createNativeQuery("update weight_log set created_at = :at where id = :id")
            .setParameter("at", createdAt).setParameter("id", e.getId()).executeUpdate();
        em.clear();
        return weightLogRepository.findById(e.getId()).orElseThrow();
    }
```

`PantryItemPopulator` — add (copy `createSupplement`'s body, change the kind):

```java
    public PantryItemEntity createStim(UUID owner, String name) {
        PantryItemEntity e = new PantryItemEntity();
        e.setCreatedBy(owner);
        e.setName(name);
        e.setKind("stim");
        return repository.saveAndFlush(e);
    }
```

(Mirror whatever required fields `createSupplement` sets — copy them verbatim and only change `kind`.)

`MealPopulator` — add:

```java
    /** Breakfast pantry meal with an explicit loggedAt instant (kitchen-close tests). */
    public MealEntity createPantryMeal(UUID owner, PantryItemEntity pantryItem, LocalDate mealDate,
        Instant loggedAt) {
        MealEntity meal = createPantryMeal(owner, pantryItem, mealDate);
        meal.setLoggedAt(loggedAt);
        return repository.saveAndFlush(meal);
    }
```

- [ ] **Step 2: Write the failing IT**

`HabitEvaluatorIT.java` — one test per metric, deterministic data via populators. Representative set (write ALL of these):

```java
package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.habit.service.HabitEvaluator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class HabitEvaluatorIT extends AbstractIntegrationTest {

    @Autowired private HabitEvaluator evaluator;

    private static Instant at(LocalDate date, String hhmm) {
        return LocalDateTime.of(date, LocalTime.parse(hhmm)).atZone(ZoneId.systemDefault()).toInstant();
    }

    @Test
    void testSatisfied_shouldPassWakeWindow_whenWakeupInsideWindow() {
        UUID owner = databasePopulator.ensureOwner();
        LocalDate d = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, d, "23:10", "06:20", new BigDecimal("7.2"));
        assertThat(evaluator.satisfied("sleep_wake_window", owner, d)).isTrue();
    }

    @Test
    void testSatisfied_shouldFailWakeWindow_whenWakeupTooLate() {
        UUID owner = databasePopulator.ensureOwner();
        LocalDate d = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, d, "23:10", "07:30", new BigDecimal("7.2"));
        assertThat(evaluator.satisfied("sleep_wake_window", owner, d)).isFalse();
    }

    @Test
    void testSatisfied_shouldRespectWeighInCutoff_whenCreatedAtVaries() {
        UUID owner = databasePopulator.ensureOwner();
        LocalDate d = LocalDate.now();
        weightLogPopulator.createWeightLogAt(owner, d, new BigDecimal("81.4"), at(d, "07:45"));
        assertThat(evaluator.satisfied("weight_logged_before", owner, d)).isTrue();
    }

    @Test
    void testSatisfied_shouldFailWeighIn_whenLoggedAfterCutoff() {
        UUID owner = databasePopulator.ensureOwner();
        LocalDate d = LocalDate.now();
        weightLogPopulator.createWeightLogAt(owner, d, new BigDecimal("81.4"), at(d, "11:15"));
        assertThat(evaluator.satisfied("weight_logged_before", owner, d)).isFalse();
    }

    @Test
    void testSatisfied_shouldPassMorningCoffee_whenStimIntakeBeforeWindowEnd() {
        UUID owner = databasePopulator.ensureOwner();
        LocalDate d = LocalDate.now();
        var stim = pantryItemPopulator.createStim(owner, "Tasty Dose gombakávé");
        supplementIntakePopulator.createIntake(owner, stim.getId(), at(d, "06:40"));
        assertThat(evaluator.satisfied("stim_intake_before", owner, d)).isTrue();
    }

    @Test
    void testSatisfied_shouldPassTraining_whenRunLoggedToday() {
        UUID owner = databasePopulator.ensureOwner();
        LocalDate d = LocalDate.now();
        var block = runningPopulator.createSprintBlock(owner);
        runningPopulator.createRunLog(owner, block.getId(), 1, "s1", d, 5);
        assertThat(evaluator.satisfied("training_done_today", owner, d)).isTrue();
    }

    @Test
    void testSatisfied_shouldPassBreakfastProtein_whenBreakfastMealMeetsTarget() {
        UUID owner = databasePopulator.ensureOwner();
        LocalDate d = LocalDate.now();
        var item = pantryItemPopulator.createFood(owner, "Skyr", null);
        mealPopulator.createPantryMeal(owner, item, d); // breakfast, 34.5 g protein
        assertThat(evaluator.satisfied("breakfast_protein", owner, d)).isTrue();
    }

    @Test
    void testSatisfied_shouldFailCaffeineCutoff_whenStimTakenAfterCutoff() {
        UUID owner = databasePopulator.ensureOwner();
        LocalDate d = LocalDate.now();
        var stim = pantryItemPopulator.createStim(owner, "Origin pre-workout");
        supplementIntakePopulator.createIntake(owner, stim.getId(), at(d, "16:00"));
        assertThat(evaluator.satisfied("no_stim_after", owner, d)).isFalse();
    }

    @Test
    void testSatisfied_shouldPassCaffeineCutoff_whenNoLateStim() {
        UUID owner = databasePopulator.ensureOwner();
        assertThat(evaluator.satisfied("no_stim_after", owner, LocalDate.now())).isTrue();
    }

    @Test
    void testSatisfied_shouldEvaluateKitchenClose_onLastMealTime() {
        UUID owner = databasePopulator.ensureOwner();
        LocalDate d = LocalDate.now();
        var item = pantryItemPopulator.createFood(owner, "Rizs", null);
        mealPopulator.createPantryMeal(owner, item, d, at(d, "19:30"));
        assertThat(evaluator.satisfied("last_meal_before", owner, d)).isTrue();
        mealPopulator.createPantryMeal(owner, item, d, at(d, "22:40"));
        assertThat(evaluator.satisfied("last_meal_before", owner, d)).isFalse();
    }

    @Test
    void testSatisfied_shouldEvaluateBedtimeNextDay_withMidnightWrap() {
        UUID owner = databasePopulator.ensureOwner();
        LocalDate d = LocalDate.now().minusDays(1);
        sleepLogPopulator.createSleepLog(owner, d.plusDays(1), "23:15", "06:30", new BigDecimal("7.0"));
        assertThat(evaluator.satisfied("bedtime_next_day", owner, d)).isTrue();
    }

    @Test
    void testSatisfied_shouldFailBedtime_whenAfterMidnight() {
        UUID owner = databasePopulator.ensureOwner();
        LocalDate d = LocalDate.now().minusDays(1);
        sleepLogPopulator.createSleepLog(owner, d.plusDays(1), "00:40", "07:10", new BigDecimal("6.5"));
        assertThat(evaluator.satisfied("bedtime_next_day", owner, d)).isFalse();
    }

    @Test
    void testSatisfied_shouldReturnFalse_whenMetricUnknown() {
        assertThat(evaluator.satisfied("nope", databasePopulator.ensureOwner(), LocalDate.now())).isFalse();
    }
}
```

Add the populator `@Autowired` fields the class needs (`sleepLogPopulator`, `weightLogPopulator`, `pantryItemPopulator`, `supplementIntakePopulator`, `runningPopulator`, `mealPopulator`) — check `AbstractIntegrationTest` first: populators are `@Import`ed there but autowired per-test-class. `RunningPopulator.createRunLog`'s exact signature is `createRunLog(UUID createdBy, UUID blockId, int weekNumber, ...)` — open the file and match it (adjust the call above to the real parameter list; the `createLog(createdBy, blockId, week, key)` convenience may be enough IF it stamps `date = today`; verify and use whichever lets you set `date == today`).

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=HabitEvaluatorIT -DargLine=-Xmx3g`
Expected: COMPILE FAILURE (`HabitEvaluator` missing).

- [ ] **Step 4: Implement HabitTargets + HabitEvaluator**

`HabitTargets.java`:

```java
package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.habit.config.HabitProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Wake/bed anchors: active goal day-planner first, config defaults otherwise (spec D6). */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitTargets {

    private final GoalRepository goalRepository;
    private final HabitProperties properties;

    public record Resolved(LocalTime wake, LocalTime bed) {}

    public Resolved resolve(UUID userId) {
        var active = goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")
            .stream().findFirst();
        LocalTime wake = active.map(g -> g.getWakeTime()).filter(t -> t != null && !t.isBlank())
            .map(LocalTime::parse).orElse(LocalTime.parse(properties.defaultWake()));
        LocalTime bed = active.map(g -> g.getBedTime()).filter(t -> t != null && !t.isBlank())
            .map(LocalTime::parse).orElse(LocalTime.parse(properties.defaultBed()));
        return new Resolved(wake, bed);
    }
}
```

`HabitEvaluator.java`:

```java
package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.fuel.repository.SupplementIntakeRepository;
import io.mrkuhne.mezo.feature.habit.config.HabitProperties;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Pure reads over already-logged data (the QuestEvaluator twin) — habits are never self-claimed
 * where a real signal exists. Unknown metric -> false (a stale catalog row can't complete).
 * Timestamp-less sources degrade to honest date-presence (spec §3 note): gym sessions have no
 * completed_at, so training_done_today counts a completed instance on the date.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitEvaluator {

    private final SleepLogRepository sleepLogRepository;
    private final WeightLogRepository weightLogRepository;
    private final SupplementIntakeRepository supplementIntakeRepository;
    private final PantryItemRepository pantryItemRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final RunSessionLogRepository runSessionLogRepository;
    private final MealRepository mealRepository;
    private final FuelDayService fuelDayService;
    private final HabitTargets habitTargets;
    private final HabitProperties properties;

    /** Metrics decidable during the day (re-checked on every read). */
    public static final Set<String> INTRADAY_METRICS = Set.of("sleep_wake_window", "manual",
        "weight_logged_before", "stim_intake_before", "training_done_today", "breakfast_protein");
    /** Metrics decidable only once the day is over (nightly close / next read). */
    public static final Set<String> END_OF_DAY_METRICS = Set.of("no_stim_after", "last_meal_before");
    /** Decided by the NEXT day's sleep log (deadline: next day noon). */
    public static final String METRIC_BED_NEXT_DAY = "bedtime_next_day";

    public boolean satisfied(String metric, UUID userId, LocalDate date) {
        return switch (metric) {
            case "sleep_wake_window" -> sleepLog(userId, date)
                .map(SleepLogEntity::getWakeup).filter(Objects::nonNull)
                .map(w -> withinWindow(LocalTime.parse(w),
                    habitTargets.resolve(userId).wake(), properties.wakeWindowMin()))
                .orElse(false);
            case "weight_logged_before" -> weightLogRepository
                .findFirstByCreatedByAndDeletedFalseAndDateOrderByCreatedAtDesc(userId, date)
                .map(w -> localTime(w.getCreatedAt())
                    .isBefore(LocalTime.parse(properties.weighInCutoff())))
                .orElse(false);
            case "stim_intake_before" -> stimIntakes(userId, date).stream()
                .anyMatch(t -> t.isBefore(LocalTime.parse(properties.morningWindowEnd())));
            case "training_done_today" ->
                !workoutSessionRepository.findDoneInstanceDates(userId, date, date).isEmpty()
                    || runSessionLogRepository
                        .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, date)
                        .stream()
                        .anyMatch(r -> date.equals(r.getDate()) && localTime(r.getCreatedAt())
                            .isBefore(LocalTime.parse(properties.workoutCutoff())));
            case "breakfast_protein" -> fuelDayService.getDay(userId, date).getMeals().stream()
                .filter(m -> "breakfast".equals(m.getSlot()))
                .map(m -> m.getMacros().getP())
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .compareTo(BigDecimal.valueOf(properties.proteinTargetG())) >= 0;
            case "no_stim_after" -> stimIntakes(userId, date).stream()
                .noneMatch(t -> t.isAfter(LocalTime.parse(properties.caffeineCutoff())));
            case "last_meal_before" -> {
                var meals = mealRepository
                    .findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(userId, date);
                if (meals.isEmpty()) {
                    yield true; // nothing logged after close — vacuously kept
                }
                LocalTime close = habitTargets.resolve(userId).bed()
                    .minusMinutes(properties.kitchenCloseOffsetMin());
                yield !localTime(meals.getLast().getLoggedAt()).isAfter(close);
            }
            case METRIC_BED_NEXT_DAY -> sleepLog(userId, date.plusDays(1))
                .map(SleepLogEntity::getBedtime).filter(Objects::nonNull)
                .map(b -> bedtimeOnTime(LocalTime.parse(b),
                    habitTargets.resolve(userId).bed(), properties.bedGraceMin()))
                .orElse(false);
            default -> {
                log.warn("Unknown habit metric '{}' — treated as not satisfied", metric);
                yield false;
            }
        };
    }

    private Optional<SleepLogEntity> sleepLog(UUID userId, LocalDate date) {
        return sleepLogRepository
            .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, date)
            .stream().filter(s -> date.equals(s.getDate())).findFirst();
    }

    /** Local wall-clock times of the day's stim-kind intakes. */
    private List<LocalTime> stimIntakes(UUID userId, LocalDate date) {
        return supplementIntakeRepository
            .findByCreatedByAndTakenDateAndDeletedFalseOrderByTakenAtAsc(userId, date).stream()
            .filter(i -> pantryItemRepository.findById(i.getPantryItemId())
                .map(p -> "stim".equals(p.getKind())).orElse(false))
            .map(i -> localTime(i.getTakenAt()))
            .toList();
    }

    private static LocalTime localTime(Instant instant) {
        return instant.atZone(ZoneId.systemDefault()).toLocalTime();
    }

    private static boolean withinWindow(LocalTime actual, LocalTime target, int windowMin) {
        return !actual.isBefore(target.minusMinutes(windowMin))
            && !actual.isAfter(target.plusMinutes(windowMin));
    }

    /** HH:mm before noon reads as after-midnight (23:00 target + grace never wraps in v1). */
    private static boolean bedtimeOnTime(LocalTime bedtime, LocalTime target, int graceMin) {
        int actual = bedtime.getHour() * 60 + bedtime.getMinute();
        if (actual < 12 * 60) {
            actual += 24 * 60;
        }
        int limit = target.getHour() * 60 + target.getMinute() + graceMin;
        if (target.getHour() < 12) {
            limit += 24 * 60;
        }
        return actual <= limit;
    }
}
```

(If `PantryItemRepository` lacks a plain `findById` usable here, use `findByIdAndCreatedByAndDeletedFalse(i.getPantryItemId(), userId)` — the owner-scoped finder that certainly exists.)

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=HabitEvaluatorIT -DargLine=-Xmx3g`
Expected: PASS (all metric branches).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main backend/src/test
git -c core.hooksPath=/dev/null commit -m "feat(habit): HabitEvaluator — pure-read metric evaluation + populator extensions (mezo-d1jb)"
```

---

### Task 6: HabitService — lazy day, closure, manual check/uncheck, strength/summary

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/mapper/HabitMapper.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitServiceIT.java`

**Interfaces:**
- Consumes: `HabitCatalog` (Task 3), `HabitDayRepository` (Task 2), `HabitEvaluator`/`HabitTargets` (Task 5), `ProgressionService.applyHabit`/`revertHabit` (Task 4), `LevelUpResultMapper.toDto`, `ObjectProvider<ProgressionGate>`, `HabitProperties`.
- Produces: `HabitService` (`@Service`, gated `HABIT_SWITCH`) —
  `HabitDayResponse getDay(UUID userId, LocalDate date)`,
  `HabitWriteResponse check(UUID userId, String key, LocalDate date)`,
  `HabitResponse uncheck(UUID userId, String key, LocalDate date)`,
  `HabitSummaryResponse summary(UUID userId)`,
  `void closePast(UUID userId, LocalDate today)` (public — the cron reuses it).
- Produces: `HabitMapper` — `HabitResponse toResponse(HabitCatalog.HabitDef def, HabitDayEntity row, Integer strengthPct)`.

- [ ] **Step 1: Write the failing IT**

`HabitServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.HabitDayResponse;
import io.mrkuhne.mezo.api.dto.HabitWriteResponse;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import io.mrkuhne.mezo.feature.habit.service.HabitService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class HabitServiceIT extends AbstractIntegrationTest {

    @Autowired private HabitService habitService;
    @Autowired private HabitDayRepository repository;

    @Test
    void testGetDay_shouldLazilyCreateTenPendingRows_whenTodayFirstRead() {
        UUID owner = databasePopulator.ensureOwner();
        HabitDayResponse day = habitService.getDay(owner, LocalDate.now());
        assertThat(day.getHabits()).hasSize(10);
        assertThat(day.getHabits()).allSatisfy(h -> assertThat(h.getStatus()).isIn("pending", "done"));
        assertThat(repository.findByCreatedByAndHabitDate(owner, LocalDate.now())).hasSize(10);
    }

    @Test
    void testGetDay_shouldCompleteDerivedAndAwardOnce_whenBreakfastProteinMet() {
        UUID owner = databasePopulator.ensureOwner();
        LocalDate today = LocalDate.now();
        var item = pantryItemPopulator.createFood(owner, "Skyr", null);
        mealPopulator.createPantryMeal(owner, item, today); // breakfast, 34.5 g protein

        HabitDayResponse first = habitService.getDay(owner, today);
        assertThat(first.getHabits()).anySatisfy(h -> {
            assertThat(h.getKey()).isEqualTo("protein_breakfast");
            assertThat(h.getStatus()).isEqualTo("done");
        });
        assertThat(first.getLevelUps()).isNotEmpty();

        HabitDayResponse second = habitService.getDay(owner, today);
        assertThat(second.getLevelUps()).isEmpty(); // idempotent
    }

    @Test
    void testCheck_shouldAwardAndGuard_whenManualHabit() {
        UUID owner = databasePopulator.ensureOwner();
        LocalDate today = LocalDate.now();
        HabitWriteResponse res = habitService.check(owner, "morning_sunlight", today);
        assertThat(res.getHabit().getStatus()).isEqualTo("done");
        assertThat(res.getLevelUps()).isNotEmpty();

        assertThatThrownBy(() -> habitService.check(owner, "morning_sunlight", today))
            .isInstanceOf(SystemRuntimeErrorException.class); // HABIT_ALREADY_DONE
        assertThatThrownBy(() -> habitService.check(owner, "morning_weigh_in", today))
            .isInstanceOf(SystemRuntimeErrorException.class); // HABIT_NOT_MANUAL
        assertThatThrownBy(() -> habitService.check(owner, "nope", today))
            .isInstanceOf(SystemRuntimeErrorException.class); // HABIT_UNKNOWN
        assertThatThrownBy(() -> habitService.check(owner, "wind_down", today.minusDays(1)))
            .isInstanceOf(SystemRuntimeErrorException.class); // HABIT_NOT_TODAY
    }

    @Test
    void testUncheck_shouldRevertXpAndAllowRecheck_whenSameDay() {
        UUID owner = databasePopulator.ensureOwner();
        LocalDate today = LocalDate.now();
        habitService.check(owner, "morning_sunlight", today);
        var reverted = habitService.uncheck(owner, "morning_sunlight", today);
        assertThat(reverted.getStatus()).isEqualTo("pending");

        HabitWriteResponse again = habitService.check(owner, "morning_sunlight", today);
        assertThat(again.getLevelUps()).isNotEmpty(); // re-award works after revert
    }

    @Test
    void testClosePast_shouldCloseEndOfDayAndMissRest_whenYesterdayPending() {
        UUID owner = databasePopulator.ensureOwner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        habitPopulator.pendingDay(owner, yesterday); // all 10 keys pending

        habitService.closePast(owner, LocalDate.now());

        var rows = repository.findByCreatedByAndHabitDate(owner, yesterday);
        // no stim logged yesterday -> caffeine cutoff honestly done; no meals -> kitchen close done
        assertThat(byKey(rows, "caffeine_cutoff").getStatus()).isEqualTo("done");
        assertThat(byKey(rows, "kitchen_close").getStatus()).isEqualTo("done");
        // no sleep log for today yet -> bed_on_time stays pending until its noon deadline
        assertThat(byKey(rows, "morning_sunlight").getStatus()).isEqualTo("missed");
        assertThat(byKey(rows, "protein_breakfast").getStatus()).isEqualTo("missed");
    }

    @Test
    void testClosePast_shouldCloseBedOnTime_whenNextDaySleepLogArrives() {
        UUID owner = databasePopulator.ensureOwner();
        LocalDate dayBefore = LocalDate.now().minusDays(2);
        habitPopulator.pendingDay(owner, dayBefore);
        sleepLogPopulator.createSleepLog(owner, dayBefore.plusDays(1), "23:20", "06:10",
            new BigDecimal("6.8"));

        habitService.closePast(owner, LocalDate.now());

        var rows = repository.findByCreatedByAndHabitDate(owner, dayBefore);
        assertThat(byKey(rows, "bed_on_time").getStatus()).isEqualTo("done");
    }

    private static HabitDayEntity byKey(java.util.List<HabitDayEntity> rows, String key) {
        return rows.stream().filter(r -> r.getHabitKey().equals(key)).findFirst().orElseThrow();
    }
}
```

Also create `backend/src/test/java/io/mrkuhne/mezo/support/populator/HabitPopulator.java`:

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.habit.HabitCatalog;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class HabitPopulator {

    private final HabitDayRepository repository;
    private final HabitCatalog catalog;

    /** All catalog habits as pending rows for the given date. */
    public List<HabitDayEntity> pendingDay(UUID owner, LocalDate date) {
        return catalog.all().stream().map(def -> {
            HabitDayEntity e = new HabitDayEntity();
            e.setCreatedBy(owner);
            e.setHabitDate(date);
            e.setHabitKey(def.key());
            return repository.saveAndFlush(e);
        }).toList();
    }

    public HabitDayEntity row(UUID owner, LocalDate date, String key, String status) {
        HabitDayEntity e = new HabitDayEntity();
        e.setCreatedBy(owner);
        e.setHabitDate(date);
        e.setHabitKey(key);
        e.setStatus(status);
        return repository.saveAndFlush(e);
    }
}
```

Register it in `AbstractIntegrationTest`'s `@Import` list (alongside `QuestPopulator.class`) and add the `@Autowired HabitPopulator habitPopulator` field wherever sibling populators are declared (check whether populators are autowired in `AbstractIntegrationTest` itself or per test class — mirror the existing idiom).

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=HabitServiceIT -DargLine=-Xmx3g`
Expected: COMPILE FAILURE (`HabitService` missing).

- [ ] **Step 3: Implement HabitMapper + HabitService**

`HabitMapper.java` (plain component — the response is composed from catalog + row, not a MapStruct entity map):

```java
package io.mrkuhne.mezo.feature.habit.mapper;

import io.mrkuhne.mezo.api.dto.HabitResponse;
import io.mrkuhne.mezo.feature.habit.HabitCatalog;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import java.time.ZoneOffset;
import org.springframework.stereotype.Component;

@Component
public class HabitMapper {

    public HabitResponse toResponse(HabitCatalog.HabitDef def, HabitDayEntity row,
        Integer strengthPct) {
        return HabitResponse.builder()
            .id(row != null ? row.getId() : null)
            .key(def.key())
            .chain(def.chain())
            .position(def.position())
            .title(def.title())
            .why(def.why())
            .anchorCopy(def.anchorCopy())
            .mode(def.mode())
            .status(row != null ? row.getStatus() : HabitDayEntity.STATUS_PENDING)
            .doneAt(row != null && row.getDoneAt() != null
                ? row.getDoneAt().atOffset(ZoneOffset.UTC) : null)
            .xp(def.xp())
            .strengthPct(strengthPct)
            .build();
    }
}
```

`HabitService.java`:

```java
package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.api.dto.HabitDayResponse;
import io.mrkuhne.mezo.api.dto.HabitResponse;
import io.mrkuhne.mezo.api.dto.HabitStrength;
import io.mrkuhne.mezo.api.dto.HabitSummaryResponse;
import io.mrkuhne.mezo.api.dto.HabitWriteResponse;
import io.mrkuhne.mezo.feature.habit.HabitCatalog;
import io.mrkuhne.mezo.feature.habit.HabitCatalog.HabitDef;
import io.mrkuhne.mezo.feature.habit.config.HabitProperties;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.mapper.HabitMapper;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import io.mrkuhne.mezo.feature.progression.ProgressionGate;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.habit.HabitSignal;
import io.mrkuhne.mezo.feature.progression.mapper.LevelUpResultMapper;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitService {

    private final HabitDayRepository repository;
    private final HabitCatalog catalog;
    private final HabitEvaluator evaluator;
    private final HabitMapper mapper;
    private final ProgressionService progressionService;
    private final LevelUpResultMapper levelUpResultMapper;
    private final ObjectProvider<ProgressionGate> progressionGate;
    private final HabitProperties properties;

    @Transactional
    public HabitDayResponse getDay(UUID userId, LocalDate date) {
        List<HabitDayEntity> rows = repository.findByCreatedByAndHabitDate(userId, date);
        if (rows.isEmpty() && date.equals(LocalDate.now())) {
            rows = ensureRows(userId, date);
        }
        List<LevelUpResult> levelUps = new ArrayList<>();
        if (date.equals(LocalDate.now())) {
            closePast(userId, date);
            levelUps.addAll(evaluateIntraday(rows));
        }
        Map<String, Integer> strengths = strengthByKey(userId, date);
        Map<String, HabitDayEntity> byKey = new HashMap<>();
        rows.forEach(r -> byKey.put(r.getHabitKey(), r));
        return HabitDayResponse.builder()
            .date(date)
            .habits(catalog.all().stream()
                .map(def -> mapper.toResponse(def, byKey.get(def.key()), strengths.get(def.key())))
                .toList())
            .levelUps(levelUps.stream().map(levelUpResultMapper::toDto).toList())
            .build();
    }

    @Transactional
    public HabitWriteResponse check(UUID userId, String key, LocalDate date) {
        HabitDef def = requireDef(key);
        requireManualToday(def, date);
        ensureRows(userId, LocalDate.now());
        HabitDayEntity row = repository
            .findByCreatedByAndHabitDateAndHabitKey(userId, date, key).orElseThrow();
        if (!HabitDayEntity.STATUS_PENDING.equals(row.getStatus())) {
            throw conflict("HABIT_ALREADY_DONE");
        }
        List<LevelUpResult> levelUps = complete(row, def, HabitDayEntity.SOURCE_MANUAL);
        return HabitWriteResponse.builder()
            .habit(mapper.toResponse(def, row, null))
            .levelUps(levelUps.stream().map(levelUpResultMapper::toDto).toList())
            .build();
    }

    @Transactional
    public HabitResponse uncheck(UUID userId, String key, LocalDate date) {
        HabitDef def = requireDef(key);
        requireManualToday(def, date);
        HabitDayEntity row = repository
            .findByCreatedByAndHabitDateAndHabitKey(userId, date, key)
            .orElseThrow(() -> conflict("HABIT_NOT_DONE"));
        if (!HabitDayEntity.STATUS_DONE.equals(row.getStatus())
            || !HabitDayEntity.SOURCE_MANUAL.equals(row.getSource())) {
            throw conflict("HABIT_NOT_DONE");
        }
        progressionService.revertHabit(userId, row.getId(), def.skillKey(), row.getXpAwarded());
        row.setStatus(HabitDayEntity.STATUS_PENDING);
        row.setDoneAt(null);
        row.setXpAwarded(0);
        row.setSource(null);
        repository.save(row);
        return mapper.toResponse(def, row, null);
    }

    @Transactional(readOnly = true)
    public HabitSummaryResponse summary(UUID userId) {
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(properties.summaryDays() - 1L);
        List<HabitDayEntity> window = repository
            .findByCreatedByAndHabitDateBetween(userId, from, today);
        Map<String, Integer> strengths = strengthByKey(userId, today);
        Map<String, long[]> counts = new HashMap<>(); // key -> [done, missed] over 28d
        LocalDate strengthFrom = today.minusDays(properties.strengthWindowDays() - 1L);
        window.stream().filter(r -> !r.getHabitDate().isBefore(strengthFrom)).forEach(r -> {
            long[] c = counts.computeIfAbsent(r.getHabitKey(), k -> new long[2]);
            if (HabitDayEntity.STATUS_DONE.equals(r.getStatus())) {
                c[0]++;
            } else if (HabitDayEntity.STATUS_MISSED.equals(r.getStatus())) {
                c[1]++;
            }
        });
        return HabitSummaryResponse.builder()
            .perfectMorningDays30(perfectDays(window, HabitCatalog.CHAIN_MORNING))
            .perfectEveningDays30(perfectDays(window, HabitCatalog.CHAIN_EVENING))
            .habits(catalog.all().stream().map(def -> {
                long[] c = counts.getOrDefault(def.key(), new long[2]);
                return HabitStrength.builder()
                    .key(def.key())
                    .strengthPct(strengths.get(def.key()))
                    .done28((int) c[0])
                    .missed28((int) c[1])
                    .build();
            }).toList())
            .build();
    }

    /** Close every pending row older than today; the cron and the today-read both call this. */
    @Transactional
    public void closePast(UUID userId, LocalDate today) {
        List<HabitDayEntity> stale = repository
            .findByCreatedByAndStatusAndHabitDateBefore(userId, HabitDayEntity.STATUS_PENDING, today);
        for (HabitDayEntity row : stale) {
            HabitDef def = catalog.byKey(row.getHabitKey()).orElse(null);
            if (def == null) {
                row.setStatus(HabitDayEntity.STATUS_MISSED); // stale catalog key — quiet close
                repository.save(row);
                continue;
            }
            String metric = def.metric();
            if (HabitEvaluator.END_OF_DAY_METRICS.contains(metric)) {
                closeByEvaluation(row, def);
            } else if (HabitEvaluator.METRIC_BED_NEXT_DAY.equals(metric)) {
                boolean deadlinePassed = today.isAfter(row.getHabitDate().plusDays(1))
                    || LocalTime.now().isAfter(LocalTime.NOON);
                if (evaluator.satisfied(metric, row.getCreatedBy(), row.getHabitDate())) {
                    complete(row, def, HabitDayEntity.SOURCE_DERIVED);
                } else if (deadlinePassed) {
                    row.setStatus(HabitDayEntity.STATUS_MISSED);
                    repository.save(row);
                }
            } else {
                closeByEvaluation(row, def); // intraday metric that never fired -> last honest check
            }
        }
    }

    private void closeByEvaluation(HabitDayEntity row, HabitDef def) {
        if (!"manual".equals(def.metric())
            && evaluator.satisfied(def.metric(), row.getCreatedBy(), row.getHabitDate())) {
            complete(row, def, HabitDayEntity.SOURCE_DERIVED);
        } else {
            row.setStatus(HabitDayEntity.STATUS_MISSED); // quiet — ADR 0010
            repository.save(row);
        }
    }

    private List<LevelUpResult> evaluateIntraday(List<HabitDayEntity> rows) {
        List<LevelUpResult> levelUps = new ArrayList<>();
        for (HabitDayEntity row : rows) {
            if (!HabitDayEntity.STATUS_PENDING.equals(row.getStatus())) {
                continue;
            }
            HabitDef def = catalog.byKey(row.getHabitKey()).orElse(null);
            if (def == null || !HabitEvaluator.INTRADAY_METRICS.contains(def.metric())
                || "manual".equals(def.metric())) {
                continue;
            }
            if (evaluator.satisfied(def.metric(), row.getCreatedBy(), row.getHabitDate())) {
                levelUps.addAll(complete(row, def, HabitDayEntity.SOURCE_DERIVED));
            }
        }
        return levelUps;
    }

    private List<LevelUpResult> complete(HabitDayEntity row, HabitDef def, String source) {
        row.setStatus(HabitDayEntity.STATUS_DONE);
        row.setDoneAt(Instant.now());
        row.setXpAwarded(def.xp());
        row.setSource(source);
        repository.save(row);
        if (progressionGate.getIfAvailable() != null) {
            return List.of(progressionService.applyHabit(row.getCreatedBy(),
                new HabitSignal(row.getId(), def.skillKey(), def.xp(), def.title())));
        }
        return List.of();
    }

    private List<HabitDayEntity> ensureRows(UUID userId, LocalDate date) {
        List<HabitDayEntity> existing = repository.findByCreatedByAndHabitDate(userId, date);
        if (!existing.isEmpty()) {
            return existing;
        }
        try {
            List<HabitDayEntity> fresh = catalog.all().stream().map(def -> {
                HabitDayEntity e = new HabitDayEntity();
                e.setCreatedBy(userId);
                e.setHabitDate(date);
                e.setHabitKey(def.key());
                return e;
            }).toList();
            return repository.saveAllAndFlush(fresh);
        } catch (DataIntegrityViolationException e) {
            // lost the race against the cron/another read — the rows exist now
            return repository.findByCreatedByAndHabitDate(userId, date);
        }
    }

    private Map<String, Integer> strengthByKey(UUID userId, LocalDate today) {
        LocalDate from = today.minusDays(properties.strengthWindowDays() - 1L);
        Map<String, long[]> counts = new HashMap<>();
        repository.findByCreatedByAndHabitDateBetween(userId, from, today).forEach(r -> {
            long[] c = counts.computeIfAbsent(r.getHabitKey(), k -> new long[2]);
            if (HabitDayEntity.STATUS_DONE.equals(r.getStatus())) {
                c[0]++;
            } else if (HabitDayEntity.STATUS_MISSED.equals(r.getStatus())) {
                c[1]++;
            }
        });
        Map<String, Integer> strengths = new HashMap<>();
        counts.forEach((key, c) -> {
            long closed = c[0] + c[1];
            strengths.put(key, closed >= properties.minSample()
                ? (int) Math.round(c[0] * 100.0 / closed) : null);
        });
        return strengths;
    }

    private int perfectDays(List<HabitDayEntity> window, String chain) {
        var keys = catalog.forChain(chain).stream().map(HabitDef::key).toList();
        Map<LocalDate, Long> doneByDate = new HashMap<>();
        window.stream()
            .filter(r -> keys.contains(r.getHabitKey())
                && HabitDayEntity.STATUS_DONE.equals(r.getStatus()))
            .forEach(r -> doneByDate.merge(r.getHabitDate(), 1L, Long::sum));
        return (int) doneByDate.values().stream().filter(n -> n == keys.size()).count();
    }

    private HabitDef requireDef(String key) {
        return catalog.byKey(key).orElseThrow(() -> new SystemRuntimeErrorException(
            SystemMessage.error("HABIT_UNKNOWN").build(), HttpStatus.NOT_FOUND));
    }

    private void requireManualToday(HabitDef def, LocalDate date) {
        if (!HabitCatalog.MODE_MANUAL.equals(def.mode())) {
            throw conflict("HABIT_NOT_MANUAL");
        }
        if (!date.equals(LocalDate.now())) {
            throw conflict("HABIT_NOT_TODAY");
        }
    }

    private SystemRuntimeErrorException conflict(String code) {
        return new SystemRuntimeErrorException(SystemMessage.error(code).build(), HttpStatus.CONFLICT);
    }
}
```

Adaptation notes for the implementer:
- Match the EXACT `SystemRuntimeErrorException`/`SystemMessage` constructor idiom used by `QuestService.reroll` (open it and copy — package names above are a best guess).
- `LevelUpResultMapper` package/API: copy the import + `toDto` call from `QuestService`.
- New error codes (`HABIT_UNKNOWN`, `HABIT_NOT_MANUAL`, `HABIT_NOT_TODAY`, `HABIT_ALREADY_DONE`, `HABIT_NOT_DONE`) go into `message.properties` next to the `QUEST_*` codes — copy that file's entry format.
- `HabitDayEntity.getXpAwarded()` is `Integer` — `revertHabit` takes `long`; the implicit widening is fine.

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=HabitServiceIT -DargLine=-Xmx3g`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git -c core.hooksPath=/dev/null commit -m "feat(habit): HabitService — lazy day + closure classes + manual check/uncheck + strength (mezo-d1jb)"
```

---

### Task 7: HabitJob nightly close cron

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitJob.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitJobIT.java`

**Interfaces:**
- Consumes: `AppUserRepository` (find all users — copy the exact finder from `QuestJob`), `HabitService.closePast`.
- Produces: `HabitJob.runClose()` — `@Scheduled(cron = "${mezo.habit.close-cron}")`.

- [ ] **Step 1: Write the failing IT**

`HabitJobIT.java`:

```java
package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import io.mrkuhne.mezo.feature.habit.service.HabitJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class HabitJobIT extends AbstractIntegrationTest {

    @Autowired private HabitJob job;
    @Autowired private HabitDayRepository repository;

    @Test
    void testRunClose_shouldCloseYesterdaysPendingRows_whenJobRuns() {
        UUID owner = databasePopulator.ensureOwner();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        habitPopulator.row(owner, yesterday, "morning_sunlight", HabitDayEntity.STATUS_PENDING);
        habitPopulator.row(owner, yesterday, "caffeine_cutoff", HabitDayEntity.STATUS_PENDING);

        job.runClose();

        var rows = repository.findByCreatedByAndHabitDate(owner, yesterday);
        assertThat(rows).extracting(HabitDayEntity::getStatus)
            .containsExactlyInAnyOrder("missed", "done"); // sunlight missed, cutoff honestly done
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=HabitJobIT -DargLine=-Xmx3g`
Expected: COMPILE FAILURE.

- [ ] **Step 3: Implement**

`HabitJob.java` (mirror `QuestJob`'s user loop + per-user try/catch; copy its `AppUserRepository` usage verbatim):

```java
package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Nightly close: end-of-day metrics evaluate, the rest quietly miss (reads also close lazily). */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.HABIT_SWITCH, FeaturesConfiguration.HABIT_JOB_SWITCH},
        havingValue = "true")
public class HabitJob {

    private final AppUserRepository appUserRepository;
    private final HabitService habitService;

    @Scheduled(cron = "${mezo.habit.close-cron}")
    public void runClose() {
        LocalDate today = LocalDate.now();
        appUserRepository.findAll().forEach(user -> {
            try {
                habitService.closePast(user.getId(), today);
            } catch (Exception e) {
                log.warn("Habit close failed for user {}", user.getId(), e);
            }
        });
    }
}
```

(Adjust the `AppUserRepository` import/package and iteration idiom to match `QuestJob` exactly.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=HabitJobIT -DargLine=-Xmx3g`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git -c core.hooksPath=/dev/null commit -m "feat(habit): nightly HabitJob close cron (mezo-d1jb)"
```

---

### Task 8: HabitController + HTTP-level HabitApiIT

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/controller/HabitController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitApiIT.java`

**Interfaces:**
- Consumes: generated `HabitApi` (Task 1), `HabitService` (Task 6), `CurrentUserId`.
- Produces: the live `/api/habit/*` surface, gated on `HABIT_SWITCH` (off → 404).

- [ ] **Step 1: Write the failing IT**

`HabitApiIT.java`:

```java
package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.HabitCheckRequest;
import io.mrkuhne.mezo.api.dto.HabitDayResponse;
import io.mrkuhne.mezo.api.dto.HabitSummaryResponse;
import io.mrkuhne.mezo.api.dto.HabitWriteResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class HabitApiIT extends ApiIntegrationTest {

    @Test
    void testGetHabitDay_shouldLazilyCreateBothChains_whenTodayFirstRead() {
        HabitDayResponse day = getForBody("/api/habit/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDayResponse.class);
        assertThat(day.getHabits()).hasSize(10);
        assertThat(day.getHabits()).filteredOn(h -> "MORNING".equals(h.getChain())).hasSize(6);
        assertThat(day.getHabits()).filteredOn(h -> "EVENING".equals(h.getChain())).hasSize(4);
    }

    @Test
    void testCheckHabit_shouldAwardThenConflict_whenCheckedTwice() {
        HabitCheckRequest body = HabitCheckRequest.builder().date(LocalDate.now()).build();
        HabitWriteResponse res = postForBody("/api/habit/morning_sunlight/check", body,
            ownerAuthHeaders(), HttpStatus.OK, HabitWriteResponse.class);
        assertThat(res.getHabit().getStatus()).isEqualTo("done");
        assertThat(res.getLevelUps()).isNotEmpty();
        assertThat(res.getLevelUps().getFirst().getSource().getValue()).isEqualTo("HABIT");

        String err = postForBody("/api/habit/morning_sunlight/check", body,
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(err, "HABIT_ALREADY_DONE");
    }

    @Test
    void testCheckHabit_shouldRejectDerivedAndUnknown() {
        HabitCheckRequest body = HabitCheckRequest.builder().date(LocalDate.now()).build();
        String notManual = postForBody("/api/habit/morning_weigh_in/check", body,
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(notManual, "HABIT_NOT_MANUAL");

        String unknown = postForBody("/api/habit/nope/check", body,
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(unknown, "HABIT_UNKNOWN");
    }

    @Test
    void testUncheckHabit_shouldRevert_whenSameDayManualDone() {
        HabitCheckRequest body = HabitCheckRequest.builder().date(LocalDate.now()).build();
        postForBody("/api/habit/wind_down/check", body,
            ownerAuthHeaders(), HttpStatus.OK, HabitWriteResponse.class);
        deleteAndExpect("/api/habit/wind_down/check?date=" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK);

        HabitDayResponse day = getForBody("/api/habit/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, HabitDayResponse.class);
        assertThat(day.getHabits()).filteredOn(h -> "wind_down".equals(h.getKey()))
            .first().satisfies(h -> assertThat(h.getStatus()).isEqualTo("pending"));
    }

    @Test
    void testGetHabitSummary_shouldReturnHonestZeros_whenNoHistory() {
        HabitSummaryResponse s = getForBody("/api/habit/summary",
            ownerAuthHeaders(), HttpStatus.OK, HabitSummaryResponse.class);
        assertThat(s.getPerfectMorningDays30()).isZero();
        assertThat(s.getHabits()).hasSize(10);
        assertThat(s.getHabits()).allSatisfy(h -> assertThat(h.getStrengthPct()).isNull());
    }
}
```

(If `deleteAndExpect` cannot return the body, that is fine — the follow-up day read asserts the revert. If `HabitCheckRequest` has no builder, use setters — match the generated DTO style.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=HabitApiIT -DargLine=-Xmx3g`
Expected: FAIL — 404s (no controller yet).

- [ ] **Step 3: Implement the controller**

`HabitController.java`:

```java
package io.mrkuhne.mezo.feature.habit.controller;

import io.mrkuhne.mezo.api.controller.HabitApi;
import io.mrkuhne.mezo.api.dto.HabitCheckRequest;
import io.mrkuhne.mezo.api.dto.HabitDayResponse;
import io.mrkuhne.mezo.api.dto.HabitResponse;
import io.mrkuhne.mezo.api.dto.HabitSummaryResponse;
import io.mrkuhne.mezo.api.dto.HabitWriteResponse;
import io.mrkuhne.mezo.feature.habit.service.HabitService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitController implements HabitApi {

    private final HabitService habitService;
    private final CurrentUserId currentUserId;

    @Override
    public HabitDayResponse getHabitDay(LocalDate date) {
        return habitService.getDay(currentUserId.get(), date);
    }

    @Override
    public HabitWriteResponse checkHabit(String key, HabitCheckRequest request) {
        return habitService.check(currentUserId.get(), key, request.getDate());
    }

    @Override
    public HabitResponse uncheckHabit(String key, LocalDate date) {
        return habitService.uncheck(currentUserId.get(), key, date);
    }

    @Override
    public HabitSummaryResponse getHabitSummary() {
        return habitService.summary(currentUserId.get());
    }
}
```

(Match the generated `HabitApi` method signatures exactly — check `backend/target/generated-sources/openapi/.../HabitApi.java` for parameter order/names after Task 1.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=HabitApiIT -DargLine=-Xmx3g`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the habit + progression focused set once**

Run: `cd backend && ./mvnw clean test -Dtest='Habit*IT,ProgressionHabitIT' -DargLine=-Xmx3g`
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main backend/src/test
git -c core.hooksPath=/dev/null commit -m "feat(habit): HabitController + HTTP-level HabitApiIT (mezo-d1jb)"
```

---

### Task 9: FE data layer — types, api, mock, dual-mode hooks, HABIT gamification

**Files:**
- Create: `frontend/src/data/habit/habitApi.ts`, `frontend/src/data/habit/habitMock.ts`, `frontend/src/data/habit/habitHooks.ts`
- Modify: `frontend/src/data/types.ts` (habit types), `frontend/src/data/hooks.ts` (barrel line), `frontend/src/data/gamification/gamificationTypes.ts` (`XpEventType` += `'HABIT'`), `frontend/src/data/gamification/xpValues.ts` (`XP_VALUES.HABIT = 0`, `DAILY_CAPS.HABIT = 10`), `frontend/src/features/progression/logic/levelUpMeta.ts` (HABIT entries), `frontend/src/test/msw/handlers.ts` (honest-empty defaults)
- Test: `frontend/src/data/habit/habitHooks.test.tsx`

**Interfaces:**
- Produces (types in `data/types.ts`):

```ts
export type HabitChain = 'MORNING' | 'EVENING'
export type HabitMode = 'DERIVED' | 'MANUAL'
export type HabitStatus = 'pending' | 'done' | 'missed'
export interface HabitItem {
  id?: string
  key: string
  chain: HabitChain
  position: number
  title: string
  why: string
  anchorCopy: string
  mode: HabitMode
  status: HabitStatus
  doneAt?: string | null
  xp: number
  strengthPct?: number | null
}
export interface HabitStrengthRow { key: string; strengthPct: number | null; done28: number; missed28: number }
export interface HabitSummary { perfectMorningDays30: number; perfectEveningDays30: number; habits: HabitStrengthRow[] }
```

- Produces (hooks, barrel-exported from `@/data/hooks`): `useHabitDay(date)` → `{ habits, levelUps, mode }` + query key `['habitDay', date]`; `useHabitActions(date)` → `{ check, uncheck, pending, consumeLevelUps }`; `useHabitSummary()` → `{ data: HabitSummary, isPending }` (`['habitSummary']`).

- [ ] **Step 1: Write the failing hook tests**

`habitHooks.test.tsx` (mirror `questHooks.test.tsx` structure — `makeHookWrapper`, `server.use`, env stubbing):

```tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useHabitDay, useHabitActions, useHabitSummary } from '@/data/habit/habitHooks'
import { mockHabitDay } from '@/data/habit/habitMock'
import { API_BASE } from '@/data/_client/api'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const DATE = '2026-07-19'

describe('useHabitDay (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('serves the seed synchronously', () => {
    const { result } = renderHook(() => useHabitDay(DATE), { wrapper: makeHookWrapper() })
    expect(result.current.habits).toHaveLength(10)
    expect(result.current.habits.filter((h) => h.chain === 'MORNING')).toHaveLength(6)
  })

  test('manual check flips the row and stays in cache', async () => {
    const wrapper = makeHookWrapper()
    const day = renderHook(() => useHabitDay(DATE), { wrapper })
    const actions = renderHook(() => useHabitActions(DATE), { wrapper })
    await act(() => actions.result.current.check('morning_sunlight'))
    await waitFor(() =>
      expect(day.result.current.habits.find((h) => h.key === 'morning_sunlight')?.status).toBe('done'))
  })
})

describe('useHabitDay (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('returns the empty day while loading — never the seed', () => {
    const { result } = renderHook(() => useHabitDay(DATE), { wrapper: makeHookWrapper() })
    expect(result.current.habits).toHaveLength(0)
  })

  test('maps the wire day', async () => {
    server.use(http.get(`${API_BASE}/api/habit/day/${DATE}`, () =>
      HttpResponse.json({
        date: DATE,
        habits: [{ key: 'wake_on_time', chain: 'MORNING', position: 1, title: 'Ébredés időben',
          why: 'w', anchorCopy: 'a lánc kezdete', mode: 'DERIVED', status: 'done',
          doneAt: '2026-07-19T04:20:00Z', xp: 10, strengthPct: 82 }],
        levelUps: [],
      })))
    const { result } = renderHook(() => useHabitDay(DATE), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.habits).toHaveLength(1))
    expect(result.current.habits[0].strengthPct).toBe(82)
  })
})

describe('useHabitSummary (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('honest-empty default from MSW', async () => {
    const { result } = renderHook(() => useHabitSummary(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.data.habits).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && pnpm test src/data/habit/habitHooks.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Add the habit types to `data/types.ts` (block above, near the quest types ~line 800).

`habitApi.ts`:

```ts
import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { HabitChain, HabitItem, HabitMode, HabitStatus, HabitSummary } from '@/data/types'
import type { LevelUpResult } from '@/data/train/trainApi'

type HabitDayWire = paths['/api/habit/day/{date}']['get']['responses']['200']['content']['application/json']
type HabitWire = HabitDayWire['habits'][number]
type HabitWriteWire = paths['/api/habit/{key}/check']['post']['responses']['200']['content']['application/json']
type HabitSummaryWire = paths['/api/habit/summary']['get']['responses']['200']['content']['application/json']

export interface HabitDay {
  habits: HabitItem[]
  levelUps: LevelUpResult[]
}

export function toHabit(w: HabitWire): HabitItem {
  return {
    id: w.id,
    key: w.key,
    chain: w.chain as HabitChain,
    position: w.position,
    title: w.title,
    why: w.why,
    anchorCopy: w.anchorCopy,
    mode: w.mode as HabitMode,
    status: w.status as HabitStatus,
    doneAt: w.doneAt ?? null,
    xp: w.xp,
    strengthPct: w.strengthPct ?? null,
  }
}

export const habitApi = {
  day: (date: string) =>
    apiFetch<HabitDayWire>(`/api/habit/day/${date}`).then((d) => ({
      habits: d.habits.map(toHabit),
      levelUps: (d.levelUps ?? []) as LevelUpResult[],
    })),
  check: (key: string, date: string) =>
    apiFetch<HabitWriteWire>(`/api/habit/${key}/check`, {
      method: 'POST',
      body: JSON.stringify({ date }),
    }).then((r) => ({ habit: toHabit(r.habit), levelUps: (r.levelUps ?? []) as LevelUpResult[] })),
  uncheck: (key: string, date: string) =>
    apiFetch<HabitWire>(`/api/habit/${key}/check?date=${date}`, { method: 'DELETE' }).then(toHabit),
  summary: () =>
    apiFetch<HabitSummaryWire>(`/api/habit/summary`).then((s): HabitSummary => ({
      perfectMorningDays30: s.perfectMorningDays30,
      perfectEveningDays30: s.perfectEveningDays30,
      habits: s.habits.map((h) => ({
        key: h.key, strengthPct: h.strengthPct ?? null, done28: h.done28, missed28: h.missed28,
      })),
    })),
}
```

`habitMock.ts` (deterministic seed — the 10 catalog items; a demo-friendly state):

```ts
import type { HabitItem, HabitSummary } from '@/data/types'

/** Static seed mirroring content/habit-catalog.json; demo state: 3 morning items done. */
export const mockHabitDay: HabitItem[] = [
  { key: 'wake_on_time', chain: 'MORNING', position: 1, title: 'Ébredés időben',
    why: 'A napfelkeltéhez igazított ébredés indítja az esti melatonint — a mély alvás reggel kezdődik.',
    anchorCopy: 'a lánc kezdete', mode: 'DERIVED', status: 'done', doneAt: '2026-07-19T04:20:00Z', xp: 10, strengthPct: 82 },
  { key: 'morning_sunlight', chain: 'MORNING', position: 2, title: 'Reggeli napfény',
    why: '10 perc reggeli fény a szemednek — este pontosabban érkezik az álmosság.',
    anchorCopy: 'ébredés után', mode: 'MANUAL', status: 'done', doneAt: '2026-07-19T04:40:00Z', xp: 5, strengthPct: 64 },
  { key: 'morning_weigh_in', chain: 'MORNING', position: 3, title: 'Reggeli súlymérés',
    why: 'Ugyanakkor mérve a reggeli súly a valódi alapvonal — azonnali visszajelzés a hétre.',
    anchorCopy: 'fogmosás után', mode: 'DERIVED', status: 'done', doneAt: '2026-07-19T04:45:00Z', xp: 10, strengthPct: 93 },
  { key: 'morning_coffee', chain: 'MORNING', position: 4, title: 'Gombakávé',
    why: 'A korai koffein a mélymunkát fűti — és estére már nyoma sincs.',
    anchorCopy: 'súlymérés után', mode: 'DERIVED', status: 'pending', xp: 5, strengthPct: 71 },
  { key: 'morning_workout', chain: 'MORNING', position: 5, title: 'Reggeli edzés',
    why: 'A reggeli mozgás előrébb tolja a belső órát — este könnyebben alszol el.',
    anchorCopy: 'kávé után', mode: 'DERIVED', status: 'pending', xp: 15, strengthPct: 57 },
  { key: 'protein_breakfast', chain: 'MORNING', position: 6, title: 'Fehérjés reggeli',
    why: 'Legalább 25 g fehérje reggel — az éjszakai lebontás után építésbe fordulsz.',
    anchorCopy: 'edzés után', mode: 'DERIVED', status: 'pending', xp: 10, strengthPct: 79 },
  { key: 'caffeine_cutoff', chain: 'EVENING', position: 1, title: 'Koffein-cutoff',
    why: 'A koffein felezési ideje ~6 óra — a délutáni kávé az éjszakádból vesz el.',
    anchorCopy: 'a lánc kezdete', mode: 'DERIVED', status: 'pending', xp: 10, strengthPct: 86 },
  { key: 'kitchen_close', chain: 'EVENING', position: 2, title: 'Konyha zárva',
    why: 'Az utolsó falat és a lefekvés közti 90 perc a mély alvásod védőzónája.',
    anchorCopy: 'vacsora után', mode: 'DERIVED', status: 'pending', xp: 10, strengthPct: 68 },
  { key: 'wind_down', chain: 'EVENING', position: 3, title: 'Wind-down, képernyő le',
    why: 'A tompuló fény jelzi az agyadnak: jöhet a melatonin.',
    anchorCopy: 'konyhazárás után', mode: 'MANUAL', status: 'pending', xp: 5, strengthPct: 43 },
  { key: 'bed_on_time', chain: 'EVENING', position: 4, title: 'Lefekvés időben',
    why: 'A fix lefekvés a teljes lánc záróköve — ettől lesz holnap is reggeled.',
    anchorCopy: 'wind-down után', mode: 'DERIVED', status: 'pending', xp: 15, strengthPct: 61 },
]

export const mockHabitSummary: HabitSummary = {
  perfectMorningDays30: 6,
  perfectEveningDays30: 4,
  habits: mockHabitDay.map((h) => ({
    key: h.key, strengthPct: h.strengthPct ?? null, done28: 18, missed28: 6,
  })),
}
```

`habitHooks.ts` (the `questHooks` shape — hand-rolled day query + `useDualQuery` summary):

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { awardGamificationEvent } from '@/data/gamification/gamificationStore'
import { habitApi, type HabitDay } from '@/data/habit/habitApi'
import { mockHabitDay, mockHabitSummary } from '@/data/habit/habitMock'
import type { HabitItem, HabitSummary } from '@/data/types'
import type { LevelUpResult } from '@/data/train/trainApi'
import { useDualQuery } from '@/data/useDualQuery'

const key = (d: string) => ['habitDay', d]

const MOCK_DAY: HabitDay = { habits: mockHabitDay, levelUps: [] }
const EMPTY_DAY: HabitDay = { habits: [], levelUps: [] }

export interface HabitDayView extends HabitDay {
  mode: 'mock' | 'live'
}

export function useHabitDay(date: string): HabitDayView {
  const mock = isMockMode()
  const q = useQuery<HabitDay>({
    queryKey: key(date),
    queryFn: mock ? async () => MOCK_DAY : () => habitApi.day(date),
    initialData: mock ? MOCK_DAY : undefined,
    staleTime: mock ? Infinity : 0, // real mode re-reads every mount (READ-triggered server eval)
    retry: false,
  })
  const data = q.data ?? (mock ? MOCK_DAY : EMPTY_DAY)
  return { ...data, mode: mock ? 'mock' : 'live' }
}

export function useHabitActions(date: string) {
  const qc = useQueryClient()
  const mock = isMockMode()

  const patchMock = (habitKey: string, status: HabitItem['status']) => {
    qc.setQueryData<HabitDay>(key(date), (d) =>
      d && {
        ...d,
        habits: d.habits.map((h) =>
          h.key === habitKey
            ? { ...h, status, doneAt: status === 'done' ? new Date().toISOString() : null }
            : h),
      })
  }

  const checkM = useMutation({
    mutationFn: async (habitKey: string) => {
      if (mock) {
        patchMock(habitKey, 'done')
        const xp = mockHabitDay.find((h) => h.key === habitKey)?.xp ?? 0
        awardGamificationEvent(qc, { type: 'HABIT', xpOverride: xp })
        return undefined
      }
      return habitApi.check(habitKey, date).then((r) => r.levelUps)
    },
    onSuccess: mock
      ? undefined
      : () => {
          qc.invalidateQueries({ queryKey: key(date) })
          qc.invalidateQueries({ queryKey: ['habitSummary'] })
          qc.invalidateQueries({ queryKey: ['progressionProfile'] })
        },
  })
  // NOTE: check() resolves the write's levelUps — the caller (RoutineCard) feeds them to showLevelUp.

  const uncheckM = useMutation({
    mutationFn: async (habitKey: string) => {
      if (mock) {
        patchMock(habitKey, 'pending')
        return undefined
      }
      return habitApi.uncheck(habitKey, date).then(() => undefined)
    },
    onSuccess: mock
      ? undefined
      : () => {
          qc.invalidateQueries({ queryKey: key(date) })
          qc.invalidateQueries({ queryKey: ['habitSummary'] })
          qc.invalidateQueries({ queryKey: ['progressionProfile'] })
        },
  })

  return {
    check: (habitKey: string) => checkM.mutateAsync(habitKey),
    uncheck: (habitKey: string) => uncheckM.mutateAsync(habitKey),
    pending: checkM.isPending || uncheckM.isPending,
    consumeLevelUps: () =>
      qc.setQueryData<HabitDay>(key(date), (d) => d && { ...d, levelUps: [] as LevelUpResult[] }),
  }
}

export function useHabitSummary() {
  return useDualQuery<HabitSummary>({
    queryKey: ['habitSummary'],
    mockData: mockHabitSummary,
    realFetch: habitApi.summary,
    realEmpty: { perfectMorningDays30: 0, perfectEveningDays30: 0, habits: [] },
  })
}
```

Registry edits:
- `data/hooks.ts`: `export { useHabitDay, useHabitActions, useHabitSummary } from '@/data/habit/habitHooks'`
- `gamificationTypes.ts`: add `'HABIT'` to the `XpEventType` union.
- `xpValues.ts`: `XP_VALUES.HABIT = 0` (XP rides `xpOverride`), `DAILY_CAPS.HABIT = 10`.
- `levelUpMeta.ts`: add `HABIT: 'A rutin épít.'` to `HEADLINE_BY_SOURCE` and `HABIT: '☀️'` to `CHIP_ICON_BY_SOURCE` (the `Source` type widens automatically from the regenerated contract union).
- `test/msw/handlers.ts` — honest-empty defaults:

```ts
http.get(`${API_BASE}/api/habit/day/:date`, ({ params }) =>
  HttpResponse.json({ date: params.date, habits: [], levelUps: [] }),
),
http.get(`${API_BASE}/api/habit/summary`, () =>
  HttpResponse.json({ perfectMorningDays30: 0, perfectEveningDays30: 0, habits: [] }),
),
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd frontend && pnpm test src/data/habit/habitHooks.test.tsx && VITE_USE_MOCK=true pnpm test src/data/habit/habitHooks.test.tsx`
Expected: PASS in both runs.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(habit): FE data layer — dual-mode habit hooks + HABIT gamification event (mezo-d1jb)"
```

---

### Task 10: Today `RoutineCard` (daypart-aware)

**Files:**
- Create: `frontend/src/features/today/logic/habitAction.ts`, `frontend/src/features/today/components/RoutineCard.tsx`
- Modify: `frontend/src/features/today/pages/TodayPage.tsx` (mount in the "Teendők ma" zone, directly under `TodayQuestsCard`)
- Test: `frontend/src/features/today/logic/habitAction.test.ts`, `frontend/src/features/today/components/RoutineCard.test.tsx`

**Interfaces:**
- Consumes: `useHabitDay`/`useHabitActions` (Task 9, via `@/data/hooks`), `daypartNow()` (`@/shared/lib/daypart`), `emitToast` (`@/shared/lib/toastBus`), `useLevelUp()` (`@/features/progression/LevelUpProvider`), `LogMealSheet` (`@/features/fuel/sheets/LogMealSheet`), `localDateString()` (`@/shared/lib/dates`).
- Produces: `habitAction(h: HabitItem): HabitAction` where `type HabitAction = { kind: 'check' } | { kind: 'nav'; to: string } | { kind: 'meal-sheet' } | { kind: 'none' }`; `<RoutineCard />` (no props).

- [ ] **Step 1: Write the failing logic test**

`habitAction.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { habitAction } from '@/features/today/logic/habitAction'
import { mockHabitDay } from '@/data/habit/habitMock'

const byKey = (k: string) => mockHabitDay.find((h) => h.key === k)!

describe('habitAction', () => {
  test('manual habits are checkable', () => {
    expect(habitAction({ ...byKey('morning_sunlight'), status: 'pending' })).toEqual({ kind: 'check' })
  })
  test('derived habits tap through to their logging surface', () => {
    expect(habitAction({ ...byKey('wake_on_time'), status: 'pending' })).toEqual({ kind: 'nav', to: '/me/sleep' })
    expect(habitAction({ ...byKey('morning_weigh_in'), status: 'pending' })).toEqual({ kind: 'nav', to: '/me/weight' })
    expect(habitAction({ ...byKey('morning_coffee'), status: 'pending' })).toEqual({ kind: 'nav', to: '/fuel/stack' })
    expect(habitAction({ ...byKey('morning_workout'), status: 'pending' })).toEqual({ kind: 'nav', to: '/train' })
    expect(habitAction({ ...byKey('protein_breakfast'), status: 'pending' })).toEqual({ kind: 'meal-sheet' })
    expect(habitAction({ ...byKey('caffeine_cutoff'), status: 'pending' })).toEqual({ kind: 'none' })
  })
  test('done/missed habits have no action', () => {
    expect(habitAction(byKey('wake_on_time'))).toEqual({ kind: 'none' }) // seed status: done
  })
})
```

- [ ] **Step 2: Implement `habitAction.ts`**

```ts
import type { HabitItem } from '@/data/types'

export type HabitAction =
  | { kind: 'check' }
  | { kind: 'nav'; to: string }
  | { kind: 'meal-sheet' }
  | { kind: 'none' }

/** ADR 0010: a CTA never self-completes a DERIVED habit — it opens the underlying log surface. */
const NAV_BY_KEY: Record<string, string> = {
  wake_on_time: '/me/sleep',
  bed_on_time: '/me/sleep',
  morning_weigh_in: '/me/weight',
  morning_coffee: '/fuel/stack',
  morning_workout: '/train',
}

export function habitAction(h: HabitItem): HabitAction {
  if (h.status !== 'pending') {
    return { kind: 'none' }
  }
  if (h.mode === 'MANUAL') {
    return { kind: 'check' }
  }
  if (h.key === 'protein_breakfast') {
    return { kind: 'meal-sheet' }
  }
  const to = NAV_BY_KEY[h.key]
  return to ? { kind: 'nav', to } : { kind: 'none' }
}
```

Run: `cd frontend && pnpm test src/features/today/logic/habitAction.test.ts` — Expected: PASS.

- [ ] **Step 3: Write the failing component test**

`RoutineCard.test.tsx` (harness: `QueryWrapper` + `LevelUpProvider` + `MemoryRouter`; pin the daypart):

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { RoutineCard } from '@/features/today/components/RoutineCard'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'

vi.mock('@/shared/lib/daypart', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/daypart')>()),
  daypartNow: vi.fn(() => 'reggel'),
}))
import { daypartNow } from '@/shared/lib/daypart'

function renderCard() {
  return render(
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter>
          <RoutineCard />
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>,
  )
}

describe('RoutineCard', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('morning daypart renders the morning chain with anchors', () => {
    renderCard()
    expect(screen.getByText('Reggeli rutin')).toBeInTheDocument()
    expect(screen.getByText('Ébredés időben')).toBeInTheDocument()
    expect(screen.getByText('ébredés után')).toBeInTheDocument()
    expect(screen.queryByText('Koffein-cutoff')).not.toBeInTheDocument()
  })

  test('evening daypart renders the evening chain', () => {
    vi.mocked(daypartNow).mockReturnValue('este')
    renderCard()
    expect(screen.getByText('Esti rutin')).toBeInTheDocument()
    expect(screen.getByText('Koffein-cutoff')).toBeInTheDocument()
  })

  test('midday renders the compact summary row', () => {
    vi.mocked(daypartNow).mockReturnValue('delutan')
    renderCard()
    expect(screen.getByText(/Reggeli rutin 3\/6/)).toBeInTheDocument()
  })

  test('manual pending habit exposes a check button', async () => {
    vi.mocked(daypartNow).mockReturnValue('este')
    renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Wind-down, képernyő le pipálása' }))
    expect(await screen.findByText('🌙 Tökéletes este')).toBeDefined()
  })
})
```

Note on the last assertion: the perfect-evening toast only fires when ALL evening habits are done — the mock seed has the other three pending, so assert instead that the row flips to ✓ (`screen.findByText('✓')` within the wind-down row). Write the test against actual reachable behavior:

```tsx
  test('manual pending habit checks and flips', async () => {
    vi.mocked(daypartNow).mockReturnValue('este')
    renderCard()
    await userEvent.click(screen.getByRole('button', { name: 'Wind-down, képernyő le pipálása' }))
    // the row's status mark flips from ◦ to ✓ via the cache patch
    expect((await screen.findAllByText('✓')).length).toBeGreaterThan(0)
  })
```

- [ ] **Step 4: Implement `RoutineCard.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useHabitDay, useHabitActions } from '@/data/hooks'
import type { HabitItem } from '@/data/types'
import { habitAction } from '@/features/today/logic/habitAction'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { LogMealSheet } from '@/features/fuel/sheets/LogMealSheet'
import { daypartNow } from '@/shared/lib/daypart'
import { localDateString } from '@/shared/lib/dates'
import { emitToast } from '@/shared/lib/toastBus'

const STATE_ICON: Record<HabitItem['status'], string> = { pending: '◦', done: '✓', missed: '—' }

/** Daypart-aware routine chains: morning chain in the morning, evening chain in the evening. */
export function RoutineCard() {
  const date = localDateString()
  const { habits, levelUps } = useHabitDay(date)
  const { check, pending, consumeLevelUps } = useHabitActions(date)
  const { showLevelUp } = useLevelUp()
  const navigate = useNavigate()
  const [mealOpen, setMealOpen] = useState(false)
  const daypart = daypartNow()

  // surface a completion's level-up exactly once
  useEffect(() => {
    if (levelUps.length > 0) {
      showLevelUp(levelUps[0])
      consumeLevelUps()
    }
  }, [levelUps, showLevelUp, consumeLevelUps])

  const morning = habits.filter((h) => h.chain === 'MORNING')
  const evening = habits.filter((h) => h.chain === 'EVENING')
  const chain = daypart === 'este' ? evening : morning
  const title = daypart === 'este' ? 'Esti rutin' : 'Reggeli rutin'
  const doneOf = (list: HabitItem[]) => list.filter((h) => h.status === 'done').length

  // quiet celebration when the visible chain just completed
  const wasComplete = useRef(false)
  const complete = chain.length > 0 && chain.every((h) => h.status === 'done')
  useEffect(() => {
    if (complete && !wasComplete.current) {
      emitToast({ kind: 'success', text: daypart === 'este' ? '🌙 Tökéletes este' : '🌅 Tökéletes reggel' })
    }
    wasComplete.current = complete
  }, [complete, daypart])

  if (habits.length === 0) {
    return null // honest ghost: switch off / real mode before data
  }

  if (daypart === 'delutan') {
    return (
      <Link to="/me/growth" className="card row" style={{ alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <span aria-hidden="true">🔁</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
          Reggeli rutin {doneOf(morning)}/{morning.length}
        </span>
        <span className="text-tertiary" style={{ fontSize: 11 }}>
          este: {doneOf(evening)}/{evening.length}
        </span>
      </Link>
    )
  }

  const firstPending = chain.find((h) => h.status === 'pending')?.key

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">{title}</span>
        <span className="eyebrow text-tertiary">{doneOf(chain)}/{chain.length} ma</span>
      </div>
      {chain.map((h) => {
        const action = habitAction(h)
        const glow = h.key === firstPending
        return (
          <div key={h.key} className="row" style={{ alignItems: 'flex-start', gap: 10, padding: '6px 0',
            ...(glow ? { background: 'var(--wash-lav)', borderRadius: 8, padding: '6px 8px' } : {}) }}>
            <span style={{ color: h.status === 'done' ? 'var(--success)' : 'var(--coral)',
              opacity: h.status === 'missed' ? 0.4 : 1, width: 14, textAlign: 'center' }}>
              {STATE_ICON[h.status]}
            </span>
            <div style={{ flex: 1, opacity: h.status === 'missed' ? 0.5 : 1 }}>
              <div className="text-tertiary" style={{ fontSize: 10 }}>{h.anchorCopy}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{h.title}</div>
            </div>
            <span className="chip" style={{ whiteSpace: 'nowrap' }}>+{h.xp} XP</span>
            {action.kind === 'check' && (
              <button className="chip" disabled={pending} aria-label={`${h.title} pipálása`}
                onClick={() => check(h.key).then((lu) => lu?.[0] && showLevelUp(lu[0]))}>
                Pipa
              </button>
            )}
            {action.kind === 'nav' && (
              <button className="chip" aria-label={`${h.title} logolása`}
                onClick={() => navigate(action.to)}>
                Logolás
              </button>
            )}
            {action.kind === 'meal-sheet' && (
              <button className="chip" aria-label={`${h.title} logolása`}
                onClick={() => setMealOpen(true)}>
                Logolás
              </button>
            )}
          </div>
        )
      })}
      {mealOpen && <LogMealSheet initialSlot="breakfast" onClose={() => setMealOpen(false)} />}
    </div>
  )
}
```

Check `MealSlot`'s actual TS values in `data/types.ts` before passing `initialSlot` — if the FE union is Hungarian (`'reggeli' | ...`), pass the matching member instead of `'breakfast'`; open `LogMealSheet.tsx` and mirror what `defaultSlot()` returns.

Mount in `TodayPage.tsx` — inside the "Teendők ma" zone, directly under `<TodayQuestsCard ... />`:

```tsx
<RoutineCard />
```

(import `{ RoutineCard } from '@/features/today/components/RoutineCard'`).

- [ ] **Step 5: Run the tests**

Run: `cd frontend && pnpm test src/features/today && VITE_USE_MOCK=true pnpm test src/features/today`
Expected: PASS (including the pre-existing TodayPage tests — if TodayPage tests mock `@/data/hooks`, add the three habit hooks to their mock factory returning the seed/no-op shapes).

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(today): daypart-aware RoutineCard — routine chains on the Teendők ma zone (mezo-d1jb)"
```

---

### Task 11: Growth „Rutin" tab

**Files:**
- Create: `frontend/src/features/me/components/RoutinesTab.tsx`
- Modify: `frontend/src/features/me/pages/GrowthPage.tsx` (Tab union + 4th SegButton + branch)
- Test: `frontend/src/features/me/components/RoutinesTab.test.tsx` + extend `GrowthPage.test.tsx`

**Interfaces:**
- Consumes: `useHabitDay(localDateString())`, `useHabitSummary()` (via `@/data/hooks`); the `.skl`/`.bar` CSS idiom (global classes from `styles/prototype.css`); `LIFE_SKILLS` not needed here.
- Produces: `<RoutinesTab />` (no props).

- [ ] **Step 1: Write the failing test**

`RoutinesTab.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { RoutinesTab } from '@/features/me/components/RoutinesTab'
import { QueryWrapper } from '@/test/queryWrapper'

describe('RoutinesTab', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders both chains, strengths and perfect-day counters', () => {
    render(<QueryWrapper><RoutinesTab /></QueryWrapper>)
    expect(screen.getByText('Reggeli lánc')).toBeInTheDocument()
    expect(screen.getByText('Esti lánc')).toBeInTheDocument()
    expect(screen.getByText('Ébredés időben')).toBeInTheDocument()
    expect(screen.getByText(/Tökéletes reggelek/)).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument() // perfectMorningDays30 seed
  })
})
```

- [ ] **Step 2: Implement `RoutinesTab.tsx`**

```tsx
import { useHabitDay, useHabitSummary } from '@/data/hooks'
import type { HabitItem } from '@/data/types'
import { localDateString } from '@/shared/lib/dates'

const STATE_ICON: Record<HabitItem['status'], string> = { pending: '◦', done: '✓', missed: '—' }

/** Overview surface: both chains in full + 28d strength bars + perfect-day counters. */
export function RoutinesTab() {
  const { habits } = useHabitDay(localDateString())
  const { data: summary } = useHabitSummary()
  const strength = (key: string) =>
    summary.habits.find((h) => h.key === key)?.strengthPct ?? null

  const chainCard = (label: string, chain: HabitItem['chain']) => {
    const items = habits.filter((h) => h.chain === chain)
    if (items.length === 0) {
      return null
    }
    return (
      <div className="card">
        <span className="eyebrow">{label}</span>
        {items.map((h) => {
          const pct = strength(h.key)
          return (
            <div key={h.key} className="skl">
              <span className="k">
                <span style={{ color: h.status === 'done' ? 'var(--success)' : 'var(--coral)' }}>
                  {STATE_ICON[h.status]}{' '}
                </span>
                {h.title}
              </span>
              <div className="bar"><i style={{ width: `${pct ?? 0}%` }} /></div>
              <span className="lv">{pct != null ? `${pct}%` : '—'}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="col gap-md">
      <div className="row" style={{ gap: 10 }}>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{summary.perfectMorningDays30}</div>
          <div className="text-tertiary" style={{ fontSize: 11 }}>Tökéletes reggelek · 30 nap</div>
        </div>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{summary.perfectEveningDays30}</div>
          <div className="text-tertiary" style={{ fontSize: 11 }}>Tökéletes esték · 30 nap</div>
        </div>
      </div>
      {chainCard('Reggeli lánc', 'MORNING')}
      {chainCard('Esti lánc', 'EVENING')}
    </div>
  )
}
```

`GrowthPage.tsx` edits: `type Tab = 'skills' | 'journal' | 'awards' | 'routines'`; add `<SegButton on={tab === 'routines'} onClick={() => setTab('routines')}>Rutin</SegButton>`; add `{tab === 'routines' && <RoutinesTab />}`. Extend `GrowthPage.test.tsx`: if it barrel-mocks `@/data/hooks`, add `useHabitDay`/`useHabitSummary`/`useHabitActions` to the mock factory (seed shapes), plus one tab-switch test: `await userEvent.click(screen.getByRole('tab', { name: 'Rutin' }))` → `expect(screen.getByText('Reggeli lánc'))`.

- [ ] **Step 3: Run the tests**

Run: `cd frontend && pnpm test src/features/me && VITE_USE_MOCK=true pnpm test src/features/me`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(me): Growth Rutin tab — chains + habit strengths + perfect days (mezo-d1jb)"
```

---

### Task 12: Gates, feature doc, handoff

**Files:**
- Create: `docs/features/habit.md`
- Modify: `docs/features/today.md` (§2 mount + related), `docs/features/growth.md` (related + Rutin tab mention), `docs/features/me.md` (Growth tab list)
- Verify: `node scripts/lint-docs.mjs`

- [ ] **Step 1: Full FE gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build green, ALL tests pass in both modes. Fix anything broken (e.g. TodayPage/GrowthPage test mock factories missing the habit hooks).

- [ ] **Step 2: Focused backend gate**

Run: `cd backend && ./mvnw clean test -Dtest='Habit*IT,ProgressionHabitIT,QuestApiIT' -DargLine=-Xmx3g`
Expected: ALL PASS (QuestApiIT included to catch progression-shared regressions). The FULL suite runs in CI on the PR — do not run it locally.

- [ ] **Step 3: Write `docs/features/habit.md`**

Follow the 10-section feature-doc template (see `docs/features/README.md` + the knowledge-base skill). Frontmatter `key_files`: `backend/src/main/java/io/mrkuhne/mezo/feature/habit`, `frontend/src/data/habit`, `frontend/src/features/today/components/RoutineCard.tsx`, `frontend/src/features/me/components/RoutinesTab.tsx`, `api/feature/habit/habit.yml`. Content: summary (chains, ADR 0010 tone), user-facing behavior (RoutineCard dayparts, Rutin tab), architecture (catalog → habit_day → evaluator → HABIT award; closure classes), data model & API (table DDL summary + 4 endpoints + error codes), integrations (sleep/weight/intake/train/meal/goal reads; progression HABIT source), how to consume (hook snippets), how to extend (new habit = catalog entry + evaluator metric case), config (`mezo.habit.*`), edge cases (E4 noon deadline, vacuous kitchen-close, gym date-presence fallback), file map. Update the three sibling docs' related links + the Today §2 mount order + the Growth page tab list.

Run: `node scripts/lint-docs.mjs`
Expected: no errors, no staleness flags.

- [ ] **Step 4: Commit + handoff**

```bash
git add docs/
git -c core.hooksPath=/dev/null commit -m "docs(habit): feature doc + cross-links (mezo-d1jb)"
git push -u origin feat/habit-routine-engine
gh pr create --title "feat(habit): morning & evening routine habit engine (mezo-d1jb)" --body "..."
```

PR body: summary of the slice + test evidence + the spec/plan links, ending with the standard footer. Wait for CI green; land with `gh pr merge --merge` (the worktree landing idiom). After merge: from the MAIN checkout run `bd close mezo-d1jb` + `bd dolt push`.

Out of scope (deliberately NOT in this plan — the spec's sub-projects ②③④): Sleep Cycle screenshot ingestion, Fuel „Mai" slot-timing fix + slot-level AI logging, morning-training reschedule + Tasty Dose/Origin protocol data setup.
