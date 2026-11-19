package io.mrkuhne.mezo.feature.nutrition.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.config.MealScoringProperties;
import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService.ScoredLine;
import io.mrkuhne.mezo.techcore.message.UserMessages;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Pure-math unit test (no Spring) of the FOOD surface of the score engine (mezo-r36n9.63): one food,
 * judged by itself on the five dimensions that need no meal around them. The rule under test is the
 * engine's own honesty rule — a missing fact degrades its dimension (weight 0, "nincs adat"), never
 * scores as a 0 — and the total is the normal weighting renormalised over what could be computed.
 */
class FoodBreakdownTest {

    private final NutritionTargetsProperties targets =
        new NutritionTargetsProperties(3100, 220, 380, 95, 4000);

    private final MealScoringProperties props = new MealScoringProperties(
        new MealScoringProperties.Weights(0.22, 0.10, 0.14, 0.10, 0.18, 0.08, 0.06, 0.12, 0.12),
        new MealScoringProperties.NovaGroupScores(1.0, 0.85, 0.55, 0.20),
        2.0,
        0.0,
        0.25,
        new MealScoringProperties.MicroRefs(38),
        new MealScoringProperties.WhoRefs(0.10, 5),
        new MealScoringProperties.FatQualityRefs(0.10, 0.33),
        new MealScoringProperties.PlantDiversityRefs(3,
            List.of("vegetables", "fruits", "grains", "legumes", "nuts_seeds")),
        new MealScoringProperties.EnergyDensityRefs(150, 400, 100),
        new MealScoringProperties.PortionRefs(0.30),
        new MealScoringProperties.SlotShares(0.25, 0.35, 0.30, 0.10),
        new MealScoringProperties.SlotWindows(5, 10, 11, 15, 17, 22),
        0.4,
        0.25,
        120,
        90,
        new MealScoringProperties.Roles(
            new MealScoringProperties.RoleRubric(150, 550, 60,
                new MealScoringProperties.WhoRefs(0.30, 5),
                new MealScoringProperties.NovaGroupScores(1.0, 0.9, 0.8, 0.6)),
            new MealScoringProperties.RoleRubric(300, 480, 70,
                new MealScoringProperties.WhoRefs(0.20, 5),
                new MealScoringProperties.NovaGroupScores(1.0, 0.88, 0.7, 0.45))));

    private final MealScoringService service = new MealScoringService(props, targets, UserMessages.fixed("hu"));

    private static BigDecimal bd(double v) {
        return BigDecimal.valueOf(v);
    }

    /** 100 g of rolled oats, every fact known: 372 kcal, NOVA 1. */
    private static ScoredLine oats() {
        return new ScoredLine("Zabpehely", "100 g", bd(372), bd(13.5), bd(58.7), bd(7), (short) 1,
            bd(10), bd(1.2), bd(0.02), bd(1.3), "grains", bd(100));
    }

    private static MealBreakdownJson.Dimension dim(MealBreakdownJson b, String id) {
        return b.dimensions().stream().filter(d -> d.id().equals(id)).findFirst().orElseThrow();
    }

    private static double weightSum(MealBreakdownJson b) {
        return b.dimensions().stream().mapToDouble(d -> d.weight().doubleValue()).sum();
    }

    @Test
    void testFoodBreakdown_shouldScoreTheFiveFoodDimensions_whenAllFactsKnown() {
        MealBreakdownJson b = service.foodBreakdown(oats());

        // Only what judges a food by itself — never macro balance, plant diversity, context or portion.
        assertThat(b.dimensions()).extracting(MealBreakdownJson.Dimension::id)
            .containsExactly("micro", "who", "fat_quality", "nova", "energy_density");
        assertThat(b.dimensions()).allSatisfy(d -> assertThat(d.weight().doubleValue()).isPositive());
        // The engine's own weights (.10 / .14 / .10 / .18 / .06), renormalised over the five.
        assertThat(dim(b, "micro").weight()).isEqualByComparingTo("0.17");
        assertThat(dim(b, "who").weight()).isEqualByComparingTo("0.24");
        assertThat(dim(b, "fat_quality").weight()).isEqualByComparingTo("0.17");
        assertThat(dim(b, "nova").weight()).isEqualByComparingTo("0.31");
        assertThat(dim(b, "energy_density").weight()).isEqualByComparingTo("0.10");
        assertThat(weightSum(b)).isCloseTo(1.0, org.assertj.core.data.Offset.offset(0.02));
        assertThat(b.confidence()).isEqualByComparingTo("1.00");
        assertThat(b.formulaVersion()).isEqualTo(MealScoringService.FORMULA_VERSION);
        assertThat(b.summary()).isNull(); // deterministic only: no prose is invented
        assertThat(b.improve()).isEmpty();
    }

    @Test
    void testFoodBreakdown_shouldEqualTheEnginesOwnPerDimensionScores() {
        // The same line as a one-item recipe template: every shared dimension must score identically —
        // the food surface reuses the engine's dimension code, it does not re-implement it.
        MealBreakdownJson food = service.foodBreakdown(oats());
        MealBreakdownJson template = service.recipeTemplateBreakdown("breakfast", List.of(oats()));

        for (String id : List.of("micro", "who", "fat_quality", "nova", "energy_density")) {
            assertThat(dim(food, id).score()).as(id).isEqualByComparingTo(dim(template, id).score());
            assertThat(dim(food, id).detail()).as(id).isEqualTo(dim(template, id).detail());
        }
        // value = Σ weight·score over the five, weights renormalised (unrounded inside the engine)
        double expected = (0.10 * dim(food, "micro").score().doubleValue()
            + 0.14 * dim(food, "who").score().doubleValue()
            + 0.10 * dim(food, "fat_quality").score().doubleValue()
            + 0.18 * dim(food, "nova").score().doubleValue()
            + 0.06 * dim(food, "energy_density").score().doubleValue()) / 0.58;
        assertThat(food.value().doubleValue()).isCloseTo(expected, org.assertj.core.data.Offset.offset(0.011));
    }

    @Test
    void testFoodBreakdown_shouldDegradeMissingFacts_neverScoreThemAsZero() {
        // Macros and NOVA only — no fibre, sugar, salt or saturated fat on the row.
        ScoredLine bare = new ScoredLine("Csirkemell", "100 g", bd(110), bd(23), bd(0), bd(1.5), (short) 1,
            null, null, null, null, "meat", bd(100));

        MealBreakdownJson b = service.foodBreakdown(bare);

        for (String id : List.of("micro", "who", "fat_quality")) {
            assertThat(dim(b, id).weight()).as(id).isEqualByComparingTo("0");
            assertThat(dim(b, id).coverage()).as(id).isEqualByComparingTo("0");
        }
        // The total is carried by what IS known — NOVA 1 (1.0) and a low energy density (1.0) — so the
        // missing facts did not drag it down as zeros would have.
        assertThat(dim(b, "nova").weight()).isEqualByComparingTo("0.75");
        assertThat(dim(b, "energy_density").weight()).isEqualByComparingTo("0.25");
        assertThat(b.value()).isEqualByComparingTo("1.00");
    }

    @Test
    void testFoodBreakdown_shouldScoreAnEstimatedFoodWithoutNova() {
        // What the quick-add leaves behind: estimated facts, NOVA never guessed.
        ScoredLine estimate = new ScoredLine("Kurkuma", "100 g", bd(354), bd(7.8), bd(64.9), bd(9.9), null,
            bd(21.1), bd(3.2), bd(0.1), bd(3.1), null, bd(100));

        MealBreakdownJson b = service.foodBreakdown(estimate);

        assertThat(dim(b, "nova").weight()).isEqualByComparingTo("0"); // no data, not "ultra-processed"
        assertThat(dim(b, "nova").coverage()).isEqualByComparingTo("0");
        assertThat(dim(b, "micro").weight().doubleValue()).isPositive();
        assertThat(dim(b, "who").weight().doubleValue()).isPositive();
        assertThat(dim(b, "fat_quality").weight().doubleValue()).isPositive();
        assertThat(dim(b, "energy_density").weight().doubleValue()).isPositive();
        assertThat(weightSum(b)).isCloseTo(1.0, org.assertj.core.data.Offset.offset(0.02));
        assertThat(b.value().doubleValue()).isBetween(0.0, 1.0);
    }

    @Test
    void testFoodBreakdown_shouldDegradeEnergyDensityForAFoodCountedInPieces() {
        // 1 db egg: no gram mass on the row, so kcal/100 g cannot be stated.
        ScoredLine egg = new ScoredLine("Tojás", "1 db", bd(78), bd(6.3), bd(0.6), bd(5.3), (short) 1,
            bd(0), bd(0.6), bd(0.2), bd(1.6), "eggs", null);

        MealBreakdownJson b = service.foodBreakdown(egg);

        assertThat(dim(b, "energy_density").weight()).isEqualByComparingTo("0");
        assertThat(dim(b, "nova").weight().doubleValue()).isPositive();
        assertThat(b.value()).isNotNull();
    }

    @Test
    void testFoodBreakdown_shouldBeNullWhenNothingCanBeComputed() {
        ScoredLine noEnergy = new ScoredLine("Víz", "100 ml", bd(0), bd(0), bd(0), bd(0), (short) 1,
            bd(0), bd(0), bd(0), bd(0), "beverages", bd(100));
        ScoredLine unknown = new ScoredLine("Ismeretlen", "1 db", null, null, null, null, null,
            null, null, null, null, null, null);
        // kcal known, but no fact, no NOVA and no gram mass: no dimension has anything to read.
        ScoredLine blind = new ScoredLine("Valami", "1 db", bd(200), bd(5), bd(20), bd(10), null,
            null, null, null, null, null, null);

        assertThat(service.foodBreakdown(noEnergy)).isNull();
        assertThat(service.foodBreakdown(unknown)).isNull();
        assertThat(service.foodBreakdown(blind)).isNull();
    }

    @Test
    void testFoodBreakdowns_shouldScoreEachFoodIndependently() {
        ScoredLine blind = new ScoredLine("Valami", "1 db", bd(200), null, null, null, null,
            null, null, null, null, null, null);

        List<MealBreakdownJson> all = service.foodBreakdowns(List.of(oats(), blind, oats()));

        assertThat(all).hasSize(3);
        assertThat(all.get(1)).isNull();
        assertThat(all.get(0).value()).isEqualByComparingTo(service.foodBreakdown(oats()).value());
        assertThat(all.get(2).value()).isEqualByComparingTo(all.get(0).value());
    }
}
