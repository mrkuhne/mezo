package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.companion.service.FactExtractionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The V1.2 post-turn extractor against the fake LLM — the fake answers extraction calls
 * (system prompt keyed on EXTRACTION_MARKER) with the [fake-facts:<json>] sentinel found
 * in the turn content, so parse/dedupe/cap logic is fully deterministic and LLM-free.
 */
@Transactional
@ActiveProfiles("companion-fake")
class FactExtractionServiceIT extends AbstractIntegrationTest {

    @Autowired private FactExtractionService factExtractionService;
    @Autowired private LearnedFactRepository learnedFactRepository;
    @Autowired private KnowledgeFactPopulator knowledgeFactPopulator;
    @Autowired private LearnedFactPopulator learnedFactPopulator;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private AiMessagePopulator messagePopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private List<LearnedFactEntity> pending(UUID userId) {
        return learnedFactRepository
                .findByCreatedByAndUserDecisionIsNullAndDeletedFalseOrderByCreatedAtDesc(userId);
    }

    @Test
    void testExtractFromTurn_shouldPersistCandidates_whenLlmReturnsFacts() {
        UUID userId = databasePopulator.populateUser("extract-happy@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        UUID messageId = messagePopulator
                .message(conversation, AiMessageEntity.ROLE_USER, "mesélek magamról").getId();
        String content = "mesélek magamról [fake-facts:[" +
                "{\"fact\":\"Laktózérzékeny\",\"category\":\"health\"}," +
                "{\"fact\":\"Reggel edz szívesen\",\"category\":\"train\"}]]";

        int persisted = factExtractionService.extractFromTurn(userId, messageId, content, "értem, felírtam");

        assertThat(persisted).isEqualTo(2);
        List<LearnedFactEntity> candidates = pending(userId);
        assertThat(candidates).extracting(LearnedFactEntity::getCandidateText)
                .containsExactlyInAnyOrder("Laktózérzékeny", "Reggel edz szívesen");
        assertThat(candidates).extracting(LearnedFactEntity::getCategory)
                .containsExactlyInAnyOrder("health", "train");
        assertThat(candidates).allSatisfy(c -> {
            assertThat(c.getDerivedFromMessageId()).isEqualTo(messageId);
            assertThat(c.getUserDecision()).isNull();
        });
    }

    @Test
    void testExtractFromTurn_shouldSkipDuplicates_whenFactAlreadyConfirmedOrPending() {
        UUID userId = databasePopulator.populateUser("extract-dupe@test.local");
        knowledgeFactPopulator.fact(userId, "Laktózérzékeny", "health", 3);
        learnedFactPopulator.candidate(userId, "Reggel edz  Szívesen", "train", null);
        String content = "ismétlem magam [fake-facts:[" +
                "{\"fact\":\"laktózérzékeny\",\"category\":\"health\"}," +
                "{\"fact\":\"Reggel edz szívesen\",\"category\":\"train\"}]]";

        int persisted = factExtractionService.extractFromTurn(userId, null, content, "tudom");

        assertThat(persisted).isZero();
        assertThat(pending(userId)).hasSize(1); // only the pre-seeded candidate
    }

    @Test
    void testExtractFromTurn_shouldCapCandidates_whenMoreThanBudget() {
        UUID userId = databasePopulator.populateUser("extract-cap@test.local");
        String content = "sok tény [fake-facts:[" +
                "{\"fact\":\"tény-1\",\"category\":\"life\"}," +
                "{\"fact\":\"tény-2\",\"category\":\"life\"}," +
                "{\"fact\":\"tény-3\",\"category\":\"life\"}," +
                "{\"fact\":\"tény-4\",\"category\":\"life\"}," +
                "{\"fact\":\"tény-5\",\"category\":\"life\"}]]";

        int persisted = factExtractionService.extractFromTurn(userId, null, content, "ok");

        assertThat(persisted).isEqualTo(3); // mezo.companion.extraction.max-candidates-per-turn
    }

    @Test
    void testExtractFromTurn_shouldDropInvalidItems_whenCategoryUnknownOrFactBlank() {
        UUID userId = databasePopulator.populateUser("extract-invalid@test.local");
        String content = "vegyes [fake-facts:[" +
                "{\"fact\":\"jó tény\",\"category\":\"fuel\"}," +
                "{\"fact\":\"rossz kategória\",\"category\":\"sport\"}," +
                "{\"fact\":\"\",\"category\":\"life\"}]]";

        int persisted = factExtractionService.extractFromTurn(userId, null, content, "ok");

        assertThat(persisted).isEqualTo(1);
        assertThat(pending(userId).getFirst().getCandidateText()).isEqualTo("jó tény");
    }

    @Test
    void testExtractFromTurn_shouldPersistNothing_whenLlmAnswerIsNotJson() {
        UUID userId = databasePopulator.populateUser("extract-broken@test.local");

        int persisted = factExtractionService.extractFromTurn(
                userId, null, "törött [fake-facts:not-json]", "ok");

        assertThat(persisted).isZero();
        assertThat(pending(userId)).isEmpty();
    }

    @Test
    void testExtractFromTurn_shouldPersistNothing_whenNoFactsInTurn() {
        UUID userId = databasePopulator.populateUser("extract-empty@test.local");

        int persisted = factExtractionService.extractFromTurn(userId, null, "szia", "szia Daniel");

        assertThat(persisted).isZero();
        assertThat(pending(userId)).isEmpty();
    }
}
