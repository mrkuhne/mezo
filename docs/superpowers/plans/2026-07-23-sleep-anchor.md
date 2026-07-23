# Sleep Goal + Day-Anchor Implementation Plan (mezo-dbsr)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first-class per-user sleep goal (target duration + fixed WAKE|BED anchor, other end derived) becomes the single source of truth for the day's wake/bed anchor; `sleep_log` is enriched for tracker-grade data; SleepPage gains the goal card + regularity/efficiency scores.

**Architecture:** Contract-first (OpenAPI fragment → generated types both sides). Backend: `sleep_goal` singleton copied from the `intention_creed` shape; an **ungated** `SleepAnchorResolver` (implements `SleepAnchorPort`) serves wake/bed to `HabitTargets`; the gated `SleepGoalService`/`SleepGoalController` own the GET/PUT surface. Frontend: `useSleepGoal`/`useSleepGoalActions` dual-mode hooks; pure `sleepStats.ts`; `timelineHooks` repointed off `goal.wakeTime/bedTime`.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven / Liquibase / PostgreSQL (UUID PKs); React 19 + Vite + TanStack Query + MSW/Vitest; OpenAPI 3.0.3 + openapi-merge-cli + openapi-generator (spring) + openapi-typescript.

**Spec:** `docs/superpowers/specs/2026-07-23-sleep-anchor-design.md` (approved 2026-07-23). Decisions D1–D8 are locked.

## Global Constraints

- Worktree: run everything from `/Users/daniel.kuhne/MrKuhne/mezo/.claude/worktrees/parallel-session-2`, branch `feat/sleep-anchor`. Commit with `git -c core.hooksPath=/dev/null commit` (bd hook pollutes worktree commits).
- Conventional commit subjects end with `(mezo-dbsr)`.
- Backend tests: ALWAYS `./mvnw clean test` (never without `clean`), focused via `-Dtest=...`, with `-DargLine=-Xmx3g` on this 16 GB machine. Postgres must be up: `cd backend && docker compose up -d` (port 15432). NEVER run the full backend suite locally — CI is the full gate.
- Frontend gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green.
- No `@Value`, no hardcoded tunables (all under `mezo:` in `application.yml`); constructor injection via `@RequiredArgsConstructor`; `@Transactional` method-level only; AssertJ only; test naming `test{Method}_should{Result}_when{Condition}`.
- Contract validation lives in the OpenAPI fragment (`pattern`/`minimum`/`maximum`), NEVER re-added by hand in Java. Boundary DTOs are generated (`io.mrkuhne.mezo.api.dto`) — never hand-written.
- FE: hooks imported from `@/data/hooks` only; deep absolute `@/` imports, no `../`; no new barrels; `var(--token)` colors, no raw hex; tests colocated; sheets conditionally mounted (`{open && <XSheet onClose=.../>}`); `Sheet` has NO `open` prop.
- Times are HH:mm strings on the wire and in the DB (`varchar(5)`); HH:mm regex in contracts: `'^([01]\d|2[0-3]):[0-5]\d$'`.

### Plan-level refinements of the spec (resolved here, not re-litigated)

1. **Own OpenAPI tag `SleepGoal`** (not tag `Sleep` as the spec's §4 implied): the generator runs `useTags=true`, so tag `Sleep` would force the goal methods into the ungated `SleepLogController implements SleepApi`. A separate `SleepGoalApi` keeps the goal surface gateable. Fragment: `api/feature/sleep-goal/sleep-goal.yml` (registered in `merge.yml`).
2. **`SleepAnchorResolver` is UNGATED**, only the controller+service are gated on `mezo.feature.sleep-goal.enabled`: `HabitTargets` (gated on the habit switch) must resolve anchors even when the sleep-goal API surface is off, else the Spring context breaks for flag-off+habit-on.
3. **No `SLEEP_GOAL_INVALID` error code**: all PUT validation is expressible in the contract (`minimum`/`maximum`/`pattern`) → standard `VALIDATION_INVALID_VALUE` FIELD errors from bean validation. Adding a hand-written duplicate would violate `api_contract_conventions.md`.
4. **`SleepGoalProperties` (prefix `mezo.sleep`) carries only backend-consumed values** (`default-target-min`, `default-anchor`, `default-wake`, `default-bed`, `regularity-band-min`). The spec's `regularity-window-days 14` and `efficiency-target-pct 85` have NO backend consumer (scores are FE-pure per spec §5) — they become FE constants in `sleepStats.ts` (`REGULARITY_WINDOW_DAYS = 14`, `EFFICIENCY_TARGET_PCT = 85`); dead backend config is forbidden by `configuration_conventions.md`.
5. **FE mock sleep-goal seed = WAKE 06:45 / 450 min → derived bed 23:15** (not the spec's illustrative WAKE 06:00/480): the 14 mock sleep entries cluster at bed ~23:15 / wake ~06:45, so this seed yields a demo-honest ~57% regularity score; the spec's value would show 0% and read as broken. The backend config-default ghost stays WAKE 06:00 / 480 / band 15 exactly per spec §3.
6. **Demodata convenience seed skipped** (spec §3 marked it optional): `GoalSeedData` never sets `wakeTime`/`bedTime`, so the "copy from goal" seed would never fire. The ghost default covers the demo.
7. **Behavioral note (accepted cascade):** with no sleep_goal row, the resolved default bed becomes **22:00** (ghost WAKE 06:00 + 480) where `HabitTargets` previously fell back to 23:00 (`mezo.habit.default-bed`). `bed_on_time` / kitchen-close defaults shift accordingly until the user sets a goal. `default-wake`/`default-bed` leave `HabitProperties` (Task 5).

## File Structure (created/modified)

```
api/feature/sleep-goal/sleep-goal.yml                      CREATE  GET/PUT /api/sleep/goal contract
api/feature/sleep/sleep.yml                                MODIFY  enriched LogSleepRequest/SleepLogResponse
api/generate/merge.yml                                     MODIFY  register new fragment
api/openapi.yml + frontend/src/data/_client/api.gen.ts     REGEN   committed

backend/src/main/resources/db/changelog/1.0.0/script/202607230957_mezo-dbsr_create_sleep_goal.sql  CREATE
backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml                                     MODIFY
backend/.../feature/biometrics/sleep/entity/SleepGoalEntity.java                                   CREATE
backend/.../feature/biometrics/sleep/entity/SleepLogEntity.java                                    MODIFY  +7 nullable fields
backend/.../feature/biometrics/sleep/repository/SleepGoalRepository.java                           CREATE
backend/.../feature/biometrics/sleep/service/SleepAnchorPort.java                                  CREATE  interface + record
backend/.../feature/biometrics/sleep/service/SleepAnchorResolver.java                              CREATE  ungated component
backend/.../feature/biometrics/sleep/service/SleepGoalService.java                                 CREATE  gated
backend/.../feature/biometrics/sleep/controller/SleepGoalController.java                           CREATE  gated, implements SleepGoalApi
backend/.../feature/biometrics/sleep/config/SleepGoalProperties.java                               CREATE  prefix mezo.sleep
backend/.../feature/biometrics/sleep/service/SleepLogService.java                                  MODIFY  enriched fields
backend/.../feature/biometrics/sleep/mapper/SleepLogMapper.java                                    MODIFY  (verify auto-mapping)
backend/.../techcore/configuration/FeaturesConfiguration.java                                      MODIFY  +SLEEP_GOAL_SWITCH
backend/src/main/resources/application.yml                                                         MODIFY  +flag +mezo.sleep, -habit defaults
backend/.../feature/habit/service/HabitTargets.java                                                MODIFY  reads SleepAnchorPort
backend/.../feature/habit/config/HabitProperties.java                                              MODIFY  -defaultWake/-defaultBed
backend/src/test/.../support/ResetDatabase.java                                                    MODIFY  +sleep_goal
backend/src/test/.../support/AbstractIntegrationTest.java                                          MODIFY  +SleepGoalPopulator import
backend/src/test/.../support/populator/SleepGoalPopulator.java                                     CREATE
backend/src/test/.../feature/biometrics/sleep/SleepGoalApiIT.java                                  CREATE
backend/src/test/.../feature/biometrics/sleep/SleepGoalSwitchOffApiIT.java                         CREATE
backend/src/test/.../feature/biometrics/sleep/SleepLogEnrichedApiIT.java                           CREATE
backend/src/test/.../feature/habit/service/HabitTargetsSleepIT.java                                CREATE

frontend/src/data/types.ts                                 MODIFY  SleepGoal type; SleepEntry/SleepLogInput enrichment
frontend/src/data/me/sleepGoal.ts                          CREATE  mock seed + deriveSleepTimes + GHOST
frontend/src/data/me/biometricsApi.ts                      MODIFY  +sleepGoalApi, enriched log body
frontend/src/data/me/sleepHooks.ts                         MODIFY  +useSleepGoal +useSleepGoalActions
frontend/src/data/hooks.ts                                 MODIFY  barrel exports
frontend/src/test/msw/handlers.ts                          MODIFY  +/api/sleep/goal handlers
frontend/src/data/me/sleepGoalHooks.test.tsx               CREATE
frontend/src/features/me/logic/sleepStats.ts               CREATE  + sleepStats.test.ts
frontend/src/features/me/sheets/SleepGoalSheet.tsx         CREATE  + test
frontend/src/features/me/sheets/SleepLogSheet.tsx          MODIFY  +Ágyban field + test
frontend/src/features/me/pages/SleepPage.tsx               MODIFY  goal card + score rings + hero + test
frontend/src/data/fuel/timelineHooks.ts                    MODIFY  wake/bed from useSleepGoal
frontend/src/features/me/sheets/EditGoalSheet.tsx          MODIFY  -wake/bed rows + test
frontend/src/data/me/goalHooks.ts                          MODIFY  savePlanner planner arg
docs/features/me.md, fuel.md, habit.md, _platform-api-backend.md, _platform-data-layer.md          MODIFY
docs/superpowers/specs/2026-07-23-sleep-routine-cluster-notes.md                                   MODIFY  status
```

---

### Task 1: API contract — sleep-goal fragment + enriched sleep-log fields + regen

**Files:**
- Create: `api/feature/sleep-goal/sleep-goal.yml`
- Modify: `api/feature/sleep/sleep.yml` (add 7 optional props to `LogSleepRequest` AND `SleepLogResponse`)
- Modify: `api/generate/merge.yml` (append fragment)
- Regen+commit: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces (backend, generated at build): `io.mrkuhne.mezo.api.controller.SleepGoalApi` with methods `SleepGoalResponse getSleepGoal()` and `SleepGoalResponse setSleepGoal(SetSleepGoalRequest)`; `api.dto.SleepGoalResponse` (`targetMinutes:Integer, anchor:String, anchorTime:String, wakeTime:String, bedTime:String, regularityBandMin:Integer`, Lombok `@Builder`); `api.dto.SetSleepGoalRequest` (same minus wake/bed, `regularityBandMin` nullable). `api.dto.LogSleepRequest`/`SleepLogResponse` gain `inBedMin, awakeMin, lightMin, remMin, deepMin, sourceQualityPct (Integer), source (String)`.
- Produces (frontend): `components['schemas']['SleepGoalResponse' | 'SetSleepGoalRequest']` and the enriched sleep schemas in `api.gen.ts`.

- [ ] **Step 1: Write the new fragment**

`api/feature/sleep-goal/sleep-goal.yml` (complete file):

```yaml
openapi: 3.0.3
info: { title: mezo sleep-goal fragment, version: 1.0.0 }
tags:
  - name: SleepGoal
    description: Sleep goal + day anchor — the single source of the day's wake/bed pair
paths:
  /api/sleep/goal:
    get:
      tags: [SleepGoal]
      operationId: getSleepGoal
      summary: The sleep goal; config-default ghost when unset — never 404 (SleepGoal)
      responses:
        '200':
          description: The goal with both derived ends (wakeTime + bedTime composed server-side)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SleepGoalResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    put:
      tags: [SleepGoal]
      operationId: setSleepGoal
      summary: Upsert the sleep goal (per-user singleton) (SleepGoal)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/SetSleepGoalRequest' }
      responses:
        '200':
          description: Saved goal, derived ends recomposed
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SleepGoalResponse' }
        '400':
          description: Validation failure
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    SleepGoalResponse:
      type: object
      required: [targetMinutes, anchor, anchorTime, wakeTime, bedTime, regularityBandMin]
      properties:
        targetMinutes:
          type: integer
          minimum: 1
          maximum: 1440
          description: Asleep target in minutes (UI hints the 7–9 h range; default 480)
        anchor:
          type: string
          pattern: '^(WAKE|BED)$'
          description: Which end is fixed — the other end is derived
        anchorTime:
          type: string
          pattern: '^([01]\d|2[0-3]):[0-5]\d$'
          description: The fixed end, HH:mm
        wakeTime:
          type: string
          pattern: '^([01]\d|2[0-3]):[0-5]\d$'
          description: Wake anchor, HH:mm — derived when anchor=BED; equals anchorTime when anchor=WAKE
        bedTime:
          type: string
          pattern: '^([01]\d|2[0-3]):[0-5]\d$'
          description: Bed anchor, HH:mm — derived when anchor=WAKE; equals anchorTime when anchor=BED
        regularityBandMin:
          type: integer
          minimum: 1
          description: ± band in minutes for the regularity score (Walker ±15)
    SetSleepGoalRequest:
      type: object
      required: [targetMinutes, anchor, anchorTime]
      properties:
        targetMinutes: { type: integer, minimum: 1, maximum: 1440, description: 'Asleep target in minutes' }
        anchor: { type: string, pattern: '^(WAKE|BED)$', description: 'Which end is fixed' }
        anchorTime: { type: string, pattern: '^([01]\d|2[0-3]):[0-5]\d$', description: 'The fixed end, HH:mm' }
        regularityBandMin: { type: integer, minimum: 1, description: 'Omit to keep/take the config default (15)' }
```

- [ ] **Step 2: Enrich the sleep fragment**

In `api/feature/sleep/sleep.yml`, add to `LogSleepRequest.properties` (after `note`) AND to `SleepLogResponse.properties` (after `notes`) — same 7 fields both places, none added to `required`:

```yaml
        inBedMin:
          type: integer
          minimum: 1
          description: Total time in bed in minutes — enables true efficiency (asleep ÷ in-bed)
        awakeMin:
          type: integer
          minimum: 0
          description: Minutes awake during the night (tracker phase data)
        lightMin:
          type: integer
          minimum: 0
          description: Light-sleep minutes (tracker phase data)
        remMin:
          type: integer
          minimum: 0
          description: REM minutes (tracker phase data; Sleep Cycle calls it Dream)
        deepMin:
          type: integer
          minimum: 0
          description: Deep-sleep minutes (tracker phase data)
        sourceQualityPct:
          type: integer
          minimum: 0
          maximum: 100
          description: Tracker-reported quality 0–100 (Sleep Cycle's own metric)
        source:
          type: string
          pattern: '^(manual|screenshot)$'
          description: Row provenance; omitted → 'manual'
```

- [ ] **Step 3: Register the fragment**

In `api/generate/merge.yml`, append to `inputs:` (after the intention line, before `output:`):

```yaml
  - inputFile: ../feature/sleep-goal/sleep-goal.yml
```

- [ ] **Step 4: Regenerate both artifacts**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` change; `git diff --stat` shows both. Grep sanity: `grep -n "SleepGoalResponse\|sourceQualityPct" api/openapi.yml frontend/src/data/_client/api.gen.ts` finds hits in both files.

- [ ] **Step 5: Frontend still compiles**

Run: `cd frontend && pnpm build`
Expected: PASS (additive optional fields break nothing).

- [ ] **Step 6: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(api): sleep-goal contract + enriched sleep-log fields (mezo-dbsr)"
```

---

### Task 2: DB migration + entities + repository + test plumbing

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607230957_mezo-dbsr_create_sleep_goal.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeset)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/entity/SleepGoalEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/entity/SleepLogEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/repository/SleepGoalRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/SleepGoalPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (TRUNCATE list + `sleep_goal`)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java` (`@Import` + `SleepGoalPopulator.class`)

**Interfaces:**
- Produces: `SleepGoalEntity` (`getTargetMinutes():Integer`, `getAnchor():String`, `getAnchorTime():String`, `getRegularityBandMin():Integer`, + `OwnedEntity`'s `createdBy/deleted/createdAt`); `SleepGoalRepository.findByCreatedByAndDeletedFalse(UUID): Optional<SleepGoalEntity>`; `SleepGoalPopulator.goal(UUID owner, int targetMinutes, String anchor, String anchorTime, int bandMin): SleepGoalEntity` + convenience `goal(UUID owner)` (450/WAKE/"06:45"/15). `SleepLogEntity` gains `inBedMin/awakeMin/lightMin/remMin/deepMin/sourceQualityPct` (Integer) + `source` (String, initialized `"manual"`).

- [ ] **Step 1: Write the migration SQL** (`202607230957_mezo-dbsr_create_sleep_goal.sql`, complete file):

```sql
-- Sleep goal + day-anchor (bd mezo-dbsr, spec docs/superpowers/specs/2026-07-23-sleep-anchor-design.md).
-- Per-user singleton (intention_creed shape): target duration + fixed WAKE|BED anchor; the other end
-- is derived at read time. Also enriches sleep_log additively so tracker/screenshot rows (slice B)
-- can carry real in-bed time + phase minutes; all new columns nullable, manual rows stay sparse.

create table sleep_goal (
    id                  uuid        not null default gen_random_uuid(),
    created_by          uuid        not null,
    is_deleted          boolean     not null default false,
    created_at          timestamptz not null default now(),
    target_minutes      integer     not null,
    anchor              varchar(4)  not null,
    anchor_time         varchar(5)  not null,
    regularity_band_min integer     not null default 15,
    constraint pk_sleep_goal_id primary key (id),
    constraint fk_sleep_goal_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_sleep_goal_target_minutes check (target_minutes between 1 and 1440),
    constraint ck_sleep_goal_anchor check (anchor in ('WAKE', 'BED')),
    constraint ck_sleep_goal_band check (regularity_band_min >= 1)
);
create unique index uq_sleep_goal_user on sleep_goal (created_by) where is_deleted = false;

alter table sleep_log add column in_bed_min integer;
alter table sleep_log add column awake_min integer;
alter table sleep_log add column light_min integer;
alter table sleep_log add column rem_min integer;
alter table sleep_log add column deep_min integer;
alter table sleep_log add column source_quality_pct integer;
alter table sleep_log add column source varchar(10) default 'manual';
alter table sleep_log add constraint ck_sleep_log_source_quality_pct
    check (source_quality_pct is null or source_quality_pct between 0 and 100);
alter table sleep_log add constraint ck_sleep_log_source
    check (source is null or source in ('manual', 'screenshot'));
```

- [ ] **Step 2: Register the changeset** — append to `1.0.0_master.yml` (after the intention changeset, same indentation):

```yaml
  - changeSet:
      id: "1.0.0:202607230957_mezo-dbsr_create_sleep_goal"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607230957_mezo-dbsr_create_sleep_goal.sql
```

- [ ] **Step 3: Lint the migration**

Run: `node scripts/lint-liquibase.mjs`
Expected: PASS (filename prefix, constraint prefixes, no seed DML).

- [ ] **Step 4: Write `SleepGoalEntity`** (complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** The user's sleep goal — one live row per owner (partial-unique on created_by, intention_creed shape). */
@Getter
@Setter
@Entity
@Table(name = "sleep_goal")
@SQLDelete(sql = "update sleep_goal set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class SleepGoalEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Min(1)
    @Max(1440)
    @Column(name = "target_minutes", nullable = false)
    private Integer targetMinutes;

    @NotNull
    @Pattern(regexp = "WAKE|BED")
    @Column(nullable = false, length = 4)
    private String anchor;

    @NotNull
    @Column(name = "anchor_time", nullable = false, length = 5)
    private String anchorTime;

    @NotNull
    @Min(1)
    @Column(name = "regularity_band_min", nullable = false)
    private Integer regularityBandMin = 15;
}
```

- [ ] **Step 5: Enrich `SleepLogEntity`** — add after the existing `notes` field:

```java
    // Tracker-grade enrichment (mezo-dbsr): nullable — manual rows stay sparse; slice B (screenshot) fills them.
    @Min(1)
    @Column(name = "in_bed_min")
    private Integer inBedMin;

    @Min(0)
    @Column(name = "awake_min")
    private Integer awakeMin;

    @Min(0)
    @Column(name = "light_min")
    private Integer lightMin;

    @Min(0)
    @Column(name = "rem_min")
    private Integer remMin;

    @Min(0)
    @Column(name = "deep_min")
    private Integer deepMin;

    @Min(0)
    @Max(100)
    @Column(name = "source_quality_pct")
    private Integer sourceQualityPct;

    @Pattern(regexp = "manual|screenshot")
    @Column(length = 10)
    private String source = "manual";
```

Add the imports `jakarta.validation.constraints.Max`, `jakarta.validation.constraints.Min`, `jakarta.validation.constraints.Pattern` if missing.

- [ ] **Step 6: Write `SleepGoalRepository`** (complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep.repository;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// Singleton config row (no 'date' base field) => extend JpaRepository directly, not OwnedRepository.
public interface SleepGoalRepository extends JpaRepository<SleepGoalEntity, UUID> {

    Optional<SleepGoalEntity> findByCreatedByAndDeletedFalse(UUID createdBy);
}
```

- [ ] **Step 7: Write `SleepGoalPopulator`** (complete file):

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class SleepGoalPopulator {

    private final SleepGoalRepository sleepGoalRepository;

    /** Any valid goal: 7.5 h asleep target anchored to a 06:45 wake (derived bed 23:15). */
    public SleepGoalEntity goal(UUID owner) {
        return goal(owner, 450, "WAKE", "06:45", 15);
    }

    public SleepGoalEntity goal(UUID owner, int targetMinutes, String anchor, String anchorTime, int bandMin) {
        SleepGoalEntity e = new SleepGoalEntity();
        e.setCreatedBy(owner);
        e.setTargetMinutes(targetMinutes);
        e.setAnchor(anchor);
        e.setAnchorTime(anchorTime);
        e.setRegularityBandMin(bandMin);
        return sleepGoalRepository.saveAndFlush(e);
    }
}
```

- [ ] **Step 8: Register in test plumbing**
  - `ResetDatabase.java`: in the TRUNCATE string, change `weight_log, sleep_log,` to `weight_log, sleep_log, sleep_goal,`.
  - `AbstractIntegrationTest.java`: in the `@Import({...})` list, change `SleepLogPopulator.class,` to `SleepLogPopulator.class, SleepGoalPopulator.class,`.

- [ ] **Step 9: Verify migration + schema sync via a focused IT**

Run: `cd backend && docker compose up -d && ./mvnw clean test -Dtest=SleepLogServiceIT -DargLine=-Xmx3g`
Expected: PASS — Liquibase applies the new changeset to `mezo_test`, Hibernate schema validation accepts both entities, existing sleep tests stay green.

- [ ] **Step 10: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep backend/src/test/java/io/mrkuhne/mezo/support
git -c core.hooksPath=/dev/null commit -m "feat(sleep): sleep_goal table + enriched sleep_log schema, entities, populator (mezo-dbsr)"
```

---

### Task 3: Sleep-goal backend — config, port/resolver, service, controller + ITs

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Modify: `backend/src/main/resources/application.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/config/SleepGoalProperties.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepAnchorPort.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepAnchorResolver.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepGoalService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/controller/SleepGoalController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/sleep/SleepGoalApiIT.java`, `SleepGoalSwitchOffApiIT.java`

**Interfaces:**
- Consumes: Task 1's generated `SleepGoalApi`, `api.dto.SleepGoalResponse`, `api.dto.SetSleepGoalRequest`; Task 2's `SleepGoalRepository`, `SleepGoalPopulator`.
- Produces: `SleepAnchorPort` with `record SleepAnchor(LocalTime wake, LocalTime bed)` and `SleepAnchor resolve(UUID userId)` — Task 5's `HabitTargets` consumes this. `SleepAnchorResolver.derive(String anchor, LocalTime anchorTime, int targetMinutes): SleepAnchor` (static). `SleepGoalService.getGoal(UUID): SleepGoalResponse`, `setGoal(UUID, SetSleepGoalRequest): SleepGoalResponse`.

- [ ] **Step 1: Write the failing ITs first** — `SleepGoalApiIT.java` (complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SetSleepGoalRequest;
import io.mrkuhne.mezo.api.dto.SleepGoalResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the generated {@code SleepGoalApi} contract (api/openapi.yml). */
class SleepGoalApiIT extends ApiIntegrationTest {

    @Test
    void testGetSleepGoal_shouldReturnConfigDefaultGhost_whenNoneSet() {
        SleepGoalResponse goal =
            getForBody("/api/sleep/goal", ownerAuthHeaders(), HttpStatus.OK, SleepGoalResponse.class);

        assertThat(goal.getTargetMinutes()).isEqualTo(480);
        assertThat(goal.getAnchor()).isEqualTo("WAKE");
        assertThat(goal.getAnchorTime()).isEqualTo("06:00");
        assertThat(goal.getWakeTime()).isEqualTo("06:00");
        assertThat(goal.getBedTime()).isEqualTo("22:00"); // 06:00 − 480 min
        assertThat(goal.getRegularityBandMin()).isEqualTo(15);
    }

    @Test
    void testSetSleepGoal_shouldDeriveBed_whenWakeAnchored() {
        HttpHeaders auth = ownerAuthHeaders();
        SetSleepGoalRequest req = SetSleepGoalRequest.builder()
            .targetMinutes(450).anchor("WAKE").anchorTime("06:45").regularityBandMin(20).build();

        SleepGoalResponse saved =
            putForBody("/api/sleep/goal", req, auth, HttpStatus.OK, SleepGoalResponse.class);

        assertThat(saved.getWakeTime()).isEqualTo("06:45");
        assertThat(saved.getBedTime()).isEqualTo("23:15"); // 06:45 − 450 min
        assertThat(saved.getRegularityBandMin()).isEqualTo(20);

        SleepGoalResponse read =
            getForBody("/api/sleep/goal", auth, HttpStatus.OK, SleepGoalResponse.class);
        assertThat(read.getBedTime()).isEqualTo("23:15");
    }

    @Test
    void testSetSleepGoal_shouldDeriveWakeAcrossMidnight_whenBedAnchored() {
        SetSleepGoalRequest req = SetSleepGoalRequest.builder()
            .targetMinutes(480).anchor("BED").anchorTime("00:30").build();

        SleepGoalResponse saved =
            putForBody("/api/sleep/goal", req, ownerAuthHeaders(), HttpStatus.OK, SleepGoalResponse.class);

        assertThat(saved.getBedTime()).isEqualTo("00:30");
        assertThat(saved.getWakeTime()).isEqualTo("08:30"); // 00:30 + 480 min
        assertThat(saved.getRegularityBandMin()).isEqualTo(15); // band omitted -> config default
    }

    @Test
    void testSetSleepGoal_shouldUpdateSingleRow_whenUpsertedTwice() {
        HttpHeaders auth = ownerAuthHeaders();
        putForBody("/api/sleep/goal",
            SetSleepGoalRequest.builder().targetMinutes(450).anchor("WAKE").anchorTime("06:45").build(),
            auth, HttpStatus.OK, SleepGoalResponse.class);
        putForBody("/api/sleep/goal",
            SetSleepGoalRequest.builder().targetMinutes(480).anchor("BED").anchorTime("23:00").build(),
            auth, HttpStatus.OK, SleepGoalResponse.class);

        SleepGoalResponse read =
            getForBody("/api/sleep/goal", auth, HttpStatus.OK, SleepGoalResponse.class);
        assertThat(read.getAnchor()).isEqualTo("BED");
        assertThat(read.getWakeTime()).isEqualTo("07:00"); // 23:00 + 480 min
    }

    @Test
    void testSetSleepGoal_shouldReturn400FieldErrors_whenInvalid() {
        SetSleepGoalRequest req = SetSleepGoalRequest.builder()
            .targetMinutes(1441).anchor("MID").anchorTime("25:00").build();

        String body = putForBody("/api/sleep/goal", req, ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "targetMinutes", "VALIDATION_INVALID_VALUE");
        assertHasFieldError(body, "anchor", "VALIDATION_INVALID_VALUE");
        assertHasFieldError(body, "anchorTime", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testSleepGoalEndpoints_shouldReturn401_whenNoToken() {
        getForBody("/api/sleep/goal", null, HttpStatus.UNAUTHORIZED, Void.class);
    }
}
```

And `SleepGoalSwitchOffApiIT.java` (complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** With the sleep-goal switch OFF, the @ConditionalOnProperty controller bean is absent -> 404. */
@TestPropertySource(properties = "mezo.feature.sleep-goal.enabled=false")
class SleepGoalSwitchOffApiIT extends ApiIntegrationTest {

    @Test
    void testGetSleepGoal_shouldReturn404_whenSleepGoalSwitchOff() {
        getForBody("/api/sleep/goal", ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && ./mvnw clean test -Dtest='SleepGoal*IT' -DargLine=-Xmx3g`
Expected: COMPILE FAILURE (`SleepGoalService`/`SleepGoalController` don't exist yet — the generated `SleepGoalApi` exists from Task 1's contract, so only the hand-written classes are missing). If it compiles, tests fail with 404.

- [ ] **Step 3: Feature switch + config.** In `FeaturesConfiguration.java`, after `INTENTION_SWITCH`:

```java
    /** Sleep goal + day-anchor (mezo-dbsr). Gates /api/sleep/goal + SleepGoalService (the anchor resolver stays on). */
    public static final String SLEEP_GOAL_SWITCH = "mezo.feature.sleep-goal.enabled";
```

In `application.yml` under `mezo.feature:` (after the `intention:` block, matching neighbours' comment style):

```yaml
    # Sleep goal + day-anchor (mezo-dbsr): first-class sleep goal owns the day's wake/bed anchor.
    sleep-goal:
      enabled: true
```

And a new value block (after the `intention:` values block):

```yaml
  # Sleep goal defaults (mezo-dbsr): the config-default "ghost" served before the user saves a goal,
  # plus the regularity band default. Binds onto SleepGoalProperties.
  sleep:
    default-target-min: 480
    default-anchor: WAKE
    default-wake: "06:00"
    default-bed: "23:00"
    regularity-band-min: 15
```

- [ ] **Step 4: `SleepGoalProperties`** (complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Sleep-goal tuning (mezo.sleep): ghost defaults + regularity band are config, never code. */
@Validated
@ConfigurationProperties(prefix = "mezo.sleep")
public record SleepGoalProperties(

    /** Asleep target served before the user saves a goal (minutes). */
    @Min(1) @Max(1440)
    int defaultTargetMin,

    /** Which end the ghost goal fixes. */
    @Pattern(regexp = "WAKE|BED")
    String defaultAnchor,

    /** Ghost wake anchor, HH:mm (used when default-anchor is WAKE). */
    @NotBlank
    String defaultWake,

    /** Ghost bed anchor, HH:mm (used when default-anchor is BED). */
    @NotBlank
    String defaultBed,

    /** Default ± regularity band in minutes (Walker ±15). */
    @Min(1)
    int regularityBandMin
) {}
```

- [ ] **Step 5: `SleepAnchorPort`** (complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import java.time.LocalTime;
import java.util.UUID;

/** Read seam for the day's wake/bed anchor — habit/fuel consumers depend on this, never on the goal row. */
public interface SleepAnchorPort {

    record SleepAnchor(LocalTime wake, LocalTime bed) {}

    /** Resolves the user's anchor pair; config-default ghost when no goal row exists (never empty). */
    SleepAnchor resolve(UUID userId);
}
```

- [ ] **Step 6: `SleepAnchorResolver`** (complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.config.SleepGoalProperties;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import java.time.LocalTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The single wake/bed derivation (spec D1/D4). Deliberately NOT gated on the sleep-goal switch:
 * HabitTargets must resolve anchors even when the /api/sleep/goal surface is off.
 */
@Component
@RequiredArgsConstructor
public class SleepAnchorResolver implements SleepAnchorPort {

    private final SleepGoalRepository repository;
    private final SleepGoalProperties properties;

    @Override
    public SleepAnchor resolve(UUID userId) {
        return repository.findByCreatedByAndDeletedFalse(userId)
            .map(g -> derive(g.getAnchor(), LocalTime.parse(g.getAnchorTime()), g.getTargetMinutes()))
            .orElseGet(this::ghost);
    }

    /** WAKE fixed -> bed = wake − target; BED fixed -> wake = bed + target (LocalTime wraps mod 24h). */
    static SleepAnchor derive(String anchor, LocalTime anchorTime, int targetMinutes) {
        return "WAKE".equals(anchor)
            ? new SleepAnchor(anchorTime, anchorTime.minusMinutes(targetMinutes))
            : new SleepAnchor(anchorTime.plusMinutes(targetMinutes), anchorTime);
    }

    private SleepAnchor ghost() {
        String time = "WAKE".equals(properties.defaultAnchor())
            ? properties.defaultWake() : properties.defaultBed();
        return derive(properties.defaultAnchor(), LocalTime.parse(time), properties.defaultTargetMin());
    }
}
```

- [ ] **Step 7: `SleepGoalService`** (complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import io.mrkuhne.mezo.api.dto.SetSleepGoalRequest;
import io.mrkuhne.mezo.api.dto.SleepGoalResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.config.SleepGoalProperties;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.SLEEP_GOAL_SWITCH, havingValue = "true")
public class SleepGoalService {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final SleepGoalRepository repository;
    private final SleepGoalProperties properties;

    /** Config-default ghost when unset — never 404 (spec §3): every user has a working anchor. */
    public SleepGoalResponse getGoal(UUID userId) {
        return repository.findByCreatedByAndDeletedFalse(userId)
            .map(g -> compose(g.getTargetMinutes(), g.getAnchor(), g.getAnchorTime(), g.getRegularityBandMin()))
            .orElseGet(() -> {
                String time = "WAKE".equals(properties.defaultAnchor())
                    ? properties.defaultWake() : properties.defaultBed();
                return compose(properties.defaultTargetMin(), properties.defaultAnchor(), time,
                    properties.regularityBandMin());
            });
    }

    @Transactional
    public SleepGoalResponse setGoal(UUID userId, SetSleepGoalRequest req) {
        SleepGoalEntity row = repository.findByCreatedByAndDeletedFalse(userId)
            .orElseGet(() -> {
                SleepGoalEntity e = new SleepGoalEntity();
                e.setCreatedBy(userId); // server-side from principal, never from client
                return e;
            });
        row.setTargetMinutes(req.getTargetMinutes());
        row.setAnchor(req.getAnchor());
        row.setAnchorTime(req.getAnchorTime());
        row.setRegularityBandMin(req.getRegularityBandMin() != null
            ? req.getRegularityBandMin() : properties.regularityBandMin());
        repository.save(row);
        return compose(row.getTargetMinutes(), row.getAnchor(), row.getAnchorTime(), row.getRegularityBandMin());
    }

    private SleepGoalResponse compose(int targetMinutes, String anchor, String anchorTime, int bandMin) {
        var resolved = SleepAnchorResolver.derive(anchor, LocalTime.parse(anchorTime), targetMinutes);
        return SleepGoalResponse.builder()
            .targetMinutes(targetMinutes)
            .anchor(anchor)
            .anchorTime(anchorTime)
            .wakeTime(HH_MM.format(resolved.wake()))
            .bedTime(HH_MM.format(resolved.bed()))
            .regularityBandMin(bandMin)
            .build();
    }
}
```

- [ ] **Step 8: `SleepGoalController`** (complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep.controller;

import io.mrkuhne.mezo.api.controller.SleepGoalApi;
import io.mrkuhne.mezo.api.dto.SetSleepGoalRequest;
import io.mrkuhne.mezo.api.dto.SleepGoalResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepGoalService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/sleep/goal surface (mezo-dbsr) — mappings/validation come from the generated {@link SleepGoalApi}. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.SLEEP_GOAL_SWITCH, havingValue = "true")
public class SleepGoalController implements SleepGoalApi {

    private final SleepGoalService service;
    private final CurrentUserId currentUserId;

    @Override
    public SleepGoalResponse getSleepGoal() {
        return service.getGoal(currentUserId.get());
    }

    @Override
    public SleepGoalResponse setSleepGoal(SetSleepGoalRequest setSleepGoalRequest) {
        return service.setGoal(currentUserId.get(), setSleepGoalRequest);
    }
}
```

Check the exact `CurrentUserId` package with `grep -rn "import.*CurrentUserId" backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/controller/SleepLogController.java` and mirror it.

- [ ] **Step 9: Run the ITs**

Run: `cd backend && ./mvnw clean test -Dtest='SleepGoal*IT' -DargLine=-Xmx3g`
Expected: PASS (7 tests). If the 400 test fails on missing FIELD errors: verify the generated `SetSleepGoalRequest` carries `@Pattern`/`@Min`/`@Max` (it does when the contract has `pattern`/`minimum`/`maximum` — re-check Task 1 step 1).

- [ ] **Step 10: Commit**

```bash
git add backend/src/main
git add backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/sleep
git -c core.hooksPath=/dev/null commit -m "feat(sleep): sleep goal service + /api/sleep/goal + anchor resolver port (mezo-dbsr)"
```

---

### Task 4: Enriched sleep-log write path + IT

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepLogService.java`
- Verify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/mapper/SleepLogMapper.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/sleep/SleepLogEnrichedApiIT.java`

**Interfaces:**
- Consumes: Task 1's enriched `api.dto.LogSleepRequest`/`SleepLogResponse` (getters `getInBedMin()`, `getAwakeMin()`, `getLightMin()`, `getRemMin()`, `getDeepMin()`, `getSourceQualityPct()`, `getSource()`); Task 2's enriched `SleepLogEntity`.
- Produces: `POST /api/biometrics/sleep` round-trips the 7 new optional fields; omitted → nulls except `source` → `"manual"`.

- [ ] **Step 1: Write the failing IT** — `SleepLogEnrichedApiIT.java` (complete file):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LogSleepRequest;
import io.mrkuhne.mezo.api.dto.SleepLogResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** The D5 enriched fields ride the existing POST /api/biometrics/sleep (additive, all optional). */
class SleepLogEnrichedApiIT extends ApiIntegrationTest {

    @Test
    void testLogSleep_shouldRoundTripEnrichedFields_whenProvided() {
        LogSleepRequest req = LogSleepRequest.builder()
            .date(LocalDate.of(2026, 7, 22))
            .bedtime("00:42").wakeup("09:03")
            .durationH(new BigDecimal("7.48")) // 7h29m asleep
            .inBedMin(501)                     // 8h21m in bed
            .awakeMin(52).lightMin(206).remMin(144).deepMin(100)
            .sourceQualityPct(95)
            .source("screenshot")
            .build();

        SleepLogResponse saved = postForBody("/api/biometrics/sleep", req, ownerAuthHeaders(),
            HttpStatus.CREATED, SleepLogResponse.class);

        assertThat(saved.getInBedMin()).isEqualTo(501);
        assertThat(saved.getAwakeMin()).isEqualTo(52);
        assertThat(saved.getLightMin()).isEqualTo(206);
        assertThat(saved.getRemMin()).isEqualTo(144);
        assertThat(saved.getDeepMin()).isEqualTo(100);
        assertThat(saved.getSourceQualityPct()).isEqualTo(95);
        assertThat(saved.getSource()).isEqualTo("screenshot");
    }

    @Test
    void testLogSleep_shouldDefaultSourceManualAndNullPhases_whenOmitted() {
        LogSleepRequest req = LogSleepRequest.builder()
            .date(LocalDate.of(2026, 7, 22))
            .bedtime("23:10").wakeup("06:45")
            .durationH(new BigDecimal("7.50"))
            .build();

        SleepLogResponse saved = postForBody("/api/biometrics/sleep", req, ownerAuthHeaders(),
            HttpStatus.CREATED, SleepLogResponse.class);

        assertThat(saved.getSource()).isEqualTo("manual");
        assertThat(saved.getInBedMin()).isNull();
        assertThat(saved.getAwakeMin()).isNull();
        assertThat(saved.getSourceQualityPct()).isNull();
    }

    @Test
    void testLogSleep_shouldReturn400FieldError_whenSourceQualityOutOfRange() {
        LogSleepRequest req = LogSleepRequest.builder()
            .date(LocalDate.of(2026, 7, 22)).sourceQualityPct(101).build();

        String body = postForBody("/api/biometrics/sleep", req, ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "sourceQualityPct", "VALIDATION_INVALID_VALUE");
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=SleepLogEnrichedApiIT -DargLine=-Xmx3g`
Expected: FAIL — the round-trip test's assertions on `getInBedMin()` return null (service doesn't copy the fields yet).

- [ ] **Step 3: Wire the fields in `SleepLogService.log`** — after `e.setNotes(req.getNote());` add:

```java
        e.setInBedMin(req.getInBedMin());
        e.setAwakeMin(req.getAwakeMin());
        e.setLightMin(req.getLightMin());
        e.setRemMin(req.getRemMin());
        e.setDeepMin(req.getDeepMin());
        e.setSourceQualityPct(req.getSourceQualityPct());
        if (req.getSource() != null) {
            e.setSource(req.getSource()); // entity default stays "manual" when omitted
        }
```

`SleepLogMapper` needs no change: MapStruct auto-maps the identically-named new properties entity→response (only `duration`/`mealToSleep` are explicit). Verify by compiling; if the generated mapper misses them, add explicit `@Mapping` lines.

- [ ] **Step 4: Run the IT + the existing sleep ITs**

Run: `cd backend && ./mvnw clean test -Dtest='SleepLog*IT,BiometricsContractIT' -DargLine=-Xmx3g`
Expected: PASS (new + existing all green).

- [ ] **Step 5: Commit**

```bash
git add backend/src
git -c core.hooksPath=/dev/null commit -m "feat(sleep): enriched sleep-log write path (in-bed + phases + source) (mezo-dbsr)"
```

---

### Task 5: Repoint HabitTargets onto SleepAnchorPort + config cleanup + IT

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitTargets.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/config/HabitProperties.java` (drop `defaultWake`/`defaultBed`)
- Modify: `backend/src/main/resources/application.yml` (drop `mezo.habit.default-wake`/`default-bed`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/service/HabitTargetsSleepIT.java`

**Interfaces:**
- Consumes: Task 3's `SleepAnchorPort` (`resolve(UUID): SleepAnchor(wake, bed)`).
- Produces: `HabitTargets.resolve(UUID): Resolved(LocalTime wake, LocalTime bed)` — signature UNCHANGED (HabitEvaluator's `habitTargets.resolve(userId).wake()/.bed()` call sites stay untouched); the values now come from the sleep goal (ghost default bed = 22:00, was 23:00 — plan refinement 7).

- [ ] **Step 1: Write the failing IT** — `HabitTargetsSleepIT.java` (complete file):

```java
package io.mrkuhne.mezo.feature.habit.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import java.time.LocalTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** D3: wake_on_time / bed_on_time center on the SLEEP goal via SleepAnchorPort, not the weight goal. */
@Transactional
class HabitTargetsSleepIT extends AbstractIntegrationTest {

    @Autowired
    private HabitTargets habitTargets;

    @Autowired
    private DatabasePopulator databasePopulator;

    @Autowired
    private SleepGoalPopulator sleepGoalPopulator;

    @Test
    void testResolve_shouldDeriveFromSleepGoal_whenGoalRowExists() {
        UUID owner = databasePopulator.populateUser("habit-sleep@test.local");
        sleepGoalPopulator.goal(owner, 450, "WAKE", "06:45", 15);

        HabitTargets.Resolved resolved = habitTargets.resolve(owner);

        assertThat(resolved.wake()).isEqualTo(LocalTime.of(6, 45));
        assertThat(resolved.bed()).isEqualTo(LocalTime.of(23, 15));
    }

    @Test
    void testResolve_shouldReturnConfigGhost_whenNoSleepGoal() {
        UUID owner = databasePopulator.populateUser("habit-ghost@test.local");

        HabitTargets.Resolved resolved = habitTargets.resolve(owner);

        assertThat(resolved.wake()).isEqualTo(LocalTime.of(6, 0));
        assertThat(resolved.bed()).isEqualTo(LocalTime.of(22, 0)); // ghost WAKE 06:00 − 480
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=HabitTargetsSleepIT -DargLine=-Xmx3g`
Expected: FAIL — first test resolves 06:00/23:00 (HabitTargets still reads the weight goal + old defaults).

- [ ] **Step 3: Rewrite `HabitTargets`** (complete file):

```java
package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Wake/bed anchors from the sleep goal (mezo-dbsr, spec D3) — SleepAnchorPort ghosts config defaults. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitTargets {

    private final SleepAnchorPort sleepAnchorPort;

    public record Resolved(LocalTime wake, LocalTime bed) {}

    public Resolved resolve(UUID userId) {
        SleepAnchorPort.SleepAnchor anchor = sleepAnchorPort.resolve(userId);
        return new Resolved(anchor.wake(), anchor.bed());
    }
}
```

- [ ] **Step 4: Drop the dead config.** In `HabitProperties.java` remove the two components `@NotBlank String defaultWake,` and `@NotBlank String defaultBed,`. In `application.yml` remove the `default-wake: "06:00"` and `default-bed: "23:00"` lines under `mezo.habit:`. Then verify nothing else consumed them:

Run: `grep -rn "defaultWake\|defaultBed\|default-wake\|default-bed" backend/src | grep -v target`
Expected: no matches.

- [ ] **Step 5: Run the habit + sleep test surface**

Run: `cd backend && ./mvnw clean test -Dtest='Habit*IT,SleepGoal*IT' -DargLine=-Xmx3g`
Expected: PASS. If an existing habit IT pinned the old 23:00 default bed (grep `23:00` under `backend/src/test/java/io/mrkuhne/mezo/feature/habit/`): either the test seeds its own anchor — repoint it to `SleepGoalPopulator` — or it asserted the ghost; update the expectation to 22:00 with a comment referencing spec §3's ghost. Do NOT weaken assertions.

- [ ] **Step 6: Commit**

```bash
git add backend/src
git -c core.hooksPath=/dev/null commit -m "feat(habit): HabitTargets reads SleepAnchorPort; drop goal wake/bed fallback config (mezo-dbsr)"
```

---

### Task 6: FE data layer — types, mock seed, API client, dual-mode hooks, MSW

**Files:**
- Modify: `frontend/src/data/types.ts` (new `SleepGoal` + `SleepGoalInput`; enrich `SleepEntry`/`SleepLogInput`)
- Create: `frontend/src/data/me/sleepGoal.ts` (mock seed + `deriveSleepTimes` + `SLEEP_GOAL_GHOST`)
- Modify: `frontend/src/data/me/biometricsApi.ts` (+`sleepGoalApi`, enriched `sleepApi.log` body)
- Modify: `frontend/src/data/me/sleepHooks.ts` (+`useSleepGoal`, +`useSleepGoalActions`)
- Modify: `frontend/src/data/hooks.ts` (barrel line)
- Modify: `frontend/src/test/msw/handlers.ts` (+GET/PUT `/api/sleep/goal` defaults)
- Test: `frontend/src/data/me/sleepGoalHooks.test.tsx`

**Interfaces:**
- Consumes: Task 1's `components['schemas']['SleepGoalResponse'|'SetSleepGoalRequest']` + enriched sleep schemas from `api.gen.ts`.
- Produces: `SleepGoal { targetMinutes: number; anchor: 'WAKE'|'BED'; anchorTime: string; wakeTime: string; bedTime: string; regularityBandMin: number }`; `SleepGoalInput = Omit<SleepGoal,'wakeTime'|'bedTime'>`; `useSleepGoal(): { goal: SleepGoal; isPending: boolean }`; `useSleepGoalActions(): { setGoal: (input: SleepGoalInput) => Promise<void>; pending: boolean }`; `deriveSleepTimes(anchor, anchorTime, targetMinutes): { wakeTime: string; bedTime: string }`; `SLEEP_GOAL_GHOST` (WAKE 06:00/480/15 — mirrors the backend ghost); `mockSleepGoal` (WAKE 06:45/450/15 → bed 23:15). Query key: `['sleepGoal']`. `SleepEntry` gains optional `inBedMin/awakeMin/lightMin/remMin/deepMin/sourceQualityPct/source`; `SleepLogInput` gains `inBedMin?: number`.

- [ ] **Step 1: Types.** In `data/types.ts`, extend `SleepEntry` (after `notes`):

```ts
  // Tracker-grade enrichment (mezo-dbsr) — null/absent on plain manual rows
  inBedMin?: number | null
  awakeMin?: number | null
  lightMin?: number | null
  remMin?: number | null
  deepMin?: number | null
  sourceQualityPct?: number | null
  source?: 'manual' | 'screenshot' | null
```

Extend `SleepLogInput` with `inBedMin?: number`. Below it add:

```ts
/** The sleep goal — target asleep-duration + one fixed end; the other end is derived (spec D1/D4). */
export interface SleepGoal {
  targetMinutes: number
  anchor: 'WAKE' | 'BED'
  anchorTime: string
  /** Derived (or equal to anchorTime) — HH:mm; the day-anchor consumers read these two. */
  wakeTime: string
  bedTime: string
  regularityBandMin: number
}

/** PUT /api/sleep/goal payload — wake/bed are always server-derived, never sent. */
export type SleepGoalInput = Omit<SleepGoal, 'wakeTime' | 'bedTime'>
```

- [ ] **Step 2: `data/me/sleepGoal.ts`** (complete file):

```ts
import type { SleepGoal, SleepGoalInput } from '@/data/types'

const pad = (n: number) => String(n).padStart(2, '0')
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const toHHmm = (min: number) => `${pad(Math.floor(((min % 1440) + 1440) % 1440 / 60))}:${pad(((min % 1440) + 1440) % 1440 % 60)}`

/** WAKE fixed -> bed = wake − target; BED fixed -> wake = bed + target (mod 24h). Mirrors SleepAnchorResolver.derive. */
export function deriveSleepTimes(anchor: 'WAKE' | 'BED', anchorTime: string, targetMinutes: number): { wakeTime: string; bedTime: string } {
  return anchor === 'WAKE'
    ? { wakeTime: anchorTime, bedTime: toHHmm(toMin(anchorTime) - targetMinutes) }
    : { wakeTime: toHHmm(toMin(anchorTime) + targetMinutes), bedTime: anchorTime }
}

export function composeSleepGoal(input: SleepGoalInput): SleepGoal {
  return { ...input, ...deriveSleepTimes(input.anchor, input.anchorTime, input.targetMinutes) }
}

/** The backend's config-default ghost (spec §3) — the honest real-mode empty value. */
export const SLEEP_GOAL_GHOST: SleepGoal = composeSleepGoal({
  targetMinutes: 480, anchor: 'WAKE', anchorTime: '06:00', regularityBandMin: 15,
})

// Demo seed tuned to the mock sleepLog cluster (bed ~23:15 / wake ~06:45) for a credible regularity score.
export const mockSleepGoal: SleepGoal = composeSleepGoal({
  targetMinutes: 450, anchor: 'WAKE', anchorTime: '06:45', regularityBandMin: 15,
})
```

- [ ] **Step 3: API client.** In `data/me/biometricsApi.ts`: extend the `sleepApi.log` body with `inBedMin: input.inBedMin` (still `satisfies LogSleepRequest`), and add:

```ts
type SleepGoalResponse = components['schemas']['SleepGoalResponse']
type SetSleepGoalRequest = components['schemas']['SetSleepGoalRequest']

export const sleepGoalApi = {
  get: (): Promise<SleepGoal> =>
    apiFetch<SleepGoalResponse>('/api/sleep/goal') as Promise<SleepGoal>,
  set: (input: SleepGoalInput): Promise<SleepGoal> =>
    apiFetch<SleepGoalResponse>('/api/sleep/goal', {
      method: 'PUT',
      body: JSON.stringify({
        targetMinutes: input.targetMinutes,
        anchor: input.anchor,
        anchorTime: input.anchorTime,
        regularityBandMin: input.regularityBandMin,
      } satisfies SetSleepGoalRequest),
    }) as Promise<SleepGoal>,
}
```

Mirror the file's existing import style for `components`, `apiFetch`, and add `SleepGoal, SleepGoalInput` to the `@/data/types` type import.

- [ ] **Step 4: Hooks.** In `data/me/sleepHooks.ts` add (below `useSleep`):

```ts
export function useSleepGoal() {
  const { data, isPending } = useDualQuery<SleepGoal>({
    queryKey: ['sleepGoal'],
    mockData: mockSleepGoal,
    realFetch: sleepGoalApi.get,
    realEmpty: SLEEP_GOAL_GHOST, // backend never 404s; the ghost is the honest pre-resolve value
  })
  return { goal: data, isPending }
}

export function useSleepGoalActions() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: async (input: SleepGoalInput) => {
      if (mock) {
        qc.setQueryData<SleepGoal>(['sleepGoal'], composeSleepGoal(input))
        return
      }
      await sleepGoalApi.set(input)
    },
    onSuccess: mock ? undefined : () => {
      qc.invalidateQueries({ queryKey: ['sleepGoal'] })
      qc.invalidateQueries({ queryKey: ['habitDay'] })  // wake/bed habits re-center
      qc.invalidateQueries({ queryKey: ['fuelDay'] })   // meal slots cascade off the anchor
    },
  })
  return {
    setGoal: (input: SleepGoalInput) => mutation.mutateAsync(input).then(() => undefined),
    pending: mutation.isPending,
  }
}
```

New imports: `useDualQuery` from `@/data/useDualQuery`; `sleepGoalApi` from `@/data/me/biometricsApi`; `mockSleepGoal, SLEEP_GOAL_GHOST, composeSleepGoal` from `@/data/me/sleepGoal`; types `SleepGoal, SleepGoalInput` from `@/data/types`. (No `['fuelTimeline']` key exists — the timeline is a derived hook and recomputes from `['sleepGoal']` once Task 10 repoints it.)

- [ ] **Step 5: Barrel.** In `data/hooks.ts` change the sleep line to:

```ts
export { useSleep, useSleepGoal, useSleepGoalActions } from '@/data/me/sleepHooks'
```

- [ ] **Step 6: MSW defaults.** In `test/msw/handlers.ts`, next to the existing sleep handlers:

```ts
  http.get(`${API_BASE}/api/sleep/goal`, () =>
    HttpResponse.json({
      targetMinutes: 450, anchor: 'WAKE', anchorTime: '06:45',
      wakeTime: '06:45', bedTime: '23:15', regularityBandMin: 15,
    })),
  http.put(`${API_BASE}/api/sleep/goal`, async ({ request }) => {
    const body = (await request.json()) as { targetMinutes: number; anchor: 'WAKE' | 'BED'; anchorTime: string; regularityBandMin?: number }
    const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
    const toHHmm = (m: number) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 1440) + 1440) % 1440 % 60).padStart(2, '0')}`
    const wakeTime = body.anchor === 'WAKE' ? body.anchorTime : toHHmm(toMin(body.anchorTime) + body.targetMinutes)
    const bedTime = body.anchor === 'BED' ? body.anchorTime : toHHmm(toMin(body.anchorTime) - body.targetMinutes)
    return HttpResponse.json({ ...body, regularityBandMin: body.regularityBandMin ?? 15, wakeTime, bedTime })
  }),
```

- [ ] **Step 7: Hook tests** — `data/me/sleepGoalHooks.test.tsx` (complete file):

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useSleepGoal, useSleepGoalActions } from '@/data/me/sleepHooks'
import { SLEEP_GOAL_GHOST, mockSleepGoal, deriveSleepTimes } from '@/data/me/sleepGoal'

afterEach(() => vi.unstubAllEnvs())

describe('deriveSleepTimes', () => {
  it('derives bed from a WAKE anchor', () => {
    expect(deriveSleepTimes('WAKE', '06:45', 450)).toEqual({ wakeTime: '06:45', bedTime: '23:15' })
  })
  it('derives wake from a BED anchor across midnight', () => {
    expect(deriveSleepTimes('BED', '00:30', 480)).toEqual({ wakeTime: '08:30', bedTime: '00:30' })
  })
})

describe('useSleepGoal (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('serves the demo seed synchronously', () => {
    const { result } = renderHook(() => useSleepGoal(), { wrapper: makeHookWrapper() })
    expect(result.current.goal).toEqual(mockSleepGoal)
  })

  it('setGoal patches the cache with re-derived ends', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ read: useSleepGoal(), act: useSleepGoalActions() }), { wrapper })
    await act(() => result.current.act.setGoal({ targetMinutes: 480, anchor: 'BED', anchorTime: '23:00', regularityBandMin: 15 }))
    await waitFor(() => expect(result.current.read.goal.wakeTime).toBe('07:00'))
  })
})

describe('useSleepGoal (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('starts from the honest ghost, then loads the server goal', async () => {
    const { result } = renderHook(() => useSleepGoal(), { wrapper: makeHookWrapper() })
    expect(result.current.goal).toEqual(SLEEP_GOAL_GHOST) // never the mock seed
    await waitFor(() => expect(result.current.goal.anchorTime).toBe('06:45'))
    expect(result.current.goal.bedTime).toBe('23:15')
  })

  it('setGoal PUTs and refetches', async () => {
    let putBody: unknown
    server.use(
      http.put(`${API_BASE}/api/sleep/goal`, async ({ request }) => {
        putBody = await request.json()
        return HttpResponse.json({ targetMinutes: 480, anchor: 'WAKE', anchorTime: '06:00', wakeTime: '06:00', bedTime: '22:00', regularityBandMin: 15 })
      }),
      http.get(`${API_BASE}/api/sleep/goal`, () =>
        HttpResponse.json({ targetMinutes: 480, anchor: 'WAKE', anchorTime: '06:00', wakeTime: '06:00', bedTime: '22:00', regularityBandMin: 15 })),
    )
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ read: useSleepGoal(), act: useSleepGoalActions() }), { wrapper })
    await act(() => result.current.act.setGoal({ targetMinutes: 480, anchor: 'WAKE', anchorTime: '06:00', regularityBandMin: 15 }))
    expect(putBody).toEqual({ targetMinutes: 480, anchor: 'WAKE', anchorTime: '06:00', regularityBandMin: 15 })
    await waitFor(() => expect(result.current.read.goal.bedTime).toBe('22:00'))
  })
})
```

- [ ] **Step 8: Run both modes**

Run: `cd frontend && pnpm test src/data/me/sleepGoalHooks.test.tsx && VITE_USE_MOCK=true pnpm test src/data/me/sleepGoalHooks.test.tsx && pnpm test src/data/dualMode.guard.test.ts`
Expected: PASS (the guard confirms no leaky mock fallback).

- [ ] **Step 9: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fe-data): useSleepGoal/useSleepGoalActions dual-mode hooks + enriched sleep types (mezo-dbsr)"
```

---

### Task 7: `sleepStats.ts` — pure regularity/efficiency logic

**Files:**
- Create: `frontend/src/features/me/logic/sleepStats.ts`
- Test: `frontend/src/features/me/logic/sleepStats.test.ts`

**Interfaces:**
- Consumes: `SleepEntry`, `SleepGoal` from `@/data/types`.
- Produces: `REGULARITY_WINDOW_DAYS = 14`, `EFFICIENCY_TARGET_PCT = 85`, `regularityScore(logs, goal, windowDays): number | null` (0..1), `efficiencyPct(entry): number | null` (0..100), `bedDeltaMin(entry, goal): number | null` (signed minutes vs. target bed). All pure, no `Date.now` — the window anchors to the latest log's date (mock-mode safe).

- [ ] **Step 1: Write the failing tests** — `sleepStats.test.ts` (complete file):

```ts
import { describe, it, expect } from 'vitest'
import { regularityScore, efficiencyPct, bedDeltaMin, REGULARITY_WINDOW_DAYS, EFFICIENCY_TARGET_PCT } from '@/features/me/logic/sleepStats'
import type { SleepEntry, SleepGoal } from '@/data/types'

const goal: SleepGoal = { targetMinutes: 450, anchor: 'WAKE', anchorTime: '06:45', wakeTime: '06:45', bedTime: '23:15', regularityBandMin: 15 }
const entry = (date: string, bedtime: string, wakeup: string, extra: Partial<SleepEntry> = {}): SleepEntry =>
  ({ date, bedtime, wakeup, duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 0, notes: null, ...extra })

describe('regularityScore', () => {
  it('counts only nights with BOTH ends inside the ±band', () => {
    const logs = [
      entry('2026-07-20', '23:15', '06:45'), // both exact — in
      entry('2026-07-21', '23:29', '06:31'), // both at +14/−14 — in
      entry('2026-07-22', '23:31', '06:45'), // bed +16 — out
      entry('2026-07-23', '23:15', '07:01'), // wake +16 — out
    ]
    expect(regularityScore(logs, goal, 14)).toBeCloseTo(0.5)
  })

  it('handles a bed target across midnight with circular distance', () => {
    const wrapGoal: SleepGoal = { ...goal, anchor: 'BED', anchorTime: '00:00', wakeTime: '07:30', bedTime: '00:00' }
    const logs = [entry('2026-07-23', '23:50', '07:20')] // bed −10 circularly, wake −10 — in
    expect(regularityScore(logs, wrapGoal, 14)).toBe(1)
  })

  it('windows to the last N days ANCHORED AT the latest log (mock-safe), skips end-less rows', () => {
    const logs = [
      entry('2026-07-01', '23:15', '06:45'),                        // outside the 14d window — ignored
      entry('2026-07-22', '23:15', '06:45'),                        // in window, in band
      { ...entry('2026-07-23', '', ''), bedtime: '', wakeup: '' },  // no ends — skipped
    ]
    expect(regularityScore(logs, goal, 14)).toBe(1)
  })

  it('is null when no scorable night exists', () => {
    expect(regularityScore([], goal, 14)).toBeNull()
  })
})

describe('efficiencyPct', () => {
  it('uses inBedMin when present: asleep ÷ in-bed', () => {
    expect(efficiencyPct(entry('2026-07-23', '00:42', '09:03', { duration: 7.48, inBedMin: 501 }))).toBeCloseTo(89.6, 1)
  })
  it('falls back to the bedtime→wakeup span (midnight wrap)', () => {
    expect(efficiencyPct(entry('2026-07-23', '23:15', '06:45', { duration: 7.0 }))).toBeCloseTo(93.3, 1)
  })
  it('caps at 100 and is null without any span', () => {
    expect(efficiencyPct(entry('2026-07-23', '23:00', '06:00', { duration: 8 }))).toBe(100)
    expect(efficiencyPct({ ...entry('2026-07-23', '', ''), bedtime: '', wakeup: '' })).toBeNull()
  })
})

describe('bedDeltaMin', () => {
  it('signs the delta vs. the target bed (late positive)', () => {
    expect(bedDeltaMin(entry('2026-07-23', '23:30', '06:45'), goal)).toBe(15)
    expect(bedDeltaMin(entry('2026-07-23', '23:00', '06:45'), goal)).toBe(-15)
  })
  it('wraps around midnight (00:05 vs 23:15 target = +50)', () => {
    expect(bedDeltaMin(entry('2026-07-23', '00:05', '06:45'), goal)).toBe(50)
  })
})

describe('constants', () => {
  it('exports the FE display config', () => {
    expect(REGULARITY_WINDOW_DAYS).toBe(14)
    expect(EFFICIENCY_TARGET_PCT).toBe(85)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && pnpm test src/features/me/logic/sleepStats.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `sleepStats.ts` (complete file):

```ts
import type { SleepEntry, SleepGoal } from '@/data/types'

/** FE display config for the two scores (backend has no consumer — spec §5: scores are FE-pure). */
export const REGULARITY_WINDOW_DAYS = 14
export const EFFICIENCY_TARGET_PCT = 85

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** Shortest circular distance between two HH:mm points on the 24h clock (0..720). */
function circularDiffMin(a: string, b: string): number {
  const d = Math.abs(toMin(a) - toMin(b))
  return Math.min(d, 1440 - d)
}

/** Signed circular delta actual−target in minutes (−720..+720; late = positive). */
function signedDeltaMin(actual: string, target: string): number {
  let d = toMin(actual) - toMin(target)
  if (d > 720) d -= 1440
  if (d < -720) d += 1440
  return d
}

const isoMinusDays = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d - days))
  return date.toISOString().slice(0, 10)
}

/**
 * Fraction of the last-N nights whose bedtime AND wakeup fall within ±band of the goal's derived
 * targets (Walker's regularity lever, spec D2). Window anchors to the LATEST log date, not "today" —
 * pure and mock-seed safe. Nights without both ends are unscorable and skipped. Null when nothing scores.
 */
export function regularityScore(logs: SleepEntry[], goal: SleepGoal, windowDays: number): number | null {
  if (logs.length === 0) return null
  const latest = logs.reduce((max, e) => (e.date > max ? e.date : max), logs[0].date)
  const from = isoMinusDays(latest, windowDays - 1)
  const scorable = logs.filter((e) => e.date >= from && e.bedtime && e.wakeup)
  if (scorable.length === 0) return null
  const inBand = scorable.filter(
    (e) =>
      circularDiffMin(e.bedtime, goal.bedTime) <= goal.regularityBandMin &&
      circularDiffMin(e.wakeup, goal.wakeTime) <= goal.regularityBandMin,
  )
  return inBand.length / scorable.length
}

/**
 * Sleep efficiency in percent: asleep ÷ in-bed (spec D6). Prefers the tracker's inBedMin;
 * falls back to the bedtime→wakeup span (midnight-wrapped). Capped at 100; null without a span.
 */
export function efficiencyPct(entry: SleepEntry): number | null {
  const asleepMin = entry.duration * 60
  const inBed = entry.inBedMin ?? (entry.bedtime && entry.wakeup
    ? ((toMin(entry.wakeup) - toMin(entry.bedtime) + 1440) % 1440) || null
    : null)
  if (!inBed) return null
  return Math.min(100, (asleepMin / inBed) * 100)
}

/** Signed minutes the night's bedtime missed the goal's target bed by (late = positive). */
export function bedDeltaMin(entry: SleepEntry, goal: SleepGoal): number | null {
  if (!entry.bedtime) return null
  return signedDeltaMin(entry.bedtime, goal.bedTime)
}
```

- [ ] **Step 4: Run the tests**

Run: `cd frontend && pnpm test src/features/me/logic/sleepStats.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/me/logic
git -c core.hooksPath=/dev/null commit -m "feat(me): sleepStats — regularity + efficiency pure logic (mezo-dbsr)"
```

---

### Task 8: `SleepGoalSheet` + „Ágyban" field on `SleepLogSheet`

**Files:**
- Create: `frontend/src/features/me/sheets/SleepGoalSheet.tsx` + `SleepGoalSheet.test.tsx`
- Modify: `frontend/src/features/me/sheets/SleepLogSheet.tsx` + `SleepLogSheet.test.tsx`

**Interfaces:**
- Consumes: `useSleepGoal`/`useSleepGoalActions` from `@/data/hooks`; `deriveSleepTimes` from `@/data/me/sleepGoal`; `Sheet` from `@/shared/ui/Sheet` (render-prop `close`, NO `open` prop); `Icon` from wherever `EditGoalSheet` imports it (mirror).
- Produces: `SleepGoalSheet({ onClose }: { onClose: () => void })` — opener conditionally mounts it. `SleepLogSheet`'s `save` now includes `inBedMin` when the optional field is filled.

- [ ] **Step 1: Failing sheet test** — `SleepGoalSheet.test.tsx` (complete file):

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryWrapper } from '@/test/queryWrapper'
import { SleepGoalSheet } from '@/features/me/sheets/SleepGoalSheet'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderSheet = (onClose = vi.fn()) => {
  render(<QueryWrapper><SleepGoalSheet onClose={onClose} /></QueryWrapper>)
  return onClose
}

describe('SleepGoalSheet', () => {
  it('opens prefilled from the current goal with a live-derived other end', () => {
    renderSheet()
    expect(screen.getByLabelText('Cél időtartam')).toHaveTextContent('7.5 ó')
    expect(screen.getByLabelText('Rögzített időpont')).toHaveValue('06:45')
    expect(screen.getByText(/Lefekvés ebből:/)).toHaveTextContent('23:15')
  })

  it('flipping the anchor swaps which end is derived', async () => {
    renderSheet()
    await userEvent.click(screen.getByRole('button', { name: /Lefekvés rögzítése/ }))
    fireEvent.change(screen.getByLabelText('Rögzített időpont'), { target: { value: '23:00' } })
    expect(screen.getByText(/Ébredés ebből:/)).toHaveTextContent('06:30') // 23:00 + 450
  })

  it('the duration stepper steps by 15 min and re-derives', async () => {
    renderSheet()
    await userEvent.click(screen.getByRole('button', { name: 'Cél növelése' }))
    expect(screen.getByLabelText('Cél időtartam')).toHaveTextContent('7.8 ó') // 465 min
    expect(screen.getByText(/Lefekvés ebből:/)).toHaveTextContent('23:00')
  })

  it('saving persists and closes', async () => {
    const onClose = renderSheet()
    await userEvent.click(screen.getByRole('button', { name: /Cél mentése/ }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run to verify failure** — `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/sheets/SleepGoalSheet.test.tsx` → FAIL (module not found).

- [ ] **Step 3: Implement `SleepGoalSheet.tsx`** (complete file; mirror `EditGoalSheet`'s row/label styles and its `Icon` import path):

```tsx
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { useSleepGoal, useSleepGoalActions } from '@/data/hooks'
import { deriveSleepTimes } from '@/data/me/sleepGoal'

const ROW: React.CSSProperties = { justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--surface-2)' }
const LABEL: React.CSSProperties = { fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }
const TIME_INPUT: React.CSSProperties = { background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontVariantNumeric: 'tabular-nums', colorScheme: 'dark' }
const STEP_MIN = 15
const MIN_TARGET = 240
const MAX_TARGET = 720

/** Sleep-goal editor (spec §5): duration stepper + fixed-end toggle + live-derived other end. */
export function SleepGoalSheet({ onClose }: { onClose: () => void }) {
  const { goal } = useSleepGoal()
  const { setGoal, pending } = useSleepGoalActions()
  const [targetMinutes, setTargetMinutes] = useState(goal.targetMinutes)
  const [anchor, setAnchor] = useState<'WAKE' | 'BED'>(goal.anchor)
  const [anchorTime, setAnchorTime] = useState(goal.anchorTime)

  const derived = deriveSleepTimes(anchor, anchorTime, targetMinutes)
  const hours = (targetMinutes / 60).toFixed(1)

  const save = (close: () => void) =>
    setGoal({ targetMinutes, anchor, anchorTime, regularityBandMin: goal.regularityBandMin }).then(close)

  return (
    <Sheet onClose={onClose} labelledBy="sleep-goal-title">
      {(close) => (
        <div className="col gap-sm">
          <h2 id="sleep-goal-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
            Alvás-cél
          </h2>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Ajánlott sáv: 7–9 óra alvás</span>

          <div className="row" style={ROW}>
            <span style={LABEL}>Cél időtartam</span>
            <div className="row gap-sm" style={{ alignItems: 'center' }}>
              <button type="button" className="chip" aria-label="Cél csökkentése"
                disabled={targetMinutes <= MIN_TARGET}
                onClick={() => setTargetMinutes((v) => Math.max(MIN_TARGET, v - STEP_MIN))}
                style={{ opacity: targetMinutes <= MIN_TARGET ? 0.4 : 1 }}><Icon name="minus" size={12} /></button>
              <span aria-label="Cél időtartam"
                style={{ minWidth: 44, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {hours} ó
              </span>
              <button type="button" className="chip" aria-label="Cél növelése"
                disabled={targetMinutes >= MAX_TARGET}
                onClick={() => setTargetMinutes((v) => Math.min(MAX_TARGET, v + STEP_MIN))}
                style={{ opacity: targetMinutes >= MAX_TARGET ? 0.4 : 1 }}><Icon name="plus" size={12} /></button>
            </div>
          </div>

          <div className="row gap-sm">
            <button type="button" className="chip" aria-label="Ébredés rögzítése" onClick={() => setAnchor('WAKE')}
              style={anchor === 'WAKE'
                ? { background: 'var(--wash-lav)', color: 'var(--lav-deep)', borderColor: 'transparent' }
                : undefined}>
              ☀️ Ébredés
            </button>
            <button type="button" className="chip" aria-label="Lefekvés rögzítése" onClick={() => setAnchor('BED')}
              style={anchor === 'BED'
                ? { background: 'var(--wash-lav)', color: 'var(--lav-deep)', borderColor: 'transparent' }
                : undefined}>
              🛏️ Lefekvés
            </button>
          </div>

          <div className="row" style={ROW}>
            <span style={LABEL}>{anchor === 'WAKE' ? 'Ébredés' : 'Lefekvés'}</span>
            <input type="time" aria-label="Rögzített időpont" value={anchorTime}
              onChange={(e) => e.target.value && setAnchorTime(e.target.value)} style={TIME_INPUT} />
          </div>

          <span style={{ fontSize: 11, color: 'var(--lav-deep)', fontVariantNumeric: 'tabular-nums' }}>
            {anchor === 'WAKE' ? `Lefekvés ebből: ${derived.bedTime}` : `Ébredés ebből: ${derived.wakeTime}`}
          </span>

          <button type="button" className="cta-primary" disabled={pending}
            style={{ opacity: pending ? 0.5 : 1 }} onClick={() => save(close)}>
            <Icon name="check" size={14} /> Cél mentése
          </button>
        </div>
      )}
    </Sheet>
  )
}
```

Before writing, check `Icon`'s real import path and the sheet-body classNames in `EditGoalSheet.tsx` and mirror them exactly (including any wrapper div the house sheets use).

- [ ] **Step 4: Run the sheet test** — both modes on the new file → PASS.

- [ ] **Step 5: „Ágyban" field on `SleepLogSheet`.** Add state `const [inBedMin, setInBedMin] = useState('')` and, between the awakenings chips and the note textarea, a row mirroring the sheet's field styling:

```tsx
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--surface-2)' }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>
              Ágyban összesen (perc)
            </span>
            <input type="number" inputMode="numeric" min={1} placeholder="opcionális" aria-label="Ágyban összesen (perc)"
              value={inBedMin} onChange={(e) => setInBedMin(e.target.value)}
              style={{ width: 72, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
          </div>
```

In `save(...)` extend the payload: `inBedMin: inBedMin ? Number(inBedMin) : undefined,`.

- [ ] **Step 6: Extend `SleepLogSheet.test.tsx`** — add:

```tsx
  it('includes inBedMin when the optional field is filled', async () => {
    const onSave = vi.fn()
    render(<SleepLogSheet onClose={vi.fn()} onSave={onSave} />)
    await userEvent.type(screen.getByLabelText('Ágyban összesen (perc)'), '480')
    await userEvent.click(screen.getByRole('button', { name: /Mentés/ }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ inBedMin: 480 }))
  })
```

(Mirror the existing test file's render/import idiom; the existing "omits it" behavior is covered by the original test whose `objectContaining` payload has no `inBedMin`.)

- [ ] **Step 7: Run both sheet test files in both modes**

Run: `cd frontend && pnpm test src/features/me/sheets/SleepGoalSheet.test.tsx src/features/me/sheets/SleepLogSheet.test.tsx && VITE_USE_MOCK=true pnpm test src/features/me/sheets/SleepGoalSheet.test.tsx src/features/me/sheets/SleepLogSheet.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/me/sheets
git -c core.hooksPath=/dev/null commit -m "feat(me): SleepGoalSheet editor + optional in-bed field on SleepLogSheet (mezo-dbsr)"
```

---

### Task 9: SleepPage — goal card, score rings, enriched hero

**Files:**
- Modify: `frontend/src/features/me/pages/SleepPage.tsx` + `SleepPage.test.tsx`

**Interfaces:**
- Consumes: `useSleep`, `useSleepGoal` from `@/data/hooks`; `regularityScore`, `efficiencyPct`, `bedDeltaMin`, `REGULARITY_WINDOW_DAYS`, `EFFICIENCY_TARGET_PCT` from `@/features/me/logic/sleepStats`; `ScoreRing` from `@/shared/ui/ScoreRing` (`pct` 0..1, `label`, `sublabel`, `color`); `SleepGoalSheet` from `@/features/me/sheets/SleepGoalSheet`.
- Produces: the approved-mockup layout — goal card (night arc bed 🛏️ ↔ ☀️ wake, target pill, „a rendszeresség a király" + `±{band}p` sage pill, `szerkeszt` button) above two score cards (Rendszeresség / Hatékonyság rings) above the KEPT last-night hero (enriched with the bed-delta stat + night efficiency), chart, log rows.

- [ ] **Step 1: Extend the page test first.** In `SleepPage.test.tsx` keep the existing three tests unchanged and add (mock-mode describe):

```tsx
  it('renders the sleep-goal card with derived ends and the regularity band', () => {
    renderPage()
    expect(screen.getByText('23:15')).toBeInTheDocument()          // derived bed
    expect(screen.getAllByText('06:45').length).toBeGreaterThan(0) // fixed wake
    expect(screen.getByText('7.5 ó cél')).toBeInTheDocument()
    expect(screen.getByText(/a rendszeresség a király/i)).toBeInTheDocument()
    expect(screen.getByText('±15p')).toBeInTheDocument()
  })

  it('renders the two score rings with computed values', () => {
    renderPage()
    expect(screen.getByText('Rendszeresség')).toBeInTheDocument()
    expect(screen.getByText('Hatékonyság')).toBeInTheDocument()
    expect(screen.getByText('14 nap · ±15p')).toBeInTheDocument()
    expect(screen.getByText('cél ≥ 85%')).toBeInTheDocument()
  })

  it('opens the SleepGoalSheet from the szerkeszt button', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /szerkeszt/i }))
    expect(screen.getByRole('dialog', { name: 'Alvás-cél' })).toBeInTheDocument()
  })

  it('shows the bed-delta stat on the hero', () => {
    renderPage()
    // last mock night bed 23:05 vs target 23:15 -> −10p
    expect(screen.getByText(/vs\. cél lefekvés/)).toHaveTextContent('−10p')
  })
```

(`renderPage` = the file's existing render helper; add `userEvent` import if missing. Run → these FAIL.)

- [ ] **Step 2: Implement the page changes.** Keep header, chart, log rows, `SleepLogSheet` wiring untouched. Add hooks + state at the top of the component:

```tsx
  const { goal } = useSleepGoal()
  const [goalOpen, setGoalOpen] = useState(false)
  const regularity = regularityScore(sleepLog, goal, REGULARITY_WINDOW_DAYS)
  const lastEfficiency = lastNight ? efficiencyPct(lastNight) : null
  const lastBedDelta = lastNight ? bedDeltaMin(lastNight, goal) : null
```

Insert the goal card directly under the page header (renders in the empty state too, so move it ABOVE the `if (!lastNight)` early return — restructure that guard to only wrap the hero/chart/log sections). Goal card JSX:

```tsx
      {/* Sleep-goal card — the day's anchor (spec §5) */}
      <section className="card" aria-label="Alvás-cél" style={{ padding: '14px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>Alvás-cél</span>
          <button type="button" className="chip" onClick={() => setGoalOpen(true)} style={{ fontSize: 9, padding: '3px 8px' }}>
            szerkeszt
          </button>
        </div>
        <div className="row" style={{ alignItems: 'center', gap: 10, marginTop: 10 }}>
          <div className="col" style={{ alignItems: 'center', gap: 2 }}>
            <span aria-hidden="true">🛏️</span>
            <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--lav-deep)' }}>{goal.bedTime}</span>
          </div>
          <div style={{ position: 'relative', flex: 1, height: 4, borderRadius: 2, background: 'linear-gradient(90deg, var(--lav), var(--sky))' }}>
            <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', padding: '2px 10px', borderRadius: 999, background: 'var(--wash-lav)', color: 'var(--lav-deep)', fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>
              {(goal.targetMinutes / 60).toFixed(1)} ó cél
            </span>
          </div>
          <div className="col" style={{ alignItems: 'center', gap: 2 }}>
            <span aria-hidden="true">☀️</span>
            <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--sky)' }}>{goal.wakeTime}</span>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--text-tertiary)' }}>„a rendszeresség a király"</span>
          <span className="chip" style={{ fontSize: 9, padding: '2px 8px', background: 'var(--wash-sage)', color: 'var(--sage-deep)', borderColor: 'transparent' }}>
            ±{goal.regularityBandMin}p
          </span>
        </div>
      </section>
```

Score cards (below the goal card):

```tsx
      <div className="row gap-sm" style={{ marginTop: 8 }}>
        <section className="card col" aria-label="Rendszeresség" style={{ flex: 1, alignItems: 'center', gap: 6, padding: '12px 8px' }}>
          <ScoreRing pct={regularity ?? 0} size={64} stroke={5} color="var(--lav-deep)"
            label={regularity != null ? `${Math.round(regularity * 100)}` : '–'} sublabel="%" />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Rendszeresség</span>
          <span style={{ fontSize: 9, color: 'var(--faint)' }}>{REGULARITY_WINDOW_DAYS} nap · ±{goal.regularityBandMin}p</span>
        </section>
        <section className="card col" aria-label="Hatékonyság" style={{ flex: 1, alignItems: 'center', gap: 6, padding: '12px 8px' }}>
          <ScoreRing pct={(lastEfficiency ?? 0) / 100} size={64} stroke={5}
            color={lastEfficiency != null && lastEfficiency >= EFFICIENCY_TARGET_PCT ? 'var(--sage-deep)' : 'var(--warning)'}
            label={lastEfficiency != null ? `${Math.round(lastEfficiency)}` : '–'} sublabel="%" />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Hatékonyság</span>
          <span style={{ fontSize: 9, color: 'var(--faint)' }}>cél ≥ {EFFICIENCY_TARGET_PCT}%</span>
        </section>
      </div>
```

Hero enrichment — next to the existing quality/awakening stats add (formatting: `−` U+2212 for negatives, `+` prefix for positives, matching `fmtSigned`'s idiom):

```tsx
          {lastBedDelta != null && (
            <span style={{ fontSize: 10, color: Math.abs(lastBedDelta) <= goal.regularityBandMin ? 'var(--sage-deep)' : 'var(--warning)', fontVariantNumeric: 'tabular-nums' }}>
              {lastBedDelta > 0 ? '+' : lastBedDelta < 0 ? '−' : ''}{Math.abs(lastBedDelta)}p vs. cél lefekvés
            </span>
          )}
          {lastEfficiency != null && (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
              hatékonyság {Math.round(lastEfficiency)}%
            </span>
          )}
```

Sheet mount at the bottom, next to the existing log sheet: `{goalOpen && <SleepGoalSheet onClose={() => setGoalOpen(false)} />}`.

Adapt these snippets to the page's ACTUAL wrappers/classNames (`card`/`col`/`row` usage, hero markup) — mirror what's there; the mockup structure (arc row, pill, two ring cards) is the requirement, exact class soup is not.

- [ ] **Step 3: Run the page tests in both modes**

Run: `cd frontend && pnpm test src/features/me/pages/SleepPage.test.tsx && VITE_USE_MOCK=true pnpm test src/features/me/pages/SleepPage.test.tsx`
Expected: PASS — old three + new four. The real-mode empty test must still pass (goal card now renders on the ghost; the "Még nincs alvásadat." placeholder remains for the log sections).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/me/pages
git -c core.hooksPath=/dev/null commit -m "feat(me): SleepPage sleep-goal card + regularity/efficiency rings + enriched hero (mezo-dbsr)"
```

---

### Task 10: Repoint the FE anchor consumers (timeline + EditGoalSheet)

**Files:**
- Modify: `frontend/src/data/fuel/timelineHooks.ts` (wake/bed from `useSleepGoal`)
- Modify: `frontend/src/features/me/sheets/EditGoalSheet.tsx` + `EditGoalSheet.test.tsx` (drop wake/bed rows)
- Modify: `frontend/src/data/me/goalHooks.ts` (`savePlanner` planner arg → `{ mealsPerDay }`)
- Modify: `frontend/src/data/me/goalApi.ts` (`goalResponseToUpsert` keeps res wake/bed pass-through)
- Check/modify: any timeline/fuel test pinning wake/bed sources

**Interfaces:**
- Consumes: `useSleepGoal` from `@/data/hooks` (its `goal.wakeTime`/`goal.bedTime` are ALWAYS set — ghost/mock — so no `??` fallback needed).
- Produces: `useFuelTimeline` composes `buildDayPlan`/`buildProtocol` anchors from the sleep goal; `mealsPerDay` still comes from the weight goal (spec D3). `savePlanner(goalId, res, { mealsPerDay })`.

- [ ] **Step 1: Repoint the timeline.** In `data/fuel/timelineHooks.ts` add `useSleepGoal` to the hook imports (data-internal: import from `@/data/me/sleepHooks` — cross-domain data imports are allowed; features use the barrel, data modules import directly). Inside the hook add `const { goal: sleepGoal } = useSleepGoal()` next to the `useGoal()` call, then change lines 92-93:

```ts
  const wake = sleepGoal.wakeTime   // sleep goal owns the anchor (mezo-dbsr, spec D3)
  const bed = sleepGoal.bedTime
  const mealsPerDay = goal?.mealsPerDay ?? PLANNER_DEFAULTS.mealsPerDay  // eating cadence stays on the weight goal
```

`PLANNER_DEFAULTS.wake/bed` become unused by this file — if nothing else imports them (`grep -rn "PLANNER_DEFAULTS" frontend/src`), slim the const to `{ mealsPerDay: 4 }` and update its comment; otherwise leave and note.

- [ ] **Step 2: EditGoalSheet slimming.** Remove the `wakeTime`/`bedTime` state lines, the two `<input type="time">` rows (Ébredés/Lefekvés) from the "Napi ritmus" section (the `mealsPerDay` stepper + save button stay), and pass `{ mealsPerDay }` to `savePlanner`. Add a one-line hint under the stepper pointing at the new home:

```tsx
  <span style={{ fontSize: 9, color: 'var(--faint)' }}>Az ébredés/lefekvés horgony az Alvás oldalon állítható.</span>
```

- [ ] **Step 3: goalHooks/goalApi.** In `goalHooks.ts` change the `savePlanner` mutation's planner type to `{ mealsPerDay: number }`. In `goalApi.ts` `goalResponseToUpsert(res, planner)`: `mealsPerDay` from `planner`, `wakeTime`/`bedTime` now pass through from `res` unchanged (columns retired from editing but kept on the wire — spec §6).

- [ ] **Step 4: Update `EditGoalSheet.test.tsx`.** Delete/adjust: the render test no longer finds Ébredés/Lefekvés inputs (assert they are GONE: `expect(screen.queryByLabelText('Ébredés')).toBeNull()`); the real-mode PUT test asserts `body.mealsPerDay === 5` and that `body.wakeTime`/`body.bedTime` equal the ORIGINAL `goalResponse` values (pass-through proof). Keep the stepper-clamp test as is.

- [ ] **Step 5: Full FE gate (both modes + build)**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: ALL green. Any fuel/timeline test that seeded wake/bed via the weight goal now needs the sleep-goal MSW handler / mock (added in Task 6) — fix by seeding `['sleepGoal']` or relying on the defaults, never by re-adding a goal fallback.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git -c core.hooksPath=/dev/null commit -m "feat(fuel,me): day-anchor consumers read the sleep goal; EditGoalSheet keeps only mealsPerDay (mezo-dbsr)"
```

---

### Task 11: Living docs + cluster notes

**Files:**
- Modify: `docs/features/me.md` (§ sleep: goal card, scores, enriched log, SleepGoalSheet; § file map)
- Modify: `docs/features/fuel.md` (§ integrations: wake/bed now from `useSleepGoal`; mealsPerDay still goal)
- Modify: `docs/features/habit.md` (§ HabitTargets → SleepAnchorPort; default-bed ghost 22:00 note)
- Modify: `docs/features/_platform-api-backend.md` (new `/api/sleep/goal` surface + `SleepGoal` tag + flag)
- Modify: `docs/features/_platform-data-layer.md` (new hooks + `['sleepGoal']` key + `data/me/sleepGoal.ts`)
- Modify: `docs/superpowers/specs/2026-07-23-sleep-routine-cluster-notes.md` (§0 TL;DR + §3 slice A → implemented)

- [ ] **Step 1: Update the five feature docs.** Overwrite in place (git is the history): only the sections the change touches — typically §4 (API/contract), §5 (integrations), §10/file-map with fresh `file:line` pointers to `SleepGoalService.java`, `SleepAnchorResolver.java`, `sleepHooks.ts`, `sleepStats.ts`, `SleepPage.tsx`, `SleepGoalSheet.tsx`, `timelineHooks.ts`. State the D-decisions in one line each where relevant (anchor single-source, ±15 band vs 45-min habit window, efficiency ≥85, enriched log for slice B).
- [ ] **Step 2: Update the cluster notes** — §0: slice A "implemented, PR pending"; §5 playbook step 1 → point at slice B brainstorm next.
- [ ] **Step 3: Lint**

Run: `node scripts/lint-docs.mjs`
Expected: PASS, no stale flags on the touched docs.

- [ ] **Step 4: Commit**

```bash
git add docs
git -c core.hooksPath=/dev/null commit -m "docs(sleep): feature docs + cluster notes for the sleep goal + day-anchor slice (mezo-dbsr)"
```

---

### Task 12: Final verification + PR

- [ ] **Step 1: Focused backend gate** (NOT the full suite — CI owns that):

Run: `cd backend && ./mvnw clean test -Dtest='SleepGoal*IT,SleepLog*IT,BiometricsContractIT,HabitTargetsSleepIT,Habit*IT' -DargLine=-Xmx3g`
Expected: PASS.

- [ ] **Step 2: Full frontend gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: PASS both modes.

- [ ] **Step 3: Contract drift self-check** (what CI runs):

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && git diff --exit-code -- ../api/openapi.yml src/data/_client/api.gen.ts`
Expected: exit 0 (no drift).

- [ ] **Step 4: Runtime-verify the UI** (memory: SDD+green tests once missed a layout deviation — LOOK at it): launch the mock FE per the project `verify` skill and screenshot `/me/sleep` — goal card arc, both rings, hero delta, the goal sheet open/derive/save loop, and `/me` EditGoalSheet without wake/bed rows. `/me/sleep` is NOT in the visual-golden set, so no golden refresh expected; if a golden screen (today/me/me-cel/insights-*) changed anyway, refresh goldens per the golden README.

- [ ] **Step 5: Push + PR + CI + merge** (worktree flow):

```bash
git push -u origin feat/sleep-anchor
gh pr create --title "feat(sleep): sleep goal + day-anchor — sleep_goal singleton, enriched sleep_log, SleepPage scores (mezo-dbsr)" --body "..."
# wait for CI green (full backend IT suite runs there), then:
gh pr merge --merge   # remote --no-ff equivalent; local main + bd reconcile deferred to the main checkout
```

- [ ] **Step 6: bd close** (from the MAIN checkout `~/MrKuhne/mezo`): `bd close mezo-dbsr` + `bd update mezo-dbsr --notes="..."` with the landing summary; `bd dolt push`.

---

## Self-Review (done at authoring)

- **Spec coverage:** D1/D2 → Tasks 1-3 (contract+entity+service derivation, band); D3 → Tasks 3/5/10 (singleton + HabitTargets + timeline/EditGoalSheet, mealsPerDay stays); D4 → Task 1/3 (both ends in response, one server-side derivation); D5 → Tasks 1/2/4 (7 nullable columns/fields, wire + entity + write path); D6 → Task 7 (`efficiencyPct` with in-bed preference + span fallback); D7 → Task 5 (habits re-center via port; the 45-min `wake-window-min` config is untouched); D8 → out of scope, model ready. Spec §3 ghost/no-migration → Task 3 service + refinement 6; §5 UI → Tasks 8/9; §7 tests → Tasks 3/4/5/6/7/8/9; §8 out-of-scope respected (goal wake/bed columns stay, only unread).
- **Type consistency:** `SleepAnchorPort.SleepAnchor(wake,bed)` consumed as `anchor.wake()/anchor.bed()` in Task 5; `SleepGoalPopulator.goal(...)` signatures match Task 5's IT; FE `SleepGoal`/`SleepGoalInput` names consistent across Tasks 6/7/8/9/10; query key `['sleepGoal']` everywhere; `deriveSleepTimes` signature identical in Tasks 6 (impl) and 8 (consumer).
- **Placeholders:** none — every code step carries complete code; the two "mirror the file's existing idiom" notes (Icon import, test render helper) are deliberate adapt-to-actual instructions, with the behavioral requirement fully specified.




