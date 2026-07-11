# Gamified Growth E1 — Quest Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the daily-quest core: a `feature/quest` backend domain (deterministic catalog-driven daily quests, BODY + FUELBIO slots, derived completion, reroll, XP via the existing progression award tail) + the Today `DailyQuestsCard`, behind a new feature switch.

**Architecture:** New `feature/quest` package modeled on the workout-challenge feature (lazy generation on GET + cron backstop, honest empty, switch-gated). XP flows through a new public `ProgressionService.applyQuest(...)` into the existing idempotent `award(...)` tail with a new `QUEST` source. One migration creates `daily_quest` and relaxes two CHECKs (`level_up_event.source_type` += `QUEST`; `skill_progress.skill_kind` += `LIFE` with a single `recovery` LIFE skill — FUELBIO quests cannot route to `robustness` because the award tail recomputes it to an absolute streak target and would wipe quest XP).

**Tech Stack:** Spring Boot 4 / Java 21 / Maven; PostgreSQL + Liquibase; MapStruct + Lombok; OpenAPI contract-first codegen; React 19 + TanStack Query + MSW/Vitest.

**Driving bd issue:** `mezo-df7q` (child of umbrella epic `mezo-52vz`). Spec: `docs/superpowers/specs/2026-07-11-gamified-growth-quests-design.md`.

## Global Constraints

- Base package `io.mrkuhne.mezo`; new code in `feature/quest/{controller,service,repository,entity,dto,mapper}` + `feature/quest/config`.
- UUID PKs (`gen_random_uuid()`), `created_by` set server-side from `CurrentUserId`, soft delete via `@SQLDelete`/`@SQLRestriction`, jsonb as typed envelope (`@JdbcTypeCode(SqlTypes.JSON)`).
- Contract-first: edit `api/feature/quest/quest.yml` + register in `api/generate/merge.yml` BEFORE backend code; backend implements generated `QuestApi`, uses `io.mrkuhne.mezo.api.dto` models; never hand-write boundary DTOs.
- Config only under `mezo:` — switch `mezo.feature.quest.enabled` (+ `FeaturesConfiguration` constant + `@ConditionalOnProperty`), tunables in `@Validated` `QuestProperties` record (prefix `mezo.quest`), **never `@Value`**. No `matchIfMissing`.
- Liquibase: one new script `202607111300_mezo-df7q_create_daily_quest.sql` under `db/changelog/1.0.0/script/`, registered in `1.0.0/1.0.0_master.yml`; explicit constraint names (`pk_/fk_/uq_/ck_/idx_`); never modify released changesets.
- Errors: `SystemRuntimeErrorException` + `SystemMessage.error("CODE")` + `messages.properties` line; no hardcoded user text.
- Tests integration-first: extend `AbstractIntegrationTest`/`ApiIntegrationTest`, data via populators, `test{Method}_should{Result}_when{Condition}`, AssertJ only, no mocks/H2. New table → `ResetDatabase` TRUNCATE list; new aggregate → new populator + `@Import` entry.
- Maven: ALWAYS `./mvnw clean test ...` (Lombok+MapStruct incremental is flaky). On the 16 GB dev box run only focused tests: `-Dtest=<Class>` + `-DargLine=-Xmx3g`; the full suite is CI's job (self-PR gate).
- Frontend: hooks only via `@/data/hooks` barrel; dual-mode via `useDualQuery` / mock-vs-real mutation split; deep absolute `@/*` imports, no new barrels, colocated tests; both test modes must stay green.
- UI copy: Hungarian, identity-vote phrasing, benefit-first; XP band 15–40/quest; no failure-state styling (expired = quiet).
- Commits: conventional subject + `(mezo-df7q)`. In a worktree commit with `git -c core.hooksPath=/dev/null commit ...` (the bd pre-commit hook would stage `.beads/`).
- Branch: `feat/quest-core` cut from up-to-date `origin/main`; cherry-pick the spec commit `27fa0323` from `independent-scratch` first.

## File Structure

**Backend (new):**
- `backend/src/main/resources/db/changelog/1.0.0/script/202607111300_mezo-df7q_create_daily_quest.sql` — table + CHECK relaxes
- `backend/src/main/java/io/mrkuhne/mezo/feature/quest/entity/DailyQuestEntity.java` + `QuestTargetEnvelope.java`
- `.../feature/quest/repository/DailyQuestRepository.java`
- `.../feature/quest/QuestCatalog.java` + `backend/src/main/resources/content/quest-catalog.json`
- `.../feature/quest/service/QuestSelector.java` — deterministic generation/replacement
- `.../feature/quest/service/QuestEvaluator.java` — derived-metric checks
- `.../feature/quest/service/QuestService.java` — GET orchestration + reroll
- `.../feature/quest/service/QuestJob.java` — morning generate + nightly finalize crons
- `.../feature/quest/controller/QuestController.java`
- `.../feature/quest/mapper/QuestMapper.java` + `QuestDisplay.java`
- `.../feature/quest/config/QuestProperties.java`
- `.../feature/progression/quest/QuestSignal.java`

**Backend (modified):**
- `ProgressionService.java` — `SOURCE_QUEST` + public `applyQuest(...)`
- `ProgressionTaxonomy.java` — `LIFE` list (`recovery`)
- `techcore/configuration/FeaturesConfiguration.java` — `QUEST_SWITCH`, `QUEST_JOB_SWITCH`
- `feature/train/service/WorkoutService.java` — extract `findPlannedTemplateForDate(...)`
- `application.yml` — switches + `mezo.quest` block
- `messages.properties` — quest error codes
- Test infra: `ResetDatabase.java`, `AbstractIntegrationTest.java`, new `support/populator/QuestPopulator.java`

**Contract:** `api/feature/quest/quest.yml` (new), `api/generate/merge.yml` (+1 input line)

**Frontend (new):** `data/quest/questApi.ts`, `data/quest/questMock.ts`, `data/quest/questHooks.ts` (+tests), `features/today/components/DailyQuestsCard.tsx` (+test)

**Frontend (modified):** `data/types.ts`, `data/hooks.ts`, `data/_client/api.gen.ts` (regen), `features/today/pages/TodayPage.tsx`, `features/progression/logic/levelUpMeta.ts`, `test/msw/handlers.ts`

**Docs:** `docs/decisions/0010-gamified-growth-xp-feedback-not-payment.md` (new ADR), spec staging amendment, `docs/features/growth.md` (new), `docs/features/today.md` (update)

---

### Task 1: Branch setup + ADR + spec amendment

**Files:**
- Create: `docs/decisions/0010-gamified-growth-xp-feedback-not-payment.md`
- Modify: `docs/superpowers/specs/2026-07-11-gamified-growth-quests-design.md` (§10 E1 row)

**Interfaces:** Produces the branch every later task commits to.

- [ ] **Step 1: Cut the branch**

```bash
git fetch origin && git checkout -b feat/quest-core origin/main
git cherry-pick 27fa0323   # the spec commit from independent-scratch
```

- [ ] **Step 2: Write the ADR** — create `docs/decisions/0010-gamified-growth-xp-feedback-not-payment.md`:

```markdown
# ADR 0010 — Gamified growth: XP is feedback, not payment

- **Status:** accepted · 2026-07-11
- **Driving issue:** mezo-df7q (epic mezo-52vz)
- **Context:** The Phase-3 mapping (roadmap 2026-07-03) parked an "XP-vs-narrative tension":
  the companion philosophy is "a try maga a jutalom" (no FOMO, no penalty), while the old
  Phase-7 idea was a motivation/XP system. The gamified-growth spec
  (`docs/superpowers/specs/2026-07-11-gamified-growth-quests-design.md`) now expands XP from
  workouts to daily quests and (E2) life activities, so the tension must be resolved.

## Decision

1. **XP is feedback, not payment.** XP certifies that a real-life action happened; quest copy
   names the real-life benefit first, XP second. No XP-gated content, ever.
2. **Quests are offers.** No accept ceremony, no penalty; an uncompleted quest silently
   expires (status `expired`, no failure styling). One reroll/day preserves autonomy.
3. **Economy proportions guard intrinsic motivation.** Quest XP is 15–40 per quest
   (≈10–15% of weekly XP potential); workouts stay the primary source. Amounts are config
   under `mezo.quest`/catalog, never code.
4. **Traits are computed, never self-claimed.** Discipline/consistency are derived from the
   ledger (E2); there is no "do a discipline" quest.
5. **Ethical boundary.** No loot boxes, no variable-reward gambling, no countdowns, no
   loss-aversion mechanics, never pay-to-win or real money. Coins ship only with a shop (E4);
   XP is never spendable.
6. **One economy.** No parallel player-XP currency: quests/activities feed the same
   `skill_progress` bands (ATHLETIC/MUSCLE now, LIFE from E1's `recovery` onward) through the
   idempotent `award(...)` tail with new sources `QUEST` (and `ACTIVITY` in E2).

## Consequences

- `level_up_event.source_type` CHECK gains `QUEST` (E1) and `ACTIVITY` (E2).
- `skill_progress.skill_kind` CHECK gains `LIFE` in E1 (first LIFE skill: `recovery`),
  because quest XP must not route to `robustness` — the award tail recomputes robustness to
  an absolute streak target and would erase additive quest XP.
- The narrative voice keeps ownership of copy; LLMs may later rewrite quest flavor copy but
  never targets or XP amounts.
```

- [ ] **Step 3: Amend the spec staging table** — in `docs/superpowers/specs/2026-07-11-gamified-growth-quests-design.md` replace the E1 row's content cell text `ADR (XP-vs-narrative resolution) + \`feature/quest\` + catalog + selection/evaluation + *derived* quests on existing skills + Today \`DailyQuestsCard\` + reroll + XP wiring` with the same text plus: `+ LIFE kind CHECK relax with a single \`recovery\` skill (FUELBIO XP routing — robustness is recomputed absolutely and cannot carry quest XP; full LIFE band stays E2)`. Also ship BODY+FUELBIO slots only in E1 — append to the same cell: `(BODY + FUELBIO slots; GROWTH slot activates in E2)`.

- [ ] **Step 4: Commit**

```bash
git add docs/decisions/0010-gamified-growth-xp-feedback-not-payment.md docs/superpowers/specs/2026-07-11-gamified-growth-quests-design.md
git -c core.hooksPath=/dev/null commit -m "docs(adr): ADR 0010 XP-is-feedback + E1 staging amendment (mezo-df7q)"
```

---

### Task 2: API contract — quest.yml + merge + FE type regen

**Files:**
- Create: `api/feature/quest/quest.yml`
- Modify: `api/generate/merge.yml` (add input), `api/openapi.yml` (generated), `frontend/src/data/_client/api.gen.ts` (generated)

**Interfaces:**
- Produces (consumed by Tasks 9–13): tag `Quest` → generated `io.mrkuhne.mezo.api.controller.QuestApi` with `getQuestDay(LocalDate date)` → `QuestDayResponse` and `rerollQuest(UUID id)` → `QuestResponse`; api.dto models `QuestResponse`, `QuestDayResponse`; FE `paths['/api/quest/day/{date}']['get']` + `paths['/api/quest/{id}/reroll']['post']`.
- `LevelUpResult` is `$ref`'d from `api/common/common-schemas.yml` (already merged into the same document).

- [ ] **Step 1: Write `api/feature/quest/quest.yml`**

```yaml
openapi: 3.0.3
info: { title: mezo quest fragment, version: 1.0.0 }
paths:
  /api/quest/day/{date}:
    get:
      tags: [Quest]
      operationId: getQuestDay
      summary: The day's daily quests (lazy-generates for today; evaluates derived completion) (Quests)
      description: >-
        Returns the day's quests (rerolled rows excluded). Lazily generates when none exist and
        date == today; lazily evaluates offered derived quests (completing them awards XP through
        progression — completions surface in levelUps); offered quests of past days expire quietly.
        An empty quests array is the honest empty state (never a 404).
      parameters:
        - name: date
          in: path
          required: true
          schema: { type: string, format: date }
      responses:
        '200':
          description: The day's quests + any level-up payloads produced by this evaluation
          content:
            application/json:
              schema: { $ref: '#/components/schemas/QuestDayResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/quest/{id}/reroll:
    post:
      tags: [Quest]
      operationId: rerollQuest
      summary: Replace one of today's offered quests with the next eligible catalog candidate (Quests)
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: The replacement quest
          content:
            application/json:
              schema: { $ref: '#/components/schemas/QuestResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Quest not found (or owned by someone else)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '409':
          description: Quest not offered / not today / daily reroll cap reached / no alternative left
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    QuestResponse:
      type: object
      required: [id, questDate, slot, skillKey, title, why, targetLabel, xp, status]
      properties:
        id: { type: string, format: uuid }
        questDate: { type: string, format: date }
        slot: { type: string, description: 'BODY | FUELBIO | GROWTH' }
        skillKey: { type: string, description: Progression skill the XP routes to }
        title: { type: string, description: HU identity-vote quest title }
        why: { type: string, description: HU benefit-first rationale }
        targetLabel: { type: string, description: Code-derived display string of the structured target }
        xp: { type: integer, format: int32 }
        status: { type: string, description: 'offered | completed | expired | rerolled' }
        completedAt: { type: string, format: date-time, nullable: true }
    QuestDayResponse:
      type: object
      required: [date, quests, levelUps, rerollsLeft]
      properties:
        date: { type: string, format: date }
        quests:
          type: array
          items: { $ref: '#/components/schemas/QuestResponse' }
        levelUps:
          type: array
          description: One entry per quest completed by THIS evaluation pass (idempotent — re-reads return [])
          items: { $ref: '#/components/schemas/LevelUpResult' }
        rerollsLeft: { type: integer, format: int32 }
```

- [ ] **Step 2: Register the fragment** — in `api/generate/merge.yml` add after the proactive line:

```yaml
  - inputFile: ../feature/quest/quest.yml
```

- [ ] **Step 3: Merge + regenerate FE types**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```
Expected: `api/openapi.yml` gains the two paths; `frontend/src/data/_client/api.gen.ts` gains `QuestResponse`/`QuestDayResponse` schemas. (Backend `QuestApi` regenerates automatically during `./mvnw clean test` in Task 3+.)

- [ ] **Step 4: Commit**

```bash
git add api/feature/quest/quest.yml api/generate/merge.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(api): quest contract fragment — day read + reroll (mezo-df7q)"
```

---

### Task 3: Migration + entity + repository + test-infra wiring

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607111300_mezo-df7q_create_daily_quest.sql`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/quest/entity/DailyQuestEntity.java`, `.../entity/QuestTargetEnvelope.java`, `.../repository/DailyQuestRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/QuestPopulator.java`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`, `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`, `.../support/AbstractIntegrationTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/quest/DailyQuestEntityIT.java`

**Interfaces:**
- Produces: `DailyQuestEntity` (constants `SLOT_BODY|SLOT_FUELBIO|SLOT_GROWTH`, `STATUS_OFFERED|STATUS_COMPLETED|STATUS_EXPIRED|STATUS_REROLLED`, `MODE_DERIVED|MODE_ACTIVITY`; fields `questDate, slot, catalogKey, skillKey, skillKind, title, why, completionMode, target, xp, coins, status, completedAt, sourceActivityId, generatedAt`), `QuestTargetEnvelope(String metric, BigDecimal threshold)`, `DailyQuestRepository` (methods below), `QuestPopulator.quest(...)`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** daily_quest DDL + jsonb envelope + partial-unique reroll identity (mezo-df7q). */
class DailyQuestEntityIT extends AbstractIntegrationTest {

    @Autowired private QuestPopulator questPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DailyQuestRepository repository;

    @Test
    void testSave_shouldRoundTripJsonbTarget_whenPersisted() {
        UUID owner = userPopulator.createUser("quest-a@test.hu").getId();
        DailyQuestEntity saved = questPopulator.quest(owner, LocalDate.of(2026, 7, 11),
            DailyQuestEntity.SLOT_FUELBIO, "bio_water", "recovery", "LIFE",
            "water_target", new BigDecimal("2500"), 15, DailyQuestEntity.STATUS_OFFERED);

        DailyQuestEntity found = repository.findByIdAndCreatedBy(saved.getId(), owner).orElseThrow();
        assertThat(found.getTarget().metric()).isEqualTo("water_target");
        assertThat(found.getTarget().threshold()).isEqualByComparingTo("2500");
        assertThat(found.getCoins()).isZero();
    }

    @Test
    void testSave_shouldAllowSecondRowInSlot_whenFirstIsRerolled() {
        UUID owner = userPopulator.createUser("quest-b@test.hu").getId();
        LocalDate d = LocalDate.of(2026, 7, 11);
        questPopulator.quest(owner, d, DailyQuestEntity.SLOT_BODY, "body_gym_done",
            "strength_endurance", "ATHLETIC", "gym_session_done", null, 25,
            DailyQuestEntity.STATUS_REROLLED);
        questPopulator.quest(owner, d, DailyQuestEntity.SLOT_BODY, "body_rest_sleep",
            "recovery", "LIFE", "sleep_target", new BigDecimal("7.5"), 20,
            DailyQuestEntity.STATUS_OFFERED);

        assertThat(repository.findByCreatedByAndQuestDateOrderBySlotAsc(owner, d)).hasSize(2);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=DailyQuestEntityIT -DargLine=-Xmx3g`
Expected: FAIL — compilation error (`DailyQuestEntity` does not exist).

- [ ] **Step 3: Write the migration** — `202607111300_mezo-df7q_create_daily_quest.sql`:

```sql
-- Daily quests (bd mezo-df7q, E1 of gamified growth mezo-52vz): catalog-driven daily side quests,
-- BODY/FUELBIO slots in E1 (GROWTH activates in E2). Identity = (created_by, quest_date, slot)
-- among non-rerolled rows (partial unique — a reroll replaces the row in the same slot).
-- Also relaxes two released CHECKs additively: level_up_event.source_type += QUEST (quest XP rides
-- the idempotent award tail) and skill_progress.skill_kind += LIFE (first LIFE skill: recovery —
-- robustness is recomputed to an absolute streak target and cannot carry quest XP).

alter table level_up_event drop constraint ck_level_up_event_source_type;
alter table level_up_event add constraint ck_level_up_event_source_type
    check (source_type in ('GYM', 'SPORT', 'RUN', 'QUEST'));

alter table skill_progress drop constraint ck_skill_progress_kind;
alter table skill_progress add constraint ck_skill_progress_kind
    check (skill_kind in ('ATHLETIC', 'MUSCLE', 'LIFE'));

create table daily_quest (
    id                 uuid          not null default gen_random_uuid(),
    created_by         uuid          not null,
    is_deleted         boolean       not null default false,
    created_at         timestamptz   not null default now(),
    quest_date         date          not null,
    slot               varchar(8)    not null,
    catalog_key        varchar(60)   not null,
    skill_key          varchar(40)   not null,
    skill_kind         varchar(10)   not null,
    title              varchar(160)  not null,
    why                text          not null,
    completion_mode    varchar(10)   not null default 'DERIVED',
    target             jsonb         not null,
    xp                 integer       not null,
    coins              integer       not null default 0,
    status             varchar(10)   not null default 'offered',
    completed_at       timestamptz,
    source_activity_id uuid,
    generated_at       timestamptz   not null,
    constraint pk_daily_quest_id primary key (id),
    constraint fk_daily_quest_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_daily_quest_slot check (slot in ('BODY', 'FUELBIO', 'GROWTH')),
    constraint ck_daily_quest_skill_kind check (skill_kind in ('ATHLETIC', 'MUSCLE', 'LIFE')),
    constraint ck_daily_quest_completion_mode check (completion_mode in ('DERIVED', 'ACTIVITY')),
    constraint ck_daily_quest_status check (status in ('offered', 'completed', 'expired', 'rerolled')),
    constraint ck_daily_quest_xp check (xp >= 0)
);

create index idx_daily_quest_user_date on daily_quest (created_by, quest_date) where is_deleted = false;
create unique index uq_daily_quest_user_date_slot on daily_quest (created_by, quest_date, slot)
    where is_deleted = false and status <> 'rerolled';
```

- [ ] **Step 4: Register the changeset** — append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202607111300_mezo-df7q_create_daily_quest"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607111300_mezo-df7q_create_daily_quest.sql
```

- [ ] **Step 5: Entity + envelope + repository**

`QuestTargetEnvelope.java`:
```java
package io.mrkuhne.mezo.feature.quest.entity;

import java.math.BigDecimal;

/** Typed jsonb envelope for a quest's structured target (metric key + optional numeric threshold). */
public record QuestTargetEnvelope(String metric, BigDecimal threshold) {
}
```

`DailyQuestEntity.java`:
```java
package io.mrkuhne.mezo.feature.quest.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One daily side quest (gamified growth E1, bd mezo-df7q): catalog-selected per (user, date, slot),
 * derived completion evaluated from already-logged data (never self-claimed in E1). Identity =
 * (created_by, quest_date, slot) among non-rerolled rows; a reroll marks the old row rerolled and
 * inserts the replacement into the same slot. An uncompleted quest of a past day expires quietly
 * (ADR 0010 — no failure state).
 */
@Getter
@Setter
@Entity
@Table(name = "daily_quest")
@SQLDelete(sql = "update daily_quest set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class DailyQuestEntity extends OwnedEntity {

    public static final String SLOT_BODY = "BODY";
    public static final String SLOT_FUELBIO = "FUELBIO";
    public static final String SLOT_GROWTH = "GROWTH";
    public static final String STATUS_OFFERED = "offered";
    public static final String STATUS_COMPLETED = "completed";
    public static final String STATUS_EXPIRED = "expired";
    public static final String STATUS_REROLLED = "rerolled";
    public static final String MODE_DERIVED = "DERIVED";
    public static final String MODE_ACTIVITY = "ACTIVITY";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "quest_date", nullable = false)
    private LocalDate questDate;

    @NotNull
    @Column(nullable = false)
    private String slot;

    @NotNull
    @Column(name = "catalog_key", nullable = false)
    private String catalogKey;

    @NotNull
    @Column(name = "skill_key", nullable = false)
    private String skillKey;

    @NotNull
    @Column(name = "skill_kind", nullable = false)
    private String skillKind;

    @NotNull
    @Column(nullable = false)
    private String title;

    @NotNull
    @Column(nullable = false)
    private String why;

    @NotNull
    @Column(name = "completion_mode", nullable = false)
    private String completionMode = MODE_DERIVED;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private QuestTargetEnvelope target;

    @NotNull
    @Column(nullable = false)
    private Integer xp;

    @NotNull
    @Column(nullable = false)
    private Integer coins = 0;

    @NotNull
    @Column(nullable = false)
    private String status = STATUS_OFFERED;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "source_activity_id")
    private UUID sourceActivityId;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
```

`DailyQuestRepository.java`:
```java
package io.mrkuhne.mezo.feature.quest.repository;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DailyQuestRepository extends JpaRepository<DailyQuestEntity, UUID> {

    /** The day-card read: every row of the day incl. rerolled (service filters for display). */
    List<DailyQuestEntity> findByCreatedByAndQuestDateOrderBySlotAsc(UUID createdBy, LocalDate questDate);

    /** The reroll path's owned lookup. */
    Optional<DailyQuestEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);

    /** Daily reroll-cap count. */
    int countByCreatedByAndQuestDateAndStatus(UUID createdBy, LocalDate questDate, String status);

    /** Cooldown window read (selector filters per-key cooldownDays in code). */
    List<DailyQuestEntity> findByCreatedByAndQuestDateGreaterThanEqual(UUID createdBy, LocalDate from);

    /** Nightly finalize backstop: offered rows whose day has passed. */
    List<DailyQuestEntity> findByCreatedByAndStatusAndQuestDateBefore(UUID createdBy, String status, LocalDate before);
}
```

- [ ] **Step 6: Populator + reset wiring**

`QuestPopulator.java`:
```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.entity.QuestTargetEnvelope;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code daily_quest} rows (gamified growth E1, bd mezo-df7q). */
@TestComponent
@RequiredArgsConstructor
public class QuestPopulator {

    private final DailyQuestRepository repository;

    public DailyQuestEntity quest(UUID createdBy, LocalDate questDate, String slot, String catalogKey,
                                  String skillKey, String skillKind, String metric, BigDecimal threshold,
                                  int xp, String status) {
        DailyQuestEntity e = new DailyQuestEntity();
        e.setCreatedBy(createdBy);
        e.setQuestDate(questDate);
        e.setSlot(slot);
        e.setCatalogKey(catalogKey);
        e.setSkillKey(skillKey);
        e.setSkillKind(skillKind);
        e.setTitle("Teszt küldetés");
        e.setWhy("Teszt indoklás.");
        e.setTarget(new QuestTargetEnvelope(metric, threshold));
        e.setXp(xp);
        e.setStatus(status);
        e.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return repository.saveAndFlush(e);
    }
}
```

In `ResetDatabase.resetExceptMasterData()` prepend `daily_quest, ` to the TRUNCATE list (before `challenge,`). In `AbstractIntegrationTest` add `QuestPopulator.class` to the `@Import({...})` list (after `ChallengePopulator.class`).

- [ ] **Step 7: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=DailyQuestEntityIT -DargLine=-Xmx3g`
Expected: PASS (2 tests). This also proves the migration applies cleanly and the LIFE/QUEST CHECK relaxes don't break existing changesets.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/quest backend/src/test/java/io/mrkuhne/mezo/support backend/src/test/java/io/mrkuhne/mezo/feature/quest
git -c core.hooksPath=/dev/null commit -m "feat(quest): daily_quest table + entity/repo + CHECK relaxes (QUEST source, LIFE kind) (mezo-df7q)"
```

---

### Task 4: Quest catalog (master-data JSON + loader)

**Files:**
- Create: `backend/src/main/resources/content/quest-catalog.json`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/quest/QuestCatalog.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestCatalogIT.java`

**Interfaces:**
- Produces (consumed by Task 7): `QuestCatalog.all()` → `List<QuestDef>`; `record QuestDef(String key, String slot, String skillKey, String skillKind, String title, String why, String metric, BigDecimal threshold, int xp, int coins, int difficulty, List<String> dayTypes, boolean requiresGoalPrescription, int cooldownDays)`. Day types: `GYM|REST|ANY`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Catalog content loads, validates fail-fast, and stays inside the ADR-0010 XP band. */
class QuestCatalogIT extends AbstractIntegrationTest {

    @Autowired private QuestCatalog catalog;

    @Test
    void testLoad_shouldExposeBothSlots_whenContentLoaded() {
        assertThat(catalog.all()).isNotEmpty();
        assertThat(catalog.all()).extracting(QuestCatalog.QuestDef::slot)
            .contains("BODY", "FUELBIO");
        // ADR 0010: quest XP band 15–40
        assertThat(catalog.all()).allSatisfy(d -> assertThat(d.xp()).isBetween(15, 40));
        // E1: coins prepared but always 0 (unspendable currency is a broken promise)
        assertThat(catalog.all()).allSatisfy(d -> assertThat(d.coins()).isZero());
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=QuestCatalogIT -DargLine=-Xmx3g`
Expected: FAIL — compilation error (`QuestCatalog` does not exist).

- [ ] **Step 3: Write the catalog JSON** — `content/quest-catalog.json` (HU copy: identity votes, benefit first):

```json
[
  {
    "key": "body_gym_done", "slot": "BODY", "skillKey": "strength_endurance", "skillKind": "ATHLETIC",
    "title": "A mai tervezett edzés a naptárban van — csináld végig",
    "why": "A megjelenés a legerősebb identitás-szavazat: aki ma edz, az edző ember.",
    "metric": "gym_session_done", "threshold": null, "xp": 25, "coins": 0, "difficulty": 2,
    "dayTypes": ["GYM"], "requiresGoalPrescription": false, "cooldownDays": 0
  },
  {
    "key": "body_rest_sleep", "slot": "BODY", "skillKey": "recovery", "skillKind": "LIFE",
    "title": "Pihenőnap: aludj legalább 7,5 órát",
    "why": "A pihenőnap edzés — az alvás alatt épül az izom és áll helyre az idegrendszer.",
    "metric": "sleep_target", "threshold": 7.5, "xp": 20, "coins": 0, "difficulty": 2,
    "dayTypes": ["REST"], "requiresGoalPrescription": false, "cooldownDays": 0
  },
  {
    "key": "bio_checkin_full", "slot": "FUELBIO", "skillKey": "recovery", "skillKind": "LIFE",
    "title": "Mind a 4 heartbeat check-in ma",
    "why": "A napi 4 pillanatfelvétel az, amiből a mintáid kirajzolódnak — magadat figyeled meg.",
    "metric": "checkin_full", "threshold": 4, "xp": 20, "coins": 0, "difficulty": 2,
    "dayTypes": ["ANY"], "requiresGoalPrescription": false, "cooldownDays": 2
  },
  {
    "key": "bio_weight_log", "slot": "FUELBIO", "skillKey": "recovery", "skillKind": "LIFE",
    "title": "Reggeli súlymérés — logold be",
    "why": "Egy pont zaj, a sorozat trend: a reggeli rutinod adja a görbét, amiből a cél él.",
    "metric": "weight_logged", "threshold": null, "xp": 15, "coins": 0, "difficulty": 1,
    "dayTypes": ["ANY"], "requiresGoalPrescription": false, "cooldownDays": 2
  },
  {
    "key": "bio_water", "slot": "FUELBIO", "skillKey": "recovery", "skillKind": "LIFE",
    "title": "Igyál meg legalább 2,5 litert ma",
    "why": "A hidratáltság a legolcsóbb teljesítményfokozó — edzés, fókusz, étvágy mind rajta múlik.",
    "metric": "water_target", "threshold": 2500, "xp": 15, "coins": 0, "difficulty": 1,
    "dayTypes": ["ANY"], "requiresGoalPrescription": false, "cooldownDays": 2
  },
  {
    "key": "bio_protein", "slot": "FUELBIO", "skillKey": "recovery", "skillKind": "LIFE",
    "title": "Hozd be a heti recept fehérje-célját ma",
    "why": "A fehérje a heti recepted gerince — ma bevinni annyi, mint holnap erősebbnek lenni.",
    "metric": "protein_target", "threshold": null, "xp": 30, "coins": 0, "difficulty": 3,
    "dayTypes": ["ANY"], "requiresGoalPrescription": true, "cooldownDays": 3
  },
  {
    "key": "bio_sleep", "slot": "FUELBIO", "skillKey": "recovery", "skillKind": "LIFE",
    "title": "Aludj legalább 7,5 órát",
    "why": "7,5 óra alvás = a holnapi erőnléted, étvágy-kontrollod és hangulatod alapja.",
    "metric": "sleep_target", "threshold": 7.5, "xp": 25, "coins": 0, "difficulty": 2,
    "dayTypes": ["ANY"], "requiresGoalPrescription": false, "cooldownDays": 3
  }
]
```
Note: `bio_protein.threshold` is null in the catalog — the selector resolves it from the goal prescription's current segment at generation time. `body_rest_sleep`/`bio_sleep` share the `sleep_target` metric; the selector's distinct-metric rule prevents both on one day.

- [ ] **Step 4: Write the loader** — `QuestCatalog.java` (mirror of `PerkCatalog`, Jackson 3 `tools.jackson`):

```java
package io.mrkuhne.mezo.feature.quest;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Static quest content (catalog key → slot/skill/copy/metric/XP), loaded at startup from a
 * classpath JSON. In-memory master content (no table, no created_by) — the per-user offered
 * quests live in the daily_quest table. Invalid content fails startup fast (ADR 0010 band).
 */
@Component
@RequiredArgsConstructor
public class QuestCatalog {

    /** One quest as authored in content/quest-catalog.json. */
    public record QuestDef(String key, String slot, String skillKey, String skillKind,
        String title, String why, String metric, BigDecimal threshold, int xp, int coins,
        int difficulty, List<String> dayTypes, boolean requiresGoalPrescription, int cooldownDays) {}

    private static final Set<String> SLOTS = Set.of("BODY", "FUELBIO", "GROWTH");
    private static final Set<String> DAY_TYPES = Set.of("GYM", "REST", "ANY");

    private final ObjectMapper objectMapper; // SB4 Jackson 3 (tools.jackson)
    private List<QuestDef> defs = List.of();

    @jakarta.annotation.PostConstruct
    void load() {
        List<QuestDef> read = readContent();
        read.forEach(this::validate);
        defs = List.copyOf(read);
    }

    public List<QuestDef> all() {
        return defs;
    }

    private List<QuestDef> readContent() {
        try (InputStream in = new ClassPathResource("content/quest-catalog.json").getInputStream()) {
            return objectMapper.readValue(in,
                objectMapper.getTypeFactory().constructCollectionType(List.class, QuestDef.class));
        } catch (IOException e) {
            throw new IllegalStateException("content/quest-catalog.json is unreadable", e);
        }
    }

    private void validate(QuestDef d) {
        boolean valid = d.key() != null && !d.key().isBlank()
            && SLOTS.contains(d.slot())
            && d.skillKey() != null && !d.skillKey().isBlank()
            && Set.of("ATHLETIC", "MUSCLE", "LIFE").contains(d.skillKind())
            && d.title() != null && !d.title().isBlank()
            && d.why() != null && !d.why().isBlank()
            && d.metric() != null && !d.metric().isBlank()
            && d.xp() >= 15 && d.xp() <= 40
            && d.coins() == 0
            && d.dayTypes() != null && !d.dayTypes().isEmpty() && DAY_TYPES.containsAll(d.dayTypes())
            && d.cooldownDays() >= 0;
        if (!valid) {
            throw new IllegalStateException("Invalid quest-catalog item: key=" + d.key());
        }
    }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=QuestCatalogIT -DargLine=-Xmx3g`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/resources/content/quest-catalog.json backend/src/main/java/io/mrkuhne/mezo/feature/quest/QuestCatalog.java backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestCatalogIT.java
git -c core.hooksPath=/dev/null commit -m "feat(quest): quest catalog master data + fail-fast loader (mezo-df7q)"
```

---

### Task 5: `ProgressionService.applyQuest` + `QuestSignal` + LIFE taxonomy

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/quest/QuestSignal.java`
- Modify: `.../feature/progression/service/ProgressionService.java`, `.../feature/progression/ProgressionTaxonomy.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionQuestIT.java`

**Interfaces:**
- Consumes: existing private `award(...)` tail (idempotent on `(sourceType, sourceRefId)`).
- Produces (consumed by Task 9): `public LevelUpResult applyQuest(UUID createdBy, QuestSignal signal)`; `record QuestSignal(UUID questId, String skillKey, String skillKind, int xp, String label)`; `ProgressionTaxonomy.LIFE = List.of("recovery")`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.quest.QuestSignal;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Quest XP rides the idempotent award tail with source QUEST and may create LIFE skill rows. */
class ProgressionQuestIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testApplyQuest_shouldCreateLifeSkillRowAndBeIdempotent_whenAppliedTwice() {
        UUID owner = userPopulator.createUser("quest-xp@test.hu").getId();
        UUID questId = UUID.randomUUID();
        QuestSignal signal = new QuestSignal(questId, "recovery", "LIFE", 20, "Teszt küldetés");

        LevelUpResult first = progressionService.applyQuest(owner, signal);
        LevelUpResult second = progressionService.applyQuest(owner, signal);

        assertThat(first.source()).isEqualTo("QUEST");
        assertThat(first.gains()).hasSize(1);
        assertThat(first.gains().getFirst().skillKey()).isEqualTo("recovery");
        assertThat(first.gains().getFirst().kind()).isEqualTo("LIFE");
        assertThat(second.totalXp()).isEqualTo(first.totalXp()); // stored payload returned, no double award

        var row = skillProgressRepository.findByCreatedByAndSkillKey(owner, "recovery").orElseThrow();
        assertThat(row.getCumulativeXp()).isEqualTo(20);
        assertThat(row.getSkillKind()).isEqualTo("LIFE");
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionQuestIT -DargLine=-Xmx3g`
Expected: FAIL — compilation error (`QuestSignal` / `applyQuest` do not exist).

- [ ] **Step 3: Implement**

`QuestSignal.java` (sibling of `run/RunSignal.java`):
```java
package io.mrkuhne.mezo.feature.progression.quest;

import java.util.UUID;

/** Input of the quest XP grant: one completed daily quest routes xp to one skill (any band). */
public record QuestSignal(
    UUID questId,
    String skillKey,
    String skillKind,   // ATHLETIC | MUSCLE | LIFE
    int xp,
    String label        // quest title — shown as workoutLabel in the level-up overlay
) {}
```

In `ProgressionService.java`: add the constant next to the existing three sources, and the method after `applyRun`:
```java
    private static final String SOURCE_QUEST = "QUEST";
```
```java
    /** Quest completion → single-skill XP through the shared idempotent tail (source QUEST). */
    @Transactional
    public LevelUpResult applyQuest(UUID createdBy, QuestSignal signal) {
        Map<String, Long> deltas = new LinkedHashMap<>();
        Map<String, String> kinds = new LinkedHashMap<>();
        if (signal.xp() > 0) {
            deltas.put(signal.skillKey(), (long) signal.xp());
            kinds.put(signal.skillKey(), signal.skillKind());
        }
        return award(createdBy, SOURCE_QUEST, signal.questId(), deltas, kinds,
            signal.label(), null, null);
    }
```
(import `io.mrkuhne.mezo.feature.progression.quest.QuestSignal`.)

In `ProgressionTaxonomy.java` add after `MUSCLE`:
```java
    /** LIFE skills (gamified growth): E1 ships recovery only; the full band arrives in E2. */
    public static final List<String> LIFE = List.of("recovery");
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionQuestIT -DargLine=-Xmx3g`
Expected: PASS. Note: the robustness recompute inside `award(...)` also runs on quest awards — that is correct and idempotent (absolute streak target).

- [ ] **Step 5: Guard the existing suite (focused)**

Run: `cd backend && ./mvnw clean test -Dtest='Progression*' -DargLine=-Xmx3g`
Expected: PASS (existing progression ITs unaffected).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionQuestIT.java
git -c core.hooksPath=/dev/null commit -m "feat(progression): applyQuest — QUEST source + LIFE band seed (mezo-df7q)"
```

---

### Task 6: Day-type seam — extract `WorkoutService.findPlannedTemplateForDate`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java`

**Interfaces:**
- Produces (consumed by Task 7): `public Optional<WorkoutSessionEntity> findPlannedTemplateForDate(UUID createdBy, LocalDate date)` — the planned (date-less, `templateSessionId == null`) template session whose HU day label matches `date`'s weekday, from the active mesocycle; empty when no active meso or no session that day.

- [ ] **Step 1: Extract the helper** — in `WorkoutService`, `getToday` currently resolves today's template inline (the `HU_DAY_LABELS.get(...)` + `filter(s -> s.getTemplateSessionId() == null && todayLabel.equals(s.getDayLabel()))` block around lines 81–138). Add this public method and rewrite that block to call it:

```java
    /**
     * The planned (date-less) template session for a calendar date: active mesocycle + HU
     * day-label match. Quest generation (feature/quest) uses this as the day-type seam
     * (present → GYM day, absent → REST day), sharing getToday's resolution logic.
     */
    public Optional<WorkoutSessionEntity> findPlannedTemplateForDate(UUID createdBy, LocalDate date) {
        MesocycleEntity activeMeso = mesocycleRepository
            .findByCreatedByAndStatusAndDeletedFalse(createdBy, "active")
            .stream().findFirst().orElse(null);
        if (activeMeso == null) {
            return Optional.empty();
        }
        String dayLabel = HU_DAY_LABELS.get(date.getDayOfWeek().getValue() - 1);
        return workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(activeMeso.getId()))
            .stream()
            .filter(s -> s.getTemplateSessionId() == null && dayLabel.equals(s.getDayLabel()))
            .findFirst();
    }
```
In `getToday`, replace the inline active-meso + day-label lookup with `WorkoutSessionEntity day = findPlannedTemplateForDate(createdBy, LocalDate.now()).orElse(null);` — keep the rest of `getToday` (instance resolution, response assembly) unchanged. If `getToday` also needs the `activeMeso` after that block, keep its own meso lookup — extract only the template-matching part in that case:
adjust so behavior is byte-identical; the tests are the referee.

- [ ] **Step 2: Guard the train suite (focused)**

Run: `cd backend && ./mvnw clean test -Dtest='Workout*,Train*' -DargLine=-Xmx3g`
Expected: PASS — pure refactor, no behavior change.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java
git -c core.hooksPath=/dev/null commit -m "refactor(train): extract findPlannedTemplateForDate day-type seam (mezo-df7q)"
```

---

### Task 7: `QuestSelector` — deterministic generation + replacement

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/quest/service/QuestSelector.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestSelectorIT.java`

**Interfaces:**
- Consumes: `QuestCatalog.all()`, `DailyQuestRepository`, `WorkoutService.findPlannedTemplateForDate(...)`, `GoalRepository.findByCreatedByAndStatusAndDeletedFalse(UUID, String)`, `GoalPrescriptionJson.currentSegment(...)`.
- Produces (consumed by Tasks 9–10): `public List<DailyQuestEntity> generate(UUID userId, LocalDate date)` — persists ≤1 quest per slot (BODY, FUELBIO), deterministic for (user, date); `public Optional<DailyQuestEntity> replacement(UUID userId, DailyQuestEntity old, int salt)` — persists + returns the replacement for a rerolled quest, empty when no alternative.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.service.QuestSelector;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Deterministic catalog selection: slot composition, day-type filter, distinct metrics, cooldown. */
class QuestSelectorIT extends AbstractIntegrationTest {

    @Autowired private QuestSelector selector;
    @Autowired private UserPopulator userPopulator;
    @Autowired private io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository repository;

    private static final LocalDate DATE = LocalDate.of(2026, 7, 11);

    @Test
    void testGenerate_shouldPickRestBodyAndOneFuelBioWithDistinctMetrics_whenNoActiveMeso() {
        UUID owner = userPopulator.createUser("sel-a@test.hu").getId();

        List<DailyQuestEntity> quests = selector.generate(owner, DATE);

        assertThat(quests).hasSize(2);
        assertThat(quests).extracting(DailyQuestEntity::getSlot)
            .containsExactlyInAnyOrder(DailyQuestEntity.SLOT_BODY, DailyQuestEntity.SLOT_FUELBIO);
        // no active meso → REST day → the BODY slot must hold the rest-day quest
        assertThat(quests).filteredOn(q -> q.getSlot().equals(DailyQuestEntity.SLOT_BODY))
            .first().extracting(DailyQuestEntity::getCatalogKey).isEqualTo("body_rest_sleep");
        // distinct-metric rule: rest-day BODY is sleep_target → FUELBIO must not be bio_sleep
        assertThat(quests).extracting(q -> q.getTarget().metric()).doesNotHaveDuplicates();
        // protein requires a goal prescription → never picked without one
        assertThat(quests).extracting(DailyQuestEntity::getCatalogKey).doesNotContain("bio_protein");
    }

    @Test
    void testGenerate_shouldPickSameKeys_whenRegeneratedForSameUserAndDate() {
        UUID owner = userPopulator.createUser("sel-b@test.hu").getId();
        List<DailyQuestEntity> first = selector.generate(owner, DATE);
        List<String> firstKeys = first.stream().map(DailyQuestEntity::getCatalogKey).toList();

        // soft-delete (@SQLDelete) frees the partial unique index AND hides the rows from the
        // cooldown window — a regeneration for the same (user, date) must pick the same keys
        repository.deleteAll(first);
        List<String> secondKeys = selector.generate(owner, DATE).stream()
            .map(DailyQuestEntity::getCatalogKey).toList();

        assertThat(secondKeys).isEqualTo(firstKeys);
    }

    @Test
    void testGenerate_shouldExcludeCooldownKeys_whenPickedRecently() {
        UUID owner = userPopulator.createUser("sel-c@test.hu").getId();
        List<String> day1 = selector.generate(owner, DATE).stream()
            .map(DailyQuestEntity::getCatalogKey).toList();
        List<String> day2 = selector.generate(owner, DATE.plusDays(1)).stream()
            .map(DailyQuestEntity::getCatalogKey).toList();
        // FUELBIO keys carry cooldownDays >= 2 → the day-2 FUELBIO pick must differ from day-1's
        String bio1 = day1.stream().filter(k -> k.startsWith("bio_")).findFirst().orElseThrow();
        String bio2 = day2.stream().filter(k -> k.startsWith("bio_")).findFirst().orElseThrow();
        assertThat(bio2).isNotEqualTo(bio1);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=QuestSelectorIT -DargLine=-Xmx3g`
Expected: FAIL — compilation error (`QuestSelector` does not exist).

- [ ] **Step 3: Implement `QuestSelector.java`**

```java
package io.mrkuhne.mezo.feature.quest.service;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.quest.QuestCatalog;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.entity.QuestTargetEnvelope;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deterministic daily-quest selection (E1, bd mezo-df7q): rule-based, seeded by (user, date, slot)
 * — no LLM in the economy (ADR 0010). Filters: slot, day type (planned template → GYM else REST),
 * goal-prescription requirement, per-key cooldown window, distinct metrics within the day.
 * Cooldown yields to availability: an empty pool re-admits cooled-down keys rather than leaving
 * the slot empty.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.QUEST_SWITCH, havingValue = "true")
public class QuestSelector {

    private static final int COOLDOWN_LOOKBACK_DAYS = 7;
    private static final List<String> E1_SLOTS =
        List.of(DailyQuestEntity.SLOT_BODY, DailyQuestEntity.SLOT_FUELBIO);

    private final QuestCatalog catalog;
    private final DailyQuestRepository repository;
    private final WorkoutService workoutService;
    private final GoalRepository goalRepository;

    @Transactional
    public List<DailyQuestEntity> generate(UUID userId, LocalDate date) {
        String dayType = workoutService.findPlannedTemplateForDate(userId, date).isPresent()
            ? "GYM" : "REST";
        GoalPrescriptionJson.Segment segment = currentSegment(userId, date);
        List<DailyQuestEntity> recent =
            repository.findByCreatedByAndQuestDateGreaterThanEqual(userId, date.minusDays(COOLDOWN_LOOKBACK_DAYS));

        List<DailyQuestEntity> out = new ArrayList<>();
        Set<String> usedMetrics = new HashSet<>();
        for (String slot : E1_SLOTS) {
            pick(userId, date, slot, dayType, segment, recent, usedMetrics, 0)
                .ifPresent(q -> {
                    usedMetrics.add(q.getTarget().metric());
                    out.add(repository.saveAndFlush(q));
                });
        }
        return out;
    }

    /** Replacement for a reroll: same slot, excludes every catalog key already used today. */
    @Transactional
    public Optional<DailyQuestEntity> replacement(UUID userId, DailyQuestEntity old, int salt) {
        String dayType = workoutService.findPlannedTemplateForDate(userId, old.getQuestDate()).isPresent()
            ? "GYM" : "REST";
        GoalPrescriptionJson.Segment segment = currentSegment(userId, old.getQuestDate());
        List<DailyQuestEntity> today =
            repository.findByCreatedByAndQuestDateOrderBySlotAsc(userId, old.getQuestDate());
        Set<String> usedKeys = new HashSet<>();
        Set<String> usedMetrics = new HashSet<>();
        for (DailyQuestEntity q : today) {
            usedKeys.add(q.getCatalogKey());
            if (!DailyQuestEntity.STATUS_REROLLED.equals(q.getStatus()) && !q.getId().equals(old.getId())) {
                usedMetrics.add(q.getTarget().metric());
            }
        }
        List<QuestCatalog.QuestDef> pool = eligible(old.getSlot(), dayType, segment, usedMetrics).stream()
            .filter(d -> !usedKeys.contains(d.key()))
            .toList();
        if (pool.isEmpty()) {
            return Optional.empty();
        }
        QuestCatalog.QuestDef def =
            pool.get(Math.floorMod(Objects.hash(userId, old.getQuestDate(), old.getSlot(), salt), pool.size()));
        return Optional.of(repository.saveAndFlush(toEntity(userId, old.getQuestDate(), def, segment)));
    }

    private Optional<DailyQuestEntity> pick(UUID userId, LocalDate date, String slot, String dayType,
        GoalPrescriptionJson.Segment segment, List<DailyQuestEntity> recent,
        Set<String> usedMetrics, int salt) {

        List<QuestCatalog.QuestDef> base = eligible(slot, dayType, segment, usedMetrics);
        List<QuestCatalog.QuestDef> pool = base.stream()
            .filter(d -> !inCooldown(d, date, recent))
            .toList();
        if (pool.isEmpty()) {
            pool = base; // cooldown yields to availability
        }
        if (pool.isEmpty()) {
            return Optional.empty(); // honest: no eligible quest for this slot today
        }
        QuestCatalog.QuestDef def =
            pool.get(Math.floorMod(Objects.hash(userId, date, slot, salt), pool.size()));
        return Optional.of(toEntity(userId, date, def, segment));
    }

    private List<QuestCatalog.QuestDef> eligible(String slot, String dayType,
        GoalPrescriptionJson.Segment segment, Set<String> usedMetrics) {
        return catalog.all().stream()
            .filter(d -> d.slot().equals(slot))
            .filter(d -> d.dayTypes().contains("ANY") || d.dayTypes().contains(dayType))
            .filter(d -> !d.requiresGoalPrescription() || segment != null)
            .filter(d -> !usedMetrics.contains(d.metric()))
            .toList();
    }

    private boolean inCooldown(QuestCatalog.QuestDef d, LocalDate date, List<DailyQuestEntity> recent) {
        if (d.cooldownDays() == 0) {
            return false;
        }
        return recent.stream().anyMatch(q -> q.getCatalogKey().equals(d.key())
            && !q.getQuestDate().isBefore(date.minusDays(d.cooldownDays()))
            && q.getQuestDate().isBefore(date));
    }

    private DailyQuestEntity toEntity(UUID userId, LocalDate date, QuestCatalog.QuestDef def,
        GoalPrescriptionJson.Segment segment) {
        DailyQuestEntity e = new DailyQuestEntity();
        e.setCreatedBy(userId);
        e.setQuestDate(date);
        e.setSlot(def.slot());
        e.setCatalogKey(def.key());
        e.setSkillKey(def.skillKey());
        e.setSkillKind(def.skillKind());
        e.setTitle(def.title());
        e.setWhy(def.why());
        e.setCompletionMode(DailyQuestEntity.MODE_DERIVED);
        e.setTarget(new QuestTargetEnvelope(def.metric(), resolveThreshold(def, segment)));
        e.setXp(def.xp());
        e.setCoins(def.coins());
        e.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return e;
    }

    /** protein_target resolves from the prescription's current segment; everything else is catalog-static. */
    private BigDecimal resolveThreshold(QuestCatalog.QuestDef def, GoalPrescriptionJson.Segment segment) {
        if ("protein_target".equals(def.metric()) && segment != null && segment.proteinG() != null) {
            return BigDecimal.valueOf(segment.proteinG());
        }
        return def.threshold();
    }

    private GoalPrescriptionJson.Segment currentSegment(UUID userId, LocalDate date) {
        GoalEntity goal = goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")
            .stream().findFirst().orElse(null);
        if (goal == null || goal.getPrescription() == null) {
            return null;
        }
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), date) / 7 + 1;
        return GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
    }
}
```

- [ ] **Step 4: Add the switch constants (needed to compile)** — in `FeaturesConfiguration.java` add:

```java
    /** Daily quests (gamified growth E1). Gates the whole /api/quest surface + services. */
    public static final String QUEST_SWITCH = "mezo.feature.quest.enabled";
    /** Daily-quest crons (morning generate backstop + nightly finalize) — techcore cron zone. */
    public static final String QUEST_JOB_SWITCH = "mezo.techcore.cron.quest-job.enabled";
```
And in `application.yml`: under `mezo.feature:` add
```yaml
    # Gamified growth E1 — daily quests (catalog-driven, derived completion). Off => /api/quest 404s.
    quest:
      enabled: true
```
under `mezo.techcore.cron:` (next to `challenge-job`) add
```yaml
      # Daily-quest crons: morning generate backstop + nightly finalize (schedule: mezo.quest.*-cron)
      quest-job:
        enabled: true
```
and after the `mezo.progression:` block add
```yaml
  quest:
    reroll-per-day: 1           # autonomy valve (ADR 0010) — a shop item may raise it later (E4)
    generate-cron: "0 35 6 * * *"   # morning backstop so quests exist even if Today is never opened
    finalize-cron: "0 5 0 * * *"    # 00:05 — evaluate + quietly expire yesterday's offered quests
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=QuestSelectorIT -DargLine=-Xmx3g`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/quest backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestSelectorIT.java
git -c core.hooksPath=/dev/null commit -m "feat(quest): deterministic QuestSelector + feature switches (mezo-df7q)"
```

---

### Task 8: `QuestEvaluator` — derived-metric checks

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/quest/service/QuestEvaluator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestEvaluatorIT.java`

**Interfaces:**
- Consumes: `CheckInRepository.findByCreatedByAndDateOrderBySlotTime`, `WeightLogRepository.findFirstByCreatedByAndDeletedFalseAndDateOrderByCreatedAtDesc`, `SleepLogRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc`, `WaterLogService.sumForDay`, `FuelDayService.getDay` (consumed `MacroSet.p`), `WorkoutSessionRepository.findDoneInstanceDates`.
- Produces (consumed by Tasks 9, 11): `public boolean satisfied(DailyQuestEntity quest)` — pure read, no state change.

- [ ] **Step 1: Write the failing IT** (three representative metrics; the rest follow the same shape)

```java
package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.service.QuestEvaluator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Derived-metric truth table: satisfied() flips exactly when the day's logged data crosses the target. */
class QuestEvaluatorIT extends AbstractIntegrationTest {

    @Autowired private QuestEvaluator evaluator;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;

    private static final LocalDate DATE = LocalDate.of(2026, 7, 11);

    @Test
    void testSatisfied_shouldFlipOnFourthCheckin_whenCheckinFullQuest() {
        UUID owner = userPopulator.createUser("eval-a@test.hu").getId();
        DailyQuestEntity quest = questPopulator.quest(owner, DATE, DailyQuestEntity.SLOT_FUELBIO,
            "bio_checkin_full", "recovery", "LIFE", "checkin_full", new BigDecimal("4"), 20,
            DailyQuestEntity.STATUS_OFFERED);

        checkInPopulator.createCheckIn(owner, DATE, "06:30", 4, 3, null);
        checkInPopulator.createCheckIn(owner, DATE, "10:00", 4, 3, null);
        checkInPopulator.createCheckIn(owner, DATE, "14:00", 4, 3, null);
        assertThat(evaluator.satisfied(quest)).isFalse();

        checkInPopulator.createCheckIn(owner, DATE, "20:00", 4, 3, null);
        assertThat(evaluator.satisfied(quest)).isTrue();
    }

    @Test
    void testSatisfied_shouldRequireSameDayRow_whenWeightLoggedQuest() {
        UUID owner = userPopulator.createUser("eval-b@test.hu").getId();
        DailyQuestEntity quest = questPopulator.quest(owner, DATE, DailyQuestEntity.SLOT_FUELBIO,
            "bio_weight_log", "recovery", "LIFE", "weight_logged", null, 15,
            DailyQuestEntity.STATUS_OFFERED);

        weightLogPopulator.createWeightLog(owner, DATE.minusDays(1), new BigDecimal("83.4"));
        assertThat(evaluator.satisfied(quest)).isFalse();

        weightLogPopulator.createWeightLog(owner, DATE, new BigDecimal("83.2"));
        assertThat(evaluator.satisfied(quest)).isTrue();
    }

    @Test
    void testSatisfied_shouldReturnFalse_whenMetricUnknown() {
        UUID owner = userPopulator.createUser("eval-c@test.hu").getId();
        DailyQuestEntity quest = questPopulator.quest(owner, DATE, DailyQuestEntity.SLOT_FUELBIO,
            "bio_future", "recovery", "LIFE", "not_a_metric", null, 15,
            DailyQuestEntity.STATUS_OFFERED);
        assertThat(evaluator.satisfied(quest)).isFalse();
    }
}
```
(If `WeightLogPopulator.createWeightLog`'s exact signature differs, match the existing populator's method — the shape above follows `CheckInPopulator`.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=QuestEvaluatorIT -DargLine=-Xmx3g`
Expected: FAIL — compilation error (`QuestEvaluator` does not exist).

- [ ] **Step 3: Implement `QuestEvaluator.java`**

```java
package io.mrkuhne.mezo.feature.quest.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.meal.service.WaterLogService;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Derived quest completion (E1, bd mezo-df7q): pure reads over already-logged domain data —
 * the quest is data-verified by construction, never self-claimed (honest completion). Unknown
 * metrics evaluate to false (a stale catalog row can never complete by accident).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.QUEST_SWITCH, havingValue = "true")
public class QuestEvaluator {

    private final CheckInRepository checkInRepository;
    private final WeightLogRepository weightLogRepository;
    private final SleepLogRepository sleepLogRepository;
    private final WaterLogService waterLogService;
    private final FuelDayService fuelDayService;
    private final WorkoutSessionRepository workoutSessionRepository;

    public boolean satisfied(DailyQuestEntity q) {
        LocalDate d = q.getQuestDate();
        BigDecimal threshold = q.getTarget().threshold();
        return switch (q.getTarget().metric()) {
            case "gym_session_done" -> !workoutSessionRepository
                .findDoneInstanceDates(q.getCreatedBy(), d, d).isEmpty();
            case "checkin_full" -> checkInRepository
                .findByCreatedByAndDateOrderBySlotTime(q.getCreatedBy(), d).size()
                >= threshold.intValue();
            case "weight_logged" -> weightLogRepository
                .findFirstByCreatedByAndDeletedFalseAndDateOrderByCreatedAtDesc(q.getCreatedBy(), d)
                .isPresent();
            case "water_target" -> waterLogService.sumForDay(q.getCreatedBy(), d)
                >= threshold.intValue();
            case "sleep_target" -> sleepLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(q.getCreatedBy(), d)
                .stream()
                .anyMatch(s -> d.equals(s.getDate()) && s.getDurationH() != null
                    && s.getDurationH().compareTo(threshold) >= 0);
            case "protein_target" -> fuelDayService.getDay(q.getCreatedBy(), d)
                .getConsumed().getP().compareTo(threshold) >= 0;
            default -> {
                log.warn("Unknown quest metric '{}' on quest {} — treated as not satisfied",
                    q.getTarget().metric(), q.getId());
                yield false;
            }
        };
    }
}
```
(If `FuelDayResponse.consumed.p`'s generated getter differs — check `api/openapi.yml`'s `MacroSet` property name — adapt the single call site.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=QuestEvaluatorIT -DargLine=-Xmx3g`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/quest/service/QuestEvaluator.java backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestEvaluatorIT.java
git -c core.hooksPath=/dev/null commit -m "feat(quest): derived-metric QuestEvaluator (mezo-df7q)"
```

---

### Task 9: `QuestService` + mapper + controller — GET orchestration

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/quest/service/QuestService.java`, `.../mapper/QuestMapper.java`, `.../mapper/QuestDisplay.java`, `.../controller/QuestController.java`, `.../config/QuestProperties.java`
- Modify: `backend/src/main/resources/messages.properties`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestApiIT.java`

**Interfaces:**
- Consumes: `QuestSelector.generate`, `QuestEvaluator.satisfied`, `ProgressionService.applyQuest(QuestSignal)`, `ObjectProvider<ProgressionGate>`, `LevelUpResultMapper.toDto(LevelUpResult)` (the train feature's existing record→api.dto mapper), generated `QuestApi` + `QuestDayResponse`/`QuestResponse` DTOs, `CurrentUserId`.
- Produces (consumed by Tasks 10–13): `GET /api/quest/day/{date}`; `QuestService.getDay(UUID, LocalDate)`, `QuestService.evaluateAndFinalize(List<DailyQuestEntity> rows, LocalDate today)` (shared with the cron), `QuestProperties(int rerollPerDay, String generateCron, String finalizeCron)`.

- [ ] **Step 1: Write the failing HTTP IT**

```java
package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.QuestDayResponse;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.techcore.configuration.OwnerProperties;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** HTTP flow: lazy generation for today, derived completion → XP + levelUps, honest empty past day. */
class QuestApiIT extends ApiIntegrationTest {

    @Autowired private QuestPopulator questPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testGetQuestDay_shouldLazilyGenerateTwoSlots_whenTodayAndNoRows() {
        QuestDayResponse day = getForBody("/api/quest/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, QuestDayResponse.class);

        assertThat(day.getQuests()).hasSize(2);
        assertThat(day.getQuests()).extracting("slot")
            .containsExactlyInAnyOrder("BODY", "FUELBIO");
        assertThat(day.getRerollsLeft()).isEqualTo(1);
        assertThat(day.getLevelUps()).isEmpty();
    }

    @Test
    void testGetQuestDay_shouldCompleteAndAwardOnce_whenDerivedTargetMet() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        questPopulator.quest(owner, today, DailyQuestEntity.SLOT_FUELBIO, "bio_checkin_full",
            "recovery", "LIFE", "checkin_full", new BigDecimal("1"), 20,
            DailyQuestEntity.STATUS_OFFERED);
        checkInPopulator.createCheckIn(owner, today, "06:30", 4, 3, null);

        QuestDayResponse first = getForBody("/api/quest/day/" + today,
            ownerAuthHeaders(), HttpStatus.OK, QuestDayResponse.class);
        assertThat(first.getQuests()).anySatisfy(q -> {
            assertThat(q.getStatus()).isEqualTo("completed");
            assertThat(q.getCompletedAt()).isNotNull();
        });
        assertThat(first.getLevelUps()).hasSize(1);
        assertThat(first.getLevelUps().getFirst().getSource()).isEqualTo("QUEST");

        // idempotent: the second read reports the completed quest but produces no new levelUps
        QuestDayResponse second = getForBody("/api/quest/day/" + today,
            ownerAuthHeaders(), HttpStatus.OK, QuestDayResponse.class);
        assertThat(second.getLevelUps()).isEmpty();
    }

    @Test
    void testGetQuestDay_shouldReturnEmptyAndExpireNothing_whenPastDayWithoutRows() {
        QuestDayResponse day = getForBody("/api/quest/day/" + LocalDate.now().minusDays(3),
            ownerAuthHeaders(), HttpStatus.OK, QuestDayResponse.class);
        assertThat(day.getQuests()).isEmpty(); // honest empty — no retro-generation
    }

    @Test
    void testGetQuestDay_shouldExpireOfferedQuest_whenDayHasPassed() {
        UUID owner = ownerId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        questPopulator.quest(owner, yesterday, DailyQuestEntity.SLOT_FUELBIO, "bio_weight_log",
            "recovery", "LIFE", "weight_logged", null, 15, DailyQuestEntity.STATUS_OFFERED);

        QuestDayResponse day = getForBody("/api/quest/day/" + yesterday,
            ownerAuthHeaders(), HttpStatus.OK, QuestDayResponse.class);
        assertThat(day.getQuests()).singleElement()
            .extracting("status").isEqualTo("expired");
    }
}
```
Note on the second test: the lazy generator would also fire for today (no rows for the other slot exist... it fires only when the day has NO rows at all — the populated row suppresses generation, matching the challenge idiom "row exists ⇒ no lazy re-propose").

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=QuestApiIT -DargLine=-Xmx3g`
Expected: FAIL — compilation error (`QuestService`/`QuestController` do not exist; `QuestApi` is generated but unimplemented).

- [ ] **Step 3: Implement**

`QuestProperties.java`:
```java
package io.mrkuhne.mezo.feature.quest.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Quest tuning (mezo.quest): reroll cap + the two cron schedules (ADR 0010 — config, not code). */
@Validated
@ConfigurationProperties(prefix = "mezo.quest")
public record QuestProperties(
    @Min(0) int rerollPerDay,        // 1
    @NotBlank String generateCron,   // "0 35 6 * * *"
    @NotBlank String finalizeCron    // "0 5 0 * * *"
) {}
```

`QuestDisplay.java` (static helpers, kept out of MapStruct — same trap as `ChallengeDisplay`):
```java
package io.mrkuhne.mezo.feature.quest.mapper;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;

/** Presentation helpers for DailyQuestEntity → QuestResponse (invoked via @Mapping(expression)). */
final class QuestDisplay {

    private QuestDisplay() {
    }

    static String targetLabel(DailyQuestEntity e) {
        return switch (e.getTarget().metric()) {
            case "gym_session_done" -> "Mai tervezett edzés teljesítve";
            case "checkin_full" -> e.getTarget().threshold().intValue() + " check-in ma";
            case "weight_logged" -> "Reggeli súly beloggolva";
            case "water_target" -> "≥ " + e.getTarget().threshold().intValue() + " ml víz";
            case "protein_target" -> "≥ " + e.getTarget().threshold().intValue() + " g fehérje";
            case "sleep_target" -> "≥ " + e.getTarget().threshold().stripTrailingZeros().toPlainString() + " óra alvás";
            default -> "";
        };
    }
}
```

`QuestMapper.java`:
```java
package io.mrkuhne.mezo.feature.quest.mapper;

import io.mrkuhne.mezo.api.dto.QuestResponse;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface QuestMapper {

    @Mapping(target = "targetLabel", expression = "java(QuestDisplay.targetLabel(e))")
    QuestResponse toQuestResponse(DailyQuestEntity e);

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
```

`QuestService.java`:
```java
package io.mrkuhne.mezo.feature.quest.service;

import io.mrkuhne.mezo.api.dto.QuestDayResponse;
import io.mrkuhne.mezo.api.dto.QuestResponse;
import io.mrkuhne.mezo.feature.progression.ProgressionGate;
import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.quest.QuestSignal;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.feature.quest.config.QuestProperties;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.mapper.QuestMapper;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.feature.train.mapper.LevelUpResultMapper;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Daily-quest read + lifecycle (E1, bd mezo-df7q): the day read lazily generates (today only),
 * evaluates offered derived quests (completion awards XP through progression — atomically with
 * the status flip), and quietly expires offered quests of past days (ADR 0010 — no failure
 * state). Rerolled rows are excluded from display. levelUps carries exactly the payloads this
 * evaluation pass produced — re-reads return [] (award is idempotent, statuses are terminal).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.QUEST_SWITCH, havingValue = "true")
public class QuestService {

    private final DailyQuestRepository repository;
    private final QuestSelector selector;
    private final QuestEvaluator evaluator;
    private final QuestMapper mapper;
    private final ProgressionService progressionService;
    private final LevelUpResultMapper levelUpResultMapper;
    private final ObjectProvider<ProgressionGate> progressionGate;
    private final QuestProperties properties;

    @Transactional
    public QuestDayResponse getDay(UUID userId, LocalDate date) {
        List<DailyQuestEntity> rows = repository.findByCreatedByAndQuestDateOrderBySlotAsc(userId, date);
        if (rows.isEmpty() && date.equals(LocalDate.now())) {
            rows = selector.generate(userId, date); // lazy first offer, today only
        }
        List<LevelUpResult> levelUps = evaluateAndFinalize(rows, LocalDate.now());
        int rerollsUsed = repository.countByCreatedByAndQuestDateAndStatus(
            userId, date, DailyQuestEntity.STATUS_REROLLED);
        return QuestDayResponse.builder()
            .date(date)
            .quests(rows.stream()
                .filter(q -> !DailyQuestEntity.STATUS_REROLLED.equals(q.getStatus()))
                .map(mapper::toQuestResponse).toList())
            .levelUps(levelUps.stream().map(levelUpResultMapper::toDto).toList())
            .rerollsLeft(Math.max(0, properties.rerollPerDay() - rerollsUsed))
            .build();
    }

    /** Shared with the nightly cron: complete satisfied offered rows (award XP), expire passed ones. */
    @Transactional
    public List<LevelUpResult> evaluateAndFinalize(List<DailyQuestEntity> rows, LocalDate today) {
        List<LevelUpResult> levelUps = new ArrayList<>();
        for (DailyQuestEntity q : rows) {
            if (!DailyQuestEntity.STATUS_OFFERED.equals(q.getStatus())) {
                continue;
            }
            if (evaluator.satisfied(q)) {
                q.setStatus(DailyQuestEntity.STATUS_COMPLETED);
                q.setCompletedAt(Instant.now());
                repository.save(q);
                if (progressionGate.getIfAvailable() != null) {
                    levelUps.add(progressionService.applyQuest(q.getCreatedBy(), new QuestSignal(
                        q.getId(), q.getSkillKey(), q.getSkillKind(), q.getXp(), q.getTitle())));
                }
            } else if (q.getQuestDate().isBefore(today)) {
                q.setStatus(DailyQuestEntity.STATUS_EXPIRED); // quiet — no failure state (ADR 0010)
                repository.save(q);
            }
        }
        return levelUps;
    }
}
```

`QuestController.java`:
```java
package io.mrkuhne.mezo.feature.quest.controller;

import io.mrkuhne.mezo.api.controller.QuestApi;
import io.mrkuhne.mezo.api.dto.QuestDayResponse;
import io.mrkuhne.mezo.api.dto.QuestResponse;
import io.mrkuhne.mezo.feature.quest.service.QuestService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.QUEST_SWITCH, havingValue = "true")
public class QuestController implements QuestApi {

    private final QuestService questService;
    private final CurrentUserId currentUserId;

    @Override
    public QuestDayResponse getQuestDay(LocalDate date) {
        return questService.getDay(currentUserId.get(), date);
    }

    @Override
    public QuestResponse rerollQuest(UUID id) {
        return questService.reroll(currentUserId.get(), id);
    }
}
```
For this task stub `reroll` in `QuestService` so it compiles (implemented in Task 10):
```java
    @Transactional
    public QuestResponse reroll(UUID userId, UUID id) {
        throw new UnsupportedOperationException("Task 10");
    }
```
`LevelUpResultMapper` import: it lives where the train feature put it (`io.mrkuhne.mezo.feature.train.mapper.LevelUpResultMapper` — verify the actual package via its usage in `WorkoutService` imports and adjust the import if it differs).

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=QuestApiIT -DargLine=-Xmx3g`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/quest backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestApiIT.java
git -c core.hooksPath=/dev/null commit -m "feat(quest): day read — lazy generate + evaluate + XP + quiet expiry (mezo-df7q)"
```

---

### Task 10: Reroll

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/quest/service/QuestService.java` (replace the stub), `backend/src/main/resources/messages.properties`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestApiIT.java`

**Interfaces:**
- Consumes: `QuestSelector.replacement(userId, old, salt)`, `DailyQuestRepository.findByIdAndCreatedBy`, `countByCreatedByAndQuestDateAndStatus`.
- Produces: `POST /api/quest/{id}/reroll` → replacement `QuestResponse`; error codes `QUEST_NOT_FOUND` (404), `QUEST_NOT_OFFERED` (409), `QUEST_NOT_TODAY` (409), `QUEST_REROLL_EXHAUSTED` (409), `QUEST_REROLL_NO_ALTERNATIVE` (409).

- [ ] **Step 1: Add the failing tests to `QuestApiIT`**

```java
    @Test
    void testReroll_shouldReplaceQuestInSlot_whenOfferedToday() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        DailyQuestEntity offered = questPopulator.quest(owner, today, DailyQuestEntity.SLOT_FUELBIO,
            "bio_weight_log", "recovery", "LIFE", "weight_logged", null, 15,
            DailyQuestEntity.STATUS_OFFERED);

        QuestResponse replacement = postForBody("/api/quest/" + offered.getId() + "/reroll",
            null, ownerAuthHeaders(), HttpStatus.OK, QuestResponse.class);

        assertThat(replacement.getSlot()).isEqualTo("FUELBIO");
        assertThat(replacement.getStatus()).isEqualTo("offered");
        assertThat(replacement.getId()).isNotEqualTo(offered.getId());

        // the old row is rerolled → excluded from the day read; cap of 1 → rerollsLeft 0
        QuestDayResponse day = getForBody("/api/quest/day/" + today,
            ownerAuthHeaders(), HttpStatus.OK, QuestDayResponse.class);
        assertThat(day.getQuests()).extracting("id").doesNotContain(offered.getId().toString());
        assertThat(day.getRerollsLeft()).isZero();
    }

    @Test
    void testReroll_shouldConflict_whenDailyCapReached() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        // an already-rerolled row consumes the daily cap of 1
        questPopulator.quest(owner, today, DailyQuestEntity.SLOT_BODY, "body_gym_done",
            "strength_endurance", "ATHLETIC", "gym_session_done", null, 25,
            DailyQuestEntity.STATUS_REROLLED);
        DailyQuestEntity offered = questPopulator.quest(owner, today, DailyQuestEntity.SLOT_FUELBIO,
            "bio_weight_log", "recovery", "LIFE", "weight_logged", null, 15,
            DailyQuestEntity.STATUS_OFFERED);

        String body = postForBody("/api/quest/" + offered.getId() + "/reroll",
            null, ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "QUEST_REROLL_EXHAUSTED");
    }

    @Test
    void testReroll_shouldConflict_whenQuestNotOffered() {
        UUID owner = ownerId();
        DailyQuestEntity done = questPopulator.quest(owner, LocalDate.now(),
            DailyQuestEntity.SLOT_FUELBIO, "bio_water", "recovery", "LIFE", "water_target",
            new BigDecimal("2500"), 15, DailyQuestEntity.STATUS_COMPLETED);

        String body = postForBody("/api/quest/" + done.getId() + "/reroll",
            null, ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "QUEST_NOT_OFFERED");
    }
```
(add `import io.mrkuhne.mezo.api.dto.QuestResponse;`)

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && ./mvnw clean test -Dtest=QuestApiIT -DargLine=-Xmx3g`
Expected: FAIL — `UnsupportedOperationException: Task 10` (500) on the reroll tests.

- [ ] **Step 3: Implement reroll** — replace the stub in `QuestService`:

```java
    @Transactional
    public QuestResponse reroll(UUID userId, UUID id) {
        DailyQuestEntity q = repository.findByIdAndCreatedBy(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("QUEST_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (!DailyQuestEntity.STATUS_OFFERED.equals(q.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("QUEST_NOT_OFFERED").build(), HttpStatus.CONFLICT);
        }
        if (!q.getQuestDate().equals(LocalDate.now())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("QUEST_NOT_TODAY").build(), HttpStatus.CONFLICT);
        }
        int rerollsUsed = repository.countByCreatedByAndQuestDateAndStatus(
            userId, q.getQuestDate(), DailyQuestEntity.STATUS_REROLLED);
        if (rerollsUsed >= properties.rerollPerDay()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("QUEST_REROLL_EXHAUSTED").build(), HttpStatus.CONFLICT);
        }
        q.setStatus(DailyQuestEntity.STATUS_REROLLED);
        repository.saveAndFlush(q); // flush first — the partial unique index frees the slot
        DailyQuestEntity replacement = selector.replacement(userId, q, rerollsUsed + 1)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("QUEST_REROLL_NO_ALTERNATIVE").build(), HttpStatus.CONFLICT));
        return mapper.toQuestResponse(replacement);
    }
```
Imports: `io.mrkuhne.mezo.techcore.exception.SystemMessage`, `io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException`, `org.springframework.http.HttpStatus`.

Add to `messages.properties` (next to the proactive block):
```properties
QUEST_NOT_FOUND=Quest not found.
QUEST_NOT_OFFERED=The quest is not open (already completed, expired or rerolled).
QUEST_NOT_TODAY=Only today's quests can be rerolled.
QUEST_REROLL_EXHAUSTED=No rerolls left for today.
QUEST_REROLL_NO_ALTERNATIVE=No alternative quest is available for this slot today.
```
Note: `QUEST_REROLL_NO_ALTERNATIVE` rolls back the whole transaction (the `rerolled` flip included) — correct: the quest stays offered.

- [ ] **Step 4: Run to verify they pass**

Run: `cd backend && ./mvnw clean test -Dtest=QuestApiIT -DargLine=-Xmx3g`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/quest/service/QuestService.java backend/src/main/resources/messages.properties backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestApiIT.java
git -c core.hooksPath=/dev/null commit -m "feat(quest): reroll — daily cap, same-slot replacement, 409 guards (mezo-df7q)"
```

---

### Task 11: `QuestJob` — morning generate + nightly finalize crons

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/quest/service/QuestJob.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestJobIT.java`

**Interfaces:**
- Consumes: `AppUserRepository.findAll()`, `QuestSelector.generate`, `QuestService.evaluateAndFinalize`, `DailyQuestRepository.findByCreatedByAndStatusAndQuestDateBefore`, `findByCreatedByAndQuestDateOrderBySlotAsc`.
- Produces: `runGenerate()` (cron `mezo.quest.generate-cron`) and `runFinalize()` (cron `mezo.quest.finalize-cron`) — both directly callable in tests.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.feature.quest.service.QuestJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Cron backstops: morning generation for users who never open Today; nightly quiet finalize. */
class QuestJobIT extends AbstractIntegrationTest {

    @Autowired private QuestJob job;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DailyQuestRepository repository;

    @Test
    void testRunGenerate_shouldCreateTodayRows_whenUserHasNone() {
        UUID owner = userPopulator.createUser("job-a@test.hu").getId();
        job.runGenerate();
        assertThat(repository.findByCreatedByAndQuestDateOrderBySlotAsc(owner, LocalDate.now()))
            .isNotEmpty();
    }

    @Test
    void testRunFinalize_shouldExpireOfferedPastQuests_whenDayPassed() {
        UUID owner = userPopulator.createUser("job-b@test.hu").getId();
        DailyQuestEntity stale = questPopulator.quest(owner, LocalDate.now().minusDays(2),
            DailyQuestEntity.SLOT_FUELBIO, "bio_weight_log", "recovery", "LIFE",
            "weight_logged", null, 15, DailyQuestEntity.STATUS_OFFERED);

        job.runFinalize();

        assertThat(repository.findByIdAndCreatedBy(stale.getId(), owner).orElseThrow().getStatus())
            .isEqualTo(DailyQuestEntity.STATUS_EXPIRED);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=QuestJobIT -DargLine=-Xmx3g`
Expected: FAIL — compilation error (`QuestJob` does not exist).

- [ ] **Step 3: Implement `QuestJob.java`**

```java
package io.mrkuhne.mezo.feature.quest.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.quest.repository.DailyQuestRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Daily-quest cron backstops (E1, bd mezo-df7q): the lazy GET path covers active users; these
 * cover the rest. Morning: generate today's offer for every user without rows (so quests exist
 * before the first app-open). Night: evaluate + quietly expire yesterday's offered rows (XP for
 * quests satisfied after the user's last read — e.g. late meal log — is still granted). Per-user
 * failures are isolated; both paths are idempotent.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.QUEST_SWITCH, FeaturesConfiguration.QUEST_JOB_SWITCH},
        havingValue = "true")
public class QuestJob {

    private final AppUserRepository appUserRepository;
    private final DailyQuestRepository repository;
    private final QuestSelector selector;
    private final QuestService questService;

    @Scheduled(cron = "${mezo.quest.generate-cron}")
    public void runGenerate() {
        LocalDate today = LocalDate.now();
        int generated = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                if (repository.findByCreatedByAndQuestDateOrderBySlotAsc(user.getId(), today).isEmpty()) {
                    generated += selector.generate(user.getId(), today).size();
                }
            } catch (Exception e) {
                log.warn("Quest generation failed for user {} on {}", user.getId(), today, e);
            }
        }
        log.info("Quest generate run for {}: {} quest(s) created", today, generated);
    }

    @Scheduled(cron = "${mezo.quest.finalize-cron}")
    public void runFinalize() {
        LocalDate today = LocalDate.now();
        int finalized = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                List<DailyQuestEntity> stale = repository.findByCreatedByAndStatusAndQuestDateBefore(
                    user.getId(), DailyQuestEntity.STATUS_OFFERED, today);
                questService.evaluateAndFinalize(stale, today);
                finalized += stale.size();
            } catch (Exception e) {
                log.warn("Quest finalize failed for user {} on {}", user.getId(), today, e);
            }
        }
        log.info("Quest finalize run for {}: {} quest(s) closed", today, finalized);
    }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=QuestJobIT -DargLine=-Xmx3g`
Expected: PASS (2 tests).

- [ ] **Step 5: Backend focused regression sweep + commit**

Run: `cd backend && ./mvnw clean test -Dtest='Quest*,Progression*' -DargLine=-Xmx3g`
Expected: PASS.

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/quest/service/QuestJob.java backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestJobIT.java
git -c core.hooksPath=/dev/null commit -m "feat(quest): morning-generate + nightly-finalize cron backstops (mezo-df7q)"
```

---

### Task 12: FE data layer — types, wire client, mock, hooks, MSW

**Files:**
- Create: `frontend/src/data/quest/questApi.ts`, `frontend/src/data/quest/questMock.ts`, `frontend/src/data/quest/questHooks.ts`
- Modify: `frontend/src/data/types.ts`, `frontend/src/data/hooks.ts`, `frontend/src/test/msw/handlers.ts`
- Test: `frontend/src/data/quest/questHooks.test.tsx`

**Interfaces:**
- Consumes: generated `paths['/api/quest/day/{date}']`, `useDualQuery` is NOT used here (the read needs `levelUps`/`rerollsLeft` besides the list — the hook follows the `useChallenges` manual dual-mode shape instead).
- Produces (consumed by Task 13): `useDailyQuests(date)` → `{ quests: DailyQuest[]; levelUps: LevelUpResult[]; rerollsLeft: number; mode: 'mock' | 'live' }`; `useQuestActions(date)` → `{ reroll(id: string): void; pending: boolean }`; barrel exports in `@/data/hooks`.

- [ ] **Step 1: FE types** — append to `frontend/src/data/types.ts` (below the Challenge block):

```ts
export type QuestSlot = 'BODY' | 'FUELBIO' | 'GROWTH'
export type QuestStatus = 'offered' | 'completed' | 'expired' | 'rerolled'
export interface DailyQuest {
  id: string
  questDate: string
  slot: QuestSlot
  skillKey: string
  title: string
  why: string
  targetLabel: string
  xp: number
  status: QuestStatus
  completedAt?: string | null
}
```

- [ ] **Step 2: Write the failing hook test** — `questHooks.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useDailyQuests, useQuestActions } from '@/data/quest/questHooks'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const DATE = '2026-07-11'

const questWire = (overrides: Record<string, unknown> = {}) => ({
  id: 'q-1',
  questDate: DATE,
  slot: 'FUELBIO',
  skillKey: 'recovery',
  title: 'Igyál meg legalább 2,5 litert ma',
  why: 'A hidratáltság a legolcsóbb teljesítményfokozó.',
  targetLabel: '≥ 2500 ml víz',
  xp: 15,
  status: 'offered',
  completedAt: null,
  ...overrides,
})

describe('useDailyQuests (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('maps the day payload and exposes rerollsLeft + levelUps', async () => {
    server.use(
      http.get(`${API_BASE}/api/quest/day/${DATE}`, () =>
        HttpResponse.json({ date: DATE, quests: [questWire()], levelUps: [], rerollsLeft: 1 }),
      ),
    )
    const { result } = renderHook(() => useDailyQuests(DATE), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.quests).toHaveLength(1))
    expect(result.current.quests[0].targetLabel).toBe('≥ 2500 ml víz')
    expect(result.current.rerollsLeft).toBe(1)
    expect(result.current.levelUps).toEqual([])
    expect(result.current.mode).toBe('live')
  })
})

describe('useQuestActions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('reroll posts and invalidates the day query (refetch)', async () => {
    let getCalls = 0
    server.use(
      http.get(`${API_BASE}/api/quest/day/${DATE}`, () => {
        getCalls += 1
        return HttpResponse.json({ date: DATE, quests: [questWire()], levelUps: [], rerollsLeft: 1 })
      }),
      http.post(`${API_BASE}/api/quest/:id/reroll`, () =>
        HttpResponse.json(questWire({ id: 'q-2', title: 'Reggeli súlymérés — logold be' })),
      ),
    )
    const wrapper = makeHookWrapper()
    const list = renderHook(() => useDailyQuests(DATE), { wrapper })
    const actions = renderHook(() => useQuestActions(DATE), { wrapper })
    await waitFor(() => expect(list.result.current.quests).toHaveLength(1))
    expect(getCalls).toBe(1)

    actions.result.current.reroll('q-1')
    await waitFor(() => expect(getCalls).toBe(2))
  })
})

describe('useDailyQuests (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('serves the seed without fetching', async () => {
    const { result } = renderHook(() => useDailyQuests(DATE), { wrapper: makeHookWrapper() })
    expect(result.current.mode).toBe('mock')
    expect(result.current.quests.length).toBeGreaterThan(0)
    expect(result.current.quests.some(q => q.status === 'completed')).toBe(true)
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd frontend && pnpm test -- src/data/quest/questHooks.test.tsx`
Expected: FAIL — cannot resolve `@/data/quest/questHooks`.

- [ ] **Step 4: Implement**

`questApi.ts`:
```ts
import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { LevelUpResult } from '@/data/train/trainApi'
import type { DailyQuest, QuestSlot, QuestStatus } from '@/data/types'

type QuestDayWire =
  paths['/api/quest/day/{date}']['get']['responses']['200']['content']['application/json']
type QuestWire = QuestDayWire['quests'][number]

export interface QuestDay {
  quests: DailyQuest[]
  levelUps: LevelUpResult[]
  rerollsLeft: number
}

export function toQuest(w: QuestWire): DailyQuest {
  return {
    id: w.id,
    questDate: w.questDate,
    slot: w.slot as QuestSlot,
    skillKey: w.skillKey,
    title: w.title,
    why: w.why,
    targetLabel: w.targetLabel,
    xp: w.xp,
    status: w.status as QuestStatus,
    completedAt: w.completedAt ?? null,
  }
}

export const questApi = {
  day: (date: string): Promise<QuestDay> =>
    apiFetch<QuestDayWire>(`/api/quest/day/${date}`).then((d) => ({
      quests: d.quests.map(toQuest),
      levelUps: (d.levelUps ?? []) as LevelUpResult[],
      rerollsLeft: d.rerollsLeft,
    })),
  reroll: (id: string): Promise<DailyQuest> =>
    apiFetch<QuestWire>(`/api/quest/${id}/reroll`, { method: 'POST' }).then(toQuest),
}
```

`questMock.ts` (Phase-1-style HU seed — one completed, one offered, plus a spare for mock reroll):
```ts
import type { DailyQuest } from '@/data/types'

/** Mock seed: a representative quest day (one completed FUELBIO, one offered BODY). */
export const mockQuestDay: DailyQuest[] = [
  {
    id: 'dq1',
    questDate: '2026-07-11',
    slot: 'BODY',
    skillKey: 'strength_endurance',
    title: 'A mai tervezett edzés a naptárban van — csináld végig',
    why: 'A megjelenés a legerősebb identitás-szavazat: aki ma edz, az edző ember.',
    targetLabel: 'Mai tervezett edzés teljesítve',
    xp: 25,
    status: 'offered',
  },
  {
    id: 'dq2',
    questDate: '2026-07-11',
    slot: 'FUELBIO',
    skillKey: 'recovery',
    title: 'Reggeli súlymérés — logold be',
    why: 'Egy pont zaj, a sorozat trend: a reggeli rutinod adja a görbét, amiből a cél él.',
    targetLabel: 'Reggeli súly beloggolva',
    xp: 15,
    status: 'completed',
    completedAt: '2026-07-11T06:41:00Z',
  },
]

/** Mock reroll pool — swapped in client-side (the seed carries no reroll backend). */
export const mockRerollSpare: DailyQuest = {
  id: 'dq3',
  questDate: '2026-07-11',
  slot: 'BODY',
  skillKey: 'recovery',
  title: 'Pihenőnap: aludj legalább 7,5 órát',
  why: 'A pihenőnap edzés — az alvás alatt épül az izom és áll helyre az idegrendszer.',
  targetLabel: '≥ 7,5 óra alvás',
  xp: 20,
  status: 'offered',
}
```

`questHooks.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { questApi, type QuestDay } from '@/data/quest/questApi'
import { mockQuestDay, mockRerollSpare } from '@/data/quest/questMock'
import type { LevelUpResult } from '@/data/train/trainApi'
import type { DailyQuest } from '@/data/types'

const key = (d: string) => ['dailyQuests', d]

const MOCK_DAY: QuestDay = { quests: mockQuestDay, levelUps: [], rerollsLeft: 1 }
const EMPTY_DAY: QuestDay = { quests: [], levelUps: [], rerollsLeft: 0 }

export interface DailyQuestsView {
  quests: DailyQuest[]
  levelUps: LevelUpResult[]
  rerollsLeft: number
  mode: 'mock' | 'live'
}

/**
 * The day's quests. Real mode: GET lazily generates (today) and evaluates derived completion —
 * levelUps carries payloads produced by THAT read only (safe to feed showLevelUp; re-reads
 * return []). While unresolved returns the empty day, never the seed (no-static-fallback rule).
 */
export function useDailyQuests(date: string): DailyQuestsView {
  const mock = isMockMode()
  const q = useQuery<QuestDay>({
    queryKey: key(date),
    queryFn: mock ? async () => MOCK_DAY : () => questApi.day(date),
    initialData: mock ? MOCK_DAY : undefined,
    staleTime: mock ? Infinity : undefined,
    retry: false,
  })
  const data = q.data ?? (mock ? MOCK_DAY : EMPTY_DAY)
  return { ...data, mode: mock ? 'mock' : 'live' }
}

/** Reroll (1/day). Mock: swaps the quest client-side from the spare pool (inert economy). */
export function useQuestActions(date: string) {
  const qc = useQueryClient()
  const mock = isMockMode()

  const rerollM = useMutation({
    mutationFn: mock
      ? async (id: string) => {
          qc.setQueryData<QuestDay>(key(date), (d) => {
            const base = d ?? MOCK_DAY
            return {
              ...base,
              rerollsLeft: Math.max(0, base.rerollsLeft - 1),
              quests: base.quests.map(q => (q.id === id ? { ...mockRerollSpare, slot: q.slot } : q)),
            }
          })
        }
      : (id: string) => questApi.reroll(id),
    onSuccess: mock ? undefined : () => qc.invalidateQueries({ queryKey: key(date) }),
  })

  return {
    reroll: (id: string) => rerollM.mutate(id),
    pending: rerollM.isPending,
  }
}
```

Barrel — add to `frontend/src/data/hooks.ts` (after the progression line):
```ts
export { useDailyQuests, useQuestActions } from '@/data/quest/questHooks'
```

MSW defaults — add to the `handlers` array in `frontend/src/test/msw/handlers.ts` (after the challenge handlers):
```ts
  // Daily quests (gamified growth E1) — default: honest empty day. Tests override with server.use(...).
  http.get(`${API_BASE}/api/quest/day/:date`, ({ params }) =>
    HttpResponse.json({ date: params.date, quests: [], levelUps: [], rerollsLeft: 1 }),
  ),
  http.post(`${API_BASE}/api/quest/:id/reroll`, ({ params }) =>
    HttpResponse.json({
      id: `${params.id}-r`, questDate: '2026-07-11', slot: 'FUELBIO', skillKey: 'recovery',
      title: 'Csere-küldetés', why: 'Teszt.', targetLabel: '', xp: 15, status: 'offered', completedAt: null,
    }),
  ),
```

- [ ] **Step 5: Run to verify it passes (both modes)**

Run: `cd frontend && pnpm test -- src/data/quest/questHooks.test.tsx && VITE_USE_MOCK=true pnpm test -- src/data/quest/questHooks.test.tsx`
Expected: PASS in both runs.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/quest frontend/src/data/types.ts frontend/src/data/hooks.ts frontend/src/test/msw/handlers.ts
git -c core.hooksPath=/dev/null commit -m "feat(fe/quest): quest data domain — dual-mode hooks + MSW defaults (mezo-df7q)"
```

---

### Task 13: `DailyQuestsCard` on Today + level-up wiring

**Files:**
- Create: `frontend/src/features/today/components/DailyQuestsCard.tsx`
- Modify: `frontend/src/features/today/pages/TodayPage.tsx`, `frontend/src/features/progression/logic/levelUpMeta.ts`
- Test: `frontend/src/features/today/components/DailyQuestsCard.test.tsx`

**Interfaces:**
- Consumes: `useDailyQuests`/`useQuestActions` from `@/data/hooks`, `useLevelUp()` (`showLevelUp(r?)` — mounted globally in `AppLayout`).
- Produces: the Today card. Copy: "Napi küldetések" eyebrow; quiet expired styling; no failure state.

- [ ] **Step 1: Write the failing component test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import { DailyQuestsCard } from '@/features/today/components/DailyQuestsCard'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { makeHookWrapper } from '@/test/queryWrapper'

const quests = vi.hoisted(() => ({
  useDailyQuests: vi.fn(),
  useQuestActions: vi.fn(),
}))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  useDailyQuests: quests.useDailyQuests,
  useQuestActions: quests.useQuestActions,
}))

const offered = {
  id: 'q1', questDate: '2026-07-11', slot: 'BODY', skillKey: 'strength_endurance',
  title: 'A mai tervezett edzés a naptárban van — csináld végig',
  why: 'A megjelenés a legerősebb identitás-szavazat.', targetLabel: 'Mai tervezett edzés teljesítve',
  xp: 25, status: 'offered' as const,
}
const completed = {
  id: 'q2', questDate: '2026-07-11', slot: 'FUELBIO', skillKey: 'recovery',
  title: 'Reggeli súlymérés — logold be', why: 'Egy pont zaj, a sorozat trend.',
  targetLabel: 'Reggeli súly beloggolva', xp: 15, status: 'completed' as const,
}

function renderCard() {
  const Wrapper = makeHookWrapper()
  return render(
    <Wrapper>
      <LevelUpProvider>
        <DailyQuestsCard />
      </LevelUpProvider>
    </Wrapper>,
  )
}

describe('DailyQuestsCard', () => {
  const reroll = vi.fn()
  beforeEach(() => {
    quests.useDailyQuests.mockReturnValue({
      quests: [offered, completed], levelUps: [], rerollsLeft: 1, mode: 'mock',
    })
    quests.useQuestActions.mockReturnValue({ reroll, pending: false })
  })
  afterEach(() => vi.clearAllMocks())

  test('renders both quests with XP chips and completed state', () => {
    renderCard()
    expect(screen.getByText('Napi küldetések')).toBeInTheDocument()
    expect(screen.getByText(offered.title)).toBeInTheDocument()
    expect(screen.getByText(completed.title)).toBeInTheDocument()
    expect(screen.getByText('+25 XP')).toBeInTheDocument()
    expect(screen.getByText('1/2 ma')).toBeInTheDocument()
  })

  test('reroll button fires the action for offered quests only', () => {
    renderCard()
    const buttons = screen.getAllByRole('button', { name: 'Csere' })
    expect(buttons).toHaveLength(1) // completed quest has no reroll
    fireEvent.click(buttons[0])
    expect(reroll).toHaveBeenCalledWith('q1')
  })

  test('renders nothing when the day is empty', () => {
    quests.useDailyQuests.mockReturnValue({ quests: [], levelUps: [], rerollsLeft: 1, mode: 'live' })
    const { container } = renderCard()
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && pnpm test -- src/features/today/components/DailyQuestsCard.test.tsx`
Expected: FAIL — cannot resolve `DailyQuestsCard`.

- [ ] **Step 3: Implement `DailyQuestsCard.tsx`** (house idiom: CSS classes `card`, `eyebrow`, `chip notch-4`, brand tokens — match `CheckInStrip`/Today cards):

```tsx
import { useEffect } from 'react'
import { useDailyQuests, useQuestActions } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { localDateString } from '@/shared/lib/dates'
import type { DailyQuest } from '@/data/types'

const STATE_ICON: Record<DailyQuest['status'], string> = {
  offered: '◦',
  completed: '✓',
  expired: '—',
  rerolled: '—',
}

/**
 * Napi küldetések (gamified growth E1). Derived quests complete server-side — the card only
 * reads; a completion detected by this read carries a levelUp payload exactly once, which is
 * handed to the global overlay. Expired is quiet (ADR 0010 — no failure state).
 */
export function DailyQuestsCard() {
  const date = localDateString()
  const { quests, levelUps, rerollsLeft } = useDailyQuests(date)
  const { reroll, pending } = useQuestActions(date)
  const { showLevelUp } = useLevelUp()

  useEffect(() => {
    if (levelUps.length > 0) showLevelUp(levelUps[0])
  }, [levelUps, showLevelUp])

  if (quests.length === 0) return null
  const doneCount = quests.filter(q => q.status === 'completed').length

  return (
    <div className="card" style={{ margin: '8px 24px', padding: '14px 16px' }}>
      <div className="row" style={{ justifyContent: 'space-between', paddingBottom: 8 }}>
        <span className="eyebrow">Napi küldetések</span>
        <span className="eyebrow text-tertiary">{doneCount}/{quests.length} ma</span>
      </div>
      {quests.map(q => (
        <div key={q.id} className="row" style={{ alignItems: 'flex-start', gap: 10, padding: '6px 0' }}>
          <span style={{
            color: q.status === 'completed' ? 'var(--success)' : 'var(--brand-glow)',
            opacity: q.status === 'expired' ? 0.4 : 1,
            width: 14, textAlign: 'center',
          }}>
            {STATE_ICON[q.status]}
          </span>
          <div style={{ flex: 1, opacity: q.status === 'expired' ? 0.5 : 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{q.title}</div>
            <div className="text-tertiary" style={{ fontSize: 11, paddingTop: 2 }}>{q.why}</div>
          </div>
          <span className="chip notch-4" style={{ whiteSpace: 'nowrap' }}>+{q.xp} XP</span>
          {q.status === 'offered' && rerollsLeft > 0 && (
            <button
              className="chip notch-4"
              disabled={pending}
              onClick={() => reroll(q.id)}
              style={{ cursor: 'pointer' }}
            >
              Csere
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
```
Adapt the `localDateString` import to the exact module `data/fuel/fuelHooks.ts` imports it from, and the wrapper/classNames to the surrounding Today cards' exact idiom (visual check follows in Step 6).

- [ ] **Step 4: Mount on Today + level-up meta** — in `TodayPage.tsx` add the import and render `<DailyQuestsCard />` between `{companionNote && <CompanionNoteCard …/>}` and `{workout && (<WorkoutTeaser …/>)}`. In `features/progression/logic/levelUpMeta.ts` add a `recovery` entry to the skillKey→display map following the file's existing entry shape (HU name `Regeneráció`, a rest/sleep icon consistent with the file's icon style) so a LIFE level-up renders properly in the overlay.

- [ ] **Step 5: Run to verify it passes (both modes) + build**

Run: `cd frontend && pnpm test -- src/features/today/components/DailyQuestsCard.test.tsx && VITE_USE_MOCK=true pnpm test -- src/features/today/components/DailyQuestsCard.test.tsx && pnpm build`
Expected: PASS + clean build.

- [ ] **Step 6: Visual verification (mandatory — memory: SDD review alone missed layout bugs before)**

Run: `cd frontend && VITE_USE_MOCK=true pnpm dev` → open `http://localhost:5180`, check the Today page: card position (after companion note, before workout teaser), completed/offered states, XP chips, reroll button. For real mode: `docker compose up -d` + backend `demodata` profile, log in, verify lazy generation renders 2 quests.
Expected: layout matches the surrounding cards; no overflow at 390px width.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/today frontend/src/features/progression/logic/levelUpMeta.ts
git -c core.hooksPath=/dev/null commit -m "feat(fe/today): DailyQuestsCard — quests, reroll, level-up wiring (mezo-df7q)"
```

---

### Task 14: Docs — feature doc + today doc + lint

**Files:**
- Create: `docs/features/growth.md`
- Modify: `docs/features/today.md`, `docs/milestones/roadmap.md`

**Interfaces:** none (docs).

- [ ] **Step 1: Write `docs/features/growth.md`** with the house 10-section feature-doc template (copy the section skeleton + frontmatter from `docs/features/train.md`; set `key_files` to the quest backend package, catalog JSON, `data/quest/*`, `DailyQuestsCard.tsx`). Content: quest lifecycle (offer → derived completion/quiet expiry → XP via `applyQuest`), catalog + selection rules (day type, cooldown, distinct metric, prescription-resolved protein), reroll semantics, switches (`mezo.feature.quest.enabled`, `mezo.techcore.cron.quest-job.enabled`), config (`mezo.quest.*`), endpoints, `file:line` pointers, ADR 0010 link, E2/E3/E4 outlook (LIFE band, activity log, shop).
- [ ] **Step 2: Update `docs/features/today.md`** — new card in the Today composition (§ layout/components + § integrations: quest domain, level-up overlay reuse).
- [ ] **Step 3: Roadmap** — add the milestone-log row for E1 ship (date, `mezo-df7q`, one-paragraph summary, ADR 0010 + spec links).
- [ ] **Step 4: Lint**

Run: `node scripts/lint-docs.mjs`
Expected: clean (no orphans, no broken links, staleness flags cleared).

- [ ] **Step 5: Commit**

```bash
git add docs/features/growth.md docs/features/today.md docs/milestones/roadmap.md
git -c core.hooksPath=/dev/null commit -m "docs(features): growth.md born + today.md quest card + roadmap E1 row (mezo-df7q)"
```

---

### Task 15: Gates + PR + land

**Files:** none new.

- [ ] **Step 1: Frontend full gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build clean, both modes green.

- [ ] **Step 2: Backend focused gate** (full suite is CI's job — 16 GB box OOMs on it)

Run: `cd backend && ./mvnw clean test -Dtest='Quest*,Progression*,Workout*' -DargLine=-Xmx3g`
Expected: PASS.

- [ ] **Step 3: Push + self-PR (CI gate)**

```bash
git push -u origin feat/quest-core
gh pr create --title "feat(quest): gamified growth E1 — daily quest core (mezo-df7q)" --body "$(cat <<'EOF'
Daily-quest core per docs/superpowers/specs/2026-07-11-gamified-growth-quests-design.md + ADR 0010:
feature/quest domain (deterministic catalog selection, derived completion, quiet expiry, reroll,
morning/nightly crons), QUEST source through the idempotent progression award tail, LIFE band seed
(recovery), quest contract fragment, Today DailyQuestsCard with level-up wiring.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Wait for CI green, then land.** If the main checkout is busy with a parallel session, use `gh pr merge --merge` (remote merge); otherwise the house flow: `git checkout main && git pull --rebase && git merge --no-ff feat/quest-core && git push` (push directly after the merge — do NOT rebase after merging), then delete the branch.

- [ ] **Step 5: bd close-out** (from the MAIN checkout — the worktree has no `.dolt`):

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo && bd close mezo-df7q && bd update mezo-df7q --notes="Shipped: quest core (E1). Next: E2 growth layer (LIFE band + activity log + GrowthCard)." && bd dolt push
```

---

## Post-plan notes for the executor

- **Package-cycle guard:** `feature/quest` depends on `progression`, `train`, `goal`, `meal`, `biometrics` — all one-directional (nothing imports quest back), so the frozen ArchUnit cycle set (`mezo-ah18.15`) is untouched.
- **Determinism:** selection seeds on `Objects.hash(userId, date, slot, salt)` — stable across JVM runs (UUID/LocalDate/String hashCodes are value-based). Never introduce `Random`.
- **E2 seams intentionally present:** `completion_mode='ACTIVITY'`, `source_activity_id`, `coins`, `SLOT_GROWTH`, `skill_kind LIFE` CHECKs — do not remove as "dead"; they are the E2/E4 contract.
- **demodata:** no quest seed rows — quests are runtime-generated; `demofixtures` untouched.

