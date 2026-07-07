# Proactive H1 — In-app Heartbeat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The companion is present during the day — a `heartbeat_note` table + window-scheduled cheap-tier generation (midday nudge + evening closing) + `GET /api/proactive/heartbeat?date=` + a new `CompanionNoteCard` on Today (honest absence otherwise).

**Architecture:** A fourth proactive surface in `feature/proactive/`, following the shipped B/W templates: the generator is the **weekly-suggestion prose idiom at the cheap tier** (pure-code gather → ONE `CompanionLlm.complete` call → flat text, honest-null); the job is the three-switch cron idiom with **two `@Scheduled` methods** (one per window); the read is persisted-row + **lazy generation of the latest elapsed window** (window fire-times derived from the SAME cron config via Spring `CronExpression` — no duplicated time config). FE mirrors `briefingHooks` (mock = null ⇒ byte-parity; the mock Today has no such card).

**Tech Stack:** Spring Boot 4 / Java 21 / Liquibase / MapStruct / React 19 / TanStack Query / Vitest+MSW.

**Driving bd:** `mezo-h4wp.5` · Roadmap §H1 · Design spec §5 (H1) — read both first.

## Global Constraints

- Every new backend bean: `@ConditionalOnProperty(name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH}, havingValue = "true")`; the job adds `HEARTBEAT_JOB_SWITCH` as a third name.
- Contract-first: `api/feature/proactive/proactive.yml` BEFORE code; never hand-write boundary DTOs.
- No fabricated numbers; empty narrative memory ⇒ NO row ⇒ 404 (the §9-gotcha-d emptiness gate).
- Marker literal-mirror rule (§9 gotcha a): `HEARTBEAT_MARKER` in the generator, `HEARTBEAT_MARKER_MIRROR` copy in `FakeCompanionLlm`, prefix-collision-checked against `REGGELI-BRIEFING-FELADAT` / `HETI-TERVJAVASLAT` / `HETI-MEMOIR-FELADAT`.
- Cheap tier: `companionLlm.complete(...)` (NOT `completeSmart` — the model-tier policy: Flash for daily generations).
- FE: hooks from `@/data/hooks` only; new component is **`CompanionNoteCard`** (the check-in strip owns the "Heartbeat" copy — never reuse that name); mock mode stays byte-identical to Phase-1 (no card).
- Column name is `window_key` (NOT `window` — reserved word in Postgres window functions).
- Backend gate: `./mvnw clean test` (compose up). FE gate: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.

## In-slice decisions (resolved now, documented in proactive.md §9 at close)

- **(p) Two windows v1:** `midday` (kind `nudge`, cron `0 30 12 * * *`) + `evening` (kind `closing`, cron `0 30 20 * * *`), each a config cron under `mezo.proactive.heartbeat.*`. The "window list" is these two explicit records — YAGNI on a dynamic list.
- **(q) Briefing overlap-dedupe:** the gather injects today's persisted briefing body under a `MAI BRIEFING (ne ismételd):` block; the prompt forbids repeating it. Deterministic, zero extra infra.
- **(r) Lazy path derives window fire-times from the SAME crons** via `org.springframework.scheduling.support.CronExpression` — only the latest elapsed window of TODAY lazy-generates; past dates never generate (a past window is never "current"). No staleness/regen (the W1/W2 YAGNI reasoning — the next window is hours away).
- **(s) Emptiness gate = narrative memory**, reusing `mezo.proactive.briefing.past-days` (one knob for "does the companion know Daniel yet"): zero `daily_summary` in that window ⇒ null ⇒ 404.
- **Component name:** `CompanionNoteCard`; eyebrow copy `Mezo · napközbeni jegyzet` (nudge) / `Mezo · napzárás` (closing).

---

### Task 1: Contract — heartbeat endpoint in proactive.yml

**Files:**
- Modify: `api/feature/proactive/proactive.yml` (add path + schema)
- Generated: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: `GET /api/proactive/heartbeat?date=` → `HeartbeatNoteResponse{date, window, kind, content, generatedAt}` (all required), 200/401/404; backend `ProactiveApi.getHeartbeat(LocalDate date)`; FE `paths['/api/proactive/heartbeat']`.

- [ ] **Step 1: Add the path** to `api/feature/proactive/proactive.yml` after the `/api/proactive/memoir` path:

```yaml
  /api/proactive/heartbeat:
    get:
      tags: [Proactive]
      operationId: getHeartbeat
      summary: The day's latest heartbeat note (napközbeni jelenlét)
      description: >-
        Returns the latest persisted heartbeat note for the given day (evening closing beats
        midday nudge). For TODAY, the latest already-elapsed window lazy-generates when missing
        (the miss-recovery); past dates never generate. 404 = honest absence (no elapsed window
        yet, no narrative memory, or generation failed).
      parameters:
        - name: date
          in: query
          required: false
          schema:
            type: string
            format: date
      responses:
        '200':
          description: The day's latest heartbeat note
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HeartbeatNoteResponse'
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '404':
          description: No note for the day (honest absence)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
```

- [ ] **Step 2: Add the schema** under `components.schemas` (after `MemoirResponse`):

```yaml
    HeartbeatNoteResponse:
      type: object
      required: [date, window, kind, content, generatedAt]
      properties:
        date:
          type: string
          format: date
        window:
          type: string
          description: Window key (midday | evening)
        kind:
          type: string
          description: nudge (midday) | closing (evening)
        content:
          type: string
          description: The generated HU note (plain prose)
        generatedAt:
          type: string
          format: date-time
```

- [ ] **Step 3: Merge + regenerate FE types**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: `api/openapi.yml` gains the path; `api.gen.ts` gains `paths['/api/proactive/heartbeat']` + `HeartbeatNoteResponse`.

- [ ] **Step 4: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): proactive heartbeat contract — GET /api/proactive/heartbeat (mezo-h4wp.5)"
```

### Task 2: Table + entity + repository (+ populator, ResetDatabase, persistence IT)

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607071800_mezo-h4wp.5_create_heartbeat_note.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeSet)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/HeartbeatNoteEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/HeartbeatNoteRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/HeartbeatNotePopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (prepend `heartbeat_note` to the TRUNCATE list)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/HeartbeatPersistenceIT.java`

**Interfaces:**
- Produces: `HeartbeatNoteEntity{UUID id, LocalDate noteDate, String windowKey, String kind, String content, Instant generatedAt}` extends `OwnedEntity`; constants `WINDOW_MIDDAY="midday"`, `WINDOW_EVENING="evening"`, `KIND_NUDGE="nudge"`, `KIND_CLOSING="closing"` on the entity; `HeartbeatNoteRepository.findByCreatedByAndNoteDateAndWindowKey(UUID, LocalDate, String)` + `findFirstByCreatedByAndNoteDateOrderByGeneratedAtDesc(UUID, LocalDate)`; `HeartbeatNotePopulator.note(UUID createdBy, LocalDate noteDate, String windowKey)`.

- [ ] **Step 1: Write the failing persistence IT** (mirror `MemoirPersistenceIT`): save/reload round-trip; the partial-unique index rejects a second LIVE row for the same (user, day, window) but allows a different window same day; owner-scoped latest-first finder isolation.

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.proactive.repository.HeartbeatNoteRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.HeartbeatNotePopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class HeartbeatPersistenceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 7, 7);

    @Autowired private HeartbeatNoteRepository repository;
    @Autowired private HeartbeatNotePopulator populator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testSave_shouldRoundTrip_whenNotePersisted() {
        UUID user = userPopulator.createUser("hb-rt@test.local").getId();
        populator.note(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY);
        HeartbeatNoteEntity found = repository
                .findByCreatedByAndNoteDateAndWindowKey(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY)
                .orElseThrow();
        assertThat(found.getKind()).isEqualTo(HeartbeatNoteEntity.KIND_NUDGE);
        assertThat(found.getContent()).isNotBlank();
    }

    @Test
    void testSave_shouldRejectSecondLiveRow_whenSameUserDayWindow() {
        UUID user = userPopulator.createUser("hb-uq@test.local").getId();
        populator.note(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY);
        // a DIFFERENT window on the same day is allowed
        populator.note(user, DAY, HeartbeatNoteEntity.WINDOW_EVENING);
        assertThatThrownBy(() -> populator.note(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void testFindLatest_shouldReturnOwnNewestNote_whenTwoWindowsExist() {
        UUID user = userPopulator.createUser("hb-own@test.local").getId();
        UUID other = userPopulator.createUser("hb-other@test.local").getId();
        HeartbeatNoteEntity midday = populator.note(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY);
        midday.setGeneratedAt(Instant.now().minusSeconds(3600).truncatedTo(ChronoUnit.MICROS));
        repository.saveAndFlush(midday);
        HeartbeatNoteEntity evening = populator.note(user, DAY, HeartbeatNoteEntity.WINDOW_EVENING);
        populator.note(other, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY);
        assertThat(repository.findFirstByCreatedByAndNoteDateOrderByGeneratedAtDesc(user, DAY))
                .hasValueSatisfying(n -> assertThat(n.getId()).isEqualTo(evening.getId()));
    }
}
```

- [ ] **Step 2: Run it to fail** — `cd backend && ./mvnw clean test -Dtest=HeartbeatPersistenceIT` → compile error (entity missing).

- [ ] **Step 3: Migration** `202607071800_mezo-h4wp.5_create_heartbeat_note.sql`:

```sql
-- Proactive H1 (bd mezo-h4wp.5, roadmap §H1): in-app heartbeat notes (napközbeni jelenlét).
-- One live row per user+day+window; window_key (NOT "window" — reserved) = midday|evening,
-- kind = nudge|closing. Written by the window crons (or the lazy GET); never regenerated.

create table heartbeat_note (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    note_date    date        not null,
    window_key   varchar(16) not null,
    kind         varchar(16) not null,
    content      text        not null,
    generated_at timestamptz not null,
    constraint pk_heartbeat_note_id primary key (id),
    constraint fk_heartbeat_note_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_heartbeat_note_window_key check (window_key in ('midday', 'evening')),
    constraint ck_heartbeat_note_kind check (kind in ('nudge', 'closing'))
);

create unique index uq_heartbeat_note_created_by_note_date_window_key
    on heartbeat_note (created_by, note_date, window_key) where is_deleted = false;
```

Register in `1.0.0_master.yml` (append after the memoir changeSet):

```yaml
  - changeSet:
      id: "1.0.0:202607071800_mezo-h4wp.5_create_heartbeat_note"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607071800_mezo-h4wp.5_create_heartbeat_note.sql
```

- [ ] **Step 4: Entity** (`entity/HeartbeatNoteEntity.java` — the `MemoirEntity` shape, flat columns):

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
 * One heartbeat note (proactive H1): the companion's short in-day presence for a user+day+window.
 * window_key/kind vocabularies are fixed v1 constants (two windows — §9 decision p).
 */
@Getter
@Setter
@Entity
@Table(name = "heartbeat_note")
@SQLDelete(sql = "update heartbeat_note set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class HeartbeatNoteEntity extends OwnedEntity {

    public static final String WINDOW_MIDDAY = "midday";
    public static final String WINDOW_EVENING = "evening";
    public static final String KIND_NUDGE = "nudge";
    public static final String KIND_CLOSING = "closing";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "note_date", nullable = false)
    private LocalDate noteDate;

    @NotNull
    @Column(name = "window_key", nullable = false, length = 16)
    private String windowKey;

    @NotNull
    @Column(nullable = false, length = 16)
    private String kind;

    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
```

- [ ] **Step 5: Repository** (`repository/HeartbeatNoteRepository.java`):

```java
package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HeartbeatNoteRepository extends JpaRepository<HeartbeatNoteEntity, UUID> {

    Optional<HeartbeatNoteEntity> findByCreatedByAndNoteDateAndWindowKey(
            UUID createdBy, LocalDate noteDate, String windowKey);

    /** The GET's read: the day's newest note (evening beats midday by generation time). */
    Optional<HeartbeatNoteEntity> findFirstByCreatedByAndNoteDateOrderByGeneratedAtDesc(
            UUID createdBy, LocalDate noteDate);
}
```

- [ ] **Step 6: Populator** (`support/populator/HeartbeatNotePopulator.java` — the `MemoirPopulator` shape):

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.proactive.repository.HeartbeatNoteRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class HeartbeatNotePopulator {

    private final HeartbeatNoteRepository heartbeatNoteRepository;

    public HeartbeatNoteEntity note(UUID createdBy, LocalDate noteDate, String windowKey) {
        HeartbeatNoteEntity entity = new HeartbeatNoteEntity();
        entity.setCreatedBy(createdBy);
        entity.setNoteDate(noteDate);
        entity.setWindowKey(windowKey);
        entity.setKind(HeartbeatNoteEntity.WINDOW_EVENING.equals(windowKey)
                ? HeartbeatNoteEntity.KIND_CLOSING
                : HeartbeatNoteEntity.KIND_NUDGE);
        entity.setContent("Teszt napközbeni jegyzet.");
        entity.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return heartbeatNoteRepository.saveAndFlush(entity);
    }
}
```

- [ ] **Step 7: ResetDatabase** — prepend `heartbeat_note` to the TRUNCATE list in `support/ResetDatabase.java` (in front of `memoir`).

- [ ] **Step 8: Run the IT to pass** — `./mvnw clean test -Dtest=HeartbeatPersistenceIT` → 3 PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/proactive backend/src/test/java/io/mrkuhne/mezo/support
git add backend/src/test/java/io/mrkuhne/mezo/feature/proactive/HeartbeatPersistenceIT.java
git commit -m "feat(proactive): heartbeat_note table + entity + repo + persistence IT (mezo-h4wp.5)"
```

### Task 3: HeartbeatGenerator + fake sentinel + generator IT

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/HeartbeatGenerator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (mirror + sentinel + dispatch branch)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/HeartbeatGeneratorIT.java`

**Interfaces:**
- Consumes: `ContextSnapshotAssembler.render(UUID, LocalDate)`, `KnowledgeFactService.renderPromptBlock(UUID)`, `DailySummaryRepository.findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(UUID, LocalDate)`, `BriefingRepository.findByCreatedByAndBriefingDate(UUID, LocalDate)`, `CompanionLlm.complete(String, String)`, `ProactiveProperties.briefing().pastDays()`.
- Produces: `HeartbeatGenerator.generate(UUID userId, LocalDate day, String windowKey): HeartbeatNoteEntity` (null = honest absence); `HeartbeatGenerator.gather(UUID, LocalDate, String): String`; `HEARTBEAT_MARKER = "NAPKOZBENI-JEGYZET-FELADAT"`; fake sentinel `[fake-heartbeat:…]` (bare string, check-in-note channel — the gather HAS a snapshot).

- [ ] **Step 1: Write the failing generator IT** (mirror `WeeklySuggestionGeneratorIT`; sentinel via check-in note — the snapshot echoes it):

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.proactive.repository.HeartbeatNoteRepository;
import io.mrkuhne.mezo.feature.proactive.service.HeartbeatGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.BriefingPopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * The [fake-heartbeat:…] sentinel rides a check-in note — the heartbeat gather renders the
 * snapshot (like briefing/weekly), so the check-in channel IS in the payload.
 */
@Transactional
@ActiveProfiles("companion-fake")
class HeartbeatGeneratorIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.now();

    @Autowired private HeartbeatGenerator generator;
    @Autowired private HeartbeatNoteRepository repository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private BriefingPopulator briefingPopulator;

    @Test
    void testGather_shouldComposeSnapshotSummaryAndWindow_whenMemoryExists() {
        UUID user = userPopulator.createUser("hbg-gather@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnapi nap összefoglaló.");
        briefingPopulator.briefing(user, DAY);
        String payload = generator.gather(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY);
        assertThat(payload)
                .contains("AKTUÁLIS ÁLLAPOT")
                .contains("Tegnapi nap összefoglaló.")
                .contains("MAI BRIEFING (ne ismételd):")
                .contains("ABLAK: dél (nudge)");
    }

    @Test
    void testGather_shouldReturnNull_whenNoNarrativeMemory() {
        UUID user = userPopulator.createUser("hbg-empty@test.local").getId();
        assertThat(generator.gather(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY)).isNull();
    }

    @Test
    void testGenerate_shouldPersistScriptedNote_whenSentinelPlanted() {
        UUID user = userPopulator.createUser("hbg-gen@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1));
        checkInPopulator.checkIn(user, DAY, "[fake-heartbeat:Szép délutáni tempó, tartsd a vizet.]");
        HeartbeatNoteEntity note = generator.generate(user, DAY, HeartbeatNoteEntity.WINDOW_EVENING);
        assertThat(note).isNotNull();
        assertThat(note.getContent()).isEqualTo("Szép délutáni tempó, tartsd a vizet.");
        assertThat(note.getKind()).isEqualTo(HeartbeatNoteEntity.KIND_CLOSING);
        assertThat(repository.findByCreatedByAndNoteDateAndWindowKey(
                user, DAY, HeartbeatNoteEntity.WINDOW_EVENING)).isPresent();
    }

    @Test
    void testGenerate_shouldReturnExistingRow_whenNoteAlreadyExists() {
        UUID user = userPopulator.createUser("hbg-idem@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1));
        HeartbeatNoteEntity first = generator.generate(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY);
        HeartbeatNoteEntity second = generator.generate(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY);
        assertThat(second.getId()).isEqualTo(first.getId());
    }

    @Test
    void testGenerate_shouldReturnNull_whenAnswerBlank() {
        UUID user = userPopulator.createUser("hbg-blank@test.local").getId();
        dailySummaryPopulator.summary(user, DAY.minusDays(1));
        checkInPopulator.checkIn(user, DAY, "[fake-heartbeat:]");
        assertThat(generator.generate(user, DAY, HeartbeatNoteEntity.WINDOW_MIDDAY)).isNull();
    }
}
```

(If `CheckInPopulator`/`BriefingPopulator` signatures differ, adapt the calls at execution time — check `support/populator/` first; the briefing populator seeds a persisted briefing whose body lands in the dedupe block.)

- [ ] **Step 2: Run to fail** — `./mvnw clean test -Dtest=HeartbeatGeneratorIT` → compile error.

- [ ] **Step 3: FakeCompanionLlm additions** — next to the memoir mirror:

```java
/** Literal mirror of HeartbeatGenerator.HEARTBEAT_MARKER (import would be a package cycle). */
public static final String HEARTBEAT_MARKER_MIRROR = "NAPKOZBENI-JEGYZET-FELADAT";
public static final Pattern HEARTBEAT_SENTINEL =
        Pattern.compile("\\[fake-heartbeat:([^\\]]*)]", Pattern.DOTALL);
```

and in `complete(...)` before the general fallthrough:

```java
if (systemPrompt.startsWith(HEARTBEAT_MARKER_MIRROR)) {
    Matcher m = HEARTBEAT_SENTINEL.matcher(userMessage);
    return m.find() ? m.group(1) : "FAKE-NAPKOZBENI-JEGYZET";
}
```

Prefix-collision check: `NAPKOZBENI-JEGYZET-FELADAT` shares no prefix with `REGGELI-…`/`HETI-…` — safe with `startsWith` dispatch.

- [ ] **Step 4: HeartbeatGenerator** (`service/HeartbeatGenerator.java` — the WeeklySuggestion prose idiom at the CHEAP tier):

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.proactive.repository.BriefingRepository;
import io.mrkuhne.mezo.feature.proactive.repository.HeartbeatNoteRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Heartbeat note generation (proactive H1): pure-code gather (snapshot + facts + latest summary
 * + today's briefing dedupe block + window instruction) → ONE CHEAP-tier CompanionLlm call →
 * flat HU prose. Honest-null on empty narrative memory or blank answer; idempotent per
 * user+day+window. Gather = pure code, prose = pure LLM (NFR-M-4).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class HeartbeatGenerator {

    /** Prompt prefix the fake LLM dispatches on — MIRRORED as a literal in FakeCompanionLlm. */
    public static final String HEARTBEAT_MARKER = "NAPKOZBENI-JEGYZET-FELADAT";

    private static final String PROMPT = HEARTBEAT_MARKER + "\n"
            + "Írj rövid (2-3 mondatos), magyar napközbeni jegyzetet Danielnek társ-szemszögből, "
            + "kizárólag a megadott mai állapotból. Az ABLAK blokk mondja meg a jegyzet fajtáját: "
            + "déli (nudge) esetén a nap hátralévő részére adj egy konkrét, gyengéd fókuszt; esti "
            + "(closing) esetén zárd a napot egy konkrét megfigyeléssel. Ha van MAI BRIEFING blokk, "
            + "annak tartalmát NE ismételd. Számot vagy adatot kitalálni tilos; gyógyszer "
            + "adagolására (pl. retatrutid) vonatkozó változtatást SOHA ne javasolj — az orvosi "
            + "döntés. Sima folyószöveggel válaszolj, markdown és felsorolás nélkül.";

    private final HeartbeatNoteRepository heartbeatNoteRepository;
    private final BriefingRepository briefingRepository;
    private final DailySummaryRepository dailySummaryRepository;
    private final ContextSnapshotAssembler contextSnapshotAssembler;
    private final KnowledgeFactService knowledgeFactService;
    private final CompanionLlm companionLlm;
    private final ProactiveProperties properties;

    @Transactional
    public HeartbeatNoteEntity generate(UUID userId, LocalDate day, String windowKey) {
        HeartbeatNoteEntity existing = heartbeatNoteRepository
                .findByCreatedByAndNoteDateAndWindowKey(userId, day, windowKey)
                .orElse(null);
        if (existing != null) {
            return existing;
        }
        String payload = gather(userId, day, windowKey);
        if (payload == null) {
            log.debug("No narrative memory for user {} — no heartbeat for {}", userId, day);
            return null;
        }
        String prose = companionLlm.complete(PROMPT, payload);
        if (prose == null || prose.isBlank()) {
            log.warn("Unusable heartbeat answer for user {} day {} window {}", userId, day, windowKey);
            return null;
        }
        HeartbeatNoteEntity note = new HeartbeatNoteEntity();
        note.setCreatedBy(userId);
        note.setNoteDate(day);
        note.setWindowKey(windowKey);
        note.setKind(HeartbeatNoteEntity.WINDOW_EVENING.equals(windowKey)
                ? HeartbeatNoteEntity.KIND_CLOSING
                : HeartbeatNoteEntity.KIND_NUDGE);
        note.setContent(prose.strip());
        note.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return heartbeatNoteRepository.saveAndFlush(note);
    }

    /** Pure-code gather; null = the emptiness gate (no daily_summary in the past-days window). */
    public String gather(UUID userId, LocalDate day, String windowKey) {
        List<DailySummaryEntity> past = dailySummaryRepository
                .findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(
                        userId, day.minusDays(properties.briefing().pastDays()));
        if (past.isEmpty()) {
            return null;
        }
        DailySummaryEntity latest = past.getFirst();
        String briefingBlock = briefingRepository.findByCreatedByAndBriefingDate(userId, day)
                .map(b -> "\n\nMAI BRIEFING (ne ismételd):\n" + String.join(" ", b.getContent().body()))
                .orElse("");
        String window = HeartbeatNoteEntity.WINDOW_EVENING.equals(windowKey)
                ? "este (closing)"
                : "dél (nudge)";
        return contextSnapshotAssembler.render(userId, day)
                + knowledgeFactService.renderPromptBlock(userId)
                + "\n\nUTOLSÓ NAPI ÖSSZEFOGLALÓ:\n- " + latest.getSummaryDate() + ": " + latest.getNarrative()
                + briefingBlock
                + "\n\nABLAK: " + window;
    }
}
```

- [ ] **Step 5: Run to pass** — `./mvnw clean test -Dtest=HeartbeatGeneratorIT` → 5 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/HeartbeatGenerator.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java backend/src/test/java/io/mrkuhne/mezo/feature/proactive/HeartbeatGeneratorIT.java
git commit -m "feat(proactive): HeartbeatGenerator (cheap tier, briefing-dedupe gather) + fake sentinel (mezo-h4wp.5)"
```

### Task 4: HeartbeatJob (two window crons) + config + job ITs

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (add `HEARTBEAT_JOB_SWITCH`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/ProactiveProperties.java` (add nested `Heartbeat`)
- Modify: `backend/src/main/resources/application.yml` (heartbeat crons + job switch)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/HeartbeatJob.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/HeartbeatJobIT.java`, `.../HeartbeatJobSwitchOffIT.java`

**Interfaces:**
- Produces: `HEARTBEAT_JOB_SWITCH = "mezo.techcore.cron.heartbeat-job.enabled"`; `ProactiveProperties.Heartbeat(String middayCron, String eveningCron)` (`@NotBlank` each) reachable as `properties.heartbeat().middayCron()`; `HeartbeatJob.runMidday()` / `runEvening()`.

- [ ] **Step 1: Failing job ITs** (mirror `MemoirJobIT` / `MemoirJobSwitchOffIT`):

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.proactive.repository.HeartbeatNoteRepository;
import io.mrkuhne.mezo.feature.proactive.service.HeartbeatJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("companion-fake")
class HeartbeatJobIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private HeartbeatJob job;
    @Autowired private HeartbeatNoteRepository repository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;

    @Test
    void testRunMidday_shouldGenerateNudge_whenUserHasMemory() {
        UUID user = userPopulator.createUser("hbj-mid@test.local").getId();
        dailySummaryPopulator.summary(user, TODAY.minusDays(1));
        job.runMidday();
        assertThat(repository.findByCreatedByAndNoteDateAndWindowKey(
                user, TODAY, HeartbeatNoteEntity.WINDOW_MIDDAY))
                .hasValueSatisfying(n -> assertThat(n.getKind()).isEqualTo(HeartbeatNoteEntity.KIND_NUDGE));
    }

    @Test
    void testRunEvening_shouldBeIdempotent_whenNoteAlreadyExists() {
        UUID user = userPopulator.createUser("hbj-idem@test.local").getId();
        dailySummaryPopulator.summary(user, TODAY.minusDays(1));
        job.runEvening();
        UUID firstId = repository.findByCreatedByAndNoteDateAndWindowKey(
                user, TODAY, HeartbeatNoteEntity.WINDOW_EVENING).orElseThrow().getId();
        job.runEvening();
        assertThat(repository.findByCreatedByAndNoteDateAndWindowKey(
                user, TODAY, HeartbeatNoteEntity.WINDOW_EVENING).orElseThrow().getId()).isEqualTo(firstId);
    }
}
```

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.service.HeartbeatJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

@TestPropertySource(properties = "mezo.techcore.cron.heartbeat-job.enabled=false")
class HeartbeatJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoHeartbeatJobBean_whenJobSwitchOff() {
        assertThat(context.getBeanNamesForType(HeartbeatJob.class)).isEmpty();
    }
}
```

- [ ] **Step 2: Run to fail** — compile error (job missing).

- [ ] **Step 3: Config additions.** `FeaturesConfiguration` after `MEMOIR_JOB_SWITCH`:

```java
/** Third switch of the H1 heartbeat window crons (on top of companion+proactive). */
public static final String HEARTBEAT_JOB_SWITCH = "mezo.techcore.cron.heartbeat-job.enabled";
```

`ProactiveProperties`: add `@NotNull @Valid Heartbeat heartbeat` component +

```java
public record Heartbeat(
        @NotBlank String middayCron,
        @NotBlank String eveningCron
) {}
```

`application.yml`: under `mezo.techcore.cron:` add `heartbeat-job:\n        enabled: true`; under `mezo.proactive:` add:

```yaml
    heartbeat:
      midday-cron: "0 30 12 * * *"
      evening-cron: "0 30 20 * * *"
```

- [ ] **Step 4: HeartbeatJob** (`service/HeartbeatJob.java` — the MemoirJob idiom, one method per window):

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.user.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.user.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The H1 window crons: midday nudge + evening closing (config, §9 decision p). Today-only,
 * no backfill (a past window is never read — the lazy GET is the miss-recovery); idempotent;
 * per-user failures isolated.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.HEARTBEAT_JOB_SWITCH},
        havingValue = "true")
public class HeartbeatJob {

    private final AppUserRepository appUserRepository;
    private final HeartbeatGenerator generator;

    @Scheduled(cron = "${mezo.proactive.heartbeat.midday-cron}")
    public void runMidday() {
        run(HeartbeatNoteEntity.WINDOW_MIDDAY);
    }

    @Scheduled(cron = "${mezo.proactive.heartbeat.evening-cron}")
    public void runEvening() {
        run(HeartbeatNoteEntity.WINDOW_EVENING);
    }

    private void run(String windowKey) {
        LocalDate today = LocalDate.now();
        int generated = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                if (generator.generate(user.getId(), today, windowKey) != null) {
                    generated++;
                }
            } catch (Exception e) {
                log.warn("Heartbeat generation failed for user {} day {} window {}",
                        user.getId(), today, windowKey, e);
            }
        }
        log.info("Heartbeat {} run for {}: {} note(s) present", windowKey, today, generated);
    }
}
```

(Adapt the `AppUserEntity`/`AppUserRepository` import packages to what `MemoirJob` actually imports.)

- [ ] **Step 5: Run to pass** — `./mvnw clean test -Dtest='HeartbeatJob*'` → 3 PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main
git add backend/src/test/java/io/mrkuhne/mezo/feature/proactive/HeartbeatJobIT.java backend/src/test/java/io/mrkuhne/mezo/feature/proactive/HeartbeatJobSwitchOffIT.java
git commit -m "feat(proactive): HeartbeatJob midday+evening window crons, three-switch (mezo-h4wp.5)"
```

### Task 5: Read path — service + controller + mapper + API/lazy ITs

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveHeartbeatService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/controller/ProactiveController.java` (implement `getHeartbeat`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java` (`toHeartbeatResponse`)
- Test: `ProactiveApiIT.java` (+3 heartbeat cases), `HeartbeatLazyIT.java` (new), `ProactiveApiSwitchOffIT.java` + `ProactiveApiCompanionOffIT.java` (+ heartbeat path)

**Interfaces:**
- Consumes: `HeartbeatGenerator.generate(UUID, LocalDate, String)`, `ProactiveProperties.heartbeat()`, `CronExpression.parse(...)` (spring-context).
- Produces: `ProactiveHeartbeatService.getHeartbeat(UUID userId, LocalDate date): HeartbeatNoteResponse` (404 via `SystemRuntimeErrorException(RESOURCE_NOT_FOUND)`); mapper `@Mapping(target="date", source="noteDate") @Mapping(target="window", source="windowKey") HeartbeatNoteResponse toHeartbeatResponse(HeartbeatNoteEntity)`.

- [ ] **Step 1: Failing API IT cases** — add to `ProactiveApiIT` (mirror the memoir trio; the default crons 12:30/20:30 make lazy time-dependent, so ApiIT only covers persisted/404/401 — lazy goes to `HeartbeatLazyIT`):

```java
@Test
void testGetHeartbeat_shouldReturnLatestNote_whenPersisted() {
    // owner login; plant midday + evening notes for today via HeartbeatNotePopulator (owner user id)
    // GET /api/proactive/heartbeat → 200, window == "evening" (the newest by generatedAt)
}

@Test
void testGetHeartbeat_shouldReturn404_whenNoNote() {
    // GET /api/proactive/heartbeat?date=<yesterday> → 404 (past date never lazy-generates)
}

@Test
void testGetHeartbeat_shouldReturn401_whenNoToken() {
    // GET without auth → 401
}
```

`HeartbeatLazyIT` — dedicated IT with overridden crons so "elapsed" is deterministic:

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.proactive.repository.HeartbeatNoteRepository;
import io.mrkuhne.mezo.feature.proactive.service.ProactiveHeartbeatService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lazy-path semantics with deterministic "elapsed" windows: midnight crons mean BOTH windows
 * have always fired for today (except the midnight minute itself — accepted micro-flake window,
 * the suite never runs then).
 */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.proactive.heartbeat.midday-cron=0 0 0 * * *",
        "mezo.proactive.heartbeat.evening-cron=0 1 0 * * *"})
class HeartbeatLazyIT extends AbstractIntegrationTest {

    @Autowired private ProactiveHeartbeatService service;
    @Autowired private HeartbeatNoteRepository repository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;

    @Test
    void testGetHeartbeat_shouldLazyGenerateLatestElapsedWindow_whenTodayHasNoNote() {
        UUID user = userPopulator.createUser("hbl-lazy@test.local").getId();
        dailySummaryPopulator.summary(user, LocalDate.now().minusDays(1));
        var response = service.getHeartbeat(user, null);
        assertThat(response.getWindow()).isEqualTo(HeartbeatNoteEntity.WINDOW_EVENING);
        assertThat(repository.findByCreatedByAndNoteDateAndWindowKey(
                user, LocalDate.now(), HeartbeatNoteEntity.WINDOW_EVENING)).isPresent();
    }

    @Test
    void testGetHeartbeat_shouldThrow404_whenNoMemoryAndNothingPersisted() {
        UUID user = userPopulator.createUser("hbl-404@test.local").getId();
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.getHeartbeat(user, null))
                .isInstanceOf(io.mrkuhne.mezo.techcore.error.SystemRuntimeErrorException.class);
    }
}
```

(Adapt the exception import to the house package at execution time.)

- [ ] **Step 2: Run to fail.**

- [ ] **Step 3: Mapper method** in `ProactiveMapper`:

```java
@Mapping(target = "date", source = "noteDate")
@Mapping(target = "window", source = "windowKey")
HeartbeatNoteResponse toHeartbeatResponse(HeartbeatNoteEntity entity);
```

- [ ] **Step 4: ProactiveHeartbeatService**:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.HeartbeatNoteResponse;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.repository.HeartbeatNoteRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.error.SystemMessage;
import io.mrkuhne.mezo.techcore.error.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The heartbeat read path (H1): the day's latest persisted note; for TODAY the latest
 * already-elapsed window lazy-generates when missing (fire-times derived from the SAME crons
 * the job runs on — §9 decision r). Past dates never generate. null ⇒ 404 (honest absence).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ProactiveHeartbeatService {

    private record Window(String key, LocalDateTime fireTime) {}

    private final HeartbeatNoteRepository heartbeatNoteRepository;
    private final HeartbeatGenerator generator;
    private final ProactiveProperties properties;
    private final ProactiveMapper mapper;

    @Transactional
    public HeartbeatNoteResponse getHeartbeat(UUID userId, LocalDate date) {
        LocalDate day = date != null ? date : LocalDate.now();
        if (day.equals(LocalDate.now())) {
            latestElapsedWindow(day).ifPresent(w -> {
                if (heartbeatNoteRepository
                        .findByCreatedByAndNoteDateAndWindowKey(userId, day, w.key()).isEmpty()) {
                    generator.generate(userId, day, w.key());
                }
            });
        }
        HeartbeatNoteEntity note = heartbeatNoteRepository
                .findFirstByCreatedByAndNoteDateOrderByGeneratedAtDesc(userId, day)
                .orElse(null);
        if (note == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
        }
        return mapper.toHeartbeatResponse(note);
    }

    /** The day's window fire-times come from the job crons; elapsed = fired at-or-before now. */
    private Optional<Window> latestElapsedWindow(LocalDate day) {
        LocalDateTime dayStart = day.atStartOfDay().minusNanos(1);
        LocalDateTime now = LocalDateTime.now();
        return List.of(
                        new Window(HeartbeatNoteEntity.WINDOW_MIDDAY,
                                CronExpression.parse(properties.heartbeat().middayCron()).next(dayStart)),
                        new Window(HeartbeatNoteEntity.WINDOW_EVENING,
                                CronExpression.parse(properties.heartbeat().eveningCron()).next(dayStart)))
                .stream()
                .filter(w -> w.fireTime() != null
                        && w.fireTime().toLocalDate().equals(day)
                        && !w.fireTime().isAfter(now))
                .max(Comparator.comparing(Window::fireTime));
    }
}
```

- [ ] **Step 5: Controller** — add the dep + method to `ProactiveController`:

```java
private final ProactiveHeartbeatService heartbeatService;

@Override
public HeartbeatNoteResponse getHeartbeat(LocalDate date) {
    return heartbeatService.getHeartbeat(currentUserId.get(), date);
}
```

- [ ] **Step 6: Switch-off ITs** — add a heartbeat 404 assertion to `ProactiveApiSwitchOffIT` and `ProactiveApiCompanionOffIT` (same shape as the memoir line: GET `/api/proactive/heartbeat` expecting 404).

- [ ] **Step 7: Run** `./mvnw clean test -Dtest='Heartbeat*,ProactiveApi*'` → all PASS, then the FULL backend gate `./mvnw clean test` → green.

- [ ] **Step 8: Commit**

```bash
git add backend/src
git commit -m "feat(proactive): heartbeat read path — lazy latest-elapsed-window GET + controller (mezo-h4wp.5)"
```

### Task 6: FE data layer — CompanionNote type + api + hook + MSW + tests

**Files:**
- Modify: `frontend/src/data/types.ts` (add `CompanionNote`)
- Create: `frontend/src/data/today/heartbeatApi.ts`, `frontend/src/data/today/heartbeatHooks.ts`
- Modify: `frontend/src/data/hooks.ts` (barrel line)
- Modify: `frontend/src/test/msw/handlers.ts` (default 404)
- Test: `frontend/src/data/today/heartbeatHooks.test.tsx`

**Interfaces:**
- Produces: `CompanionNote { window: string; kind: 'nudge' | 'closing'; text: string }` in `types.ts`; `heartbeatApi.get(date: string): Promise<CompanionNote>`; `useCompanionNote(): CompanionNote | null` exported from `@/data/hooks` (mock: always null, no fetch; real: today's GET, 404→null, `retry:false`, queryKey `['heartbeat', date]`).

- [ ] **Step 1: Failing hook tests** (mirror `memoirHooks.test.tsx` / `briefingHooks` idiom):

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useCompanionNote } from '@/data/today/heartbeatHooks'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

describe('useCompanionNote (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('maps the wire note', async () => {
    server.use(
      http.get(`${API_BASE}/api/proactive/heartbeat`, () =>
        HttpResponse.json({
          date: '2026-07-07', window: 'evening', kind: 'closing',
          content: 'Szép zárás.', generatedAt: '2026-07-07T18:30:00Z',
        })),
    )
    const { result } = renderHook(() => useCompanionNote(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current).toEqual({ window: 'evening', kind: 'closing', text: 'Szép zárás.' })
  })

  test('returns null on the default 404', async () => {
    const { result } = renderHook(() => useCompanionNote(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current).toBeNull())
  })
})

describe('useCompanionNote (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('is null without fetching (Phase-1 byte-parity — no such card in mock)', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useCompanionNote(), { wrapper: makeHookWrapper() })
    expect(result.current).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to fail** — `cd frontend && pnpm test heartbeatHooks` → module not found.

- [ ] **Step 3: Type** in `types.ts` (next to `Briefing`):

```ts
/** Proactive H1 in-day note — the CompanionNoteCard's data (mock mode has none; honest absence). */
export interface CompanionNote { window: string; kind: 'nudge' | 'closing'; text: string }
```

- [ ] **Step 4: `heartbeatApi.ts`** (the `briefingApi` shape):

```ts
import { apiFetch } from '@/data/_client/api'
import type { paths } from '@/data/_client/api.gen'
import type { CompanionNote } from '@/data/types'

type HeartbeatWire =
  paths['/api/proactive/heartbeat']['get']['responses']['200']['content']['application/json']

export function toCompanionNote(wire: HeartbeatWire): CompanionNote {
  return { window: wire.window, kind: wire.kind as CompanionNote['kind'], text: wire.content }
}

export const heartbeatApi = {
  /** The day's latest heartbeat note for the FE's LOCAL day (the briefing date precedent). */
  get: (date: string) =>
    apiFetch<HeartbeatWire>(`/api/proactive/heartbeat?date=${date}`).then(toCompanionNote),
}
```

- [ ] **Step 5: `heartbeatHooks.ts`** (the `briefingHooks` clone):

```ts
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { heartbeatApi } from '@/data/today/heartbeatApi'
import { localDateString } from '@/shared/lib/dates'
import type { CompanionNote } from '@/data/types'

/**
 * The day's heartbeat note (proactive H1). Mock mode: always null — the Phase-1 Today has no
 * such card (byte parity). Real mode: today's latest note, or null while loading / on 404
 * (no elapsed window, no narrative memory, switch off) / on error — the card simply absent
 * (honest absence, roadmap §H1).
 */
export function useCompanionNote(): CompanionNote | null {
  const mock = isMockMode()
  const date = localDateString()
  const q = useQuery<CompanionNote | null>({
    queryKey: ['heartbeat', date],
    queryFn: mock
      ? async () => null
      : async () => {
          try {
            return await heartbeatApi.get(date)
          } catch (e) {
            if (e instanceof ApiError && e.status === 404) return null
            throw e
          }
        },
    initialData: mock ? null : undefined,
    staleTime: mock ? Infinity : undefined,
    retry: false,
  })
  return q.data ?? null
}
```

- [ ] **Step 6: Barrel + MSW.** `data/hooks.ts`: `export { useCompanionNote } from '@/data/today/heartbeatHooks'` (next to the `useBriefing` line). `test/msw/handlers.ts` (after the memoir default):

```ts
  // Proactive heartbeat (H1) — default: honest 404, the Today CompanionNoteCard stays absent.
  http.get(`${API_BASE}/api/proactive/heartbeat`, () => new HttpResponse(null, { status: 404 })),
```

- [ ] **Step 7: Run to pass** — `pnpm test heartbeatHooks` → 3 PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/data frontend/src/test
git commit -m "feat(fe): useCompanionNote dual-mode hook for the heartbeat note (mezo-h4wp.5)"
```

### Task 7: FE surface — CompanionNoteCard on Today

**Files:**
- Create: `frontend/src/features/today/components/CompanionNoteCard.tsx`
- Modify: `frontend/src/features/today/pages/TodayPage.tsx` (render after `<CheckInStrip>`)
- Test: `frontend/src/features/today/components/CompanionNoteCard.test.tsx` + a real-mode case in `frontend/src/features/today/components/conditionalCards.test.tsx`

**Interfaces:**
- Consumes: `useCompanionNote` from `@/data/hooks`; `CompanionNote` from `@/data/types`.
- Produces: `CompanionNoteCard({ note }: { note: CompanionNote })`.

- [ ] **Step 1: Failing component test:**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { CompanionNoteCard } from '@/features/today/components/CompanionNoteCard'

describe('CompanionNoteCard', () => {
  test('renders a nudge with the in-day eyebrow', () => {
    render(<CompanionNoteCard note={{ window: 'midday', kind: 'nudge', text: 'Tarts egy kis szünetet.' }} />)
    expect(screen.getByText('Mezo · napközbeni jegyzet')).toBeInTheDocument()
    expect(screen.getByText('Tarts egy kis szünetet.')).toBeInTheDocument()
  })

  test('renders a closing with the day-close eyebrow', () => {
    render(<CompanionNoteCard note={{ window: 'evening', kind: 'closing', text: 'Szép zárás.' }} />)
    expect(screen.getByText('Mezo · napzárás')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to fail.**

- [ ] **Step 3: Component** (match the house card idiom — check `BriefingCard`'s primitives before writing; `Eyebrow` from shared/ui if that's what it uses):

```tsx
import { Eyebrow } from '@/shared/ui/Eyebrow'
import type { CompanionNote } from '@/data/types'

/**
 * Proactive H1: the companion's in-day note (midday nudge / evening closing). NOT named
 * "Heartbeat*" — the check-in strip owns that copy. Rendered only when a note exists
 * (honest absence otherwise) — the parent guards.
 */
export function CompanionNoteCard({ note }: { note: CompanionNote }) {
  return (
    <div className="card notch-12" style={{ padding: 14 }}>
      <Eyebrow brand>{note.kind === 'closing' ? 'Mezo · napzárás' : 'Mezo · napközbeni jegyzet'}</Eyebrow>
      <p className="text-secondary" style={{ fontSize: 13, lineHeight: 1.55, marginTop: 8 }}>{note.text}</p>
    </div>
  )
}
```

(Adapt the `Eyebrow` import/markup to whatever `BriefingCard.tsx` actually uses at execution time.)

- [ ] **Step 4: TodayPage wiring** — add `useCompanionNote` to the `@/data/hooks` import, then after `<CheckInStrip …/>`:

```tsx
const companionNote = useCompanionNote()
...
{companionNote && <CompanionNoteCard note={companionNote} />}
```

- [ ] **Step 5: conditionalCards.test.tsx** — add two cases following that file's existing render/MSW idiom: real mode + MSW override serves a note ⇒ the card text appears; mock mode ⇒ `Mezo · napközbeni jegyzet` NOT in the document (byte-parity).

- [ ] **Step 6: Run the full FE gate** — `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → all green.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/today
git commit -m "feat(fe): CompanionNoteCard on Today — heartbeat note real dual-mode (mezo-h4wp.5)"
```

### Task 8: Docs + gates + merge + close

**Files:**
- Modify: `docs/features/proactive.md` (§1 summary+status table, §2 user-facing, §3 flow, §4 table+endpoint+config, §5 Today integration, §6 curl, §7 extend, §8 tests, §9 decisions p/q/r/s, §10 key files)
- Modify: `docs/features/today.md` (the new card in §2 + key files)
- Modify: `docs/milestones/roadmap.md` (H1 milestone row)

- [ ] **Step 1: Update the three docs** per the W2 precedent (overwrite in place, `file:line` pointers, no changelog).
- [ ] **Step 2: Lint** — `node scripts/lint-docs.mjs` → clean.
- [ ] **Step 3: Full gates once more** — backend `./mvnw clean test`; frontend `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- [ ] **Step 4: Commit docs**

```bash
git add docs
git commit -m "docs(proactive): H1 shipped — heartbeat live docs (mezo-h4wp.5)"
```

- [ ] **Step 5: Merge + push + close** (memory: push directly after the merge — NO post-merge `git pull --rebase`, it flattens the --no-ff merge):

```bash
git checkout main && git pull --rebase && git merge --no-ff feat/proactive-h1 -m "Merge feat/proactive-h1 — in-app heartbeat (mezo-h4wp.5)"
git branch -d feat/proactive-h1
bd close mezo-h4wp.5 && bd update mezo-h4wp.5 --notes "H1 shipped: heartbeat_note + cheap-tier HeartbeatGenerator + midday/evening crons + lazy latest-elapsed-window GET + CompanionNoteCard on Today. Decisions p/q/r/s in proactive.md §9."
bd dolt push && git push
```

## Self-review notes

- Spec coverage: table ✓ (heartbeat_note), window-scheduled generation ✓ (two crons), grounded in the day's state ✓ (snapshot has fuel/train/check-ins), GET ✓, Today card ✓, distinct name ✓ (CompanionNoteCard), IDENT-3 rhythm ✓ (briefing + 2 windows = 3 touches).
- Types consistent: `windowKey`/`window_key` (entity/SQL), wire `window`; `generate(userId, day, windowKey)` used by job + service + ITs.
- Populator signatures (`CheckInPopulator`, `BriefingPopulator`) and shared-UI primitives (`Eyebrow`) are verify-at-execution points, flagged inline.
