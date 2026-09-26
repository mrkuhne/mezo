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
     * Alap ({@code baseKcal}, BMR × NEAT) + Mozgás ({@code plannedMovementKcal}, the weekly plan's
     * share incl. the day-type shift, never negative; {@code extraMovementKcal}, unplanned logged
     * net kcal) + Célod ({@code balanceKcal}, the goal's deficit/surplus, which also absorbs the BMR
     * floor and any negative planned share) = {@code targetKcal}. Always closes.
     */
    public record Energy(int baseKcal, int plannedMovementKcal, int extraMovementKcal, int balanceKcal, int targetKcal) {
    }

    public static DailyTargets fromConfig(NutritionTargetsProperties t) {
        return new DailyTargets(t.kcal(), t.p(), t.c(), t.f(), "config", null);
    }
}
