package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.habit.service.HabitFormationEstimator;
import io.mrkuhne.mezo.feature.habit.service.HabitFormationEstimator.Day;
import io.mrkuhne.mezo.feature.habit.service.HabitFormationEstimator.Result;
import io.mrkuhne.mezo.feature.habit.service.HabitFormationEstimator.Settings;
import io.mrkuhne.mezo.feature.habit.service.HabitFormationEstimator.Status;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * Plain unit test (no Spring context) for the formation model — the domain's first, per the
 * design spec {@code docs/superpowers/specs/2026-09-06-habit-formation-design.md}. Every expected
 * number below is hand-computed from the spec's formulas, so a silent change to the curve, the
 * consistency EMA or the ±band breaks this file rather than shipping.
 */
class HabitFormationEstimatorTest {

    /** The application.yml defaults, spelled out so the arithmetic in each test is checkable. */
    private static final Settings S = new Settings(0.03, 90, 5, 0.30, 0.12, 0.09, 28, 5);

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 6);

    @Test
    void testEstimate_shouldReproduceTheHandComputedCurve_whenTenConsecutiveDones() {
        // consistency after 10 dones from the 0.5 seed: 1 - 0.5*0.88^10 = 0.8607495119952989
        // no context signal at all -> context 0.5
        // k = 0.03 * (0.6 + 0.4*0.86074951) * (0.7 + 0.5*0.5) = 0.026912544436746406
        // automaticity(10) = 1 - e^(-k*10) = 0.23595259580701944 -> 24 %
        Result r = HabitFormationEstimator.estimate(consecutive(10, Status.DONE), null, TODAY, S);

        assertThat(r.reps()).isEqualTo(10);
        assertThat(r.missed()).isZero();
        assertThat(r.firstDate()).isEqualTo(TODAY.minusDays(9));
        assertThat(r.curveK()).isCloseTo(0.026912544436746406, within(1e-12));
        assertThat(r.automaticityPct()).isEqualTo(24);
        assertThat(r.consistencyPct()).isEqualTo(86);
        // n_T = ln(1/(1-0.9))/k = 85.558 ; the ±30 % band: 122.226 (slow) / 65.814 (fast)
        assertThat(r.repsToThresholdLo()).isEqualTo(56);
        assertThat(r.repsToThresholdHi()).isEqualTo(112);
        assertThat(r.repsPerWeek()).isCloseTo(2.5, within(1e-9)); // 10 dones / (28/7) weeks
        assertThat(r.weeksToThresholdLo()).isCloseTo(22.4, within(1e-9));
        assertThat(r.weeksToThresholdHi()).isCloseTo(44.8, within(1e-9));
    }

    @Test
    void testEstimate_shouldReportNothingButTheCounts_whenUnderMinReps() {
        Result r = HabitFormationEstimator.estimate(consecutive(4, Status.DONE), null, TODAY, S);

        assertThat(r.reps()).isEqualTo(4); // the honest, non-estimated part still lands
        assertThat(r.firstDate()).isEqualTo(TODAY.minusDays(3));
        assertThat(r.automaticityPct()).isNull();
        assertThat(r.curveK()).isNull();
        assertThat(r.consistencyPct()).isNull();
        assertThat(r.repsToThresholdLo()).isNull();
        assertThat(r.repsToThresholdHi()).isNull();
        assertThat(r.weeksToThresholdLo()).isNull();
        assertThat(r.weeksToThresholdHi()).isNull();
        assertThat(r.repsPerWeek()).isNull();
        assertThat(r.timeConstancyPct()).isNull();
        assertThat(r.anchorConstancyPct()).isNull();
    }

    @Test
    void testEstimate_shouldSlowButNeverReset_whenADayIsMissed() {
        Result clean = HabitFormationEstimator.estimate(consecutive(10, Status.DONE), null, TODAY, S);

        List<Day> withMiss = new ArrayList<>();
        LocalDate start = TODAY.minusDays(10);
        for (int i = 0; i < 11; i++) {
            Status status = i == 5 ? Status.MISSED : Status.DONE;
            withMiss.add(new Day(start.plusDays(i), status, null));
        }
        Result missed = HabitFormationEstimator.estimate(withMiss, null, TODAY, S);

        assertThat(missed.reps()).isEqualTo(10);            // same repetitions...
        assertThat(missed.missed()).isEqualTo(1);
        assertThat(missed.curveK()).isLessThan(clean.curveK());      // ...but a slower curve
        assertThat(missed.automaticityPct()).isLessThan(clean.automaticityPct());
        assertThat(missed.automaticityPct()).isGreaterThan(0);       // slowed, NOT reset
        assertThat(missed.consistencyPct()).isLessThan(clean.consistencyPct());
    }

    @Test
    void testEstimate_shouldIgnoreCalendarSpan_whenTheRepetitionsAreTheSame() {
        // Same ten dones, one packed into ten days and one spread over thirty (the days between
        // carry no row at all — the user never opened the app, which is absence, not a miss).
        List<Day> dense = consecutive(10, Status.DONE);
        List<Day> sparse = new ArrayList<>();
        LocalDate start = TODAY.minusDays(27);
        for (int i = 0; i < 10; i++) {
            sparse.add(new Day(start.plusDays(i * 3L), Status.DONE, null));
        }

        Result a = HabitFormationEstimator.estimate(dense, null, TODAY, S);
        Result b = HabitFormationEstimator.estimate(sparse, null, TODAY, S);

        assertThat(b.curveK()).isEqualTo(a.curveK());
        assertThat(b.automaticityPct()).isEqualTo(a.automaticityPct());
        assertThat(b.repsToThresholdLo()).isEqualTo(a.repsToThresholdLo());
    }

    @Test
    void testEstimate_shouldFabricateNoContext_whenNeitherSignalIsAvailable() {
        Result r = HabitFormationEstimator.estimate(consecutive(10, Status.DONE), null, TODAY, S);

        assertThat(r.timeConstancyPct()).isNull();  // no doneAt hour on any row
        assertThat(r.anchorConstancyPct()).isNull(); // the def has no anchor
        // context fell back to the neutral 0.5, which is exactly the k asserted above
        assertThat(r.curveK()).isCloseTo(0.026912544436746406, within(1e-12));
    }

    @Test
    void testEstimate_shouldOrderTheBand_whenTheEstimateExists() {
        Result r = HabitFormationEstimator.estimate(consecutive(10, Status.DONE), null, TODAY, S);

        assertThat(r.repsToThresholdLo()).isLessThanOrEqualTo(r.repsToThresholdHi());
        assertThat(r.weeksToThresholdLo()).isLessThanOrEqualTo(r.weeksToThresholdHi());
    }

    @Test
    void testEstimate_shouldLeaveWeeksNull_whenTheRecentRateIsZero() {
        // Ten dones, all of them a year ago: the strength window holds nothing, so there is no
        // honest rate to divide by. Repetitions-to-threshold still stands; weeks cannot.
        List<Day> old = new ArrayList<>();
        LocalDate start = TODAY.minusDays(365);
        for (int i = 0; i < 10; i++) {
            old.add(new Day(start.plusDays(i), Status.DONE, null));
        }
        Result r = HabitFormationEstimator.estimate(old, null, TODAY, S);

        assertThat(r.repsPerWeek()).isNull();
        assertThat(r.weeksToThresholdLo()).isNull();
        assertThat(r.weeksToThresholdHi()).isNull();
        assertThat(r.repsToThresholdLo()).isNotNull();
    }

    @Test
    void testEstimate_shouldReportPerfectTimeConstancy_whenEveryDoneLandsOnTheSameHour() {
        List<Day> days = new ArrayList<>();
        LocalDate start = TODAY.minusDays(9);
        for (int i = 0; i < 10; i++) {
            days.add(new Day(start.plusDays(i), Status.DONE, 7));
        }
        Result r = HabitFormationEstimator.estimate(days, null, TODAY, S);

        assertThat(r.timeConstancyPct()).isEqualTo(100);
        // a stable context lifts k above the neutral-0.5 baseline
        assertThat(r.curveK()).isGreaterThan(0.026912544436746406);
    }

    @Test
    void testEstimate_shouldLeaveTimeConstancyNull_whenTooFewTimedRows() {
        List<Day> days = new ArrayList<>();
        LocalDate start = TODAY.minusDays(9);
        for (int i = 0; i < 10; i++) {
            days.add(new Day(start.plusDays(i), Status.DONE, i < 4 ? 7 : null));
        }
        Result r = HabitFormationEstimator.estimate(days, null, TODAY, S);

        assertThat(r.timeConstancyPct()).isNull(); // 4 timed rows, min-sample is 5
    }

    @Test
    void testEstimate_shouldMeasureAnchorConstancy_whenTheAnchorHasItsOwnDoneDates() {
        List<Day> days = consecutive(10, Status.DONE);
        Set<LocalDate> anchorDone = Set.of(
            TODAY.minusDays(9), TODAY.minusDays(8), TODAY.minusDays(7),
            TODAY.minusDays(6), TODAY.minusDays(5));

        Result r = HabitFormationEstimator.estimate(days, anchorDone, TODAY, S);

        assertThat(r.anchorConstancyPct()).isEqualTo(50); // 5 of the 10 done dates
    }

    @Test
    void testEstimate_shouldStayEmpty_whenThereAreNoRowsAtAll() {
        Result r = HabitFormationEstimator.estimate(List.of(), null, TODAY, S);

        assertThat(r.reps()).isZero();
        assertThat(r.missed()).isZero();
        assertThat(r.firstDate()).isNull();
        assertThat(r.automaticityPct()).isNull();
    }

    private static List<Day> consecutive(int count, Status status) {
        List<Day> days = new ArrayList<>();
        LocalDate start = TODAY.minusDays(count - 1L);
        for (int i = 0; i < count; i++) {
            days.add(new Day(start.plusDays(i), status, null));
        }
        return days;
    }
}
