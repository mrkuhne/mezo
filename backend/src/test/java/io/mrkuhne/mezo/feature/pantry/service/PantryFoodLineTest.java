package io.mrkuhne.mezo.feature.pantry.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService.ScoredLine;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/**
 * Pure unit test of "a pantry definition -> the score engine's input line" (mezo-r36n9.63). The engine
 * itself is tested in {@code FoodBreakdownTest}; here: the basis scaling and the honest nulls.
 */
class PantryFoodLineTest {

    private static PantryCatalogEntity food(String per, String unit) {
        PantryCatalogEntity c = new PantryCatalogEntity();
        c.setKind("food");
        c.setName("Zabpehely");
        c.setCategory("grains");
        c.setServingAmount(per == null ? null : new BigDecimal(per));
        c.setServingUnit(unit);
        c.setKcal(new BigDecimal("372"));
        c.setProteinG(new BigDecimal("13.5"));
        c.setCarbsG(new BigDecimal("58.7"));
        c.setFatG(new BigDecimal("7"));
        c.setFiberG(new BigDecimal("10"));
        c.setNova((short) 1);
        return c;
    }

    @Test
    void testLineOf_shouldUseThePer100BasisAsItIs() {
        ScoredLine line = PantryFoodScoreService.lineOf(food("100", "g"));

        assertThat(line.name()).isEqualTo("Zabpehely");
        assertThat(line.amountLabel()).isEqualTo("100 g");
        assertThat(line.kcal()).isEqualByComparingTo("372");
        assertThat(line.p()).isEqualByComparingTo("13.5");
        assertThat(line.fiberG()).isEqualByComparingTo("10");
        assertThat(line.amountG()).isEqualByComparingTo("100");
        assertThat(line.nova()).isEqualTo((short) 1);
        assertThat(line.category()).isEqualTo("grains");
    }

    @Test
    void testLineOf_shouldScaleAGramOrMillilitreBasisTo100() {
        PantryCatalogEntity perServing = food("30", "gramm"); // "per 30 g" row, unit spelled out
        perServing.setKcal(new BigDecimal("111.6"));
        perServing.setFiberG(new BigDecimal("3"));

        ScoredLine line = PantryFoodScoreService.lineOf(perServing);

        assertThat(line.amountLabel()).isEqualTo("100 g");
        assertThat(line.kcal()).isEqualByComparingTo("372");
        assertThat(line.fiberG()).isEqualByComparingTo("10");
        assertThat(line.amountG()).isEqualByComparingTo("100");
        assertThat(PantryFoodScoreService.lineOf(food("250", "ml")).amountLabel()).isEqualTo("100 ml");
    }

    @Test
    void testLineOf_shouldKeepAPieceBasisAndCarryNoGramMass() {
        ScoredLine piece = PantryFoodScoreService.lineOf(food("1", "db"));
        ScoredLine noBasis = PantryFoodScoreService.lineOf(food(null, null));

        assertThat(piece.amountLabel()).isEqualTo("1 db");
        assertThat(piece.kcal()).isEqualByComparingTo("372"); // per its own basis
        assertThat(piece.amountG()).isNull();                 // energy density cannot be stated
        assertThat(noBasis.amountG()).isNull();
        assertThat(noBasis.kcal()).isEqualByComparingTo("372");
    }

    @Test
    void testLineOf_shouldKeepMissingFactsNull() {
        PantryCatalogEntity estimate = food("100", "g");
        estimate.setNova(null);
        estimate.setFiberG(null);
        estimate.setKcal(null);

        ScoredLine line = PantryFoodScoreService.lineOf(estimate);

        assertThat(line.nova()).isNull();
        assertThat(line.fiberG()).isNull();
        assertThat(line.sugarG()).isNull();
        assertThat(line.saltG()).isNull();
        assertThat(line.saturatedFatG()).isNull();
        assertThat(line.kcal()).isNull(); // never a fabricated 0
    }

    @Test
    void testLineOf_shouldBeNullForANonFood() {
        PantryCatalogEntity supplement = food("100", "g");
        supplement.setKind("supplement");

        assertThat(PantryFoodScoreService.lineOf(supplement)).isNull();
    }
}
