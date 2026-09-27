package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * facts-always (mezo-d6ivw.8): the conversation-first path's volatile context must end with
 * the full confirmed-facts block, not the retired top-N slice.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.conversation.enabled=true")
class ConversationFactsIT extends AbstractIntegrationTest {
    @Autowired private ChatService chatService;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private KnowledgeFactPopulator factPopulator;

    private SendMessageRequest request(String text) {
        return SendMessageRequest.builder().content(text).build();
    }

    @Test
    void testConversationTurn_shouldCarryEveryEnabledFact_inVolatileContext() {
        UUID userId = databasePopulator.populateUser("conv-facts@test.local");
        var conversation = conversations.conversation(userId);
        // 11 facts — one more than the retired top-10 — plus one toggled off
        for (int i = 1; i <= 11; i++) {
            factPopulator.fact(userId, "konv-tény-%02d".formatted(i), "train", i);
        }
        factPopulator.fact(userId, "kikapcsolt konv-tény", "fuel", 99, false, KnowledgeFactEntity.SOURCE_MANUAL);

        var answer = chatService.sendMessage(userId, conversation.getId(), request("Szia"));

        assertThat(answer.getContent()).contains("MEGERŐSÍTETT TÉNYEK");
        assertThat(answer.getContent()).contains("konv-tény-01").contains("konv-tény-11");
        assertThat(answer.getContent()).doesNotContain("kikapcsolt konv-tény");
    }
}
