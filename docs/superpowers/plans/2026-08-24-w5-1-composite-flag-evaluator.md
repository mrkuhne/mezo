# W5.1 Composite flag evaluator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**bd:** `mezo-b3pp.18` · **Spec:** [`2026-08-18-phase5-deep-memory-personalization-design.md`](../specs/2026-08-18-phase5-deep-memory-personalization-design.md) §4.5 + §9.1 (+ §11 conventions) · **Branch:** `feat/w5-1-flag-evaluator`

**Goal:** A deterministic, LLM-free evaluator that raises five composite state flags
(`sustained_stress`, `sleep_debt`, `momentum_at_risk`, `recovery_needed`, `all_healthy`) from
already-stored biometrics, on every check-in/sleep write **and** on an hourly sweep, auditing each
raise into a new `companion_flag_log` table with its inputs frozen in `payload`.

**Architecture:** New `feature/companion/flags/{config,entity,repository,service}` subpackage (the
`feature/companion/feedback` + `feature/companion/graph` precedent). `FlagEvaluator` composes
per-day series READ-ONLY from `MetricSeriesService` (`CHECKIN_STRESS`, `SLEEP_DURATION_H`,
`TRAINING_RPE`, `HABITS_DONE`) plus `SleepGoalRepository` (goal hours) and train's
`GymScheduleSlotRepository` + `WorkoutSessionRepository.findDoneInstanceDates` (planned-vs-done gym
days) — the same companion→other-features read direction `MetricSeriesService` itself already uses.
`FlagService` applies per-flag cooldowns against `companion_flag_log` and persists the raises.
Two triggers, one code path: an `@Async @TransactionalEventListener(AFTER_COMMIT)` listener on the
new `CheckInSavedEvent` + the existing `SleepLogSavedEvent` (source `write`), and an hourly
`FlagSweepJob` behind `mezo.techcore.cron.flag-sweep-job.enabled` (source `sweep`).

**Tech Stack:** Java 21 / Spring Boot 3 / JPA + Hibernate (`@JdbcTypeCode(SqlTypes.JSON)` typed
jsonb envelope), Liquibase SQL changesets, JUnit 5 integration tests on Postgres+pgvector
(`AbstractIntegrationTest`). No LLM, no embedding, **no API/contract change, no frontend change.**

## Global Constraints

- **No LLM/embed call in this slice** — the evaluator is pure arithmetic over stored rows.
  Therefore **no** `LlmCallContextHolder.runWith(...)` wrapper is added anywhere (spec §11's tagging
  rule binds only call sites; W5.1 has none).
- **Contract-first is a no-op here:** the slice adds no endpoint and no DTO. Do **not** touch
  `api/openapi.yml`, do **not** run `npm run generate:api` / `pnpm generate:api`, do **not** touch
  `frontend/`.
- **Config, never code:** every threshold, window and cooldown lives in
  `mezo.companion.flags.*` bound to a `@Validated @ConfigurationProperties` record
  (`FeedbackLearningProperties` / `ProfileProperties` precedent — feature-scoped record, *not* a new
  field on the already-291-line `CompanionProperties`; the spec's "`CompanionProperties.Flags`"
  wording predates that precedent).
- **New table ⇒** `ResetDatabase` TRUNCATE list + a `FlagLogPopulator` in the same change (spec §11).
- **Migrations:** `src/main/resources/db/changelog/1.0.0/script/<yyyyMMddHHmm>_mezo-b3pp.18_<name>.sql`
  + a `changeSet` appended to `1.0.0_master.yml`; explicit `pk_/fk_/uq_/ck_/idx_` constraint names.
- **Cron switch idiom:** `FeaturesConfiguration` constant + `@ConditionalOnProperty` — off ⇒ the job
  bean does not exist; pinned by a `*SwitchOffIT`.
- **Spring rules (ArchUnit-enforced):** constructor injection only, `@Transactional` method-level
  only, no Spring `@Value`, `@Service` in `..service..`, `@Entity` in `..entity..`, repositories in
  `..repository..`.
- **Commit subjects** carry the bd id: `feat(companion): ... (mezo-b3pp.18)`.
- Backend gate command (compose must be up: `docker compose up -d`):
  `cd backend && ./mvnw clean test -Dtest='<the ITs this plan adds>' -Dmezo.test.use-testcontainers=true`.

## File structure

**Create (backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/):**
- `config/FlagProperties.java` — every threshold/window/cooldown, `@Validated`.
- `entity/CompanionFlagLogEntity.java` — the audit row.
- `entity/FlagPayloadEnvelope.java` — typed jsonb payload (one nested record per rule).
- `repository/CompanionFlagLogRepository.java` — cooldown + quiet-window queries.
- `service/FlagKey.java` — the five keys as constants (shared by evaluator, service, tests).
- `service/FlagRaise.java` — `record FlagRaise(String flagKey, FlagPayloadEnvelope payload)`.
- `service/FlagEvaluator.java` — the five rules, LLM-free, no writes.
- `service/FlagService.java` — cooldown gate + `companion_flag_log` write.
- `service/FlagEvaluationListener.java` — AFTER_COMMIT `@Async` on check-in/sleep writes.
- `service/FlagSweepJob.java` — hourly sweep, per-user isolation.

**Create (elsewhere):**
- `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin/service/CheckInSavedEvent.java`
- `backend/src/main/resources/db/changelog/1.0.0/script/202608241200_mezo-b3pp.18_create_companion_flag_log.sql`
- `backend/src/test/java/io/mrkuhne/mezo/support/populator/FlagLogPopulator.java`
- ITs under `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/`:
  `CompanionFlagLogPersistenceIT`, `FlagPropertiesIT`, `FlagEvaluatorStressSleepIT`,
  `FlagEvaluatorMomentumRecoveryIT`, `FlagServiceIT`, `FlagEvaluationListenerIT`,
  `FlagSweepJobSwitchOffIT`.

**Modify:**
- `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin/service/CheckInService.java` — publish the event.
- `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` — `FLAG_SWEEP_JOB_SWITCH`.
- `backend/src/main/resources/application.yml` — `mezo.techcore.cron.flag-sweep-job.enabled` + the `mezo.companion.flags` block.
- `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` — the changeSet.
- `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` — truncate `companion_flag_log`.
- `docs/features/companion.md` — W5.1 sections (§3/§4/§8/§10 + config keys).
- `docs/CODEMAP.md` — regenerated.

## The rules (single source of truth for Tasks 3–4)

All windows are **whole days ending yesterday-or-today as noted**, computed from `LocalDate.now()`
(house idiom — no `Clock` bean exists; ITs seed relative to today).

| flag | fires when | inputs |
|---|---|---|
| `sustained_stress` | per-day avg `CHECKIN_STRESS` ≥ `threshold` on ≥ `min-days` of the last `window-days` days (today included) | `MetricKey.CHECKIN_STRESS` |
| `sleep_debt` | over the last `nights` nights (yesterday-anchored, today excluded — today's night is logged in the morning): Σ max(0, goalHours − durationH) ≥ `deficit-hours`, and at least `min-nights` of them are logged | `MetricKey.SLEEP_DURATION_H`, `sleep_goal.target_minutes` (fallback `default-goal-hours`) |
| `momentum_at_risk` | recentAvg(`HABITS_DONE`) ≤ baselineAvg × (1 − `drop-ratio`) **and** ≥1 missed planned gym day in the recent window; guarded by baselineAvg ≥ `min-baseline` | `MetricKey.HABITS_DONE`, `gym_schedule_slot.day_of_week`, `WorkoutSessionRepository.findDoneInstanceDates` |
| `recovery_needed` | inside the last `window-days` days (today included): a day with `SLEEP_DURATION_H` ≤ `sleep-floor-hours` **and** a day with `TRAINING_RPE` ≥ `rpe-threshold` **and** a day with avg `CHECKIN_STRESS` ≥ `stress-threshold` | those three series |
| `all_healthy` | none of the four fire now, **and** no non-`all_healthy` row in `companion_flag_log` in the last `quiet-days` days, **and** the window is not empty (≥1 check-in-stress or sleep value) | the log + the series |

Missing days are **absent, never invented** (the `MetricSeriesService` rule) — except
`HABITS_DONE`, where a day with no `habit_day` row genuinely means "zero habits done" and is
counted as 0 inside both averaging windows.

A flag is written only if `companion_flag_log` holds no row with that `flag_key` newer than
`cooldown-hours.<flag>` — identical for both sources.

---

### Task 1: `companion_flag_log` table, entity, repository, populator

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608241200_mezo-b3pp.18_create_companion_flag_log.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeSet)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/entity/FlagPayloadEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/entity/CompanionFlagLogEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagKey.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/repository/CompanionFlagLogRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/FlagLogPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java:40`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/CompanionFlagLogPersistenceIT.java`

**Interfaces:**
- Produces: `FlagKey.SUSTAINED_STRESS|SLEEP_DEBT|MOMENTUM_AT_RISK|RECOVERY_NEEDED|ALL_HEALTHY`,
  `FlagKey.SOURCE_WRITE|SOURCE_SWEEP`; `CompanionFlagLogEntity{flagKey,source,payload}`;
  `CompanionFlagLogRepository.findFirstByCreatedByAndFlagKeyAndDeletedFalseOrderByCreatedAtDesc`,
  `.existsRaiseSince(...)`, `.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc`;
  `FlagPayloadEnvelope` static factories (Task 3/4 fill them).
- Consumes: nothing.

- [ ] **Step 1: Write the failing persistence IT**

`backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/CompanionFlagLogPersistenceIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CompanionFlagLogPersistenceIT extends AbstractIntegrationTest {

    @Autowired private CompanionFlagLogRepository repository;
    @Autowired private FlagLogPopulator flagLogPopulator;

    @Test
    void persists_a_raise_with_its_typed_jsonb_payload() {
        UUID owner = ownerId();
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.sustainedStress(
            new FlagPayloadEnvelope.SustainedStress(7.0, 4, 3, 3, Map.of("2026-08-24", 8.0)));

        CompanionFlagLogEntity saved =
            flagLogPopulator.raise(owner, FlagKey.SUSTAINED_STRESS, FlagKey.SOURCE_WRITE, payload);

        CompanionFlagLogEntity reloaded = repository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getFlagKey()).isEqualTo(FlagKey.SUSTAINED_STRESS);
        assertThat(reloaded.getSource()).isEqualTo(FlagKey.SOURCE_WRITE);
        assertThat(reloaded.getPayload().sustainedStress().daysOverThreshold()).isEqualTo(3);
        assertThat(reloaded.getPayload().sustainedStress().stressByDay()).containsEntry("2026-08-24", 8.0);
        assertThat(reloaded.getCreatedAt()).isNotNull();
    }

    @Test
    void rejects_an_unknown_flag_key_at_the_db_check() {
        UUID owner = ownerId();
        assertThatThrownBy(() -> flagLogPopulator.raise(owner, "vibes_off", FlagKey.SOURCE_SWEEP, null))
            .hasMessageContaining("ck_companion_flag_log_flag_key");
    }

    @Test
    void rejects_an_unknown_source_at_the_db_check() {
        UUID owner = ownerId();
        assertThatThrownBy(() -> flagLogPopulator.raise(owner, FlagKey.ALL_HEALTHY, "guess", null))
            .hasMessageContaining("ck_companion_flag_log_source");
    }

    @Test
    void exists_raise_since_sees_only_rows_inside_the_window() {
        UUID owner = ownerId();
        flagLogPopulator.raiseAt(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_SWEEP, null,
            Instant.now().minus(30, ChronoUnit.HOURS));

        assertThat(repository.existsRaiseSince(owner, FlagKey.SLEEP_DEBT, Instant.now().minus(24, ChronoUnit.HOURS)))
            .isFalse();
        assertThat(repository.existsRaiseSince(owner, FlagKey.SLEEP_DEBT, Instant.now().minus(48, ChronoUnit.HOURS)))
            .isTrue();
    }
}
```

`ownerId()` is the `AbstractIntegrationTest` helper other companion ITs use — if the base class
exposes it under a different name (grep `FeedbackRollupPersistenceIT` for the exact accessor), use
that one verbatim instead.

- [ ] **Step 2: Run it and watch it fail**

```bash
cd backend && ./mvnw test -Dtest=CompanionFlagLogPersistenceIT -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `FlagKey`, `FlagPayloadEnvelope`, `CompanionFlagLogEntity`,
`CompanionFlagLogRepository`, `FlagLogPopulator` do not exist.

- [ ] **Step 3: Write the migration**

`202608241200_mezo-b3pp.18_create_companion_flag_log.sql`:

```sql
-- Phase 5 W5.1 (bd mezo-b3pp.18, spec §4.5/§9.1): the composite-flag audit trail. One row per
-- RAISE (never per evaluation) — the evaluator is deterministic and LLM-free, so payload freezing
-- the inputs makes every raise reproducible after the fact. Cooldowns (§9.2) derive from this log:
-- a flag re-raises only when no row of the same flag_key is newer than its cooldown.
create table companion_flag_log (
    id         uuid        not null default gen_random_uuid(),
    created_by uuid        not null,
    is_deleted boolean     not null default false,
    created_at timestamptz not null default now(),
    flag_key   varchar(24) not null,
    source     varchar(6)  not null,
    payload    jsonb,
    constraint pk_companion_flag_log_id primary key (id),
    constraint fk_companion_flag_log_created_by_app_user_id foreign key (created_by)
        references app_user (id) on delete cascade,
    constraint ck_companion_flag_log_flag_key check (flag_key in
        ('sustained_stress', 'sleep_debt', 'momentum_at_risk', 'recovery_needed', 'all_healthy')),
    constraint ck_companion_flag_log_source check (source in ('write', 'sweep'))
);

create index idx_companion_flag_log_user_key_at on companion_flag_log (created_by, flag_key, created_at desc);
```

Append to `1.0.0_master.yml` (same shape as the last entry there):

```yaml
  - changeSet:
      id: "1.0.0:202608241200_mezo-b3pp.18_create_companion_flag_log"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608241200_mezo-b3pp.18_create_companion_flag_log.sql
```

- [ ] **Step 4: Write `FlagKey`**

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

/**
 * The five composite state flags (Phase 5 W5.1, bd mezo-b3pp.18, spec §9.1) and the two raise
 * sources — string constants, mirroring {@code ck_companion_flag_log_flag_key} /
 * {@code ck_companion_flag_log_source} exactly. Constants, not an enum: the column is a varchar
 * with a DB CHECK (the {@code MessageFeedbackEntity} verdict/reason precedent), and W5.2's
 * intervention config keys flags by these very strings.
 */
public final class FlagKey {

    public static final String SUSTAINED_STRESS = "sustained_stress";
    public static final String SLEEP_DEBT = "sleep_debt";
    public static final String MOMENTUM_AT_RISK = "momentum_at_risk";
    public static final String RECOVERY_NEEDED = "recovery_needed";
    public static final String ALL_HEALTHY = "all_healthy";

    public static final String SOURCE_WRITE = "write";
    public static final String SOURCE_SWEEP = "sweep";

    private FlagKey() {
    }
}
```

- [ ] **Step 5: Write `FlagPayloadEnvelope`**

```java
package io.mrkuhne.mezo.feature.companion.flags.entity;

import java.util.List;
import java.util.Map;

/**
 * Typed jsonb envelope for {@code companion_flag_log.payload} (Phase 5 W5.1, bd mezo-b3pp.18,
 * spec §4.5) — the {@code FeedbackRollupStatsEnvelope} precedent: one record, all-nullable
 * fields, a static factory per shape. Exactly one nested record is non-null per row: the rule
 * that raised, with BOTH its thresholds and the observed values, so the raise is reproducible
 * from the log alone. Day keys are ISO-8601 strings ({@code LocalDate.toString()}) — jsonb object
 * keys are text.
 */
public record FlagPayloadEnvelope(
    SustainedStress sustainedStress,
    SleepDebt sleepDebt,
    MomentumAtRisk momentumAtRisk,
    RecoveryNeeded recoveryNeeded,
    AllHealthy allHealthy
) {

    public record SustainedStress(
        double threshold, int windowDays, int minDays, int daysOverThreshold,
        Map<String, Double> stressByDay) {
    }

    public record SleepDebt(
        double goalHours, int nights, int loggedNights, double deficitThresholdHours,
        double deficitHours, Map<String, Double> sleepHoursByDay) {
    }

    public record MomentumAtRisk(
        int windowDays, int baselineDays, double recentDoneAvg, double baselineDoneAvg,
        double dropRatio, double minBaseline, List<String> missedGymDays) {
    }

    public record RecoveryNeeded(
        int windowDays, double sleepFloorHours, double rpeThreshold, double stressThreshold,
        Double sleepHours, String sleepDay, Double rpe, String rpeDay, Double stress, String stressDay) {
    }

    public record AllHealthy(int quietDays, int observedDays) {
    }

    public static FlagPayloadEnvelope sustainedStress(SustainedStress p) {
        return new FlagPayloadEnvelope(p, null, null, null, null);
    }

    public static FlagPayloadEnvelope sleepDebt(SleepDebt p) {
        return new FlagPayloadEnvelope(null, p, null, null, null);
    }

    public static FlagPayloadEnvelope momentumAtRisk(MomentumAtRisk p) {
        return new FlagPayloadEnvelope(null, null, p, null, null);
    }

    public static FlagPayloadEnvelope recoveryNeeded(RecoveryNeeded p) {
        return new FlagPayloadEnvelope(null, null, null, p, null);
    }

    public static FlagPayloadEnvelope allHealthy(AllHealthy p) {
        return new FlagPayloadEnvelope(null, null, null, null, p);
    }
}
```

- [ ] **Step 6: Write `CompanionFlagLogEntity`**

```java
package io.mrkuhne.mezo.feature.companion.flags.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One raised composite state flag (Phase 5 W5.1, bd mezo-b3pp.18, spec §4.5/§9.1). Append-only
 * audit: the evaluator writes a row only when a flag actually RAISES (cooldown-gated), never on a
 * quiet evaluation, and nothing ever updates a row. {@code payload} freezes the evaluator's
 * inputs at raise time.
 */
@Getter
@Setter
@Entity
@Table(name = "companion_flag_log")
@SQLDelete(sql = "update companion_flag_log set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CompanionFlagLogEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** Mirrors ck_companion_flag_log_flag_key — see {@code FlagKey}. */
    @NotNull
    @Pattern(regexp = "sustained_stress|sleep_debt|momentum_at_risk|recovery_needed|all_healthy")
    @Column(name = "flag_key", nullable = false, length = 24)
    private String flagKey;

    /** Mirrors ck_companion_flag_log_source: {@code write} (on-write listener) | {@code sweep} (hourly job). */
    @NotNull
    @Pattern(regexp = "write|sweep")
    @Column(nullable = false, length = 6)
    private String source;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private FlagPayloadEnvelope payload;
}
```

If `OwnedEntity` does not already expose `getCreatedAt()`, read
`backend/src/main/java/io/mrkuhne/mezo/techcore/persistence/OwnedEntity.java` and use whatever
accessor it defines — do not add a duplicate `created_at` field.

- [ ] **Step 7: Write `CompanionFlagLogRepository`**

```java
package io.mrkuhne.mezo.feature.companion.flags.repository;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompanionFlagLogRepository extends JpaRepository<CompanionFlagLogEntity, UUID> {

    Optional<CompanionFlagLogEntity> findFirstByCreatedByAndFlagKeyAndDeletedFalseOrderByCreatedAtDesc(
        UUID createdBy, String flagKey);

    List<CompanionFlagLogEntity> findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(UUID createdBy);

    /** Cooldown gate: is there a raise of this flag newer than {@code since}? */
    @Query("""
        SELECT count(f) > 0 FROM CompanionFlagLogEntity f
        WHERE f.createdBy = :createdBy AND f.flagKey = :flagKey AND f.createdAt >= :since
        """)
    boolean existsRaiseSince(
        @Param("createdBy") UUID createdBy, @Param("flagKey") String flagKey, @Param("since") Instant since);

    /** all_healthy's quiet-window gate: any NON-all_healthy raise since {@code since}? */
    @Query("""
        SELECT count(f) > 0 FROM CompanionFlagLogEntity f
        WHERE f.createdBy = :createdBy AND f.flagKey <> 'all_healthy' AND f.createdAt >= :since
        """)
    boolean existsProblemRaiseSince(@Param("createdBy") UUID createdBy, @Param("since") Instant since);
}
```

`@SQLRestriction` already filters soft-deleted rows for JPQL queries; the explicit
`AndDeletedFalse` on the derived finders matches the house style used by
`MessageFeedbackRepository`.

- [ ] **Step 8: Write `FlagLogPopulator` and extend `ResetDatabase`**

`backend/src/test/java/io/mrkuhne/mezo/support/populator/FlagLogPopulator.java`:

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.transaction.annotation.Transactional;

/** Test data factory for {@link CompanionFlagLogEntity} (W5.1, mezo-b3pp.18) — persists via
 *  {@code saveAndFlush} so the DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class FlagLogPopulator {

    private final CompanionFlagLogRepository repository;

    /** JPA-managed shared EntityManager — the {@code created_at} backdate needs a native update;
     *  field-injected {@code @PersistenceContext} is the house exception to constructor DI
     *  (see {@code ResetDatabase}). */
    @PersistenceContext
    private EntityManager em;

    public CompanionFlagLogEntity raise(UUID owner, String flagKey, String source, FlagPayloadEnvelope payload) {
        CompanionFlagLogEntity e = new CompanionFlagLogEntity();
        e.setCreatedBy(owner);
        e.setFlagKey(flagKey);
        e.setSource(source);
        e.setPayload(payload);
        return repository.saveAndFlush(e);
    }

    /** A raise with a controlled timestamp — the cooldown/quiet-window tests' seam
     *  ({@code FeedbackPopulator.createVerdictAt} precedent). */
    @Transactional
    public CompanionFlagLogEntity raiseAt(
        UUID owner, String flagKey, String source, FlagPayloadEnvelope payload, Instant createdAt) {
        CompanionFlagLogEntity e = raise(owner, flagKey, source, payload);
        em.createNativeQuery("update companion_flag_log set created_at = :at where id = :id")
            .setParameter("at", createdAt).setParameter("id", e.getId()).executeUpdate();
        em.clear();
        return repository.findById(e.getId()).orElseThrow();
    }
}
```

The entity's `@Pattern` bean-validation would reject `"vibes_off"` before the DB CHECK ever sees it,
which would make the two rejection tests assert the wrong thing. Keep the entity annotations
(they document the contract) **and** make the populator's rejection path hit the DB: in
`CompanionFlagLogPersistenceIT`'s two rejection tests the populator must bypass Hibernate
validation. Add this to the populator and call it from those two tests instead of `raise`:

```java
    /** Inserts natively, so a bad flag_key/source reaches the DB CHECK instead of being stopped by
     *  the entity's mirroring {@code @Pattern} — the CHECKs are what this pins. */
    @Transactional
    public void rawInsert(UUID owner, String flagKey, String source) {
        em.createNativeQuery(
                "insert into companion_flag_log (created_by, flag_key, source) values (:owner, :key, :src)")
            .setParameter("owner", owner).setParameter("key", flagKey).setParameter("src", source)
            .executeUpdate();
        em.flush();
    }
```

and in the IT the two rejection tests become:

```java
    @Test
    void rejects_an_unknown_flag_key_at_the_db_check() {
        assertThatThrownBy(() -> flagLogPopulator.rawInsert(ownerId(), "vibes_off", FlagKey.SOURCE_SWEEP))
            .hasStackTraceContaining("ck_companion_flag_log_flag_key");
    }

    @Test
    void rejects_an_unknown_source_at_the_db_check() {
        assertThatThrownBy(() -> flagLogPopulator.rawInsert(ownerId(), FlagKey.ALL_HEALTHY, "guess"))
            .hasStackTraceContaining("ck_companion_flag_log_source");
    }
```

In `ResetDatabase.java:40`, add `companion_flag_log` to the TRUNCATE list — put it next to
`feedback_rollup` in the first line's companion cluster.

- [ ] **Step 9: Run the IT green**

```bash
cd backend && ./mvnw test -Dtest=CompanionFlagLogPersistenceIT -Dmezo.test.use-testcontainers=true
```

Expected: 4 tests pass.

- [ ] **Step 10: Commit**

```bash
git add backend/src/main/resources/db backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags backend/src/test
git commit -m "feat(companion): companion_flag_log table + entity/repo/populator (mezo-b3pp.18)"
```

---

### Task 2: `FlagProperties` + `application.yml` block

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/config/FlagProperties.java`
- Modify: `backend/src/main/resources/application.yml` (the `mezo.companion` block; cron switch in `mezo.techcore.cron`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagPropertiesIT.java`

**Interfaces:**
- Produces: `FlagProperties` with accessors `sweepCron()`, `sustainedStress()`, `sleepDebt()`,
  `momentum()`, `recovery()`, `allHealthy()`, `cooldownHours()` and the nested records below;
  `FeaturesConfiguration.FLAG_SWEEP_JOB_SWITCH`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing properties IT**

`FlagPropertiesIT.java` (the `FeedbackLearningPropertiesIT` shape):

```java
package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class FlagPropertiesIT extends AbstractIntegrationTest {

    @Autowired private FlagProperties properties;

    @Test
    void binds_every_rule_threshold_from_application_yml() {
        assertThat(properties.sweepCron()).isEqualTo("0 5 * * * *");
        assertThat(properties.sustainedStress().threshold()).isEqualTo(7.0);
        assertThat(properties.sustainedStress().windowDays()).isEqualTo(4);
        assertThat(properties.sustainedStress().minDays()).isEqualTo(3);
        assertThat(properties.sleepDebt().nights()).isEqualTo(3);
        assertThat(properties.sleepDebt().minNights()).isEqualTo(2);
        assertThat(properties.sleepDebt().deficitHours()).isEqualTo(3.0);
        assertThat(properties.sleepDebt().defaultGoalHours()).isEqualTo(8.0);
        assertThat(properties.momentum().windowDays()).isEqualTo(3);
        assertThat(properties.momentum().baselineDays()).isEqualTo(14);
        assertThat(properties.momentum().dropRatio()).isEqualTo(0.5);
        assertThat(properties.momentum().minBaseline()).isEqualTo(1.0);
        assertThat(properties.recovery().windowDays()).isEqualTo(2);
        assertThat(properties.recovery().sleepFloorHours()).isEqualTo(6.0);
        assertThat(properties.recovery().rpeThreshold()).isEqualTo(7.0);
        assertThat(properties.recovery().stressThreshold()).isEqualTo(6.0);
        assertThat(properties.allHealthy().quietDays()).isEqualTo(7);
        assertThat(properties.cooldownHours().sustainedStress()).isEqualTo(24);
        assertThat(properties.cooldownHours().sleepDebt()).isEqualTo(24);
        assertThat(properties.cooldownHours().momentumAtRisk()).isEqualTo(48);
        assertThat(properties.cooldownHours().recoveryNeeded()).isEqualTo(24);
        assertThat(properties.cooldownHours().allHealthy()).isEqualTo(168);
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd backend && ./mvnw test -Dtest=FlagPropertiesIT -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `FlagProperties` does not exist.

- [ ] **Step 3: Write `FlagProperties`**

```java
package io.mrkuhne.mezo.feature.companion.flags.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * W5.1 composite-flag tuning (bd mezo-b3pp.18, spec §9.1) — EVERY threshold, window and cooldown
 * is config, never code. The {@code FeedbackLearningProperties}/{@code ProfileProperties}
 * precedent: a feature-scoped {@code @ConfigurationProperties} record rather than another field on
 * the already-large shared {@code CompanionProperties}.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.flags")
public record FlagProperties(

    /** Hourly sweep schedule — the windows that are crossed by time alone, with no write. */
    @NotBlank String sweepCron,

    @NotNull @Valid SustainedStress sustainedStress,
    @NotNull @Valid SleepDebt sleepDebt,
    @NotNull @Valid Momentum momentum,
    @NotNull @Valid Recovery recovery,
    @NotNull @Valid AllHealthy allHealthy,
    @NotNull @Valid CooldownHours cooldownHours
) {

    /** Check-in stress is a 1–10 scale (the contract's SaveCheckInRequest bounds). */
    public record SustainedStress(
        @DecimalMin("1.0") @DecimalMax("10.0") double threshold,
        @Min(2) @Max(30) int windowDays,
        @Min(1) @Max(30) int minDays
    ) {
    }

    public record SleepDebt(
        /** How many nights back (ending yesterday) the deficit is accumulated over. */
        @Min(1) @Max(30) int nights,
        /** Honest small-n gate: fewer logged nights than this inside the window ⇒ no flag. */
        @Min(1) @Max(30) int minNights,
        /** Cumulative deficit (hours) at or above which the flag raises. */
        @DecimalMin("0.5") @DecimalMax("40.0") double deficitHours,
        /** Used only when the user has no sleep_goal row at all. */
        @DecimalMin("4.0") @DecimalMax("12.0") double defaultGoalHours
    ) {
    }

    public record Momentum(
        /** Recent window (days, ending yesterday) whose habit-completion average is compared. */
        @Min(1) @Max(30) int windowDays,
        /** Baseline window (days) immediately preceding the recent window. */
        @Min(3) @Max(120) int baselineDays,
        /** Fraction of the baseline the recent average must fall by (0.5 = halved). */
        @DecimalMin("0.05") @DecimalMax("1.0") double dropRatio,
        /** Honest floor: below this baseline average there is no momentum to lose. */
        @DecimalMin("0.0") @DecimalMax("20.0") double minBaseline
    ) {
    }

    public record Recovery(
        /** The "same 48h" window as whole days, today included (2 = today + yesterday). */
        @Min(1) @Max(7) int windowDays,
        @DecimalMin("0.0") @DecimalMax("12.0") double sleepFloorHours,
        @DecimalMin("1.0") @DecimalMax("10.0") double rpeThreshold,
        @DecimalMin("1.0") @DecimalMax("10.0") double stressThreshold
    ) {
    }

    public record AllHealthy(
        /** No other flag raised for this many days ⇒ the quiet state is itself worth recording. */
        @Min(1) @Max(90) int quietDays
    ) {
    }

    /** Per-flag re-raise cooldown; a flag re-raises only once its own window has passed. */
    public record CooldownHours(
        @Min(1) @Max(8760) int sustainedStress,
        @Min(1) @Max(8760) int sleepDebt,
        @Min(1) @Max(8760) int momentumAtRisk,
        @Min(1) @Max(8760) int recoveryNeeded,
        @Min(1) @Max(8760) int allHealthy
    ) {

        /** The cooldown for {@code flagKey} — keeps the switch out of the service. */
        public int forFlag(String flagKey) {
            return switch (flagKey) {
                case "sustained_stress" -> sustainedStress;
                case "sleep_debt" -> sleepDebt;
                case "momentum_at_risk" -> momentumAtRisk;
                case "recovery_needed" -> recoveryNeeded;
                case "all_healthy" -> allHealthy;
                default -> throw new IllegalArgumentException("Unknown flag key: " + flagKey);
            };
        }
    }
}
```

Check how `FeedbackLearningProperties` is registered (grep `@ConfigurationPropertiesScan` or
`@EnableConfigurationProperties` in `techcore`): register `FlagProperties` the identical way. If the
app uses `@ConfigurationPropertiesScan`, nothing to do.

- [ ] **Step 4: Add the yml block**

In `application.yml` under `mezo.companion`, after the `feedback-learning` block:

```yaml
    flags:
      # W5.1 (mezo-b3pp.18, spec §9.1): deterministic, LLM-free composite state flags. Every
      # threshold below is config, never code. Two triggers, one code path: the on-write listener
      # (check-in/sleep save) and this hourly sweep — the sweep exists for windows that are crossed
      # by TIME alone (a third quiet day, a cooldown expiring), with no write to react to.
      # :05 every hour — brushes past no dawn job (02:20 summary, 02:40 patterns, 03:00 SUN
      # hypotheses, 03:10 feedback-learning, 03:20 graph, 03:40 llm-log retention).
      sweep-cron: "0 5 * * * *"
      sustained-stress:
        # Check-in stress is 1–10; 7+ on 3 of the last 4 days is "this is not one bad day".
        threshold: 7.0
        window-days: 4
        min-days: 3
      sleep-debt:
        # Cumulative deficit vs the sleep goal over the last 3 nights (today excluded — tonight is
        # logged tomorrow morning).
        nights: 3
        # Honest small-n gate: with fewer logged nights than this the deficit is unknown, not zero.
        min-nights: 2
        deficit-hours: 3.0
        # Only used when there is no sleep_goal row at all.
        default-goal-hours: 8.0
      momentum:
        # Habit completions in the last 3 days vs the 14 days before them; a halving plus a missed
        # PLANNED gym day (gym_schedule_slot day-of-week with no completed workout) is the signal.
        window-days: 3
        baseline-days: 14
        drop-ratio: 0.5
        # Below this baseline average there is no momentum to lose — no flag.
        min-baseline: 1.0
      recovery:
        # "Poor sleep + high RPE + high stress inside the same 48h" as whole days (today included).
        window-days: 2
        sleep-floor-hours: 6.0
        rpe-threshold: 7.0
        stress-threshold: 6.0
      all-healthy:
        # Nothing else raised for a week ⇒ record the quiet state (W5.2 may celebrate it).
        quiet-days: 7
      cooldown-hours:
        # A raised flag stays raised for its cooldown: the evaluator re-runs constantly (every
        # write + hourly), and without this the log would fill with the same day's state.
        sustained-stress: 24
        sleep-debt: 24
        momentum-at-risk: 48
        recovery-needed: 24
        all-healthy: 168
```

Under `mezo.techcore.cron`, after `feedback-learning-job`:

```yaml
      # W5.1 (mezo-b3pp.18) hourly composite-flag sweep (schedule: mezo.companion.flags.sweep-cron);
      # off = the FlagSweepJob bean does not exist (on-write evaluation still runs)
      flag-sweep-job:
        enabled: true
```

Check whether `backend/src/test/resources/application-test.yml` (or equivalent) overrides
`mezo.techcore.cron.*` — if the test profile disables crons wholesale, `FlagPropertiesIT` still
binds fine; the sweep job's presence is Task 7's `SwitchOffIT` concern.

- [ ] **Step 5: Add the switch constant**

In `FeaturesConfiguration.java`, next to `FEEDBACK_LEARNING_JOB_SWITCH`, with a javadoc in the
surrounding style:

```java
    /** W5.1 (mezo-b3pp.18): hourly composite-flag sweep; off ⇒ the FlagSweepJob bean does not exist. */
    public static final String FLAG_SWEEP_JOB_SWITCH = "mezo.techcore.cron.flag-sweep-job.enabled";
```

- [ ] **Step 6: Run the IT green**

```bash
cd backend && ./mvnw test -Dtest=FlagPropertiesIT -Dmezo.test.use-testcontainers=true
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(companion): FlagProperties + mezo.companion.flags config block (mezo-b3pp.18)"
```

---

### Task 3: `FlagEvaluator` — `sustained_stress` + `sleep_debt`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagRaise.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagEvaluator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagEvaluatorStressSleepIT.java`

**Interfaces:**
- Consumes: `FlagKey`, `FlagPayloadEnvelope`, `FlagProperties` (Tasks 1–2).
- Produces: `record FlagRaise(String flagKey, FlagPayloadEnvelope payload)`;
  `FlagEvaluator.evaluate(UUID userId)` → `List<FlagRaise>` (ordered: sustained_stress, sleep_debt,
  momentum_at_risk, recovery_needed, then all_healthy only when the first four are empty).

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class FlagEvaluatorStressSleepIT extends AbstractIntegrationTest {

    @Autowired private FlagEvaluator evaluator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;

    private List<String> keys(UUID owner) {
        return evaluator.evaluate(owner).stream().map(FlagRaise::flagKey).toList();
    }

    @Test
    void sustained_stress_raises_at_three_of_the_last_four_days() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 7, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(2), "08:00", 4, 9, null);

        assertThat(keys(owner)).contains(FlagKey.SUSTAINED_STRESS);
    }

    @Test
    void sustained_stress_does_not_raise_at_two_of_four() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 7, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(2), "08:00", 4, 3, null);

        assertThat(keys(owner)).doesNotContain(FlagKey.SUSTAINED_STRESS);
    }

    @Test
    void sustained_stress_ignores_days_outside_the_window() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 9, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(4), "08:00", 4, 9, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(5), "08:00", 4, 9, null);

        assertThat(keys(owner)).doesNotContain(FlagKey.SUSTAINED_STRESS);
    }

    @Test
    void sustained_stress_averages_the_days_check_ins() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        // 9 + 3 = avg 6.0, below the 7.0 threshold — one spike does not make a stressed day
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 9, null);
        checkInPopulator.createCheckIn(owner, today, "20:00", 4, 3, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(2), "08:00", 4, 8, null);

        assertThat(keys(owner)).doesNotContain(FlagKey.SUSTAINED_STRESS);
    }

    @Test
    void sleep_debt_raises_when_the_three_night_deficit_reaches_the_threshold() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:30", 15); // 8.0 h
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("6.5"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(2), new BigDecimal("6.5"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(3), new BigDecimal("6.0"), 3);
        // deficit = 1.5 + 1.5 + 2.0 = 5.0 >= 3.0

        assertThat(keys(owner)).contains(FlagKey.SLEEP_DEBT);
    }

    @Test
    void sleep_debt_stays_quiet_just_below_the_threshold() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:30", 15);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("7.1"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(2), new BigDecimal("7.1"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(3), new BigDecimal("7.1"), 3);
        // deficit = 0.9 * 3 = 2.7 < 3.0

        assertThat(keys(owner)).doesNotContain(FlagKey.SLEEP_DEBT);
    }

    @Test
    void sleep_debt_never_credits_a_long_night_against_a_short_one() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:30", 15);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("4.0"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(2), new BigDecimal("11.0"), 3);
        // per-night max(0, deficit): 4.0 + 0.0 = 4.0 >= 3.0 (a surplus night does not repay debt)

        assertThat(keys(owner)).contains(FlagKey.SLEEP_DEBT);
    }

    @Test
    void sleep_debt_stays_quiet_below_the_min_nights_gate() {
        UUID owner = ownerId();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:30", 15);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(1), new BigDecimal("3.0"), 3);
        // one logged night only: the other two are UNKNOWN, not zero

        assertThat(keys(owner)).doesNotContain(FlagKey.SLEEP_DEBT);
    }

    @Test
    void sleep_debt_falls_back_to_the_default_goal_without_a_sleep_goal_row() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("6.0"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(2), new BigDecimal("6.0"), 3);
        // 8.0 default goal ⇒ deficit 2.0 + 2.0 = 4.0 >= 3.0

        assertThat(keys(owner)).contains(FlagKey.SLEEP_DEBT);
    }

    @Test
    void the_payload_freezes_the_stress_inputs() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(2), "08:00", 4, 8, null);

        FlagRaise raise = evaluator.evaluate(owner).stream()
            .filter(r -> FlagKey.SUSTAINED_STRESS.equals(r.flagKey())).findFirst().orElseThrow();

        assertThat(raise.payload().sustainedStress().threshold()).isEqualTo(7.0);
        assertThat(raise.payload().sustainedStress().daysOverThreshold()).isEqualTo(3);
        assertThat(raise.payload().sustainedStress().stressByDay())
            .containsEntry(today.toString(), 8.0)
            .hasSize(3);
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd backend && ./mvnw test -Dtest=FlagEvaluatorStressSleepIT -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `FlagEvaluator`/`FlagRaise` do not exist.

- [ ] **Step 3: Write `FlagRaise`**

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;

/**
 * One flag the evaluator says is TRUE right now, with the inputs that made it true (W5.1, bd
 * mezo-b3pp.18). Not yet a log row: {@code FlagService} still applies the per-flag cooldown.
 */
public record FlagRaise(String flagKey, FlagPayloadEnvelope payload) {
}
```

- [ ] **Step 4: Write `FlagEvaluator` with the first two rules**

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The W5.1 composite-flag rule set (bd mezo-b3pp.18, spec §9.1) — deterministic and
 * <b>LLM-free</b>: pure arithmetic over series that {@link MetricSeriesService} already composes
 * READ-ONLY from the owning features. Every threshold comes from {@link FlagProperties}; this
 * class holds no numbers of its own. It never writes: {@code FlagService} owns the cooldown gate
 * and the audit row.
 *
 * <p>Missing days stay missing (the MetricSeriesService rule) — the one exception is
 * {@code HABITS_DONE}, where "no habit_day row" genuinely means zero completions.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FlagEvaluator {

    private final MetricSeriesService metricSeriesService;
    private final SleepGoalRepository sleepGoalRepository;
    private final FlagProperties properties;

    /** Every flag that is TRUE for {@code userId} right now, cooldowns NOT yet applied. */
    @Transactional(readOnly = true)
    public List<FlagRaise> evaluate(UUID userId) {
        LocalDate today = LocalDate.now();
        List<FlagRaise> raises = new ArrayList<>();
        sustainedStress(userId, today).ifPresent(raises::add);
        sleepDebt(userId, today).ifPresent(raises::add);
        return raises;
    }

    private java.util.Optional<FlagRaise> sustainedStress(UUID userId, LocalDate today) {
        FlagProperties.SustainedStress cfg = properties.sustainedStress();
        LocalDate from = today.minusDays(cfg.windowDays() - 1L);
        Map<LocalDate, Double> stress =
            metricSeriesService.series(userId, MetricKey.CHECKIN_STRESS, from, today);

        Map<String, Double> byDay = new LinkedHashMap<>();
        int over = 0;
        for (LocalDate day = from; !day.isAfter(today); day = day.plusDays(1)) {
            Double value = stress.get(day);
            if (value == null) {
                continue;
            }
            byDay.put(day.toString(), value);
            if (value >= cfg.threshold()) {
                over++;
            }
        }
        if (over < cfg.minDays()) {
            return java.util.Optional.empty();
        }
        return java.util.Optional.of(new FlagRaise(FlagKey.SUSTAINED_STRESS,
            FlagPayloadEnvelope.sustainedStress(new FlagPayloadEnvelope.SustainedStress(
                cfg.threshold(), cfg.windowDays(), cfg.minDays(), over, byDay))));
    }

    private java.util.Optional<FlagRaise> sleepDebt(UUID userId, LocalDate today) {
        FlagProperties.SleepDebt cfg = properties.sleepDebt();
        // Today's night is logged tomorrow morning — the window ends YESTERDAY.
        LocalDate to = today.minusDays(1);
        LocalDate from = to.minusDays(cfg.nights() - 1L);
        Map<LocalDate, Double> sleep =
            metricSeriesService.series(userId, MetricKey.SLEEP_DURATION_H, from, to);

        double goalHours = sleepGoalRepository.findByCreatedByAndDeletedFalse(userId)
            .map(SleepGoalEntity::getTargetMinutes)
            .map(minutes -> minutes / 60.0)
            .orElse(cfg.defaultGoalHours());

        Map<String, Double> byDay = new LinkedHashMap<>();
        double deficit = 0;
        int logged = 0;
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            Double hours = sleep.get(day);
            if (hours == null) {
                continue;
            }
            logged++;
            byDay.put(day.toString(), hours);
            deficit += Math.max(0, goalHours - hours); // a long night never repays a short one
        }
        if (logged < cfg.minNights() || deficit < cfg.deficitHours()) {
            return java.util.Optional.empty();
        }
        return java.util.Optional.of(new FlagRaise(FlagKey.SLEEP_DEBT,
            FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(
                goalHours, cfg.nights(), logged, cfg.deficitHours(), deficit, byDay))));
    }
}
```

Use a normal `import java.util.Optional;` and drop the fully-qualified names — they are spelled out
here only to keep the snippet self-contained.

- [ ] **Step 5: Run the IT green**

```bash
cd backend && ./mvnw test -Dtest=FlagEvaluatorStressSleepIT -Dmezo.test.use-testcontainers=true
```

Expected: 10 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(companion): FlagEvaluator sustained_stress + sleep_debt rules (mezo-b3pp.18)"
```

---

### Task 4: `FlagEvaluator` — `momentum_at_risk`, `recovery_needed`, `all_healthy`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagEvaluator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagEvaluatorMomentumRecoveryIT.java`

**Interfaces:**
- Consumes: `FlagEvaluator.evaluate(UUID)` from Task 3; `CompanionFlagLogRepository.existsProblemRaiseSince` from Task 1.
- Produces: the same `evaluate(UUID)` now returning all five keys; `all_healthy` is emitted **only**
  when the other four are empty.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import io.mrkuhne.mezo.support.populator.HabitPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class FlagEvaluatorMomentumRecoveryIT extends AbstractIntegrationTest {

    @Autowired private FlagEvaluator evaluator;
    @Autowired private HabitPopulator habitPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private FlagLogPopulator flagLogPopulator;

    private List<String> keys(UUID owner) {
        return evaluator.evaluate(owner).stream().map(FlagRaise::flagKey).toList();
    }

    /** Two done habits/day across the baseline window (days -17..-4), nothing in the last 3 days. */
    private void collapsedHabitMomentum(UUID owner) {
        LocalDate today = LocalDate.now();
        for (int back = 4; back <= 17; back++) {
            LocalDate day = today.minusDays(back);
            habitPopulator.row(owner, day, "water", "done");
            habitPopulator.row(owner, day, "steps", "done");
        }
    }

    /** A gym slot on every weekday, so every day in the recent window is a PLANNED gym day. */
    private void gymPlannedEveryDay(UUID owner) {
        for (int dow = 0; dow <= 6; dow++) {
            trainPopulator.createGymSlot(owner, dow, "18:00");
        }
    }

    @Test
    void momentum_at_risk_raises_on_a_habit_collapse_plus_a_missed_planned_gym_day() {
        UUID owner = ownerId();
        collapsedHabitMomentum(owner);
        gymPlannedEveryDay(owner);

        assertThat(keys(owner)).contains(FlagKey.MOMENTUM_AT_RISK);
    }

    @Test
    void momentum_at_risk_stays_quiet_when_every_planned_gym_day_was_trained() {
        UUID owner = ownerId();
        collapsedHabitMomentum(owner);
        gymPlannedEveryDay(owner);
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Push");
        LocalDate today = LocalDate.now();
        for (int back = 1; back <= 3; back++) {
            trainPopulator.createWorkoutInstance(owner, template, today.minusDays(back), "completed");
        }

        assertThat(keys(owner)).doesNotContain(FlagKey.MOMENTUM_AT_RISK);
    }

    @Test
    void momentum_at_risk_stays_quiet_without_a_planned_gym_day() {
        UUID owner = ownerId();
        collapsedHabitMomentum(owner); // no gym_schedule_slot at all ⇒ nothing was missed

        assertThat(keys(owner)).doesNotContain(FlagKey.MOMENTUM_AT_RISK);
    }

    @Test
    void momentum_at_risk_stays_quiet_below_the_baseline_floor() {
        UUID owner = ownerId();
        gymPlannedEveryDay(owner);
        LocalDate today = LocalDate.now();
        habitPopulator.row(owner, today.minusDays(9), "water", "done"); // baseline avg ≈ 0.07

        assertThat(keys(owner)).doesNotContain(FlagKey.MOMENTUM_AT_RISK);
    }

    @Test
    void momentum_at_risk_stays_quiet_when_the_habits_held_up() {
        UUID owner = ownerId();
        gymPlannedEveryDay(owner);
        LocalDate today = LocalDate.now();
        for (int back = 1; back <= 17; back++) {
            habitPopulator.row(owner, today.minusDays(back), "water", "done");
            habitPopulator.row(owner, today.minusDays(back), "steps", "done");
        }

        assertThat(keys(owner)).doesNotContain(FlagKey.MOMENTUM_AT_RISK);
    }

    @Test
    void recovery_needed_raises_on_poor_sleep_plus_high_rpe_plus_high_stress_in_48h() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today, new BigDecimal("5.5"), 2);
        checkInPopulator.createCheckIn(owner, today, "08:00", 3, 7, null);
        trainPopulator.createSportSessionWithRpe(owner, today.minusDays(1), 8);

        assertThat(keys(owner)).contains(FlagKey.RECOVERY_NEEDED);
    }

    @Test
    void recovery_needed_stays_quiet_when_one_leg_is_missing() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today, new BigDecimal("5.5"), 2);
        checkInPopulator.createCheckIn(owner, today, "08:00", 3, 7, null);
        // no training load at all

        assertThat(keys(owner)).doesNotContain(FlagKey.RECOVERY_NEEDED);
    }

    @Test
    void recovery_needed_stays_quiet_when_a_leg_falls_outside_the_48h_window() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today, new BigDecimal("5.5"), 2);
        checkInPopulator.createCheckIn(owner, today, "08:00", 3, 7, null);
        trainPopulator.createSportSessionWithRpe(owner, today.minusDays(3), 9);

        assertThat(keys(owner)).doesNotContain(FlagKey.RECOVERY_NEEDED);
    }

    @Test
    void all_healthy_raises_after_a_quiet_week_with_actual_data() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 2, null);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("8.0"), 4);

        assertThat(keys(owner)).containsExactly(FlagKey.ALL_HEALTHY);
    }

    @Test
    void all_healthy_stays_quiet_on_an_empty_log() {
        UUID owner = ownerId();

        assertThat(keys(owner)).isEmpty();
    }

    @Test
    void all_healthy_stays_quiet_while_a_problem_flag_is_inside_the_quiet_window() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 2, null);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("8.0"), 4);
        flagLogPopulator.raiseAt(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_SWEEP, null,
            Instant.now().minus(48, ChronoUnit.HOURS));

        assertThat(keys(owner)).doesNotContain(FlagKey.ALL_HEALTHY);
    }

    @Test
    void all_healthy_returns_once_the_problem_flag_ages_out_of_the_quiet_window() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 2, null);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("8.0"), 4);
        flagLogPopulator.raiseAt(owner, FlagKey.SLEEP_DEBT, FlagKey.SOURCE_SWEEP, null,
            Instant.now().minus(8 * 24, ChronoUnit.HOURS));

        assertThat(keys(owner)).contains(FlagKey.ALL_HEALTHY);
    }
}
```

`trainPopulator.createSportSessionWithRpe(owner, date, rpe)` may not exist under that name — before
writing the IT, read `TrainPopulator` around its `sportSessionRepository` usage (~line 500) and use
the real sport-session factory, passing an RPE ≥ 7. `MetricSeriesService.trainingRpe` is the
authority on which columns feed `TRAINING_RPE`: read that method first and seed exactly what it
reads (sport session and/or run session RPE). If no populator method sets RPE, add a minimal one to
`TrainPopulator` in this task, following the file's existing style.

- [ ] **Step 2: Run it and watch it fail**

```bash
cd backend && ./mvnw test -Dtest=FlagEvaluatorMomentumRecoveryIT -Dmezo.test.use-testcontainers=true
```

Expected: failures — the three rules are not implemented yet (and `all_healthy` is never returned).

- [ ] **Step 3: Add the three rules to `FlagEvaluator`**

Add the dependencies (constructor injection via Lombok's `@RequiredArgsConstructor`):

```java
    private final GymScheduleSlotRepository gymScheduleSlotRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final CompanionFlagLogRepository flagLogRepository;
```

and extend `evaluate`:

```java
    @Transactional(readOnly = true)
    public List<FlagRaise> evaluate(UUID userId) {
        LocalDate today = LocalDate.now();
        List<FlagRaise> raises = new ArrayList<>();
        sustainedStress(userId, today).ifPresent(raises::add);
        sleepDebt(userId, today).ifPresent(raises::add);
        momentumAtRisk(userId, today).ifPresent(raises::add);
        recoveryNeeded(userId, today).ifPresent(raises::add);
        if (raises.isEmpty()) {
            allHealthy(userId, today).ifPresent(raises::add);
        }
        return raises;
    }
```

```java
    /**
     * Habit completions in the recent window vs the baseline window before it, AND at least one
     * PLANNED gym day (a {@code gym_schedule_slot} on that weekday) with no completed workout.
     * Both windows end YESTERDAY: today is still in progress, and counting its unfinished habits
     * as a collapse would flag every morning.
     */
    private Optional<FlagRaise> momentumAtRisk(UUID userId, LocalDate today) {
        FlagProperties.Momentum cfg = properties.momentum();
        LocalDate recentTo = today.minusDays(1);
        LocalDate recentFrom = recentTo.minusDays(cfg.windowDays() - 1L);
        LocalDate baselineTo = recentFrom.minusDays(1);
        LocalDate baselineFrom = baselineTo.minusDays(cfg.baselineDays() - 1L);

        // A day with no habit_day row means zero completions — here absence IS information.
        double recentAvg = dailyAverage(
            metricSeriesService.series(userId, MetricKey.HABITS_DONE, recentFrom, recentTo),
            recentFrom, recentTo);
        double baselineAvg = dailyAverage(
            metricSeriesService.series(userId, MetricKey.HABITS_DONE, baselineFrom, baselineTo),
            baselineFrom, baselineTo);

        if (baselineAvg < cfg.minBaseline() || recentAvg > baselineAvg * (1 - cfg.dropRatio())) {
            return Optional.empty();
        }

        List<String> missedGymDays = missedPlannedGymDays(userId, recentFrom, recentTo);
        if (missedGymDays.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new FlagRaise(FlagKey.MOMENTUM_AT_RISK,
            FlagPayloadEnvelope.momentumAtRisk(new FlagPayloadEnvelope.MomentumAtRisk(
                cfg.windowDays(), cfg.baselineDays(), recentAvg, baselineAvg,
                cfg.dropRatio(), cfg.minBaseline(), missedGymDays))));
    }

    /** Mean over EVERY calendar day in the window, absent days counted as 0. */
    private static double dailyAverage(Map<LocalDate, Double> series, LocalDate from, LocalDate to) {
        double sum = 0;
        int days = 0;
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            sum += series.getOrDefault(day, 0.0);
            days++;
        }
        return days == 0 ? 0 : sum / days;
    }

    /** Planned gym weekdays inside the window with no completed workout instance that day. */
    private List<String> missedPlannedGymDays(UUID userId, LocalDate from, LocalDate to) {
        Set<Integer> plannedDows = gymScheduleSlotRepository
            .findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
            .map(GymScheduleSlotEntity::getDayOfWeek)
            .collect(Collectors.toSet());
        if (plannedDows.isEmpty()) {
            return List.of();
        }
        Set<LocalDate> trained = Set.copyOf(workoutSessionRepository.findDoneInstanceDates(userId, from, to));
        List<String> missed = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            // gym_schedule_slot.day_of_week is 0=Monday..6=Sunday (the entity's own comment)
            int dow = day.getDayOfWeek().getValue() - 1;
            if (plannedDows.contains(dow) && !trained.contains(day)) {
                missed.add(day.toString());
            }
        }
        return missed;
    }

    /**
     * Poor sleep + high RPE + high stress inside the same short window (spec's "same 48h", read as
     * whole days with today included — the three signals rarely land on one calendar day).
     */
    private Optional<FlagRaise> recoveryNeeded(UUID userId, LocalDate today) {
        FlagProperties.Recovery cfg = properties.recovery();
        LocalDate from = today.minusDays(cfg.windowDays() - 1L);

        Map.Entry<LocalDate, Double> poorSleep = firstMatch(
            metricSeriesService.series(userId, MetricKey.SLEEP_DURATION_H, from, today),
            v -> v <= cfg.sleepFloorHours());
        Map.Entry<LocalDate, Double> highRpe = firstMatch(
            metricSeriesService.series(userId, MetricKey.TRAINING_RPE, from, today),
            v -> v >= cfg.rpeThreshold());
        Map.Entry<LocalDate, Double> highStress = firstMatch(
            metricSeriesService.series(userId, MetricKey.CHECKIN_STRESS, from, today),
            v -> v >= cfg.stressThreshold());

        if (poorSleep == null || highRpe == null || highStress == null) {
            return Optional.empty();
        }
        return Optional.of(new FlagRaise(FlagKey.RECOVERY_NEEDED,
            FlagPayloadEnvelope.recoveryNeeded(new FlagPayloadEnvelope.RecoveryNeeded(
                cfg.windowDays(), cfg.sleepFloorHours(), cfg.rpeThreshold(), cfg.stressThreshold(),
                poorSleep.getValue(), poorSleep.getKey().toString(),
                highRpe.getValue(), highRpe.getKey().toString(),
                highStress.getValue(), highStress.getKey().toString()))));
    }

    /** The newest day in the series whose value satisfies {@code test}, or null. */
    private static Map.Entry<LocalDate, Double> firstMatch(
        Map<LocalDate, Double> series, DoublePredicate test) {
        return series.entrySet().stream()
            .filter(e -> e.getValue() != null && test.test(e.getValue()))
            .max(Map.Entry.comparingByKey())
            .orElse(null);
    }

    /**
     * The quiet state, and only honestly: nothing else fires now, no problem flag was raised inside
     * the quiet window, AND the window actually contains data — "all healthy" over an empty log
     * would be a claim about nothing (IDENT-3).
     */
    private Optional<FlagRaise> allHealthy(UUID userId, LocalDate today) {
        FlagProperties.AllHealthy cfg = properties.allHealthy();
        LocalDate from = today.minusDays(cfg.quietDays() - 1L);
        Instant since = Instant.now().minus(cfg.quietDays(), ChronoUnit.DAYS);

        if (flagLogRepository.existsProblemRaiseSince(userId, since)) {
            return Optional.empty();
        }
        Set<LocalDate> observed = new HashSet<>();
        observed.addAll(metricSeriesService.series(userId, MetricKey.CHECKIN_STRESS, from, today).keySet());
        observed.addAll(metricSeriesService.series(userId, MetricKey.SLEEP_DURATION_H, from, today).keySet());
        if (observed.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new FlagRaise(FlagKey.ALL_HEALTHY,
            FlagPayloadEnvelope.allHealthy(new FlagPayloadEnvelope.AllHealthy(
                cfg.quietDays(), observed.size()))));
    }
```

Add the imports these need (`GymScheduleSlotEntity`, `GymScheduleSlotRepository`,
`WorkoutSessionRepository`, `CompanionFlagLogRepository`, `Instant`, `ChronoUnit`, `HashSet`,
`Set`, `Collectors`, `DoublePredicate`, `Optional`).

- [ ] **Step 4: Run both evaluator ITs green**

```bash
cd backend && ./mvnw test -Dtest='FlagEvaluator*IT' -Dmezo.test.use-testcontainers=true
```

Expected: all tests in both classes pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(companion): FlagEvaluator momentum/recovery/all_healthy rules (mezo-b3pp.18)"
```

---

### Task 5: `FlagService` — cooldown gate + audit write

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagServiceIT.java`

**Interfaces:**
- Consumes: `FlagEvaluator.evaluate(UUID)`, `CompanionFlagLogRepository`, `FlagProperties.CooldownHours.forFlag`.
- Produces: `FlagService.evaluateAndLog(UUID userId, String source)` → `List<String>` (the flag keys
  actually written, in evaluator order).

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.FlagLogPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class FlagServiceIT extends AbstractIntegrationTest {

    @Autowired private FlagService flagService;
    @Autowired private CompanionFlagLogRepository repository;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private FlagLogPopulator flagLogPopulator;

    private void stressedThreeDays(UUID owner) {
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(2), "08:00", 4, 8, null);
    }

    @Test
    void writes_one_audit_row_per_raised_flag_with_the_source() {
        UUID owner = ownerId();
        stressedThreeDays(owner);

        List<String> raised = flagService.evaluateAndLog(owner, FlagKey.SOURCE_WRITE);

        assertThat(raised).contains(FlagKey.SUSTAINED_STRESS);
        CompanionFlagLogEntity row = repository
            .findFirstByCreatedByAndFlagKeyAndDeletedFalseOrderByCreatedAtDesc(owner, FlagKey.SUSTAINED_STRESS)
            .orElseThrow();
        assertThat(row.getSource()).isEqualTo(FlagKey.SOURCE_WRITE);
        assertThat(row.getPayload().sustainedStress().daysOverThreshold()).isEqualTo(3);
    }

    @Test
    void the_cooldown_blocks_an_immediate_re_raise() {
        UUID owner = ownerId();
        stressedThreeDays(owner);

        flagService.evaluateAndLog(owner, FlagKey.SOURCE_WRITE);
        List<String> second = flagService.evaluateAndLog(owner, FlagKey.SOURCE_SWEEP);

        assertThat(second).doesNotContain(FlagKey.SUSTAINED_STRESS);
        assertThat(repository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(owner))
            .filteredOn(r -> FlagKey.SUSTAINED_STRESS.equals(r.getFlagKey()))
            .hasSize(1);
    }

    @Test
    void the_flag_re_raises_once_its_cooldown_has_expired() {
        UUID owner = ownerId();
        stressedThreeDays(owner);
        flagLogPopulator.raiseAt(owner, FlagKey.SUSTAINED_STRESS, FlagKey.SOURCE_SWEEP, null,
            Instant.now().minus(25, ChronoUnit.HOURS)); // cooldown is 24h

        assertThat(flagService.evaluateAndLog(owner, FlagKey.SOURCE_SWEEP))
            .contains(FlagKey.SUSTAINED_STRESS);
    }

    @Test
    void a_quiet_evaluation_writes_nothing() {
        UUID owner = ownerId();

        assertThat(flagService.evaluateAndLog(owner, FlagKey.SOURCE_SWEEP)).isEmpty();
        assertThat(repository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(owner)).isEmpty();
    }

    @Test
    void write_and_sweep_raise_identically_apart_from_the_source() {
        UUID owner = ownerId();
        stressedThreeDays(owner);
        UUID other = populateUser("flag-sweep-twin@example.com");
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(other, today, "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(other, today.minusDays(1), "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(other, today.minusDays(2), "08:00", 4, 8, null);

        List<String> viaWrite = flagService.evaluateAndLog(owner, FlagKey.SOURCE_WRITE);
        List<String> viaSweep = flagService.evaluateAndLog(other, FlagKey.SOURCE_SWEEP);

        assertThat(viaWrite).isEqualTo(viaSweep);
        assertThat(repository
            .findFirstByCreatedByAndFlagKeyAndDeletedFalseOrderByCreatedAtDesc(owner, FlagKey.SUSTAINED_STRESS)
            .orElseThrow().getPayload().sustainedStress())
            .isEqualTo(repository
                .findFirstByCreatedByAndFlagKeyAndDeletedFalseOrderByCreatedAtDesc(other, FlagKey.SUSTAINED_STRESS)
                .orElseThrow().getPayload().sustainedStress());
    }
}
```

`populateUser(...)` is `DatabasePopulator`'s helper — autowire `DatabasePopulator` if
`AbstractIntegrationTest` does not already expose it (grep an existing ownership-isolation IT).

- [ ] **Step 2: Run it and watch it fail**

```bash
cd backend && ./mvnw test -Dtest=FlagServiceIT -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `FlagService` does not exist.

- [ ] **Step 3: Write `FlagService`**

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The W5.1 raise path (bd mezo-b3pp.18, spec §9.1): run {@link FlagEvaluator}, drop everything
 * still inside its per-flag cooldown, and append what survives to {@code companion_flag_log} with
 * the inputs frozen in {@code payload}. The ONLY difference between the on-write listener and the
 * hourly sweep is the {@code source} string — same evaluator, same cooldowns, same rows.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FlagService {

    private final FlagEvaluator evaluator;
    private final CompanionFlagLogRepository repository;
    private final FlagProperties properties;

    /** Evaluates {@code userId} and logs every flag past its cooldown; returns the keys written. */
    @Transactional
    public List<String> evaluateAndLog(UUID userId, String source) {
        List<String> written = new ArrayList<>();
        for (FlagRaise raise : evaluator.evaluate(userId)) {
            Instant coolUntil = Instant.now()
                .minus(properties.cooldownHours().forFlag(raise.flagKey()), ChronoUnit.HOURS);
            if (repository.existsRaiseSince(userId, raise.flagKey(), coolUntil)) {
                continue;
            }
            CompanionFlagLogEntity row = new CompanionFlagLogEntity();
            row.setCreatedBy(userId);
            row.setFlagKey(raise.flagKey());
            row.setSource(source);
            row.setPayload(raise.payload());
            repository.save(row);
            written.add(raise.flagKey());
        }
        if (!written.isEmpty()) {
            log.info("Flags raised for user {} ({}): {}", userId, source, written);
        }
        return written;
    }
}
```

- [ ] **Step 4: Run the IT green**

```bash
cd backend && ./mvnw test -Dtest=FlagServiceIT -Dmezo.test.use-testcontainers=true
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(companion): FlagService cooldown gate + companion_flag_log write (mezo-b3pp.18)"
```

---

### Task 6: On-write trigger — `CheckInSavedEvent` + listener

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin/service/CheckInSavedEvent.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin/service/CheckInService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagEvaluationListener.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagEvaluationListenerIT.java`

**Interfaces:**
- Consumes: `FlagService.evaluateAndLog(UUID, String)`; the existing
  `io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepLogSavedEvent(UUID userId, LocalDate date)`.
- Produces: `CheckInSavedEvent(UUID userId, LocalDate date)`, published by `CheckInService.save`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInService;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import java.time.Duration;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class FlagEvaluationListenerIT extends AbstractIntegrationTest {

    @Autowired private CheckInService checkInService;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private CompanionFlagLogRepository repository;

    @Test
    void a_check_in_save_raises_the_flag_with_source_write() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today.minusDays(1), "08:00", 4, 8, null);
        checkInPopulator.createCheckIn(owner, today.minusDays(2), "08:00", 4, 8, null);

        SaveCheckInRequest req = new SaveCheckInRequest();
        req.setDate(today);
        req.setSlotTime("08:00");
        req.setState("done");
        req.setEnergy(4);
        req.setStress(8);
        checkInService.save(owner, req);

        await().atMost(Duration.ofSeconds(5)).untilAsserted(() ->
            assertThat(repository
                .findFirstByCreatedByAndFlagKeyAndDeletedFalseOrderByCreatedAtDesc(owner, FlagKey.SUSTAINED_STRESS))
                .isPresent()
                .get()
                .extracting(r -> r.getSource())
                .isEqualTo(FlagKey.SOURCE_WRITE));
    }

    @Test
    void a_calm_check_in_save_raises_nothing() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();

        SaveCheckInRequest req = new SaveCheckInRequest();
        req.setDate(today);
        req.setSlotTime("08:00");
        req.setState("done");
        req.setEnergy(4);
        req.setStress(2);
        checkInService.save(owner, req);

        await().during(Duration.ofSeconds(1)).atMost(Duration.ofSeconds(5)).untilAsserted(() ->
            assertThat(repository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(owner))
                .noneMatch(r -> FlagKey.SUSTAINED_STRESS.equals(r.getFlagKey())));
    }
}
```

Check how other AFTER_COMMIT/`@Async` ITs wait (`CompanionMessageEventIT` is the reference — it may
use Awaitility or the base class's async drain). Use whatever that IT uses; do not introduce a new
waiting idiom or a new test dependency. `SaveCheckInRequest` is a generated DTO — confirm its
setters/constructor shape from `CheckInApiIT` before writing this.

- [ ] **Step 2: Run it and watch it fail**

```bash
cd backend && ./mvnw test -Dtest=FlagEvaluationListenerIT -Dmezo.test.use-testcontainers=true
```

Expected: the first test fails — no flag row appears (nothing publishes or listens yet).

- [ ] **Step 3: Write `CheckInSavedEvent`**

```java
package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Published by {@link CheckInService#save} inside its {@code @Transactional} method, so an
 * {@code AFTER_COMMIT} listener sees it only once the check-in row is durable — the
 * {@code SleepLogSavedEvent} precedent. Consumed by the companion's W5.1
 * {@code FlagEvaluationListener} (bd mezo-b3pp.18): a fresh check-in is the strongest single
 * trigger for the stress/recovery rules. The check-in feature knows nothing about flags.
 */
public record CheckInSavedEvent(UUID userId, LocalDate date) {
}
```

- [ ] **Step 4: Publish it from `CheckInService.save`**

Add the publisher to the constructor-injected fields and publish right before returning:

```java
    private final ApplicationEventPublisher eventPublisher;
```

```java
        CheckInResponse response = mapper.toResponse(repository.save(e));
        // W5.1 (mezo-b3pp.18): the companion's flag evaluator reacts AFTER_COMMIT; a failure there
        // can never fail or slow this write (the listener is @Async and swallows its own errors).
        eventPublisher.publishEvent(new CheckInSavedEvent(createdBy, e.getDate()));
        return response;
```

(import `org.springframework.context.ApplicationEventPublisher`.)

- [ ] **Step 5: Write `FlagEvaluationListener`**

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInSavedEvent;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepLogSavedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * W5.1 on-write evaluation (bd mezo-b3pp.18, spec §9.1) — the {@code CompanionMessageEventListener}
 * template: AFTER_COMMIT (so only persisted writes are reacted to) and off the request thread
 * ({@code @Async}, existing {@code applicationTaskExecutor}), so the evaluator can never delay or
 * fail the check-in/sleep response. The hourly {@code FlagSweepJob} covers the windows that are
 * crossed by time alone; both call the same {@link FlagService}, differing only in {@code source}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FlagEvaluationListener {

    private final FlagService flagService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCheckInSaved(CheckInSavedEvent event) {
        evaluate(event.userId(), "check-in");
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onSleepLogged(SleepLogSavedEvent event) {
        evaluate(event.userId(), "sleep-log");
    }

    private void evaluate(java.util.UUID userId, String trigger) {
        try {
            flagService.evaluateAndLog(userId, FlagKey.SOURCE_WRITE);
        } catch (Exception e) {
            log.warn("Flag evaluation after {} failed for user {}", trigger, userId, e);
        }
    }
}
```

(import `java.util.UUID` properly rather than fully-qualifying it.)

- [ ] **Step 6: Run the listener IT + the check-in feature's own ITs green**

```bash
cd backend && ./mvnw test -Dtest='FlagEvaluationListenerIT,CheckIn*IT' -Dmezo.test.use-testcontainers=true
```

Expected: PASS — including the existing check-in ITs, unchanged by the new publication.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(companion): CheckInSavedEvent + on-write flag evaluation listener (mezo-b3pp.18)"
```

---

### Task 7: Hourly `FlagSweepJob` + switch-off IT

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagSweepJob.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagSweepJobSwitchOffIT.java`

**Interfaces:**
- Consumes: `FlagService.evaluateAndLog(UUID, String)`, `FeaturesConfiguration.FLAG_SWEEP_JOB_SWITCH`,
  `mezo.companion.flags.sweep-cron`.
- Produces: `FlagSweepJob.run()`.

- [ ] **Step 1: Write the failing switch-off IT**

Copy the exact shape of `FeedbackLearningJobSwitchOffIT` (read it first — it pins how the property
override and the bean-absence assertion are written), swapping in:

```java
package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagSweepJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

@TestPropertySource(properties = "mezo.techcore.cron.flag-sweep-job.enabled=false")
class FlagSweepJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void the_sweep_job_bean_does_not_exist_when_the_switch_is_off() {
        assertThat(context.getBeanNamesForType(FlagSweepJob.class)).isEmpty();
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd backend && ./mvnw test -Dtest=FlagSweepJobSwitchOffIT -Dmezo.test.use-testcontainers=true
```

Expected: compilation failure — `FlagSweepJob` does not exist.

- [ ] **Step 3: Write `FlagSweepJob`**

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The W5.1 hourly sweep (bd mezo-b3pp.18, spec §9.1) — the {@code PatternDetectionJob} idiom:
 * per-user isolation, one bad user never kills the run. The on-write listener covers the windows a
 * WRITE crosses; this job covers the ones TIME crosses on its own (a third quiet day arriving, a
 * cooldown expiring) — no write, so no event, so nothing else would notice.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.FLAG_SWEEP_JOB_SWITCH},
        havingValue = "true")
public class FlagSweepJob {

    private final AppUserRepository appUserRepository;
    private final FlagService flagService;

    @Scheduled(cron = "${mezo.companion.flags.sweep-cron}")
    public void run() {
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                List<String> raised = flagService.evaluateAndLog(user.getId(), FlagKey.SOURCE_SWEEP);
                if (!raised.isEmpty()) {
                    log.info("Flag sweep for user {}: raised {}", user.getId(), raised);
                }
            } catch (Exception e) {
                log.warn("Flag sweep failed for user {}", user.getId(), e);
            }
        }
    }
}
```

- [ ] **Step 4: Run the whole slice's ITs green**

```bash
cd backend && ./mvnw clean test -Dtest='CompanionFlagLogPersistenceIT,FlagPropertiesIT,FlagEvaluatorStressSleepIT,FlagEvaluatorMomentumRecoveryIT,FlagServiceIT,FlagEvaluationListenerIT,FlagSweepJobSwitchOffIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```

Expected: all green, `ArchitectureTest` included (it catches a misplaced stereotype or a new
feature-package cycle, and focused ITs alone would miss it).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(companion): hourly FlagSweepJob behind flag-sweep-job switch (mezo-b3pp.18)"
```

---

### Task 8: Docs in the same change

**Files:**
- Modify: `docs/features/companion.md`
- Modify: `docs/CODEMAP.md` (regenerated, never hand-edited below the marker)

- [ ] **Step 1: Write the companion.md sections**

Add, matching the surrounding heading style and the W4.2/W4.3 sections' depth:

1. Under **§3 Architecture & data flow** — a short "W5.1 composite flags" subsection: the two
   triggers (on-write listener AFTER_COMMIT/`@Async`, hourly sweep behind `flag-sweep-job`), the one
   shared code path (`FlagEvaluator` → `FlagService` cooldown gate → `companion_flag_log`), and the
   explicit statement that the evaluator is **LLM-free** (no `LlmCallContextHolder` because there is
   no call to tag). Name W5.2 as the consumer that will read these raises.
2. Under **§4 Data model & API** — `### Backend tables (W5.1 flag log, ✅ mezo-b3pp.18)` with the
   `companion_flag_log` DDL, the CK values, the index, and the payload envelope shape (one nested
   record per rule).
3. In the **Config keys** area — a `mezo.companion.flags.*` table (key → default → meaning) plus the
   `mezo.techcore.cron.flag-sweep-job.enabled` switch row, and the five rules stated in one line
   each (copy the "The rules" table from this plan, it is the source of truth).
4. Under **§8 Testing** — the seven IT classes and what each pins.
5. Under **§10 Key files** — the new `feature/companion/flags/**` files, `CheckInSavedEvent`, and
   the migration.
6. Under **§9 Decisions, gotchas & deferred** — three entries: (a) thresholds live in a
   feature-scoped `FlagProperties`, not `CompanionProperties`, per the
   `FeedbackLearningProperties`/`ProfileProperties` precedent (the spec's wording predates it);
   (b) `sleep_debt` excludes today (tonight is logged tomorrow) and `momentum_at_risk` ends
   yesterday (today is unfinished); (c) `all_healthy` never raises over an empty log — a claim about
   nothing would break IDENT-3.

- [ ] **Step 2: Regenerate the codemap and lint the docs**

```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs
```

Expected: the codemap picks up the new files; the linter reports **no new** staleness/orphan/broken
link. Fix anything it flags that this change introduced.

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs(companion): W5.1 composite flag evaluator (mezo-b3pp.18)"
```

---

## Ship (house git flow)

- [ ] `git push -u origin feat/w5-1-flag-evaluator`
- [ ] `gh pr create` (self-PR = the CI gate; body links bd `mezo-b3pp.18` + spec §9.1)
- [ ] `gh pr checks <PR#> --watch` until green (CI runs the FULL backend IT suite — the local run was focused)
- [ ] After green: `git -C /Users/mrkuhne/Applications/Personal/Mezo/mezo pull --rebase`, merge the
      branch with `--no-ff`, push main (the PR auto-closes)
- [ ] `bd close mezo-b3pp.18 && bd dolt push`; delete the branch locally + on the remote
- [ ] `git status` clean and "up to date with origin" in both the worktree and the primary repo

## Self-review notes

- **Spec §9.1 coverage:** five rules → Tasks 3–4 (`FlagEvaluator`); thresholds in a `@Validated`
  config record → Task 2; `CheckInSavedEvent` published by `CheckInService.save` → Task 6; sleep
  event reuse → Task 6; hourly sweep behind `flag-sweep-job` → Task 7; `companion_flag_log` with
  frozen payload → Tasks 1 + 5; per-flag cooldown → Task 5; "each rule pinned by IT (boundary
  cases); on-write and sweep raise identically; log payload reproduces the inputs" → Tasks 3, 4, 5
  (`write_and_sweep_raise_identically_apart_from_the_source`, `the_payload_freezes_the_stress_inputs`).
- **Spec §4.5 coverage:** exact DDL, CK values, index → Task 1.
- **Spec §11 coverage:** no contract change (stated in Global Constraints); no LLM call to tag;
  `@Validated` config record; integration-first tests; new table → `ResetDatabase` + `FlagLogPopulator`;
  docs in the same change → Task 8.
- **Deliberate deviation:** `FlagProperties` (prefix `mezo.companion.flags`) instead of a
  `CompanionProperties.Flags` nested record — the two most recent Phase 5 slices established the
  feature-scoped properties record as the house idiom. Recorded in companion.md §9 (Task 8).
