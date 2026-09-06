package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.journal.repository.GratitudeEntryRepository;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.journal.service.GratitudeEntryDeletedEvent;
import io.mrkuhne.mezo.feature.journal.service.GratitudeEntrySavedEvent;
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
 * Reflexió S1 (bd mezo-eq85.1) — the post-commit text-signal trigger, built on the
 * {@code JournalEmbeddingListener} idiom: after a journal/gratitude write commits, extract that
 * entry's signal asynchronously. Gated on the companion, journal AND reflection switches — flipping
 * any one off removes this bean, so no extraction call can happen.
 *
 * <p>Failures are logged and swallowed: signal extraction must never affect a journal write. That
 * is also why the source rows are read through the journal REPOSITORIES rather than through
 * {@code JournalService} — the companion slice already depends on journal events + repositories
 * (see {@code companion/embedding}), and reaching for a journal SERVICE here would widen that
 * dependency for no gain.
 *
 * <p>The delete handlers cannot resolve an owner (the event carries only the id, and the source row
 * is already soft-deleted by AFTER_COMMIT time), so they use the deliberately narrow owner-less
 * suppression documented on {@code TextSignalRepository}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.JOURNAL_SWITCH,
                FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class TextSignalListener {

    private final TextSignalService textSignalService;
    private final JournalEntryRepository journalEntryRepository;
    private final GratitudeEntryRepository gratitudeEntryRepository;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onJournalEntrySaved(JournalEntrySavedEvent event) {
        try {
            // @SQLRestriction("is_deleted = false") already filters findById, so an empty result
            // covers "a racing delete already committed" too — nothing to extract either way.
            journalEntryRepository.findById(event.entryId()).ifPresent(entry ->
                    textSignalService.record(entry.getCreatedBy(), TextSignalEntity.SOURCE_JOURNAL,
                            entry.getId(), entry.getOccurredOn(), entry.getText()));
        } catch (Exception e) {
            log.warn("Text signal extraction failed for journal entry {}", event.entryId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onGratitudeEntrySaved(GratitudeEntrySavedEvent event) {
        try {
            gratitudeEntryRepository.findById(event.entryId()).ifPresent(entry ->
                    textSignalService.record(entry.getCreatedBy(), TextSignalEntity.SOURCE_GRATITUDE,
                            entry.getId(), entry.getOccurredOn(), entry.getText()));
        } catch (Exception e) {
            log.warn("Text signal extraction failed for gratitude entry {}", event.entryId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onJournalEntryDeleted(JournalEntryDeletedEvent event) {
        try {
            textSignalService.suppressBySource(TextSignalEntity.SOURCE_JOURNAL, event.entryId());
        } catch (Exception e) {
            log.warn("Text signal suppression failed for journal entry {}", event.entryId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onGratitudeEntryDeleted(GratitudeEntryDeletedEvent event) {
        try {
            textSignalService.suppressBySource(TextSignalEntity.SOURCE_GRATITUDE, event.entryId());
        } catch (Exception e) {
            log.warn("Text signal suppression failed for gratitude entry {}", event.entryId(), e);
        }
    }
}
