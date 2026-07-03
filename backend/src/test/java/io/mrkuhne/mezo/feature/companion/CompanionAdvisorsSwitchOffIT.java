package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.advisor.AdvisorRetry;
import io.mrkuhne.mezo.feature.companion.advisor.CompanionAdvisorChain;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
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
        UUID userId = databasePopulator.populateUser("advisors-off@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse response = chatService.sendMessage(userId, conversation.getId(),
                SendMessageRequest.builder()
                        .content("kérdés " + FakeCompanionLlm.VIOLATE_ALWAYS)
                        .build());

        assertThat(response.getDegraded()).isFalse();
        assertThat(response.getContent()).doesNotContain(AdvisorRetry.RETRY_MARKER);
    }
}
