package io.mrkuhne.mezo.feature.llmlog.repository;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.feature.llmlog.entity.PricingSnapshot;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
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
    @Autowired private LlmLogPopulator llmLogPopulator;

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
            new BigDecimal("0.075"), null, null, LocalDate.of(2026, 7, 28)));
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

    /**
     * The cap's only read (mezo-ozri.6): ONE user's priced spend inside the rolling budget window.
     * ERROR rows are excluded — a provider failure is not the user's money — and an unpriced row
     * contributes nothing rather than making the whole sum null, because the cap has to answer with
     * a number on every call.
     */
    @Test
    void testSumCostSince_shouldCountOnlyThisUsersPricedSuccesses_whenTheWindowIsOpen() {
        UUID user = ownerId();
        UUID other = userPopulator.createUser("llm-budget-other@test.hu").getId();
        Instant since = Instant.now().minus(Duration.ofDays(30));

        llmLogPopulator.log(user, CallKind.CHAT, "companion_chat", "gpt-5.6-luna", 10, 5, null, new BigDecimal("1.50"));
        llmLogPopulator.log(user, CallKind.CHAT, "companion_chat", "gpt-5.6-luna", 10, 5, null, new BigDecimal("0.75"));
        llmLogPopulator.log(user, CallKind.CHAT, "companion_chat", "gpt-5.6-luna", 10, 5, null, null);
        llmLogPopulator.logError(user, CallKind.CHAT, "companion_chat", "gpt-5.6-luna", "RESOURCE_EXHAUSTED");
        llmLogPopulator.log(other, CallKind.CHAT, "companion_chat", "gpt-5.6-luna", 10, 5, null, new BigDecimal("9.99"));

        assertThat(llmLogRepository.sumCostSince(since, user, CallStatus.ERROR)).isEqualByComparingTo("2.25");
    }

    /** Rows older than the window belong to a spent cycle — the whole point of a ROLLING cap. */
    @Test
    void testSumCostSince_shouldIgnoreRowsOlderThanTheWindow_whenTheyPredateIt() {
        UUID user = ownerId();
        llmLogPopulator.logAt(Instant.now().minus(Duration.ofDays(40)), user, CallKind.CHAT,
            "companion_chat", "gpt-5.6-luna", 10, 5, null, new BigDecimal("4.00"));

        assertThat(llmLogRepository.sumCostSince(
            Instant.now().minus(Duration.ofDays(30)), user, CallStatus.ERROR)).isEqualByComparingTo("0");
    }

    /** No priced row at all is a confident ZERO here, not "unknown": a ceiling has to decide. */
    @Test
    void testSumCostSince_shouldReturnZero_whenTheUserHasNoRows() {
        assertThat(llmLogRepository.sumCostSince(
            Instant.now().minus(Duration.ofDays(30)), UUID.randomUUID(), CallStatus.ERROR))
            .isEqualByComparingTo("0");
    }
}
