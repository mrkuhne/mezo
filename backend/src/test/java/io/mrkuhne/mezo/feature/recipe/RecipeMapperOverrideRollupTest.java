package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.Nutrients;
import io.mrkuhne.mezo.api.dto.RecipeMacros;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
import io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapper;
import io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapperImpl;
import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * The override-aware rollup is the SINGLE macro formula (mezo-ormb): round per line, then sum
 * (mezo-8xy). Fixture mirrors RecipePopulator — two lines, snapshotPer 100, 110/13/4/4.5:
 * Túró 250 g -> factor 2.5 -> 275/32.5/10/11.25 -> round 275/33/10/11
 * Méz   20 g -> factor 0.2 ->  22/2.6/0.8/0.9   -> round  22/3/1/1
 * whole = 297/36/11/12.
 */
class RecipeMapperOverrideRollupTest {

    private final RecipeMapper mapper = new RecipeMapperImpl();

    private RecipeIngredientEntity line(int order, String amount) {
        RecipeIngredientEntity l = new RecipeIngredientEntity();
        l.setLineOrder(order);
        l.setPantryItemId(UUID.randomUUID());
        l.setAmount(new BigDecimal(amount));
        l.setUnit("g");
        l.setSnapshotName("line" + order);
        l.setSnapshotPer(new BigDecimal("100"));
        l.setSnapshotBasisUnit("g");
        l.setSnapshotKcal(new BigDecimal("110"));
        l.setSnapshotProteinG(new BigDecimal("13.0"));
        l.setSnapshotCarbsG(new BigDecimal("4.0"));
        l.setSnapshotFatG(new BigDecimal("4.5"));
        return l;
    }

    private RecipeEntity recipe() {
        RecipeEntity r = new RecipeEntity();
        r.setServings(2);
        r.getLines().add(line(0, "250"));
        r.getLines().add(line(1, "20"));
        return r;
    }

    /** Two lines: line0 (200 g of a per-100g source) carries all four nutrient facts, line1 carries none. */
    private RecipeEntity recipeWithTwoLines() {
        RecipeEntity r = new RecipeEntity();
        r.setServings(2);
        RecipeIngredientEntity l0 = line(0, "200");
        l0.setSnapshotFiberG(new BigDecimal("3.2"));
        l0.setSnapshotSugarG(new BigDecimal("4.1"));
        l0.setSnapshotSaltG(new BigDecimal("0.4"));
        l0.setSnapshotSaturatedFatG(new BigDecimal("2.8"));
        r.getLines().add(l0);
        r.getLines().add(line(1, "50"));
        return r;
    }

    @Test
    void testRollupWithOverrides_shouldEqualTheStoredRollup_whenMapIsEmpty() {
        RecipeMacros m = mapper.rollupWithOverrides(recipe(), Map.of());

        assertThat(m.getKcal()).isEqualByComparingTo("297");
        assertThat(m.getP()).isEqualByComparingTo("36");
        assertThat(m.getC()).isEqualByComparingTo("11");
        assertThat(m.getF()).isEqualByComparingTo("12");
    }

    @Test
    void testRollupWithOverrides_shouldDropTheLine_whenAmountIsZero() {
        RecipeMacros m = mapper.rollupWithOverrides(recipe(), Map.of(1, BigDecimal.ZERO));

        // only Túró 250 g remains -> 275/33/10/11
        assertThat(m.getKcal()).isEqualByComparingTo("275");
        assertThat(m.getP()).isEqualByComparingTo("33");
        assertThat(m.getC()).isEqualByComparingTo("10");
        assertThat(m.getF()).isEqualByComparingTo("11");
    }

    @Test
    void testRollupWithOverrides_shouldScaleTheLine_whenAmountIsHalved() {
        // Túró 125 g -> factor 1.25 -> 137.5/16.25/5/5.625 -> round 138/16/5/6
        // Méz still 22/3/1/1 -> sum 160/19/6/7.
        RecipeMacros m = mapper.rollupWithOverrides(recipe(), Map.of(0, new BigDecimal("125")));

        assertThat(m.getKcal()).isEqualByComparingTo("160");
        assertThat(m.getP()).isEqualByComparingTo("19");
        assertThat(m.getC()).isEqualByComparingTo("6");
        assertThat(m.getF()).isEqualByComparingTo("7");
    }

    @Test
    void testRollupWithOverrides_shouldRoundEachLineBeforeSumming_whenBothLinesRoundDown() {
        // THE rounding-order guard (mezo-8xy). Both lines at 4 g:
        //   per line   kcal 110 × 0.04 = 4.4  -> 4  ; p 13.0 × 0.04 = 0.52 -> 1
        //   round-per-line-then-sum : kcal 4+4  = 8      ; p 1+1  = 2
        //   sum-then-round-once     : kcal 8.8  -> 9     ; p 1.04 -> 1
        // The two strategies disagree on BOTH macros here, which is exactly what makes this a
        // real guard. NOTE the halved-amount case above canNOT do this job: 137.5 + 22.0 = 159.5,
        // which HALF_UP rounds to 160 either way — it passes under both strategies.
        RecipeMacros m = mapper.rollupWithOverrides(recipe(),
            Map.of(0, new BigDecimal("4"), 1, new BigDecimal("4")));

        assertThat(m.getKcal()).isEqualByComparingTo("8");
        assertThat(m.getP()).isEqualByComparingTo("2");
    }

    @Test
    void testRollupNutrientsWithOverrides_shouldEqualStoredRollup_whenOverridesEmpty() {
        RecipeEntity recipe = recipeWithTwoLines();

        Nutrients empty = mapper.rollupNutrientsWithOverrides(recipe, Map.of());
        Nutrients stored = mapper.toResponse(recipe).getNutrients();

        assertThat(empty.getFiberG()).isEqualByComparingTo(stored.getFiberG());
        assertThat(empty.getSugarG()).isEqualByComparingTo(stored.getSugarG());
        assertThat(empty.getSaltG()).isEqualByComparingTo(stored.getSaltG());
        assertThat(empty.getSaturatedFatG()).isEqualByComparingTo(stored.getSaturatedFatG());
    }

    @Test
    void testRollupNutrientsWithOverrides_shouldRescaleOnlyTheOverriddenLine() {
        RecipeEntity recipe = recipeWithTwoLines(); // line0: 200 g with facts

        Nutrients halved = mapper.rollupNutrientsWithOverrides(recipe, Map.of(0, new BigDecimal("100")));

        assertThat(halved.getFiberG()).isEqualByComparingTo("3.2"); // factor 1 instead of 2
    }
}
