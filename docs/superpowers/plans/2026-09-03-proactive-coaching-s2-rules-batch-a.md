# Proactive Coaching S2 — Rules Batch A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the three "the app noticed you stopped" detections to the S1 flag spine — `logging_gap` (per-domain staleness with the stale-domain list), its sleep-debt-suspicion variant, and `missed_workouts` (≥2 consecutive planned gym days with nothing completed).

**Architecture:** Slice S2 of `docs/superpowers/specs/2026-09-03-proactive-coaching-round1-design.md` §4 rows 1 / 5 / 3, on the one-class-per-rule spine S1 built (`FlagRule` + `FlagEvaluator` orchestrator). Two new `FlagRule` classes, two new `FlagKey` constants, two new `FlagPayloadEnvelope` variants, a widened DB CHECK constraint, and one small extraction so the sleep-deficit math is shared instead of duplicated. **No card, endpoint, FE or prompt change** — S4 builds the card layer; a flag with no configured intervention is already a safe no-op (verified: `InterventionService.deliverForFlag` filters the config library and returns `Optional.empty()` with a log line when nothing matches).

**Tech Stack:** Spring Boot backend (`backend/`), Liquibase SQL changesets, JUnit ITs extending `AbstractIntegrationTest` with populators, Maven wrapper `./mvnw`.

**Explicitly deferred out of this slice (flagged, not dropped):** spec §4 row 3 also says the `missed_workouts` fact should reach "the morning companion prompt … (no more blind cheering)". That is prompt-assembly in `CompanionMessageJob`'s context block, not flag-spine work, and it needs the same fact plumbing S4's advice card builds. This slice raises the flag with a payload rich enough to feed that prompt (`missedDays`, `plannedDays`, `longestMissedRun`); wiring it INTO the morning prompt belongs to S4. If it should land here instead, that changes Task 4's scope — decide before Task 4 starts, not during it.

## Global Constraints

- **Every threshold/window/cooldown lives in config, never in rule code** (`FlagProperties` + `application.yml`). A number in a rule class is a defect.
- **A new `FlagKey` needs FOUR matching changes or it ships broken, and three of them fail only at RUNTIME:** (a) the constant in `FlagKey`; (b) a `cooldownHours` record field + a `case` arm in `FlagProperties.CooldownHours.forFlag` — the switch's `default` throws `SystemRuntimeErrorException`, so an unmapped key blows up `FlagService.evaluateAndLog` the first time the rule raises; (c) the `ck_companion_flag_log_flag_key` DB CHECK widened by a NEW migration, or the INSERT fails at the DB layer; and (d) **the `@Pattern` regex on `CompanionFlagLogEntity.flagKey`, which mirrors the same key list — Bean Validation rejects the row before it ever reaches the DB.** (d) was missed when this plan was first written and cost Task 3 a debugging detour; it is the least discoverable of the four because nothing references it by name.
- **Liquibase changesets are immutable.** Never edit an existing `script/*.sql`; add a new file and register it in `1.0.0_master.yml`. Naming: `YYYYMMDDHHMM_<bd-id>_<snake_description>.sql`; the highest existing timestamp is `202609030100`, so S2's must be greater.
- **`gym_schedule_slot.day_of_week` is 0=Monday..6=Sunday**, NOT `DayOfWeek.getValue()` (1=Monday). Convert with `day.getDayOfWeek().getValue() - 1`, exactly as `MomentumAtRiskRule` does.
- **`sleep_log.date` is the WAKE-UP MORNING**, not the evening the night began — the row dated today IS last night.
- **Only completed workout INSTANCES count as training.** Template rows have `templateSessionId == null` and a nullable `date`; always go through `WorkoutSessionRepository.findDoneInstanceDates` (`templateSessionId IS NOT NULL AND status = 'completed'`).
- **Unlogged days are never counted as compliant OR as violating** (spec §7). They route to `logging_gap`.
- **`MetricKey` is APPEND-ONLY** (`FatigueEvidenceCollector` ordering contract). S2 adds no `MetricKey`s — don't touch the enum.
- Day-bucketed reads go through `MetricSeriesService.series(userId, key, from, to)`. **`logging_gap` is the documented exception:** its thresholds are in HOURS and `MetricSeriesService` is a day-bucketed aggregate, so the staleness probe reads `loggedAt` / `savedAt` / `date` from the repositories directly. Both cross-feature edges it needs (companion→meal, companion→biometrics) already exist via `MetricSeriesService`, so no new slice edge and no ArchUnit cycle risk.
- Focused tests locally; the full suite + ArchUnit + contract-drift + CODEMAP freshness run on CI via the self-PR. **Local runs need `-Dmezo.test.use-testcontainers=true`** — the default fixed-DB mode fails spuriously on this machine.
- Run all commands from the repo root of the executing worktree; never `cd` to the primary repo.
- Commit messages: conventional subject + the driving bd id + a `Co-Authored-By:` trailer for the acting model.
- After creating/moving files: `node scripts/gen-codemap.mjs`, and commit `docs/CODEMAP.md` in the same change.

---

### Task 0: bd issue + branch

**Files:** none (process).

- [ ] **Step 1: Claim the driving bd issue**

The issue already exists: **`mezo-d58h.2`** (child of epic `mezo-d58h`). `<BD-ID>` in every commit below means `mezo-d58h.2`.

```bash
bd update mezo-d58h.2 --claim
```

- [ ] **Step 2: Create the feature branch**

```bash
git checkout -b feat/proactive-coaching-s2
```

---

### Task 1: Keys, config and the DB CHECK constraint

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagKey.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/config/FlagProperties.java`
- Modify: `backend/src/main/resources/application.yml` (the `mezo.companion.flags` block)
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609031200_mezo-d58h.2_flag_key_logging_gap_missed_workouts.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append a changeset)
- Test (existing, regression gate): `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagPropertiesIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/CompanionFlagLogPersistenceIT.java`

**Interfaces:**
- Produces: `FlagKey.LOGGING_GAP = "logging_gap"`, `FlagKey.MISSED_WORKOUTS = "missed_workouts"`; `FlagProperties.LoggingGap` and `FlagProperties.MissedWorkouts` config records reached via `properties.loggingGap()` / `properties.missedWorkouts()`; `CooldownHours.forFlag` answers for both new keys. Tasks 3 and 4 consume all of these.

This task ships no rule, so nothing raises the new keys yet — its deliverable is that the config binds, the switch answers, and the DB accepts a row with the new keys.

- [ ] **Step 1: Run the existing flag ITs — must be green before touching anything**

```bash
cd backend && ./mvnw test -Dtest='FlagEvaluator*IT,FlagServiceIT,FlagPropertiesIT,CompanionFlagLogPersistenceIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: all pass. If not, STOP — the baseline is broken; investigate before adding to it.

- [ ] **Step 2: Add the two `FlagKey` constants**

In `FlagKey.java`, after the `ALL_HEALTHY` line and before the blank line preceding `SOURCE_WRITE`:

```java
    public static final String LOGGING_GAP = "logging_gap";
    public static final String MISSED_WORKOUTS = "missed_workouts";
```

Also update the class javadoc's opening phrase — it says "The five composite state flags"; make it "The composite state flags (Phase 5 W5.1, bd mezo-b3pp.18, spec §9.1; `logging_gap` / `missed_workouts` added by the round-1 coaching spec 2026-09-03 §4)".

- [ ] **Step 3: Add the two config records to `FlagProperties`**

Add to the top-level record's component list, after `@NotNull @Valid AllHealthy allHealthy,` and before `@NotNull @Valid CooldownHours cooldownHours`:

```java
    @NotNull @Valid LoggingGap loggingGap,
    @NotNull @Valid MissedWorkouts missedWorkouts,
```

Add the two nested records after the `AllHealthy` record:

```java
    public record LoggingGap(
        /** Hours since the last meal row (its {@code logged_at}) at or above which meals count
         *  as stale. */
        @Min(6) @Max(336) int mealStaleHours,
        /** Hours since the last check-in row (its {@code saved_at}) at or above which check-ins
         *  count as stale. */
        @Min(6) @Max(336) int checkinStaleHours,
        /** Consecutive missing wake-mornings (sleep_log.date) at or above which sleep counts as
         *  stale. Mornings, not hours: sleep_log has no clock field, only the wake date. */
        @Min(1) @Max(14) int sleepStaleMornings,
        /** How many domains must be stale at once for the flag to raise. */
        @Min(1) @Max(3) int minStaleDomains,
        /** Sleep-debt suspicion (spec §4 row 5): when the window has too few logged nights for
         *  sleep_debt to speak, but the nights that ARE logged average at least this deficit,
         *  the payload carries the suspicion instead of staying silent. */
        @DecimalMin("0.25") @DecimalMax("6.0") double sleepSuspicionDeficitHours
    ) {
    }

    public record MissedWorkouts(
        /** How far back (days, ending TODAY) planned gym days are scanned. */
        @Min(2) @Max(60) int windowDays,
        /** Consecutive PLANNED gym days with no completed instance needed to raise. Consecutive
         *  in the sequence of planned days, not in calendar days. */
        @Min(2) @Max(14) int minConsecutiveMissed
    ) {
    }
```

- [ ] **Step 4: Add the cooldown fields and switch arms**

In `CooldownHours`, add two components after `@Min(1) @Max(8760) int allHealthy`:

```java
        @Min(1) @Max(8760) int loggingGap,
        @Min(1) @Max(8760) int missedWorkouts
```

(the preceding `allHealthy` line gains a trailing comma), and two `case` arms in `forFlag` before `default`:

```java
                case "logging_gap" -> loggingGap;
                case "missed_workouts" -> missedWorkouts;
```

- [ ] **Step 5: Add the yaml defaults**

In `application.yml`, inside `mezo.companion.flags`, after the `all-healthy:` block and before `cooldown-hours:`:

```yaml
      logging-gap:
        # Spec 2026-09-03 §4 row 1. The detector that must NOT go quiet when logging stops: the
        # 2026-08-27 collapse muted every value-based rule precisely because unlogged days are
        # skipped. Hours, not days: meal_.logged_at and check_in.saved_at are real instants, so
        # "36 hours without a meal row" is expressible exactly. Sleep is mornings — sleep_log
        # carries only the wake date, no clock.
        meal-stale-hours: 36
        checkin-stale-hours: 48
        sleep-stale-mornings: 2
        # One stale domain is already worth saying out loud; the payload lists which.
        min-stale-domains: 1
        # Spec §4 row 5: the logged nights average at least a 1h deficit ⇒ the card says
        # "gap + suspicion" instead of nothing.
        sleep-suspicion-deficit-hours: 1.0
      missed-workouts:
        # Spec 2026-09-03 §4 row 3. Two planned gym days in a row with nothing completed — the
        # morning prompt stops cheering blindly. Consecutive PLANNED days, so a Mon/Wed/Fri
        # schedule raises on Mon+Wed, not only on two adjacent calendar days.
        window-days: 14
        min-consecutive-missed: 2
```

and two entries at the end of `cooldown-hours:`:

```yaml
        # 48h per spec §4 row 1 — long enough that a gap card does not repeat daily.
        logging-gap: 48
        missed-workouts: 48
```

- [ ] **Step 6: Write the migration**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202609031200_mezo-d58h.2_flag_key_logging_gap_missed_workouts.sql`:

```sql
-- Proactive coaching round 1, slice S2 (mezo-d58h.2, spec 2026-09-03 §4 rows 1/3): the
-- companion_flag_log.flag_key CHECK mirrors the FlagKey constants exactly, so the two new
-- detections need it widened. Liquibase changesets are immutable — this replaces the constraint
-- created by 202608241200_mezo-b3pp.18_create_companion_flag_log.sql rather than editing it.
alter table companion_flag_log
    drop constraint ck_companion_flag_log_flag_key;

alter table companion_flag_log
    add constraint ck_companion_flag_log_flag_key check (flag_key in
        ('sustained_stress', 'sleep_debt', 'momentum_at_risk', 'recovery_needed', 'all_healthy',
         'logging_gap', 'missed_workouts'));
```

Append to `1.0.0_master.yml` (matching the existing block shape exactly — `relativeToChangelogFile: true`):

```yaml
  - changeSet:
      id: "1.0.0:202609031200_mezo-d58h.2_flag_key_logging_gap_missed_workouts"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609031200_mezo-d58h.2_flag_key_logging_gap_missed_workouts.sql
```

- [ ] **Step 7: Write the failing tests**

Append to `CompanionFlagLogPersistenceIT` (mirror the file's existing test style and its populator/repository fields — read it first):

```java
    @Test
    void testInsert_shouldAcceptTheNewKeys_whenLoggingGapOrMissedWorkoutsRaised() {
        UUID owner = userPopulator.createUser().getId();

        flagLogPopulator.rawInsert(owner, FlagKey.LOGGING_GAP, FlagKey.SOURCE_SWEEP);
        flagLogPopulator.rawInsert(owner, FlagKey.MISSED_WORKOUTS, FlagKey.SOURCE_WRITE);

        assertThat(flagLogRepository.findAll())
            .extracting(CompanionFlagLogEntity::getFlagKey)
            .contains(FlagKey.LOGGING_GAP, FlagKey.MISSED_WORKOUTS);
    }
```

Append to `FlagPropertiesIT` (again, mirror the file's existing style):

```java
    @Test
    void testForFlag_shouldAnswerForTheNewKeys_whenBatchARulesRaise() {
        assertThat(properties.cooldownHours().forFlag(FlagKey.LOGGING_GAP)).isEqualTo(48);
        assertThat(properties.cooldownHours().forFlag(FlagKey.MISSED_WORKOUTS)).isEqualTo(48);
    }

    @Test
    void testLoggingGapAndMissedWorkouts_shouldBindFromYaml_whenContextStarts() {
        assertThat(properties.loggingGap().mealStaleHours()).isEqualTo(36);
        assertThat(properties.loggingGap().checkinStaleHours()).isEqualTo(48);
        assertThat(properties.loggingGap().sleepStaleMornings()).isEqualTo(2);
        assertThat(properties.loggingGap().minStaleDomains()).isEqualTo(1);
        assertThat(properties.loggingGap().sleepSuspicionDeficitHours()).isEqualTo(1.0);
        assertThat(properties.missedWorkouts().windowDays()).isEqualTo(14);
        assertThat(properties.missedWorkouts().minConsecutiveMissed()).isEqualTo(2);
    }
```

- [ ] **Step 8: Run the tests**

```bash
cd backend && ./mvnw test -Dtest='FlagPropertiesIT,CompanionFlagLogPersistenceIT,FlagServiceIT,FlagEvaluator*IT' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS. If the persistence test fails with a CHECK-constraint violation, the migration did not run — verify the `1.0.0_master.yml` changeset registration and the filename match exactly.

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/ backend/src/main/resources/application.yml backend/src/main/resources/db/changelog/ backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/
git commit -m "feat(companion): logging_gap + missed_workouts flag keys, config and DB CHECK (<BD-ID>)

Co-Authored-By: <acting model> <noreply@anthropic.com>"
```

---

### Task 2: Extract the sleep-deficit calculation

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/SleepDeficitCalculator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/SleepDebtRule.java`
- Test (existing, regression gate): `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagEvaluatorStressSleepIT.java`

**Interfaces:**
- Produces: `SleepDeficitCalculator` with `Deficit over(UUID userId, LocalDate from, LocalDate to)` returning `record Deficit(double goalHours, int loggedNights, double deficitHours, Map<String, Double> byDay)`. Task 3's `LoggingGapRule` uses it for the sleep-suspicion variant; `SleepDebtRule` uses it for its own verdict. Sharing it is why this task exists — duplicating the goal-lookup + deficit loop in two rules would be the defect this avoids.

This is a behavior-preserving refactor: `FlagEvaluatorStressSleepIT`'s sleep-debt cases are the safety net, run before and after.

- [ ] **Step 1: Create the calculator**

```java
package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Cumulative sleep deficit vs the user's goal over a window of wake-mornings — shared by
 * {@code SleepDebtRule} (which turns it into a verdict) and {@code LoggingGapRule} (which turns
 * it into the spec §4 row 5 "gap + suspicion" variant). Extracted so the goal lookup and the
 * deficit loop exist once.
 *
 * <p>sleep_log.date is the WAKE-UP MORNING, not the evening the night began (confirmed by
 * HabitEvaluator's sleep_wake_window/bedtime_next_day metrics and by SleepLogSheet posting
 * date=today on wake) — so the row dated today IS last night. An unlogged morning is skipped,
 * never counted as a debt-free night.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class SleepDeficitCalculator {

    private final MetricSeriesService metricSeriesService;
    private final SleepGoalRepository sleepGoalRepository;
    private final FlagProperties properties;

    /** The observed deficit over the inclusive window of wake-mornings {@code [from, to]}. */
    public Deficit over(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> sleep =
            metricSeriesService.series(userId, MetricKey.SLEEP_DURATION_H, from, to);

        double goalHours = sleepGoalRepository.findByCreatedByAndDeletedFalse(userId)
            .map(SleepGoalEntity::getTargetMinutes)
            .map(minutes -> minutes / 60.0)
            .orElse(properties.sleepDebt().defaultGoalHours());

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
        return new Deficit(goalHours, logged, deficit, byDay);
    }

    /** Goal, how many nights were actually logged, the summed deficit, and the per-day hours. */
    public record Deficit(
        double goalHours, int loggedNights, double deficitHours, Map<String, Double> byDay) {

        /** Mean deficit per LOGGED night — the honest denominator when nights are missing. */
        public double deficitPerLoggedNight() {
            return loggedNights == 0 ? 0 : deficitHours / loggedNights;
        }
    }
}
```

- [ ] **Step 2: Rewrite `SleepDebtRule` over the calculator**

Replace the whole class body with:

```java
package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class SleepDebtRule implements FlagRule {

    private final SleepDeficitCalculator sleepDeficitCalculator;
    private final FlagProperties properties;

    @Override
    public Optional<FlagRaise> evaluate(UUID userId, LocalDate today) {
        FlagProperties.SleepDebt cfg = properties.sleepDebt();
        // The window ends TODAY: sleep_log.date is the wake morning, so today's row is last
        // night. See SleepDeficitCalculator for the full date-semantics note.
        LocalDate to = today;
        LocalDate from = to.minusDays(cfg.nights() - 1L);
        SleepDeficitCalculator.Deficit d = sleepDeficitCalculator.over(userId, from, to);

        if (d.loggedNights() < cfg.minNights() || d.deficitHours() < cfg.deficitHours()) {
            return Optional.empty();
        }
        return Optional.of(new FlagRaise(FlagKey.SLEEP_DEBT,
            FlagPayloadEnvelope.sleepDebt(new FlagPayloadEnvelope.SleepDebt(
                d.goalHours(), cfg.nights(), d.loggedNights(), cfg.deficitHours(),
                d.deficitHours(), d.byDay()))));
    }
}
```

- [ ] **Step 3: Run the regression ITs — must stay green, unchanged**

```bash
cd backend && ./mvnw test -Dtest='FlagEvaluator*IT,FlagServiceIT,FlagEvaluationListenerIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: all pass, identical to Task 1 Step 1's result. The sleep-debt cases in `FlagEvaluatorStressSleepIT` are the proof the extraction changed nothing.

- [ ] **Step 4: Regenerate CODEMAP and commit**

```bash
node scripts/gen-codemap.mjs
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/ docs/CODEMAP.md
git commit -m "refactor(companion): share the sleep-deficit calculation between flag rules (<BD-ID>)

Co-Authored-By: <acting model> <noreply@anthropic.com>"
```

---

### Task 3: `logging_gap` + the sleep-suspicion variant

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/LoggingGapRule.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/entity/FlagPayloadEnvelope.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagEvaluator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/repository/MealRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin/repository/CheckInRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/repository/SleepLogRepository.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagEvaluatorLoggingGapIT.java`

**Interfaces:**
- Consumes: `FlagKey.LOGGING_GAP`, `properties.loggingGap()` (Task 1); `SleepDeficitCalculator.over(...)` and its `Deficit` record incl. `deficitPerLoggedNight()` (Task 2).
- Produces: `FlagPayloadEnvelope.LoggingGap` + the `loggingGap(...)` factory; three new "latest row ever" repository finders.

**Design note the implementer must not re-litigate:** the thresholds are in HOURS and `MetricSeriesService.series` is a day-bucketed aggregate, so this rule reads the three repositories directly for recency — the one documented exception in this slice. It uses `meal_.logged_at` and `check_in.saved_at` (real instants: when the user actually logged, which is what an engagement gap means) and `sleep_log.date` (mornings — the table has no clock field). Sleep-domain staleness is the only day-granularity one, matching the spec's own "no sleep log for 2 mornings" wording.

- [ ] **Step 1: Add the three repository finders**

In `MealRepository`, alongside the existing `findFirstByCreatedByAndDeletedFalseAndMealDateBetweenOrderByCreatedAtDesc`:

```java
    /** The user's most recent meal row by when it was LOGGED (not by the day it belongs to). */
    Optional<MealEntity> findFirstByCreatedByAndDeletedFalseOrderByLoggedAtDesc(UUID createdBy);
```

In `CheckInRepository`:

```java
    /** The user's most recent check-in by when it was SAVED. */
    Optional<CheckInEntity> findFirstByCreatedByAndDeletedFalseOrderBySavedAtDesc(UUID createdBy);
```

In `SleepLogRepository`:

```java
    /** The user's most recent sleep log by wake morning. */
    Optional<SleepLogEntity> findFirstByCreatedByAndDeletedFalseOrderByDateDesc(UUID createdBy);
```

Add the `java.util.Optional` / `java.util.UUID` imports if a repository lacks them.

- [ ] **Step 2: Add the payload variant**

In `FlagPayloadEnvelope`, add a sixth component to the record (`LoggingGap loggingGap`) after `AllHealthy allHealthy`, the nested record after `AllHealthy`:

```java
    public record LoggingGap(
        List<String> staleDomains, Integer mealStaleHours, Integer mealHoursSince,
        Integer checkinStaleHours, Integer checkinHoursSince,
        Integer sleepStaleMornings, Integer sleepMorningsSince,
        Double sleepSuspicionDeficitHours, Double observedDeficitPerLoggedNight,
        Integer loggedNights) {
    }
```

the factory:

```java
    public static FlagPayloadEnvelope loggingGap(LoggingGap p) {
        return new FlagPayloadEnvelope(null, null, null, null, null, p);
    }
```

and a trailing `, null` in each of the five existing factories, so they stay 6-arg. Update the class javadoc's "one record, all-nullable fields" sentence to keep naming the current shape count if it names one.

- [ ] **Step 3: Write the failing tests**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagEvaluatorLoggingGapIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * S2 logging_gap (spec 2026-09-03 §4 row 1) plus its sleep-suspicion variant (row 5) — the
 * detector that must speak precisely WHEN the value-based rules go quiet.
 */
class FlagEvaluatorLoggingGapIT extends AbstractIntegrationTest {

    @Autowired private FlagEvaluator evaluator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    private List<String> keys(UUID owner) {
        return evaluator.evaluate(owner).stream().map(FlagRaise::flagKey).toList();
    }

    private Optional<FlagPayloadEnvelope.LoggingGap> gapPayload(UUID owner) {
        return evaluator.evaluate(owner).stream()
            .filter(r -> FlagKey.LOGGING_GAP.equals(r.flagKey()))
            .map(r -> r.payload().loggingGap())
            .findFirst();
    }

    @Test
    void logging_gap_raises_for_a_user_who_has_logged_nothing_at_all() {
        UUID owner = ownerId();

        assertThat(keys(owner)).contains(FlagKey.LOGGING_GAP);
        assertThat(gapPayload(owner)).isPresent();
        assertThat(gapPayload(owner).orElseThrow().staleDomains())
            .containsExactlyInAnyOrder("meal", "checkin", "sleep");
    }

    @Test
    void logging_gap_stays_quiet_when_every_domain_is_fresh() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 6, 3, null);
        sleepLogPopulator.createSleepLog(owner, today, BigDecimal.valueOf(8.0), 4);
        freshMeal(owner, today);

        assertThat(keys(owner)).doesNotContain(FlagKey.LOGGING_GAP);
    }

    @Test
    void logging_gap_names_only_the_stale_domain_when_the_others_are_fresh() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 6, 3, null);
        freshMeal(owner, today);
        // No sleep log at all ⇒ sleep is the only stale domain.

        assertThat(gapPayload(owner).orElseThrow().staleDomains()).containsExactly("sleep");
    }

    @Test
    void logging_gap_treats_a_sleep_log_from_two_mornings_ago_as_stale() {
        // sleep-stale-mornings=2 ⇒ the newest wake morning must be within [today-1, today].
        // A row dated today-2 is exactly one morning too old: this boundary is load-bearing.
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 6, 3, null);
        freshMeal(owner, today);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(2), BigDecimal.valueOf(8.0), 4);

        assertThat(gapPayload(owner).orElseThrow().staleDomains()).containsExactly("sleep");
    }

    @Test
    void logging_gap_accepts_a_sleep_log_from_yesterday_morning_as_fresh() {
        // The other side of the same boundary: today-1 is still inside the window.
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 6, 3, null);
        freshMeal(owner, today);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), BigDecimal.valueOf(8.0), 4);

        assertThat(keys(owner)).doesNotContain(FlagKey.LOGGING_GAP);
    }

    @Test
    void logging_gap_carries_the_sleep_suspicion_when_the_few_logged_nights_are_short() {
        // sleep_debt needs min-nights=2 logged nights inside its 3-night window; one 5.5h night
        // (2.5h under the 8h default goal) leaves it silent. The gap card must carry the
        // suspicion instead — spec §4 row 5's whole point.
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today, BigDecimal.valueOf(5.5), 3);

        FlagPayloadEnvelope.LoggingGap payload = gapPayload(owner).orElseThrow();
        assertThat(keys(owner)).doesNotContain(FlagKey.SLEEP_DEBT);
        assertThat(payload.observedDeficitPerLoggedNight()).isNotNull();
        assertThat(payload.observedDeficitPerLoggedNight()).isGreaterThanOrEqualTo(1.0);
        assertThat(payload.loggedNights()).isEqualTo(1);
    }

    @Test
    void logging_gap_omits_the_sleep_suspicion_when_the_logged_nights_are_fine() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today, BigDecimal.valueOf(8.5), 4);

        FlagPayloadEnvelope.LoggingGap payload = gapPayload(owner).orElseThrow();
        assertThat(payload.observedDeficitPerLoggedNight()).isNull();
    }

    /**
     * A meal row logged just now. Note the populator's DEFAULT loggedAt is the hardcoded
     * 2026-06-24T11:30Z (see {@code MealPopulator.newMeal}), which is ancient relative to the
     * test clock — so a fresh meal MUST go through the explicit-instant overload, or the meal
     * domain silently reads as stale and these fixtures stop meaning what they say.
     */
    private void freshMeal(UUID owner, LocalDate date) {
        PantryItemEntity item = pantryItemPopulator.createFoodWithNutrients(owner, "csirke");
        mealPopulator.createPantryMeal(owner, item, date, Instant.now());
    }
}
```

The helper needs these added to the class's fields and imports:

```java
    @Autowired private MealPopulator mealPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
```

```java
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.time.Instant;
```

Verify `PantryItemEntity`'s actual package from `PantryItemPopulator`'s own imports before writing the import line — the rest of the signature (`createPantryMeal(UUID, PantryItemEntity, LocalDate, Instant)`, `createFoodWithNutrients(UUID, String)`) is confirmed to exist as written.

- [ ] **Step 4: Run to verify the tests fail**

```bash
cd backend && ./mvnw test -Dtest='FlagEvaluatorLoggingGapIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: compile error on `FlagPayloadEnvelope.LoggingGap` / `FlagKey.LOGGING_GAP` usage in the payload accessor, or assertion failures once it compiles — the rule does not exist yet.

- [ ] **Step 5: Implement the rule**

```java
package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * The user stopped logging (spec 2026-09-03 §4 row 1) — ONE flag carrying the list of stale
 * domains, so the card can name them instead of scolding about targets. This is the rule that
 * exists because every value-based rule goes honestly quiet when the data stops: on 2026-08-27
 * logging collapsed and the detectors muted themselves precisely when something was wrong.
 *
 * <p>Recency, not day-buckets: the thresholds are in HOURS and {@code MetricSeriesService} is a
 * day-bucketed aggregate, so this rule reads {@code meal_.logged_at} and {@code check_in.saved_at}
 * (real instants — WHEN the user logged, which is what an engagement gap means) from the
 * repositories directly. Sleep is counted in wake-mornings: {@code sleep_log} carries only a
 * date, and "no sleep log for 2 mornings" is the spec's own wording.
 *
 * <p>Spec §4 row 5 rides along: when {@code sleep_debt} cannot speak because too few nights are
 * logged, but the logged ones average at least the configured deficit, the payload carries that
 * suspicion — "gap + suspicion" instead of silence.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class LoggingGapRule implements FlagRule {

    private static final String DOMAIN_MEAL = "meal";
    private static final String DOMAIN_CHECKIN = "checkin";
    private static final String DOMAIN_SLEEP = "sleep";

    private final MealRepository mealRepository;
    private final CheckInRepository checkInRepository;
    private final SleepLogRepository sleepLogRepository;
    private final SleepDeficitCalculator sleepDeficitCalculator;
    private final FlagProperties properties;

    @Override
    public Optional<FlagRaise> evaluate(UUID userId, LocalDate today) {
        FlagProperties.LoggingGap cfg = properties.loggingGap();
        Instant now = Instant.now();

        Integer mealHoursSince = mealRepository
            .findFirstByCreatedByAndDeletedFalseOrderByLoggedAtDesc(userId)
            .map(MealEntity::getLoggedAt)
            .map(loggedAt -> hoursBetween(loggedAt, now))
            .orElse(null);
        Integer checkinHoursSince = checkInRepository
            .findFirstByCreatedByAndDeletedFalseOrderBySavedAtDesc(userId)
            .map(CheckInEntity::getSavedAt)
            .map(savedAt -> hoursBetween(savedAt, now))
            .orElse(null);
        Integer sleepMorningsSince = sleepLogRepository
            .findFirstByCreatedByAndDeletedFalseOrderByDateDesc(userId)
            .map(SleepLogEntity::getDate)
            .map(date -> (int) ChronoUnit.DAYS.between(date, today))
            .orElse(null);

        List<String> stale = new ArrayList<>();
        // A domain with NO row at all is stale: never-logged is the most stale a domain gets.
        if (mealHoursSince == null || mealHoursSince >= cfg.mealStaleHours()) {
            stale.add(DOMAIN_MEAL);
        }
        if (checkinHoursSince == null || checkinHoursSince >= cfg.checkinStaleHours()) {
            stale.add(DOMAIN_CHECKIN);
        }
        if (sleepMorningsSince == null || sleepMorningsSince >= cfg.sleepStaleMornings()) {
            stale.add(DOMAIN_SLEEP);
        }
        if (stale.size() < cfg.minStaleDomains()) {
            return Optional.empty();
        }

        // Spec §4 row 5: the suspicion is attached only when sleep_debt itself stayed silent for
        // want of nights AND the nights that exist are short enough to matter.
        FlagProperties.SleepDebt sleepCfg = properties.sleepDebt();
        SleepDeficitCalculator.Deficit d = sleepDeficitCalculator.over(
            userId, today.minusDays(sleepCfg.nights() - 1L), today);
        boolean suspicious = d.loggedNights() > 0
            && d.loggedNights() < sleepCfg.minNights()
            && d.deficitPerLoggedNight() >= cfg.sleepSuspicionDeficitHours();

        return Optional.of(new FlagRaise(FlagKey.LOGGING_GAP,
            FlagPayloadEnvelope.loggingGap(new FlagPayloadEnvelope.LoggingGap(
                stale, cfg.mealStaleHours(), mealHoursSince,
                cfg.checkinStaleHours(), checkinHoursSince,
                cfg.sleepStaleMornings(), sleepMorningsSince,
                suspicious ? cfg.sleepSuspicionDeficitHours() : null,
                suspicious ? d.deficitPerLoggedNight() : null,
                suspicious ? d.loggedNights() : null))));
    }

    private static int hoursBetween(Instant from, Instant to) {
        return (int) Duration.between(from, to).toHours();
    }
}
```

- [ ] **Step 6: Wire it into `FlagEvaluator`**

Add the field `private final LoggingGapRule loggingGapRule;` after `recoveryNeededRule`, the import, and the call after `recoveryNeededRule.evaluate(...)` and before the `raises.isEmpty()` gate:

```java
        loggingGapRule.evaluate(userId, today).ifPresent(raises::add);
```

Order matters only for the `allHealthy` special case, which stays last.

- [ ] **Step 7: Run to verify the tests pass**

```bash
cd backend && ./mvnw test -Dtest='FlagEvaluatorLoggingGapIT,FlagEvaluator*IT,FlagServiceIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS, including the pre-existing flag ITs. **Watch for pre-existing ITs that now also raise `logging_gap`** — several fixtures create only check-ins or only sleep logs, so a `logging_gap` raise will legitimately appear alongside their expected flag. Any test asserting an EXACT flag list (rather than `contains` / `doesNotContain`) must be updated to accept it; note every such change in your report and do NOT weaken an assertion that was checking something else.

- [ ] **Step 8: Regenerate CODEMAP and commit**

```bash
node scripts/gen-codemap.mjs
git add backend/src/main/java/io/mrkuhne/mezo/feature/ backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/ docs/CODEMAP.md
git commit -m "feat(companion): logging_gap rule with stale-domain list and sleep-debt suspicion (<BD-ID>)

Co-Authored-By: <acting model> <noreply@anthropic.com>"
```

---

### Task 4: `missed_workouts`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/MissedWorkoutsRule.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/entity/FlagPayloadEnvelope.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagEvaluator.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagEvaluatorMissedWorkoutsIT.java`

**Interfaces:**
- Consumes: `FlagKey.MISSED_WORKOUTS`, `properties.missedWorkouts()` (Task 1); `FlagPayloadEnvelope`'s 6-component shape (Task 3 — this task makes it 7).
- Produces: `FlagPayloadEnvelope.MissedWorkouts` + the `missedWorkouts(...)` factory.

**Design note:** "≥2 consecutive planned gym days" means consecutive in the sequence of PLANNED days, not in calendar days — a Mon/Wed/Fri schedule raises on a missed Mon+Wed. `MomentumAtRiskRule.missedPlannedGymDays` is the closest prior art (same repositories, same 0=Monday conversion) but answers a different question (ANY missed day), so this rule needs its own run-scan. Do not change `MomentumAtRiskRule`.

- [ ] **Step 1: Add the payload variant**

In `FlagPayloadEnvelope`, add a seventh component (`MissedWorkouts missedWorkouts`) after `LoggingGap loggingGap`, the nested record:

```java
    public record MissedWorkouts(
        int windowDays, int minConsecutiveMissed, int longestMissedRun,
        List<String> missedDays, List<String> plannedDays) {
    }
```

the factory:

```java
    public static FlagPayloadEnvelope missedWorkouts(MissedWorkouts p) {
        return new FlagPayloadEnvelope(null, null, null, null, null, null, p);
    }
```

and a trailing `, null` in each of the six existing factories so they stay 7-arg.

- [ ] **Step 2: Write the failing tests**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagEvaluatorMissedWorkoutsIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * S2 missed_workouts (spec 2026-09-03 §4 row 3): two PLANNED gym days in a row with nothing
 * completed. Consecutive in the sequence of planned days, not in calendar days.
 */
class FlagEvaluatorMissedWorkoutsIT extends AbstractIntegrationTest {

    @Autowired private FlagEvaluator evaluator;
    @Autowired private FlagProperties properties;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    private List<String> keys(UUID owner) {
        return evaluator.evaluate(owner).stream().map(FlagRaise::flagKey).toList();
    }

    private Optional<FlagPayloadEnvelope.MissedWorkouts> payload(UUID owner) {
        return evaluator.evaluate(owner).stream()
            .filter(r -> FlagKey.MISSED_WORKOUTS.equals(r.flagKey()))
            .map(r -> r.payload().missedWorkouts())
            .findFirst();
    }

    /** A Mon/Wed/Fri gym schedule — 0=Monday, so 0/2/4. */
    private void monWedFriSchedule(UUID owner) {
        trainPopulator.createGymSlot(owner, 0, "07:00");
        trainPopulator.createGymSlot(owner, 2, "07:00");
        trainPopulator.createGymSlot(owner, 4, "07:00");
    }

    @Test
    void missed_workouts_raises_after_two_consecutive_planned_days_with_nothing_completed() {
        UUID owner = ownerId();
        monWedFriSchedule(owner);
        // No workout instances at all inside the window ⇒ every planned day is a miss, so the
        // longest run is well past min-consecutive-missed=2.

        assertThat(keys(owner)).contains(FlagKey.MISSED_WORKOUTS);
        assertThat(payload(owner).orElseThrow().longestMissedRun()).isGreaterThanOrEqualTo(2);
    }

    @Test
    void missed_workouts_stays_quiet_without_a_gym_schedule() {
        UUID owner = ownerId();
        // Nothing planned ⇒ nothing missed. An empty schedule must never raise.

        assertThat(keys(owner)).doesNotContain(FlagKey.MISSED_WORKOUTS);
    }

    @Test
    void missed_workouts_stays_quiet_when_every_planned_day_was_trained() {
        UUID owner = ownerId();
        monWedFriSchedule(owner);
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "A");
        LocalDate today = LocalDate.now();
        for (int i = 0; i < windowDays(); i++) {
            LocalDate day = today.minusDays(i);
            int dow = day.getDayOfWeek().getValue() - 1;
            if (dow == 0 || dow == 2 || dow == 4) {
                trainPopulator.createWorkoutInstance(owner, template, day, "completed");
            }
        }

        assertThat(keys(owner)).doesNotContain(FlagKey.MISSED_WORKOUTS);
    }

    @Test
    void missed_workouts_stays_quiet_when_a_completed_day_breaks_the_run() {
        // Single missed planned days on either side of a completed one never form a run of 2.
        // window-days=14 with a Mon/Wed/Fri schedule gives ~6 planned days; train every OTHER
        // planned day and the longest miss-run is 1.
        UUID owner = ownerId();
        monWedFriSchedule(owner);
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "A");
        LocalDate today = LocalDate.now();
        boolean train = true;
        for (int i = windowDays() - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            int dow = day.getDayOfWeek().getValue() - 1;
            if (dow != 0 && dow != 2 && dow != 4) {
                continue;
            }
            if (train) {
                trainPopulator.createWorkoutInstance(owner, template, day, "completed");
            }
            train = !train;
        }

        assertThat(payload(owner).map(FlagPayloadEnvelope.MissedWorkouts::longestMissedRun)
            .orElse(0)).isLessThan(2);
    }

    @Test
    void missed_workouts_does_not_count_a_started_but_unfinished_instance_as_trained() {
        // status='active' is not 'completed' — findDoneInstanceDates filters on the string, and
        // a half-finished session must not silence the flag.
        UUID owner = ownerId();
        monWedFriSchedule(owner);
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "A");
        LocalDate today = LocalDate.now();
        for (int i = 0; i < windowDays(); i++) {
            LocalDate day = today.minusDays(i);
            int dow = day.getDayOfWeek().getValue() - 1;
            if (dow == 0 || dow == 2 || dow == 4) {
                trainPopulator.createWorkoutInstance(owner, template, day, "active");
            }
        }

        assertThat(keys(owner)).contains(FlagKey.MISSED_WORKOUTS);
    }

    /** The configured window — read from config so the fixtures and the rule cannot drift. */
    private int windowDays() {
        return properties.missedWorkouts().windowDays();
    }
}
```

- [ ] **Step 3: Run to verify the tests fail**

```bash
cd backend && ./mvnw test -Dtest='FlagEvaluatorMissedWorkoutsIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: compile error on `FlagPayloadEnvelope.MissedWorkouts` accessor / no raise — the rule does not exist yet.

- [ ] **Step 4: Implement the rule**

```java
package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Consecutive PLANNED gym days with nothing completed (spec 2026-09-03 §4 row 3) — so the
 * morning prompt stops cheering blindly at someone who has not trained since Friday.
 *
 * <p>"Consecutive" is in the sequence of PLANNED days, not calendar days: a Mon/Wed/Fri
 * schedule raises on a missed Mon + Wed. Only completed INSTANCES count as training —
 * {@code findDoneInstanceDates} filters {@code templateSessionId IS NOT NULL AND
 * status = 'completed'}, which is what keeps nullable-dated template rows and half-finished
 * sessions out.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MissedWorkoutsRule implements FlagRule {

    private final GymScheduleSlotRepository gymScheduleSlotRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final FlagProperties properties;

    @Override
    public Optional<FlagRaise> evaluate(UUID userId, LocalDate today) {
        FlagProperties.MissedWorkouts cfg = properties.missedWorkouts();
        LocalDate from = today.minusDays(cfg.windowDays() - 1L);

        Set<Integer> plannedDows = gymScheduleSlotRepository
            .findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
            .map(GymScheduleSlotEntity::getDayOfWeek)
            .collect(Collectors.toSet());
        if (plannedDows.isEmpty()) {
            return Optional.empty();
        }
        Set<LocalDate> trained =
            Set.copyOf(workoutSessionRepository.findDoneInstanceDates(userId, from, today));

        List<String> plannedDays = new ArrayList<>();
        List<String> missedDays = new ArrayList<>();
        int run = 0;
        int longestRun = 0;
        for (LocalDate day = from; !day.isAfter(today); day = day.plusDays(1)) {
            // gym_schedule_slot.day_of_week is 0=Monday..6=Sunday (the entity's own comment)
            int dow = day.getDayOfWeek().getValue() - 1;
            if (!plannedDows.contains(dow)) {
                continue;
            }
            plannedDays.add(day.toString());
            if (trained.contains(day)) {
                run = 0;
                continue;
            }
            missedDays.add(day.toString());
            run++;
            longestRun = Math.max(longestRun, run);
        }
        if (longestRun < cfg.minConsecutiveMissed()) {
            return Optional.empty();
        }
        return Optional.of(new FlagRaise(FlagKey.MISSED_WORKOUTS,
            FlagPayloadEnvelope.missedWorkouts(new FlagPayloadEnvelope.MissedWorkouts(
                cfg.windowDays(), cfg.minConsecutiveMissed(), longestRun,
                missedDays, plannedDays))));
    }
}
```

- [ ] **Step 5: Wire it into `FlagEvaluator`**

Add the field `private final MissedWorkoutsRule missedWorkoutsRule;` after `loggingGapRule`, the import, and the call after `loggingGapRule.evaluate(...)`, still before the `raises.isEmpty()` gate:

```java
        missedWorkoutsRule.evaluate(userId, today).ifPresent(raises::add);
```

- [ ] **Step 6: Run to verify the tests pass**

```bash
cd backend && ./mvnw test -Dtest='FlagEvaluatorMissedWorkoutsIT,FlagEvaluator*IT,FlagServiceIT,FlagEvaluationListenerIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS. The same warning as Task 3 Step 7 applies — `FlagEvaluatorMomentumRecoveryIT`'s gym fixtures may now also raise `missed_workouts`; update only exact-list assertions, and report each one.

- [ ] **Step 7: Regenerate CODEMAP and commit**

```bash
node scripts/gen-codemap.mjs
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/ backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/ docs/CODEMAP.md
git commit -m "feat(companion): missed_workouts rule — consecutive planned gym days with nothing completed (<BD-ID>)

Co-Authored-By: <acting model> <noreply@anthropic.com>"
```

---

### Task 5: Docs, gates, ship

**Files:**
- Modify: `docs/CODEMAP.md` (regenerated)
- Modify: `docs/features/companion.md` — the flag section (two new rules + their config keys) and the `mezo.companion.flags.*` config-key table. The file's §3 currently says "the five flags"; that language is now wrong.
- Modify: `docs/features/proactive.md` — one line noting `logging_gap` / `missed_workouts` raise with no configured intervention until S4, and that this is a deliberate no-op.

- [ ] **Step 1: Regenerate CODEMAP + docs lint**

```bash
node scripts/gen-codemap.mjs
node scripts/lint-docs.mjs --errors-only
```

Expected: CODEMAP updated; lint clean. Note that the plain `node scripts/lint-docs.mjs` (without `--errors-only`) reports pre-existing staleness in ~16 unrelated docs — CI's gate is the `--errors-only` form (`.github/workflows/ci.yml`), so match CI. If a file YOU touched appears in the errors, fix it.

- [ ] **Step 2: Update `docs/features/companion.md`** — the flag architecture section (now seven flags; name the two new rule classes, their trigger logic, and the `SleepDeficitCalculator` extraction) and the config-key table (`logging-gap.*`, `missed-workouts.*`, the two new `cooldown-hours` entries). Follow the file's existing 10-section structure; no new sections. Record the `logging_gap` recency-read exception to the "reads go through MetricSeriesService" rule and WHY (hour thresholds vs. day buckets).

- [ ] **Step 3: Update `docs/features/proactive.md`** — one sentence in the intervention-library section: the two new flag keys have no library entry until S4, and `InterventionService.deliverForFlag` returns empty with a log line rather than failing.

- [ ] **Step 4: Focused verification sweep** (NOT the full suite — that's CI's job)

```bash
cd backend && ./mvnw test -Dtest='FlagEvaluator*IT,FlagServiceIT,FlagEvaluationListenerIT,FlagSweepJobSwitchOffIT,CompanionFlagLogPersistenceIT,FlagPropertiesIT,InterventionConfigIT,MetricSeries*IT' -q -Dmezo.test.use-testcontainers=true
```

Expected: all green. `InterventionConfigIT` is in the list deliberately: it asserts library coverage against a hardcoded list of the five original keys, so it should still pass — if it fails, it was iterating `FlagKey` reflectively after all and needs a decision, not a silent edit.

- [ ] **Step 5: Commit docs**

```bash
git add docs/
git commit -m "docs(companion): logging_gap + missed_workouts in the feature docs and CODEMAP (<BD-ID>)

Co-Authored-By: <acting model> <noreply@anthropic.com>"
```

- [ ] **Step 6: Ship via the house flow** — invoke `superpowers:finishing-a-development-branch`: push `feat/proactive-coaching-s2`, open a self-PR against `main` (CI = authoritative full suite + ArchUnit + contract-drift + CODEMAP gates), wait green, `git pull --rebase` on main, merge `--no-ff`, push, `bd close <BD-ID>`, `bd dolt push`.

**If the PR opens as CONFLICTING, GitHub runs ZERO checks** — merge `origin/main` into the branch first (resolving `.beads/issues.jsonl` by taking either side; the pre-commit hook re-exports the authoritative union from Dolt), regenerate CODEMAP on top of the merge, push, and CI starts.

PR body ends with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
