package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.meal.service.MealAiDraftValidator;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/**
 * Deterministic per-line confidence (mezo-78rn, mirror of {@code ScrapeDraftValidatorTest}):
 * missing macro -0.3; Atwater (4P+4C+9F) off vs kcal by >30% -0.4; per-portion kcal out of
 * [0, 3000] -0.2; clamped at 0. Plain JUnit — no Spring.
 */
class MealAiDraftValidatorTest {

    private final MealAiDraftValidator validator = new MealAiDraftValidator();

    @Test
    void testConfidence_shouldReturnFull_whenAtwaterConsistent() {
        // 4*28 + 4*40 + 9*18 = 434 vs kcal 450 -> ~3.6% off, consistent
        double c = validator.confidence(bd("450"), bd("28"), bd("40"), bd("18"));
        assertThat(c).isEqualTo(1.0);
    }

    @Test
    void testConfidence_shouldPenalize_whenAtwaterOffOver30Percent() {
        // atwater = 434, kcal 900 -> >30% off -> -0.4
        double c = validator.confidence(bd("900"), bd("28"), bd("40"), bd("18"));
        assertThat(c).isEqualTo(0.6);
    }

    @Test
    void testConfidence_shouldPenalize_whenMacroMissing() {
        double c = validator.confidence(bd("450"), null, bd("40"), bd("18"));
        assertThat(c).isEqualTo(0.7);
    }

    @Test
    void testConfidence_shouldClampToZero_whenEverythingWrong() {
        double c = validator.confidence(bd("9000"), null, null, null);
        assertThat(c).isEqualTo(0.5); // -0.3 missing macros, -0.2 kcal range
    }

    private static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }
}
