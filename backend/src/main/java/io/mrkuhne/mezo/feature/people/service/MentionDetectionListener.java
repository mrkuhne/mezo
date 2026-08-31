package io.mrkuhne.mezo.feature.people.service;

import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.feature.journal.repository.GratitudeEntryRepository;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.journal.service.DecisionEntrySavedEvent;
import io.mrkuhne.mezo.feature.journal.service.GratitudeEntrySavedEvent;
import io.mrkuhne.mezo.feature.journal.service.JournalEntrySavedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * S2 azonnali név-match a journal-forrásokra (napló/hála/döntés — spec §3.2, bd mezo-06o0.1), a
 * {@code JournalEmbeddingListener} idiómán. Kapuzás: PEOPLE ∧ JOURNAL switch — bármelyik off,
 * és a bean nem létezik. IDENT-3: minden hiba warn + swallow, a user írása sosem sérül. Az új
 * people→journal él ciklusmentes (a journal semmit nem importál kifelé).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.PEOPLE_SWITCH, FeaturesConfiguration.JOURNAL_SWITCH},
        havingValue = "true")
public class MentionDetectionListener {

    private final MentionDetectionService mentionDetectionService;
    private final JournalEntryRepository journalEntryRepository;
    private final GratitudeEntryRepository gratitudeEntryRepository;
    private final DecisionEntryRepository decisionEntryRepository;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onJournalEntrySaved(JournalEntrySavedEvent event) {
        try {
            journalEntryRepository.findById(event.entryId()).ifPresent(entry ->
                    mentionDetectionService.detect(entry.getCreatedBy(), entry.getText(),
                            "text", "journal_entry", entry.getId(), Instant.now()));
        } catch (Exception e) {
            log.warn("Mention detection failed for journal entry {}", event.entryId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onGratitudeEntrySaved(GratitudeEntrySavedEvent event) {
        try {
            gratitudeEntryRepository.findById(event.entryId()).ifPresent(entry ->
                    mentionDetectionService.detect(entry.getCreatedBy(), entry.getText(),
                            "text", "gratitude", entry.getId(), Instant.now()));
        } catch (Exception e) {
            log.warn("Mention detection failed for gratitude entry {}", event.entryId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onDecisionEntrySaved(DecisionEntrySavedEvent event) {
        try {
            decisionEntryRepository.findById(event.decisionId()).ifPresent(decision ->
                    mentionDetectionService.detect(decision.getCreatedBy(),
                            decisionText(decision), "text", "decision", decision.getId(),
                            Instant.now()));
        } catch (Exception e) {
            log.warn("Mention detection failed for decision {}", event.decisionId(), e);
        }
    }

    /** A döntés-szöveg + (ha már van) a kimenet — mindkettő a user szava, mindkettő matchelhető. */
    private static String decisionText(DecisionEntryEntity decision) {
        return decision.getOutcomeText() == null
                ? decision.getDecisionText()
                : decision.getDecisionText() + "\n" + decision.getOutcomeText();
    }
}
