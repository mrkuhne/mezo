package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.UUID;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * The full V1.2 post-turn pipeline over a COMMITTING chat turn: sendMessage → AFTER_COMMIT event
 * → async listener → extraction (fake LLM, [fake-facts:…] sentinel) → pending learned_fact row.
 * ApiIntegrationTest commits server-side, so the AFTER_COMMIT listener genuinely fires;
 * Awaitility rides out the async hop.
 */
@ActiveProfiles("companion-fake")
class ChatExtractionFlowIT extends ApiIntegrationTest {

    @Autowired private LearnedFactRepository learnedFactRepository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    @Test
    void testSendMessage_shouldPersistExtractedCandidateAsync_whenTurnCarriesFacts() {
        UUID ownerId = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
        ConversationResponse conversation = postForBody("/api/companion/conversation", null,
                ownerAuthHeaders(), HttpStatus.CREATED, ConversationResponse.class);

        MessageResponse answer = postForBody(
                "/api/companion/conversation/" + conversation.getId() + "/message",
                SendMessageRequest.builder()
                        .content("mesélek: [fake-facts:[{\"fact\":\"Laktózérzékeny\",\"category\":\"health\"}]]")
                        .build(),
                ownerAuthHeaders(), HttpStatus.OK, MessageResponse.class);
        assertThat(answer.getRole()).isEqualTo("assistant");

        await().atMost(5, SECONDS).untilAsserted(() -> {
            List<LearnedFactEntity> pending = learnedFactRepository
                    .findByCreatedByAndUserDecisionIsNullAndDeletedFalseOrderByCreatedAtDesc(ownerId);
            assertThat(pending).extracting(LearnedFactEntity::getCandidateText).contains("Laktózérzékeny");
            assertThat(pending.getFirst().getCategory()).isEqualTo("health");
            assertThat(pending.getFirst().getDerivedFromMessageId()).isNotNull();
        });
    }
}
