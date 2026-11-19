package io.mrkuhne.mezo.feature.pantry.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.pantry.service.PantryEstimateValidator.Facts;
import org.junit.jupiter.api.Test;

/**
 * Pure unit test of the estimate gate (mezo-r36n9.63): an AI estimate becomes a food only when its
 * headline figures are present, physical and consistent with each other; a doubtful secondary fact
 * becomes "no data", never 0.
 */
class PantryEstimateValidatorTest {

    @Test
    void testValidate_shouldAcceptPlausibleFacts() {
        Facts f = PantryEstimateValidator.validate("""
            Sure: {"basisUnit":"g","kcal":354,"proteinG":7.8,"carbsG":64.9,"fatG":9.9,
                   "fiberG":21.1,"sugarG":3.2,"saltG":0.1,"saturatedFatG":3.1,"nova":1}""").orElseThrow();

        assertThat(f.basisUnit()).isEqualTo("g");
        assertThat(f.kcal()).isEqualByComparingTo("354");
        assertThat(f.proteinG()).isEqualByComparingTo("7.8");
        assertThat(f.carbsG()).isEqualByComparingTo("64.9");
        assertThat(f.fatG()).isEqualByComparingTo("9.9");
        assertThat(f.fiberG()).isEqualByComparingTo("21.1");
        assertThat(f.saturatedFatG()).isEqualByComparingTo("3.1");
    }

    @Test
    void testValidate_shouldKeepMillilitreBasisAndDefaultAnythingElseToGrams() {
        assertThat(PantryEstimateValidator.validate(
            "{\"basisUnit\":\"ML\",\"kcal\":884,\"proteinG\":0,\"carbsG\":0,\"fatG\":100}").orElseThrow().basisUnit())
            .isEqualTo("ml");
        assertThat(PantryEstimateValidator.validate(
            "{\"basisUnit\":\"cup\",\"kcal\":884,\"proteinG\":0,\"carbsG\":0,\"fatG\":100}").orElseThrow().basisUnit())
            .isEqualTo("g");
        assertThat(PantryEstimateValidator.validate(
            "{\"kcal\":0,\"proteinG\":0,\"carbsG\":0,\"fatG\":0}").orElseThrow().basisUnit()).isEqualTo("g");
    }

    @Test
    void testValidate_shouldRejectKcalThatDisagreesWithMacros() {
        assertThat(PantryEstimateValidator.validate(
            "{\"basisUnit\":\"g\",\"kcal\":50,\"proteinG\":5,\"carbsG\":10,\"fatG\":60}")).isEmpty();
        assertThat(PantryEstimateValidator.validate(
            "{\"basisUnit\":\"g\",\"kcal\":700,\"proteinG\":10,\"carbsG\":20,\"fatG\":5}")).isEmpty();
    }

    @Test
    void testValidate_shouldRejectOutOfRangeMacro() {
        assertThat(PantryEstimateValidator.validate(
            "{\"basisUnit\":\"g\",\"kcal\":560,\"proteinG\":140,\"carbsG\":0,\"fatG\":0}")).isEmpty();
        assertThat(PantryEstimateValidator.validate(
            "{\"basisUnit\":\"g\",\"kcal\":-5,\"proteinG\":0,\"carbsG\":0,\"fatG\":0}")).isEmpty();
        assertThat(PantryEstimateValidator.validate(
            "{\"basisUnit\":\"g\",\"kcal\":950,\"proteinG\":0,\"carbsG\":0,\"fatG\":100}")).isEmpty();
        // each inside 0..100 but together more than the food weighs
        assertThat(PantryEstimateValidator.validate(
            "{\"basisUnit\":\"g\",\"kcal\":600,\"proteinG\":60,\"carbsG\":60,\"fatG\":13}")).isEmpty();
    }

    @Test
    void testValidate_shouldRejectMissingHeadlineFigure() {
        assertThat(PantryEstimateValidator.validate("{\"basisUnit\":\"g\",\"kcal\":null}")).isEmpty();
        assertThat(PantryEstimateValidator.validate(
            "{\"basisUnit\":\"g\",\"kcal\":100,\"proteinG\":10,\"carbsG\":15}")).isEmpty();
    }

    @Test
    void testValidate_shouldDropImplausibleSecondaryFactsToNoData() {
        Facts f = PantryEstimateValidator.validate("""
            {"basisUnit":"g","kcal":354,"proteinG":7.8,"carbsG":64.9,"fatG":9.9,
             "fiberG":-1,"sugarG":80,"saltG":null,"saturatedFatG":12}""").orElseThrow();

        assertThat(f.fiberG()).isNull();         // negative
        assertThat(f.sugarG()).isNull();         // more sugar than carbohydrate
        assertThat(f.saltG()).isNull();          // not given
        assertThat(f.saturatedFatG()).isNull();  // more saturated fat than fat
    }

    @Test
    void testValidate_shouldRejectGarbage() {
        assertThat(PantryEstimateValidator.validate("I'm sorry, I can't help with that.")).isEmpty();
        assertThat(PantryEstimateValidator.validate("{\"kcal\":\"sok\"}")).isEmpty();
        assertThat(PantryEstimateValidator.validate("")).isEmpty();
        assertThat(PantryEstimateValidator.validate(null)).isEmpty();
    }
}
