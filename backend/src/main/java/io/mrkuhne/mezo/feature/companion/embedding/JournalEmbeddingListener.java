package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.journal.service.JournalEntryDeletedEvent;
import io.mrkuhne.mezo.feature.journal.service.JournalEntrySavedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * The W1.1 post-commit journal embed trigger (the {@code TurnEmbeddingListener} idiom): after a
 * journal entry create/update/delete commits, keep its {@code memory_embedding} vector in sync
 * asynchronously. Gated on BOTH the companion switch and the journal switch — flipping either off
 * removes this bean, so no journal embed call can ever happen. Failures are logged and swallowed:
 * memory building must never affect a journal write.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.JOURNAL_SWITCH},
        havingValue = "true")
public class JournalEmbeddingListener {

    private final MemoryEmbeddingWriter memoryEmbeddingWriter;
    private final JournalEntryRepository journalEntryRepository;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onJournalEntrySaved(JournalEntrySavedEvent event) {
        try {
            JournalEntryEntity entry = journalEntryRepository.findById(event.entryId()).orElse(null);
            if (entry == null || entry.isDeleted()) {
                return;
            }
            memoryEmbeddingWriter.writeJournal(entry);
        } catch (Exception e) {
            log.warn("Journal embedding failed for entry {}", event.entryId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onJournalEntryDeleted(JournalEntryDeletedEvent event) {
        try {
            memoryEmbeddingWriter.deleteJournalEmbedding(event.entryId());
        } catch (Exception e) {
            log.warn("Journal embedding delete failed for entry {}", event.entryId(), e);
        }
    }
}
