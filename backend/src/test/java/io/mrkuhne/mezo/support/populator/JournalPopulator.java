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
import java.time.temporal.ChronoUnit;
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

    /** W4.3 (mezo-b3pp.17): a decision that has already been through the review loop. */
    public DecisionEntryEntity createReviewedDecision(UUID owner, LocalDate decidedOn,
            String decisionText, int outcomeRating, String outcomeText) {
        return createReviewedDecision(owner, decidedOn, decisionText, outcomeRating, outcomeText,
                Instant.now().truncatedTo(ChronoUnit.MICROS));
    }

    /** W4.3 (mezo-b3pp.17) review fix: same as {@link #createReviewedDecision(UUID, LocalDate,
     *  String, int, String)} but with an explicit {@code reviewedAt} — ordering tests need two
     *  reviewed rows with deterministically distinct instants, which back-to-back {@code now()}
     *  calls cannot guarantee once truncated to microseconds. */
    public DecisionEntryEntity createReviewedDecision(UUID owner, LocalDate decidedOn,
            String decisionText, int outcomeRating, String outcomeText, Instant reviewedAt) {
        DecisionEntryEntity e = new DecisionEntryEntity();
        e.setCreatedBy(owner);
        e.setDecidedOn(decidedOn);
        e.setDecisionText(decisionText);
        e.setContextSnapshot(new DecisionContextEnvelope(null, Instant.parse("2026-08-20T06:00:00Z")));
        e.setReviewDue(decidedOn.plusDays(14));
        e.setReviewedAt(reviewedAt);
        e.setOutcomeRating((short) outcomeRating);
        e.setOutcomeText(outcomeText);
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
