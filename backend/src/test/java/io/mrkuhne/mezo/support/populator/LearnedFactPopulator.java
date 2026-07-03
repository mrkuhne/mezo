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

    /** An undecided extraction candidate (user_decision null until V1.2's confirm flow). */
    public LearnedFactEntity candidate(UUID createdBy, String candidateText, UUID derivedFromMessageId) {
        LearnedFactEntity candidate = new LearnedFactEntity();
        candidate.setCreatedBy(createdBy);
        candidate.setCandidateText(candidateText);
        candidate.setDerivedFromMessageId(derivedFromMessageId);
        return repository.saveAndFlush(candidate);
    }
}
