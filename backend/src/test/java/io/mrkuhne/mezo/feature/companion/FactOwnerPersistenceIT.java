package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Transactional
class FactOwnerPersistenceIT extends AbstractIntegrationTest {
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private LearnedFactPopulator learnedFactPopulator;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;

    @Test
    void testPersist_shouldDefaultOwnerFromCategory_whenProducerNamesNone() {
        UUID userId = databasePopulator.populateUser("owner-default@test.local");
        LearnedFactEntity candidate = learnedFactPopulator.candidate(userId, "Szeretem a zabkását", "fuel", null);
        assertThat(candidate.getOwner()).isEqualTo("falat");

        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(userId);
        fact.setFactText("Kedden röplabda");
        fact.setCategory("train");
        fact.setSource(KnowledgeFactEntity.SOURCE_MANUAL);
        assertThat(knowledgeFactRepository.saveAndFlush(fact).getOwner()).isEqualTo("mocor");
    }
}
