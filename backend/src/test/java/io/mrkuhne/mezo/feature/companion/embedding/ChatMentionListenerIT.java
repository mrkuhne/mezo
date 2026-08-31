package io.mrkuhne.mezo.feature.companion.embedding;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.CreatePersonRequest;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.PersonResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * S2 chat-source mention pipeline (bd mezo-06o0.1): a committed chat turn's USER content is
 * matched against known people (the assistant's own words are never a user mention). The
 * {@code TurnEmbeddingListenerIT} idiom, in the people direction.
 */
@ActiveProfiles("companion-fake")
class ChatMentionListenerIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MentionRepository mentionRepository;
    @Autowired private AiMessageRepository aiMessageRepository;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private void createPerson(String name) {
        CreatePersonRequest req = new CreatePersonRequest();
        req.setName(name);
        req.setRelationship(CreatePersonRequest.RelationshipEnum.FRIEND);
        req.setRelationshipHu("Barát");
        postForBody("/api/people", req, ownerAuthHeaders(), HttpStatus.CREATED, PersonResponse.class);
    }

    @Test
    void testChatTurn_shouldWriteMentionFromUserContent_whenTurnCommits() {
        UUID owner = ownerId();
        createPerson("Ádám");

        ConversationResponse conversation = postForBody("/api/companion/conversation", null,
                ownerAuthHeaders(), HttpStatus.CREATED, ConversationResponse.class);
        MessageResponse answer = postForBody(
                "/api/companion/conversation/" + conversation.getId() + "/message",
                SendMessageRequest.builder().content("Ádám ma sokat segített").build(),
                ownerAuthHeaders(), HttpStatus.OK, MessageResponse.class);

        AiMessageEntity userMessage = aiMessageRepository
                .findFirstByConversationIdAndRoleAndDeletedFalseAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
                        conversation.getId(), AiMessageEntity.ROLE_USER, answer.getCreatedAt().toInstant())
                .orElseThrow();

        await().atMost(5, SECONDS).untilAsserted(() -> {
            List<MentionEntity> mentions =
                    mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner);
            assertThat(mentions).hasSize(1);
            MentionEntity m = mentions.getFirst();
            assertThat(m.getSource()).isEqualTo("chat");
            assertThat(m.getSourceRefKind()).isEqualTo("chat_turn");
            assertThat(m.getSourceRefId()).isEqualTo(userMessage.getId());
        });
    }
}
