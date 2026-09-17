package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.MessageTool;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
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

    private static final String PLAN_SLEEP =
        " [fake-plan:{\"needsData\":true,\"steps\":[{\"tool\":\"get_recovery\",\"args\":{\"scope\":\"sleep\",\"days\":3},\"why\":\"alvás\"}]}]";

    private MessageResponse send(UUID userId, String content) {
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        return chatService.sendMessage(userId, conversation.getId(),
            // gear-audited: forwards its caller's string — the call sites are the audited ones.
            SendMessageRequest.builder().content(content).build());
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

    @Test
    void testSendMessage_shouldFallBackToLegacy_whenPlannerIsUnscripted() {
        UUID userId = databasePopulator.populateUser("pipe-fallback@test.local");

        MessageResponse answer = send(userId, "Mennyit aludtam kedden?");

        // Legacy echo shape: no answer sentinel, no digest — the old tool-loop path answered.
        assertThat(answer.getContent()).startsWith(FakeCompanionLlm.PREFIX);
        assertThat(answer.getContent()).doesNotContain(FakeCompanionLlm.ANSWER_SENTINEL)
            .doesNotContain("ESZKÖZHÍVÁSOK");
    }

    @Test
    void testSendMessage_shouldAnswerWithoutData_whenPlanSaysNoDataNeeded() {
        UUID userId = databasePopulator.populateUser("pipe-nodata@test.local");

        MessageResponse answer = send(userId,
            "Mit gondolsz az edzésről? [fake-plan:{\"needsData\":false,\"steps\":[]}]"); // gear-audited: data-bearing (edzésről)

        assertThat(answer.getContent()).startsWith(FakeCompanionLlm.ANSWER_SENTINEL);
        assertThat(answer.getContent()).contains(ToolOutcomeDigest.NONE);
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
