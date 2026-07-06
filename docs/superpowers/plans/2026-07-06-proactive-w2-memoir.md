# W2 — Memoir — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the companion writes the week's story — the Insights Memoir tab un-ghosts in real mode with a REAL Sunday-evening narrative (`mezo-h4wp.4`).

**Architecture:** a `memoir` table (title + body + anchors jsonb) + smart-tier `MemoirGenerator` (gather = the week's daily summaries + facts + patterns; strict-JSON `{title, body, anchorIndexes}`; anchors are code-collected candidates the model SELECTS by index — the briefing ref rule) + Sunday-19:00 `MemoirJob` (old journey 5.8) + `GET /api/proactive/memoir` (latest row; lazy fallback generates the LAST COMPLETED week). FE: a new dual-mode `useMemoir()` hook; MemoirPage drops its ghost guard, `memoir` leaves `PHASE3_TAB_IDS`; the local-only reactions + anniversary card + archive footer become mock-only (unpersisted interactivity = false affordance, the W1 button precedent).

**Tech Stack:** the shipped proactive skeleton · `CompanionLlm.completeSmart` · TanStack Query + MSW.

**Design of record:** spec `docs/superpowers/specs/2026-07-06-proactive-layer-design.md` §5 · roadmap §W2 · living doc `docs/features/proactive.md`.

## Global Constraints

- Backend house rules as in B1.x/W1 (UUID/OwnedEntity/soft-delete/method-level `@Transactional`/no `@Value`/ArchUnit: NO companion→proactive import — marker LITERAL-mirrored in the fake; controllers implement the generated API; NO raw exceptions — **Task 1 ships the real read service, so no temp stub ever exists** (the W1 lesson)). ALWAYS `./mvnw clean test` (compose up).
- Every proactive bean: dual-switch (`COMPANION_SWITCH` + `PROACTIVE_SWITCH`); the job adds `MEMOIR_JOB_SWITCH` as a third.
- Honesty: anchors only from code-collected candidates (bounds-checked, deduped); unparseable/blank answer or an empty week-window ⇒ NO row ⇒ 404; the FE renders an honest "készül" state on 404 — never demo fiction in real mode.
- FE conventions: `data/insights/` implementation, barrel-only re-export, deep `@/*` imports, colocated tests, mock byte-parity (the full demo memoir + reactions + anniversary + archive render EXACTLY as Phase-1 in mock), both modes + build green.
- **Decisions this slice closes (roadmap §W2 open decisions):**
  - **Cron = Sunday 19:00** (`mezo.proactive.memoir.cron: "0 0 19 * * SUN"`, the old PRD journey 5.8) — the memoir covers the week ENDING that Sunday (`week_start = previousOrSame(MONDAY)`); at generation time Mon–Sat summaries exist (Sunday's own summary is born at the next dawn — documented, accepted).
  - **Lazy fallback = the LAST COMPLETED week** (`previousOrSame(MONDAY).minusWeeks(1)`) when NO memoir row exists at all; gate: ≥1 daily summary inside `[weekStart, weekStart+6]`, else 404. `GET /api/proactive/memoir` takes NO parameters and returns the LATEST live row (archive = later).
  - **Reactions (Like/Love/Save/Dismiss) are MOCK-ONLY v1** — an unpersisted reaction is a false affordance; a follow-up bd issue (persisted reactions as companion signal) is filed by the controller at close-out. Anniversary card + "Memoir archive · 17 darab" footer likewise mock-only (deferred epic / later).
  - **Marker = `"HETI-MEMOIR-FELADAT"`** — verified against all existing markers: no `startsWith` prefix collision (nearest neighbour `HETI-TERVJAVASLAT` diverges at char 6).
  - **FE week label derives client-side**: `Hét ${isoWeekNumber(weekStart)} · ${deriveWeekTitle(weekStart)}` (helpers already exported by `weeklyHooks.ts` / `fuelWeekHooks.ts`).

**Branch first:** `git checkout -b feat/proactive-w2` (main checkout, NOT a worktree).

---

### Task 1: Contract + `memoir` table + read path (latest-or-404)

**Files:**
- Modify: `api/feature/proactive/proactive.yml` (new path + 2 schemas)
- Generated (commit): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607071500_mezo-h4wp.4_create_memoir.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/MemoirAnchorsEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/MemoirEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/MemoirRepository.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveMemoirService.java` (read-only in this task)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java` (memoir mapping)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/controller/ProactiveController.java` (implement the new op — REAL delegation, no stub)
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/MemoirPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (TRUNCATE: prepend `memoir, `)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java` (`@Import` the populator)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/MemoirPersistenceIT.java`
- Modify (test): `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ProactiveApiIT.java` + `ProactiveApiSwitchOffIT.java`

**Interfaces:**
- Produces: generated `ProactiveApi.getMemoir()` (no params) + `MemoirResponse` (`getWeekStart()/getTitle()/getBody()/getAnchors()/getGeneratedAt()`) + `MemoirAnchor` (`getKind()/getLabel()`); `MemoirEntity` (`setCreatedBy/setWeekStart(LocalDate)/setTitle(String)/setBody(String)/setAnchors(MemoirAnchorsEnvelope)/setGeneratedAt(Instant)`); `MemoirAnchorsEnvelope(List<Anchor> anchors)` + nested `record Anchor(String kind, String label)`; `MemoirRepository.findByCreatedByAndWeekStart(UUID, LocalDate)` + `findFirstByCreatedByOrderByWeekStartDesc(UUID)`; `MemoirPopulator.memoir(UUID, LocalDate weekStart)` (title `"Teszt memoir"`, body `"Teszt heti narratíva."`, one anchor `("Memory", "2026-07-01")`, generatedAt µs-truncated); `ProactiveMemoirService.getMemoir(UUID): MemoirResponse` (Task 2 extends it with the lazy path).

- [ ] **Step 1: Contract addition**

`proactive.yml` — new path after weekly-suggestion:

```yaml
  /api/proactive/memoir:
    get:
      tags: [Proactive]
      operationId: getMemoir
      summary: The latest weekly memoir (lazily generated for the last completed week when none exists yet)
      responses:
        '200':
          description: The latest persisted (or just-generated) memoir
          content:
            application/json:
              schema: { $ref: '#/components/schemas/MemoirResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: No memoir possible — no narrative memory in the last completed week. The FE renders its honest "készül" state.
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

new schemas:

```yaml
    MemoirAnchor:
      type: object
      required: [kind, label]
      properties:
        kind:
          type: string
          description: FE RefTag kind (Memory/Pattern/…) — code-collected, model-SELECTED, never invented
        label:
          type: string
    MemoirResponse:
      type: object
      required: [weekStart, title, body, anchors, generatedAt]
      properties:
        weekStart: { type: string, format: date }
        title:
          type: string
          description: Display title of the week's narrative
        body:
          type: string
          description: The memoir prose (single narrative paragraph block)
        anchors:
          type: array
          items: { $ref: '#/components/schemas/MemoirAnchor' }
        generatedAt: { type: string, format: date-time }
```

- [ ] **Step 2: Merge + regen + verify**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && cd ../backend && ./mvnw clean compile -q
```
Note the generated `getMemoir()` signature (expected: no parameters).

- [ ] **Step 3: Write the failing ITs**

`MemoirPersistenceIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.MemoirAnchorsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoirPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** memoir jsonb-envelope round-trip + one-live-row-per-week + latest-first finder. */
@Transactional
class MemoirPersistenceIT extends AbstractIntegrationTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 6, 29);

    @Autowired private MemoirRepository memoirRepository;
    @Autowired private MemoirPopulator memoirPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testSave_shouldRoundTripAnchorsEnvelope_whenReloaded() {
        UUID user = userPopulator.createUser("memoir-rt@test.local").getId();
        MemoirEntity saved = memoirPopulator.memoir(user, MONDAY);

        assertThat(memoirRepository.findByCreatedByAndWeekStart(user, MONDAY))
                .hasValueSatisfying(m -> {
                    assertThat(m.getId()).isEqualTo(saved.getId());
                    assertThat(m.getTitle()).isEqualTo("Teszt memoir");
                    assertThat(m.getAnchors().anchors())
                            .containsExactly(new MemoirAnchorsEnvelope.Anchor("Memory", "2026-07-01"));
                });
    }

    @Test
    void testSave_shouldRejectSecondLiveRowForSameWeek_whenUniqueIndexHolds() {
        UUID user = userPopulator.createUser("memoir-uq@test.local").getId();
        memoirPopulator.memoir(user, MONDAY);

        assertThatThrownBy(() -> memoirPopulator.memoir(user, MONDAY))
                .hasMessageContaining("uq_memoir_created_by_week_start");
    }

    @Test
    void testFindFirstByCreatedByOrderByWeekStartDesc_shouldReturnLatestOwnRow() {
        UUID owner = userPopulator.createUser("memoir-latest@test.local").getId();
        UUID other = userPopulator.createUser("memoir-foreign@test.local").getId();
        memoirPopulator.memoir(owner, MONDAY.minusWeeks(1));
        MemoirEntity latest = memoirPopulator.memoir(owner, MONDAY);
        memoirPopulator.memoir(other, MONDAY.plusWeeks(1));

        assertThat(memoirRepository.findFirstByCreatedByOrderByWeekStartDesc(owner))
                .hasValueSatisfying(m -> assertThat(m.getId()).isEqualTo(latest.getId()));
    }
}
```

`ProactiveApiIT.java` — ADD (lazy case arrives in Task 2; here the persisted-row + absence paths):

```java
    @Test
    void testGetMemoir_shouldReturnLatestPersistedRow_whenOneExists() {
        LocalDate monday = LocalDate.now().with(
                java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        memoirPopulator.memoir(ownerId(), monday.minusWeeks(1));

        MemoirResponse memoir = getForBody(
                "/api/proactive/memoir", ownerAuthHeaders(), HttpStatus.OK, MemoirResponse.class);

        assertThat(memoir.getTitle()).isEqualTo("Teszt memoir");
        assertThat(memoir.getAnchors()).hasSize(1);
    }

    @Test
    void testGetMemoir_shouldReturn404_whenNoMemoirAndNoMemory() {
        String body = getForBody(
                "/api/proactive/memoir", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
```

(autowire `MemoirPopulator memoirPopulator`; import `MemoirResponse`.)

`ProactiveApiSwitchOffIT.java` — ADD:

```java
    @Test
    void testGetMemoir_shouldReturn404_whenProactiveSwitchedOff() {
        String body = getForBody(
                "/api/proactive/memoir", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
```

- [ ] **Step 4: Run — expect compile failure**

```bash
./mvnw clean test -q -Dtest='Memoir*IT,ProactiveApi*IT'
```

- [ ] **Step 5: Migration + entity + repo + service + mapper + controller + plumbing**

Migration `202607071500_mezo-h4wp.4_create_memoir.sql`:

```sql
-- Proactive W2 (bd mezo-h4wp.4, roadmap §W2): the weekly memoir narrative.
-- One live row per user+week (ISO Monday); anchors = typed jsonb envelope of code-collected,
-- model-selected refs (the briefing envelope precedent).

create table memoir (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    week_start   date        not null,
    title        varchar(200) not null,
    body         text        not null,
    anchors      jsonb       not null,
    generated_at timestamptz not null,
    constraint pk_memoir_id primary key (id),
    constraint fk_memoir_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);

create unique index uq_memoir_created_by_week_start
    on memoir (created_by, week_start) where is_deleted = false;
```

Master changelog append (id `"1.0.0:202607071500_mezo-h4wp.4_create_memoir"`, same shape as the siblings).

`MemoirAnchorsEnvelope.java`:

```java
package io.mrkuhne.mezo.feature.proactive.entity;

import java.util.List;

/**
 * Typed jsonb envelope for memoir.anchors (the BriefingContentEnvelope precedent): refs the
 * model SELECTED by index from code-collected candidates — never invented (spec §6).
 */
public record MemoirAnchorsEnvelope(List<Anchor> anchors) {

    public record Anchor(String kind, String label) {
    }
}
```

`MemoirEntity.java` (the `BriefingEntity` pattern: `@Table(name = "memoir")`, `@SQLDelete(sql = "update memoir set is_deleted = true where id = ?")`, `@SQLRestriction("is_deleted = false")`; fields `weekStart` (`week_start`), `title` (`@Column(nullable = false, length = 200)`), `body` (`columnDefinition = "text"`), `anchors` (`@JdbcTypeCode(SqlTypes.JSON)`, `columnDefinition = "jsonb"`, type `MemoirAnchorsEnvelope`), `generatedAt` (`generated_at`); all `@NotNull`; class Javadoc mirroring the entity's role).

`MemoirRepository.java`:

```java
package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemoirRepository extends JpaRepository<MemoirEntity, UUID> {

    Optional<MemoirEntity> findByCreatedByAndWeekStart(UUID createdBy, LocalDate weekStart);

    /** The GET's read: the newest memoir (archive is a later slice). */
    Optional<MemoirEntity> findFirstByCreatedByOrderByWeekStartDesc(UUID createdBy);
}
```

`ProactiveMemoirService.java` (Task-1 version — read-only; Task 2 splices the lazy branch in):

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.MemoirResponse;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The memoir read path: the latest persisted row; honest 404 otherwise (lazy fallback: W2 Task 2). */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ProactiveMemoirService {

    private final MemoirRepository memoirRepository;
    private final ProactiveMapper mapper;

    @Transactional
    public MemoirResponse getMemoir(UUID userId) {
        MemoirEntity memoir = memoirRepository
                .findFirstByCreatedByOrderByWeekStartDesc(userId).orElse(null);
        if (memoir == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
        }
        return mapper.toMemoirResponse(memoir);
    }
}
```

`ProactiveMapper.java` — add:

```java
    @Mapping(target = "anchors", source = "anchors.anchors")
    MemoirResponse toMemoirResponse(MemoirEntity entity);

    MemoirAnchor toMemoirAnchor(MemoirAnchorsEnvelope.Anchor anchor);
```

(+ imports; the `Instant→OffsetDateTime` default covers `generatedAt`.)

`ProactiveController.java` — add (REAL delegation from the start):

```java
    @Override
    public MemoirResponse getMemoir() {
        return memoirService.getMemoir(currentUserId.get());
    }
```

(+ inject `ProactiveMemoirService memoirService`.)

`MemoirPopulator.java`:

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.proactive.entity.MemoirAnchorsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code memoir} rows (proactive W2). */
@TestComponent
@RequiredArgsConstructor
public class MemoirPopulator {

    private final MemoirRepository memoirRepository;

    public MemoirEntity memoir(UUID createdBy, LocalDate weekStart) {
        MemoirEntity entity = new MemoirEntity();
        entity.setCreatedBy(createdBy);
        entity.setWeekStart(weekStart);
        entity.setTitle("Teszt memoir");
        entity.setBody("Teszt heti narratíva.");
        entity.setAnchors(new MemoirAnchorsEnvelope(
                List.of(new MemoirAnchorsEnvelope.Anchor("Memory", "2026-07-01"))));
        entity.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return memoirRepository.saveAndFlush(entity);
    }
}
```

Plumbing: `ResetDatabase` TRUNCATE prepends `memoir, `; `AbstractIntegrationTest` `@Import` gains `MemoirPopulator.class`.

- [ ] **Step 6: Run — expect green; FE gates for the regen**

```bash
./mvnw clean test -q -Dtest='Memoir*IT,ProactiveApi*IT'
cd ../frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

- [ ] **Step 7: Commit**

```bash
git add api frontend/src/data/_client/api.gen.ts backend/src
git commit -m "feat(proactive): memoir contract + table + latest-read path (mezo-h4wp.4)"
```

---

### Task 2: `MemoirGenerator` (smart tier) + Sunday cron + lazy fallback

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/MemoirGenerator.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/MemoirJob.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveMemoirService.java` (lazy branch)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/ProactiveProperties.java` (Memoir record)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (MEMOIR_JOB_SWITCH)
- Modify: `backend/src/main/resources/application.yml` (memoir cron + techcore switch)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (memoir sentinel — LITERAL)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/MemoirGeneratorIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/MemoirJobIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/MemoirJobSwitchOffIT.java`
- Modify (test): `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ProactiveApiIT.java` (lazy case)

**Interfaces:**
- Consumes: Task 1's entity/repo/populator/service; companion reads (`DailySummaryRepository` window finder, `KnowledgeFactService.renderPromptBlock`, `PatternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc`); `CompanionLlm.completeSmart`.
- Produces: `MemoirGenerator.MEMOIR_MARKER` (= `"HETI-MEMOIR-FELADAT"`), `.generate(UUID, LocalDate weekStart): MemoirEntity` (null = empty week / unusable answer), `.gather(UUID, LocalDate weekStart): MemoirGather` (`record MemoirGather(String payload, List<MemoirAnchorsEnvelope.Anchor> candidates)`, null when empty); `MemoirJob.run()`.

- [ ] **Step 1: Write the failing ITs**

`MemoirGeneratorIT.java` (the `WeeklySuggestionGeneratorIT`/`BriefingGeneratorIT` blend — `@Transactional` + `@ActiveProfiles("companion-fake")`):

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import io.mrkuhne.mezo.feature.proactive.service.MemoirGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.MemoirPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * W2 generation flow over the fake LLM: gather = the WEEK'S summaries [weekStart, weekStart+6]
 * + facts + patterns, with numbered anchor candidates; strict-JSON {title, body, anchorIndexes}
 * scripted via [fake-memoir:{…}] (check-in note → the note is NOT in the memoir gather, so the
 * sentinel is planted via a daily-summary NARRATIVE instead — summaries carry free text).
 */
@Transactional
@ActiveProfiles("companion-fake")
class MemoirGeneratorIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.now()
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);

    @Autowired private MemoirGenerator generator;
    @Autowired private MemoirRepository repository;
    @Autowired private MemoirPopulator memoirPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testGather_shouldComposeWeekSummariesAndCandidates_whenDataExists() {
        UUID user = userPopulator.createUser("mg-gather@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(1), "Kedden kemény edzés volt.");
        dailySummaryPopulator.summary(user, WEEK_START.minusDays(1), "Előző vasárnap — nem tartozik bele.");

        MemoirGenerator.MemoirGather gather = generator.gather(user, WEEK_START);

        assertThat(gather).isNotNull();
        assertThat(gather.payload())
                .contains("Kedden kemény edzés volt.")
                .doesNotContain("Előző vasárnap — nem tartozik bele.")
                .contains("HORGONY-JELÖLTEK");
        // one Memory candidate per included summary
        assertThat(gather.candidates()).hasSize(1);
        assertThat(gather.candidates().get(0).kind()).isEqualTo("Memory");
    }

    @Test
    void testGather_shouldReturnNull_whenWeekEmpty() {
        UUID user = userPopulator.createUser("mg-empty@test.local").getId();

        assertThat(generator.gather(user, WEEK_START)).isNull();
    }

    @Test
    void testGenerate_shouldPersistScriptedMemoir_whenSentinelPlanted() {
        UUID user = userPopulator.createUser("mg-gen@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(2),
                "[fake-memoir:{\"title\":\"A várakozás hete\",\"body\":\"Szép hét volt.\",\"anchorIndexes\":[0]}]");

        MemoirEntity memoir = generator.generate(user, WEEK_START);

        assertThat(memoir).isNotNull();
        assertThat(memoir.getTitle()).isEqualTo("A várakozás hete");
        assertThat(memoir.getBody()).isEqualTo("Szép hét volt.");
        assertThat(memoir.getAnchors().anchors()).hasSize(1);
        assertThat(memoir.getAnchors().anchors().get(0).kind()).isEqualTo("Memory");
    }

    @Test
    void testGenerate_shouldReturnExisting_whenRowAlreadyExists() {
        UUID user = userPopulator.createUser("mg-idem@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(1), "Volt nap.");
        MemoirEntity existing = memoirPopulator.memoir(user, WEEK_START);

        assertThat(generator.generate(user, WEEK_START).getId()).isEqualTo(existing.getId());
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void testGenerate_shouldReturnNull_whenAnswerUnparseable() {
        UUID user = userPopulator.createUser("mg-broken@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.plusDays(1), "[fake-memoir:{\"title\":}]");

        assertThat(generator.generate(user, WEEK_START)).isNull();
        assertThat(repository.count()).isZero();
    }
}
```

`MemoirJobIT.java` (the `WeeklySuggestionJobIT` twin — `@ActiveProfiles("companion-fake")`, NOT `@Transactional`): two tests — `testRun_shouldGenerateMemoirForWeekEndingNow_whenMemoryExists` (seed a summary at `previousOrSame(MONDAY).plusDays(1)`... careful: if today IS Monday, plusDays(1) is tomorrow — seed at `previousOrSame(MONDAY)` exactly, run `job.run()`, assert `findByCreatedByAndWeekStart(user, previousOrSame(MONDAY))` present) and `testRun_shouldBeIdempotent_whenMemoirExists` (run twice, same id).

`MemoirJobSwitchOffIT.java` — the `WeeklySuggestionJobSwitchOffIT` twin: `@TestPropertySource("mezo.techcore.cron.memoir-job.enabled=false")`, assert `context.getBeanNamesForType(MemoirJob.class)).isEmpty()`.

`ProactiveApiIT.java` — ADD the lazy case:

```java
    @Test
    void testGetMemoir_shouldLazilyGenerateLastCompletedWeek_whenNoneExists() {
        LocalDate lastWeek = LocalDate.now()
                .with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY))
                .minusWeeks(1);
        dailySummaryPopulator.summary(ownerId(), lastWeek.plusDays(1), "Múlt heti nap.");

        MemoirResponse memoir = getForBody(
                "/api/proactive/memoir", ownerAuthHeaders(), HttpStatus.OK, MemoirResponse.class);

        assertThat(memoir.getWeekStart()).isEqualTo(lastWeek);
        assertThat(memoir.getTitle()).isEqualTo("Fake memoir");   // the un-scripted fake default
    }
```

- [ ] **Step 2: Run — expect failures**

```bash
./mvnw clean test -q -Dtest='Memoir*IT'
```

- [ ] **Step 3: Config + switch + fake dispatch**

`ProactiveProperties` gains `@NotNull @Valid Memoir memoir` + `public record Memoir(@NotBlank String cron) {}`. `application.yml`:

```yaml
    memoir:
      # W2 Sunday-evening memoir schedule (old journey 5.8) — the week ending that Sunday
      cron: "0 0 19 * * SUN"
```

techcore cron block:

```yaml
      # W2 Sunday memoir generation (schedule: mezo.proactive.memoir.cron);
      # off = the MemoirJob bean does not exist
      memoir-job:
        enabled: true
```

`FeaturesConfiguration`:

```java
    /** W2 Sunday memoir job — techcore cron zone (schedule: mezo.proactive.memoir.cron). */
    public static final String MEMOIR_JOB_SWITCH = "mezo.techcore.cron.memoir-job.enabled";
```

`FakeCompanionLlm` — literal mirror + sentinel + dispatch (before the generic echo):

```java
    /** Mirror of MemoirGenerator.MEMOIR_MARKER (feature/proactive) — LITERAL, cycle rule. */
    public static final String MEMOIR_MARKER_MIRROR = "HETI-MEMOIR-FELADAT";

    /** Scripted memoir (W2): {@code [fake-memoir:{…}]} planted via a daily-summary narrative. */
    public static final Pattern MEMOIR_SENTINEL =
            Pattern.compile("\\[fake-memoir:(\\{.*?\\})]", Pattern.DOTALL);
```

```java
        if (systemPrompt.startsWith(MEMOIR_MARKER_MIRROR)) {
            Matcher m = MEMOIR_SENTINEL.matcher(userMessage);
            return m.find() ? m.group(1)
                    : "{\"title\":\"Fake memoir\",\"body\":\"FAKE-MEMOIR-NARRATÍVA\",\"anchorIndexes\":[]}";
        }
```

- [ ] **Step 4: Generator + job + lazy branch**

`MemoirGenerator.java` — the `BriefingGenerator` strict-JSON pattern on the smart tier:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirAnchorsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * W2 memoir generator (spec §5, old journey 5.8): PURE-CODE gather (the week's daily summaries
 * [weekStart, weekStart+6] + facts + patterns + numbered anchor candidates) → ONE SMART-tier
 * call with a strict-JSON contract {title, body, anchorIndexes} — anchors are model-SELECTED
 * from code-collected candidates (the briefing ref rule), never invented. Empty week or
 * unusable answer ⇒ NO row. Existing row ⇒ returned untouched.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class MemoirGenerator {

    /** Prompt prefix the fake dispatches on — MIRRORED as a literal in FakeCompanionLlm. */
    public static final String MEMOIR_MARKER = "HETI-MEMOIR-FELADAT";

    private static final String PROMPT = MEMOIR_MARKER + "\n"
            + "Írj rövid, irodalmi hangvételű magyar heti memoárt Danielről, társ-szemszögből, "
            + "kizárólag a megadott hét tényadataiból. Legyen benne konkrét megfigyelés és egy "
            + "gyengéd észrevétel; számot vagy adatot kitalálni tilos; gyógyszer adagolására "
            + "vonatkozó változtatást SOHA ne javasolj. Válaszolj KIZÁRÓLAG szigorú JSON-nal: "
            + "{\"title\": \"rövid cím\", \"body\": \"a memoár szövege\", "
            + "\"anchorIndexes\": [a felhasznált HORGONY-JELÖLTEK sorszámai]}";

    private final MemoirRepository memoirRepository;
    private final DailySummaryRepository dailySummaryRepository;
    private final PatternRepository patternRepository;
    private final KnowledgeFactService knowledgeFactService;
    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;

    public record MemoirGather(String payload, List<MemoirAnchorsEnvelope.Anchor> candidates) {
    }

    record ParsedMemoir(String title, String body, List<Integer> anchorIndexes) {
    }

    @Transactional
    public MemoirEntity generate(UUID userId, LocalDate weekStart) {
        MemoirEntity existing = memoirRepository
                .findByCreatedByAndWeekStart(userId, weekStart).orElse(null);
        if (existing != null) {
            return existing;
        }
        MemoirGather gather = gather(userId, weekStart);
        if (gather == null) {
            log.debug("No summaries in week {} for {} — no memoir", weekStart, userId);
            return null;
        }
        String answer = companionLlm.completeSmart(PROMPT, gather.payload());
        ParsedMemoir parsed = parse(answer);
        if (parsed == null || parsed.title() == null || parsed.title().isBlank()
                || parsed.body() == null || parsed.body().isBlank()) {
            log.warn("Unusable memoir answer for {} week {} — no row", userId, weekStart);
            return null;
        }
        MemoirEntity memoir = new MemoirEntity();
        memoir.setCreatedBy(userId);
        memoir.setWeekStart(weekStart);
        memoir.setTitle(parsed.title().strip());
        memoir.setBody(parsed.body().strip());
        memoir.setAnchors(new MemoirAnchorsEnvelope(
                resolveAnchors(parsed.anchorIndexes(), gather.candidates())));
        memoir.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return memoirRepository.saveAndFlush(memoir);
    }

    /** PURE-CODE payload; null when the week [weekStart, weekStart+6] has no summaries. */
    public MemoirGather gather(UUID userId, LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(6);
        List<DailySummaryEntity> week = dailySummaryRepository
                .findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(userId, weekStart)
                .stream()
                .filter(s -> !s.getSummaryDate().isAfter(weekEnd))
                .toList();
        if (week.isEmpty()) {
            return null;
        }
        List<MemoirAnchorsEnvelope.Anchor> candidates = new ArrayList<>();
        StringBuilder payload = new StringBuilder("A HÉT NAPJAI (" + weekStart + " – " + weekEnd + "):\n");
        for (DailySummaryEntity s : week) {
            payload.append("- ").append(s.getSummaryDate()).append(": ")
                    .append(s.getNarrative()).append('\n');
            candidates.add(new MemoirAnchorsEnvelope.Anchor("Memory", s.getSummaryDate().toString()));
        }
        payload.append(knowledgeFactService.renderPromptBlock(userId));
        var patterns = patternRepository
                .findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(userId);
        if (!patterns.isEmpty()) {
            payload.append("\n\nMINTÁK:\n");
            for (var p : patterns) {
                payload.append("- ").append(p.getTitle()).append(" (státusz: ")
                        .append(p.getStatus()).append(")\n");
                candidates.add(new MemoirAnchorsEnvelope.Anchor("Pattern", p.getTitle()));
            }
        }
        payload.append("\nHORGONY-JELÖLTEK (az anchorIndexes ezekre mutat):\n");
        for (int i = 0; i < candidates.size(); i++) {
            payload.append(i).append(": [").append(candidates.get(i).kind()).append("] ")
                    .append(candidates.get(i).label()).append('\n');
        }
        return new MemoirGather(payload.toString(), candidates);
    }

    private ParsedMemoir parse(String answer) {
        if (answer == null) {
            return null;
        }
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(answer.substring(start, end + 1), ParsedMemoir.class);
        } catch (Exception e) {
            log.warn("Memoir answer failed to parse: {}", e.getMessage());
            return null;
        }
    }

    private List<MemoirAnchorsEnvelope.Anchor> resolveAnchors(
            List<Integer> indexes, List<MemoirAnchorsEnvelope.Anchor> candidates) {
        if (indexes == null) {
            return List.of();
        }
        return indexes.stream()
                .filter(i -> i != null && i >= 0 && i < candidates.size())
                .distinct()
                .map(candidates::get)
                .toList();
    }
}
```

`MemoirJob.java` — the `WeeklySuggestionJob` twin: three-switch (`COMPANION` + `PROACTIVE` + `MEMOIR_JOB_SWITCH`), `@Scheduled(cron = "${mezo.proactive.memoir.cron}")`, `weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))` (the week ending this Sunday), per-user try/catch, `log.info` summary line.

`ProactiveMemoirService.getMemoir` — the read grows the lazy branch:

```java
        MemoirEntity memoir = memoirRepository
                .findFirstByCreatedByOrderByWeekStartDesc(userId)
                .orElseGet(() -> generator.generate(userId, LocalDate.now()
                        .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1)));
```

(+ inject `MemoirGenerator generator`; imports `DayOfWeek`/`TemporalAdjusters`/`LocalDate`; the class Javadoc's "lazy fallback: W2 Task 2" note is replaced by the real description: latest row, else generate the LAST COMPLETED week.)

- [ ] **Step 5: Run all memoir ITs + full gate**

```bash
./mvnw clean test -q -Dtest='Memoir*IT,ProactiveApi*IT'
./mvnw clean test
```

- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "feat(proactive): MemoirGenerator (smart tier) + Sunday cron + lazy last-week fallback (mezo-h4wp.4)"
```

---

### Task 3: FE — Memoir tab un-ghosts

**Files:**
- Create: `frontend/src/data/insights/memoirApi.ts`
- Create: `frontend/src/data/insights/memoirHooks.ts`
- Test: `frontend/src/data/insights/memoirHooks.test.tsx`
- Modify: `frontend/src/data/hooks.ts` (re-export `useMemoir`)
- Modify: `frontend/src/features/insights/pages/tabs.ts` (PHASE3_TAB_IDS loses `memoir`)
- Modify: `frontend/src/features/insights/pages/MemoirPage.tsx` (guard out; real render; reactions/anniversary/archive mock-only)
- Modify (tests): `frontend/src/features/insights/pages/MemoirPage.test.tsx`, `InsightsSubNav.test.tsx`, `insights.nav.test.tsx`
- Modify: `frontend/src/test/msw/handlers.ts` (default 404)

**Interfaces:**
- Consumes: generated `paths['/api/proactive/memoir']` types; `isoWeekNumber` from `@/data/insights/weeklyHooks`, `deriveWeekTitle` from `@/data/fuel/fuelWeekHooks`; the FE `Memoir` type (`{week, title, body, anchors}` — UNCHANGED).
- Produces: `useMemoir(): { memoir: Memoir | null; anniversaryNote: string | null; mode: 'mock' | 'live' }` — mock: the seed + note; real: the mapped server memoir (week label derived) or null (404/loading/error), note always null.

- [ ] **Step 1: Write the failing tests**

`memoirHooks.test.tsx` (the `briefingHooks.test.tsx` idiom — `makeHookWrapper()`, env-pinned describes):

```tsx
// real-mode describe:
  it('maps the server memoir with a derived week label', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/memoir`, () => HttpResponse.json({
      weekStart: '2026-06-29', title: 'A várakozás hete', body: 'Szép hét volt.',
      anchors: [{ kind: 'Memory', label: '2026-07-01' }], generatedAt: '2026-07-05T19:00:00Z',
    })))
    const { result } = renderHook(() => useMemoir(), { wrapper })
    await waitFor(() => expect(result.current.memoir).not.toBeNull())
    expect(result.current.memoir!.title).toBe('A várakozás hete')
    expect(result.current.memoir!.week).toMatch(/^Hét \d+/)   // derived label
    expect(result.current.memoir!.anchors).toEqual([{ kind: 'Memory', label: '2026-07-01' }])
    expect(result.current.anniversaryNote).toBeNull()
    expect(result.current.mode).toBe('live')
  })
  it('returns null memoir on the default 404', async () => { /* waitFor mode live, expect memoir null */ })
// mock-mode describe:
  it('returns the seed + anniversaryNote without fetching', () => { /* fetch spy + seed equality + mode mock */ })
```

`MemoirPage.test.tsx` — the `(real mode)` describe REPLACES the ghost assertions: with an MSW memoir fixture the page renders the real title/body/anchor and does NOT render reactions/anniversary/archive (`queryByText('Évforduló · 1 hónap')` absent, `queryByRole('button', { name: /Like/ })` absent); with the default 404 it renders the honest *"Az első memoir a hét zárásakor készül el."* placeholder and NOT the demo fiction. The `(mock mode)` describe stays UNTOUCHED.

`InsightsSubNav.test.tsx` — the real-mode describe: `Memoir` moves from the hidden list to the visible list (5 tabs: Patterns/Weekly/Memoir/Knowledge/Chat; hidden: Predictions/Experiments only).

`insights.nav.test.tsx` — the real describe's `Memoir is hidden` assertion flips to `Memoir link works` (click it → the memoir route renders — assert the honest placeholder or the fixture, whichever the test seeds).

- [ ] **Step 2: Run — expect failures**

```bash
cd frontend && pnpm test -- memoirHooks MemoirPage InsightsSubNav insights.nav
```

- [ ] **Step 3: Implement**

`memoirApi.ts`:

```ts
import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { Memoir } from '@/data/types'
import { isoWeekNumber } from '@/data/insights/weeklyHooks'
import { deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'

type MemoirWire = paths['/api/proactive/memoir']['get']['responses']['200']['content']['application/json']

/** Wire → FE Memoir: the week label derives client-side from weekStart. */
export function toMemoir(wire: MemoirWire): Memoir {
  return {
    week: `Hét ${isoWeekNumber(wire.weekStart)} · ${deriveWeekTitle(wire.weekStart)}`,
    title: wire.title,
    body: wire.body,
    anchors: wire.anchors.map((a) => ({ kind: a.kind, label: a.label })),
  }
}

export const memoirApi = {
  latest: () => apiFetch<MemoirWire>('/api/proactive/memoir').then(toMemoir),
}
```

`memoirHooks.ts` (the `useBriefing` idiom — mock null-fetch, 404→null, `retry: false`; returns the seed in mock):

```ts
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { memoirApi } from '@/data/insights/memoirApi'
import { memoir as mockMemoir, anniversaryNote as mockAnniversaryNote } from '@/data/insights/insights'
import type { Memoir } from '@/data/types'

export interface MemoirView {
  memoir: Memoir | null
  /** Mock-only demo copy (deferred epic); always null in live mode. */
  anniversaryNote: string | null
  mode: 'mock' | 'live'
}

/**
 * The weekly memoir (proactive W2). Mock: the Phase-1 seed (byte parity). Live: the latest
 * generated memoir, or null (404/loading/error) — the page renders its honest "készül" state.
 */
export function useMemoir(): MemoirView {
  const mock = isMockMode()
  const q = useQuery<Memoir | null>({
    queryKey: ['memoir'],
    queryFn: mock
      ? async () => mockMemoir
      : async () => {
          try {
            return await memoirApi.latest()
          } catch (e) {
            if (e instanceof ApiError && e.status === 404) return null
            throw e
          }
        },
    initialData: mock ? mockMemoir : undefined,
    staleTime: mock ? Infinity : undefined,
    retry: false,
  })
  if (mock) {
    return { memoir: mockMemoir, anniversaryNote: mockAnniversaryNote, mode: 'mock' }
  }
  return { memoir: q.data ?? null, anniversaryNote: null, mode: 'live' }
}
```

`hooks.ts` barrel: `export { useMemoir } from '@/data/insights/memoirHooks'`.

`tabs.ts`: `const PHASE3_TAB_IDS = new Set(['predictions', 'experiments'])` (comment updated: memoir un-ghosted at W2).

`MemoirPage.tsx`: swap `useInsights()` for `useMemoir()`; DELETE the `PhaseTeaserCard` early-return; render:
- `memoir == null && mode === 'live'` → an honest placeholder card (the WeeklyPage null-state idiom): eyebrow `Heti memoir` + text `Az első memoir a hét zárásakor készül el.`;
- otherwise the existing memoir card markup unchanged (works for both seed and real data);
- the reactions row + anniversary card + archive footer wrap in `mode === 'mock' ? (...) : null` (mock render byte-identical).

`handlers.ts` default:

```ts
  // Proactive memoir (W2) — default: honest 404, MemoirPage renders its "készül" state.
  http.get(`${API_BASE}/api/proactive/memoir`, () => new HttpResponse(null, { status: 404 })),
```

- [ ] **Step 4: Focused tests, then full FE gates**

```bash
pnpm test -- memoirHooks MemoirPage InsightsSubNav insights.nav navigation
pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: all green both modes. (`navigation.test.tsx` included in the focused run in case it asserts tab counts.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(fe): Memoir tab un-ghosts — real weekly narrative, demo extras mock-only (mezo-h4wp.4)"
```

---

### Task 4: Docs + gates

**Files:**
- Modify: `docs/features/proactive.md` (§1 status W2 · §2 Memoir surface · §3 flow + Sunday cron + lazy-last-week rule · §4 table/config · §8 tests · §9 decisions · §10 files)
- Modify: `docs/features/insights.md` (§1 status line · §2 sub-tab table: memoir row flips to shown/real · §2.3 rewritten: real memoir + mock-only extras + honest "készül" state · §3 hook note (`useMemoir` split from `useInsights` consumers) · §9 honest-surface row updated)
- Modify: `docs/milestones/roadmap.md` (milestone row + Phase-4 W-stage tick "(W1 ✅ · W2 ✅ 2026-07-06 — **W „ír rólam hetente" complete**)")
- Modify: `docs/superpowers/plans/2026-07-06-proactive-roadmap.md` (§W2 heading ✅ shipped 2026-07-06)

**Steps:** the W1-Task-4 recipe: update the four docs (overwrite-in-place, `updated:` bumps, file:line pointers; record ALL the closed decisions from Global Constraints incl. the sentinel-via-summary-narrative test trick), clear any collateral git-drift stales with minimal truthful touches, then gates:

```bash
node scripts/lint-docs.mjs        # 0 stale / 0 error
cd backend && ./mvnw clean test
cd ../frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Commit: `git add docs && git commit -m "docs(proactive): W2 shipped — memoir live docs (mezo-h4wp.4)"`.

(Merge --no-ff + push + `bd close mezo-h4wp.4` + the persisted-reactions follow-up bd issue = controller, after the final whole-branch review.)

---

## Self-review notes (done while writing)

- **Roadmap §W2 coverage:** table+generator+cron+GET ✅ (T1–T2) · un-ghost (tabs + guard) ✅ (T3) · reactions decision closed (mock-only + follow-up) · anniversary/archive mock-only ✅ · anchors = code-collected/model-selected ✅ (briefing rule reused) · insights.md update ✅ (T4).
- **The W1 stub lesson applied:** Task 1 ships the REAL read service + controller op — no temp stub, no raw exception, ArchUnit-clean at every commit.
- **Sentinel plant trick differs from B/W1:** the memoir gather does NOT include the snapshot (it is a PAST-week narrative), so the check-in-note channel is unavailable — the `[fake-memoir:…]` sentinel rides a daily-summary NARRATIVE instead (summaries are free text). Flagged in the IT Javadoc.
- **Type consistency:** `MemoirGather(payload, candidates)` (T2) ↔ IT usage; `useMemoir(): MemoirView` (T3) ↔ page/test usage; marker literal `"HETI-MEMOIR-FELADAT"` identical generator↔fake; `Memoir` FE type reused unchanged.
- **Verify-at-execution:** generated `getMemoir()` signature (T1 Step 2); `isoWeekNumber`/`deriveWeekTitle` export paths (T3 Step 3 — confirm at execution, both are exported today); the nav tests' exact assertion wording (T3 Step 1 — adapt to the files' idioms).
