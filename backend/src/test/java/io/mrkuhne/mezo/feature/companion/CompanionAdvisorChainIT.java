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
 * The advisor chain through ChatService.sendMessage — retry-once and degraded-on-2nd-failure,
 * against the two checks still on the live path since S9.8 (mezo-rj214.7, mezo-rj214.5):
 * deterministic clinical + action-claim. The fake's action-claim scripting is stateless too:
 * {@link FakeCompanionLlm#ACTION_CLAIM_ONCE} fabricates a claim only until the retry header
 * shows up in the prompt half the corrective round actually rewrites.
 *
 * <p><b>Every fixture here is data-bearing unless it says otherwise</b> (mezo-rj214.7): a
 * greeting fixture would make these assertions pass while covering nothing at all — the
 * clean-answer case was exactly that until this was fixed. The one deliberate CHAT case is the
 * clinical check, which must run on that branch too. {@code PromptOrderFixtureGearGuardTest}
 * keeps the distinction honest. The retired LLM verdict's OWN behaviour (fail-open, the
 * linguistically-marked-speculation policy) is covered separately by {@code TurnVerdictCheckIT} —
 * see the comment above {@code testSendMessage_shouldShipDegraded_whenAChatTurnSuggestsADoseChange}
 * below for what moved and why.
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
        // S9.8 (mezo-rj214.7, mezo-rj214.5): re-pointed from the retired LLM verdict's
        // FakeCompanionLlm.VIOLATE_ONCE onto the deterministic action-claim backstop — this test
        // pins the RETRY MACHINERY (violation -> corrective re-prompt -> clean), not the judge's
        // own behaviour, so the retry-machinery premise survives the judge's removal intact.
        UUID userId = databasePopulator.populateUser("advisor-retry@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse response = chatService.sendMessage(userId, conversation.getId(),
                request("mit ettem ma? " + FakeCompanionLlm.ACTION_CLAIM_ONCE));

        // the fake answers round 1 with a fabricated claim UNCONDITIONALLY and only rewrites it to
        // this exact clean sentence once its own corrective retryContext carries the retry header
        // — so the clean text landing here is only possible if the second LLM round actually ran.
        assertThat(response.getContent()).isEqualTo("Ezt te tudod felírni, ha szeretnéd.");
        assertThat(response.getDegraded()).isFalse();
    }

    @Test
    void testSendMessage_shouldShipDegraded_whenRetryStillViolates() {
        // S9.8: re-pointed from FakeCompanionLlm.VIOLATE_ALWAYS onto a persistent action claim —
        // the fabricated "naplóztam" is baked into the content itself, so it survives the retry's
        // corrective round unchanged (unlike ACTION_CLAIM_ONCE above) and ships degraded.
        UUID userId = databasePopulator.populateUser("advisor-degraded@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse response = chatService.sendMessage(
                userId, conversation.getId(), request("mit ettem ma? Naplóztam ezt."));

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

    // S9.8 (mezo-rj214.7, mezo-rj214.5): testSendMessage_shouldFailOpen_whenVerdictIsBroken and
    // testSendMessage_shouldNotRetry_whenSpeculationIsLinguisticallyMarked used to live here,
    // scripted via FakeCompanionLlm.VERDICT_BROKEN / MARKED_SPECULATION. Both pinned the LLM
    // JUDGE's OWN behaviour (fail-open on broken JSON; a linguistically-hedged claim stays clean),
    // not the chain's retry machinery — and the chain no longer calls that judge at all, so their
    // premise ("the CHAIN fails open / does not retry a marked hunch") genuinely no longer exists
    // at this level. The judge behaviour itself is still covered, unchanged, by
    // TurnVerdictCheckIT.testCheck_shouldFailOpen_whenVerdictIsNotJson and the new
    // testCheck_shouldReturnNoViolations_whenSpeculationIsLinguisticallyMarked.

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
