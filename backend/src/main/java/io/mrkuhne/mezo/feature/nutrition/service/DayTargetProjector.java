package io.mrkuhne.mezo.feature.nutrition.service;

import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import java.util.function.BooleanSupplier;

/**
 * The ONE rule turning a goal-recept segment into the macro targets a single date serves — pure,
 * nutrition-owned, no I/O. Extracted from {@code FuelDayService} (mezo-u2pd) so the Fuel-day hero,
 * the meal scorer and the diet-settings draft preview all project identically; a preview that
 * re-derived the day type or the config fallback on its own could show numbers the day never
 * serves.
 *
 * <p>Day-type pick (slice 3, mezo-sxlj): a segment carrying a day-type split
 * ({@code trainingDayKcal} / {@code restDayKcal}) serves the training-day kcal when the date has a
 * SCHEDULE-derived training source, else the rest-day kcal; the whole kcal delta lands in carbs
 * (ISSN), derived at serve time and never stored. A pre-slice-3 / uniform segment (both fields
 * null), or one where only the other field is set, keeps the segment kcal unchanged. The
 * {@code trainingDay} probe is a {@link BooleanSupplier} because it is a DB round-trip the
 * uniform-segment path must not pay.
 */
public final class DayTargetProjector {

    private DayTargetProjector() {
    }

    /**
     * @param seg         the covering recept segment, or {@code null} when no goal covers the date
     * @param trainingDay lazily probed schedule-derived day type; only called for a split segment
     * @param fallback    the static per-field config targets used wherever the segment is silent
     * @return the date's targets; {@code source} is {@code "goal"} iff a segment covered the date
     */
    public static DailyTargets project(
        GoalPrescriptionJson.Segment seg,
        BooleanSupplier trainingDay,
        NutritionTargetsProperties fallback) {

        if (seg == null) {
            return DailyTargets.fromConfig(fallback);
        }
        Integer dayKcal = dayTypeKcal(seg, trainingDay);
        int carbDeltaG = dayKcal == null ? 0 : Math.round((dayKcal - seg.kcal()) / 4f);
        int kcal = dayKcal != null ? dayKcal : (seg.kcal() != null ? seg.kcal() : fallback.kcal());
        return new DailyTargets(
            kcal,
            seg.proteinG() != null ? seg.proteinG() : fallback.p(),
            (seg.carbsG() != null ? seg.carbsG() : fallback.c()) + carbDeltaG,
            seg.fatG() != null ? seg.fatG() : fallback.f(),
            "goal");
    }

    /** The day-type kcal the date serves, or {@code null} when the segment carries no usable split. */
    private static Integer dayTypeKcal(GoalPrescriptionJson.Segment seg, BooleanSupplier trainingDay) {
        if (seg.kcal() == null || (seg.trainingDayKcal() == null && seg.restDayKcal() == null)) {
            return null;
        }
        return trainingDay.getAsBoolean() ? seg.trainingDayKcal() : seg.restDayKcal();
    }
}
