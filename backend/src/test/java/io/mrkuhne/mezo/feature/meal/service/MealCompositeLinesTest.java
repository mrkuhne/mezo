package io.mrkuhne.mezo.feature.meal.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService.ScoredLine;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * The composite expansion's own arithmetic (mezo-tm3sb).
 *
 * <p>Why this file exists: a meal logged from a recipe stored ONE row for the whole recipe, so the
 * scorer judged five ingredients by a single dominant-NOVA stamp and saw no gram amount at all.
 * These are pure rounds — no Spring, no database — because the scaling is where this can silently
 * go wrong: grams must NOT carry the amount/per term that the macros do.
 */
class MealCompositeLinesTest {

    /** Two servings; the log took one. Zab 70 g @ 371 kcal/100 g, túró 200 g @ 130 kcal/100 g. */
    private static final BigDecimal ONE_SERVING = BigDecimal.ONE;

    @Test
    void oneServingOfATwoServingRecipeHalvesEveryIngredient() {
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.twoServingOatmeal(), Map.of(), ONE_SERVING, RecipeFixtures.pantry());
        assertThat(lines).hasSize(2);
        // zab: 70 g / 2 servings = 35 g of mass, and 371 kcal per 100 g → 129.85 kcal
        assertThat(lines.get(0).amountG()).isEqualByComparingTo("35");
        assertThat(lines.get(0).kcal()).isEqualByComparingTo("129.85");
    }

    @Test
    void gramsDoNotCarryTheAmountPerTerm() {
        // THE trap: the macro factor is amount/per, the gram factor is not. A 100 g basis with a
        // 70 g line must yield 35 g of mass for a half serving — never 35 × (70/100) = 24.5 g.
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.twoServingOatmeal(), Map.of(), ONE_SERVING, RecipeFixtures.pantry());
        assertThat(lines.get(0).amountG()).isEqualByComparingTo("35");
    }

    @Test
    void eachIngredientCarriesItsOwnNovaAndCategory() {
        // This is the whole point: the stack can no longer be 100% of one group.
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.twoServingOatmeal(), Map.of(), ONE_SERVING, RecipeFixtures.pantry());
        assertThat(lines).extracting(ScoredLine::nova).containsExactly((short) 1, (short) 3);
        assertThat(lines).extracting(ScoredLine::category).containsExactly("grains", "dairy");
    }

    @Test
    void aLineDroppedToZeroContributesNoLineAtAll() {
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.twoServingOatmeal(), Map.of(1, BigDecimal.ZERO), ONE_SERVING,
            RecipeFixtures.pantry());
        assertThat(lines).hasSize(1);
        assertThat(lines.get(0).nova()).isEqualTo((short) 1);
    }

    @Test
    void anOverriddenAmountScalesThatLineOnly() {
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.twoServingOatmeal(), Map.of(0, new BigDecimal("140")), ONE_SERVING,
            RecipeFixtures.pantry());
        assertThat(lines.get(0).amountG()).isEqualByComparingTo("70");  // 140 / 2 servings
        assertThat(lines.get(1).amountG()).isEqualByComparingTo("100"); // untouched: 200 / 2
    }

    @Test
    void twoServingsLoggedDoubleTheWholeExpansion() {
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.twoServingOatmeal(), Map.of(), new BigDecimal("2"),
            RecipeFixtures.pantry());
        assertThat(lines.get(0).amountG()).isEqualByComparingTo("70");
    }

    @Test
    void aDiscreteUnitYieldsNoGramsButKeepsItsMacros() {
        // "2 db tojás": honest null mass, so energy_density degrades rather than lying.
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.eggRecipe(), Map.of(), ONE_SERVING, RecipeFixtures.pantry());
        assertThat(lines.get(0).amountG()).isNull();
        assertThat(lines.get(0).kcal()).isGreaterThan(BigDecimal.ZERO);
    }

    @Test
    void aMissingPantryRowLeavesNovaAndCategoryNullWithoutLosingTheLine() {
        // A since-deleted pantry row must lower coverage, not delete what was eaten.
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.twoServingOatmeal(), Map.of(), ONE_SERVING, Map.of());
        assertThat(lines).hasSize(2);
        assertThat(lines).allSatisfy(l -> {
            assertThat(l.nova()).isNull();
            assertThat(l.category()).isNull();
        });
    }

    @Test
    void theAmountLabelNamesWhatWasActuallyEaten() {
        // The NOVA item receipt reads "Zabpehely 35g" — the SCALED amount, not the recipe's 70 g,
        // because the row describes this meal rather than the template it came from.
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.twoServingOatmeal(), Map.of(), ONE_SERVING, RecipeFixtures.pantry());
        assertThat(lines).extracting(ScoredLine::amountLabel).containsExactly("35g", "100g");
        assertThat(lines).extracting(ScoredLine::name).containsExactly("Zabpehely", "Túró");
    }

    @Test
    void theNutritionFactsScaleWithTheMacrosAndStayNullWhenAbsent() {
        // Facts ride the macro factor (0.35 for the zab line) — and a snapshot that carried no
        // value must stay null all the way into the scorer, never flatten to 0 (mezo-1f7b).
        List<ScoredLine> lines = MealCompositeLines.expandRecipeItem(
            RecipeFixtures.twoServingOatmeal(), Map.of(), ONE_SERVING, RecipeFixtures.pantry());
        // fiber 10.1 g / 100 g × 70 g ÷ 2 servings = 3.535 g
        assertThat(lines.get(0).fiberG()).isEqualByComparingTo("3.535");

        RecipeEntity stripped = RecipeFixtures.twoServingOatmeal();
        stripped.getLines().get(0).setSnapshotFiberG(null);
        List<ScoredLine> nulled = MealCompositeLines.expandRecipeItem(
            stripped, Map.of(), ONE_SERVING, RecipeFixtures.pantry());
        assertThat(nulled.get(0).fiberG()).isNull();
    }
}
