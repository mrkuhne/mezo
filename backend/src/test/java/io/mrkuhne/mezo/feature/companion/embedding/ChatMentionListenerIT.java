package io.mrkuhne.mezo.feature.companion.embedding;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static java.util.concurrent.TimeUnit.MILLISECONDS;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.CreatePersonRequest;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.PersonResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatMentionListener;
import io.mrkuhne.mezo.feature.companion.service.ChatTurnCompleted;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
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
    @Autowired private ChatMentionListener chatMentionListener;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private AiMessagePopulator messages;

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

    /** mezo-tdabt: "ezt ne jegyezd meg" soft-deletes the preceding message's mention, and the forget
     *  request's own words — even naming a person — never become a mention. */
    @Test
    void testForgetRequest_shouldSoftDeleteThePrecedingMention_andWriteNoneForItself() {
        UUID owner = ownerId();
        createPerson("Ádám");
        ConversationResponse conversation = postForBody("/api/companion/conversation", null,
                ownerAuthHeaders(), HttpStatus.CREATED, ConversationResponse.class);
        String uri = "/api/companion/conversation/" + conversation.getId() + "/message";
        postForBody(uri, SendMessageRequest.builder().content("Ádám ma sokat segített").build(),
                ownerAuthHeaders(), HttpStatus.OK, MessageResponse.class);
        await().atMost(5, SECONDS).untilAsserted(() ->
                assertThat(mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner)).hasSize(1));

        postForBody(uri, SendMessageRequest.builder().content("Ádámról ezt ne jegyezd meg").build(),
                ownerAuthHeaders(), HttpStatus.OK, MessageResponse.class);

        await().during(1500, MILLISECONDS).atMost(5, SECONDS).untilAsserted(() ->
                assertThat(mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner)).isEmpty());
    }

    /** mezo-tdabt: the listener re-checks the row under the FOR SHARE gate — a forget that
     *  committed after the event was published still wins (the event flag is stale-false here). */
    @Test
    void testListener_shouldWriteNoMention_whenTheUserRowWasBlockedAfterTheEvent() {
        UUID owner = ownerId();
        createPerson("Ádám");
        var conversation = conversations.conversation(owner);
        AiMessageEntity blocked = messages.message(conversation, AiMessageEntity.ROLE_USER, "Ádám titka");
        blocked.setExtractionBlocked(true);
        aiMessageRepository.saveAndFlush(blocked);
        AiMessageEntity control = messages.message(conversation, AiMessageEntity.ROLE_USER, "Ádám itt volt");

        chatMentionListener.onChatTurnCompleted(
                new ChatTurnCompleted(owner, blocked.getId(), "Ádám titka", UUID.randomUUID(), "ok", false));
        chatMentionListener.onChatTurnCompleted(
                new ChatTurnCompleted(owner, control.getId(), "Ádám itt volt", UUID.randomUUID(), "ok", false));

        await().atMost(5, SECONDS).untilAsserted(() ->
                assertThat(mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner))
                        .extracting(MentionEntity::getSourceRefId).contains(control.getId()));
        await().during(1000, MILLISECONDS).atMost(3, SECONDS).untilAsserted(() ->
                assertThat(mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner))
                        .extracting(MentionEntity::getSourceRefId).containsExactly(control.getId()));
    }

    /** mezo-tdabt: a turn published as blocked is skipped outright. */
    @Test
    void testListener_shouldWriteNoMention_whenTheEventIsBlocked() {
        UUID owner = ownerId();
        createPerson("Ádám");
        var conversation = conversations.conversation(owner);
        AiMessageEntity row = messages.message(conversation, AiMessageEntity.ROLE_USER, "Ádám titka");

        chatMentionListener.onChatTurnCompleted(
                new ChatTurnCompleted(owner, row.getId(), "Ádám titka", UUID.randomUUID(), "ok", true));

        await().during(1000, MILLISECONDS).atMost(3, SECONDS).untilAsserted(() ->
                assertThat(mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(owner)).isEmpty());
    }
}
