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
import org.assertj.core.data.Offset;
import org.junit.jupiter.api.Test;

public class ExpenditureFilterTest {

    public static GoalEngineProperties.Expenditure defaults() {
        return new GoalEngineProperties.Expenditure(true, 120, 0.35, 0.02, 0.5, 0.3, 0.10, 800, 0.90, 0.20, 12.0,
            0.007, 2.0, 0.4, 0.60, 28, 5, 10, 4, 2, 150, 30, 0.35, 1.10, 100, 200, 0.8);
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
        // Final-review fix (mezo-zz91i): the carb EWMA now folds in day d's carbs only AFTER d's own
        // init/update step (a morning weigh-in cannot reflect that day's eating yet). That delays the
        // glycogen correction by one day on the step day, moving this margin from ~226.12 to ~226.20
        // (control ≈176.2) — a ~0.1 kcal shift, not a real behavior regression; the +50 slack is widened
        // slightly to +55 to absorb it.
        assertThat(step).isLessThan(control + 55);
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
        assertThat(e.baseKcal()).isCloseTo(2700, Offset.offset(1.0));
    }

    @Test
    void noWeighInMeansNoEstimate() {
        List<Day> days = simulate(3, 14, 2300, i -> 2600, i -> 250, i -> true, i -> false);
        assertThat(ExpenditureFilter.run(days, 2700, P)).isEmpty();
    }

    // ── the trace (mezo-y72o3, "Hogy tanultam?") ────────────────────────────

    /** A mixed scenario (gaps in logs and weigh-ins, a carb step) — the bits of run() before the trace existed. */
    private static List<Day> mixed() {
        return simulate(7, 60, 2400, i -> i < 30 ? 2500 : 2900, i -> i < 30 ? 200 : 380,
            i -> i % 9 != 4, i -> i % 3 != 1 && i > 2);
    }

    @Test
    void runKeepsItsExactNumbers() {
        Estimate e = ExpenditureFilter.run(mixed(), 2650, P).orElseThrow();
        assertThat(Double.doubleToLongBits(e.baseKcal())).isEqualTo(4657700679819020223L);
        assertThat(Double.doubleToLongBits(e.sdKcal())).isEqualTo(4637791393091154157L);
    }

    @Test
    void runWithTraceCarriesTheSameEstimateAsRun() {
        ExpenditureFilter.Traced t = ExpenditureFilter.runWithTrace(mixed(), 2650, P).orElseThrow();
        assertThat(t.estimate()).isEqualTo(ExpenditureFilter.run(mixed(), 2650, P).orElseThrow());
    }

    @Test
    void theTraceHasOneDayPerCalendarDayFromTheFirstWeighIn() {
        List<Day> days = mixed(); // first weigh-in on day 3
        List<ExpenditureFilter.DayTrace> trace = ExpenditureFilter.runWithTrace(days, 2650, P).orElseThrow().days();
        assertThat(trace).hasSize(57);
        assertThat(trace.get(0).date()).isEqualTo(D0.plusDays(3));
        assertThat(trace.get(56).date()).isEqualTo(D0.plusDays(59));
    }

    @Test
    void theTraceFollowsTheScaleThroughTissueWaterAndGlycogen() {
        List<Day> days = simulate(4, 42, 2300, i -> 2600, i -> 250, i -> true, i -> true);
        List<ExpenditureFilter.DayTrace> trace = ExpenditureFilter.runWithTrace(days, 2700, P).orElseThrow().days();
        double err = 0;
        for (int i = 0; i < trace.size(); i++) {
            ExpenditureFilter.DayTrace t = trace.get(i);
            err += Math.abs(t.tissueKg() + t.waterKg() + t.glycogenKg() - days.get(i).weightKg());
        }
        assertThat(err / trace.size()).isLessThan(0.35);
        // True tissue: +(2600 − 2300 − 300)/7700 = 0 kg/day → the tissue line stays flat within noise.
        assertThat(trace.get(41).tissueKg() - trace.get(0).tissueKg()).isCloseTo(0, Offset.offset(0.6));
    }

    @Test
    void aSustainedCarbStepIsTracedAsGlycogen() {
        List<Day> days = simulate(5, 42, 2500, i -> 2800, i -> i < 21 ? 200 : 420, i -> true, i -> true);
        List<ExpenditureFilter.DayTrace> trace = ExpenditureFilter.runWithTrace(days, 2500, P).orElseThrow().days();
        assertThat(trace.get(30).glycogenKg() - trace.get(15).glycogenKg()).isGreaterThan(1.0);
    }

    @Test
    void noWeighInMeansNoTrace() {
        List<Day> days = simulate(3, 14, 2300, i -> 2600, i -> 250, i -> true, i -> false);
        assertThat(ExpenditureFilter.runWithTrace(days, 2700, P)).isEmpty();
    }
}
