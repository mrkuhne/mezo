# Diagnózis riport — backend implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the backend for mezo's first on-demand report — a fatigue diagnosis that
answers „Miért vagyok fáradt?" with 2–4 evidence-bound ranked suspects, each carrying a probe
that becomes a tracked experiment on one call.

**Architecture:** The `WeeklyReviewGenerator` recipe applied to a rolling window instead of an
ISO week: a pure-code collector renders a single numbered candidate list from `MetricSeriesService`
series + confirmed patterns + knowledge facts + prior diagnoses' experiments; one SMART-tier
strict-JSON call returns suspects that reference evidence **by index**; everything is
bounds-checked on the way in and persisted as a `diagnosis` row with its evidence frozen
alongside. A per-day count quota gates generation; reads are free.

**Tech Stack:** Java 21 / Spring Boot 3 / JPA + Liquibase / PostgreSQL (jsonb envelopes) /
MapStruct / contract-first OpenAPI (`api/feature/**` → `api/openapi.yml`) / JUnit 5 +
`AbstractIntegrationTest` + `FakeCompanionLlm`.

**Scope:** bd `mezo-hqfi.1`, `.2`, `.3`. The frontend (`mezo-hqfi.4`) is a separate plan, written
after this one lands and the client is generated.

**Spec:** [`docs/superpowers/specs/2026-08-31-diagnosis-report-design.md`](../specs/2026-08-31-diagnosis-report-design.md)

## Global Constraints

- **Slice placement:** all new backend code lives in `feature.proactive`. `proactive` may read
  `feature.companion`; the reverse is forbidden by `ArchitectureTest`. Never import
  `feature.proactive` from `feature.companion`.
- **Switch gating:** every new bean carries
  `@ConditionalOnProperty(name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH}, havingValue = "true")`.
- **Ownership:** `userId` always comes from `CurrentUserId` (the JWT principal), never from a
  request body or a model answer. Every repository read is `...AndCreatedBy...`.
- **Honesty:** an unusable LLM answer ⇒ **no row**, never a placeholder. Missing data is absent,
  never zero-filled.
- **Liquibase:** `backend/src/main/resources/db/changelog/1.0.0/script/{YYYYMMDDHHMM}_{bd-id}_{snake_desc}.sql`,
  changeset `id: "1.0.0:<filename without .sql>"`, `author: daniel.kuhne`, `sqlFile` +
  `relativeToChangelogFile: true`, registered in `1.0.0_master.yml`. Named constraints
  (`pk_/fk_/uq_/ck_/idx_`). `INSERT INTO` forbidden. Lint: `node scripts/lint-liquibase.mjs`.
- **Contract-first:** new endpoints are authored in `api/feature/<name>/<name>.yml` (a full OpenAPI
  3.0.3 mini-document), appended to `api/generate/merge.yml`, then
  `cd api/generate && npm run generate:api` (commit `api/openapi.yml`). Controllers
  `implements <Tag>Api` — no `@RequestMapping`/`@Valid` of their own. Validation lives in the
  contract; `pattern` instead of `enum`. Every non-2xx returns `SystemMessageList`.
- **Tests:** integration tests extend `AbstractIntegrationTest` (or `ApiIntegrationTest` for HTTP).
  **No class-level `@Transactional`** on any path touching `AppNotificationEmitter` (REQUIRES_NEW →
  deadlock). New tables go into `ResetDatabase`'s TRUNCATE list **in the same change**.
  Test factories live in `backend/src/test/java/io/mrkuhne/mezo/support/populator/`.
- **LLM in tests:** `@ActiveProfiles("companion-fake")` + `FakeCompanionLlm`. Markers are
  **mirrored as literals** in `FakeCompanionLlm`, never imported (slice-cycle rule).
- **Local gate:** run focused tests only —
  `./mvnw test -Dtest=<Class> -Dmezo.test.use-testcontainers=true`. The full suite is CI's job.
- **Hungarian in, English out:** all user-visible strings and all LLM prompt text are Hungarian;
  code, javadoc and this plan are English.
- **`MetricKey` uses record-style accessors** — `labelHu()`, `sourceHu()`, `domain()`, `name()`,
  `wireKey()`. It is a plain enum with hand-written accessors, NOT a Lombok `@Getter`; there is
  no `getLabelHu()`.
- **Vocabularies copied verbatim from `ExperimentEntity`:** `expectedDirection` is
  `up|down|stable` (NOT just up/down); `status` is `proposed|active|completed|dismissed`.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `feature/proactive/service/LogFreshnessProbe.java` | Window-parameterised "has anything been logged since T?" probe, shared by weekly review + diagnosis |
| `feature/proactive/config/DiagnosisProperties.java` | Window/baseline/coverage/quota constants — one home, documented |
| `feature/proactive/service/FatigueEvidenceCollector.java` | Pure-code gather → the numbered candidate list + rendered payload |
| `feature/proactive/entity/DiagnosisEntity.java` | The persisted artifact |
| `feature/proactive/entity/DiagnosisEvidenceEnvelope.java` | Typed jsonb envelope — the frozen candidate list |
| `feature/proactive/entity/DiagnosisSuspectsEnvelope.java` | Typed jsonb envelope — the model's validated suspects |
| `feature/proactive/repository/DiagnosisRepository.java` | Reads + the quota count (native, counts soft-deleted) |
| `feature/proactive/service/DiagnosisGenerator.java` | Prompt, one SMART call, parse, bounds-check, persist |
| `feature/proactive/service/DiagnosisService.java` | List/detail/generate/`stale`, quota enforcement, the experiment hand-off |
| `feature/proactive/controller/DiagnosisController.java` | `implements DiagnosisApi` |
| `api/feature/diagnosis/diagnosis.yml` | The contract fragment |
| `db/changelog/1.0.0/script/202608311200_mezo-hqfi_create_diagnosis.sql` | The table |
| `db/changelog/1.0.0/script/202608311210_mezo-hqfi_experiment_source_diagnosis.sql` | `experiment.source_diagnosis_id` |
| `support/populator/DiagnosisPopulator.java` | Test factory |
| `feature/proactive/service/LogFreshnessProbeIT.java` | Task 1 tests |
| `feature/proactive/service/FatigueEvidenceCollectorIT.java` | Task 3 tests |
| `feature/proactive/service/DiagnosisGeneratorIT.java` | Task 5 tests |
| `feature/proactive/controller/DiagnosisControllerIT.java` | Task 6 + 7 tests |

**Modified**

| File | Change |
|---|---|
| `feature/proactive/service/WeeklyReviewService.java` | `isStale` delegates to `LogFreshnessProbe` |
| `feature/proactive/entity/ExperimentEntity.java` | `+ source`, `+ sourceDiagnosisId` |
| `feature/proactive/mapper/ProactiveMapper.java` | `+ toDiagnosisResponse` and friends |
| `feature/companion/llm/FakeCompanionLlm.java` | `+ DIAGNOSIS_MARKER_MIRROR` + `[fake-diagnosis:{…}]` |
| `support/ResetDatabase.java` | `+ diagnosis` in the TRUNCATE list |
| `api/generate/merge.yml` | `+ diagnosis.yml` |
| `db/changelog/1.0.0/1.0.0_master.yml` | `+ 2` changesets |
| `application.yml` | `+ mezo.proactive.diagnosis.*` |

**Two refinements this plan makes to the spec** (apply them; the spec is the older document):

1. **`EvidenceItem` is a union, not a metric row.** Spec §2 types `EvidenceItem` with
   `metricKey`/`value`/`baselineValue`, but §3.2 also collects confirmed patterns and knowledge
   facts as evidence — which have none of those fields. Resolution: one shape with
   `kind ∈ {metric, pattern, fact}` and the metric-only fields nullable. This is what the tasks
   below build.
2. **All candidates render exactly once**, in a single numbered list — unlike the weekly gather,
   which renders pattern/fact labels twice (their own section *and* the numbered anchor list) and
   therefore needs the awkward "plant the sentinel in the memoir title" trick. Rendering once makes
   any pattern title a safe sentinel channel for `FakeCompanionLlm`, and makes the payload smaller.

---

### Task 1: `LogFreshnessProbe` — extract the stale probe, window-parameterised

bd `mezo-hqfi.1`. Behaviour-preserving. Ships alone.

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/LogFreshnessProbe.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/LogFreshnessProbeIT.java`

**Interfaces:**
- Consumes: `WeightLogRepository`, `SleepLogRepository`, `CheckInRepository`, `MealRepository`
  (already injected into `WeeklyReviewService` today — move them).
- Produces: `boolean LogFreshnessProbe.anyLoggedAfter(UUID userId, LocalDate from, LocalDate to, Instant since)`
  — Task 6 calls this with a rolling 14-day window.

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The shared stale probe (mezo-hqfi.1) — extracted VERBATIM from
 * {@code WeeklyReviewService#isStale}, with the ISO week generalised to an arbitrary
 * [from, to] window. Workout logs stay unprobed for the reason the original documents:
 * {@code WorkoutSessionEntity.date} is nullable on template rows, so there is no clean
 * date-window read. Only {@code createdAt} is observable — {@code OwnedEntity} has no
 * {@code updatedAt} (bd mezo-hszs).
 */
class LogFreshnessProbeIT extends AbstractIntegrationTest {

    @Autowired private LogFreshnessProbe probe;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void reportsTrueWhenALogLandsInsideTheWindowAfterTheTimestamp() {
        UUID user = userPopulator.createUser("probe-fresh@test.local").getId();
        LocalDate from = LocalDate.now().minusDays(13);
        LocalDate to = LocalDate.now();
        Instant before = Instant.now().minusSeconds(60);

        sleepLogPopulator.createSleepLog(user, from.plusDays(3), new BigDecimal("7.0"), 8);

        assertThat(probe.anyLoggedAfter(user, from, to, before)).isTrue();
    }

    @Test
    void reportsFalseWhenTheLogIsOlderThanTheTimestamp() {
        UUID user = userPopulator.createUser("probe-stale@test.local").getId();
        LocalDate from = LocalDate.now().minusDays(13);
        LocalDate to = LocalDate.now();

        sleepLogPopulator.createSleepLog(user, from.plusDays(3), new BigDecimal("7.0"), 8);

        assertThat(probe.anyLoggedAfter(user, from, to, Instant.now().plusSeconds(60))).isFalse();
    }

    @Test
    void reportsFalseWhenTheLogFallsOutsideTheWindow() {
        UUID user = userPopulator.createUser("probe-outside@test.local").getId();
        LocalDate from = LocalDate.now().minusDays(13);
        LocalDate to = LocalDate.now();

        sleepLogPopulator.createSleepLog(user, from.minusDays(5), new BigDecimal("7.0"), 8);

        assertThat(probe.anyLoggedAfter(user, from, to, Instant.now().minusSeconds(60))).isFalse();
    }

    @Test
    void isOwnershipScoped() {
        UUID mine = userPopulator.createUser("probe-mine@test.local").getId();
        UUID theirs = userPopulator.createUser("probe-theirs@test.local").getId();
        LocalDate from = LocalDate.now().minusDays(13);
        LocalDate to = LocalDate.now();

        sleepLogPopulator.createSleepLog(theirs, from.plusDays(1), new BigDecimal("7.0"), 8);

        assertThat(probe.anyLoggedAfter(mine, from, to, Instant.now().minusSeconds(60))).isFalse();
    }
}
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `./mvnw test -Dtest=LogFreshnessProbeIT -Dmezo.test.use-testcontainers=true`
Expected: FAIL — compilation error, `LogFreshnessProbe` does not exist.

- [ ] **Step 3: Write the minimal implementation**

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * "Has anything been logged in [from, to] since {@code since}?" — the shared basis of every
 * generated artifact's {@code stale} flag (mezo-hqfi.1). Extracted verbatim from
 * {@code WeeklyReviewService#isStale} and generalised from an ISO week to an arbitrary window,
 * because the diagnosis probes a rolling 14 days.
 *
 * <p>Probes weight / sleep / check-in / meal logs. Workout logs are deliberately NOT probed:
 * {@code WorkoutSessionEntity.date} is nullable on template rows, so a clean date-window read
 * is not available (the rationale the original carried).
 *
 * <p>Only {@code createdAt} is observable — {@code OwnedEntity} has no {@code updatedAt}, so an
 * EDITED log cannot mark anything stale. Making edits observable is bd mezo-hszs.
 *
 * <p>Best-effort: false on ANY probe failure. Staleness is a hint, never a reason to fail a read.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class LogFreshnessProbe {

    private final WeightLogRepository weightLogRepository;
    private final SleepLogRepository sleepLogRepository;
    private final CheckInRepository checkInRepository;
    private final MealRepository mealRepository;

    public boolean anyLoggedAfter(UUID userId, LocalDate from, LocalDate to, Instant since) {
        try {
            return newerThan(weightLogRepository
                            .findFirstByCreatedByAndDeletedFalseAndDateBetweenOrderByCreatedAtDesc(userId, from, to)
                            .map(e -> e.getCreatedAt()), since)
                    || newerThan(sleepLogRepository
                            .findFirstByCreatedByAndDeletedFalseAndDateBetweenOrderByCreatedAtDesc(userId, from, to)
                            .map(e -> e.getCreatedAt()), since)
                    || newerThan(checkInRepository
                            .findFirstByCreatedByAndDeletedFalseAndDateBetweenOrderByCreatedAtDesc(userId, from, to)
                            .map(e -> e.getCreatedAt()), since)
                    || newerThan(mealRepository
                            .findFirstByCreatedByAndDeletedFalseAndMealDateBetweenOrderByCreatedAtDesc(userId, from, to)
                            .map(e -> e.getCreatedAt()), since);
        } catch (Exception e) {
            log.warn("Log freshness probe failed for {} [{}..{}]: {}", userId, from, to, e.getMessage());
            return false;
        }
    }

    private static boolean newerThan(Optional<Instant> candidate, Instant since) {
        return candidate.map(createdAt -> createdAt.isAfter(since)).orElse(false);
    }
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `./mvnw test -Dtest=LogFreshnessProbeIT -Dmezo.test.use-testcontainers=true`
Expected: PASS, 4 tests.

- [ ] **Step 5: Move `WeeklyReviewService` onto the probe**

In `WeeklyReviewService`: delete the four repository fields, the private `isStale` and the
private `newerThan`; inject `private final LogFreshnessProbe logFreshnessProbe;` and replace both
call sites (`getResponse`, `regenerate`) with:

```java
response.setStale(logFreshnessProbe.anyLoggedAfter(
        userId, weekStart, weekStart.plusDays(6), review.getGeneratedAt()));
```

Delete the now-unused imports (`WeightLogRepository`, `SleepLogRepository`, `CheckInRepository`,
`MealRepository`, `java.util.Optional`).

- [ ] **Step 6: Run the weekly review tests to prove nothing changed**

Run: `./mvnw test -Dtest='WeeklyReviewControllerIT,WeeklyReviewGeneratorIT,LogFreshnessProbeIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS, all green — this refactor is behaviour-preserving.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/LogFreshnessProbe.java backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/WeeklyReviewService.java backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/LogFreshnessProbeIT.java
git commit -m "refactor(proactive): extract LogFreshnessProbe from the weekly stale check (mezo-hqfi.1)"
```

---

### Task 2: `DiagnosisProperties` — the tuning knobs in one place

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/DiagnosisProperties.java`
- Modify: `backend/src/main/resources/application.yml`

**Interfaces:**
- Produces: `DiagnosisProperties#windowDays()`, `#baselineDays()`, `#minCoverageDays()`,
  `#minDomains()`, `#maxPerDay()` — consumed by Tasks 3, 5 and 6.

- [ ] **Step 1: Write the properties record**

```java
package io.mrkuhne.mezo.feature.proactive.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Diagnosis (mezo-hqfi, spec 2026-08-31 §3.2/§5) — every constant the collector and the quota
 * depend on, in one documented home (the {@code MeWeekProperties} precedent). Picked up by
 * {@code @ConfigurationPropertiesScan}.
 *
 * @param windowDays      the diagnosed window, ending today (inclusive).
 * @param baselineDays    the comparison window immediately preceding {@code windowDays}.
 * @param minCoverageDays how many measured days a metric needs inside the window before it may
 *                        become an evidence candidate at all — below this it is dropped, because
 *                        a two-day average is not a finding.
 * @param minDomains      how many distinct {@code MetricDomain}s must survive coverage before a
 *                        diagnosis is attempted; below this the request is an honest 409.
 * @param maxPerDay       generations allowed per user per calendar day (soft-deleted rows count,
 *                        so regenerate-spam counts).
 */
@Validated
@ConfigurationProperties(prefix = "mezo.proactive.diagnosis")
public record DiagnosisProperties(
    @Min(7) @Max(90) int windowDays,
    @Min(7) @Max(180) int baselineDays,
    @Min(1) @Max(30) int minCoverageDays,
    @Min(1) @Max(6) int minDomains,
    @Min(1) @Max(50) int maxPerDay
) {
}
```

- [ ] **Step 2: Add the defaults to `application.yml`**

Under the existing `mezo.proactive` block:

```yaml
    diagnosis:
      window-days: 14
      baseline-days: 28
      min-coverage-days: 7
      min-domains: 2
      max-per-day: 3
```

- [ ] **Step 3: Run any context-loading test to prove binding works**

Run: `./mvnw test -Dtest=WeeklyReviewControllerIT -Dmezo.test.use-testcontainers=true`
Expected: PASS — a validation failure would fail context startup.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/DiagnosisProperties.java backend/src/main/resources/application.yml
git commit -m "feat(proactive): DiagnosisProperties — window, baseline, coverage, quota (mezo-hqfi.2)"
```

---

### Task 3: `FatigueEvidenceCollector` — the pure-code gather

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/DiagnosisEvidenceEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/FatigueEvidenceCollector.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/FatigueEvidenceCollectorIT.java`

**Interfaces:**
- Consumes: `MetricSeriesService#series(UUID, MetricKey, LocalDate, LocalDate)` →
  `Map<LocalDate, Double>`; `PatternRepository`; `KnowledgeFactRepository`;
  `DiagnosisProperties` (Task 2).
- Produces:
  - `record DiagnosisEvidenceEnvelope(List<EvidenceItem> items)` with
    `record EvidenceItem(String kind, String label, String detail, String sourceHu, String metricKey, Double value, Double baselineValue, Double delta, Integer coverageDays)`
    — `kind` is `metric|pattern|fact`; every field except `kind`/`label` may be null for
    non-metric kinds.
  - `record FatigueGather(String payload, List<EvidenceItem> candidates, int domainCount)`
  - `FatigueGather FatigueEvidenceCollector.gather(UUID userId, LocalDate today)` — returns
    `null` when fewer than `minDomains` domains survive coverage.

- [ ] **Step 1: Write the envelope**

```java
package io.mrkuhne.mezo.feature.proactive.entity;

import java.util.List;

/**
 * Typed jsonb envelope for {@code diagnosis.evidence} (mezo-hqfi, the
 * {@code WeeklyReviewHighlightsEnvelope} precedent): the code-collected candidate list, FROZEN at
 * generation time. It is persisted rather than recomputed on read, so a diagnosis always shows
 * the numbers it actually reasoned from — weeks later, a recomputed window would put different
 * values next to the same conclusion.
 *
 * <p>{@code kind} is one of {@code metric|pattern|fact}. The metric-only fields
 * ({@code metricKey}, {@code value}, {@code baselineValue}, {@code delta}, {@code coverageDays})
 * are null for pattern and fact items.
 */
public record DiagnosisEvidenceEnvelope(List<EvidenceItem> items) {

    public record EvidenceItem(
            String kind,
            String label,
            String detail,
            String sourceHu,
            String metricKey,
            Double value,
            Double baselineValue,
            Double delta,
            Integer coverageDays) {
    }
}
```

- [ ] **Step 2: Write the failing test**

```java
package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEvidenceEnvelope.EvidenceItem;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The pure-code fatigue gather (mezo-hqfi.2): coverage discipline, deterministic ordering, and
 * the honest "not enough domains" absence. No LLM anywhere in this path.
 */
class FatigueEvidenceCollectorIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private FatigueEvidenceCollector collector;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private UserPopulator userPopulator;

    /** Sleep + check-in on every day of the window and the baseline — two domains, full coverage. */
    private void seedTwoDomains(UUID user, double windowSleepH, double baselineSleepH) {
        for (int i = 0; i < 14; i++) {
            sleepLogPopulator.createSleepLog(
                    user, TODAY.minusDays(i), BigDecimal.valueOf(windowSleepH), 7);
            checkInPopulator.createCheckIn(user, TODAY.minusDays(i), "08:00", 5, 5, null);
        }
        for (int i = 14; i < 42; i++) {
            sleepLogPopulator.createSleepLog(
                    user, TODAY.minusDays(i), BigDecimal.valueOf(baselineSleepH), 8);
            checkInPopulator.createCheckIn(user, TODAY.minusDays(i), "08:00", 8, 3, null);
        }
    }

    @Test
    void returnsNullWhenFewerThanTwoDomainsHaveCoverage() {
        UUID user = userPopulator.createUser("gather-thin@test.local").getId();
        for (int i = 0; i < 14; i++) {
            sleepLogPopulator.createSleepLog(user, TODAY.minusDays(i), new BigDecimal("7.0"), 8);
        }

        assertThat(collector.gather(user, TODAY)).isNull();
    }

    @Test
    void dropsMetricsBelowTheCoverageThreshold() {
        UUID user = userPopulator.createUser("gather-coverage@test.local").getId();
        seedTwoDomains(user, 6.0, 7.5);
        // A third domain with only 2 measured days — below min-coverage-days (7).
        checkInPopulator.createCheckIn(user, TODAY.minusDays(1), "20:00", 4, 9, null);

        FatigueEvidenceCollector.FatigueGather gather = collector.gather(user, TODAY);

        assertThat(gather).isNotNull();
        assertThat(gather.candidates())
                .filteredOn(item -> "metric".equals(item.kind()))
                .allMatch(item -> item.coverageDays() >= 7);
    }

    @Test
    void carriesValueBaselineAndDeltaForEachMetric() {
        UUID user = userPopulator.createUser("gather-delta@test.local").getId();
        seedTwoDomains(user, 6.0, 7.5);

        FatigueEvidenceCollector.FatigueGather gather = collector.gather(user, TODAY);

        assertThat(gather).isNotNull();
        EvidenceItem sleep = gather.candidates().stream()
                .filter(item -> "SLEEP_DURATION_H".equals(item.metricKey()))
                .findFirst().orElseThrow();
        assertThat(sleep.value()).isEqualTo(6.0);
        assertThat(sleep.baselineValue()).isEqualTo(7.5);
        assertThat(sleep.delta()).isEqualTo(-1.5);
        assertThat(sleep.sourceHu()).isEqualTo("Alvás-napló");
    }

    @Test
    void numbersEveryCandidateExactlyOnceInThePayload() {
        UUID user = userPopulator.createUser("gather-payload@test.local").getId();
        seedTwoDomains(user, 6.0, 7.5);

        FatigueEvidenceCollector.FatigueGather gather = collector.gather(user, TODAY);

        assertThat(gather).isNotNull();
        for (int i = 0; i < gather.candidates().size(); i++) {
            assertThat(gather.payload()).contains("\n" + i + ": ");
        }
        // Each label appears exactly once — the sentinel-safety property Task 5 depends on.
        String label = gather.candidates().get(0).label();
        assertThat(gather.payload().split(java.util.regex.Pattern.quote(label), -1)).hasSize(2);
    }

    @Test
    void orderingIsDeterministicAcrossCalls() {
        UUID user = userPopulator.createUser("gather-order@test.local").getId();
        seedTwoDomains(user, 6.0, 7.5);

        assertThat(collector.gather(user, TODAY).candidates())
                .isEqualTo(collector.gather(user, TODAY).candidates());
    }
}
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `./mvnw test -Dtest=FatigueEvidenceCollectorIT -Dmezo.test.use-testcontainers=true`
Expected: FAIL — compilation error, `FatigueEvidenceCollector` does not exist.

- [ ] **Step 4: Write the collector**

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.proactive.config.DiagnosisProperties;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEvidenceEnvelope.EvidenceItem;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fatigue evidence gather (mezo-hqfi.2, spec §3.2) — PURE CODE, no LLM. For each fatigue-relevant
 * {@link MetricKey}: the window mean vs the preceding baseline mean, dropped entirely when the
 * window has fewer than {@code minCoverageDays} measured days (a two-day average is not a
 * finding). Confirmed patterns and knowledge facts join the same list as non-metric evidence.
 *
 * <p>Ordering is the FIXED enum order, then patterns, then facts. The index IS the contract the
 * model answers with, so a reordering is a breaking change to already-persisted rows.
 *
 * <p>Every candidate is rendered EXACTLY ONCE, in the single numbered list — unlike the weekly
 * gather, which renders labels twice. That keeps the payload small and makes any label a safe
 * {@code FakeCompanionLlm} sentinel channel.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class FatigueEvidenceCollector {

    /** The fatigue-relevant slice of the metric catalog — the suspect space, fixed by design. */
    static final List<MetricKey> FATIGUE_METRICS = List.of(
            MetricKey.SLEEP_DURATION_H,
            MetricKey.SLEEP_QUALITY,
            MetricKey.SLEEP_AWAKENINGS,
            MetricKey.BEDTIME_HOUR,
            MetricKey.BEDTIME_VARIABILITY,
            MetricKey.CHECKIN_ENERGY,
            MetricKey.CHECKIN_STRESS,
            MetricKey.CHECKIN_MENTAL,
            MetricKey.CHECKIN_BODY,
            MetricKey.DAILY_KCAL,
            MetricKey.DAILY_PROTEIN_G,
            MetricKey.DAILY_WATER_ML,
            MetricKey.LATE_MEAL_HOUR,
            MetricKey.TRAINING_RPE,
            MetricKey.GYM_VOLUME_KG,
            MetricKey.SPORT_LOAD_MIN,
            MetricKey.ACWR,
            MetricKey.TRAINING_MONOTONY,
            MetricKey.MEDICATION_CYCLE_DAY);

    private static final int MAX_PATTERNS = 5;
    private static final int MAX_FACTS = 5;

    private final MetricSeriesService metricSeriesService;
    private final PatternRepository patternRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final DiagnosisProperties properties;

    public record FatigueGather(String payload, List<EvidenceItem> candidates, int domainCount) {
    }

    /** Null when fewer than {@code minDomains} domains clear the coverage threshold. */
    @Transactional(readOnly = true)
    public FatigueGather gather(UUID userId, LocalDate today) {
        LocalDate windowFrom = today.minusDays(properties.windowDays() - 1L);
        LocalDate baselineTo = windowFrom.minusDays(1);
        LocalDate baselineFrom = baselineTo.minusDays(properties.baselineDays() - 1L);

        List<EvidenceItem> candidates = new ArrayList<>();
        Set<String> domains = new LinkedHashSet<>();

        for (MetricKey metric : FATIGUE_METRICS) {
            Map<LocalDate, Double> window = metricSeriesService.series(userId, metric, windowFrom, today);
            if (window.size() < properties.minCoverageDays()) {
                continue;
            }
            Double value = round(mean(window.values()));
            Map<LocalDate, Double> baseline =
                    metricSeriesService.series(userId, metric, baselineFrom, baselineTo);
            Double baselineValue = baseline.isEmpty() ? null : round(mean(baseline.values()));
            Double delta = baselineValue == null ? null : round(value - baselineValue);

            domains.add(metric.domain().name());
            candidates.add(new EvidenceItem(
                    "metric",
                    metric.labelHu(),
                    detailLine(value, baselineValue, delta, window.size()),
                    metric.sourceHu(),
                    metric.name(),
                    value,
                    baselineValue,
                    delta,
                    window.size()));
        }

        if (domains.size() < properties.minDomains()) {
            return null;
        }

        patternRepository.findByCreatedByAndStatusAndDeletedFalse(userId, PatternEntity.STATUS_CONFIRMED)
                .stream().limit(MAX_PATTERNS)
                .forEach(pattern -> candidates.add(new EvidenceItem(
                        "pattern", pattern.getTitle(), null, "Minták", null, null, null, null, null)));

        knowledgeFactRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId)
                .stream().limit(MAX_FACTS)
                .forEach(fact -> candidates.add(new EvidenceItem(
                        "fact", truncate(fact.getFactText(), 80), null, "Tudástár",
                        null, null, null, null, null)));

        return new FatigueGather(render(candidates, windowFrom, today, baselineFrom, baselineTo),
                candidates, domains.size());
    }

    private String render(List<EvidenceItem> candidates, LocalDate windowFrom, LocalDate today,
            LocalDate baselineFrom, LocalDate baselineTo) {
        StringBuilder payload = new StringBuilder();
        payload.append("JELENSÉG: fáradtság\n")
                .append("ABLAK: ").append(windowFrom).append(" – ").append(today)
                .append(" (").append(properties.windowDays()).append(" nap)\n")
                .append("BÁZIS: ").append(baselineFrom).append(" – ").append(baselineTo)
                .append(" (").append(properties.baselineDays()).append(" nap)\n\n")
                .append("EVIDENCIA-JELÖLTEK (az evidenceIndexes ezekre mutat):\n");
        for (int i = 0; i < candidates.size(); i++) {
            EvidenceItem item = candidates.get(i);
            payload.append(i).append(": [").append(item.kind()).append("] ").append(item.label());
            if (item.detail() != null) {
                payload.append(" — ").append(item.detail());
            }
            if (item.metricKey() != null) {
                payload.append(" · metricKey=").append(item.metricKey());
            }
            payload.append('\n');
        }
        return payload.toString();
    }

    private static String detailLine(Double value, Double baselineValue, Double delta, int coverage) {
        StringBuilder line = new StringBuilder("átlag ").append(value);
        if (baselineValue != null) {
            line.append(" (bázis ").append(baselineValue)
                    .append(", eltérés ").append(delta >= 0 ? "+" : "").append(delta).append(")");
        }
        return line.append(" · ").append(coverage).append(" mért nap").toString();
    }

    private static double mean(java.util.Collection<Double> values) {
        return values.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static String truncate(String text, int maxLen) {
        if (text == null) {
            return "";
        }
        return text.length() <= maxLen ? text : text.substring(0, maxLen);
    }
}
```

> If `PatternRepository#findByCreatedByAndStatusAndDeletedFalse` or
> `KnowledgeFactRepository#findByCreatedByAndDeletedFalseOrderByCreatedAtDesc` do not exist under
> exactly those names, add the derived finders to those repositories (they are plain Spring Data
> derivations — no `@Query` needed) rather than inventing a different call shape here.

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `./mvnw test -Dtest=FatigueEvidenceCollectorIT -Dmezo.test.use-testcontainers=true`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/DiagnosisEvidenceEnvelope.java backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/FatigueEvidenceCollector.java backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/FatigueEvidenceCollectorIT.java
git commit -m "feat(proactive): FatigueEvidenceCollector — pure-code evidence gather (mezo-hqfi.2)"
```

---

### Task 4: The `diagnosis` table, entity, repository and populator

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608311200_mezo-hqfi_create_diagnosis.sql`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/DiagnosisSuspectsEnvelope.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/DiagnosisEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/DiagnosisRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/DiagnosisPopulator.java`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`

**Interfaces:**
- Produces: `DiagnosisEntity` (getters/setters via Lombok);
  `DiagnosisRepository#findByIdAndCreatedByAndDeletedFalse(UUID, UUID)`,
  `#findByCreatedByAndPhenomenonOrderByGeneratedAtDesc(UUID, String)`,
  `#countGeneratedOn(UUID, Instant, Instant)`;
  `DiagnosisSuspectsEnvelope(List<Suspect>)` with
  `record Suspect(int rank, String title, String claim, List<Integer> evidenceIndexes, String strength, String probeText, String metricKey, String expectedDirection, int totalDays)`;
  `DiagnosisPopulator#diagnosis(UUID)`.

- [ ] **Step 1: Write the migration**

```sql
-- Diagnosis (bd mezo-hqfi, spec 2026-08-31): mezo's first ON-DEMAND report. Many rows per user
-- accumulate over time (that longitudinal list is the point), so there is deliberately NO unique
-- constraint — unlike weekly_review, which is one row per week.
-- evidence/suspects are typed jsonb envelopes; evidence is FROZEN at generation time so the
-- report always shows the numbers it reasoned from.

create table diagnosis (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    phenomenon   varchar(30) not null,
    window_days  integer     not null,
    verdict      text        not null,
    confidence   varchar(10) not null,
    evidence     jsonb       not null,
    suspects     jsonb       not null,
    generated_at timestamptz not null,
    constraint pk_diagnosis_id primary key (id),
    constraint fk_diagnosis_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_diagnosis_phenomenon check (phenomenon in ('fatigue')),
    constraint ck_diagnosis_confidence check (confidence in ('strong', 'moderate', 'weak'))
);

create index idx_diagnosis_created_by_generated_at on diagnosis (created_by, generated_at desc);
```

- [ ] **Step 2: Register the changeset in `1.0.0_master.yml`**

Append at the end of the changeset list:

```yaml
  - changeSet:
      id: "1.0.0:202608311200_mezo-hqfi_create_diagnosis"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608311200_mezo-hqfi_create_diagnosis.sql
```

- [ ] **Step 3: Run the Liquibase linter**

Run: `node scripts/lint-liquibase.mjs`
Expected: PASS.

- [ ] **Step 4: Write the suspects envelope**

```java
package io.mrkuhne.mezo.feature.proactive.entity;

import java.util.List;

/**
 * Typed jsonb envelope for {@code diagnosis.suspects} (mezo-hqfi). Every suspect is VALIDATED
 * before it lands here: {@code evidenceIndexes} is non-empty and in range against the frozen
 * evidence list, {@code metricKey} is a known {@code MetricKey}, {@code expectedDirection} is
 * the {@code ExperimentEntity} vocabulary ({@code up|down|stable}), and the probe fields map 1:1
 * onto {@code ExperimentEntity} so the hand-off needs no translation layer.
 */
public record DiagnosisSuspectsEnvelope(List<Suspect> suspects) {

    public record Suspect(
            int rank,
            String title,
            String claim,
            List<Integer> evidenceIndexes,
            String strength,
            String probeText,
            String metricKey,
            String expectedDirection,
            int totalDays) {
    }
}
```

- [ ] **Step 5: Write the entity**

```java
package io.mrkuhne.mezo.feature.proactive.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One on-demand diagnosis (mezo-hqfi, spec 2026-08-31) — the {@code WeeklyReviewEntity} idiom
 * applied to a rolling window. Many rows per user accumulate: the list of past diagnoses and what
 * their experiments concluded is the feature's longitudinal value, so there is no unique index.
 */
@Getter
@Setter
@Entity
@Table(name = "diagnosis")
@SQLDelete(sql = "update diagnosis set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class DiagnosisEntity extends OwnedEntity {

    public static final String PHENOMENON_FATIGUE = "fatigue";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Pattern(regexp = "fatigue")
    @Column(nullable = false, length = 30)
    private String phenomenon = PHENOMENON_FATIGUE;

    @NotNull
    @Column(name = "window_days", nullable = false)
    private Integer windowDays;

    /** The 1-2 sentence Hungarian answer. */
    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String verdict;

    @NotNull
    @Pattern(regexp = "strong|moderate|weak")
    @Column(nullable = false, length = 10)
    private String confidence;

    /** The code-collected candidate list, frozen at generation time. */
    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private DiagnosisEvidenceEnvelope evidence;

    /** Validated, model-selected suspects — indexes into {@link #evidence}, never invented. */
    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private DiagnosisSuspectsEnvelope suspects;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
```

- [ ] **Step 6: Write the repository**

```java
package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DiagnosisRepository extends JpaRepository<DiagnosisEntity, UUID> {

    Optional<DiagnosisEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    List<DiagnosisEntity> findByCreatedByAndPhenomenonOrderByGeneratedAtDesc(
            UUID createdBy, String phenomenon);

    /**
     * The quota count — NATIVE on purpose: {@code @SQLRestriction} would hide soft-deleted rows,
     * and a regenerate soft-deletes nothing today but a future one might. Counting deleted rows
     * too means the quota cannot be reset by throwing rows away.
     */
    @Query(value = "select count(*) from diagnosis where created_by = :userId "
            + "and generated_at >= :from and generated_at < :to", nativeQuery = true)
    long countGeneratedOn(@Param("userId") UUID userId,
            @Param("from") Instant from, @Param("to") Instant to);
}
```

- [ ] **Step 7: Add `diagnosis` to `ResetDatabase`**

In the TRUNCATE statement, insert `diagnosis, ` immediately before `experiment, `.

- [ ] **Step 8: Write the populator**

```java
package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEvidenceEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEvidenceEnvelope.EvidenceItem;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisSuspectsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisSuspectsEnvelope.Suspect;
import io.mrkuhne.mezo.feature.proactive.repository.DiagnosisRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for {@code diagnosis} rows (proactive, mezo-hqfi). */
@TestComponent
@RequiredArgsConstructor
public class DiagnosisPopulator {

    private final DiagnosisRepository diagnosisRepository;

    public DiagnosisEntity diagnosis(UUID createdBy) {
        return diagnosis(createdBy, Instant.now().truncatedTo(ChronoUnit.MICROS));
    }

    public DiagnosisEntity diagnosis(UUID createdBy, Instant generatedAt) {
        DiagnosisEntity entity = new DiagnosisEntity();
        entity.setCreatedBy(createdBy);
        entity.setPhenomenon(DiagnosisEntity.PHENOMENON_FATIGUE);
        entity.setWindowDays(14);
        entity.setVerdict("Teszt diagnózis.");
        entity.setConfidence("moderate");
        entity.setEvidence(new DiagnosisEvidenceEnvelope(List.of(new EvidenceItem(
                "metric", "alváshossz", "átlag 6.0 (bázis 7.5, eltérés -1.5) · 14 mért nap",
                "Alvás-napló", "SLEEP_DURATION_H", 6.0, 7.5, -1.5, 14))));
        entity.setSuspects(new DiagnosisSuspectsEnvelope(List.of(new Suspect(
                1, "Alváshiány", "Két hete napi másfél órával kevesebbet alszol.",
                List.of(0), "strong", "Feküdj le 7 napig 23:00 előtt.",
                "SLEEP_DURATION_H", "up", 7))));
        entity.setGeneratedAt(generatedAt);
        return diagnosisRepository.saveAndFlush(entity);
    }
}
```

- [ ] **Step 9: Prove the schema and mapping load**

Run: `./mvnw test -Dtest=WeeklyReviewControllerIT -Dmezo.test.use-testcontainers=true`
Expected: PASS — Liquibase applies the new changeset and Hibernate validates the entity at
context startup, so a schema/entity mismatch fails here.

- [ ] **Step 10: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/DiagnosisRepository.java backend/src/test/java/io/mrkuhne/mezo/support/populator/DiagnosisPopulator.java backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java
git commit -m "feat(proactive): diagnosis table, entity, repository and populator (mezo-hqfi.2)"
```

---

### Task 5: `DiagnosisGenerator` — one SMART call, bounds-checked

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/DiagnosisGenerator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/DiagnosisGeneratorIT.java`

**Interfaces:**
- Consumes: `FatigueEvidenceCollector#gather` (Task 3), `DiagnosisRepository` (Task 4),
  `CompanionLlm#completeSmart(String, String)`, `LlmCallContextHolder`, `ObjectMapper`.
- Produces: `DiagnosisEntity DiagnosisGenerator.generate(UUID userId, LocalDate today)` — returns
  `null` when the gather is null or no suspect survives validation.
- Produces: `DiagnosisGenerator.DIAGNOSIS_MARKER` (`"FARADTSAG-DIAGNOZIS-FELADAT"`), mirrored as a
  literal in `FakeCompanionLlm.DIAGNOSIS_MARKER_MIRROR`.

- [ ] **Step 1: Wire the fake LLM**

In `FakeCompanionLlm`, next to `WEEKLY_REVIEW_MARKER_MIRROR`:

```java
    /** Mirror of DiagnosisGenerator.DIAGNOSIS_MARKER (feature/proactive) — LITERAL, cycle rule. */
    public static final String DIAGNOSIS_MARKER_MIRROR = "FARADTSAG-DIAGNOZIS-FELADAT";

    /** Scripted diagnosis (mezo-hqfi): {@code [fake-diagnosis:{…}]} planted in ANY candidate
     *  label — unlike the weekly gather, the diagnosis payload renders every candidate EXACTLY
     *  ONCE, so there is no duplicate-occurrence hazard and the GREEDY nested-JSON match is safe
     *  wherever it is planted. */
    private static final Pattern FAKE_DIAGNOSIS =
            Pattern.compile("\\[fake-diagnosis:(\\{.*})]", Pattern.DOTALL);
```

and, in the same `if (systemPrompt.startsWith(...))` dispatch chain the weekly review uses, add a
branch that returns the captured group when the prompt starts with `DIAGNOSIS_MARKER_MIRROR` and
the user message matches `FAKE_DIAGNOSIS` (mirror the `WEEKLY_REVIEW_MARKER_MIRROR` branch
exactly — read it first and copy its shape, including its no-match fallback).

- [ ] **Step 2: Write the failing test**

```java
package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Diagnosis generation over the fake LLM (mezo-hqfi.2). The {@code [fake-diagnosis:{…}]} sentinel
 * is planted in a CONFIRMED PATTERN's title, which the gather renders exactly once.
 *
 * <p>No class-level {@code @Transactional} — the house rule for generator ITs.
 */
@ActiveProfiles("companion-fake")
class DiagnosisGeneratorIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private DiagnosisGenerator generator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;

    private void seedTwoDomains(UUID user) {
        for (int i = 0; i < 14; i++) {
            sleepLogPopulator.createSleepLog(user, TODAY.minusDays(i), new BigDecimal("6.0"), 6);
            checkInPopulator.createCheckIn(user, TODAY.minusDays(i), "08:00", 4, 7, null);
        }
        for (int i = 14; i < 42; i++) {
            sleepLogPopulator.createSleepLog(user, TODAY.minusDays(i), new BigDecimal("7.5"), 8);
            checkInPopulator.createCheckIn(user, TODAY.minusDays(i), "08:00", 8, 3, null);
        }
    }

    /** {@code createPattern} returns a PROPOSED row — the collector only renders CONFIRMED ones,
     *  so flip the status and re-persist through the populator's own {@code save} (the W2.2
     *  mutate-then-save idiom). */
    private void plantSentinel(UUID user, String json) {
        PatternEntity pattern = patternPopulator.createPattern(
                user, "pair-" + UUID.randomUUID().toString().substring(0, 8),
                "[fake-diagnosis:" + json + "]");
        pattern.setStatus(PatternEntity.STATUS_CONFIRMED);
        patternPopulator.save(pattern);
    }

    private static String suspectJson(String metricKey, String direction, int totalDays, String indexes) {
        return "{\"verdict\":\"Az alvásod esett vissza.\",\"confidence\":\"strong\","
                + "\"suspects\":[{\"title\":\"Alváshiány\",\"claim\":\"Kevesebbet alszol.\","
                + "\"evidenceIndexes\":" + indexes + ",\"strength\":\"strong\","
                + "\"probe\":{\"text\":\"Feküdj le 23:00 előtt.\",\"metricKey\":\"" + metricKey
                + "\",\"expectedDirection\":\"" + direction + "\",\"totalDays\":" + totalDays + "}}]}";
    }

    @Test
    void persistsAValidatedDiagnosis() {
        UUID user = userPopulator.createUser("diag-ok@test.local").getId();
        seedTwoDomains(user);
        plantSentinel(user, suspectJson("SLEEP_DURATION_H", "up", 7, "[0]"));

        DiagnosisEntity diagnosis = generator.generate(user, TODAY);

        assertThat(diagnosis).isNotNull();
        assertThat(diagnosis.getVerdict()).isEqualTo("Az alvásod esett vissza.");
        assertThat(diagnosis.getConfidence()).isEqualTo("strong");
        assertThat(diagnosis.getWindowDays()).isEqualTo(14);
        assertThat(diagnosis.getSuspects().suspects()).hasSize(1);
        assertThat(diagnosis.getSuspects().suspects().get(0).rank()).isEqualTo(1);
        assertThat(diagnosis.getSuspects().suspects().get(0).metricKey()).isEqualTo("SLEEP_DURATION_H");
        assertThat(diagnosis.getEvidence().items()).isNotEmpty();
    }

    @Test
    void dropsASuspectWhoseEvidenceIndexIsOutOfRange() {
        UUID user = userPopulator.createUser("diag-oob@test.local").getId();
        seedTwoDomains(user);
        plantSentinel(user, suspectJson("SLEEP_DURATION_H", "up", 7, "[9999]"));

        assertThat(generator.generate(user, TODAY)).isNull();
    }

    @Test
    void dropsASuspectWithNoEvidenceAtAll() {
        UUID user = userPopulator.createUser("diag-noev@test.local").getId();
        seedTwoDomains(user);
        plantSentinel(user, suspectJson("SLEEP_DURATION_H", "up", 7, "[]"));

        assertThat(generator.generate(user, TODAY)).isNull();
    }

    @Test
    void dropsASuspectWithAnUnknownMetricKey() {
        UUID user = userPopulator.createUser("diag-badmetric@test.local").getId();
        seedTwoDomains(user);
        plantSentinel(user, suspectJson("NOT_A_METRIC", "up", 7, "[0]"));

        assertThat(generator.generate(user, TODAY)).isNull();
    }

    @Test
    void dropsASuspectWithAnOutOfBandProbeLength() {
        UUID user = userPopulator.createUser("diag-baddays@test.local").getId();
        seedTwoDomains(user);
        plantSentinel(user, suspectJson("SLEEP_DURATION_H", "up", 900, "[0]"));

        assertThat(generator.generate(user, TODAY)).isNull();
    }

    @Test
    void returnsNullWhenThereIsNotEnoughData() {
        UUID user = userPopulator.createUser("diag-thin@test.local").getId();
        for (int i = 0; i < 14; i++) {
            sleepLogPopulator.createSleepLog(user, TODAY.minusDays(i), new BigDecimal("6.0"), 6);
        }

        assertThat(generator.generate(user, TODAY)).isNull();
    }
}
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `./mvnw test -Dtest=DiagnosisGeneratorIT -Dmezo.test.use-testcontainers=true`
Expected: FAIL — compilation error, `DiagnosisGenerator` does not exist.

- [ ] **Step 4: Write the generator**

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.proactive.config.DiagnosisProperties;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEvidenceEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisSuspectsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisSuspectsEnvelope.Suspect;
import io.mrkuhne.mezo.feature.proactive.repository.DiagnosisRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Fatigue diagnosis generator (mezo-hqfi.2, spec §3.3) — the {@code WeeklyReviewGenerator} recipe
 * on a rolling window: PURE-CODE gather ({@link FatigueEvidenceCollector}) → ONE SMART-tier call
 * with a strict-JSON contract → every field bounds-checked on the way in.
 *
 * <p>A suspect is DROPPED (not repaired, not asked for again) when its evidence indexes are
 * empty or out of range, its {@code metricKey} is not a known {@link MetricKey}, its direction is
 * outside the {@code ExperimentEntity} vocabulary, or its probe length is outside 3..28 days. No
 * surviving suspect ⇒ NO row — the "unusable answer ⇒ no row" rule.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class DiagnosisGenerator {

    /** Prompt prefix the fake dispatches on — MIRRORED as a literal in FakeCompanionLlm. */
    public static final String DIAGNOSIS_MARKER = "FARADTSAG-DIAGNOZIS-FELADAT";

    private static final int MIN_SUSPECTS = 1;
    private static final int MAX_SUSPECTS = 4;
    private static final int MIN_PROBE_DAYS = 3;
    private static final int MAX_PROBE_DAYS = 28;
    private static final int MAX_TEXT_LEN = 400;
    private static final Set<String> DIRECTIONS = Set.of("up", "down", "stable");
    private static final Set<String> STRENGTHS = Set.of("strong", "moderate", "weak");

    private static final String PROMPT = DIAGNOSIS_MARKER + "\n"
            + "Daniel azt kérdezi: miért fáradt? Válaszolj KIZÁRÓLAG a megadott evidencia-jelöltekből. "
            + "Számot kitalálni tilos; olyan összefüggésre hivatkozni, ami nincs a jelöltek között, tilos; "
            + "gyógyszer-adagolást érintő javaslat tilos. Minden gyanúsítotthoz NEVEZD MEG a mechanizmust "
            + "(miért okozna fáradtságot), ne csak az együttjárást állapítsd meg. Minden gyanúsítotthoz "
            + "kötelező legalább egy evidenceIndex. Legfeljebb 4 gyanúsított, a legerősebb elöl. "
            + "A probe.metricKey CSAK a jelöltek között szereplő metricKey lehet, az expectedDirection "
            + "csak up|down|stable, a totalDays 3 és 28 között. Válaszolj KIZÁRÓLAG szigorú JSON-nal: "
            + "{\"verdict\": \"1-2 mondat\", \"confidence\": \"strong|moderate|weak\", \"suspects\": "
            + "[{\"title\": \"...\", \"claim\": \"...\", \"evidenceIndexes\": [sorszámok], "
            + "\"strength\": \"strong|moderate|weak\", \"probe\": {\"text\": \"...\", "
            + "\"metricKey\": \"...\", \"expectedDirection\": \"up|down|stable\", \"totalDays\": 7}}]}";

    private final DiagnosisRepository diagnosisRepository;
    private final FatigueEvidenceCollector collector;
    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final DiagnosisProperties properties;
    private final ObjectMapper objectMapper;

    record ParsedProbe(String text, String metricKey, String expectedDirection, Integer totalDays) {
    }

    record ParsedSuspect(String title, String claim, List<Integer> evidenceIndexes,
            String strength, ParsedProbe probe) {
    }

    record ParsedDiagnosis(String verdict, String confidence, List<ParsedSuspect> suspects) {
    }

    @Transactional
    public DiagnosisEntity generate(UUID userId, LocalDate today) {
        FatigueEvidenceCollector.FatigueGather gather = collector.gather(userId, today);
        if (gather == null) {
            log.debug("Not enough data for a fatigue diagnosis for {}", userId);
            return null;
        }
        String answer = llmCallContextHolder.runWith(
                new LlmCallContext("proactive_diagnosis", "generate", null, null),
                () -> companionLlm.completeSmart(PROMPT, gather.payload()));
        ParsedDiagnosis parsed = parse(answer);
        if (parsed == null || parsed.verdict() == null || parsed.verdict().isBlank()
                || !STRENGTHS.contains(parsed.confidence())) {
            log.warn("Unusable diagnosis answer for {} — no row", userId);
            return null;
        }
        List<Suspect> suspects = resolveSuspects(parsed.suspects(), gather.candidates().size());
        if (suspects.size() < MIN_SUSPECTS) {
            log.warn("No suspect survived validation for {} — no row", userId);
            return null;
        }
        DiagnosisEntity diagnosis = new DiagnosisEntity();
        diagnosis.setCreatedBy(userId);
        diagnosis.setPhenomenon(DiagnosisEntity.PHENOMENON_FATIGUE);
        diagnosis.setWindowDays(properties.windowDays());
        diagnosis.setVerdict(truncate(parsed.verdict().strip()));
        diagnosis.setConfidence(parsed.confidence());
        diagnosis.setEvidence(new DiagnosisEvidenceEnvelope(gather.candidates()));
        diagnosis.setSuspects(new DiagnosisSuspectsEnvelope(suspects));
        diagnosis.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return diagnosisRepository.saveAndFlush(diagnosis);
    }

    private ParsedDiagnosis parse(String answer) {
        if (answer == null) {
            return null;
        }
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(answer.substring(start, end + 1), ParsedDiagnosis.class);
        } catch (Exception e) {
            log.warn("Diagnosis answer failed to parse: {}", e.getMessage());
            return null;
        }
    }

    /** Drop-on-violation: a malformed suspect never lands, and is never repaired. */
    private List<Suspect> resolveSuspects(List<ParsedSuspect> parsed, int candidateCount) {
        if (parsed == null) {
            return List.of();
        }
        List<Suspect> resolved = new ArrayList<>();
        for (ParsedSuspect suspect : parsed) {
            if (resolved.size() >= MAX_SUSPECTS) {
                break;
            }
            if (suspect == null || isBlank(suspect.title()) || isBlank(suspect.claim())
                    || !STRENGTHS.contains(suspect.strength()) || suspect.probe() == null) {
                continue;
            }
            List<Integer> indexes = suspect.evidenceIndexes() == null ? List.of()
                    : suspect.evidenceIndexes().stream()
                            .filter(i -> i != null && i >= 0 && i < candidateCount)
                            .distinct().collect(Collectors.toList());
            if (indexes.isEmpty() || indexes.size() != orZero(suspect.evidenceIndexes())) {
                continue;
            }
            ParsedProbe probe = suspect.probe();
            if (isBlank(probe.text()) || !isKnownMetric(probe.metricKey())
                    || !DIRECTIONS.contains(probe.expectedDirection())
                    || probe.totalDays() == null
                    || probe.totalDays() < MIN_PROBE_DAYS || probe.totalDays() > MAX_PROBE_DAYS) {
                continue;
            }
            resolved.add(new Suspect(resolved.size() + 1, truncate(suspect.title().strip()),
                    truncate(suspect.claim().strip()), indexes, suspect.strength(),
                    truncate(probe.text().strip()), probe.metricKey(),
                    probe.expectedDirection(), probe.totalDays()));
        }
        return resolved;
    }

    /** An out-of-range index is a fabrication signal — reject the WHOLE suspect, don't silently
     *  keep its surviving indexes. */
    private static int orZero(List<Integer> indexes) {
        return indexes == null ? 0 : (int) indexes.stream().filter(java.util.Objects::nonNull).distinct().count();
    }

    private static boolean isKnownMetric(String metricKey) {
        if (metricKey == null) {
            return false;
        }
        for (MetricKey known : MetricKey.values()) {
            if (known.name().equals(metricKey)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isBlank(String text) {
        return text == null || text.isBlank();
    }

    private static String truncate(String text) {
        return text.length() <= MAX_TEXT_LEN ? text : text.substring(0, MAX_TEXT_LEN);
    }
}
```

- [ ] **Step 5: Run the tests and make sure they pass**

Run: `./mvnw test -Dtest=DiagnosisGeneratorIT -Dmezo.test.use-testcontainers=true`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/DiagnosisGenerator.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/DiagnosisGeneratorIT.java
git commit -m "feat(proactive): DiagnosisGenerator — one SMART call, bounds-checked suspects (mezo-hqfi.2)"
```

---

### Task 6: Contract, service and controller — list, detail, generate, quota

**Files:**
- Create: `api/feature/diagnosis/diagnosis.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/DiagnosisService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/controller/DiagnosisController.java`
- Modify: `api/generate/merge.yml`, `backend/.../proactive/mapper/ProactiveMapper.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/controller/DiagnosisControllerIT.java`

**Interfaces:**
- Consumes: `DiagnosisGenerator#generate` (Task 5), `DiagnosisRepository` (Task 4),
  `LogFreshnessProbe#anyLoggedAfter` (Task 1), `DiagnosisProperties#maxPerDay` (Task 2).
- Produces: generated DTOs `DiagnosisResponse`, `DiagnosisSuspect`, `DiagnosisEvidenceItem`,
  `DiagnosisGenerateRequest`; `DiagnosisService#list`, `#get`, `#generate`.

- [ ] **Step 1: Write the contract fragment**

```yaml
openapi: 3.0.3
info: { title: '', version: '' }
tags:
  - name: Diagnosis
    description: >-
      On-demand diagnostic reports (mezo-hqfi) — a phenomenon question answered with ranked,
      evidence-bound suspects. Evidence is code-collected and frozen at generation time; the
      model selects it by index and can never invent a reference.
paths:
  /api/proactive/diagnosis:
    get:
      tags: [Diagnosis]
      operationId: listDiagnoses
      summary: Past diagnoses, newest first ([] = honest empty, never 404)
      parameters:
        - name: phenomenon
          in: query
          required: false
          schema: { type: string, pattern: '^fatigue$', default: fatigue }
      responses:
        '200':
          description: The user's diagnoses
          content:
            application/json:
              schema: { type: array, items: { $ref: '#/components/schemas/DiagnosisResponse' } }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    post:
      tags: [Diagnosis]
      operationId: generateDiagnosis
      summary: Generate a fresh diagnosis (consumes the daily quota)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/DiagnosisGenerateRequest' }
      responses:
        '201':
          description: The generated diagnosis
          content:
            application/json:
              schema: { $ref: '#/components/schemas/DiagnosisResponse' }
        '409':
          description: Not enough data in the window, or no suspect survived validation
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '429':
          description: Daily generation quota exceeded
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/proactive/diagnosis/{id}:
    get:
      tags: [Diagnosis]
      operationId: getDiagnosis
      summary: One diagnosis, including its stale flag
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: The diagnosis
          content:
            application/json:
              schema: { $ref: '#/components/schemas/DiagnosisResponse' }
        '404':
          description: Not found or not owned
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    DiagnosisGenerateRequest:
      type: object
      required: [phenomenon]
      properties:
        phenomenon: { type: string, pattern: '^fatigue$' }
    DiagnosisEvidenceItem:
      type: object
      required: [kind, label]
      properties:
        kind: { type: string, pattern: '^(metric|pattern|fact)$' }
        label: { type: string }
        detail: { type: string, nullable: true }
        sourceHu: { type: string, nullable: true, description: Hungarian provenance, e.g. "Alvás-napló" }
        metricKey: { type: string, nullable: true }
        value: { type: number, nullable: true }
        baselineValue: { type: number, nullable: true }
        delta: { type: number, nullable: true }
        coverageDays: { type: integer, nullable: true }
    DiagnosisSuspect:
      type: object
      required: [rank, title, claim, evidenceIndexes, strength, probeText, metricKey, expectedDirection, totalDays]
      properties:
        rank: { type: integer }
        title: { type: string }
        claim: { type: string }
        evidenceIndexes: { type: array, items: { type: integer } }
        strength: { type: string, pattern: '^(strong|moderate|weak)$' }
        probeText: { type: string }
        metricKey: { type: string }
        expectedDirection: { type: string, pattern: '^(up|down|stable)$' }
        totalDays: { type: integer }
    DiagnosisResponse:
      type: object
      required: [id, phenomenon, windowDays, verdict, confidence, evidence, suspects, generatedAt, stale]
      properties:
        id: { type: string, format: uuid }
        phenomenon: { type: string }
        windowDays: { type: integer }
        verdict: { type: string }
        confidence: { type: string, pattern: '^(strong|moderate|weak)$' }
        evidence: { type: array, items: { $ref: '#/components/schemas/DiagnosisEvidenceItem' } }
        suspects: { type: array, items: { $ref: '#/components/schemas/DiagnosisSuspect' } }
        generatedAt: { type: string, format: date-time }
        stale: { type: boolean, description: a log landed in the window after generatedAt }
```

- [ ] **Step 2: Register the fragment and regenerate**

Append to `api/generate/merge.yml`'s input list:

```yaml
  - inputFile: ../feature/diagnosis/diagnosis.yml
```

Run: `cd api/generate && npm run generate:api`
Expected: `api/openapi.yml` gains the three paths and four schemas.

- [ ] **Step 3: Add the mapper methods**

In `ProactiveMapper`, next to the weekly review methods:

```java
    /** {@code stale} is NOT mapped from the entity — it is a live probe result, computed in
     *  {@code DiagnosisService} and set on the returned DTO after this call (the
     *  {@code toWeeklyReviewResponse} precedent). */
    @Mapping(target = "stale", ignore = true)
    @Mapping(target = "evidence", source = "evidence.items")
    @Mapping(target = "suspects", source = "suspects.suspects")
    DiagnosisResponse toDiagnosisResponse(DiagnosisEntity entity);

    DiagnosisEvidenceItem toDiagnosisEvidenceItem(DiagnosisEvidenceEnvelope.EvidenceItem item);

    DiagnosisSuspect toDiagnosisSuspect(DiagnosisSuspectsEnvelope.Suspect suspect);
```

- [ ] **Step 4: Write the failing test**

```java
package io.mrkuhne.mezo.feature.proactive.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpMethod.GET;
import static org.springframework.http.HttpMethod.POST;

import io.mrkuhne.mezo.api.dto.DiagnosisResponse;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DiagnosisPopulator;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * The diagnosis HTTP surface (mezo-hqfi.2): honest-empty list, ownership-scoped detail, the
 * quota 429 and the not-enough-data 409. Generation itself is covered by DiagnosisGeneratorIT.
 */
class DiagnosisControllerIT extends ApiIntegrationTest {

    @Autowired private DiagnosisPopulator diagnosisPopulator;

    @Test
    void listIsHonestlyEmptyRatherThan404() {
        ResponseEntity<java.util.List<DiagnosisResponse>> response = restTemplate.exchange(
                "/api/proactive/diagnosis?phenomenon=fatigue", GET,
                new HttpEntity<>(ownerAuthHeaders()),
                new ParameterizedTypeReference<>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEmpty();
    }

    @Test
    void detailReturnsTheRowWithAStaleFlag() {
        DiagnosisEntity seeded = diagnosisPopulator.diagnosis(ownerId());

        ResponseEntity<DiagnosisResponse> response = restTemplate.exchange(
                "/api/proactive/diagnosis/" + seeded.getId(), GET,
                new HttpEntity<>(ownerAuthHeaders()), DiagnosisResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getVerdict()).isEqualTo("Teszt diagnózis.");
        assertThat(response.getBody().getStale()).isFalse();
        assertThat(response.getBody().getSuspects()).hasSize(1);
        assertThat(response.getBody().getEvidence()).hasSize(1);
    }

    @Test
    void detailIs404ForAnotherUsersRow() {
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/proactive/diagnosis/" + UUID.randomUUID(), GET,
                new HttpEntity<>(ownerAuthHeaders()), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void generateIs429WhenTheDailyQuotaIsSpent() {
        Instant today = Instant.now().truncatedTo(ChronoUnit.MICROS);
        for (int i = 0; i < 3; i++) {
            diagnosisPopulator.diagnosis(ownerId(), today);
        }

        ResponseEntity<String> response = restTemplate.exchange(
                "/api/proactive/diagnosis", POST,
                new HttpEntity<>("{\"phenomenon\":\"fatigue\"}", ownerAuthHeaders()), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void generateIs409WhenThereIsNotEnoughData() {
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/proactive/diagnosis", POST,
                new HttpEntity<>("{\"phenomenon\":\"fatigue\"}", ownerAuthHeaders()), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }
}
```

> `ownerAuthHeaders()` comes from `ApiIntegrationTest`. If it exposes the owner's id under a
> different name than `ownerId()`, use whatever the base class actually provides — read it first.

- [ ] **Step 5: Run it to make sure it fails**

Run: `./mvnw test -Dtest=DiagnosisControllerIT -Dmezo.test.use-testcontainers=true`
Expected: FAIL — no controller implements `DiagnosisApi`, so the routes 404.

- [ ] **Step 6: Write the service**

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.api.dto.DiagnosisResponse;
import io.mrkuhne.mezo.feature.proactive.config.DiagnosisProperties;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import io.mrkuhne.mezo.feature.proactive.mapper.ProactiveMapper;
import io.mrkuhne.mezo.feature.proactive.repository.DiagnosisRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The diagnosis read/generate surface (mezo-hqfi.2, spec §3.5/§5). Reads are FREE — only
 * generation consumes the daily quota, so re-opening a report never costs anything.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class DiagnosisService {

    private final DiagnosisRepository diagnosisRepository;
    private final DiagnosisGenerator generator;
    private final LogFreshnessProbe logFreshnessProbe;
    private final DiagnosisProperties properties;
    private final ProactiveMapper mapper;

    @Transactional(readOnly = true)
    public List<DiagnosisResponse> list(UUID userId, String phenomenon) {
        return diagnosisRepository
                .findByCreatedByAndPhenomenonOrderByGeneratedAtDesc(userId, phenomenon)
                .stream().map(entity -> withStale(userId, entity)).toList();
    }

    @Transactional(readOnly = true)
    public DiagnosisResponse get(UUID userId, UUID id) {
        DiagnosisEntity entity = diagnosisRepository
                .findByIdAndCreatedByAndDeletedFalse(id, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        return withStale(userId, entity);
    }

    @Transactional
    public DiagnosisResponse generate(UUID userId, String phenomenon) {
        LocalDate today = LocalDate.now();
        Instant dayStart = today.atStartOfDay(ZoneId.systemDefault()).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();
        if (diagnosisRepository.countGeneratedOn(userId, dayStart, dayEnd) >= properties.maxPerDay()) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("DIAGNOSIS_QUOTA_EXCEEDED").build(), HttpStatus.TOO_MANY_REQUESTS);
        }
        DiagnosisEntity generated = generator.generate(userId, today);
        if (generated == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("DIAGNOSIS_INSUFFICIENT_DATA").build(), HttpStatus.CONFLICT);
        }
        return withStale(userId, generated);
    }

    private DiagnosisResponse withStale(UUID userId, DiagnosisEntity entity) {
        DiagnosisResponse response = mapper.toDiagnosisResponse(entity);
        LocalDate to = LocalDate.now();
        LocalDate from = to.minusDays(entity.getWindowDays() - 1L);
        response.setStale(logFreshnessProbe.anyLoggedAfter(userId, from, to, entity.getGeneratedAt()));
        return response;
    }
}
```

- [ ] **Step 7: Write the controller**

```java
package io.mrkuhne.mezo.feature.proactive.controller;

import io.mrkuhne.mezo.api.controller.DiagnosisApi;
import io.mrkuhne.mezo.api.dto.DiagnosisGenerateRequest;
import io.mrkuhne.mezo.api.dto.DiagnosisResponse;
import io.mrkuhne.mezo.feature.proactive.service.DiagnosisService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class DiagnosisController implements DiagnosisApi {

    private final DiagnosisService diagnosisService;
    private final CurrentUserId currentUserId;

    @Override
    public List<DiagnosisResponse> listDiagnoses(String phenomenon) {
        return diagnosisService.list(currentUserId.get(), phenomenon);
    }

    @Override
    public DiagnosisResponse getDiagnosis(UUID id) {
        return diagnosisService.get(currentUserId.get(), id);
    }

    @Override
    public DiagnosisResponse generateDiagnosis(DiagnosisGenerateRequest request) {
        return diagnosisService.generate(currentUserId.get(), request.getPhenomenon());
    }
}
```

- [ ] **Step 8: Run the tests and make sure they pass**

Run: `./mvnw test -Dtest=DiagnosisControllerIT -Dmezo.test.use-testcontainers=true`
Expected: PASS, 5 tests.

- [ ] **Step 9: Commit**

```bash
git add api backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/DiagnosisService.java backend/src/main/java/io/mrkuhne/mezo/feature/proactive/controller/DiagnosisController.java backend/src/main/java/io/mrkuhne/mezo/feature/proactive/mapper/ProactiveMapper.java backend/src/test/java/io/mrkuhne/mezo/feature/proactive/controller/DiagnosisControllerIT.java
git commit -m "feat(api): diagnosis list/detail/generate with a daily quota (mezo-hqfi.2)"
```

---

### Task 7: Probe → experiment — closing the loop

bd `mezo-hqfi.3`.

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608311210_mezo-hqfi_experiment_source_diagnosis.sql`
- Modify: `backend/.../proactive/entity/ExperimentEntity.java`, `api/feature/diagnosis/diagnosis.yml`,
  `backend/.../proactive/service/DiagnosisService.java`,
  `backend/.../proactive/controller/DiagnosisController.java`,
  `backend/.../proactive/service/FatigueEvidenceCollector.java`,
  `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/controller/DiagnosisExperimentIT.java`

**Interfaces:**
- Consumes: `DiagnosisRepository`, `ExperimentRepository`, `DiagnosisSuspectsEnvelope.Suspect`.
- Produces: `ExperimentResponse DiagnosisService.startExperiment(UUID userId, UUID diagnosisId, int rank)`.

- [ ] **Step 1: Write the migration**

```sql
-- Diagnosis → experiment hand-off (bd mezo-hqfi.3, spec 2026-08-31 §4). The tap on
-- "✓ Próbáljuk ki" IS the acceptance, so the row is created active. source_diagnosis_id mirrors
-- source_pattern_id (202608141110_mezo-tk88.2_experiment_source_pattern.sql); source records
-- WHICH origin produced it, so the earlier pattern-sourced rows stay honest.

alter table experiment add column source varchar(20) not null default 'proposal';
alter table experiment add column source_diagnosis_id uuid;

alter table experiment add constraint ck_experiment_source check (source in ('proposal', 'diagnosis'));

alter table experiment add constraint fk_experiment_source_diagnosis_id_diagnosis_id
    foreign key (source_diagnosis_id) references diagnosis (id) on delete set null;

create index idx_experiment_source_diagnosis_id on experiment (source_diagnosis_id)
    where source_diagnosis_id is not null;
```

Register it in `1.0.0_master.yml` with id `"1.0.0:202608311210_mezo-hqfi_experiment_source_diagnosis"`,
author `daniel.kuhne`, then run `node scripts/lint-liquibase.mjs` (expected: PASS).

- [ ] **Step 2: Widen the entity**

Append to `ExperimentEntity`:

```java
    public static final String SOURCE_PROPOSAL = "proposal";
    public static final String SOURCE_DIAGNOSIS = "diagnosis";

    /** Which origin produced this experiment (mezo-hqfi.3). Pre-existing rows are 'proposal'. */
    @NotNull
    @Pattern(regexp = "proposal|diagnosis")
    @Column(nullable = false, length = 20)
    private String source = SOURCE_PROPOSAL;

    /** The diagnosis whose suspect probe this is (loose ref, ON DELETE SET NULL). */
    @Column(name = "source_diagnosis_id", columnDefinition = "uuid")
    private UUID sourceDiagnosisId;
```

- [ ] **Step 3: Add the endpoint to the contract and regenerate**

Add to `api/feature/diagnosis/diagnosis.yml` under `paths:`:

```yaml
  /api/proactive/diagnosis/{id}/suspect/{rank}/experiment:
    post:
      tags: [Diagnosis]
      operationId: startDiagnosisExperiment
      summary: Turn a suspect's probe into a tracked experiment (the tap IS the acceptance)
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
        - name: rank
          in: path
          required: true
          schema: { type: integer, minimum: 1, maximum: 4 }
      responses:
        '201':
          description: The created experiment, or the open one that already covers this metric
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ExperimentResponse' }
        '404':
          description: Diagnosis not found, not owned, or no suspect at that rank
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

Run: `cd api/generate && npm run generate:api`

- [ ] **Step 4: Write the failing test**

```java
package io.mrkuhne.mezo.feature.proactive.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpMethod.POST;

import io.mrkuhne.mezo.api.dto.ExperimentResponse;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DiagnosisPopulator;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/** The probe → experiment hand-off (mezo-hqfi.3, spec §4). */
class DiagnosisExperimentIT extends ApiIntegrationTest {

    @Autowired private DiagnosisPopulator diagnosisPopulator;
    @Autowired private ExperimentRepository experimentRepository;

    private ResponseEntity<ExperimentResponse> start(DiagnosisEntity diagnosis, int rank) {
        return restTemplate.exchange(
                "/api/proactive/diagnosis/" + diagnosis.getId() + "/suspect/" + rank + "/experiment",
                POST, new HttpEntity<>(ownerAuthHeaders()), ExperimentResponse.class);
    }

    @Test
    void createsAnActiveExperimentFromTheProbe() {
        DiagnosisEntity diagnosis = diagnosisPopulator.diagnosis(ownerId());

        ResponseEntity<ExperimentResponse> response = start(diagnosis, 1);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().getStatus()).isEqualTo("active");
        assertThat(response.getBody().getMetricKey()).isEqualTo("SLEEP_DURATION_H");
        assertThat(response.getBody().getTotalDays()).isEqualTo(7);

        List<ExperimentEntity> rows = experimentRepository.findAll();
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getSource()).isEqualTo(ExperimentEntity.SOURCE_DIAGNOSIS);
        assertThat(rows.get(0).getSourceDiagnosisId()).isEqualTo(diagnosis.getId());
        assertThat(rows.get(0).getStartDate()).isEqualTo(LocalDate.now());
    }

    @Test
    void doesNotCreateASecondExperimentForTheSameMetric() {
        DiagnosisEntity diagnosis = diagnosisPopulator.diagnosis(ownerId());
        start(diagnosis, 1);

        ResponseEntity<ExperimentResponse> second = start(diagnosis, 1);

        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(experimentRepository.findAll()).hasSize(1);
    }

    @Test
    void is404ForARankThatHasNoSuspect() {
        DiagnosisEntity diagnosis = diagnosisPopulator.diagnosis(ownerId());

        ResponseEntity<String> response = restTemplate.exchange(
                "/api/proactive/diagnosis/" + diagnosis.getId() + "/suspect/4/experiment",
                POST, new HttpEntity<>(ownerAuthHeaders()), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
```

- [ ] **Step 5: Run it to make sure it fails**

Run: `./mvnw test -Dtest=DiagnosisExperimentIT -Dmezo.test.use-testcontainers=true`
Expected: FAIL — `startDiagnosisExperiment` is unimplemented, so the route 404s.

- [ ] **Step 6: Implement the hand-off**

Add to `DiagnosisService` (and inject `ExperimentRepository experimentRepository`):

```java
    private static final List<String> OPEN_STATUSES =
            List.of(ExperimentEntity.STATUS_PROPOSED, ExperimentEntity.STATUS_ACTIVE);

    /**
     * The tap IS the acceptance (spec §4): the row is created {@code active} starting today, not
     * routed through {@code proposed}. Idempotent per metric — an open experiment on the same
     * metric is returned as-is rather than duplicated.
     */
    @Transactional
    public ExperimentResponse startExperiment(UUID userId, UUID diagnosisId, int rank) {
        DiagnosisEntity diagnosis = diagnosisRepository
                .findByIdAndCreatedByAndDeletedFalse(diagnosisId, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        DiagnosisSuspectsEnvelope.Suspect suspect = diagnosis.getSuspects().suspects().stream()
                .filter(s -> s.rank() == rank).findFirst()
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));

        return experimentRepository
                .findFirstByCreatedByAndMetricKeyAndStatusInAndDeletedFalse(
                        userId, suspect.metricKey(), OPEN_STATUSES)
                .map(mapper::toExperimentResponse)
                .orElseGet(() -> {
                    ExperimentEntity experiment = new ExperimentEntity();
                    experiment.setCreatedBy(userId);
                    experiment.setTitle(suspect.title());
                    experiment.setHypothesis(suspect.probeText());
                    experiment.setStatus(ExperimentEntity.STATUS_ACTIVE);
                    experiment.setMetricKey(suspect.metricKey());
                    experiment.setExpectedDirection(suspect.expectedDirection());
                    experiment.setStartDate(LocalDate.now());
                    experiment.setTotalDays(suspect.totalDays());
                    experiment.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
                    experiment.setSource(ExperimentEntity.SOURCE_DIAGNOSIS);
                    experiment.setSourceDiagnosisId(diagnosis.getId());
                    return mapper.toExperimentResponse(experimentRepository.saveAndFlush(experiment));
                });
    }
```

Add the derived finder to `ExperimentRepository`:

```java
    Optional<ExperimentEntity> findFirstByCreatedByAndMetricKeyAndStatusInAndDeletedFalse(
            UUID createdBy, String metricKey, List<String> statuses);
```

Add to `DiagnosisController`:

```java
    @Override
    public ExperimentResponse startDiagnosisExperiment(UUID id, Integer rank) {
        return diagnosisService.startExperiment(currentUserId.get(), id, rank);
    }
```

- [ ] **Step 7: Feed prior experiments back into the gather — the loop closes**

In `FatigueEvidenceCollector`, inject `ExperimentRepository experimentRepository` and append to
`render(...)`, after the numbered candidate list:

```java
        List<ExperimentEntity> prior = experimentRepository
                .findByCreatedByAndSourceAndDeletedFalseOrderByGeneratedAtDesc(
                        userId, ExperimentEntity.SOURCE_DIAGNOSIS);
        if (!prior.isEmpty()) {
            payload.append("\nKORÁBBI KÍSÉRLETEK (amit már kipróbált — ne javasold újra ugyanazt):\n");
            for (ExperimentEntity experiment : prior.stream().limit(5).toList()) {
                payload.append("- ").append(experiment.getTitle())
                        .append(" [").append(experiment.getStatus()).append("]");
                if (experiment.getOutcome() != null) {
                    payload.append(" — ").append(experiment.getOutcome());
                }
                payload.append('\n');
            }
        }
```

`render` needs the `userId` parameter threaded through from `gather` for this. The prior-experiment
block is **payload only** — it deliberately produces no candidates, because it is context for the
model, not evidence a suspect may cite.

Add the derived finder to `ExperimentRepository`:

```java
    List<ExperimentEntity> findByCreatedByAndSourceAndDeletedFalseOrderByGeneratedAtDesc(
            UUID createdBy, String source);
```

- [ ] **Step 8: Run the full backend slice**

Run: `./mvnw test -Dtest='LogFreshnessProbeIT,FatigueEvidenceCollectorIT,DiagnosisGeneratorIT,DiagnosisControllerIT,DiagnosisExperimentIT,WeeklyReviewControllerIT,WeeklyReviewGeneratorIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS. `ArchitectureTest` is in the list on purpose — it enforces the layer subpackages
and the cycle-freedom rule, and it is the gate most often missed by focused runs.

- [ ] **Step 9: Regenerate the codemap and update the feature doc**

Run: `node scripts/generate-codemap.mjs` (or whatever `docs/CODEMAP.md`'s header names as its
generator — read the header first).
Then add the diagnosis section to `docs/features/proactive.md` and the MetricKey-as-suspect-catalog
note to `docs/features/companion.md`, per spec §8.
Run: `node scripts/lint-docs.mjs` — the diagnosis sections must not add findings.

- [ ] **Step 10: Commit**

```bash
git add api backend docs
git commit -m "feat(proactive): diagnosis probe becomes a tracked experiment (mezo-hqfi.3)"
```

---

## Done criteria

- `POST /api/proactive/diagnosis` produces a persisted, evidence-bound diagnosis or an honest
  409/429 — never an empty or invented report.
- A suspect's probe becomes an `active` experiment on one call, idempotent per metric.
- A second generation sees what was already tried.
- `mezo-hqfi.1` landed as a behaviour-preserving refactor with the weekly review still green.
- Focused tests + `ArchitectureTest` green locally; the full suite is CI's gate via the self-PR.

## Not in this plan

- `mezo-hqfi.4` — the frontend (list + detail pages). Its own plan, written once the client is
  generated from this contract.
- `mezo-hszs` — `OwnedEntity.updatedAt`, without which no stale probe can see an EDITED log.
- Cost-based quota over `llmlog`; a second phenomenon; the chat anchor (`mezo-dz3y` is a
  different feature entirely).
