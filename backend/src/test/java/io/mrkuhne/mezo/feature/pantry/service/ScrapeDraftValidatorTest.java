package io.mrkuhne.mezo.feature.pantry.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/** Deterministic confidence: clamps + Atwater consistency (mezo-8vum, spec §Backend 4). */
class ScrapeDraftValidatorTest {

    private final ScrapeDraftValidator validator = new ScrapeDraftValidator();

    private ScrapeExtractionService.ExtractedDraft draft(double kcal, Double p, Double c, Double f) {
        return new ScrapeExtractionService.ExtractedDraft(
            "Impact Whey", "Myprotein", BigDecimal.valueOf(100), "g", BigDecimal.valueOf(kcal),
            p == null ? null : BigDecimal.valueOf(p), c == null ? null : BigDecimal.valueOf(c),
            f == null ? null : BigDecimal.valueOf(f), null, null, null, null, 4, "supplement", null, null);
    }

    @Test
    void testConfidence_shouldBeFull_whenAtwaterConsistent() {
        // 4*82 + 4*4 + 9*7.5 = 411.5 ≈ 412
        assertThat(validator.confidence(draft(412, 82.0, 4.0, 7.5))).isEqualTo(1.0);
    }

    @Test
    void testConfidence_shouldDrop_whenAtwaterOffByMoreThan30Percent() {
        assertThat(validator.confidence(draft(900, 10.0, 10.0, 2.0))).isLessThan(0.7);
    }

    @Test
    void testConfidence_shouldDrop_whenMacrosMissing() {
        assertThat(validator.confidence(draft(412, null, null, null))).isLessThan(1.0);
    }
}
