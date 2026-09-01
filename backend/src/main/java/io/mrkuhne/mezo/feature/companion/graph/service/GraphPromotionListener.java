package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactChangedEvent;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactPromotedEvent;
import io.mrkuhne.mezo.feature.companion.service.PatternConfirmedEvent;
import io.mrkuhne.mezo.feature.companion.service.PatternRetractedEvent;
import io.mrkuhne.mezo.feature.goal.service.GoalDeletedEvent;
import io.mrkuhne.mezo.feature.goal.service.GoalSavedEvent;
import io.mrkuhne.mezo.feature.people.service.PersonDeletedEvent;
import io.mrkuhne.mezo.feature.people.service.PersonSavedEvent;
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
            // syncFact, not promoteFact: a freshly promoted candidate that is somehow already
            // opted out (mezo-b3pp.30) must not become an active node either.
            promotionService.syncFact(event.userId(), event.factId());
        } catch (Exception e) {
            log.warn("Graph promotion failed for knowledge fact {}", event.factId(), e);
        }
    }

    /**
     * mezo-b3pp.30: a fact's text, category or {@code includeInPrompt} toggle changed — re-derive
     * whether it still qualifies for the graph and promote or archive its node accordingly, so the
     * user's opt-out (or opt-back-in) takes effect on the next turn rather than at the nightly
     * {@code reconcile} sweep.
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onKnowledgeFactChanged(KnowledgeFactChangedEvent event) {
        try {
            promotionService.syncFact(event.userId(), event.factId());
        } catch (Exception e) {
            log.warn("Graph fact sync failed for fact {}", event.factId(), e);
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

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPatternRetracted(PatternRetractedEvent event) {
        try {
            promotionService.retractPattern(event.userId(), event.patternId());
        } catch (Exception e) {
            log.warn("Graph pattern retraction failed for pattern {}", event.patternId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onGoalDeleted(GoalDeletedEvent event) {
        try {
            promotionService.retractGoal(event.userId(), event.goalId());
        } catch (Exception e) {
            log.warn("Graph goal retraction failed for goal {}", event.goalId(), e);
        }
    }

    /** Emberek S5 (mezo-06o0.4): a személy-írás élőben frissíti a PERSON node-ot; a nightly
     *  {@code reconcile} már csak gyógyító háló (pl. ha a gráf-kapcsoló ki volt kapcsolva). */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPersonSaved(PersonSavedEvent event) {
        try {
            promotionService.syncPerson(event.userId(), event.personId());
        } catch (Exception e) {
            log.warn("Graph person sync failed for person {}", event.personId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPersonDeleted(PersonDeletedEvent event) {
        try {
            promotionService.retractPerson(event.userId(), event.personId());
        } catch (Exception e) {
            log.warn("Graph person retraction failed for person {}", event.personId(), e);
        }
    }
}
