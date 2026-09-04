package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.feedback.service.FeedMessageKindSource;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.Collection;
import java.util.Map;
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
}
