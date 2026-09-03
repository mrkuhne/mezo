package io.mrkuhne.mezo.feature.goal.engine.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Slice-3 day-type kcal split (spec §6.4): move {@code shiftKcal} off each rest day onto the
 * training days so the WEEKLY sum is unchanged and the delta lands in carbs (derived at serve
 * time). Rest days are floored at BMR — the floor shrinks the effective shift rather than
 * breaking the weekly invariance. Pure, deterministic, no Spring.
 */
public final class DayTypeShiftCalculator {

    private static final int DAYS_PER_WEEK = 7;

    /** Both fields null ⇔ uniform day (no shift applicable). */
    public record DayTypeKcal(Integer trainingDayKcal, Integer restDayKcal) {
        public static final DayTypeKcal UNIFORM = new DayTypeKcal(null, null);
    }

    private DayTypeShiftCalculator() {
    }

    /**
     * @param segmentKcal  the segment's uniform daily target (kcal)
     * @param shiftKcal    the user's dayTypeShiftKcal setting (kcal off each rest day)
     * @param trainingDays scheduled training days per week for this segment (0..7)
     * @param bmr          the bootstrap BMR — the rest-day floor; null → floor 0 (defensive)
     */
    public static DayTypeKcal split(int segmentKcal, int shiftKcal, int trainingDays, BigDecimal bmr) {
        if (shiftKcal <= 0 || trainingDays <= 0 || trainingDays >= DAYS_PER_WEEK) {
            return DayTypeKcal.UNIFORM;
        }
        int floor = bmr == null ? 0 : bmr.setScale(0, RoundingMode.CEILING).intValueExact();
        int restDayKcal = Math.max(segmentKcal - shiftKcal, floor);
        int effectiveShift = segmentKcal - restDayKcal;
        if (effectiveShift <= 0) {
            return DayTypeKcal.UNIFORM;
        }
        int restDays = DAYS_PER_WEEK - trainingDays;
        int trainingDayKcal = segmentKcal
            + BigDecimal.valueOf((long) effectiveShift * restDays)
                .divide(BigDecimal.valueOf(trainingDays), 0, RoundingMode.HALF_UP)
                .intValueExact();
        return new DayTypeKcal(trainingDayKcal, restDayKcal);
    }
}
