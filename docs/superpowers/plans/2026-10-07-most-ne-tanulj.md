# „Most ne tanulj" (learning pause) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A master switch in the Tudástár that pauses everything Boop learns on its own — strictly: material from a paused period is never learned from, online or in any later batch — while existing knowledge stays in use.

**Architecture:** Pause *intervals* are stored in an account-level table owned by `feature/auth` (the only slice every learner can import). One service answers "is this instant / this local day paused?", one SQL fragment excludes paused rows from batch windows. Online learners skip paused events; every look-back job excludes paused material and paused days. The UI (hub switch row, duration sheet, persistent strips) ships last, when the promise is true.

**Tech Stack:** Spring Boot (Java), Liquibase, Postgres, OpenAPI-first contract (`api/feature/*`), React + TanStack Query (`useDualQuery`), Vitest, Playwright layout specs.

**Spec:** [`docs/superpowers/specs/2026-10-07-most-ne-tanulj-design.md`](../specs/2026-10-07-most-ne-tanulj-design.md) · **bd:** `mezo-rrjxe` · **Prototype (owner OK 2026-10-07):** `docs/design_2.0/prototypes/elo/mezo.html` routes `#tudastar`, `#tenyek`, `#rolad`, `#elo`, `#chat/szunet`, `#hogyan`, `#ikonok-lp` (Artifact https://claude.ai/artifact/LBngXviRqUhc5q2ragbtex).

## Global Constraints

- **The promise (copy, verbatim):** „Amíg szünetel a tanulás, magamtól semmit nem jegyzek meg — és abból, amit közben mondasz vagy írsz, később sem tanulok."
- **Record rule:** a text record whose `created_at` falls inside a pause interval is *paused material*; no learning path may read it, ever. **Day rule:** a local day (zone `Europe/Budapest`, the existing per-feature `zone` properties) overlapping a pause at any instant is a *paused day*: no daily summary, and it is excluded from all numeric evidence.
- **"Reagálni szabad, megőrizni nem":** real-time reactions to logged numbers keep working; anything that persists a narrative or conclusion about the paused period is skipped.
- **Explicit user acts stay allowed** (fact create/edit/mute/forget, candidate decisions, pattern decide/reply, question-card answers, „Rólam is", people CRUD).
- **Never reuse `ai_message.extraction_blocked`** — it means "forgotten" (S8b) and hides the turn from the user's own recall.
- **A disabled/failed pause check must never mean "learn":** `LearningPauseService` is an ungated `@Service`; learners that cannot reach it skip (fail-closed for learning, fail-open for the user-visible result).
- **Durations:** `tonight` → next local midnight · `tomorrow_morning` → tomorrow at `mezo.notification.quiet-hours.end` (07:00) · `open` → no planned end. Expiry is computed (`now >= planned_end_at`), never job-dependent.
- **Slice order is fixed (owner D5):** B1 → B2 → F. No UI before B2 is merged.
- **House rules:** code decides status, the LLM never; switch-gated beans; async after-commit listeners swallow-and-log; ArchUnit `feature_slices_are_cycle_free`; contract enums as `enum:` (never `pattern:`); no apostrophe inside single-quoted YAML; new owned table → `ResetDatabase`; `node scripts/gen-codemap.mjs` after every merge; `node scripts/lint-docs.mjs` 0 errors / 0 stale.
- **Gates per slice:** backend focused tests + full suite `./mvnw test -Dmezo.test.use-testcontainers=true`; FE tests in both modes with `CI=true` (`VITE_USE_MOCK` unset AND `=false`), `pnpm build`, affected `frontend/tests/layout` specs (slice F).
- **Design (slice F):** build to the approved prototype using the shared kit only (`frontend/src/shared/ui`, existing hub CSS). The Cseppesítés programme (epic `cseppesites`, started 2026-10-07) re-skins whole domains later; if the Mezo domain has already been re-skinned when slice F starts, the same layout is built with the then-current kit and the living prototype's then-current look — no new look is invented and no extra owner round is needed for that.

## *Kész, ha…* (written into `mezo-rrjxe` with `bd update mezo-rrjxe --acceptance`)

1. **Store + API:** `learning_pause` table live in prod; `GET/PUT/DELETE /api/learning-pause` work; one open interval per user; timed pauses read as ended at their planned end without any job.
2. **Online gates:** a chat turn, journal / gratitude / decision / reflection entry, check-in note, training note and csapatfal reply made during a pause produce no `learned_fact`, `knowledge_fact`, `person_fact`, mention, `text_signal`, pattern, `memory_embedding` / `memory_item`, or csapatfal exception.
3. **Batch gates:** after resume, running every nightly / weekly / quarterly job with the clock past each look-back window creates nothing from paused material and nothing for paused days (leak-matrix IT green for every `LEARNS` path).
4. **Registry guard:** every `@Scheduled` class and every listener on the learning events is classified `LEARNS` / `MAINTAINS` / `NEUTRAL`; an unclassified one fails the build.
5. **Honesty:** the chat prompt carries `[Tanulás szünetel]` while paused; no memory chips on paused turns; csapatfal reply is `ANSWER_ONLY` while paused.
6. **Expiry:** the sweep closes expired rows and emits one „Újra figyelek" in-app notification; an open-ended pause gets one reminder after 3 days.
7. **What the owner sees (slice F):** hub switch row + three-option sheet + paused row state; strip on every Tudástár view, Rólad, csapatfal and chat; paused-chat quiet line; „Hogyan működik?" paragraph; new sprite icon `t-learn-pause`; loading / error / companion-off states; 320 px; reduced motion — all matching the prototype routes above.
8. **Parity:** every control, state and data field of `KnowledgeListPage`, `KnowledgeBaseView`, `BoopAboutPage`, `TeamChatPage` and the chat page still present; no behaviour change outside this spec.
9. **Gates:** as in Global Constraints, per slice.
10. **Docs:** `docs/features/{companion,insights,me,character,proactive}.md` updated; feature index row; milestone log entry when F ships; spec gets a "Slice lessons" note.
11. **Shipped:** each slice merged to main, `deploy` green for the commit, new version live; after B1 the prod table exists; after F a live pause/resume round-trip leaves exactly one closed interval row (verified with a read-only query).
12. **Living prototype** in sync with production and republished after F.

---

## File structure

**Backend — new (package `backend/src/main/java/io/mrkuhne/mezo/feature/auth`):**
- `entity/LearningPauseEntity.java` — one interval row.
- `repository/LearningPauseRepository.java` — open row, overlap queries.
- `service/LearningPauseService.java` — start / end / current / `isPausedAt` / `isPausedDay` / `pausedDays` / `intervals`.
- `service/LearningPauseSql.java` — the one SQL fragment for batch exclusion.
- `service/LearningPauseExpiryJob.java` — closes expired rows, emits notifications (B2).
- `controller/LearningPauseController.java` — the three endpoints.
- `db/changelog/1.1.0/script/<ts>_mezo-rrjxe_learning_pause.sql` + master entry.

**Backend — modified:** `ChatTurnCompleted` (+`learningPaused`), `ChatService` (two publish sites + prompt block), the four chat-turn listeners, note listeners, `TeamChatReplyService`, `MemoryEmbeddingWriter` and the catch-up sweeps, reflection / people / proactive / character job steps (B2), `FakeCompanionLlm`, `AppNotificationKind`, `ResetDatabase`.

**Contract:** `api/feature/auth/auth.yml` (+ generated `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`).

**Frontend — new:** `frontend/src/data/account/learningPauseApi.ts`, `learningPauseHooks.ts`, `learningPauseMock.ts`; `frontend/src/features/insights/logic/learningPauseCopy.ts`; `frontend/src/features/insights/components/pause/{LearningPauseRow,LearningPauseSheet,LearningPauseStrip}.tsx`.
**Frontend — modified:** `KnowledgeBaseView.tsx`, `KnowledgeListPage.tsx` (`TudasFrame`), `BoopAboutPage.tsx`, `TeamChatPage.tsx`, the chat page header, `HowItWorksView.tsx`, sprite, `frontend/src/test/msw/handlers.ts`, layout specs.

---

# Slice B1 — store, API, online gates (invisible)

Branch `feat/emlekezet-pause-b1`. Ends with merge + deploy + prod table check.

### Task 1: `learning_pause` table, entity, repository

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202610081000_mezo-rrjxe_learning_pause.sql`
- Modify: `backend/src/main/resources/db/changelog/1.1.0/1.1.0_master.yml` (append one changeSet)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/entity/LearningPauseEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/repository/LearningPauseRepository.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (add `learning_pause` to the TRUNCATE list, next to `companion_preferences`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/LearningPauseRepositoryIT.java`

**Interfaces:**
- Produces: `LearningPauseEntity` (`id`, `createdBy`, `startedAt`, `plannedEndAt`, `endedAt`, `durationChoice`, `endReason`); `LearningPauseRepository.findOpen(UUID)`, `.overlapping(UUID, Instant from, Instant to)`, `.expiredOpen(Instant now)`, `.openEndedOlderThan(Instant before)`.

- [ ] **Step 1: Write the migration**

```sql
-- "Most ne tanulj" (mezo-rrjxe, spec 2026-10-07): one row per pause interval. An interval is in
-- effect from started_at until coalesce(ended_at, planned_end_at, infinity) — expiry is COMPUTED
-- from planned_end_at, the sweep only stamps ended_at afterwards. Intervals are never deleted:
-- every look-back window excludes them forever (owner decision D1, "végleg kimarad").
create table learning_pause (
    id               uuid         not null default gen_random_uuid(),
    created_by       uuid         not null,
    is_deleted       boolean      not null default false,
    created_at       timestamptz  not null default now(),
    started_at       timestamptz  not null,
    planned_end_at   timestamptz,
    ended_at         timestamptz,
    duration_choice  varchar(20)  not null,
    end_reason       varchar(8),
    reminded_at      timestamptz,
    constraint pk_learning_pause_id primary key (id),
    constraint fk_learning_pause_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_learning_pause_duration_choice
        check (duration_choice in ('tonight', 'tomorrow_morning', 'open')),
    constraint ck_learning_pause_end_reason check (end_reason is null or end_reason in ('user', 'expired')),
    constraint ck_learning_pause_planned_end check (planned_end_at is null or planned_end_at > started_at),
    constraint ck_learning_pause_ended check (ended_at is null or ended_at >= started_at)
);
create unique index uq_learning_pause_one_open on learning_pause (created_by)
    where is_deleted = false and ended_at is null;
create index idx_learning_pause_user_started on learning_pause (created_by, started_at) where is_deleted = false;
```

Master entry (append, mirroring the previous changeSet):

```yaml
  - changeSet:
      id: "1.1.0:202610081000_mezo-rrjxe_learning_pause"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202610081000_mezo-rrjxe_learning_pause.sql
```

- [ ] **Step 2: Write the failing repository IT**

```java
package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.auth.entity.LearningPauseEntity;
import io.mrkuhne.mezo.feature.auth.repository.LearningPauseRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

class LearningPauseRepositoryIT extends AbstractIntegrationTest {

    @Autowired private LearningPauseRepository pauses;
    @Autowired private UserPopulator userPopulator;

    private LearningPauseEntity pause(UUID user, Instant start, Instant plannedEnd, Instant ended) {
        LearningPauseEntity p = new LearningPauseEntity();
        p.setCreatedBy(user);
        p.setStartedAt(start);
        p.setPlannedEndAt(plannedEnd);
        p.setEndedAt(ended);
        p.setDurationChoice(plannedEnd == null ? "open" : "tonight");
        p.setEndReason(ended == null ? null : "user");
        return pauses.saveAndFlush(p);
    }

    @Test
    void oneOpenIntervalPerUser() {
        UUID user = userPopulator.createUser().getId();
        Instant t = Instant.parse("2026-10-08T10:00:00Z");
        pause(user, t, null, null);
        assertThat(pauses.findOpen(user)).isPresent();
        assertThatThrownBy(() -> pause(user, t.plus(1, ChronoUnit.HOURS), null, null))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void overlapping_usesTheEffectiveEnd_plannedOrEndedOrOpen() {
        UUID user = userPopulator.createUser().getId();
        Instant t = Instant.parse("2026-10-01T10:00:00Z");
        pause(user, t, t.plus(2, ChronoUnit.HOURS), t.plus(1, ChronoUnit.HOURS));          // ended early by the user
        pause(user, t.plus(1, ChronoUnit.DAYS), t.plus(1, ChronoUnit.DAYS).plus(3, ChronoUnit.HOURS), null); // timed, unswept
        assertThat(pauses.overlapping(user, t.plus(90, ChronoUnit.MINUTES), t.plus(100, ChronoUnit.MINUTES))).isEmpty();
        assertThat(pauses.overlapping(user, t.plus(30, ChronoUnit.MINUTES), t.plus(40, ChronoUnit.MINUTES))).hasSize(1);
        assertThat(pauses.overlapping(user, t.plus(1, ChronoUnit.DAYS).plus(4, ChronoUnit.HOURS),
                t.plus(2, ChronoUnit.DAYS))).isEmpty();                                    // past its planned end
        assertThat(pauses.expiredOpen(t.plus(2, ChronoUnit.DAYS))).hasSize(1);
    }
}
```

- [ ] **Step 3: Run it — expect a compile failure**

Run: `cd backend && ./mvnw -q test -Dmezo.test.use-testcontainers=true -Dtest=LearningPauseRepositoryIT`
Expected: FAIL — `LearningPauseEntity` / `LearningPauseRepository` do not exist.

- [ ] **Step 4: Entity and repository**

```java
package io.mrkuhne.mezo.feature.auth.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

/** One "Most ne tanulj" interval (mezo-rrjxe). In effect until
 *  {@code coalesce(endedAt, plannedEndAt, +infinity)}; never deleted. */
@Getter
@Setter
@Entity
@Table(name = "learning_pause")
@SQLRestriction("is_deleted = false")
public class LearningPauseEntity extends OwnedEntity {
    public static final String TONIGHT = "tonight";
    public static final String TOMORROW_MORNING = "tomorrow_morning";
    public static final String OPEN = "open";
    public static final String END_USER = "user";
    public static final String END_EXPIRED = "expired";

    @Id @GeneratedValue @Column(columnDefinition = "uuid")
    private UUID id;
    @Column(name = "started_at", nullable = false)
    private Instant startedAt;
    @Column(name = "planned_end_at")
    private Instant plannedEndAt;
    @Column(name = "ended_at")
    private Instant endedAt;
    @Column(name = "duration_choice", nullable = false, length = 20)
    private String durationChoice;
    @Column(name = "end_reason", length = 8)
    private String endReason;
    @Column(name = "reminded_at")
    private Instant remindedAt;

    /** The instant this interval stops applying; null = still open-ended. */
    public Instant effectiveEnd() {
        return endedAt != null ? endedAt : plannedEndAt;
    }
}
```

```java
package io.mrkuhne.mezo.feature.auth.repository;

import io.mrkuhne.mezo.feature.auth.entity.LearningPauseEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface LearningPauseRepository extends JpaRepository<LearningPauseEntity, UUID> {

    /** The row with no {@code endedAt} — at most one per user (uq_learning_pause_one_open). It may
     *  already be past its planned end; the service decides whether it still applies. */
    @Query("select p from LearningPauseEntity p where p.createdBy = :user and p.endedAt is null")
    Optional<LearningPauseEntity> findOpen(UUID user);

    /** Intervals in effect at any instant of {@code [from, to)}. */
    @Query("select p from LearningPauseEntity p where p.createdBy = :user and p.startedAt < :to"
            + " and (coalesce(p.endedAt, p.plannedEndAt) is null or coalesce(p.endedAt, p.plannedEndAt) > :from)"
            + " order by p.startedAt")
    List<LearningPauseEntity> overlapping(UUID user, Instant from, Instant to);

    /** Timed pauses past their planned end that the sweep has not stamped yet (all users). */
    @Query("select p from LearningPauseEntity p where p.endedAt is null and p.plannedEndAt is not null"
            + " and p.plannedEndAt <= :now")
    List<LearningPauseEntity> expiredOpen(Instant now);

    /** Open-ended pauses started before {@code before} that were never reminded (all users). */
    @Query("select p from LearningPauseEntity p where p.endedAt is null and p.plannedEndAt is null"
            + " and p.remindedAt is null and p.startedAt <= :before")
    List<LearningPauseEntity> openEndedOlderThan(Instant before);
}
```

Add `learning_pause, ` to the TRUNCATE list in `ResetDatabase.resetExceptMasterData()` right before `companion_preferences`.

- [ ] **Step 5: Run — expect PASS**

Run: `cd backend && ./mvnw -q test -Dmezo.test.use-testcontainers=true -Dtest=LearningPauseRepositoryIT`
Expected: 2 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/resources/db backend/src/main/java/io/mrkuhne/mezo/feature/auth backend/src/test
git commit -m "feat(auth): learning_pause interval store (mezo-rrjxe)"
```

### Task 2: `LearningPauseService` + `LearningPauseSql`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/LearningPauseService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/LearningPauseSql.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/LearningPauseServiceIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/service/LearningPauseWindowTest.java`

**Interfaces:**
- Consumes: Task 1 repository; `NotificationProperties.quietHours().end()` ("07:00").
- Produces (used by every later task):
  - `record Status(boolean paused, Instant startedAt, Instant until, String choice)`
  - `Status current(UUID userId)` · `Status start(UUID userId, String choice)` · `Status end(UUID userId)`
  - `boolean isPausedAt(UUID userId, Instant at)`
  - `boolean isPausedDay(UUID userId, LocalDate day)` · `Set<LocalDate> pausedDays(UUID userId, LocalDate from, LocalDate toInclusive)`
  - `static Instant plannedEnd(String choice, Instant now, ZoneId zone, LocalTime morning)`
  - `LearningPauseSql.notPaused(String alias)` → SQL predicate string on `<alias>.created_by` / `<alias>.created_at`
  - `ZONE = ZoneId.of("Europe/Budapest")`

- [ ] **Step 1: Write the failing unit test for the duration arithmetic**

```java
package io.mrkuhne.mezo.feature.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class LearningPauseWindowTest {

    private static final ZoneId ZONE = ZoneId.of("Europe/Budapest");
    private static final LocalTime MORNING = LocalTime.of(7, 0);

    @Test
    void tonight_endsAtTheNextLocalMidnight_evenWhenStartedLate() {
        // 2026-10-08 23:30 Budapest (UTC+2) → 2026-10-09 00:00 Budapest
        Instant now = Instant.parse("2026-10-08T21:30:00Z");
        assertThat(LearningPauseService.plannedEnd("tonight", now, ZONE, MORNING))
                .isEqualTo(Instant.parse("2026-10-08T22:00:00Z"));
    }

    @Test
    void tomorrowMorning_endsAtTomorrowsQuietHoursEnd() {
        Instant now = Instant.parse("2026-10-08T10:00:00Z");
        assertThat(LearningPauseService.plannedEnd("tomorrow_morning", now, ZONE, MORNING))
                .isEqualTo(Instant.parse("2026-10-09T05:00:00Z"));
    }

    @Test
    void tomorrowMorning_afterMidnightBeforeTheMorning_stillMeansTheNextCalendarDay() {
        // 01:00 on the 9th → the morning of the 10th: "holnap reggelig" never ends within hours.
        Instant now = Instant.parse("2026-10-08T23:00:00Z");
        assertThat(LearningPauseService.plannedEnd("tomorrow_morning", now, ZONE, MORNING))
                .isEqualTo(Instant.parse("2026-10-10T05:00:00Z"));
    }

    @Test
    void open_hasNoPlannedEnd() {
        assertThat(LearningPauseService.plannedEnd("open", Instant.now(), ZONE, MORNING)).isNull();
    }
}
```

- [ ] **Step 2: Write the failing service IT**

```java
package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.entity.LearningPauseEntity;
import io.mrkuhne.mezo.feature.auth.repository.LearningPauseRepository;
import io.mrkuhne.mezo.feature.auth.service.LearningPauseService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class LearningPauseServiceIT extends AbstractIntegrationTest {

    @Autowired private LearningPauseService service;
    @Autowired private LearningPauseRepository pauses;
    @Autowired private UserPopulator userPopulator;

    @Test
    void start_thenEnd_leavesOneClosedInterval_andIsIdempotent() {
        UUID user = userPopulator.createUser().getId();
        assertThat(service.current(user).paused()).isFalse();

        LearningPauseService.Status on = service.start(user, "open");
        assertThat(on.paused()).isTrue();
        assertThat(on.until()).isNull();
        assertThat(service.start(user, "tonight").choice()).isEqualTo("open"); // already paused: unchanged
        assertThat(service.isPausedAt(user, Instant.now())).isTrue();

        assertThat(service.end(user).paused()).isFalse();
        assertThat(service.end(user).paused()).isFalse();                       // idempotent
        assertThat(pauses.findAll()).singleElement()
                .satisfies(p -> assertThat(p.getEndReason()).isEqualTo(LearningPauseEntity.END_USER));
    }

    @Test
    void aTimedPause_readsAsEnded_pastItsPlannedEnd_withoutAnySweep() {
        UUID user = userPopulator.createUser().getId();
        LearningPauseEntity p = new LearningPauseEntity();
        p.setCreatedBy(user);
        p.setStartedAt(Instant.now().minus(3, ChronoUnit.HOURS));
        p.setPlannedEndAt(Instant.now().minus(1, ChronoUnit.HOURS));
        p.setDurationChoice("tonight");
        pauses.saveAndFlush(p);

        assertThat(service.current(user).paused()).isFalse();
        assertThat(service.isPausedAt(user, Instant.now())).isFalse();
        assertThat(service.isPausedAt(user, Instant.now().minus(2, ChronoUnit.HOURS))).isTrue();
        // starting again closes the stale row first (one open row per user)
        assertThat(service.start(user, "open").paused()).isTrue();
        assertThat(pauses.findAll()).hasSize(2);
    }

    @Test
    void pausedDays_coversEveryLocalDayTheIntervalTouches() {
        UUID user = userPopulator.createUser().getId();
        LearningPauseEntity p = new LearningPauseEntity();
        p.setCreatedBy(user);
        p.setStartedAt(Instant.parse("2026-10-01T18:00:00Z"));   // 20:00 Budapest on the 1st
        p.setEndedAt(Instant.parse("2026-10-02T22:30:00Z"));     // 00:30 Budapest on the 3rd
        p.setEndReason("user");
        p.setDurationChoice("open");
        pauses.saveAndFlush(p);

        assertThat(service.pausedDays(user, LocalDate.of(2026, 9, 28), LocalDate.of(2026, 10, 5)))
                .containsExactlyInAnyOrder(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2), LocalDate.of(2026, 10, 3));
        assertThat(service.isPausedDay(user, LocalDate.of(2026, 10, 4))).isFalse();
    }
}
```

- [ ] **Step 3: Run both — expect compile failure**

Run: `cd backend && ./mvnw -q test -Dmezo.test.use-testcontainers=true -Dtest='LearningPauseWindowTest,LearningPauseServiceIT'`
Expected: FAIL — `LearningPauseService` does not exist.

- [ ] **Step 4: Implement the service and the SQL fragment**

```java
package io.mrkuhne.mezo.feature.auth.service;

import io.mrkuhne.mezo.feature.auth.entity.LearningPauseEntity;
import io.mrkuhne.mezo.feature.auth.repository.LearningPauseRepository;
import io.mrkuhne.mezo.feature.notification.config.NotificationProperties;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Most ne tanulj" (mezo-rrjxe, spec 2026-10-07): the one place that answers whether learning is
 * paused for a user at an instant or on a local day. Deliberately NOT switch-gated: a missing
 * gate must never read as "learn". Lives in {@code feature/auth} because every learner slice
 * (people, companion, character, proactive) may import auth, and nothing else is below people.
 *
 * <p>An interval applies on {@code [startedAt, coalesce(endedAt, plannedEndAt, +inf))}. Expiry is
 * computed here from {@code plannedEndAt}; {@link LearningPauseExpiryJob} only stamps
 * {@code endedAt} afterwards, so a late sweep can never extend a pause.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LearningPauseService {

    public static final ZoneId ZONE = ZoneId.of("Europe/Budapest");

    private final LearningPauseRepository pauses;
    private final NotificationProperties notificationProperties;

    public record Status(boolean paused, Instant startedAt, Instant until, String choice) {
        public static Status off() {
            return new Status(false, null, null, null);
        }
    }

    @Transactional(readOnly = true)
    public Status current(UUID userId) {
        return applying(userId, Instant.now()).map(LearningPauseService::status).orElseGet(Status::off);
    }

    /** Starts a pause. Already paused → the running pause is returned unchanged. */
    @Transactional
    public Status start(UUID userId, String choice) {
        Instant now = Instant.now();
        Optional<LearningPauseEntity> open = pauses.findOpen(userId);
        if (open.isPresent()) {
            LearningPauseEntity p = open.get();
            if (applies(p, now)) {
                return status(p);
            }
            close(p, p.getPlannedEndAt(), LearningPauseEntity.END_EXPIRED); // stale timed row the sweep has not reached
        }
        LearningPauseEntity p = new LearningPauseEntity();
        p.setCreatedBy(userId);
        p.setStartedAt(now);
        p.setDurationChoice(choice);
        p.setPlannedEndAt(plannedEnd(choice, now, ZONE, LocalTime.parse(notificationProperties.quietHours().end())));
        log.info("Learning paused for user {} ({})", userId, choice);
        return status(pauses.saveAndFlush(p));
    }

    /** Ends the running pause, if any. Idempotent. */
    @Transactional
    public Status end(UUID userId) {
        Instant now = Instant.now();
        pauses.findOpen(userId).ifPresent(p -> {
            boolean expired = p.getPlannedEndAt() != null && !now.isBefore(p.getPlannedEndAt());
            close(p, expired ? p.getPlannedEndAt() : now,
                    expired ? LearningPauseEntity.END_EXPIRED : LearningPauseEntity.END_USER);
            log.info("Learning resumed for user {}", userId);
        });
        return Status.off();
    }

    /** The record rule: was learning paused for this user at {@code at}? */
    @Transactional(readOnly = true)
    public boolean isPausedAt(UUID userId, Instant at) {
        return userId != null && at != null && !pauses.overlapping(userId, at, at.plusNanos(1_000)).isEmpty();
    }

    /** The day rule: does any pause touch this local day? */
    @Transactional(readOnly = true)
    public boolean isPausedDay(UUID userId, LocalDate day) {
        return !pausedDays(userId, day, day).isEmpty();
    }

    /** Every local day in {@code [from, toInclusive]} touched by a pause. */
    @Transactional(readOnly = true)
    public Set<LocalDate> pausedDays(UUID userId, LocalDate from, LocalDate toInclusive) {
        Instant winFrom = from.atStartOfDay(ZONE).toInstant();
        Instant winTo = toInclusive.plusDays(1).atStartOfDay(ZONE).toInstant();
        Set<LocalDate> days = new LinkedHashSet<>();
        for (LearningPauseEntity p : pauses.overlapping(userId, winFrom, winTo)) {
            Instant start = p.getStartedAt().isBefore(winFrom) ? winFrom : p.getStartedAt();
            Instant end = p.effectiveEnd() == null || p.effectiveEnd().isAfter(winTo) ? winTo : p.effectiveEnd();
            LocalDate d = start.atZone(ZONE).toLocalDate();
            // the end instant is exclusive: an interval ending exactly at midnight does not touch the next day
            LocalDate last = end.minusNanos(1_000).atZone(ZONE).toLocalDate();
            for (; !d.isAfter(last) && !d.isAfter(toInclusive); d = d.plusDays(1)) {
                days.add(d);
            }
        }
        return days;
    }

    /** {@code tonight} → next local midnight; {@code tomorrow_morning} → tomorrow at {@code morning};
     *  {@code open} → null. */
    public static Instant plannedEnd(String choice, Instant now, ZoneId zone, LocalTime morning) {
        ZonedDateTime local = now.atZone(zone);
        return switch (choice) {
            case LearningPauseEntity.TONIGHT -> local.toLocalDate().plusDays(1).atStartOfDay(zone).toInstant();
            case LearningPauseEntity.TOMORROW_MORNING ->
                    local.toLocalDate().plusDays(1).atTime(morning).atZone(zone).toInstant();
            case LearningPauseEntity.OPEN -> null;
            default -> throw new IllegalArgumentException("Unknown learning pause choice: " + choice);
        };
    }

    void close(LearningPauseEntity p, Instant endedAt, String reason) {
        p.setEndedAt(endedAt);
        p.setEndReason(reason);
        pauses.saveAndFlush(p);
    }

    private Optional<LearningPauseEntity> applying(UUID userId, Instant now) {
        return pauses.findOpen(userId).filter(p -> applies(p, now));
    }

    private static boolean applies(LearningPauseEntity p, Instant now) {
        return p.getPlannedEndAt() == null || now.isBefore(p.getPlannedEndAt());
    }

    private static Status status(LearningPauseEntity p) {
        return new Status(true, p.getStartedAt(), p.getPlannedEndAt(), p.getDurationChoice());
    }
}
```

```java
package io.mrkuhne.mezo.feature.auth.service;

/**
 * The batch half of "Most ne tanulj" (mezo-rrjxe): ONE SQL predicate that excludes paused
 * material, composed by every native look-back query — the
 * {@code MemorySourceVisibilitySql.forgottenTurn} idiom. Nobody re-derives the interval maths.
 */
public final class LearningPauseSql {

    private LearningPauseSql() {
    }

    /** True for rows of {@code alias} (needs {@code created_by}, {@code created_at}) that were NOT
     *  created inside any pause interval of their owner. */
    public static String notPaused(String alias) {
        return " not exists (select 1 from learning_pause lp where lp.created_by = " + alias + ".created_by"
                + " and lp.is_deleted = false and " + alias + ".created_at >= lp.started_at"
                + " and " + alias + ".created_at < coalesce(lp.ended_at, lp.planned_end_at, 'infinity'::timestamptz)) ";
    }
}
```

- [ ] **Step 5: Run — expect PASS**

Run: `cd backend && ./mvnw -q test -Dmezo.test.use-testcontainers=true -Dtest='LearningPauseWindowTest,LearningPauseServiceIT,ArchitectureTest'`
Expected: all green (ArchUnit confirms `auth → notification` adds no cycle; if it reports one, inject the morning time through a new `mezo.auth.learning-pause.morning` property instead and re-run).

- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "feat(auth): LearningPauseService — instant and day rules, computed expiry (mezo-rrjxe)"
```

### Task 3: API contract + controller

**Files:**
- Modify: `api/feature/auth/auth.yml` (new tag, path, two schemas)
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/controller/LearningPauseController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/LearningPauseControllerIT.java`

**Interfaces:**
- Produces: `GET /api/learning-pause` → `LearningPauseResponse{paused, startedAt?, until?, choice?}`; `PUT /api/learning-pause` body `LearningPauseRequest{choice}` → same response; `DELETE /api/learning-pause` → same response with `paused=false`. Generated interface `LearningPauseApi` (`getLearningPause`, `startLearningPause`, `endLearningPause`).

- [ ] **Step 1: Add the contract fragment** (in `api/feature/auth/auth.yml`)

Under `tags:`:

```yaml
  - name: LearningPause
    description: Most ne tanulj (mezo-rrjxe) — account-level pause of everything the AI learns on its own
```

Under `paths:`:

```yaml
  /api/learning-pause:
    get:
      tags: [LearningPause]
      operationId: getLearningPause
      summary: getLearningPause
      responses:
        '200':
          description: Current pause state
          content:
            application/json:
              schema: { $ref: '#/components/schemas/LearningPauseResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    put:
      tags: [LearningPause]
      operationId: startLearningPause
      summary: startLearningPause
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/LearningPauseRequest' }
      responses:
        '200':
          description: Pause running (unchanged when one was already running)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/LearningPauseResponse' }
        '400':
          description: Invalid choice
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    delete:
      tags: [LearningPause]
      operationId: endLearningPause
      summary: endLearningPause
      responses:
        '200':
          description: Learning resumed (idempotent)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/LearningPauseResponse' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

Under `components.schemas:`:

```yaml
    LearningPauseRequest:
      type: object
      required: [choice]
      properties:
        choice: { type: string, enum: [tonight, tomorrow_morning, open] }
    LearningPauseResponse:
      type: object
      required: [paused]
      properties:
        paused: { type: boolean }
        startedAt: { type: string, format: date-time, nullable: true }
        until: { type: string, format: date-time, nullable: true }
        choice: { type: string, enum: [tonight, tomorrow_morning, open], nullable: true }
```

- [ ] **Step 2: Regenerate the contract**

```bash
cd api/generate && npm run generate:api && cd ../../backend && ./mvnw -q generate-sources && cd ../frontend && pnpm generate:api
```

Expected: `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` change; `git status` shows both.

- [ ] **Step 3: Write the failing controller IT** (copy the request helpers — authenticated `MockMvc` user — from `backend/src/test/java/io/mrkuhne/mezo/feature/character/chat/TeamChatAnswerControllerIT.java`; it shows this repo's `ApiIntegrationTest` idiom)

```java
package io.mrkuhne.mezo.feature.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class LearningPauseControllerIT extends ApiIntegrationTest {

    @Test
    void pauseRoundTrip() throws Exception {
        mockMvc.perform(get("/api/learning-pause").with(asOwner()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.paused").value(false));

        mockMvc.perform(put("/api/learning-pause").with(asOwner()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"choice\":\"tomorrow_morning\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paused").value(true))
                .andExpect(jsonPath("$.choice").value("tomorrow_morning"))
                .andExpect(jsonPath("$.until").isNotEmpty());

        mockMvc.perform(delete("/api/learning-pause").with(asOwner()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.paused").value(false));
    }

    @Test
    void unknownChoice_is400_andUnauthenticated_is401() throws Exception {
        mockMvc.perform(put("/api/learning-pause").with(asOwner()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"choice\":\"forever\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/learning-pause")).andExpect(status().isUnauthorized());
    }
}
```

(`asOwner()` stands for the authenticated-request post-processor that `ApiIntegrationTest` exposes; use the exact name that class defines.)

- [ ] **Step 4: Run — expect FAIL** (404: no controller)

Run: `cd backend && ./mvnw -q test -Dmezo.test.use-testcontainers=true -Dtest=LearningPauseControllerIT`

- [ ] **Step 5: Controller**

```java
package io.mrkuhne.mezo.feature.auth.controller;

import io.mrkuhne.mezo.api.controller.LearningPauseApi;
import io.mrkuhne.mezo.api.dto.LearningPauseRequest;
import io.mrkuhne.mezo.api.dto.LearningPauseResponse;
import io.mrkuhne.mezo.feature.auth.service.LearningPauseService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.ZoneOffset;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** "Most ne tanulj" (mezo-rrjxe). Ungated like its service: the switch must stay reachable. */
@RestController
@RequiredArgsConstructor
public class LearningPauseController implements LearningPauseApi {

    private final CurrentUserId currentUserId;
    private final LearningPauseService service;

    @Override public LearningPauseResponse getLearningPause() {
        return toResponse(service.current(currentUserId.get()));
    }

    @Override public LearningPauseResponse startLearningPause(LearningPauseRequest request) {
        return toResponse(service.start(currentUserId.get(), request.getChoice().getValue()));
    }

    @Override public LearningPauseResponse endLearningPause() {
        return toResponse(service.end(currentUserId.get()));
    }

    private static LearningPauseResponse toResponse(LearningPauseService.Status s) {
        return new LearningPauseResponse()
                .paused(s.paused())
                .startedAt(s.startedAt() == null ? null : s.startedAt().atOffset(ZoneOffset.UTC))
                .until(s.until() == null ? null : s.until().atOffset(ZoneOffset.UTC))
                .choice(s.choice() == null ? null : LearningPauseResponse.ChoiceEnum.fromValue(s.choice()));
    }
}
```

- [ ] **Step 6: Run — expect PASS**, then the contract-drift check locally:

```bash
cd backend && ./mvnw -q test -Dmezo.test.use-testcontainers=true -Dtest=LearningPauseControllerIT
cd .. && git status --short api frontend/src/data/_client   # only the regenerated files + auth.yml
```

- [ ] **Step 7: Commit**

```bash
git add api backend/src frontend/src/data/_client
git commit -m "feat(api): learning-pause endpoints (mezo-rrjxe)"
```

### Task 4: Chat turn — the event flag and the four post-turn learners

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatTurnCompleted.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java:295,418` (both publish sites)
- Modify: `.../companion/service/FactExtractionListener.java`, `PersonFactExtractionListener.java`, `ChatMentionListener.java`, `.../companion/embedding/TurnEmbeddingListener.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/LearningPauseChatIT.java`

**Interfaces:**
- Consumes: `LearningPauseService.isPausedAt(UUID, Instant)`.
- Produces: `ChatTurnCompleted(..., boolean extractionBlocked, boolean learningPaused)` — every constructor call site passes the new last argument.

- [ ] **Step 1: Write the failing IT** (profile `companion-fake`; model the turn helper on `backend/src/test/java/io/mrkuhne/mezo/feature/companion/` S8 tests that drive `ChatService` with a `FakeCompanionLlm` fact script — reuse their script constant for "a turn that normally yields one learned fact and one person fact")

```java
@ActiveProfiles("companion-fake")
class LearningPauseChatIT extends AbstractIntegrationTest {

    @Autowired private LearningPauseService pause;
    @Autowired private LearnedFactRepository learnedFacts;
    @Autowired private PersonFactRepository personFacts;
    @Autowired private MemoryEmbeddingRepository embeddings;
    @Autowired private MentionRepository mentions;
    // + the chat driver beans the S8 chat ITs use

    @Test
    void aTurnDuringAPause_learnsNothing_andTheSameTurnAfterResumeDoes() {
        UUID user = owner();
        pause.start(user, "open");
        sendTurnThatNormallyLearns(user);          // helper: one sync ChatService turn with the fact + person-fact script
        drainAsync();                               // AbstractIntegrationTest's drain idiom
        assertThat(learnedFacts.findAll()).isEmpty();
        assertThat(personFacts.findAll()).isEmpty();
        assertThat(embeddings.findAll()).isEmpty();
        assertThat(mentions.findAll()).isEmpty();

        pause.end(user);
        sendTurnThatNormallyLearns(user);
        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(learnedFacts.findAll()).isNotEmpty());
    }
}
```

- [ ] **Step 2: Run — expect FAIL** (facts are learned during the pause)

Run: `cd backend && ./mvnw -q test -Dmezo.test.use-testcontainers=true -Dtest=LearningPauseChatIT`

- [ ] **Step 3: Extend the event and the publish sites**

`ChatTurnCompleted`:

```java
public record ChatTurnCompleted(UUID userId, UUID userMessageId, String userContent,
                                UUID assistantMessageId, String assistantContent, boolean extractionBlocked,
                                boolean learningPaused) {
}
```

Javadoc addition: `{@code learningPaused} (mezo-rrjxe): the turn was made while "Most ne tanulj" was on — every post-turn learner skips it. Decided once, at publish time, from the turn's own instant; a later resume does not un-pause this turn.`

In `ChatService` inject `LearningPauseService learningPause` and at BOTH publish sites pass `learningPause.isPausedAt(userId, Instant.now())` as the new last argument.

- [ ] **Step 4: Gate the four listeners** — the same two lines, first statement of each handler, before any LLM call:

```java
        if (event.learningPaused()) {
            return; // mezo-rrjxe: "Most ne tanulj" — nothing from a paused turn is learned, now or later
        }
```

`FactExtractionListener.onChatTurnCompleted`, `PersonFactExtractionListener.onChatTurnCompleted`, `ChatMentionListener` (its `ChatTurnCompleted` handler), `TurnEmbeddingListener` (its handler). Fix every other `new ChatTurnCompleted(` in main and test code (`grep -rn "new ChatTurnCompleted(" backend/src`) by appending `, false`.

- [ ] **Step 5: Run — expect PASS**; also the existing chat ITs:

Run: `cd backend && ./mvnw -q test -Dmezo.test.use-testcontainers=true -Dtest='LearningPauseChatIT,Chat*IT,FactExtraction*,PersonFact*,TurnEmbedding*'`

- [ ] **Step 6: Commit** — `git commit -am "feat(companion): post-turn learners skip a paused chat turn (mezo-rrjxe)"`

### Task 5: Notes — journal, gratitude, decision, reflection, check-in and training notes

**Files:**
- Modify: `.../companion/reflection/service/TextSignalListener.java:50-76`
- Modify: `.../companion/embedding/{JournalEmbeddingListener,GratitudeEmbeddingListener,DecisionEmbeddingListener,ReflectionEmbeddingListener}.java`
- Modify: `.../people/service/MentionDetectionListener.java:41,53,65`, `.../people/service/ReflectionMentionListener.java:37`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/LearningPauseNotesIT.java`

**Interfaces:** Consumes `LearningPauseService.isPausedAt`. Every handler receives a "saved" event carrying the user id.

- [ ] **Step 1: Failing IT** — for each of journal, gratitude, decision: start a pause, save an entry through its service (use the populators / services the existing `TextSignalListener` and `MentionDetection` ITs use), drain async, assert `text_signal`, `memory_embedding` and mention tables are empty; then `pause.end`, save again, await non-empty.

```java
    @Test
    void aJournalEntryDuringAPause_leavesNoSignalEmbeddingOrMention() {
        UUID user = owner();
        personPopulator.create(user, "Dóri");
        pause.start(user, "open");
        journalService.create(user, journalRequest("Dórival ma nagyot sétáltunk, sokkal nyugodtabb lettem."));
        drainAsync();
        assertThat(textSignals.findAll()).isEmpty();
        assertThat(embeddings.findAll()).isEmpty();
        assertThat(mentions.findAll()).isEmpty();
    }
```

(Repeat the same test body for gratitude and decision with their services; one test per record type.)

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Gate every handler** — inject `LearningPauseService learningPause`; first statement:

```java
        if (learningPause.isPausedAt(event.userId(), Instant.now())) {
            return; // mezo-rrjxe: written while learning is paused — never learned from
        }
```

(Use the event's own owner accessor; where the event carries the entity's `createdAt`, pass that instead of `Instant.now()`.) The people listeners import `io.mrkuhne.mezo.feature.auth.service.LearningPauseService` — allowed (people → auth).

- [ ] **Step 4: Run — expect PASS** plus `ArchitectureTest`.

- [ ] **Step 5: Commit** — `git commit -am "feat(companion,people): note listeners honour the learning pause (mezo-rrjxe)"`

### Task 6: Csapatfal reply — answer only while paused

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/chat/TeamChatReplyService.java` (`commit`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/chat/TeamChatReplyIT.java` (new test)

**Interfaces:** Consumes `LearningPauseService.isPausedAt`. No signature changes.

- [ ] **Step 1: Failing test** (append to `TeamChatReplyIT`; `MECCS` and `openLateEating` already exist there)

```java
    /** mezo-rrjxe: while "Most ne tanulj" is on, a concrete explanation is only answered —
     *  the ügy stays open, no fact, no exception. */
    @Test
    void concreteReplyDuringALearningPause_isAnswerOnly() {
        UUID owner = owner();
        TeamChatThreadEntity t = openLateEating(owner);
        learningPause.start(owner, "open");

        service.reply(owner, t.getId(), "10-kor ért véget a kupa " + MECCS);

        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(linesOf(t.getId()))
                .extracting(TeamChatLineEntity::getKind).containsExactly("OPEN", "USER", "REPLY"));
        assertThat(threads.findById(t.getId()).orElseThrow().getStatus()).isEqualTo("OPEN");
        assertThat(exceptions.findFirstBySourceThreadIdAndCreatedByAndDeletedFalse(t.getId(), owner)).isEmpty();
        assertThat(teamChatFacts(owner)).isEmpty();
    }
```

Add `@Autowired private LearningPauseService learningPause;`.

- [ ] **Step 2: Run — expect FAIL** (the ügy closes and a fact is captured).

- [ ] **Step 3: Gate the decision** — in `TeamChatReplyService`, inject `LearningPauseService learningPause` and change the condition that opens the decision block in `commit`:

```java
        // mezo-rrjxe: a reply written while learning is paused is answered, never remembered —
        // judged by the USER line's own instant, so a pause ending mid-debounce changes nothing.
        boolean paused = learningPause.isPausedAt(userId, lines.findById(lastUserLineId)
                .map(TeamChatLineEntity::getOccurredAt).orElse(now));
        if (!paused && TeamChatService.STATUS_OPEN.equals(thread.getStatus()) && draft.voiced()
                && TeamChatReplyDraft.CONCRETE.equals(draft.verdict())) {
```

- [ ] **Step 4: Run — expect PASS** for the whole class.

- [ ] **Step 5: Commit** — `git commit -am "feat(character): csapatfal reply is answer-only during a learning pause (mezo-rrjxe)"`

### Task 7: Chat honesty — prompt block, fake LLM branch, no chips

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` (`turnContext`, next to the `[Elfelejtve]` volatile block — read `ChatMemoryBlocks.java:40,70` and `ConversationTurnService.java:32,48,54` first)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`
- Modify: the turn-memory read (`grep -rn "turn-memory" backend/src/main/java`) — a paused turn returns no chips and `learningPaused=true`
- Modify: `api/feature/companion/companion.yml` (turn-memory response: add `learningPaused: { type: boolean, default: false }`), regenerate
- Test: extend `LearningPauseChatIT`

**Interfaces:**
- Produces: prompt marker constant `ChatMemoryBlocks.LEARNING_PAUSED = "[Tanulás szünetel]"`; turn-memory response field `learningPaused` (consumed by Task 19).

- [ ] **Step 1: Failing tests** — (a) with a pause on, the system prompt handed to `CompanionLlm` contains `[Tanulás szünetel]` and the sentence below; (b) the turn-memory endpoint for a paused turn returns an empty chip list and `learningPaused: true`. Capture the prompt the way the S8 prompt-order tests do (`PromptOrderFixtureGearGuardTest` and its fixture show the idiom; add the pause fixture there too so the guard stays green).

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** — the volatile block text (exact):

```
[Tanulás szünetel]
A felhasználó szüneteltette a tanulást. Ebből a beszélgetésből SEMMIT nem jegyzel meg, és később sem tanulsz belőle. Ne ígérd, hogy megjegyzed. Ha arra kér, hogy jegyezz meg valamit, mondd el röviden, hogy most szünetel a tanulás, és két lehetősége van: visszakapcsolja a Tudástárban, vagy maga írja be oda. Amit eddig tudsz róla, azt ugyanúgy használod.
```

Emit it only when `learningPause.isPausedAt(userId, Instant.now())`; place it after the knowledge blocks so it overrides `VOICE`'s background-remembering sentence. `FakeCompanionLlm`: when the system prompt contains the marker, the canned chat answer is `"Most szünetel a tanulás, ezt nem jegyzem meg."` (mirror how the `[Elfelejtve]` branch is written).

- [ ] **Step 4: Regenerate the contract, run — expect PASS**, including `PromptOrderFixtureGearGuardTest`.

- [ ] **Step 5: Commit** — `git commit -am "feat(companion): the chat knows learning is paused (mezo-rrjxe)"`

### Task 8: Registry guard (skeleton)

**Files:**
- Test: `backend/src/test/java/io/mrkuhne/mezo/LearningPathRegistryTest.java`

**Interfaces:** Produces the test-side map `REGISTRY: Map<String, Entry>` with `Entry(Kind kind, String gateTest)`; B2 tasks flip `PENDING` entries to `LEARNS` + a gate test name.

- [ ] **Step 1: Write the test** (ArchUnit is already on the test classpath — `ArchitectureTest` uses it)

```java
package io.mrkuhne.mezo;

import static org.assertj.core.api.Assertions.assertThat;

import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * "Most ne tanulj" leak guard (mezo-rrjxe, spec §4.3): every scheduled job and every after-commit
 * listener in the app must be classified. A new one that nobody classified fails here — the pause
 * may not quietly leave a write path open (the documented trust-breaker for pause switches).
 */
class LearningPathRegistryTest {

    enum Kind { LEARNS, MAINTAINS, NEUTRAL, PENDING }

    record Entry(Kind kind, String gateTest) {
        static Entry learns(String gateTest) { return new Entry(Kind.LEARNS, gateTest); }
        static Entry of(Kind kind) { return new Entry(kind, null); }
    }

    /** Simple class name → classification. LEARNS names the test that proves the gate. */
    static final Map<String, Entry> REGISTRY = Map.ofEntries(
            Map.entry("FactExtractionListener", Entry.learns("LearningPauseChatIT")),
            Map.entry("PersonFactExtractionListener", Entry.learns("LearningPauseChatIT")),
            Map.entry("ChatMentionListener", Entry.learns("LearningPauseChatIT")),
            Map.entry("TurnEmbeddingListener", Entry.learns("LearningPauseChatIT")),
            Map.entry("TextSignalListener", Entry.learns("LearningPauseNotesIT")),
            Map.entry("JournalEmbeddingListener", Entry.learns("LearningPauseNotesIT")),
            Map.entry("GratitudeEmbeddingListener", Entry.learns("LearningPauseNotesIT")),
            Map.entry("DecisionEmbeddingListener", Entry.learns("LearningPauseNotesIT")),
            Map.entry("ReflectionEmbeddingListener", Entry.learns("LearningPauseNotesIT")),
            Map.entry("MentionDetectionListener", Entry.learns("LearningPauseNotesIT")),
            Map.entry("ReflectionMentionListener", Entry.learns("LearningPauseNotesIT")),
            Map.entry("TeamChatReplyListener", Entry.learns("TeamChatReplyIT"))
            // Step 2 adds every remaining class the scan reports, as MAINTAINS / NEUTRAL / PENDING.
    );

    private static final JavaClasses APP = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS).importPackages("io.mrkuhne.mezo");

    private static Set<String> annotated(Class<? extends java.lang.annotation.Annotation> a) {
        return APP.stream().filter(c -> c.getMethods().stream().anyMatch(m -> m.isAnnotatedWith(a)))
                .map(JavaClass::getSimpleName).collect(Collectors.toCollection(TreeSet::new));
    }

    @Test
    void everyScheduledJobAndAfterCommitListenerIsClassified() {
        Set<String> found = new TreeSet<>(annotated(Scheduled.class));
        found.addAll(annotated(TransactionalEventListener.class));
        assertThat(found).as("classify new jobs/listeners in LearningPathRegistryTest.REGISTRY")
                .allSatisfy(name -> assertThat(REGISTRY).containsKey(name));
        assertThat(REGISTRY.keySet()).as("stale registry entries").isSubsetOf(found);
    }

    @Test
    void everyLearningPathNamesItsGateTest() {
        REGISTRY.forEach((name, e) -> {
            if (e.kind() == Kind.LEARNS) {
                assertThat(e.gateTest()).as(name).isNotBlank();
            }
        });
    }
}
```

- [ ] **Step 2: Run it, read the failure list, classify every reported class** — add one `Map.entry` per name: `PENDING` for every job/listener that slice B2 will gate (the spec §5 table names them), `MAINTAINS` for `FactMergeJob`, `GraphPromotionListener`, `TeamChatFactMirrorListener`, backfill runners, `LearningPauseExpiryJob`; `NEUTRAL` for everything that creates no knowledge (notification dispatch, push, gamification, quest, habit close, LLM-log writer, flag evaluation, team-chat expiry/catch-up, …). Decide each by reading the class, not by its name; when unsure, `PENDING`.

Run: `cd backend && ./mvnw -q test -Dtest=LearningPathRegistryTest`
Expected after classification: PASS.

- [ ] **Step 3: Commit** — `git commit -am "test: learning-path registry guard, B1 paths gated, the rest classified (mezo-rrjxe)"`

### Task 9: Slice B1 close — gates, docs, merge, deploy, verify

- [ ] **Step 1:** `cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true` → 0 failures, 0 errors.
- [ ] **Step 2:** FE both modes (the regenerated `api.gen.ts` changed): `cd frontend && CI=true pnpm test` and `CI=true VITE_USE_MOCK=false pnpm test`; `pnpm build`.
- [ ] **Step 3:** Docs — `docs/features/companion.md` (new §: learning pause store, event flag, prompt block), `docs/features/character.md` (reply decision), `docs/features/me.md` (people listeners); `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` → 0 errors / 0 stale.
- [ ] **Step 4:** `git pull --rebase origin main`; from the worktree `git checkout --detach origin/main && git merge --no-ff feat/emlekezet-pause-b1`; `node scripts/gen-codemap.mjs`; commit if it changed; `git push origin HEAD:main`.
- [ ] **Step 5:** Watch `deploy` for the commit until green; then

```bash
export KUBECONFIG=~/.kube/mezo-k3s.yaml
kubectl exec -n mezo postgres-0 -- psql -U mezo -d mezo -c "\d learning_pause" -c "select count(*) from learning_pause"
```

Expected: the table with its two indexes and five CHECKs; count 0.
- [ ] **Step 6:** `bd update mezo-rrjxe --notes "B1 shipped <sha> (v<version>): store + API + online gates; UI not yet."`; tracker backup `node scripts/check-beads-backup.mjs --fix` + commit + push.

---

# Slice B2 — batch gates, leak matrix, expiry (invisible)

Branch `feat/emlekezet-pause-b2`. Every task follows one shape, shown in full here once per task with its own class names: (1) write an IT that creates source material inside a pause, ends the pause, runs the job step with a clock past its look-back window, and asserts the path's output table is empty; (2) see it fail; (3) gate the read with `LearningPauseSql.notPaused` (native SQL), `LearningPauseService.pausedDays` (day loops) or `isPausedAt` (per-row Java filters); (4) see it pass; (5) flip the class's registry entry from `PENDING` to `Entry.learns("<IT name>")`; (6) commit. Before each task **re-derive the read sites from the code** (`grep` the repository methods the step calls) — the spec's table is the starting list, not the proof.

### Task 10: Recall and raw-record visibility

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/repository/MemorySourceVisibilitySql.java` (compose `LearningPauseSql.notPaused("m")` beside `forgottenTurn`)
- Modify: `.../companion/service/PersonalRecordQuery.java:78`, `.../companion/memory/repository/MemorySourceRepairQuery.java:19`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/LearningPauseRecallIT.java`

- [ ] **Step 1: Failing IT**

```java
    @Test
    void aTurnMadeDuringAPause_isNeverRecalled_evenIfAnEmbeddingExists() {
        UUID user = owner();
        Instant inPause = Instant.parse("2026-10-01T10:00:00Z");
        closedPause(user, inPause.minus(1, HOURS), inPause.plus(1, HOURS));       // helper: saves a LearningPauseEntity
        UUID turn = aiMessagePopulator.assistantTurn(user, "A fogorvos csütörtökön lesz.", inPause);
        memoryItemPopulator.forTurn(user, turn, inPause);                          // simulates a pre-existing projection

        assertThat(recall.search(user, "fogorvos")).isEmpty();
        assertThat(personalRecords.chatTurns(user, LocalDate.of(2026, 10, 1))).isEmpty();
    }
```

- [ ] **Step 2: FAIL → Step 3:** add the predicate to the shared visibility fragment and both record queries (alias = the source row carrying `created_by` / `created_at`). **Step 4: PASS**, plus the existing recall suites (`-Dtest='Memory*IT,Recall*IT,PersonalRecord*'`). **Step 5: Commit** — `feat(companion): paused material is invisible to recall (mezo-rrjxe)`.

### Task 11: Embedding and mention catch-ups, daily summary, consolidation

**Files:** `MemoryEmbeddingWriter.java:105-128,319,339` (`findUnembeddedTurnIds` + the write guard), `NoteEmbeddingCatchUp.java:74,99`, `NoteMentionCatchUp.java:46`, `TrainingNoteMentionSweep.java:61`, `DailySummaryJob.java:56-127` / `DailySummaryService.java:118`, `ConsolidationJob.java:48-67`.
**Test:** `backend/src/test/java/io/mrkuhne/mezo/feature/companion/LearningPauseNightlyIT.java`

- [ ] **Step 1: Failing IT** — three tests:

```java
    @Test
    void theNightlyCatchUp_neverEmbedsAPausedTurnOrNote() {
        UUID user = owner();
        Instant inPause = yesterdayAt(20, 0);
        closedPause(user, inPause.minus(1, HOURS), inPause.plus(1, HOURS));
        aiMessagePopulator.assistantTurn(user, "Ezt a szünet alatt mondtam.", inPause);
        journalPopulator.entry(user, "Ezt a szünet alatt írtam.", inPause);

        dailySummaryJob.runFor(user, today());       // the per-user entry point the job's fan-out calls

        assertThat(embeddings.findAll()).isEmpty();
        assertThat(memoryItems.findAll()).isEmpty();
        assertThat(mentions.findAll()).isEmpty();
    }

    @Test
    void aPausedDay_getsNoDailySummary_andANormalDayStillDoes() {
        UUID user = owner();
        seedLoggedDay(user, today().minusDays(2));                       // normal day
        seedLoggedDay(user, today().minusDays(1));                       // paused day
        closedPause(user, atLocal(today().minusDays(1), 20, 0), atLocal(today().minusDays(1), 21, 0));

        dailySummaryJob.runFor(user, today());

        assertThat(dailySummaries.findAll()).extracting(DailySummaryEntity::getDay)
                .containsExactly(today().minusDays(2));
    }

    @Test
    void aWriteOfAPausedTurn_isRefusedByTheWriterItself() {
        // belt for any caller: MemoryEmbeddingWriter.embedTurn on a paused turn writes nothing
    }
```

(Third test: call the writer's public turn-embedding method directly with a paused turn id and assert no row.)

- [ ] **Step 2: FAIL → Step 3:** `notPaused` in `findUnembeddedTurnIds` and both note catch-up queries; an `isPausedAt(owner, row.createdAt)` guard at the top of the writer's public write methods; in the daily-summary loop skip `learningPause.pausedDays(user, from, to)` days (log at info: "paused day — no summary"); `ConsolidationJob` builds period summaries from daily summaries, so assert (in the IT) that a week whose only days are paused yields no period summary and fix the generator if it falls back to raw records. **Step 4: PASS.** **Step 5:** registry entries `DailySummaryJob`, `ConsolidationJob`, `MemoryProjectionListener` → `Entry.learns("LearningPauseNightlyIT")`. **Step 6: Commit.**

### Task 12: Reflection — signals, hypotheses, effects, patterns, recheck

**Files:** `TextSignalCatchUpService.java:51-69`, `ChatDaySignalService.java:43-48`, `HypothesisEvaluationService.java:87`, `EffectLinkService.java:127-128,344`, `HypothesisPipelineService.java:217,276`, `PatternDetectionService.java:63-66`, `KnowledgeRecheckService.java:119`, `QuickNoticeService.java:124` (already unreachable for paused notes via Task 5 — assert it).
**Test:** `backend/src/test/java/io/mrkuhne/mezo/feature/companion/reflection/LearningPauseReflectionIT.java`

- [ ] **Step 1: Failing IT** — one test per step; the common fixture: 30 logged days where the ONLY days that would produce a signal / a correlation / an effect are paused days. Assertions: `text_signal` empty after `catch-up`; no new `pattern` after `propose` and `PatternDetectionJob`; no `pattern_event` evidence row citing a paused day after `evaluate`; `effect_link` rows computed without the paused days (compare the `n` of a seeded pair with and without the pause); no drift card from `KnowledgeRecheckJob` whose evidence window is entirely paused.

```java
    @Test
    void evaluate_neverCountsAPausedDayAsEvidence() {
        UUID user = owner();
        PatternEntity h = patternPopulator.monitoringWithTestPlan(user, "vacsora", "alvas");
        seedPairDay(user, today().minusDays(3), 21.5, 5.4);           // a hit — but on a paused day
        closedPause(user, atLocal(today().minusDays(3), 12, 0), atLocal(today().minusDays(3), 13, 0));

        hypothesisEvaluation.runFor(user, today());

        assertThat(patternEvents.findByPatternId(h.getId())).isEmpty();
        assertThat(patterns.findById(h.getId()).orElseThrow().getHits()).isZero();
    }
```

- [ ] **Step 2: FAIL → Step 3:** each service asks `Set<LocalDate> paused = learningPause.pausedDays(user, windowFrom, windowTo)` once per run and removes those days from its day list before any maths; text-signal and chat-day reads add `notPaused` (native) or a Java filter on `createdAt`. **Step 4: PASS** + the existing reflection suites. **Step 5:** registry `ReflectionJob`, `PatternDetectionJob`, `KnowledgeRecheckJob` → `learns("LearningPauseReflectionIT")`. **Step 6: Commit.**

### Task 13: People and life events (graph maintenance phases 3–4)

**Files:** `PersonExtractionService.java:219,297,358,419,494`, `LifeEventExtractionService.java:142,187`, `GraphMaintenanceJob.java:49-75`.
**Test:** `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/LearningPauseGraphIT.java` (needs `KNOWLEDGE_GRAPH` and graph-maintenance switches on — copy the property set of the existing `PersonExtraction*IT`).

- [ ] **Step 1: Failing IT**

```java
    @Test
    void yesterdaysPausedNotes_yieldNoPersonCandidate_personFact_orLifeEvent() {
        UUID user = owner();
        Instant inPause = yesterdayAt(19, 0);
        closedPause(user, inPause.minus(1, HOURS), inPause.plus(1, HOURS));
        journalPopulator.entry(user, "Zsófival ma megbeszéltük, hogy jövő hónapban összeköltözünk.", inPause);

        graphMaintenance.runFor(user, today());

        assertThat(persons.findAll()).isEmpty();
        assertThat(personFacts.findAll()).isEmpty();
        assertThat(knowledgeNodes.findByKindIn(List.of("LIFE_EVENT", "SEASON"))).isEmpty();
    }

    @Test
    void decayAndReconcile_stillRun_duringAndAfterAPause() {
        // maintenance is not learning: an existing edge still decays on the nightly run
    }
```

- [ ] **Step 2: FAIL → Step 3:** both extraction services filter their source rows with `isPausedAt(user, row.createdAt)` (they read one day of mixed sources; a per-row Java filter is the smallest change — where the read is native SQL, compose `notPaused`). **Step 4: PASS.** **Step 5:** registry `GraphMaintenanceJob` → `learns("LearningPauseGraphIT")` (the class both learns and maintains; the gate test covers the learning phases). **Step 6: Commit.**

### Task 14: Proactive and profile — weekly lessons, reviews, quarterly, communication profile, feedback rollups

**Files:** `proactive/service/WeeklyLessonService.java:92,127`, `WeeklyReviewGenerator.java:187`, `companion/quarterly/service/QuarterlyReviewJob.java:91`, `companion/profile/service/ProfileAssemblerJob.java:42`, `companion/feedback/service/FeedbackLearningJob.java:28`.
**Test:** `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/LearningPauseReviewsIT.java`

- [ ] **Step 1: Failing IT** — (a) a week whose notes and chats are all paused material yields no lesson candidate (`learned_fact` empty) and a weekly review whose narrative inputs exclude the paused days (assert on the context object the generator builds — expose it package-private if it is not already testable — that its day list has no paused day); (b) the quarterly review's season / event candidates ignore paused days; (c) `ProfileAssemblerJob` builds the communication profile without paused chat turns (seed turns only inside a pause → no profile row / unchanged profile); (d) `FeedbackLearningJob` rollups: feedback the user gives during a pause is an explicit act — it IS counted (assert it still rolls up; classify the job `MAINTAINS`).

- [ ] **Step 2: FAIL → Step 3:** `pausedDays` filter in the weekly and quarterly generators' day loops; `notPaused` on the profile assembler's turn query. Weekly review day cells for a paused day: numbers stay, narrative is "szünetelt a tanulás" — add the field `learningPaused: boolean` to the day DTO **only if** the review contract already carries per-day narrative; otherwise leave the contract alone and just exclude the day from the LLM context (spec §9 open point: default is "no narrative"). **Step 4: PASS.** **Step 5:** registry `WeeklyReviewJob`, `QuarterlyReviewJob`, `ProfileAssemblerJob` → `learns("LearningPauseReviewsIT")`; `FeedbackLearningJob` → `MAINTAINS`. **Step 6: Commit.**

### Task 15: Character — observations, council, conference, monthly, evening edition

**Files:** `character/service/CharacterObservationJob.java:32-40`, `CharacterCouncilJob.java:30-73`, `CharacterConferenceJob.java:35-44`, `CharacterMonthlyJob.java:43`, `CharacterMaturityJob.java:31`, the detector day-window helper they share (`grep -rn "lookback\|trailing" backend/src/main/java/io/mrkuhne/mezo/feature/character/detector | head`), `character/service/edition/TeamEditionService` (evening edition), `CharacterReplyService.java:93`, `CharacterFeedbackService.java:235`.
**Test:** `backend/src/test/java/io/mrkuhne/mezo/feature/character/LearningPauseCharacterIT.java`

- [ ] **Step 1: Failing IT**

```java
    @Test
    void detectors_skipPausedDays_soNoObservationIsBornFromThem() { … }   // seed a detector-firing pattern only on paused days → character_observation empty after the nightly job

    @Test
    void theEveningEdition_ofAPausedDay_isNotWritten_butRaisesStillOpenTheirUgyek() {
        UUID user = owner();
        learningPause.start(user, "open");
        raiseLateEatingLog(user);                                  // a real-time flag — "reagálni szabad"
        assertThat(teamChat.open(user, FlagKey.LATE_EATING, todayAt(12, 0))).isPresent();

        councilJob.runEveningEditionFor(user, today());
        assertThat(teamEditions.findAll()).isEmpty();
    }

    @Test
    void aReplyToAClaim_duringAPause_isStored_butDerivesNoObservation() { … }
```

- [ ] **Step 2: FAIL → Step 3:** the shared detector window removes `pausedDays`; the council / conference / monthly context builders do the same on their day lists; the evening edition returns early when `isPausedDay(user, day)` (log at info); `CharacterReplyService` / `CharacterFeedbackService` keep storing the user's reply but skip the derived observation when `isPausedAt(user, now)`. **Step 4: PASS** + `TeamEdition*IT`, `Character*IT`. **Step 5:** registry: the five jobs → `learns("LearningPauseCharacterIT")`. **Step 6: Commit.**

### Task 16: Expiry sweep, „Újra figyelek", the 3-day reminder

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/LearningPauseExpiryJob.java`
- Modify: `AppNotificationKind` (two kinds: `LEARNING_RESUMED`, `LEARNING_PAUSE_REMINDER` — follow the most recent kind addition end to end: `grep -rn "FACT_REINFORCED" backend/src frontend/src api`, mirror every hit incl. the contract enum, FE label map and tests)
- Modify: `FeaturesConfiguration` (+`LEARNING_PAUSE_EXPIRY_JOB_SWITCH = "mezo.techcore.cron.learning-pause-expiry-job.enabled"`), `application.yml` (cron `0 */10 * * * *`, enabled true; `false` in `backend/src/test/resources/application.properties` like its siblings)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/LearningPauseExpiryIT.java`

**Interfaces:** Consumes `LearningPauseRepository.expiredOpen`, `.openEndedOlderThan`, `LearningPauseService.close`; `AppNotificationEmitter.tryEmit(owner, kind, title, body, deeplink, refId, dedupKey)`.

Because `auth` must not import `appnotification` if that creates a cycle, check first: `grep -rn "feature.auth" backend/src/main/java/io/mrkuhne/mezo/feature/appnotification | head -3`. If appnotification imports auth, place the job in `feature/appnotification/service/LearningPauseExpiryJob.java` instead (it only needs the auth repository + service) — same class, other package.

- [ ] **Step 1: Failing IT**

```java
    @Test
    void sweep_closesAnExpiredTimedPause_once_andSaysUjraFigyelek() {
        UUID user = owner();
        timedPause(user, Instant.now().minus(3, HOURS), Instant.now().minus(1, HOURS));   // unswept
        job.sweep(Instant.now());
        job.sweep(Instant.now());                                                            // idempotent

        assertThat(pauses.findAll()).singleElement().satisfies(p -> {
            assertThat(p.getEndReason()).isEqualTo("expired");
            assertThat(p.getEndedAt()).isEqualTo(p.getPlannedEndAt());                       // never extended
        });
        assertThat(notifications(user, AppNotificationKind.LEARNING_RESUMED)).hasSize(1);
    }

    @Test
    void anOpenEndedPause_olderThanThreeDays_getsExactlyOneReminder_andStaysPaused() {
        UUID user = owner();
        openPause(user, Instant.now().minus(4, DAYS));
        job.sweep(Instant.now());
        job.sweep(Instant.now());
        assertThat(notifications(user, AppNotificationKind.LEARNING_PAUSE_REMINDER)).hasSize(1);
        assertThat(service.current(user).paused()).isTrue();
    }

    @Test
    void aUserEndedPause_getsNoNotification() { … }
```

- [ ] **Step 2: FAIL → Step 3: the job**

```java
/** "Most ne tanulj" (mezo-rrjxe): stamps timed pauses that ran out and tells the user once;
 *  reminds once about an open-ended pause older than three days. Never decides whether a pause
 *  applies — {@link LearningPauseService} computes that from {@code plannedEndAt}. */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LEARNING_PAUSE_EXPIRY_JOB_SWITCH, havingValue = "true")
public class LearningPauseExpiryJob {

    static final Duration REMIND_AFTER = Duration.ofDays(3);

    private final LearningPauseRepository pauses;
    private final LearningPauseService service;
    private final AppNotificationEmitter notifications;

    @Scheduled(cron = "${mezo.techcore.cron.learning-pause-expiry-job.cron}", zone = "Europe/Budapest")
    public void run() {
        try {
            sweep(Instant.now());
        } catch (Exception e) {
            log.warn("Learning pause sweep failed", e);
        }
    }

    @Transactional
    public void sweep(Instant now) {
        for (LearningPauseEntity p : pauses.expiredOpen(now)) {
            service.close(p, p.getPlannedEndAt(), LearningPauseEntity.END_EXPIRED);
            notifications.tryEmit(p.getCreatedBy(), AppNotificationKind.LEARNING_RESUMED, "Újra figyelek",
                    "A tanulás szünete véget ért. Innentől megint megjegyzem, ami fontos — a szünet alatti részből nem tanulok.",
                    "/mezo/knowledge", p.getId(), "learning_pause_resumed:" + p.getId());
        }
        for (LearningPauseEntity p : pauses.openEndedOlderThan(now.minus(REMIND_AFTER))) {
            p.setRemindedAt(now);
            pauses.saveAndFlush(p);
            notifications.tryEmit(p.getCreatedBy(), AppNotificationKind.LEARNING_PAUSE_REMINDER, "Még szünetel a tanulás",
                    "3 napja nem jegyzek meg semmit. Így marad, vagy visszakapcsoljam?",
                    "/mezo/knowledge", p.getId(), "learning_pause_reminder:" + p.getId());
        }
    }
}
```

(`LearningPauseService.close` becomes `public`. `AppNotificationEmitter` runs `REQUIRES_NEW` — the IT must NOT be class-level `@Transactional`, lesson 55.)

- [ ] **Step 4: PASS**; registry `LearningPauseExpiryJob` → `MAINTAINS`. **Step 5: Commit** — `feat: learning pause expiry sweep + notifications (mezo-rrjxe)`.

### Task 17: Leak matrix complete + slice B2 close

- [ ] **Step 1:** `LearningPathRegistryTest`: no entry is `PENDING` any more — add the assertion

```java
    @Test
    void nothingIsLeftPending() {
        assertThat(REGISTRY.values()).noneMatch(e -> e.kind() == Kind.PENDING);
    }
```

- [ ] **Step 2: One end-to-end leak IT** — `backend/src/test/java/io/mrkuhne/mezo/LearningPauseLeakMatrixIT.java`: a pause of two local days; inside it one chat turn, one journal, one gratitude, one decision, one check-in note, one csapatfal reply and a full set of logged numbers; then end the pause and run every `LEARNS` job once for "today = pause end + 70 days" (past the longest window, 60 d) and once for "today = pause end + 1 day". After both: `learned_fact`, `knowledge_fact`, `person_fact`, `person`, mention, `text_signal`, `pattern`, `pattern_event`, `effect_link`, `memory_embedding`, `memory_item`, `daily_summary`, `period_summary`, `knowledge_node`, `character_observation`, character claims, `team_chat_exception`, `team_edition*` contain **no row owned by the user**. (The jobs are invoked through their per-user entry points; the fixture has nothing outside the pause, so "no row" is exact.)

- [ ] **Step 3:** full backend suite `./mvnw test -Dmezo.test.use-testcontainers=true` → green. FE both modes + build (notification kinds touched the contract).
- [ ] **Step 4:** docs — `docs/features/{companion,insights,character,proactive,me}.md` each get the batch-gate paragraph for their jobs; base spec "Slice lessons" appendix gets what B2 taught; codemap; lint-docs.
- [ ] **Step 5:** merge (detached-HEAD), codemap after merge, push, watch `deploy`, confirm the backend pod started clean (`kubectl logs -n mezo deploy/backend | grep "Started MezoApplication"`), `bd update mezo-rrjxe --notes "B2 shipped …"`, tracker backup.

---

# Slice F — the switch, the strips, release (visible)

Branch `feat/emlekezet-pause-ui`. Build target: the approved prototype routes. No visual iteration after the build.

### Task 18: Data layer — API, hooks, mock, MSW

**Files:**
- Create: `frontend/src/data/account/learningPauseApi.ts`, `learningPauseHooks.ts`, `learningPauseMock.ts`
- Modify: `frontend/src/data/hooks.ts` (export), `frontend/src/test/msw/handlers.ts`
- Test: `frontend/src/data/account/learningPauseHooks.test.tsx`

**Interfaces:**
- Produces: `type LearningPause = { paused: boolean; startedAt: string | null; until: string | null; choice: 'tonight' | 'tomorrow_morning' | 'open' | null }`; `useLearningPause(): { data, isLoading, isError }`; `useLearningPauseActions(): { start(choice), end(), pending }` (optimistic, rollback on error — the `knowledgeHubHooks.ts:83-110` shape).

- [ ] **Step 1: Failing hook test** (both modes run it; model on `teamChatHooks.test.tsx`)

```tsx
it('start flips the cache optimistically and end clears it', async () => {
  const { result } = renderHook(() => ({ q: useLearningPause(), a: useLearningPauseActions() }), { wrapper })
  await waitFor(() => expect(result.current.q.data?.paused).toBe(false))
  await act(() => result.current.a.start('tonight'))
  expect(result.current.q.data).toMatchObject({ paused: true, choice: 'tonight' })
  await act(() => result.current.a.end())
  expect(result.current.q.data?.paused).toBe(false)
})

it('a failed start rolls back', async () => {
  server.use(http.put('*/api/learning-pause', () => HttpResponse.json({}, { status: 500 })))   // real mode only
  …expect(result.current.q.data?.paused).toBe(false) and the promise rejects
})
```

- [ ] **Step 2: FAIL → Step 3: implement**

```ts
// learningPauseApi.ts
import { api } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
export type LearningPause = components['schemas']['LearningPauseResponse']
export type LearningPauseChoice = NonNullable<LearningPause['choice']>
export const learningPauseApi = {
  get: () => api.get<LearningPause>('/api/learning-pause'),
  start: (choice: LearningPauseChoice) => api.put<LearningPause>('/api/learning-pause', { choice }),
  end: () => api.delete<LearningPause>('/api/learning-pause'),
}
```

(Use the exact client helper names `preferencesApi.ts` uses.) `learningPauseMock.ts`: `mockUntil(choice, now)` — `tonight` → next local midnight, `tomorrow_morning` → tomorrow 07:00, `open` → null; a module-level `MOCK_PAUSE = { paused: false, startedAt: null, until: null, choice: null }`. Hooks: `useDualQuery(['learningPause'], learningPauseApi.get, MOCK_PAUSE)`; the mutations `setQueryData` optimistically, restore the previous value in `onError`, and in real mode invalidate `['learningPause']` and `['turnMemory']` on settle. A timed pause schedules one refetch at `until` (`setTimeout`, cleared on unmount) so the UI flips by itself. MSW: `GET/PUT/DELETE */api/learning-pause` backed by a resettable in-memory object.

- [ ] **Step 4: PASS in both modes** — `CI=true pnpm test` and `CI=true VITE_USE_MOCK=false pnpm test`. **Step 5: Commit.**

### Task 19: Copy module + sprite icon

**Files:**
- Create: `frontend/src/features/insights/logic/learningPauseCopy.ts` (+ `.test.ts`)
- Modify: the shared Titanium sprite source (locate with `grep -rln 'id="t-mute"' frontend/src`) — add `t-learn-pause` verbatim from the prototype (`docs/design_2.0/prototypes/elo/mezo.html`, `<symbol id="t-learn-pause" …>`); if `CLAY_TO_3D` or an icon-name union lists symbols, add `learn-pause` there too.

- [ ] **Step 1: Failing copy test**

```ts
import { PAUSE, untilLabel } from './learningPauseCopy'
const at = (iso: string) => new Date(iso)
it('names the end exactly', () => {
  expect(untilLabel({ choice: 'open', until: null }, at('2026-10-08T10:00:00+02:00'))).toBe('amíg vissza nem kapcsolod')
  expect(untilLabel({ choice: 'tonight', until: '2026-10-08T22:00:00Z' }, at('2026-10-08T10:00:00+02:00'))).toBe('ma 24:00-ig')
  expect(untilLabel({ choice: 'tomorrow_morning', until: '2026-10-09T05:00:00Z' }, at('2026-10-08T10:00:00+02:00'))).toBe('holnap 7:00-ig')
  expect(untilLabel({ choice: 'tomorrow_morning', until: '2026-10-09T05:00:00Z' }, at('2026-10-09T01:00:00+02:00'))).toBe('ma 7:00-ig')
})
it('carries the promise verbatim', () => {
  expect(PAUSE.promise).toBe('Amíg szünetel a tanulás, magamtól semmit nem jegyzek meg — és abból, amit közben mondasz vagy írsz, később sem tanulok.')
})
```

- [ ] **Step 2: FAIL → Step 3:** `learningPauseCopy.ts` exports `PAUSE` with every string of the prototype, verbatim:

```ts
export const PAUSE = {
  rowTitle: 'Most ne tanulj',
  rowSub: 'amíg tart, magamtól semmit nem jegyzek meg',
  rowOnTitle: (until: string) => `Szünetel a tanulás · ${until}`,
  rowOnSub: 'Magamtól semmit nem jegyzek meg. Koppints, és újra figyelek.',
  sheetEyebrow: 'TUDÁSTÁR',
  promise: 'Amíg szünetel a tanulás, magamtól semmit nem jegyzek meg — és abból, amit közben mondasz vagy írsz, később sem tanulok.',
  howLong: 'MEDDIG TARTSON?',
  options: [
    { choice: 'tonight', title: 'Ma estig', sub: 'éjfélkor magamtól újra figyelek', end: '24:00' },
    { choice: 'tomorrow_morning', title: 'Holnap reggelig', sub: 'reggel 7-kor magamtól újra figyelek', end: '7:00' },
    { choice: 'open', title: 'Amíg vissza nem kapcsolom', sub: 'nem jár le magától — 3 nap után egyszer rákérdezek', end: '' },
  ],
  keeps: [
    'Amit már tudok rólad, azt továbbra is használom.',
    'A Tudástárban te bármit beírhatsz, javíthatsz, elfogadhatsz.',
    'A naplód és a számaid megmaradnak — csak új észrevétel nem születik belőlük.',
  ],
  stripTitle: 'Szünetel a tanulás',
  resume: 'Visszakapcsolom',
  stripRolad: 'Amit itt elfogadsz vagy pontosítasz, az a szünet alatt is érvényes.',
  stripTeam: 'A csapat szól, ha teendő van — de a válaszaidból most nem jegyez meg semmit.',
  chatQuiet: 'Szünetel a tanulás — ebből a beszélgetésből nem jegyeztem meg semmit.',
  teamQuiet: 'Szünetel a tanulás — válaszoltam, de ezt most nem jegyeztem meg.',
  toastOn: (until: string) => `Szünetel a tanulás · ${until}`,
  toastOff: 'Újra figyelek — a szünet alatti részből nem tanulok.',
  toastErrOn: 'Most nem sikerült átkapcsolni — a tanulás nem szünetel.',
  toastErrOff: 'Most nem sikerült átkapcsolni — a tanulás még szünetel.',
  howTitle: 'Mit csinál a „Most ne tanulj”?',
  howBody: 'Szünetelteti, amit magamtól tanulnék: amíg tart, nem jegyzek meg új tényt, észrevételt vagy ismerőst, és abból, amit közben mondasz vagy írsz, később sem tanulok. Amit már tudok, azt ugyanúgy használom, és te a Tudástárban a szünet alatt is bármit beírhatsz vagy javíthatsz. A Tudástár nyitóoldalán kapcsolod be, és választhatsz: ma estig, holnap reggelig, vagy amíg vissza nem kapcsolod.',
} as const
```

`untilLabel(pause, now)`: `open`/null → `'amíg vissza nem kapcsolod'`; otherwise day word `'ma'` when `until`'s local date ≤ today (midnight counts as today's 24:00), else `'holnap'`, + `H:mm` (`24:00` for a local-midnight end) + `'-ig'`. **Step 4: PASS. Step 5: Commit.**

### Task 20: Hub — the switch row and the duration sheet

**Files:**
- Create: `frontend/src/features/insights/components/pause/LearningPauseRow.tsx`, `LearningPauseSheet.tsx` (+ `.test.tsx` each)
- Modify: `frontend/src/features/insights/components/KnowledgeBaseView.tsx:46-52` (render `<LearningPauseRow/>` between the hero note and `HubTiles`; not rendered when the hub is in its companion-off state — the same condition that swaps the tiles to dashed)
- Modify: `frontend/src/styles/prototype.css` (append the `.lp-row`, `.lp-prom`, `.lp-opt`, `.lp-keep` rules from the prototype's `LP` style block, verbatim; scope under `.tud9` where the hub rules are)

**Interfaces:** Consumes Task 18 hooks, Task 19 copy; kit `shared/ui/Toggle.tsx` (`glass`), the app's existing bottom-sheet component (the one `ForgetAllSheet.tsx` uses), `Icon3D`, `useToast`.

- [ ] **Step 1: Failing component tests**

```tsx
it('off: one row with the switch; tapping it opens the sheet with three durations and the promise', async () => {
  render(<LearningPauseRow />, { wrapper })
  await user.click(await screen.findByRole('switch', { name: /Most ne tanulj/ }))
  expect(screen.getByText(PAUSE.promise)).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /Ma estig|Holnap reggelig|Amíg vissza nem kapcsolom/ })).toHaveLength(3)
})
it('choosing a duration pauses, closes the sheet and toasts the exact end', async () => { … expect(screen.getByRole('switch')).toBeChecked(); expect(toast).toHaveTextContent(/Szünetel a tanulás · /) })
it('on: tapping the row resumes directly, no sheet', async () => { … })
it('loading: a non-interactive skeleton row; error on toggle: state unchanged + the error toast', async () => { … })
```

- [ ] **Step 2: FAIL → Step 3:** build both components to the prototype markup (`lpRow()` and `lpSheet()` in `elo/mezo.html` are the reference: row = icon `learn-pause` · title/sub · toggle; `on` state = gold hairline + soft glow, title `PAUSE.rowOnTitle(untilLabel(…))`; sheet = header with the icon, promise in the serif italic, eyebrow, three `optrow` buttons with the end time at the right, the three `keeps` lines with tick icons). `role="switch"` + `aria-checked` on the row button. **Step 4: PASS both modes. Step 5: Commit.**

### Task 21: The strip — Tudástár views, Rólad, csapatfal, chat; the quiet lines

**Files:**
- Create: `frontend/src/features/insights/components/pause/LearningPauseStrip.tsx` (+ test)
- Modify: `frontend/src/features/insights/pages/KnowledgeListPage.tsx:52-95` (`TudasFrame`: strip under the header on every view **except** the hub landing, which has the row), `pages/BoopAboutPage.tsx` (under the page head, `extra={PAUSE.stripRolad}`), `pages/TeamChatPage.tsx:142-167` (replaces the `tf-chat-live` line while paused, `extra={PAUSE.stripTeam}`), the chat page header (locate: `grep -rln "chhead\|ChatHeader" frontend/src/features/insights`), `components/memory/MemoryChip.tsx` host (render `PAUSE.chatQuiet` once under a turn whose turn-memory has `learningPaused`), `components/teamchat/ReplyAfterlife.tsx` (no change expected — a paused reply has no remembered exception; add a test proving nothing renders)
- Modify: `frontend/src/features/insights/components/HowItWorksView.tsx` (append the `PAUSE.howTitle` / `howBody` card)
- CSS: `.lp-strip`, `.lp-btn`, `.lp-quiet` from the prototype block.

**Interfaces:** `<LearningPauseStrip extra?: string />` renders nothing when not paused; `role="status"`; the button calls `end()` and toasts `PAUSE.toastOff` / `toastErrOff`.

- [ ] **Step 1: Failing tests** — strip unit test (hidden when off; text + resume when on; resume calls the hook); page tests: `KnowledgeListPage` facts view shows the strip when paused and not on the landing; `BoopAboutPage` shows it with the Rólad extra; `TeamChatPage` paused → strip present and the "Mind az öten figyelnek" line absent, unpaused → the line present (parity); chat page paused → strip under the header; a turn with `learningPaused` shows the quiet line and no chips. Use the mock store / MSW override to set the paused state.

- [ ] **Step 2: FAIL → Step 3: implement. Step 4: PASS both modes. Step 5: Commit.**

### Task 22: Layout specs, runtime pass, docs, release, live verification

- [ ] **Step 1: Layout specs** — extend `frontend/tests/layout/tudastar-hub.spec.ts` (row off / on at 390 and 320 px: no horizontal overflow, the toggle inside the row, the sheet's three options and the keep list inside the sheet), `chat-memory.spec.ts` (strip under the header at 320 px), `team-chat-reply.spec.ts` (strip replaces the live line). Run: `cd frontend && pnpm exec playwright test tests/layout/tudastar-hub.spec.ts tests/layout/chat-memory.spec.ts tests/layout/team-chat-reply.spec.ts`.
- [ ] **Step 2: Runtime pass** with the `verify` skill (mock-mode PWA): hub → pause each of the three durations → every Tudástár view, Rólad, csapatfal, chat → resume from each strip; 320 px; reduced motion (the row/strip icon glow is off); console clean. Compare each screen with its prototype route side by side; fix any difference in the **build** (the prototype is the target).
- [ ] **Step 3: Gates** — FE both modes, `pnpm build`, backend full suite (unchanged backend, but the merge base moved), codemap, lint-docs.
- [ ] **Step 4: Docs** — `docs/features/insights.md` (hub row, sheet, strips, copy module, hooks), `companion.md` cross-link, the feature index row (`docs/features/README.md` §2–§3), a dated milestone entry in `docs/milestones/roadmap.md`; base spec "Slice lessons"; `docs/design_2.0/prototypes/elo/README.md` Mezo row: "Most ne tanulj shipped … matches production" (drop the "awaiting OK" sentence). If the build had to deviate anywhere, update `elo/mezo.html` in the same merge and rewrite its "Legutóbb változott" block.
- [ ] **Step 5: Merge + deploy** — detached-HEAD merge, codemap after merge, push, watch `deploy` green.
- [ ] **Step 6: Live verification** — open `https://46.225.112.172.sslip.io/mezo/knowledge` in the browser: the row is there; the owner's account is NOT toggled by the agent (a real pause would drop real learning). Verify instead with a read-only query that the endpoint is live and the table is still consistent:

```bash
export KUBECONFIG=~/.kube/mezo-k3s.yaml
kubectl exec -n mezo postgres-0 -- psql -U mezo -d mezo -c "select duration_choice, end_reason, started_at, planned_end_at, ended_at from learning_pause order by started_at desc limit 5"
```

The owner does the first real pause / resume; after it, re-run the query: exactly one new row, closed, `end_reason = user`.
- [ ] **Step 7: Republish the living prototype** to its fixed Artifact URL (read first, then publish with `url`) if it changed; close `mezo-rrjxe` with the result summary; tracker backup; `bd dolt push`; `git status` clean.
- [ ] **Step 8: Report to the owner in Hungarian**, walking the *Kész, ha…* list in everyday words, including anything that could not be met.

---

## Self-review

- **Spec coverage:** D1 → Tasks 1–2 (intervals), 10–15 (windows), 17 (leak matrix); D2 → 10–15 incl. recall, summaries, numbers; D3 → 2 (durations), 16 (expiry, reminder), 20 (sheet); D4 → explicit acts untouched (asserted in 14d, 15 reply) and the copy in 19; D5 → slice order. §3.4 UI states → 20–22. §4.3 guard → 8, 17. Prompt honesty → 7. Open points §9 → 14 (weekly cells), 15 (character replies), 16 (reminder as plain in-app notification).
- **Types:** `LearningPauseService.Status(paused, startedAt, until, choice)` ↔ `LearningPauseResponse{paused, startedAt, until, choice}` ↔ FE `LearningPause`; choices `tonight | tomorrow_morning | open` in SQL CHECK, contract enum, entity constants and FE copy.
- **Known soft spots (resolve while executing, not placeholders):** helper names inside ITs (`asOwner()`, populator methods, per-user job entry points) must be replaced by the names the cited neighbour tests use; where a job has no per-user entry point, add a package-private `runFor(UUID, LocalDate)` and have the fan-out call it.
