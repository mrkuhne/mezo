# W1.2 Evening prose reflection in Napzárás — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Driver:** bd `mezo-b3pp.2` (epic `mezo-b3pp`, Phase 5 W1.2)
**Spec:** [`2026-08-18-phase5-deep-memory-personalization-design.md`](../specs/2026-08-18-phase5-deep-memory-personalization-design.md) §5.2 (+ §1–§4, §11)
**Feature docs:** [`ritual.md`](../../features/ritual.md), [`companion.md`](../../features/companion.md)

**Goal:** The Napzárás ritual asks once, gently — „Milyen volt a napod valójában?" — stores the prose on `ritual_day.reflection_text`, and embeds it into `memory_embedding(kind=reflection)` when the day closes.

**Architecture:** A new `PUT /api/ritual/reflection` upserts the `(created_by, ritual_date)` row **before** the close, which deliberately relaxes the existing "nothing writes before act 4" invariant. Because a `ritual_day` row can now exist *without* being closed, `closed_at` becomes nullable and the "day is closed" predicate everywhere changes from *"a row exists"* to *"`closed_at is not null`"* — three consumers must move in lockstep (`RitualService`, `HabitEvaluator`, `MetricSeriesService`). The embed rides a new `RitualClosedEvent` + `@Async AFTER_COMMIT` listener (the `JournalEmbeddingListener` idiom) into `MemoryEmbeddingWriter.writeReflection`. On the frontend a sixth act — `ReflectionStep` — inserts after DayStory; skipping is one tap and writes nothing.

**Tech Stack:** Spring Boot 3 + JPA + Liquibase (Postgres), contract-first OpenAPI (`api/feature/ritual/ritual.yml` → generated `RitualApi`), React 19 + TanStack Query dual-mode (`useDualQuery`), Vitest + Playwright visual goldens.

## Global Constraints

- **Contract-first** — the `api/feature/ritual/ritual.yml` fragment changes BEFORE any backend code; backend implements the generated `RitualApi`; FE types regenerate. Never hand-write boundary DTOs. Regenerate with `cd api/generate && npm run generate:api` then `cd frontend && pnpm generate:api`.
- **Every LLM/embed call site** wraps in `LlmCallContextHolder.runWith(new LlmCallContext(feature, operation, entityKind, entityId), …)`. For this slice the feature/operation pair is `("embed_memory", "document")`, matching `MemoryEmbeddingWriter`'s existing calls.
- **Config records** are `@Validated` + nested `@Valid` in their properties record. *(This slice adds no new tuning values — the reflection has nothing to tune.)*
- **Integration-first tests** — backend behaviour is pinned by ITs against real Postgres (`ApiIntegrationTest`), not unit mocks. No new table in this slice, so no `ResetDatabase`/populator additions are required beyond a new `RitualPopulator` helper for open (unclosed) rows.
- **Migrations** carry the driving bd id: `backend/src/main/resources/db/changelog/1.0.0/script/<yyyyMMddHHmm>_mezo-b3pp.2_<name>.sql`, registered in `1.0.0_master.yml` with changeSet id `"1.0.0:<same filename stem>"`, author `daniel.kuhne`.
- **Explicit constraint names** (`pk_/fk_/uq_/ck_/idx_`). This slice adds no constraints.
- **Soft delete + `@SQLRestriction("is_deleted = false")`** stays as-is on `ritual_day`.
- **Docs in the SAME change**: `docs/features/ritual.md` (§2, §4, §5, §8, §9, §10), `docs/features/companion.md` (the embedding-seam table row), then `node scripts/gen-codemap.mjs` and `node scripts/lint-docs.mjs` — **no new staleness allowed**.
- **HU copy is user-facing** and must be exactly as written in this plan (byte-exact, the ritual's approved-mockup rule).
- **Dual-mode frontend**: every new surface has an honest mock seed AND a real-mode path; both `pnpm test` and `VITE_USE_MOCK=true pnpm test` must be green.

## Decisions locked in this plan (do not re-litigate mid-execution)

1. **`closed` means `closed_at is not null`.** The row's mere existence stops meaning "closed" the moment a reflection can create it. All three consumers change together in Task 1.
2. **`PUT /api/ritual/reflection` is today-only** (409 `RITUAL_NOT_TODAY`, reusing the close's existing message key). Rationale: the reflection is written *inside* the evening ritual, and `POST /api/ritual/close` already carries the same guard — a wider write surface would let arbitrary past days sprout rows for no product reason. The spec does not forbid this; it simply doesn't specify a date rule.
3. **Blank text is a clear, not a create.** `PUT` with blank/whitespace text: if a row exists → `reflection_text = null`; if no row exists → no row is created (no junk rows from an opened-then-abandoned textarea). This is what makes "skipping writes nothing" true even if the FE ever fires an empty save.
4. **No length cap on the reflection** — mirrors `journal_entry.text` ("free prose, no length cap", spec §4.1). The embed caps at `mezo.companion.embedding.embed-max-chars` inside `MemoryEmbeddingWriter`, as every other kind does.
5. **`RitualClosedEvent` fires from two places:** (a) the close that actually stamps `closed_at` (first close only — a repeat close is idempotent and publishes nothing), and (b) a reflection upsert onto an **already-closed** row, so editing the prose after the close re-embeds instead of leaving a stale vector standing. `writeReflection` updates in place on the live `(kind, ref_id)` row, exactly like `writeJournal`.
6. **Act order** becomes: 1 Megérkezés · 2 A napod íve · **3 Ma milyen volt (new)** · 4 Nyitott hurkok · 5 Termés (close fires here) · 6 Elengedés. `ACT_COUNT` 5 → 6; the `closedRef` effect moves from `act === 4` to `act === 5`.
7. **The reflection saves on advance, not on keystroke.** Both the „Tovább" CTA and the „Ma nem írok" skip advance immediately; „Tovább" fires a fire-and-forget `saveReflection` when the text is non-blank. Nothing in this act may block or fail the flow (IDENT-3).

## File Structure

**Backend — modified**
- `backend/src/main/resources/db/changelog/1.0.0/script/202608211500_mezo-b3pp.2_ritual_day_reflection.sql` *(create)* — adds `reflection_text`, drops `closed_at`'s NOT NULL.
- `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` — registers the changeSet.
- `backend/src/main/java/io/mrkuhne/mezo/feature/ritual/entity/RitualDayEntity.java` — `closedAt` nullable, new `reflectionText`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/ritual/repository/RitualDayRepository.java` — three closed-only finders.
- `backend/src/main/java/io/mrkuhne/mezo/feature/ritual/service/RitualService.java` — `closed` predicate, `reflectionText` in the response, new `saveReflection`, `RitualClosedEvent` publication.
- `backend/src/main/java/io/mrkuhne/mezo/feature/ritual/controller/RitualController.java` — the new operation.
- `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitEvaluator.java` — `ritual_closed` uses the closed-only finder.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricSeriesService.java` — `ritualClosed` series uses the closed-only finders.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryEmbeddingEntity.java` — `KIND_REFLECTION`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java` — `writeReflection`.

**Backend — created**
- `backend/src/main/java/io/mrkuhne/mezo/feature/ritual/service/RitualClosedEvent.java` — the AFTER_COMMIT payload.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/ReflectionEmbeddingListener.java` — `@Async` AFTER_COMMIT → `writeReflection`.

**Contract**
- `api/feature/ritual/ritual.yml` — `reflectionText` on `RitualDayResponse`, new `PUT /api/ritual/reflection` + `RitualReflectionRequest`.

**Frontend — modified**
- `frontend/src/data/types.ts` — `RitualDay.reflectionText`.
- `frontend/src/data/ritual/ritualApi.ts` — `toDay` maps the field; `saveReflection`.
- `frontend/src/data/ritual/ritualMock.ts` — both seeds gain `reflectionText: null`.
- `frontend/src/data/ritual/ritualHooks.ts` — `useRitualActions` returns `saveReflection`.
- `frontend/src/features/ritual/pages/RitualPage.tsx` — 6 acts, close on act 5.
- `frontend/tests/visual/visual.spec.ts` — one extra advance click in the harvest click-through.

**Frontend — created**
- `frontend/src/features/ritual/components/ReflectionStep.tsx` — the new act.
- `frontend/src/features/ritual/components/ReflectionStep.test.tsx`.

**Tests — modified**
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/RitualPopulator.java` — `openDay(...)`/`reflection(...)` helpers.
- `backend/src/test/java/io/mrkuhne/mezo/feature/ritual/RitualApiIT.java` — the reflection endpoint's cases.
- `backend/src/test/java/io/mrkuhne/mezo/feature/ritual/RitualDayEntityIT.java` — nullable `closed_at` round-trip.
- `frontend/src/data/ritual/ritualHooks.test.tsx` — `saveReflection` in both modes.
- `frontend/src/features/ritual/pages/RitualPage.test.tsx` — the 6-act progression.

**Tests — created**
- `backend/src/test/java/io/mrkuhne/mezo/feature/ritual/RitualReflectionEmbeddingIT.java` — close → exactly one `reflection` vector; skip → none.

**Docs**
- `docs/features/ritual.md`, `docs/features/companion.md`, `docs/CODEMAP.md` (generated).

---

### Task 1: `closed` stops meaning "a row exists"

The load-bearing task. A reflection can now create an *open* `ritual_day` row; every reader that treated row-existence as closure must move to `closed_at is not null` in the same commit, or the ritual habit completes and the metric series lights up the moment prose is typed.

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608211500_mezo-b3pp.2_ritual_day_reflection.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append at end)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/ritual/entity/RitualDayEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/ritual/repository/RitualDayRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/ritual/service/RitualService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitEvaluator.java:121-122`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricSeriesService.java:516-529`
- Test: `backend/src/test/java/io/mrkuhne/mezo/support/populator/RitualPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/ritual/RitualDayEntityIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/ritual/RitualApiIT.java`

**Interfaces:**
- Produces: `RitualDayEntity.getReflectionText()/setReflectionText(String)`; `RitualDayEntity.getClosedAt()` may now return `null`.
- Produces: `RitualDayRepository.findByCreatedByAndRitualDateAndClosedAtIsNotNull(UUID, LocalDate) : Optional<RitualDayEntity>`, `findByCreatedByAndRitualDateBetweenAndClosedAtIsNotNull(UUID, LocalDate, LocalDate) : List<RitualDayEntity>`, `findFirstByCreatedByAndClosedAtIsNotNullOrderByRitualDateAsc(UUID) : Optional<RitualDayEntity>`.
- Produces: `RitualPopulator.openDay(UUID owner, LocalDate date, String reflectionText) : RitualDayEntity` (an unclosed row).

- [ ] **Step 1: Write the failing tests**

Add to `backend/src/test/java/io/mrkuhne/mezo/support/populator/RitualPopulator.java`:

```java
    /** An OPEN ritual_day row — the reflection-before-close shape (mezo-b3pp.2): no closed_at. */
    public RitualDayEntity openDay(UUID owner, LocalDate date, String reflectionText) {
        RitualDayEntity e = new RitualDayEntity();
        e.setCreatedBy(owner);
        e.setRitualDate(date);
        e.setReflectionText(reflectionText);
        return ritualDayRepository.saveAndFlush(e);
    }
```

Add to `backend/src/test/java/io/mrkuhne/mezo/feature/ritual/RitualApiIT.java` (the class already has `ownerId()`; add `@Autowired RitualPopulator ritualPopulator;` and the `HabitEvaluator` import shown in Step 3's usage is NOT needed here):

```java
    @Test
    void testGetDay_shouldReportNotClosed_whenOnlyAReflectionRowExists() {
        ritualPopulator.openDay(ownerId(), LocalDate.now(), "Fáradt voltam, de befejeztem.");
        RitualDayResponse day = getForBody("/api/ritual/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getClosed()).isFalse();
        assertThat(day.getClosedAt()).isNull();
    }

    @Test
    void testClose_shouldCloseTheExistingOpenRow_whenAReflectionRowAlreadyExists() {
        ritualPopulator.openDay(ownerId(), LocalDate.now(), "Fáradt voltam, de befejeztem.");
        RitualDayResponse day = postForBody("/api/ritual/close",
            RitualCloseRequest.builder().date(LocalDate.now()).build(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getClosed()).isTrue();
        assertThat(day.getClosedAt()).isNotNull();
        // the close must REUSE the open row, never insert a second one (uq_ritual_day_user_date)
        assertThat(ritualDayRepository.findByCreatedByAndRitualDate(ownerId(), LocalDate.now()))
            .get().extracting(RitualDayEntity::getReflectionText)
            .isEqualTo("Fáradt voltam, de befejeztem.");
    }
```

For that last assertion add `@Autowired RitualDayRepository ritualDayRepository;` plus imports
`io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity`,
`io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository`,
`io.mrkuhne.mezo.support.populator.RitualPopulator`.

Add to `backend/src/test/java/io/mrkuhne/mezo/feature/ritual/RitualDayEntityIT.java` (follow the file's existing owner-id/populator idiom):

```java
    @Test
    void testSave_shouldPersistOpenRowWithReflection_whenClosedAtIsNull() {
        RitualDayEntity saved = ritualPopulator.openDay(ownerId(), LocalDate.now(), "Csendes nap.");
        RitualDayEntity read = ritualDayRepository.findById(saved.getId()).orElseThrow();
        assertThat(read.getClosedAt()).isNull();
        assertThat(read.getReflectionText()).isEqualTo("Csendes nap.");
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend && ./mvnw test -Dtest='RitualApiIT,RitualDayEntityIT' -Dmezo.test.use-testcontainers=true
```

Expected: compile error — `setReflectionText` does not exist on `RitualDayEntity`.

- [ ] **Step 3: Migration, entity, repository, and the three consumers**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202608211500_mezo-b3pp.2_ritual_day_reflection.sql`:

```sql
-- Phase 5 W1.2 (bd mezo-b3pp.2, spec §5.2): the Napzárás gains an optional prose reflection.
-- The reflection upserts the (created_by, ritual_date) row BEFORE the close, so a ritual_day
-- row no longer implies "the day was closed" — closed_at becomes nullable and every reader
-- moves to `closed_at is not null` (RitualService, HabitEvaluator, MetricSeriesService).
alter table ritual_day add column reflection_text text;
alter table ritual_day alter column closed_at drop not null;
```

Append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202608211500_mezo-b3pp.2_ritual_day_reflection"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608211500_mezo-b3pp.2_ritual_day_reflection.sql
```

In `RitualDayEntity.java` — drop the `@NotNull`/`nullable = false` from `closedAt` and add the column (remove the now-unused `jakarta.validation.constraints.NotNull` import only if no other field uses it; `ritualDate` still does, so keep it):

```java
    @Column(name = "closed_at")
    private Instant closedAt;

    /** The evening's prose answer to „Milyen volt a napod valójában?" (W1.2) — nullable,
     *  skipping is first-class. Written by an upsert BEFORE the close; embedded on close. */
    @Column(name = "reflection_text", columnDefinition = "text")
    private String reflectionText;
```

In `RitualDayRepository.java` add:

```java
    /** Closed-only reads (mezo-b3pp.2): a row may now exist for a reflection alone, so
     *  "the day was closed" is `closed_at is not null`, never mere row existence. */
    Optional<RitualDayEntity> findByCreatedByAndRitualDateAndClosedAtIsNotNull(UUID createdBy, LocalDate ritualDate);

    List<RitualDayEntity> findByCreatedByAndRitualDateBetweenAndClosedAtIsNotNull(
        UUID createdBy, LocalDate from, LocalDate to);

    Optional<RitualDayEntity> findFirstByCreatedByAndClosedAtIsNotNullOrderByRitualDateAsc(UUID createdBy);
```

In `RitualService.java` — `close` must reuse an existing open row, and `toResponse` must read `closedAt`:

```java
    @Transactional
    public RitualDayResponse close(UUID userId, LocalDate date) {
        if (!LocalDate.now().equals(date)) {
            throw ritualNotToday();
        }
        RitualDayEntity row = ritualDayRepository.findByCreatedByAndRitualDate(userId, date)
            .orElseGet(() -> insertOrReread(userId, date));
        if (row.getClosedAt() == null) {
            // an open row exists (a reflection was written first, mezo-b3pp.2) — stamp it closed
            row.setClosedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
            row = ritualDayRepository.saveAndFlush(row);
        }
        return toResponse(userId, date, row);
    }
```

and in `toResponse`:

```java
    private RitualDayResponse toResponse(UUID userId, LocalDate date, RitualDayEntity row) {
        LocalTime bed = sleepAnchorPort.resolve(userId).bed();
        RitualWindow window = RitualWindow.builder()
            .bedTime(bed.format(HHMM))
            .opensAt(bed.minusMinutes(properties.leadMin()).format(HHMM))
            .prepStartsAt(bed.minusMinutes(properties.prepLeadMin()).format(HHMM))
            .build();
        Instant closedAt = row == null ? null : row.getClosedAt();
        return RitualDayResponse.builder()
            .date(date)
            .closed(closedAt != null)
            .closedAt(closedAt == null ? null : OffsetDateTime.ofInstant(closedAt, ZoneOffset.UTC))
            .window(window)
            .build();
    }
```

In `HabitEvaluator.java`, the `ritual_closed` case:

```java
            case "ritual_closed" -> ritualDayRepository
                .findByCreatedByAndRitualDateAndClosedAtIsNotNull(userId, date).isPresent();
```

In `MetricSeriesService.ritualClosed`:

```java
        LocalDate adopted = ritualDayRepository.findFirstByCreatedByAndClosedAtIsNotNullOrderByRitualDateAsc(userId)
                .map(RitualDayEntity::getRitualDate).orElse(null);
        if (adopted == null) {
            return Map.of();
        }
        Set<LocalDate> closed = ritualDayRepository
                .findByCreatedByAndRitualDateBetweenAndClosedAtIsNotNull(userId, from, to).stream()
                .map(RitualDayEntity::getRitualDate)
                .collect(Collectors.toSet());
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && ./mvnw test -Dtest='RitualApiIT,RitualDayEntityIT,RitualSwitchOffIT,HabitEvaluatorIT' -Dmezo.test.use-testcontainers=true
```

Expected: PASS — including the pre-existing `testClose_shouldBeIdempotent_whenClosedTwice` (the second close finds `closedAt != null` and skips the re-stamp, so `closedAt` is unchanged).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test && git commit -m "feat(ritual): ritual_day.reflection_text + closed means closed_at is not null (mezo-b3pp.2)"
```

---

### Task 2: `PUT /api/ritual/reflection`

**Files:**
- Modify: `api/feature/ritual/ritual.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/ritual/service/RitualService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/ritual/controller/RitualController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/ritual/RitualApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/ritual/RitualSwitchOffIT.java`

**Interfaces:**
- Consumes (Task 1): `RitualDayEntity.setReflectionText`, `RitualDayRepository.findByCreatedByAndRitualDate`.
- Produces: generated DTOs `RitualReflectionRequest{LocalDate date, String text}` and `RitualDayResponse.getReflectionText()`; `RitualApi.saveRitualReflection(RitualReflectionRequest)`.
- Produces: `RitualService.saveReflection(UUID userId, LocalDate date, String text) : RitualDayResponse`.

- [ ] **Step 1: Change the contract first**

In `api/feature/ritual/ritual.yml`, add the path (after `/api/ritual/close`) and the two schema edits:

```yaml
  /api/ritual/reflection:
    put:
      tags: [Ritual]
      operationId: saveRitualReflection
      summary: Upsert the day's prose reflection before the close (Ritual)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/RitualReflectionRequest' }
      responses:
        '200':
          description: The day after the upsert (blank text clears the reflection)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/RitualDayResponse' }
        '409':
          description: RITUAL_NOT_TODAY
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

In `RitualDayResponse.properties` add:

```yaml
        reflectionText: { type: string, nullable: true, description: "The day's prose reflection (W1.2); null when skipped" }
```

And a new schema under `components.schemas`:

```yaml
    RitualReflectionRequest:
      type: object
      required: [date, text]
      properties:
        date: { type: string, format: date }
        text: { type: string, description: "Free prose; blank clears the reflection" }
```

- [ ] **Step 2: Regenerate the API**

```bash
cd api/generate && npm run generate:api
```

Then confirm the generated `RitualApi` carries `saveRitualReflection`:

```bash
grep -rn 'saveRitualReflection' backend/target/generated-sources 2>/dev/null | head -3
```

(If the generated sources land elsewhere in this repo, `grep -rn 'saveRitualReflection' backend | head -3` finds them — do not hand-write the interface.)

- [ ] **Step 3: Write the failing tests**

Add to `RitualApiIT.java`:

```java
    @Test
    void testSaveReflection_shouldUpsertAnOpenRow_whenNoRowExists() {
        RitualDayResponse day = putForBody("/api/ritual/reflection",
            RitualReflectionRequest.builder().date(LocalDate.now()).text("Nehéz nap volt, de bírtam.").build(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getReflectionText()).isEqualTo("Nehéz nap volt, de bírtam.");
        assertThat(day.getClosed()).isFalse();
    }

    @Test
    void testSaveReflection_shouldOverwrite_whenCalledTwice() {
        var first = RitualReflectionRequest.builder().date(LocalDate.now()).text("Első").build();
        putForBody("/api/ritual/reflection", first, ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        RitualDayResponse day = putForBody("/api/ritual/reflection",
            RitualReflectionRequest.builder().date(LocalDate.now()).text("Második").build(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getReflectionText()).isEqualTo("Második");
        assertThat(ritualDayRepository.findByCreatedByAndRitualDateBetween(
            ownerId(), LocalDate.now(), LocalDate.now())).hasSize(1);
    }

    @Test
    void testSaveReflection_shouldCreateNoRow_whenTextIsBlankAndNoRowExists() {
        RitualDayResponse day = putForBody("/api/ritual/reflection",
            RitualReflectionRequest.builder().date(LocalDate.now()).text("   ").build(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getReflectionText()).isNull();
        assertThat(ritualDayRepository.findByCreatedByAndRitualDate(ownerId(), LocalDate.now())).isEmpty();
    }

    @Test
    void testSaveReflection_shouldClear_whenTextIsBlankAndRowExists() {
        ritualPopulator.openDay(ownerId(), LocalDate.now(), "Valami");
        RitualDayResponse day = putForBody("/api/ritual/reflection",
            RitualReflectionRequest.builder().date(LocalDate.now()).text("").build(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getReflectionText()).isNull();
    }

    @Test
    void testSaveReflection_shouldReject_whenNotToday() {
        String err = putForBody("/api/ritual/reflection",
            RitualReflectionRequest.builder().date(LocalDate.now().minusDays(1)).text("Tegnap").build(),
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(err, "RITUAL_NOT_TODAY");
    }

    @Test
    void testGetDay_shouldServeTheReflection_whenOneWasSaved() {
        ritualPopulator.openDay(ownerId(), LocalDate.now(), "Megírtam.");
        RitualDayResponse day = getForBody("/api/ritual/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getReflectionText()).isEqualTo("Megírtam.");
    }
```

Import `io.mrkuhne.mezo.api.dto.RitualReflectionRequest`. If `ApiIntegrationTest` has no `putForBody` helper, use whatever PUT helper the base class exposes — check with:

```bash
grep -n 'putForBody\|protected .* put' backend/src/test/java/io/mrkuhne/mezo/support/ApiIntegrationTest.java
```

and mirror an existing PUT-using IT (e.g. `grep -rln 'putForBody' backend/src/test | head -3`).

Add to `RitualSwitchOffIT.java`:

```java
    @Test
    void testSaveRitualReflection_shouldReturn404_whenRitualSwitchOff() {
        putForBody("/api/ritual/reflection",
            RitualReflectionRequest.builder().date(LocalDate.now()).text("x").build(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
```

- [ ] **Step 4: Run the tests to verify they fail**

```bash
cd backend && ./mvnw test -Dtest='RitualApiIT,RitualSwitchOffIT' -Dmezo.test.use-testcontainers=true
```

Expected: compile error — `RitualController` does not implement the new `saveRitualReflection`.

- [ ] **Step 5: Implement the service + controller**

In `RitualService.java` add (keep `insertOrReread`'s race-catch idiom — this one inserts an OPEN row, so it cannot reuse that helper as-is):

```java
    /**
     * W1.2 (spec §5.2): upserts the day's prose reflection on the {@code (created_by, ritual_date)}
     * row BEFORE the close — the one deliberate relaxation of the ritual's "nothing writes before
     * act 4" invariant. Today-only, mirroring {@link #close}: the reflection is written inside the
     * evening ritual, so a wider write surface would only let past days sprout rows. Blank text is
     * a CLEAR, never a create: an abandoned textarea must leave no junk row behind.
     */
    @Transactional
    public RitualDayResponse saveReflection(UUID userId, LocalDate date, String text) {
        if (!LocalDate.now().equals(date)) {
            throw ritualNotToday();
        }
        String cleaned = text == null || text.isBlank() ? null : text.strip();
        RitualDayEntity row = ritualDayRepository.findByCreatedByAndRitualDate(userId, date).orElse(null);
        if (row == null) {
            if (cleaned == null) {
                return toResponse(userId, date, null); // nothing to write, nothing to create
            }
            row = insertOpenOrReread(userId, date);
        }
        row.setReflectionText(cleaned);
        RitualDayEntity saved = ritualDayRepository.saveAndFlush(row);
        if (saved.getClosedAt() != null) {
            // the prose was edited AFTER the close — re-embed so the vector never goes stale
            eventPublisher.publishEvent(new RitualClosedEvent(saved.getId()));
        }
        return toResponse(userId, date, saved);
    }

    private RitualDayEntity insertOpenOrReread(UUID userId, LocalDate date) {
        try {
            RitualDayEntity e = new RitualDayEntity();
            e.setCreatedBy(userId);
            e.setRitualDate(date);
            return ritualDayRepository.saveAndFlush(e); // closed_at stays null — an OPEN row
        } catch (DataIntegrityViolationException ex) {
            // lost the race against a concurrent close()/saveReflection() — the row exists now
            return ritualDayRepository.findByCreatedByAndRitualDate(userId, date).orElseThrow();
        }
    }
```

Add `private final ApplicationEventPublisher eventPublisher;` to the service's fields and import
`org.springframework.context.ApplicationEventPublisher` — Task 3 creates `RitualClosedEvent`, so
write Task 3's event record FIRST if compiling this task standalone (it is a 6-line record; see
Task 3 Step 3). Also add `reflectionText` to `toResponse`'s builder:

```java
            .reflectionText(row == null ? null : row.getReflectionText())
```

In `RitualController.java`:

```java
    @Override
    public RitualDayResponse saveRitualReflection(RitualReflectionRequest request) {
        return ritualService.saveReflection(currentUserId.get(), request.getDate(), request.getText());
    }
```

with the `io.mrkuhne.mezo.api.dto.RitualReflectionRequest` import.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd backend && ./mvnw test -Dtest='RitualApiIT,RitualSwitchOffIT,RitualDayEntityIT' -Dmezo.test.use-testcontainers=true
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api backend/src && git commit -m "feat(api): PUT /api/ritual/reflection upserts the day's prose (mezo-b3pp.2)"
```

---

### Task 3: Embed the reflection on close

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/ritual/service/RitualClosedEvent.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/ReflectionEmbeddingListener.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/ritual/RitualReflectionEmbeddingIT.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryEmbeddingEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/ritual/service/RitualService.java` (publish on the closing stamp)

**Interfaces:**
- Consumes (Task 1): `RitualDayEntity.getReflectionText()`, `getRitualDate()`, `getCreatedBy()`.
- Consumes (Task 2): `RitualService.saveReflection` already publishes `RitualClosedEvent` for post-close edits.
- Produces: `MemoryEmbeddingEntity.KIND_REFLECTION = "reflection"` (already legal in the kind CHECK — the W1.1 migration `202608181610_mezo-b3pp.1_expand_memory_embedding_kinds.sql` listed it; **no new migration**).
- Produces: `MemoryEmbeddingWriter.writeReflection(RitualDayEntity day) : void`.
- Produces: `RitualClosedEvent(UUID ritualDayId)`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/ritual/RitualReflectionEmbeddingIT.java`. Mirror the existing journal embedding IT's shape — find it and copy its `EmbeddingPort` stubbing and await idiom:

```bash
grep -rln 'writeJournal\|JournalEmbeddingListener\|KIND_JOURNAL_ENTRY' backend/src/test | head -5
```

The test must pin exactly these three behaviours:

```java
    @Test
    void testClose_shouldEmbedTheReflection_whenProseWasWritten() {
        // PUT the reflection, then close; await the @Async AFTER_COMMIT listener
        // → exactly ONE memory_embedding row with kind=reflection, ref_id = the ritual_day id,
        //   occurred_on = the ritual date, content = the prose.
    }

    @Test
    void testClose_shouldEmbedNothing_whenTheReflectionWasSkipped() {
        // close with no reflection → zero memory_embedding rows of kind=reflection.
    }

    @Test
    void testSaveReflection_shouldNotEmbed_beforeTheClose() {
        // PUT the reflection only → zero reflection vectors until the close fires.
    }
```

Write these out fully against the journal IT's helpers (owner id, populators, the awaiting assertion — `await()` / `Awaitility` or whatever that IT uses; do not invent a new waiting idiom).

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='RitualReflectionEmbeddingIT' -Dmezo.test.use-testcontainers=true
```

Expected: FAIL — no `reflection` vector is ever written.

- [ ] **Step 3: The event, the writer method, the listener, the publication**

Create `RitualClosedEvent.java`:

```java
package io.mrkuhne.mezo.feature.ritual.service;

import java.util.UUID;

/**
 * Published AFTER_COMMIT when a Napzárás day is closed (bd mezo-b3pp.2, spec §5.2) — and again
 * when an already-closed day's reflection is edited, so the vector never goes stale. The
 * companion's {@code ReflectionEmbeddingListener} consumes it and embeds the day's prose.
 *
 * <p>No {@code userId} field — mezo is single-user and the listener re-reads the row by id
 * (the {@code JournalEntrySavedEvent} precedent).
 */
public record RitualClosedEvent(UUID ritualDayId) {
}
```

In `MemoryEmbeddingEntity.java` add next to the other kinds:

```java
    public static final String KIND_REFLECTION = "reflection";
```

In `MemoryEmbeddingWriter.java` add (import `io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity`):

```java
    /**
     * W1.2 evening reflection (spec §5.2): the day's prose, embedded when the ritual closes.
     * Update-in-place on the live {@code (kind, ref_id)} row — a post-close edit re-embeds the
     * SAME row rather than leaving a stale vector (the {@link #writeJournal} idiom). A blank or
     * cleared reflection is not embeddable: any existing vector is soft-deleted so a skipped
     * (or erased) evening is never recallable.
     */
    @Transactional
    public void writeReflection(RitualDayEntity day) {
        String text = day.getReflectionText();
        if (text == null || text.isBlank()) {
            memoryEmbeddingRepository
                    .findByKindAndRefId(MemoryEmbeddingEntity.KIND_REFLECTION, day.getId())
                    .ifPresent(memoryEmbeddingRepository::delete); // @SQLDelete → soft delete
            return;
        }
        memoryEmbeddingRepository
                .findByKindAndRefId(MemoryEmbeddingEntity.KIND_REFLECTION, day.getId())
                .ifPresentOrElse(existing -> {
                    String capped = cap(text);
                    float[] vector = llmCallContextHolder.runWith(
                            new LlmCallContext("embed_memory", "document",
                                    MemoryEmbeddingEntity.KIND_REFLECTION, day.getId()),
                            () -> embeddingPort.embedDocuments(List.of(capped))).getFirst();
                    existing.setContent(capped);
                    existing.setEmbedding(vector);
                    existing.setOccurredOn(day.getRitualDate());
                    memoryEmbeddingRepository.saveAndFlush(existing);
                }, () -> write(day.getCreatedBy(), MemoryEmbeddingEntity.KIND_REFLECTION,
                        day.getId(), text, day.getRitualDate()));
    }
```

Create `ReflectionEmbeddingListener.java`:

```java
package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity;
import io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository;
import io.mrkuhne.mezo.feature.ritual.service.RitualClosedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * W1.2 (spec §5.2): after a Napzárás close commits — or a closed day's prose is edited — embed the
 * day's reflection into {@code memory_embedding(kind=reflection)}. The {@code
 * JournalEmbeddingListener} idiom: gated on BOTH the companion and the ritual switch (either off ⇒
 * this bean does not exist, so no embed call can happen), and failures are logged and swallowed —
 * memory building must never break the ritual close (IDENT-3).
 *
 * <p>Unlike journal there is no create-then-fast-edit race to retry: the reflection is embedded
 * only on close (and on a post-close edit), never on every keystroke-save, so concurrent inserts
 * for the same {@code (kind, ref_id)} are not a realistic path. A lost race would surface as the
 * swallowed warning below and heal on the next edit.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.RITUAL_SWITCH},
        havingValue = "true")
public class ReflectionEmbeddingListener {

    private final MemoryEmbeddingWriter memoryEmbeddingWriter;
    private final RitualDayRepository ritualDayRepository;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onRitualClosed(RitualClosedEvent event) {
        try {
            RitualDayEntity day = ritualDayRepository.findById(event.ritualDayId()).orElse(null);
            if (day == null) {
                return; // @SQLRestriction already hides soft-deleted rows
            }
            memoryEmbeddingWriter.writeReflection(day);
        } catch (Exception e) {
            log.warn("Reflection embedding failed for ritual day {}", event.ritualDayId(), e);
        }
    }
}
```

In `RitualService.close`, publish on the stamp (inside the `if (row.getClosedAt() == null)` branch added in Task 1, after `saveAndFlush`):

```java
        if (row.getClosedAt() == null) {
            row.setClosedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
            row = ritualDayRepository.saveAndFlush(row);
            eventPublisher.publishEvent(new RitualClosedEvent(row.getId()));
        }
```

and in `insertOrReread`'s successful-insert path — that helper creates an already-closed row, so
publish there too. Restructure `close` so exactly one publication happens per *first* close:

```java
    @Transactional
    public RitualDayResponse close(UUID userId, LocalDate date) {
        if (!LocalDate.now().equals(date)) {
            throw ritualNotToday();
        }
        RitualDayEntity row = ritualDayRepository.findByCreatedByAndRitualDate(userId, date)
            .orElseGet(() -> insertOrReread(userId, date));
        if (row.getClosedAt() == null) {
            row.setClosedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
            row = ritualDayRepository.saveAndFlush(row);
            eventPublisher.publishEvent(new RitualClosedEvent(row.getId()));
        } else if (!wasAlreadyClosedBefore) {
            eventPublisher.publishEvent(new RitualClosedEvent(row.getId()));
        }
        return toResponse(userId, date, row);
    }
```

**Simplify that to avoid the flag** — have `insertOrReread` return an OPEN row and let the single
stamp branch below own both the closing and the publication:

```java
    @Transactional
    public RitualDayResponse close(UUID userId, LocalDate date) {
        if (!LocalDate.now().equals(date)) {
            throw ritualNotToday();
        }
        RitualDayEntity row = ritualDayRepository.findByCreatedByAndRitualDate(userId, date)
            .orElseGet(() -> insertOpenOrReread(userId, date));
        if (row.getClosedAt() == null) {
            row.setClosedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
            row = ritualDayRepository.saveAndFlush(row);
            // exactly one publication per FIRST close — a repeat close short-circuits above
            eventPublisher.publishEvent(new RitualClosedEvent(row.getId()));
        }
        return toResponse(userId, date, row);
    }
```

Delete the now-unused `insertOrReread` (Task 2's `insertOpenOrReread` replaces it). Keep its
`DataIntegrityViolationException` re-read comment on the surviving helper.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend && ./mvnw test -Dtest='RitualReflectionEmbeddingIT,RitualApiIT,RitualSwitchOffIT,RitualDayEntityIT' -Dmezo.test.use-testcontainers=true
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src && git commit -m "feat(companion): embed the Napzárás reflection on close (mezo-b3pp.2)"
```

---

### Task 4: Frontend data layer

**Files:**
- Modify: `frontend/src/data/types.ts:1227`
- Modify: `frontend/src/data/ritual/ritualApi.ts`
- Modify: `frontend/src/data/ritual/ritualMock.ts`
- Modify: `frontend/src/data/ritual/ritualHooks.ts`
- Test: `frontend/src/data/ritual/ritualHooks.test.tsx`

**Interfaces:**
- Consumes (Task 2): the regenerated `components['schemas']['RitualDayResponse'].reflectionText`.
- Produces: `RitualDay { date, closed, closedAt, reflectionText: string | null, window }`.
- Produces: `ritualApi.saveReflection(date: string, text: string) : Promise<RitualDay>`.
- Produces: `useRitualActions(date)` returns `{ close, saveReflection, pending }` where `saveReflection: (text: string) => Promise<RitualDay>`.

- [ ] **Step 1: Regenerate the FE API types**

```bash
cd frontend && pnpm generate:api
```

Verify:

```bash
grep -n 'reflectionText\|RitualReflectionRequest' frontend/src/data/_client/api.gen.ts | head -5
```

- [ ] **Step 2: Write the failing tests**

Add to `frontend/src/data/ritual/ritualHooks.test.tsx` (follow the file's existing mock/real describe split and its MSW real-mode idiom exactly):

```tsx
  it('mock: saveReflection patches the ritualDay cache', async () => {
    const { result } = renderHook(() => useRitualActions('2026-05-21'), { wrapper })
    await act(async () => { await result.current.saveReflection('Nehéz nap volt.') })
    expect(qc.getQueryData<RitualDay>(['ritualDay', '2026-05-21'])?.reflectionText)
      .toBe('Nehéz nap volt.')
  })

  it('real: saveReflection PUTs the prose and refreshes the day', async () => {
    // MSW: put('/api/ritual/reflection') → { date, closed:false, closedAt:null,
    //      reflectionText: 'Nehéz nap volt.', window: {...} }
    const { result } = renderHook(() => useRitualActions('2026-05-21'), { wrapper })
    await act(async () => { await result.current.saveReflection('Nehéz nap volt.') })
    expect(await putBody()).toEqual({ date: '2026-05-21', text: 'Nehéz nap volt.' })
  })
```

Fill `putBody()` in with whatever request-capture helper the file's real-mode block already uses
(read the existing `close` real-mode test in the same file and mirror it).

- [ ] **Step 3: Run to verify failure**

```bash
cd frontend && pnpm test -- ritualHooks
```

Expected: FAIL — `saveReflection` is not a function.

- [ ] **Step 4: Implement**

`frontend/src/data/types.ts:1227` becomes:

```ts
export interface RitualDay { date: string; closed: boolean; closedAt: string | null; reflectionText: string | null; window: RitualWindow }
```

`frontend/src/data/ritual/ritualApi.ts`:

```ts
const toDay = (w: Wire): RitualDay => ({
  date: w.date,
  closed: w.closed,
  closedAt: w.closedAt ?? null,
  reflectionText: w.reflectionText ?? null,
  window: { opensAt: w.window.opensAt, prepStartsAt: w.window.prepStartsAt, bedTime: w.window.bedTime },
})

export const ritualApi = {
  day: async (date: string) => toDay(await apiFetch<Wire>(`/api/ritual/day/${date}`)),
  close: async (date: string) =>
    toDay(await apiFetch<Wire>('/api/ritual/close', { method: 'POST', body: JSON.stringify({ date }) })),
  saveReflection: async (date: string, text: string) =>
    toDay(await apiFetch<Wire>('/api/ritual/reflection', { method: 'PUT', body: JSON.stringify({ date, text }) })),
}
```

`frontend/src/data/ritual/ritualMock.ts` — add `reflectionText: null` to BOTH `mockRitualDay` and `EMPTY_RITUAL_DAY`.

`frontend/src/data/ritual/ritualHooks.ts` — add a second mutation inside `useRitualActions` and widen its return type:

```ts
export function useRitualActions(
  date: string,
): {
  close: (rings?: NeedsRingsWire) => Promise<RitualDay>
  saveReflection: (text: string) => Promise<RitualDay>
  pending: boolean
} {
```

and, next to the existing `mutation`:

```ts
  // W1.2 (mezo-b3pp.2): the prose reflection upserts BEFORE the close — the one write the ritual
  // performs before act 5. Mock mode patches the ritualDay cache directly (no server round trip);
  // real mode PUTs and lets the response reseed the cache.
  const reflectionMutation = useMutation({
    mutationFn: async (text: string): Promise<RitualDay> => {
      if (mock) {
        const prev = qc.getQueryData<RitualDay>(['ritualDay', date]) ?? mockRitualDay(date)
        const next = { ...prev, reflectionText: text.trim() || null }
        qc.setQueryData(['ritualDay', date], next)
        return next
      }
      const day = await ritualApi.saveReflection(date, text)
      qc.setQueryData(['ritualDay', date], day)
      return day
    },
  })
```

and return it:

```ts
  return {
    close: (rings?: NeedsRingsWire) => mutation.mutateAsync(rings),
    saveReflection: (text: string) => reflectionMutation.mutateAsync(text),
    pending: mutation.isPending || reflectionMutation.isPending,
  }
```

- [ ] **Step 5: Run both modes**

```bash
cd frontend && pnpm test -- ritualHooks && VITE_USE_MOCK=true pnpm test -- ritualHooks
```

Expected: PASS in both.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data && git commit -m "feat(fe): ritual reflection data layer, dual-mode (mezo-b3pp.2)"
```

---

### Task 5: The sixth act — `ReflectionStep`

**Files:**
- Create: `frontend/src/features/ritual/components/ReflectionStep.tsx`
- Create: `frontend/src/features/ritual/components/ReflectionStep.test.tsx`
- Modify: `frontend/src/features/ritual/pages/RitualPage.tsx`
- Test: `frontend/src/features/ritual/pages/RitualPage.test.tsx`

**Interfaces:**
- Consumes (Task 4): `useRitualActions(date).saveReflection(text)`, `useRitualDay(date).data.reflectionText`.
- Produces: `<ReflectionStep onNext={() => void} />` — owns its own textarea state, seeds from the day's existing `reflectionText`, and calls `saveReflection` itself. `onNext` only advances the act.

**HU copy (byte-exact):** eyebrow „Ma milyen volt", headline „Milyen volt a napod valójában?", placeholder „Írd le, ahogy volt — senki más nem olvassa…", primary CTA „Tovább", skip „Ma nem írok".

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/ritual/components/ReflectionStep.test.tsx` (mirror `DayStoryStep.test.tsx`'s render harness — same providers/wrapper):

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReflectionStep } from '@/features/ritual/components/ReflectionStep'
// + the same wrapper/provider imports DayStoryStep.test.tsx uses

describe('ReflectionStep', () => {
  it('advances without writing anything when skipped', async () => {
    const onNext = vi.fn()
    render(<ReflectionStep onNext={onNext} />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: 'Ma nem írok' }))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('advances on Tovább with an empty textarea and writes nothing', async () => {
    const onNext = vi.fn()
    render(<ReflectionStep onNext={onNext} />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: 'Tovább' }))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('saves the prose and advances on Tovább', async () => {
    const onNext = vi.fn()
    render(<ReflectionStep onNext={onNext} />, { wrapper })
    await userEvent.type(screen.getByRole('textbox', { name: /napod/i }), 'Nehéz nap volt.')
    await userEvent.click(screen.getByRole('button', { name: 'Tovább' }))
    expect(onNext).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(qc.getQueryData<RitualDay>(['ritualDay', today])?.reflectionText).toBe('Nehéz nap volt.')
    })
  })
})
```

Wire `qc`/`today`/`wrapper` the way the sibling ritual component tests do (read `LoopsStep.test.tsx` — it is the one that also performs writes).

Update `frontend/src/features/ritual/pages/RitualPage.test.tsx`: every assertion that walks the acts gains one step, and the close assertion moves to act 5. Change the existing "close fires exactly once on entering act 4" test to act 5, and add:

```tsx
  it('renders six progress dots', () => {
    render(<RitualPage />, { wrapper })
    expect(document.querySelectorAll('.rz-dot')).toHaveLength(6)
  })

  it('reaches the reflection act after A napod íve and writes nothing when skipped', async () => {
    render(<RitualPage />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: 'Kezdjük 🌙' }))
    await userEvent.click(screen.getByRole('button', { name: 'Tovább' }))   // act 2 → 3
    expect(screen.getByText('Milyen volt a napod valójában?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ma nem írok' }))
    expect(screen.getByText('Nyitott hurkok')).toBeInTheDocument()          // act 4
  })
```

(Use whatever text `LoopsStep` actually renders as its heading — check it before writing the last assertion.)

- [ ] **Step 2: Run to verify failure**

```bash
cd frontend && pnpm test -- ReflectionStep RitualPage
```

Expected: FAIL — module `ReflectionStep` not found.

- [ ] **Step 3: Implement `ReflectionStep`**

```tsx
import { useState } from 'react'
import { useRitualActions, useRitualDay } from '@/data/hooks'
import { useVoiceInput } from '@/features/insights/logic/useVoiceInput'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'

/**
 * Napzárás act 3 — „Ma milyen volt" (Phase 5 W1.2, mezo-b3pp.2, spec §5.2). The one act that
 * writes BEFORE the close: `PUT /api/ritual/reflection` upserts the day's prose onto the
 * `(created_by, ritual_date)` row, which is why `closed` now means `closed_at is not null`
 * rather than "a row exists" (see ritual.md §4).
 *
 * Nothing here is mandatory and nothing here may block the flow (IDENT-3): „Ma nem írok" skips
 * in one tap and writes nothing, an empty „Tovább" is identical, and the save is fire-and-forget
 * — the act advances immediately whether or not the PUT lands. The prose seeds from the day's
 * existing `reflectionText`, so re-entering the act after a back-out shows what was written.
 *
 * The W1.3 gratitude rows join this act below the textarea (spec §5.2's "combined writing act",
 * ONE act, both parts optional); until that slice lands the gratitude half simply isn't rendered.
 */
export function ReflectionStep({ onNext }: { onNext: () => void }) {
  const date = localDateString()
  const { data } = useRitualDay(date)
  const { saveReflection } = useRitualActions(date)
  const [text, setText] = useState(data.reflectionText ?? '')
  // Same append-to-what's-typed idiom as JournalSheet/ChatPage's composer (useVoiceInput.ts).
  const voice = useVoiceInput((t) => setText((d) => (d ? `${d} ${t}` : t)))
  const recording = voice.state === 'recording'

  const advance = () => {
    if (text.trim()) {
      // fire-and-forget: a failed save must never trap the user inside the ritual
      void saveReflection(text.trim()).catch(() => {})
    }
    onNext()
  }

  return (
    <div className="rz-act rz-reflect">
      <div className="rz-story-eyebrow">Ma milyen volt</div>
      <h2 className="rz-reflect-title">Milyen volt a napod valójában?</h2>
      <div className="rz-reflect-box">
        <textarea
          className="rz-reflect-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Milyen volt a napod valójában?"
          placeholder="Írd le, ahogy volt — senki más nem olvassa…"
        />
        <button
          type="button"
          className={cn('chip rz-reflect-mic', recording && 'chat-mic-live')}
          onClick={voice.toggle}
          disabled={voice.state === 'unsupported' || voice.state === 'transcribing'}
          aria-label={recording ? 'Felvétel leállítása' : 'Hangbevitel'}
          aria-pressed={recording}
        >
          <Icon name={recording ? 'voice-wave' : 'mic'} size={14} />
        </button>
      </div>
      <button className="rz-cta" onClick={advance}>Tovább</button>
      <button className="rz-skip" onClick={onNext}>Ma nem írok</button>
    </div>
  )
}
```

Add the three new classes to `frontend/src/prototype.css` in the `rz-*` family, next to the other
act styles. They must be **static** (no animation) — the reduced-motion guard
(`features/ritual/reducedMotionGuard.test.ts`) fails the build on any new unguarded `rz-*`
animation, and this act deliberately has none:

```css
.rz-reflect-title { font-family: var(--font-display); font-size: 22px; line-height: 1.3; text-align: center; margin: 8px 24px 18px; color: var(--rz-text, #f3f1ee); }
.rz-reflect-box { position: relative; width: 100%; padding: 0 20px; }
.rz-reflect-input { width: 100%; min-height: 160px; resize: none; font-size: 16px; line-height: 1.5; padding: 14px 40px 14px 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.05); color: inherit; }
.rz-reflect-mic { position: absolute; top: 10px; right: 30px; padding: 8px; }
.rz-skip { background: none; border: none; color: rgba(255,255,255,.55); font-size: 13px; padding: 10px; margin-top: 6px; }
```

Match the surrounding file's existing custom-property names when you write these — read the
`.rz-cta`/`.rz-act` rules first and reuse their tokens rather than the placeholders above where
the file already defines one.

Then `RitualPage.tsx`:

```tsx
const ACT_COUNT = 6
```

```tsx
      {act === 1 && <ArrivalStep onNext={() => setAct(2)} />}
      {act === 2 && <DayStoryStep onNext={() => setAct(3)} />}
      {act === 3 && <ReflectionStep onNext={() => setAct(4)} />}
      {act === 4 && (
        <LoopsStep
          onNext={() => setAct(5)}
          onOpenCheckIn={() => setCheckInIdx(nextCheckinIdx)}
          onOpenJournal={() => setJournalOpen(true)}
        />
      )}
      {act === 5 && <HarvestStep onNext={() => setAct(6)} />}
      {act === 6 && (
        <ReleaseStep
          prepStartsAt={data.window.prepStartsAt}
          bedTime={data.window.bedTime}
          closingNote={closingNote}
          onFinish={() => navigate('/today')}
        />
      )}
```

and the close effect's guard:

```tsx
    if (act === 5 && !closedRef.current) {
```

with its dependency array unchanged. Update the file's doc comment: "a 5-act state machine" → "a
6-act state machine", and the "Nothing writes anything before act 4" sentence becomes:

```
 * The ONLY write before the Harvest act is the optional prose reflection in act 3
 * (`ReflectionStep`, W1.2) — an idempotent upsert that cannot conflict with the close, which
 * only stamps `closed_at`. The ✕ exit stays consequence-free otherwise: entering act 5 is
 * still the close.
```

Add the import: `import { ReflectionStep } from '@/features/ritual/components/ReflectionStep'`.

- [ ] **Step 4: Run both modes**

```bash
cd frontend && pnpm test -- ReflectionStep RitualPage reducedMotionGuard && VITE_USE_MOCK=true pnpm test -- ReflectionStep RitualPage reducedMotionGuard
```

Expected: PASS in both.

- [ ] **Step 5: Full frontend gate**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: all green. Fix any sibling test that counted five acts/dots.

- [ ] **Step 6: Commit**

```bash
git add frontend/src && git commit -m "feat(fe): the Napzárás gains a prose reflection act (mezo-b3pp.2)"
```

---

### Task 6: Visual goldens

**Files:**
- Modify: `frontend/tests/visual/visual.spec.ts`
- Modify: `frontend/tests/visual/*-snapshots/**` (regenerated, not hand-edited)

- [ ] **Step 1: Add the extra advance click**

In the `ritual-harvest` test, the walk is now four clicks. Replace the three-click block with:

```ts
      await page.getByRole('button', { name: 'Kezdjük 🌙' }).click()  // act 1 → 2
      await page.getByRole('button', { name: 'Tovább' }).click()       // act 2 → 3
      await page.getByRole('button', { name: 'Ma nem írok' }).click()  // act 3 → 4 (reflection skipped)
      await page.getByRole('button', { name: 'Tovább' }).click()       // act 4 → 5
```

and update the test's doc comment: the walk is Arrival → A napod íve → Ma milyen volt → Nyitott
hurkok → Termés, and the reflection act is deliberately **skipped** (not typed into) so the shot
stays deterministic. Also update the file header comment — the act numbering it cites (`act 1` /
`act 4`) becomes `act 1` / `act 5`.

- [ ] **Step 2: Regenerate the darwin baselines**

```bash
cd frontend && pnpm test:visual:update
```

Expected: `ritual-arrival-{light,dark}.png` move (5 → 6 progress dots) and `ritual-harvest-*` may
move by a dot too. **Inspect the diffs before accepting** — nothing outside the ritual shots
should change; if another screen moved, that is a regression from Task 5, not a baseline update.

- [ ] **Step 3: Commit**

```bash
git add frontend/tests && git commit -m "test(visual): rebaseline the /ritual shots for the 6-act flow (mezo-b3pp.2)"
```

The **linux** baselines come from CI after the branch is pushed — see the Ship section below.

---

### Task 7: Documentation

**Files:**
- Modify: `docs/features/ritual.md` (§2, §4, §5, §8, §9, §10)
- Modify: `docs/features/companion.md` (the embedding-seam table, near the `Decision embedding seam` row at :583)
- Modify: `docs/CODEMAP.md` (generated)

- [ ] **Step 1: Update `ritual.md`**

- **§2 heading** — „The 5 acts … `act: 1..5`, progress dots `● ● ○ ○ ○`" becomes „The 6 acts … `act: 1..6`, progress dots `● ● ○ ○ ○ ○`". Insert the new act 3 and renumber 3→4, 4→5, 5→6 **in the prose too** (the act-4 close references inside the Termés paragraph become act 5).
- **New act-3 bullet:**
  > 3. **Ma milyen volt** (`ReflectionStep.tsx`, W1.2 / `mezo-b3pp.2`) — one textarea under „Milyen volt a napod valójában?", voice input via `useVoiceInput`, seeded from the day's existing `reflectionText`. „Tovább" fire-and-forget-`PUT`s the prose (a failed save never traps the user); „Ma nem írok" skips in one tap and writes nothing. This is the **one write before the Harvest act** — an idempotent upsert on `(created_by, ritual_date)` that cannot conflict with the close, which only stamps `closed_at`. The W1.3 gratitude rows join this same act below the textarea when that slice lands (spec §5.2's combined writing act).
- **Replace** „**Nothing is written before act 4.**" with the honest version: the ✕ exit is consequence-free except for a reflection the user explicitly saved in act 3; no close fires before act 5.
- **§4** — the `ritual_day` sentence gains `reflection_text text` and `closed_at timestamptz **nullable**`, with the migration link `202608211500_mezo-b3pp.2_ritual_day_reflection.sql`. Add the row to the endpoint table:
  > | `PUT /api/ritual/reflection` (`{date, text}`) | `saveRitualReflection` | `RitualDayResponse` — blank text clears the reflection, and creates no row when none exists | 409 `RITUAL_NOT_TODAY` |
  and extend `RitualDayResponse`'s shape in the `GET`/`POST` rows with `reflectionText?`. Update the **FE types** line: `RitualDay { date, closed, closedAt, reflectionText, window }`.
- **§4, new paragraph — the closure predicate:**
  > **`closed` means `closed_at is not null`, not "a row exists" (`mezo-b3pp.2`).** Before W1.2 the `ritual_day` row *was* the closure record; the reflection upsert can now create the row hours before the close, so three readers moved together: `RitualService.toResponse`, `HabitEvaluator`'s `ritual_closed` metric (`findByCreatedByAndRitualDateAndClosedAtIsNotNull`), and `MetricSeriesService.ritualClosed` (`findFirstByCreatedByAndClosedAtIsNotNullOrderByRitualDateAsc` + `findByCreatedByAndRitualDateBetweenAndClosedAtIsNotNull`). Any future `ritual_day` reader must use a closed-only finder — a plain `findByCreatedByAndRitualDate` now answers "did the evening start", not "did the day close".
- **§5** — add a `→ Companion (memory)` bullet: the close publishes `RitualClosedEvent`; `ReflectionEmbeddingListener` (`@Async` AFTER_COMMIT, gated `COMPANION_SWITCH` + `RITUAL_SWITCH`) calls `MemoryEmbeddingWriter.writeReflection` → `memory_embedding(kind=reflection, ref_id=ritual_day.id, occurred_on=ritual_date)`. A post-close edit re-publishes and re-embeds in place; a cleared reflection soft-deletes the vector. Failures are logged and swallowed — memory never breaks the close (IDENT-3). Link [`companion.md`](companion.md).
- **§8** — add `RitualReflectionEmbeddingIT` and the new `RitualApiIT` cases to the backend list; add `ReflectionStep.test.tsx` to the FE list; note the 6-act `RitualPage.test.tsx` progression and that the visual `ritual-harvest` walk now skips the reflection act.
- **§9** — add a decisions bullet: today-only reflection writes (mirroring the close's guard), blank-is-a-clear, embed-on-close-not-per-keystroke, and that the gratitude half of the combined act is deferred to W1.3.
- **§10** — add `components/ReflectionStep.tsx`, `service/RitualClosedEvent.java`, `companion/embedding/ReflectionEmbeddingListener.java`, the migration, and the two new test files.

- [ ] **Step 2: Update `companion.md`**

Add a row to the seam table right after the `Decision embedding seam` row:

```markdown
| Reflection embedding seam | ✅ `mezo-b3pp.2` | A FIFTH `memory_embedding` kind, `reflection`: the Napzárás evening prose (`ritual_day.reflection_text`). `ReflectionEmbeddingListener` (AFTER_COMMIT/`@Async`, `COMPANION_SWITCH`+`RITUAL_SWITCH` gated) consumes `RitualClosedEvent` → `MemoryEmbeddingWriter.writeReflection`, embedding **on close** rather than per keystroke-save; a post-close edit re-embeds the same `(kind, ref_id)` row in place, and clearing the prose soft-deletes the vector. Full detail: [`ritual.md`](ritual.md). |
```

- [ ] **Step 3: Regenerate CODEMAP and lint**

```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs
```

Expected: lint clean, **no new staleness**. Fix anything it reports.

- [ ] **Step 4: Commit**

```bash
git add docs && git commit -m "docs(ritual): the 6-act flow, the closure predicate, the reflection embed seam (mezo-b3pp.2)"
```

---

## Ship

- [ ] **Backend focused gate**

```bash
cd backend && ./mvnw clean test -Dtest='Ritual*IT,HabitEvaluatorIT,MetricSeries*IT,*EmbeddingIT' -Dmezo.test.use-testcontainers=true
```

- [ ] **Frontend gate, both modes**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

- [ ] **Push + self-PR (the CI gate)**

```bash
git push -u origin feat/evening-reflection && gh pr create --fill
```

- [ ] **Linux visual baselines** (only if the darwin goldens moved, which they will)

```bash
gh workflow run update-visual-baselines.yml -r feat/evening-reflection
```

Then `git fetch` and merge the **origin** branch (the bot commit exists only there). If the bot
commit's CI is `action_required`, approve it:

```bash
gh api -X POST repos/mrkuhne/mezo/actions/runs/<run-id>/approve
```

- [ ] **Wait for green, then merge**

```bash
gh pr checks <PR#> --watch
```

Then, in the PRIMARY repo (never `cd` there from this worktree's shell for anything else):

```bash
git -C /Users/mrkuhne/Applications/Personal/Mezo/mezo pull --rebase
```

merge `--no-ff`, push, `bd close mezo-b3pp.2 && bd dolt push`, delete the branch locally + remote,
and confirm `git status` is "up to date with origin" in both places.

---

## Self-review notes

- **Spec §5.2 coverage:** `reflection_text` column → Task 1. Contract DTO `reflectionText` + `PUT /api/ritual/reflection` upsert-before-close → Task 2. Embed on close with `kind=reflection`, `ref_id=ritual_day.id`, via `RitualClosedEvent` + AFTER_COMMIT listener → Task 3. `ReflectionStep` inserted after DayStory, `ACT_COUNT` 5→6, one-tap skip, empty advance unpenalized, nothing blocks the close → Task 5. Acceptance ("reflection lands on `ritual_day` + one `memory_embedding(kind=reflection)` after close; skipping writes nothing; the close still fires exactly once") → the three `RitualReflectionEmbeddingIT` cases plus `RitualPage.test.tsx`'s close-once assertion.
- **Spec §11 coverage:** contract-first (Task 2 Step 1 precedes any code), `LlmCallContextHolder` on the one new embed call (Task 3), integration-first tests throughout, no new table so no `ResetDatabase` change, docs in the same change (Task 7) with `lint-docs.mjs`.
- **The W1.3 seam:** the gratitude half of the combined act is explicitly *not* built here; `ReflectionStep`'s doc comment names where it lands so the next slice has an anchor.
- **Not in this slice (correctly):** `mezo.companion.journal.decision-review-days` and every other W1.1/W1.4 tunable; the reflection needs no config value of its own.
