package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromptAssembler;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/** W2.4: graph switch OFF ⇒ no GraphPromptAssembler bean, and the chat prompt has no [Összefüggések]. */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.knowledge-graph.enabled=false")
class ChatServiceGraphBlockSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;
    @Autowired private ChatService chatService;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testChat_shouldHaveNoConnectionsBlock_whenGraphSwitchedOff() {
        assertThat(context.getBeanNamesForType(GraphPromptAssembler.class)).isEmpty();
        UUID userId = databasePopulator.populateUser("chat-graph-off@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                SendMessageRequest.builder().content("miért rossz az alvás?").build());

        assertThat(answer.getContent()).doesNotContain("[Összefüggések]");
        assertThat(answer.getContent()).contains(
                ChatService.TONE_REMINDER.replace(PromptPersona.NAME_TOKEN, "chat-graph-off@test.local"));
        assertThat(answer.getDegraded()).isFalse();
    }
}
