package io.mrkuhne.mezo.feature.nutrition.config;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.Valid;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Binds {@code mezo.fuel.scoring.*} — every tunable of the deterministic meal-score v0
 * (mezo-yta, ADR 0006). The 4-dimension weighted model: Macro · Micro · NOVA · Context.
 * See docs/superpowers/specs/2026-07-05-fuel-p7-meal-scoring-design.md §3 for the formulas.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.fuel.scoring")
public record MealScoringProperties(
    @NotNull @Valid Weights weights,
    @NotNull @Valid NovaGroupScores nova,
    /** Macro fit: score = max(0, 1 − totalVariation(meal vs target kcal-shares) × slope). */
    @DecimalMin("0.5") @DecimalMax("10.0") double macroDeviationSlope,
    @NotNull @Valid MicroRefs micro,
    @NotNull @Valid SlotShares slotShares,
    @NotNull @Valid SlotWindows slotWindows,
    /** Relative tolerance around the slot kcal-share within which the fit is perfect (0..1). */
    @DecimalMin("0.0") @DecimalMax("1.0") double slotShareTolerance
) {

    /** Dimension weights — must sum to 1.0 (a degraded dimension renormalizes at compute time). */
    public record Weights(
        @DecimalMin("0.0") @DecimalMax("1.0") double macro,
        @DecimalMin("0.0") @DecimalMax("1.0") double micro,
        @DecimalMin("0.0") @DecimalMax("1.0") double nova,
        @DecimalMin("0.0") @DecimalMax("1.0") double context
    ) {
        @AssertTrue(message = "mezo.fuel.scoring.weights must sum to 1.0")
        public boolean isNormalized() {
            return Math.abs(macro + micro + nova + context - 1.0) < 1e-6;
        }
    }

    /** Quality score per NOVA processing class (1 unprocessed … 4 ultra-processed). */
    public record NovaGroupScores(
        @DecimalMin("0.0") @DecimalMax("1.0") double group1,
        @DecimalMin("0.0") @DecimalMax("1.0") double group2,
        @DecimalMin("0.0") @DecimalMax("1.0") double group3,
        @DecimalMin("0.0") @DecimalMax("1.0") double group4
    ) {
        public double of(int novaGroup) {
            return switch (novaGroup) {
                case 1 -> group1;
                case 2 -> group2;
                case 3 -> group3;
                default -> group4;
            };
        }
    }

    /**
     * Daily nutrition-quality references; the per-meal allotment scales by the meal's kcal-share.
     * Fiber is a TARGET (more is better up to the allotment), the rest are LIMITS (less is better).
     */
    public record MicroRefs(
        @DecimalMin("1.0") double fiberG,
        @DecimalMin("1.0") double sugarLimitG,
        @DecimalMin("0.5") double saltLimitG,
        @DecimalMin("1.0") double saturatedFatLimitG
    ) {
    }

    /** Expected kcal-share of the day per meal slot (context dimension). */
    public record SlotShares(
        @DecimalMin("0.0") @DecimalMax("1.0") double breakfast,
        @DecimalMin("0.0") @DecimalMax("1.0") double lunch,
        @DecimalMin("0.0") @DecimalMax("1.0") double dinner,
        @DecimalMin("0.0") @DecimalMax("1.0") double snack
    ) {
        public double of(String slot) {
            return switch (slot) {
                case "breakfast" -> breakfast;
                case "lunch" -> lunch;
                case "dinner" -> dinner;
                default -> snack;
            };
        }
    }

    /** Local-hour windows for the slot-timing fit; a snack fits at any hour. */
    public record SlotWindows(
        @Min(0) @Max(23) int breakfastFrom, @Min(0) @Max(23) int breakfastTo,
        @Min(0) @Max(23) int lunchFrom, @Min(0) @Max(23) int lunchTo,
        @Min(0) @Max(23) int dinnerFrom, @Min(0) @Max(23) int dinnerTo
    ) {
    }
}
