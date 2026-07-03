package io.mrkuhne.mezo.feature.companion.embedding;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * V2.2 post-turn embedding e2e (the ChatExtractionFlowIT pattern): a committed HTTP chat turn
 * fires the AFTER_COMMIT listener, which embeds the turn as one unit through the fake port.
 */
@ActiveProfiles("companion-fake")
class TurnEmbeddingListenerIT extends ApiIntegrationTest {

    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;

    @Test
    void testChatTurn_shouldEmbedTurnAsOneUnit_whenTurnCommits() {
        ConversationResponse conversation = postForBody("/api/companion/conversation", null,
                ownerAuthHeaders(), HttpStatus.CREATED, ConversationResponse.class);
        MessageResponse answer = postForBody(
                "/api/companion/conversation/" + conversation.getId() + "/message",
                SendMessageRequest.builder().content("ma leg-day volt").build(),
                ownerAuthHeaders(), HttpStatus.OK, MessageResponse.class);

        await().atMost(5, SECONDS).untilAsserted(() -> {
            var row = memoryEmbeddingRepository
                    .findAll().stream()
                    .filter(e -> MemoryEmbeddingEntity.KIND_CHAT_TURN.equals(e.getKind()))
                    .filter(e -> e.getRefId().equals(answer.getId()))
                    .findFirst();
            assertThat(row).isPresent();
            assertThat(row.get().getContent()).startsWith("Daniel: ma leg-day volt");
        });
    }
}
