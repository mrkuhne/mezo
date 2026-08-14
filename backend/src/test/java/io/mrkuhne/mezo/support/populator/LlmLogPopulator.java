package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.feature.llmlog.entity.PricingSnapshot;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Test data factory for {@link LlmLogEntity} (mezo-2zyu) — see
 * docs/references/integration_test_framework.md (one populator per aggregate,
 * layered overloads from "give me any logged call" down to full control).
 */
@TestComponent
@RequiredArgsConstructor
public class LlmLogPopulator {

    private final LlmLogRepository llmLogRepository;
    private final JdbcTemplate jdbcTemplate;

    /** A successful, unpriced generation call — the minimal valid audit row. */
    public LlmLogEntity log(UUID createdBy, CallKind kind, String feature, String servedModel,
            int promptTokens, int candidatesTokens) {
        return log(createdBy, kind, feature, servedModel, promptTokens, candidatesTokens, null, null);
    }

    /** Full control: the frozen snapshot and the derived cost are supplied by the caller. */
    public LlmLogEntity log(UUID createdBy, CallKind kind, String feature, String servedModel,
            int promptTokens, int candidatesTokens, PricingSnapshot pricingSnapshot, BigDecimal costUsd) {
        LlmLogEntity entity = new LlmLogEntity();
        entity.setCreatedBy(createdBy);
        entity.setCallKind(kind);
        entity.setFeature(feature);
        entity.setRequestedModel(servedModel);
        entity.setServedModel(servedModel);
        entity.setStatus(CallStatus.SUCCESS);
        entity.setLatencyMs(100);
        entity.setPromptTokens(promptTokens);
        entity.setCandidatesTokens(candidatesTokens);
        entity.setTotalTokens(promptTokens + candidatesTokens);
        entity.setPricingSnapshot(pricingSnapshot);
        entity.setCostUsd(costUsd);
        return llmLogRepository.saveAndFlush(entity);
    }

    /** A failed call: no served model, no usage, no cost — it still happened, so it still counts. */
    public LlmLogEntity logError(UUID createdBy, CallKind kind, String feature, String requestedModel,
            String errorCode) {
        LlmLogEntity entity = new LlmLogEntity();
        entity.setCreatedBy(createdBy);
        entity.setCallKind(kind);
        entity.setFeature(feature);
        entity.setRequestedModel(requestedModel);
        entity.setStatus(CallStatus.ERROR);
        entity.setErrorCode(errorCode);
        entity.setLatencyMs(37);
        return llmLogRepository.saveAndFlush(entity);
    }

    /**
     * Back-dated call for the period-rollup tests — {@code @CreationTimestamp} stamps
     * {@code created_at} on INSERT, so the only way to place a row in the past is to rewrite the
     * column afterwards (same trick as {@code LevelUpEventPopulator#createEventAt}).
     */
    public LlmLogEntity logAt(Instant createdAt, UUID createdBy, CallKind kind, String feature,
            String servedModel, int promptTokens, int candidatesTokens, PricingSnapshot pricingSnapshot,
            BigDecimal costUsd) {
        LlmLogEntity entity = log(createdBy, kind, feature, servedModel, promptTokens, candidatesTokens,
            pricingSnapshot, costUsd);
        jdbcTemplate.update("update llm_log_history set created_at = ? where id = ?",
            Timestamp.from(createdAt), entity.getId());
        return entity;
    }

    /**
     * Full-shape row for the list/filter tests (mezo-uakh): status, kind, feature and timestamp are
     * all caller-chosen, and the payload columns are filled so a test can assert that the LIST
     * response does not carry them.
     */
    public LlmLogEntity logCall(Instant createdAt, UUID createdBy, CallKind kind, CallStatus status,
            String feature, String operation, String servedModel, BigDecimal costUsd) {
        LlmLogEntity entity = new LlmLogEntity();
        entity.setCreatedBy(createdBy);
        entity.setCallKind(kind);
        entity.setStatus(status);
        entity.setFeature(feature);
        entity.setOperation(operation);
        entity.setRequestedModel(servedModel == null ? "gemini-2.5-flash" : servedModel);
        entity.setServedModel(servedModel);
        entity.setLatencyMs(120);
        entity.setPromptTokens(100);
        entity.setCandidatesTokens(20);
        entity.setTotalTokens(120);
        entity.setSystemPrompt("SYS");
        entity.setUserMessage("USR");
        entity.setResponseText("RSP");
        entity.setPayloadBytes(9);
        entity.setCostUsd(costUsd);
        LlmLogEntity saved = llmLogRepository.saveAndFlush(entity);
        if (createdAt != null) {
            jdbcTemplate.update("update llm_log_history set created_at = ? where id = ?",
                Timestamp.from(createdAt), saved.getId());
        }
        return saved;
    }
}
