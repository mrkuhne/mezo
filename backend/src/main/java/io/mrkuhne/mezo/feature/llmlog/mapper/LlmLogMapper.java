package io.mrkuhne.mezo.feature.llmlog.mapper;

import io.mrkuhne.mezo.api.dto.LlmCallDetailResponse;
import io.mrkuhne.mezo.api.dto.LlmPricingSnapshot;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.feature.llmlog.entity.PricingSnapshot;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;

/**
 * The audit row → detail DTO mapping (mezo-uakh). Written as default methods rather than generated
 * field mappings because three things need explicit handling and would be wrong by default: the
 * jsonb {@link PricingSnapshot} value object, the {@code BigDecimal} → {@code Double} money
 * conversion (null must STAY null — "unpriced" is not "free"), and {@code Instant} →
 * {@code OffsetDateTime} for the contract's date-time.
 */
@Mapper(componentModel = "spring")
public interface LlmLogMapper {

    default LlmCallDetailResponse toDetail(LlmLogEntity e) {
        return LlmCallDetailResponse.builder()
            .id(e.getId())
            .createdAt(toOffset(e.getCreatedAt()))
            .createdBy(e.getCreatedBy())
            .feature(e.getFeature())
            .operation(e.getOperation())
            .entityKind(e.getEntityKind())
            .entityId(e.getEntityId())
            .callKind(LlmCallDetailResponse.CallKindEnum.fromValue(e.getCallKind().name()))
            .status(LlmCallDetailResponse.StatusEnum.fromValue(e.getStatus().name()))
            .requestedModel(e.getRequestedModel())
            .servedModel(e.getServedModel())
            .errorCode(e.getErrorCode())
            .errorClass(e.getErrorClass())
            .latencyMs(e.getLatencyMs())
            .streamed(e.isStreamed())
            .toolRounds(e.getToolRounds())
            .serviceTier(e.getServiceTier())
            .promptTokens(e.getPromptTokens())
            .candidatesTokens(e.getCandidatesTokens())
            .thoughtsTokens(e.getThoughtsTokens())
            .cachedTokens(e.getCachedTokens())
            .totalTokens(e.getTotalTokens())
            .embedInputCount(e.getEmbedInputCount())
            .embedDimensions(e.getEmbedDimensions())
            .embedBillableChars(e.getEmbedBillableChars())
            .imageCount(e.getImageCount())
            .imageBytesTotal(e.getImageBytesTotal())
            .imageMime(e.getImageMime())
            .systemPrompt(e.getSystemPrompt())
            .userMessage(e.getUserMessage())
            .responseText(e.getResponseText())
            .truncated(e.isTruncated())
            .payloadBytes(e.getPayloadBytes())
            .payloadScrubbedAt(toOffset(e.getPayloadScrubbedAt()))
            .costUsd(toDouble(e.getCostUsd()))
            .pricingSnapshot(toSnapshot(e.getPricingSnapshot()))
            .build();
    }

    default LlmPricingSnapshot toSnapshot(PricingSnapshot s) {
        return s == null ? null : LlmPricingSnapshot.builder()
            .sourceModel(s.sourceModel())
            .currency(s.currency())
            .inputPerMillion(toDouble(s.inputPerMillion()))
            .outputPerMillion(toDouble(s.outputPerMillion()))
            .thinkingPerMillion(toDouble(s.thinkingPerMillion()))
            .cachedPerMillion(toDouble(s.cachedPerMillion()))
            .embedPerMillionChars(toDouble(s.embedPerMillionChars()))
            .pricedOn(s.pricedOn())
            .build();
    }

    /** null STAYS null: an absent price is "unknown", never a confident zero (ADR 0014). */
    default Double toDouble(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }

    default OffsetDateTime toOffset(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
