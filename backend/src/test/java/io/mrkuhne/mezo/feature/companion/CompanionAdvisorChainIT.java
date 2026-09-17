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
 *
 * <p><b>Every fixture here is data-bearing unless it says otherwise</b> (mezo-rj214.7): a
 * {@code CHAT}-gear turn skips the LLM verdict, so a greeting fixture would make these assertions
 * pass while covering nothing at all — the clean-answer and fail-open cases were exactly that
 * until this was fixed. The one deliberate CHAT case is the clinical check, which must run on
 * that branch too. {@code PromptOrderFixtureGearGuardTest} keeps the distinction honest.
 */
@Transactional
@ActiveProfiles("companion-fake")
class CompanionAdvisorChainIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    // gear-audited: forwards whatever its callers pass; every call site below is the audited one.
    private SendMessageRequest request(String content) {
        return SendMessageRequest.builder().content(content).build();
    }

    @Test
    void testSendMessage_shouldKeepAnswerClean_whenNoViolation() {
        UUID userId = databasePopulator.populateUser("advisor-clean@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse response = chatService.sendMessage(userId, conversation.getId(), request("Hogy aludtam az éjjel?"));

        assertThat(response.getDegraded()).isFalse();
        assertThat(response.getContent()).doesNotContain(AdvisorRetry.RETRY_MARKER);
    }

    @Test
    void testSendMessage_shouldRetryAndRecover_whenFirstAnswerViolates() {
        UUID userId = databasePopulator.populateUser("advisor-retry@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse response = chatService.sendMessage(
                userId, conversation.getId(), request("aludtam jól, kérdés " + FakeCompanionLlm.VIOLATE_ONCE));

        // the retry echo carries the corrective block -> proves the second LLM round happened
        assertThat(response.getContent()).contains(AdvisorRetry.RETRY_MARKER);
        assertThat(response.getDegraded()).isFalse();
    }

    @Test
    void testSendMessage_shouldShipDegraded_whenRetryStillViolates() {
        UUID userId = databasePopulator.populateUser("advisor-degraded@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse response = chatService.sendMessage(
                userId, conversation.getId(), request("aludtam jól, kérdés " + FakeCompanionLlm.VIOLATE_ALWAYS));

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
                userId, conversation.getId(), request("aludtam jól, kérdés " + FakeCompanionLlm.VERDICT_BROKEN));

        assertThat(response.getDegraded()).isFalse();
        assertThat(response.getContent()).doesNotContain(AdvisorRetry.RETRY_MARKER);
    }

    @Test
    void testSendMessage_shouldNotRetry_whenSpeculationIsLinguisticallyMarked() {
        UUID userId = databasePopulator.populateUser("advisor-marked@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse response = chatService.sendMessage(userId, conversation.getId(),
                request("aludtam jól, kérdés " + FakeCompanionLlm.MARKED_SPECULATION));

        // A jelölt sejtés a mezo-q71s politika szerint MEGENGEDETT — nem indít korrekciós kört.
        assertThat(response.getContent()).doesNotContain(AdvisorRetry.RETRY_MARKER);
        assertThat(response.getDegraded()).isFalse();
    }

    @Test
    void testSendMessage_shouldShipDegraded_whenAChatTurnSuggestsADoseChange() {
        UUID userId = databasePopulator.populateUser("advisor-chat-clinical@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        // gear-audited: CHAT on purpose — the whole point is that the deterministic clinical check
        // still runs on the tool-free branch (mezo-rj214.7). The fake echoes the message, so the
        // "answer" suggests the dose change; the retry echoes it again and ships degraded.
        MessageResponse response = chatService.sendMessage(
                userId, conversation.getId(), request("Szerinted emeljük a retatrutidot?"));

        assertThat(response.getContent()).contains(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
        assertThat(response.getDegraded()).isTrue();
        assertThat(messageRepository.findById(response.getId()).orElseThrow().isDegraded()).isTrue();
    }
}
