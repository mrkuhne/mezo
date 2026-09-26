package io.mrkuhne.mezo.feature.nutrition.service;

import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import java.math.RoundingMode;
import java.util.function.Supplier;

/**
 * The ONE rule turning a goal-recept segment into the macro targets a single date serves — pure,
 * nutrition-owned, no I/O. Extracted from {@code FuelDayService} (mezo-u2pd) so the Fuel-day hero,
 * the meal scorer, the diet-settings draft preview and the character reads all project
 * identically; a surface that re-derived the day type or the config fallback on its own could
 * show numbers the day never serves.
 *
 * <p>The served target (mezo-32m82):
 * <pre>
 *   dayKcal = split segment ? (PLANNED training done ? trainingDayKcal : restDayKcal) : seg.kcal
 *   target  = max(BMR, dayKcal + extraKcal)
 *   carbs   = segCarbs + round((target − seg.kcal) / 4)
 * </pre>
 * The day-type pick keys on a <b>planned</b> session actually logged (the weekly plan already
 * budgets planned movement into the segment); unplanned logged movement arrives as its net
 * {@code extraKcal} on top. The BMR floor applies whenever the goal carries a biometric snapshot
 * ({@link EnergyBase}). Every kcal delta lands in carbs (ISSN), derived at serve time and never
 * stored. The {@link DailyTargets.Energy} breakdown always closes: base + planned + extra +
 * balance = target, with the floor and any negative planned share folded into the balance.
 *
 * <p>The movement probe is a {@link Supplier} because it is a DB round-trip the config path (no
 * covering segment) must not pay.
 */
public final class DayTargetProjector {

    private DayTargetProjector() {
    }

    /**
     * @param seg      the covering recept segment, or {@code null} when no goal covers the date
     * @param base     the goal snapshot's BMR / BMR × NEAT, or {@code null} (no floor, no breakdown)
     * @param movement lazily probed planned-done flag + unplanned extra kcal for the date
     * @param fallback the static per-field config targets used wherever the segment is silent
     * @return the date's targets; {@code source} is {@code "goal"} iff a segment covered the date
     */
    public static DailyTargets project(GoalPrescriptionJson.Segment seg, EnergyBase base,
        Supplier<WorkoutWindowQueryService.DayMovement> movement, NutritionTargetsProperties fallback) {
        if (seg == null || seg.kcal() == null) {
            return seg == null ? DailyTargets.fromConfig(fallback) : legacy(seg, fallback);
        }
        WorkoutWindowQueryService.DayMovement m = movement.get();
        boolean split = seg.trainingDayKcal() != null || seg.restDayKcal() != null;
        Integer picked = split ? (m.plannedDone() ? seg.trainingDayKcal() : seg.restDayKcal()) : null;
        int dayKcal = picked != null ? picked : seg.kcal();
        int kcal = dayKcal + m.extraKcal();
        if (base != null) {
            kcal = Math.max(kcal, base.bmr().setScale(0, RoundingMode.HALF_UP).intValueExact());
        }
        int carbDeltaG = Math.round((kcal - seg.kcal()) / 4f);
        return new DailyTargets(kcal,
            seg.proteinG() != null ? seg.proteinG() : fallback.p(),
            (seg.carbsG() != null ? seg.carbsG() : fallback.c()) + carbDeltaG,
            seg.fatG() != null ? seg.fatG() : fallback.f(),
            "goal", energy(base, seg, dayKcal, m.extraKcal(), kcal));
    }

    /** Alap + Mozgás (planned share + extra) + Célod = target; the floor and any negative planned share land in Célod. */
    private static DailyTargets.Energy energy(EnergyBase base, GoalPrescriptionJson.Segment seg, int dayKcal, int extra, int target) {
        if (base == null) {
            return null;
        }
        int baseKcal = base.neatBaselineKcal().setScale(0, RoundingMode.HALF_UP).intValueExact();
        int segBalance = seg.dailyEnergyBalanceKcal() != null ? seg.dailyEnergyBalanceKcal() : 0;
        int planned = Math.max(0, dayKcal - baseKcal - segBalance);
        int balance = target - baseKcal - planned - extra;
        return new DailyTargets.Energy(baseKcal, planned, extra, balance, target);
    }

    /** A segment without kcal (malformed/legacy): per-field config fallback, no breakdown. */
    private static DailyTargets legacy(GoalPrescriptionJson.Segment seg, NutritionTargetsProperties fallback) {
        return new DailyTargets(fallback.kcal(),
            seg.proteinG() != null ? seg.proteinG() : fallback.p(),
            seg.carbsG() != null ? seg.carbsG() : fallback.c(),
            seg.fatG() != null ? seg.fatG() : fallback.f(), "goal", null);
    }
}
