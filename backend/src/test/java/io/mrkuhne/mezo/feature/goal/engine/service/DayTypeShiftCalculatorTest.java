package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.engine.service.DayTypeShiftCalculator.DayTypeKcal;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/** The slice-3 split math: weekly-sum invariance, BMR floor, uniform-day edge cases. Pure JUnit. */
class DayTypeShiftCalculatorTest {

    private static final BigDecimal BMR = new BigDecimal("1720.00");

    @Test
    void splitsShiftWeeklySumInvariant() { // worked example A from the plan header
        DayTypeKcal r = DayTypeShiftCalculator.split(2150, 200, 4, BMR);
        assertThat(r.restDayKcal()).isEqualTo(1950);
        assertThat(r.trainingDayKcal()).isEqualTo(2300);
        assertThat(4 * r.trainingDayKcal() + 3 * r.restDayKcal()).isEqualTo(7 * 2150);
    }

    @Test
    void bmrFloorShrinksTheEffectiveShift() { // worked example B
        DayTypeKcal r = DayTypeShiftCalculator.split(1800, 200, 4, BMR);
        assertThat(r.restDayKcal()).isEqualTo(1720);
        assertThat(r.trainingDayKcal()).isEqualTo(1860);
        assertThat(4 * r.trainingDayKcal() + 3 * r.restDayKcal()).isEqualTo(7 * 1800);
    }

    @Test
    void weeklySumStaysWithinRoundingBoundAcrossTheGrid() {
        for (int t = 1; t <= 6; t++) {
            for (int s = 50; s <= 500; s += 50) {
                for (int kcal = 1800; kcal <= 3200; kcal += 175) {
                    DayTypeKcal r = DayTypeShiftCalculator.split(kcal, s, t, BMR);
                    if (r.trainingDayKcal() == null) continue; // floor swallowed the whole shift
                    int weekly = t * r.trainingDayKcal() + (7 - t) * r.restDayKcal();
                    assertThat(Math.abs(weekly - 7 * kcal))
                        .as("kcal=%d s=%d t=%d", kcal, s, t)
                        .isLessThanOrEqualTo((t + 1) / 2); // one round() → ≤ T/2 drift
                }
            }
        }
    }

    @Test
    void uniformWhenNoShift_noTrainingDays_allTrainingDays_orFloorEatsItAll() {
        assertThat(DayTypeShiftCalculator.split(2150, 0, 4, BMR).restDayKcal()).isNull();
        assertThat(DayTypeShiftCalculator.split(2150, 200, 0, BMR).restDayKcal()).isNull();
        assertThat(DayTypeShiftCalculator.split(2150, 200, 7, BMR).restDayKcal()).isNull();
        // segment kcal already at the floor → nothing to take from rest days
        assertThat(DayTypeShiftCalculator.split(1720, 200, 4, BMR).restDayKcal()).isNull();
        // null bmr (defensive) → floor of 0, shift applies fully
        assertThat(DayTypeShiftCalculator.split(2150, 200, 4, null).restDayKcal()).isEqualTo(1950);
    }
}
