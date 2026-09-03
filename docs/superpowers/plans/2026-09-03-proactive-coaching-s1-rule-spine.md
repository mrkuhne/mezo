# Proactive Coaching S1 — Rule Spine Refactor + New MetricKeys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the monolithic `FlagEvaluator` into one-class-per-rule `FlagRule` implementations (behavior-identical), and add the three metric extractors round-1 rules need: `SHOULDER_STRAIN`, `WEIGHT_TREND_PCT_WK`, `COMBINED_LOAD_MIN`.

**Architecture:** Slice S1 of `docs/superpowers/specs/2026-09-03-proactive-coaching-round1-design.md` §3/§9. Pure refactor + additive metrics; NO new flags, cards, or endpoints in this slice. `FlagEvaluator` keeps its public API (`evaluate(UUID): List<FlagRaise>`) so `FlagService`, the listener, and the sweep job are untouched.

**Tech Stack:** Spring Boot backend (`backend/`), JUnit ITs extending `AbstractIntegrationTest` with populators, Maven wrapper `./mvnw`.

## Global Constraints

- **MetricKey is APPEND-ONLY.** `FatigueEvidenceCollector` persists evidence keyed by enum order — new entries go at the END of the enum, never in the middle (spec §2 traps).
- Every threshold/number lives in config, never code (`FlagProperties` precedent). S1 adds no thresholds.
- All data reads in rules go through `MetricSeriesService.series(userId, key, from, to)`.
- MetricSeriesService rule: missing days stay missing. Documented exceptions where absence IS information: `HABITS_DONE`, and (new, this plan) `COMBINED_LOAD_MIN`.
- Focused tests locally; the full suite runs on CI via the self-PR (house rule). Local full-suite needs `-Dmezo.test.use-testcontainers=true` — don't run it here.
- Run all commands from the repo root of the executing worktree; never `cd` to the primary repo.
- Commit messages: conventional subject + driving bd id + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer.
- After moving/creating files: `node scripts/gen-codemap.mjs` and commit `docs/CODEMAP.md` in the same change (CI freshness gate).

---

### Task 0: bd issue + branch

**Files:** none (process).

- [ ] **Step 1: Claim the driving bd issue**

The issue already exists: **`mezo-d58h.1`** (child of epic `mezo-d58h`). `<BD-ID>` in every commit below means `mezo-d58h.1`.

```bash
bd update mezo-d58h.1 --claim
```

- [ ] **Step 2: Create the feature branch**

```bash
git checkout -b feat/proactive-coaching-s1
```

---

### Task 1: `FlagRule` interface + extract `SustainedStressRule`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagRule.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/SustainedStressRule.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagEvaluator.java`
- Test (existing, regression gate): `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagEvaluatorStressSleepIT.java`

**Interfaces:**
- Produces: `interface FlagRule { Optional<FlagRaise> evaluate(UUID userId, LocalDate today); }` — Task 2 implements four more of these. Rule classes live in the new `service/rule/` subpackage (still inside the `flags` feature slice, so ArchUnit layer rules are satisfied).

This is a behavior-preserving refactor: the safety net is the existing IT suite, run before and after.

- [ ] **Step 1: Run the existing flag ITs — must be green before touching anything**

```bash
cd backend && ./mvnw test -Dtest='FlagEvaluator*IT,FlagServiceIT,FlagEvaluationListenerIT' -q
```

Expected: all pass. If not, STOP — the baseline is broken; investigate before refactoring.

- [ ] **Step 2: Create the `FlagRule` interface**

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/**
 * One deterministic composite-flag rule (spec 2026-09-03 §3.1): pure arithmetic over
 * MetricSeriesService series, every threshold from FlagProperties, no writes. Implementations are
 * one-class-per-rule so each rule carries its own reads and stays reviewable in isolation;
 * FlagEvaluator orchestrates them and owns the all_healthy special case.
 */
public interface FlagRule {

    /** The rule's verdict for {@code userId} on {@code today}, cooldowns NOT applied. */
    Optional<FlagRaise> evaluate(UUID userId, LocalDate today);
}
```

- [ ] **Step 3: Extract `SustainedStressRule`**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/SustainedStressRule.java`. The body of `evaluate` is the current `FlagEvaluator.sustainedStress` method ([FlagEvaluator.java:69-93](../../backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagEvaluator.java)) moved VERBATIM (only the method renamed to `evaluate` and `private` dropped):

```java
package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** 7+ stress on minDays of the last windowDays check-in days (spec §9.1 sustained_stress). */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class SustainedStressRule implements FlagRule {

    private final MetricSeriesService metricSeriesService;
    private final FlagProperties properties;

    @Override
    public Optional<FlagRaise> evaluate(UUID userId, LocalDate today) {
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
            return Optional.empty();
        }
        return Optional.of(new FlagRaise(FlagKey.SUSTAINED_STRESS,
            FlagPayloadEnvelope.sustainedStress(new FlagPayloadEnvelope.SustainedStress(
                cfg.threshold(), cfg.windowDays(), cfg.minDays(), over, byDay))));
    }
}
```

- [ ] **Step 4: Wire it into `FlagEvaluator`**

In `FlagEvaluator`: add field `private final SustainedStressRule sustainedStressRule;` (constructor injection via existing `@RequiredArgsConstructor`), delete the private `sustainedStress` method, and in `evaluate` replace `sustainedStress(userId, today).ifPresent(raises::add);` with `sustainedStressRule.evaluate(userId, today).ifPresent(raises::add);`. Remove now-unused imports.

- [ ] **Step 5: Re-run the same ITs — must stay green**

```bash
cd backend && ./mvnw test -Dtest='FlagEvaluator*IT,FlagServiceIT,FlagEvaluationListenerIT' -q
```

Expected: all pass, unchanged.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/
git commit -m "refactor(companion): FlagRule interface + SustainedStressRule extraction (<BD-ID>)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Extract the remaining four rules

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/SleepDebtRule.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/MomentumAtRiskRule.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/RecoveryNeededRule.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/AllHealthyRule.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagEvaluator.java`

**Interfaces:**
- Consumes: `FlagRule` from Task 1.
- Produces: `FlagEvaluator` shrunk to an orchestrator (~40 lines); later slices (S2/S6) add new rules as further `service/rule/` classes wired the same way.

Same move-verbatim recipe as Task 1, one rule per class, each `@Component @RequiredArgsConstructor @ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")` implementing `FlagRule`:

| New class | Source method (FlagEvaluator.java) | Dependencies to inject | Private helpers that move WITH it |
|---|---|---|---|
| `SleepDebtRule` | `sleepDebt` (:95-130) | `MetricSeriesService`, `SleepGoalRepository`, `FlagProperties` | — |
| `MomentumAtRiskRule` | `momentumAtRisk` (:138-165) | `MetricSeriesService`, `FlagProperties`, `GymScheduleSlotRepository`, `WorkoutSessionRepository` | `dailyAverage` (:168-176), `missedPlannedGymDays` (:179-197) |
| `RecoveryNeededRule` | `recoveryNeeded` (:203-226) | `MetricSeriesService`, `FlagProperties` | `newestMatch` (:229-235) |
| `AllHealthyRule` | `allHealthy` (:242-259) | `MetricSeriesService`, `FlagProperties`, `CompanionFlagLogRepository` | — |

Every javadoc comment moves with its method (they carry load-bearing domain facts, e.g. the wake-morning semantics).

- [ ] **Step 1: Create the four rule classes** (move method bodies + listed helpers verbatim; method renamed to `evaluate`, signature `public Optional<FlagRaise> evaluate(UUID userId, LocalDate today)`)

- [ ] **Step 2: Shrink `FlagEvaluator` to the orchestrator**

```java
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FlagEvaluator {

    private final SustainedStressRule sustainedStressRule;
    private final SleepDebtRule sleepDebtRule;
    private final MomentumAtRiskRule momentumAtRiskRule;
    private final RecoveryNeededRule recoveryNeededRule;
    private final AllHealthyRule allHealthyRule;

    /** Every flag that is TRUE for {@code userId} right now, cooldowns NOT yet applied. */
    @Transactional(readOnly = true)
    public List<FlagRaise> evaluate(UUID userId) {
        LocalDate today = LocalDate.now();
        List<FlagRaise> raises = new ArrayList<>();
        sustainedStressRule.evaluate(userId, today).ifPresent(raises::add);
        sleepDebtRule.evaluate(userId, today).ifPresent(raises::add);
        momentumAtRiskRule.evaluate(userId, today).ifPresent(raises::add);
        recoveryNeededRule.evaluate(userId, today).ifPresent(raises::add);
        if (raises.isEmpty()) {
            allHealthyRule.evaluate(userId, today).ifPresent(raises::add);
        }
        return raises;
    }
}
```

Keep the class-level javadoc (updated to say rules live in `service/rule/`); the `@Transactional(readOnly = true)` stays HERE, not on the rules. The explicit ordered calls (not an injected `List<FlagRule>`) are deliberate: all_healthy's raises-is-empty gate is an ordering contract, and implicit bean-order would hide it.

- [ ] **Step 3: Run the flag ITs — green**

```bash
cd backend && ./mvnw test -Dtest='FlagEvaluator*IT,FlagServiceIT,FlagEvaluationListenerIT,FlagSweepJobSwitchOffIT,CompanionFlagLogPersistenceIT,FlagPropertiesIT' -q
```

Expected: all pass, unchanged.

- [ ] **Step 4: Regenerate CODEMAP (new files) and commit**

```bash
node scripts/gen-codemap.mjs
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/ docs/CODEMAP.md
git commit -m "refactor(companion): one-class-per-rule flag spine, FlagEvaluator as orchestrator (<BD-ID>)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `SHOULDER_STRAIN` metric

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricKey.java` (append at END)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricSeriesService.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/MetricSeriesCoachingIT.java`
- Possibly modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java`

**Interfaces:**
- Produces: `MetricKey.SHOULDER_STRAIN` — per-day MAX of `sport_session.shoulder_strain` (1–10, nullable). S6's `joint_overuse` rule reads it. Max, not mean: two sessions of strain 3 and 8 are a strain-8 day (peak semantics, mirroring `GYM_JOINT_PAIN`'s `peak=true`).

- [ ] **Step 1: Write the failing test**

New IT class (idiom copied from `MetricSeriesDerivedIT`):

```java
package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * S1 coaching-metric extractors (spec 2026-09-03 §3.1): SHOULDER_STRAIN napi csúcs,
 * WEIGHT_TREND_PCT_WK 7 napos regressziós lejtő %/hét, COMBINED_LOAD_MIN naptári terhelés-sor.
 */
@Transactional
@ActiveProfiles("companion-fake")
class MetricSeriesCoachingIT extends AbstractIntegrationTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 6, 15);

    @Autowired private MetricSeriesService metricSeriesService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;

    @Test
    void testSeries_shouldReturnDayPeak_whenShoulderStrainRequested() {
        UUID owner = userPopulator.createUser().getId();
        trainPopulator.createSportSessionWithShoulderStrain(owner, MONDAY, 120, 3);
        trainPopulator.createSportSessionWithShoulderStrain(owner, MONDAY, 60, 8);
        trainPopulator.createSportSessionWithShoulderStrain(owner, MONDAY.plusDays(1), 90, null);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.SHOULDER_STRAIN, MONDAY, MONDAY.plusDays(2));

        assertThat(series.get(MONDAY)).isEqualTo(8.0); // peak, not mean
        assertThat(series).doesNotContainKey(MONDAY.plusDays(1)); // null strain ⇒ no datapoint
        assertThat(series).doesNotContainKey(MONDAY.plusDays(2)); // no session ⇒ missing stays missing
    }
}
```

If `TrainPopulator` has no sport-session overload accepting `shoulderStrain`, add one alongside the existing `createSportSession(owner, date, durationMin)` (same entity build, plus `.shoulderStrain(strain)` — check the existing builder/setter style in `TrainPopulator` and mirror it).

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='MetricSeriesCoachingIT' -q
```

Expected: compile error on `MetricKey.SHOULDER_STRAIN` (or test failure if populator added first).

- [ ] **Step 3: Implement**

`MetricKey.java` — append at the very END of the enum list (before the `;`):

```java
    SHOULDER_STRAIN("váll-terhelés", "Sport-napló (shoulder strain csúcs)", MetricDomain.TRAIN),
```

`MetricSeriesService.java` — add the switch case (after `BEDTIME_VARIABILITY`):

```java
            case SHOULDER_STRAIN -> shoulderStrain(userId, from, to);
```

and the extractor (next to `sportLoad`, same repository call):

```java
    /** A nap sport-session shoulder_strain CSÚCSA (1–10; null-os session nem adatpont). */
    private Map<LocalDate, Double> shoulderStrain(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> series = new HashMap<>();
        sportSessionRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from)
                .forEach(s -> {
                    if (!s.getDate().isAfter(to) && s.getShoulderStrain() != null) {
                        series.merge(s.getDate(), s.getShoulderStrain().doubleValue(), Math::max);
                    }
                });
        return series;
    }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && ./mvnw test -Dtest='MetricSeriesCoachingIT' -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ backend/src/test/java/io/mrkuhne/mezo/feature/companion/MetricSeriesCoachingIT.java backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java
git commit -m "feat(companion): SHOULDER_STRAIN metric — per-day sport strain peak (<BD-ID>)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `WEIGHT_TREND_PCT_WK` metric

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricKey.java` (append at END)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricSeriesService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/MetricSeriesCoachingIT.java`

**Interfaces:**
- Produces: `MetricKey.WEIGHT_TREND_PCT_WK` — for each day: least-squares slope over the trailing 7 days' weigh-ins (latest weigh-in per day, same dedup as `weightDelta`), expressed as %/week of the window's mean weight. Honest gate: <4 weigh-ins in the trailing window ⇒ no datapoint. S6's `rapid_weight_loss` rule reads it (threshold `< -0.7`).

- [ ] **Step 1: Write the failing test** (add to `MetricSeriesCoachingIT`)

```java
    @Test
    void testSeries_shouldReturnRegressionSlopePctPerWeek_whenWeightTrendRequested() {
        UUID owner = userPopulator.createUser().getId();
        // Perfectly linear fall: 84.0, 83.8, ... -0.2 kg/day over 7 days ⇒ -1.4 kg/week.
        // Mean of the window = 83.4 kg ⇒ -1.4/83.4*100 = -1.679 %/week.
        for (int i = 0; i < 7; i++) {
            weightLogPopulator.createWeightLog(owner, MONDAY.plusDays(i),
                    BigDecimal.valueOf(84.0 - 0.2 * i));
        }

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.WEIGHT_TREND_PCT_WK, MONDAY.plusDays(6), MONDAY.plusDays(6));

        assertThat(series.get(MONDAY.plusDays(6))).isCloseTo(-1.679, within(0.01));
    }

    @Test
    void testSeries_shouldStaySilent_whenFewerThanFourWeighIns() {
        UUID owner = userPopulator.createUser().getId();
        weightLogPopulator.createWeightLog(owner, MONDAY, BigDecimal.valueOf(84.0));
        weightLogPopulator.createWeightLog(owner, MONDAY.plusDays(3), BigDecimal.valueOf(83.0));
        weightLogPopulator.createWeightLog(owner, MONDAY.plusDays(6), BigDecimal.valueOf(82.0));

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.WEIGHT_TREND_PCT_WK, MONDAY.plusDays(6), MONDAY.plusDays(6));

        assertThat(series).isEmpty(); // 3 weigh-ins < 4 ⇒ unknown, not zero
    }
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='MetricSeriesCoachingIT' -q
```

Expected: compile error on `WEIGHT_TREND_PCT_WK`.

- [ ] **Step 3: Implement**

`MetricKey.java` — append at END:

```java
    WEIGHT_TREND_PCT_WK("súlytrend %/hét", "származtatott: 7 napos súly-regresszió", MetricDomain.BODY),
```

`MetricSeriesService.java` — switch case:

```java
            case WEIGHT_TREND_PCT_WK -> weightTrendPctWk(userId, from, to);
```

Extractor (next to `weightDelta`; same dedup — date asc then createdAt, last put wins; internal window extension like `acwr`):

```java
    /**
     * 7 napos gördülő legkisebb-négyzetes súly-lejtő %/hét-ben (a lejtő kg/nap × 7 / ablakátlag
     * × 100). Honest gate: <4 mérés a gördülő ablakban ⇒ nincs adatpont. Belső ablak-kiterjesztés
     * (az ACWR mintája): a hívó [from,to]-ja változatlan.
     */
    private Map<LocalDate, Double> weightTrendPctWk(UUID userId, LocalDate from, LocalDate to) {
        TreeMap<LocalDate, Double> weights = new TreeMap<>();
        weightLogRepository.findAllOwned(userId).stream()
                .filter(log -> !log.getDate().isBefore(from.minusDays(6)) && !log.getDate().isAfter(to))
                .sorted(java.util.Comparator.comparing(WeightLogEntity::getDate)
                        .thenComparing(WeightLogEntity::getCreatedAt))
                .forEach(log -> weights.put(log.getDate(), log.getWeightKg().doubleValue()));

        Map<LocalDate, Double> series = new HashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            List<double[]> points = new ArrayList<>(); // {dayIndex 0..6, weightKg}
            for (int i = 6; i >= 0; i--) {
                Double kg = weights.get(day.minusDays(i));
                if (kg != null) {
                    points.add(new double[] {6 - i, kg});
                }
            }
            if (points.size() < 4) {
                continue;
            }
            double meanX = points.stream().mapToDouble(p -> p[0]).average().orElseThrow();
            double meanY = points.stream().mapToDouble(p -> p[1]).average().orElseThrow();
            double num = 0;
            double den = 0;
            for (double[] p : points) {
                num += (p[0] - meanX) * (p[1] - meanY);
                den += (p[0] - meanX) * (p[0] - meanX);
            }
            if (den == 0) {
                continue;
            }
            double slopeKgPerDay = num / den;
            series.put(day, slopeKgPerDay * 7 / meanY * 100);
        }
        return series;
    }
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd backend && ./mvnw test -Dtest='MetricSeriesCoachingIT' -q
```

Expected: PASS (both new tests + Task 3's).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ backend/src/test/java/io/mrkuhne/mezo/feature/companion/MetricSeriesCoachingIT.java
git commit -m "feat(companion): WEIGHT_TREND_PCT_WK metric — 7-day regression slope, min 4 weigh-ins (<BD-ID>)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `COMBINED_LOAD_MIN` metric

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricKey.java` (append at END)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricSeriesService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/MetricSeriesCoachingIT.java`

**Interfaces:**
- Produces: `MetricKey.COMBINED_LOAD_MIN` — the existing private `dailyLoad` array (sport minutes + gym volume minute-equivalent, [MetricSeriesService.java:411-422](../../backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MetricSeriesService.java)) exposed as a CALENDAR series: every day in [from,to] present, un-logged days 0.0 (second documented absence-is-information exception after `HABITS_DONE`). S6's `load_fuel_mismatch` rule reads 7-day averages of it.

- [ ] **Step 1: Write the failing test** (add to `MetricSeriesCoachingIT`)

```java
    @Test
    void testSeries_shouldReturnCalendarSeriesWithZeros_whenCombinedLoadRequested() {
        UUID owner = userPopulator.createUser().getId();
        trainPopulator.createSportSession(owner, MONDAY, 120);

        Map<LocalDate, Double> series = metricSeriesService.series(
                owner, MetricKey.COMBINED_LOAD_MIN, MONDAY, MONDAY.plusDays(2));

        assertThat(series).hasSize(3); // calendar series — every day exists
        assertThat(series.get(MONDAY)).isEqualTo(120.0);
        assertThat(series.get(MONDAY.plusDays(1))).isEqualTo(0.0); // no training IS information
    }
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='MetricSeriesCoachingIT' -q
```

Expected: compile error on `COMBINED_LOAD_MIN`.

- [ ] **Step 3: Implement**

`MetricKey.java` — append at END:

```java
    COMBINED_LOAD_MIN("kombinált terhelés", "származtatott: sport-perc + gym perc-ekvivalens", MetricDomain.TRAIN);
```

(The previous last entry's `;` becomes `,`.)

`MetricSeriesService.java` — switch case:

```java
            case COMBINED_LOAD_MIN -> combinedLoad(userId, from, to);
```

Extractor (right after `dailyLoad`, reusing it):

```java
    /**
     * A dailyLoad naptári sor sorozatként: minden nap létezik, a nem-logolt nap valódi 0 — a
     * HABITS_DONE utáni második dokumentált kivétel a "missing stays missing" szabály alól
     * (edzés-nemlét itt információ, a gördülő terhelés-ablakok ezt igénylik).
     */
    private Map<LocalDate, Double> combinedLoad(UUID userId, LocalDate from, LocalDate to) {
        double[] load = dailyLoad(userId, from, to);
        Map<LocalDate, Double> series = new HashMap<>();
        for (int i = 0; i < load.length; i++) {
            series.put(from.plusDays(i), load[i]);
        }
        return series;
    }
```

Also update the class-level javadoc of `MetricSeriesService` (and the `FlagEvaluator` class javadoc's "the one exception is HABITS_DONE" sentence — it moved to `FlagEvaluator`'s orchestrator javadoc in Task 2) to name both exceptions: `HABITS_DONE` and `COMBINED_LOAD_MIN`.

- [ ] **Step 4: Run the whole new IT class + the flag ITs once more**

```bash
cd backend && ./mvnw test -Dtest='MetricSeriesCoachingIT,MetricSeriesDerivedIT,MetricSeriesExpansionIT,MetricSeriesServiceIT,FlagEvaluator*IT' -q
```

Expected: PASS — the metric regression suite proves the switch stayed exhaustive-safe.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ backend/src/test/java/io/mrkuhne/mezo/feature/companion/MetricSeriesCoachingIT.java
git commit -m "feat(companion): COMBINED_LOAD_MIN metric — calendar combined-load series (<BD-ID>)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Docs, gates, ship

**Files:**
- Modify: `docs/CODEMAP.md` (regenerated)
- Modify: `docs/features/companion.md` (rule-class split + 3 new metric rows in the metric catalog table — find the table listing MetricKeys and append the three, mirroring existing row format)

- [ ] **Step 1: Regenerate CODEMAP + docs check**

```bash
node scripts/gen-codemap.mjs
node scripts/lint-docs.mjs
```

Expected: CODEMAP updated, docs lint clean.

- [ ] **Step 2: Update `docs/features/companion.md`** — §flag architecture (evaluator → orchestrator + `service/rule/` classes) and the metric catalog (append SHOULDER_STRAIN, WEIGHT_TREND_PCT_WK, COMBINED_LOAD_MIN rows). Follow the file's existing 10-section structure; no new sections.

- [ ] **Step 3: Focused verification sweep** (NOT the full suite — that's CI's job)

```bash
cd backend && ./mvnw test -Dtest='FlagEvaluator*IT,FlagServiceIT,FlagEvaluationListenerIT,FlagSweepJobSwitchOffIT,CompanionFlagLogPersistenceIT,FlagPropertiesIT,MetricSeries*IT' -q
```

Expected: all green. Note: focused runs skip ArchUnit — CI enforces layer/cycle rules; the refactor stays inside the `companion.flags` slice so no new cross-feature edges exist.

- [ ] **Step 4: Commit docs**

```bash
git add docs/
git commit -m "docs(companion): rule-spine split + coaching metrics in feature doc and CODEMAP (<BD-ID>)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Ship via the house flow** — invoke `superpowers:finishing-a-development-branch`: push `feat/proactive-coaching-s1`, open self-PR (CI = authoritative full suite + ArchUnit + contract-drift + CODEMAP gates), wait green, merge locally `--no-ff` after `git pull --rebase` on main, push, `bd close <BD-ID>`, `bd dolt push`.

PR body ends with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
