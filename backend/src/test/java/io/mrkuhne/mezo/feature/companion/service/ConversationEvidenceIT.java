package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.companion.conversation.enabled=true",
        "mezo.companion.turn.answerer.outcome-max-chars-per-result=2000",
        "mezo.companion.turn.answerer.outcome-max-chars-total=2000"
})
class ConversationEvidenceIT extends AbstractIntegrationTest {
    @Autowired private ChatService chatService;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private AiMessagePopulator messages;
    @Autowired private DatabasePopulator users;
    @Autowired private io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator facts;

    @Test
    void testSendMessage_shouldKeepNewEvidence_whenEarlierReadFillsContextBudget() {
        UUID user = users.populateUser("free-late-evidence@test.local");
        var conversation = conversations.conversation(user);
        for (int i = 0; i < 12; i++) {
            messages.message(conversation, "user", "Régi háttér " + i + "x".repeat(2000));
        }
        facts.fact(user, "A regény munkacíme: Holdkert.", "life", 1);
        String first = " [fake-plan:{\"needsData\":true,\"steps\":["
                + "{\"tool\":\"get_conversation_history\",\"args\":{\"page\":0},\"why\":\"háttér\"},"
                + "{\"tool\":\"get_conversation_history\",\"args\":{\"page\":1},\"why\":\"régebbi\"}]}]";
        String next = " [fake-next-plan:{\"needsData\":true,\"steps\":["
                + "{\"tool\":\"get_personal_context\",\"args\":{\"scope\":\"facts\"},\"why\":\"cím\"}]}]";
        var answer = chatService.sendMessage(user, conversation.getId(), SendMessageRequest.builder().content("És a cím?" + first + next).build());
        assertThat(answer.getTools()).hasSize(3);
        assertThat(answer.getContent()).contains("Holdkert");
    }

}
