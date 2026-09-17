package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * The kill switch (spec §8), streamed twin of {@link ChatServicePipelineSwitchOffIT} (Task 6 fix
 * round 1 finding M4): with {@code pipeline-enabled=false} a scripted plan is never even asked
 * for on the STREAMED path either — {@code streamMessage} must take the SAME legacy stream branch
 * a plan-less turn takes. Separate class (not a {@code @Nested} inside {@link
 * ChatStreamPipelineIT}) so the {@code @TestPropertySource} override scopes to exactly this one
 * context.
 *
 * <p>Deliberately NOT {@code @Transactional} — the same reason {@link ChatStreamPipelineIT} and
 * {@link ChatStreamServiceIT} skip it: {@code prepareTurn}/{@code completeTurn} run in their own
 * transactions through the proxy. Cleanup is the per-test {@code ResetDatabase}.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.turn.pipeline-enabled=false")
class ChatStreamPipelineSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ChatStreamService chatStreamService;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private static final String PLAN_SLEEP =
        " [fake-plan:{\"needsData\":true,\"steps\":[{\"tool\":\"get_recovery\",\"args\":{\"scope\":\"sleep\",\"days\":3},\"why\":\"alvás\"}]}]";

    @Test
    void testStreamMessage_shouldAnswerViaLegacyEcho_whenPipelineIsSwitchedOff() {
        UUID userId = databasePopulator.populateUser("stream-pipe-switch-off@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        // Even a fully scripted plan must never be asked for — the switch gates the CALL itself,
        // not just what happens with its result. gear=LOOKUP ("Mennyit"/"aludtam"/"kedden").
        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(),
                        // gear-audited: forwards its caller's string — the call sites are the audited ones.
                        SendMessageRequest.builder().content("Mennyit aludtam kedden?" + PLAN_SLEEP).build())
                .collectList().block();

        MessageResponse done = (MessageResponse) events.getLast().data();
        // Legacy echo shape: no answer sentinel, no digest — the old tool-loop path answered.
        assertThat(done.getContent()).startsWith(FakeCompanionLlm.PREFIX);
        assertThat(done.getContent()).doesNotContain(FakeCompanionLlm.ANSWER_SENTINEL)
            .doesNotContain("ESZKÖZHÍVÁSOK");
    }
}
