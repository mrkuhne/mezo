package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.companion.conversation.enabled=true",
        "mezo.companion.conversation.max-read-rounds=1",
        "mezo.companion.conversation.result-max-chars=500",
        "mezo.companion.conversation.results-max-chars=2000"
})
class ConversationLimitsIT extends AbstractIntegrationTest {
    @Autowired private ChatService chat;
    @Autowired private ConversationHistory history;
    @Autowired private CompanionToolRegistry tools;
    @Autowired private DatabasePopulator users;
    @Autowired private AiConversationPopulator conversations;

    @Test
    void testSendMessage_shouldStopAndDiscloseLimit_whenFurtherDataIsRequested() {
        var user = users.populateUser("free-limits@test.local");
        var conversation = conversations.conversation(user);
        String message = "És ez? [fake-plan:{\"needsData\":true,\"steps\":[{\"tool\":\"get_recovery\","
                + "\"args\":{\"scope\":\"sleep\"},\"why\":\"első\"}]}] "
                + "[fake-next-plan:{\"needsData\":true,\"steps\":[{\"tool\":\"get_personal_context\","
                + "\"args\":{\"scope\":\"facts\"},\"why\":\"második\"}]}]";
        var answer = chat.sendMessage(user, conversation.getId(), SendMessageRequest.builder().content(message).build());
        assertThat(answer.getTools()).hasSize(1);
        assertThat(answer.getContent()).contains("lekérdezési keret elfogyott");
        assertThat(answer.getDegraded()).isTrue();
    }

    @Test
    void testEnvelope_shouldBoundEvidenceAndMarkTruncation_whenToolResultIsLarge() {
        var audit = tools.newTurnAudit();
        int index = audit.recordCall("get_recovery", "scope=sleep");
        audit.recordResult(index, "x".repeat(10000));
        var result = history.envelope(audit).calls().getFirst().result();
        assertThat(result).hasSizeLessThanOrEqualTo(500).endsWith(ConversationHistory.CLIPPED);
    }

    @Test
    void testPrepare_shouldAvoidDuplicateReads_whenPlannerRepeatsSameArguments() {
        var user = users.populateUser("free-duplicate@test.local");
        var conversation = conversations.conversation(user);
        String step = "{\"tool\":\"get_recovery\",\"args\":{\"scope\":\"sleep\"},\"why\":\"ugyanaz\"}";
        String message = "Mi a helyzet? [fake-plan:{\"needsData\":true,\"steps\":[" + step + "," + step + "]}]";
        var answer = chat.sendMessage(user, conversation.getId(), SendMessageRequest.builder().content(message).build());
        assertThat(answer.getTools()).hasSize(1);
    }
}
