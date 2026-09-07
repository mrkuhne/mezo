package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.feature.llmlog.config.LlmPricingProperties;
import io.mrkuhne.mezo.feature.llmlog.config.ModelPrice;
import io.mrkuhne.mezo.feature.llmlog.entity.PricingSnapshot;
import io.mrkuhne.mezo.feature.llmlog.entity.ReasoningBilling;
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
                new BigDecimal("2.50"), new BigDecimal("0.075"), null, ReasoningBilling.SEPARATE),
            "gemini-embedding-001", new ModelPrice(null, null, null, null, new BigDecimal("0.15"), null));
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

    private LlmPricingService openAiStyleService() {
        // Same unit prices as the Gemini row above, so the ONLY difference under test is the
        // reasoning-billing semantics — not the rates.
        Map<String, ModelPrice> models = Map.of(
            "reasoning-included-model", new ModelPrice(
                new BigDecimal("0.30"), new BigDecimal("2.50"),
                new BigDecimal("2.50"), new BigDecimal("0.075"),
                null, ReasoningBilling.INCLUDED_IN_OUTPUT));
        return new LlmPricingService(new LlmPricingProperties("USD", models));
    }

    @Test
    void testComputeGenerationCost_shouldBillThoughtsSeparately_whenProviderReportsThemBesideOutput() {
        // Gemini semantics: thoughtsTokenCount sits NEXT TO candidatesTokenCount, so it is its own
        // billable category. 10_000 in @0.30/M + 1_000 out @2.50/M + 500 thoughts @2.50/M
        PricingSnapshot snap = service().snapshot("gemini-2.5-flash", LocalDate.of(2026, 9, 6));

        assertThat(snap.reasoningBilling()).isEqualTo(ReasoningBilling.SEPARATE);
        assertThat(service().computeGenerationCost(snap, 10_000, 1_000, 500, 0))
            .isEqualByComparingTo("0.00675");
    }

    @Test
    void testComputeGenerationCost_shouldNotBillThoughtsTwice_whenReasoningIsIncludedInOutput() {
        // OpenAI semantics: reasoning_tokens is a SUBSET of completion_tokens, which is what
        // `candidates` already holds — charging the thoughts again would bill the same tokens twice.
        // 10_000 in @0.30/M + 1_000 out @2.50/M + 0 for the 500 reasoning tokens = 0.0055
        PricingSnapshot snap = openAiStyleService().snapshot("reasoning-included-model", LocalDate.of(2026, 9, 6));

        assertThat(snap.reasoningBilling()).isEqualTo(ReasoningBilling.INCLUDED_IN_OUTPUT);
        assertThat(openAiStyleService().computeGenerationCost(snap, 10_000, 1_000, 500, 0))
            .isEqualByComparingTo("0.0055");
    }

    @Test
    void testSnapshot_shouldDefaultToSeparateReasoningBilling_whenTheModelDoesNotDeclareIt() {
        // The Gemini-shaped default: an existing price row without the new key keeps today's math.
        LlmPricingService legacy = new LlmPricingService(new LlmPricingProperties("USD", Map.of(
            "legacy-model", new ModelPrice(new BigDecimal("1.00"), new BigDecimal("2.00"),
                new BigDecimal("2.00"), null, null, null))));

        assertThat(legacy.snapshot("legacy-model", LocalDate.of(2026, 9, 6)).reasoningBilling())
            .isEqualTo(ReasoningBilling.SEPARATE);
    }
}
