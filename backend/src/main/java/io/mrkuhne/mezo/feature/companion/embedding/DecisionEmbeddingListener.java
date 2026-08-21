package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.feature.journal.service.DecisionEntrySavedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * The W1.4 post-commit decision embed trigger ({@link JournalEmbeddingListener}'s idiom): after a
 * decision is created or reviewed, keep its {@code memory_embedding(kind=decision)} vector in
 * sync asynchronously. Gated on BOTH the companion and the journal switch, so flipping either off
 * removes the bean and no decision embed call can happen. Failures are logged and swallowed —
 * memory building must never affect a decision write.
 *
 * <p>Only the create-then-fast-review race needs handling here: two AFTER_COMMIT handlers for the
 * same decision can run concurrently on Boot's multi-threaded task executor, both take the insert
 * branch, and the loser hits {@code uq_memory_embedding_kind_ref_id}. It is retried once after a
 * re-read, so the retry takes the update-in-place branch on the winner's row and embeds the LATEST
 * state. There is no delete path for decisions (the surface offers no delete), which is why this
 * listener carries no delete-race re-check.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.JOURNAL_SWITCH},
        havingValue = "true")
public class DecisionEmbeddingListener {

    private final MemoryEmbeddingWriter memoryEmbeddingWriter;
    private final DecisionEntryRepository decisionEntryRepository;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDecisionEntrySaved(DecisionEntrySavedEvent event) {
        try {
            DecisionEntryEntity decision =
                    decisionEntryRepository.findById(event.decisionId()).orElse(null);
            if (decision == null) {
                return;
            }
            try {
                memoryEmbeddingWriter.writeDecision(decision);
            } catch (DataIntegrityViolationException raceLost) {
                DecisionEntryEntity latest =
                        decisionEntryRepository.findById(event.decisionId()).orElse(null);
                if (latest != null) {
                    memoryEmbeddingWriter.writeDecision(latest);
                }
            }
        } catch (Exception e) {
            log.warn("Decision embedding failed for decision {}", event.decisionId(), e);
        }
    }
}
