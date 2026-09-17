package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.MessageTool;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * The LIVE pipeline on the sync path. Deliberately NOT @Transactional: PlanExecutor's pool
 * threads read with their own connections (TurnPipelineIT precedent); cleanup is ResetDatabase.
 */
@ActiveProfiles("companion-fake")
class ChatServicePipelineIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private AiMessageRepository messageRepository;

    private static final String PLAN_SLEEP =
        " [fake-plan:{\"needsData\":true,\"steps\":[{\"tool\":\"get_recovery\",\"args\":{\"scope\":\"sleep\",\"days\":3},\"why\":\"alvás\"}]}]";

    private MessageResponse send(UUID userId, String content) {
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        return chatService.sendMessage(userId, conversation.getId(),
            // gear-audited: forwards its caller's string — the call sites are the audited ones.
            SendMessageRequest.builder().content(content).build());
    }

    /** Task 4 (mezo-rj214.7 S9.7): send() alone discards the conversation id these provenance
     *  assertions need to re-query the persisted row — {@code send} stays as-is for the tests
     *  that only look at the wire response. */
    private record Sent(MessageResponse response, UUID conversationId) {}

    private Sent sendTracked(UUID userId, String content) {
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        MessageResponse response = chatService.sendMessage(userId, conversation.getId(),
            // gear-audited: forwards its caller's string — the call sites are the audited ones.
            SendMessageRequest.builder().content(content).build());
        return new Sent(response, conversation.getId());
    }

    private AiMessageEntity lastAssistantRow(UUID conversationId, UUID userId) {
        return messageRepository
            .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversationId, userId)
            .getLast();
    }

    @Test
    void testSendMessage_shouldAnswerFromExecutedPlan_whenPlanIsScripted() {
        UUID userId = databasePopulator.populateUser("pipe-sync@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("7.5"), 2);

        MessageResponse answer = send(userId, "Hogy aludtam mostanában?" + PLAN_SLEEP);

        // The answerer echo proves: tool-free smart call whose volatile half carried the digest
        // with the REAL rendered sleep line.
        assertThat(answer.getContent()).startsWith(FakeCompanionLlm.ANSWER_SENTINEL);
        assertThat(answer.getContent()).contains(ToolOutcomeDigest.HEADER).contains("7,5");
        // The audit choke point still fills the envelopes.
        assertThat(answer.getTools()).extracting(MessageTool::getName)
            .containsExactly("get_recovery(scope=sleep, days=3)");
    }

    /** Task 4 (mezo-rj214.7 S9.7 step 1a): the persisted row — not just the wire echo — carries
     *  BOTH provenance halves off the plan-truth outcome list: the ask (with {@code why}) and the
     *  result (the Hungarian outcome text {@link TurnProvenance} rendered). */
    @Test
    void testSendMessage_shouldPersistPipelineProvenance_whenPlanIsScripted() {
        UUID userId = databasePopulator.populateUser("pipe-provenance@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("7.5"), 2);

        Sent sent = sendTracked(userId, "Hogy aludtam mostanában?" + PLAN_SLEEP);

        AiMessageEntity assistant = lastAssistantRow(sent.conversationId(), userId);
        assertThat(assistant.getToolCalls().calls()).hasSize(1);
        assertThat(assistant.getToolCalls().calls().getFirst().name()).isEqualTo("get_recovery");
        assertThat(assistant.getToolCalls().calls().getFirst().why()).isEqualTo("alvás");
        assertThat(assistant.getToolOutcomes().outcomes()).hasSize(1);
        assertThat(assistant.getToolOutcomes().outcomes().getFirst().name()).isEqualTo("get_recovery");
        assertThat(assistant.getToolOutcomes().outcomes().getFirst().text()).contains("7,5");
        assertThat(assistant.getToolOutcomes().outcomes().getFirst().failed()).isFalse();
    }

    @Test
    void testSendMessage_shouldFallBackToLegacy_whenPlannerIsUnscripted() {
        UUID userId = databasePopulator.populateUser("pipe-fallback@test.local");

        Sent sent = sendTracked(userId, "Mennyit aludtam kedden?");
        MessageResponse answer = sent.response();

        // Legacy echo shape: no answer sentinel, no digest — the old tool-loop path answered.
        assertThat(answer.getContent()).startsWith(FakeCompanionLlm.PREFIX);
        assertThat(answer.getContent()).doesNotContain(FakeCompanionLlm.ANSWER_SENTINEL)
            .doesNotContain("ESZKÖZHÍVÁSOK");
        // Non-negotiable (task 4 brief): a fallback turn persists LEGACY provenance end-to-end —
        // never a half-built plan. No tool sentinel fired here, so ran-truth is empty too.
        AiMessageEntity assistant = lastAssistantRow(sent.conversationId(), userId);
        assertThat(assistant.getToolCalls()).isNull();
        assertThat(assistant.getToolOutcomes()).isNull();
    }

    @Test
    void testSendMessage_shouldAnswerWithoutData_whenPlanSaysNoDataNeeded() {
        UUID userId = databasePopulator.populateUser("pipe-nodata@test.local");

        MessageResponse answer = send(userId,
            "Mit gondolsz az edzésről? [fake-plan:{\"needsData\":false,\"steps\":[]}]"); // gear-audited: data-bearing (edzésről)

        assertThat(answer.getContent()).startsWith(FakeCompanionLlm.ANSWER_SENTINEL);
        assertThat(answer.getContent()).contains(ToolOutcomeDigest.NONE);
    }

    /** Task 4 (mezo-rj214.7 S9.7 step 1c): an empty-but-usable plan produces an empty outcome
     *  list — {@link TurnProvenance#build} must collapse that to null/null, not empty envelopes
     *  (mirrors {@link ToolCallAudit}'s existing null-when-empty contract). */
    @Test
    void testSendMessage_shouldPersistNullProvenance_whenPlanNeedsNoData() {
        UUID userId = databasePopulator.populateUser("pipe-nodata-provenance@test.local");

        Sent sent = sendTracked(userId,
            "Mit gondolsz az edzésről? [fake-plan:{\"needsData\":false,\"steps\":[]}]");

        AiMessageEntity assistant = lastAssistantRow(sent.conversationId(), userId);
        assertThat(assistant.getToolCalls()).isNull();
        assertThat(assistant.getToolOutcomes()).isNull();
    }

    @Test
    void testSendMessage_shouldRunOneReplanLap_whenAnswererSignalsDataGap() {
        UUID userId = databasePopulator.populateUser("pipe-replan@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("6.0"), 4);

        // ANALYSIS-shaped question; lap 1 scripts a data gap; the replanned planner call gets the
        // SAME scripted plan (the sentinel stays in the user message), lap 2 answers.
        MessageResponse answer = send(userId,
            "Miért alszom rosszul mostanában? [fake-datagap:alvásnapló]" + PLAN_SLEEP);

        assertThat(answer.getContent()).startsWith(FakeCompanionLlm.ANSWER_SENTINEL);
        assertThat(answer.getContent()).contains("[PÓTLÁS]");
        assertThat(answer.getContent()).doesNotContain(TurnAnswerer.DATA_GAP_MARKER);
        // Two executed steps: lap 1 + the replan lap re-executed the scripted plan.
        assertThat(answer.getTools()).hasSize(2);
        // fix round 1 finding 5: the answer echo's digest carries the merged lap1+lap2 outcomes,
        // not just the last lap's — TWO "- get_recovery" lines, one per executed call.
        assertThat(answer.getContent()).containsSubsequence("- get_recovery", "- get_recovery");
    }

    /** Task 4 (mezo-rj214.7 S9.7 step 1b): the persisted row carries the FINAL merged outcome
     *  list — lap 1 AND the replan lap, in that order — not just lap 1's (the bug the plan
     *  called out: {@code pipelineAnswer}'s replan lap builds {@code merged} but it used to die
     *  inside the method, never reaching persistence). */
    @Test
    void testSendMessage_shouldPersistMergedLapOutcomes_whenReplanRuns() {
        UUID userId = databasePopulator.populateUser("pipe-replan-provenance@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("6.0"), 4);

        Sent sent = sendTracked(userId,
            "Miért alszom rosszul mostanában? [fake-datagap:alvásnapló]" + PLAN_SLEEP);

        AiMessageEntity assistant = lastAssistantRow(sent.conversationId(), userId);
        assertThat(assistant.getToolCalls().calls()).hasSize(2);
        assertThat(assistant.getToolCalls().calls()).allSatisfy(
            call -> assertThat(call.name()).isEqualTo("get_recovery"));
        assertThat(assistant.getToolOutcomes().outcomes()).hasSize(2);
        assertThat(assistant.getToolOutcomes().outcomes()).allSatisfy(
            outcome -> assertThat(outcome.name()).isEqualTo("get_recovery"));
    }

    @Test
    void testSendMessage_shouldNeverReplan_whenLookupGear() {
        UUID userId = databasePopulator.populateUser("pipe-lookup@test.local");

        // LOOKUP-shaped ("mennyit"): the offer block is absent, so even a scripted datagap
        // sentinel cannot fire (the fake only emits the marker when the offer could exist —
        // but the wiring must ALSO ignore a marker on LOOKUP defensively).
        MessageResponse answer = send(userId, "Mennyit aludtam kedden? [fake-datagap:x]" + PLAN_SLEEP);

        assertThat(answer.getContent()).startsWith(FakeCompanionLlm.ANSWER_SENTINEL);
        assertThat(answer.getContent()).doesNotContain("[PÓTLÁS]");
    }
}
