package io.mrkuhne.mezo.feature.companion.embedding;

import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.journal.service.JournalEntryDeletedEvent;
import io.mrkuhne.mezo.feature.journal.service.JournalEntrySavedEvent;
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
 * The W1.1 post-commit journal embed trigger (the {@code TurnEmbeddingListener} idiom): after a
 * journal entry create/update/delete commits, keep its {@code memory_embedding} vector in sync
 * asynchronously. Gated on BOTH the companion switch and the journal switch — flipping either off
 * removes this bean, so no journal embed call can ever happen. Failures are logged and swallowed:
 * memory building must never affect a journal write.
 *
 * <p>Journal has no nightly self-heal sweep (unlike {@code chat_turn}'s {@code
 * findUnembeddedTurnIds} — spec §5.5 scopes W1.5's catch-up to {@code activity_note}/{@code
 * checkin_note} only), so the two races below are handled inline instead of being left for a
 * sweep that doesn't exist:
 * <ul>
 *   <li>create-then-fast-edit: Boot's default multi-threaded {@code applicationTaskExecutor} can
 *       run both entries' AFTER_COMMIT handlers concurrently; both take {@code writeJournal}'s
 *       insert branch, and the loser hits {@code uq_memory_embedding_kind_ref_id}. Retried once
 *       below, re-reading first so the retry takes the update-in-place branch on the winner's row.
 *   <li>create-then-delete: the saved/deleted listeners are unordered, so a delete that commits
 *       and runs its listener BEFORE this save's write lands would otherwise leave a live vector
 *       for a dead entry. Re-checked after the write below.
 * </ul>
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
            // @SQLRestriction("is_deleted = false") already filters findById, so a null result here
            // covers "row is soft-deleted" too — no separate entry.isDeleted() check is reachable.
            JournalEntryEntity entry = journalEntryRepository.findById(event.entryId()).orElse(null);
            if (entry == null) {
                return;
            }
            try {
                memoryEmbeddingWriter.writeJournal(entry);
            } catch (DataIntegrityViolationException raceLost) {
                // Lost the insert race against a concurrent save of the SAME entry (Finding 1) —
                // re-read so the retry embeds the LATEST text, not this handler's stale snapshot.
                JournalEntryEntity latest = journalEntryRepository.findById(event.entryId()).orElse(null);
                if (latest == null) {
                    return;
                }
                memoryEmbeddingWriter.writeJournal(latest);
            }
            // Finding 2: the write above may now be live for an entry a racing delete already
            // committed. Re-check liveness and clean up if so — genuinely different from the
            // pre-write null check above (that one guards THIS call's own stale event; this one
            // guards against a delete that raced ahead of the write we just performed).
            if (journalEntryRepository.findById(event.entryId()).isEmpty()) {
                memoryEmbeddingWriter.deleteJournalEmbedding(event.entryId());
            }
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
