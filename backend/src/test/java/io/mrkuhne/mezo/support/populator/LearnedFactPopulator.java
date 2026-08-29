package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

import java.time.LocalDate;
import java.util.UUID;

@TestComponent
@RequiredArgsConstructor
public class LearnedFactPopulator {

    private final LearnedFactRepository repository;

    /** An undecided extraction candidate (user_decision null until the confirm flow decides it). */
    public LearnedFactEntity candidate(UUID createdBy, String candidateText, UUID derivedFromMessageId) {
        return candidate(createdBy, candidateText, "life", derivedFromMessageId);
    }

    public LearnedFactEntity candidate(UUID createdBy, String candidateText, String category, UUID derivedFromMessageId) {
        LearnedFactEntity candidate = new LearnedFactEntity();
        candidate.setCreatedBy(createdBy);
        candidate.setCandidateText(candidateText);
        candidate.setCategory(category);
        candidate.setDerivedFromMessageId(derivedFromMessageId);
        return repository.saveAndFlush(candidate);
    }

    /** A weekly-review candidate (mezo-d20.7.6) — no message behind it, a week and an evidence
     *  line instead; {@code decision} null leaves it OPEN. */
    public LearnedFactEntity weeklyCandidate(UUID createdBy, LocalDate weekStart, String candidateText,
            String category, String evidence, String decision) {
        LearnedFactEntity candidate = new LearnedFactEntity();
        candidate.setCreatedBy(createdBy);
        candidate.setCandidateText(candidateText);
        candidate.setCategory(category);
        candidate.setSource(LearnedFactEntity.SOURCE_WEEKLY_REVIEW);
        candidate.setWeekStart(weekStart);
        candidate.setEvidence(evidence);
        candidate.setUserDecision(decision);
        return repository.saveAndFlush(candidate);
    }
}
