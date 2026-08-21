package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.journal.entity.DecisionContextEnvelope;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.entity.GratitudeEntryEntity;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.feature.journal.repository.GratitudeEntryRepository;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the JournalEntry + DecisionEntry aggregates — persists via {@code saveAndFlush}
 *  so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class JournalPopulator {

    private final JournalEntryRepository repository;
    private final DecisionEntryRepository decisionRepository;
    private final GratitudeEntryRepository gratitudeEntryRepository;

    public JournalEntryEntity createEntry(UUID owner, LocalDate occurredOn, String text, String source) {
        JournalEntryEntity e = new JournalEntryEntity();
        e.setCreatedBy(owner);
        e.setOccurredOn(occurredOn);
        e.setText(text);
        e.setSource(source);
        return repository.saveAndFlush(e);
    }

    public DecisionEntryEntity createDecision(UUID owner, LocalDate decidedOn, String decisionText,
                                              LocalDate reviewDue, String snapshotText) {
        DecisionEntryEntity e = new DecisionEntryEntity();
        e.setCreatedBy(owner);
        e.setDecidedOn(decidedOn);
        e.setDecisionText(decisionText);
        e.setContextSnapshot(new DecisionContextEnvelope(snapshotText, Instant.parse("2026-08-20T06:00:00Z")));
        e.setReviewDue(reviewDue);
        return decisionRepository.saveAndFlush(e);
    }

    public GratitudeEntryEntity createGratitude(UUID owner, LocalDate occurredOn, String text, String lifeArea) {
        var e = new GratitudeEntryEntity();
        e.setCreatedBy(owner);
        e.setOccurredOn(occurredOn);
        e.setText(text);
        e.setLifeArea(lifeArea);
        return gratitudeEntryRepository.saveAndFlush(e);
    }
}
