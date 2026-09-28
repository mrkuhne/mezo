package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * S8 (mezo-d6ivw.12): the one-shot rewrite of pre-S8 pattern facts whose text is still their
 * promoting pattern's TITLE. Not a Liquibase changeset — the data is user-specific and the owner
 * sees the before/after list first. {@link #plan} is the dry-run; {@link #apply} rewrites only
 * what {@link #plan} lists, publishes {@link KnowledgeFactChangedEvent} per row (graph + RAG
 * resync) and never touches the mute state. Deleted (forgotten) facts are not read at all.
 * Idempotent: an applied row no longer equals its title.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FactTextBackfillService {

    public record Change(UUID factId, UUID patternId, String before, String after, boolean muted) {}

    private final KnowledgeFactRepository factRepository;
    private final PatternRepository patternRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public List<Change> plan(UUID userId) {
        Map<UUID, PatternEntity> byFact = patternRepository.findByCreatedByAndPromotedFactIdIsNotNullAndDeletedFalse(userId)
                .stream().collect(Collectors.toMap(PatternEntity::getPromotedFactId, p -> p, (a, b) -> a));
        List<Change> changes = new ArrayList<>();
        for (KnowledgeFactEntity fact : factRepository.findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId)) {
            PatternEntity pattern = promotingPattern(userId, fact, byFact);
            if (pattern == null || !fact.getFactText().equals(pattern.getTitle())) {
                continue;
            }
            String after = FactTextComposer.compose(pattern.getKind(), pattern.getTitle(), pattern.getMechanism());
            if (!after.equals(fact.getFactText())) {
                changes.add(new Change(fact.getId(), pattern.getId(), fact.getFactText(), after,
                        !fact.isIncludeInPrompt()));
            }
        }
        return changes;
    }

    @Transactional
    public List<Change> apply(UUID userId) {
        List<Change> changes = plan(userId);
        for (Change change : changes) {
            KnowledgeFactEntity fact = factRepository.findByIdAndCreatedByAndDeletedFalse(change.factId(), userId).orElseThrow();
            fact.setFactText(change.after());
            factRepository.save(fact);
            eventPublisher.publishEvent(new KnowledgeFactChangedEvent(userId, fact.getId()));
        }
        return changes;
    }

    private PatternEntity promotingPattern(UUID userId, KnowledgeFactEntity fact, Map<UUID, PatternEntity> byFact) {
        UUID viaEnvelope = fact.getProvenance() == null ? null : fact.getProvenance().patternId();
        if (viaEnvelope != null) {
            PatternEntity row = patternRepository.findByIdAndCreatedByAndDeletedFalse(viaEnvelope, userId).orElse(null);
            if (row != null) {
                return row;
            }
        }
        return byFact.get(fact.getId()); // pre-S2 promotions carry no envelope
    }
}
