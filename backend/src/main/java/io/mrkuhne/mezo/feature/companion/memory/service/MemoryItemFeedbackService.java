package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.api.dto.MemoryRetrievalFeedbackResponse;
import io.mrkuhne.mezo.api.dto.PutMemoryRetrievalFeedbackRequest;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalResultEntity;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalFeedbackRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalResultRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Stores explicit beta feedback for one audited retrieval result. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryItemFeedbackService {

    private final MemoryRetrievalResultRepository resultRepository;
    private final MemoryRetrievalFeedbackRepository feedbackRepository;
    private final MemoryItemRepository itemRepository;

    public List<MemoryRetrievalFeedbackResponse> list(UUID userId, List<UUID> resultIds) {
        return feedbackRepository.findByCreatedByAndResultIdIn(userId, resultIds).stream()
                .map(MemoryItemFeedbackService::toResponse)
                .toList();
    }

    @Transactional
    public MemoryRetrievalFeedbackResponse put(
            UUID userId, UUID runId, UUID resultId, PutMemoryRetrievalFeedbackRequest request) {
        MemoryRetrievalResultEntity result = resultRepository
                .findByIdAndRunIdAndCreatedByAndSelectedTrue(resultId, runId, userId)
                .orElseThrow(MemoryItemFeedbackService::notFound);

        MemoryRetrievalFeedbackEntity feedback = feedbackRepository
                .findByCreatedByAndResultId(userId, resultId)
                .orElseGet(() -> newFeedback(userId, result));
        if (MemoryRetrievalFeedbackEntity.ACTION_SUPPRESS.equals(feedback.getAction())
                && !MemoryRetrievalFeedbackEntity.ACTION_SUPPRESS.equals(request.getAction())) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("MEMORY_RETRIEVAL_SUPPRESSION_FINAL").build(),
                    HttpStatus.BAD_REQUEST);
        }
        if (MemoryRetrievalFeedbackEntity.ACTION_SUPPRESS.equals(request.getAction())) {
            suppressCanonicalItem(userId, result);
        }

        feedback.setRunId(runId);
        feedback.setMemoryItemId(result.getMemoryItemId());
        feedback.setAction(request.getAction());
        return toResponse(feedbackRepository.saveAndFlush(feedback));
    }

    private void suppressCanonicalItem(UUID userId, MemoryRetrievalResultEntity result) {
        if (result.getMemoryItemId() == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("MEMORY_RETRIEVAL_SUPPRESS_UNAVAILABLE").build(),
                    HttpStatus.BAD_REQUEST);
        }
        MemoryItemEntity item = itemRepository
                .findByIdAndCreatedByAndDeletedFalse(result.getMemoryItemId(), userId)
                .orElseThrow(MemoryItemFeedbackService::notFound);
        item.setState(MemoryItemEntity.STATE_SUPPRESSED);
        itemRepository.save(item);
    }

    private static MemoryRetrievalFeedbackEntity newFeedback(
            UUID userId, MemoryRetrievalResultEntity result) {
        MemoryRetrievalFeedbackEntity feedback = new MemoryRetrievalFeedbackEntity();
        feedback.setCreatedBy(userId);
        feedback.setRunId(result.getRunId());
        feedback.setResultId(result.getId());
        feedback.setMemoryItemId(result.getMemoryItemId());
        return feedback;
    }

    private static MemoryRetrievalFeedbackResponse toResponse(MemoryRetrievalFeedbackEntity entity) {
        return MemoryRetrievalFeedbackResponse.builder()
                .runId(entity.getRunId())
                .resultId(entity.getResultId())
                .action(MemoryRetrievalFeedbackResponse.ActionEnum.fromValue(entity.getAction()))
                .updatedAt(toOffsetDateTime(entity.getUpdatedAt()))
                .build();
    }

    private static OffsetDateTime toOffsetDateTime(Instant value) {
        return value == null ? null : value.atOffset(ZoneOffset.UTC);
    }

    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
