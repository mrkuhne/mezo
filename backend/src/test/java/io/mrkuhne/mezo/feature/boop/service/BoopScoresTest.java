package io.mrkuhne.mezo.feature.boop.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.boop.service.BoopDay.Sleep;
import io.mrkuhne.mezo.feature.boop.service.BoopDay.WorkoutLoad;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class BoopScoresTest {

    private final BoopScores scores = new BoopScores(9000);

    private static Sleep night(int min, Integer quality) {
        return new Sleep(null, "23:00", "07:00", min, null, null, null, null, quality, List.of());
    }

    private static BoopDay day(Sleep sleep, int nights, Double baseline, Integer rhr, Integer steps,
                               int kcalSoFar, int kcalTarget) {
        return new BoopDay(LocalDate.of(2026, 11, 10), sleep, 480, LocalTime.of(23, 0), nights,
                List.of(), List.of(), baseline, null, rhr, null, steps, null, null,
                new WorkoutLoad(0, 0), List.of(), kcalSoFar, kcalTarget, 0, 0, 0, 0,
                List.of(), null, List.of(), null, null, null);
    }

    @Test
    void noNightMeansNoSleepScore() {
        var s = scores.compute(day(null, 60, 59.0, 57, 1000, 0, 2000), LocalTime.of(9, 0));
        assertThat(s.alvas()).isNull();
        assertThat(s.forma()).isNull();
    }

    @Test
    void thinNightsMeansLearning() {
        var s = scores.compute(day(night(480, 8), 13, 59.0, 57, 1000, 0, 2000), LocalTime.of(9, 0));
        assertThat(s.alvas()).isNotNull();
        assertThat(s.forma()).isNull();
        assertThat(s.state()).isEqualTo("learning");
    }

    @Test
    void pulseBelowBaselineScoresHigh() {
        var s = scores.compute(day(night(480, 8), 20, 59.0, 57, 1000, 0, 2000), LocalTime.of(9, 0));
        assertThat(s.pulzus()).isEqualTo(82);
        assertThat(s.pulzusBpm()).isEqualTo(57);
        assertThat(s.forma()).isNotNull();
    }

    @Test
    void fuelNullBeforeSeven() {
        var s = scores.compute(day(null, 0, null, null, null, 500, 2000), LocalTime.of(6, 59));
        assertThat(s.fuel()).isNull();
        var later = scores.compute(day(null, 0, null, null, null, 500, 2000), LocalTime.of(14, 0));
        assertThat(later.fuel()).isEqualTo(50);
    }

    @Test
    void stepsCapAt100() {
        var s = scores.compute(day(null, 0, null, null, 20000, 0, 2000), LocalTime.of(9, 0));
        assertThat(s.mozgas()).isEqualTo(100);
    }

    private static BoopDay dayWith(int targetMin, int load, Double baseline, Integer rhr) {
        BoopDay b = day(night(480, 10), 30, baseline, rhr, 0, 0, 2000);
        return new BoopDay(b.date(), b.sleep(), targetMin, b.bedtimeTarget(), 30, List.of(), List.of(),
                baseline, null, rhr, null, 0, null, null, new WorkoutLoad(load, 0), List.of(), 0, 2000,
                0, 0, 0, 0, List.of(), null, List.of(), null, null, null);
    }

    @Test
    void formaExactValue() {
        // alvas 100 (480/480, q10); pulzus 82 (70 + (59-57)*6); load 40 (120 min -> 100-60)
        // forma = 0.45*100 + 0.35*82 + 0.20*40 = 45 + 28.7 + 8 = 81.7 -> 82
        var s = scores.compute(dayWith(480, 120, 59.0, 57), LocalTime.of(9, 0));
        assertThat(s.alvas()).isEqualTo(100);
        assertThat(s.pulzus()).isEqualTo(82);
        assertThat(s.forma()).isEqualTo(82);
        assertThat(s.state()).isEqualTo("good");
    }

    @Test
    void loadTermIs100MinusHalfMinutesCappedAt60() {
        // pulzus 70 (rhr == baseline); alvas 100 -> forma = 45 + 24.5 + 0.2*load
        assertThat(scores.compute(dayWith(480, 120, 59.0, 59), LocalTime.NOON).forma()).isEqualTo(78); // load 40: 77.5 -> 78
        assertThat(scores.compute(dayWith(480, 0, 59.0, 59), LocalTime.NOON).forma()).isEqualTo(90);   // load 100
        assertThat(scores.compute(dayWith(480, 600, 59.0, 59), LocalTime.NOON).forma()).isEqualTo(78); // capped at 60 off
    }

    @Test
    void loadIsNotRoundedBeforeForma() {
        // 25 min -> load 87.5; pulzus 77 (baseline 57+7/6, rhr 57): 45 + 26.95 + 17.5 = 89.45 -> 89
        // (a pre-rounded load of 88 would give 89.55 -> 90)
        var s = scores.compute(dayWith(480, 25, 57 + 7.0 / 6, 57), LocalTime.NOON);
        assertThat(s.pulzus()).isEqualTo(77);
        assertThat(s.forma()).isEqualTo(89);
    }

    @Test
    void stateThresholds() {
        assertThat(BoopScores.stateOf(70)).isEqualTo("good");
        assertThat(BoopScores.stateOf(69)).isEqualTo("okay");
        assertThat(BoopScores.stateOf(50)).isEqualTo("okay");
        assertThat(BoopScores.stateOf(49)).isEqualTo("tired");
        assertThat(BoopScores.stateOf(null)).isEqualTo("learning");
    }

    @Test
    void fuelClampsAt100() {
        var s = scores.compute(day(null, 0, null, null, null, 3000, 2000), LocalTime.of(14, 0));
        assertThat(s.fuel()).isEqualTo(100);
    }

    @Test
    void fuelNullJustAfterSeven() {
        var s = scores.compute(day(null, 0, null, null, null, 300, 2000), LocalTime.of(7, 5));
        assertThat(s.fuel()).isNull();
    }

    @Test
    void partialStepsScoreProportionally() {
        assertThat(scores.compute(day(null, 0, null, null, 4500, 0, 2000), LocalTime.NOON).mozgas()).isEqualTo(50);
    }

    @Test
    void nonPositiveGoalsGiveNoScore() {
        var s = new BoopScores(0).compute(day(null, 0, null, null, 4500, 0, 2000), LocalTime.NOON);
        assertThat(s.mozgas()).isNull();
        assertThat(scores.compute(dayWith(0, 0, 59.0, 57), LocalTime.NOON).alvas()).isNull();
    }
}
