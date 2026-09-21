package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.api.dto.CharacterReplyCreateRequest;
import io.mrkuhne.mezo.api.dto.CharacterReplyResponse;
import io.mrkuhne.mezo.api.dto.ConferencePeerReaction;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.character.config.CharacterReplyProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterReplyEntity;
import io.mrkuhne.mezo.feature.character.entity.ObservationDimensionKeysEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ObservationSignalsEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterReplyRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;

import lombok.RequiredArgsConstructor;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

/** Save, snapshot and evidence are one transaction; evaluation starts only after its commit. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterReplyService {
    private final CharacterReplyRepository replies;
    private final CharacterReplySourceResolver sources;
    private final CharacterObservationRepository observations;
    private final AppUserRepository users;
    private final ApplicationEventPublisher events;
    private final EntityManager entityManager;
    private final CharacterReplyProperties properties;

    public record Requested(UUID owner, UUID replyId) {}

    @Transactional
    public CharacterReplyResponse create(UUID owner, CharacterReplyCreateRequest request) {
        // Account lock serializes client idempotency keys across threads, including two first
        // inserts.
        entityManager.find(AppUserEntity.class, owner, LockModeType.PESSIMISTIC_WRITE);
        int index = request.getSourceIndex() == null ? 0 : request.getSourceIndex();
        String type = request.getSourceType().getValue();
        String text = request.getText().strip();
        if (text.isBlank())
            throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_REQUIRED_FIELD", "text").build(),
                    HttpStatus.BAD_REQUEST);
        var source = sources.resolve(owner, type, request.getSourceId(), index);
        var previous =
                replies.findByCreatedByAndClientRequestId(owner, request.getClientRequestId());
        if (previous.isPresent()) {
            var r = previous.get();
            if (!r.getText().equals(text)
                    || !r.getSourceType().equals(type)
                    || !r.getSourceId().equals(request.getSourceId())
                    || r.getSourceIndex() != index)
                throw new SystemRuntimeErrorException(
                        SystemMessage.error("CHARACTER_REPLY_KEY_CONFLICT").build(),
                        HttpStatus.CONFLICT);
            return dto(r);
        }
        var r = new CharacterReplyEntity();
        r.setCreatedBy(owner);
        r.setSourceType(type);
        r.setSourceId(request.getSourceId());
        r.setSourceIndex(index);
        r.setSourceText(source.text());
        r.setSourceEvidence(source.evidence());
        r.setExpertKey(source.expertKey());
        r.setDimensionKey(source.dimensionKey());
        r.setClaimId(source.claimId());
        r.setAuthorName(
                users.findById(owner).orElseThrow(CharacterReplySourceResolver::missing).getName());
        r.setText(text);
        r.setClientRequestId(request.getClientRequestId());
        r.setStatus("SAVED");
        replies.saveAndFlush(r);
        var o = new CharacterObservationEntity();
        o.setCreatedBy(owner);
        o.setExpertKey("user");
        o.setDay(LocalDate.now());
        o.setSalience((short) 5);
        o.setDimensionKeys(
                new ObservationDimensionKeysEnvelope(
                        source.dimensionKey() == null
                                ? List.of()
                                : List.of(source.dimensionKey())));
        o.setText(
                "Felhasználói önbeszámoló, erre válaszolva: «"
                        + flat(source.text())
                        + "» — "
                        + flat(text));
        o.setSignals(
                new ObservationSignalsEnvelope(
                        List.of(
                                new ObservationSignalsEnvelope.Signal(
                                        "contextual-reply",
                                        o.getText(),
                                        List.of(r.getId().toString())))));
        observations.save(o);
        events.publishEvent(new Requested(owner, r.getId()));
        return dto(r);
    }

    @Transactional(readOnly = true)
    public List<CharacterReplyResponse> list(UUID owner, String type, UUID id, int index) {
        sources.resolve(owner, type, id, index);
        return replies
                .findByCreatedByAndSourceTypeAndSourceIdAndSourceIndexOrderByCreatedAtAsc(
                        owner, type, id, index)
                .stream()
                .map(CharacterReplyService::dto)
                .toList();
    }

    @Transactional
    public CharacterReplyResponse retry(UUID owner, UUID id) {
        var r = replies.lockOwned(id, owner).orElseThrow(CharacterReplySourceResolver::missing);
        sources.resolve(owner, r.getSourceType(), r.getSourceId(), r.getSourceIndex());
        if ("COMPLETED".equals(r.getStatus()) || "NEEDS_CLARIFICATION".equals(r.getStatus()))
            return dto(r);
        if ("PROCESSING".equals(r.getStatus())
                && r.getProcessingStartedAt() != null
                && r.getProcessingStartedAt()
                        .plusSeconds(properties.leaseSeconds())
                        .isAfter(Instant.now())) return dto(r);
        r.setStatus("SAVED");
        r.setProcessingToken(null);
        r.setOutcomeText(null);
        events.publishEvent(new Requested(owner, id));
        return dto(r);
    }

    public static CharacterReplyResponse dto(CharacterReplyEntity r) {
        return CharacterReplyResponse.builder()
                .id(r.getId())
                .sourceType(CharacterReplyResponse.SourceTypeEnum.fromValue(r.getSourceType()))
                .sourceId(r.getSourceId())
                .sourceIndex(r.getSourceIndex())
                .sourceText(r.getSourceText())
                .text(r.getText())
                .createdAt(r.getCreatedAt().atOffset(ZoneOffset.UTC))
                .authorName(r.getAuthorName())
                .expertKey(r.getExpertKey())
                .status(CharacterReplyResponse.StatusEnum.fromValue(r.getStatus()))
                .outcome(
                        r.getOutcome() == null
                                ? null
                                : CharacterReplyResponse.OutcomeEnum.fromValue(r.getOutcome()))
                .outcomeText(r.getOutcomeText())
                .discussion(r.getDiscussion() == null ? List.of() : r.getDiscussion().comments().stream()
                        .map(comment -> {
                            var dto = new ConferencePeerReaction();
                            dto.setExpertKey(comment.expertKey());
                            dto.setStance(ConferencePeerReaction.StanceEnum.fromValue(comment.stance()));
                            dto.setArgument(comment.argument());
                            dto.setRound(comment.round());
                            dto.setReplyToExpert(comment.replyToExpert());
                            dto.setParticipationReason(comment.participationReason());
                            dto.setToolNames(comment.toolNames() == null ? List.of() : comment.toolNames());
                            return dto;
                        }).toList())
                .build();
    }

    static String flat(String s) {
        return s == null ? "" : s.strip().replaceAll("\\s+", " ");
    }
}
