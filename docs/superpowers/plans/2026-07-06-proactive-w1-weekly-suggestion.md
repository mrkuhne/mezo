# W1 — weeklySuggestion prose — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the Insights Weekly page's "Mezo · heti tervjavaslat" card stops being a placeholder — a smart-tier generator writes the companion's plan suggestion for the running week (`mezo-h4wp.3`).

**Architecture:** a `weekly_suggestion` table + `WeeklySuggestionGenerator` in `feature/proactive` (gather = the `HypothesisPipelineService.gather` idiom: prior-week daily summaries + facts block + patterns, plus the V0.3 snapshot for current state → ONE `completeSmart` call → plain Hungarian prose, no JSON); a Monday-dawn `WeeklySuggestionJob` pre-generates, the lazy `GET /api/proactive/weekly-suggestion` covers misses (the B1.1/B1.2 hybrid precedent, WITHOUT staleness/regen — weekly cadence, YAGNI). FE: `useWeekly()`'s real branch fetches the prose (404→null keeps the honest placeholder); the inert „Elfogad/Hangoljuk" buttons hide in live mode (false affordance), mock stays byte-identical.

**Tech Stack:** the shipped proactive skeleton (B1.1/B1.2) · `CompanionLlm.completeSmart` (Pro tier — the decided cheap-daily/smart-weekly policy) · TanStack Query + MSW.

**Design of record:** spec `docs/superpowers/specs/2026-07-06-proactive-layer-design.md` §5 · roadmap `docs/superpowers/plans/2026-07-06-proactive-roadmap.md` §W1 · living doc `docs/features/proactive.md`.

## Global Constraints

- Backend house rules as in B1.1/B1.2 (UUID/OwnedEntity/soft-delete/method-level `@Transactional`/no `@Value`/ArchUnit: NO companion→proactive import — the fake mirrors the marker as a LITERAL; controllers implement the generated API). ALWAYS `./mvnw clean test` from `backend/` (compose up).
- Every proactive bean: `@ConditionalOnProperty` on BOTH `COMPANION_SWITCH` + `PROACTIVE_SWITCH`; the job adds its own third switch.
- Honesty: plain-prose output; blank/failed answer or an empty prior-week summary window ⇒ NO row ⇒ 404; the FE placeholder *"A társ heti tervjavaslata hamarosan."* is the degraded state. No fabricated numbers in the prompt contract; clinical Rx guard in the prompt.
- FE conventions: implementation in `data/insights/`, barrel-only re-exports, deep `@/*` imports, colocated tests; mock byte-parity (the seed suggestion + its buttons render exactly as Phase-1); both FE test modes + build green.
- **Decisions this slice closes (roadmap §W1 open decisions):**
  - **Cron = Monday 06:00** (`mezo.proactive.weekly.cron: "0 0 6 * * MON"`) — the suggestion is FOR the week just starting, gathered from the finished previous week; pairs with Monday-morning planning. Switch `mezo.techcore.cron.weekly-suggestion-job.enabled`.
  - **„Elfogad / Hangoljuk" HIDDEN in live mode** — inert buttons on a REAL suggestion are a false affordance (`insights.md` §9 lists them); they stay on the mock seed (byte-parity). Real interactivity is future work.
  - **Week identity = ISO Monday** (`week_start`), server-derived from the optional `date` param (`LocalDate.with(DayOfWeek.MONDAY)` semantics — use `java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)`); the FE sends its local date.
  - **No staleness/regen for weekly prose v1** — weekly cadence; the Monday cron + lazy GET suffice. (The briefing's regen machinery is per-day-input-driven; nothing equivalent exists weekly.)
  - **D′ FE score-constants promotion to backend config: NOT in-slice** — the controller files a follow-up bd issue at close-out (keeps W1 at size M).

**Branch first:** `git checkout -b feat/proactive-w1` (main checkout, NOT a worktree).

---

### Task 1: Contract + `weekly_suggestion` table + entity/repo/plumbing

**Files:**
- Modify: `api/feature/proactive/proactive.yml` (new path + schema)
- Generated (commit): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607071200_mezo-h4wp.3_create_weekly_suggestion.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/WeeklySuggestionEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/WeeklySuggestionRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/WeeklySuggestionPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (TRUNCATE growth: prepend `weekly_suggestion, `)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java` (`@Import` the populator — the B1.1 precedent)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/WeeklySuggestionPersistenceIT.java`

**Interfaces:**
- Produces: generated `ProactiveApi.getWeeklySuggestion(LocalDate date)` + `WeeklySuggestionResponse` DTO (`getWeekStart()`, `getProse()`, `getGeneratedAt()`); `WeeklySuggestionEntity` (`setCreatedBy/setWeekStart(LocalDate)/setProse(String)/setGeneratedAt(Instant)`); `WeeklySuggestionRepository.findByCreatedByAndWeekStart(UUID, LocalDate): Optional<WeeklySuggestionEntity>`; `WeeklySuggestionPopulator.suggestion(UUID, LocalDate weekStart): WeeklySuggestionEntity` (prose default `"Heti tervjavaslat teszt."`, generatedAt `Instant.now().truncatedTo(ChronoUnit.MICROS)`).

- [ ] **Step 1: Contract fragment addition**

In `api/feature/proactive/proactive.yml` add under `paths:` (after the briefing path):

```yaml
  /api/proactive/weekly-suggestion:
    get:
      tags: [Proactive]
      operationId: getWeeklySuggestion
      summary: The companion's generated plan suggestion for the week containing the given day (lazily generated when the Monday cron has not produced it yet)
      parameters:
        - name: date
          in: query
          required: false
          description: Any day of the wanted week (the FE sends its LOCAL date); defaults to the server's today. The week identity is the ISO Monday.
          schema: { type: string, format: date }
      responses:
        '200':
          description: The persisted (or just-generated) weekly suggestion
          content:
            application/json:
              schema: { $ref: '#/components/schemas/WeeklySuggestionResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: No suggestion possible — no narrative memory (daily_summary) in the prior week. The FE keeps its honest placeholder.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

and under `components.schemas:`:

```yaml
    WeeklySuggestionResponse:
      type: object
      required: [weekStart, prose, generatedAt]
      properties:
        weekStart: { type: string, format: date }
        prose:
          type: string
          description: Plain Hungarian plan-suggestion prose (smart tier; no markdown structure)
        generatedAt: { type: string, format: date-time }
```

- [ ] **Step 2: Merge + regen + verify**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && cd ../backend && ./mvnw clean compile -q
```
Expected: BUILD SUCCESS; `ProactiveApi` gains `getWeeklySuggestion` (note its exact signature for Task 2's controller); FE types additive.

- [ ] **Step 3: Write the failing persistence IT**

`backend/src/test/java/io/mrkuhne/mezo/feature/proactive/WeeklySuggestionPersistenceIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.WeeklySuggestionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklySuggestionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeeklySuggestionPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** weekly_suggestion round-trip + the one-live-row-per-week partial-unique contract. */
@Transactional
class WeeklySuggestionPersistenceIT extends AbstractIntegrationTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 7, 6);

    @Autowired private WeeklySuggestionRepository weeklySuggestionRepository;
    @Autowired private WeeklySuggestionPopulator weeklySuggestionPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testSave_shouldRoundTrip_whenReloaded() {
        UUID user = userPopulator.createUser("ws-rt@test.local").getId();
        WeeklySuggestionEntity saved = weeklySuggestionPopulator.suggestion(user, MONDAY);

        assertThat(weeklySuggestionRepository.findByCreatedByAndWeekStart(user, MONDAY))
                .hasValueSatisfying(s -> {
                    assertThat(s.getId()).isEqualTo(saved.getId());
                    assertThat(s.getProse()).isEqualTo("Heti tervjavaslat teszt.");
                    assertThat(s.getGeneratedAt()).isNotNull();
                });
    }

    @Test
    void testSave_shouldRejectSecondLiveRowForSameWeek_whenUniqueIndexHolds() {
        UUID user = userPopulator.createUser("ws-uq@test.local").getId();
        weeklySuggestionPopulator.suggestion(user, MONDAY);

        assertThatThrownBy(() -> weeklySuggestionPopulator.suggestion(user, MONDAY))
                .hasMessageContaining("uq_weekly_suggestion_created_by_week_start");
    }

    @Test
    void testFindByCreatedByAndWeekStart_shouldReturnEmpty_whenOtherUsersRow() {
        UUID owner = userPopulator.createUser("ws-own@test.local").getId();
        UUID other = userPopulator.createUser("ws-other@test.local").getId();
        weeklySuggestionPopulator.suggestion(other, MONDAY);

        assertThat(weeklySuggestionRepository.findByCreatedByAndWeekStart(owner, MONDAY)).isEmpty();
    }
}
```

- [ ] **Step 4: Run — expect compile failure**

```bash
./mvnw clean test -q -Dtest=WeeklySuggestionPersistenceIT
```

- [ ] **Step 5: Migration + entity + repo + populator + plumbing**

`backend/src/main/resources/db/changelog/1.0.0/script/202607071200_mezo-h4wp.3_create_weekly_suggestion.sql`:

```sql
-- Proactive W1 (bd mezo-h4wp.3, roadmap §W1): the companion's weekly plan-suggestion prose.
-- One live row per user+week (ISO Monday); regenerable data — partial unique like briefing.

create table weekly_suggestion (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    week_start   date        not null,
    prose        text        not null,
    generated_at timestamptz not null,
    constraint pk_weekly_suggestion_id primary key (id),
    constraint fk_weekly_suggestion_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);

create unique index uq_weekly_suggestion_created_by_week_start
    on weekly_suggestion (created_by, week_start) where is_deleted = false;
```

Master changelog append:

```yaml
  - changeSet:
      id: "1.0.0:202607071200_mezo-h4wp.3_create_weekly_suggestion"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607071200_mezo-h4wp.3_create_weekly_suggestion.sql
```

`WeeklySuggestionEntity.java` (mirror `BriefingEntity` minus the jsonb):

```java
package io.mrkuhne.mezo.feature.proactive.entity;

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
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * The companion's weekly plan-suggestion prose (proactive W1, spec §5) — one live row per
 * user + ISO-Monday week; partial unique so a soft-deleted row can be regenerated.
 */
@Getter
@Setter
@Entity
@Table(name = "weekly_suggestion")
@SQLDelete(sql = "update weekly_suggestion set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class WeeklySuggestionEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** The ISO Monday of the suggested week. */
    @NotNull
    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    /** Smart-tier generated plain Hungarian prose. */
    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String prose;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
```

`WeeklySuggestionRepository.java`:

```java
package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.WeeklySuggestionEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WeeklySuggestionRepository extends JpaRepository<WeeklySuggestionEntity, UUID> {

    Optional<WeeklySuggestionEntity> findByCreatedByAndWeekStart(UUID createdBy, LocalDate weekStart);
}
```

`WeeklySuggestionPopulator.java`:

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.proactive.entity.WeeklySuggestionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklySuggestionRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code weekly_suggestion} rows (proactive W1). */
@TestComponent
@RequiredArgsConstructor
public class WeeklySuggestionPopulator {

    private final WeeklySuggestionRepository weeklySuggestionRepository;

    public WeeklySuggestionEntity suggestion(UUID createdBy, LocalDate weekStart) {
        WeeklySuggestionEntity entity = new WeeklySuggestionEntity();
        entity.setCreatedBy(createdBy);
        entity.setWeekStart(weekStart);
        entity.setProse("Heti tervjavaslat teszt.");
        entity.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return weeklySuggestionRepository.saveAndFlush(entity);
    }
}
```

Plumbing: `ResetDatabase` TRUNCATE list gains `weekly_suggestion, ` (prepend before `briefing, `); `AbstractIntegrationTest` `@Import` gains `WeeklySuggestionPopulator.class`.

- [ ] **Step 6: Run — expect green; FE gates for the regenerated types**

```bash
./mvnw clean test -q -Dtest=WeeklySuggestionPersistenceIT
cd ../frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: 3 IT PASS; FE all green (additive types).

- [ ] **Step 7: Commit**

```bash
git add api frontend/src/data/_client/api.gen.ts backend/src
git commit -m "feat(proactive): weekly-suggestion contract + table + plumbing (mezo-h4wp.3)"
```

---

### Task 2: Generator (smart tier) + Monday cron + lazy GET

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklySuggestionGenerator.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklySuggestionJob.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveWeeklySuggestionService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java` (one method)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/controller/ProactiveController.java` (implement the new op)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/ProactiveProperties.java` (Weekly record)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (job switch)
- Modify: `backend/src/main/resources/application.yml` (weekly cron + techcore switch)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (weekly sentinel — LITERAL marker, cycle rule)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/WeeklySuggestionGeneratorIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/WeeklySuggestionJobIT.java`
- Modify (test): `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ProactiveApiIT.java` + `ProactiveApiSwitchOffIT.java` (weekly-suggestion cases)

**Interfaces:**
- Consumes: Task 1's entity/repo/populator + generated `ProactiveApi.getWeeklySuggestion` + `WeeklySuggestionResponse`; companion reads: `DailySummaryRepository.findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc`, `KnowledgeFactService.renderPromptBlock`, `PatternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc`, `ContextSnapshotAssembler.render`, `CompanionLlm.completeSmart(String, String)`.
- Produces: `WeeklySuggestionGenerator.WEEKLY_SUGGESTION_MARKER` (= `"HETI-TERVJAVASLAT"`), `.generate(UUID userId, LocalDate weekStart): WeeklySuggestionEntity` (null = no prior-week memory / blank answer), `.gather(UUID, LocalDate weekStart): String` (null when empty); `ProactiveWeeklySuggestionService.getWeeklySuggestion(UUID, LocalDate date): WeeklySuggestionResponse` (404 idiom on null); `WeeklySuggestionJob.run()`.

- [ ] **Step 1: Write the failing ITs**

`WeeklySuggestionGeneratorIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.WeeklySuggestionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklySuggestionRepository;
import io.mrkuhne.mezo.feature.proactive.service.WeeklySuggestionGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeeklySuggestionPopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * W1 generation flow over the fake LLM: gather = prior-week summaries + facts + patterns +
 * snapshot; the [fake-weekly:…] sentinel (planted via a check-in note → snapshot) scripts the
 * prose; empty prior week or blank answer ⇒ NO row (honest absence). The smart tier is used —
 * the fake's completeSmart default delegates to complete, so the marker dispatch covers both.
 */
@Transactional
@ActiveProfiles("companion-fake")
class WeeklySuggestionGeneratorIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START =
            LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

    @Autowired private WeeklySuggestionGenerator generator;
    @Autowired private WeeklySuggestionRepository repository;
    @Autowired private WeeklySuggestionPopulator weeklySuggestionPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private KnowledgeFactPopulator knowledgeFactPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testGather_shouldComposePriorWeekSummariesFactsAndSnapshot_whenDataExists() {
        UUID user = userPopulator.createUser("ws-gather@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.minusDays(2), "Előző héten kemény edzés volt.");
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(1), "E heti nap — nem tartozik bele.");
        knowledgeFactPopulator.fact(user, "Laktózérzékeny", "health", 1);

        String payload = generator.gather(user, WEEK_START);

        assertThat(payload)
                .contains("Előző héten kemény edzés volt.")
                .doesNotContain("E heti nap — nem tartozik bele.")   // strictly BEFORE week_start
                .contains("Laktózérzékeny")
                .contains("AKTUÁLIS ÁLLAPOT");
    }

    @Test
    void testGather_shouldReturnNull_whenPriorWeekEmpty() {
        UUID user = userPopulator.createUser("ws-empty@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(1), "Csak e heti nap van.");

        assertThat(generator.gather(user, WEEK_START)).isNull();
    }

    @Test
    void testGenerate_shouldPersistScriptedProse_whenSentinelPlanted() {
        UUID user = userPopulator.createUser("ws-gen@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.minusDays(1), "Tegnap pihenő volt.");
        checkInPopulator.createCheckIn(user, LocalDate.now(), "06:30", 4, 2,
                "[fake-weekly:Fókuszálj az alvásra és a fehérjére ezen a héten.]");

        WeeklySuggestionEntity suggestion = generator.generate(user, WEEK_START);

        assertThat(suggestion).isNotNull();
        assertThat(suggestion.getProse()).isEqualTo("Fókuszálj az alvásra és a fehérjére ezen a héten.");
        assertThat(suggestion.getWeekStart()).isEqualTo(WEEK_START);
    }

    @Test
    void testGenerate_shouldReturnExisting_whenRowAlreadyExists() {
        UUID user = userPopulator.createUser("ws-idem@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.minusDays(1), "Tegnap úszás volt.");
        WeeklySuggestionEntity existing = weeklySuggestionPopulator.suggestion(user, WEEK_START);

        assertThat(generator.generate(user, WEEK_START).getId()).isEqualTo(existing.getId());
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void testGenerate_shouldReturnNull_whenAnswerBlank() {
        UUID user = userPopulator.createUser("ws-blank@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.minusDays(1), "Tegnap futás volt.");
        checkInPopulator.createCheckIn(user, LocalDate.now(), "06:30", 4, 2, "[fake-weekly: ]");

        assertThat(generator.generate(user, WEEK_START)).isNull();
        assertThat(repository.count()).isZero();
    }
}
```

`WeeklySuggestionJobIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.repository.WeeklySuggestionRepository;
import io.mrkuhne.mezo.feature.proactive.service.WeeklySuggestionJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** W1 Monday cron: generates the CURRENT week's suggestion per user; idempotent; isolated. */
@ActiveProfiles("companion-fake")
class WeeklySuggestionJobIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START =
            LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

    @Autowired private WeeklySuggestionJob job;
    @Autowired private WeeklySuggestionRepository repository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRun_shouldGenerateCurrentWeekSuggestion_whenPriorWeekHasMemory() {
        UUID user = userPopulator.createUser("wsjob-gen@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.minusDays(3), "Előző heti nap.");

        job.run();

        assertThat(repository.findByCreatedByAndWeekStart(user, WEEK_START)).isPresent();
    }

    @Test
    void testRun_shouldBeIdempotent_whenSuggestionExists() {
        UUID user = userPopulator.createUser("wsjob-idem@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.minusDays(3), "Előző heti nap.");

        job.run();
        var first = repository.findByCreatedByAndWeekStart(user, WEEK_START).orElseThrow();
        job.run();

        assertThat(repository.findByCreatedByAndWeekStart(user, WEEK_START))
                .hasValueSatisfying(s -> assertThat(s.getId()).isEqualTo(first.getId()));
    }
}
```

`ProactiveApiIT.java` — ADD two tests (existing scaffolding: `ownerId()`, populators):

```java
    @Test
    void testGetWeeklySuggestion_shouldLazilyGenerate_whenPriorWeekHasMemory() {
        LocalDate weekStart = LocalDate.now()
                .with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        dailySummaryPopulator.summary(ownerId(), weekStart.minusDays(2), "Előző héten edzés volt.");

        WeeklySuggestionResponse suggestion = getForBody(
                "/api/proactive/weekly-suggestion", ownerAuthHeaders(), HttpStatus.OK, WeeklySuggestionResponse.class);

        assertThat(suggestion.getWeekStart()).isEqualTo(weekStart);
        assertThat(suggestion.getProse()).isNotBlank();
    }

    @Test
    void testGetWeeklySuggestion_shouldReturn404_whenNoPriorWeekMemory() {
        String body = getForBody(
                "/api/proactive/weekly-suggestion", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
```

(import `io.mrkuhne.mezo.api.dto.WeeklySuggestionResponse`.)

`ProactiveApiSwitchOffIT.java` — ADD:

```java
    @Test
    void testGetWeeklySuggestion_shouldReturn404_whenProactiveSwitchedOff() {
        String body = getForBody(
                "/api/proactive/weekly-suggestion", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
```

- [ ] **Step 2: Run — expect compile failure**

```bash
./mvnw clean test -q -Dtest='WeeklySuggestion*IT'
```

- [ ] **Step 3: Config + switch + fake dispatch**

`ProactiveProperties.java` — top-level record gains a Weekly group:

```java
public record ProactiveProperties(@NotNull @Valid Briefing briefing, @NotNull @Valid Weekly weekly) {
    ...
    /** W1 weekly plan-suggestion generation. */
    public record Weekly(
        /** Monday-dawn schedule (server zone) — the suggestion is FOR the week just starting. */
        @NotBlank String cron
    ) {}
}
```

`FeaturesConfiguration.java` — append:

```java
    /** W1 Monday weekly-suggestion job — techcore cron zone (schedule: mezo.proactive.weekly.cron). */
    public static final String WEEKLY_SUGGESTION_JOB_SWITCH = "mezo.techcore.cron.weekly-suggestion-job.enabled";
```

`application.yml` — `mezo.proactive` gains:

```yaml
    weekly:
      # W1 Monday-dawn plan-suggestion schedule (server zone); gathered from the finished previous week
      cron: "0 0 6 * * MON"
```

and `mezo.techcore.cron` gains:

```yaml
      # W1 Monday weekly-suggestion pre-generation (schedule: mezo.proactive.weekly.cron);
      # off = the WeeklySuggestionJob bean does not exist
      weekly-suggestion-job:
        enabled: true
```

`FakeCompanionLlm.java` — next to the briefing sentinel:

```java
    /** Mirror of WeeklySuggestionGenerator.WEEKLY_SUGGESTION_MARKER (feature/proactive) — a
     *  LITERAL, not an import (package-cycle rule; drift fails WeeklySuggestionGeneratorIT loudly). */
    public static final String WEEKLY_MARKER_MIRROR = "HETI-TERVJAVASLAT";

    /** Scripted weekly prose (W1): {@code [fake-weekly:…]} planted via a check-in note. */
    public static final Pattern WEEKLY_SENTINEL =
            Pattern.compile("\\[fake-weekly:([^\\]]*)]", Pattern.DOTALL);
```

and in `complete(...)` after the briefing branch:

```java
        if (systemPrompt.startsWith(WEEKLY_MARKER_MIRROR)) {
            Matcher m = WEEKLY_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1) : "FAKE-HETI-TERVJAVASLAT";
        }
```

- [ ] **Step 4: Generator + job + service + mapper + controller**

`WeeklySuggestionGenerator.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklySuggestionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklySuggestionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * W1 weekly plan-suggestion generator (spec §5): PURE-CODE gather (prior-week daily summaries
 * strictly BEFORE week_start + facts block + pattern list — the HypothesisPipelineService
 * idiom — plus the V0.3 snapshot for the current state) → ONE SMART-tier call → plain
 * Hungarian prose. Empty prior week or blank answer ⇒ NO row (honest absence). Existing row ⇒
 * returned untouched (idempotent; no weekly staleness machinery by decision).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class WeeklySuggestionGenerator {

    /** Prompt prefix the fake LLM dispatches on — MIRRORED as a literal in FakeCompanionLlm. */
    public static final String WEEKLY_SUGGESTION_MARKER = "HETI-TERVJAVASLAT";

    private static final String PROMPT = WEEKLY_SUGGESTION_MARKER + "\n"
            + "Írj rövid (3-5 mondatos), magyar heti tervjavaslatot Danielnek a most kezdődő "
            + "hétre, kizárólag a megadott adatokból. Építs az előző hét összefoglalóira, a "
            + "megerősített tényekre és a mintákra; adj 2-3 konkrét, végrehajtható javaslatot. "
            + "Számot vagy adatot kitalálni tilos; gyógyszer adagolására (pl. retatrutid) "
            + "vonatkozó változtatást SOHA ne javasolj — az orvosi döntés. Sima folyószöveggel "
            + "válaszolj, markdown és felsorolás nélkül.";

    private final WeeklySuggestionRepository weeklySuggestionRepository;
    private final DailySummaryRepository dailySummaryRepository;
    private final PatternRepository patternRepository;
    private final ContextSnapshotAssembler contextSnapshotAssembler;
    private final KnowledgeFactService knowledgeFactService;
    private final CompanionLlm companionLlm;

    /** Generates (or returns the existing) suggestion for one ISO-Monday week; null = honest absence. */
    @Transactional
    public WeeklySuggestionEntity generate(UUID userId, LocalDate weekStart) {
        WeeklySuggestionEntity existing = weeklySuggestionRepository
                .findByCreatedByAndWeekStart(userId, weekStart).orElse(null);
        if (existing != null) {
            return existing;
        }
        String payload = gather(userId, weekStart);
        if (payload == null) {
            log.debug("No prior-week summaries for {} before {} — no suggestion", userId, weekStart);
            return null;
        }
        String prose = companionLlm.completeSmart(PROMPT, payload);
        if (prose == null || prose.isBlank()) {
            log.warn("Blank weekly-suggestion answer for {} week {} — no row", userId, weekStart);
            return null;
        }
        WeeklySuggestionEntity suggestion = new WeeklySuggestionEntity();
        suggestion.setCreatedBy(userId);
        suggestion.setWeekStart(weekStart);
        suggestion.setProse(prose.strip());
        suggestion.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return weeklySuggestionRepository.saveAndFlush(suggestion);
    }

    /** PURE-CODE prompt payload; null when the prior week (strictly before weekStart) is empty. */
    public String gather(UUID userId, LocalDate weekStart) {
        List<DailySummaryEntity> priorWeek = dailySummaryRepository
                .findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(
                        userId, weekStart.minusDays(7)).stream()
                .filter(s -> s.getSummaryDate().isBefore(weekStart))
                .toList();
        if (priorWeek.isEmpty()) {
            return null;
        }
        String narratives = priorWeek.stream()
                .map(s -> "- " + s.getSummaryDate() + ": " + s.getNarrative())
                .collect(Collectors.joining("\n"));
        String facts = knowledgeFactService.renderPromptBlock(userId);
        String patterns = patternRepository
                .findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(userId).stream()
                .map(p -> "- " + p.getTitle() + " (státusz: " + p.getStatus() + ")")
                .collect(Collectors.joining("\n"));
        return contextSnapshotAssembler.render(userId, LocalDate.now())
                + facts
                + "\n\nELŐZŐ HÉT NAPJAI (legfrissebb elöl):\n" + narratives
                + (patterns.isBlank() ? "" : "\n\nMINTÁK:\n" + patterns);
    }
}
```

`WeeklySuggestionJob.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * W1 Monday-dawn pre-generation: the CURRENT week's suggestion per user (gathered from the
 * finished previous week). Idempotent; per-user failures isolated; the lazy GET covers misses.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.WEEKLY_SUGGESTION_JOB_SWITCH},
        havingValue = "true")
public class WeeklySuggestionJob {

    private final AppUserRepository appUserRepository;
    private final WeeklySuggestionGenerator generator;

    @Scheduled(cron = "${mezo.proactive.weekly.cron}")
    public void run() {
        LocalDate weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        int generated = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                if (generator.generate(user.getId(), weekStart) != null) {
                    generated++;
                }
            } catch (Exception e) {
                log.warn("Weekly suggestion failed for user {} week {}", user.getId(), weekStart, e);
            }
        }
        log.info("Weekly-suggestion run for {}: {} suggestion(s) present", weekStart, generated);
    }
}
```

`ProactiveWeeklySuggestionService.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.WeeklySuggestionResponse;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklySuggestionEntity;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklySuggestionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The weekly-suggestion read path: persisted row or lazy generation; honest 404 otherwise. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ProactiveWeeklySuggestionService {

    private final WeeklySuggestionRepository weeklySuggestionRepository;
    private final WeeklySuggestionGenerator generator;
    private final ProactiveMapper mapper;

    /** date = null ⇒ server today; the week identity is the ISO Monday of that day. */
    @Transactional
    public WeeklySuggestionResponse getWeeklySuggestion(UUID userId, LocalDate date) {
        LocalDate weekStart = (date != null ? date : LocalDate.now())
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        WeeklySuggestionEntity suggestion = weeklySuggestionRepository
                .findByCreatedByAndWeekStart(userId, weekStart)
                .orElseGet(() -> generator.generate(userId, weekStart));
        if (suggestion == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
        }
        return mapper.toWeeklySuggestionResponse(suggestion);
    }
}
```

`ProactiveMapper.java` — add:

```java
    @Mapping(target = "weekStart", source = "weekStart")
    WeeklySuggestionResponse toWeeklySuggestionResponse(WeeklySuggestionEntity entity);
```

(+ import `io.mrkuhne.mezo.api.dto.WeeklySuggestionResponse` and the entity; the existing `Instant→OffsetDateTime` default method covers `generatedAt`. If MapStruct warns the explicit same-name mapping is redundant, drop the `@Mapping` line.)

`ProactiveController.java` — add:

```java
    @Override
    public WeeklySuggestionResponse getWeeklySuggestion(LocalDate date) {
        return weeklySuggestionService.getWeeklySuggestion(currentUserId.get(), date);
    }
```

(+ inject `private final ProactiveWeeklySuggestionService weeklySuggestionService;`, import the DTO; match the generated signature noted in Task 1 Step 2.)

- [ ] **Step 5: Run the ITs, then the full gate**

```bash
./mvnw clean test -q -Dtest='WeeklySuggestion*IT,ProactiveApi*IT'
./mvnw clean test
```
Expected: all green (incl. ArchUnit — the fake's weekly mirror stays a literal).

- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "feat(proactive): WeeklySuggestionGenerator (smart tier) + Monday cron + lazy GET (mezo-h4wp.3)"
```

---

### Task 3: FE — `useWeekly().weeklySuggestion` goes real + live buttons hide

**Files:**
- Create: `frontend/src/data/insights/weeklySuggestionApi.ts`
- Modify: `frontend/src/data/insights/weeklyHooks.ts` (real branch reads the GET)
- Modify: `frontend/src/features/insights/pages/WeeklyPage.tsx` (buttons only in mock)
- Modify: `frontend/src/test/msw/handlers.ts` (default 404)
- Test: `frontend/src/data/insights/weeklyHooks.test.tsx` (extend)
- Test: `frontend/src/features/insights/pages/WeeklyPage.test.tsx` (extend)

**Interfaces:**
- Consumes: generated `paths['/api/proactive/weekly-suggestion']` types; `ApiError`/`apiFetch`; the existing `useWeekly` real-branch scaffolding (`mondayIso()` start, `useRealQuery`-style composition) and `WeeklyView { …, weeklySuggestion: string | null, mode: 'mock' | 'live' }`.
- Produces: real-mode `weeklySuggestion` = the server prose or null; the `WeeklyView` shape is UNCHANGED (hook-signature stability).

- [ ] **Step 1: Extend the tests (failing first)**

`weeklyHooks.test.tsx` — ADD to the real-mode describe (mirror the file's existing MSW/wrapper idioms):

```tsx
  it('serves the generated weeklySuggestion prose when the GET succeeds', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/weekly-suggestion`, () => HttpResponse.json({
      weekStart: '2026-07-06', prose: 'Fókuszálj az alvásra ezen a héten.',
      generatedAt: '2026-07-06T06:00:00Z',
    })))
    const { result } = renderHook(() => useWeekly(), { wrapper })
    await waitFor(() => expect(result.current.weeklySuggestion).toBe('Fókuszálj az alvásra ezen a héten.'))
  })

  it('keeps weeklySuggestion null on the default 404 (honest placeholder)', async () => {
    const { result } = renderHook(() => useWeekly(), { wrapper })
    await waitFor(() => expect(result.current.mode).toBe('live'))
    expect(result.current.weeklySuggestion).toBeNull()
  })
```

`WeeklyPage.test.tsx` — ADD a live-suggestion case asserting the prose renders AND the buttons are absent, e.g.:

```tsx
  it('renders the live suggestion prose WITHOUT the inert Elfogad/Hangoljuk buttons', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/weekly-suggestion`, () => HttpResponse.json({
      weekStart: '2026-07-06', prose: 'Élő heti javaslat.', generatedAt: '2026-07-06T06:00:00Z',
    })))
    render(<WeeklyPage />, { wrapper })
    expect(await screen.findByText('Élő heti javaslat.')).toBeInTheDocument()
    expect(screen.queryByText('Elfogad')).not.toBeInTheDocument()
    expect(screen.queryByText('Hangoljuk')).not.toBeInTheDocument()
  })
```

(adapt render/wrapper to the file's existing idioms; the EXISTING mock-mode tests asserting the buttons must stay untouched and green.)

- [ ] **Step 2: Run — expect failures**

```bash
cd frontend && pnpm test -- weeklyHooks WeeklyPage
```

- [ ] **Step 3: Implement**

`frontend/src/data/insights/weeklySuggestionApi.ts`:

```ts
import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'

type WeeklySuggestionWire =
  paths['/api/proactive/weekly-suggestion']['get']['responses']['200']['content']['application/json']

export const weeklySuggestionApi = {
  /** The generated plan-suggestion prose for the week containing the FE's local day. */
  get: (date: string) =>
    apiFetch<WeeklySuggestionWire>(`/api/proactive/weekly-suggestion?date=${date}`).then((w) => w.prose),
}
```

`weeklyHooks.ts` — in the REAL branch add a query beside the existing composition (the file's `useRealQuery`-style idiom; 404 → null, the `patternsHooks` catch pattern):

```ts
import { ApiError } from '@/data/_client/api'
import { weeklySuggestionApi } from '@/data/insights/weeklySuggestionApi'
import { localDateString } from '@/shared/lib/dates'
```

query (placed with the other real-mode queries, BEFORE the mock early-return per rules of hooks — mirror how the file already handles its mock/real split; if the file's queries sit after an early return, follow ITS structure and gate with `enabled: !mock`):

```ts
  const suggestionQ = useQuery<string | null>({
    queryKey: ['weeklySuggestion', start],
    queryFn: async () => {
      try {
        return await weeklySuggestionApi.get(localDateString())
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null
        throw e
      }
    },
    enabled: !mock,
    retry: false,
  })
```

and the real return's `weeklySuggestion: null` becomes:

```ts
    weeklySuggestion: suggestionQ.data ?? null,
```

`WeeklyPage.tsx` — the buttons row renders only in mock mode (the seed keeps its Phase-1 look):

```tsx
          {mode === 'mock' ? (
            <div className="row gap-sm mt-md">
              <button type="button" className="cta-ghost notch-4" style={{ fontSize: 10 }}>Elfogad</button>
              <button type="button" className="chip" style={{ fontSize: 9 }}>Hangoljuk</button>
            </div>
          ) : null}
```

(destructure `mode` from the existing `useWeekly()` call; keep the surrounding markup byte-identical for mock.)

`handlers.ts` — add the default:

```ts
  // Proactive weekly suggestion (W1) — default: honest 404, the Weekly card keeps its placeholder.
  http.get(`${API_BASE}/api/proactive/weekly-suggestion`, () => new HttpResponse(null, { status: 404 })),
```

- [ ] **Step 4: Focused tests, then full FE gates**

```bash
pnpm test -- weeklyHooks WeeklyPage
pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: all green both modes (mock byte-parity: seed prose + buttons unchanged).

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(fe): Weekly renders the generated tervjavaslat — live buttons hidden (mezo-h4wp.3)"
```

---

### Task 4: Docs + gates

**Files:**
- Modify: `docs/features/proactive.md` (§1 status W1 · §2 Weekly surface · §3 flow + Monday cron · §4 table/config · §8 tests · §9 decisions · §10 files)
- Modify: `docs/features/insights.md` (§2.2 Weekly: real suggestion + hidden buttons; §9 the weeklySuggestion row flips; §4 endpoint note)
- Modify: `docs/milestones/roadmap.md` (milestone row + Phase-4 W-stage tick "(W1 ✅ 2026-07-06)")
- Modify: `docs/superpowers/plans/2026-07-06-proactive-roadmap.md` (§W1 heading ✅)

**Steps:**

- [ ] **Step 1:** Update the four docs per the file list (overwrite-in-place, file:line pointers, bump `updated:`; the W1 decisions from Global Constraints land in proactive.md §9 + insights.md §9). Milestone row:

```markdown
| 2026-07-06 | **Proactive W1 — weeklySuggestion prose (`mezo-h4wp.3`)** shipped: `weekly_suggestion` table (ISO-Monday identity, partial unique) + smart-tier `WeeklySuggestionGenerator` (gather = prior-week daily summaries strictly before week_start + facts + patterns + V0.3 snapshot → ONE `completeSmart` call, plain HU prose, honest-null) + Monday-06:00 `WeeklySuggestionJob` + lazy `GET /api/proactive/weekly-suggestion` (404 = the FE's honest placeholder). FE: `useWeekly().weeklySuggestion` real (404→null), the inert „Elfogad/Hangoljuk" buttons hidden in live mode (false affordance), mock byte-parity. The Insights Weekly card now speaks. |
```

- [ ] **Step 2:** Gates:

```bash
node scripts/lint-docs.mjs        # 0 stale/0 error (clear any collateral drift the same way as B1.2 Task 5)
cd backend && ./mvnw clean test
cd ../frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs(proactive): W1 shipped — weekly suggestion live docs (mezo-h4wp.3)"
```

(Merge --no-ff + push + `bd close mezo-h4wp.3` + the D′-score-constants follow-up bd issue = controller, after the final whole-branch review.)

---

## Self-review notes (done while writing)

- **Roadmap §W1 coverage:** table+generator+cron+GET ✅ (T1–T2) · FE swap + placeholder-as-degraded ✅ (T3) · insights.md update ✅ (T4) · open decisions (cron day/time, buttons) closed in Global Constraints · score-constants promotion explicitly deferred to a follow-up bd issue (controller files it).
- **Type consistency:** `WeeklySuggestionEntity.weekStart/prose/generatedAt` (T1) = generator/service/mapper usage (T2); `weeklySuggestionApi.get → string` (T3) = `weeklySuggestion: string | null`; marker literal `"HETI-TERVJAVASLAT"` identical in generator and fake.
- **Verify-at-execution points flagged in-task:** generated `getWeeklySuggestion` signature (T1 Step 2 → T2 Step 4), `weeklyHooks.ts` real-branch query placement idiom (T3 Step 3), WeeklyPage/weeklyHooks test scaffolding idioms (T3 Step 1).
- **Smart-tier proof:** the fake's `completeSmart` default delegates to `complete`, so the marker dispatch covers the IT path; the REAL smart-tier routing is `GeminiCompanionLlm`'s existing `completeSmart` (V3.2-proven) — no new adapter work.
