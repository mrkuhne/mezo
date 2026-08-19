# W1.1 Journal Entity + Embed Pipeline — Implementation Plan (mezo-b3pp.1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Free-prose journal captured anywhere in two taps (QuickInput + Me/naplo), persisted in `journal_entry`, and embedded into `memory_embedding(kind=journal_entry)` post-commit; edits re-embed, deletes remove the vector.

**Architecture:** Contract-first REST slice (`api/feature/journal/journal.yml` → generated `JournalApi` + DTOs), new `feature/journal` backend package publishing `JournalEntrySavedEvent`/`JournalEntryDeletedEvent`; the companion side listens (`JournalEmbeddingListener`, `@Async` AFTER_COMMIT) and upserts through the single `MemoryEmbeddingWriter` write path. FE: new `data/journal` domain + `JournalSheet` (QuickInput two-option phase) + `JournalPage` under `/me/naplo`.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven, Liquibase + Postgres (pgvector), MapStruct, React 19 + Vite + TanStack Query, vitest + MSW, OpenAPI 3.0.3 contract-first.

**Design spec:** `docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md` §4.1, §4.3, §5.1, §11.

## Global Constraints

- Base package `io.mrkuhne.mezo`; UUID PKs (`gen_random_uuid()`); `created_by` set server-side from `CurrentUserId`, never from the client.
- Soft delete everywhere: `is_deleted` + `@SQLDelete`/`@SQLRestriction`; never physically delete in normal paths.
- No `@Value` — config via `FeaturesConfiguration` constants + `@Validated` `*Properties` records; switches consumed with `@ConditionalOnProperty` at the bean boundary, no `matchIfMissing`.
- Every embed/LLM call runs inside `LlmCallContextHolder.runWith(...)` — journal embeds go through the existing single write path, which tags `("embed_memory", "document", kind, refId)`; `entityKind=journal_entry` is the discriminator. (Spec §11 names a `journal` feature tag for journal-specific LLM calls; this slice has none — the embed rides the §4.3 single-writer rule. Note this in the PR.)
- **Spec deviation to document (mechanical, not design):** spec §5.1 says edits re-embed via "delete+insert on the `(kind, ref_id)` key". `uq_memory_embedding_kind_ref_id` spans soft-deleted rows, so soft-delete+insert would violate it and hard delete breaks the soft-delete rule ⇒ re-embed is implemented as **update-in-place** on the live row (same effect: fresh vector + content for the same key).
- Backend tests: integration-first, `test{Method}_should{Result}_when{Condition}`, AssertJ only, populator data; new table → `ResetDatabase` TRUNCATE list + populator in the same change.
- Frontend: hooks only via `@/data/hooks` barrel; `useDualQuery` for reads (never mock fallback in real mode); no new `*Screen`/`*View`; deep absolute `@/*` imports; tests colocated, both modes green.
- Liquibase: script names `{YYYYMMDDHHMM}_mezo-b3pp.1_{desc}.sql` (12-digit UTC, bd id verbatim), explicit constraint names, entity mirrors DDL constraints.
- Hungarian UI copy; commit subjects `feat(...): ... (mezo-b3pp.1)`.
- Local gates: focused ITs only (`./mvnw clean test -Dtest=...`, compose up); the full suite is CI's job.

---

### Task 1: API contract fragment + regeneration

**Files:**
- Create: `api/feature/journal/journal.yml`
- Modify: `api/generate/merge.yml` (append fragment), `api/base.yml` (version 0.4.0 → 0.5.0)
- Generated (committed): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: generated `io.mrkuhne.mezo.api.controller.JournalApi` (tag `Journal`), DTOs `CreateJournalEntryRequest`, `UpdateJournalEntryRequest`, `JournalEntryResponse`; FE `paths['/api/journal']` types. operationIds: `listJournalEntries`, `createJournalEntry`, `updateJournalEntry`, `deleteJournalEntry`.

- [ ] **Step 1: Write the fragment**

```yaml
openapi: 3.0.3
info: { title: mezo journal fragment, version: 1.0.0 }
paths:
  /api/journal:
    get:
      tags: [Journal]
      operationId: listJournalEntries
      summary: Journal entries in a date range, newest first (Journal)
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
                items: { $ref: '#/components/schemas/JournalEntryResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    post:
      tags: [Journal]
      operationId: createJournalEntry
      summary: Create a free-prose journal entry (Journal)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CreateJournalEntryRequest' }
      responses:
        '201':
          description: Entry saved
          content:
            application/json:
              schema: { $ref: '#/components/schemas/JournalEntryResponse' }
        '400':
          description: Validation error (empty text, bad source)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/journal/{id}:
    put:
      tags: [Journal]
      operationId: updateJournalEntry
      summary: Edit an entry's text and/or day (Journal)
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/UpdateJournalEntryRequest' }
      responses:
        '200':
          description: Updated entry
          content:
            application/json:
              schema: { $ref: '#/components/schemas/JournalEntryResponse' }
        '400':
          description: Validation error
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: JOURNAL_ENTRY_NOT_FOUND
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    delete:
      tags: [Journal]
      operationId: deleteJournalEntry
      summary: Soft-delete an entry (Journal)
      parameters:
        - { name: id, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        '204':
          description: Deleted
        '404':
          description: JOURNAL_ENTRY_NOT_FOUND
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    JournalEntryResponse:
      type: object
      required: [id, occurredOn, text, source, createdAt]
      properties:
        id: { type: string, format: uuid }
        occurredOn: { type: string, format: date }
        text: { type: string }
        source: { type: string, enum: [quickinput, ritual] }
        createdAt: { type: string, format: date-time }
    CreateJournalEntryRequest:
      type: object
      required: [text, source]
      properties:
        text: { type: string, minLength: 1 }
        occurredOn:
          type: string
          format: date
          description: The day the entry is ABOUT; server defaults to today when absent.
        source: { type: string, pattern: '^(quickinput|ritual)$' }
    UpdateJournalEntryRequest:
      type: object
      required: [text]
      properties:
        text: { type: string, minLength: 1 }
        occurredOn:
          type: string
          format: date
          description: Absent = keep the current day.
```

(`source` is a `pattern`, not an `enum`, on the REQUEST per `api_contract_conventions.md` — invalid values must 400, not 500. The RESPONSE enum is fine.)

- [ ] **Step 2: Register + bump version**

Append to `api/generate/merge.yml` inputs: `  - inputFile: ../feature/journal/journal.yml`. In `api/base.yml` set `version: 0.5.0`.

- [ ] **Step 3: Merge + regenerate FE types**

Run: `cd api/generate && npm run generate:api` then `cd ../../frontend && pnpm generate:api`
Expected: `api/openapi.yml` gains the `/api/journal` paths; `api.gen.ts` diff shows the new schemas.

- [ ] **Step 4: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): journal contract — /api/journal CRUD fragment (mezo-b3pp.1)"
```

---

### Task 2: Migrations + entity + repository + test scaffolding

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608181600_mezo-b3pp.1_create_journal_entry.sql`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608181610_mezo-b3pp.1_expand_memory_embedding_kinds.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (two changeSets, author `daniel.kuhne` — copy the file's existing author value)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/entity/JournalEntryEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/repository/JournalEntryRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryEmbeddingEntity.java` (new kind constant + `@Pattern`)
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/JournalPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (add `journal_entry` to TRUNCATE)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/journal/JournalEntryPersistenceIT.java`

**Interfaces:**
- Produces: `JournalEntryEntity` (extends `OwnedEntity`; `UUID id`, `LocalDate occurredOn`, `String text`, `String source`; constants `SOURCE_QUICKINPUT="quickinput"`, `SOURCE_RITUAL="ritual"`); `JournalEntryRepository.findByIdAndCreatedByAndDeletedFalse(UUID, UUID)` → `Optional<JournalEntryEntity>`, `findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(UUID, LocalDate, LocalDate)` → `List<JournalEntryEntity>`; `MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY = "journal_entry"`; `JournalPopulator.createEntry(UUID owner, LocalDate occurredOn, String text, String source)` → `JournalEntryEntity`.

- [ ] **Step 1: journal_entry migration** (spec §4.1, house constraint names)

```sql
-- Phase 5 W1.1 (bd mezo-b3pp.1, spec §4.1): free-prose journal entries.
-- Stories live in vector space — the row is the source; the embedding rides in memory_embedding.
create table journal_entry (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    occurred_on date        not null,
    text        text        not null,
    source      varchar(12) not null,
    constraint pk_journal_entry_id primary key (id),
    constraint fk_journal_entry_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_journal_entry_source check (source in ('quickinput', 'ritual'))
);

create index idx_journal_entry_created_by_occurred_on on journal_entry (created_by, occurred_on desc);
```

- [ ] **Step 2: kind-CK expansion migration** (spec §4.3 — W1.1 carries the whole batch)

```sql
-- Phase 5 (bd mezo-b3pp.1, spec §4.3): memory_embedding learns the narrative kinds.
-- The (kind, ref_id) uniqueness and the single MemoryEmbeddingWriter path are unchanged.
alter table memory_embedding drop constraint ck_memory_embedding_kind;
alter table memory_embedding add constraint ck_memory_embedding_kind check (kind in
    ('chat_turn', 'daily_summary', 'weekly_summary', 'monthly_summary',
     'journal_entry', 'reflection', 'gratitude', 'decision', 'activity_note', 'checkin_note'));
```

Register both in `1.0.0_master.yml` following the existing changeSet format (`id: 1.0.0:2026...`, `sqlFile` with `relativeToChangelogFile: true`).

- [ ] **Step 3: Entity + repository**

`JournalEntryEntity` mirrors the DDL (Liquibase rule #3): `@Table(name = "journal_entry")`, `@SQLDelete(sql = "update journal_entry set is_deleted = true where id = ?")`, `@SQLRestriction("is_deleted = false")`, extends `OwnedEntity`; `@Id @GeneratedValue @Column(columnDefinition = "uuid") UUID id`; `@NotNull @Column(name = "occurred_on", nullable = false) LocalDate occurredOn`; `@NotNull @Column(nullable = false, columnDefinition = "text") String text`; `@NotNull @Size(max = 12) @Pattern(regexp = "quickinput|ritual") @Column(nullable = false, length = 12) String source`. Javadoc: one row per free-prose entry; `occurred_on` = the day the entry is ABOUT.

`JournalEntryRepository extends JpaRepository<JournalEntryEntity, UUID>` with the two derived methods from **Interfaces**.

In `MemoryEmbeddingEntity`: add `public static final String KIND_JOURNAL_ENTRY = "journal_entry";` and widen the `kind` `@Pattern` to `chat_turn|daily_summary|weekly_summary|monthly_summary|journal_entry|reflection|gratitude|decision|activity_note|checkin_note` (mirrors the new CK; `@Size(max = 20)`/`length = 20` still fit — longest is `monthly_summary`, 15).

- [ ] **Step 4: Populator + ResetDatabase**

`JournalPopulator` (`@TestComponent @RequiredArgsConstructor`, mirrors `CheckInPopulator`): sets createdBy/occurredOn/text/source, `repository.saveAndFlush(e)` so DB CHECKs fire. Add `journal_entry, ` to the `ResetDatabase` TRUNCATE list (anywhere in the owned-table list, e.g. after `activity_log,`).

- [ ] **Step 5: Failing-then-green persistence IT**

`JournalEntryPersistenceIT extends AbstractIntegrationTest`, `@Transactional`:
- `testCreateEntry_shouldRoundTrip_whenValid` — populator entry, reload via repository, assert fields.
- `testFindByRange_shouldOrderNewestFirst_whenMultipleDays` — 3 entries across days, assert descending `occurredOn`.
- `testSource_shouldRejectUnknownValue_whenViolatingCheck` — populator with `source="bogus"`, `assertThatThrownBy(...saveAndFlush...)` (constraint/validation exception).

Run: `cd backend && ./mvnw clean test -Dtest='JournalEntryPersistenceIT'`
Expected: PASS (compose must be up: `docker compose up -d`).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(journal): journal_entry table + entity + narrative embedding kinds (mezo-b3pp.1)"
```

---

### Task 3: Journal REST surface (service + controller + switch)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/journal/service/JournalService.java`, `.../service/JournalEntrySavedEvent.java`, `.../service/JournalEntryDeletedEvent.java`, `.../mapper/JournalMapper.java`, `.../controller/JournalController.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`, `backend/src/main/resources/application.yml` (feature switch), `backend/src/main/resources/messages.properties`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/journal/JournalApiIT.java`, `.../journal/JournalSwitchOffIT.java`

**Interfaces:**
- Consumes: Task 1's `JournalApi` + DTOs; Task 2's entity/repository.
- Produces: `JournalEntrySavedEvent(UUID userId, UUID entryId)` and `JournalEntryDeletedEvent(UUID userId, UUID entryId)` records (Task 4's listener consumes); `JournalService.create(UUID, CreateJournalEntryRequest)` → `JournalEntryResponse`, `.list(UUID, LocalDate, LocalDate)` → `List<JournalEntryResponse>`, `.update(UUID, UUID, UpdateJournalEntryRequest)` → `JournalEntryResponse`, `.delete(UUID, UUID)`; `FeaturesConfiguration.JOURNAL_SWITCH = "mezo.feature.journal.enabled"`.

- [ ] **Step 1: Failing API IT first**

`JournalApiIT extends ApiIntegrationTest` (NOT `@Transactional` — AFTER_COMMIT must be real later; `companion-fake` not needed here):
- `testCreateJournalEntry_shouldReturn201WithDefaultedDate_whenOccurredOnAbsent` — POST `{text:"Ma jó napom volt.", source:"quickinput"}` → 201, `occurredOn == LocalDate.now()`, `source == quickinput`.
- `testCreateJournalEntry_shouldReturn400_whenTextBlank` — POST `{text:"", source:"quickinput"}` → 400 + `assertHasFieldError(body, "text", "VALIDATION_INVALID_VALUE")`.
- `testCreateJournalEntry_shouldReturn400_whenSourceUnknown` — `source:"bogus"` → 400 (pattern → FIELD error).
- `testListJournalEntries_shouldReturnNewestFirstWithinRange_whenEntriesExist` — populator 3 entries (2 in range, 1 outside), GET `/api/journal?from=...&to=...` → 200, size 2, newest first.
- `testUpdateJournalEntry_shouldChangeTextAndKeepDate_whenOccurredOnAbsent` — PUT → 200, text changed, occurredOn unchanged.
- `testUpdateJournalEntry_shouldReturn404_whenNotOwnEntry` — populator entry for `userPopulator.createUser()` (not the owner), PUT as owner → 404 + `assertHasRequestError(body, "JOURNAL_ENTRY_NOT_FOUND")`.
- `testDeleteJournalEntry_shouldSoftDeleteAndVanishFromList_whenExisting` — DELETE → 204; GET → without it; repository (via `findAll` on a `@Autowired` repo) still risky under `@SQLRestriction` — instead assert list absence only.

Run: `./mvnw clean test -Dtest='JournalApiIT'` — Expected: FAIL (no controller yet; 404s).

- [ ] **Step 2: Implement service + events + mapper + controller + config**

`JournalService` (`@Service @RequiredArgsConstructor`, `@ConditionalOnProperty(name = FeaturesConfiguration.JOURNAL_SWITCH, havingValue = "true")`, method-level `@Transactional`): create defaults `occurredOn` to `LocalDate.now()` when null, saves, publishes `new JournalEntrySavedEvent(userId, e.getId())` via `ApplicationEventPublisher`; update loads `findByIdAndCreatedByAndDeletedFalse` `.orElseThrow(() -> new SystemRuntimeErrorException(SystemMessage.error("JOURNAL_ENTRY_NOT_FOUND").build(), HttpStatus.NOT_FOUND))`, sets text (+ occurredOn when present), publishes the same saved event; delete loads the same way, `repository.delete(e)` (soft) and publishes `JournalEntryDeletedEvent`. Both event records live in `feature/journal/service/` (one file each, Javadoc: AFTER_COMMIT payload for the companion embed listener).

`JournalMapper` (`@Mapper(componentModel = "spring")`): `JournalEntryResponse toResponse(JournalEntryEntity entity)` + `default OffsetDateTime map(Instant instant)` bridge (copy the idiom from an existing mapper, e.g. `ActivityMapper`); `source` maps to the response enum via `JournalEntryResponse.SourceEnum.fromValue(entity.getSource())` default method if MapStruct doesn't auto-map (check the generated DTO first).

`JournalController implements JournalApi` — exactly the `IntentionController` shape: `@RestController @RequiredArgsConstructor @ConditionalOnProperty(name = FeaturesConfiguration.JOURNAL_SWITCH, havingValue = "true")`, injects `JournalService` + `CurrentUserId`, four thin overrides.

Config: `FeaturesConfiguration` gains `/** Phase 5 W1.1 journal (bd mezo-b3pp.1) — off ⇒ the /api/journal surface 404s and no journal beans exist. */ public static final String JOURNAL_SWITCH = "mezo.feature.journal.enabled";`. `application.yml` `mezo.feature` block gains (with comment):

```yaml
    # Phase 5 W1.1 journal (bd mezo-b3pp.1) — free-prose entries + embed pipeline;
    # off ⇒ /api/journal 404s and no journal beans exist.
    journal:
      enabled: true
```

`messages.properties`: `JOURNAL_ENTRY_NOT_FOUND=A naplóbejegyzés nem található.`

- [ ] **Step 3: Green + switch-off IT**

Run: `./mvnw clean test -Dtest='JournalApiIT'` — Expected: PASS.

`JournalSwitchOffIT extends ApiIntegrationTest` with `@TestPropertySource(properties = "mezo.feature.journal.enabled=false")` (the `MesoReviewSwitchOffIT` idiom — separate class because bean presence is fixed per context): `testJournalSurface_shouldReturn404_whenSwitchedOff` — GET + POST both 404 with `ownerAuthHeaders()`.

Run: `./mvnw clean test -Dtest='JournalApiIT,JournalSwitchOffIT'` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(journal): /api/journal CRUD surface + feature switch (mezo-b3pp.1)"
```

---

### Task 4: Embed pipeline (writer upsert + listener + companion config)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java`, `.../companion/repository/MemoryEmbeddingRepository.java`, `.../companion/config/CompanionProperties.java`, `backend/src/main/resources/application.yml` (companion block)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/JournalEmbeddingListener.java`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriterIT.java`; create `backend/src/test/java/io/mrkuhne/mezo/feature/journal/JournalEmbeddingEventIT.java`

**Interfaces:**
- Consumes: Task 2's `JournalEntryEntity`/`KIND_JOURNAL_ENTRY`/`JournalPopulator`, Task 3's event records.
- Produces: `MemoryEmbeddingWriter.writeJournal(JournalEntryEntity entry)` (upsert), `MemoryEmbeddingWriter.deleteJournalEmbedding(UUID entryId)` (soft-delete), `MemoryEmbeddingRepository.findByKindAndRefId(String kind, UUID refId)` → `Optional<MemoryEmbeddingEntity>`; `CompanionProperties.Journal(@Positive int decisionReviewDays)`.

- [ ] **Step 1: Failing writer ITs** (in `MemoryEmbeddingWriterIT`, profile `companion-fake`, add `@Autowired JournalPopulator` + repository):

- `testWriteJournal_shouldPersistJournalUnit_whenNewEntry` — populator entry, `writeJournal(entry)`, assert one row: kind `journal_entry`, refId = entry id, content = entry text, occurredOn = entry occurredOn, embedding size `EmbeddingPort.DIMENSIONS`.
- `testWriteJournal_shouldReembedInPlace_whenEntryEdited` — write, mutate entry text + occurredOn, `writeJournal` again → still ONE row, same row id, new content + occurredOn (update-in-place — see Global Constraints deviation note).
- `testDeleteJournalEmbedding_shouldSoftDeleteRow_whenPresent` — write, delete, `findByKindAndRefId` empty.

Run: `./mvnw clean test -Dtest='MemoryEmbeddingWriterIT'` — Expected: FAIL (methods missing).

- [ ] **Step 2: Implement writer + repository method**

Repository: derived `Optional<MemoryEmbeddingEntity> findByKindAndRefId(String kind, UUID refId)` (respects `@SQLRestriction`). Writer (Javadoc each; both `@Transactional`):

```java
/** W1.1 journal unit (spec §5.1): first write inserts; an edit re-embeds IN PLACE on the live
 *  (kind, ref_id) row — uq_memory_embedding_kind_ref_id spans soft-deleted rows, so the spec's
 *  "delete+insert" is realized as an update (same key, fresh vector + content). */
@Transactional
public void writeJournal(JournalEntryEntity entry) {
    memoryEmbeddingRepository
            .findByKindAndRefId(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, entry.getId())
            .ifPresentOrElse(existing -> {
                String capped = cap(entry.getText());
                float[] vector = llmCallContextHolder.runWith(
                        new LlmCallContext("embed_memory", "document",
                                MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, entry.getId()),
                        () -> embeddingPort.embedDocuments(List.of(capped))).getFirst();
                existing.setContent(capped);
                existing.setEmbedding(vector);
                existing.setOccurredOn(entry.getOccurredOn());
                memoryEmbeddingRepository.saveAndFlush(existing);
            }, () -> write(entry.getCreatedBy(), MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY,
                    entry.getId(), entry.getText(), entry.getOccurredOn()));
}

/** Deleted entries must not be recallable — soft-deletes the entry's vector row (IDENT-3 honesty). */
@Transactional
public void deleteJournalEmbedding(UUID entryId) {
    memoryEmbeddingRepository
            .findByKindAndRefId(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, entryId)
            .ifPresent(memoryEmbeddingRepository::delete); // @SQLDelete → soft delete
}
```

(Import `JournalEntryEntity` — companion → journal is the established higher-level-AI-feature direction, same as proactive → biometrics.)

Run: `./mvnw clean test -Dtest='MemoryEmbeddingWriterIT'` — Expected: PASS.

- [ ] **Step 3: Listener + end-to-end event IT**

`JournalEmbeddingListener` — the `TurnEmbeddingListener` shape: `@Slf4j @Component @RequiredArgsConstructor @ConditionalOnProperty(name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.JOURNAL_SWITCH}, havingValue = "true")`; injects `MemoryEmbeddingWriter` + `JournalEntryRepository`; two methods, each `@Async @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)` with try/catch `log.warn` (embedding must never break a journal write): `onJournalEntrySaved(JournalEntrySavedEvent)` loads the entry (`findById`, skip when absent/deleted) → `writeJournal`; `onJournalEntryDeleted(JournalEntryDeletedEvent)` → `deleteJournalEmbedding(event.entryId())`.

`JournalEmbeddingEventIT extends ApiIntegrationTest`, `@ActiveProfiles("companion-fake")` (the `CompanionMessageEventIT` idiom — server-side commits so AFTER_COMMIT genuinely fires, Awaitility rides the async hop):
- `testCreateJournalEntry_shouldProduceExactlyOneEmbedding_whenCommitted` — POST → `await().atMost(10, SECONDS).untilAsserted(...)` one `memory_embedding` row, kind/refId/content/occurredOn asserted (spec §5.1 acceptance: exactly one row).
- `testUpdateJournalEntry_shouldReembed_whenTextChanges` — POST, await row; PUT new text → await content change, still one row.
- `testDeleteJournalEntry_shouldRemoveEmbedding_whenDeleted` — POST, await row; DELETE → await `findByKindAndRefId` empty.

Run: `./mvnw clean test -Dtest='JournalEmbeddingEventIT'` — Expected: PASS.

- [ ] **Step 4: CompanionProperties.Journal** (spec §5.1: the record starts here, W1.4 consumes it)

Add component `@NotNull @Valid Journal journal` + record with Javadoc:

```java
/** Phase 5 W1 journal knobs (mezo-b3pp.1). decisionReviewDays feeds W1.4's decision review-due default. */
public record Journal(
    /** decision_entry.review_due default offset in days from decided_on (W1.4). */
    @Positive int decisionReviewDays
) {}
```

`application.yml` under `mezo.companion:`:

```yaml
    # Phase 5 W1 journal (mezo-b3pp.1) — decision review-due offset in days (used by W1.4's decision journal).
    journal:
      decision-review-days: 30
```

Run: `./mvnw clean test -Dtest='JournalApiIT'` — Expected: PASS (context still boots with the new required property).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(journal): post-commit embed pipeline — writeJournal upsert + listener (mezo-b3pp.1)"
```

---

### Task 5: FE data layer (journal domain)

**Files:**
- Create: `frontend/src/data/journal/journalTypes.ts`, `journalApi.ts`, `journalMock.ts`, `journalHooks.ts`
- Modify: `frontend/src/data/hooks.ts` (barrel line), `frontend/src/test/msw/handlers.ts` (journal handlers), `frontend/src/data/hooks.reexport.test.ts` (mirror the existing per-domain identity asserts)
- Test: `frontend/src/data/journal/journalHooks.test.tsx`

**Interfaces:**
- Consumes: Task 1's `paths['/api/journal']` generated types.
- Produces: `JournalNote { id: string; occurredOn: string; text: string; source: 'quickinput' | 'ritual'; createdAt: string }`; `useJournalNotes(from: string, to: string)` → `{ data: JournalNote[], isPending, isError, refetch }` (via `useDualQuery`, key `['journal', from, to]`); `useJournalActions()` → `{ addNote(text: string, occurredOn?: string): Promise<JournalNote>, updateNote(id: string, text: string, occurredOn?: string): Promise<JournalNote>, removeNote(id: string): Promise<void>, pending: boolean }`.

- [ ] **Step 1: Types + API module + mock**

`journalTypes.ts`: the `JournalNote` interface above (named `JournalNote`, NOT `JournalEntry` — two unrelated `JournalEntry` types already exist in `growthJournal.ts` and `patternHistory.ts`).

`journalApi.ts` — the `activityApi.ts` shape: path-type aliases off `paths` (`JournalListResponse`, `JournalCreateBody = paths['/api/journal']['post']['requestBody']['content']['application/json']`, etc.), `toJournalNote(wire)` mapper, and:

```ts
export const journalApi = {
  list: (from: string, to: string): Promise<JournalNote[]> =>
    apiFetch<JournalListResponse>(`/api/journal?from=${from}&to=${to}`).then((rows) => rows.map(toJournalNote)),
  create: (text: string, occurredOn?: string): Promise<JournalNote> =>
    apiFetch<JournalWire>(`/api/journal`, {
      method: 'POST',
      body: JSON.stringify({ text, occurredOn, source: 'quickinput' } satisfies JournalCreateBody),
    }).then(toJournalNote),
  update: (id: string, text: string, occurredOn?: string): Promise<JournalNote> =>
    apiFetch<JournalWire>(`/api/journal/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ text, occurredOn } satisfies JournalUpdateBody),
    }).then(toJournalNote),
  remove: (id: string): Promise<void> => apiFetch<void>(`/api/journal/${id}`, { method: 'DELETE' }),
}
```

`journalMock.ts`: `export const mockJournalNotes: JournalNote[]` — 5 Hungarian entries spanning the current and previous month (relative to `localDateString()`-style fixed dates is fine; use literal dates ~2026-07/2026-08 like other mocks) so the month grouping is visible in mock mode.

- [ ] **Step 2: Hooks + barrel + MSW**

`journalHooks.ts` — the `activityHooks.ts` shape: `useJournalNotes(from, to)` via `useDualQuery({ queryKey: ['journal', from, to], mockData: filtered mockJournalNotes (by range), realFetch: () => journalApi.list(from, to), realEmpty: [] })`. `useJournalActions()` — `const qc = useQueryClient(); const mock = isMockMode()`; mutations: in mock mode `qc.setQueryData` over every `['journal']`-prefixed cache entry (use `qc.invalidateQueries({ queryKey: ['journal'] })` after a `setQueryData` on the exact keys is fiddly — simplest mock path: update via `qc.setQueriesData<JournalNote[]>({ queryKey: ['journal'] }, updater)`); real mode `onSuccess: () => qc.invalidateQueries({ queryKey: ['journal'] })`. Return `mutateAsync` wrappers + `pending`.

Barrel `data/hooks.ts`: `export { useJournalNotes, useJournalActions } from '@/data/journal/journalHooks'`. Mirror the pattern in `hooks.reexport.test.ts`.

MSW `handlers.ts`: `http.get(`${API_BASE}/api/journal`, () => HttpResponse.json([]))`, `http.post(...)` → echo a `JournalEntryResponse`-shaped row (201), `http.put(`${API_BASE}/api/journal/:id`, ...)` → echo, `http.delete(...)` → 204.

- [ ] **Step 3: Dual-mode hook tests**

`journalHooks.test.tsx` — copy the `activityHooks.test.tsx` structure: mock mode (`vi.stubEnv('VITE_USE_MOCK', 'true')`) seed served synchronously + `addNote` prepends via `setQueriesData`; real mode (`'false'`) resolves from MSW + `addNote` POSTs (spy via `server.use` override). Use `makeHookWrapper()`.

Run: `cd frontend && pnpm test src/data/journal && VITE_USE_MOCK=true pnpm test src/data/journal`
Expected: PASS both modes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(journal-fe): data/journal domain — dual-mode hooks + MSW (mezo-b3pp.1)"
```

---

### Task 6: JournalSheet + QuickInput two-option phase

**Files:**
- Create: `frontend/src/features/me/sheets/JournalSheet.tsx` (+ `JournalSheet.test.tsx`)
- Modify: `frontend/src/features/quickinput/sheets/QuickInputSheet.tsx` (+ its test)

**Interfaces:**
- Consumes: `useJournalActions` from `@/data/hooks`; `useVoiceInput` from `@/features/insights/logic/useVoiceInput` (cross-feature import — sanctioned precedent, see `GrowthPage.tsx:14-17`); `Sheet` from `@/shared/ui/Sheet`.
- Produces: `JournalSheet` props `{ onClose: () => void; entry?: JournalNote | null }` (Task 7's edit flow passes `entry`).

- [ ] **Step 1: JournalSheet**

One textarea (free prose, no maxLength, placeholder `„Írd le, mi jár a fejedben…"`, autoFocus) + optional date `<input type="date" aria-label="Dátum">` (default: today via `localDateString()`; the `SleepLogSheet.tsx:290` idiom) + mic button wired to `useVoiceInput((text) => setText((d) => (d ? `${d} ${text}` : text)))` (copy the `ChatPage.tsx:191-207` chip markup incl. `aria-label="Hangbevitel"` / `'Felvétel leállítása'`, `chat-mic-live` recording style, disabled on `unsupported`/`transcribing`). Header eyebrow `„Napló"`, title `„Mi jár a fejedben?"` (edit mode: `„Bejegyzés szerkesztése"`). CTAs `„Mégse"` / `„Mentem"` (the `ActivityLogSheet.tsx:96-97` row); save = `entry ? updateNote(entry.id, text, date) : addNote(text, date)` then `close()`. Delete only in edit mode: two-step confirm (`EditGoalSheet.tsx:79-109` idiom — `„Törlés"` → `„Biztosan törlöd?"`, `var(--error)` styling) calling `removeNote(entry.id).then(close)`. Wrap in `@/shared/ui/Sheet` (`{open && <JournalSheet …/>}` conditional-mount idiom — no `open` prop).

`JournalSheet.test.tsx` — the `ActivityLogSheet.test.tsx` structure (`vi.mock('@/data/hooks', …)` hoisted, `makeHookWrapper()`): saves text via `addNote` on CTA; edit mode prefills + calls `updateNote`; delete needs the second confirm tap.

- [ ] **Step 2: QuickInputSheet two-option phase**

`type Phase = 'menu' | 'sleep' | 'naplo-pick' | 'aktivitas' | 'journal' | 'checkin'` (the old `'naplo'` member splits). Napló tile → `setPhase('naplo-pick')`. Early returns: `if (phase === 'aktivitas') return <ActivityLogSheet onClose={onClose} />`; `if (phase === 'journal') return <JournalSheet onClose={onClose} />` (import from `@/features/me/sheets/JournalSheet` — same cross-feature direction as the existing `@/features/today/sheets/ActivityLogSheet` import). `'naplo-pick'` renders INSIDE the existing `<Sheet>` shell (not an early return): heading `„Mit naplózol?"` + two `quicklog-tile np-press` buttons — `✍️ Aktivitás` (→ `setPhase('aktivitas')`) and `📓 Napló` (→ `setPhase('journal')`).

Update `QuickInputSheet.test.tsx`: the `:64-71` test becomes two tests — Napló tile shows the picker (both option labels visible, menu heading gone or still fine if shell retained — assert `Mit naplózol?`); picking `Aktivitás` swaps to `Tevékenységnapló`; picking `Napló` swaps to the JournalSheet title. Keep the 8-tile test (tile labels unchanged).

- [ ] **Step 3: Run + commit**

Run: `cd frontend && pnpm test src/features/quickinput src/features/me/sheets/JournalSheet && VITE_USE_MOCK=true pnpm test src/features/quickinput src/features/me/sheets/JournalSheet`
Expected: PASS both modes.

```bash
git add frontend/src
git commit -m "feat(journal-fe): JournalSheet + QuickInput két-opciós napló fázis (mezo-b3pp.1)"
```

---

### Task 7: JournalPage (/me/naplo) + tab + route

**Files:**
- Create: `frontend/src/features/me/pages/JournalPage.tsx` (+ `JournalPage.test.tsx`)
- Modify: `frontend/src/features/me/pages/tabs.ts` (new tab), `frontend/src/app/router.tsx` (route), `frontend/src/features/me/pages/MeSection.test.tsx` (label loop gains `Napló`)

**Interfaces:**
- Consumes: `useJournalNotes` from `@/data/hooks`; Task 6's `JournalSheet` (`entry` prop for edit).

- [ ] **Step 1: Page**

`JournalPage` (a `*Page` leaf under the Me `*Section` outlet): header `pghead-np lav` — `over` = `Me · Napló`, `h1` = `Napló`, `pgact-np np-press` add-button (opens `JournalSheet` create mode). Data window: `const [monthsBack, setMonthsBack] = useState(3)`; `from` = first day of (current month − (monthsBack−1)), `to` = today (`localDateString()`); `useJournalNotes(from, to)`. Render month-grouped (the `MemoryJournalPanel.tsx:5-13,28-40` idiom): running `lastMonth` separator with `monthLabel()` (`hu-HU` `{ year: 'numeric', month: 'long' }`), inside a month each entry card shows `dayLabel()` (`Ma`/`Tegnap`/short date) + the prose; tapping a card sets `editNote` state → `{editNote && <JournalSheet entry={editNote} onClose={() => setEditNote(null)} />}`. Footer `„Korábbi hónapok"` ghost button → `setMonthsBack((m) => m + 3)`. Empty state: `GhostState` with `„Még nincs bejegyzés — kezdd a + gombbal."`. Loading: `isPending` → a small skeleton block (no dedicated file needed; inline `animate-pulse` rows like sibling pages, or a `JournalSkeleton` next to the page if >10 lines).

- [ ] **Step 2: Tab + route**

`tabs.ts` `ME_TABS`: insert `{ id: 'journal', to: '/me/naplo', label: 'Napló' },` after the `growth` entry. `router.tsx`: import `JournalPage` next to the other Me pages; add `{ path: 'naplo', element: <JournalPage /> },` to the `me` children array (keeps sub-nav chrome). Update `MeSection.test.tsx`'s label list (7 → 8, add `Napló`).

- [ ] **Step 3: Page test**

`JournalPage.test.tsx` — the `GrowthPage.test.tsx` structure: barrel-mock `useJournalNotes`/`useJournalActions`, pin `localDateString` (`vi.mock('@/shared/lib/dates', …)`), render inside `QueryWrapper > MemoryRouter initialEntries={['/me/naplo']}`. Asserts: month separator labels render for a two-month fixture; tapping an entry opens the edit sheet (its title appears); empty fixture shows the ghost state.

- [ ] **Step 4: Full FE gate + commit**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: build + both modes green (this catches the router/tabs/barrel wiring project-wide).

```bash
git add frontend/src
git commit -m "feat(journal-fe): /me/naplo JournalPage — havi csoportosítás + szerkesztés (mezo-b3pp.1)"
```

---

### Task 8: Docs + final gates

**Files:**
- Create: `docs/features/journal.md` (10-section template — read `docs/features/README.md` + one sibling, e.g. `docs/features/intention.md`, first; frontmatter `key_files` must list the real new files)
- Modify: `docs/features/me.md` (new Napló tab + page in the surface map), `docs/features/companion.md` (memory_embedding kind expansion + JournalEmbeddingListener in the embed-pipeline section)

**Steps:**

- [ ] **Step 1: Write `journal.md`** — what it is (W1.1 scope: free-prose entries, QuickInput + /me/naplo, post-commit embedding, edit-re-embed/delete-remove), data model (`journal_entry` DDL summary), API (4 endpoints), FE surfaces, integration seams (events → companion listener; W1.2/W1.4 will extend), config switches (`mezo.feature.journal.enabled`, `mezo.companion.journal.decision-review-days`), file map with `file:line` pointers, test map. Update `me.md` + `companion.md` only in the touched sections.

- [ ] **Step 2: Lint**

Run: `node scripts/lint-docs.mjs`
Expected: zero errors, no new staleness.

- [ ] **Step 3: Focused backend gate** (final)

Run: `cd backend && ./mvnw clean test -Dtest='JournalEntryPersistenceIT,JournalApiIT,JournalSwitchOffIT,JournalEmbeddingEventIT,MemoryEmbeddingWriterIT'`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/
git commit -m "docs(journal): journal.md born + me/companion feature docs (mezo-b3pp.1)"
```

---

## Self-Review Notes

- Spec §5.1 coverage: table+package (T2/T3) ✓, contract-first 4 endpoints (T1) ✓, event+listener+writeJournal (T4) ✓, kind-CK expansion rides this slice (T2) ✓, QuickInput two-option phase + JournalSheet + voice (T6) ✓, /me/naplo month-grouped read view + edit/delete + Me tab (T7) ✓, `mezo.feature.journal.enabled` + `CompanionProperties.Journal.decisionReviewDays` (T3/T4) ✓, `journal.md` born (T8) ✓, acceptance (save→exactly one embedding row, edit re-embeds, switches honest) covered by `JournalEmbeddingEventIT` + `JournalSwitchOffIT` ✓.
- Two documented interpretations: re-embed = update-in-place (unique-key constraint reality); embed tag stays `embed_memory`/`entityKind=journal_entry` (single-writer rule §4.3). Both go in the PR description.
