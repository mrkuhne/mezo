package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

import java.util.UUID;

@TestComponent
@RequiredArgsConstructor
public class KnowledgeFactPopulator {

    private final KnowledgeFactRepository repository;

    /** A confirmed, prompt-included manual fact with the given reinforcement count. */
    public KnowledgeFactEntity fact(UUID createdBy, String factText, String category, int reinforcementCount) {
        return fact(createdBy, factText, category, reinforcementCount, true, KnowledgeFactEntity.SOURCE_MANUAL);
    }

    public KnowledgeFactEntity fact(UUID createdBy, String factText, String category, int reinforcementCount,
            boolean includeInPrompt, String source) {
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(createdBy);
        fact.setFactText(factText);
        fact.setCategory(category);
        fact.setSource(source);
        fact.setReinforcementCount(reinforcementCount);
        fact.setIncludeInPrompt(includeInPrompt);
        return repository.saveAndFlush(fact);
    }
}
