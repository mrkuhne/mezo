package io.mrkuhne.mezo.feature.nutrition.service;

import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;

/**
 * The day's resolved macro targets the scorer judges against (mezo-3g5w, diet-plan slice 2).
 * Nutrition-owned carrier so {@link MealScoringService} stays pure and never resolves goals
 * itself — the caller (meal slice) supplies it. {@code source} feeds the provenance tool row:
 * {@code "config"} (static fallback) or {@code "goal"} (active-goal prescription segment).
 *
 * <p>{@code energy} (mezo-32m82) is the served target's equation, {@code null} on the config path
 * or when the goal carries no biometric snapshot ({@link EnergyBase}).
 */
public record DailyTargets(int kcal, int p, int c, int f, String source, Energy energy) {

    /**
     * Alap ({@code baseKcal}, BMR × NEAT) + Mozgás ({@code plannedMovementKcal}, the LOGGED planned
     * sessions' net kcal; {@code extraMovementKcal}, unplanned logged net kcal) + Célod
     * ({@code balanceKcal}, the goal's deficit/surplus, which also absorbs the BMR floor) =
     * {@code targetKcal}. Always closes (mezo-tb3s2). {@code pendingMovementKcal} previews today's
     * planned-but-unlogged sessions at the moderate band — display only, never in the sum; null
     * when nothing is pending.
     *
     * <p>Provenance of Alap (mezo-zz91i): {@code baseSource} ({@code "formula"}|{@code "learned"}),
     * {@code formulaBaseKcal} (BMR × NEAT, shown next to a learned base), {@code baseSdKcal} and
     * {@code baseConfidence} (LOW|MEDIUM|HIGH; both null for formula). Display only — not arithmetic.
     */
    public record Energy(int baseKcal, int plannedMovementKcal, int extraMovementKcal, int balanceKcal, int targetKcal,
                         Integer pendingMovementKcal, String baseSource, Integer formulaBaseKcal, Integer baseSdKcal, String baseConfidence) {
    }

    public static DailyTargets fromConfig(NutritionTargetsProperties t) {
        return new DailyTargets(t.kcal(), t.p(), t.c(), t.f(), "config", null);
    }
}
