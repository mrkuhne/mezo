package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/** S8: the model may call "megjegyeztem" only what this block lists — and the block is capped. */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.conversation.enabled=true")
class ChatMemoryBlocksIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private ChatMemoryBlocks blocks;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private AiMessagePopulator messages;
    @Autowired private LearnedFactPopulator candidates;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testConversationBlock_shouldListWhatThisConversationLearned_capped() {
        UUID userId = databasePopulator.populateUser("s8-ebben@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);
        AiMessageEntity turn = messages.message(conversation, AiMessageEntity.ROLE_USER, "sok minden");
        for (int i = 1; i <= 10; i++) {
            candidates.candidate(userId, "javaslat-%02d".formatted(i), "life", turn.getId());
        }

        String block = blocks.conversationBlock(userId, conversation.getId());

        assertThat(block).startsWith("\n\n[Ebben a beszélgetésben]");
        assertThat(block.lines().filter(l -> l.startsWith("- ")).count()).isEqualTo(8);
        assertThat(block).contains("javaslat, még nem döntött róla: javaslat-");
    }

    @Test
    void testSendMessage_shouldOmitTheBlock_whenNothingWasLearned() {
        UUID userId = databasePopulator.populateUser("s8-ebben-empty@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                SendMessageRequest.builder().content("Szia").build());

        // The stable voice text mentions the block by name as an instruction (see ConversationTurnService.VOICE);
        // the actual injected block is anchored by its own "\n\n" prefix (ChatMemoryBlocks.conversationBlock) —
        // that anchor is what must be absent when nothing was learned.
        assertThat(answer.getContent()).doesNotContain("\n\n[Ebben a beszélgetésben]");
    }
}
