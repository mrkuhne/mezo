# W1.5 Note-Embedding Catch-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the narrative Daniel already writes elsewhere — `activity_log.text` („Napló" QuickInput entries) and substantive `check_in.note` rows — joins the vector memory as `activity_note` / `checkin_note` embeddings, via the existing nightly `DailySummaryJob` sweep, with a one-time history backfill.

**Architecture:** No new table and **no migration** — the `memory_embedding` kind CHECK was already widened to include `activity_note`/`checkin_note` in W1.1 (`202608181610_mezo-b3pp.1_expand_memory_embedding_kinds.sql`). A new `NoteEmbeddingCatchUp` component (`feature/companion/embedding`) selects live, length-gated, not-yet-embedded note rows across **all** history (no lower date bound — that IS the backfill; already-embedded rows drop out of the candidate set, so it converges), bounded per run by a batch size, and embeds each one through **one** new pair of `MemoryEmbeddingWriter` methods so the single-write-path invariant holds. `DailySummaryJob` gains one call per user, after the existing turn catch-up. Per-row isolation: `NoteEmbeddingCatchUp.run` is NOT transactional, so every `MemoryEmbeddingWriter.write*` call gets its own transaction through the proxy; a failing/racing row is logged and the loop continues (exactly the turn-catch-up idiom in `DailySummaryJob`).

**Tech Stack:** Java 21 / Spring Boot 3, Spring Data JPA, Postgres + pgvector, JUnit 5 + AssertJ integration tests (`AbstractIntegrationTest`, `@ActiveProfiles("companion-fake")`), Liquibase (not needed here), Lombok.

## Global Constraints

Spec: [`docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md`](../specs/2026-08-18-phase5-deep-memory-personalization-design.md) §5.5, conventions §11.

- **No API change** in this slice ⇒ **no contract regeneration, no frontend change**. Do not touch `api/`, `frontend/`.
- **No new table** ⇒ no `ResetDatabase` change, no new populator (`ActivityPopulator` and `CheckInPopulator` already exist).
- Every embed call must be tagged via `LlmCallContextHolder.runWith(new LlmCallContext(...))` — satisfied automatically by routing through `MemoryEmbeddingWriter.write(...)`, which already tags. **Do not add a second embed call site.**
- Tuning lives in `CompanionProperties` as `@Validated` nested records + `application.yml` (never hardcoded constants).
- Integration-first tests. Test method naming in this repo: `testX_shouldY_whenZ`.
- Length gate default: `mezo.companion.embedding.note-min-chars: 80` (spec §5.5 names this key verbatim).
- Docs in the SAME change: [`docs/features/journal.md`](../../features/journal.md) and [`docs/features/companion.md`](../../features/companion.md); then `node scripts/lint-docs.mjs` — no new staleness. Regenerate `docs/CODEMAP.md` (new files).
- Conventional commits carrying the bd id: `feat(companion): ... (mezo-b3pp.5)`.
- Build/test from the `backend/` directory, ALWAYS in Testcontainers mode: `./mvnw clean test -Dtest='...' -Dmezo.test.use-testcontainers=true` (Docker must be running; the fixed-DB mode races with parallel sessions).

## File Structure

| File | Responsibility |
|---|---|
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryEmbeddingEntity.java` (modify) | Two new kind constants: `KIND_ACTIVITY_NOTE`, `KIND_CHECKIN_NOTE`. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java` (modify) | `Embedding` record gains `embedNotes`, `noteMinChars`, `noteBatchSize`. |
| `backend/src/main/resources/application.yml` (modify) | The three new keys with commented rationale. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/activity/repository/ActivityLogRepository.java` (modify) | `findNoteCandidates` — live rows, `occurred_on <= through`, `length(text) >= minChars`, chronological. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin/repository/CheckInRepository.java` (modify) | `findNoteCandidates` — same shape over `note`/`date`. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java` (modify) | `writeActivityNote(ActivityLogEntity)` / `writeCheckInNote(CheckInEntity)` — write-once units through the existing private `write(...)`. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingCatchUp.java` (create) | Candidate selection (minus already-embedded ref-ids), batch budget, per-row isolation, toggle gate. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DailySummaryJob.java` (modify) | One `noteEmbeddingCatchUp.run(user.getId(), yesterday)` call per user. |
| `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingCatchUpIT.java` (create) | Length gate, idempotency, history backfill, batch cap, per-kind coverage, soft-deleted source skipped. |
| `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingSwitchOffIT.java` (create) | `embed-notes=false` ⇒ the nightly job embeds no note. |
| `backend/src/test/java/io/mrkuhne/mezo/feature/companion/DailySummaryJobIT.java` (modify) | The job wires the note pass (end-to-end through `run()`). |
| `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java` (modify) | The three new keys bind from YAML. |
| `docs/features/journal.md`, `docs/features/companion.md`, `docs/CODEMAP.md` (modify) | Doc mandate (spec §11). |

---

### Task 1: Config keys + kind constants

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryEmbeddingEntity.java` (the `KIND_*` block, ~line 44-49)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java` (the `Embedding` record, ~line 84-91)
- Modify: `backend/src/main/resources/application.yml` (the `mezo.companion.embedding` block, ~line 387-395)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java`

**Interfaces:**
- Consumes: nothing.
- Produces: `MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE = "activity_note"`, `MemoryEmbeddingEntity.KIND_CHECKIN_NOTE = "checkin_note"`; `CompanionProperties.Embedding#embedNotes():boolean`, `#noteMinChars():int`, `#noteBatchSize():int`.

- [ ] **Step 1: Extend the binding test (failing first)**

In `CompanionPropertiesIT`, replace the existing `testEmbeddingConfig_shouldBindModelFromYaml_whenContextStarts` body with:

```java
    @Test
    void testEmbeddingConfig_shouldBindModelFromYaml_whenContextStarts() {
        assertThat(properties.embedding().model()).isEqualTo("gemini-embedding-001");
        assertThat(properties.embedding().embedChatTurns()).isTrue();
        assertThat(properties.embedding().embedMaxChars()).isEqualTo(2000);
        assertThat(properties.embedding().embedNotes()).isTrue();
        assertThat(properties.embedding().noteMinChars()).isEqualTo(80);
        assertThat(properties.embedding().noteBatchSize()).isEqualTo(200);
    }
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd backend && ./mvnw clean test -Dtest='CompanionPropertiesIT' -Dmezo.test.use-testcontainers=true`
Expected: COMPILATION FAILURE — `cannot find symbol: method embedNotes()`.

- [ ] **Step 3: Add the kind constants**

In `MemoryEmbeddingEntity`, after `KIND_REFLECTION`:

```java
    /** W1.5 (mezo-b3pp.5): a substantive „Napló" activity entry, embedded by the nightly catch-up. */
    public static final String KIND_ACTIVITY_NOTE = "activity_note";
    /** W1.5 (mezo-b3pp.5): a substantive check-in note, embedded by the nightly catch-up. */
    public static final String KIND_CHECKIN_NOTE = "checkin_note";
```

- [ ] **Step 4: Extend the `Embedding` record**

In `CompanionProperties`, the `Embedding` record becomes (keep the existing javadoc lines, append the three components):

```java
    /** V2.1 embedding port — which provider model produces memory vectors (+ V2.2 pipeline tuning). */
    public record Embedding(
        /** gemini-embedding-001 (bd mezo-c30) — the 768 dimension is structural (vector(768) schema + EmbeddingPort.DIMENSIONS), not config. */
        @NotBlank String model,
        /** V2.2: embed each completed chat turn (user+assistant as one unit, post-commit async) — off removes the listener bean (COMPANION_EMBED_TURNS_SWITCH). */
        boolean embedChatTurns,
        /** Upper cap on embedded content length (chars) per narrative unit (turn / summary). */
        @Min(200) @Max(20000) int embedMaxChars,
        /** W1.5: embed activity_log.text / check_in.note in the nightly sweep — off = the catch-up does nothing (the pass HEALS the toggle, never bypasses it). */
        boolean embedNotes,
        /** W1.5 length gate: below this many chars a note carries no retrieval value („fáradt vagyok") and is never embedded. */
        @Min(1) @Max(500) int noteMinChars,
        /** W1.5 blast-radius guard: at most this many note embeddings per user per nightly run — the first-run history backfill spreads over nights instead of one giant burst. */
        @Min(1) @Max(5000) int noteBatchSize
    ) {}
```

- [ ] **Step 5: Add the YAML keys**

In `application.yml`, inside `mezo.companion.embedding`, after `embed-max-chars: 2000`:

```yaml
      # W1.5 (mezo-b3pp.5): the nightly sweep also embeds the narrative written OUTSIDE the journal —
      # activity_log.text (QuickInput „Napló") and check_in.note. Off = the catch-up pass does nothing.
      embed-notes: true
      # Length gate: a note shorter than this carries no retrieval value, so it never becomes a vector
      note-min-chars: 80
      # Per-user, per-run cap on note embeddings — the one-time history backfill spreads over nights
      note-batch-size: 200
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest='CompanionPropertiesIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/MemoryEmbeddingEntity.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java
git commit -m "feat(companion): note-embedding kinds + tuning keys (mezo-b3pp.5)"
```

---

### Task 2: Candidate queries + the two writer paths

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/activity/repository/ActivityLogRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin/repository/CheckInRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingWriterIT.java` (create)

**Interfaces:**
- Consumes: `MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE` / `KIND_CHECKIN_NOTE` (Task 1).
- Produces:
  - `ActivityLogRepository#findNoteCandidates(UUID createdBy, LocalDate through, int minChars) : List<ActivityLogEntity>`
  - `CheckInRepository#findNoteCandidates(UUID createdBy, LocalDate through, int minChars) : List<CheckInEntity>`
  - `MemoryEmbeddingWriter#writeActivityNote(ActivityLogEntity) : void`
  - `MemoryEmbeddingWriter#writeCheckInNote(CheckInEntity) : void`

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingWriterIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * The W1.5 note units on the SINGLE write path: the repositories hand out live, length-gated
 * candidates chronologically, and the writer turns one candidate into one idempotent vector.
 */
@ActiveProfiles("companion-fake")
class NoteEmbeddingWriterIT extends AbstractIntegrationTest {

    private static final String LONG_NOTE =
            "Ma este végre leültem és átgondoltam a hetet, sokkal nyugodtabb voltam mint általában, "
            + "és ez a séta után jött meg igazán.";
    private static final String SHORT_NOTE = "fáradt";

    @Autowired private MemoryEmbeddingWriter writer;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private CheckInRepository checkInRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    @Test
    void testFindNoteCandidates_shouldGateOnLengthAndDate_whenActivityRowsExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        ActivityLogEntity longOne = activityPopulator.activity(owner, yesterday, LONG_NOTE, "mindset", 10, "AI");
        activityPopulator.activity(owner, yesterday, SHORT_NOTE, "mindset", 10, "AI");
        activityPopulator.activity(owner, LocalDate.now().plusDays(1), LONG_NOTE, "mindset", 10, "AI");

        List<ActivityLogEntity> candidates = activityLogRepository.findNoteCandidates(owner, yesterday, 80);

        assertThat(candidates).extracting(ActivityLogEntity::getId).containsExactly(longOne.getId());
    }

    @Test
    void testFindNoteCandidates_shouldGateOnLengthAndSkipNullNotes_whenCheckInsExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        CheckInEntity longOne = checkInPopulator.createCheckIn(owner, yesterday, "08:00", 4, 2, LONG_NOTE);
        checkInPopulator.createCheckIn(owner, yesterday, "12:00", 4, 2, SHORT_NOTE);
        checkInPopulator.createCheckIn(owner, yesterday, "18:00", 4, 2, null);

        List<CheckInEntity> candidates = checkInRepository.findNoteCandidates(owner, yesterday, 80);

        assertThat(candidates).extracting(CheckInEntity::getId).containsExactly(longOne.getId());
    }

    @Test
    void testWriteActivityNote_shouldEmbedOnceOnTheEntryDay_whenCalledTwice() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(3);
        ActivityLogEntity entry = activityPopulator.activity(owner, day, LONG_NOTE, "mindset", 10, "AI");

        writer.writeActivityNote(entry);
        writer.writeActivityNote(entry);

        MemoryEmbeddingEntity vector = memoryEmbeddingRepository
                .findByKindAndRefId(MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, entry.getId()).orElseThrow();
        assertThat(vector.getContent()).isEqualTo(LONG_NOTE);
        assertThat(vector.getOccurredOn()).isEqualTo(day);
        assertThat(vector.getCreatedBy()).isEqualTo(owner);
        assertThat(memoryEmbeddingRepository.countByCreatedByAndKind(
                owner, MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE)).isEqualTo(1);
    }

    @Test
    void testWriteCheckInNote_shouldEmbedOnTheCheckInDay_whenNoteIsSubstantive() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(2);
        CheckInEntity checkIn = checkInPopulator.createCheckIn(owner, day, "18:00", 3, 4, LONG_NOTE);

        writer.writeCheckInNote(checkIn);

        MemoryEmbeddingEntity vector = memoryEmbeddingRepository
                .findByKindAndRefId(MemoryEmbeddingEntity.KIND_CHECKIN_NOTE, checkIn.getId()).orElseThrow();
        assertThat(vector.getContent()).isEqualTo(LONG_NOTE);
        assertThat(vector.getOccurredOn()).isEqualTo(day);
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd backend && ./mvnw clean test -Dtest='NoteEmbeddingWriterIT' -Dmezo.test.use-testcontainers=true`
Expected: COMPILATION FAILURE — `findNoteCandidates` / `writeActivityNote` do not exist.

- [ ] **Step 3: Add the activity candidate query**

In `ActivityLogRepository`, add the imports `org.springframework.data.jpa.repository.Query` and `org.springframework.data.repository.query.Param`, then:

```java
    /**
     * W1.5 note-embedding candidates (mezo-b3pp.5): live entries up to and including {@code through},
     * long enough to carry retrieval value, oldest first — the nightly sweep embeds history in the
     * order it was lived. {@code @SQLRestriction} keeps soft-deleted rows out.
     */
    @Query("""
        select a from ActivityLogEntity a
        where a.createdBy = :createdBy and a.occurredOn <= :through and length(a.text) >= :minChars
        order by a.occurredOn asc, a.createdAt asc
        """)
    List<ActivityLogEntity> findNoteCandidates(@Param("createdBy") UUID createdBy,
                                               @Param("through") LocalDate through,
                                               @Param("minChars") int minChars);
```

- [ ] **Step 4: Add the check-in candidate query**

In `CheckInRepository`, add the same two imports, then:

```java
    /**
     * W1.5 note-embedding candidates (mezo-b3pp.5): live check-ins up to and including
     * {@code through} whose note is substantive, oldest first. A null note fails the length
     * predicate in SQL, so no explicit null branch is needed.
     */
    @Query("""
        select c from CheckInEntity c
        where c.createdBy = :createdBy and c.date <= :through and length(c.note) >= :minChars
        order by c.date asc, c.slotTime asc
        """)
    List<CheckInEntity> findNoteCandidates(@Param("createdBy") UUID createdBy,
                                           @Param("through") LocalDate through,
                                           @Param("minChars") int minChars);
```

- [ ] **Step 5: Add the two writer paths**

In `MemoryEmbeddingWriter`, add the imports `io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity` and `io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity`, then after `writeReflection`:

```java
    /**
     * W1.5 activity note (spec §5.5): a substantive „Napló" entry's own words. WRITE-ONCE via
     * {@link #write} — there is no listener behind this kind, only the nightly sweep, so an edited
     * source row keeps its original vector (known gap, journal.md §9). The entity may be detached:
     * only getters are read.
     */
    @Transactional
    public void writeActivityNote(ActivityLogEntity entry) {
        write(entry.getCreatedBy(), MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, entry.getId(),
                entry.getText(), entry.getOccurredOn());
    }

    /** W1.5 check-in note (spec §5.5) — same write-once unit, dated to the check-in's day. */
    @Transactional
    public void writeCheckInNote(CheckInEntity checkIn) {
        write(checkIn.getCreatedBy(), MemoryEmbeddingEntity.KIND_CHECKIN_NOTE, checkIn.getId(),
                checkIn.getNote(), checkIn.getDate());
    }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest='NoteEmbeddingWriterIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/activity/repository/ActivityLogRepository.java backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin/repository/CheckInRepository.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/MemoryEmbeddingWriter.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingWriterIT.java
git commit -m "feat(companion): note candidate queries + activity/checkin write paths (mezo-b3pp.5)"
```

---

### Task 3: The `NoteEmbeddingCatchUp` pass

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingCatchUp.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingCatchUpIT.java` (create)

**Interfaces:**
- Consumes: `ActivityLogRepository#findNoteCandidates`, `CheckInRepository#findNoteCandidates`, `MemoryEmbeddingWriter#writeActivityNote`, `#writeCheckInNote` (Task 2); `MemoryEmbeddingRepository#findRefIdsByCreatedByAndKind(UUID, String) : Set<UUID>` (existing); `CompanionProperties.Embedding#embedNotes/#noteMinChars/#noteBatchSize` (Task 1).
- Produces: `NoteEmbeddingCatchUp#run(UUID userId, LocalDate through) : int` (number of vectors written this run).

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingCatchUpIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * The W1.5 nightly note sweep: length gate, idempotent re-runs, and a history backfill that is NOT
 * bounded by the daily-summary catch-up window (a not-yet-embedded row from months ago is still a
 * candidate — that IS the one-time backfill).
 */
@ActiveProfiles("companion-fake")
class NoteEmbeddingCatchUpIT extends AbstractIntegrationTest {

    private static final String LONG_NOTE =
            "Ma este végre leültem és átgondoltam a hetet, sokkal nyugodtabb voltam mint általában, "
            + "és ez a séta után jött meg igazán.";
    private static final String SHORT_NOTE = "fáradt";

    @Autowired private NoteEmbeddingCatchUp noteEmbeddingCatchUp;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private ActivityLogRepository activityLogRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    @Test
    void testRun_shouldEmbedBothKindsAndGateOnLength_whenNotesExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        ActivityLogEntity activity = activityPopulator.activity(owner, yesterday, LONG_NOTE, "mindset", 10, "AI");
        activityPopulator.activity(owner, yesterday, SHORT_NOTE, "mindset", 10, "AI");
        CheckInEntity checkIn = checkInPopulator.createCheckIn(owner, yesterday, "18:00", 3, 4, LONG_NOTE);
        checkInPopulator.createCheckIn(owner, yesterday, "08:00", 3, 4, SHORT_NOTE);

        int written = noteEmbeddingCatchUp.run(owner, yesterday);

        assertThat(written).isEqualTo(2);
        assertThat(memoryEmbeddingRepository.existsByKindAndRefId(
                MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, activity.getId())).isTrue();
        assertThat(memoryEmbeddingRepository.existsByKindAndRefId(
                MemoryEmbeddingEntity.KIND_CHECKIN_NOTE, checkIn.getId())).isTrue();
        assertThat(memoryEmbeddingRepository.count()).isEqualTo(2);
    }

    @Test
    void testRun_shouldWriteNothingNew_whenRunTwice() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        activityPopulator.activity(owner, yesterday, LONG_NOTE, "mindset", 10, "AI");
        checkInPopulator.createCheckIn(owner, yesterday, "18:00", 3, 4, LONG_NOTE);

        noteEmbeddingCatchUp.run(owner, yesterday);
        long afterFirst = memoryEmbeddingRepository.count();
        int written = noteEmbeddingCatchUp.run(owner, yesterday);

        assertThat(written).isZero();
        assertThat(memoryEmbeddingRepository.count()).isEqualTo(afterFirst);
    }

    @Test
    void testRun_shouldBackfillOldHistory_whenRowsPredateTheSummaryWindow() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        ActivityLogEntity ancient = activityPopulator.activity(
                owner, yesterday.minusDays(400), LONG_NOTE, "mindset", 10, "AI");

        int written = noteEmbeddingCatchUp.run(owner, yesterday);

        assertThat(written).isEqualTo(1);
        assertThat(memoryEmbeddingRepository.findByKindAndRefId(
                MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, ancient.getId()))
                .get().extracting(MemoryEmbeddingEntity::getOccurredOn)
                .isEqualTo(yesterday.minusDays(400));
    }

    @Test
    void testRun_shouldSkipSoftDeletedSources_whenAnEntryWasDeleted() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        ActivityLogEntity deleted = activityPopulator.activity(owner, yesterday, LONG_NOTE, "mindset", 10, "AI");
        activityLogRepository.delete(deleted); // @SQLDelete → soft delete

        int written = noteEmbeddingCatchUp.run(owner, yesterday);

        assertThat(written).isZero();
        assertThat(memoryEmbeddingRepository.count()).isZero();
    }

    @Test
    void testRun_shouldIgnoreOtherUsersNotes_whenTwoUsersHaveHistory() {
        UUID owner = userPopulator.createUser().getId();
        UUID other = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        activityPopulator.activity(other, yesterday, LONG_NOTE, "mindset", 10, "AI");

        int written = noteEmbeddingCatchUp.run(owner, yesterday);

        assertThat(written).isZero();
        assertThat(memoryEmbeddingRepository.count()).isZero();
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd backend && ./mvnw clean test -Dtest='NoteEmbeddingCatchUpIT' -Dmezo.test.use-testcontainers=true`
Expected: COMPILATION FAILURE — `NoteEmbeddingCatchUp` does not exist.

- [ ] **Step 3: Write the component**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingCatchUp.java`:

```java
package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.activity.repository.ActivityLogRepository;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * W1.5 (spec §5.5, bd mezo-b3pp.5) — the nightly sweep's note pass: the narrative Daniel writes
 * OUTSIDE the journal (QuickInput „Napló" {@code activity_log.text} and {@code check_in.note})
 * joins the vector memory as {@code activity_note}/{@code checkin_note}.
 *
 * <p>There is no live listener behind these kinds: this pass is the ONLY writer, which is why it
 * carries no lower date bound. Every live, length-gated row that has no vector yet is a candidate,
 * so the very first run doubles as the one-time HISTORY BACKFILL and every later run finds only
 * what the previous ones missed (already-embedded rows drop out via the ref-id set). {@code
 * note-batch-size} bounds one run so a long history spreads over nights instead of one burst.
 *
 * <p>Per-row isolation: {@link #run} is deliberately NOT transactional — each
 * {@link MemoryEmbeddingWriter} call goes through the proxy in its OWN transaction, so a failing or
 * racing row is logged and the loop continues (the {@code DailySummaryJob} turn-catch-up idiom).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class NoteEmbeddingCatchUp {

    private final ActivityLogRepository activityLogRepository;
    private final CheckInRepository checkInRepository;
    private final MemoryEmbeddingRepository memoryEmbeddingRepository;
    private final MemoryEmbeddingWriter memoryEmbeddingWriter;
    private final CompanionProperties properties;

    /**
     * Embeds this user's still-unembedded notes up to and including {@code through}, newest run
     * first-come, oldest row first. Returns how many vectors were written (the caller logs it).
     * The toggle is checked HERE so the pass heals it rather than bypassing it.
     */
    public int run(UUID userId, LocalDate through) {
        if (!properties.embedding().embedNotes()) {
            return 0;
        }
        int minChars = properties.embedding().noteMinChars();
        int budget = properties.embedding().noteBatchSize();

        int written = embed(MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, userId, budget,
                activityLogRepository.findNoteCandidates(userId, through, minChars),
                ActivityLogEntity::getId, memoryEmbeddingWriter::writeActivityNote);
        written += embed(MemoryEmbeddingEntity.KIND_CHECKIN_NOTE, userId, budget - written,
                checkInRepository.findNoteCandidates(userId, through, minChars),
                CheckInEntity::getId, memoryEmbeddingWriter::writeCheckInNote);
        return written;
    }

    /** One kind's pass: drop what already has a vector, honour the remaining budget, isolate failures. */
    private <T> int embed(String kind, UUID userId, int budget, List<T> candidates,
                          java.util.function.Function<T, UUID> idOf, Consumer<T> write) {
        if (budget <= 0 || candidates.isEmpty()) {
            return 0;
        }
        Set<UUID> alreadyEmbedded = memoryEmbeddingRepository.findRefIdsByCreatedByAndKind(userId, kind);
        int written = 0;
        for (T candidate : candidates) {
            if (written >= budget) {
                log.info("Note-embedding budget reached for user {} kind {} — the rest waits for the next run",
                        userId, kind);
                break;
            }
            if (alreadyEmbedded.contains(idOf.apply(candidate))) {
                continue;
            }
            try {
                write.accept(candidate);
                written++;
            } catch (Exception e) {
                log.warn("Note-embedding failed for user {} kind {} ref {}", userId, kind,
                        idOf.apply(candidate), e);
            }
        }
        return written;
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest='NoteEmbeddingCatchUpIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingCatchUp.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingCatchUpIT.java
git commit -m "feat(companion): nightly note-embedding catch-up with history backfill (mezo-b3pp.5)"
```

---

### Task 4: Wire it into `DailySummaryJob` + the switch-off gate

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DailySummaryJob.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/DailySummaryJobIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingSwitchOffIT.java`

**Interfaces:**
- Consumes: `NoteEmbeddingCatchUp#run(UUID, LocalDate)` (Task 3).
- Produces: nothing new — the nightly `DailySummaryJob#run()` now also embeds notes.

- [ ] **Step 1: Write the failing tests**

Append to `DailySummaryJobIT` (add imports `io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity`, `io.mrkuhne.mezo.support.populator.ActivityPopulator`, and the field `@Autowired private ActivityPopulator activityPopulator;`):

```java
    @Test
    void testRun_shouldEmbedSubstantiveNotes_whenNotesExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        String longNote = "Ma este végre leültem és átgondoltam a hetet, sokkal nyugodtabb voltam "
                + "mint általában, és ez a séta után jött meg igazán.";
        ActivityLogEntity activity = activityPopulator.activity(owner, yesterday, longNote, "mindset", 10, "AI");
        checkInPopulator.createCheckIn(owner, yesterday, "18:00", 3, 4, "fáradt");

        dailySummaryJob.run();

        assertThat(memoryEmbeddingRepository.existsByKindAndRefId(
                MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, activity.getId())).isTrue();
        assertThat(memoryEmbeddingRepository.countByCreatedByAndKind(
                owner, MemoryEmbeddingEntity.KIND_CHECKIN_NOTE)).isZero();
    }
```

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingSwitchOffIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.companion.service.DailySummaryJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * embed-notes off ⇒ the nightly sweep's note pass does nothing — the toggle is HEALED by the pass,
 * never bypassed (the TurnEmbeddingSwitchOffIT idiom).
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.embedding.embed-notes=false")
class NoteEmbeddingSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private DailySummaryJob dailySummaryJob;
    @Autowired private NoteEmbeddingCatchUp noteEmbeddingCatchUp;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ActivityPopulator activityPopulator;

    @Test
    void testJobRun_shouldEmbedNoNote_whenEmbedNotesOff() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        String longNote = "Ma este végre leültem és átgondoltam a hetet, sokkal nyugodtabb voltam "
                + "mint általában, és ez a séta után jött meg igazán.";
        ActivityLogEntity activity = activityPopulator.activity(owner, yesterday, longNote, "mindset", 10, "AI");

        dailySummaryJob.run();

        assertThat(noteEmbeddingCatchUp.run(owner, yesterday)).isZero();
        assertThat(memoryEmbeddingRepository.existsByKindAndRefId(
                MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, activity.getId())).isFalse();
    }
}
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd backend && ./mvnw clean test -Dtest='DailySummaryJobIT,NoteEmbeddingSwitchOffIT' -Dmezo.test.use-testcontainers=true`
Expected: `DailySummaryJobIT#testRun_shouldEmbedSubstantiveNotes_whenNotesExist` FAILS (`existsByKindAndRefId` is false — the job never calls the pass).

- [ ] **Step 3: Wire the job**

In `DailySummaryJob`: add the field `private final NoteEmbeddingCatchUp noteEmbeddingCatchUp;` (import `io.mrkuhne.mezo.feature.companion.embedding.NoteEmbeddingCatchUp`) and, inside the per-user loop right after the turn catch-up block and before the closing `log.info`:

```java
            // W1.5 (spec §5.5): one nightly narrative sweep, not a new cron — the notes written
            // OUTSIDE the journal join the memory here. Its own toggle + batch budget live in the
            // pass; a failing row is isolated there, so nothing can abort the user's run.
            int notes = 0;
            try {
                notes = noteEmbeddingCatchUp.run(user.getId(), yesterday);
            } catch (Exception e) {
                log.warn("Note-embedding catch-up failed for user {}", user.getId(), e);
            }
            log.info("Daily-summary run for user {}: {} day(s) processed, {} note(s) embedded in window {}..{}",
                    user.getId(), generated, notes, from, yesterday);
```

(Replace the existing `log.info("Daily-summary run for user {}: {} day(s) processed in window {}..{}", ...)` line with the one above.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && ./mvnw clean test -Dtest='DailySummaryJobIT,DailySummaryJobSwitchOffIT,NoteEmbeddingSwitchOffIT,TurnEmbeddingSwitchOffIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DailySummaryJob.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/DailySummaryJobIT.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/embedding/NoteEmbeddingSwitchOffIT.java
git commit -m "feat(companion): the nightly sweep runs the note catch-up (mezo-b3pp.5)"
```

---

### Task 5: Docs in the same change

**Files:**
- Modify: `docs/features/journal.md` (§3 architecture, §4 the kind-expansion block, §5 integrations, §8 testing, §9 gotchas, §10 key files)
- Modify: `docs/features/companion.md` (the embedding-kind list ~line 1129-1134 and the workstream table row near line 584-585)
- Regenerate: `docs/CODEMAP.md`

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: nothing code-facing.

- [ ] **Step 1: Update `docs/features/journal.md`**

Read the file first. Then, keeping the house voice (code-native, no marketing prose):
- §3/§5: add the W1.5 seam — `activity_log.text` / `check_in.note` reach `memory_embedding` with **no listener**, only the nightly `DailySummaryJob` → `NoteEmbeddingCatchUp` → `MemoryEmbeddingWriter.writeActivityNote/writeCheckInNote` path; length gate `note-min-chars`, per-run cap `note-batch-size`, toggle `embed-notes`; the pass has **no lower date bound**, which is what makes the first run the one-time history backfill.
- §4 „The `memory_embedding` kind expansion" block: mark `activity_note`/`checkin_note` as now POPULATED (they were listed as headroom).
- §8: name the new ITs (`NoteEmbeddingWriterIT`, `NoteEmbeddingCatchUpIT`, `NoteEmbeddingSwitchOffIT`, the `DailySummaryJobIT` case).
- §9 gotchas — record BOTH known gaps honestly: (a) these kinds are **write-once**, so editing an `activity_log`/`check_in` note after it was embedded leaves the original vector standing; (b) soft-deleting a source row does **not** remove its vector (unlike `journal_entry`, which has a delete path) — the follow-up bd issue filed in Task 6 covers both.
- §10 key files: `NoteEmbeddingCatchUp.java`, the two repository queries, the two writer methods.

- [ ] **Step 2: Update `docs/features/companion.md`**

- The embedding-kind list (~line 1129-1134) currently says `activity_note`/`checkin_note` "are still schema headroom" — replace with what W1.5 actually writes and point at `journal.md`.
- Add a workstream-table row next to the „Journal embedding seam" / „Decision embedding seam" rows: „Note catch-up seam | ✅ `mezo-b3pp.5` | …".
- Line ~672-673 says "journal has no nightly self-heal sweep (spec §5.5 scopes W1.5's catch-up job to `activity_note`/`checkin_note` only)" — that statement stays TRUE; verify it still reads correctly after the edits.

- [ ] **Step 3: Regenerate the codemap and lint**

```bash
node scripts/gen-codemap.mjs
node scripts/lint-docs.mjs
```
Expected: lint reports no NEW staleness or broken links.

- [ ] **Step 4: Commit**

```bash
git add docs/features/journal.md docs/features/companion.md docs/CODEMAP.md
git commit -m "docs(journal): W1.5 note-embedding catch-up seam (mezo-b3pp.5)"
```

---

### Task 6: Gates + ship

**Files:** none (process task).

- [ ] **Step 1: Focused backend gate**

```bash
cd backend && ./mvnw clean test -Dtest='NoteEmbedding*IT,DailySummaryJob*IT,MemoryEmbeddingWriterIT,Journal*IT,Decision*IT,CompanionPropertiesIT,CompanionMemory*IT,*ArchUnit*' -Dmezo.test.use-testcontainers=true
```
Expected: 0 failures, 0 errors. (Testcontainers mode — the fixed-DB mode races with parallel sessions.)

- [ ] **Step 2: File the known-gap follow-up in bd**

```bash
bd create "W1.5 follow-up: note vectors go stale on source edit/delete (activity_note, checkin_note)" -t task -p 2 --parent mezo-b3pp
```
Body: the two gaps documented in `journal.md` §9 — write-once kinds keep their original vector after the source note is edited, and a soft-deleted `activity_log`/`check_in` row leaves its vector recallable. Fix shape: compare stored content in the nightly pass and `upsert` on drift; reap vectors whose source row is no longer live.

- [ ] **Step 3: Push + self-PR (the CI gate)**

```bash
git push -u origin feat/note-embedding-catchup
```
Then `gh pr create` with a Hungarian title carrying the bd id, e.g. `feat(companion): W1.5 jegyzet-beágyazás utólagos felzárkóztatással (mezo-b3pp.5)`, and watch: `gh pr checks <PR#> --watch`.

- [ ] **Step 4: Merge locally after CI green**

```bash
git -C /Users/mrkuhne/Applications/Personal/Mezo/mezo pull --rebase
git -C /Users/mrkuhne/Applications/Personal/Mezo/mezo merge --no-ff feat/note-embedding-catchup
git -C /Users/mrkuhne/Applications/Personal/Mezo/mezo push
```

- [ ] **Step 5: Close the bd issue and clean up**

```bash
bd close mezo-b3pp.5 && bd dolt push
git push origin --delete feat/note-embedding-catchup
```
Then confirm `git status` is "up to date with origin" in both the primary repo and this worktree.
