# Gamified Growth E2 — Growth Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the personal-growth loop: the full 8-skill LIFE band, a new `feature/activity` domain (free-text activity log + AI categorization with deterministic XP guardrails), GROWTH-slot activity-mode quests, computed traits (discipline/consistency) + `life[]` in the progression profile, and the FE trio (ActivityLogSheet + ActivityLogCard on Today, Me GrowthCard octagon).

**Architecture:** `feature/activity` modeled on the quest slice (switch-gated, contract-first, owned table). AI classification via the existing `CompanionLlm` cheap-tier port (FactExtractionService pattern: marker prompt + defensive JSON parse + `companion-fake` sentinel); the LLM only *proposes* — the server clamps XP into 5–25 and enforces per-skill (40) and per-day (100) caps (ADR 0010). Activity XP rides the idempotent `award(...)` tail with new source `ACTIVITY`. Activity-mode quests complete when a matching categorized activity lands (`QuestService.completeMatchingActivityQuest`, `source_activity_id`). Traits are computed on read in `getProfile` from the ledger + two new ports (`QuestLedgerSource` impl in quest, `TrainingCommitmentSource` impl in train — mirrors the `RobustnessSource` port pattern, keeps packages cycle-free).

**Tech Stack:** Spring Boot 4 / Java 21 / Maven; PostgreSQL + Liquibase; MapStruct + Lombok; Jackson 3 (`tools.jackson`); OpenAPI contract-first codegen; React 19 + TanStack Query + MSW/Vitest.

**Driving bd issue:** `mezo-jzca` (child of umbrella epic `mezo-52vz`). Spec: `docs/superpowers/specs/2026-07-11-gamified-growth-quests-design.md` (§3 LIFE taxonomy, §5 activity log, §7 UI, §8 data model). E1 groundwork already in main: `daily_quest.completion_mode/source_activity_id` columns, GROWTH slot + LIFE kind CHECKs, `skill_progress.skill_kind += LIFE`.

## Global Constraints

- Base package `io.mrkuhne.mezo`; new backend code in `feature/activity/{controller,service,repository,entity,dto,mapper,config}`; quest/progression/train edits stay in their packages.
- UUID PKs (`gen_random_uuid()`), `created_by` server-side, soft delete `@SQLDelete`/`@SQLRestriction`, jsonb via `@JdbcTypeCode(SqlTypes.JSON)` onto typed records.
- Contract-first: edit `api/feature/activity/activity.yml` + extend `quest.yml`/`progression.yml`/`train.yml` and register in `api/generate/merge.yml` BEFORE backend code; controllers implement generated `<Tag>Api`; never hand-write boundary DTOs.
- Config only under `mezo:` — new switch `mezo.feature.activity.enabled` (+ `FeaturesConfiguration.ACTIVITY_SWITCH` + `@ConditionalOnProperty`, no `matchIfMissing`); tunables in `@Validated ActivityProperties` (prefix `mezo.activity`); **never `@Value`**.
- Liquibase: ONE new script `202607112000_mezo-jzca_create_activity_log.sql` under `db/changelog/1.0.0/script/`, appended to `1.0.0/1.0.0_master.yml` AFTER `202607111300_mezo-df7q_create_daily_quest`; explicit constraint names; never modify released changesets.
- Errors: `SystemRuntimeErrorException` + `SystemMessage.error("CODE")` + `messages.properties` line; no hardcoded user text.
- Tests integration-first: `AbstractIntegrationTest`/`ApiIntegrationTest`, populators, `test{Method}_should{Result}_when{Condition}`, AssertJ only, no mocks/H2. LLM tests use `@ActiveProfiles("companion-fake")` + `[fake-activity:{…}]` sentinel (NEVER the network). New table → `ResetDatabase` TRUNCATE list; new populator → `@Import` in `AbstractIntegrationTest`.
- Maven: ALWAYS `./mvnw clean test`; on the 16 GB dev box ONLY focused tests `-Dtest=<Class> -DargLine=-Xmx3g`; the full suite is CI's job (self-PR gate).
- ArchUnit guards: no new package cycles (activity→{quest,progression,companion} is one-directional; FakeCompanionLlm uses a MIRROR literal for the activity marker, never imports `feature.activity`); controllers implement generated APIs; no `@Value`; no class-level `@Transactional`.
- Frontend: hooks only via `@/data/hooks` barrel; reads via `useDualQuery` (never mock seed as real-mode fallback); mutations split mock (`setQueryData`) / real (`invalidateQueries`); deep absolute `@/*` imports; colocated tests; both test modes green.
- UI copy: Hungarian, identity-vote phrasing, benefit-first; quest XP band 15–40 (catalog validation enforces); activity XP 5–25; no failure-state styling.
- Commits: conventional subject + `(mezo-jzca)`. In this worktree ALWAYS commit with `git -c core.hooksPath=/dev/null commit ...` (the bd pre-commit hook would stage `.beads/`). Run `bd` commands from the MAIN checkout (`/Users/daniel.kuhne/MrKuhne/mezo`), never from the worktree.
- Branch: `feat/quest-growth` (already cut from `origin/main` @ 53a6605b). Landing: push → self-PR → CI green → `gh pr merge --merge` (remote merge; local main + bd reconcile deferred to the main checkout).
- Out of scope (per spec §10): savings aggregate display (E3), adaptive difficulty (E3), companion flavor copy (E3), coins/shop (E4). The `amountHuf` extraction IS in scope (stored, shown per-entry), only the 30-day aggregate card stat is deferred.

## File Structure

**Contract:**
- Create: `api/feature/activity/activity.yml` (tag `Activity`: create + day read + categorize)
- Modify: `api/feature/quest/quest.yml` (QuestResponse += `completionMode`), `api/feature/progression/progression.yml` (profile += `life[]`, `traits`; new `ProfileTraits`), `api/feature/train/train.yml` (LevelUpResult.source enum += `ACTIVITY`), `api/generate/merge.yml` (+ activity input)

**Backend (new):**
- `backend/src/main/resources/db/changelog/1.0.0/script/202607112000_mezo-jzca_create_activity_log.sql`
- `.../feature/activity/entity/ActivityLogEntity.java` + `entity/ActivityExtract.java`
- `.../feature/activity/repository/ActivityLogRepository.java`
- `.../feature/activity/service/ActivityClassifier.java`, `service/ActivityService.java`
- `.../feature/activity/controller/ActivityController.java`, `mapper/ActivityMapper.java`, `config/ActivityProperties.java`
- `.../feature/progression/activity/ActivitySignal.java`
- `.../feature/progression/QuestLedgerSource.java`, `.../feature/progression/TrainingCommitmentSource.java`
- `.../feature/progression/service/TraitCalculator.java`
- `.../feature/quest/service/QuestLedgerAdapter.java`
- `.../feature/train/signal/TrainingCommitmentCalculator.java`
- Test: `support/populator/ActivityPopulator.java`, `feature/activity/ActivityLogEntityIT.java`, `feature/activity/ActivityClassifierIT.java`, `feature/activity/ActivityApiIT.java`, `feature/progression/ProgressionActivityIT.java`, `feature/progression/ProfileTraitsIT.java`, `feature/quest/QuestActivityCompletionIT.java`

**Backend (modified):**
- `ProgressionTaxonomy.java` (LIFE → 8), `ProgressionService.java` (`SOURCE_ACTIVITY`, `applyActivity`, `moveActivityXp`, `getProfile` += life/traits), `LevelUpEventRepository.java` (occurredAt projection)
- `QuestCatalog.java` (QuestDef += `mode`), `content/quest-catalog.json` (mode on all + 7 GROWTH entries), `QuestSelector.java` (SLOTS incl. GROWTH, mode from def), `QuestEvaluator.java` (`own_recipe_meal`), `QuestService.java` (DERIVED guard + `completeMatchingActivityQuest`), `QuestDisplay.java` (2 labels)
- `MealItemRepository.java` (exists finder), `FeaturesConfiguration.java` (`ACTIVITY_SWITCH`), `FakeCompanionLlm.java` (activity marker mirror + sentinel), `application.yml`, `messages.properties`
- Test infra: `ResetDatabase.java`, `AbstractIntegrationTest.java`, `QuestPopulator.java` (+activityQuest), `QuestSelectorIT.java` + `QuestApiIT.java` (counts 2→3)

**Frontend (new):** `data/activity/{activityApi,activityMock,activityHooks}.ts` (+tests), `features/today/sheets/ActivityLogSheet.tsx` (+test), `features/today/components/ActivityLogCard.tsx` (+test), `features/me/components/GrowthCard.tsx` (+test)

**Frontend (modified):** `data/types.ts`, `data/hooks.ts`, `data/_client/api.gen.ts` (regen), `data/quest/questMock.ts` + `questApi.ts` (completionMode), `data/progression/progressionMock.ts`, `features/progression/logic/levelUpMeta.ts` (LIFE band 8 + ACTIVITY source), `features/today/components/DailyQuestsCard.tsx` (+test), `features/today/pages/TodayPage.tsx`, `features/me/pages/ProfilePage.tsx`, `test/msw/handlers.ts`

**Docs:** `docs/features/growth.md` (major), `docs/features/me.md`, `docs/features/today.md`, `docs/milestones/roadmap.md`

---

### Task 1: Plan commit + API contract (activity fragment + 3 extensions + regen)

**Files:**
- Create: `api/feature/activity/activity.yml`
- Modify: `api/feature/quest/quest.yml`, `api/feature/progression/progression.yml`, `api/feature/train/train.yml`, `api/generate/merge.yml`; regen `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces (backend, regenerated during `./mvnw clean test`): `io.mrkuhne.mezo.api.controller.ActivityApi` with `createActivity(ActivityCreateRequest)` → `ActivityWriteResponse`, `getActivityDay(LocalDate date)` → `List<ActivityResponse>`, `categorizeActivity(UUID id, ActivityCategoryRequest)` → `ActivityWriteResponse`; api.dto models `ActivityResponse`, `ActivityWriteResponse`, `ActivityCreateRequest`, `ActivityCategoryRequest`, `ProfileTraits`; `ProgressionProfileResponse` gains `getLife()`/`getTraits()`; `QuestResponse` gains `getCompletionMode()`; `api.dto.LevelUpResult.SourceEnum` gains `ACTIVITY`.
- Produces (FE): `paths['/api/activity']`, `paths['/api/activity/day/{date}']`, `paths['/api/activity/{id}/category']` in `api.gen.ts`.

- [ ] **Step 1: Commit this plan file** (it is already on the branch working tree):

```bash
git add docs/superpowers/plans/2026-07-11-gamified-growth-e2-growth-layer.md
git -c core.hooksPath=/dev/null commit -m "docs(plans): E2 growth-layer implementation plan (mezo-jzca)"
```

- [ ] **Step 2: Write `api/feature/activity/activity.yml`**

```yaml
openapi: 3.0.3
info: { title: mezo activity fragment, version: 1.0.0 }
paths:
  /api/activity:
    post:
      tags: [Activity]
      operationId: createActivity
      summary: Log a free-text life activity; AI categorizes and routes clamped XP (Activity log)
      description: >-
        Persists the entry, classifies it with the companion cheap-tier LLM (when the companion
        switch is on), clamps the XP suggestion into the deterministic band and daily caps, awards
        XP through progression (source ACTIVITY), and completes a matching open activity-mode
        quest of the same day (its XP on top). Low confidence (< threshold) stores the entry
        uncategorized (no XP yet) — the client prompts for a manual category.
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ActivityCreateRequest' }
      responses:
        '200':
          description: The stored entry + any completed quest + level-up payloads
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ActivityWriteResponse' }
        '400':
          description: Blank text
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/activity/day/{date}:
    get:
      tags: [Activity]
      operationId: getActivityDay
      summary: The day's activity-log entries, newest first (Activity log)
      parameters:
        - name: date
          in: path
          required: true
          schema: { type: string, format: date }
      responses:
        '200':
          description: Entries of the day (empty array when none — never a 404)
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/ActivityResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/activity/{id}/category:
    post:
      tags: [Activity]
      operationId: categorizeActivity
      summary: Set or override the entry's LIFE skill (grants XP on first categorization) (Activity log)
      description: >-
        Manual categorization of an uncategorized entry grants the stored (clamped) XP suggestion
        within the daily caps; overriding an already-categorized entry MOVES the awarded XP
        between skill rows. Either way the matching open activity-mode quest of the entry's day
        completes. categorizedBy becomes USER.
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ActivityCategoryRequest' }
      responses:
        '200':
          description: The updated entry + any completed quest + level-up payloads
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ActivityWriteResponse' }
        '400':
          description: Unknown LIFE skill key
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Entry not found (or owned by someone else)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    ActivityCreateRequest:
      type: object
      required: [text]
      properties:
        text: { type: string, maxLength: 500, description: Free-text HU activity description }
        occurredOn: { type: string, format: date, description: Defaults to today }
    ActivityCategoryRequest:
      type: object
      required: [skillKey]
      properties:
        skillKey: { type: string, description: One of the 8 LIFE skill keys }
    ActivityResponse:
      type: object
      required: [id, occurredOn, text, xpAwarded]
      properties:
        id: { type: string, format: uuid }
        occurredOn: { type: string, format: date }
        text: { type: string }
        skillKey: { type: string, nullable: true, description: LIFE skill; null = uncategorized }
        confidence: { type: number, nullable: true, description: AI confidence 0..1 }
        xpAwarded: { type: integer, format: int32, description: Clamped + capped XP actually granted }
        durationMin: { type: integer, format: int32, nullable: true, description: AI-extracted duration }
        amountHuf: { type: integer, format: int64, nullable: true, description: AI-extracted amount (financial) }
        categorizedBy: { type: string, nullable: true, description: 'AI | USER' }
        createdAt: { type: string, format: date-time }
    ActivityWriteResponse:
      type: object
      required: [entry, levelUps]
      properties:
        entry: { $ref: '#/components/schemas/ActivityResponse' }
        completedQuest:
          allOf: [{ $ref: '#/components/schemas/QuestResponse' }]
          nullable: true
          description: The activity-mode quest this write completed, if any
        levelUps:
          type: array
          description: 0–2 payloads — the activity award and/or the completed quest's award
          items: { $ref: '#/components/schemas/LevelUpResult' }
```

- [ ] **Step 3: Extend the three existing fragments**

In `api/feature/quest/quest.yml`, inside `QuestResponse.properties` after `status`, add; and append `completionMode` to the `required` list:

```yaml
        completionMode: { type: string, description: 'DERIVED | ACTIVITY (activity-mode completes via a matching activity-log entry)' }
```

In `api/feature/progression/progression.yml`: in `ProgressionProfileResponse` append `life` and `traits` to `required` and add the properties + new schema; update `SkillLevel.kind` description to `'ATHLETIC|MUSCLE|LIFE'`:

```yaml
        life:
          type: array
          description: All 8 LIFE skills in taxonomy order (missing row → level 1, 0 XP)
          items: { $ref: '#/components/schemas/SkillLevel' }
        traits:
          $ref: '#/components/schemas/ProfileTraits'
```

```yaml
    ProfileTraits:
      type: object
      description: Computed behavior traits (ADR 0010 — never self-claimed)
      required: [consistencyWeeks]
      properties:
        disciplinePct:
          type: integer
          nullable: true
          description: 28-day commitment completion ratio 0–100 (planned sessions done + quests completed, blended); null when no commitments in the window
        consistencyWeeks:
          type: integer
          description: Current streak of consecutive weeks with >= 4 active days (any XP-earning action)
```

In `api/feature/train/train.yml`, `LevelUpResult.source`: `enum: [GYM, SPORT, RUN, QUEST]` → `enum: [GYM, SPORT, RUN, QUEST, ACTIVITY]`.

- [ ] **Step 4: Register + merge + FE regen**

In `api/generate/merge.yml` append after the quest line:

```yaml
  - inputFile: ../feature/activity/activity.yml
```

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```
Expected: `api/openapi.yml` gains the three activity paths; `api.gen.ts` gains `ActivityResponse`/`ActivityWriteResponse` schemas, `QuestResponse.completionMode`, `ProgressionProfileResponse.life/traits`, `LevelUpResult.source` incl. `ACTIVITY`.

- [ ] **Step 5: Fix FE compile fallout NOW** (questMock lacks `completionMode`, which is now required on the wire type only — the domain type changes in Task 8; nothing should break yet because `DailyQuest` is hand-defined). Run:

```bash
cd frontend && pnpm build
```
Expected: PASS (wire-type additions are additive). If `toQuest` in `src/data/quest/questApi.ts` errors on the new required field, map it: `completionMode: (w.completionMode ?? 'DERIVED') as QuestCompletionMode` — but the full domain-type change is Task 8; here only keep the build green.

- [ ] **Step 6: Commit**

```bash
git add api frontend/src/data/_client/api.gen.ts frontend/src/data/quest 2>/dev/null || git add api frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(api): activity contract + profile life/traits + quest completionMode + ACTIVITY source (mezo-jzca)"
```

---

### Task 2: Migration + ActivityLogEntity + repository + test-infra wiring

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607112000_mezo-jzca_create_activity_log.sql`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/activity/entity/ActivityLogEntity.java`, `.../entity/ActivityExtract.java`, `.../repository/ActivityLogRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/ActivityPopulator.java`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`, `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`, `.../support/AbstractIntegrationTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/activity/ActivityLogEntityIT.java`

**Interfaces:**
- Produces: `ActivityLogEntity` (constants `BY_AI="AI"`, `BY_USER="USER"`; fields `occurredOn, text, skillKey, confidence, xpAwarded, xpSuggested, extracted, categorizedBy`), `record ActivityExtract(Integer durationMin, Long amountHuf)`, `ActivityLogRepository.findByCreatedByAndOccurredOnOrderByCreatedAtDesc / findByIdAndCreatedBy`, `ActivityPopulator.activity(UUID createdBy, LocalDate day, String text, String skillKey, int xpAwarded, String categorizedBy)`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.activity;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** activity_log DDL + jsonb extract envelope + owner-scoped reads (mezo-jzca). */
class ActivityLogEntityIT extends AbstractIntegrationTest {

    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ActivityLogRepository repository;

    @Test
    void testSave_shouldRoundTripJsonbExtract_whenPersisted() {
        UUID owner = userPopulator.createUser("act-a@test.hu").getId();
        ActivityLogEntity e = activityPopulator.activity(owner, LocalDate.of(2026, 7, 11),
            "Olvastam 30 percet", "learning", 15, ActivityLogEntity.BY_AI);

        ActivityLogEntity found = repository.findByIdAndCreatedBy(e.getId(), owner).orElseThrow();
        assertThat(found.getExtracted().durationMin()).isEqualTo(30);
        assertThat(found.getSkillKey()).isEqualTo("learning");
        assertThat(found.getXpAwarded()).isEqualTo(15);
    }

    @Test
    void testFindDay_shouldReturnOwnRowsNewestFirst_whenTwoUsersLog() {
        UUID a = userPopulator.createUser("act-b@test.hu").getId();
        UUID b = userPopulator.createUser("act-c@test.hu").getId();
        LocalDate d = LocalDate.of(2026, 7, 11);
        activityPopulator.activity(a, d, "Meditáltam", "mindfulness", 10, ActivityLogEntity.BY_AI);
        activityPopulator.activity(b, d, "Főztem", "cooking", 10, ActivityLogEntity.BY_USER);

        assertThat(repository.findByCreatedByAndOccurredOnOrderByCreatedAtDesc(a, d))
            .hasSize(1)
            .allSatisfy(r -> assertThat(r.getText()).isEqualTo("Meditáltam"));
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=ActivityLogEntityIT -DargLine=-Xmx3g`
Expected: FAIL — compilation error (`ActivityLogEntity` does not exist).

- [ ] **Step 3: Write the migration** — `202607112000_mezo-jzca_create_activity_log.sql`:

```sql
-- Activity log (bd mezo-jzca, E2 of gamified growth mezo-52vz): free-text life activities with
-- AI categorization onto the LIFE skill band. skill_key NULL = uncategorized (low-confidence AI
-- answer or companion off) — XP is granted at categorization time. xp_suggested stores the
-- clamped AI suggestion so a later manual categorization grants a deterministic amount.
-- Also relaxes the released level_up_event source CHECK additively: += ACTIVITY (activity XP
-- rides the same idempotent award tail; ADR 0010 consequence).

alter table level_up_event drop constraint ck_level_up_event_source_type;
alter table level_up_event add constraint ck_level_up_event_source_type
    check (source_type in ('GYM', 'SPORT', 'RUN', 'QUEST', 'ACTIVITY'));

create table activity_log (
    id             uuid         not null default gen_random_uuid(),
    created_by     uuid         not null,
    is_deleted     boolean      not null default false,
    created_at     timestamptz  not null default now(),
    occurred_on    date         not null,
    text           text         not null,
    skill_key      varchar(40),
    confidence     numeric(4,3),
    xp_awarded     integer      not null default 0,
    xp_suggested   integer      not null default 0,
    extracted      jsonb,
    categorized_by varchar(6),
    constraint pk_activity_log_id primary key (id),
    constraint fk_activity_log_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_activity_log_categorized_by check (categorized_by in ('AI', 'USER')),
    constraint ck_activity_log_xp check (xp_awarded >= 0 and xp_suggested >= 0)
);

create index idx_activity_log_user_day on activity_log (created_by, occurred_on) where is_deleted = false;
```

- [ ] **Step 4: Register the changeset** — append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (after the `202607111300_mezo-df7q_create_daily_quest` block):

```yaml
  - changeSet:
      id: "1.0.0:202607112000_mezo-jzca_create_activity_log"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607112000_mezo-jzca_create_activity_log.sql
```

- [ ] **Step 5: Entity + envelope + repository**

`ActivityExtract.java`:
```java
package io.mrkuhne.mezo.feature.activity.entity;

/** Typed jsonb envelope of AI-extracted structured facts (spec §5: duration, HUF amount). */
public record ActivityExtract(Integer durationMin, Long amountHuf) {
}
```

`ActivityLogEntity.java`:
```java
package io.mrkuhne.mezo.feature.activity.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One free-text life-activity entry (gamified growth E2, bd mezo-jzca). The AI proposes a LIFE
 * skill + XP; the server clamps and caps deterministically (ADR 0010 — the LLM proposes, the
 * server disposes). skillKey null = uncategorized: no XP yet, the client prompts for a manual
 * category; a later categorization grants xpSuggested within the day's remaining caps.
 */
@Getter
@Setter
@Entity
@Table(name = "activity_log")
@SQLDelete(sql = "update activity_log set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ActivityLogEntity extends OwnedEntity {

    public static final String BY_AI = "AI";
    public static final String BY_USER = "USER";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "occurred_on", nullable = false)
    private LocalDate occurredOn;

    @NotNull
    @Column(nullable = false)
    private String text;

    @Column(name = "skill_key")
    private String skillKey;

    @Column
    private BigDecimal confidence;

    @NotNull
    @Column(name = "xp_awarded", nullable = false)
    private Integer xpAwarded = 0;

    @NotNull
    @Column(name = "xp_suggested", nullable = false)
    private Integer xpSuggested = 0;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column
    private ActivityExtract extracted;

    @Column(name = "categorized_by")
    private String categorizedBy;
}
```

`ActivityLogRepository.java`:
```java
package io.mrkuhne.mezo.feature.activity.repository;

import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityLogRepository extends JpaRepository<ActivityLogEntity, UUID> {

    /** Day read (newest first) — also the cap-computation input (xpAwarded sums in code). */
    List<ActivityLogEntity> findByCreatedByAndOccurredOnOrderByCreatedAtDesc(UUID createdBy, LocalDate occurredOn);

    /** Owned lookup for the categorize path. */
    Optional<ActivityLogEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);
}
```

- [ ] **Step 6: Populator + reset wiring**

`ActivityPopulator.java`:
```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.activity.entity.ActivityExtract;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code activity_log} rows (gamified growth E2, bd mezo-jzca). */
@TestComponent
@RequiredArgsConstructor
public class ActivityPopulator {

    private final ActivityLogRepository repository;

    public ActivityLogEntity activity(UUID createdBy, LocalDate day, String text,
                                      String skillKey, int xpAwarded, String categorizedBy) {
        ActivityLogEntity e = new ActivityLogEntity();
        e.setCreatedBy(createdBy);
        e.setOccurredOn(day);
        e.setText(text);
        e.setSkillKey(skillKey);
        e.setConfidence(skillKey != null ? new BigDecimal("0.900") : null);
        e.setXpAwarded(xpAwarded);
        e.setXpSuggested(Math.max(xpAwarded, 10));
        e.setExtracted(new ActivityExtract(30, null));
        e.setCategorizedBy(categorizedBy);
        return repository.saveAndFlush(e);
    }
}
```

In `ResetDatabase.resetExceptMasterData()` prepend `activity_log, ` to the TRUNCATE list (before `daily_quest,`). In `AbstractIntegrationTest` add `ActivityPopulator.class` to the `@Import({...})` list (after `QuestPopulator.class`).

- [ ] **Step 7: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=ActivityLogEntityIT -DargLine=-Xmx3g`
Expected: PASS (2 tests) — proves the migration applies and the ACTIVITY CHECK relax doesn't break existing changesets.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/activity backend/src/test/java/io/mrkuhne/mezo/support backend/src/test/java/io/mrkuhne/mezo/feature/activity
git -c core.hooksPath=/dev/null commit -m "feat(activity): activity_log table + entity/repo + ACTIVITY source CHECK relax (mezo-jzca)"
```

---

### Task 3: LIFE taxonomy (8 skills) + `applyActivity` + `moveActivityXp`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/activity/ActivitySignal.java`
- Modify: `.../feature/progression/ProgressionTaxonomy.java`, `.../feature/progression/service/ProgressionService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionActivityIT.java`

**Interfaces:**
- Consumes: private idempotent `award(...)` tail (unchanged).
- Produces (consumed by Task 7): `public LevelUpResult applyActivity(UUID createdBy, ActivitySignal signal)` (kind fixed `LIFE`); `record ActivitySignal(UUID activityId, String skillKey, int xp, String label)`; `public void moveActivityXp(UUID createdBy, String fromSkillKey, String toSkillKey, long xp)`; `ProgressionTaxonomy.LIFE` = 8 keys in octagon order.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.activity.ActivitySignal;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Activity XP rides the idempotent award tail (source ACTIVITY); overrides move XP between rows. */
class ProgressionActivityIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testApplyActivity_shouldCreateLifeRowAndBeIdempotent_whenAppliedTwice() {
        UUID owner = userPopulator.createUser("act-xp@test.hu").getId();
        ActivitySignal signal = new ActivitySignal(UUID.randomUUID(), "learning", 15, "Olvastam 30 percet");

        LevelUpResult first = progressionService.applyActivity(owner, signal);
        LevelUpResult second = progressionService.applyActivity(owner, signal);

        assertThat(first.source()).isEqualTo("ACTIVITY");
        assertThat(first.gains()).singleElement().satisfies(g -> {
            assertThat(g.skillKey()).isEqualTo("learning");
            assertThat(g.kind()).isEqualTo("LIFE");
        });
        assertThat(second.totalXp()).isEqualTo(first.totalXp()); // stored payload, no double award

        var row = skillProgressRepository.findByCreatedByAndSkillKey(owner, "learning").orElseThrow();
        assertThat(row.getCumulativeXp()).isEqualTo(15);
        assertThat(row.getSkillKind()).isEqualTo("LIFE");
    }

    @Test
    void testMoveActivityXp_shouldShiftCumulativeXp_whenOverridingCategory() {
        UUID owner = userPopulator.createUser("act-move@test.hu").getId();
        progressionService.applyActivity(owner,
            new ActivitySignal(UUID.randomUUID(), "learning", 20, "Teszt"));

        progressionService.moveActivityXp(owner, "learning", "mindset", 20);

        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(owner, "learning").orElseThrow()
            .getCumulativeXp()).isZero();
        var target = skillProgressRepository.findByCreatedByAndSkillKey(owner, "mindset").orElseThrow();
        assertThat(target.getCumulativeXp()).isEqualTo(20);
        assertThat(target.getSkillKind()).isEqualTo("LIFE");
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionActivityIT -DargLine=-Xmx3g`
Expected: FAIL — compilation error (`ActivitySignal` / `applyActivity` do not exist).

- [ ] **Step 3: Implement**

`ActivitySignal.java`:
```java
package io.mrkuhne.mezo.feature.progression.activity;

import java.util.UUID;

/** Input of the activity XP grant: one categorized activity-log entry routes xp to one LIFE skill. */
public record ActivitySignal(
    UUID activityId,
    String skillKey,   // LIFE taxonomy key
    int xp,            // already clamped + capped by ActivityService (ADR 0010 guardrails)
    String label       // truncated entry text — shown as workoutLabel in the level-up overlay
) {}
```

In `ProgressionTaxonomy.java` replace the LIFE list:
```java
    /** LIFE skills (gamified growth E2, spec §3) — octagon order on the Me GrowthCard. */
    public static final List<String> LIFE = List.of(
        "mindfulness", "mindset", "cooking", "financial",
        "productivity", "learning", "connection", "recovery");
```

In `ProgressionService.java` add next to `SOURCE_QUEST`:
```java
    private static final String SOURCE_ACTIVITY = "ACTIVITY";
```
and after `applyQuest` (import `io.mrkuhne.mezo.feature.progression.activity.ActivitySignal`):
```java
    /** Categorized activity → single-LIFE-skill XP through the shared idempotent tail (source ACTIVITY). */
    @Transactional
    public LevelUpResult applyActivity(UUID createdBy, ActivitySignal signal) {
        Map<String, Long> deltas = new LinkedHashMap<>();
        Map<String, String> kinds = new LinkedHashMap<>();
        if (signal.xp() > 0) {
            deltas.put(signal.skillKey(), (long) signal.xp());
            kinds.put(signal.skillKey(), "LIFE");
        }
        return award(createdBy, SOURCE_ACTIVITY, signal.activityId(), deltas, kinds,
            signal.label(), null, null);
    }

    /**
     * Category override: MOVE already-awarded activity XP between LIFE rows (spec §5 — the
     * override grants/moves the XP). Direct row adjustment, no new level_up_event: the original
     * event stays as the grant's ledger entry (its payload keeps the old skill — acceptable
     * correction-history trade-off, documented in docs/features/growth.md).
     */
    @Transactional
    public void moveActivityXp(UUID createdBy, String fromSkillKey, String toSkillKey, long xp) {
        skillProgressRepository.findByCreatedByAndSkillKey(createdBy, fromSkillKey).ifPresent(from -> {
            from.setCumulativeXp(Math.max(0, from.getCumulativeXp() - xp));
            from.setCurrentLevel(curve.levelFor(from.getCumulativeXp()));
            skillProgressRepository.save(from);
        });
        SkillProgressEntity to = skillProgressRepository
            .findByCreatedByAndSkillKey(createdBy, toSkillKey).orElseGet(() -> {
                SkillProgressEntity r = new SkillProgressEntity();
                r.setCreatedBy(createdBy);
                r.setSkillKey(toSkillKey);
                r.setSkillKind("LIFE");
                return r;
            });
        to.setCumulativeXp(to.getCumulativeXp() + xp);
        to.setCurrentLevel(curve.levelFor(to.getCumulativeXp()));
        skillProgressRepository.save(to);
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionActivityIT -DargLine=-Xmx3g`
Expected: PASS. (The generated `LevelUpResultMapper` handles source ACTIVITY because Task 1 extended the enum.)

- [ ] **Step 5: Guard progression + quest suites (focused)**

Run: `cd backend && ./mvnw clean test -Dtest='Progression*,Quest*' -DargLine=-Xmx3g`
Expected: PASS — the LIFE list expansion must not disturb existing tests (they only asserted `recovery`, which is still present).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression backend/src/test/java/io/mrkuhne/mezo/feature/progression
git -c core.hooksPath=/dev/null commit -m "feat(progression): full LIFE band + applyActivity (ACTIVITY source) + XP move on override (mezo-jzca)"
```

---

### Task 4: Profile `life[]` + computed traits (ports + calculator)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/QuestLedgerSource.java`, `.../feature/progression/TrainingCommitmentSource.java`, `.../feature/progression/service/TraitCalculator.java`
- Create: `.../feature/quest/service/QuestLedgerAdapter.java`, `.../feature/train/signal/TrainingCommitmentCalculator.java`
- Modify: `.../feature/progression/service/ProgressionService.java` (getProfile), `.../feature/progression/repository/LevelUpEventRepository.java`, `.../feature/quest/repository/DailyQuestRepository.java`
- Modify (test infra): `backend/src/test/java/io/mrkuhne/mezo/support/populator/LevelUpEventPopulator.java` (occurredAt override)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProfileTraitsIT.java`

**Interfaces:**
- Produces: `getProfile(...)` response now carries `life` (8 `SkillLevel`s, taxonomy order) + `traits` (`ProfileTraits{disciplinePct nullable, consistencyWeeks}`).
- Ports (mirror `RobustnessSource` — impls point INTO progression, no cycle):
  - `QuestLedgerSource.closedQuestStats(UUID, LocalDate from, LocalDate to)` → `QuestLedgerSource.Stats(int completed, int expired)`; impl `QuestLedgerAdapter` in feature/quest (gated `QUEST_SWITCH`), consumed via `ObjectProvider`.
  - `TrainingCommitmentSource.commitmentStats(UUID, LocalDate from, LocalDate to)` → `TrainingCommitmentSource.Stats(int planned, int done)`; impl `TrainingCommitmentCalculator` in feature/train (unconditional bean).
- `LevelUpEventRepository` gains `List<Instant> findOccurredAtSince(UUID createdBy, Instant from)` (JPQL projection).
- `DailyQuestRepository` gains `int countByCreatedByAndStatusAndQuestDateBetween(UUID, String, LocalDate, LocalDate)`.

- [ ] **Step 1: Extend `LevelUpEventPopulator` with an occurredAt override** (`@CreationTimestamp` stamps on insert, so back-dated events need a direct update; inject `org.springframework.jdbc.core.JdbcTemplate` as a second `final` field):

```java
    /** Back-dated event for trait/streak tests — @CreationTimestamp forbids setting occurredAt on insert. */
    public LevelUpEventEntity createEventAt(UUID createdBy, String sourceType, UUID sourceRefId,
        LevelUpResult payload, java.time.Instant occurredAt) {
        LevelUpEventEntity e = createEvent(createdBy, sourceType, sourceRefId, payload);
        jdbcTemplate.update("update level_up_event set occurred_at = ? where id = ?",
            java.sql.Timestamp.from(occurredAt), e.getId());
        return e;
    }
```
Also add a minimal payload helper if none exists nearby — construct inline in the test instead: `new LevelUpResult("GYM", null, null, null, 10, List.of(), List.of(), List.of(), new LevelUpResult.Robustness(0, 0))`.

- [ ] **Step 2: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ProgressionProfileResponse;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LevelUpEventPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Profile life[] band + computed traits (discipline 28d ratio, consistency active-week streak). */
class ProfileTraitsIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private LevelUpEventPopulator levelUpEventPopulator;
    @Autowired private UserPopulator userPopulator;

    private static LevelUpResult payload() {
        return new LevelUpResult("GYM", null, null, null, 10,
            List.of(), List.of(), List.of(), new LevelUpResult.Robustness(0, 0));
    }

    @Test
    void testGetProfile_shouldListAllEightLifeSkillsInTaxonomyOrder_whenNoRows() {
        UUID owner = userPopulator.createUser("life-a@test.hu").getId();

        ProgressionProfileResponse profile = progressionService.getProfile(owner);

        assertThat(profile.getLife()).extracting(s -> s.getSkillKey())
            .containsExactly("mindfulness", "mindset", "cooking", "financial",
                "productivity", "learning", "connection", "recovery");
        assertThat(profile.getLife()).allSatisfy(s -> {
            assertThat(s.getKind()).isEqualTo("LIFE");
            assertThat(s.getLevel()).isEqualTo(1);
        });
        assertThat(profile.getTraits().getDisciplinePct()).isNull(); // no commitments in window
        assertThat(profile.getTraits().getConsistencyWeeks()).isZero();
    }

    @Test
    void testGetProfile_shouldComputeDisciplineFromQuestLedger_whenQuestsClosedInWindow() {
        UUID owner = userPopulator.createUser("life-b@test.hu").getId();
        LocalDate d = LocalDate.now().minusDays(3);
        // 3 completed + 1 expired = 75% quest ratio; no active meso → no training component
        questPopulator.quest(owner, d, DailyQuestEntity.SLOT_FUELBIO, "bio_water", "recovery",
            "LIFE", "water_target", new java.math.BigDecimal("2500"), 15, DailyQuestEntity.STATUS_COMPLETED);
        questPopulator.quest(owner, d.minusDays(1), DailyQuestEntity.SLOT_FUELBIO, "bio_sleep", "recovery",
            "LIFE", "sleep_target", new java.math.BigDecimal("7.5"), 25, DailyQuestEntity.STATUS_COMPLETED);
        questPopulator.quest(owner, d.minusDays(2), DailyQuestEntity.SLOT_BODY, "body_rest_sleep", "recovery",
            "LIFE", "sleep_target", new java.math.BigDecimal("7.5"), 20, DailyQuestEntity.STATUS_COMPLETED);
        questPopulator.quest(owner, d.minusDays(4), DailyQuestEntity.SLOT_FUELBIO, "bio_weight_log", "recovery",
            "LIFE", "weight_logged", null, 15, DailyQuestEntity.STATUS_EXPIRED);

        ProgressionProfileResponse profile = progressionService.getProfile(owner);

        assertThat(profile.getTraits().getDisciplinePct()).isEqualTo(75);
    }

    @Test
    void testGetProfile_shouldCountConsecutiveActiveWeeks_whenFourActiveDaysPerWeek() {
        UUID owner = userPopulator.createUser("life-c@test.hu").getId();
        ZoneId zone = ZoneId.systemDefault();
        LocalDate monday = LocalDate.now().with(java.time.DayOfWeek.MONDAY);
        // previous week: 4 active days; the week before: 4 active days; current week: 1 (not counted)
        for (int w = 1; w <= 2; w++) {
            for (int i = 0; i < 4; i++) {
                LocalDate day = monday.minusWeeks(w).plusDays(i);
                levelUpEventPopulator.createEventAt(owner, "GYM", UUID.randomUUID(), payload(),
                    day.atStartOfDay(zone).toInstant().plusSeconds(3600));
            }
        }
        levelUpEventPopulator.createEventAt(owner, "GYM", UUID.randomUUID(), payload(),
            monday.atStartOfDay(zone).toInstant().plusSeconds(3600));

        ProgressionProfileResponse profile = progressionService.getProfile(owner);

        assertThat(profile.getTraits().getConsistencyWeeks()).isEqualTo(2);
    }
}
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=ProfileTraitsIT -DargLine=-Xmx3g`
Expected: FAIL — `getLife()`/`getTraits()` unpopulated (compile passes — the DTO fields exist since Task 1 — but assertions fail on null).

- [ ] **Step 4: Ports + finders**

`QuestLedgerSource.java` (in `feature/progression/`, javadoc mirrors `RobustnessSource`):
```java
package io.mrkuhne.mezo.feature.progression;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Port for the quest half of the discipline trait: progression only needs the closed-quest
 * counts; HOW they are stored belongs to feature/quest, which implements this
 * ({@code feature/quest/service/QuestLedgerAdapter}) — dependency stays quest → progression,
 * never back (feature_slices_are_cycle_free). Bean exists only when the quest switch is on;
 * consume via ObjectProvider.
 */
public interface QuestLedgerSource {

    record Stats(int completed, int expired) {}

    /** Terminal (completed/expired) quests in [from, to] — rerolled/offered rows excluded. */
    Stats closedQuestStats(UUID createdBy, LocalDate from, LocalDate to);
}
```

`TrainingCommitmentSource.java`:
```java
package io.mrkuhne.mezo.feature.progression;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Port for the training half of the discipline trait (planned vs done sessions in a window).
 * Implemented by the train slice ({@code feature/train/signal/TrainingCommitmentCalculator}) —
 * same one-directional pattern as {@link RobustnessSource}.
 */
public interface TrainingCommitmentSource {

    record Stats(int planned, int done) {}

    /** planned = window dates matching the active meso's template weekdays; done = distinct done-instance dates. */
    Stats commitmentStats(UUID createdBy, LocalDate from, LocalDate to);
}
```

In `LevelUpEventRepository.java` add (imports: `java.time.Instant`, `java.util.List`, `org.springframework.data.jpa.repository.Query`, `org.springframework.data.repository.query.Param`):
```java
    /** Active-day feed of the consistency trait: every award timestamp since the horizon. */
    @Query("select e.occurredAt from LevelUpEventEntity e where e.createdBy = :createdBy and e.occurredAt >= :from")
    List<Instant> findOccurredAtSince(@Param("createdBy") UUID createdBy, @Param("from") Instant from);
```

In `DailyQuestRepository.java` add:
```java
    /** Discipline-trait window count (per terminal status). */
    int countByCreatedByAndStatusAndQuestDateBetween(UUID createdBy, String status, LocalDate from, LocalDate to);
```

`QuestLedgerAdapter.java`:
```java
package io.mrkuhne.mezo.feature.quest.service;

import io.mrkuhne.mezo.feature.progression.QuestLedgerSource;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Quest side of the discipline trait — see {@link QuestLedgerSource}. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.QUEST_SWITCH, havingValue = "true")
public class QuestLedgerAdapter implements QuestLedgerSource {

    private final DailyQuestRepository repository;

    @Override
    public Stats closedQuestStats(UUID createdBy, LocalDate from, LocalDate to) {
        return new Stats(
            repository.countByCreatedByAndStatusAndQuestDateBetween(
                createdBy, DailyQuestEntity.STATUS_COMPLETED, from, to),
            repository.countByCreatedByAndStatusAndQuestDateBetween(
                createdBy, DailyQuestEntity.STATUS_EXPIRED, from, to));
    }
}
```

`TrainingCommitmentCalculator.java` (in `feature/train/signal/`, next to `TrainingStreakCalculator`; reuse `WorkoutService.findPlannedTemplateForDate` for the weekday semantics but compute set-wise — inject `MesocycleRepository` + `WorkoutSessionRepository` the way `WorkoutService` does; copy its `HU_DAY_LABELS` access or replicate the label list if private — if `HU_DAY_LABELS` is private in `WorkoutService`, promote it to `public static final` there):
```java
package io.mrkuhne.mezo.feature.train.signal;

import io.mrkuhne.mezo.feature.progression.TrainingCommitmentSource;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Training side of the discipline trait — see {@link TrainingCommitmentSource}. */
@Component
@RequiredArgsConstructor
public class TrainingCommitmentCalculator implements TrainingCommitmentSource {

    private final MesocycleRepository mesocycleRepository;
    private final WorkoutSessionRepository workoutSessionRepository;

    @Override
    public Stats commitmentStats(UUID createdBy, LocalDate from, LocalDate to) {
        MesocycleEntity activeMeso = mesocycleRepository
            .findByCreatedByAndStatusAndDeletedFalse(createdBy, "active")
            .stream().findFirst().orElse(null);
        if (activeMeso == null) {
            return new Stats(0, 0);
        }
        Set<String> plannedLabels = new HashSet<>();
        workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(activeMeso.getId()))
            .stream()
            .filter(s -> s.getTemplateSessionId() == null)
            .forEach(s -> plannedLabels.add(s.getDayLabel()));
        int planned = 0;
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            if (plannedLabels.contains(WorkoutService.HU_DAY_LABELS.get(d.getDayOfWeek().getValue() - 1))) {
                planned++;
            }
        }
        int done = (int) workoutSessionRepository.findDoneInstanceDates(createdBy, from, to)
            .stream().distinct().count();
        return new Stats(planned, done);
    }
}
```

- [ ] **Step 5: `TraitCalculator` + `getProfile` wiring**

`TraitCalculator.java`:
```java
package io.mrkuhne.mezo.feature.progression.service;

import io.mrkuhne.mezo.api.dto.ProfileTraits;
import io.mrkuhne.mezo.feature.progression.QuestLedgerSource;
import io.mrkuhne.mezo.feature.progression.TrainingCommitmentSource;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * Computed behavior traits (ADR 0010 §4 — mirrored back, never self-claimed), derived on read:
 * discipline = 28-day completion ratio over commitments (planned training sessions + closed daily
 * quests, available components averaged); consistency = current streak of consecutive weeks with
 * >= ACTIVE_DAYS_PER_WEEK active days (a day with any XP-earning action in the level_up_event
 * ledger). The current, still-running week counts only once it already meets the bar — an
 * unfinished week never breaks the streak (grace, mirrors the robustness streak's tone).
 */
@Component
@RequiredArgsConstructor
public class TraitCalculator {

    static final int DISCIPLINE_WINDOW_DAYS = 28;
    static final int ACTIVE_DAYS_PER_WEEK = 4;
    static final int CONSISTENCY_HORIZON_DAYS = 400;

    private final LevelUpEventRepository levelUpEventRepository;
    private final TrainingCommitmentSource trainingCommitmentSource;
    private final ObjectProvider<QuestLedgerSource> questLedgerSource;

    public ProfileTraits traits(UUID createdBy, LocalDate today) {
        return ProfileTraits.builder()
            .disciplinePct(disciplinePct(createdBy, today))
            .consistencyWeeks(consistencyWeeks(createdBy, today))
            .build();
    }

    private Integer disciplinePct(UUID createdBy, LocalDate today) {
        LocalDate from = today.minusDays(DISCIPLINE_WINDOW_DAYS - 1L);
        double sum = 0;
        int components = 0;

        TrainingCommitmentSource.Stats training = trainingCommitmentSource.commitmentStats(createdBy, from, today);
        if (training.planned() > 0) {
            sum += Math.min(1.0, (double) training.done() / training.planned());
            components++;
        }
        QuestLedgerSource quests = questLedgerSource.getIfAvailable();
        if (quests != null) {
            QuestLedgerSource.Stats s = quests.closedQuestStats(createdBy, from, today);
            int closed = s.completed() + s.expired();
            if (closed > 0) {
                sum += (double) s.completed() / closed;
                components++;
            }
        }
        return components == 0 ? null : (int) Math.round(100 * sum / components);
    }

    private int consistencyWeeks(UUID createdBy, LocalDate today) {
        ZoneId zone = ZoneId.systemDefault();
        Instant horizon = today.minusDays(CONSISTENCY_HORIZON_DAYS).atStartOfDay(zone).toInstant();
        Map<LocalDate, Long> activeDaysByWeek = new HashMap<>();
        levelUpEventRepository.findOccurredAtSince(createdBy, horizon).stream()
            .map(i -> LocalDate.ofInstant(i, zone))
            .distinct()
            .forEach(d -> activeDaysByWeek.merge(d.with(DayOfWeek.MONDAY), 1L, Long::sum));

        LocalDate week = today.with(DayOfWeek.MONDAY);
        if (activeDaysByWeek.getOrDefault(week, 0L) < ACTIVE_DAYS_PER_WEEK) {
            week = week.minusWeeks(1); // grace: the running week can't break the streak yet
        }
        int streak = 0;
        while (activeDaysByWeek.getOrDefault(week, 0L) >= ACTIVE_DAYS_PER_WEEK) {
            streak++;
            week = week.minusWeeks(1);
        }
        return streak;
    }
}
```

In `ProgressionService.getProfile` (inject `private final TraitCalculator traitCalculator;`): after the `muscle` list build add
```java
        List<SkillLevel> life = ProgressionTaxonomy.LIFE.stream()
            .map(k -> skillLevel(byKey, k, "LIFE")).toList();
```
and extend the builder chain: `.life(life).traits(traitCalculator.traits(createdBy, LocalDate.now()))` (import `java.time.LocalDate`, `io.mrkuhne.mezo.api.dto.ProfileTraits` where needed).

- [ ] **Step 6: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=ProfileTraitsIT -DargLine=-Xmx3g`
Expected: PASS (3 tests).

- [ ] **Step 7: Guard neighbors (focused)**

Run: `cd backend && ./mvnw clean test -Dtest='Progression*,Quest*,Workout*,ArchitectureTest' -DargLine=-Xmx3g`
Expected: PASS — profile consumers unaffected (new fields additive); no package cycle (ports point into progression).

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression backend/src/main/java/io/mrkuhne/mezo/feature/quest backend/src/main/java/io/mrkuhne/mezo/feature/train backend/src/test/java/io/mrkuhne/mezo
git -c core.hooksPath=/dev/null commit -m "feat(progression): profile life[] band + computed discipline/consistency traits via ledger ports (mezo-jzca)"
```

---

### Task 5: GROWTH slot + activity-mode quests (catalog, selector, evaluator, completion seam)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/quest/QuestCatalog.java`, `backend/src/main/resources/content/quest-catalog.json`, `.../feature/quest/service/QuestSelector.java`, `.../feature/quest/service/QuestService.java`, `.../feature/quest/mapper/QuestDisplay.java`, `.../feature/meal/repository/MealItemRepository.java`, `.../feature/quest/service/QuestEvaluator.java`
- Modify (tests): `backend/src/test/java/io/mrkuhne/mezo/support/populator/QuestPopulator.java`, `.../feature/quest/QuestSelectorIT.java`, `.../feature/quest/QuestApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestActivityCompletionIT.java`

**Interfaces:**
- Consumes: `QuestCatalog.QuestDef` (Task 5 adds `mode`), `ProgressionService.applyQuest` (existing).
- Produces (consumed by Task 7): `QuestService.completeMatchingActivityQuest(UUID userId, LocalDate date, String skillKey, UUID activityId)` → `Optional<QuestService.ActivityQuestCompletion>` where `record ActivityQuestCompletion(DailyQuestEntity quest, LevelUpResult levelUp)` (levelUp null when progression off); `QuestPopulator.activityQuest(UUID createdBy, LocalDate date, String skillKey, int xp, String status)`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.feature.quest.service.QuestService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Activity-mode quests: never auto-completed by evaluation; completed by a matching activity. */
class QuestActivityCompletionIT extends AbstractIntegrationTest {

    @Autowired private QuestService questService;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private DailyQuestRepository repository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testCompleteMatchingActivityQuest_shouldCompleteAndStampSource_whenSkillMatches() {
        UUID owner = userPopulator.createUser("aq-a@test.hu").getId();
        LocalDate today = LocalDate.now();
        DailyQuestEntity quest = questPopulator.activityQuest(owner, today, "learning", 20,
            DailyQuestEntity.STATUS_OFFERED);
        UUID activityId = UUID.randomUUID();

        var completion = questService.completeMatchingActivityQuest(owner, today, "learning", activityId);

        assertThat(completion).isPresent();
        assertThat(completion.get().levelUp()).isNotNull();
        DailyQuestEntity reloaded = repository.findByIdAndCreatedBy(quest.getId(), owner).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(DailyQuestEntity.STATUS_COMPLETED);
        assertThat(reloaded.getSourceActivityId()).isEqualTo(activityId);
    }

    @Test
    void testCompleteMatchingActivityQuest_shouldReturnEmpty_whenSkillDiffers() {
        UUID owner = userPopulator.createUser("aq-b@test.hu").getId();
        LocalDate today = LocalDate.now();
        questPopulator.activityQuest(owner, today, "learning", 20, DailyQuestEntity.STATUS_OFFERED);

        assertThat(questService.completeMatchingActivityQuest(owner, today, "cooking", UUID.randomUUID()))
            .isEmpty();
    }

    @Test
    void testEvaluateAndFinalize_shouldSkipActivityModeQuest_whenOfferedToday() {
        UUID owner = userPopulator.createUser("aq-c@test.hu").getId();
        LocalDate today = LocalDate.now();
        DailyQuestEntity quest = questPopulator.activityQuest(owner, today, "mindset", 15,
            DailyQuestEntity.STATUS_OFFERED);

        questService.evaluateAndFinalize(java.util.List.of(quest), today);

        assertThat(repository.findByIdAndCreatedBy(quest.getId(), owner).orElseThrow().getStatus())
            .isEqualTo(DailyQuestEntity.STATUS_OFFERED); // ACTIVITY mode never auto-completes
    }

    @Test
    void testEvaluateAndFinalize_shouldExpireActivityModeQuest_whenDayPassed() {
        UUID owner = userPopulator.createUser("aq-d@test.hu").getId();
        DailyQuestEntity quest = questPopulator.activityQuest(owner, LocalDate.now().minusDays(1),
            "mindset", 15, DailyQuestEntity.STATUS_OFFERED);

        questService.evaluateAndFinalize(java.util.List.of(quest), LocalDate.now());

        assertThat(repository.findByIdAndCreatedBy(quest.getId(), owner).orElseThrow().getStatus())
            .isEqualTo(DailyQuestEntity.STATUS_EXPIRED);
    }
}
```

- [ ] **Step 2: `QuestPopulator.activityQuest`** — add to the populator:

```java
    /** GROWTH-slot activity-mode quest (E2): completes via a matching activity-log entry. */
    public DailyQuestEntity activityQuest(UUID createdBy, LocalDate questDate, String skillKey,
                                          int xp, String status) {
        DailyQuestEntity e = new DailyQuestEntity();
        e.setCreatedBy(createdBy);
        e.setQuestDate(questDate);
        e.setSlot(DailyQuestEntity.SLOT_GROWTH);
        e.setCatalogKey("growth_" + skillKey);
        e.setSkillKey(skillKey);
        e.setSkillKind("LIFE");
        e.setTitle("Teszt growth küldetés");
        e.setWhy("Teszt indoklás.");
        e.setCompletionMode(DailyQuestEntity.MODE_ACTIVITY);
        e.setTarget(new QuestTargetEnvelope("activity_match", null));
        e.setXp(xp);
        e.setStatus(status);
        e.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return repository.saveAndFlush(e);
    }
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=QuestActivityCompletionIT -DargLine=-Xmx3g`
Expected: FAIL — compilation error (`completeMatchingActivityQuest` does not exist).

- [ ] **Step 4: Catalog — `mode` field + GROWTH entries**

In `QuestCatalog.java`:
- `QuestDef` record gains `String mode` after `why`: `record QuestDef(String key, String slot, String skillKey, String skillKind, String title, String why, String mode, String metric, BigDecimal threshold, int xp, int coins, int difficulty, List<String> dayTypes, boolean requiresGoalPrescription, int cooldownDays)`.
- Add `private static final Set<String> MODES = Set.of("DERIVED", "ACTIVITY");` next to `SLOTS` and extend `validate(...)` with `&& MODES.contains(d.mode())` (fail-fast on missing/typo'd mode).

In `content/quest-catalog.json`: add `"mode": "DERIVED"` to ALL 7 existing entries (after `"why"`), then append the 7 GROWTH entries:

```json
  {
    "key": "growth_read", "slot": "GROWTH", "skillKey": "learning", "skillKind": "LIFE",
    "title": "Olvass ma legalább 10 percet",
    "why": "Aki naponta olvas, az olvasó ember — napi 10 perc évi több mint 60 óra tanulás.",
    "mode": "ACTIVITY", "metric": "activity_match", "threshold": null, "xp": 20, "coins": 0,
    "difficulty": 2, "dayTypes": ["ANY"], "requiresGoalPrescription": false, "cooldownDays": 2
  },
  {
    "key": "growth_gratitude", "slot": "GROWTH", "skillKey": "mindset", "skillKind": "LIFE",
    "title": "Írj le 3 dolgot, amiért ma hálás vagy",
    "why": "A hála-gyakorlat a legjobban dokumentált hangulat-emelő — 2 perc, mérhető hatás.",
    "mode": "ACTIVITY", "metric": "activity_match", "threshold": null, "xp": 15, "coins": 0,
    "difficulty": 1, "dayTypes": ["ANY"], "requiresGoalPrescription": false, "cooldownDays": 2
  },
  {
    "key": "growth_mindfulness", "slot": "GROWTH", "skillKey": "mindfulness", "skillKind": "LIFE",
    "title": "10 perc meditáció vagy légzőgyakorlat",
    "why": "A figyelmed izom: napi 10 perc edzéssel nyugodtabb az alvás és élesebb a fókusz.",
    "mode": "ACTIVITY", "metric": "activity_match", "threshold": null, "xp": 20, "coins": 0,
    "difficulty": 2, "dayTypes": ["ANY"], "requiresGoalPrescription": false, "cooldownDays": 2
  },
  {
    "key": "growth_finance_review", "slot": "GROWTH", "skillKey": "financial", "skillKind": "LIFE",
    "title": "Nézd át a heti költéseid",
    "why": "Aki látja a pénzét, az dönt róla — 10 perc áttekintés többet ér egy hónap találgatásnál.",
    "mode": "ACTIVITY", "metric": "activity_match", "threshold": null, "xp": 20, "coins": 0,
    "difficulty": 2, "dayTypes": ["ANY"], "requiresGoalPrescription": false, "cooldownDays": 3
  },
  {
    "key": "growth_deepwork", "slot": "GROWTH", "skillKey": "productivity", "skillKind": "LIFE",
    "title": "Egy 45 perces deep-work blokk megszakítás nélkül",
    "why": "Egy védett blokk többet ér, mint egy szétdarabolt délelőtt — a fókusz edzhető.",
    "mode": "ACTIVITY", "metric": "activity_match", "threshold": null, "xp": 25, "coins": 0,
    "difficulty": 2, "dayTypes": ["ANY"], "requiresGoalPrescription": false, "cooldownDays": 2
  },
  {
    "key": "growth_connect", "slot": "GROWTH", "skillKey": "connection", "skillKind": "LIFE",
    "title": "Hívj fel egy barátot vagy családtagot",
    "why": "A leghosszabb boldogság-kutatás szerint a kapcsolatok a jó élet legerősebb előrejelzői.",
    "mode": "ACTIVITY", "metric": "activity_match", "threshold": null, "xp": 20, "coins": 0,
    "difficulty": 2, "dayTypes": ["ANY"], "requiresGoalPrescription": false, "cooldownDays": 2
  },
  {
    "key": "growth_cook_own", "slot": "GROWTH", "skillKey": "cooking", "skillKind": "LIFE",
    "title": "Főzz ma a saját receptjeid egyikéből",
    "why": "Egy szakács ma is főz — és pontosan tudja, mi kerül a tányérjára.",
    "mode": "DERIVED", "metric": "own_recipe_meal", "threshold": null, "xp": 25, "coins": 0,
    "difficulty": 2, "dayTypes": ["ANY"], "requiresGoalPrescription": false, "cooldownDays": 3
  }
```

- [ ] **Step 5: Selector + evaluator + display + service**

`QuestSelector.java`:
- Rename `E1_SLOTS` → `SLOTS` and include GROWTH: `private static final List<String> SLOTS = List.of(DailyQuestEntity.SLOT_BODY, DailyQuestEntity.SLOT_FUELBIO, DailyQuestEntity.SLOT_GROWTH);` (update the loop reference).
- In `toEntity(...)` replace the hard-coded mode line with `e.setCompletionMode(def.mode());`.

`MealItemRepository.java` add:
```java
    /** Cooking-quest derived signal (E2): did an own-recipe meal item land on this day? */
    boolean existsByCreatedByAndDeletedFalseAndSourceAndMeal_MealDate(
        UUID createdBy, String source, LocalDate mealDate);
```
(imports `java.time.LocalDate`, `java.util.UUID` if missing.)

`QuestEvaluator.java`: inject `private final MealItemRepository mealItemRepository;` and add a case before `default`:
```java
            case "own_recipe_meal" -> mealItemRepository
                .existsByCreatedByAndDeletedFalseAndSourceAndMeal_MealDate(q.getCreatedBy(), "recipe", d);
```

`QuestDisplay.targetLabel` add two cases before `default`:
```java
            case "activity_match" -> "Tevékenységnapló-bejegyzés ma";
            case "own_recipe_meal" -> "Saját recept étkezésként loggolva";
```

`QuestService.java`:
- In `evaluateAndFinalize` guard evaluation to derived quests — replace `if (evaluator.satisfied(q)) {` with:
```java
            boolean derived = DailyQuestEntity.MODE_DERIVED.equals(q.getCompletionMode());
            if (derived && evaluator.satisfied(q)) {
```
(the `else if (q.getQuestDate().isBefore(today))` expiry branch stays — it now also quietly expires past activity-mode quests).
- Add the completion seam + nested record at the class end:
```java
    /** One activity-completed quest + its XP payload (levelUp null when progression is off). */
    public record ActivityQuestCompletion(DailyQuestEntity quest, LevelUpResult levelUp) {}

    /**
     * Activity-write hook (E2, spec §5 quest synergy): the day's first offered activity-mode
     * quest with a matching LIFE skill completes; the triggering activity id is stamped for
     * provenance. Same XP path as derived completion (idempotent per quest id).
     */
    @Transactional
    public Optional<ActivityQuestCompletion> completeMatchingActivityQuest(
        UUID userId, LocalDate date, String skillKey, UUID activityId) {
        return repository.findByCreatedByAndQuestDateOrderBySlotAsc(userId, date).stream()
            .filter(q -> DailyQuestEntity.STATUS_OFFERED.equals(q.getStatus()))
            .filter(q -> DailyQuestEntity.MODE_ACTIVITY.equals(q.getCompletionMode()))
            .filter(q -> q.getSkillKey().equals(skillKey))
            .findFirst()
            .map(q -> {
                q.setStatus(DailyQuestEntity.STATUS_COMPLETED);
                q.setCompletedAt(Instant.now());
                q.setSourceActivityId(activityId);
                repository.save(q);
                LevelUpResult levelUp = progressionGate.getIfAvailable() != null
                    ? progressionService.applyQuest(userId, new QuestSignal(
                        q.getId(), q.getSkillKey(), q.getSkillKind(), q.getXp(), q.getTitle()))
                    : null;
                return new ActivityQuestCompletion(q, levelUp);
            });
    }
```
(import `java.util.Optional`.)

- [ ] **Step 6: Update the E1 tests that assert 2 slots** (GROWTH now generates a third quest):
- `QuestSelectorIT`: `hasSize(2)` → `hasSize(3)`; `containsExactlyInAnyOrder(SLOT_BODY, SLOT_FUELBIO)` → `containsExactlyInAnyOrder(SLOT_BODY, SLOT_FUELBIO, SLOT_GROWTH)`. The determinism + cooldown tests operate on keys and still hold — but the cooldown test's `bio_` filter is unaffected by GROWTH keys. Run and adjust ONLY count/slot assertions; keep semantics.
- `QuestApiIT`: `hasSize(2)` → `hasSize(3)` (line ~37); any slot-set assertion gains `"GROWTH"`. Inspect the remaining tests — reroll/evaluation tests are slot-scoped and stay valid; fix only what the run flags.

- [ ] **Step 7: Run to verify all quest tests pass**

Run: `cd backend && ./mvnw clean test -Dtest='Quest*' -DargLine=-Xmx3g`
Expected: PASS (incl. the new QuestActivityCompletionIT, updated selector/API ITs, catalog IT — GROWTH entries respect the 15–40 band and coins=0 so `QuestCatalogIT` still passes).

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/quest backend/src/main/java/io/mrkuhne/mezo/feature/meal backend/src/main/resources/content/quest-catalog.json backend/src/test/java/io/mrkuhne/mezo
git -c core.hooksPath=/dev/null commit -m "feat(quest): GROWTH slot + activity-mode quests + own-recipe derived metric + activity completion seam (mezo-jzca)"
```

---

### Task 6: `ActivityClassifier` (companion cheap tier) + switch + properties + fake wiring

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/activity/service/ActivityClassifier.java`, `.../feature/activity/config/ActivityProperties.java`
- Modify: `.../techcore/configuration/FeaturesConfiguration.java`, `.../feature/companion/llm/FakeCompanionLlm.java`, `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/activity/ActivityClassifierIT.java`

**Interfaces:**
- Produces (consumed by Task 7): `ActivityClassifier.classify(String text)` → `Optional<ActivityClassifier.Classification>` where `record Classification(String skillKey, BigDecimal confidence, Integer xpSuggestion, Integer durationMin, Long amountHuf)` — empty on LLM failure/unparseable JSON; unknown skillKey normalized to null skillKey + confidence 0. Bean exists only when BOTH `ACTIVITY_SWITCH` AND `COMPANION_SWITCH` are on. `ActivityProperties(xpMin, xpMax, perSkillDailyCap, dailyCap, confidenceThreshold, defaultXp)`; `FeaturesConfiguration.ACTIVITY_SWITCH`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.activity;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.service.ActivityClassifier;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** AI classification against the companion-fake: sentinel-scripted answers, defensive parsing. */
@ActiveProfiles("companion-fake")
class ActivityClassifierIT extends AbstractIntegrationTest {

    @Autowired private ActivityClassifier classifier;

    @Test
    void testClassify_shouldParseScriptedAnswer_whenSentinelPlanted() {
        var result = classifier.classify(
            "Olvastam 30 percet [fake-activity:{\"skillKey\":\"learning\",\"confidence\":0.92,"
                + "\"xpSuggestion\":18,\"durationMin\":30,\"amountHuf\":null}]");

        assertThat(result).isPresent();
        assertThat(result.get().skillKey()).isEqualTo("learning");
        assertThat(result.get().confidence()).isEqualByComparingTo("0.92");
        assertThat(result.get().xpSuggestion()).isEqualTo(18);
        assertThat(result.get().durationMin()).isEqualTo(30);
    }

    @Test
    void testClassify_shouldNullSkill_whenUnknownKeyScripted() {
        var result = classifier.classify(
            "X [fake-activity:{\"skillKey\":\"hacking\",\"confidence\":0.95,\"xpSuggestion\":20}]");

        assertThat(result).isPresent();
        assertThat(result.get().skillKey()).isNull(); // unknown key → uncategorized, never a bad row
    }

    @Test
    void testClassify_shouldReturnEmpty_whenLlmFails() {
        assertThat(classifier.classify("Valami [fake-fail]")).isEmpty();
    }

    @Test
    void testClassify_shouldReturnEmpty_whenAnswerIsNotJson() {
        assertThat(classifier.classify("Valami [fake-activity:ez nem json]")).isEmpty();
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=ActivityClassifierIT -DargLine=-Xmx3g`
Expected: FAIL — compilation error (`ActivityClassifier` does not exist).

- [ ] **Step 3: Switch + properties + yaml**

`FeaturesConfiguration.java` append after `QUEST_JOB_SWITCH`:
```java
    /** Activity log (gamified growth E2). Gates the whole /api/activity surface + services;
     *  the AI classifier additionally requires COMPANION_SWITCH (it calls the CompanionLlm port). */
    public static final String ACTIVITY_SWITCH = "mezo.feature.activity.enabled";
```

`ActivityProperties.java`:
```java
package io.mrkuhne.mezo.feature.activity.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Activity-log tuning (mezo.activity): deterministic XP guardrails + the AI confidence gate
 * (ADR 0010 — the LLM proposes, the server disposes; amounts are config, never code). */
@Validated
@ConfigurationProperties(prefix = "mezo.activity")
public record ActivityProperties(
    @Min(1) int xpMin,                                        // 5
    @Min(1) int xpMax,                                        // 25
    @Min(0) int perSkillDailyCap,                             // 40
    @Min(0) int dailyCap,                                     // 100
    @DecimalMin("0.0") @DecimalMax("1.0") double confidenceThreshold, // 0.6
    @Min(0) int defaultXp                                     // 10 — classifier absent/off
) {}
```
Check how `QuestProperties` is registered (`@ConfigurationPropertiesScan` on the app class or an `@EnableConfigurationProperties` site) and register `ActivityProperties` the same way if registration is explicit.

`application.yml`:
- Under `mezo.feature` (after the quest switch):
```yaml
    # Gamified growth E2 — activity log (bd mezo-jzca): free-text life-activity logging with AI
    # categorization onto the LIFE band; off ⇒ /api/activity surface 404s and no activity beans.
    activity:
      enabled: true
```
- After the `mezo.quest` block:
```yaml
  # Activity-log tuning (E2, ADR 0010): the LLM proposes, the server disposes — XP clamped into
  # [xp-min, xp-max], per-skill and per-day caps bound the honor system; below the confidence
  # threshold the entry lands uncategorized and the client prompts for a manual category.
  activity:
    xp-min: 5
    xp-max: 25
    per-skill-daily-cap: 40
    daily-cap: 100
    confidence-threshold: 0.6
    default-xp: 10
```

- [ ] **Step 4: The classifier + fake branch**

`ActivityClassifier.java`:
```java
package io.mrkuhne.mezo.feature.activity.service;

import io.mrkuhne.mezo.feature.activity.config.ActivityProperties;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.progression.ProgressionTaxonomy;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * One-shot LIFE-skill classification of a free-text activity (E2, spec §5) on the companion
 * CHEAP tier (FactExtractionService pattern: marker-prefixed prompt, strict-JSON answer,
 * defensive parse — a broken answer degrades to "uncategorized", never an error). The XP
 * suggestion is only a proposal; ActivityService clamps and caps it deterministically.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.ACTIVITY_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
    havingValue = "true")
public class ActivityClassifier {

    /** First word of the system prompt — FakeCompanionLlm mirrors it (literal, no import back). */
    public static final String CLASSIFY_MARKER = "TEVEKENYSEG-BESOROLAS-FELADAT";

    private static final String CLASSIFY_PROMPT = CLASSIFY_MARKER + """
        : Az alábbi magyar szabadszöveges tevékenység-bejegyzést sorold be PONTOSAN EGY life-skill
        kulcs alá: mindfulness (meditáció, légzés, naplózás), mindset (hála, vizualizáció, célírás),
        cooking (főzés, meal-prep), financial (költségvetés, megtakarítás, no-spend), productivity
        (deep work, tervezés, halogatott feladat), learning (olvasás, kurzus, nyelvtanulás),
        connection (hívás, minőségi idő, segítségnyújtás), recovery (mobilitás, szauna, pihenés).
        Válaszolj KIZÁRÓLAG egyetlen JSON objektummal:
        {"skillKey": "<kulcs>", "confidence": <0..1>, "xpSuggestion": <5..25 egész>,
         "durationMin": <egész vagy null>, "amountHuf": <egész vagy null>}
        Az xpSuggestion az erőfeszítéssel arányos. Ha nem egyértelmű, a confidence legyen alacsony.""";

    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final ActivityProperties properties;

    /** One classification as proposed by the model (record mirrors the strict-JSON answer). */
    public record Classification(String skillKey, BigDecimal confidence, Integer xpSuggestion,
                                 Integer durationMin, Long amountHuf) {}

    /** Empty = LLM failed or answered garbage → the caller stores the entry uncategorized. */
    public Optional<Classification> classify(String text) {
        String raw;
        try {
            raw = companionLlm.complete(CLASSIFY_PROMPT, text);
        } catch (Exception e) {
            log.warn("Activity classification failed, storing uncategorized: {}", e.getMessage());
            return Optional.empty();
        }
        return parse(raw);
    }

    private Optional<Classification> parse(String raw) {
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return Optional.empty();
        }
        try {
            Classification c = objectMapper.readValue(raw.substring(start, end + 1), Classification.class);
            if (c.skillKey() != null && !ProgressionTaxonomy.LIFE.contains(c.skillKey())) {
                // hallucinated key → keep the extraction, drop the category (uncategorized flow)
                return Optional.of(new Classification(null, BigDecimal.ZERO, c.xpSuggestion(),
                    c.durationMin(), c.amountHuf()));
            }
            return Optional.of(c);
        } catch (Exception e) {
            log.warn("Activity classification answer unparseable: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
```
NOTE the ArchUnit cycle rule: `feature.activity` → `feature.companion` + `feature.progression` is new but one-directional (companion/progression never import activity).

`FakeCompanionLlm.java` — add next to the other proactive mirrors:
```java
    /** Mirror of ActivityClassifier.CLASSIFY_MARKER (feature/activity) — LITERAL, cycle rule. */
    public static final String ACTIVITY_MARKER_MIRROR = "TEVEKENYSEG-BESOROLAS-FELADAT";

    /** Scripted classification (E2): {@code [fake-activity:{…}]} planted in the entry text. */
    public static final Pattern ACTIVITY_SENTINEL =
            Pattern.compile("\\[fake-activity:(\\{.*\\}|[^\\]]*)]", Pattern.DOTALL);
```
and in `complete(...)` (before the final echo return):
```java
        if (systemPrompt.startsWith(ACTIVITY_MARKER_MIRROR)) {
            Matcher m = ACTIVITY_SENTINEL.matcher(userMessage);
            // default = valid confident classification so the un-scripted happy path categorizes
            return m.find() ? m.group(1)
                    : "{\"skillKey\":\"learning\",\"confidence\":0.9,\"xpSuggestion\":15,"
                            + "\"durationMin\":null,\"amountHuf\":null}";
        }
```
IMPORTANT: place this branch BEFORE the extraction/verdict branches is unnecessary — order among marker branches is irrelevant (distinct prefixes); append after the challenge branch.

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=ActivityClassifierIT -DargLine=-Xmx3g`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/activity backend/src/main/java/io/mrkuhne/mezo/techcore backend/src/main/java/io/mrkuhne/mezo/feature/companion backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/activity
git -c core.hooksPath=/dev/null commit -m "feat(activity): AI classifier on the companion cheap tier + switch + guardrail properties (mezo-jzca)"
```

---

### Task 7: `ActivityService` + controller + mapper + messages + API ITs

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/activity/service/ActivityService.java`, `.../feature/activity/mapper/ActivityMapper.java`, `.../feature/activity/controller/ActivityController.java`
- Modify: `backend/src/main/resources/messages.properties`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/activity/ActivityApiIT.java`

**Interfaces:**
- Consumes: `ActivityClassifier.classify` (Task 6, via `ObjectProvider` — bean may be off), `QuestService.completeMatchingActivityQuest` (Task 5, via `ObjectProvider` — quest switch may be off), `ProgressionService.applyActivity`/`moveActivityXp` (Task 3), `ObjectProvider<ProgressionGate>` (existing pattern), generated `ActivityApi` (Task 1).
- Produces: the full `/api/activity` surface.

- [ ] **Step 1: messages.properties** — append after the QUEST block:

```properties
ACTIVITY_NOT_FOUND=Activity entry not found.
ACTIVITY_TEXT_REQUIRED=The activity text must not be blank.
ACTIVITY_SKILL_UNKNOWN=Unknown LIFE skill key.
```

- [ ] **Step 2: Write the failing API IT** (HTTP level, `companion-fake` so the classifier bean exists and is deterministic; model on `QuestApiIT` — look at how it obtains `ownerAuthHeaders()` and builds URLs):

```java
package io.mrkuhne.mezo.feature.activity;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ActivityCategoryRequest;
import io.mrkuhne.mezo.api.dto.ActivityCreateRequest;
import io.mrkuhne.mezo.api.dto.ActivityResponse;
import io.mrkuhne.mezo.api.dto.ActivityWriteResponse;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/** /api/activity surface: create+classify+award, caps, categorize/override, quest synergy. */
@ActiveProfiles({"demodata", "companion-fake"})
class ActivityApiIT extends ApiIntegrationTest {

    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private SkillProgressRepository skillProgressRepository;

    @Test
    void testCreateActivity_shouldClassifyAwardAndCompleteQuest_whenConfidentAndQuestMatches() {
        questPopulator.activityQuest(ownerId(), LocalDate.now(), "learning", 20,
            DailyQuestEntity.STATUS_OFFERED);
        ActivityCreateRequest req = ActivityCreateRequest.builder()
            .text("Olvastam 30 percet [fake-activity:{\"skillKey\":\"learning\",\"confidence\":0.92,"
                + "\"xpSuggestion\":18,\"durationMin\":30,\"amountHuf\":null}]")
            .build();

        ActivityWriteResponse res = postForBody("/api/activity", req, ActivityWriteResponse.class,
            HttpStatus.OK);

        assertThat(res.getEntry().getSkillKey()).isEqualTo("learning");
        assertThat(res.getEntry().getXpAwarded()).isEqualTo(18);
        assertThat(res.getEntry().getCategorizedBy()).isEqualTo("AI");
        assertThat(res.getEntry().getDurationMin()).isEqualTo(30);
        assertThat(res.getCompletedQuest()).isNotNull();
        assertThat(res.getCompletedQuest().getStatus()).isEqualTo("completed");
        assertThat(res.getLevelUps()).hasSize(2); // activity award + quest award
        // learning row = 18 (activity) + 20 (quest)
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(ownerId(), "learning")
            .orElseThrow().getCumulativeXp()).isEqualTo(38);
    }

    @Test
    void testCreateActivity_shouldStoreUncategorized_whenConfidenceBelowThreshold() {
        ActivityCreateRequest req = ActivityCreateRequest.builder()
            .text("Valami homályos [fake-activity:{\"skillKey\":\"learning\",\"confidence\":0.35,"
                + "\"xpSuggestion\":12,\"durationMin\":null,\"amountHuf\":null}]")
            .build();

        ActivityWriteResponse res = postForBody("/api/activity", req, ActivityWriteResponse.class,
            HttpStatus.OK);

        assertThat(res.getEntry().getSkillKey()).isNull();
        assertThat(res.getEntry().getXpAwarded()).isZero(); // XP waits for categorization
        assertThat(res.getCompletedQuest()).isNull();
        assertThat(res.getLevelUps()).isEmpty();
    }

    @Test
    void testCreateActivity_shouldCapPerSkillXp_whenDailySkillBudgetNearlyUsed() {
        // 35 XP already awarded to learning today → cap 40 leaves 5, even though 18 suggested
        activityPopulator.activity(ownerId(), LocalDate.now(), "Korábbi olvasás", "learning", 35,
            ActivityLogEntity.BY_AI);
        ActivityCreateRequest req = ActivityCreateRequest.builder()
            .text("Még olvasás [fake-activity:{\"skillKey\":\"learning\",\"confidence\":0.9,"
                + "\"xpSuggestion\":18,\"durationMin\":null,\"amountHuf\":null}]")
            .build();

        ActivityWriteResponse res = postForBody("/api/activity", req, ActivityWriteResponse.class,
            HttpStatus.OK);

        assertThat(res.getEntry().getXpAwarded()).isEqualTo(5);
    }

    @Test
    void testCategorizeActivity_shouldGrantStoredSuggestion_whenUncategorized() {
        ActivityCreateRequest req = ActivityCreateRequest.builder()
            .text("Homályos [fake-activity:{\"skillKey\":null,\"confidence\":0.2,"
                + "\"xpSuggestion\":14,\"durationMin\":null,\"amountHuf\":null}]")
            .build();
        ActivityWriteResponse created = postForBody("/api/activity", req, ActivityWriteResponse.class,
            HttpStatus.OK);

        ActivityWriteResponse res = postForBody(
            "/api/activity/" + created.getEntry().getId() + "/category",
            ActivityCategoryRequest.builder().skillKey("mindset").build(),
            ActivityWriteResponse.class, HttpStatus.OK);

        assertThat(res.getEntry().getSkillKey()).isEqualTo("mindset");
        assertThat(res.getEntry().getCategorizedBy()).isEqualTo("USER");
        assertThat(res.getEntry().getXpAwarded()).isEqualTo(14);
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(ownerId(), "mindset")
            .orElseThrow().getCumulativeXp()).isEqualTo(14);
    }

    @Test
    void testCategorizeActivity_shouldMoveXp_whenOverridingAiCategory() {
        ActivityCreateRequest req = ActivityCreateRequest.builder()
            .text("Olvastam [fake-activity:{\"skillKey\":\"learning\",\"confidence\":0.9,"
                + "\"xpSuggestion\":16,\"durationMin\":null,\"amountHuf\":null}]")
            .build();
        ActivityWriteResponse created = postForBody("/api/activity", req, ActivityWriteResponse.class,
            HttpStatus.OK);
        assertThat(created.getEntry().getXpAwarded()).isEqualTo(16);

        ActivityWriteResponse res = postForBody(
            "/api/activity/" + created.getEntry().getId() + "/category",
            ActivityCategoryRequest.builder().skillKey("productivity").build(),
            ActivityWriteResponse.class, HttpStatus.OK);

        assertThat(res.getEntry().getSkillKey()).isEqualTo("productivity");
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(ownerId(), "learning")
            .orElseThrow().getCumulativeXp()).isZero();
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(ownerId(), "productivity")
            .orElseThrow().getCumulativeXp()).isEqualTo(16);
    }

    @Test
    void testCategorizeActivity_shouldReject_whenSkillKeyUnknown() {
        var e = activityPopulator.activity(ownerId(), LocalDate.now(), "X", null, 0, null);

        var body = exchangeForBody("/api/activity/" + e.getId() + "/category",
            org.springframework.http.HttpMethod.POST,
            ActivityCategoryRequest.builder().skillKey("hacking").build(),
            io.mrkuhne.mezo.api.dto.SystemMessageList.class, HttpStatus.BAD_REQUEST);

        assertHasRequestError(body, "ACTIVITY_SKILL_UNKNOWN");
    }

    @Test
    void testGetActivityDay_shouldListOwnEntriesNewestFirst_whenLogged() {
        LocalDate d = LocalDate.now();
        activityPopulator.activity(ownerId(), d, "Első", "learning", 10, ActivityLogEntity.BY_AI);
        activityPopulator.activity(ownerId(), d, "Második", "mindset", 10, ActivityLogEntity.BY_USER);

        ActivityResponse[] list = getForBody("/api/activity/day/" + d, ActivityResponse[].class,
            HttpStatus.OK);

        assertThat(list).hasSize(2);
        assertThat(list[0].getText()).isEqualTo("Második");
    }
}
```
ADAPT the helper calls to the real `ApiIntegrationTest` API (verb-helper signatures, how the owner's id is obtained — if there is no `ownerId()` helper, use the same idiom `QuestApiIT` uses; if `postForBody` has a different parameter order, follow it; builders on generated DTOs exist because the generator emits them project-wide). Semantics of every assertion stay as written.

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=ActivityApiIT -DargLine=-Xmx3g`
Expected: FAIL — compilation error (`ActivityService`/controller do not exist → generated `ActivityApi` unimplemented is fine until the controller lands; the IT fails on missing beans/404).

- [ ] **Step 4: Mapper + service + controller**

`ActivityMapper.java`:
```java
package io.mrkuhne.mezo.feature.activity.mapper;

import io.mrkuhne.mezo.api.dto.ActivityResponse;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ActivityMapper {

    @Mapping(target = "durationMin",
        expression = "java(e.getExtracted() == null ? null : e.getExtracted().durationMin())")
    @Mapping(target = "amountHuf",
        expression = "java(e.getExtracted() == null ? null : e.getExtracted().amountHuf())")
    ActivityResponse toResponse(ActivityLogEntity e);

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
```

`ActivityService.java`:
```java
package io.mrkuhne.mezo.feature.activity.service;

import io.mrkuhne.mezo.api.dto.ActivityResponse;
import io.mrkuhne.mezo.api.dto.ActivityWriteResponse;
import io.mrkuhne.mezo.feature.activity.config.ActivityProperties;
import io.mrkuhne.mezo.feature.activity.entity.ActivityExtract;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.mapper.ActivityMapper;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.progression.ProgressionGate;
import io.mrkuhne.mezo.feature.progression.ProgressionTaxonomy;
import io.mrkuhne.mezo.feature.progression.activity.ActivitySignal;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.mapper.LevelUpResultMapper;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.feature.quest.mapper.QuestMapper;
import io.mrkuhne.mezo.feature.quest.service.QuestService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Activity-log write/read/categorize (E2, bd mezo-jzca, spec §5). The classifier PROPOSES; this
 * service DISPOSES: XP clamped into [xpMin, xpMax], bounded by the per-skill and per-day daily
 * caps, granted once per entry through the idempotent progression tail (source ACTIVITY). A
 * confident classification (or manual categorization) also completes the day's matching open
 * activity-mode quest — the self-report tap is a mini-journal entry, never an empty checkbox.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ACTIVITY_SWITCH, havingValue = "true")
public class ActivityService {

    private static final int LABEL_MAX = 60;

    private final ActivityLogRepository repository;
    private final ActivityMapper mapper;
    private final ActivityProperties properties;
    private final ObjectProvider<ActivityClassifier> classifier;      // needs companion switch too
    private final ObjectProvider<QuestService> questService;          // quest switch may be off
    private final ObjectProvider<ProgressionGate> progressionGate;    // progression switch may be off
    private final ProgressionService progressionService;
    private final LevelUpResultMapper levelUpResultMapper;
    private final QuestMapper questMapper;

    @Transactional
    public ActivityWriteResponse create(UUID userId, String text, LocalDate occurredOn) {
        if (text == null || text.isBlank()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("ACTIVITY_TEXT_REQUIRED").build(), HttpStatus.BAD_REQUEST);
        }
        LocalDate day = occurredOn != null ? occurredOn : LocalDate.now();
        ActivityLogEntity e = new ActivityLogEntity();
        e.setCreatedBy(userId);
        e.setOccurredOn(day);
        e.setText(text.strip());
        e.setXpSuggested(properties.defaultXp());

        ActivityClassifier c = classifier.getIfAvailable();
        if (c != null) {
            c.classify(e.getText()).ifPresent(cl -> {
                if (cl.xpSuggestion() != null) {
                    e.setXpSuggested(clamp(cl.xpSuggestion()));
                }
                e.setConfidence(cl.confidence());
                e.setExtracted(cl.durationMin() != null || cl.amountHuf() != null
                    ? new ActivityExtract(cl.durationMin(), cl.amountHuf()) : null);
                boolean confident = cl.skillKey() != null && cl.confidence() != null
                    && cl.confidence().doubleValue() >= properties.confidenceThreshold();
                if (confident) {
                    e.setSkillKey(cl.skillKey());
                    e.setCategorizedBy(ActivityLogEntity.BY_AI);
                }
            });
        }
        repository.saveAndFlush(e); // id needed for the idempotent award + quest provenance
        List<LevelUpResult> levelUps = new ArrayList<>();
        QuestService.ActivityQuestCompletion completion = null;
        if (e.getSkillKey() != null) {
            grantXp(userId, e, levelUps);
            completion = completeQuest(userId, e, levelUps);
        }
        return response(e, completion, levelUps);
    }

    @Transactional(readOnly = true)
    public List<ActivityResponse> getDay(UUID userId, LocalDate date) {
        return repository.findByCreatedByAndOccurredOnOrderByCreatedAtDesc(userId, date)
            .stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public ActivityWriteResponse categorize(UUID userId, UUID id, String skillKey) {
        if (!ProgressionTaxonomy.LIFE.contains(skillKey)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("ACTIVITY_SKILL_UNKNOWN").build(), HttpStatus.BAD_REQUEST);
        }
        ActivityLogEntity e = repository.findByIdAndCreatedBy(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("ACTIVITY_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        List<LevelUpResult> levelUps = new ArrayList<>();
        QuestService.ActivityQuestCompletion completion = null;
        String previous = e.getSkillKey();
        if (!skillKey.equals(previous)) {
            e.setSkillKey(skillKey);
            e.setCategorizedBy(ActivityLogEntity.BY_USER);
            if (e.getXpAwarded() == 0) {
                grantXp(userId, e, levelUps); // first categorization → grant within remaining caps
            } else if (previous != null && progressionGate.getIfAvailable() != null) {
                progressionService.moveActivityXp(userId, previous, skillKey, e.getXpAwarded());
            }
            completion = completeQuest(userId, e, levelUps);
            repository.save(e);
        }
        return response(e, completion, levelUps);
    }

    /** Deterministic guardrails: clamp the suggestion, bound by the day's remaining budgets. */
    private void grantXp(UUID userId, ActivityLogEntity e, List<LevelUpResult> levelUps) {
        List<ActivityLogEntity> day =
            repository.findByCreatedByAndOccurredOnOrderByCreatedAtDesc(userId, e.getOccurredOn());
        int skillUsed = day.stream()
            .filter(r -> !r.getId().equals(e.getId()) && e.getSkillKey().equals(r.getSkillKey()))
            .mapToInt(ActivityLogEntity::getXpAwarded).sum();
        int dayUsed = day.stream()
            .filter(r -> !r.getId().equals(e.getId()))
            .mapToInt(ActivityLogEntity::getXpAwarded).sum();
        int grant = Math.max(0, Math.min(e.getXpSuggested(),
            Math.min(properties.perSkillDailyCap() - skillUsed, properties.dailyCap() - dayUsed)));
        e.setXpAwarded(grant);
        repository.save(e);
        if (grant > 0 && progressionGate.getIfAvailable() != null) {
            levelUps.add(progressionService.applyActivity(userId,
                new ActivitySignal(e.getId(), e.getSkillKey(), grant, label(e.getText()))));
        }
    }

    private QuestService.ActivityQuestCompletion completeQuest(
        UUID userId, ActivityLogEntity e, List<LevelUpResult> levelUps) {
        QuestService qs = questService.getIfAvailable();
        if (qs == null) {
            return null;
        }
        QuestService.ActivityQuestCompletion completion = qs
            .completeMatchingActivityQuest(userId, e.getOccurredOn(), e.getSkillKey(), e.getId())
            .orElse(null);
        if (completion != null && completion.levelUp() != null) {
            levelUps.add(completion.levelUp());
        }
        return completion;
    }

    private ActivityWriteResponse response(ActivityLogEntity e,
        QuestService.ActivityQuestCompletion completion, List<LevelUpResult> levelUps) {
        return ActivityWriteResponse.builder()
            .entry(mapper.toResponse(e))
            .completedQuest(completion != null ? questMapper.toQuestResponse(completion.quest()) : null)
            .levelUps(levelUps.stream().map(levelUpResultMapper::toDto).toList())
            .build();
    }

    private int clamp(int suggestion) {
        return Math.max(properties.xpMin(), Math.min(properties.xpMax(), suggestion));
    }

    private static String label(String text) {
        return text.length() <= LABEL_MAX ? text : text.substring(0, LABEL_MAX - 1) + "…";
    }
}
```
NOTE: strip any `[fake-…]` sentinel? NO — sentinels only appear in tests and the fake echoes them; the stored text keeping the sentinel is fine for assertions.

`ActivityController.java` — copy `QuestController`'s exact structure (same `CurrentUserId`/auth-principal idiom, implements generated `ActivityApi`):
```java
package io.mrkuhne.mezo.feature.activity.controller;

import io.mrkuhne.mezo.api.controller.ActivityApi;
import io.mrkuhne.mezo.api.dto.ActivityCategoryRequest;
import io.mrkuhne.mezo.api.dto.ActivityCreateRequest;
import io.mrkuhne.mezo.api.dto.ActivityResponse;
import io.mrkuhne.mezo.api.dto.ActivityWriteResponse;
import io.mrkuhne.mezo.feature.activity.service.ActivityService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

/** /api/activity surface (E2, bd mezo-jzca) — thin delegation, ownership from the principal. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ACTIVITY_SWITCH, havingValue = "true")
public class ActivityController implements ActivityApi {

    private final ActivityService activityService;

    @Override
    public ResponseEntity<ActivityWriteResponse> createActivity(ActivityCreateRequest request) {
        return ResponseEntity.ok(activityService.create(currentUserId(),
            request.getText(), request.getOccurredOn()));
    }

    @Override
    public ResponseEntity<List<ActivityResponse>> getActivityDay(LocalDate date) {
        return ResponseEntity.ok(activityService.getDay(currentUserId(), date));
    }

    @Override
    public ResponseEntity<ActivityWriteResponse> categorizeActivity(UUID id, ActivityCategoryRequest request) {
        return ResponseEntity.ok(activityService.categorize(currentUserId(), id, request.getSkillKey()));
    }

    // currentUserId(): use the EXACT same principal-resolution idiom as QuestController — if it
    // injects a CurrentUserId bean/argument resolver, replicate that instead of this placeholder.
}
```
IMPORTANT: read `QuestController.java` first and mirror its auth idiom exactly (constructor deps + how the user id reaches the service) — the snippet above marks the seam.

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=ActivityApiIT -DargLine=-Xmx3g`
Expected: PASS (7 tests). If the switch-off honesty needs proving: quest feature does it via a dedicated test — add one only if `QuestApiIT` has a pattern to copy (`@TestPropertySource` with the switch false asserting 404); otherwise CI's ArchUnit + the conditional beans cover it.

- [ ] **Step 6: Guard the backend neighbors (focused)**

Run: `cd backend && ./mvnw clean test -Dtest='Activity*,Quest*,Progression*,ArchitectureTest' -DargLine=-Xmx3g`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/activity backend/src/main/resources/messages.properties backend/src/test/java/io/mrkuhne/mezo/feature/activity
git -c core.hooksPath=/dev/null commit -m "feat(activity): activity log write/read/categorize + XP guardrails + quest synergy (mezo-jzca)"
```

---

### Task 8: FE data layer — activity domain + quest/progression type extensions

**Files:**
- Create: `frontend/src/data/activity/activityApi.ts`, `.../activityMock.ts`, `.../activityHooks.ts`, `.../activityHooks.test.tsx`
- Modify: `frontend/src/data/types.ts`, `frontend/src/data/hooks.ts`, `frontend/src/data/quest/questApi.ts`, `frontend/src/data/quest/questMock.ts`, `frontend/src/data/progression/progressionMock.ts`, `frontend/src/features/progression/logic/levelUpMeta.ts`, `frontend/src/test/msw/handlers.ts`

**Interfaces:**
- Produces (consumed by Tasks 9–10): barrel hooks `useActivities(date)` → `{ data: ActivityEntry[], isPending }`, `useActivityActions(date)` → `{ logActivity(text: string): Promise<ActivityWriteResult>, categorize(id: string, skillKey: LifeSkillKey): Promise<ActivityWriteResult>, pending: boolean }`; types `ActivityEntry`, `ActivityWriteResult { entry: ActivityEntry; completedQuest: DailyQuest | null; levelUps: LevelUpResult[] }`, `LifeSkillKey`; `DailyQuest.completionMode: 'DERIVED' | 'ACTIVITY'`; `LIFE_SKILLS: { key: LifeSkillKey; name: string; icon: string }[]` (8, octagon order) exported from `levelUpMeta.ts`.

- [ ] **Step 1: Types** — in `data/types.ts` extend the quest block:

```ts
export type QuestCompletionMode = 'DERIVED' | 'ACTIVITY'
```
add to `DailyQuest`: `completionMode: QuestCompletionMode`, and append the activity block:
```ts
// ── Activity log (gamified growth E2, mezo-jzca) ─────────────────────────────
export type LifeSkillKey =
  | 'mindfulness' | 'mindset' | 'cooking' | 'financial'
  | 'productivity' | 'learning' | 'connection' | 'recovery'
export type ActivityCategorizedBy = 'AI' | 'USER'
export interface ActivityEntry {
  id: string
  occurredOn: string
  text: string
  skillKey: LifeSkillKey | null
  confidence: number | null
  xpAwarded: number
  durationMin?: number | null
  amountHuf?: number | null
  categorizedBy: ActivityCategorizedBy | null
  createdAt?: string
}
```

- [ ] **Step 2: Quest domain catch-up** — `questApi.ts` `toQuest`: map `completionMode: (w.completionMode ?? 'DERIVED') as QuestCompletionMode`. `questMock.ts`: add `completionMode: 'DERIVED'` to `dq1`, `dq2`, `mockRerollSpare`, and append the third quest (spec §8 mock day: 1 completed, 1 offered-derived, 1 offered-activity):

```ts
  {
    id: 'dq3g',
    questDate: '2026-07-11',
    slot: 'GROWTH',
    skillKey: 'learning',
    title: 'Olvass ma legalább 10 percet',
    why: 'Aki naponta olvas, az olvasó ember — napi 10 perc évi több mint 60 óra tanulás.',
    targetLabel: 'Tevékenységnapló-bejegyzés ma',
    xp: 20,
    status: 'offered',
    completionMode: 'ACTIVITY',
  },
```

- [ ] **Step 3: levelUpMeta** — replace `LIFE_META` with the 8-skill map + export the ordered list; extend the source maps (the `Source` union gains `'ACTIVITY'` automatically from the regenerated `LevelUpResult`):

```ts
// LIFE band (gamified growth E2, mezo-jzca) — octagon order, mirrors ProgressionTaxonomy.LIFE.
export const LIFE_SKILLS: { key: LifeSkillKey; name: string; icon: string }[] = [
  { key: 'mindfulness', name: 'Tudatosság', icon: '🧘' },
  { key: 'mindset', name: 'Szemlélet', icon: '🌱' },
  { key: 'cooking', name: 'Konyha', icon: '🍳' },
  { key: 'financial', name: 'Pénzügyek', icon: '💰' },
  { key: 'productivity', name: 'Produktivitás', icon: '🎯' },
  { key: 'learning', name: 'Tanulás', icon: '📚' },
  { key: 'connection', name: 'Kapcsolatok', icon: '🤝' },
  { key: 'recovery', name: 'Regeneráció', icon: '🛌' },
]
const LIFE_META: Record<string, { name: string; icon: string }> =
  Object.fromEntries(LIFE_SKILLS.map((s) => [s.key, { name: s.name, icon: s.icon }]))
```
(import `LifeSkillKey` from `@/data/types`), and add to the two source maps: `ACTIVITY: 'Az élet is edzés.'` in `HEADLINE_BY_SOURCE`, `ACTIVITY: '✍️'` in `CHIP_ICON_BY_SOURCE`.

- [ ] **Step 4: activityApi.ts** (wire style of `questApi.ts` — read it and mirror the fetch wrapper):

```ts
import type { paths } from '@/data/_client/api.gen'
import type { ActivityEntry, DailyQuest, LifeSkillKey } from '@/data/types'
import type { LevelUpResult } from '@/data/train/trainApi'
import { toQuest } from '@/data/quest/questApi'

type ActivityWriteWire =
  paths['/api/activity']['post']['responses']['200']['content']['application/json']
type ActivityWire =
  paths['/api/activity/day/{date}']['get']['responses']['200']['content']['application/json'][number]
type ActivityCreateBody =
  paths['/api/activity']['post']['requestBody']['content']['application/json']
type ActivityCategoryBody =
  paths['/api/activity/{id}/category']['post']['requestBody']['content']['application/json']

export interface ActivityWriteResult {
  entry: ActivityEntry
  completedQuest: DailyQuest | null
  levelUps: LevelUpResult[]
}

export function toActivity(w: ActivityWire): ActivityEntry {
  return {
    id: w.id,
    occurredOn: w.occurredOn,
    text: w.text,
    skillKey: (w.skillKey ?? null) as ActivityEntry['skillKey'],
    confidence: w.confidence ?? null,
    xpAwarded: w.xpAwarded,
    durationMin: w.durationMin ?? null,
    amountHuf: w.amountHuf ?? null,
    categorizedBy: (w.categorizedBy ?? null) as ActivityEntry['categorizedBy'],
    createdAt: w.createdAt,
  }
}

function toWriteResult(w: ActivityWriteWire): ActivityWriteResult {
  return {
    entry: toActivity(w.entry),
    completedQuest: w.completedQuest ? toQuest(w.completedQuest) : null,
    levelUps: (w.levelUps ?? []) as LevelUpResult[],
  }
}

export const activityApi = {
  day: (date: string) =>
    /* GET `/api/activity/day/${date}` with the same request helper questApi uses */
    ... .then((list: ActivityWire[]) => list.map(toActivity)),
  create: (text: string, occurredOn?: string) =>
    /* POST '/api/activity' body: { text, occurredOn } satisfies ActivityCreateBody */
    ... .then(toWriteResult),
  categorize: (id: string, skillKey: LifeSkillKey) =>
    /* POST `/api/activity/${id}/category` body: { skillKey } satisfies ActivityCategoryBody */
    ... .then(toWriteResult),
}
```
The `...` placeholders are the ONLY project-specific part: `questApi.ts` shows the exact fetch helper (`api.get`/`api.post` or similar) — replicate it verbatim, including `satisfies` on request bodies.

- [ ] **Step 5: activityMock.ts** (deterministic — fixed dates, no `Date.now`):

```ts
import type { ActivityEntry } from '@/data/types'

/** Mock seed: a representative day — 2 categorized entries + 1 uncategorized prompt. */
export const mockActivities: ActivityEntry[] = [
  {
    id: 'act1',
    occurredOn: '2026-07-11',
    text: 'Olvastam 30 percet a Psychology of Money-ból',
    skillKey: 'learning',
    confidence: 0.92,
    xpAwarded: 18,
    durationMin: 30,
    amountHuf: null,
    categorizedBy: 'AI',
    createdAt: '2026-07-11T08:10:00Z',
  },
  {
    id: 'act2',
    occurredOn: '2026-07-11',
    text: 'Átraktam 50 ezret megtakarításba',
    skillKey: 'financial',
    confidence: 0.88,
    xpAwarded: 15,
    durationMin: null,
    amountHuf: 50000,
    categorizedBy: 'AI',
    createdAt: '2026-07-11T09:30:00Z',
  },
  {
    id: 'act3',
    occurredOn: '2026-07-11',
    text: 'Rendet raktam a garázsban',
    skillKey: null,
    confidence: 0.4,
    xpAwarded: 0,
    durationMin: null,
    amountHuf: null,
    categorizedBy: null,
    createdAt: '2026-07-11T11:05:00Z',
  },
]
```

- [ ] **Step 6: activityHooks.ts** (dual-mode read via `useDualQuery`; mutations return the write result so the sheet can render the classification):

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { activityApi, type ActivityWriteResult } from '@/data/activity/activityApi'
import { mockActivities } from '@/data/activity/activityMock'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import type { ActivityEntry, LifeSkillKey } from '@/data/types'

const key = (d: string) => ['activities', d]

export function useActivities(date: string): { data: ActivityEntry[]; isPending: boolean } {
  return useDualQuery<ActivityEntry[]>({
    queryKey: key(date),
    mockData: mockActivities,
    realFetch: () => activityApi.day(date),
    realEmpty: [],
  })
}

/** Mock-mode write result: deterministic AI verdict so the sheet flow is fully demoable. */
function mockWrite(text: string, date: string): ActivityWriteResult {
  const entry: ActivityEntry = {
    id: `act-m-${text.length}-${date}`,
    occurredOn: date,
    text,
    skillKey: 'learning',
    confidence: 0.9,
    xpAwarded: 15,
    durationMin: null,
    amountHuf: null,
    categorizedBy: 'AI',
  }
  return { entry, completedQuest: null, levelUps: [] }
}

export function useActivityActions(date: string) {
  const qc = useQueryClient()
  const mock = isMockMode()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key(date) })
    qc.invalidateQueries({ queryKey: ['dailyQuests', date] })
    qc.invalidateQueries({ queryKey: ['progressionProfile'] })
  }

  const logM = useMutation({
    mutationFn: async (text: string) => {
      if (mock) {
        const res = mockWrite(text, date)
        qc.setQueryData<ActivityEntry[]>(key(date), (d) => [res.entry, ...(d ?? [])])
        return res
      }
      return activityApi.create(text, date)
    },
    onSuccess: mock ? undefined : invalidate,
  })

  const catM = useMutation({
    mutationFn: async (input: { id: string; skillKey: LifeSkillKey }) => {
      if (mock) {
        let updated: ActivityEntry | undefined
        qc.setQueryData<ActivityEntry[]>(key(date), (d) =>
          (d ?? []).map((e) => {
            if (e.id !== input.id) return e
            updated = { ...e, skillKey: input.skillKey, xpAwarded: e.xpAwarded || 10, categorizedBy: 'USER' }
            return updated
          }),
        )
        return {
          entry: updated!,
          completedQuest: null,
          levelUps: [],
        } satisfies ActivityWriteResult
      }
      return activityApi.categorize(input.id, input.skillKey)
    },
    onSuccess: mock ? undefined : invalidate,
  })

  return {
    logActivity: (text: string) => logM.mutateAsync(text),
    categorize: (id: string, skillKey: LifeSkillKey) => catM.mutateAsync({ id, skillKey }),
    pending: logM.isPending || catM.isPending,
  }
}
```

- [ ] **Step 7: Barrel + MSW + progression mock**

`data/hooks.ts` after the quest line:
```ts
export { useActivities, useActivityActions } from '@/data/activity/activityHooks'
```

`test/msw/handlers.ts` — next to the quest handlers:
```ts
  // ── Activity log (E2, mezo-jzca). Defaults: empty day; create echoes a confident AI verdict.
  http.get(`${API_BASE}/api/activity/day/:date`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/api/activity`, async ({ request }) => {
    const body = (await request.json()) as { text: string; occurredOn?: string }
    return HttpResponse.json({
      entry: {
        id: 'act-new',
        occurredOn: body.occurredOn ?? '2026-07-11',
        text: body.text,
        skillKey: 'learning',
        confidence: 0.9,
        xpAwarded: 15,
        durationMin: null,
        amountHuf: null,
        categorizedBy: 'AI',
        createdAt: '2026-07-11T12:00:00Z',
      },
      completedQuest: null,
      levelUps: [],
    })
  }),
  http.post(`${API_BASE}/api/activity/:id/category`, async ({ params, request }) => {
    const body = (await request.json()) as { skillKey: string }
    return HttpResponse.json({
      entry: {
        id: params.id,
        occurredOn: '2026-07-11',
        text: 'Besorolt bejegyzés',
        skillKey: body.skillKey,
        confidence: 0.4,
        xpAwarded: 10,
        durationMin: null,
        amountHuf: null,
        categorizedBy: 'USER',
        createdAt: '2026-07-11T12:00:00Z',
      },
      completedQuest: null,
      levelUps: [],
    })
  }),
```
Also extend the existing progression-profile handler's payload with `life: []` and `traits: { disciplinePct: null, consistencyWeeks: 0 }` (the regenerated type requires them). Match the handler-array style already in the file (`http`/`HttpResponse` imports exist).

`data/progression/progressionMock.ts` — extend `progressionProfileMock` with:
```ts
  life: [
    { skillKey: 'mindfulness', kind: 'LIFE', level: 1, cumulativeXp: 40, progressPct: 40 },
    { skillKey: 'mindset', kind: 'LIFE', level: 2, cumulativeXp: 130, progressPct: 15.9 },
    { skillKey: 'cooking', kind: 'LIFE', level: 2, cumulativeXp: 150, progressPct: 26.5 },
    { skillKey: 'financial', kind: 'LIFE', level: 1, cumulativeXp: 55, progressPct: 55 },
    { skillKey: 'productivity', kind: 'LIFE', level: 1, cumulativeXp: 25, progressPct: 25 },
    { skillKey: 'learning', kind: 'LIFE', level: 3, cumulativeXp: 320, progressPct: 27.7 },
    { skillKey: 'connection', kind: 'LIFE', level: 1, cumulativeXp: 60, progressPct: 60 },
    { skillKey: 'recovery', kind: 'LIFE', level: 3, cumulativeXp: 305, progressPct: 22.4 },
  ],
  traits: { disciplinePct: 78, consistencyWeeks: 5 },
```
and `GHOST_PROGRESSION_PROFILE` with `life: [], traits: { disciplinePct: null, consistencyWeeks: 0 }`.

- [ ] **Step 8: Hook tests** — `data/activity/activityHooks.test.tsx`, modeled EXACTLY on `data/quest/questHooks.test.tsx` (same wrapper util, same mock/real split style). Cover: (a) mock mode: `useActivities` returns the 3-entry seed synchronously; `logActivity` prepends an AI-categorized entry; `categorize` sets skillKey+USER on the uncategorized seed entry. (b) real mode (MSW): `useActivities` resolves `[]` from the default handler; `logActivity` resolves an `ActivityWriteResult` whose `entry.skillKey === 'learning'`. Copy the file's structure; assert through the barrel import `@/data/hooks`.

- [ ] **Step 9: Verify both modes + build**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: PASS ×3. The `dualMode.guard.test.ts` must stay green (useDualQuery used for the read; no destructuring-default fallback anywhere).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/data frontend/src/features/progression/logic/levelUpMeta.ts frontend/src/test/msw/handlers.ts
git -c core.hooksPath=/dev/null commit -m "feat(fe/activity): activity data domain — dual-mode hooks + LIFE band meta + MSW defaults (mezo-jzca)"
```

---

### Task 9: FE Today — ActivityLogSheet + ActivityLogCard + quest affordance

**Files:**
- Create: `frontend/src/features/today/sheets/ActivityLogSheet.tsx` (+ `ActivityLogSheet.test.tsx`), `frontend/src/features/today/components/ActivityLogCard.tsx` (+ `ActivityLogCard.test.tsx`)
- Modify: `frontend/src/features/today/components/DailyQuestsCard.tsx` (+ its test), `frontend/src/features/today/pages/TodayPage.tsx`

**Interfaces:**
- Consumes: `useActivities`/`useActivityActions` + `useDailyQuests` from `@/data/hooks`, `LIFE_SKILLS` from `@/features/progression/logic/levelUpMeta`, `Sheet` from `@/shared/ui/Sheet`, `useLevelUp` from `@/features/progression/LevelUpProvider` (check the real import path in `DailyQuestsCard`).
- Produces: `ActivityLogSheet` props `{ onClose: () => void; quest?: DailyQuest | null; entry?: ActivityEntry | null }` — `quest` renders the quest-context banner (opened from an activity-mode quest), `entry` starts the sheet in categorize mode for an uncategorized entry.

- [ ] **Step 1: ActivityLogSheet** — three-phase flow, `Sheet` render-prop pattern (copy `SleepLogSheet`'s skeleton: header eyebrow + title + X chip, footer buttons):

```tsx
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { useActivityActions } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { localDateString } from '@/shared/lib/dates'
import type { ActivityEntry, DailyQuest, LifeSkillKey } from '@/data/types'
import type { ActivityWriteResult } from '@/data/activity/activityApi'

interface ActivityLogSheetProps {
  onClose: () => void
  /** Opened from an activity-mode quest → contextual banner + the quest completes on a match. */
  quest?: DailyQuest | null
  /** Opened to categorize an existing uncategorized entry → starts in the picker phase. */
  entry?: ActivityEntry | null
}

export function ActivityLogSheet({ onClose, quest, entry }: ActivityLogSheetProps) {
  const date = localDateString()
  const { logActivity, categorize, pending } = useActivityActions(date)
  const { showLevelUp } = useLevelUp()
  const [text, setText] = useState('')
  const [result, setResult] = useState<ActivityWriteResult | null>(null)
  const [phase, setPhase] = useState<'compose' | 'pick' | 'done'>(entry ? 'pick' : 'compose')
  const pickTarget = result?.entry ?? entry ?? null

  const surfaceLevelUps = (r: ActivityWriteResult) => {
    const payload = r.levelUps.find((l) => l.levelUps.length > 0) ?? r.levelUps[0]
    if (payload) showLevelUp(payload)
  }

  const submit = async () => {
    if (!text.trim() || pending) return
    const r = await logActivity(text.trim())
    setResult(r)
    surfaceLevelUps(r)
    setPhase(r.entry.skillKey ? 'done' : 'pick')
  }

  const pick = async (skillKey: LifeSkillKey) => {
    if (!pickTarget || pending) return
    const r = await categorize(pickTarget.id, skillKey)
    setResult(r)
    surfaceLevelUps(r)
    setPhase('done')
  }

  return (
    <Sheet onClose={onClose} labelledBy="activity-log-title">
      {(close) => (
        <>
          {/* header: eyebrow "Tevékenységnapló", title id=activity-log-title "Mi történt ma?",
              X chip → close — copy SleepLogSheet's header block */}
          {quest && phase === 'compose' && (
            /* quest banner: quest.title + "+{quest.xp} XP a teljesítésért" — chip-style row */
          )}
          {phase === 'compose' && (
            /* textarea value={text} maxLength 500, placeholder
               "pl. Olvastam 30 percet, átraktam 50 ezret megtakarításba…"
               helper copy: "Az AI besorolja, és a megfelelő LIFE skillhez írja az XP-t."
               footer: Mégse (cta-ghost, close) + Naplózom (cta-primary, submit, disabled: !text.trim() || pending) */
          )}
          {phase === 'pick' && pickTarget && (
            /* "Nem egyértelmű — melyik skillhez tartozik?" + the entry text quoted +
               8 chip buttons: LIFE_SKILLS.map(s => `${s.icon} ${s.name}`) → pick(s.key) */
          )}
          {phase === 'done' && result && (
            /* result summary: entry skill chip (icon+name from LIFE_SKILLS), "+{xpAwarded} XP",
               result.completedQuest && "Küldetés teljesítve: {title} (+{xp} XP)" row,
               footer single cta-primary "Kész" → close */
          )}
        </>
      )}
    </Sheet>
  )
}
```
Fill the comment blocks with the house markup idiom (copy classes from `SleepLogSheet`: `eyebrow`, `chip notch-4`, `cta-primary notch-4 flex-1`…). Every visible string above is final copy.

- [ ] **Step 2: ActivityLogCard** — always rendered (the standalone quick-add entry point, spec §7):

```tsx
import { useState } from 'react'
import { useActivities } from '@/data/hooks'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { localDateString } from '@/shared/lib/dates'
import type { ActivityEntry } from '@/data/types'

/** Today's activity mini-journal: entries + quick-add; uncategorized rows prompt for a pick. */
export function ActivityLogCard() {
  const date = localDateString()
  const { data: entries } = useActivities(date)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [categorizeEntry, setCategorizeEntry] = useState<ActivityEntry | null>(null)
  // ...card markup: className="card" like DailyQuestsCard, header eyebrow "Tevékenységnapló"
  // + right-aligned chip button "+ Bejegyzés" → setSheetOpen(true).
  // Rows: icon (LIFE_SKILLS lookup by skillKey, fallback '✎'), text (truncate ~1 line),
  //       xpAwarded > 0 && `+${xpAwarded} XP` chip;
  //       skillKey === null → "Besorolás?" chip → setCategorizeEntry(e).
  // Empty state: single text-tertiary line "Mi történt ma? Jegyezd fel — az XP a tiéd."
  // {sheetOpen && <ActivityLogSheet onClose={() => setSheetOpen(false)} />}
  // {categorizeEntry && <ActivityLogSheet entry={categorizeEntry} onClose={() => setCategorizeEntry(null)} />}
}
```

- [ ] **Step 3: DailyQuestsCard affordance** — offered ACTIVITY-mode quests get a "Naplózz" chip next to the reroll chip; the card owns the sheet state:

```tsx
const [activityQuest, setActivityQuest] = useState<DailyQuest | null>(null)
// in the per-quest row, before the reroll chip:
{q.status === 'offered' && q.completionMode === 'ACTIVITY' && (
  <button className="chip notch-4" onClick={() => setActivityQuest(q)}>Naplózz</button>
)}
// after the rows:
{activityQuest && <ActivityLogSheet quest={activityQuest} onClose={() => setActivityQuest(null)} />}
```

- [ ] **Step 4: TodayPage** — render `<ActivityLogCard />` directly under `<DailyQuestsCard />`.

- [ ] **Step 5: Tests**
- `ActivityLogSheet.test.tsx` (mock the barrel like `DailyQuestsCard.test.tsx` does with `vi.hoisted` + `vi.mock('@/data/hooks')`; wrap in `LevelUpProvider`): (a) compose→submit calls `logActivity` and shows the returned category + XP; (b) low-confidence result switches to the picker (8 chips) and `categorize` fires with the picked key; (c) quest prop renders the quest banner; (d) completedQuest in the result renders the "Küldetés teljesítve" row.
- `ActivityLogCard.test.tsx`: renders seed rows (mocked `useActivities`), "Besorolás?" chip only on the uncategorized entry, "+ Bejegyzés" opens the sheet.
- `DailyQuestsCard.test.tsx`: extend the fixture quests with `completionMode` (fixing the type error), add a GROWTH/ACTIVITY offered quest and assert the "Naplózz" chip appears (and does NOT on derived quests). Update the done-count assertion if it hardcodes `/2`.

- [ ] **Step 6: Verify both modes + build**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: PASS ×3.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/today frontend/src/data
git -c core.hooksPath=/dev/null commit -m "feat(fe/today): ActivityLogSheet + ActivityLogCard + activity-quest affordance (mezo-jzca)"
```

---

### Task 10: FE Me — GrowthCard (LIFE octagon + trait meters)

**Files:**
- Create: `frontend/src/features/me/components/GrowthCard.tsx` (+ `GrowthCard.test.tsx`)
- Modify: `frontend/src/features/me/pages/ProfilePage.tsx`

**Interfaces:**
- Consumes: `profile.life` + `profile.traits` (regenerated `ProgressionProfileResponse`), `radarGeometry` helpers (`radarMax`, `polarPoint`, `polygonPoints`, `dataPolygonPoints` — already N-axis capable), `LIFE_SKILLS` from levelUpMeta, CSS classes `.progress-radar-*` / `.progress-mrow` family (see `AthleticRadarCard` + `MuscleLevelsCard`).

- [ ] **Step 1: GrowthCard** — same card chrome as `AthleticRadarCard` (`card notch-12`, left gradient accent, eyebrow header "Growth — LIFE", `useReducedMotion` gating):
- Values: `const life = profile.life ?? []`, ordered by `LIFE_SKILLS` (`LIFE_SKILLS.map(s => life.find(l => l.skillKey === s.key))`, missing → level 1).
- **Ghost branch** when `life.every(s => (s?.cumulativeXp ?? 0) === 0)`: BiometricCard-style prompt card — eyebrow "Growth — LIFE", title "Az élet is edzés.", copy "Jegyezd fel az első tevékenységed a Ma nézetben — olvasás, főzés, egy hívás — és elindul a nyolc LIFE skilled." (mirror the AthleticRadarCard ghost markup).
- **Octagon**: 248×248 SVG, `CX=CY=124, R=88`, rings `[1, 0.66, 0.33]` via `polygonPoints(CX, CY, R*f, 8)`; data polygon `dataPolygonPoints(CX, CY, R, values, radarMax(values))` where `values` = the 8 levels; axis labels = `LIFE_SKILLS[i].icon` (emoji labels — 8 text abbreviations won't fit) placed at `polarPoint(CX, CY, R + 16, i, 8)` with `anchorFor(i, 8)` copied from AthleticRadarCard; include the `sr-only` sentence listing skill names + levels and `aria-hidden` on the SVG.
- **Top skills**: top 3 of `life` by `(level, cumulativeXp)` desc as `.progress-mrow` rows — `LIFE_SKILLS` icon+name, `Lv{level}`, bar fill `progressPct`.
- **Trait meters** (below, `.progress-mrow` reuse): row "Fegyelem" — value `traits.disciplinePct == null ? '–' : traits.disciplinePct + '%'`, bar width `disciplinePct ?? 0`%; row "Következetesség" — value `${traits.consistencyWeeks} hét`, bar width `min(consistencyWeeks, 12)/12*100`%. Sub-caption (text-tertiary, 10–11px): "A számaid mondják ki — nem önbevallás." (ADR 0010 §4 mirrored back).

- [ ] **Step 2: ProfilePage** — import + render `<GrowthCard profile={progression} />` after `<MuscleLevelsCard …/>` in the card column.

- [ ] **Step 3: GrowthCard.test.tsx** — mirror `MuscleLevelsCard`/`AthleticRadarCard` test style: (a) populated profile (use the extended `progressionProfileMock`) renders 8 axis labels, the top-3 skill rows (learning first), "78%" and "5 hét"; (b) all-zero `life` renders the ghost prompt; (c) `disciplinePct: null` renders "–".

- [ ] **Step 4: Verify both modes + build**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: PASS ×3.

- [ ] **Step 5: VISUAL verification (mandatory — memory: mezo-verify-ui-by-running-app):** run `cd frontend && VITE_USE_MOCK=true pnpm dev` (port 5180) and screenshot with the browser tooling: (a) Today — quests card with the GROWTH "Naplózz" chip + ActivityLogCard rows; (b) the sheet compose + picker phases; (c) Me — GrowthCard octagon + trait meters (scroll below MuscleLevelsCard). Check against the house card language (spacing, eyebrow, chips); fix obvious layout breakage before committing. Kill the dev server afterwards.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/me
git -c core.hooksPath=/dev/null commit -m "feat(fe/me): GrowthCard — LIFE octagon radar + computed trait meters (mezo-jzca)"
```

---

### Task 11: Docs + gates + PR + merge

**Files:**
- Modify: `docs/features/growth.md` (major update), `docs/features/me.md`, `docs/features/today.md`, `docs/milestones/roadmap.md`

- [ ] **Step 1: `docs/features/growth.md`** — update in place (living doc): §1–2 now describe 3 slots + the activity log loop; §3 add the activity flow (classifier → clamps/caps → award → quest synergy) + trait computation (ports, TraitCalculator semantics incl. the mid-week grace + the move-XP override trade-off); §4 add `activity_log` DDL summary + the 3 endpoints + profile `life[]`/`traits`; §5 integrations (companion cheap tier + fake sentinel `[fake-activity:{…}]`, meal `own_recipe_meal` signal, progression `SOURCE_ACTIVITY`); §6–7 how to add LIFE skills / GROWTH catalog entries / new derived metrics; §8 new ITs + FE tests; §9 gotchas (XP move keeps the original event payload; uncategorized = no XP until pick; caps make bad-faith logging economically irrelevant) + deferred (savings E3, adaptive difficulty E3, coins E4); §10 key files + update frontmatter `key_files` (add `feature/activity`, `data/activity`, `GrowthCard.tsx`, `ActivityLogSheet.tsx`) and `updated:`.
- [ ] **Step 2: `docs/features/me.md`** — §2 GrowthCard behavior (octagon, traits, ghost), §4 profile response life/traits fields, §5 growth-domain integration pointer, §10 key files += GrowthCard.
- [ ] **Step 3: `docs/features/today.md`** — §2 ActivityLogCard + sheet + quest affordance, §5 integration pointer to growth.md, §10 key files += the two new components.
- [ ] **Step 4: `docs/milestones/roadmap.md`** — append the E2 landing entry after the E1 row (same style: date, bd id, epic, one-paragraph summary, "Next: E3 …").
- [ ] **Step 5: Lint docs**: `node scripts/lint-docs.mjs` → 0 errors (fixes staleness flags on the three feature docs).
- [ ] **Step 6: Commit docs**

```bash
git add docs
git -c core.hooksPath=/dev/null commit -m "docs(features): growth/me/today living docs + roadmap for E2 growth layer (mezo-jzca)"
```

- [ ] **Step 7: Focused backend gate** (full suite is CI's job):

```bash
cd backend && ./mvnw clean test -Dtest='Activity*,Quest*,Progression*,ProfileTraitsIT,Workout*,ArchitectureTest' -DargLine=-Xmx3g
```
Expected: PASS.

- [ ] **Step 8: FE full gate**: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → PASS ×3.

- [ ] **Step 9: Push + self-PR + CI**

```bash
git push -u origin feat/quest-growth
gh pr create --title "E2 — Growth layer: LIFE band + activity log + AI classification + GROWTH quests + GrowthCard (mezo-jzca)" --body "$(cat <<'EOF'
## Summary
- Full 8-skill LIFE band + profile life[] + computed discipline/consistency traits
- New feature/activity domain: free-text log, companion cheap-tier AI classification, deterministic XP clamps/caps (ADR 0010), manual categorize/override with XP move
- GROWTH quest slot + activity-mode quests completing via matching activity entries (source_activity_id)
- FE: ActivityLogSheet + ActivityLogCard on Today, DailyQuestsCard "Naplózz" affordance, Me GrowthCard (LIFE octagon + trait meters)

Spec: docs/superpowers/specs/2026-07-11-gamified-growth-quests-design.md §10 E2 · Plan: docs/superpowers/plans/2026-07-11-gamified-growth-e2-growth-layer.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr checks --watch
```
Expected: all checks green (backend full IT suite, FE both modes, lint, contract-drift). Known flakes: mezo-91rw (`window is not defined` post-teardown in ActiveWorkoutPage.test), mezo-k7d (CheckInSheet leaked setTimeout) — a failure matching EXACTLY those signatures → rerun (`gh run rerun <id> --failed`), anything else → fix.

- [ ] **Step 10: Merge + close out** (worktree flow — memory: mezo-worktree-landing-via-gh-pr-merge)

```bash
gh pr merge --merge   # remote merge commit ≈ --no-ff; PR closes, branch delete on remote
git fetch origin && git log --oneline -3 origin/main   # verify the merge landed
git push origin --delete feat/quest-growth 2>/dev/null || true
```
Then from the MAIN checkout (`cd /Users/daniel.kuhne/MrKuhne/mezo`): `bd close mezo-jzca` + `bd update mezo-jzca --notes="..."` handoff note + `bd dolt push`. Check whether closing the child auto-closes the umbrella epic `mezo-52vz` — if bd auto-closes it, REOPEN it (E3/E4 remain): `bd update mezo-52vz --status=open`. Update its NOTES to point at E3 as next.

## Self-review notes (done at plan time)

- Spec coverage: §3 full LIFE band → Task 3; §5 activity log + guardrails + quest synergy + finance thin-slice extraction → Tasks 2/6/7 (savings *aggregate* correctly deferred to E3 per §10); §7 UI placements → Tasks 9/10 (octagon generalization confirmed: radarGeometry is already N-axis); §8 data model → Tasks 1/2; traits → Task 4; GROWTH slot → Task 5; §11 testing → per-task ITs + both FE modes.
- Type consistency: `ActivityWriteResponse.entry/completedQuest/levelUps` naming consistent across contract (Task 1), service (Task 7), FE wire mapping (Task 8), sheet consumption (Task 9). `completeMatchingActivityQuest` signature identical in Tasks 5 (producer) and 7 (consumer). `LIFE` ordering identical in Task 3 (taxonomy), Task 4 (profile), Task 8 (LIFE_SKILLS), Task 10 (octagon).
- Known judgment calls encoded: XP move on override adjusts skill rows without a new ledger event (documented gotcha); uncategorized entries carry 0 XP until categorization; the running week can't break the consistency streak; discipline is null (not 0) without commitments; ACTIVITY quests expire like derived ones.
