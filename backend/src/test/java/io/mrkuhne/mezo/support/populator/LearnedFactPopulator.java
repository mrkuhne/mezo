package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

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
}
