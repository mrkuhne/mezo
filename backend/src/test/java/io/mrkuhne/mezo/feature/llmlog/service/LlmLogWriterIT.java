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
            .finishReason("STOP")
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
        // mezo-8z79: the finish reason rides the row so an empty responseText is diagnosable.
        assertThat(row.getFinishReason()).isEqualTo("STOP");
    }

    /**
     * mezo-1rz9: a CANCELLED stream row must survive the DB CHECK (the migration widened
     * {@code ck_llm_log_history_status}) and keep whatever the stream revealed before the client
     * disconnected — the partial answer, and a COST when the tally caught a completed round's usage
     * (those tokens were billed; a cancel does not make them free).
     */
    @Test
    void testPersist_shouldStoreCancelledRowWithPartialUsage_whenStreamWasCancelled() {
        LlmCallRecord rec = LlmCallRecord.builder()
            .callKind(CallKind.CHAT_STREAM)
            .requestedModel("gemini-2.5-flash").servedModel("gemini-2.5-flash")
            .status(CallStatus.CANCELLED).latencyMs(120).streamed(true)
            .tokens(new TokenUsage(10_000, 1_000, 500, 0, 11_500))
            .systemPrompt("sys").userMessage("hi").responseText("partial ans")
            .context(new LlmCallContext("companion_chat", "stream", "conversation", UUID.randomUUID()))
            .build();

        llmLogWriter.persist(new LlmCallEvent(rec, ownerId(), Instant.parse("2026-07-28T10:00:00Z")));

        LlmLogEntity row = llmLogRepository.findAll().getFirst();
        assertThat(row.getStatus()).isEqualTo(CallStatus.CANCELLED);
        assertThat(row.isStreamed()).isTrue();
        assertThat(row.getResponseText()).isEqualTo("partial ans");
        assertThat(row.getCostUsd()).isEqualByComparingTo("0.00675");
        assertThat(row.getErrorCode()).isNull();
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

    /**
     * mezo-q71s: {@code conversation_history} keeps the audit whole now that the chat history rides
     * the port as real prior messages instead of being rendered into the system prompt — it must
     * land on the row, and {@code system_prompt} must NOT contain it (a half-true audit column is
     * worse than a missing one).
     */
    @Test
    void testPersist_shouldMapConversationHistory_whenChatCallHasPriorTurns() {
        LlmCallRecord rec = LlmCallRecord.builder()
            .callKind(CallKind.CHAT).requestedModel("gemini-2.5-flash").servedModel("gemini-2.5-flash")
            .status(CallStatus.SUCCESS).latencyMs(10)
            .systemPrompt("sys").conversationHistory("Daniel: korábbi kérdés\n").userMessage("és most?")
            .context(new LlmCallContext("companion_chat", "chat_turn", null, null))
            .build();

        llmLogWriter.persist(new LlmCallEvent(rec, ownerId(), Instant.parse("2026-07-28T10:00:00Z")));

        LlmLogEntity row = llmLogRepository.findAll().getFirst();
        assertThat(row.getConversationHistory()).contains("Daniel: korábbi kérdés");
        assertThat(row.getSystemPrompt()).doesNotContain("Daniel: korábbi kérdés");
    }

    /**
     * The new column must participate in the SAME payload discipline as the other three: it counts
     * toward {@code payload_bytes}, gets capped at {@code mezo.llm-log.max-payload-chars}, and its
     * own overflow sets {@code truncated} — missing any one of these would be a silent audit defect.
     */
    @Test
    void testPersist_shouldCapAndFlagConversationHistory_whenOverCap() {
        String huge = "h".repeat(70_000);
        LlmCallRecord rec = LlmCallRecord.builder()
            .callKind(CallKind.CHAT).requestedModel("gemini-2.5-flash")
            .status(CallStatus.SUCCESS).latencyMs(1)
            .systemPrompt("sys").conversationHistory(huge).userMessage("hi")
            .context(LlmCallContext.UNKNOWN)
            .build();

        llmLogWriter.persist(new LlmCallEvent(rec, ownerId(), Instant.now()));

        LlmLogEntity row = llmLogRepository.findAll().getFirst();
        assertThat(row.isTruncated()).isTrue();
        assertThat(row.getConversationHistory()).hasSize(llmLogProperties.maxPayloadChars());
        assertThat(row.getPayloadBytes()).isGreaterThanOrEqualTo(70_000);
    }

    /** Non-chat pipelines have no conversation to lose — the column must stay null (mezo-q71s). */
    @Test
    void testPersist_shouldLeaveConversationHistoryNull_whenRecordHasNone() {
        LlmCallRecord rec = LlmCallRecord.builder()
            .callKind(CallKind.SMART).requestedModel("gemini-2.5-pro")
            .status(CallStatus.SUCCESS).latencyMs(1).userMessage("hi")
            .context(LlmCallContext.UNKNOWN)
            .build();

        llmLogWriter.persist(new LlmCallEvent(rec, ownerId(), Instant.now()));

        assertThat(llmLogRepository.findAll().getFirst().getConversationHistory()).isNull();
    }

    /**
     * Cost honesty on the generation path (bd mezo-xyud): a PRICED model plus NO usage block must
     * still record {@code cost_usd = null}. Summing four missing counts into {@code 0.000000} would
     * make an unknown-cost call indistinguishable from a genuinely free one — the exact thing the
     * unknown-⇒-null rule forbids. The snapshot itself is still frozen: the price WAS known.
     */
    @Test
    void testPersist_shouldRecordNullCost_whenPricedModelReportsNoUsage() {
        LlmCallRecord rec = LlmCallRecord.builder()
            .callKind(CallKind.CHAT)
            .requestedModel("gemini-2.5-flash").servedModel("gemini-2.5-flash")
            .status(CallStatus.SUCCESS).latencyMs(42)
            .tokens(null)
            .context(new LlmCallContext("companion_chat", "chat_turn", null, null))
            .build();

        llmLogWriter.persist(new LlmCallEvent(rec, ownerId(), Instant.parse("2026-07-28T10:00:00Z")));

        LlmLogEntity row = llmLogRepository.findAll().getFirst();
        assertThat(row.getPricingSnapshot()).isNotNull();
        assertThat(row.getPricingSnapshot().sourceModel()).isEqualTo("gemini-2.5-flash");
        assertThat(row.getPromptTokens()).isNull();
        assertThat(row.getCostUsd()).isNull();
    }

    /**
     * The model-aliasing scenario that motivated the feature: the provider serves a model that is not
     * in {@code mezo.llm-log.pricing.models}. The row must still land (audit logging never fails a
     * call), with an honest null snapshot and null cost — and the writer WARNs so the gap is visible.
     */
    @Test
    void testPersist_shouldRecordNullSnapshotAndCost_whenServedModelIsUnpriced() {
        LlmCallRecord rec = LlmCallRecord.builder()
            .callKind(CallKind.CHAT)
            .requestedModel("gemini-2.5-flash").servedModel("gemini-2.5-flash-preview-09-2025")
            .status(CallStatus.SUCCESS).latencyMs(7)
            .tokens(new TokenUsage(100, 20, 0, 0, 120))
            .context(new LlmCallContext("companion_chat", "chat_turn", null, null))
            .build();

        llmLogWriter.persist(new LlmCallEvent(rec, ownerId(), Instant.parse("2026-07-28T10:00:00Z")));

        LlmLogEntity row = llmLogRepository.findAll().getFirst();
        assertThat(row.getServedModel()).isEqualTo("gemini-2.5-flash-preview-09-2025");
        assertThat(row.getPromptTokens()).isEqualTo(100);
        assertThat(row.getPricingSnapshot()).isNull();
        assertThat(row.getCostUsd()).isNull();
    }
}
