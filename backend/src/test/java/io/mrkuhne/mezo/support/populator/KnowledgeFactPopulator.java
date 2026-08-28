package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.transaction.annotation.Transactional;

@TestComponent
@RequiredArgsConstructor
public class KnowledgeFactPopulator {

    private final KnowledgeFactRepository repository;

    /** JPA-managed shared EntityManager — the {@code @CreationTimestamp} backdate needs a native
     *  update; field-injected {@code @PersistenceContext} is the house exception to constructor DI
     *  (see {@code WeightLogPopulator.createWeightLogAt}). */
    @PersistenceContext
    private EntityManager em;

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

    /** A fact with a controlled {@code created_at} — the weekly-review digest's week-window
     *  read filters on it, so week-in-the-past tests need to backdate (mezo-p2tr). */
    @Transactional
    public KnowledgeFactEntity factAt(UUID createdBy, String factText, String category, Instant createdAt) {
        KnowledgeFactEntity fact = fact(createdBy, factText, category, 1);
        em.createNativeQuery("update knowledge_fact set created_at = :at where id = :id")
                .setParameter("at", createdAt).setParameter("id", fact.getId()).executeUpdate();
        em.clear();
        return repository.findById(fact.getId()).orElseThrow();
    }
}
