package io.mrkuhne.mezo.feature.nutrition.service;

import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;

/**
 * The day's resolved macro targets the scorer judges against (mezo-3g5w, diet-plan slice 2).
 * Nutrition-owned carrier so {@link MealScoringService} stays pure and never resolves goals
 * itself — the caller (meal slice) supplies it. {@code source} feeds the provenance tool row:
 * {@code "config"} (static fallback) or {@code "goal"} (active-goal prescription segment).
 */
public record DailyTargets(int kcal, int p, int c, int f, String source) {

    public static DailyTargets fromConfig(NutritionTargetsProperties t) {
        return new DailyTargets(t.kcal(), t.p(), t.c(), t.f(), "config");
    }
}
