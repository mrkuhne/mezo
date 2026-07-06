# B1.1 — Proactive skeleton + briefing spine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the `feature/proactive` layer exists and a morning briefing can be generated and read over HTTP — the spine of the proactive epic (`mezo-h4wp.1`).

**Architecture:** a new `feature/proactive/` backend package behind `mezo.feature.proactive.enabled` (AND the companion switch), whose `BriefingGenerator` composes three SHIPPED companion reads (context snapshot + top-N facts block + last-N `daily_summary` narratives) into a pure-code gather, makes ONE cheap-tier `CompanionLlm` call with a strict-JSON contract, and persists a `briefing` row (typed jsonb envelope). `GET /api/proactive/briefing` returns the persisted row or lazily generates it. No FE change in this slice (that is B1.2); no cron (B1.2).

**Tech Stack:** Java 21 · Spring Boot 4 · Maven · PostgreSQL/Liquibase · MapStruct/Lombok · OpenAPI contract-first (`openapi-merge-cli`) · Spring AI port (`CompanionLlm`) with the `companion-fake` test profile.

**Design of record:** `docs/superpowers/specs/2026-07-06-proactive-layer-design.md` §2–§4 · roadmap `docs/superpowers/plans/2026-07-06-proactive-roadmap.md` §B1.1.

## Global Constraints

- Base package `io.mrkuhne.mezo`; feature layout `feature/proactive/{controller,service,repository,entity,config,mapper}`.
- UUID PKs (`gen_random_uuid()`); `created_by` set server-side from `CurrentUserId`; soft delete via `@SQLDelete`/`@SQLRestriction`; jsonb = typed envelope via `@JdbcTypeCode(SqlTypes.JSON)`.
- Constructor DI (`@RequiredArgsConstructor`), `@Transactional` method-level ONLY, no `@Value` (ArchUnit-enforced), errors via `SystemRuntimeErrorException` + `SystemMessage` (no raw RuntimeException — ArchUnit).
- Contract-first: `api/feature/proactive/proactive.yml` BEFORE code; controller `implements` the generated `ProactiveApi` (ArchUnit rule `controllers_implement_generated_api`).
- **No companion→proactive import, EVER** — ArchUnit `feature_slices_are_cycle_free` fails on a new cycle. proactive→companion is the allowed direction. Consequence: `FakeCompanionLlm` (companion package) mirrors the briefing marker as a **string literal**, never an import.
- Tests: integration-first (`AbstractIntegrationTest`/`ApiIntegrationTest` + real Postgres, compose up), AssertJ only, `test{Method}_should{Result}_when{Condition}` naming, populators, NO mocks/`@MockBean`; LLM always the `companion-fake` profile fake.
- ALWAYS `./mvnw clean test` (Lombok+MapStruct incremental compile is flaky). Run from `backend/`.
- Every new owned table joins `support/ResetDatabase.java`'s TRUNCATE list + gets a populator.
- **Decisions this slice closes (spec §7 row 1):** envelope = `{eyebrow, body[], refs[]}` — **no `confidence`** (an LLM's self-reported confidence is a fabricated number; the FE mock `Briefing.confidence` stays mock-only and B1.2 hides the chip in real mode) and **no `tone`** (dead data in the FE today). Refs are code-collected candidates the model SELECTS by index — it can never invent one. Emptiness gate v1: zero `daily_summary` rows in the `past-days` window ⇒ no briefing (honest 404); may loosen in B1.2. `date` query param optional (FE sends its local date, the check-in precedent), defaults to server today.

**Branch first:** `git checkout -b feat/proactive-b11` (work in the main checkout, NOT a worktree — the bd hooks pollute worktree commits).

---

### Task 1: Contract fragment + generated types

**Files:**
- Create: `api/feature/proactive/proactive.yml`
- Modify: `api/generate/merge.yml` (append input)
- Generated (commit them): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: generated `io.mrkuhne.mezo.api.controller.ProactiveApi` (method `getBriefing(LocalDate date)`) + DTOs `BriefingResponse` (getters: `getDate()`, `getEyebrow()`, `getBody()`, `getRefs()`, `getGeneratedAt()`) and `BriefingRef` (`getKind()`, `getLabel()`) — consumed by Tasks 4–5. Backend types regenerate inside `./mvnw generate-sources`/`test`.

- [ ] **Step 1: Write the fragment**

`api/feature/proactive/proactive.yml`:

```yaml
openapi: 3.0.3
info: { title: '', version: '' }
tags:
  - name: Proactive
    description: >-
      Proactive layer — surfaces the companion speaks first on (mezo-h4wp). B1.1 ships the
      morning briefing read; cron + staleness arrive in B1.2, weekly/heartbeat/prediction
      surfaces in later slices.
paths:
  /api/proactive/briefing:
    get:
      tags: [Proactive]
      operationId: getBriefing
      summary: The generated morning briefing for one day (lazily generated when the dawn cron has not produced it yet)
      parameters:
        - name: date
          in: query
          required: false
          description: >-
            The briefed day — the FE sends its LOCAL date (the check-in read precedent);
            defaults to the server's today.
          schema: { type: string, format: date }
      responses:
        '200':
          description: The persisted (or just-generated) briefing
          content:
            application/json:
              schema: { $ref: '#/components/schemas/BriefingResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: >-
            No briefing possible — no narrative memory (daily_summary) in the configured
            past-days window. The FE renders its honest state (B1.2).
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    BriefingRef:
      type: object
      required: [kind, label]
      properties:
        kind:
          type: string
          description: FE RefTag kind (WeightTrend/Goal/Workout/FuelDay/Medication/Sleep/Memory)
        label:
          type: string
    BriefingResponse:
      type: object
      required: [date, eyebrow, body, refs, generatedAt]
      properties:
        date: { type: string, format: date }
        eyebrow:
          type: string
          description: One-line header above the briefing prose
        body:
          type: array
          items: { type: string }
          description: Briefing paragraphs — the FE maps each to a BriefingPara
        refs:
          type: array
          items: { $ref: '#/components/schemas/BriefingRef' }
          description: Code-collected, model-SELECTED source references (never model-invented)
        generatedAt: { type: string, format: date-time }
```

- [ ] **Step 2: Register the fragment**

In `api/generate/merge.yml` append after the `people` line:

```yaml
  - inputFile: ../feature/proactive/proactive.yml
```

- [ ] **Step 3: Merge + regenerate FE types**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```
Expected: `api/openapi.yml` gains the `/api/proactive/briefing` path + both schemas; `frontend/src/data/_client/api.gen.ts` regenerates (additive only).

- [ ] **Step 4: Verify the backend types generate**

```bash
cd ../backend && ./mvnw clean compile -q
```
Expected: BUILD SUCCESS; `target/generated-sources` contains `io/mrkuhne/mezo/api/controller/ProactiveApi.java` + `io/mrkuhne/mezo/api/dto/BriefingResponse.java` + `BriefingRef.java`. Note the exact generated method signature of `getBriefing` (expected `BriefingResponse getBriefing(LocalDate date)`) — Task 4's controller implements it verbatim.

- [ ] **Step 5: FE gates still green (generated file changed)**

```bash
cd ../frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: all green (the regen is additive).

- [ ] **Step 6: Commit**

```bash
git add api/feature/proactive/proactive.yml api/generate/merge.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): proactive contract fragment — GET /api/proactive/briefing (mezo-h4wp.1)"
```

---

### Task 2: `briefing` table + entity + repository + test plumbing

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607061100_mezo-h4wp.1_create_briefing.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeset)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/BriefingContentEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/BriefingEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/BriefingRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/BriefingPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (TRUNCATE growth)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/BriefingPersistenceIT.java`

**Interfaces:**
- Produces: `BriefingEntity` (`setCreatedBy(UUID)`, `setBriefingDate(LocalDate)`, `setContent(BriefingContentEnvelope)`, `setGeneratedAt(Instant)`), `BriefingContentEnvelope(String eyebrow, List<String> body, List<Ref> refs)` with nested `record Ref(String kind, String label)`, `BriefingRepository.findByCreatedByAndBriefingDate(UUID, LocalDate): Optional<BriefingEntity>`, `BriefingPopulator.briefing(UUID createdBy, LocalDate date): BriefingEntity`. Tasks 3–4 consume all of these.

- [ ] **Step 1: Write the failing IT**

`backend/src/test/java/io/mrkuhne/mezo/feature/proactive/BriefingPersistenceIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.BriefingContentEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.BriefingEntity;
import io.mrkuhne.mezo.feature.proactive.repository.BriefingRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.BriefingPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** briefing jsonb envelope round-trip + the partial-unique regeneration contract (spec §3). */
@Transactional
class BriefingPersistenceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 7, 6);

    @Autowired private BriefingRepository briefingRepository;
    @Autowired private BriefingPopulator briefingPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testSave_shouldRoundTripContentEnvelope_whenReloaded() {
        UUID user = userPopulator.user("briefing-rt@test.local");
        BriefingEntity saved = briefingPopulator.briefing(user, DAY);

        BriefingEntity reloaded = briefingRepository
                .findByCreatedByAndBriefingDate(user, DAY).orElseThrow();

        assertThat(reloaded.getId()).isEqualTo(saved.getId());
        assertThat(reloaded.getContent().eyebrow()).isEqualTo("Reggeli briefing");
        assertThat(reloaded.getContent().body()).containsExactly("Jó reggelt, Daniel!");
        assertThat(reloaded.getContent().refs())
                .containsExactly(new BriefingContentEnvelope.Ref("Sleep", "regeneráció"));
        assertThat(reloaded.getGeneratedAt()).isNotNull();
    }

    @Test
    void testSave_shouldRejectSecondLiveRowForSameDay_whenUniqueIndexHolds() {
        UUID user = userPopulator.user("briefing-uq@test.local");
        briefingPopulator.briefing(user, DAY);

        assertThatThrownBy(() -> briefingPopulator.briefing(user, DAY))
                .hasMessageContaining("uq_briefing_created_by_briefing_date");
    }

    @Test
    void testSoftDelete_shouldAllowRegeneration_whenOldRowDeleted() {
        UUID user = userPopulator.user("briefing-regen@test.local");
        BriefingEntity first = briefingPopulator.briefing(user, DAY);
        briefingRepository.delete(first);   // @SQLDelete -> is_deleted = true
        briefingRepository.flush();

        BriefingEntity second = briefingPopulator.briefing(user, DAY);

        assertThat(second.getId()).isNotEqualTo(first.getId());
        assertThat(briefingRepository.findByCreatedByAndBriefingDate(user, DAY))
                .hasValueSatisfying(b -> assertThat(b.getId()).isEqualTo(second.getId()));
    }

    @Test
    void testFindByCreatedByAndBriefingDate_shouldReturnEmpty_whenOtherUsersRow() {
        UUID owner = userPopulator.user("briefing-own@test.local");
        UUID other = userPopulator.user("briefing-other@test.local");
        briefingPopulator.briefing(other, DAY);

        assertThat(briefingRepository.findByCreatedByAndBriefingDate(owner, DAY)).isEmpty();
    }
}
```

Check `UserPopulator`'s factory method name first (`backend/src/test/java/io/mrkuhne/mezo/support/populator/UserPopulator.java`) — if it is not `user(String email)`, use its actual signature everywhere in this plan.

- [ ] **Step 2: Run it — expect compile failure**

```bash
cd backend && ./mvnw clean test -q -Dtest=BriefingPersistenceIT
```
Expected: FAIL — `BriefingEntity`/`BriefingRepository`/`BriefingPopulator` do not exist.

- [ ] **Step 3: Migration**

`backend/src/main/resources/db/changelog/1.0.0/script/202607061100_mezo-h4wp.1_create_briefing.sql`:

```sql
-- Proactive layer B1.1 (bd mezo-h4wp.1, roadmap §B1.1).
-- One generated morning briefing per user+day; content is a typed jsonb envelope
-- (eyebrow + body paragraphs + model-SELECTED refs) mirroring the FE Briefing shape.

create table briefing (
    id            uuid        not null default gen_random_uuid(),
    created_by    uuid        not null,
    is_deleted    boolean     not null default false,
    created_at    timestamptz not null default now(),
    briefing_date date        not null,
    content       jsonb       not null,
    generated_at  timestamptz not null,
    constraint pk_briefing_id primary key (id),
    constraint fk_briefing_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);

-- Partial UNIQUE (the daily_summary precedent): one LIVE briefing per user+day; a soft-deleted
-- row does not block regeneration (B1.2's staleness path = soft-delete + insert). Doubles as
-- the lookup index (every query filters is_deleted = false via @SQLRestriction).
create unique index uq_briefing_created_by_briefing_date
    on briefing (created_by, briefing_date) where is_deleted = false;
```

Append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202607061100_mezo-h4wp.1_create_briefing"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607061100_mezo-h4wp.1_create_briefing.sql
```

- [ ] **Step 4: Envelope + entity + repository**

`backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/BriefingContentEnvelope.java`:

```java
package io.mrkuhne.mezo.feature.proactive.entity;

import java.util.List;

/**
 * Typed jsonb envelope for briefing.content (ADR 0006 / ProvenanceEnvelope precedent).
 * Mirrors the FE Briefing shape MINUS confidence and tone — decided at B1.1: an LLM's
 * self-reported confidence is a fabricated number (spec §6), and tone is dead FE data.
 * Refs are code-collected candidates the model selected by index (never invented).
 */
public record BriefingContentEnvelope(String eyebrow, List<String> body, List<Ref> refs) {

    public record Ref(String kind, String label) {
    }
}
```

`backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/BriefingEntity.java`:

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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One generated morning briefing per user+day (proactive B1.1, spec §3-§4). Regenerable data:
 * uniqueness is a PARTIAL index (uq_briefing_created_by_briefing_date where is_deleted = false),
 * so B1.2's staleness path soft-deletes + reinserts.
 */
@Getter
@Setter
@Entity
@Table(name = "briefing")
@SQLDelete(sql = "update briefing set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class BriefingEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** The briefed day (the morning it is FOR — not when it was generated). */
    @NotNull
    @Column(name = "briefing_date", nullable = false)
    private LocalDate briefingDate;

    /** The generated content — eyebrow + paragraphs + model-selected refs. */
    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private BriefingContentEnvelope content;

    /** When the LLM call produced this row — B1.2's staleness anchor. */
    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
```

`backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/BriefingRepository.java`:

```java
package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.BriefingEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BriefingRepository extends JpaRepository<BriefingEntity, UUID> {

    Optional<BriefingEntity> findByCreatedByAndBriefingDate(UUID createdBy, LocalDate briefingDate);
}
```

- [ ] **Step 5: Populator + ResetDatabase growth**

`backend/src/test/java/io/mrkuhne/mezo/support/populator/BriefingPopulator.java`:

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.proactive.entity.BriefingContentEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.BriefingEntity;
import io.mrkuhne.mezo.feature.proactive.repository.BriefingRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code briefing} rows (proactive B1.1). */
@TestComponent
@RequiredArgsConstructor
public class BriefingPopulator {

    private final BriefingRepository briefingRepository;

    /** Any valid briefing for the given day. */
    public BriefingEntity briefing(UUID createdBy, LocalDate briefingDate) {
        return briefing(createdBy, briefingDate, new BriefingContentEnvelope(
                "Reggeli briefing",
                List.of("Jó reggelt, Daniel!"),
                List.of(new BriefingContentEnvelope.Ref("Sleep", "regeneráció"))));
    }

    public BriefingEntity briefing(UUID createdBy, LocalDate briefingDate, BriefingContentEnvelope content) {
        BriefingEntity entity = new BriefingEntity();
        entity.setCreatedBy(createdBy);
        entity.setBriefingDate(briefingDate);
        entity.setContent(content);
        entity.setGeneratedAt(Instant.now());
        return briefingRepository.saveAndFlush(entity);
    }
}
```

In `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` extend the TRUNCATE list — the first line becomes:

```java
            "TRUNCATE TABLE briefing, pattern, daily_summary, memory_embedding, learned_fact, knowledge_fact, ai_message, ai_conversation, supplement_intake, protocol_item, protocol, water_log, medication_dose, medication, meal_item, meal, recipe_ingredient, recipe, pantry_import, pantry_item, weight_log, sleep_log, check_in, "
```

- [ ] **Step 6: Run the IT — expect green**

```bash
./mvnw clean test -q -Dtest=BriefingPersistenceIT
```
Expected: 4 tests PASS (Liquibase applies the new changeset on boot).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/resources/db/changelog api/feature/proactive backend/src/main/java/io/mrkuhne/mezo/feature/proactive backend/src/test/java/io/mrkuhne/mezo/support backend/src/test/java/io/mrkuhne/mezo/feature/proactive
git commit -m "feat(proactive): briefing table + typed jsonb envelope + repo + test plumbing (mezo-h4wp.1)"
```

---

### Task 3: Switch + properties + `BriefingGenerator` + fake dispatch

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/ProactiveProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/DailySummaryRepository.java` (one new finder)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (briefing dispatch — LITERAL marker, no proactive import)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/BriefingGenerator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/BriefingGeneratorIT.java`

**Interfaces:**
- Consumes: Task 2's entity/repo/populator; companion's `ContextSnapshotAssembler.render(UUID, LocalDate): String`, `KnowledgeFactService.renderPromptBlock(UUID): String`, `CompanionLlm.complete(String, String): String`.
- Produces: `FeaturesConfiguration.PROACTIVE_SWITCH`; `ProactiveProperties.briefing().pastDays(): int`; `BriefingGenerator.BRIEFING_MARKER` ( = `"REGGELI-BRIEFING-FELADAT"`), `BriefingGenerator.generate(UUID userId, LocalDate date): BriefingEntity` (null = no data / unparseable answer — honest absence), `BriefingGenerator.gather(UUID, LocalDate): BriefingGather` (null when the summary window is empty) with `record BriefingGather(String payload, List<BriefingContentEnvelope.Ref> candidates)`. Task 4 consumes `generate`.

- [ ] **Step 1: Write the failing IT**

`backend/src/test/java/io/mrkuhne/mezo/feature/proactive/BriefingGeneratorIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.BriefingEntity;
import io.mrkuhne.mezo.feature.proactive.repository.BriefingRepository;
import io.mrkuhne.mezo.feature.proactive.service.BriefingGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.BriefingPopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * B1.1 generation flow over the fake LLM: the pure-code gather composes snapshot + facts +
 * past summaries + numbered ref candidates; the [fake-briefing:{…}] sentinel (planted via a
 * check-in note, the [fake-summary:…] trick) scripts the strict-JSON answer; broken JSON or an
 * empty summary window produce NO row (honest absence).
 */
@Transactional
@ActiveProfiles("companion-fake")
class BriefingGeneratorIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 7, 6);

    @Autowired private BriefingGenerator briefingGenerator;
    @Autowired private BriefingRepository briefingRepository;
    @Autowired private BriefingPopulator briefingPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private KnowledgeFactPopulator knowledgeFactPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testGather_shouldComposeSnapshotFactsSummariesAndCandidates_whenDataExists() {
        UUID user = userPopulator.user("gather@test.local");
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap kemény leg-day volt.");
        knowledgeFactPopulator.confirmedFact(user, "Laktózérzékeny");

        BriefingGenerator.BriefingGather gather = briefingGenerator.gather(user, DAY);

        assertThat(gather).isNotNull();
        assertThat(gather.payload())
                .contains("AKTUÁLIS ÁLLAPOT")                      // V0.3 snapshot block
                .contains("Laktózérzékeny")                        // V1.1 facts block
                .contains("Tegnap kemény leg-day volt.")           // past narrative
                .contains("HIVATKOZÁS-JELÖLTEK");                  // numbered candidates
        // 6 static snapshot candidates + 1 per included summary
        assertThat(gather.candidates()).hasSize(7);
        assertThat(gather.candidates().get(6).kind()).isEqualTo("Memory");
        assertThat(gather.candidates().get(6).label()).isEqualTo(DAY.minusDays(1).toString());
    }

    @Test
    void testGather_shouldReturnNull_whenNoSummariesInWindow() {
        UUID user = userPopulator.user("gather-empty@test.local");

        assertThat(briefingGenerator.gather(user, DAY)).isNull();
    }

    @Test
    void testGenerate_shouldPersistScriptedEnvelope_whenSentinelPlanted() {
        UUID user = userPopulator.user("gen@test.local");
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap pihenőnap volt.");
        // the check-in note rides into the snapshot's [Regeneráció] block -> the fake sees it
        checkInPopulator.checkIn(user, DAY,
                "[fake-briefing:{\"eyebrow\":\"Reta nap 3\",\"body\":[\"Jó reggelt!\"],\"refIndexes\":[5,6]}]");

        BriefingEntity briefing = briefingGenerator.generate(user, DAY);

        assertThat(briefing).isNotNull();
        assertThat(briefing.getContent().eyebrow()).isEqualTo("Reta nap 3");
        assertThat(briefing.getContent().body()).containsExactly("Jó reggelt!");
        assertThat(briefing.getContent().refs()).extracting("kind")
                .containsExactly("Sleep", "Memory");               // candidates #5 and #6
        assertThat(briefing.getGeneratedAt()).isNotNull();
    }

    @Test
    void testGenerate_shouldReturnExistingWithoutLlmCall_whenRowAlreadyExists() {
        UUID user = userPopulator.user("gen-idem@test.local");
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap úszás volt.");
        BriefingEntity existing = briefingPopulator.briefing(user, DAY);

        BriefingEntity second = briefingGenerator.generate(user, DAY);

        assertThat(second.getId()).isEqualTo(existing.getId());
        assertThat(briefingRepository.count()).isEqualTo(1);
    }

    @Test
    void testGenerate_shouldReturnNull_whenAnswerIsNotParseableJson() {
        UUID user = userPopulator.user("gen-broken@test.local");
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap futás volt.");
        checkInPopulator.checkIn(user, DAY, "[fake-briefing:{\"eyebrow\":}]");   // invalid JSON

        assertThat(briefingGenerator.generate(user, DAY)).isNull();
        assertThat(briefingRepository.count()).isZero();
    }

    @Test
    void testGenerate_shouldDropOutOfRangeRefIndexes_whenModelHallucinatesThem() {
        UUID user = userPopulator.user("gen-refs@test.local");
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap edzés volt.");
        checkInPopulator.checkIn(user, DAY,
                "[fake-briefing:{\"eyebrow\":\"x\",\"body\":[\"y\"],\"refIndexes\":[0,99,-1,0]}]");

        BriefingEntity briefing = briefingGenerator.generate(user, DAY);

        // 99 and -1 dropped, duplicate 0 deduped -> exactly candidate #0
        assertThat(briefing.getContent().refs()).extracting("kind").containsExactly("WeightTrend");
    }
}
```

Check `KnowledgeFactPopulator` and `CheckInPopulator` factory signatures first and adapt the two calls: the fact must be `include_in_prompt = true` (confirmed), and the check-in factory must accept a note (if the existing factory takes no note, add an overload in the populator — additive, safe).

- [ ] **Step 2: Run it — expect compile failure**

```bash
./mvnw clean test -q -Dtest=BriefingGeneratorIT
```
Expected: FAIL — `BriefingGenerator`/`ProactiveProperties` do not exist.

- [ ] **Step 3: Switch + properties + config**

`FeaturesConfiguration.java` — append:

```java
    /** Proactive layer (mezo-h4wp) — generated briefing + weekly prose + heartbeat + predictions.
     *  Every proactive bean conditions on BOTH this AND COMPANION_SWITCH (the generators call the
     *  CompanionLlm port, whose beans only exist when the companion is on). */
    public static final String PROACTIVE_SWITCH = "mezo.feature.proactive.enabled";
```

`backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/ProactiveProperties.java`:

```java
package io.mrkuhne.mezo.feature.proactive.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Proactive-layer tuning (mezo.proactive). B1.1: briefing gather window; B1.2 adds cron + regen. */
@Validated
@ConfigurationProperties(prefix = "mezo.proactive")
public record ProactiveProperties(@NotNull @Valid Briefing briefing) {

    public record Briefing(
        /** How many finished days of narrative memory (daily_summary) the gather reads;
         *  doubles as the emptiness gate: zero summaries in the window -> no briefing (404). */
        @Min(1) @Max(14) int pastDays
    ) {}
}
```

(Registered automatically — `MezoApplication` carries `@ConfigurationPropertiesScan`.)

`application.yml` — under `mezo.feature:` append after `companion.enabled`:

```yaml
    # Proactive layer (mezo-h4wp) — generated briefing (B1.1+). Presupposes the companion
    # switch: proactive beans condition on BOTH (they call the CompanionLlm port).
    proactive:
      enabled: true
```

and as a new top-level block under `mezo:` (sibling of `companion:`):

```yaml
  proactive:
    briefing:
      # How many finished days of narrative memory (daily_summary) the briefing gather reads;
      # doubles as the emptiness gate: zero summaries in the window -> no briefing (honest 404)
      past-days: 7
```

- [ ] **Step 4: New finder on the companion summary repo**

`DailySummaryRepository.java` — append (proactive→companion read; the repo stays proactive-unaware):

```java
    /** The proactive briefing's past-narrative window (B1.1) — newest first. */
    List<DailySummaryEntity> findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(
            UUID createdBy, LocalDate from);
```

- [ ] **Step 5: Fake dispatch (LITERAL marker — cycle rule!)**

`FakeCompanionLlm.java` — add next to the other sentinels:

```java
    /** Mirror of BriefingGenerator.BRIEFING_MARKER (feature/proactive) — a LITERAL, not an
     *  import: companion→proactive would be a NEW package cycle (feature_slices_are_cycle_free).
     *  Drift is caught loudly by BriefingGeneratorIT (echo answer -> parse fails -> null row). */
    public static final String BRIEFING_MARKER_MIRROR = "REGGELI-BRIEFING-FELADAT";

    /** Scripted briefing (B1.1): {@code [fake-briefing:{…}]} planted via a check-in note. */
    public static final Pattern BRIEFING_SENTINEL =
            Pattern.compile("\\[fake-briefing:(\\{.*?\\})]", Pattern.DOTALL);
```

and in `complete(...)`, after the `SUMMARY_MARKER` branch:

```java
        if (systemPrompt.startsWith(BRIEFING_MARKER_MIRROR)) {
            Matcher m = BRIEFING_SENTINEL.matcher(userMessage);
            // default = valid minimal JSON so the un-scripted happy path still persists a row
            return m.find() ? m.group(1)
                    : "{\"eyebrow\":\"Fake briefing\",\"body\":[\"FAKE-BRIEFING-NARRATÍVA\"],\"refIndexes\":[]}";
        }
```

- [ ] **Step 6: The generator**

`backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/BriefingGenerator.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.BriefingContentEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.BriefingEntity;
import io.mrkuhne.mezo.feature.proactive.repository.BriefingRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
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
 * B1.1 morning-briefing generator (spec §4): a PURE-CODE gather composes the shipped companion
 * reads (V0.3 snapshot + V1.1 facts block + V2.2 daily summaries) plus numbered, code-collected
 * ref candidates; ONE cheap-tier CompanionLlm call answers a strict-JSON contract
 * ({eyebrow, body[], refIndexes[]}); the model SELECTS refs by index and can never invent one.
 * Gather = pure code, prose = pure LLM (NFR-M-4). No summaries in the window or a broken answer
 * ⇒ NO row (honest absence, never a fabricated briefing). Existing row ⇒ returned untouched
 * (idempotent; B1.2 owns staleness/regeneration).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class BriefingGenerator {

    /** Prompt prefix the fake LLM dispatches on — MIRRORED as a literal in FakeCompanionLlm
     *  (a companion→proactive import would be a new package cycle). Keep the two in sync. */
    public static final String BRIEFING_MARKER = "REGGELI-BRIEFING-FELADAT";

    private static final String PROMPT = BRIEFING_MARKER + "\n"
            + "Írj rövid magyar reggeli briefinget Danielnek a mai napra, kizárólag a megadott "
            + "tényadatokból. Szabályok: (1) ha az éjszakai alvás gyenge volt, azzal kezdd — az a "
            + "nap elsődleges tényezője; (2) többhorizontú: a mai terv mellett utalj a hét "
            + "trendjére; (3) zárd 2-3 konkrét, apró fókuszponttal; (4) számot vagy adatot "
            + "kitalálni tilos; (5) gyógyszer adagolására (pl. retatrutid) vonatkozó változtatást "
            + "SOHA ne javasolj — az orvosi döntés. Válaszolj KIZÁRÓLAG szigorú JSON-nal, "
            + "markdown nélkül, pontosan ebben a formában: "
            + "{\"eyebrow\": \"egysoros fejléc\", \"body\": [\"bekezdés\", ...], "
            + "\"refIndexes\": [a felhasznált HIVATKOZÁS-JELÖLTEK sorszámai]}";

    /** The six V0.3 snapshot blocks as static ref candidates (kind = the FE RefTag vocabulary). */
    static final List<BriefingContentEnvelope.Ref> SNAPSHOT_CANDIDATES = List.of(
            new BriefingContentEnvelope.Ref("WeightTrend", "profil"),
            new BriefingContentEnvelope.Ref("Goal", "cél"),
            new BriefingContentEnvelope.Ref("Workout", "edzés"),
            new BriefingContentEnvelope.Ref("FuelDay", "mai üzemanyag"),
            new BriefingContentEnvelope.Ref("Medication", "gyógyszer"),
            new BriefingContentEnvelope.Ref("Sleep", "regeneráció"));

    private final BriefingRepository briefingRepository;
    private final DailySummaryRepository dailySummaryRepository;
    private final ContextSnapshotAssembler contextSnapshotAssembler;
    private final KnowledgeFactService knowledgeFactService;
    private final CompanionLlm companionLlm;
    private final ProactiveProperties properties;
    private final ObjectMapper objectMapper;

    /** The gather's output: the prompt payload + the numbered ref candidates it offered. */
    public record BriefingGather(String payload, List<BriefingContentEnvelope.Ref> candidates) {
    }

    /** The model's strict-JSON answer shape. */
    record ParsedBriefing(String eyebrow, List<String> body, List<Integer> refIndexes) {
    }

    /**
     * Generates (or returns the existing) briefing for one day. Returns null when there is no
     * narrative memory in the window or the answer is unusable — the caller renders honest 404.
     */
    @Transactional
    public BriefingEntity generate(UUID userId, LocalDate date) {
        BriefingEntity existing = briefingRepository
                .findByCreatedByAndBriefingDate(userId, date).orElse(null);
        if (existing != null) {
            return existing;
        }
        BriefingGather gather = gather(userId, date);
        if (gather == null) {
            log.debug("No daily summaries for {} in the {}-day window before {} — no briefing",
                    userId, properties.briefing().pastDays(), date);
            return null;
        }
        String answer = companionLlm.complete(PROMPT, gather.payload());
        ParsedBriefing parsed = parse(answer);
        if (parsed == null || parsed.eyebrow() == null || parsed.eyebrow().isBlank()
                || parsed.body() == null || parsed.body().isEmpty()) {
            log.warn("Unusable briefing answer for {} on {} — no row persisted", userId, date);
            return null;
        }
        BriefingEntity briefing = new BriefingEntity();
        briefing.setCreatedBy(userId);
        briefing.setBriefingDate(date);
        briefing.setContent(new BriefingContentEnvelope(
                parsed.eyebrow(), parsed.body(), resolveRefs(parsed.refIndexes(), gather.candidates())));
        briefing.setGeneratedAt(Instant.now());
        return briefingRepository.saveAndFlush(briefing);
    }

    /**
     * PURE-CODE composition of the prompt payload (LLM-free, IT-asserted): snapshot + facts +
     * past narratives + the numbered candidate list. Null when the summary window is empty —
     * the v1 emptiness gate (spec §7, decided at B1.1; B1.2 may loosen it).
     */
    public BriefingGather gather(UUID userId, LocalDate date) {
        List<DailySummaryEntity> past = dailySummaryRepository
                .findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(
                        userId, date.minusDays(properties.briefing().pastDays()));
        if (past.isEmpty()) {
            return null;
        }
        List<BriefingContentEnvelope.Ref> candidates = new ArrayList<>(SNAPSHOT_CANDIDATES);
        StringBuilder payload = new StringBuilder();
        payload.append(contextSnapshotAssembler.render(userId, date));
        payload.append(knowledgeFactService.renderPromptBlock(userId));
        payload.append("\n\nKORÁBBI NAPOK (legfrissebb elöl):\n");
        for (DailySummaryEntity summary : past) {
            payload.append("- ").append(summary.getSummaryDate()).append(": ")
                    .append(summary.getNarrative()).append('\n');
            candidates.add(new BriefingContentEnvelope.Ref(
                    "Memory", summary.getSummaryDate().toString()));
        }
        payload.append("\nHIVATKOZÁS-JELÖLTEK (a refIndexes ezekre mutat):\n");
        for (int i = 0; i < candidates.size(); i++) {
            BriefingContentEnvelope.Ref ref = candidates.get(i);
            payload.append(i).append(": [").append(ref.kind()).append("] ")
                    .append(ref.label()).append('\n');
        }
        return new BriefingGather(payload.toString(), candidates);
    }

    /** Defensive first-{ to last-} JSON parse (the FactExtractionService idiom); null on any failure. */
    private ParsedBriefing parse(String answer) {
        if (answer == null) {
            return null;
        }
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(answer.substring(start, end + 1), ParsedBriefing.class);
        } catch (Exception e) {
            log.warn("Briefing answer failed to parse: {}", e.getMessage());
            return null;
        }
    }

    /** Bounds-checked, order-preserving, deduped index→candidate resolution. */
    private List<BriefingContentEnvelope.Ref> resolveRefs(
            List<Integer> indexes, List<BriefingContentEnvelope.Ref> candidates) {
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

- [ ] **Step 7: Run the IT — expect green**

```bash
./mvnw clean test -q -Dtest=BriefingGeneratorIT
```
Expected: 6 tests PASS. If `testGenerate_shouldPersistScriptedEnvelope…` fails because the sentinel is truncated: the check-in note rides through the snapshot block truncated to `mezo.companion.snapshot.checkin-note-max-chars` (200) — keep the scripted JSON under 200 chars.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java backend/src/main/resources/application.yml backend/src/test/java
git commit -m "feat(proactive): switch + properties + BriefingGenerator over the companion stack (mezo-h4wp.1)"
```

---

### Task 4: Lazy GET — service + mapper + controller + API ITs

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveBriefingService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/controller/ProactiveController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ProactiveApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ProactiveApiSwitchOffIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ProactiveApiCompanionOffIT.java`

**Interfaces:**
- Consumes: Task 1's generated `ProactiveApi`/`BriefingResponse`/`BriefingRef`; Task 3's `BriefingGenerator.generate`; Task 2's `BriefingRepository`.
- Produces: `ProactiveBriefingService.getBriefing(UUID userId, LocalDate date): BriefingResponse` (404 via `SystemRuntimeErrorException` when absent) — B1.2's FE consumes the endpoint.

- [ ] **Step 1: Write the failing API ITs**

`backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ProactiveApiIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.BriefingResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/** HTTP-level briefing flow against the fake LLM (lazy generation on first GET). */
@ActiveProfiles("companion-fake")
class ProactiveApiIT extends ApiIntegrationTest {

    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testGetBriefing_shouldLazilyGenerateAndBeIdempotent_whenSummariesExist() {
        dailySummaryPopulator.summary(ownerId(), LocalDate.now().minusDays(1),
                "Tegnap kemény leg-day volt.");

        BriefingResponse first = getForBody(
                "/api/proactive/briefing", ownerAuthHeaders(), HttpStatus.OK, BriefingResponse.class);

        // un-scripted fake answers the default valid JSON
        assertThat(first.getEyebrow()).isEqualTo("Fake briefing");
        assertThat(first.getBody()).containsExactly("FAKE-BRIEFING-NARRATÍVA");
        assertThat(first.getDate()).isEqualTo(LocalDate.now());
        assertThat(first.getGeneratedAt()).isNotNull();

        BriefingResponse second = getForBody(
                "/api/proactive/briefing", ownerAuthHeaders(), HttpStatus.OK, BriefingResponse.class);
        assertThat(second.getGeneratedAt()).isEqualTo(first.getGeneratedAt());   // no regeneration
    }

    @Test
    void testGetBriefing_shouldHonorDateParam_whenPastDateRequested() {
        LocalDate day = LocalDate.now().minusDays(3);
        dailySummaryPopulator.summary(ownerId(), day.minusDays(1), "Aznap előtt úszás volt.");

        BriefingResponse briefing = getForBody(
                "/api/proactive/briefing?date=" + day, ownerAuthHeaders(),
                HttpStatus.OK, BriefingResponse.class);

        assertThat(briefing.getDate()).isEqualTo(day);
    }

    @Test
    void testGetBriefing_shouldReturn404_whenNoNarrativeMemory() {
        String body = getForBody(
                "/api/proactive/briefing", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testGetBriefing_shouldReturn401_whenNoToken() {
        getForBody("/api/proactive/briefing", null, HttpStatus.UNAUTHORIZED, String.class);
    }
}
```

Check `AppUserRepository`'s package (`io.mrkuhne.mezo.feature.auth.repository` assumed — mirror `CompanionPatternApiIT`'s imports verbatim).

`backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ProactiveApiSwitchOffIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** Proactive switch off ⇒ the whole proactive HTTP surface does not exist (bean-boundary gating). */
@TestPropertySource(properties = "mezo.feature.proactive.enabled=false")
class ProactiveApiSwitchOffIT extends ApiIntegrationTest {

    @Test
    void testGetBriefing_shouldReturn404_whenProactiveSwitchedOff() {
        String body = getForBody(
                "/api/proactive/briefing", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
}
```

`backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ProactiveApiCompanionOffIT.java`:

```java
package io.mrkuhne.mezo.feature.proactive;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * Companion off + proactive on ⇒ proactive beans must ALSO not exist (they inject the
 * CompanionLlm port, which is absent) — the dual-name @ConditionalOnProperty contract.
 * The context booting at all IS the assertion; the 404 confirms no controller routed.
 */
@TestPropertySource(properties = {
        "mezo.feature.companion.enabled=false",
        "mezo.feature.proactive.enabled=true"})
class ProactiveApiCompanionOffIT extends ApiIntegrationTest {

    @Test
    void testGetBriefing_shouldReturn404_whenCompanionSwitchedOff() {
        String body = getForBody(
                "/api/proactive/briefing", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
}
```

- [ ] **Step 2: Run them — expect failures**

```bash
./mvnw clean test -q -Dtest='ProactiveApi*IT'
```
Expected: FAIL — no controller (the happy-path test 404s; compile passes because Task 1 generated the DTOs).

- [ ] **Step 3: Mapper + service + controller**

`backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java`:

```java
package io.mrkuhne.mezo.feature.proactive.mapper;

import io.mrkuhne.mezo.api.dto.BriefingRef;
import io.mrkuhne.mezo.api.dto.BriefingResponse;
import io.mrkuhne.mezo.feature.proactive.entity.BriefingContentEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.BriefingEntity;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ProactiveMapper {

    @Mapping(target = "date", source = "briefingDate")
    @Mapping(target = "eyebrow", source = "content.eyebrow")
    @Mapping(target = "body", source = "content.body")
    @Mapping(target = "refs", source = "content.refs")
    BriefingResponse toBriefingResponse(BriefingEntity entity);

    BriefingRef toBriefingRef(BriefingContentEnvelope.Ref ref);

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
```

`backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveBriefingService.java`:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.BriefingResponse;
import io.mrkuhne.mezo.feature.proactive.entity.BriefingEntity;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.repository.BriefingRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The briefing read path (B1.1): persisted row, or lazy generation (hybrid model, spec §2). */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ProactiveBriefingService {

    private final BriefingRepository briefingRepository;
    private final BriefingGenerator briefingGenerator;
    private final ProactiveMapper mapper;

    /** date = null ⇒ the server's today (the FE sends its local date, the check-in precedent). */
    @Transactional
    public BriefingResponse getBriefing(UUID userId, LocalDate date) {
        LocalDate day = date != null ? date : LocalDate.now();
        BriefingEntity briefing = briefingRepository
                .findByCreatedByAndBriefingDate(userId, day)
                .orElseGet(() -> briefingGenerator.generate(userId, day));
        if (briefing == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
        }
        return mapper.toBriefingResponse(briefing);
    }
}
```

`backend/src/main/java/io/mrkuhne/mezo/feature/proactive/controller/ProactiveController.java`:

```java
package io.mrkuhne.mezo.feature.proactive.controller;

import io.mrkuhne.mezo.api.controller.ProactiveApi;
import io.mrkuhne.mezo.api.dto.BriefingResponse;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveBriefingService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ProactiveController implements ProactiveApi {

    private final ProactiveBriefingService briefingService;
    private final CurrentUserId currentUserId;

    @Override
    public BriefingResponse getBriefing(LocalDate date) {
        return briefingService.getBriefing(currentUserId.get(), date);
    }
}
```

(If Task 1 Step 4 revealed a different generated signature — e.g. `Optional<LocalDate>` — implement THAT signature and adapt the null-check accordingly.)

- [ ] **Step 4: Run the API ITs — expect green**

```bash
./mvnw clean test -q -Dtest='ProactiveApi*IT'
```
Expected: 6 tests PASS across the three classes.

- [ ] **Step 5: Full backend gate (includes ArchUnit)**

```bash
./mvnw clean test
```
Expected: BUILD SUCCESS — every existing IT green; `ArchitectureTest.feature_slices_are_cycle_free` proves no companion↔proactive cycle; `controllers_implement_generated_api` accepts `ProactiveController`.

- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "feat(proactive): lazy briefing GET — service + MapStruct mapper + controller + API ITs (mezo-h4wp.1)"
```

---

### Task 5: Living doc + milestone + close-out

**Files:**
- Create: `docs/features/proactive.md`
- Modify: `docs/milestones/roadmap.md` (milestone row + Phase-4 bullet status)
- Modify: `docs/superpowers/plans/2026-07-06-proactive-roadmap.md` (mark B1.1 ✅ in §B1.1 header line)

**Interfaces:** none (documentation) — but the slice is NOT done without it (CLAUDE.md docs mandate).

- [ ] **Step 1: Write `docs/features/proactive.md`**

Follow the 10-section template (the knowledge-base skill is the operating manual — invoke it if unsure). Frontmatter + content must cover: what exists after B1.1 (table, generator, gather composition, strict-JSON contract, ref-candidate selection, lazy GET, dual-switch gating, the marker-mirror gotcha, the emptiness gate), status per layer (backend 🟢 B1.1 · FE ⛔ until B1.2 · cron ⛔ B1.2), and pointers to the spec/roadmap. Frontmatter:

```yaml
---
title: Proactive layer (briefing, weekly prose, heartbeat, predictions)
type: feature-domain
status: in-progress
updated: 2026-07-06
tags: [proactive, briefing, ai, llm, backend, phase-4]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/proactive
  - api/feature/proactive/proactive.yml
  - backend/src/main/resources/db/changelog/1.0.0/script/202607061100_mezo-h4wp.1_create_briefing.sql
related: [companion, today, insights, _platform-api-backend]
---
```

Document §9 gotchas explicitly: (a) `BRIEFING_MARKER` is literal-mirrored in `FakeCompanionLlm` (cycle rule) — keep in sync; (b) proactive beans condition on BOTH switches; (c) FE `Briefing.confidence`/`tone` deliberately absent from the wire (fabricated-number rule / dead data); (d) empty summary window ⇒ 404 by design.

- [ ] **Step 2: Milestone row**

Add to `docs/milestones/roadmap.md` milestone log (top of the table):

```markdown
| 2026-07-06 | **Proactive B1.1 — skeleton + briefing spine (`mezo-h4wp.1`)** shipped: `feature/proactive` package born behind `mezo.feature.proactive.enabled` (dual-conditional with the companion switch); `briefing` table (typed jsonb envelope — eyebrow/body/refs, NO confidence/tone by decision); `BriefingGenerator` composes snapshot (V0.3) + facts block (V1.1) + last-7d daily summaries (V2.2) + numbered code-collected ref candidates → ONE cheap-tier port call, strict-JSON answer, model-selected refs (bounds-checked); `GET /api/proactive/briefing` (contract fragment `proactive.yml`) returns or lazily generates; empty narrative window ⇒ honest 404. Fake LLM gained the `[fake-briefing:{…}]` sentinel (marker literal-mirrored — package-cycle rule). FE untouched (B1.2). |
```

Also flip the Phases bullet's B-stage marker: in the Phase-4 line change „B „megszólal reggel"" status by appending „(B1.1 ✅ 2026-07-06)".

- [ ] **Step 3: Mark the roadmap slice**

In `docs/superpowers/plans/2026-07-06-proactive-roadmap.md`, change the §B1.1 heading to:

```markdown
### B1.1 — Proactive skeleton + briefing spine ✅ (shipped 2026-07-06)
```

- [ ] **Step 4: Lint + gates**

```bash
node scripts/lint-docs.mjs        # proactive.md clean; the pre-existing _platform-api-backend stale is mezo-avpl
cd backend && ./mvnw clean test   # full backend green
cd ../frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test   # unchanged but the gate is cheap insurance
```

- [ ] **Step 5: Commit docs**

```bash
git add docs
git commit -m "docs(proactive): living doc born + milestone row — B1.1 shipped (mezo-h4wp.1)"
```

- [ ] **Step 6: Merge + push + bd close**

```bash
git checkout main && git pull --rebase          # rebase BEFORE the merge, never after
git merge --no-ff feat/proactive-b11 -m "Merge feat/proactive-b11 — proactive skeleton + briefing spine (mezo-h4wp.1)"
git branch -d feat/proactive-b11
bd close mezo-h4wp.1
bd update mezo-h4wp.1 --notes "Shipped: feature/proactive package + briefing table/envelope + BriefingGenerator (snapshot+facts+summaries gather, strict-JSON, model-selected refs) + lazy GET /api/proactive/briefing + dual-switch gating + fake sentinel. Decisions closed: envelope has NO confidence/tone; refs code-collected/model-selected; empty summary window => 404. Next: B1.2 (cron + staleness + FE swap)."
bd dolt push && git push
git status    # MUST show "up to date with origin"
```

---

## Self-review notes (done while writing)

- **Spec coverage (§B1.1):** package+switch+properties ✅ (T3) · briefing table + partial unique ✅ (T2) · generator with gather/one-call/strict-JSON/ref-index selection ✅ (T3) · contract fragment + lazy GET ✅ (T1, T4) · populator/ResetDatabase/ITs incl. ownership ✅ (T2–T4) · living doc born ✅ (T5). Envelope/emptiness/`date`-param decisions closed in Global Constraints.
- **Cycle safety:** the ONLY companion-side edits are additive and proactive-unaware (a repo finder, a fake sentinel with a literal marker). ArchUnit runs in T4 Step 5.
- **Known verify-at-execution points (flagged in-task):** `UserPopulator`/`CheckInPopulator`/`KnowledgeFactPopulator` factory signatures (T2/T3 Step 1), the generated `getBriefing` parameter shape (T1 Step 4 → T4 Step 3), `AppUserRepository` package (T4 Step 1).
