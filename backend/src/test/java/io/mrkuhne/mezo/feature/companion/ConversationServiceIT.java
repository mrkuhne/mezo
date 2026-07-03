package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.service.ConversationService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Transactional
class ConversationServiceIT extends AbstractIntegrationTest {

    @Autowired private ConversationService conversationService;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private AiMessagePopulator messagePopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testCreate_shouldPersistEmptyConversation_whenCalled() {
        UUID userId = databasePopulator.populateUser("conv-create@test.local");

        ConversationResponse created = conversationService.create(userId);

        assertThat(created.getId()).isNotNull();
        assertThat(created.getTitle()).isNull();
        assertThat(created.getStartedAt()).isNotNull();
        assertThat(created.getLastMessageAt()).isNull();
        assertThat(conversationService.list(userId)).hasSize(1);
    }

    @Test
    void testList_shouldOrderByActivityDesc_whenMultipleConversations() {
        UUID userId = databasePopulator.populateUser("conv-order@test.local");
        AiConversationEntity older = conversationPopulator.conversation(
                userId, "régi", Instant.parse("2026-07-01T10:00:00Z"));
        AiConversationEntity newer = conversationPopulator.conversation(
                userId, "friss", Instant.parse("2026-07-02T10:00:00Z"));

        List<ConversationResponse> list = conversationService.list(userId);

        assertThat(list).extracting(ConversationResponse::getId)
                .containsExactly(newer.getId(), older.getId());
    }

    @Test
    void testList_shouldExcludeOtherUsersConversations_whenTwoUsers() {
        UUID mine = databasePopulator.populateUser("conv-mine@test.local");
        UUID theirs = databasePopulator.populateUser("conv-theirs@test.local");
        conversationPopulator.conversation(theirs);

        assertThat(conversationService.list(mine)).isEmpty();
    }

    @Test
    void testListMessages_shouldReturnChronological_whenMessagesExist() {
        UUID userId = databasePopulator.populateUser("conv-msgs@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "első kérdés");
        messagePopulator.message(conversation, AiMessageEntity.ROLE_ASSISTANT, "első válasz");

        List<MessageResponse> messages = conversationService.listMessages(userId, conversation.getId());

        assertThat(messages).extracting(MessageResponse::getContent)
                .containsExactly("első kérdés", "első válasz");
        assertThat(messages.getFirst().getRole()).isEqualTo("user");
        assertThat(messages.getFirst().getTools()).isEmpty();
        assertThat(messages.getFirst().getRefs()).isEmpty();
    }

    @Test
    void testListMessages_shouldThrow404_whenConversationNotOwned() {
        UUID mine = databasePopulator.populateUser("conv-notmine@test.local");
        UUID theirs = databasePopulator.populateUser("conv-owner@test.local");
        AiConversationEntity foreign = conversationPopulator.conversation(theirs);

        assertThatThrownBy(() -> conversationService.listMessages(mine, foreign.getId()))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
