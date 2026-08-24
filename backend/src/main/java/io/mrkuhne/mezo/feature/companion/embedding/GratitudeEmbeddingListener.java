package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.journal.entity.GratitudeEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.GratitudeEntryRepository;
import io.mrkuhne.mezo.feature.journal.service.GratitudeEntryDeletedEvent;
import io.mrkuhne.mezo.feature.journal.service.GratitudeEntrySavedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * The W1.3 post-commit gratitude embed trigger: after a gratitude entry create/delete commits,
 * keep its {@code memory_embedding} vector in sync asynchronously. Gated on BOTH the companion
 * switch and the journal switch — flipping either off removes this bean, so no gratitude embed
 * call can ever happen. Failures are logged and swallowed: memory building must never affect a
 * gratitude write.
 *
 * <p>Gratitude has no update endpoint (unlike journal), so only two races exist:
 * <ul>
 *   <li>create-then-fast-delete: the saved/deleted listeners are unordered, so a delete that
 *       commits and runs its listener BEFORE this save's write lands would otherwise leave a live
 *       vector for a dead entry. Re-checked after the write below.
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.JOURNAL_SWITCH},
        havingValue = "true")
public class GratitudeEmbeddingListener {

    private final MemoryEmbeddingWriter memoryEmbeddingWriter;
    private final GratitudeEntryRepository gratitudeEntryRepository;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onGratitudeEntrySaved(GratitudeEntrySavedEvent event) {
        try {
            GratitudeEntryEntity entry = gratitudeEntryRepository.findById(event.entryId()).orElse(null);
            if (entry == null) {
                return;
            }
            try {
                memoryEmbeddingWriter.writeGratitude(entry);
            } catch (DataIntegrityViolationException raceLost) {
                // Lost the insert race against a concurrent save of the SAME entry —
                // re-read so the retry embeds the LATEST text, not this handler's stale snapshot.
                GratitudeEntryEntity latest = gratitudeEntryRepository.findById(event.entryId()).orElse(null);
                if (latest == null) {
                    return;
                }
                memoryEmbeddingWriter.writeGratitude(latest);
            }
            // The write above may now be live for an entry a racing delete already
            // committed. Re-check liveness and clean up if so.
            if (gratitudeEntryRepository.findById(event.entryId()).isEmpty()) {
                memoryEmbeddingWriter.deleteGratitudeEmbedding(event.entryId());
            }
        } catch (Exception e) {
            log.warn("Gratitude embedding failed for entry {}", event.entryId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onGratitudeEntryDeleted(GratitudeEntryDeletedEvent event) {
        try {
            memoryEmbeddingWriter.deleteGratitudeEmbedding(event.entryId());
        } catch (Exception e) {
            log.warn("Gratitude embedding delete failed for entry {}", event.entryId(), e);
        }
    }
}
