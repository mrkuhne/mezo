package io.mrkuhne.mezo.feature.companion.feedback.service;

import io.mrkuhne.mezo.api.dto.MessageFeedbackResponse;
import io.mrkuhne.mezo.api.dto.PutFeedbackRequest;
import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.feedback.mapper.MessageFeedbackMapper;
import io.mrkuhne.mezo.feature.companion.feedback.repository.MessageFeedbackRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * One updatable 👍/👎 verdict per AI artifact (Phase 5 W4.1, bd mezo-b3pp.15, spec §4.4): upsert
 * (overwrite on opposite verdict, resurrect on re-vote after retraction), idempotent retraction,
 * and batch-read for page hydration. Gated on {@code COMPANION_SWITCH} — feedback is a companion
 * organ with no switch of its own (spec §8.1).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MessageFeedbackService {

    private final MessageFeedbackRepository repository;
    private final MessageFeedbackMapper mapper;

    @Transactional
    public MessageFeedbackResponse put(UUID userId, PutFeedbackRequest request) {
        // The DB CHECK is the backstop; this is the honest 400 (a 500 from a CHECK is not an answer).
        if (request.getReason() != null && !MessageFeedbackEntity.VERDICT_DOWN.equals(request.getVerdict())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("FEEDBACK_REASON_REQUIRES_DOWN").build(), HttpStatus.BAD_REQUEST);
        }
        repository.upsertVerdict(userId, request.getArtifactKind(), request.getArtifactId(),
            request.getVerdict(), request.getReason());
        return mapper.toResponse(repository
            .findByCreatedByAndArtifactKindAndArtifactIdAndDeletedFalse(
                userId, request.getArtifactKind(), request.getArtifactId())
            // Can't-happen: the upsert above ran in this same transaction. If the row is gone
            // anyway, that is OUR fault, not the caller's — a 500, never a 400 (error_handling.md).
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("FEEDBACK_UPSERT_READBACK_FAILED").build(),
                HttpStatus.INTERNAL_SERVER_ERROR)));
    }

    /** Retraction (spec §4.4: re-tapping the same verdict removes it) — soft delete via @SQLDelete;
     *  idempotent, because "I have no opinion on this" is already the state a missing row means. */
    @Transactional
    public void retract(UUID userId, String artifactKind, UUID artifactId) {
        repository.findByCreatedByAndArtifactKindAndArtifactIdAndDeletedFalse(userId, artifactKind, artifactId)
            .ifPresent(repository::delete);
    }

    @Transactional(readOnly = true)
    public List<MessageFeedbackResponse> list(UUID userId, String kind, List<UUID> ids) {
        return repository
            .findByCreatedByAndArtifactKindAndArtifactIdInAndDeletedFalse(userId, kind, ids)
            .stream().map(mapper::toResponse).toList();
    }
}
