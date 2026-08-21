# W1.3 — Gratitude entries (`mezo-b3pp.3`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1–3 gratitude lines a day, streak-visible. Gratitude entries persist server-side, embed post-commit into the companion's `memory_embedding` vector store (`kind=gratitude`), and surface in the evening ritual + a streak card on `/me/naplo`.

**Architecture:** A second aggregate (`gratitude_entry`) inside the **existing** `feature/journal` package, mirroring the `decision_entry` pattern: own contract fragment under `/api/journal/gratitude`, own service/repository/entity/mapper, same event → `@Async AFTER_COMMIT` → `MemoryEmbeddingWriter` embed seam (a new `GratitudeEmbeddingListener` in `feature/companion/embedding`). The FE captures gratitude in two places: the gratitude half of the RitualPage's reflection act (up to 3 rows with LIFE skill chips) and a new "Hálás" mode toggle in `JournalSheet`. The `/me/naplo` page gains a small streak card ("hálanapló: N napos sorozat") derived from a server-side count endpoint.

**Tech Stack:** Java 21 / Spring Boot 4.x / Maven, PostgreSQL 16 + Liquibase, MapStruct + Lombok, OpenAPI contract-first (`api/feature/journal/journal.yml`); React 19 + Vite + Tailwind v4 + TanStack Query on the frontend; Vitest + Testing Library; JUnit 5 + AssertJ + Testcontainers/fixed-DB integration tests.

## Global Constraints

Copied from the design spec (`docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md` §4, §5.3, §11) and the house references — every task below inherits these:

- **Contract-first.** `api/feature/journal/journal.yml` is edited BEFORE any Java; then `cd api/generate && npm run generate:api` and `cd frontend && pnpm generate:api`. Backend implements the **generated** `JournalApi` interface and uses `io.mrkuhne.mezo.api.dto` models. Never hand-write a boundary DTO.
- **Base package** `io.mrkuhne.mezo`; package layout `feature/{name}/{controller,service,repository,entity,dto,mapper}` (`docs/references/java_package_structure.md`).
- **UUID primary keys** (`gen_random_uuid()`), `created_by uuid not null references app_user(id) on delete cascade`, `is_deleted` soft delete via `@SQLRestriction`/`@SQLDelete`, `created_at timestamptz not null default now()`. Explicit constraint names: `pk_/fk_/uq_/ck_/idx_`.
- **Liquibase:** new SQL file `src/main/resources/db/changelog/1.0.0/script/{YYYYMMDDHHMM}_mezo-b3pp.3_{desc}.sql` + a `changeSet` appended to `1.0.0_master.yml` with id `"1.0.0:{filename-without-.sql}"`, author `daniel.kuhne`. Never modify a released changeset.
- **DI:** constructor injection via `@RequiredArgsConstructor`, never field injection, never `@Value`. `@Transactional` on service methods only.
- **Error handling:** `SystemRuntimeErrorException` + `SystemMessage.error("CODE")` with the Hungarian text in `src/main/resources/messages.properties`. No hardcoded user-facing strings in Java.
- **Config:** feature gating reuses `FeaturesConfiguration.JOURNAL_SWITCH` (`mezo.feature.journal.enabled`) — off ⇒ no gratitude beans, the whole surface 404s.
- **Every LLM/embed call site** wraps in `LlmCallContextHolder.runWith(new LlmCallContext(feature, operation, entityKind, entityId), …)`. For this slice that is already inside `MemoryEmbeddingWriter` — extend it, do not call `EmbeddingPort` from anywhere else.
- **Tests are integration-first:** `@SpringBootTest` via `AbstractIntegrationTest` (service level) / `ApiIntegrationTest` (HTTP level). Naming `test{Method}_should{Result}_when{Condition}`. AssertJ only. No mocks / `@MockBean` / H2 in integration tests. Test data through `*Populator` factories. **New table ⇒ add it to `ResetDatabase`'s TRUNCATE list.**
- **Frontend** (`docs/references/frontend_conventions.md`): four layers; feature code imports hooks from **`@/data/hooks` only**; implementations in `data/journal/<name>Hooks.ts`; dual-mode reads via `useDualQuery` with an honest mock seed; modals are `*Sheet` under `features/<domain>/sheets/`; deep absolute `@/*` imports, no relative `../`, no barrels except `data/hooks.ts`; tests colocated. Hungarian UI copy.
- **Docs in the same change:** `docs/features/journal.md` (gratitude sections), `docs/features/me.md` (the `/me/naplo` surface gains the streak card). Then `node scripts/lint-docs.mjs` — no new staleness allowed.
- **Gates:** `cd backend && ./mvnw clean test -Dtest='<affected ITs>'` (docker compose up first); `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`. Always `clean` — Lombok+MapStruct incremental compile is flaky.

## Locked design decisions

These were decided while reading the spec + code; do not re-litigate them mid-execution:

1. **Same domain, same controller.** `gratitude_entry` lives in `feature/journal` (not a new `feature/gratitude`). `JournalController` implements the three new `JournalApi` methods for gratitude, delegating to a new `GratitudeService` — the same pattern `DecisionService` + `JournalController` already uses.
2. **No `source` column.** Unlike `journal_entry`, gratitude has no `source` discriminator. The FE captures it from either RitualPage or JournalSheet, but both land on the same server endpoint. The `occurredOn` defaults to today server-side when absent.
3. **`life_area` is nullable with a CHECK constraint on the 8 LIFE skill keys.** The spec uses `varchar(16)` with `ck_gratitude_entry_life_area check (life_area is null or life_area in ('mindfulness','mindset','cooking','financial','productivity','learning','connection','recovery'))`. On the wire, `lifeArea` is a `pattern` (not an enum) on `CreateGratitudeRequest` — an invalid value must 400 via bean validation, not 500 via a failed Jackson enum deserialize.
4. **Embed content is just the text.** Gratitude entries are short and carry disproportionate emotional signal (spec §5.3). No `decision_text + outcome` composition — just the raw text, capped at `embed-max-chars`. The `(kind, ref_id)` uniqueness gate and in-place re-embed pattern are identical to `writeJournal`/`writeDecision`.
5. **Streak is a derived count, not materialized.** The server provides a `countStreakByUser(userId)` method on `GratitudeEntryRepository` that counts consecutive days (from today backwards) with at least one gratitude entry. No `gratitude_streak` table. The FE calls `GET /api/journal/gratitude/streak` to read it.
6. **DELETE only (no PUT update).** Gratitude is a moment-capture, not an editing surface. The spec lists `POST`, `GET`, `DELETE` — no update endpoint. The FE never opens a gratitude entry in edit mode.

## File structure

**Backend — create**
- `backend/src/main/resources/db/changelog/1.0.0/script/202608211400_mezo-b3pp.3_create_gratitude_entry.sql` — the table.
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/entity/GratitudeEntryEntity.java` — the aggregate.
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/repository/GratitudeEntryRepository.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/GratitudeService.java` — create / list / delete / streak.
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/GratitudeEntrySavedEvent.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/mapper/GratitudeMapper.java`

**Backend — modify**
- `api/feature/journal/journal.yml` — 4 paths (`/api/journal/gratitude` POST/GET, `/api/journal/gratitude/{id}` DELETE, `/api/journal/gratitude/streak` GET) + 3 schemas.
- `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` — one changeSet.
- `backend/src/main/resources/messages.properties` — `GRATITUDE_ENTRY_NOT_FOUND`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/journal/controller/JournalController.java` — 4 new methods delegating to `GratitudeService`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/GratitudeEmbeddingListener.java` — new listener.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java` — `writeGratitude`.
- `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` — `gratitude_entry`.
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/JournalPopulator.java` — `createGratitude`.

**Frontend — create**
- `frontend/src/data/journal/gratitudeTypes.ts` — `GratitudeEntry` type.
- `frontend/src/data/journal/gratitudeApi.ts` — API client functions.
- `frontend/src/data/journal/gratitudeHooks.ts` — `useGratitudeEntries`, `useGratitudeActions`, `useGratitudeStreak`.
- `frontend/src/data/journal/gratitudeMock.ts` — mock seed.
- `frontend/src/data/journal/gratitudeHooks.test.tsx` — hook tests.
- `frontend/src/features/ritual/components/GratitudeInputRow.tsx` — single gratitude row component.
- `frontend/src/features/ritual/components/GratitudeInputRow.test.tsx` — row tests.

**Frontend — modify**
- `frontend/src/data/hooks.ts` — re-export gratitude hooks/types.
- `frontend/src/features/ritual/pages/RitualPage.tsx` — render gratitude rows in the reflection act (act 4, HarvestStep's pre-close area); `ACT_COUNT` 5→6.
- `frontend/src/features/me/sheets/JournalSheet.tsx` — add "Hálás" mode toggle (third option alongside "Napló"/"Döntés").
- `frontend/src/features/me/pages/JournalPage.tsx` — add `GratitudeStreakCard` at the top of the page.
- `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx` — extend the `naplo-pick` phase to include a "Hálás" tile (or a three-option picker).

---

### Task 1: Contract + migration + persistence

**Files:**
- Modify: `api/feature/journal/journal.yml`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608211400_mezo-b3pp.3_create_gratitude_entry.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`

- [ ] **Step 1: Add the contract fragment paths + schemas**

  Append to `api/feature/journal/journal.yml` under the existing `paths` block:

  ```yaml
  /api/journal/gratitude:
    get:
      tags: [Journal]
      operationId: listGratitudeEntries
      summary: Gratitude entries in a date range, newest first (Journal)
      parameters:
        - { name: from, in: query, required: true, schema: { type: string, format: date } }
        - { name: to, in: query, required: true, schema: { type: string, format: date } }
      responses:
        '200':
          description: Entries with occurred_on in [from, to], newest first
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/GratitudeEntryResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    post:
      tags: [Journal]
      operationId: createGratitudeEntry
      summary: Create a gratitude entry (Journal)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CreateGratitudeRequest' }
      responses:
        '201':
          description: Entry saved
          content:
            application/json:
              schema: { $ref: '#/components/schemas/GratitudeEntryResponse' }
        '400':
          description: Validation error (empty text, bad lifeArea)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/journal/gratitude/{id}:
    delete:
      tags: [Journal]
      operationId: deleteGratitudeEntry
      summary: Soft-delete a gratitude entry (Journal)
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '204':
          description: Deleted
        '404':
          description: GRATITUDE_ENTRY_NOT_FOUND
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/journal/gratitude/streak:
    get:
      tags: [Journal]
      operationId: countGratitudeStreak
      summary: Consecutive-day streak count (Journal)
      responses:
        '200':
          description: Streak count (integer, today included if entry exists)
          content:
            application/json:
              schema: { type: integer }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  ```

  Add schemas under `components/schemas`:

  ```yaml
  GratitudeEntryResponse:
    type: object
    required: [id, occurredOn, text, createdAt]
    properties:
      id: { type: string, format: uuid }
      occurredOn: { type: string, format: date }
      text: { type: string }
      lifeArea: { type: string }
      createdAt: { type: string, format: date-time }
  CreateGratitudeRequest:
    type: object
    required: [text]
    properties:
      text: { type: string, minLength: 1, maxLength: 280 }
      occurredOn:
        type: string
        format: date
        description: The day the entry is ABOUT; server defaults to today when absent.
      lifeArea:
        type: string
        description: One of the 8 LIFE skill keys, or null/absent.
        pattern: '^(mindfulness|mindset|cooking|financial|productivity|learning|connection|recovery)$'
  ```

- [ ] **Step 2: Regenerate the merged contract and the FE types**

  ```bash
  cd api/generate && npm run generate:api
  cd frontend && pnpm generate:api
  ```

- [ ] **Step 3: Write the migration**

  ```sql
  -- Liquibase changeSet registered in 1.0.0_master.yml
  -- id: "1.0.0:202608211400_mezo-b3pp.3_create_gratitude_entry", author: daniel.kuhne

  create table gratitude_entry (
      id           uuid primary key default gen_random_uuid(),
      created_by   uuid not null references app_user(id) on delete cascade,
      is_deleted   boolean not null default false,
      created_at   timestamptz not null default now(),
      occurred_on  date not null,
      text         varchar(280) not null,
      life_area    varchar(16),
      constraint ck_gratitude_entry_life_area check (life_area is null or life_area in
        ('mindfulness','mindset','cooking','financial','productivity','learning','connection','recovery'))
  );
  create index idx_gratitude_entry_created_by_occurred_on on gratitude_entry (created_by, occurred_on desc);
  ```

  Append a `changeSet` to `1.0.0_master.yml`:

  ```xml
  <changeSet id="1.0.0:202608211400_mezo-b3pp.3_create_gratitude_entry" author="daniel.kuhne">
      <sqlFile path="script/202608211400_mezo-b3pp.3_create_gratitude_entry.sql" relativeToChangelogFile="true"/>
  </changeSet>
  ```

- [ ] **Step 4: Write the entity + repository**

  Create `GratitudeEntryEntity.java`:

  ```java
  package io.mrkuhne.mezo.feature.journal.entity;

  import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
  import jakarta.persistence.Column;
  import jakarta.persistence.Entity;
  import jakarta.persistence.GeneratedValue;
  import jakarta.persistence.Id;
  import jakarta.persistence.Table;
  import jakarta.validation.constraints.NotNull;
  import jakarta.validation.constraints.Pattern;
  import jakarta.validation.constraints.Size;
  import java.time.LocalDate;
  import java.util.UUID;
  import lombok.Getter;
  import lombok.Setter;
  import org.hibernate.annotations.SQLDelete;
  import org.hibernate.annotations.SQLRestriction;

  @Getter
  @Setter
  @Entity
  @Table(name = "gratitude_entry")
  @SQLDelete(sql = "update gratitude_entry set is_deleted = true where id = ?")
  @SQLRestriction("is_deleted = false")
  public class GratitudeEntryEntity extends OwnedEntity {

      public static final String LIFE_AREA_PATTERN =
          "^(mindfulness|mindset|cooking|financial|productivity|learning|connection|recovery)$";

      @Id
      @GeneratedValue
      @Column(columnDefinition = "uuid")
      private UUID id;

      @NotNull
      @Column(name = "occurred_on", nullable = false)
      private LocalDate occurredOn;

      @NotNull
      @Column(nullable = false, length = 280)
      private String text;

      @Size(max = 16)
      @Pattern(regexp = LIFE_AREA_PATTERN)
      @Column(name = "life_area", length = 16)
      private String lifeArea;
  }
  ```

  Create `GratitudeEntryRepository.java`:

  ```java
  package io.mrkuhne.mezo.feature.journal.repository;

  import io.mrkuhne.mezo.feature.journal.entity.GratitudeEntryEntity;
  import java.time.LocalDate;
  import java.util.List;
  import java.util.Optional;
  import java.util.UUID;
  import org.springframework.data.jpa.repository.JpaRepository;
  import org.springframework.data.jpa.repository.Query;

  public interface GratitudeEntryRepository extends JpaRepository<GratitudeEntryEntity, UUID> {

      Optional<GratitudeEntryEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

      List<GratitudeEntryEntity> findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
          UUID createdBy, LocalDate startInclusive, LocalDate endInclusive);

      @Query("""
          select count(distinct e.occurredOn) from GratitudeEntryEntity e
          where e.createdBy = :userId and e.occurredOn <= :today and e.deletedFalse
          and e.occurredOn in (
              select e2.occurredOn from GratitudeEntryEntity e2
              where e2.createdBy = :userId and e2.deletedFalse
          )
          """)
      long countConsecutiveDays(UUID userId, LocalDate today);
  }
  ```

  **Streak logic decision — the `@Query` above is a simplification that counts all days with entries up to today, NOT consecutive days.** The correct approach uses a `ROW_NUMBER` window function to gap-and-island consecutive dates. Implement it as a native query in the repository:

  ```java
  @Query(value = """
      with gratitude_days as (
          select distinct occurred_on
          from gratitude_entry
          where created_by = ?1 and is_deleted = false
          order by occurred_on desc
      ),
      numbered as (
          select occurred_on,
                 row_number() over (order by occurred_on desc) as rn
          from gratitude_days
      ),
      groups as (
          select occurred_on,
                 date_sub(occurred_on, interval (rn - 1) day) as grp
          from numbered
      )
      select count(*) from groups
      where grp = (select min(grp) from groups)
      """, nativeQuery = true)
  long countStreak(UUID userId);
  ```

  This groups consecutive dates by subtracting a row-number offset; the group with the smallest group key is today's run.

- [ ] **Step 5: Write the failing persistence IT**

  Create `GratitudeEntryPersistenceIT.java` (extend `AbstractIntegrationTest`, same structure as `JournalEntryPersistenceIT`):

  ```java
  class GratitudeEntryPersistenceIT extends AbstractIntegrationTest {

      @Autowired private GratitudeEntryRepository repository;
      @Autowired private UserPopulator userPopulator;

      @Test
      void testGratitudeEntry_shouldPersistWithAllFields() {
          UUID owner = userPopulator.createUser().getId();
          var e = new GratitudeEntryEntity();
          e.setCreatedBy(owner);
          e.setOccurredOn(LocalDate.now());
          e.setText("Köszönöm a szép idő.");
          e.setLifeArea("mindfulness");
          var saved = repository.saveAndFlush(e);

          assertThat(saved.getId()).isNotNull();
          assertThat(saved.getText()).isEqualTo("Köszönöm a szép idő.");
          assertThat(saved.getLifeArea()).isEqualTo("mindfulness");
      }

      @Test
      void testGratitudeEntry_shouldPersistWithoutLifeArea() {
          UUID owner = userPopulator.createUser().getId();
          var e = new GratitudeEntryEntity();
          e.setCreatedBy(owner);
          e.setOccurredOn(LocalDate.now());
          e.setText("Köszönöm a kávét.");
          var saved = repository.saveAndFlush(e);

          assertThat(saved.getLifeArea()).isNull();
      }

      @Test
      void testGratitudeEntry_shouldRejectInvalidLifeArea() {
          UUID owner = userPopulator.createUser().getId();
          var e = new GratitudeEntryEntity();
          e.setCreatedBy(owner);
          e.setOccurredOn(LocalDate.now());
          e.setText("Valami.");
          e.setLifeArea("invalid_skill");

          assertThatThrownBy(() -> repository.saveAndFlush(e))
              .isInstanceOf(ConstraintViolationException.class);
      }

      @Test
      void testGratitudeEntry_shouldSoftDelete() {
          UUID owner = userPopulator.createUser().getId();
          var e = new GratitudeEntryEntity();
          e.setCreatedBy(owner);
          e.setOccurredOn(LocalDate.now());
          e.setText("Törlendő.");
          var saved = repository.saveAndFlush(e);

          repository.delete(saved);

          assertThat(repository.findById(saved.getId())).isEmpty();
          // Soft-deleted row still exists in the table (not in the soft-delete view)
      }

      @Test
      void testCountStreak_shouldReturnConsecutiveDays() {
          UUID owner = userPopulator.createUser().getId();
          LocalDate today = LocalDate.now();
          // 3 consecutive days: today, yesterday, day before
          for (int i = 0; i < 3; i++) {
              var e = new GratitudeEntryEntity();
              e.setCreatedBy(owner);
              e.setOccurredOn(today.minusDays(i));
              e.setText("Köszönöm " + i);
              repository.saveAndFlush(e);
          }
          // A gap, then another day
          var e = new GratitudeEntryEntity();
          e.setCreatedBy(owner);
          e.setOccurredOn(today.minusDays(5));
          e.setText("Régi.");
          repository.saveAndFlush(e);

          assertThat(repository.countStreak(owner)).isEqualTo(3);
      }

      @Test
      void testCountStreak_shouldReturnZero_whenNoEntries() {
          UUID owner = userPopulator.createUser().getId();
          assertThat(repository.countStreak(owner)).isZero();
      }
  }
  ```

- [ ] **Step 6: Run the IT and watch it fail, then pass**

  ```bash
  cd backend && docker compose up -d
  ./mvnw clean test -Dtest=GratitudeEntryPersistenceIT
  ```

  Fix any failures (constraint names, SQL syntax, etc.), re-run until green.

- [ ] **Step 7: Commit**

  ```bash
  cd /Users/mrkuhne/Applications/Personal/Mezo/mezo
  git add api/feature/journal/journal.yml backend/src/main/resources/db/changelog/ backend/src/main/java/io/mrkuhne/mezo/feature/journal/entity/GratitudeEntryEntity.java backend/src/main/java/io/mrkuhne/mezo/feature/journal/repository/GratitudeEntryRepository.java backend/src/test/java/io/mrkuhne/mezo/feature/journal/GratitudeEntryPersistenceIT.java
  git commit -m "feat(journal): gratitude_entry table + persistence (mezo-b3pp.3)"
  ```

### Task 2: GratitudeService + controller — CRUD + streak

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/GratitudeService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/GratitudeEntrySavedEvent.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/mapper/GratitudeMapper.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/controller/JournalController.java`
- Modify: `backend/src/main/resources/messages.properties`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/JournalPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`

- [ ] **Step 1: Add the message code**

  Append to `messages.properties`:

  ```properties
  GRATITUDE_ENTRY_NOT_FOUND=A hála bejegyzés nem található.
  ```

- [ ] **Step 2: Write the event, mapper, service and controller**

  Create `GratitudeEntrySavedEvent.java`:

  ```java
  package io.mrkuhne.mezo.feature.journal.service;

  import java.util.UUID;
  import org.springframework.context.ApplicationEvent;

  public class GratitudeEntrySavedEvent extends ApplicationEvent {
      private final UUID entryId;

      public GratitudeEntrySavedEvent(UUID entryId) {
          super(entryId);
          this.entryId = entryId;
      }

      public UUID getEntryId() {
          return entryId;
      }
  }
  ```

  Create `GratitudeMapper.java`:

  ```java
  package io.mrkuhne.mezo.feature.journal.mapper;

  import io.mrkuhne.mezo.api.dto.GratitudeEntryResponse;
  import io.mrkuhne.mezo.feature.journal.entity.GratitudeEntryEntity;
  import java.time.Instant;
  import java.time.OffsetDateTime;
  import java.time.ZoneOffset;
  import org.mapstruct.Mapper;
  import org.mapstruct.Mapping;

  @Mapper(componentModel = "spring")
  public interface GratitudeMapper {

      GratitudeEntryResponse toResponse(GratitudeEntryEntity e);

      default OffsetDateTime map(Instant instant) {
          return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
      }
  }
  ```

  Create `GratitudeService.java`:

  ```java
  package io.mrkuhne.mezo.feature.journal.service;

  import io.mrkuhne.mezo.api.dto.CreateGratitudeRequest;
  import io.mrkuhne.mezo.api.dto.GratitudeEntryResponse;
  import io.mrkuhne.mezo.feature.journal.entity.GratitudeEntryEntity;
  import io.mrkuhne.mezo.feature.journal.mapper.GratitudeMapper;
  import io.mrkuhne.mezo.feature.journal.repository.GratitudeEntryRepository;
  import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
  import io.mrkuhne.mezo.techcore.exception.SystemMessage;
  import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
  import java.time.LocalDate;
  import java.util.List;
  import java.util.UUID;
  import lombok.RequiredArgsConstructor;
  import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
  import org.springframework.context.ApplicationEventPublisher;
  import org.springframework.http.HttpStatus;
  import org.springframework.stereotype.Service;
  import org.springframework.transaction.annotation.Transactional;

  @Service
  @RequiredArgsConstructor
  @ConditionalOnProperty(name = FeaturesConfiguration.JOURNAL_SWITCH, havingValue = "true")
  public class GratitudeService {

      private final GratitudeEntryRepository repository;
      private final GratitudeMapper mapper;
      private final ApplicationEventPublisher eventPublisher;

      @Transactional
      public GratitudeEntryResponse create(UUID userId, CreateGratitudeRequest request) {
          GratitudeEntryEntity e = new GratitudeEntryEntity();
          e.setCreatedBy(userId);
          e.setOccurredOn(request.getOccurredOn() == null ? LocalDate.now() : request.getOccurredOn());
          e.setText(request.getText());
          e.setLifeArea(request.getLifeArea());
          GratitudeEntryEntity saved = repository.saveAndFlush(e);
          eventPublisher.publishEvent(new GratitudeEntrySavedEvent(saved.getId()));
          return mapper.toResponse(saved);
      }

      @Transactional(readOnly = true)
      public List<GratitudeEntryResponse> list(UUID userId, LocalDate from, LocalDate to) {
          return repository
              .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(userId, from, to)
              .stream().map(mapper::toResponse).toList();
      }

      @Transactional
      public void delete(UUID userId, UUID entryId) {
          findOwned(userId, entryId); // 404 check
          // Gratitude has no edit, so we just soft-delete by id.
          // We need to load the entity to apply @SQLDelete with ownership —
          // use a direct native soft-delete to avoid loading the full entity.
          repository.deleteBy... // see below
      }

      private GratitudeEntryEntity findOwned(UUID userId, UUID entryId) {
          return repository.findByIdAndCreatedByAndDeletedFalse(entryId, userId)
              .orElseThrow(() -> new SystemRuntimeErrorException(
                  SystemMessage.error("GRATITUDE_ENTRY_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
      }

      @Transactional(readOnly = true)
      public long countStreak(UUID userId) {
          return repository.countStreak(userId);
      }
  }
  ```

  **Correction on delete:** Since we don't load the entity (to avoid unnecessary overhead), we need a custom delete method. Update the repository:

  ```java
  @Modifying
  @Query("update GratitudeEntryEntity e set e.deleted = true where e.id = :id and e.createdBy = :userId")
  int softDeleteByIdAndCreatedBy(UUID id, UUID userId);
  ```

  And in the service:

  ```java
  @Transactional
  public void delete(UUID userId, UUID entryId) {
      findOwned(userId, entryId); // verify ownership + existence (404)
      int updated = repository.softDeleteByIdAndCreatedBy(entryId, userId);
      if (updated == 0) {
          throw new SystemRuntimeErrorException(
              SystemMessage.error("GRATITUDE_ENTRY_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
      }
  }
  ```

  Actually, the `findOwned` already verifies — if it passes, the entity exists and is not deleted. The subsequent `softDeleteByIdAndCreatedBy` will always find it. Simplify:

  ```java
  @Transactional
  public void delete(UUID userId, UUID entryId) {
      GratitudeEntryEntity e = findOwned(userId, entryId);
      repository.delete(e); // @SQLDelete → soft delete, same pattern as JournalService
  }
  ```

  This is simpler and consistent with the existing `JournalService.delete` pattern.

  Modify `JournalController.java` — add the gratitude methods:

  ```java
  // Gratitude (bd mezo-b3pp.3): bundled into JournalController alongside notes and decisions.
  @Override
  public GratitudeEntryResponse createGratitudeEntry(CreateGratitudeRequest createGratitudeRequest) {
      return gratitudeService.create(currentUserId.get(), createGratitudeRequest);
  }

  @Override
  public List<GratitudeEntryResponse> listGratitudeEntries(LocalDate from, LocalDate to) {
      return gratitudeService.list(currentUserId.get(), from, to);
  }

  @Override
  public void deleteGratitudeEntry(UUID id) {
      gratitudeService.delete(currentUserId.get(), id);
  }

  @Override
  public Long countGratitudeStreak() {
      return gratitudeService.countStreak(currentUserId.get());
  }
  ```

  Add `GratitudeService gratitudeService` as a constructor parameter.

- [ ] **Step 3: Extend the test scaffolding**

  Add `createGratitude` to `JournalPopulator.java`:

  ```java
  public GratitudeEntryEntity createGratitude(UUID createdBy, LocalDate occurredOn, String text, String lifeArea) {
      GratitudeEntryEntity e = new GratitudeEntryEntity();
      e.setCreatedBy(createdBy);
      e.setOccurredOn(occurredOn);
      e.setText(text);
      e.setLifeArea(lifeArea);
      return repository.save(e);
  }
  ```

  Add `gratitude_entry` to `ResetDatabase.java` TRUNCATE list.

- [ ] **Step 4: Write the failing HTTP contract IT**

  Create `GratitudeApiIT.java` (same structure as `JournalApiIT`):

  ```java
  class GratitudeApiIT extends ApiIntegrationTest {

      @Autowired private OwnerProperties ownerProperties;
      @Autowired private JournalPopulator journalPopulator;
      @Autowired private UserPopulator userPopulator;

      private UUID ownerId() {
          return databasePopulator.populateUser(ownerProperties.ownerEmail());
      }

      @Test
      void testCreateGratitudeEntry_shouldReturn201WithDefaultedDate_whenOccurredOnAbsent() {
          GratitudeEntryResponse created = postForBody("/api/journal/gratitude",
              CreateGratitudeRequest.builder().text("Köszönöm a napot.").lifeArea("mindfulness").build(),
              ownerAuthHeaders(), HttpStatus.CREATED, GratitudeEntryResponse.class);

          assertThat(created.getId()).isNotNull();
          assertThat(created.getOccurredOn()).isEqualTo(LocalDate.now());
          assertThat(created.getText()).isEqualTo("Köszönöm a napot.");
          assertThat(created.getLifeArea()).isEqualTo("mindfulness");
          assertThat(created.getCreatedAt()).isNotNull();
      }

      @Test
      void testCreateGratitudeEntry_shouldReturn400_whenTextBlank() {
          String body = postForBody("/api/journal/gratitude",
              CreateGratitudeRequest.builder().text("").lifeArea("mindset").build(),
              ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

          assertHasFieldError(body, "text", "VALIDATION_INVALID_VALUE");
      }

      @Test
      void testCreateGratitudeEntry_shouldReturn400_whenTextTooLong() {
          String longText = "x".repeat(281);
          String body = postForBody("/api/journal/gratitude",
              CreateGratitudeRequest.builder().text(longText).build(),
              ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

          assertHasFieldError(body, "text", "VALIDATION_INVALID_VALUE");
      }

      @Test
      void testCreateGratitudeEntry_shouldReturn400_whenLifeAreaInvalid() {
          String body = postForBody("/api/journal/gratitude",
              CreateGratitudeRequest.builder().text("Valami.").lifeArea("bogus").build(),
              ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

          assertHasFieldError(body, "lifeArea", "VALIDATION_INVALID_VALUE");
      }

      @Test
      void testCreateGratitudeEntry_shouldPersistWithoutLifeArea() {
          GratitudeEntryResponse created = postForBody("/api/journal/gratitude",
              CreateGratitudeRequest.builder().text("Köszönöm a kávét.").build(),
              ownerAuthHeaders(), HttpStatus.CREATED, GratitudeEntryResponse.class);

          assertThat(created.getLifeArea()).isNull();
      }

      @Test
      void testListGratitudeEntries_shouldReturnNewestFirstWithinRange_whenEntriesExist() {
          UUID owner = ownerId();
          journalPopulator.createGratitude(owner, LocalDate.parse("2026-08-10"),
              "Régi hála.", "cooking");
          journalPopulator.createGratitude(owner, LocalDate.parse("2026-08-15"),
              "Középső.", "connection");
          journalPopulator.createGratitude(owner, LocalDate.parse("2026-08-17"),
              "Legújabb.", "mindfulness");

          List<GratitudeEntryResponse> entries = getForList(
              "/api/journal/gratitude?from=2026-08-14&to=2026-08-18", ownerAuthHeaders(), HttpStatus.OK,
              GratitudeEntryResponse.class);

          assertThat(entries).hasSize(2);
          assertThat(entries).extracting(GratitudeEntryResponse::getText)
              .containsExactly("Legújabb.", "Középső.");
      }

      @Test
      void testDeleteGratitudeEntry_shouldSoftDeleteAndVanishFromList_whenExisting() {
          UUID owner = ownerId();
          GratitudeEntryEntity entry = journalPopulator.createGratitude(owner, LocalDate.now(),
              "Törlendő hála.", "learning");
          HttpHeaders auth = ownerAuthHeaders();

          deleteAndExpect("/api/journal/gratitude/" + entry.getId(), auth, HttpStatus.NO_CONTENT);

          List<GratitudeEntryResponse> entries = getForList(
              "/api/journal/gratitude?from=" + LocalDate.now() + "&to=" + LocalDate.now(), auth, HttpStatus.OK,
              GratitudeEntryResponse.class);
          assertThat(entries).extracting(GratitudeEntryResponse::getId).doesNotContain(entry.getId());
      }

      @Test
      void testDeleteGratitudeEntry_shouldReturn404_whenNotOwnEntry() {
          UUID otherUser = userPopulator.createUser().getId();
          GratitudeEntryEntity entry = journalPopulator.createGratitude(otherUser, LocalDate.now(),
              "Nem az enyém.", "mindset");

          String body = deleteAndExpect("/api/journal/gratitude/" + entry.getId(),
              ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

          assertHasRequestError(body, "GRATITUDE_ENTRY_NOT_FOUND");
      }

      @Test
      void testCountGratitudeStreak_shouldReturnConsecutiveDays() {
          UUID owner = ownerId();
          LocalDate today = LocalDate.now();
          for (int i = 0; i < 3; i++) {
              journalPopulator.createGratitude(owner, today.minusDays(i),
                  "Köszönöm " + i, null);
          }

          Long streak = getForBody("/api/journal/gratitude/streak",
              ownerAuthHeaders(), HttpStatus.OK, Long.class);

          assertThat(streak).isEqualTo(3);
      }

      @Test
      void testCountGratitudeStreak_shouldReturnZero_whenNoEntries() {
          Long streak = getForBody("/api/journal/gratitude/streak",
              ownerAuthHeaders(), HttpStatus.OK, Long.class);
          assertThat(streak).isZero();
      }
  }
  ```

- [ ] **Step 5: Run the IT to verify it passes**

  ```bash
  ./mvnw clean test -Dtest=GratitudeApiIT
  ```

  Fix failures, re-run until green.

- [ ] **Step 6: Extend the switch-off IT**

  Add a gratitude-404 assertion to the existing `JournalSwitchOffIT.java`:

  ```java
  @Test
  void testGratitudeSurface_should404_whenJournalSwitchOff() {
      // Asserted via the switch-off profile — the generated JournalApi methods for gratitude
      // are absent, so any /api/journal/gratitude* call returns 404.
      // Reuse the existing switch-off mechanism.
  }
  ```

  Actually, since the whole `JournalController` is gated on `JOURNAL_SWITCH`, the switch-off IT already covers gratitude (404 for every endpoint). No additional test needed — the existing `JournalSwitchOffIT` implicitly covers this.

- [ ] **Step 7: Run the switch-off IT**

  ```bash
  ./mvnw clean test -Dtest=JournalSwitchOffIT
  ```

- [ ] **Step 8: Commit**

  ```bash
  git add backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/GratitudeService.java \
    backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/GratitudeEntrySavedEvent.java \
    backend/src/main/java/io/mrkuhne/mezo/feature/journal/mapper/GratitudeMapper.java \
    backend/src/main/java/io/mrkuhne/mezo/feature/journal/controller/JournalController.java \
    backend/src/main/resources/messages.properties \
    backend/src/test/java/io/mrkuhne/mezo/feature/journal/GratitudeApiIT.java \
    backend/src/test/java/io/mrkuhne/mezo/support/populator/JournalPopulator.java \
    backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java
  git commit -m "feat(journal): GratitudeService + controller + CRUD ITs (mezo-b3pp.3)"
  ```

### Task 3: Embed the gratitude entry into memory

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/GratitudeEmbeddingListener.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java`

- [ ] **Step 1: Write the failing embed IT**

  Create `GratitudeEmbeddingEventIT.java` (same pattern as `JournalEmbeddingEventIT`):

  ```java
  @ActiveProfiles("companion-fake")
  class GratitudeEmbeddingEventIT extends ApiIntegrationTest {

      @Autowired private OwnerProperties ownerProperties;
      @Autowired private JournalPopulator journalPopulator;
      @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;

      private UUID ownerId() {
          return databasePopulator.populateUser(ownerProperties.ownerEmail());
      }

      @Test
      void testCreateGratitudeEntry_shouldProduceExactlyOneEmbedding_whenCompanionOn() throws InterruptedException {
          HttpHeaders auth = ownerAuthHeaders();
          postForBody("/api/journal/gratitude",
              CreateGratitudeRequest.builder().text("Köszönöm a reggeli sétát.").lifeArea("recovery").build(),
              auth, HttpStatus.CREATED, GratitudeEntryResponse.class);

          await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> {
              List<MemoryEmbeddingEntity> embeddings = memoryEmbeddingRepository
                  .findByKindAndCreatedBy(MemoryEmbeddingEntity.KIND GRATITUDE, ownerId());
              assertThat(embeddings).hasSize(1);
              assertThat(embeddings.get(0).getKind()).isEqualTo(MemoryEmbeddingEntity.KIND GRATITUDE);
          });
      }

      @Test
      void testDeleteGratitudeEntry_shouldRemoveEmbedding_whenCompanionOn() throws InterruptedException {
          UUID owner = ownerId();
          GratitudeEntryEntity entry = journalPopulator.createGratitude(owner, LocalDate.now(),
              "Törlendő hála.", null);
          HttpHeaders auth = ownerAuthHeaders();

          // First, trigger the embed by creating via API
          postForBody("/api/journal/gratitude",
              CreateGratitudeRequest.builder().text("Először létrehozva.").build(),
              auth, HttpStatus.CREATED, GratitudeEntryResponse.class);

          await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> {
              assertThat(memoryEmbeddingRepository
                  .findByKindAndCreatedBy(MemoryEmbeddingEntity.KIND GRATITUDE, ownerId()))
                  .hasSize(1);
          });

          // Now delete
          deleteAndExpect("/api/journal/gratitude/" + entry.getId(), auth, HttpStatus.NO_CONTENT);

          await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> {
              // The just-created entry's embed should also be gone if the delete triggers cleanup
              // Actually, delete only removes the specific entry's embed — we need a separate test.
          });
      }
  }
  ```

  **Correction:** The `GratitudeEmbeddingEventIT` should mirror `JournalEmbeddingEventIT` exactly: create via API → await embed row; the delete case is covered by the listener's `onGratitudeEntryDeleted` handler. Let me simplify to match the actual pattern:

  ```java
  @ActiveProfiles("companion-fake")
  class GratitudeEmbeddingEventIT extends ApiIntegrationTest {

      @Autowired private OwnerProperties ownerProperties;
      @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;

      private UUID ownerId() {
          return databasePopulator.populateUser(ownerProperties.ownerEmail());
      }

      @Test
      void testCreateGratitudeEntry_shouldProduceExactlyOneEmbedding_whenCompanionOn() throws InterruptedException {
          HttpHeaders auth = ownerAuthHeaders();
          postForBody("/api/journal/gratitude",
              CreateGratitudeRequest.builder().text("Köszönöm a reggeli sétát.").lifeArea("recovery").build(),
              auth, HttpStatus.CREATED, GratitudeEntryResponse.class);

          await().atMost(5, TimeUnit.SECONDS).untilAsserted(() -> {
              List<MemoryEmbeddingEntity> embeddings = memoryEmbeddingRepository
                  .findByKindAndCreatedBy(MemoryEmbeddingEntity.KIND GRATITUDE, ownerId());
              assertThat(embeddings).hasSize(1);
              assertThat(embeddings.get(0).getKind()).isEqualTo(MemoryEmbeddingEntity.KIND GRATITUDE);
              assertThat(embeddings.get(0).getContent()).isEqualTo("Köszönöm a reggeli sétát.");
          });
      }
  }
  ```

- [ ] **Step 2: Run it to verify it fails**

  ```bash
  ./mvnw clean test -Dtest=GratitudeEmbeddingEventIT
  ```

  Expect: listener bean absent → no embed row.

- [ ] **Step 3: Add the kind constant and the writer method**

  Add `KIND GRATITUDE` constant to `MemoryEmbeddingEntity.java`:

  ```java
  public static final String KIND GRATITUDE = "gratitude";
  ```

  Add `writeGratitude` method to `MemoryEmbeddingWriter.java`:

  ```java
  /** W1.3 gratitude unit (spec §5.3): short texts carry disproportionate emotional signal.
   *  Same in-place re-embed pattern as writeJournal/writeDecision. */
  @Transactional
  public void writeGratitude(GratitudeEntryEntity entry) {
      memoryEmbeddingRepository
          .findByKindAndRefId(MemoryEmbeddingEntity.KIND GRATITUDE, entry.getId())
          .ifPresentOrElse(existing -> {
              String capped = cap(entry.getText());
              float[] vector = llmCallContextHolder.runWith(
                      new LlmCallContext("embed_memory", "document",
                              MemoryEmbeddingEntity.KIND GRATITUDE, entry.getId()),
                      () -> embeddingPort.embedDocuments(List.of(capped))).getFirst();
              existing.setContent(capped);
              existing.setEmbedding(vector);
              existing.setOccurredOn(entry.getOccurredOn());
              memoryEmbeddingRepository.saveAndFlush(existing);
          }, () -> write(entry.getCreatedBy(), MemoryEmbeddingEntity.KIND GRATITUDE,
                  entry.getId(), entry.getText(), entry.getOccurredOn()));
  }
  ```

  Add `deleteGratitudeEmbedding` method:

  ```java
  @Transactional
  public void deleteGratitudeEmbedding(UUID entryId) {
      memoryEmbeddingRepository
          .findByKindAndRefId(MemoryEmbeddingEntity.KIND GRATITUDE, entryId)
          .ifPresent(memoryEmbeddingRepository::delete);
  }
  ```

  Add import for `GratitudeEntryEntity`.

- [ ] **Step 4: Write the listener**

  Create `GratitudeEmbeddingListener.java`:

  ```java
  package io.mrkuhne.mezo.feature.companion.embedding;

  import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
  import io.mrkuhne.mezo.feature.journal.entity.GratitudeEntryEntity;
  import io.mrkuhne.mezo.feature.journal.repository.GratitudeEntryRepository;
  import io.mrkuhne.mezo.feature.journal.service.GratitudeEntryDeletedEvent;
  import io.mrkuhne.mezo.feature.journal.service.GratitudeEntrySavedEvent;
  import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
  import lombok.RequiredArgsConstructor;
  import lombok.extern.slf4j.Slf4j;
  import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
  import org.springframework.context.event.EventListener;
  import org.springframework.scheduling.annotation.Async;
  import org.springframework.stereotype.Component;
  import org.springframework.transaction.event.TransactionalEventListener;

  /** After a gratitude entry create/update/delete commits, keep its {@code memory_embedding} vector
   *  in sync. Gated on both {@code COMPANION SWITCH} and {@code JOURNAL SWITCH}.
   *
   *  <p>Same fire-and-forget idiom as {@code JournalEmbeddingListener}: the listener runs
   *  {@code @Async} + {@code @TransactionalEventListener(phase = AFTER_COMMIT)}, so a gratitude
   *  write's latency and success are completely unaffected by whether the embed call succeeds.
   *  Failures are logged and swallowed.
   */
  @Slf4j
  @Component
  @RequiredArgsConstructor
  @ConditionalOnProperty(name = FeaturesConfiguration.COMPANION SWITCH, havingValue = "true")
  @ConditionalOnProperty(name = FeaturesConfiguration.JOURNAL SWITCH, havingValue = "true")
  public class GratitudeEmbeddingListener {

      private final GratitudeEntryRepository gratitudeEntryRepository;
      private final MemoryEmbeddingWriter memoryEmbeddingWriter;

      @Async
      @TransactionalEventListener(phase = TransactionalEventListener Phase AFTER_COMMIT)
      public void onGratitudeEntrySaved(GratitudeEntrySavedEvent event) {
          gratitudeEntryRepository.findById(event.getEntryId()).ifPresent(entry -> {
              try {
                  memoryEmbeddingWriter.writeGratitude(entry);
              } catch (Exception ex) {
                  log.warn("Failed to embed gratitude entry {}", entry.getId(), ex);
              }
          });
      }

      @Async
      @TransactionalEventListener(phase = TransactionalEventListener Phase AFTER_COMMIT)
      public void onGratitudeEntryDeleted(GratitudeEntryDeletedEvent event) {
          memoryEmbeddingWriter.deleteGratitudeEmbedding(event.getEntryId());
      }
  }
  ```

  **Correction:** Need to create `GratitudeEntryDeletedEvent` too (the delete path). Create it in `feature/journal/service/`:

  ```java
  package io.mrkuhne.mezo.feature.journal.service;

  import java.util.UUID;
  import org.springframework.context.ApplicationEvent;

  public class GratitudeEntryDeletedEvent extends ApplicationEvent {
      private final UUID entryId;

      public GratitudeEntryDeletedEvent(UUID entryId) {
          super(entryId);
          this.entryId = entryId;
      }

      public UUID getEntryId() {
          return entryId;
      }
  }
  ```

  And publish it from `GratitudeService.delete()`:

  ```java
  @Transactional
  public void delete(UUID userId, UUID entryId) {
      GratitudeEntryEntity e = findOwned(userId, entryId);
      repository.delete(e);
      eventPublisher.publishEvent(new GratitudeEntryDeletedEvent(e.getId()));
  }
  ```

- [ ] **Step 5: Run the IT to verify it passes**

  ```bash
  ./mvnw clean test -Dtest=GratitudeEmbeddingEventIT
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/GratitudeEmbeddingListener.java \
    backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java \
    backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryEmbeddingEntity.java \
    backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/GratitudeEntryDeletedEvent.java \
    backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/GratitudeService.java \
    backend/src/test/java/io/mrkuhne/mezo/feature/journal/GratitudeEmbeddingEventIT.java
  git commit -m "feat(journal): gratitude embedding listener + writer (mezo-b3pp.3)"
  ```

### Task 4: Frontend data layer for gratitude

**Files:**
- Create: `frontend/src/data/journal/gratitudeTypes.ts`
- Create: `frontend/src/data/journal/gratitudeApi.ts`
- Create: `frontend/src/data/journal/gratitudeHooks.ts`
- Create: `frontend/src/data/journal/gratitudeMock.ts`
- Create: `frontend/src/data/journal/gratitudeHooks.test.tsx`
- Modify: `frontend/src/data/hooks.ts`

- [ ] **Step 1: Write the types and API client**

  Create `gratitudeTypes.ts`:

  ```ts
  import type { GratitudeEntryResponse } from '@/data/_client/api.gen'

  export interface GratitudeEntry {
    id: string
    occurredOn: string
    text: string
    lifeArea: string | null
    createdAt: string
  }

  export function toGratitudeEntry(r: GratitudeEntryResponse): GratitudeEntry {
    return {
      id: r.id,
      occurredOn: r.occurredOn,
      text: r.text,
      lifeArea: r.lifeArea ?? null,
      createdAt: r.createdAt,
    }
  }
  ```

  Create `gratitudeApi.ts`:

  ```ts
  import { api } from '@/data/_client/api.gen'
  import { toGratitudeEntry } from './gratitudeTypes'
  import type { GratitudeEntry, CreateGratitudeInput } from './gratitudeTypes'

  export async function listGratitudeEntries(from: string, to: string): Promise<GratitudeEntry[]> {
    const res = await api.paths['/api/journal/gratitude'].get({ query: { from, to } })
    if (!res.ok) return []
    return (res.data as GratitudeEntryResponse[]).map(toGratitudeEntry)
  }

  export async function createGratitudeEntry(text: string, occurredOn?: string, lifeArea?: string): Promise<GratitudeEntry> {
    const res = await api.paths['/api/journal/gratitude'].post({
      body: { text, occurredOn, lifeArea: lifeArea || undefined },
    })
    if (!res.ok) throw new Error('Failed to create gratitude entry')
    return toGratitudeEntry(res.data as GratitudeEntryResponse)
  }

  export async function deleteGratitudeEntry(id: string): Promise<void> {
    const res = await api.paths['/api/journal/gratitude/{id}'].delete({ param: { id } })
    if (!res.ok && res.status !== 204) throw new Error('Failed to delete gratitude entry')
  }

  export async function getGratitudeStreak(): Promise<number> {
    const res = await api.paths['/api/journal/gratitude/streak'].get()
    if (!res.ok) return 0
    return res.data as number
  }
  ```

- [ ] **Step 2: Write the hooks**

  Create `gratitudeHooks.ts`:

  ```ts
  import { useDualQuery, useMutationWithInvalidate } from '@/data/hooks'
  import * as gratitudeApi from './gratitudeApi'
  import type { GratitudeEntry } from './gratitudeTypes'
  import { mockGratitudeEntries } from './gratitudeMock'

  export function useGratitudeEntries(from: string, to: string) {
    return useDualQuery<GratitudeEntry[]>(
      ['gratitude', from, to],
      () => gratitudeApi.listGratitudeEntries(from, to),
      { staleTime: Infinity },
      mockGratitudeEntries,
    )
  }

  export function useGratitudeActions() {
    const { mutateAsync: add, ...rest } = useMutationWithInvalidate(
      ['gratitude'],
      (input: { text: string; occurredOn?: string; lifeArea?: string }) =>
        gratitudeApi.createGratitudeEntry(input.text, input.occurredOn, input.lifeArea),
    )

    const { mutateAsync: remove, ...restDel } = useMutationWithInvalidate(
      ['gratitude'],
      gratitudeApi.deleteGratitudeEntry,
    )

    return {
      addGratitude: add,
      removeGratitude: remove,
      ...rest,
      ...restDel,
    }
  }

  export function useGratitudeStreak() {
    return useDualQuery<number>(
      ['gratitudeStreak'],
      gratitudeApi.getGratitudeStreak,
      { staleTime: 5 * 60 * 1000 },
      () => 0,
    )
  }
  ```

- [ ] **Step 3: Write the mock seed**

  Create `gratitudeMock.ts`:

  ```ts
  import type { GratitudeEntry } from './gratitudeTypes'

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]

  export const mockGratitudeEntries: GratitudeEntry[] = [
    { id: '1', occurredOn: today, text: 'Köszönöm a szép idő.', lifeArea: 'mindfulness', createdAt: new Date().toISOString() },
    { id: '2', occurredOn: yesterday, text: 'Köszönöm a barátaimat.', lifeArea: 'connection', createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: '3', occurredOn: twoDaysAgo, text: 'Köszönöm a kávét.', lifeArea: null, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  ]
  ```

- [ ] **Step 4: Write the hook tests**

  Create `gratitudeHooks.test.tsx` — dual-mode read + write, streak.

- [ ] **Step 5: Re-export from barrel**

  Modify `frontend/src/data/hooks.ts` — add gratitude re-exports.

- [ ] **Step 6: Run FE tests**

  ```bash
  cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add frontend/src/data/journal/gratitudeTypes.ts frontend/src/data/journal/gratitudeApi.ts \
    frontend/src/data/journal/gratitudeHooks.ts frontend/src/data/journal/gratitudeMock.ts \
    frontend/src/data/journal/gratitudeHooks.test.tsx frontend/src/data/hooks.ts
  git commit -m "feat(journal): gratitude frontend data layer + hooks (mezo-b3pp.3)"
  ```

### Task 5: FE — GratitudeInputRow + RitualPage integration

**Files:**
- Create: `frontend/src/features/ritual/components/GratitudeInputRow.tsx`
- Create: `frontend/src/features/ritual/components/GratitudeInputRow.test.tsx`
- Modify: `frontend/src/features/ritual/pages/RitualPage.tsx`

- [ ] **Step 1: Write the single-row component**

  Create `GratitudeInputRow.tsx`:

  ```tsx
  import { useState } from 'react'
  import { cn } from '@/shared/lib/cn'

  const LIFE_AREA_OPTIONS = [
    { key: 'mindfulness', label: 'Bölcsesség' },
    { key: 'mindset', label: 'Attitűd' },
    { key: 'cooking', label: 'Főzés' },
    { key: 'financial', label: 'Pénzügy' },
    { key: 'productivity', label: 'Eredmény' },
    { key: 'learning', label: 'Tanulás' },
    { key: 'connection', label: 'Kapcsolat' },
    { key: 'recovery', label: 'Regeneráció' },
  ] as const

  interface GratitudeInputRowProps {
    index: number
    text: string
    lifeArea: string | null
    onChange: (text: string) => void
    onLifeAreaChange: (lifeArea: string | null) => void
    onRemove?: () => void
    canRemove: boolean
  }

  export function GratitudeInputRow({
    index, text, lifeArea, onChange, onLifeAreaChange, onRemove, canRemove,
  }: GratitudeInputRowProps) {
    const [showChips, setShowChips] = useState(false)

    return (
      <div className="col gap-xs">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-secondary" style={{ fontSize: 12 }}>
            {index + 1}. Hála
          </span>
          {canRemove && onRemove && (
            <button className="chip" style={{ padding: '4px 6px', fontSize: 11 }} onClick={onRemove}>
              ×
            </button>
          )}
        </div>
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Köszönöm, hogy …`}
          rows={2}
          style={{
            width: '100%', fontSize: 14, padding: '8px 10px',
            background: 'var(--surface-1)', border: '1px solid var(--border)',
            borderRadius: 8, resize: 'none', color: 'var(--text-primary)',
          }}
        />
        <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="chip"
            style={{ fontSize: 11, padding: '3px 8px' }}
            onClick={() => setShowChips(!showChips)}
          >
            {lifeArea ? LIFE_AREA_OPTIONS.find(o => o.key === lifeArea)?.label : 'Szegmens'}
          </button>
          {showChips && LIFE_AREA_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              className={cn('chip', lifeArea === opt.key && 'chip-active')}
              style={{ fontSize: 11, padding: '3px 8px' }}
              onClick={() => { onLifeAreaChange(opt.key); setShowChips(false) }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Write the row tests**

  Create `GratitudeInputRow.test.tsx` — renders textarea, chip toggle, life area selection, remove button.

- [ ] **Step 3: Integrate into RitualPage**

  Modify `RitualPage.tsx` — the spec says the gratitude half of `ReflectionStep` renders up to 3 rows. Since there is no `ReflectionStep` component yet (W1.2 creates it), we need to **add the gratitude rows directly to the RitualPage's act 4 (Harvest) area** — the spec says "the gratitude half of `ReflectionStep` (up to 3 rows, life-area chip from the 8 LIFE skills); also reachable in `JournalSheet` as a mode toggle."

  The spec says W1.2 (W1.2 Evening prose reflection in Napzárás) creates the `ReflectionStep` component, and W1.3 adds the gratitude half to it. Since W1.2 is still `IN_PROGRESS` (mezo-b3pp.2), we have two options:

  1. **Defer the ritual integration** until W1.2 lands — W1.3 only does the backend + JournalSheet mode toggle + streak card.
  2. **Add the gratitude rows directly to RitualPage** now, with a switch guard (`mezo.feature.journal.enabled`), so the ritual surface is ready when W1.2's prose textarea arrives.

  **Decision: Option 2.** Add the gratitude rows directly to RitualPage's act 4 area, gate them on `JOURNAL_SWITCH`, and keep them empty/degraded when the journal feature is off. This matches IDENT-3 (honest degraded state). The rows capture to the backend API immediately — no dependency on W1.2's prose textarea.

  Modify `RitualPage.tsx`:

  ```tsx
  // Add imports
  import { GratitudeInputRow } from '@/features/ritual/components/GratitudeInputRow'
  import { useGratitudeActions } from '@/data/hooks'
  import { localDateString } from '@/shared/lib/dates'

  // In the component, add gratitude state
  const [gratitudeRows, setGratitudeRows] = useState<Array<{ text: string; lifeArea: string | null }>>([
    { text: '', lifeArea: null },
  ])
  const { addGratitude, pending: gratitudePending } = useGratitudeActions()
  const date = localDateString()

  // In act 4 (HarvestStep), before the close fires, save gratitude rows
  // The close effect already fires when act === 4 && !closedRef.current.
  // We need to save gratitude rows BEFORE the close, so we add a pre-close effect:

  const [savingGratitude, setSavingGratitude] = useState(false)

  useEffect(() => {
    if (act === 4 && !closedRef.current && gratitudeRows.some(r => r.text.trim())) {
      // Save non-empty rows before close
      setSavingGratitude(true)
      Promise.all(
        gratitudeRows
          .filter(r => r.text.trim())
          .map(r => addGratitude({ text: r.text.trim(), occurredOn: date, lifeArea: r.lifeArea }))
      ).finally(() => setSavingGratitude(false))
    }
  }, [act, gratitudeRows, addGratitude, date])
  ```

  Actually, this is getting complex. Let me reconsider the approach. The spec says gratitude is captured in the ritual as part of the reflection act. Since W1.2 creates the `ReflectionStep` component, and W1.3 adds gratitude rows to it, the cleanest approach is:

  **Decision revised: Add the gratitude rows to RitualPage's act 4 area (between DayStory and Harvest), not inside a ReflectionStep.** This gives us a dedicated "Hála" section in the evening ritual that exists independently of the prose reflection. The rows are saved on close (alongside the ritual close), and the FE captures them directly.

  Modify `RitualPage.tsx`:

  ```tsx
  // After act 3 (LoopsStep) and before act 4 (HarvestStep), insert the gratitude section:
  {act === 3.5 && (
    <div className="rz-slide">
      <div className="rz-top">
        <div className="rz-dots" aria-hidden="true">
          {Array.from({ length: ACT_COUNT }, (_, i) => (
            <span key={i} className={i < act ? 'rz-dot on' : 'rz-dot'} />
          ))}
        </div>
        <button className="rz-exit" aria-label="Kilépés" onClick={() => navigate('/today')}>✕</button>
      </div>
      <div className="rz-body" style={{ padding: '20px 16px' }}>
        <h2 className="h3" style={{ marginBottom: 16 }}>Miben vagy hálás?</h2>
        <p className="text-secondary" style={{ marginBottom: 20, fontSize: 14 }}>
          1–3 dolog, amiért ma hálás lehetsz.
        </p>
        <div className="col gap-md">
          {gratitudeRows.map((row, i) => (
            <GratitudeInputRow
              key={i}
              index={i}
              text={row.text}
              lifeArea={row.lifeArea}
              onChange={(text) => setGratitudeRows(prev => prev.map((r, j) => j === i ? { ...r, text } : r))}
              onLifeAreaChange={(lifeArea) => setGratitudeRows(prev => prev.map((r, j) => j === i ? { ...r, lifeArea } : r))}
              onRemove={i > 0 ? () => setGratitudeRows(prev => prev.filter((_, j) => j !== i)) : undefined}
              canRemove={i > 0}
            />
          ))}
          {gratitudeRows.length < 3 && (
            <button
              className="cta-ghost"
              onClick={() => setGratitudeRows(prev => [...prev, { text: '', lifeArea: null }])}
            >
              + További hála
            </button>
          )}
        </div>
        <div className="row gap-sm mt-lg" style={{ justifyContent: 'flex-end' }}>
          <button className="cta-primary" onClick={() => setAct(4)}>Tovább</button>
        </div>
      </div>
    </div>
  )}
  ```

  **Wait — this changes ACT_COUNT from 5 to 6, which is what the spec says ("ACT_COUNT 5→6").** But the spec says this change is part of W1.2's "combined writing act" (decision + prose + gratitude). Since W1.2 is still in progress, let me check if the RitualPage already has `ACT_COUNT` modified or if it's still 5.

  Looking at the current RitualPage code: `const ACT_COUNT = 5`. W1.2 hasn't landed yet. So W1.3 should **NOT change ACT_COUNT** — that's W1.2's job. Instead, W1.3 should render the gratitude rows **inside the existing act 4 (HarvestStep)** area, or as a separate sheet/modal that the HarvestStep opens.

  **Decision final: Render gratitude rows as a pre-close overlay in the HarvestStep.** The HarvestStep currently shows the day recap + close button. We add a "Hála" section above the close button. The rows are saved when the user taps "Close" (alongside the ritual close). This keeps ACT_COUNT at 5 and doesn't depend on W1.2.

  Actually, re-reading the spec more carefully:

  > **FE:** the gratitude half of `ReflectionStep` (up to 3 rows, life-area chip from the 8 LIFE skills); also reachable in `JournalSheet` as a mode toggle. Me/Napló gets a small streak card.

  The spec says "the gratitude half of `ReflectionStep`" — meaning the gratitude rows are part of the `ReflectionStep` component that W1.2 creates. The spec also says "also reachable in `JournalSheet` as a mode toggle."

  Since W1.2 (`mezo-b3pp.2`) is still `IN_PROGRESS` and W1.3 depends on it, the correct approach is:

  **W1.3 adds the gratitude rows to RitualPage as a standalone section (not inside ReflectionStep), with a note that they will be merged into ReflectionStep when W1.2 lands.** The rows are saved on ritual close. This keeps the slice self-contained and working independently.

  Let me update the plan step:

  Modify `RitualPage.tsx` — add a gratitude capture section between act 3 and act 4:

  The gratitude section is a new "act 3.5" that the user progresses through before reaching Harvest. It renders up to 3 rows, saves them on the "Tovább" button, and carries the saved rows into act 4 where they are persisted on close.

  Actually, the simplest approach: **save gratitude rows on ritual close**, alongside the ritual close call. The rows are captured in a new section that appears in act 3 (after LoopsStep, before the user advances to Harvest). This keeps the flow clean.

  Let me simplify: Add the gratitude section as a new act between 3 and 4. `ACT_COUNT` stays 5 because the dots are rendered as `ACT_COUNT` (the spec's 5→6 is W1.2's change). W1.3 renders gratitude as a **slide within the existing act count** — the dots don't change.

  **Final approach:** Add gratitude rows to the HarvestStep (act 4) as a section above the close button. The HarvestStep already renders the recap + close. We add a "Hála" section that collects 1–3 rows, saved when the close fires. This is the simplest, most contained change.

  I'll write this in the actual implementation. For the plan, the steps are:

- [ ] **Step 1: Write the GratitudeInputRow component** (same as above).

- [ ] **Step 2: Write the row tests.**

- [ ] **Step 3: Integrate gratitude rows into RitualPage.**

  Add to `RitualPage.tsx`:
  - Import `GratitudeInputRow`, `useGratitudeActions`, `localDateString`.
  - Add state: `gratitudeRows` (array of `{ text, lifeArea }`), max 3.
  - Render gratitude rows **after the recap content and before the close button** in act 4.
  - On close, save all non-empty rows via `addGratitude` (with `occurredOn = today`).
  - Gate the entire section on `mezo.feature.journal.enabled` — when off, the section is not rendered (IDENT-3: honest degraded).

  The close effect needs to be updated to save gratitude rows before calling `close()`:

  ```tsx
  // Replace the existing act-4 close effect with one that also saves gratitude:
  useEffect(() => {
    if (act === 4 && !closedRef.current) {
      closedRef.current = true

      // Save gratitude rows first
      const gratitudePromises = gratitudeRows
        .filter(r => r.text.trim())
        .map(r => addGratitude({ text: r.text.trim(), occurredOn: date, lifeArea: r.lifeArea }).catch(() => null))

      Promise.all(gratitudePromises).then(() => {
        close(needsPending ? undefined : ringsOf(states))
      })
    }
  }, [act, close, consumeLevelUps, needsPending, states, gratitudeRows, addGratitude, date])
  ```

- [ ] **Step 4: Run FE tests + build.**

- [ ] **Step 5: Commit.**

### Task 6: FE — JournalSheet "Hálás" mode toggle

**Files:**
- Modify: `frontend/src/features/me/sheets/JournalSheet.tsx`

- [ ] **Step 1: Add the "Hálás" mode toggle**

  Modify `JournalSheet.tsx` — add `'grateful'` as a third mode alongside `'note'` and `'decision'`:

  ```tsx
  type Mode = 'note' | 'decision' | 'grateful'
  ```

  Add a third chip in the mode toggle section:

  ```tsx
  <button
    type="button"
    className="chip"
    aria-pressed={mode === 'grateful'}
    onClick={() => setMode('grateful')}
  >
    Hálás
  </button>
  ```

  In the textarea placeholder and title, handle `'grateful'` mode:
  - Title: "Miben vagy hálás?"
  - Placeholder: "Köszönöm, hogy …"

  In the `save` function, route `'grateful'` mode to `addGratitude`:

  ```tsx
  const { addGratitude } = useGratitudeActions()

  const save = (close: () => void) => {
    if (!text.trim() || busy) return
    if (mode === 'grateful') {
      void addGratitude({ text: text.trim(), occurredOn: date }).then(close)
      return
    }
    // ... existing note/decision logic
  }
  ```

  The "Hálás" mode does NOT show a date picker — gratitude is always for today (the ritual captures it for today, and the JournalSheet is a quick-capture surface). Actually, the spec says `occurredOn?` is optional on the API, defaulting to today. Let me keep the date picker for consistency with the other modes, but default it to today.

- [ ] **Step 2: Write the JournalSheet test update**

  Add a test for the "Hálás" mode toggle and save path in `JournalSheet.test.tsx`.

- [ ] **Step 3: Run FE tests.**

- [ ] **Step 4: Commit.**

### Task 7: FE — GratitudeStreakCard on /me/naplo

**Files:**
- Create: `frontend/src/features/me/components/GratitudeStreakCard.tsx`
- Create: `frontend/src/features/me/components/GratitudeStreakCard.test.tsx`
- Modify: `frontend/src/features/me/pages/JournalPage.tsx`

- [ ] **Step 1: Write the streak card component**

  Create `GratitudeStreakCard.tsx`:

  ```tsx
  import { useGratitudeStreak } from '@/data/hooks'
  import { Icon } from '@/shared/ui/Icon'

  export function GratitudeStreakCard() {
    const { data: streak, isPending } = useGratitudeStreak()

    if (isPending || streak === 0) return null

    return (
      <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon name="flame" size={18} style={{ color: 'var(--amber)' }} />
        <div>
          <span className="eyebrow" style={{ fontSize: 11 }}>Hálanapló</span>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {streak} napos sorozat
          </div>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Write the streak card tests**

  Create `GratitudeStreakCard.test.tsx` — renders when streak > 0, hidden when 0 or pending.

- [ ] **Step 3: Integrate into JournalPage**

  Modify `JournalPage.tsx` — import and render `GratitudeStreakCard` at the top of the page, above the month-grouped entries list.

- [ ] **Step 4: Run FE tests.**

- [ ] **Step 5: Commit.**

### Task 8: FE — QuickInputSheet "Hálás" tile

**Files:**
- Modify: `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx`

- [ ] **Step 1: Extend the naplo-pick phase to include "Hálás"**

  The current `naplo-pick` phase shows two tiles: "✍️ Aktivitás" and "📓 Napló". W1.3 adds a third tile: "🙏 Hálás" that opens `JournalSheet` in `'grateful'` mode.

  However, `JournalSheet` currently takes an `entry` prop for edit mode and a `mode` is internal `useState`. To support opening in `'grateful'` mode from QuickInput, we need to add a `mode` prop to `JournalSheet`:

  ```tsx
  interface JournalSheetProps {
    onClose: () => void
    entry?: JournalNote | null
    mode?: 'note' | 'decision' | 'grateful'
  }
  ```

  Then in `QuickInputSheet.tsx`:

  ```tsx
  // Add 'grateful' to the Phase type
  type Phase = 'menu' | 'sleep' | 'naplo-pick' | 'aktivitas' | 'journal' | 'checkin' | 'grateful'

  // Add the grateful sheet rendering
  if (phase === 'grateful') return <JournalSheet onClose={onClose} mode="grateful" />

  // Add the tile in the naplo-pick phase
  <Tile emoji="🙏" label="Hálás"
    onClick={() => setPhase('grateful')} />
  ```

  Actually, looking at the current `naplo-pick` phase, it already has two tiles. Adding a third makes it a three-option picker. The spec says "also reachable in `JournalSheet` as a mode toggle" — the QuickInput path is the primary capture surface for gratitude (alongside the ritual).

- [ ] **Step 2: Write the QuickInputSheet test update**

  Add a test for the "Hálás" tile in the `naplo-pick` phase in `QuickInputSheet.test.tsx`.

- [ ] **Step 3: Run FE tests + build.**

- [ ] **Step 4: Commit.**

### Task 9: Docs + lint

**Files:**
- Modify: `docs/features/journal.md`
- Modify: `docs/features/me.md`
- Run: `node scripts/lint-docs.mjs`

- [ ] **Step 1: Update `docs/features/journal.md`**

  Add a new "Gratitude entries" section (§4 Data model & API, §3 Architecture & data flow, §5 Integrations, §10 Key files):
  - `gratitude_entry` table schema
  - API endpoints (POST/GET/DELETE/STREAK)
  - `GratitudeService`, `GratitudeEntryEntity`, `GratitudeEmbeddingListener`
  - Embed `kind=gratitude` seam
  - Frontend hooks + types

- [ ] **Step 2: Update `docs/features/me.md`**

  Add the gratitude streak card to the `/me/naplo` surface description.

- [ ] **Step 3: Run the doc linter**

  ```bash
  node scripts/lint-docs.mjs
  ```

  Fix any staleness flags.

- [ ] **Step 4: Commit.**

---

## Self-check against the spec

| Spec requirement | Task |
|---|---|
| `gratitude_entry` table (§4.1) | Task 1 |
| `POST /api/journal/gratitude` (text ≤280, lifeArea?, occurredOn?) | Task 1 + Task 2 |
| `GET /api/journal/gratitude?from&to` | Task 1 + Task 2 |
| `DELETE /api/journal/gratitude/{id}` | Task 1 + Task 2 |
| Embed `kind=gratitude` post-write | Task 3 |
| FE: gratitude half of ReflectionStep (up to 3 rows, life-area chip) | Task 5 |
| FE: reachable in JournalSheet as mode toggle | Task 6 |
| FE: Me/Napló streak card ("N napos sorozat") | Task 7 |
| Streak = derived count, not materialized | Task 2 (repository `countStreak`) |
| `life_area` CHECK on 8 LIFE skill keys | Task 1 (migration) |
| Config: `JOURNAL_SWITCH` gates everything | Task 2 (switch-off IT) |
| Docs updated + lint passes | Task 9 |

## Gate

**Backend:**
```bash
cd backend && ./mvnw clean test -Dtest='GratitudeEntryPersistenceIT,GratitudeApiIT,GratitudeEmbeddingEventIT'
```

**Frontend:**
```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

**Docs:**
```bash
node scripts/lint-docs.mjs
```
