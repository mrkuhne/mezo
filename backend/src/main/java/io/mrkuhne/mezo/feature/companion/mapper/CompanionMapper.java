package io.mrkuhne.mezo.feature.companion.mapper;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.FactCandidateResponse;
import io.mrkuhne.mezo.api.dto.KnowledgeFactResponse;
import io.mrkuhne.mezo.api.dto.MessageRef;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.MessageTool;
import io.mrkuhne.mezo.api.dto.PatternCritique;
import io.mrkuhne.mezo.api.dto.PatternResponse;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternCritiqueEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import org.mapstruct.Mapper;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Mapper(componentModel = "spring")
public interface CompanionMapper {

    default ConversationResponse toConversationResponse(AiConversationEntity entity) {
        return ConversationResponse.builder()
                .id(entity.getId())
                .title(entity.getTitle())
                .startedAt(toOffset(entity.getCreatedAt()))
                .lastMessageAt(toOffset(entity.getLastMessageAt()))
                .build();
    }

    default MessageResponse toMessageResponse(AiMessageEntity entity) {
        return MessageResponse.builder()
                .id(entity.getId())
                .role(entity.getRole())
                .content(entity.getContent())
                .createdAt(toOffset(entity.getCreatedAt()))
                .tools(toTools(entity.getToolCalls()))
                .refs(toRefs(entity.getRefs()))
                .degraded(entity.isDegraded())
                .build();
    }

    default PatternResponse toPatternResponse(PatternEntity entity) {
        return PatternResponse.builder()
                .id(entity.getId())
                .kind(entity.getKind())
                .category(entity.getCategory())
                .categoryLabel(entity.getCategoryLabel())
                .title(entity.getTitle())
                .mechanism(entity.getMechanism())
                .evidence(entity.getEvidence() == null ? List.of() : entity.getEvidence().items())
                .confidence(entity.getConfidence() == null ? null : entity.getConfidence().doubleValue())
                .critique(toCritique(entity.getCritique()))
                .status(entity.getStatus())
                .lastDetectedAt(toOffset(entity.getLastDetectedAt()))
                .thinking(entity.getCritique() == null ? null : entity.getCritique().reasoning())
                .build();
    }

    default PatternCritique toCritique(PatternCritiqueEnvelope envelope) {
        if (envelope == null) {
            return null;
        }
        return PatternCritique.builder()
                .statistical(envelope.statistical())
                .confounders(envelope.confounders())
                .l3align(envelope.l3align())
                .actionability(envelope.actionability())
                .build();
    }

    default KnowledgeFactResponse toKnowledgeFactResponse(KnowledgeFactEntity entity) {
        return KnowledgeFactResponse.builder()
                .id(entity.getId())
                .factText(entity.getFactText())
                .category(entity.getCategory())
                .source(entity.getSource())
                .reinforcementCount(entity.getReinforcementCount())
                .includeInPrompt(entity.isIncludeInPrompt())
                .lastReinforcedAt(toOffset(entity.getLastReinforcedAt()))
                .createdAt(toOffset(entity.getCreatedAt()))
                .build();
    }

    default FactCandidateResponse toFactCandidateResponse(LearnedFactEntity entity) {
        return FactCandidateResponse.builder()
                .id(entity.getId())
                .candidateText(entity.getCandidateText())
                .category(entity.getCategory())
                .userDecision(entity.getUserDecision())
                .refinedText(entity.getRefinedText())
                .promotedFactId(entity.getPromotedFactId())
                .createdAt(toOffset(entity.getCreatedAt()))
                .build();
    }

    /** Null envelope maps to []; the wire name carries the args — "get_sleep(days=3)" (FE chip style). */
    default List<MessageTool> toTools(ToolCallsEnvelope envelope) {
        if (envelope == null || envelope.calls() == null) {
            return List.of();
        }
        return envelope.calls().stream()
                .map(call -> MessageTool.builder()
                        .type(call.type())
                        .name(call.args() == null || call.args().isBlank()
                                ? call.name() : call.name() + "(" + call.args() + ")")
                        .build())
                .toList();
    }

    default List<MessageRef> toRefs(RefsEnvelope envelope) {
        if (envelope == null || envelope.refs() == null) {
            return List.of();
        }
        return envelope.refs().stream()
                .map(ref -> MessageRef.builder().kind(ref.kind()).id(ref.id()).build())
                .toList();
    }

    default OffsetDateTime toOffset(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
