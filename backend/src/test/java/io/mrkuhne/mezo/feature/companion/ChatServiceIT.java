package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** ChatService against the deterministic fake LLM — asserts persistence AND prompt assembly (the fake echoes its inputs). */
@Transactional
@ActiveProfiles("companion-fake")
class ChatServiceIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private AiConversationRepository conversationRepository;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private AiMessagePopulator messagePopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private SendMessageRequest request(String content) {
        return SendMessageRequest.builder().content(content).build();
    }

    @Test
    void testSendMessage_shouldPersistUserAndAssistantRows_whenFirstMessage() {
        UUID userId = databasePopulator.populateUser("chat-first@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("mit egyek ma?"));

        List<AiMessageEntity> rows = messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversation.getId(), userId);
        assertThat(rows).hasSize(2);
        assertThat(rows.getFirst().getRole()).isEqualTo(AiMessageEntity.ROLE_USER);
        assertThat(rows.getFirst().getContent()).isEqualTo("mit egyek ma?");
        assertThat(rows.getLast().getRole()).isEqualTo(AiMessageEntity.ROLE_ASSISTANT);
        assertThat(rows.getLast().getContent()).startsWith(FakeCompanionLlm.PREFIX);
        assertThat(rows.getLast().getToolCalls()).isNull();
        assertThat(rows.getLast().getRefs()).isNull();
        assertThat(answer.getRole()).isEqualTo("assistant");
        assertThat(answer.getTools()).isEmpty();

        AiConversationEntity touched = conversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(touched.getLastMessageAt()).isNotNull();
        assertThat(touched.getTitle()).isEqualTo("mit egyek ma?");
    }

    @Test
    void testSendMessage_shouldIncludeCompanionVoiceAndUserMessageInPrompt_whenCalled() {
        UUID userId = databasePopulator.populateUser("chat-voice@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("szia mezo"));

        // The fake echoes system=[...] user=[...] — the persisted answer proves prompt assembly.
        assertThat(answer.getContent()).contains("Te vagy a mezo");
        assertThat(answer.getContent()).contains("retatrutid");
        assertThat(answer.getContent()).contains("user=[szia mezo]");
        assertThat(answer.getContent()).doesNotContain("Eddigi beszélgetés");
    }

    @Test
    void testSendMessage_shouldWindowHistoryIntoPrompt_whenPriorTurnsExist() {
        UUID userId = databasePopulator.populateUser("chat-window@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "korábbi kérdés");
        messagePopulator.message(conversation, AiMessageEntity.ROLE_ASSISTANT, "korábbi válasz");

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("és most?"));

        assertThat(answer.getContent()).contains("Eddigi beszélgetés");
        assertThat(answer.getContent()).contains("Daniel: korábbi kérdés");
        assertThat(answer.getContent()).contains("Mezo: korábbi válasz");
        // The current message is the user param, not part of the rendered history block.
        assertThat(answer.getContent()).doesNotContain("Daniel: és most?");
        assertThat(answer.getContent()).contains("user=[és most?]");
    }

    @Test
    void testSendMessage_shouldLimitHistoryToWindow_whenMoreMessagesThanWindow() {
        UUID userId = databasePopulator.populateUser("chat-limit@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        // 22 prior messages with window=20: the 2 oldest must fall out.
        for (int i = 1; i <= 22; i++) {
            messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "üzenet-" + i);
        }

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("összegzés?"));

        assertThat(answer.getContent()).doesNotContain("üzenet-1\n");
        assertThat(answer.getContent()).doesNotContain("üzenet-2\n");
        assertThat(answer.getContent()).contains("üzenet-3");
        assertThat(answer.getContent()).contains("üzenet-22");
    }

    @Test
    void testSendMessage_shouldTruncateTitle_whenFirstMessageLong() {
        UUID userId = databasePopulator.populateUser("chat-title@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        String longContent = "x".repeat(200);

        chatService.sendMessage(userId, conversation.getId(), request(longContent));

        AiConversationEntity touched = conversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(touched.getTitle()).hasSize(80);
    }

    @Test
    void testSendMessage_shouldKeepTitle_whenSecondMessage() {
        UUID userId = databasePopulator.populateUser("chat-title2@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        chatService.sendMessage(userId, conversation.getId(), request("első téma"));

        chatService.sendMessage(userId, conversation.getId(), request("második üzenet"));

        AiConversationEntity touched = conversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(touched.getTitle()).isEqualTo("első téma");
    }

    @Test
    void testSendMessage_shouldThrow404_whenConversationNotOwned() {
        UUID mine = databasePopulator.populateUser("chat-notmine@test.local");
        UUID theirs = databasePopulator.populateUser("chat-owner@test.local");
        AiConversationEntity foreign = conversationPopulator.conversation(theirs);

        assertThatThrownBy(() -> chatService.sendMessage(mine, foreign.getId(), request("hahó")))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
