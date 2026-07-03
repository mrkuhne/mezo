package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.advisor.AdvisorRetry;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The V1.3 advisor chain through ChatService.sendMessage — retry-once, degraded-on-2nd-failure,
 * fail-open, and the persisted flag. The fake's verdict scripting is stateless: [fake-violate]
 * violates only until the retry header shows up in the checked answer (the echo carries it).
 */
@Transactional
@ActiveProfiles("companion-fake")
class CompanionAdvisorChainIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private SendMessageRequest request(String content) {
        return SendMessageRequest.builder().content(content).build();
    }

    @Test
    void testSendMessage_shouldKeepAnswerClean_whenNoViolation() {
        UUID userId = databasePopulator.populateUser("advisor-clean@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse response = chatService.sendMessage(userId, conversation.getId(), request("szia mezo"));

        assertThat(response.getDegraded()).isFalse();
        assertThat(response.getContent()).doesNotContain(AdvisorRetry.RETRY_MARKER);
    }

    @Test
    void testSendMessage_shouldRetryAndRecover_whenFirstAnswerViolates() {
        UUID userId = databasePopulator.populateUser("advisor-retry@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse response = chatService.sendMessage(
                userId, conversation.getId(), request("kérdés " + FakeCompanionLlm.VIOLATE_ONCE));

        // the retry echo carries the corrective block -> proves the second LLM round happened
        assertThat(response.getContent()).contains(AdvisorRetry.RETRY_MARKER);
        assertThat(response.getDegraded()).isFalse();
    }

    @Test
    void testSendMessage_shouldShipDegraded_whenRetryStillViolates() {
        UUID userId = databasePopulator.populateUser("advisor-degraded@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse response = chatService.sendMessage(
                userId, conversation.getId(), request("kérdés " + FakeCompanionLlm.VIOLATE_ALWAYS));

        assertThat(response.getDegraded()).isTrue();
        AiMessageEntity row = messageRepository.findById(response.getId()).orElseThrow();
        assertThat(row.isDegraded()).isTrue();
    }

    @Test
    void testSendMessage_shouldShipDegraded_whenClinicalPhrasePersists() {
        UUID userId = databasePopulator.populateUser("advisor-clinical@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        // the echo copies the phrase into every "answer": attempt-1 and the retry both violate
        MessageResponse response = chatService.sendMessage(
                userId, conversation.getId(), request("Emeljük a retatrutid adagot 4 mg-ra?"));

        assertThat(response.getDegraded()).isTrue();
    }

    @Test
    void testSendMessage_shouldFailOpen_whenVerdictIsBroken() {
        UUID userId = databasePopulator.populateUser("advisor-broken@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse response = chatService.sendMessage(
                userId, conversation.getId(), request("kérdés " + FakeCompanionLlm.VERDICT_BROKEN));

        assertThat(response.getDegraded()).isFalse();
        assertThat(response.getContent()).doesNotContain(AdvisorRetry.RETRY_MARKER);
    }
}
