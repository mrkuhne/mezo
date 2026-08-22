package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactPromotedEvent;
import io.mrkuhne.mezo.feature.companion.service.PatternConfirmedEvent;
import io.mrkuhne.mezo.feature.goal.service.GoalSavedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * W2.2 promotion hooks (bd mezo-b3pp.7, spec §6.2) — the {@code JournalEmbeddingListener} idiom:
 * AFTER_COMMIT + {@code @Async}, so the (LLM-bearing) promotion never sits inside the user's write
 * transaction and a graph failure can never break a pattern decision, a fact accept or a goal save.
 * Gated on BOTH switches: with either off the bean does not exist and the hooks are simply absent.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH},
    havingValue = "true")
public class GraphPromotionListener {

    private final GraphPromotionService promotionService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPatternConfirmed(PatternConfirmedEvent event) {
        try {
            promotionService.promotePattern(event.userId(), event.patternId());
        } catch (Exception e) {
            log.warn("Graph promotion failed for pattern {}", event.patternId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onKnowledgeFactPromoted(KnowledgeFactPromotedEvent event) {
        try {
            promotionService.promoteFact(event.userId(), event.factId());
        } catch (Exception e) {
            log.warn("Graph promotion failed for knowledge fact {}", event.factId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onGoalSaved(GoalSavedEvent event) {
        try {
            promotionService.syncGoal(event.userId(), event.goalId());
        } catch (Exception e) {
            log.warn("Graph goal sync failed for goal {}", event.goalId(), e);
        }
    }
}
