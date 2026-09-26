# Learned Expenditure — Part 1 (engine + served Alap) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Learn each user's base expenditure weekly from logged intake + weigh-ins (Kalman filter
seeded by the formula) and serve it as the goal's `neatBaselineKcal` ("Alap"), with a confidence
line in the Fuel energy sheet.

**Architecture:** Three pure units (`ExpenditureFilter`, `IntakeDayClassifier`,
`ExpenditureStepPolicy`) plus one `@Transactional` orchestrator (`ExpenditureLearningService`)
run on Monday for the week that ended, and upsert one `expenditure_estimate` row per user per
week. `GoalPrescriptionCalculator` swaps the bootstrap's `neatBaselineKcal` for the latest applied
base. The existing served-target chain (`GoalProjectionService` → `DayTargetProjector`) does the
rest. The Monday job runs learning for eligible users and the old weekly_correction suggestion
for the others.

**Tech Stack:** Java 21 / Spring Boot / JPA / Liquibase / JUnit 5 + AssertJ (backend), OpenAPI
contract generation, React + TS + Vitest (frontend).

**Spec:** `docs/superpowers/specs/2026-09-26-learned-expenditure-design.md`. Read §5 before any task.

## Global Constraints

- One served-target rule: the learned value enters ONLY by replacing `tdeeBootstrap.neatBaselineKcal`; never re-derive targets on a surface or in the FE.
- No filter work on the request path. The calculator reads a persisted row only.
- Every tunable lives in `GoalEngineProperties.Expenditure` + `application.yml` `mezo.goal.expenditure.*`; no `@Value`, no hardcoded constants in services.
- Honest null: an unlogged day is missing data, never 0 kcal intake.
- Today is never used; the window ends on the last day of the reviewed week (a Sunday).
- The weekly step is ≤ ±150 kcal, hedged to half on a new direction, dead band 30, rails `[max(0.65×formula, 1.10×BMR), 1.35×formula]`.
- Liquibase changesets go in `backend/src/main/resources/db/changelog/1.1.0/` (id `"1.1.0:{YYYYMMDDHHMM}_mezo-zz91i_{desc}"`).
- New owned tables join the TRUNCATE list in `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`.
- Contract order: `api/feature/*/…yml` → `cd api/generate && npm run generate:api` → `cd frontend && pnpm generate:api`.
- Regenerate `docs/CODEMAP.md` (`node scripts/gen-codemap.mjs`) in the same change; `--check` must pass.
- Backend IT runs: `cd backend && ./mvnw -q test -Dtest=<Class> -Dmezo.test.use-testcontainers=true`.
- FE tests: `cd frontend && CI=true pnpm test` (mock mode) and `CI=true VITE_USE_MOCK=false pnpm test` (real mode).
- Commit subjects: `feat(goal): … (mezo-zz91i)`; end every message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Config + `ExpenditureFilter` (pure Kalman filter)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/GoalEngineProperties.java` (add `Expenditure` component + record)
- Modify: `backend/src/main/resources/application.yml` (under `mezo.goal`, after `adaptive:`)
- Modify: any `src/test/resources/application*.yml` that redefines `mezo.goal` completely (grep `bootstrap-uncertainty-kcal` under `backend/src/test/resources`; add the same block where found)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/GoalEnginePropertiesIT.java` (bind assertion for the new block)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/ExpenditureFilter.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/ExpenditureFilterTest.java`

**Interfaces:**
- Produces: `GoalEngineProperties.expenditure()` → `Expenditure` record (fields below); `ExpenditureFilter.run(List<Day>, double priorBaseKcal, Params) → Optional<Estimate>`; `ExpenditureFilter.Params.of(GoalEngineProperties)`.

- [ ] **Step 1: Add the config record.** In `GoalEngineProperties`, add a component after `overview`:

```java
    /** Learned-expenditure tunables (mezo-zz91i, spec 2026-09-26-learned-expenditure-design §5). */
    @NotNull @Valid Expenditure expenditure
```

and the nested record:

```java
    /**
     * Learned expenditure (mezo-zz91i): the Kalman filter's noise model (§5.2), the usable-day
     * classifier (§5.3) and the weekly step policy (§5.4). The prior SD is
     * {@link GoalEngineProperties#bootstrapUncertaintyKcal()}.
     */
    public record Expenditure(
        @NotNull Boolean enabled,                                   // true — global switch (Part 2 adds a per-user one)
        @NotNull @Min(28) @Max(365) Integer windowDays,             // 120 — history replayed each run
        @NotNull @Positive Double sigmaScaleKg,                     // 0.35 — scale noise
        @NotNull @Positive Double sigmaTissueKg,                    // 0.02 — daily tissue process noise
        @NotNull @DecimalMin("0") Double intakeErrorPct,            // 0.10 — logged-intake error
        @NotNull @Positive Integer sigmaUnknownKcal,                // 800 — an unknown-intake day
        @NotNull @DecimalMin("0") @jakarta.validation.constraints.DecimalMax("0.99") Double waterPhi, // 0.90
        @NotNull @Positive Double sigmaWaterKg,                     // 0.20
        @NotNull @Positive Double sigmaBaseKcal,                    // 12 — base drift per day
        @NotNull @DecimalMin("0") Double glycogenKgPerG,            // 0.007 — +200 g/day carbs → +1.4 kg
        @NotNull @Positive Double glycogenMaxKg,                    // 2.0
        @NotNull @Positive Double glycogenAlpha,                    // 0.4 — carb EWMA per usable day
        @NotNull @Positive Double suspiciousRatio,                  // 0.60 — of the user's 28-day median
        @NotNull @Min(7) @Max(60) Integer referenceDays,            // 28
        @NotNull @Min(1) @Max(28) Integer minReferenceDays,         // 5
        @NotNull @Min(1) @Max(28) Integer minUsableDays,            // 10 — eligibility: usable days in the last 28
        @NotNull @Min(1) @Max(7) Integer minUsableDaysPerWeek,      // 4 — below: HOLDING
        @NotNull @Min(1) @Max(7) Integer minWeighInDaysPerWeek,     // 2 — below: HOLDING
        @NotNull @Min(10) @Max(400) Integer maxStepKcal,            // 150
        @NotNull @Min(0) @Max(200) Integer deadBandKcal,            // 30
        @NotNull @Positive Double maxDeviation,                     // 0.35 — rails around the formula base
        @NotNull @Positive Double minBaseBmrRatio,                  // 1.10 — rail: base ≥ BMR × this
        @NotNull @Positive Integer highConfidenceSdKcal,            // 100
        @NotNull @Positive Integer mediumConfidenceSdKcal           // 200
    ) {
    }
```

In `application.yml`, under `mezo.goal:` after the `adaptive:` block:

```yaml
    # Learned expenditure (mezo-zz91i, spec 2026-09-26-learned-expenditure-design §5).
    expenditure:
      enabled: true
      window-days: 120
      sigma-scale-kg: 0.35
      sigma-tissue-kg: 0.02
      intake-error-pct: 0.10
      sigma-unknown-kcal: 800
      water-phi: 0.90
      sigma-water-kg: 0.20
      sigma-base-kcal: 12
      glycogen-kg-per-g: 0.007
      glycogen-max-kg: 2.0
      glycogen-alpha: 0.4
      suspicious-ratio: 0.60
      reference-days: 28
      min-reference-days: 5
      min-usable-days: 10
      min-usable-days-per-week: 4
      min-weigh-in-days-per-week: 2
      max-step-kcal: 150
      dead-band-kcal: 30
      max-deviation: 0.35
      min-base-bmr-ratio: 1.10
      high-confidence-sd-kcal: 100
      medium-confidence-sd-kcal: 200
```

Add to `GoalEnginePropertiesIT` an assertion in its existing binding test style, e.g.
`assertThat(props.expenditure().maxStepKcal()).isEqualTo(150); assertThat(props.expenditure().waterPhi()).isEqualTo(0.90);`.
Every other place that constructs `GoalEngineProperties` by hand (grep `new GoalEngineProperties(` in
`backend/src/test`) gets a fixture `Expenditure` with the values above as the extra last argument;
put one shared factory `ExpenditureFilterTest.defaults()` (see Step 2) and reuse it.

- [ ] **Step 2: Write the failing filter tests.** Deterministic synthetic scenarios (a seeded
`java.util.Random`, mean over seeds, the same simulator the spec's design sim used):

```java
package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureFilter.Day;
import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureFilter.Estimate;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.function.IntPredicate;
import java.util.function.IntUnaryOperator;
import org.junit.jupiter.api.Test;

class ExpenditureFilterTest {

    static GoalEngineProperties.Expenditure defaults() {
        return new GoalEngineProperties.Expenditure(true, 120, 0.35, 0.02, 0.10, 800, 0.90, 0.20, 12.0,
            0.007, 2.0, 0.4, 0.60, 28, 5, 10, 4, 2, 150, 30, 0.35, 1.10, 100, 200);
    }

    static final ExpenditureFilter.Params P = ExpenditureFilter.Params.of(7700, 300, defaults());
    static final LocalDate D0 = LocalDate.of(2026, 1, 5);

    /** Truth simulator: tissue moves by energy balance; water AR(1); glycogen fills ~3 days after a carb change. */
    static List<Day> simulate(long seed, int n, int trueBase, IntUnaryOperator intake, IntUnaryOperator carbs,
                              IntPredicate logged, IntPredicate weighed) {
        Random r = new Random(seed);
        List<Day> days = new ArrayList<>();
        double m = 80, water = 0, gly = 0;
        int move = 300;
        for (int i = 0; i < n; i++) {
            int in = intake.applyAsInt(i) + (int) Math.round(r.nextGaussian() * 300);
            int c = carbs.applyAsInt(i);
            gly += (0.007 * (c - carbs.applyAsInt(0)) - gly) * 0.4;
            water = 0.85 * water + r.nextGaussian() * 0.2;
            Double w = weighed.test(i) ? m + water + gly + r.nextGaussian() * 0.35 : null;
            days.add(new Day(D0.plusDays(i), logged.test(i) ? in : null, logged.test(i) ? c : null, move, 0, w));
            m += (in - trueBase - move) / 7700.0;
        }
        return days;
    }

    static double meanAbsErrorAt(int day, int trueBase, int prior, IntUnaryOperator intake, IntUnaryOperator carbs,
                                 IntPredicate logged, IntPredicate weighed) {
        double sum = 0;
        for (long s = 0; s < 30; s++) {
            List<Day> days = simulate(s, day + 1, trueBase, intake, carbs, logged, weighed);
            sum += Math.abs(ExpenditureFilter.run(days, prior, P).orElseThrow().baseKcal() - trueBase);
        }
        return sum / 30;
    }

    @Test
    void recoversABase400KcalAwayFromThePrior() {
        assertThat(meanAbsErrorAt(27, 2300, 2700, i -> 2600, i -> 250, i -> true, i -> true)).isLessThan(150);
        assertThat(meanAbsErrorAt(41, 2300, 2700, i -> 2600, i -> 250, i -> true, i -> true)).isLessThan(100);
    }

    @Test
    void aCarbStepDoesNotMoveTheBaseBeyondControlNoise() {
        double control = maxDeviation(i -> 200);
        double step = maxDeviation(i -> i < 14 ? 200 : 420);
        assertThat(step).isLessThan(control + 50);
    }

    private static double maxDeviation(IntUnaryOperator carbs) {
        double sum = 0;
        for (long s = 0; s < 30; s++) {
            List<Day> all = simulate(s, 42, 2500, i -> 2800, carbs, i -> true, i -> true);
            double worst = 0;
            for (int end = 14; end < 42; end++) {
                double b = ExpenditureFilter.run(all.subList(0, end + 1), 2500, P).orElseThrow().baseKcal();
                worst = Math.max(worst, Math.abs(b - 2500));
            }
            sum += worst;
        }
        return sum / 30;
    }

    @Test
    void uncertaintyShrinksWithDataAndGrowsThroughALoggingGap() {
        List<Day> days = simulate(1, 42, 2300, i -> 2600, i -> 250, i -> i < 28, i -> i < 28);
        double sd27 = ExpenditureFilter.run(days.subList(0, 28), 2700, P).orElseThrow().sdKcal();
        double sd41 = ExpenditureFilter.run(days, 2700, P).orElseThrow().sdKcal();
        assertThat(sd27).isLessThan(300);
        assertThat(sd41).isGreaterThan(sd27);
    }

    @Test
    void unloggedDaysCarryNoInformationAboutTheBase() {
        List<Day> days = simulate(2, 28, 2300, i -> 2600, i -> 250, i -> false, i -> true);
        Estimate e = ExpenditureFilter.run(days, 2700, P).orElseThrow();
        assertThat(e.baseKcal()).isCloseTo(2700, org.assertj.core.data.Offset.offset(1.0));
    }

    @Test
    void noWeighInMeansNoEstimate() {
        List<Day> days = simulate(3, 14, 2300, i -> 2600, i -> 250, i -> true, i -> false);
        assertThat(ExpenditureFilter.run(days, 2700, P)).isEmpty();
    }
}
```

- [ ] **Step 3: Run it to verify it fails.**
Run: `cd backend && ./mvnw -q test -Dtest=ExpenditureFilterTest`
Expected: compilation failure (`ExpenditureFilter` does not exist).

- [ ] **Step 4: Implement the filter.**

```java
package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * The learned-expenditure estimator (mezo-zz91i, spec §5.2): a 3-state linear Kalman filter over
 * {@code [m tissue kg, w transient water kg, B base kcal/day]}, one step per calendar day, seeded
 * with the formula base as the prior. A usable intake day links weight to B through
 * {@code Δm = (I − B − movement)/ρ}; an unknown or excluded day drifts by the goal balance with a
 * wide variance and carries no information about B. A weigh-in observes {@code m + w + G}, where G
 * is the deterministic glycogen-water input from the carb EWMA, so a sustained carb change is not
 * read as tissue. Pure: no I/O, no Spring.
 */
public final class ExpenditureFilter {

    private ExpenditureFilter() {
    }

    /**
     * One calendar day, days ascending and contiguous.
     *
     * @param intakeKcal   usable logged intake, or {@code null} (unlogged / excluded)
     * @param carbsG       that day's carbs when {@code intakeKcal} is usable, else {@code null}
     * @param movementKcal the plan's daily movement average + the day's unplanned extra (net)
     * @param balanceKcal  the goal's daily energy balance (the drift assumed on an unknown day)
     * @param weightKg     the day's mean scale weight, or {@code null}
     */
    public record Day(LocalDate date, Integer intakeKcal, Integer carbsG, int movementKcal, int balanceKcal,
                      Double weightKg) {
    }

    public record Estimate(double baseKcal, double sdKcal) {
    }

    public record Params(int kcalPerKg, double priorSdKcal, double sigmaScaleKg, double sigmaTissueKg,
                         double intakeErrorPct, double sigmaUnknownKcal, double waterPhi, double sigmaWaterKg,
                         double sigmaBaseKcal, double glycogenKgPerG, double glycogenMaxKg, double glycogenAlpha) {

        public static Params of(int kcalPerKg, int priorSdKcal, GoalEngineProperties.Expenditure e) {
            return new Params(kcalPerKg, priorSdKcal, e.sigmaScaleKg(), e.sigmaTissueKg(), e.intakeErrorPct(),
                e.sigmaUnknownKcal(), e.waterPhi(), e.sigmaWaterKg(), e.sigmaBaseKcal(), e.glycogenKgPerG(),
                e.glycogenMaxKg(), e.glycogenAlpha());
        }

        public static Params of(GoalEngineProperties props) {
            return of(props.kcalPerKg(), props.bootstrapUncertaintyKcal(), props.expenditure());
        }
    }

    /** @return the posterior base at the end of the last day, or empty when no day has a weigh-in */
    public static Optional<Estimate> run(List<Day> days, double priorBaseKcal, Params p) {
        double cref = medianCarbs(days);
        double rho = p.kcalPerKg();
        double[] x = null;
        double[][] cov = null;
        Double carbEwma = null;
        Day prev = null;
        for (Day d : days) {
            if (d.intakeKcal() != null && d.carbsG() != null) {
                carbEwma = carbEwma == null ? d.carbsG() : carbEwma + p.glycogenAlpha() * (d.carbsG() - carbEwma);
            }
            if (x == null) {
                if (d.weightKg() == null) {
                    continue;
                }
                x = new double[] {d.weightKg() - glycogen(carbEwma, cref, p), 0, priorBaseKcal};
                cov = new double[][] {{0.25, 0, 0}, {0, 0.09, 0}, {0, 0, p.priorSdKcal() * p.priorSdKcal()}};
                prev = d;
                continue;
            }
            // Predict from prev's intake into d.
            double[][] f = {{1, 0, 0}, {0, p.waterPhi(), 0}, {0, 0, 1}};
            double u0;
            double qm;
            if (prev.intakeKcal() != null) {
                f[0][2] = -1 / rho;
                u0 = (prev.intakeKcal() - prev.movementKcal()) / rho;
                double intakeErr = p.intakeErrorPct() * prev.intakeKcal() / rho;
                qm = sq(p.sigmaTissueKg()) + sq(intakeErr);
            } else {
                u0 = prev.balanceKcal() / rho;
                qm = sq(p.sigmaTissueKg()) + sq(p.sigmaUnknownKcal() / rho);
            }
            x = new double[] {
                f[0][0] * x[0] + f[0][2] * x[2] + u0,
                f[1][1] * x[1],
                x[2]};
            cov = add(mul(mul(f, cov), transpose(f)), new double[][] {
                {qm, 0, 0}, {0, sq(p.sigmaWaterKg()), 0}, {0, 0, sq(p.sigmaBaseKcal())}});
            // Update on a weigh-in: z = m + w + G + v.
            if (d.weightKg() != null) {
                double y = d.weightKg() - glycogen(carbEwma, cref, p) - (x[0] + x[1]);
                double s = cov[0][0] + cov[0][1] + cov[1][0] + cov[1][1] + sq(p.sigmaScaleKg());
                double[] k = new double[3];
                double[] hp = new double[3];
                for (int i = 0; i < 3; i++) {
                    k[i] = (cov[i][0] + cov[i][1]) / s;
                    hp[i] = cov[0][i] + cov[1][i];
                }
                for (int i = 0; i < 3; i++) {
                    x[i] += k[i] * y;
                    for (int j = 0; j < 3; j++) {
                        cov[i][j] -= k[i] * hp[j];
                    }
                }
            }
            prev = d;
        }
        return x == null ? Optional.empty() : Optional.of(new Estimate(x[2], Math.sqrt(cov[2][2])));
    }

    private static double glycogen(Double carbEwma, double cref, Params p) {
        if (carbEwma == null) {
            return 0;
        }
        double g = p.glycogenKgPerG() * (carbEwma - cref);
        return Math.max(-p.glycogenMaxKg(), Math.min(p.glycogenMaxKg(), g));
    }

    private static double medianCarbs(List<Day> days) {
        double[] c = days.stream().filter(d -> d.intakeKcal() != null && d.carbsG() != null)
            .mapToDouble(Day::carbsG).sorted().toArray();
        if (c.length == 0) {
            return 0;
        }
        return c.length % 2 == 1 ? c[c.length / 2] : (c[c.length / 2 - 1] + c[c.length / 2]) / 2;
    }

    private static double sq(double v) {
        return v * v;
    }

    private static double[][] mul(double[][] a, double[][] b) {
        double[][] r = new double[3][3];
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                for (int k = 0; k < 3; k++) {
                    r[i][j] += a[i][k] * b[k][j];
                }
            }
        }
        return r;
    }

    private static double[][] transpose(double[][] a) {
        double[][] r = new double[3][3];
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                r[i][j] = a[j][i];
            }
        }
        return r;
    }

    private static double[][] add(double[][] a, double[][] b) {
        double[][] r = new double[3][3];
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                r[i][j] = a[i][j] + b[i][j];
            }
        }
        return r;
    }
}
```

- [ ] **Step 5: Run the tests to verify they pass.**
Run: `cd backend && ./mvnw -q test -Dtest='ExpenditureFilterTest,GoalEnginePropertiesIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS. If `recoversABase…` or the carb test misses its threshold by a small margin, do NOT loosen the
assertion silently: report the measured numbers in the task report (the spec's design sim gave 133 / 71 / control+6).

- [ ] **Step 6: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine backend/src/main/resources/application.yml backend/src/test
git commit -m "feat(goal): learned-expenditure Kalman filter + config (mezo-zz91i)"
```

---

### Task 2: `IntakeDayClassifier` (usable / unlogged / suspicious / marked)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/IntakeDayClassifier.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/IntakeDayClassifierTest.java`

**Interfaces:**
- Produces: `IntakeDayClassifier.classify(LocalDate from, LocalDate to, Map<LocalDate,Integer> loggedKcal, Map<LocalDate,Boolean> marks, int fallbackRefKcal, double ratio, int refDays, int minRef) → Map<LocalDate, Status>` (every date in `[from,to]`, insertion-ordered); `enum Status { USABLE, UNLOGGED, SUSPICIOUS, MARKED_INCOMPLETE }`. `loggedKcal` may contain dates before `from` (the reference window); absent or ≤ 0 = unlogged. `marks`: `true` = the user confirmed complete, `false` = marked incomplete (Part 1 passes `Map.of()`).

- [ ] **Step 1: Write the failing tests.**

```java
package io.mrkuhne.mezo.feature.goal.engine.service;

import static io.mrkuhne.mezo.feature.goal.engine.service.IntakeDayClassifier.Status.*;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class IntakeDayClassifierTest {

    static final LocalDate FROM = LocalDate.of(2026, 9, 7);

    /** 28 reference days at ~2950 before FROM, then the owner's real pattern. */
    static Map<LocalDate, Integer> history() {
        Map<LocalDate, Integer> m = new HashMap<>();
        for (int i = 1; i <= 28; i++) {
            m.put(FROM.minusDays(i), 2900 + (i % 3) * 50);
        }
        m.put(FROM, 604);             // 1 meal logged
        m.put(FROM.plusDays(1), 2980);
        m.put(FROM.plusDays(2), 1347); // 2 meals logged
        m.put(FROM.plusDays(3), 2100); // a lighter but real day (71 % of the norm)
        return m;
    }

    @Test
    void daysFarBelowTheUsersOwnNormAreSuspiciousNotLowIntake() {
        var s = IntakeDayClassifier.classify(FROM, FROM.plusDays(4), history(), Map.of(), 2900, 0.60, 28, 5);
        assertThat(s.get(FROM)).isEqualTo(SUSPICIOUS);
        assertThat(s.get(FROM.plusDays(1))).isEqualTo(USABLE);
        assertThat(s.get(FROM.plusDays(2))).isEqualTo(SUSPICIOUS);
        assertThat(s.get(FROM.plusDays(3))).isEqualTo(USABLE);
        assertThat(s.get(FROM.plusDays(4))).isEqualTo(UNLOGGED);
    }

    @Test
    void aUserMarkBeatsTheRuleBothWays() {
        var marks = Map.of(FROM, true, FROM.plusDays(1), false);
        var s = IntakeDayClassifier.classify(FROM, FROM.plusDays(1), history(), marks, 2900, 0.60, 28, 5);
        assertThat(s.get(FROM)).isEqualTo(USABLE);
        assertThat(s.get(FROM.plusDays(1))).isEqualTo(MARKED_INCOMPLETE);
    }

    @Test
    void withTooFewReferenceDaysTheFallbackReferenceIsUsed() {
        Map<LocalDate, Integer> m = Map.of(FROM, 1500, FROM.plusDays(1), 2000);
        var s = IntakeDayClassifier.classify(FROM, FROM.plusDays(1), m, Map.of(), 2900, 0.60, 28, 5);
        assertThat(s.get(FROM)).isEqualTo(SUSPICIOUS);   // 1500 < 0.6 × 2900
        assertThat(s.get(FROM.plusDays(1))).isEqualTo(USABLE);
    }
}
```

- [ ] **Step 2: Run to verify failure.** `cd backend && ./mvnw -q test -Dtest=IntakeDayClassifierTest` → compilation failure.

- [ ] **Step 3: Implement.**

```java
package io.mrkuhne.mezo.feature.goal.engine.service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Which logged days may teach the learned-expenditure filter (mezo-zz91i, spec §5.3, owner
 * decision L2). A day far below the user's OWN recent norm is SUSPICIOUS (probably partly logged)
 * and excluded by default — never read as low intake. A user mark wins in both directions.
 * Pure.
 */
public final class IntakeDayClassifier {

    public enum Status { USABLE, UNLOGGED, SUSPICIOUS, MARKED_INCOMPLETE }

    private IntakeDayClassifier() {
    }

    public static Map<LocalDate, Status> classify(LocalDate from, LocalDate to, Map<LocalDate, Integer> loggedKcal,
            Map<LocalDate, Boolean> marks, int fallbackRefKcal, double ratio, int refDays, int minRef) {
        Map<LocalDate, Status> out = new LinkedHashMap<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            Integer kcal = loggedKcal.get(d);
            Boolean mark = marks.get(d);
            if (kcal == null || kcal <= 0) {
                out.put(d, Status.UNLOGGED);
            } else if (Boolean.FALSE.equals(mark)) {
                out.put(d, Status.MARKED_INCOMPLETE);
            } else if (Boolean.TRUE.equals(mark)) {
                out.put(d, Status.USABLE);
            } else {
                double ref = reference(d, loggedKcal, fallbackRefKcal, refDays, minRef);
                out.put(d, kcal < ratio * ref ? Status.SUSPICIOUS : Status.USABLE);
            }
        }
        return out;
    }

    /** Median logged kcal over the {@code refDays} before {@code d}; the fallback with fewer than {@code minRef}. */
    private static double reference(LocalDate d, Map<LocalDate, Integer> loggedKcal, int fallback, int refDays, int minRef) {
        int[] vals = java.util.stream.IntStream.rangeClosed(1, refDays)
            .mapToObj(i -> loggedKcal.get(d.minusDays(i)))
            .filter(v -> v != null && v > 0)
            .mapToInt(Integer::intValue).sorted().toArray();
        if (vals.length < minRef) {
            return fallback;
        }
        int n = vals.length;
        return n % 2 == 1 ? vals[n / 2] : (vals[n / 2 - 1] + vals[n / 2]) / 2.0;
    }
}
```

- [ ] **Step 4: Run to verify pass.** `cd backend && ./mvnw -q test -Dtest=IntakeDayClassifierTest` → PASS.

- [ ] **Step 5: Commit.** `git add … && git commit -m "feat(goal): intake-day classifier for learned expenditure (mezo-zz91i)"`

---

### Task 3: `ExpenditureStepPolicy` (weekly step, rails, status, confidence)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/ExpenditureStepPolicy.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/ExpenditureStepPolicyTest.java`

**Interfaces:**
- Consumes: `GoalEngineProperties.Expenditure` (Task 1).
- Produces: `ExpenditureStepPolicy.decide(Input, GoalEngineProperties.Expenditure) → Result`; `ExpenditureStepPolicy.rails(int value, int formulaBase, double bmr, GoalEngineProperties.Expenditure) → int`; `ExpenditureStepPolicy.confidence(double sd, Expenditure) → Confidence`; records `Input(int prevApplied, int prevDirection, double posteriorBase, double posteriorSd, int formulaBase, double bmr, int usableDays, int weighInDays)`, `Result(int appliedBase, int step, int direction, Status status, Confidence confidence)`; enums `Status { LEARNING, UPDATED, STABLE, HOLDING }`, `Confidence { LOW, MEDIUM, HIGH }`.

- [ ] **Step 1: Write the failing tests.**

```java
package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureStepPolicy.Confidence;
import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureStepPolicy.Input;
import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureStepPolicy.Status;
import org.junit.jupiter.api.Test;

class ExpenditureStepPolicyTest {

    static final GoalEngineProperties.Expenditure E = ExpenditureFilterTest.defaults();

    static Input in(int prevApplied, int prevDir, double post, double sd, int usable, int weighIns) {
        return new Input(prevApplied, prevDir, post, sd, 2700, 1900, usable, weighIns);
    }

    @Test
    void aNewDirectionMovesHalfFirst() {
        var r = ExpenditureStepPolicy.decide(in(2700, 0, 2300, 150, 6, 5), E);
        assertThat(r.step()).isEqualTo(-150);            // −400/2 = −200 → clamped to −150
        var small = ExpenditureStepPolicy.decide(in(2700, 0, 2600, 150, 6, 5), E);
        assertThat(small.step()).isEqualTo(-50);          // −100/2
        assertThat(small.direction()).isEqualTo(-1);
        assertThat(small.status()).isEqualTo(Status.UPDATED);
    }

    @Test
    void aConfirmedDirectionTakesTheFullStep() {
        var r = ExpenditureStepPolicy.decide(in(2650, -1, 2550, 150, 6, 5), E);
        assertThat(r.step()).isEqualTo(-100);
        assertThat(r.appliedBase()).isEqualTo(2550);
    }

    @Test
    void belowTheDeadBandNothingMoves() {
        var r = ExpenditureStepPolicy.decide(in(2700, -1, 2680, 90, 6, 5), E);
        assertThat(r.step()).isZero();
        assertThat(r.status()).isEqualTo(Status.STABLE);
        assertThat(r.confidence()).isEqualTo(Confidence.HIGH);
    }

    @Test
    void tooLittleDataHolds() {
        assertThat(ExpenditureStepPolicy.decide(in(2700, 0, 2300, 150, 3, 5), E).status()).isEqualTo(Status.HOLDING);
        assertThat(ExpenditureStepPolicy.decide(in(2700, 0, 2300, 150, 6, 1), E).step()).isZero();
    }

    @Test
    void lowConfidenceWithoutAStepIsLearning() {
        var r = ExpenditureStepPolicy.decide(in(2700, 0, 2710, 260, 6, 5), E);
        assertThat(r.status()).isEqualTo(Status.LEARNING);
        assertThat(r.confidence()).isEqualTo(Confidence.LOW);
    }

    @Test
    void railsHoldTheBaseInsideThePlausibleBand() {
        // formula 2700 → lo = max(1755, 1900 × 1.10 = 2090) = 2090, hi = 3645
        assertThat(ExpenditureStepPolicy.rails(2000, 2700, 1900, E)).isEqualTo(2090);
        assertThat(ExpenditureStepPolicy.rails(3800, 2700, 1900, E)).isEqualTo(3645);
        var r = ExpenditureStepPolicy.decide(new Input(2150, -1, 1500, 150, 2700, 1900, 6, 5), E);
        assertThat(r.appliedBase()).isEqualTo(2090);
        assertThat(r.step()).isEqualTo(-60);
    }
}
```

- [ ] **Step 2: Run to verify failure.** `./mvnw -q test -Dtest=ExpenditureStepPolicyTest` → compilation failure.

- [ ] **Step 3: Implement.**

```java
package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;

/**
 * The weekly learned-base step (mezo-zz91i, spec §5.4, owner decisions L1 + L5): at most
 * ±maxStep a week; a new direction moves half first ("more likely the scale is slow than that
 * expenditure changed"), a confirmed one the full step; too little data holds. The applied base
 * always stays inside the plausibility rails. Pure.
 */
public final class ExpenditureStepPolicy {

    public enum Status { LEARNING, UPDATED, STABLE, HOLDING }

    public enum Confidence { LOW, MEDIUM, HIGH }

    public record Input(int prevApplied, int prevDirection, double posteriorBase, double posteriorSd,
                        int formulaBase, double bmr, int usableDays, int weighInDays) {
    }

    public record Result(int appliedBase, int step, int direction, Status status, Confidence confidence) {
    }

    private ExpenditureStepPolicy() {
    }

    public static Result decide(Input in, GoalEngineProperties.Expenditure e) {
        Confidence confidence = confidence(in.posteriorSd(), e);
        boolean holding = in.usableDays() < e.minUsableDaysPerWeek() || in.weighInDays() < e.minWeighInDaysPerWeek();
        double delta = in.posteriorBase() - in.prevApplied();
        int step = 0;
        if (!holding && Math.abs(delta) >= e.deadBandKcal()) {
            int dir = delta > 0 ? 1 : -1;
            double raw = dir == in.prevDirection() ? delta : delta / 2;
            step = (int) Math.round(Math.max(-e.maxStepKcal(), Math.min(e.maxStepKcal(), raw)));
        }
        int applied = rails(in.prevApplied() + step, in.formulaBase(), in.bmr(), e);
        int realStep = applied - in.prevApplied();
        int direction = realStep == 0 ? in.prevDirection() : Integer.signum(realStep);
        Status status = holding ? Status.HOLDING
            : realStep != 0 ? Status.UPDATED
            : confidence == Confidence.LOW ? Status.LEARNING
            : Status.STABLE;
        return new Result(applied, realStep, direction, status, confidence);
    }

    public static int rails(int value, int formulaBase, double bmr, GoalEngineProperties.Expenditure e) {
        double lo = Math.max(formulaBase * (1 - e.maxDeviation()), bmr * e.minBaseBmrRatio());
        double hi = formulaBase * (1 + e.maxDeviation());
        return (int) Math.round(Math.max(lo, Math.min(hi, value)));
    }

    public static Confidence confidence(double sd, GoalEngineProperties.Expenditure e) {
        return sd <= e.highConfidenceSdKcal() ? Confidence.HIGH
            : sd <= e.mediumConfidenceSdKcal() ? Confidence.MEDIUM
            : Confidence.LOW;
    }
}
```

- [ ] **Step 4: Run to verify pass.** → PASS.
- [ ] **Step 5: Commit.** `feat(goal): weekly learned-base step policy (mezo-zz91i)`

---

### Task 4: Persistence — `expenditure_estimate`

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202609262200_mezo-zz91i_expenditure_estimate.sql`
- Modify: `backend/src/main/resources/db/changelog/1.1.0/1.1.0_master.yml` (append the changeSet, same shape as the last entry)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/ExpenditureEstimateEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/ExcludedIntakeDayJson.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/repository/ExpenditureEstimateRepository.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (add `expenditure_estimate, ` before `goal_suggestion,`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/repository/ExpenditureEstimateRepositoryIT.java`

**Interfaces:**
- Produces: `ExpenditureEstimateEntity` (Lombok `@Getter @Setter`, extends `OwnedEntity`) with fields `id, weekStart (LocalDate), status (String), formulaBaseKcal, posteriorBaseKcal, posteriorSdKcal, appliedBaseKcal, stepKcal (Integer), direction (Integer), confidence (String), usableDays, weighInDays (Integer), excludedDays (List<ExcludedIntakeDayJson>)`; `ExcludedIntakeDayJson(LocalDate date, int kcal, String reason)` (`suspicious|marked`); repository methods
  `Optional<ExpenditureEstimateEntity> findByCreatedByAndWeekStartAndDeletedFalse(UUID, LocalDate)`,
  `Optional<ExpenditureEstimateEntity> findFirstByCreatedByAndWeekStartBeforeAndDeletedFalseOrderByWeekStartDesc(UUID, LocalDate)`,
  `Optional<ExpenditureEstimateEntity> findFirstByCreatedByAndDeletedFalseOrderByWeekStartDesc(UUID)`,
  `boolean existsByCreatedByAndDeletedFalse(UUID)`.

- [ ] **Step 1: Write the SQL.**

```sql
-- Learned expenditure (bd mezo-zz91i, spec 2026-09-26-learned-expenditure-design §5.5):
-- one row per user per reviewed week. applied_base_kcal is what the goal serves as "Alap".
create table expenditure_estimate (
    id                  uuid        not null default gen_random_uuid(),
    created_by          uuid        not null,
    is_deleted          boolean     not null default false,
    created_at          timestamptz not null default now(),
    week_start          date        not null,
    status              varchar(10) not null,
    formula_base_kcal   integer     not null,
    posterior_base_kcal integer     not null,
    posterior_sd_kcal   integer     not null,
    applied_base_kcal   integer     not null,
    step_kcal           integer     not null,
    direction           smallint    not null,
    confidence          varchar(6)  not null,
    usable_days         integer     not null,
    weigh_in_days       integer     not null,
    excluded_days       jsonb       not null default '[]'::jsonb,
    constraint pk_expenditure_estimate_id primary key (id),
    constraint fk_expenditure_estimate_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_expenditure_estimate_status check (status in ('LEARNING', 'UPDATED', 'STABLE', 'HOLDING')),
    constraint ck_expenditure_estimate_confidence check (confidence in ('LOW', 'MEDIUM', 'HIGH'))
);

create unique index uq_expenditure_estimate_user_week
    on expenditure_estimate (created_by, week_start) where is_deleted = false;
```

Check `docs/references/liquibase_conventions.md` for the header/changeSet rules before writing the yml entry.

- [ ] **Step 2: Write the entity, the jsonb record and the repository** following
`GoalSuggestionEntity` exactly (`@SQLDelete`/`@SQLRestriction`, `@JdbcTypeCode(SqlTypes.JSON)` on
`excludedDays` with `columnDefinition = "jsonb"`, `smallint` direction mapped as `Integer` with
`@Column(columnDefinition = "smallint")`).

- [ ] **Step 3: Write the repository IT** (extends `AbstractIntegrationTest`, `@Transactional`): save two
rows (weeks 2026-09-14 and 2026-09-21) for a populated user; assert
`findFirstByCreatedByAndWeekStartBeforeAndDeletedFalseOrderByWeekStartDesc(user, 2026-09-21)` returns the
09-14 row, `findFirstByCreatedByAndDeletedFalseOrderByWeekStartDesc` returns 09-21, and that the jsonb
`excludedDays` round-trips (`[{2026-09-13, 604, "suspicious"}]`).

- [ ] **Step 4: Run.** `./mvnw -q test -Dtest=ExpenditureEstimateRepositoryIT -Dmezo.test.use-testcontainers=true` → PASS.
Also run `-Dtest=ArchitectureTest` → PASS.

- [ ] **Step 5: Commit.** `feat(goal): expenditure_estimate persistence (mezo-zz91i)`

---

### Task 5: `DailyIntakePort` + meal adapter

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/port/DailyIntakePort.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/GoalDailyIntakeAdapter.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/service/GoalDailyIntakeAdapterIT.java`

**Interfaces:**
- Produces:

```java
package io.mrkuhne.mezo.feature.goal.engine.port;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Consumer-owned port (ADR 0012): per-day logged intake for the learned-expenditure filter
 * (mezo-zz91i). Implemented in feature/meal off the FuelDayService week rollup, so "consumed"
 * means exactly what Fuel shows. Only LOGGED days are returned (kcal > 0) — absence is missing
 * data, never a zero-kcal day.
 */
public interface DailyIntakePort {

    record DayIntake(LocalDate date, int kcal, int carbsG) {}

    List<DayIntake> between(UUID userId, LocalDate from, LocalDate to);
}
```

- [ ] **Step 1: Write the failing IT.** Populate a user with meals on 3 dates inside a 10-day range (use `MealPopulator`;
read it first for its create method signature) with known kcal/carbs, and one date with no meal. Assert
`between(user, from, to)` returns exactly the 3 logged dates in ascending order with their summed kcal and carbs
(rounded to int, `HALF_UP`), and nothing for the empty date.

- [ ] **Step 2: Run to verify failure** (compilation).

- [ ] **Step 3: Implement the adapter** as a `@Component` in `meal/service`, mirroring `GoalIntakeAdherenceAdapter`:
iterate Monday-aligned weeks from `from.with(previousOrSame(MONDAY))` to `to`, call `fuelDayService.getWeek(userId, weekStart)`
once per week, keep rollups whose `date` is inside `[from, to]` and whose `consumed.kcal > 0`, map to `DayIntake(date,
kcal.setScale(0, HALF_UP).intValueExact(), carbs == null ? 0 : carbs.setScale(0, HALF_UP).intValueExact())`. Check the
exact `MacroSet` getter names in the generated DTO (`getKcal()`, `getC()` or `getCarbs()` — use whichever exists).

- [ ] **Step 4: Run.** → PASS. Run `-Dtest=ArchitectureTest` → PASS (meal → goal port is the existing allowed direction).

- [ ] **Step 5: Commit.** `feat(meal): daily intake port for learned expenditure (mezo-zz91i)`

---

### Task 6: `ExpenditureLearningService` (the weekly orchestrator)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/ExpenditureLearningService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/ExpenditureLearningServiceIT.java`

**Interfaces:**
- Consumes: Tasks 1–5; `GoalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")`;
  `WeightLogRepository.findAllOwned(userId)`; `WorkoutWindowQueryService.movementBetween(userId, from, to)`;
  `GoalEngineService.recomputeActiveGoal(userId)`; `GoalPrescriptionJson.currentSegment(prescription, week)`;
  `GoalSuggestionService.listOpen(userId, goalId)` + `dismiss(userId, goalId, suggestionId)`.
- Produces: `Optional<ExpenditureEstimateEntity> reviewWeek(UUID userId, LocalDate weekStart)` —
  empty = not eligible (the caller runs the fallback suggestion).

- [ ] **Step 1: Write the failing IT** (`@Transactional`, `AbstractIntegrationTest`; seed like `AdaptiveReviewServiceIT`:
user + `BiometricProfilePopulator.create` + active goal via `GoalPopulator` + `goalEngineService.evaluate`).
Anchor every date to a fixed `weekStart = LocalDate.of(2026, 9, 14)` (a Monday) — never `now()` (midnight trap).
Scenarios:
  1. `learnsAndServesTheBase`: 35 days up to 2026-09-20 with meals of ~2600 kcal/day and daily weigh-ins
     trending down 0.05 kg/day → `reviewWeek` returns a row with status `UPDATED`, `stepKcal` in `[-150, -1]`,
     `appliedBaseKcal == formulaBaseKcal + balanceAdjustment + stepKcal`, and the re-read goal's
     `tdeeBootstrap().baseSource()` is `"learned"` with `neatBaselineKcal == appliedBaseKcal` (this last assertion
     turns green only after Task 7 — mark it with a `// Task 7` comment and keep it; the implementer of Task 6 runs
     the IT with that one assertion and expects it to fail until Task 7, or orders Tasks 6 and 7 together).
  2. `suspiciousDaysAreExcludedAndListed`: as 1, plus a 604-kcal day on 2026-09-16 → the row's `excludedDays`
     contains `{2026-09-16, 604, "suspicious"}` and `usableDays` is 6.
  3. `aUserWhoNeverLogsFoodIsNotEligible`: weigh-ins only → `Optional.empty()` and no row.
  4. `reRunningTheSameWeekIsIdempotent`: run twice → one row, same values.
  5. `theFirstRowFoldsInTheAcceptedAdjustment`: goal with `balanceAdjustmentKcal = -120` → the first row's step is
     computed from `formulaBase − 120`.
  6. `learningDismissesAnOpenWeeklyCorrection`: seed an open `weekly_correction` (`GoalSuggestionPopulator`) → after
     `reviewWeek` it is no longer open.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement.**

```java
package io.mrkuhne.mezo.feature.goal.engine.service;

// imports: GoalEngineProperties, ExpenditureFilter, IntakeDayClassifier, ExpenditureStepPolicy, DailyIntakePort,
// ExpenditureEstimateEntity, ExcludedIntakeDayJson, ExpenditureEstimateRepository, GoalEntity, GoalRepository,
// GoalPrescriptionJson, TdeeBootstrapJson, WeightLogRepository, WeightLogEntity, WorkoutWindowQueryService,
// GoalSuggestionService, java.math.*, java.time.*, java.util.*, lombok.RequiredArgsConstructor,
// org.springframework.stereotype.Service, org.springframework.transaction.annotation.Transactional

/**
 * The weekly learned-expenditure run (mezo-zz91i, spec §5): gathers the window, classifies the
 * intake days, runs {@link ExpenditureFilter}, decides the step ({@link ExpenditureStepPolicy}),
 * upserts the week's {@code expenditure_estimate} row and recomputes the active goal so the new
 * base is served. Empty = the user is not (yet) a learning user — the caller falls back to the
 * weight-only weekly_correction suggestion (owner decision L4: never both).
 */
@Service
@RequiredArgsConstructor
public class ExpenditureLearningService {

    private static final String WEEKLY_CORRECTION = "weekly_correction";

    private final GoalEngineProperties props;
    private final GoalRepository goalRepository;
    private final WeightLogRepository weightLogRepository;
    private final DailyIntakePort dailyIntake;
    private final WorkoutWindowQueryService workoutWindows;
    private final ExpenditureEstimateRepository estimates;
    private final GoalEngineService goalEngineService;
    private final GoalSuggestionService suggestionService;

    @Transactional
    public Optional<ExpenditureEstimateEntity> reviewWeek(UUID userId, LocalDate weekStart) {
        GoalEngineProperties.Expenditure e = props.expenditure();
        if (!Boolean.TRUE.equals(e.enabled())) {
            return Optional.empty();
        }
        GoalEntity goal = goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")
            .stream().findFirst().orElse(null);
        TdeeBootstrapJson boot = goal == null ? null : goal.getTdeeBootstrap();
        if (boot == null || boot.bmr() == null) {
            return Optional.empty();
        }
        int formulaBase = round(boot.formulaNeatBaselineKcal() != null ? boot.formulaNeatBaselineKcal() : boot.neatBaselineKcal());
        int planEat = round(boot.weeklyEatKcalPerDay() == null ? BigDecimal.ZERO : boot.weeklyEatKcalPerDay());
        LocalDate weekEnd = weekStart.plusDays(6);
        LocalDate windowStart = weekEnd.minusDays(e.windowDays() - 1L);

        Map<LocalDate, Integer> kcal = new HashMap<>();
        Map<LocalDate, Integer> carbs = new HashMap<>();
        for (DailyIntakePort.DayIntake d : dailyIntake.between(userId, windowStart.minusDays(e.referenceDays()), weekEnd)) {
            kcal.put(d.date(), d.kcal());
            carbs.put(d.date(), d.carbsG());
        }
        Map<LocalDate, IntakeDayClassifier.Status> status = IntakeDayClassifier.classify(windowStart, weekEnd, kcal,
            Map.of(), formulaBase + planEat, e.suspiciousRatio(), e.referenceDays(), e.minReferenceDays());

        Optional<ExpenditureEstimateEntity> prev =
            estimates.findFirstByCreatedByAndWeekStartBeforeAndDeletedFalseOrderByWeekStartDesc(userId, weekStart);
        boolean existing = prev.isPresent() || estimates.findByCreatedByAndWeekStartAndDeletedFalse(userId, weekStart).isPresent();
        long recentUsable = status.entrySet().stream()
            .filter(en -> !en.getKey().isBefore(weekEnd.minusDays(27)))
            .filter(en -> en.getValue() == IntakeDayClassifier.Status.USABLE).count();
        if (!existing && recentUsable < e.minUsableDays()) {
            return Optional.empty();
        }

        Map<LocalDate, Double> weights = dailyMeanWeights(weightLogRepository.findAllOwned(userId), windowStart, weekEnd);
        Map<LocalDate, WorkoutWindowQueryService.DayMovement> movement = workoutWindows.movementBetween(userId, windowStart, weekEnd);
        int balance = currentBalance(goal, weekEnd);
        List<ExpenditureFilter.Day> days = new ArrayList<>();
        for (LocalDate d = windowStart; !d.isAfter(weekEnd); d = d.plusDays(1)) {
            boolean usable = status.get(d) == IntakeDayClassifier.Status.USABLE;
            var m = movement.getOrDefault(d, WorkoutWindowQueryService.DayMovement.NONE);
            days.add(new ExpenditureFilter.Day(d, usable ? kcal.get(d) : null, usable ? carbs.get(d) : null,
                planEat + m.extraKcal(), balance, weights.get(d)));
        }
        Optional<ExpenditureFilter.Estimate> est = ExpenditureFilter.run(days, formulaBase, ExpenditureFilter.Params.of(props));
        if (est.isEmpty()) {
            return Optional.empty();
        }

        int adjustment = goal.getBalanceAdjustmentKcal() == null ? 0 : goal.getBalanceAdjustmentKcal();
        int prevApplied = prev.map(ExpenditureEstimateEntity::getAppliedBaseKcal).orElse(formulaBase + adjustment);
        int prevDirection = prev.map(ExpenditureEstimateEntity::getDirection).orElse(0);
        int usableWeek = count(status, weekStart, weekEnd, IntakeDayClassifier.Status.USABLE);
        int weighInWeek = (int) weights.keySet().stream().filter(d -> !d.isBefore(weekStart)).count();
        ExpenditureStepPolicy.Result r = ExpenditureStepPolicy.decide(new ExpenditureStepPolicy.Input(
            prevApplied, prevDirection, est.get().baseKcal(), est.get().sdKcal(), formulaBase,
            boot.bmr().doubleValue(), usableWeek, weighInWeek), e);

        ExpenditureEstimateEntity row = estimates.findByCreatedByAndWeekStartAndDeletedFalse(userId, weekStart)
            .orElseGet(ExpenditureEstimateEntity::new);
        row.setCreatedBy(userId);
        row.setWeekStart(weekStart);
        row.setStatus(r.status().name());
        row.setFormulaBaseKcal(formulaBase);
        row.setPosteriorBaseKcal((int) Math.round(est.get().baseKcal()));
        row.setPosteriorSdKcal((int) Math.round(est.get().sdKcal()));
        row.setAppliedBaseKcal(r.appliedBase());
        row.setStepKcal(r.step());
        row.setDirection(r.direction());
        row.setConfidence(r.confidence().name());
        row.setUsableDays(usableWeek);
        row.setWeighInDays(weighInWeek);
        row.setExcludedDays(excluded(status, kcal, weekStart, weekEnd));
        ExpenditureEstimateEntity saved = estimates.save(row);

        suggestionService.listOpen(userId, goal.getId()).stream()
            .filter(s -> WEEKLY_CORRECTION.equals(s.getKind() == null ? null : s.getKind().getValue()))
            .forEach(s -> suggestionService.dismiss(userId, goal.getId(), s.getId()));
        goalEngineService.recomputeActiveGoal(userId);
        return Optional.of(saved);
    }

    // helpers: round(BigDecimal) HALF_UP → int; count(status, from, to, want);
    // excluded(...) → List<ExcludedIntakeDayJson> for SUSPICIOUS ("suspicious") / MARKED_INCOMPLETE ("marked") days in the week, date-asc;
    // dailyMeanWeights(logs, from, to) → date → mean weightKg (same-day weigh-ins averaged, like WeightTrendService);
    // currentBalance(goal, date): the prescription segment covering date's goal-week
    //   (week = DAYS.between(goal.getStartDate(), date) / 7 + 1, GoalPrescriptionJson.currentSegment) → dailyEnergyBalanceKcal, else 0.
}
```

Check the actual `GoalSuggestionResponse` getter names (`getKind()` may be an enum or a String — adapt the filter
accordingly). Check whether `ExpenditureLearningService → GoalEngineService` creates a Spring cycle (it must not:
`GoalEngineService` does not depend on this service). Note: `boot.formulaNeatBaselineKcal()` is added in Task 7 —
if you run Task 6 before Task 7, add that record component first (Task 7 Step 1) and commit it with this task.

- [ ] **Step 4: Run.** `./mvnw -q test -Dtest=ExpenditureLearningServiceIT -Dmezo.test.use-testcontainers=true` → PASS
(except the Task 7-tagged assertion if Task 7 is not in yet).

- [ ] **Step 5: Commit.** `feat(goal): weekly learned-expenditure orchestrator (mezo-zz91i)`

---

### Task 7: Serve the learned base

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/TdeeBootstrapJson.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/LearnedBaseResolver.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalPrescriptionCalculator.java:78`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalProjectionService.java` (`dailyEnergyBalance` + its caller)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/EnergyBase.java`, `DailyTargets.java`, `DayTargetProjector.java` (`energy()` only)
- Modify: `api/feature/meal/meal.yml` (`FuelDayEnergy`), then regenerate; `api/feature/goal/goal.yml` (`TdeeBootstrap` schema: the 4 new nullable fields), then regenerate
- Modify: the `FuelDayEnergy` mapping in `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/FuelDayService.java` (grep `FuelDayEnergy`), and `GoalMapper` for the bootstrap
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/LearnedBaseResolverTest.java`, extend `ExpenditureLearningServiceIT` (scenario 1's Task 7 assertion), and a Fuel-day IT assertion (find the existing `FuelDayService` energy IT via grep `extraMovementKcal` in `backend/src/test`)

**Interfaces:**
- Produces: `TdeeBootstrapJson` gains `String baseSource` (`"formula"`|`"learned"`, null = formula), `BigDecimal formulaNeatBaselineKcal`, `Integer learnedSdKcal`, `String learnedConfidence` — appended after `activityModel`, plus a secondary 8-arg constructor that passes nulls (keeps every existing call site compiling). `LearnedBaseResolver.apply(UUID userId, TdeeBootstrapJson formula) → TdeeBootstrapJson`. `EnergyBase(bmr, neatBaselineKcal, baseSource, formulaBaseKcal, sdKcal, confidence)` + the old 2-arg constructor; `DailyTargets.Energy` gains `String baseSource, Integer formulaBaseKcal, Integer baseSdKcal, String baseConfidence`. Contract `FuelDayEnergy` gains optional `baseSource` (enum `formula|learned`), `formulaBaseKcal` (int, nullable), `baseSdKcal` (int, nullable), `baseConfidence` (enum `low|medium|high`, nullable).

- [ ] **Step 1: Extend `TdeeBootstrapJson`.**

```java
public record TdeeBootstrapJson(
    BigDecimal bmr,
    BigDecimal neat,
    BigDecimal neatBaselineKcal,   // the served Alap: bmr × neat, or the learned base (mezo-zz91i)
    BigDecimal weeklyEatKcalPerDay,
    BigDecimal tdee,               // neatBaselineKcal + weeklyEatKcalPerDay
    String formula,
    OffsetDateTime computedAt,
    Integer activityModel,
    String baseSource,                 // "formula" | "learned"; null = formula (pre-mezo-zz91i rows)
    BigDecimal formulaNeatBaselineKcal,// bmr × neat, kept when the base is learned
    Integer learnedSdKcal,
    String learnedConfidence           // LOW | MEDIUM | HIGH
) {
    public TdeeBootstrapJson(BigDecimal bmr, BigDecimal neat, BigDecimal neatBaselineKcal, BigDecimal weeklyEatKcalPerDay,
                             BigDecimal tdee, String formula, OffsetDateTime computedAt, Integer activityModel) {
        this(bmr, neat, neatBaselineKcal, weeklyEatKcalPerDay, tdee, formula, computedAt, activityModel, null, null, null, null);
    }

    public boolean learned() {
        return "learned".equals(baseSource);
    }
}
```

- [ ] **Step 2: Write `LearnedBaseResolverTest`** (Mockito on `ExpenditureEstimateRepository`): no row → the input is
returned unchanged; a row with `appliedBaseKcal 2500, posteriorSdKcal 140, confidence MEDIUM` and formula
`neatBaselineKcal 2700, weeklyEatKcalPerDay 400, bmr 1900` → `neatBaselineKcal 2500`, `tdee 2900`,
`baseSource "learned"`, `formulaNeatBaselineKcal 2700`, `learnedSdKcal 140`, `learnedConfidence "MEDIUM"`; a stored
applied base below today's rails (formula dropped after a weigh-in) is re-railed with `ExpenditureStepPolicy.rails`;
`enabled=false` → unchanged.

- [ ] **Step 3: Implement `LearnedBaseResolver`** (`@Service`, reads
`findFirstByCreatedByAndDeletedFalseOrderByWeekStartDesc`), and call it in `GoalPrescriptionCalculator.calculate`
right after `bootstrapService.compute(...)`:

```java
        TdeeBootstrapJson bootstrap = learnedBase.apply(userId,
            bootstrapService.compute(profile, currentWeightKg, weeklyEat));
```

Because the diet-draft preview and the suggestion preview use the same calculator, they serve the learned base too
(one calculation path — intended).

- [ ] **Step 4: Stop double-applying the correction.** In `GoalProjectionService`, pass the bootstrap into
`dailyEnergyBalance(goal, weightKg, bootstrap)` and use
`BigDecimal adjustment = bootstrap != null && bootstrap.learned() || goal.getBalanceAdjustmentKcal() == null ? BigDecimal.ZERO : BigDecimal.valueOf(goal.getBalanceAdjustmentKcal());`
Update its javadoc: "…while the base is learned (mezo-zz91i) the accepted correction lives inside the base and is not added again."
Add a projection test (in the existing `GoalProjectionService` test class) proving a learned bootstrap with
`balanceAdjustmentKcal = -120` yields the same balance as adjustment 0.

- [ ] **Step 5: Carry the provenance to the Fuel equation.** `EnergyBase.of(b)` fills the 4 new fields from the
bootstrap (`baseSource` defaults to `"formula"`; `formulaBaseKcal` = `formulaNeatBaselineKcal` when learned, else
`neatBaselineKcal`). `DayTargetProjector.energy()` copies them into `DailyTargets.Energy` (arithmetic unchanged).
Contract first: add to `FuelDayEnergy` in `api/feature/meal/meal.yml`:

```yaml
        baseSource:
          type: string
          enum: [formula, learned]
          description: Where baseKcal comes from (mezo-zz91i) — the BMR × NEAT formula or the base learned from intake + weight trend.
        formulaBaseKcal: { type: integer, nullable: true, description: BMR × NEAT, shown next to a learned base. }
        baseSdKcal: { type: integer, nullable: true, description: Learned base uncertainty (±1 SD kcal); null for formula. }
        baseConfidence:
          type: string
          nullable: true
          enum: [low, medium, high]
```

and the 4 fields to the goal contract's tdee bootstrap schema (grep `neatBaselineKcal` in `api/feature/goal/goal.yml`).
Regenerate (`cd api/generate && npm run generate:api`, `cd frontend && pnpm generate:api`), map them in `FuelDayService`
(lower-case the confidence) and `GoalMapper`. Update every Java construction site of `DailyTargets.Energy` /
`EnergyBase` (grep) — tests included.

- [ ] **Step 6: Run.** `./mvnw -q test -Dtest='LearnedBaseResolverTest,ExpenditureLearningServiceIT,GoalProjection*,*FuelDay*,DayTargetProjector*,ArchitectureTest' -Dmezo.test.use-testcontainers=true` → PASS.

- [ ] **Step 7: Commit.** `feat(goal): serve the learned base as Alap (mezo-zz91i)`

---

### Task 8: Monday job split + deploy rollout

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/AdaptiveReviewJob.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/AdaptiveReviewJobTest.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/ExpenditureRolloutRunner.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/ExpenditureRolloutRunnerIT.java`

**Interfaces:**
- Consumes: `ExpenditureLearningService.reviewWeek` (Task 6), `AdaptiveReviewService.reviewUser(userId, weekStart)`.

- [ ] **Step 1: Update `AdaptiveReviewJobTest`** (it mocks the collaborators): user A → `reviewWeek` returns a row →
`adaptiveReviewService.reviewUser` is NEVER called for A; user B → `reviewWeek` empty → `reviewUser(B, weekStart)` is
called; `reviewWeek` is called with `weekStart.minusWeeks(1)` (the week that ended); an exception for one user does not
stop the next.

- [ ] **Step 2: Implement.** In `AdaptiveReviewJob.run()`, inject `ExpenditureLearningService`, and per user:

```java
                if (expenditureLearning.reviewWeek(user.getId(), weekStart.minusWeeks(1)).isPresent()) {
                    learned++;
                } else if (adaptiveReviewService.reviewUser(user.getId(), weekStart)) {
                    proposed++;
                }
```

Log `"Weekly energy review for {}: {} learned, {} correction(s) proposed"`. Update the class javadoc (L4: learning
users get no weekly_correction; the two are exclusive).

- [ ] **Step 3: Write `ExpenditureRolloutRunnerIT`**: a learning-eligible user (meals + weigh-ins in the last 5 weeks,
dates anchored to `LocalDate.now(clock)` minus whole weeks — use the project's `MidnightZone`/clock helper if the IT
base provides one, else compute from `now()` but keep every fixture date ≥ 2 days before today) with no row → after
`runner.run()` exactly one row exists for the last completed week; running again adds nothing; a non-logging user
gets no row.

- [ ] **Step 4: Implement the runner** — `@Component @Order(208) CommandLineRunner`, all profiles, pattern of
`ActivityModelMigrationRunner`: `weekStart = today.with(previousOrSame(MONDAY)).minusWeeks(1)`; for each goal from
`goalRepository.findByStatusNotAndDeletedFalse("archived")` with status `active` whose owner has no
`expenditure_estimate` row (`existsByCreatedByAndDeletedFalse`), call `reviewWeek(owner, weekStart)` in a try/catch
logging a warning; log one info line with the count.

- [ ] **Step 5: Run.** `./mvnw -q test -Dtest='AdaptiveReviewJobTest,ExpenditureRolloutRunnerIT,AdaptiveReviewServiceIT' -Dmezo.test.use-testcontainers=true` → PASS.

- [ ] **Step 6: Commit.** `feat(goal): weekly energy review — learning with suggestion fallback, deploy rollout (mezo-zz91i)`

---

### Task 9: Frontend — the confidence line

**Files:**
- Modify: `frontend/src/features/fuel/sheets/EnergyBreakdownSheet.tsx` (the `base` section + `EnergyBreakdown.base` type)
- Modify: `frontend/src/features/fuel/logic/buildEnergyBreakdown.ts` (pass the provenance through)
- Modify: the caller that builds `energy` for `buildEnergyBreakdown` (grep `buildEnergyBreakdown(` — `FuelMaiPage.tsx` / `buildDayPlan.ts` `servedBudget`) so `energy` carries `source, formulaBase, sd, confidence`
- Modify: `frontend/src/data/fuel/fuel.ts` (`fuelDayEnergy` mock: `baseSource: 'learned'`, `formulaBaseKcal: MOCK_BASE_KCAL + 180`, `baseSdKcal: 140`, `baseConfidence: 'medium'`)
- Test: the existing `buildEnergyBreakdown` and `EnergyBreakdownSheet` test files (grep `buildEnergyBreakdown` under `frontend/src`)

**Interfaces:**
- Consumes: generated `FuelDayEnergy` fields from Task 7.
- Produces: `EnergyBreakdown.base` gains `source: 'formula' | 'learned'`, `formulaKcal?: number`, `sdKcal?: number | null`, `confidence?: 'low' | 'medium' | 'high' | null`.

- [ ] **Step 1: Failing tests.** `buildEnergyBreakdown` with a learned energy → `base.source === 'learned'`,
`base.formulaKcal`, `base.sdKcal`, `base.confidence` passed through; the sheet renders the line
„Tanult alap · Közepesen biztos · ±140 kcal” and a formula tile „Képlet szerint 2 880” (use `nf`), and for
`source: 'formula'` renders „Képlet alapján” and the current BMR × NEAT tiles unchanged. Confidence words:
`low` → „Még tanulok”, `medium` → „Közepesen biztos”, `high` → „Biztos”; the ± is rounded to 10.

- [ ] **Step 2: Run to verify failure.** `cd frontend && CI=true pnpm test` → the new tests FAIL.

- [ ] **Step 3: Implement.** In the sheet's base segment, when `base.source === 'learned'`: keep the Alapanyagcsere
tile, replace the NEAT-szorzó tile with a „Képlet szerint” tile (`base.formulaKcal`) and the result tile's sub with
„Tanult alap”; the explanation paragraph becomes: „Ennyit égetsz <b>edzés nélkül</b> — az app a <b>súlytrendedből
és a felírt evésedből</b> tanulta meg. A képlet {formula} kcal-t mondana.” plus the confidence line under the tiles.
Reuse the sheet's existing classes and tokens only (no new colors; üveg canon). Formula path unchanged.

- [ ] **Step 4: Run both modes.** `CI=true pnpm test` and `CI=true VITE_USE_MOCK=false pnpm test` → PASS; `pnpm build` → PASS; `pnpm lint` if the repo has it.

- [ ] **Step 5: Commit.** `feat(fuel): learned-base confidence line in the energy sheet (mezo-zz91i)`

---

### Task 10: Docs, codemap, full gates

**Files:**
- Modify: `docs/features/goal-engine.md` (new §: learned expenditure — units, the Monday split, rails, config keys), `docs/features/fuel.md` (Alap provenance; fix the stale §10 `NEAT_BASELINE`/`MET_BY_KIND` note), `docs/CODEMAP.md` (regenerate)
- Modify: `docs/superpowers/specs/2026-09-26-learned-expenditure-design.md` §5.3: the fallback reference is the formula maintenance (`formulaBase + planEat`), not the day's served target (what Task 6 implements)

- [ ] **Step 1: Write the docs** (follow the `knowledge-base` skill's 10-section feature-doc shape for the edited sections).
- [ ] **Step 2: `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check`** → clean.
- [ ] **Step 3: Full backend suite:** `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true` → BUILD SUCCESS.
- [ ] **Step 4: FE both modes + build** (Task 9 Step 4 commands) → PASS.
- [ ] **Step 5: Commit.** `docs(goal): learned expenditure feature docs + codemap (mezo-zz91i)`
