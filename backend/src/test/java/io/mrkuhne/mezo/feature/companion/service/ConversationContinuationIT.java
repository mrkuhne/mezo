package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.conversation.enabled=true")
@Import(ConversationContinuationIT.Configuration.class)
class ConversationContinuationIT extends AbstractIntegrationTest {
    @Autowired private ChatService chat;
    @Autowired private DatabasePopulator users;
    @Autowired private AiConversationPopulator conversations;

    @Test
    void testSendMessage_shouldExecuteFourthDependentRead_whenMoreEvidenceIsNeeded() {
        var user = users.populateUser("continuation@test.local");
        var conversation = conversations.conversation(user);
        var answer = chat.sendMessage(user, conversation.getId(), SendMessageRequest.builder()
                .content("A tegnapi kajám meg a legutóbbi edzésem alapján jó úton vagyok a súlycélom felé? Min változtassak ma?").build());
        assertThat(answer.getTools()).hasSize(4);
        assertThat(answer.getDegraded()).isFalse();
        assertThat(answer.getContent()).doesNotContain("lekérdezési keret elfogyott");
    }

    @TestConfiguration
    static class Configuration {
        @Bean @Primary
        FakeCompanionLlm continuationLlm() {
            return new FakeCompanionLlm() {
                @Override
                public String completeSmart(String system, String context, List<Turn> history, String message) {
                    if (!system.startsWith(TurnPlanner.PROMPT_MARKER)) return super.completeSmart(system, context, history, message);
                    for (String scope : List.of("progress", "recept", "guards", "feasibility")) {
                        if (!context.contains("\"" + scope + "\"") && !context.contains("scope=" + scope)) {
                            return "{\"needsData\":true,\"steps\":[{\"tool\":\"get_goal\",\"args\":{\"scope\":\"" + scope
                                    + "\"},\"why\":\"következő részlet\"}]}";
                        }
                    }
                    return "{\"needsData\":false,\"steps\":[]}";
                }
            };
        }
    }
}
