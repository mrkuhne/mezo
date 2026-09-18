package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.advisor.AdvisorRetry;
import io.mrkuhne.mezo.feature.companion.advisor.CompanionAdvisorChain;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Advisors off ⇒ the chain beans do not exist and a scripted violation changes nothing (V1.2 behavior). */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.advisors.enabled=false")
class CompanionAdvisorsSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;
    @Autowired private ChatService chatService;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testChainBean_shouldNotExist_whenAdvisorsDisabled() {
        assertThat(context.getBeanProvider(CompanionAdvisorChain.class).getIfAvailable()).isNull();
    }

    @Test
    void testSendMessage_shouldIgnoreViolationSentinels_whenAdvisorsDisabled() {
        // S9.8 fix round (mezo-rj214.7): re-pointed off FakeCompanionLlm.VIOLATE_ALWAYS, a JUDGE
        // sentinel the chain has not called since Task 3 — with the judge gone, that content was
        // clean either way and this test could not fail for the reason its name claims (advisors
        // ENABLED would also come back degraded=false). "mit ettem ma? Naplóztam ezt." is instead a
        // PERSISTENT action claim caught by the deterministic ActionClaimCheck: with advisors
        // enabled it ships degraded=true (see CompanionAdvisorChainIT's sibling test using this
        // exact content, testSendMessage_shouldShipDegraded_whenRetryStillViolates), so seeing
        // degraded=false here genuinely proves the switch, not a vacuous default.
        UUID userId = databasePopulator.populateUser("advisors-off@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse response = chatService.sendMessage(userId, conversation.getId(),
                SendMessageRequest.builder()
                        .content("mit ettem ma? Naplóztam ezt.")
                        .build());

        assertThat(response.getDegraded()).isFalse();
        assertThat(response.getContent()).doesNotContain(AdvisorRetry.RETRY_MARKER);
    }
}
