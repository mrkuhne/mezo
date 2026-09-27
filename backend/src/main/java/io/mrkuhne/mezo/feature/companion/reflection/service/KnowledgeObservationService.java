package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.api.dto.KnowledgeObservationResponse;
import io.mrkuhne.mezo.api.dto.ObservationEvidenceItem;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * S6 (mezo-d6ivw.6): the Tudástár's two reflection-side reads — the Észrevételek section and a
 * fact's "Honnan tudom?". Evidence always comes from {@link ObservationFeedService}'s builder
 * (slice lesson 6: never re-format server-side); the mute state lives on the linked FACT.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class KnowledgeObservationService {

    private static final String AI_MESSAGE_REF_PREFIX = "ai_message:";

    private final PatternRepository patternRepository;
    private final PatternEventRepository patternEventRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final LearnedFactRepository learnedFactRepository;
    private final ObservationFeedService feed;

    /** Reflection-owned rows that ARE knowledge: {@code confirmed}, or {@code refuted} while a
     *  learned fact still hangs off them (its mute reason explains why). Forgotten, open and
     *  statistical rows never appear. Newest confirmation first. */
    @Transactional(readOnly = true)
    public List<KnowledgeObservationResponse> list(UUID userId) {
        List<PatternEntity> rows = patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(userId)
                .stream()
                .filter(PatternEntity::isReflectionOwned)
                .filter(r -> PatternEntity.STATUS_CONFIRMED.equals(r.getStatus())
                        || (PatternEntity.STATUS_REFUTED.equals(r.getStatus()) && r.getPromotedFactId() != null))
                .toList();
        Map<UUID, KnowledgeFactEntity> facts = knowledgeFactRepository
                .findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId).stream()
                .collect(Collectors.toMap(KnowledgeFactEntity::getId, Function.identity()));
        Map<UUID, UUID> replacedBy = new HashMap<>();
        for (PatternEntity r : rows) {
            originalIdOf(r).ifPresent(originalId -> replacedBy.put(originalId, r.getId()));
        }
        return rows.stream()
                .map(r -> toResponse(userId, r,
                        r.getPromotedFactId() == null ? null : facts.get(r.getPromotedFactId()),
                        replacedBy.get(r.getId())))
                .sorted(Comparator.comparing(KnowledgeObservationResponse::getConfirmedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    /** "Honnan tudom?" for one fact: a pattern fact shows its source row's evidence; a chat or
     *  weekly-review fact the chat turn it was extracted from; a manual fact has none. */
    @Transactional(readOnly = true)
    public List<ObservationEvidenceItem> factEvidence(UUID userId, UUID factId) {
        KnowledgeFactEntity fact = knowledgeFactRepository.findByIdAndCreatedByAndDeletedFalse(factId, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (KnowledgeFactEntity.SOURCE_PATTERN.equals(fact.getSource())) {
            UUID patternId = fact.getProvenance() == null ? null : fact.getProvenance().patternId();
            Optional<PatternEntity> row = patternId != null
                    ? patternRepository.findByIdAndCreatedByAndDeletedFalse(patternId, userId)
                    : patternRepository.findByCreatedByAndPromotedFactIdIsNotNullAndDeletedFalse(userId).stream()
                            .filter(p -> factId.equals(p.getPromotedFactId())).findFirst();
            return row.map(r -> feed.rowEvidence(userId, r)).orElse(List.of());
        }
        return learnedFactRepository.findFirstByCreatedByAndPromotedFactIdAndDeletedFalse(userId, factId)
                .map(LearnedFactEntity::getDerivedFromMessageId)
                .map(messageId -> feed.refEvidence(userId, List.of(AI_MESSAGE_REF_PREFIX + messageId)))
                .orElse(List.of());
    }

    private KnowledgeObservationResponse toResponse(UUID userId, PatternEntity row, KnowledgeFactEntity fact,
                                                    UUID replacedById) {
        Instant confirmedAt = patternEventRepository
                .findFirstByCreatedByAndPatternIdAndKindAndDeletedFalseOrderByOccurredAtDesc(
                        userId, row.getId(), PatternEventEntity.KIND_CONFIRMED)
                .map(PatternEventEntity::getOccurredAt)
                .orElse(row.getLastDetectedAt());
        return KnowledgeObservationResponse.builder()
                .patternId(row.getId())
                .title(row.getTitle())
                .confirmedAt(toOffset(confirmedAt))
                .recheckedAt(toOffset(row.getRecheckedAt()))
                .status(KnowledgeObservationResponse.StatusEnum.fromValue(row.getStatus()))
                .factId(fact == null ? null : fact.getId())
                .factMutedReason(fact == null || fact.getMutedReason() == null ? null
                        : KnowledgeObservationResponse.FactMutedReasonEnum.fromValue(fact.getMutedReason()))
                .factMutedAt(fact == null ? null : toOffset(fact.getMutedAt()))
                .replacesPatternId(originalIdOf(row).orElse(null))
                .replacedByPatternId(replacedById)
                .topicKey(topicKey(row))
                .evidence(feed.rowEvidence(userId, row))
                .build();
    }

    /** A drift row's pairKey is {@code drift-<original uuid>}; a malformed suffix pairs nothing. */
    private static Optional<UUID> originalIdOf(PatternEntity row) {
        if (!row.isDrift()) return Optional.empty();
        try {
            return Optional.of(UUID.fromString(
                    row.getPairKey().substring(PatternEntity.PAIR_KEY_DRIFT_PREFIX.length())));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private static String topicKey(PatternEntity row) {
        if (row.getEvidence() == null || row.getEvidence().items() == null) return null;
        return row.getEvidence().items().stream()
                .filter(Objects::nonNull)
                .filter(i -> i.startsWith(EffectLinkService.OBSERVATION_TOPIC_KEY_PREFIX))
                .map(i -> i.substring(EffectLinkService.OBSERVATION_TOPIC_KEY_PREFIX.length()))
                .findFirst().orElse(null);
    }

    private static OffsetDateTime toOffset(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
