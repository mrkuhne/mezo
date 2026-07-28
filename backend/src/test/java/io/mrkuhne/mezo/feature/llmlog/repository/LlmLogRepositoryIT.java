package io.mrkuhne.mezo.feature.llmlog.repository;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.feature.llmlog.entity.PricingSnapshot;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * llm_log_history DDL proof (mezo-2zyu): the audit row round-trips through JPA — every §4 column,
 * the enum-as-text columns, and the frozen {@link PricingSnapshot} jsonb envelope — and
 * {@code created_at} is stamped server-side. The table is deliberately INSERT-only (no soft delete).
 */
class LlmLogRepositoryIT extends AbstractIntegrationTest {

    @Autowired private LlmLogRepository llmLogRepository;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser("llm-log@test.hu").getId();
    }

    @Test
    void testSave_shouldRoundTripAllFieldsIncludingJsonbSnapshot_whenPersisted() {
        LlmLogEntity e = new LlmLogEntity();
        e.setCreatedBy(ownerId());
        e.setCallKind(CallKind.CHAT);
        e.setFeature("companion_chat");
        e.setRequestedModel("gemini-2.5-flash");
        e.setServedModel("gemini-2.5-flash");
        e.setStatus(CallStatus.SUCCESS);
        e.setLatencyMs(842);
        e.setPromptTokens(10_000);
        e.setCandidatesTokens(1_000);
        e.setSystemPrompt("sys");
        e.setUserMessage("hi");
        e.setResponseText("hello");
        e.setPayloadBytes(11);
        e.setPricingSnapshot(new PricingSnapshot("gemini-2.5-flash", "USD",
            new BigDecimal("0.30"), new BigDecimal("2.50"), new BigDecimal("2.50"),
            new BigDecimal("0.075"), null, LocalDate.of(2026, 7, 28)));
        e.setCostUsd(new BigDecimal("0.00550"));

        LlmLogEntity saved = llmLogRepository.saveAndFlush(e);
        LlmLogEntity read = llmLogRepository.findById(saved.getId()).orElseThrow();

        assertThat(read.getServedModel()).isEqualTo("gemini-2.5-flash");
        assertThat(read.getPromptTokens()).isEqualTo(10_000);
        assertThat(read.getPricingSnapshot().inputPerMillion()).isEqualByComparingTo("0.30");
        assertThat(read.getPricingSnapshot().pricedOn()).isEqualTo(LocalDate.of(2026, 7, 28));
        assertThat(read.getCostUsd()).isEqualByComparingTo("0.00550");
        assertThat(read.getCreatedAt()).isNotNull(); // @CreationTimestamp
    }

    /**
     * The optional half of §4 (error/embedding/vision/tool columns) must be nullable end-to-end:
     * an unpriced ERROR row carries no tokens, no snapshot and no cost — honestly empty, not zeroed.
     */
    @Test
    void testSave_shouldPersistErrorRowWithoutPricing_whenCallFailed() {
        LlmLogEntity e = new LlmLogEntity();
        e.setCreatedBy(ownerId());
        e.setCallKind(CallKind.EMBED_QUERY);
        e.setFeature("companion_recall");
        e.setRequestedModel("gemini-embedding-001");
        e.setStatus(CallStatus.ERROR);
        e.setErrorCode("RESOURCE_EXHAUSTED");
        e.setErrorClass("io.grpc.StatusRuntimeException");
        e.setLatencyMs(37);

        LlmLogEntity read = llmLogRepository.findById(llmLogRepository.saveAndFlush(e).getId()).orElseThrow();

        assertThat(read.getStatus()).isEqualTo(CallStatus.ERROR);
        assertThat(read.getCallKind()).isEqualTo(CallKind.EMBED_QUERY);
        assertThat(read.getServedModel()).isNull();
        assertThat(read.getPricingSnapshot()).isNull();
        assertThat(read.getCostUsd()).isNull();
        assertThat(read.getPromptTokens()).isNull();
        assertThat(read.isStreamed()).isFalse();
        assertThat(read.getPayloadBytes()).isZero();
    }
}
