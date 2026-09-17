package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * The kill switch (spec §8): with {@code pipeline-enabled=false} a scripted plan is never even
 * asked for — {@code sendMessage} must take the SAME legacy tool-loop branch a plan-less turn
 * takes. Separate class (not a {@code @Nested} inside {@link ChatServicePipelineIT}) so the
 * {@code @TestPropertySource} override scopes to exactly this one context.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.turn.pipeline-enabled=false")
class ChatServicePipelineSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private static final String PLAN_SLEEP =
        " [fake-plan:{\"needsData\":true,\"steps\":[{\"tool\":\"get_recovery\",\"args\":{\"scope\":\"sleep\",\"days\":3},\"why\":\"alvás\"}]}]";

    private MessageResponse send(UUID userId, String content) {
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        return chatService.sendMessage(userId, conversation.getId(),
            // gear-audited: forwards its caller's string — the call sites are the audited ones.
            SendMessageRequest.builder().content(content).build());
    }

    @Test
    void testSendMessage_shouldAnswerViaLegacyEcho_whenPipelineIsSwitchedOff() {
        UUID userId = databasePopulator.populateUser("pipe-switch-off@test.local");

        // Even a fully scripted plan must never be asked for — the switch gates the CALL itself,
        // not just what happens with its result.
        MessageResponse answer = send(userId, "Mennyit aludtam kedden?" + PLAN_SLEEP);

        // Legacy echo shape: no answer sentinel, no digest — the old tool-loop path answered.
        assertThat(answer.getContent()).startsWith(FakeCompanionLlm.PREFIX);
        assertThat(answer.getContent()).doesNotContain(FakeCompanionLlm.ANSWER_SENTINEL)
            .doesNotContain("ESZKÖZHÍVÁSOK");
    }
}
