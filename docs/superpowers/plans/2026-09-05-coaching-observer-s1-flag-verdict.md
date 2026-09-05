# Coaching Observer S1 — FlagVerdict + Evaluation Trace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the coaching engine record what it decided about every rule — not only the ones that fired — so a later slice can render the decision process.

**Architecture:** `FlagRule.evaluate` stops returning `Optional<FlagRaise>` and returns a `FlagVerdict` (`RAISED` / `CLEAR` / `UNAVAILABLE`). `FlagEvaluator` returns all 13 verdicts instead of only the raises. `FlagService` — the one place that sees both a rule's verdict and the cooldown decision — writes a row to the new `companion_flag_trace` table, but **only when that rule's verdict changed** since its previous row.

**Tech Stack:** Java 21 / Spring Boot 4, Hibernate 7, Liquibase, JUnit 5 + AssertJ on `AbstractIntegrationTest`, Testcontainers.

**Driving issue:** `mezo-6269.1` · **Spec:** `docs/superpowers/specs/2026-09-05-coaching-observer-design.md` §4

## Global Constraints

- Backend test runs REQUIRE `-Dmezo.test.use-testcontainers=true`; the fixed-DB mode races and fakes failures.
- Use Maven's OWN exit code, never a pipeline's — `./mvnw … | tail` reports `tail`'s status. Write to a file and grep, or check `${PIPESTATUS[0]}`. **"Tests run: 0" is a FAILURE**, and a `-Dtest` glob matching nothing exits 0.
- Liquibase changesets are **immutable**: never edit a shipped script; add a new one and register it in `1.0.0_master.yml`. Index names must start with `idx_`; `node scripts/lint-liquibase.mjs` gates this.
- A new table MUST be added to `ResetDatabase`'s TRUNCATE list (documented growth rule).
- Regenerate `docs/CODEMAP.md` in the same change as any new file (`node scripts/gen-codemap.mjs`, then `--check` must exit 0). Focused ITs miss both this and ArchUnit.
- ArchUnit enforces the layer subpackages (`entity` / `repository` / `service` / `controller`) and feature boundaries — all new classes live under `feature.companion.flags`.
- **No behaviour change for the user in this slice.** The same flags raise, with the same cooldowns, producing the same cards. Only the recording is new.
- Conventional commit subjects carrying the bd id: `feat(companion): … (mezo-6269.1)`, plus the trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Work from the worktree root `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/padding-2px-all-pages-3479e4`. NEVER `cd` to `/Users/mrkuhne/Applications/Personal/Mezo/mezo` — main is checked out there.

## File Structure

**Create**
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagVerdict.java` — the verdict record + its factories and invariants.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagOutcome.java` — `RAISED | CLEAR | UNAVAILABLE`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/UnavailableReason.java` — one member per honesty gate that exists in the rules.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/TraceDisposition.java` — `LOGGED | SUPPRESSED_BY_COOLDOWN`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/entity/CompanionFlagTraceEntity.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/repository/CompanionFlagTraceRepository.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagTraceWriter.java` — owns the "changed?" comparison and the insert.
- `backend/src/main/resources/db/changelog/1.0.0/script/202609051200_mezo-6269.1_companion_flag_trace.sql`
- Tests: `FlagVerdictTest`, `CompanionFlagTracePersistenceIT`, `FlagServiceTraceIT`.

**Modify**
- `service/FlagRule.java` — the interface's return type.
- `service/FlagEvaluator.java` — returns `List<FlagVerdict>`.
- `service/FlagService.java` — filters `RAISED`, records disposition, calls the trace writer.
- All 13 rules under `service/rule/`.
- `1.0.0_master.yml`, `ResetDatabase`, `docs/features/companion.md`, `docs/CODEMAP.md`.
- Existing rule ITs under `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/`.

---

### Task 1: The verdict types

**Files:**
- Create: `.../flags/service/FlagOutcome.java`, `UnavailableReason.java`, `FlagVerdict.java`, `TraceDisposition.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagVerdictTest.java`

**Interfaces:**
- Produces: `FlagVerdict.raised(String flagKey, FlagPayloadEnvelope payload)`, `FlagVerdict.clear(String flagKey, FlagVerdict.ClearEvidence evidence)`, `FlagVerdict.unavailable(String flagKey, UnavailableReason reason)`; accessors `flagKey()`, `outcome()`, `payload()`, `reason()`, `clear()`. `ClearEvidence(String metric, Double observed, Double threshold, String detail)`.

- [ ] **Step 1: Write the failing test**

`FlagVerdictTest.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import org.junit.jupiter.api.Test;

/** The verdict is the rule's ONLY return type, so its invariants are what stop a half-filled
 *  verdict (raised with no payload, clear with a reason) from reaching the trace. */
class FlagVerdictTest {

    @Test
    void testRaised_shouldCarryPayloadOnly() {
        FlagPayloadEnvelope payload = FlagPayloadEnvelope.allHealthy(
            new FlagPayloadEnvelope.AllHealthy(7, 5));

        FlagVerdict v = FlagVerdict.raised(FlagKey.ALL_HEALTHY, payload);

        assertThat(v.outcome()).isEqualTo(FlagOutcome.RAISED);
        assertThat(v.flagKey()).isEqualTo(FlagKey.ALL_HEALTHY);
        assertThat(v.payload()).isSameAs(payload);
        assertThat(v.reason()).isNull();
        assertThat(v.clear()).isNull();
    }

    @Test
    void testClear_shouldCarryEvidenceOnly() {
        FlagVerdict v = FlagVerdict.clear(FlagKey.SLEEP_DEBT,
            new FlagVerdict.ClearEvidence("deficit_hours", 1.2, 6.0, null));

        assertThat(v.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(v.clear().metric()).isEqualTo("deficit_hours");
        assertThat(v.clear().observed()).isEqualTo(1.2);
        assertThat(v.clear().threshold()).isEqualTo(6.0);
        assertThat(v.payload()).isNull();
        assertThat(v.reason()).isNull();
    }

    @Test
    void testClear_shouldAllowNonNumericEvidence() {
        // Not every "checked and fine" is a number: rapid_weight_loss clears because the goal
        // trajectory IS a cut, joint_overuse because tomorrow trains a different muscle.
        FlagVerdict v = FlagVerdict.clear(FlagKey.RAPID_WEIGHT_LOSS,
            new FlagVerdict.ClearEvidence("trajectory", null, null, "cut"));

        assertThat(v.clear().detail()).isEqualTo("cut");
        assertThat(v.clear().observed()).isNull();
    }

    @Test
    void testUnavailable_shouldCarryReasonOnly() {
        FlagVerdict v = FlagVerdict.unavailable(
            FlagKey.RAPID_WEIGHT_LOSS, UnavailableReason.NO_ACTIVE_GOAL);

        assertThat(v.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(v.reason()).isEqualTo(UnavailableReason.NO_ACTIVE_GOAL);
        assertThat(v.payload()).isNull();
        assertThat(v.clear()).isNull();
    }

    @Test
    void testRaised_shouldRejectNullPayload() {
        assertThatThrownBy(() -> FlagVerdict.raised(FlagKey.SLEEP_DEBT, null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void testClear_shouldRejectNullEvidence() {
        assertThatThrownBy(() -> FlagVerdict.clear(FlagKey.SLEEP_DEBT, null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void testUnavailable_shouldRejectNullReason() {
        assertThatThrownBy(() -> FlagVerdict.unavailable(FlagKey.SLEEP_DEBT, null))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd backend && ./mvnw test -Dtest=FlagVerdictTest -Dmezo.test.use-testcontainers=true
```
Expected: compilation failure — `FlagVerdict` does not exist.

- [ ] **Step 3: Write the types**

`FlagOutcome.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

/**
 * What a rule concluded this evaluation (spec 2026-09-05 §4.1). {@code CLEAR} is the point of the
 * whole trace: the rule ran, read its inputs, and found them below its threshold — information
 * the engine used to compute and throw away.
 */
public enum FlagOutcome {
    /** The rule is true right now; {@code payload} carries the frozen inputs. */
    RAISED,
    /** The rule ran and is not true; {@code clear} carries the observed value and the threshold. */
    CLEAR,
    /** An honesty gate stopped the rule before it could judge; {@code reason} says which. */
    UNAVAILABLE
}
```

`UnavailableReason.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

/**
 * One member per honesty gate that already exists in the 13 rules — the reason a rule could not
 * judge, as opposed to judging and finding nothing wrong. Derived by reading every
 * {@code Optional.empty()} site in {@code service/rule/} on 2026-09-05; adding a gate without a
 * member is impossible, because the verdict is now a rule's only return type.
 */
public enum UnavailableReason {
    /** sleep_debt: fewer logged nights than {@code min-nights}. */
    NOT_ENOUGH_LOGGED_NIGHTS,
    /** load_fuel_mismatch: neither the kcal nor the sleep side reached {@code min-logged-days-per-side}. */
    NOT_ENOUGH_LOGGED_DAYS,
    /** acute_bad_day: fewer check-ins today than {@code min-check-ins} — one bad answer is a moment, not a day. */
    NOT_ENOUGH_CHECKINS,
    /** sustained_stress: no check-in stress value anywhere in the window. */
    NO_CHECKIN_DATA,
    /** all_healthy / recovery_needed: the window holds no observations at all. */
    NO_DATA_IN_WINDOW,
    /** momentum_at_risk: the baseline period is itself below {@code min-baseline} — nothing to fall from. */
    NO_HABIT_BASELINE,
    /** missed_workouts / momentum_at_risk: the user has no gym schedule slots. */
    NO_GYM_SCHEDULE,
    /** missed_workouts: the schedule is younger than the window, so no day in it could be a violation. */
    SCHEDULE_YOUNGER_THAN_WINDOW,
    /** rapid_weight_loss: the weight-trend extractor returned nothing for today. */
    NO_WEIGHT_TREND,
    /** rapid_weight_loss: no ACTIVE goal, so "trajectory ≠ cut" cannot be evaluated. */
    NO_ACTIVE_GOAL,
    /** joint_overuse: no shoulder-strain data points in the window — never average over an empty set. */
    NO_STRAIN_DATA,
    /** joint_overuse: no planned session for tomorrow to be shoulder-focused. */
    NO_PLANNED_SESSION,
    /** ignored_nudge / late_eating (bed arm): no sleep_goal row — the config default must not stand in. */
    NO_SLEEP_GOAL_ROW,
    /** ignored_nudge: the notification feature is off, so "was a nudge sent" is unknowable. */
    NOTIFICATIONS_OFF,
    /** ignored_nudge: a night in the run has no bedtime — neither compliant nor violating. */
    UNLOGGED_NIGHT,
    /** late_eating: no last-meal hour anywhere in the window. */
    NO_MEAL_DATA
}
```

`FlagVerdict.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;

/**
 * What one rule concluded for one user on one evaluation (spec 2026-09-05 §4.1) — the replacement
 * for {@code Optional<FlagRaise>}, whose empty case threw away the two most interesting answers:
 * "I checked and it is fine" and "I could not check".
 *
 * <p>Exactly one of {@code payload} / {@code clear} / {@code reason} is non-null, matching
 * {@code outcome}; the factories are the only way to build one.
 */
public record FlagVerdict(
    String flagKey,
    FlagOutcome outcome,
    FlagPayloadEnvelope payload,
    ClearEvidence clear,
    UnavailableReason reason) {

    /**
     * Why a rule is not firing, in the rule's own numbers. {@code observed}/{@code threshold} are
     * null for a non-numeric clear (a goal trajectory, a muscle group), where {@code detail}
     * carries the value instead.
     */
    public record ClearEvidence(String metric, Double observed, Double threshold, String detail) {
    }

    public static FlagVerdict raised(String flagKey, FlagPayloadEnvelope payload) {
        if (payload == null) {
            throw new IllegalArgumentException("RAISED verdict needs a payload: " + flagKey);
        }
        return new FlagVerdict(flagKey, FlagOutcome.RAISED, payload, null, null);
    }

    public static FlagVerdict clear(String flagKey, ClearEvidence evidence) {
        if (evidence == null) {
            throw new IllegalArgumentException("CLEAR verdict needs evidence: " + flagKey);
        }
        return new FlagVerdict(flagKey, FlagOutcome.CLEAR, null, evidence, null);
    }

    public static FlagVerdict unavailable(String flagKey, UnavailableReason reason) {
        if (reason == null) {
            throw new IllegalArgumentException("UNAVAILABLE verdict needs a reason: " + flagKey);
        }
        return new FlagVerdict(flagKey, FlagOutcome.UNAVAILABLE, null, null, reason);
    }

    /** The raise this verdict represents, or null when the rule did not fire. */
    public FlagRaise toRaise() {
        return outcome == FlagOutcome.RAISED ? new FlagRaise(flagKey, payload) : null;
    }
}
```

`TraceDisposition.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

/**
 * What {@code FlagService} did with a RAISED verdict (spec §4.2). Null for a verdict that never
 * reached the cooldown gate, because the rule did not fire.
 */
public enum TraceDisposition {
    /** Written to {@code companion_flag_log} and published as a raise. */
    LOGGED,
    /** True, but the same flag spoke inside its cooldown window — so it stayed quiet. */
    SUPPRESSED_BY_COOLDOWN
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
cd backend && ./mvnw test -Dtest=FlagVerdictTest -Dmezo.test.use-testcontainers=true
```
Expected: `Tests run: 7, Failures: 0`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/ \
        backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagVerdictTest.java
git commit -m "feat(companion): FlagVerdict — a rule can say 'checked, fine' and 'cannot check' (mezo-6269.1)"
```

---

### Task 2: Every rule returns a verdict

This is the largest task and it is **atomic by necessity**: the interface cannot change without all 13 implementations changing with it. Work rule by rule, in the order of the table below, and run that rule's own test class as you go.

**Files:**
- Modify: `service/FlagRule.java`, `service/FlagEvaluator.java`, `service/FlagService.java`, and all 13 files under `service/rule/`
- Modify (tests): the existing `FlagEvaluator*IT` classes under `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/`

**Interfaces:**
- Consumes: `FlagVerdict`, `FlagOutcome`, `UnavailableReason` from Task 1.
- Produces: `FlagRule.evaluate(UUID, LocalDate) → FlagVerdict`; `FlagEvaluator.evaluate(UUID) → List<FlagVerdict>` containing **exactly 13 entries, one per rule, in `AdvicePriority` order**.

- [ ] **Step 1: Change the interface**

`FlagRule.java` — replace the method and drop the `java.util.Optional` import:

```java
    /** The rule's verdict for {@code userId} on {@code today}, cooldowns NOT applied. */
    FlagVerdict evaluate(UUID userId, LocalDate today);
```

- [ ] **Step 2: Convert each rule using this table**

Every current `Optional.empty()` site, classified by reading the code on 2026-09-05. **Three sites are compound conditions that must be SPLIT** — they currently hide a data gate and a threshold miss behind one `if`, and collapsing them would report "checked and fine" for a rule that never had the data to check.

| Rule | Line | Current condition | Becomes | Evidence to carry |
|---|---|---|---|---|
| `SleepDebtRule` | 33 | `loggedNights < minNights \|\| deficitHours < deficitHours` | **SPLIT** → `UNAVAILABLE(NOT_ENOUGH_LOGGED_NIGHTS)` / `CLEAR` | clear: `("deficit_hours", d.deficitHours(), cfg.deficitHours(), null)` |
| `SustainedStressRule` | 48 | `over < cfg.minDays()` | **SPLIT** → `byDay.isEmpty()` ⇒ `UNAVAILABLE(NO_CHECKIN_DATA)`, else `CLEAR` | clear: `("stress_days_over", (double) over, (double) cfg.minDays(), null)` |
| `RecoveryNeededRule` | 47 | any of the three matches is null | `CLEAR` | clear: `("signals_matched", matched, 3.0, missing)` where `matched` counts non-null of the three and `missing` names them, e.g. `"rpe,stress"` |
| `AllHealthyRule` | 43 | `existsProblemRaiseSince` | `CLEAR` | clear: `("quiet_days", null, (double) cfg.quietDays(), "problem_raise_in_window")` |
| `AllHealthyRule` | 49 | `observed.isEmpty()` | `UNAVAILABLE(NO_DATA_IN_WINDOW)` | — |
| `AcuteBadDayRule` | 47 | `checkIns.size() < minCheckIns` | `UNAVAILABLE(NOT_ENOUGH_CHECKINS)` | — |
| `AcuteBadDayRule` | 60 | `qualifying.size() < minCheckIns` | `CLEAR` | clear: `("bad_checkins", (double) qualifying.size(), (double) cfg.minCheckIns(), null)` |
| `MomentumAtRiskRule` | 58 | `baselineAvg < minBaseline \|\| recentAvg > baselineAvg*(1-dropRatio)` | **SPLIT** → `UNAVAILABLE(NO_HABIT_BASELINE)` / `CLEAR` | clear: `("habits_recent_avg", recentAvg, baselineAvg * (1 - cfg.dropRatio()), null)` |
| `MomentumAtRiskRule` | 63 | `missedGymDays.isEmpty()` | `CLEAR` | clear: `("missed_gym_days", 0.0, 1.0, null)` |
| `MissedWorkoutsRule` | 62 | `slots.isEmpty()` | `UNAVAILABLE(NO_GYM_SCHEDULE)` | — |
| `MissedWorkoutsRule` | 77 | `from.isAfter(to)` | `UNAVAILABLE(SCHEDULE_YOUNGER_THAN_WINDOW)` | — |
| `MissedWorkoutsRule` | 103 | `longestRun < minConsecutiveMissed` | `CLEAR` | clear: `("longest_missed_run", (double) longestRun, (double) cfg.minConsecutiveMissed(), null)` |
| `LoggingGapRule` | 98 | `stale.size() < minStaleDomains` | `CLEAR` | clear: `("stale_domains", (double) stale.size(), (double) cfg.minStaleDomains(), String.join(",", stale))` |
| `RapidWeightLossRule` | 70 | `trend == null` | `UNAVAILABLE(NO_WEIGHT_TREND)` | — |
| `RapidWeightLossRule` | 73 | `trend >= pctPerWeekAtMost` | `CLEAR` | clear: `("weight_trend_pct_wk", trend, cfg.pctPerWeekAtMost(), null)` |
| `RapidWeightLossRule` | 81 | `activeGoal == null` | `UNAVAILABLE(NO_ACTIVE_GOAL)` | — |
| `RapidWeightLossRule` | 85 | trajectory is `cut` | `CLEAR` | clear: `("trajectory", null, null, trajectory)` |
| `JointOveruseRule` | 71 | `dataPoints == 0` | `UNAVAILABLE(NO_STRAIN_DATA)` | — |
| `JointOveruseRule` | 75 | `strainAvg < strainAvgAtLeast` | `CLEAR` | clear: `("shoulder_strain_avg", strainAvg, cfg.strainAvgAtLeast(), null)` |
| `JointOveruseRule` | 83 | `planned == null` | `UNAVAILABLE(NO_PLANNED_SESSION)` | — |
| `JointOveruseRule` | 87 | muscle ≠ needle | `CLEAR` | clear: `("tomorrow_muscle", null, null, tomorrowMuscle)` |
| `IgnoredNudgeRule` | 82 | no sleep_goal row | `UNAVAILABLE(NO_SLEEP_GOAL_ROW)` | — |
| `IgnoredNudgeRule` | 86 | push port unavailable | `UNAVAILABLE(NOTIFICATIONS_OFF)` | — |
| `IgnoredNudgeRule` | 109 | no nudge that evening | `CLEAR` | clear: `("nudge_run_nights", (double) nightsSoFar, (double) n, "no_push:" + pushDate)` |
| `IgnoredNudgeRule` | 114 | unlogged night | `UNAVAILABLE(UNLOGGED_NIGHT)` | — |
| `IgnoredNudgeRule` | 118 | complied at least once | `CLEAR` | clear: `("nudge_run_nights", (double) nightsSoFar, (double) n, "complied:" + sleepDate)` |
| `LateEatingRule` | 119 | `qualifying < minDaysOfLastThree` | **SPLIT** → `hourByDay.isEmpty()` ⇒ `UNAVAILABLE(NO_MEAL_DATA)`, else `CLEAR` | clear: `("late_meal_days", (double) qualifying, (double) cfg.minDaysOfLastThree(), null)` |
| `LoadFuelMismatchRule` | 71 | `loadAvg < loadThreshold` | `CLEAR` | clear: `("load_avg_min", loadAvg, cfg.loadThreshold(), null)` |
| `LoadFuelMismatchRule` | 87 | neither side has enough logged days | `UNAVAILABLE(NOT_ENOUGH_LOGGED_DAYS)` | — |
| `LoadFuelMismatchRule` | 141 | neither arm fires | `CLEAR` | clear: `("fuel_arms_fired", 0.0, 1.0, null)` |

In `IgnoredNudgeRule`, `nightsSoFar` is the count of nights already accepted when the loop breaks — declare `int nightsSoFar = 0;` before the loop and increment it where `bedtimeByNight.put(...)` happens.

Every `return Optional.of(new FlagRaise(KEY, payload))` becomes `return FlagVerdict.raised(KEY, payload)`.

- [ ] **Step 3: The three worked conversions**

**Split condition** — `SleepDebtRule`, replacing lines 33-35:

```java
        if (d.loggedNights() < cfg.minNights()) {
            // Not "the user slept fine" — we do not have the nights to say anything.
            return FlagVerdict.unavailable(FlagKey.SLEEP_DEBT,
                UnavailableReason.NOT_ENOUGH_LOGGED_NIGHTS);
        }
        if (d.deficitHours() < cfg.deficitHours()) {
            return FlagVerdict.clear(FlagKey.SLEEP_DEBT, new FlagVerdict.ClearEvidence(
                "deficit_hours", d.deficitHours(), cfg.deficitHours(), null));
        }
```

**Multiple gates** — `JointOveruseRule`, replacing lines 70-89:

```java
        if (dataPoints == 0) {
            return FlagVerdict.unavailable(FlagKey.JOINT_OVERUSE, UnavailableReason.NO_STRAIN_DATA);
        }
        double strainAvg = sum / dataPoints;
        if (strainAvg < cfg.strainAvgAtLeast()) {
            return FlagVerdict.clear(FlagKey.JOINT_OVERUSE, new FlagVerdict.ClearEvidence(
                "shoulder_strain_avg", strainAvg, cfg.strainAvgAtLeast(), null));
        }

        LocalDate tomorrow = today.plusDays(1);
        // findPlannedTemplateForDate is a READ — never getToday, which WRITES on every call.
        WorkoutSessionEntity planned =
            workoutService.findPlannedTemplateForDate(userId, tomorrow).orElse(null);
        if (planned == null) {
            return FlagVerdict.unavailable(FlagKey.JOINT_OVERUSE,
                UnavailableReason.NO_PLANNED_SESSION);
        }
        String tomorrowMuscle = MuscleGroup.of(planned.getMuscle());
        if (!cfg.muscleNeedle().equals(tomorrowMuscle)) {
            return FlagVerdict.clear(FlagKey.JOINT_OVERUSE, new FlagVerdict.ClearEvidence(
                "tomorrow_muscle", null, null, tomorrowMuscle));
        }
```

**Gates inside a loop** — `IgnoredNudgeRule`, replacing the loop body's three exits:

```java
        int nightsSoFar = 0;
        for (LocalDate sleepDate = oldestSleepDate; !sleepDate.isAfter(newestSleepDate);
                sleepDate = sleepDate.plusDays(1)) {
            LocalDate pushDate = sleepDate.minusDays(1);
            if (!sentDates.contains(pushDate)) {
                return FlagVerdict.clear(FlagKey.IGNORED_NUDGE, new FlagVerdict.ClearEvidence(
                    "nudge_run_nights", (double) nightsSoFar, (double) n, "no_push:" + pushDate));
            }
            Double observed = bedtimeSeries.get(sleepDate);
            if (observed == null) {
                // Honesty gate: an unlogged night is neither compliant nor violating.
                return FlagVerdict.unavailable(FlagKey.IGNORED_NUDGE,
                    UnavailableReason.UNLOGGED_NIGHT);
            }
            double lateByMinutes = (observed - anchorShiftedHour) * 60.0;
            if (lateByMinutes <= cfg.nonComplianceMinutes()) {
                return FlagVerdict.clear(FlagKey.IGNORED_NUDGE, new FlagVerdict.ClearEvidence(
                    "nudge_run_nights", (double) nightsSoFar, (double) n, "complied:" + sleepDate));
            }
            bedtimeByNight.put(pushDate.toString(), observed);
            nightsSoFar++;
        }
```

- [ ] **Step 4: Rewrite the evaluator**

`FlagEvaluator.evaluate` returns all 13 verdicts. **`all_healthy` keeps its gate but now always produces a verdict**: it is evaluated unconditionally, and if any other rule RAISED, its verdict is forced to `CLEAR` — the celebration is genuinely not true when something else fired, and a trace with 12 entries would be a hole in the picture.

```java
    /** Every rule's verdict for {@code userId} right now, cooldowns NOT yet applied — 13 entries,
     *  one per rule, in AdvicePriority order. */
    @Transactional(readOnly = true)
    public List<FlagVerdict> evaluate(UUID userId) {
        LocalDate today = LocalDate.now();
        List<FlagVerdict> verdicts = new ArrayList<>();
        verdicts.add(acuteBadDayRule.evaluate(userId, today));
        verdicts.add(loadFuelMismatchRule.evaluate(userId, today));
        verdicts.add(rapidWeightLossRule.evaluate(userId, today));
        verdicts.add(jointOveruseRule.evaluate(userId, today));
        verdicts.add(ignoredNudgeRule.evaluate(userId, today));
        verdicts.add(lateEatingRule.evaluate(userId, today));
        verdicts.add(sustainedStressRule.evaluate(userId, today));
        verdicts.add(sleepDebtRule.evaluate(userId, today));
        verdicts.add(momentumAtRiskRule.evaluate(userId, today));
        verdicts.add(recoveryNeededRule.evaluate(userId, today));
        verdicts.add(loggingGapRule.evaluate(userId, today));
        verdicts.add(missedWorkoutsRule.evaluate(userId, today));

        boolean anyRaised = verdicts.stream().anyMatch(v -> v.outcome() == FlagOutcome.RAISED);
        FlagVerdict healthy = allHealthyRule.evaluate(userId, today);
        if (anyRaised && healthy.outcome() == FlagOutcome.RAISED) {
            // The quiet state is not true while something else is firing. Same behaviour as the
            // old `if (raises.isEmpty())` gate, but it now leaves a trace instead of a hole.
            healthy = FlagVerdict.clear(FlagKey.ALL_HEALTHY, new FlagVerdict.ClearEvidence(
                "other_flags_raised", null, null, "another_rule_fired"));
        }
        verdicts.add(healthy);
        return verdicts;
    }
```

- [ ] **Step 5: Keep `FlagService` behaviour identical**

Only the loop head changes in this task — the trace write lands in Task 4:

```java
        for (FlagVerdict verdict : evaluator.evaluate(userId)) {
            if (verdict.outcome() != FlagOutcome.RAISED) {
                continue;
            }
            FlagRaise raise = verdict.toRaise();
            // … the existing cooldown check and save, unchanged …
        }
```

- [ ] **Step 6: Adapt the existing rule ITs**

Every `FlagEvaluator*IT` that asserts on `evaluate(...)` now receives 13 verdicts instead of a raise list. Add this helper to each affected test class rather than weakening the assertions:

```java
    /** The keys that actually RAISED — the old evaluate() return, reconstructed. */
    private static List<String> raisedKeys(List<FlagVerdict> verdicts) {
        return verdicts.stream()
            .filter(v -> v.outcome() == FlagOutcome.RAISED)
            .map(FlagVerdict::flagKey)
            .toList();
    }
```

**Then add, per rule, one test for each new branch the table introduced** — the `CLEAR` case with a value just below the threshold, and each `UNAVAILABLE` case. Put the fixture value **one step on each side of the boundary**, never far from it and never exactly on it: round 1 shipped two bugs that survived precisely because every fixture sat far from its threshold, and a third because a filler value sat exactly on a `< 12` boundary.

Example, added to `FlagEvaluatorSleepDebtIT`:

```java
    @Test
    void testSleepDebt_shouldBeClearWhenDeficitIsJustUnderThreshold() {
        UUID user = userPopulator.createUser().getId();
        // 7 nights logged (the gate passes), deficit just under the 6.0 h threshold.
        seedNights(user, 7, 7.2);   // goal 8.0 → 0.8 h/night → 5.6 h total

        FlagVerdict v = verdictFor(sleepDebtRule.evaluate(user, LocalDate.now()));

        assertThat(v.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(v.clear().metric()).isEqualTo("deficit_hours");
        assertThat(v.clear().observed()).isLessThan(v.clear().threshold());
    }

    @Test
    void testSleepDebt_shouldBeUnavailableWhenTooFewNightsLogged() {
        UUID user = userPopulator.createUser().getId();
        seedNights(user, 2, 5.0);   // deep deficit, but below min-nights

        FlagVerdict v = sleepDebtRule.evaluate(user, LocalDate.now());

        assertThat(v.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(v.reason()).isEqualTo(UnavailableReason.NOT_ENOUGH_LOGGED_NIGHTS);
    }
```

The second test is the one that matters most: with the old code both of these were the same silent `Optional.empty()`, and a rule that cannot see the data was indistinguishable from a user who is sleeping well.

- [ ] **Step 7: Run the full companion flag suite**

```bash
cd backend && ./mvnw test -Dtest='FlagVerdictTest,FlagEvaluator*IT,FlagServiceIT,InterventionServiceIT,InterventionConfigIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true > /tmp/t2.log 2>&1; echo "EXIT=$?"; grep -E "Tests run:.*(Failures|Errors)|BUILD" /tmp/t2.log | tail -3
```
Expected: `EXIT=0`, a non-zero test count, `BUILD SUCCESS`. Verify each named class exists first — a `-Dtest` glob matching nothing exits 0 and proves nothing.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags
git commit -m "feat(companion): every rule returns a verdict, not an empty Optional (mezo-6269.1)"
```

---

### Task 3: The trace table

**Files:**
- Create: `entity/CompanionFlagTraceEntity.java`, `repository/CompanionFlagTraceRepository.java`, `db/changelog/1.0.0/script/202609051200_mezo-6269.1_companion_flag_trace.sql`
- Modify: `db/changelog/1.0.0/1.0.0_master.yml`, `ResetDatabase`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/CompanionFlagTracePersistenceIT.java`

**Interfaces:**
- Produces: `CompanionFlagTraceRepository.findFirstByCreatedByAndFlagKeyOrderByOccurredAtDesc(UUID, String)` and `findByCreatedByAndOccurredAtBetweenOrderByOccurredAtAsc(UUID, Instant, Instant)`.

- [ ] **Step 1: Write the migration**

`202609051200_mezo-6269.1_companion_flag_trace.sql`:

```sql
-- Coaching observer S1 (mezo-6269.1, spec 2026-09-05 §4.3): the evaluation trace. One row per
-- rule per CHANGE of verdict — an hourly sweep where nothing changed writes nothing, which is
-- what keeps this table small enough to keep forever.
create table companion_flag_trace (
    id            uuid         not null primary key,
    created_by    uuid         not null,
    created_at    timestamptz  not null,
    is_deleted    boolean      not null default false,
    flag_key      varchar(24)  not null,
    outcome       varchar(12)  not null,
    reason_code   varchar(32),
    disposition   varchar(24),
    evidence      jsonb,
    occurred_at   timestamptz  not null,
    constraint ck_companion_flag_trace_flag_key check (flag_key in
        ('sustained_stress', 'sleep_debt', 'momentum_at_risk', 'recovery_needed', 'all_healthy',
         'logging_gap', 'missed_workouts', 'acute_bad_day', 'load_fuel_mismatch',
         'rapid_weight_loss', 'joint_overuse', 'ignored_nudge', 'late_eating')),
    constraint ck_companion_flag_trace_outcome check (outcome in ('raised', 'clear', 'unavailable')),
    constraint ck_companion_flag_trace_disposition check (disposition is null or disposition in
        ('logged', 'suppressed_by_cooldown'))
);

-- "the newest row for this rule" — the transition comparison on every evaluation.
create index idx_companion_flag_trace_owner_flag_time
    on companion_flag_trace (created_by, flag_key, occurred_at desc);

-- "everything that happened on this day" — the observer's timeline read.
create index idx_companion_flag_trace_owner_time
    on companion_flag_trace (created_by, occurred_at);
```

Register it in `1.0.0_master.yml` as the LAST changeset, following the existing shape exactly:

```yaml
  - changeSet:
      id: "1.0.0:202609051200_mezo-6269.1_companion_flag_trace"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609051200_mezo-6269.1_companion_flag_trace.sql
```

- [ ] **Step 2: Write the entity and repository**

`CompanionFlagTraceEntity.java` — mirror `CompanionFlagLogEntity`'s conventions, including the `@Pattern` that mirrors the CHECK:

```java
package io.mrkuhne.mezo.feature.companion.flags.entity;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
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
 * One CHANGE in what a rule concluded (spec 2026-09-05 §4.3). Unlike {@code companion_flag_log},
 * which records only raises, this records every rule's verdict — but only when it differs from
 * that rule's previous row, so an unchanged hourly sweep writes nothing.
 */
@Getter
@Setter
@Entity
@Table(name = "companion_flag_trace")
@SQLDelete(sql = "update companion_flag_trace set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CompanionFlagTraceEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** Mirrors ck_companion_flag_trace_flag_key — see {@code FlagKey}. */
    @NotNull
    @Pattern(regexp = "sustained_stress|sleep_debt|momentum_at_risk|recovery_needed|all_healthy"
        + "|logging_gap|missed_workouts|acute_bad_day|load_fuel_mismatch|rapid_weight_loss"
        + "|joint_overuse|ignored_nudge|late_eating")
    @Column(name = "flag_key", nullable = false, length = 24)
    private String flagKey;

    /** Mirrors ck_companion_flag_trace_outcome — see {@code FlagOutcome}, lower-cased. */
    @NotNull
    @Pattern(regexp = "raised|clear|unavailable")
    @Column(nullable = false, length = 12)
    private String outcome;

    /** {@code UnavailableReason} lower-cased, null unless the outcome is unavailable. */
    @Column(name = "reason_code", length = 32)
    private String reasonCode;

    /** {@code TraceDisposition} lower-cased, null unless the rule raised. */
    @Column(length = 24)
    private String disposition;

    /** The CLEAR verdict's observed value and threshold; null for the other outcomes. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private FlagVerdict.ClearEvidence evidence;

    /** When the evaluation happened — the ordering key for both observer reads. */
    @NotNull
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;
}
```

`CompanionFlagTraceRepository.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags.repository;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompanionFlagTraceRepository extends JpaRepository<CompanionFlagTraceEntity, UUID> {

    /** The rule's most recent verdict — what a new evaluation is compared against. */
    Optional<CompanionFlagTraceEntity> findFirstByCreatedByAndFlagKeyOrderByOccurredAtDesc(
        UUID createdBy, String flagKey);

    /** Everything that changed inside a window — the observer's day timeline. */
    List<CompanionFlagTraceEntity> findByCreatedByAndOccurredAtBetweenOrderByOccurredAtAsc(
        UUID createdBy, Instant from, Instant to);
}
```

- [ ] **Step 3: Add the table to `ResetDatabase`**

`backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java:40` holds one long `TRUNCATE TABLE …` string. Add `companion_flag_trace` immediately after `companion_flag_log`. A new table missing from this list leaks rows between integration tests and produces failures that look like logic bugs — this is a documented growth rule, and the previous slice tripped over it.

The columns `created_by`, `created_at` and `is_deleted` come from `OwnedEntity` (`techcore/persistence/OwnedEntity.java`), which maps exactly those three and no `updated_at` — the DDL above matches it deliberately.

- [ ] **Step 4: Write the persistence test**

`CompanionFlagTracePersistenceIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.AbstractIntegrationTest;
import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagTraceRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CompanionFlagTracePersistenceIT extends AbstractIntegrationTest {

    @Autowired CompanionFlagTraceRepository repository;

    @Test
    void testFindFirst_shouldReturnTheNewestRowForThatRuleOnly() {
        UUID user = userPopulator.createUser().getId();
        Instant now = Instant.now();
        save(user, FlagKey.SLEEP_DEBT, "clear", now.minus(2, ChronoUnit.HOURS));
        save(user, FlagKey.SLEEP_DEBT, "raised", now.minus(1, ChronoUnit.HOURS));
        save(user, FlagKey.LATE_EATING, "raised", now);

        CompanionFlagTraceEntity newest = repository
            .findFirstByCreatedByAndFlagKeyOrderByOccurredAtDesc(user, FlagKey.SLEEP_DEBT)
            .orElseThrow();

        assertThat(newest.getOutcome()).isEqualTo("raised");
    }

    @Test
    void testEvidence_shouldRoundTripThroughJsonb() {
        UUID user = userPopulator.createUser().getId();
        CompanionFlagTraceEntity row = row(user, FlagKey.SLEEP_DEBT, "clear", Instant.now());
        row.setEvidence(new FlagVerdict.ClearEvidence("deficit_hours", 1.25, 6.0, null));
        repository.save(row);

        FlagVerdict.ClearEvidence read = repository
            .findFirstByCreatedByAndFlagKeyOrderByOccurredAtDesc(user, FlagKey.SLEEP_DEBT)
            .orElseThrow().getEvidence();

        assertThat(read.metric()).isEqualTo("deficit_hours");
        assertThat(read.observed()).isEqualTo(1.25);
        assertThat(read.threshold()).isEqualTo(6.0);
        assertThat(read.detail()).isNull();
    }

    @Test
    void testFindByWindow_shouldExcludeRowsOutsideIt() {
        UUID user = userPopulator.createUser().getId();
        Instant now = Instant.now();
        save(user, FlagKey.SLEEP_DEBT, "clear", now.minus(3, ChronoUnit.DAYS));
        save(user, FlagKey.LATE_EATING, "raised", now.minus(1, ChronoUnit.HOURS));

        assertThat(repository.findByCreatedByAndOccurredAtBetweenOrderByOccurredAtAsc(
            user, now.minus(1, ChronoUnit.DAYS), now))
            .extracting(CompanionFlagTraceEntity::getFlagKey)
            .containsExactly(FlagKey.LATE_EATING);
    }

    private void save(UUID user, String flagKey, String outcome, Instant at) {
        repository.save(row(user, flagKey, outcome, at));
    }

    private CompanionFlagTraceEntity row(UUID user, String flagKey, String outcome, Instant at) {
        CompanionFlagTraceEntity row = new CompanionFlagTraceEntity();
        row.setCreatedBy(user);
        row.setFlagKey(flagKey);
        row.setOutcome(outcome);
        row.setOccurredAt(at);
        return row;
    }
}
```

- [ ] **Step 5: Run the test and the liquibase linter**

```bash
cd backend && ./mvnw test -Dtest=CompanionFlagTracePersistenceIT -Dmezo.test.use-testcontainers=true > /tmp/t3.log 2>&1; echo "EXIT=$?"; grep -E "Tests run:|BUILD" /tmp/t3.log | tail -2
cd .. && node scripts/lint-liquibase.mjs | tail -2
```
Expected: `EXIT=0`, 3 tests, `BUILD SUCCESS`; linter `result: PASS`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags backend/src/main/resources/db/changelog backend/src/test
git commit -m "feat(companion): companion_flag_trace — one row per verdict CHANGE (mezo-6269.1)"
```

---

### Task 4: Writing the trace

**Files:**
- Create: `service/FlagTraceWriter.java`
- Modify: `service/FlagService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagServiceTraceIT.java`

**Interfaces:**
- Consumes: `CompanionFlagTraceRepository`, `FlagVerdict`, `TraceDisposition`.
- Produces: `FlagTraceWriter.record(UUID userId, FlagVerdict verdict, TraceDisposition disposition, Instant at)`.

- [ ] **Step 1: Write the failing test**

`FlagServiceTraceIT.java` — the three behaviours that justify the table's existence:

```java
package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.AbstractIntegrationTest;
import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagTraceRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class FlagServiceTraceIT extends AbstractIntegrationTest {

    @Autowired FlagService flagService;
    @Autowired CompanionFlagTraceRepository traceRepository;

    @Test
    void testEvaluate_shouldTraceEveryRuleOnTheFirstRun() {
        UUID user = userPopulator.createUser().getId();

        flagService.evaluateAndLog(user, "sweep");

        // 13 rules, all traced — the point of the feature is that the quiet ones leave a mark.
        assertThat(traceRepository.findAll().stream()
            .filter(r -> r.getCreatedBy().equals(user))
            .map(CompanionFlagTraceEntity::getFlagKey))
            .hasSize(13).doesNotHaveDuplicates();
    }

    @Test
    void testEvaluate_shouldWriteNothingWhenNothingChanged() {
        UUID user = userPopulator.createUser().getId();
        flagService.evaluateAndLog(user, "sweep");
        long afterFirst = countFor(user);

        flagService.evaluateAndLog(user, "sweep");

        // This is the condition for keeping the table forever: an unchanged sweep is free.
        assertThat(countFor(user)).isEqualTo(afterFirst);
    }

    @Test
    void testEvaluate_shouldRecordCooldownSuppressionAsItsOwnState() {
        UUID user = userPopulator.createUser().getId();
        seedSleepDebtRaise(user);          // makes sleep_debt true
        flagService.evaluateAndLog(user, "sweep");   // → raised / logged

        flagService.evaluateAndLog(user, "sweep");   // → still raised, now inside its cooldown

        List<CompanionFlagTraceEntity> sleepRows = traceRepository.findAll().stream()
            .filter(r -> r.getCreatedBy().equals(user) && FlagKey.SLEEP_DEBT.equals(r.getFlagKey()))
            .toList();
        assertThat(sleepRows).hasSize(2);
        assertThat(sleepRows.get(0).getDisposition()).isEqualTo("logged");
        // Today this transition is invisible: the raise is dropped before it is ever persisted.
        assertThat(sleepRows.get(1).getDisposition()).isEqualTo("suppressed_by_cooldown");
    }

    private long countFor(UUID user) {
        return traceRepository.findAll().stream().filter(r -> r.getCreatedBy().equals(user)).count();
    }
}
```

`seedSleepDebtRaise` seeds enough short nights to trip `sleep_debt` — copy the fixture helper from the existing `FlagEvaluatorSleepDebtIT` rather than inventing new numbers.

- [ ] **Step 2: Run it and watch it fail**

```bash
cd backend && ./mvnw test -Dtest=FlagServiceTraceIT -Dmezo.test.use-testcontainers=true
```
Expected: FAIL — no trace rows are written at all.

- [ ] **Step 3: Write the trace writer**

```java
package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagTraceRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Appends to {@code companion_flag_trace}, but only when a rule's verdict actually CHANGED
 * (spec 2026-09-05 §4.3). The comparison covers the disposition too: a rule that stays RAISED
 * while flipping from LOGGED to SUPPRESSED_BY_COOLDOWN has genuinely changed state, and that is
 * exactly the "why did it go quiet" moment worth recording.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FlagTraceWriter {

    private final CompanionFlagTraceRepository repository;

    public void record(UUID userId, FlagVerdict verdict, TraceDisposition disposition, Instant at) {
        String outcome = verdict.outcome().name().toLowerCase();
        String reasonCode = verdict.reason() == null ? null : verdict.reason().name().toLowerCase();
        String dispositionValue = disposition == null ? null : disposition.name().toLowerCase();

        CompanionFlagTraceEntity previous = repository
            .findFirstByCreatedByAndFlagKeyOrderByOccurredAtDesc(userId, verdict.flagKey())
            .orElse(null);
        if (previous != null
            && Objects.equals(previous.getOutcome(), outcome)
            && Objects.equals(previous.getReasonCode(), reasonCode)
            && Objects.equals(previous.getDisposition(), dispositionValue)) {
            return;
        }

        CompanionFlagTraceEntity row = new CompanionFlagTraceEntity();
        row.setCreatedBy(userId);
        row.setFlagKey(verdict.flagKey());
        row.setOutcome(outcome);
        row.setReasonCode(reasonCode);
        row.setDisposition(dispositionValue);
        row.setEvidence(verdict.clear());
        row.setOccurredAt(at);
        repository.save(row);
    }
}
```

Note what is deliberately **not** in the comparison: `evidence`. A sleep deficit drifting from 1.2 h to 1.3 h is the same verdict, and treating every decimal as a transition would put the table back to 312 rows a day.

- [ ] **Step 4: Wire it into `FlagService`**

```java
        Instant at = Instant.now();
        for (FlagVerdict verdict : evaluator.evaluate(userId)) {
            TraceDisposition disposition = null;
            if (verdict.outcome() == FlagOutcome.RAISED) {
                Instant coolUntil = at.minus(
                    properties.cooldownHours().forFlag(verdict.flagKey()), ChronoUnit.HOURS);
                if (repository.existsRaiseSince(userId, verdict.flagKey(), coolUntil)) {
                    disposition = TraceDisposition.SUPPRESSED_BY_COOLDOWN;
                } else {
                    CompanionFlagLogEntity row = new CompanionFlagLogEntity();
                    row.setCreatedBy(userId);
                    row.setFlagKey(verdict.flagKey());
                    row.setSource(source);
                    row.setPayload(verdict.payload());
                    repository.save(row);
                    written.add(verdict.flagKey());
                    eventPublisher.publishEvent(
                        new FlagRaisedEvent(userId, verdict.flagKey(), source));
                    disposition = TraceDisposition.LOGGED;
                }
            }
            traceWriter.record(userId, verdict, disposition, at);
        }
```

Add `private final FlagTraceWriter traceWriter;` to the constructor fields. One `Instant at` for the whole loop, so every rule in one evaluation shares a timestamp — the observer's timeline groups by it.

- [ ] **Step 5: Run the test and watch it pass**

```bash
cd backend && ./mvnw test -Dtest='FlagServiceTraceIT,FlagServiceIT,CompanionFlagTracePersistenceIT' -Dmezo.test.use-testcontainers=true > /tmp/t4.log 2>&1; echo "EXIT=$?"; grep -E "Tests run:.*(Failures|Errors)|BUILD" /tmp/t4.log | tail -2
```
Expected: `EXIT=0`, `BUILD SUCCESS`.

- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "feat(companion): FlagService records the trace, cooldown suppression included (mezo-6269.1)"
```

---

### Task 5: Docs, CODEMAP and the full gate

**Files:**
- Modify: `docs/features/companion.md`, `docs/CODEMAP.md`

- [ ] **Step 1: Update `docs/features/companion.md`**

Edit the sections that are now wrong — do NOT append a changelog; the doc describes how the code works today. Cover: that `FlagRule` returns a verdict rather than an `Optional`, the three outcomes and what each carries, the `UnavailableReason` enum as the list of honesty gates, `companion_flag_trace` and its transition-only rule, and that `all_healthy` is now always evaluated but forced to `CLEAR` when another rule fired. Bump the frontmatter `updated:` to `2026-09-05`.

- [ ] **Step 2: Regenerate the CODEMAP — in this order**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
```
The docs edit must come first: bumping a frontmatter field drifts the map, and regenerating before the edit is what made an earlier slice's docs commit fail `--check` and become a merge blocker.

- [ ] **Step 3: Run the whole gate**

```bash
cd backend && ./mvnw test -Dmezo.test.use-testcontainers=true > /tmp/gate.log 2>&1; echo "EXIT=$?"; grep -E "Tests run:.*(Failures|Errors)|BUILD" /tmp/gate.log | tail -3
cd .. && node scripts/lint-liquibase.mjs | tail -2
cd frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```
The frontend is untouched by this slice, but CI runs it, so a pre-existing red must be identified now rather than at merge time. Known load flakes: `ActiveWorkoutPage.test.tsx` (bd `mezo-0121`) and `insights.nav.test.tsx` — if either fails in a full run but passes standalone, say so and move on.

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs(companion): the verdict model and the evaluation trace (mezo-6269.1)"
```

---

## Self-Review

**Spec coverage** (§4 of the design doc): §4.1 `FlagVerdict` → Tasks 1-2; the `CLEAR` branch carrying observed + threshold → Task 2's table; `UnavailableReason` derived from real gates → Task 1, built by reading all 28 exit sites; §4.2 the three-gate decision chain → Task 4 (`disposition`); `SUPPRESSED_BY_COOLDOWN` no longer discarded → Task 4's third test; §4.3 transition-only persistence → Tasks 3-4; the comparison covering disposition → `FlagTraceWriter`; ordering by `AdvicePriority` → Task 2's evaluator. §4.4 (`flagKey` on the card) and §5 (the read endpoint) belong to S2 and are deliberately absent here.

**Placeholders:** none — every step carries the code or the exact command. The one instruction that points at existing code rather than repeating it (Task 4's `seedSleepDebtRaise`) does so on purpose: re-deriving sleep fixtures by hand is how round 1 shipped wrong arithmetic in a plan.

**Type consistency:** `FlagVerdict.raised/clear/unavailable`, `ClearEvidence(metric, observed, threshold, detail)`, `FlagOutcome.RAISED/CLEAR/UNAVAILABLE`, `TraceDisposition.LOGGED/SUPPRESSED_BY_COOLDOWN` and the repository method names are used identically in Tasks 1-4. Entity string columns store the lower-cased enum names, and the `@Pattern`/CHECK pairs match those spellings.

**Known risk carried into execution:** Task 2 touches 13 files in one commit. It is atomic because the interface change forces it; the mitigation is the per-site table, the three worked conversions covering all three code shapes, and running each rule's own test class as you convert it.
