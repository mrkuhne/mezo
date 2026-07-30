package io.mrkuhne.mezo.feature.llmlog.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.feature.llmlog.event.LlmCallEvent;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The write half of the audit pipeline (mezo-2zyu): {@link LlmLogWriter#persist} maps an observed
 * {@link LlmCallRecord} onto the {@code llm_log_history} row, freezes the pricing snapshot and
 * derives the cost from it.
 *
 * <p>{@code persist} is called DIRECTLY (never through the {@code @Async} listener) so the assertions
 * are deterministic — the async hop is Spring's concern, the mapping is ours.
 */
class LlmLogWriterIT extends AbstractIntegrationTest {

    @Autowired private LlmLogWriter llmLogWriter;
    @Autowired private LlmLogRepository llmLogRepository;
    @Autowired private LlmLogProperties llmLogProperties;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser("llm-log-writer@test.hu").getId();
    }

    /**
     * The happy path: every observed field lands on the row, the call context supplies the
     * feature/operation/entity grouping axes, and the cost matches the Task-1 math for
     * gemini-2.5-flash — 10k prompt @0.30 + 1k output @2.50 + 500 thoughts @2.50 = 0.00675 USD.
     */
    @Test
    void testPersist_shouldMapRecordAndComputeCost_whenGenerationCallSucceeds() {
        UUID owner = ownerId();
        UUID mealId = UUID.randomUUID();
        LlmCallRecord rec = LlmCallRecord.builder()
            .callKind(CallKind.CHAT)
            .requestedModel("gemini-2.5-flash").servedModel("gemini-2.5-flash")
            .status(CallStatus.SUCCESS).latencyMs(500)
            .tokens(new TokenUsage(10_000, 1_000, 500, 0, 11_500))
            .systemPrompt("sys").userMessage("hi").responseText("hello")
            .context(new LlmCallContext("companion_chat", "chat_turn", "meal", mealId))
            .build();

        llmLogWriter.persist(new LlmCallEvent(rec, owner, Instant.parse("2026-07-28T10:00:00Z")));

        LlmLogEntity row = llmLogRepository.findAll().getFirst();
        assertThat(row.getServedModel()).isEqualTo("gemini-2.5-flash");
        assertThat(row.getFeature()).isEqualTo("companion_chat");
        assertThat(row.getOperation()).isEqualTo("chat_turn");
        assertThat(row.getEntityKind()).isEqualTo("meal");
        assertThat(row.getEntityId()).isEqualTo(mealId);
        assertThat(row.getThoughtsTokens()).isEqualTo(500);
        assertThat(row.getTotalTokens()).isEqualTo(11_500);
        assertThat(row.getCostUsd()).isEqualByComparingTo("0.00675");
        assertThat(row.getPricingSnapshot().sourceModel()).isEqualTo("gemini-2.5-flash");
        assertThat(row.getCreatedBy()).isEqualTo(owner);
        assertThat(row.isTruncated()).isFalse();
    }

    /**
     * Payload discipline: each payload column is capped at {@code mezo.llm-log.max-payload-chars},
     * the row is flagged {@code truncated}, and {@code payload_bytes} still records the TRUE
     * pre-truncation size — the cap must not erase how big the call really was.
     *
     * <p>An unpriced context (no served model) also proves an honest null cost/snapshot.
     */
    @Test
    void testPersist_shouldTruncatePayloadAndFlag_whenOverCap() {
        String huge = "x".repeat(70_000);
        LlmCallRecord rec = LlmCallRecord.builder()
            .callKind(CallKind.CHAT).requestedModel("gemini-2.5-flash")
            .status(CallStatus.SUCCESS).latencyMs(1).userMessage(huge)
            .context(LlmCallContext.UNKNOWN)
            .build();

        llmLogWriter.persist(new LlmCallEvent(rec, ownerId(), Instant.now()));

        LlmLogEntity row = llmLogRepository.findAll().getFirst();
        assertThat(row.isTruncated()).isTrue();
        assertThat(row.getUserMessage()).hasSize(llmLogProperties.maxPayloadChars());
        assertThat(row.getPayloadBytes()).isGreaterThanOrEqualTo(70_000);
        assertThat(row.getFeature()).isEqualTo("unknown");
        assertThat(row.getPricingSnapshot()).isNull();
        assertThat(row.getCostUsd()).isNull();
    }
}
