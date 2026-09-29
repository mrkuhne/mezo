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
 * identically; a surface that re-derived the movement credit or the config fallback on its own could
 * show numbers the day never serves.
 *
 * <p>The served target (mezo-tb3s2, spec §2 — replacing the mezo-32m82 day-type pick):
 * <pre>
 *   movement = Σ net kcal of the date's LOGGED sessions (planned + unplanned)
 *   target   = max(BMR, base + movement + balance)        base = EnergyBase.neatBaselineKcal
 *   carbs    = segCarbs + round((target − seg.kcal) / 4)
 *   pending  = today's planned-but-unlogged sessions at the moderate band (display only)
 * </pre>
 * {@code balance} is the segment's {@code dailyEnergyBalanceKcal} (goal pace + accepted
 * adjustments), independent of movement. The segment's {@code kcal} stays the weekly PLANNING
 * number (the carb-delta anchor); a legacy {@code trainingDayKcal}/{@code restDayKcal} split is
 * ignored. Every live caller (Fuel day, meal scorer, settings preview, character reads) passes the
 * goal's {@link EnergyBase}; only a bootstrap-less snapshot (no BMR / base recorded) falls back to
 * the pre-mezo-tb3s2 shape: {@code seg.kcal + extraKcal}, no floor, no breakdown. Every kcal delta lands in carbs (ISSN),
 * derived at serve time and never stored. The {@link DailyTargets.Energy} breakdown always closes:
 * base + planned + extra + balance = target, with the BMR floor folded into the balance.
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
     * @param movement lazily probed logged planned/extra kcal (+ display-only pending) for the date
     * @param fallback the static per-field config targets used wherever the segment is silent
     * @return the date's targets; {@code source} is {@code "goal"} iff a segment covered the date
     */
    public static DailyTargets project(GoalPrescriptionJson.Segment seg, EnergyBase base,
        Supplier<WorkoutWindowQueryService.DayMovement> movement, NutritionTargetsProperties fallback) {
        if (seg == null || seg.kcal() == null) {
            return seg == null ? DailyTargets.fromConfig(fallback) : legacy(seg, fallback);
        }
        WorkoutWindowQueryService.DayMovement m = movement.get();
        int segBalance = seg.dailyEnergyBalanceKcal() != null ? seg.dailyEnergyBalanceKcal() : 0;
        int kcal;
        if (base != null) {
            int baseKcal = base.neatBaselineKcal().setScale(0, RoundingMode.HALF_UP).intValueExact();
            kcal = Math.max(baseKcal + m.movementKcal() + segBalance,
                base.bmr().setScale(0, RoundingMode.HALF_UP).intValueExact());
        } else {
            kcal = seg.kcal() + m.extraKcal();   // bootstrap-less snapshot: the pre-mezo-tb3s2 shape
        }
        int carbDeltaG = Math.round((kcal - seg.kcal()) / 4f);
        return new DailyTargets(kcal,
            seg.proteinG() != null ? seg.proteinG() : fallback.p(),
            (seg.carbsG() != null ? seg.carbsG() : fallback.c()) + carbDeltaG,
            seg.fatG() != null ? seg.fatG() : fallback.f(),
            "goal", energy(base, m, kcal));
    }

    /** Alap + Mozgás (logged planned + extra) + Célod = target; the BMR floor lands in Célod. */
    private static DailyTargets.Energy energy(EnergyBase base, WorkoutWindowQueryService.DayMovement m, int target) {
        if (base == null) {
            return null;
        }
        int baseKcal = base.neatBaselineKcal().setScale(0, RoundingMode.HALF_UP).intValueExact();
        int balance = target - baseKcal - m.plannedKcal() - m.extraKcal();
        return new DailyTargets.Energy(baseKcal, m.plannedKcal(), m.extraKcal(), balance, target,
            m.pendingKcal() > 0 ? m.pendingKcal() : null,
            base.baseSource(), base.formulaBaseKcal(), base.sdKcal(), base.confidence());
    }

    /** A segment without kcal (malformed/legacy): per-field config fallback, no breakdown. */
    private static DailyTargets legacy(GoalPrescriptionJson.Segment seg, NutritionTargetsProperties fallback) {
        return new DailyTargets(fallback.kcal(),
            seg.proteinG() != null ? seg.proteinG() : fallback.p(),
            seg.carbsG() != null ? seg.carbsG() : fallback.c(),
            seg.fatG() != null ? seg.fatG() : fallback.f(), "goal", null);
    }
}
