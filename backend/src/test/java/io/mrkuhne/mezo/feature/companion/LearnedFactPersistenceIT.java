package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * learned_fact is born in V1.1 as a table only (the extraction/decision flow is V1.2) —
 * this IT proves the candidate → decision → promoted_fact_id shape round-trips.
 */
@Transactional
class LearnedFactPersistenceIT extends AbstractIntegrationTest {

    @Autowired private LearnedFactRepository learnedFactRepository;
    @Autowired private LearnedFactPopulator learnedFactPopulator;
    @Autowired private KnowledgeFactPopulator knowledgeFactPopulator;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private AiMessagePopulator messagePopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testCandidate_shouldPersistUndecided_whenCreated() {
        UUID userId = databasePopulator.populateUser("learned-new@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        AiMessageEntity message = messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "laktózérzékeny vagyok");

        LearnedFactEntity candidate = learnedFactPopulator.candidate(userId, "Laktózérzékeny", "health", message.getId());

        LearnedFactEntity reloaded = learnedFactRepository.findById(candidate.getId()).orElseThrow();
        assertThat(reloaded.getCandidateText()).isEqualTo("Laktózérzékeny");
        assertThat(reloaded.getCategory()).isEqualTo("health");
        assertThat(reloaded.getDerivedFromMessageId()).isEqualTo(message.getId());
        assertThat(reloaded.getUserDecision()).isNull();
        assertThat(reloaded.getRefinedText()).isNull();
        assertThat(reloaded.getPromotedFactId()).isNull();
    }

    @Test
    void testCandidate_shouldLinkPromotedFact_whenAcceptDecisionRecorded() {
        UUID userId = databasePopulator.populateUser("learned-promote@test.local");
        LearnedFactEntity candidate = learnedFactPopulator.candidate(userId, "Reggel edz", null);
        KnowledgeFactEntity promoted = knowledgeFactPopulator.fact(userId, "Reggel edz", "train", 0);

        candidate.setUserDecision(LearnedFactEntity.DECISION_ACCEPT);
        candidate.setPromotedFactId(promoted.getId());
        learnedFactRepository.saveAndFlush(candidate);

        LearnedFactEntity reloaded = learnedFactRepository.findById(candidate.getId()).orElseThrow();
        assertThat(reloaded.getUserDecision()).isEqualTo(LearnedFactEntity.DECISION_ACCEPT);
        assertThat(reloaded.getPromotedFactId()).isEqualTo(promoted.getId());
        assertThat(reloaded.getDerivedFromMessageId()).isNull();
    }
}
