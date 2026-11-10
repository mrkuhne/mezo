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
}
