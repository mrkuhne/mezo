# Workout Timing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure the actual elapsed and active duration of every workout session, persist it, and learn a per-user timing profile that makes the session-length estimate personal.

**Architecture:** The raw signal already exists — `exercise_set.done_at` stamps every logged set. Slice 1 adds `started_at`/`finished_at`/`active_seconds` to `workout_session`, computes the active time by summing consecutive `done_at` deltas with each delta clipped at a gap cap, backfills history in SQL, and surfaces plan-vs-actual in the summary. Slice 2 adds a per-user `workout_timing_profile` (one row per learned component), updated at finish with an RFC-6298-style EWMA behind an outlier gate, exposed over a new GET endpoint and fed into `estimateSessionMinutes` as an optional parameter.

**Tech Stack:** Java 21 / Spring Boot / JPA / Liquibase / PostgreSQL; React + TypeScript + Vite; contract-first OpenAPI (`api/feature/train/train.yml` → `api/openapi.yml` → `frontend/src/data/_client/api.gen.ts`).

**Spec:** `docs/superpowers/specs/2026-09-02-workout-timing-design.md`
**bd:** `mezo-2k4q` (epic) · slice 1 = `mezo-1jm8` · slice 2 = `mezo-dzbm`

## Global Constraints

- **No `@Value`.** All tuning goes through a `@Validated @ConfigurationProperties` record (pattern: `feature/train/config/HypertrophyProperties.java`).
- **`@Transactional` is method-level only.** Class-level is ArchUnit-forbidden.
- **ArchUnit subpackages:** `@RestController` → `..controller..`, `@Service` → `..service..`, `@Entity` → `..entity..`, Spring Data repos → `..repository..`. Every `@RestController` implements a generated `io.mrkuhne.mezo.api.controller.*Api` interface.
- **Contract-first:** edit `api/feature/train/train.yml`, then regenerate `api/openapi.yml` **and** `frontend/src/data/_client/api.gen.ts` in the SAME commit. CI fails on drift.
- **CODEMAP:** never hand-edit `docs/CODEMAP.md`; regenerate with `node scripts/gen-codemap.mjs`. CI runs `--check`.
- **Liquibase:** one SQL file per change at `backend/src/main/resources/db/changelog/1.0.0/script/{YYYYMMDDHHmm}_{bd-id}_{snake_desc}.sql`, registered in `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` with changeSet id `1.0.0:{filename-without-.sql}`. Constraint names need prefixes (`pk_`/`fk_`/`uq_`/`ck_`/`idx_`). Lint: `node scripts/lint-liquibase.mjs`.
- **Backend tests are integration-first:** `@SpringBootTest` + Testcontainers, naming `test{Method}_should{Result}_when{Condition}`, AssertJ, `TrainPopulator` data, no mocks/H2. Pure decision logic may be a plain unit test (precedent: `ProgressionDeciderTest`).
- **Backend full suite requires** `-Dmezo.test.use-testcontainers=true`. Without it the fixed-DB mode races and produces fake failures.
- **Frontend must be green in BOTH modes explicitly.** `VITE_USE_MOCK` unset means mock mode, so a bare `pnpm test` runs mock twice.
- **Derived data never rolls back the user's write.** Timing computation at finish is wrapped in try/catch, mirroring the medal derivation in `WorkoutService.finishWorkout`.
- **Hungarian UI copy.** All user-visible strings in Hungarian.

## Design amendment vs the spec (accepted during planning)

The spec's profile carried a `global_multiplier` component as the cold-start fallback,
defined as `actual active time / formula-estimated time`. Implementing it would require
porting `estimateSessionMinutes` to the backend — a duplicated formula with a permanent
drift hazard between two languages.

It is also unnecessary. Observations are **per-interval, not per-session**: one workout
of 20 sets yields ~20 `set_cycle` observations, so an EWMA converges within one or two
sessions. The cold-start problem the multiplier solved is handled more directly by
**seeding each component from its static-constant equivalent** (config values in
`TimingProperties`), so a brand-new profile already returns exactly today's numbers and
only moves as real data arrives.

`global_multiplier` is therefore dropped. Everything else in the spec stands.

## File Structure

**Slice 1 — measurement**

| file | responsibility |
|---|---|
| `backend/.../db/changelog/1.0.0/script/202609021400_mezo-1jm8_workout_session_timing.sql` | 3 new columns + SQL backfill of `active_seconds` from history |
| `backend/.../feature/train/entity/WorkoutSessionEntity.java` | +`startedAt`, `finishedAt`, `activeSeconds` |
| `backend/.../feature/train/config/TimingProperties.java` | `mezo.train.timing.*` tunables |
| `backend/.../feature/train/service/SessionTimingCalculator.java` | pure: `done_at` list → active seconds |
| `backend/.../feature/train/service/WorkoutService.java` | stamp start, stamp finish, compute active seconds |
| `api/feature/train/train.yml` | `doneAt` on set; `startedAt`/`finishedAt`/`activeSeconds` on instance + detail |
| `frontend/src/features/train/components/WorkoutSummary.tsx` | plan-vs-actual line |
| `frontend/src/features/train/logic/actualDuration.ts` | pure: pick the minutes to display |

**Slice 2 — profile**

| file | responsibility |
|---|---|
| `backend/.../db/changelog/1.0.0/script/202609021600_mezo-dzbm_create_workout_timing_profile.sql` | the profile table |
| `backend/.../feature/train/entity/WorkoutTimingProfileEntity.java` | one row per (user, component) |
| `backend/.../feature/train/repository/WorkoutTimingProfileRepository.java` | lookups by owner |
| `backend/.../feature/train/service/TimingObservation.java` | the observation value type |
| `backend/.../feature/train/service/TimingObservationExtractor.java` | pure: session sets → observations |
| `backend/.../feature/train/service/EwmaEstimator.java` | pure: EWMA + outlier gate |
| `backend/.../feature/train/service/TimingProfileService.java` | persist/update the profile; read it |
| `backend/.../feature/train/TimingProfileGate.java` | feature-switch marker bean |
| `backend/.../feature/train/controller/...` (existing `TrainController`) | `GET /api/train/timing-profile` |
| `frontend/src/data/train/timingProfileApi.ts` + `timingProfileHooks.ts` | fetch + hook + mock |
| `frontend/src/features/train/logic/sessionLength.ts` | optional `profile` parameter |

---

## SLICE 1 — Measurement, storage, visibility (`mezo-1jm8`)

### Task 1: Schema + entity fields + history backfill

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609021400_mezo-1jm8_workout_session_timing.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/WorkoutSessionEntity.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutTimingBackfillIT.java`

**Interfaces:**
- Produces: `WorkoutSessionEntity.getStartedAt()/setStartedAt(Instant)`, `getFinishedAt()/setFinishedAt(Instant)`, `getActiveSeconds()/setActiveSeconds(Integer)`.

- [ ] **Step 1: Write the migration**

```sql
-- mezo-1jm8 — actual workout timing. Two clocks, deliberately separate (spec: Strava
-- pattern): the RAW pair started_at/finished_at is the immutable wall clock, and
-- active_seconds is the DERIVED work time with dead air trimmed. Neither overwrites
-- the other; elapsed is always derivable as finished_at - started_at and is not stored.
--
-- finished_at doubles as the "this session was really closed by the user" discriminator:
-- WorkoutAutoCloseService flips an abandoned session to 'completed' the next calendar day
-- but never stamps finished_at, so `status='completed' AND finished_at IS NULL` identifies
-- an abandoned session without a second column.
alter table workout_session add column started_at   TIMESTAMPTZ;
alter table workout_session add column finished_at  TIMESTAMPTZ;
alter table workout_session add column active_seconds INTEGER;

-- Backfill from history. exercise_set.done_at has always been written, so every past
-- session already carries its interval stream. Each inter-set gap is clipped at 300s
-- (mezo.train.timing.gap-cap-seconds) so a phone call or a queue at the machine cannot
-- inflate the number. No lead-in term: started_at does not exist for historical rows.
-- Idempotent — only fills rows where active_seconds IS NULL.
with gaps as (
    select workout_session_id as sid,
           least(
               extract(epoch from (done_at - lag(done_at)
                   over (partition by workout_session_id order by done_at)))::int,
               300
           ) as gap
    from exercise_set
    where workout_session_id is not null
      and done_at is not null
      and is_deleted = false
      and skipped = false
)
update workout_session s
set active_seconds = t.total
from (select sid, sum(gap)::int as total from gaps where gap is not null group by sid) t
where s.id = t.sid
  and s.active_seconds is null
  and s.status = 'completed';
```

- [ ] **Step 2: Register the changeSet**

Append to `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202609021400_mezo-1jm8_workout_session_timing"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609021400_mezo-1jm8_workout_session_timing.sql
```

- [ ] **Step 3: Run the liquibase linter**

Run: `node scripts/lint-liquibase.mjs`
Expected: exit 0. (The backfill is an UPDATE, not an INSERT, so no `allow-insert` marker is needed.)

- [ ] **Step 4: Add the entity fields**

In `WorkoutSessionEntity.java`, after the `durationEst` field, add (and add `import java.time.Instant;`):

```java
    /**
     * Wall-clock start of an INSTANCE row, stamped once when the instance is created and never
     * rewritten — POST /workouts resumes an open instance, and a resume must not restart the clock.
     * NULL on template rows and on instances created before mezo-1jm8.
     */
    @Column(name = "started_at")
    private Instant startedAt;

    /**
     * Wall-clock finish, stamped by finishWorkout. Deliberately NOT stamped by
     * WorkoutAutoCloseService: `status='completed' AND finished_at IS NULL` is exactly
     * "abandoned, its timing is not trustworthy" — excluded from display and from learning.
     */
    @Column(name = "finished_at")
    private Instant finishedAt;

    /** Derived work time: consecutive done_at deltas, each clipped at the gap cap. NULL = unknown. */
    @Column(name = "active_seconds")
    private Integer activeSeconds;
```

- [ ] **Step 5: Write the backfill integration test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutTimingBackfillIT.java`. Follow the existing IT base class used by the other train ITs in that package (same `@SpringBootTest` annotation stack and the same `TrainPopulator`/`DatabasePopulator` injection). The test inserts a completed session with four `done_at` stamps at `t`, `t+60s`, `t+600s`, `t+90s` after that, re-runs the backfill SQL, and asserts the clipping:

```java
    @Test
    void testBackfill_shouldClipLongGaps_whenSetIntervalExceedsCap() {
        // 60s + min(600,300) + 90s = 450
        assertThat(loadActiveSeconds(sessionId)).isEqualTo(450);
    }

    @Test
    void testBackfill_shouldLeaveActiveSecondsNull_whenSessionHasNoLoggedSets() {
        assertThat(loadActiveSeconds(emptySessionId)).isNull();
    }
```

Because Liquibase already ran at context start, the test re-executes the same `with gaps as (...)` UPDATE through the injected `JdbcTemplate` after inserting its fixture, which also proves idempotency.

- [ ] **Step 6: Run the test**

Run: `cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=WorkoutTimingBackfillIT`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/WorkoutSessionEntity.java backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutTimingBackfillIT.java
git commit -m "feat(train): workout_session timing columns + history backfill (mezo-1jm8)"
```

---

### Task 2: Tuning properties + the pure active-seconds calculator

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/config/TimingProperties.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/SessionTimingCalculator.java`
- Modify: `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/SessionTimingCalculatorTest.java`

**Interfaces:**
- Produces: `TimingProperties` record with accessors `gapCapSeconds()`, `leadInCapSeconds()`, `maxClippedRatio()`, `alpha()`, `beta()`, `outlierK()`, `minSamples()`, `seedSetCycleCompound()`, `seedSetCycleIsolation()`, `seedTransition()`, `seedLeadIn()`.
- Produces: `SessionTimingCalculator.activeSeconds(Instant startedAt, List<Instant> doneAt, int gapCapSeconds, int leadInCapSeconds)` → `Integer` (null when `doneAt` is empty).

- [ ] **Step 1: Write the failing unit test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/train/SessionTimingCalculatorTest.java`:

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.SessionTimingCalculator;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Pure decision logic — plain unit test, no Spring (precedent: ProgressionDeciderTest). */
class SessionTimingCalculatorTest {

    private static final Instant T = Instant.parse("2026-09-02T17:00:00Z");
    private static final int GAP_CAP = 300;
    private static final int LEAD_CAP = 900;

    @Test
    void testActiveSeconds_shouldReturnNull_whenNoSetsWereLogged() {
        assertThat(SessionTimingCalculator.activeSeconds(T, List.of(), GAP_CAP, LEAD_CAP)).isNull();
    }

    @Test
    void testActiveSeconds_shouldSumIntervals_whenAllGapsAreUnderTheCap() {
        List<Instant> done = List.of(T.plusSeconds(120), T.plusSeconds(300), T.plusSeconds(500));
        // lead-in 120 + 180 + 200
        assertThat(SessionTimingCalculator.activeSeconds(T, done, GAP_CAP, LEAD_CAP)).isEqualTo(500);
    }

    @Test
    void testActiveSeconds_shouldClipTheInterval_whenAGapExceedsTheCap() {
        List<Instant> done = List.of(T.plusSeconds(60), T.plusSeconds(1260));
        // lead-in 60 + min(1200, 300)
        assertThat(SessionTimingCalculator.activeSeconds(T, done, GAP_CAP, LEAD_CAP)).isEqualTo(360);
    }

    @Test
    void testActiveSeconds_shouldClipTheLeadIn_whenTheFirstSetIsFarFromTheStart() {
        List<Instant> done = List.of(T.plusSeconds(5000), T.plusSeconds(5100));
        assertThat(SessionTimingCalculator.activeSeconds(T, done, GAP_CAP, LEAD_CAP)).isEqualTo(1000);
    }

    @Test
    void testActiveSeconds_shouldCountOnlyTheLeadIn_whenExactlyOneSetWasLogged() {
        assertThat(SessionTimingCalculator.activeSeconds(T, List.of(T.plusSeconds(200)), GAP_CAP, LEAD_CAP))
            .isEqualTo(200);
    }

    @Test
    void testActiveSeconds_shouldSkipTheLeadIn_whenStartedAtIsNull() {
        List<Instant> done = List.of(T.plusSeconds(120), T.plusSeconds(300));
        assertThat(SessionTimingCalculator.activeSeconds(null, done, GAP_CAP, LEAD_CAP)).isEqualTo(180);
    }

    @Test
    void testActiveSeconds_shouldSortInput_whenTimestampsArriveOutOfOrder() {
        List<Instant> done = List.of(T.plusSeconds(300), T.plusSeconds(120));
        assertThat(SessionTimingCalculator.activeSeconds(T, done, GAP_CAP, LEAD_CAP)).isEqualTo(300);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=SessionTimingCalculatorTest`
Expected: compilation failure — `SessionTimingCalculator` does not exist.

- [ ] **Step 3: Write the calculator**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/SessionTimingCalculator.java`:

```java
package io.mrkuhne.mezo.feature.train.service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/**
 * Derives a session's ACTIVE seconds from its set-completion stamps (spec 2026-09-02).
 *
 * <p>done_at marks when a set was FINISHED, so the interval between two consecutive stamps is
 * "rest + the next set's execution" — one indivisible unit. Each interval is clipped at
 * {@code gapCapSeconds} so a phone call or a queue at the machine cannot inflate the total; the
 * lead-in (session start to the first set) is clipped separately and more generously, because a
 * real warm-up block legitimately takes several minutes.
 *
 * <p>Pure and static: no Spring, no repository, table-tested.
 */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class SessionTimingCalculator {

    public static Integer activeSeconds(
            Instant startedAt, List<Instant> doneAt, int gapCapSeconds, int leadInCapSeconds) {
        if (doneAt == null || doneAt.isEmpty()) {
            return null;
        }
        List<Instant> sorted = new ArrayList<>(doneAt);
        sorted.sort(Comparator.naturalOrder());
        long total = 0;
        if (startedAt != null) {
            total += clipped(startedAt, sorted.get(0), leadInCapSeconds);
        }
        for (int i = 1; i < sorted.size(); i++) {
            total += clipped(sorted.get(i - 1), sorted.get(i), gapCapSeconds);
        }
        return Math.toIntExact(total);
    }

    /** Seconds between two stamps, floored at 0 and capped at {@code capSeconds}. */
    private static long clipped(Instant from, Instant to, int capSeconds) {
        long seconds = Duration.between(from, to).getSeconds();
        return Math.min(Math.max(seconds, 0), capSeconds);
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && ./mvnw test -Dtest=SessionTimingCalculatorTest`
Expected: PASS, 7 tests.

- [ ] **Step 5: Add the properties record**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/train/config/TimingProperties.java`:

```java
package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Workout-timing tuning (mezo.train.timing) — the measurement clips (slice 1) and the profile
 * learner (slice 2). The seed values are the backend's copy of the frontend's static pacing
 * constants (SESSION_TIME + restSecondsFor): a brand-new profile therefore returns today's
 * numbers, and only moves as real observations arrive.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.train.timing")
public record TimingProperties(
    @NotNull @Positive Integer gapCapSeconds,      // 300 — inter-set interval clip
    @NotNull @Positive Integer leadInCapSeconds,   // 900 — start-to-first-set clip
    @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double maxClippedRatio, // 0.25
    @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double alpha,  // 0.125 — RFC 6298 1/8
    @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double beta,   // 0.25  — RFC 6298 1/4
    @NotNull @Positive Double outlierK,            // 4 — gate width in deviations
    @NotNull @Min(1) Integer minSamples,           // 3 — gate stays open below this
    @NotNull @Positive Double seedSetCycleCompound,  // 180 — 150s rest + ~8 reps x 3.5s
    @NotNull @Positive Double seedSetCycleIsolation, // 125 — 90s rest + ~10 reps x 3.5s
    @NotNull @Positive Double seedTransition,        // 240 — rest + 90s changeover + first set
    @NotNull @Positive Double seedLeadIn             // 480 — the 8-minute warm-up block
) {}
```

- [ ] **Step 6: Wire the defaults into application.yml**

Under the existing `mezo:` root in `backend/src/main/resources/application.yml`, add a `train.timing` block alongside the other `mezo.*` tuning sections (match the file's existing indentation and place it near `mezo.hypertrophy`):

```yaml
  train:
    timing:
      gap-cap-seconds: 300
      lead-in-cap-seconds: 900
      max-clipped-ratio: 0.25
      alpha: 0.125
      beta: 0.25
      outlier-k: 4
      min-samples: 3
      seed-set-cycle-compound: 180
      seed-set-cycle-isolation: 125
      seed-transition: 240
      seed-lead-in: 480
```

If `mezo.train` already exists in the file, nest `timing:` under it rather than adding a second `train:` key. Register the record wherever the other train `@ConfigurationProperties` records are registered (the same `@EnableConfigurationProperties` list that carries `HypertrophyProperties`).

- [ ] **Step 7: Verify the context still starts**

Run: `cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=WorkoutTimingBackfillIT`
Expected: PASS — a binding or validation error in the new record would fail context startup.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/config/TimingProperties.java backend/src/main/java/io/mrkuhne/mezo/feature/train/service/SessionTimingCalculator.java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/train/SessionTimingCalculatorTest.java
git commit -m "feat(train): timing properties + pure active-seconds calculator (mezo-1jm8)"
```

---

### Task 3: Stamp start and finish in WorkoutService

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java` (start path ~line 515-528; `finishWorkout` ~line 748)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutAutoCloseService.java` (comment only)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutTimingIT.java`

**Interfaces:**
- Consumes: `SessionTimingCalculator.activeSeconds(...)` and `TimingProperties` from Task 2; the entity setters from Task 1.

- [ ] **Step 1: Write the failing integration test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutTimingIT.java`, following the annotation stack and populator injection of the neighbouring train ITs:

```java
    @Test
    void testStartWorkout_shouldStampStartedAt_whenTheInstanceIsCreated() { }

    @Test
    void testStartWorkout_shouldNotRestampStartedAt_whenAnOpenInstanceIsResumed() { }

    @Test
    void testFinishWorkout_shouldStampFinishedAtAndActiveSeconds_whenSetsWereLogged() { }

    @Test
    void testFinishWorkout_shouldNotOverwriteFinishedAt_whenFinishIsCalledTwice() { }

    @Test
    void testFinishWorkout_shouldLeaveActiveSecondsNull_whenNoSetWasLogged() { }

    @Test
    void testAutoCloseStale_shouldLeaveFinishedAtNull_whenAnAbandonedSessionIsClosed() { }
```

Each body drives the real service methods (`startWorkout`/`logSet`/`finishWorkout`, and `WorkoutAutoCloseService.autoCloseStale`) and asserts on the reloaded `WorkoutSessionEntity`.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=WorkoutTimingIT`
Expected: FAIL — `startedAt` is null after a start.

- [ ] **Step 3: Stamp the start**

In `WorkoutService`, in the branch that builds a new instance, immediately after `instance.setStatus("active");`:

```java
        // The wall clock starts here and only here. The resume branch above returns before this
        // point, so a mid-workout reload or an app restart can never restart the clock.
        instance.setStartedAt(Instant.now());
```

- [ ] **Step 4: Stamp the finish and compute the active time**

In `finishWorkout`, after the closing-note fill-if-empty block and before `WorkoutInstanceResponse base = toInstanceResponse(...)`:

```java
        // FILL-IF-EMPTY, exactly like the closing note above: finishing is contractually
        // idempotent, so a retry must not move the wall clock.
        if (instance.getFinishedAt() == null) {
            instance.setFinishedAt(Instant.now());
        }
        // Timing is derived and decorative — the completion write above is the user's real data
        // and must survive a failure here (same rationale as the medal derivation below).
        try {
            List<Instant> doneAt = exerciseSetRepository
                .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instance.getId())
                .stream()
                .filter(s -> !s.isSkipped() && s.getDoneAt() != null)
                .map(ExerciseSetEntity::getDoneAt)
                .toList();
            instance.setActiveSeconds(SessionTimingCalculator.activeSeconds(
                instance.getStartedAt(), doneAt,
                timingProperties.gapCapSeconds(), timingProperties.leadInCapSeconds()));
        } catch (RuntimeException e) {
            log.warn("Timing derivation failed for session {} — finishing the workout anyway",
                instance.getId(), e);
        }
```

Add `timingProperties` to the class's `@RequiredArgsConstructor` field list (`private final TimingProperties timingProperties;`) and the `java.time.Instant` / `ExerciseSetEntity` imports if absent.

- [ ] **Step 5: Document the auto-close contract**

In `WorkoutAutoCloseService.autoCloseStale`, above `instance.setStatus(...)`, add:

```java
            // Deliberately no finished_at: an auto-closed session was never really finished by
            // the user, and `status='completed' AND finished_at IS NULL` is how the rest of the
            // system recognises that its timing is not trustworthy (mezo-1jm8).
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=WorkoutTimingIT`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutTimingIT.java
git commit -m "feat(train): stamp session start/finish and derive active seconds (mezo-1jm8)"
```

---

### Task 4: Expose timing over the contract

**Files:**
- Modify: `api/feature/train/train.yml` (`ExerciseSetResponse` ~3190, `WorkoutInstanceResponse` ~3048, `WorkoutDetailResponse` ~3104)
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java` (`toInstanceResponse`, `getWorkoutDetail`)
- Test: extend `WorkoutTimingIT`

**Interfaces:**
- Produces (contract, camelCase in the generated TS client): `ExerciseSetResponse.doneAt: string`, and on both `WorkoutInstanceResponse` and `WorkoutDetailResponse`: `startedAt: string`, `finishedAt: string`, `activeSeconds: integer`.

- [ ] **Step 1: Extend the schemas**

In `api/feature/train/train.yml`, add to `ExerciseSetResponse.properties`:

```yaml
        doneAt:
          type: string
          format: date-time
          description: When the set was completed. Already persisted since mezo-n5q; exposed by mezo-1jm8.
```

Add to the `properties` of BOTH `WorkoutInstanceResponse` and `WorkoutDetailResponse`:

```yaml
        startedAt:
          type: string
          format: date-time
          description: Wall-clock start of the instance. Absent on rows created before mezo-1jm8.
        finishedAt:
          type: string
          format: date-time
          description: >
            Wall-clock finish. ABSENT on an auto-closed (abandoned) session even though its status
            is 'completed' — that pair is exactly "the timing here is not trustworthy".
        activeSeconds:
          type: integer
          description: >
            Derived work time: consecutive set-completion intervals, each clipped at the gap cap.
            Absent when nothing was logged.
```

- [ ] **Step 2: Regenerate both artifacts**

Run the repo's contract regeneration (the same command CI's contract-drift job runs — see `package.json` scripts; it produces `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts`).
Expected: both files change; `git diff --stat` shows exactly those two.

- [ ] **Step 3: Fill the fields in the responses**

`ExerciseSetResponse.doneAt` needs no code — `TrainMapper.toSetResponse` is a name-matched MapStruct auto-map.

In `toInstanceResponse`, add to the builder chain:

```java
            .startedAt(instance.getStartedAt())
            .finishedAt(instance.getFinishedAt())
            .activeSeconds(instance.getActiveSeconds())
```

In `getWorkoutDetail`, set the same three fields on the `WorkoutDetailResponse` beside the existing `durationEst`. If the generated types use `OffsetDateTime`, convert with `instant.atOffset(ZoneOffset.UTC)`; check the generated class before writing the line.

- [ ] **Step 4: Extend the integration test**

Add to `WorkoutTimingIT`:

```java
    @Test
    void testFinishWorkout_shouldReturnTimingInTheResponse_whenTheSessionIsClosed() { }

    @Test
    void testGetWorkoutDetail_shouldReturnDoneAtOnEverySet_whenSetsWereLogged() { }
```

- [ ] **Step 5: Run the test**

Run: `cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=WorkoutTimingIT`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit (contract + client together — CI fails on drift)**

```bash
git add api frontend/src/data/_client/api.gen.ts backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java backend/src/test/java/io/mrkuhne/mezo/feature/train/WorkoutTimingIT.java
git commit -m "feat(api): expose set doneAt and session timing on train responses (mezo-1jm8)"
```

---

### Task 5: Plan-vs-actual in the workout summary

**Files:**
- Create: `frontend/src/features/train/logic/actualDuration.ts`
- Create: `frontend/src/features/train/logic/actualDuration.test.ts`
- Modify: `frontend/src/features/train/components/WorkoutSummary.tsx`
- Modify: `frontend/src/features/train/pages/WorkoutReviewPage.tsx` (~line 124)
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (~line 953)
- Modify: `frontend/src/data/types.ts`, `frontend/src/data/train/trainHooks.ts`, `frontend/src/data/train/train.ts` (mock)

**Interfaces:**
- Produces: `actualMinutes({ startedAt, finishedAt, activeSeconds }): number | null`
- Produces: `WorkoutSummary` prop `actualMin?: number | null`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/train/logic/actualDuration.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { actualMinutes } from '@/features/train/logic/actualDuration'

describe('actualMinutes', () => {
  it('prefers elapsed wall clock when both stamps exist', () => {
    expect(actualMinutes({
      startedAt: '2026-09-02T17:00:00Z',
      finishedAt: '2026-09-02T18:11:00Z',
      activeSeconds: 3000,
    })).toBe(71)
  })

  it('falls back to active seconds when the session was auto-closed', () => {
    expect(actualMinutes({
      startedAt: '2026-09-02T17:00:00Z', finishedAt: null, activeSeconds: 3000,
    })).toBe(50)
  })

  it('returns null when nothing was measured', () => {
    expect(actualMinutes({ startedAt: null, finishedAt: null, activeSeconds: null })).toBeNull()
  })

  it('returns null for a zero-length measurement rather than showing 0 perc', () => {
    expect(actualMinutes({
      startedAt: '2026-09-02T17:00:00Z', finishedAt: '2026-09-02T17:00:10Z', activeSeconds: null,
    })).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/train/logic/actualDuration.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

Create `frontend/src/features/train/logic/actualDuration.ts`:

```ts
// ============================================================
// Mezo · actualDuration — the MEASURED counterpart of sessionLength's estimate
// (mezo-1jm8). Two clocks reach the client: the raw wall-clock pair and the
// derived active time. The headline "tény" number is the elapsed wall clock,
// because that is what the user actually spent; active time is the fallback for
// a session that was auto-closed (finishedAt absent) and for backfilled history.
// ============================================================

export interface SessionTiming {
  startedAt?: string | null
  finishedAt?: string | null
  activeSeconds?: number | null
}

/** Whole minutes actually spent, or null when nothing usable was measured. */
export function actualMinutes(t: SessionTiming): number | null {
  const seconds = elapsedSeconds(t) ?? t.activeSeconds ?? null
  if (seconds == null || seconds < 60) return null
  return Math.round(seconds / 60)
}

function elapsedSeconds(t: SessionTiming): number | null {
  if (!t.startedAt || !t.finishedAt) return null
  const ms = Date.parse(t.finishedAt) - Date.parse(t.startedAt)
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : null
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/train/logic/actualDuration.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Render plan-vs-actual**

In `WorkoutSummary.tsx`, add `actualMin = null` to the destructured props and `actualMin?: number | null` to the prop type, then replace the duration fragment in the `wsum-sub` line:

```tsx
          {durationMin && actualMin
            ? <> · terv ~{durationMin} · tény <b>{actualMin} perc</b></>
            : actualMin
              ? <> · <b>{actualMin} perc</b></>
              : durationMin ? <> · ~{durationMin} perc</> : null}
```

This keeps today's behaviour exactly when no measurement exists, which matters because `durationEst` is NULL in real mode and the mocks do carry values.

- [ ] **Step 6: Pass it from both pages**

`WorkoutReviewPage.tsx`, next to the existing `durationMin` prop:

```tsx
      actualMin={actualMinutes(detail)}
```

`ActiveWorkoutPage.tsx`, next to `durationMin={W.durationEst}`:

```tsx
        actualMin={actualMinutes(finishedTiming)}
```

where `finishedTiming` is the timing carried by the finish response (`WorkoutInstanceResponse`) held by the page — in the `closing` phase there is no measurement yet, so it resolves to null and nothing renders. Import `actualMinutes` from `@/features/train/logic/actualDuration` in both files.

- [ ] **Step 7: Thread the fields through the data layer**

Add `startedAt`, `finishedAt` (`string | null`) and `activeSeconds` (`number | null`) to the workout instance/detail types in `frontend/src/data/types.ts`, map them in `frontend/src/data/train/trainHooks.ts` next to the existing `durationEst: r.durationEst ?? 0`, and give the mock sessions in `frontend/src/data/train/train.ts` plausible values so mock mode exercises the new render path.

- [ ] **Step 8: Run both frontend modes and the build**

```bash
cd frontend && pnpm vitest run && VITE_USE_MOCK=false pnpm vitest run && pnpm build
```
Expected: all PASS, build clean. (Mock mode is the default when `VITE_USE_MOCK` is unset, so the second run is the only real-mode gate.)

- [ ] **Step 9: Commit**

```bash
git add frontend/src
git commit -m "feat(train): show measured duration beside the estimate in the summary (mezo-1jm8)"
```

---

### Task 6: Docs and CODEMAP for slice 1

**Files:**
- Modify: `docs/features/train.md` (§4 Workout execution, §9 gotchas)
- Regenerate: `docs/CODEMAP.md`

- [ ] **Step 1: Correct the stale claims in train.md §4**

Three statements there are now wrong and must be fixed in the same edit:
1. "no UI reads `durationEst`" — literally false; `ActiveWorkoutPage.tsx` and `WorkoutReviewPage.tsx` both pass it to `WorkoutSummary`. It only *looks* true because the column has no writer.
2. The `TodayPage` `gymMinutes` consumer described there no longer exists.
3. Undocumented anywhere: `workout_session.duration_est` has **no writer at all** — the only assignment is the template→instance copy, and nothing ever populates a template row. State it plainly.

- [ ] **Step 2: Document the new measurement**

Add to §4: the two clocks, the gap-clipping rule, the `status='completed' AND finished_at IS NULL` abandoned-session discriminator, the backfill, and the `mezo.train.timing.*` tunables table.

- [ ] **Step 3: Regenerate the CODEMAP**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
```
Expected: the second command exits 0.

- [ ] **Step 4: Run ArchUnit (focused ITs skip it)**

Run: `cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=ArchitectureTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs(train): document measured session timing + fix stale durationEst claims (mezo-1jm8)"
```

---

## SLICE 2 — Timing profile and calibrated estimate (`mezo-dzbm`)

### Task 7: Profile table + entity + repository

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609021600_mezo-dzbm_create_workout_timing_profile.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/WorkoutTimingProfileEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/WorkoutTimingProfileRepository.java`

**Interfaces:**
- Produces: entity with `component` (String), `valueNum` (double), `deviationNum` (double), `samples` (int), `updatedAt` (Instant).
- Produces: `WorkoutTimingProfileRepository.findByCreatedBy(UUID)` → `List<WorkoutTimingProfileEntity>`, and `findByCreatedByAndComponent(UUID, String)` → `Optional<...>`.

- [ ] **Step 1: Write the migration**

```sql
-- mezo-dzbm — per-user learned timing components. ROW per component rather than a wide
-- table: adding a component later is a new row, not a migration, and each row carries its own
-- sample count so the outlier gate can open independently per component.
--
-- value_num/deviation_num are the RFC 6298 pair (smoothed estimate + smoothed deviation).
-- Seeds live in config (mezo.train.timing.seed-*), not here: a user with no row yet gets the
-- static frontend constants, so the estimate is correct from the first day.
create table workout_timing_profile (
    id             UUID        NOT NULL,
    created_by     UUID        NOT NULL,
    component      TEXT        NOT NULL,
    value_num      DOUBLE PRECISION NOT NULL,
    deviation_num  DOUBLE PRECISION NOT NULL,
    samples        INTEGER     NOT NULL DEFAULT 0,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted     BOOLEAN     NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_workout_timing_profile PRIMARY KEY (id),
    CONSTRAINT ck_workout_timing_profile_component CHECK (
        component IN ('set_cycle_compound', 'set_cycle_isolation', 'transition', 'lead_in')),
    CONSTRAINT ck_workout_timing_profile_samples CHECK (samples >= 0)
);

CREATE UNIQUE INDEX uq_workout_timing_profile_owner_component
    ON workout_timing_profile (created_by, component);
```

Register it in `1.0.0_master.yml` with changeSet id `1.0.0:202609021600_mezo-dzbm_create_workout_timing_profile`, then run `node scripts/lint-liquibase.mjs` (expected: exit 0).

- [ ] **Step 2: Write the entity**

Create `WorkoutTimingProfileEntity.java` in `feature/train/entity`, mirroring `WorkoutSessionEntity`'s shape: `extends OwnedEntity`, `@Entity @Table(name = "workout_timing_profile")`, the `@SQLDelete`/`@SQLRestriction` pair on `is_deleted`, `@Id @GeneratedValue @Column(columnDefinition = "uuid") private UUID id;`, then:

```java
    /** set_cycle_compound | set_cycle_isolation | transition | lead_in (DB CHECK). */
    @NotNull
    @Column(nullable = false)
    private String component;

    /** The smoothed estimate, in seconds (RFC 6298 SRTT). */
    @NotNull
    @Column(name = "value_num", nullable = false)
    private Double valueNum;

    /** The smoothed absolute deviation, in seconds (RFC 6298 RTTVAR) — the outlier gate's width. */
    @NotNull
    @Column(name = "deviation_num", nullable = false)
    private Double deviationNum;

    /** Accepted observations so far. The outlier gate stays open below minSamples. */
    @NotNull
    @Column(nullable = false)
    private Integer samples = 0;

    @NotNull
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
```

- [ ] **Step 3: Write the repository**

```java
package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.WorkoutTimingProfileEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkoutTimingProfileRepository extends JpaRepository<WorkoutTimingProfileEntity, UUID> {

    List<WorkoutTimingProfileEntity> findByCreatedBy(UUID createdBy);

    Optional<WorkoutTimingProfileEntity> findByCreatedByAndComponent(UUID createdBy, String component);
}
```

- [ ] **Step 4: Verify the schema applies**

Run: `cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=WorkoutTimingIT`
Expected: PASS — Liquibase runs at context start, so a broken migration fails here.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/WorkoutTimingProfileEntity.java backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/WorkoutTimingProfileRepository.java
git commit -m "feat(train): workout_timing_profile table + entity (mezo-dzbm)"
```

---

### Task 8: The EWMA estimator with its outlier gate

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/EwmaEstimator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/EwmaEstimatorTest.java`

**Interfaces:**
- Produces: `EwmaEstimator.Estimate` record `(double value, double deviation, int samples)`.
- Produces: `EwmaEstimator.seed(double value)` → `Estimate` with `deviation = value / 2`, `samples = 0`.
- Produces: `EwmaEstimator.update(Estimate current, double observation, double alpha, double beta, double outlierK, int minSamples)` → `Estimate` (unchanged instance when the observation is rejected).

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.train.service.EwmaEstimator;
import io.mrkuhne.mezo.feature.train.service.EwmaEstimator.Estimate;
import org.junit.jupiter.api.Test;

class EwmaEstimatorTest {

    private static final double A = 0.125;
    private static final double B = 0.25;
    private static final double K = 4;
    private static final int MIN = 3;

    @Test
    void testSeed_shouldHalveTheValueAsDeviation_whenSeededFromAStaticConstant() {
        assertThat(EwmaEstimator.seed(180)).isEqualTo(new Estimate(180, 90, 0));
    }

    @Test
    void testUpdate_shouldMoveTowardsTheObservation_whenTheObservationIsAccepted() {
        Estimate next = EwmaEstimator.update(EwmaEstimator.seed(180), 220, A, B, K, MIN);
        // deviation: 0.75*90 + 0.25*40 = 77.5 ; value: 0.875*180 + 0.125*220 = 185
        assertThat(next.deviation()).isCloseTo(77.5, within(1e-9));
        assertThat(next.value()).isCloseTo(185.0, within(1e-9));
        assertThat(next.samples()).isEqualTo(1);
    }

    @Test
    void testUpdate_shouldAcceptAnyObservation_whenSampleCountIsBelowTheMinimum() {
        Estimate next = EwmaEstimator.update(EwmaEstimator.seed(180), 5000, A, B, K, MIN);
        assertThat(next.samples()).isEqualTo(1);
        assertThat(next.value()).isGreaterThan(180);
    }

    @Test
    void testUpdate_shouldRejectTheObservation_whenItLiesBeyondKDeviations() {
        Estimate warm = new Estimate(180, 10, 5);           // gate half-width 4*10 = 40
        Estimate next = EwmaEstimator.update(warm, 400, A, B, K, MIN);
        assertThat(next).isEqualTo(warm);                   // dropped, NOT clipped
    }

    @Test
    void testUpdate_shouldAcceptTheObservation_whenItLiesInsideKDeviations() {
        Estimate warm = new Estimate(180, 10, 5);
        assertThat(EwmaEstimator.update(warm, 210, A, B, K, MIN).samples()).isEqualTo(6);
    }

    @Test
    void testUpdate_shouldConverge_whenTheSameObservationRepeats() {
        Estimate e = EwmaEstimator.seed(180);
        for (int i = 0; i < 40; i++) {
            e = EwmaEstimator.update(e, 200, A, B, K, MIN);
        }
        assertThat(e.value()).isCloseTo(200, within(1.0));
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=EwmaEstimatorTest`
Expected: compilation failure — `EwmaEstimator` does not exist.

- [ ] **Step 3: Write the estimator**

```java
package io.mrkuhne.mezo.feature.train.service;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/**
 * RFC 6298's estimator, reused for workout pacing (spec 2026-09-02): a smoothed value plus a
 * smoothed absolute deviation, updated per observation.
 *
 * <p>Two rules matter more than the arithmetic. First, an observation that lies further than
 * {@code outlierK} deviations from the current estimate is DROPPED, never clipped — clipping a
 * contaminated sample biases the estimate upward permanently (Karn's algorithm). Second, the gate
 * stays open until {@code minSamples} observations have landed, so a cold estimate can still move.
 *
 * <p>Seeds come from config, not from the first observation: a fresh profile starts at the
 * frontend's static pacing constants, so the estimate is never worse than today's.
 */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class EwmaEstimator {

    public record Estimate(double value, double deviation, int samples) {}

    public static Estimate seed(double value) {
        return new Estimate(value, value / 2, 0);
    }

    public static Estimate update(
            Estimate current, double observation,
            double alpha, double beta, double outlierK, int minSamples) {
        if (current.samples() >= minSamples
                && Math.abs(observation - current.value()) > outlierK * current.deviation()) {
            return current;
        }
        double deviation = (1 - beta) * current.deviation()
            + beta * Math.abs(current.value() - observation);
        double value = (1 - alpha) * current.value() + alpha * observation;
        return new Estimate(value, deviation, current.samples() + 1);
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && ./mvnw test -Dtest=EwmaEstimatorTest`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/EwmaEstimator.java backend/src/test/java/io/mrkuhne/mezo/feature/train/EwmaEstimatorTest.java
git commit -m "feat(train): EWMA estimator with Karn-rule outlier gate (mezo-dzbm)"
```

---

### Task 9: Turning a session into observations

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TimingObservation.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TimingObservationExtractor.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/TimingObservationExtractorTest.java`

**Interfaces:**
- Produces: `TimingObservation` record `(String component, double seconds)`.
- Produces: `TimingObservationExtractor.SetStamp` record `(java.util.UUID exerciseId, String exerciseType, java.time.Instant doneAt)`.
- Produces: `TimingObservationExtractor.Result` record `(java.util.List<TimingObservation> observations, int clipped, int total)` with `boolean tooNoisy(double maxClippedRatio)`.
- Produces: `TimingObservationExtractor.extract(Instant startedAt, List<SetStamp> stamps, int gapCapSeconds, int leadInCapSeconds)` → `Result`.
- Component names, used verbatim by Tasks 7, 10 and 11: `"set_cycle_compound"`, `"set_cycle_isolation"`, `"transition"`, `"lead_in"`.

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.TimingObservation;
import io.mrkuhne.mezo.feature.train.service.TimingObservationExtractor;
import io.mrkuhne.mezo.feature.train.service.TimingObservationExtractor.SetStamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TimingObservationExtractorTest {

    private static final Instant T = Instant.parse("2026-09-02T17:00:00Z");
    private static final UUID A = UUID.randomUUID();
    private static final UUID B = UUID.randomUUID();
    private static final int GAP = 300;
    private static final int LEAD = 900;

    private static SetStamp s(UUID ex, String type, int offsetSeconds) {
        return new SetStamp(ex, type, T.plusSeconds(offsetSeconds));
    }

    @Test
    void testExtract_shouldEmitLeadIn_whenStartedAtIsKnown() {
        var r = TimingObservationExtractor.extract(T, List.of(s(A, "compound", 400)), GAP, LEAD);
        assertThat(r.observations()).containsExactly(new TimingObservation("lead_in", 400));
    }

    @Test
    void testExtract_shouldEmitSetCycle_whenTwoSetsShareAnExercise() {
        var r = TimingObservationExtractor.extract(
            null, List.of(s(A, "compound", 100), s(A, "compound", 280)), GAP, LEAD);
        assertThat(r.observations()).containsExactly(new TimingObservation("set_cycle_compound", 180));
    }

    @Test
    void testExtract_shouldBucketNonCompoundAsIsolation_whenTheExerciseIsPlyo() {
        var r = TimingObservationExtractor.extract(
            null, List.of(s(A, "plyo", 100), s(A, "plyo", 200)), GAP, LEAD);
        assertThat(r.observations()).containsExactly(new TimingObservation("set_cycle_isolation", 100));
    }

    @Test
    void testExtract_shouldEmitTransition_whenTheIntervalCrossesAnExerciseBoundary() {
        var r = TimingObservationExtractor.extract(
            null, List.of(s(A, "compound", 100), s(B, "isolation", 340)), GAP, LEAD);
        assertThat(r.observations()).containsExactly(new TimingObservation("transition", 240));
    }

    @Test
    void testExtract_shouldDropTheInterval_whenItExceedsTheGapCap() {
        var r = TimingObservationExtractor.extract(
            null, List.of(s(A, "compound", 100), s(A, "compound", 1000)), GAP, LEAD);
        assertThat(r.observations()).isEmpty();
        assertThat(r.clipped()).isEqualTo(1);
        assertThat(r.total()).isEqualTo(1);
    }

    @Test
    void testTooNoisy_shouldBeTrue_whenClippedIntervalsExceedTheRatio() {
        var r = TimingObservationExtractor.extract(
            null,
            List.of(s(A, "compound", 0), s(A, "compound", 100), s(A, "compound", 2000)),
            GAP, LEAD);
        assertThat(r.tooNoisy(0.25)).isTrue();   // 1 of 2 intervals clipped
    }

    @Test
    void testExtract_shouldReturnNothing_whenNoSetsWereLogged() {
        var r = TimingObservationExtractor.extract(T, List.of(), GAP, LEAD);
        assertThat(r.observations()).isEmpty();
        assertThat(r.total()).isZero();
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=TimingObservationExtractorTest`
Expected: compilation failure.

- [ ] **Step 3: Write the value type and the extractor**

`TimingObservation.java`:

```java
package io.mrkuhne.mezo.feature.train.service;

/** One learned interval: which profile component it belongs to, and how long it took. */
public record TimingObservation(String component, double seconds) {}
```

`TimingObservationExtractor.java`:

```java
package io.mrkuhne.mezo.feature.train.service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/**
 * Splits a finished session's set-completion stream into the intervals the profile learns
 * (spec 2026-09-02).
 *
 * <p>done_at marks a set's END, so an interval is always "rest + the next set's execution" —
 * rest and work cannot be separated without also capturing set starts, which would cost new UI.
 * The decomposition is therefore by BOUNDARY, not by activity:
 *
 * <ul>
 *   <li>{@code lead_in} — session start to the first completed set (warm-up block).
 *   <li>{@code set_cycle_*} — two consecutive sets of the SAME exercise, bucketed compound vs
 *       everything-else to match the frontend's restSecondsFor split.
 *   <li>{@code transition} — an interval crossing an exercise boundary (rest + changeover +
 *       the next exercise's first set).
 * </ul>
 *
 * <p>Warm-up sets are counted like any other set: the estimate that consumes this profile sums
 * over ALL sets, so measurement and use share one decomposition — which matters far more than
 * separating warm-up pacing out.
 *
 * <p>An interval longer than the gap cap is DROPPED, not clipped, and counted: a session whose
 * clipped share exceeds maxClippedRatio is too contaminated to learn from at all.
 */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class TimingObservationExtractor {

    public static final String SET_CYCLE_COMPOUND = "set_cycle_compound";
    public static final String SET_CYCLE_ISOLATION = "set_cycle_isolation";
    public static final String TRANSITION = "transition";
    public static final String LEAD_IN = "lead_in";

    /** One completed, non-skipped set: which exercise it belongs to, that exercise's type, when. */
    public record SetStamp(UUID exerciseId, String exerciseType, Instant doneAt) {}

    /** Observations plus the noise accounting the caller needs to decide whether to learn at all. */
    public record Result(List<TimingObservation> observations, int clipped, int total) {
        public boolean tooNoisy(double maxClippedRatio) {
            return total > 0 && (double) clipped / total > maxClippedRatio;
        }
    }

    public static Result extract(
            Instant startedAt, List<SetStamp> stamps, int gapCapSeconds, int leadInCapSeconds) {
        List<TimingObservation> out = new ArrayList<>();
        if (stamps == null || stamps.isEmpty()) {
            return new Result(out, 0, 0);
        }
        List<SetStamp> sorted = new ArrayList<>(stamps);
        sorted.sort(Comparator.comparing(SetStamp::doneAt));
        if (startedAt != null) {
            long leadIn = seconds(startedAt, sorted.get(0).doneAt());
            if (leadIn > 0 && leadIn <= leadInCapSeconds) {
                out.add(new TimingObservation(LEAD_IN, leadIn));
            }
        }
        int clipped = 0;
        int total = 0;
        for (int i = 1; i < sorted.size(); i++) {
            SetStamp prev = sorted.get(i - 1);
            SetStamp curr = sorted.get(i);
            long gap = seconds(prev.doneAt(), curr.doneAt());
            total++;
            if (gap <= 0 || gap > gapCapSeconds) {
                clipped++;
                continue;
            }
            out.add(new TimingObservation(componentFor(prev, curr), gap));
        }
        return new Result(out, clipped, total);
    }

    private static String componentFor(SetStamp prev, SetStamp curr) {
        if (!prev.exerciseId().equals(curr.exerciseId())) {
            return TRANSITION;
        }
        return "compound".equals(curr.exerciseType()) ? SET_CYCLE_COMPOUND : SET_CYCLE_ISOLATION;
    }

    private static long seconds(Instant from, Instant to) {
        return Duration.between(from, to).getSeconds();
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && ./mvnw test -Dtest=TimingObservationExtractorTest`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TimingObservation.java backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TimingObservationExtractor.java backend/src/test/java/io/mrkuhne/mezo/feature/train/TimingObservationExtractorTest.java
git commit -m "feat(train): extract learnable timing observations from a session (mezo-dzbm)"
```

---

### Task 10: The profile service, its gate, and the finish hook

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/TimingProfileGate.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TimingProfileService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutService.java` (`finishWorkout`)
- Modify: `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/TimingProfileIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/TimingProfileSwitchOffIT.java`

**Interfaces:**
- Consumes: `EwmaEstimator` (Task 8), `TimingObservationExtractor` (Task 9), `TimingProperties` (Task 2), `WorkoutTimingProfileRepository` (Task 7).
- Produces: `TimingProfileService.learnFrom(UUID createdBy, UUID workoutSessionId)` — void, idempotent-safe to call once per finish.
- Produces: `TimingProfileService.read(UUID createdBy)` → `Map<String, EwmaEstimator.Estimate>` containing all four components, config seeds filling any component with no row.

- [ ] **Step 1: Register the feature switch**

In `FeaturesConfiguration.java`, next to the other train switches:

```java
    /** Learned workout-timing profile (mezo-dzbm) — off ⇒ no profile is ever written and
     *  GET /api/train/timing-profile returns the static config seeds unchanged. Measurement
     *  (slice 1) is independent and keeps running either way. */
    public static final String TIMING_PROFILE_SWITCH = "mezo.feature.timing-profile.enabled";
```

Create `backend/src/main/java/io/mrkuhne/mezo/feature/train/TimingProfileGate.java`:

```java
package io.mrkuhne.mezo.feature.train;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Marker bean present only when mezo.feature.timing-profile.enabled=true; gates the profile
 * learning hook in WorkoutService.finishWorkout via ObjectProvider. */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.TIMING_PROFILE_SWITCH, havingValue = "true")
public class TimingProfileGate {}
```

Add `mezo.feature.timing-profile.enabled: true` to `application.yml` beside the other feature switches.

- [ ] **Step 2: Write the failing integration test**

Create `TimingProfileIT.java` in the train test package, following the neighbouring ITs' annotation stack:

```java
    @Test
    void testFinishWorkout_shouldCreateProfileRows_whenTheSessionHasLoggedSets() { }

    @Test
    void testFinishWorkout_shouldMoveTheEstimateTowardsReality_whenIntervalsDifferFromTheSeed() { }

    @Test
    void testLearnFrom_shouldWriteNothing_whenTheSessionWasAutoClosed() { }   // finishedAt IS NULL

    @Test
    void testLearnFrom_shouldWriteNothing_whenTheSessionIsTooNoisy() { }      // clipped ratio over the cap

    @Test
    void testRead_shouldReturnConfigSeeds_whenTheUserHasNoProfileRows() { }

    @Test
    void testFinishWorkout_shouldStillComplete_whenProfileLearningThrows() { }
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=TimingProfileIT`
Expected: compilation failure — `TimingProfileService` does not exist.

- [ ] **Step 4: Write the service**

Create `TimingProfileService.java` in `feature/train/service`. A `@Service` with `@RequiredArgsConstructor` holding `WorkoutSessionRepository`, `ExerciseSetRepository`, `ExerciseRepository`, `WorkoutTimingProfileRepository` and `TimingProperties`. Method-level `@Transactional` only.

```java
    /**
     * Folds one finished session's intervals into the user's profile.
     *
     * <p>Karn's rule, applied literally: a session that was auto-closed (finishedAt IS NULL while
     * status is 'completed') or whose clipped-interval share exceeds maxClippedRatio has ambiguous
     * provenance and is skipped ENTIRELY rather than partially trusted.
     */
    @Transactional
    public void learnFrom(UUID createdBy, UUID workoutSessionId) {
        WorkoutSessionEntity session = workoutSessionRepository.findById(workoutSessionId)
            .filter(s -> createdBy.equals(s.getCreatedBy()))
            .orElse(null);
        if (session == null || session.getFinishedAt() == null) {
            return;
        }
        List<TimingObservationExtractor.SetStamp> stamps = stampsFor(createdBy, session);
        var result = TimingObservationExtractor.extract(
            session.getStartedAt(), stamps,
            properties.gapCapSeconds(), properties.leadInCapSeconds());
        if (result.observations().isEmpty() || result.tooNoisy(properties.maxClippedRatio())) {
            return;
        }
        for (TimingObservation observation : result.observations()) {
            apply(createdBy, observation);
        }
    }
```

`stampsFor` loads the session's non-skipped sets with a non-null `doneAt`, resolves each set's exercise once (a `Map<UUID, String>` of exercise id → `type`, built from `exerciseRepository.findAllById(...)`), and maps them to `SetStamp`. `apply` loads or seeds the component's row, runs `EwmaEstimator.update` with the configured `alpha`/`beta`/`outlierK`/`minSamples`, writes `valueNum`/`deviationNum`/`samples`/`updatedAt` back, and saves.

```java
    /** The user's learned components, config seeds filling anything not yet learned. */
    @Transactional(readOnly = true)
    public Map<String, EwmaEstimator.Estimate> read(UUID createdBy) {
        Map<String, EwmaEstimator.Estimate> out = new LinkedHashMap<>(seeds());
        for (WorkoutTimingProfileEntity row : repository.findByCreatedBy(createdBy)) {
            out.put(row.getComponent(),
                new EwmaEstimator.Estimate(row.getValueNum(), row.getDeviationNum(), row.getSamples()));
        }
        return out;
    }

    private Map<String, EwmaEstimator.Estimate> seeds() {
        return Map.of(
            TimingObservationExtractor.SET_CYCLE_COMPOUND, EwmaEstimator.seed(properties.seedSetCycleCompound()),
            TimingObservationExtractor.SET_CYCLE_ISOLATION, EwmaEstimator.seed(properties.seedSetCycleIsolation()),
            TimingObservationExtractor.TRANSITION, EwmaEstimator.seed(properties.seedTransition()),
            TimingObservationExtractor.LEAD_IN, EwmaEstimator.seed(properties.seedLeadIn()));
    }
```

- [ ] **Step 5: Hook it into finishWorkout**

`TimingProfileService.learnFrom` opens its own transaction, so it is a SEPARATE bean called after the finish work — the same reason `WorkoutAutoCloseService` and `ClosingBlockService` are separate beans. In `WorkoutService`, add the fields:

```java
    private final ObjectProvider<TimingProfileGate> timingProfileGate;
    private final TimingProfileService timingProfileService;
```

and in `finishWorkout`, right after the medal try/catch:

```java
        // Learning is derived and decorative, exactly like the medals above: the completion write
        // must not roll back because the profile update blew up. Gated — off ⇒ nothing is learned.
        if (timingProfileGate.getIfAvailable() != null) {
            try {
                timingProfileService.learnFrom(createdBy, instance.getId());
            } catch (RuntimeException e) {
                log.warn("Timing-profile learning failed for session {} — finishing anyway",
                    instance.getId(), e);
            }
        }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=TimingProfileIT`
Expected: PASS, 6 tests.

- [ ] **Step 7: Write the switch-off test**

`TimingProfileSwitchOffIT.java` mirrors the repo's other `*SwitchOffIT` files: same `@SpringBootTest` stack plus `@TestPropertySource(properties = "mezo.feature.timing-profile.enabled=false")`.

```java
    @Test
    void testFinishWorkout_shouldWriteNoProfileRows_whenTheSwitchIsOff() { }
```

Run: `cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=TimingProfileSwitchOffIT`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/train
git commit -m "feat(train): learn the per-user timing profile at finish, behind a switch (mezo-dzbm)"
```

---

### Task 11: Expose the profile over the API

**Files:**
- Modify: `api/feature/train/train.yml`
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Modify: the existing train `@RestController` (it implements the generated `TrainApi`)
- Test: extend `TimingProfileIT`

**Interfaces:**
- Produces: `GET /api/train/timing-profile` → `TimingProfileResponse { leadInSeconds, setCycleCompoundSeconds, setCycleIsolationSeconds, transitionSeconds, samples }` where `samples` is `{ leadIn, setCycleCompound, setCycleIsolation, transition }`.

- [ ] **Step 1: Add the operation and schema**

In `api/feature/train/train.yml`, add the path (matching the file's existing operation style, tag and security):

```yaml
  /api/train/timing-profile:
    get:
      tags: [train]
      operationId: getTimingProfile
      summary: The caller's learned workout-timing profile
      description: >
        Per-component learned pacing in seconds, used to personalise the session-length estimate.
        Always complete: any component the user has not yet accumulated data for is returned at
        its static seed, so the client never has to implement a cold-start branch.
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TimingProfileResponse'
```

and the schemas:

```yaml
    TimingProfileResponse:
      type: object
      required: [leadInSeconds, setCycleCompoundSeconds, setCycleIsolationSeconds, transitionSeconds, samples]
      properties:
        leadInSeconds: { type: number, description: Session start to the first completed set. }
        setCycleCompoundSeconds: { type: number, description: Rest + execution for one compound set. }
        setCycleIsolationSeconds: { type: number, description: Rest + execution for one non-compound set. }
        transitionSeconds: { type: number, description: Interval spanning an exercise change. }
        samples:
          $ref: '#/components/schemas/TimingProfileSamples'
    TimingProfileSamples:
      type: object
      required: [leadIn, setCycleCompound, setCycleIsolation, transition]
      description: Accepted observations per component. 0 means the value is still the static seed.
      properties:
        leadIn: { type: integer }
        setCycleCompound: { type: integer }
        setCycleIsolation: { type: integer }
        transition: { type: integer }
```

- [ ] **Step 2: Regenerate both artifacts**

Run the contract regeneration. Expected: `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` both change.

- [ ] **Step 3: Implement the endpoint**

Add the generated interface's `getTimingProfile` override to the existing train controller, delegating to `timingProfileService.read(currentUserId)` and mapping the four components onto the response. Follow the controller's existing pattern for resolving the caller's id.

- [ ] **Step 4: Extend the integration test**

```java
    @Test
    void testGetTimingProfile_shouldReturnSeedsWithZeroSamples_whenNothingWasLearnedYet() { }

    @Test
    void testGetTimingProfile_shouldReturnLearnedValues_whenTheUserHasFinishedSessions() { }
```

- [ ] **Step 5: Run the test**

Run: `cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=TimingProfileIT`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add api frontend/src/data/_client/api.gen.ts backend/src/main/java backend/src/test/java
git commit -m "feat(api): GET /api/train/timing-profile (mezo-dzbm)"
```

---

### Task 12: Calibrated estimate on the frontend

**Files:**
- Modify: `frontend/src/features/train/logic/sessionLength.ts`
- Modify: `frontend/src/features/train/logic/sessionLength.test.ts` (or create if absent)
- Create: `frontend/src/data/train/timingProfileApi.ts`, `frontend/src/data/train/timingProfileHooks.ts`
- Modify: `frontend/src/data/hooks.ts` (barrel), `frontend/src/data/train/train.ts` (mock)
- Modify: `frontend/src/features/train/pages/TrainTodayPage.tsx` (~line 319)
- Modify: `frontend/src/features/train/components/MesoEditor.tsx` (~line 115)

**Interfaces:**
- Consumes: `GET /api/train/timing-profile` from Task 11.
- Produces: `SessionTimingProfile` interface and `estimateSessionMinutes(exercises, profile?)`.
- Produces: `useTimingProfile()` → `{ data: SessionTimingProfile | null, ... }`.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/features/train/logic/sessionLength.test.ts`:

```ts
import { estimateSessionMinutes, SESSION_TIME } from '@/features/train/logic/sessionLength'

const ex = (type: 'compound' | 'isolation', workingSets: number) =>
  ({ type, workingSets, warmupSets: 0, repMin: 8, repMax: 12 }) as const

describe('estimateSessionMinutes with a timing profile', () => {
  const profile = {
    leadInSeconds: 480,
    setCycleCompoundSeconds: 180,
    setCycleIsolationSeconds: 120,
    transitionSeconds: 240,
  }

  it('is unchanged when no profile is passed', () => {
    // The static path is the contract for structureLint and peakWeekFit — it must not move.
    expect(estimateSessionMinutes([ex('compound', 3)]))
      .toBe(estimateSessionMinutes([ex('compound', 3)], undefined))
  })

  it('sums lead-in, per-exercise set cycles and transitions', () => {
    // 480 + (3-1)*180 + (2-1)*120 + 1*240 = 1200s = 20 perc
    expect(estimateSessionMinutes([ex('compound', 3), ex('isolation', 2)], profile)).toBe(20)
  })

  it('counts warm-up sets as ordinary set cycles', () => {
    // 480 + (2+2-1)*180 = 1020s = 17 perc
    expect(estimateSessionMinutes(
      [{ type: 'compound', workingSets: 2, warmupSets: 2, repMin: 8, repMax: 12 }], profile)).toBe(17)
  })

  it('returns 0 for an empty list, profile or not', () => {
    expect(estimateSessionMinutes([], profile)).toBe(0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/train/logic/sessionLength.test.ts`
Expected: FAIL — the second argument is ignored.

- [ ] **Step 3: Add the optional profile path**

In `sessionLength.ts`, add the type and branch (keeping the existing body as the `else`):

```ts
/** Learned pacing, in seconds (GET /api/train/timing-profile). Every field is always present —
 *  the backend fills unlearned components with the static seeds, so there is no cold-start branch. */
export interface SessionTimingProfile {
  leadInSeconds: number
  setCycleCompoundSeconds: number
  setCycleIsolationSeconds: number
  transitionSeconds: number
}

/**
 * Whole-session estimate in whole minutes; 0 for an empty list.
 *
 * With a profile, the sum mirrors EXACTLY how the backend measures (TimingObservationExtractor):
 * a lead-in, one set cycle per interval WITHIN each exercise (n-1 for n sets), and one transition
 * per exercise boundary. Measurement and estimate share one decomposition — that consistency is
 * what makes the learned numbers mean anything.
 *
 * Without a profile the original static formula runs unchanged. structureLint's session-length
 * band and peakWeekFit deliberately stay on that path: they are programming RULES, not personal
 * predictions, and a per-user band would drift out from under its own thresholds.
 */
export function estimateSessionMinutes(
  exercises: SessionTimeExercise[],
  profile?: SessionTimingProfile,
): number {
  if (exercises.length === 0) return 0
  if (!profile) return staticEstimate(exercises)
  let seconds = profile.leadInSeconds
  for (const ex of exercises) {
    const sets = ex.workingSets + ex.warmupSets
    const cycle = ex.type === 'compound'
      ? profile.setCycleCompoundSeconds
      : profile.setCycleIsolationSeconds
    seconds += Math.max(0, sets - 1) * cycle
  }
  seconds += Math.max(0, exercises.length - 1) * profile.transitionSeconds
  return Math.round(seconds / 60)
}
```

Move the current body verbatim into a private `staticEstimate(exercises: SessionTimeExercise[]): number`, and update the module header comment: the profile parameter now exists, and only the today chip and the MesoEditor hero pass it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && pnpm vitest run src/features/train/logic/sessionLength.test.ts`
Expected: PASS, including every pre-existing static-path case.

- [ ] **Step 5: Add the data-layer triad**

`timingProfileApi.ts` calls the generated client's `getTimingProfile`; `timingProfileHooks.ts` exports `useTimingProfile()` following the shape of the neighbouring train hooks; the mock source returns the seed values (`480 / 180 / 125 / 240`, all `samples: 0`). Export the hook through the `@/data/hooks` barrel.

- [ ] **Step 6: Wire the two consumers**

In `TrainTodayPage.tsx`, call `useTimingProfile()` at the top of the component with the other hooks and pass it through:

```tsx
            const workoutMinutes = estimateSessionMinutes(workout.exercises, timingProfile ?? undefined)
```

In `MesoEditor.tsx`:

```tsx
  const dayMinutes = estimateSessionMinutes(day.exercises, timingProfile ?? undefined)
```

Do NOT touch `structureLint.ts`, `peakWeekFit.ts`, `programFit.ts` or `prepBriefing.ts` — they keep the static path by design.

- [ ] **Step 7: Run both modes and the build**

```bash
cd frontend && pnpm vitest run && VITE_USE_MOCK=false pnpm vitest run && pnpm build
```
Expected: all PASS, build clean.

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "feat(train): calibrate the session estimate from the learned profile (mezo-dzbm)"
```

---

### Task 13: Docs, CODEMAP and the full gate for slice 2

**Files:**
- Modify: `docs/features/train.md`
- Regenerate: `docs/CODEMAP.md`

- [ ] **Step 1: Document the profile**

Add to `train.md`: the four components and what each interval means; why rest and execution are not separated (done_at marks completion, not start); the seeds-from-config cold start and why `global_multiplier` was dropped; the Karn exclusions (auto-closed, too noisy); the feature switch; and — explicitly — which estimate consumers get the profile and which deliberately do not.

- [ ] **Step 2: Regenerate the CODEMAP**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
```
Expected: exit 0.

- [ ] **Step 3: Run ArchUnit and the liquibase lint**

```bash
cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true -Dtest=ArchitectureTest
node scripts/lint-liquibase.mjs
```
Expected: both PASS. A new cross-feature dependency would trip the frozen `archunit-store`; there should be none here (everything lives inside `feature/train` plus one constant in `techcore/configuration`).

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs(train): document the learned timing profile (mezo-dzbm)"
```

---

## Final gate before the PR

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true
cd frontend && pnpm vitest run && VITE_USE_MOCK=false pnpm vitest run && pnpm build
node scripts/gen-codemap.mjs --check
node scripts/lint-liquibase.mjs
```

Then: push the branch, open the self-PR, wait for CI green, merge locally with `--no-ff`, push main, delete the branch.
