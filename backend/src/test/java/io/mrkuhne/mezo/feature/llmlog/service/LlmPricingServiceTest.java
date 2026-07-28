package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.feature.llmlog.config.LlmPricingProperties;
import io.mrkuhne.mezo.feature.llmlog.config.ModelPrice;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Pure unit test — the pricing snapshot freeze + the per-category cost math (no Spring, no DB). */
class LlmPricingServiceTest {

    private LlmPricingService service() {
        Map<String, ModelPrice> models = Map.of(
            "gemini-2.5-flash", new ModelPrice(
                new BigDecimal("0.30"), new BigDecimal("2.50"),
                new BigDecimal("2.50"), new BigDecimal("0.075"), null),
            "gemini-embedding-001", new ModelPrice(null, null, null, null, new BigDecimal("0.15")));
        return new LlmPricingService(new LlmPricingProperties("USD", models));
    }

    @Test
    void testSnapshot_shouldFreezeUnitPrices_whenModelKnown() {
        PricingSnapshot snap = service().snapshot("gemini-2.5-flash", LocalDate.of(2026, 7, 28));
        assertThat(snap).isNotNull();
        assertThat(snap.currency()).isEqualTo("USD");
        assertThat(snap.inputPerMillion()).isEqualByComparingTo("0.30");
        assertThat(snap.pricedOn()).isEqualTo(LocalDate.of(2026, 7, 28));
    }

    @Test
    void testSnapshot_shouldReturnNull_whenModelUnknown() {
        assertThat(service().snapshot("gemini-9.9-ultra", LocalDate.of(2026, 7, 28))).isNull();
    }

    @Test
    void testComputeGenerationCost_shouldSumPerCategory_whenTokensGiven() {
        PricingSnapshot snap = service().snapshot("gemini-2.5-flash", LocalDate.of(2026, 7, 28));
        // 10_000 in @0.30/M + 1_000 out @2.50/M + 500 thoughts @2.50/M + 0 cached
        BigDecimal cost = service().computeGenerationCost(snap, 10_000, 1_000, 500, 0);
        // 0.003 + 0.0025 + 0.00125 = 0.00675
        assertThat(cost).isEqualByComparingTo("0.00675");
    }

    @Test
    void testCostMethods_shouldReturnNull_whenSnapshotOrCharCountMissing() {
        // an unpriced call stays honestly unpriced — never a misleading 0
        assertThat(service().computeGenerationCost(null, 1, 1, 1, 1)).isNull();
        assertThat(service().computeEmbeddingCost(
            service().snapshot("gemini-2.5-flash", LocalDate.of(2026, 7, 28)), null)).isNull();
        assertThat(service().snapshot(null, LocalDate.of(2026, 7, 28))).isNull();
    }

    @Test
    void testComputeEmbeddingCost_shouldPricePerChar_whenBillableCharsGiven() {
        PricingSnapshot snap = service().snapshot("gemini-embedding-001", LocalDate.of(2026, 7, 28));
        BigDecimal cost = service().computeEmbeddingCost(snap, 2_000_000); // 2M chars @0.15/M = 0.30
        assertThat(cost).isEqualByComparingTo("0.30");
    }
}
