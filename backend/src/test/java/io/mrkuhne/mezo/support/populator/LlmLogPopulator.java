package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.feature.llmlog.entity.PricingSnapshot;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Test data factory for {@link LlmLogEntity} (mezo-2zyu) — see
 * docs/references/integration_test_framework.md (one populator per aggregate,
 * layered overloads from "give me any logged call" down to full control).
 */
@TestComponent
@RequiredArgsConstructor
public class LlmLogPopulator {

    private final LlmLogRepository llmLogRepository;

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
}
