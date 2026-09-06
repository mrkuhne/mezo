package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.feedback.service.FeedMessageKindSource;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.Collection;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * mezo-b3pp.16: the proactive-side implementation of {@link FeedMessageKindSource} — the batch
 * {@code feed_message artifact id → companion_message.kind} lookup W4.2's rollup layer needs. Lives
 * here (not in {@code feature.companion}) because it reads a {@code feature.proactive} repository;
 * see {@link FeedMessageKindSource}'s javadoc for why the dependency is inverted through that
 * interface.
 *
 * <p>Conditioned on {@code COMPANION_SWITCH} ONLY — the SAME switch as
 * {@code FeedbackLearningService}, deliberately NOT ALSO {@code PROACTIVE_SWITCH}: the nightly
 * rollup must resolve a bean whenever the companion is on, even with the proactive generators off
 * (it then honestly finds no feed messages). The {@link PatternImpactService} precedent.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FeedMessageKindService implements FeedMessageKindSource {

    private final CompanionMessageRepository companionMessageRepository;

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, String> kindsByIds(UUID userId, Collection<UUID> feedMessageIds) {
        if (feedMessageIds.isEmpty()) {
            return Map.of();
        }
        return companionMessageRepository.findAllById(feedMessageIds).stream()
            .filter(m -> userId.equals(m.getCreatedBy()))
            .collect(Collectors.toMap(CompanionMessageEntity::getId, CompanionMessageEntity::getKind));
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, String> interventionKeysByIds(UUID userId, Collection<UUID> feedMessageIds) {
        if (feedMessageIds.isEmpty()) {
            return Map.of();
        }
        // S4 (mezo-d58h.4): a flag-sourced `advice` row carries the library ENTRY key in the same
        // envelope field, so the W5.2 per-entry effectiveness rollup keeps working across the kind
        // change. Setup-sourced advice rows have a null interventionKey and drop out below.
        return companionMessageRepository.findAllById(feedMessageIds).stream()
            .filter(m -> userId.equals(m.getCreatedBy()))
            .filter(m -> CompanionMessageEntity.KIND_INTERVENTION.equals(m.getKind())
                || CompanionMessageEntity.KIND_ADVICE.equals(m.getKind()))
            .filter(m -> m.getContent().interventionKey() != null)
            .collect(Collectors.toMap(CompanionMessageEntity::getId, m -> m.getContent().interventionKey()));
    }

    /** Round 2 S5 (bd mezo-d58h.7.5). The question keys are plain constants on
     *  {@link OneTimeQuestionService} — referencing them creates no bean dependency, so this class
     *  keeps its COMPANION-only condition and still resolves with the proactive switch off (it then
     *  honestly finds no question cards, because none were ever written). */
    @Override
    @Transactional(readOnly = true)
    public Set<UUID> answerArtifactIds(UUID userId, Collection<UUID> feedMessageIds) {
        if (feedMessageIds.isEmpty()) {
            return Set.of();
        }
        Set<String> questionKeys = Set.of(OneTimeQuestionService.QUESTION_FEATURE_ABANDONMENT,
            OneTimeQuestionService.QUESTION_FLAT_FEEDBACK);
        return companionMessageRepository.findAllById(feedMessageIds).stream()
            .filter(m -> userId.equals(m.getCreatedBy()))
            // Null-check BEFORE the set lookup: Set.of(...).contains(null) throws, and most
            // advice rows (every flag-sourced one) carry a null setupKey.
            .filter(m -> m.getContent().setupKey() != null
                && questionKeys.contains(m.getContent().setupKey()))
            .map(CompanionMessageEntity::getId)
            .collect(Collectors.toSet());
    }
}
