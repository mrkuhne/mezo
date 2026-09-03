package io.mrkuhne.mezo.feature.nutrition.config;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Binds {@code mezo.fuel.scoring.*} — every tunable of the deterministic meal-score v0
 * (mezo-yta, ADR 0006). The 8-dimension weighted model (mezo-7797): Macro · Rost · WHO ·
 * Zsírminőség · NOVA · Növényi diverzitás · Energia-sűrűség · Context/Portion.
 * See docs/superpowers/specs/2026-07-05-fuel-p7-meal-scoring-design.md §3 for the formulas.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.fuel.scoring")
public record MealScoringProperties(
    @NotNull @Valid Weights weights,
    @NotNull @Valid NovaGroupScores nova,
    /** Macro fit: score = max(0, 1 − totalVariation(meal vs target kcal-shares) × slope). */
    @DecimalMin("0.5") @DecimalMax("10.0") double macroDeviationSlope,
    /** Penalty factor on the protein-SURPLUS side of the macro deviation: 0 = overshoot forgiven (fitness-app policy, mezo-8ms6), 1 = symmetric. Deficits always count in full. */
    @DecimalMin("0.0") @DecimalMax("1.0") double macroProteinSurplusPenalty,
    /** kcal-share of the day at (or above) which a meal's macro-ratio deviation counts in full;
     *  smaller meals scale linearly (a 100-kcal snack can no longer tank the macro dimension). */
    @DecimalMin("0.05") @DecimalMax("1.0") double macroSignificanceRefShare,
    @NotNull @Valid MicroRefs micro,
    @NotNull @Valid WhoRefs who,
    @NotNull @Valid FatQualityRefs fatQuality,
    @NotNull @Valid PlantDiversityRefs plantDiversity,
    @NotNull @Valid EnergyDensityRefs energyDensity,
    @NotNull @Valid PortionRefs portion,
    @NotNull @Valid SlotShares slotShares,
    @NotNull @Valid SlotWindows slotWindows,
    /** Relative tolerance around the slot kcal-share within which the fit is perfect (0..1). */
    @DecimalMin("0.0") @DecimalMax("1.0") double slotShareTolerance,
    /** Minutes BEFORE a workout start within which a meal is pre-workout fuel. */
    @Min(0) @Max(360) int preLeadMin,
    /** Minutes AFTER a workout end within which a meal is post-workout recovery. */
    @Min(0) @Max(360) int postTrailMin,
    @NotNull @Valid Roles roles
) {

    /** Dimension weights. Meal surface = all except portion; template = all except context; BOTH must sum to 1.0. */
    public record Weights(
        @DecimalMin("0.0") @DecimalMax("1.0") double macro,
        @DecimalMin("0.0") @DecimalMax("1.0") double micro,
        @DecimalMin("0.0") @DecimalMax("1.0") double who,
        @DecimalMin("0.0") @DecimalMax("1.0") double fatQuality,
        @DecimalMin("0.0") @DecimalMax("1.0") double nova,
        @DecimalMin("0.0") @DecimalMax("1.0") double plantDiversity,
        @DecimalMin("0.0") @DecimalMax("1.0") double energyDensity,
        @DecimalMin("0.0") @DecimalMax("1.0") double context,
        @DecimalMin("0.0") @DecimalMax("1.0") double portion
    ) {
        @AssertTrue(message = "mezo.fuel.scoring.weights: the meal surface (all except portion) must sum to 1.0")
        public boolean isMealNormalized() {
            return Math.abs(macro + micro + who + fatQuality + nova + plantDiversity + energyDensity + context - 1.0) < 1e-6;
        }

        @AssertTrue(message = "mezo.fuel.scoring.weights: the template surface (all except context) must sum to 1.0")
        public boolean isTemplateNormalized() {
            return Math.abs(macro + micro + who + fatQuality + nova + plantDiversity + energyDensity + portion - 1.0) < 1e-6;
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

    /** Daily fiber TARGET (g); the per-meal allotment scales by the meal's kcal-share. Sugar/salt/satFat moved to who/fat-quality (mezo-7797). */
    public record MicroRefs(
        @DecimalMin("1.0") double fiberG
    ) {
    }

    /** WHO guideline references: free-sugar energy-share limit (0..1) + daily salt limit (g, scaled per kcal-share). */
    public record WhoRefs(
        @DecimalMin("0.01") @DecimalMax("0.5") double sugarEnergyShareLimit,
        @DecimalMin("0.5") double saltLimitG
    ) {
    }

    /** Fat quality: saturated-fat energy-share limit (WHO ≤10 E%) + saturated share of total fat reference. */
    public record FatQualityRefs(
        @DecimalMin("0.01") @DecimalMax("0.5") double satFatEnergyShareLimit,
        @DecimalMin("0.05") @DecimalMax("1.0") double satFatShareRef
    ) {
    }

    /** Plant diversity: distinct plant categories for a full score + the category values counted as plants. */
    public record PlantDiversityRefs(
        @Min(1) @Max(10) int targetCategories,
        @NotNull List<String> plantCategories
    ) {
    }

    /** Energy density band: kcal/100g at (or below) which the score is 1.0, and at (or above) which it is 0. */
    public record EnergyDensityRefs(
        @DecimalMin("50.0") double goodKcalPer100g,
        @DecimalMin("100.0") double badKcalPer100g
    ) {
        @AssertTrue(message = "mezo.fuel.scoring.energy-density: bad must exceed good")
        public boolean isOrdered() {
            return badKcalPer100g > goodKcalPer100g;
        }
    }

    /** Portion (template-only): fallback kcal-share of the day for a slot-less recipe. */
    public record PortionRefs(
        @DecimalMin("0.05") @DecimalMax("1.0") double defaultShare
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

    /**
     * A meal-role rubric overlay (mezo-ta8p): the role-sensitive tunables that differ from the
     * standard rubric. Each role is FULLY specified (no partial merge) — the scorer picks these
     * verbatim for pre/post-workout meals; STANDARD uses the base targets/who/nova.
     */
    public record RoleRubric(
        @Min(0) int p,          // role macro target — protein grams/day (feeds macro kcal-shares)
        @Min(0) int c,          // role macro target — carbs grams/day
        @Min(0) int f,          // role macro target — fat grams/day
        @NotNull @Valid WhoRefs who,          // role WHO limits (relaxed sugar for fueling)
        @NotNull @Valid NovaGroupScores nova  // role NOVA class scores (softened processing penalty)
    ) {
    }

    /** Per-role rubric overlays; STANDARD needs none (uses the base rubric). */
    public record Roles(
        @NotNull @Valid RoleRubric pre,
        @NotNull @Valid RoleRubric post
    ) {
    }
}
