package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.api.dto.StreamDelta;
import io.mrkuhne.mezo.api.dto.StreamPhase;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * The LIVE pipeline on the STREAMED path (mezo-rj214.7 Task 6): {@link ChatStreamService}'s
 * pre-stream plan+execute lap for LOOKUP, the full sync {@link ChatService#pipelineAnswer} for
 * ANALYSIS, and the unchanged legacy stream for whatever the planner cannot handle.
 *
 * <p>Deliberately NOT {@code @Transactional} — the same reason {@link ChatStreamServiceIT} and
 * {@link ChatServicePipelineIT} skip it: {@code prepareTurn}/{@code completeTurn} run in their
 * own transactions through the proxy, and {@link PlanExecutor} fans steps out onto pool threads
 * that open their own DB connections. Cleanup is the per-test {@code ResetDatabase}.
 *
 * <p>Copies {@link ChatStreamServiceIT}'s {@code serving-mode=OLD} trait: prepareTurn is the same
 * streamed assembly site that memory-platform fixture depends on.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.memory-platform.serving-mode=OLD")
class ChatStreamPipelineIT extends AbstractIntegrationTest {

    @Autowired private ChatStreamService chatStreamService;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;

    /** Mirrors {@code ChatServicePipelineIT}'s fixture: needsData scripts one get_recovery step. */
    private static final String PLAN_SLEEP =
        " [fake-plan:{\"needsData\":true,\"steps\":[{\"tool\":\"get_recovery\",\"args\":{\"scope\":\"sleep\",\"days\":3},\"why\":\"alvás\"}]}]";

    private SendMessageRequest request(String content) {
        // gear-audited: forwards its caller's string — the call sites are the audited ones.
        return SendMessageRequest.builder().content(content).build();
    }

    @Test
    void testStreamMessage_shouldEmitToolEventsBeforeDeltas_whenPipelineExecutesPreStream() {
        UUID userId = databasePopulator.populateUser("stream-pipe-lookup@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("7.5"), 2);
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        // "Mennyit" (LOOKUP_WORDS) + "aludtam"/"mostanában" (DOMAIN/TIME words) -> gear=LOOKUP:
        // the pre-stream branch plans+executes BEFORE the Flux assembles (TurnGearAnalyzerTest
        // pins the classification; this IT pins the streamed-pipeline wiring on top of it).
        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(), request("Mennyit aludtam mostanában?" + PLAN_SLEEP))
                .collectList().block();

        int toolIdx = IntStream.range(0, events.size())
                .filter(i -> "tool".equals(events.get(i).event())).findFirst().orElseThrow();
        int deltaIdx = IntStream.range(0, events.size())
                .filter(i -> "delta".equals(events.get(i).event())).findFirst().orElseThrow();
        // The premise of the pre-stream execution (mezo-280's twin for the pipeline): the tool
        // chip is buffered in the sink WHILE the plan+execute lap still runs, well before the
        // answerer's own Flux is even subscribed to — not merely ahead of the terminal 'done'.
        assertThat(toolIdx).isLessThan(deltaIdx);

        ServerSentEvent<Object> done = events.getLast();
        assertThat(done.event()).isEqualTo("done");
        assertThat(((MessageResponse) done.data()).getContent()).startsWith(FakeCompanionLlm.ANSWER_SENTINEL);
    }

    @Test
    void testStreamMessage_shouldResolveReplanServerSide_whenAnalysisSignalsGap() {
        UUID userId = databasePopulator.populateUser("stream-pipe-replan@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("6.0"), 4);
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        // "Miért" (ANALYSIS_WORDS) -> gear=ANALYSIS: the pre-stream branch runs the FULL sync
        // pipelineAnswer (replan lap included) BEFORE the Flux assembles, so the data-gap marker
        // never reaches the client as a delta — the server resolves it, not a client round-trip.
        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(),
                        request("Miért alszom rosszul mostanában? [fake-datagap:alvásnapló]" + PLAN_SLEEP))
                .collectList().block();

        assertThat(events).filteredOn(e -> "delta".equals(e.event()))
                .extracting(e -> ((StreamDelta) e.data()).getText())
                .noneMatch(text -> text.contains(TurnAnswerer.DATA_GAP_MARKER));

        MessageResponse done = (MessageResponse) events.getLast().data();
        assertThat(done.getContent()).contains("[PÓTLÁS]");
    }

    @Test
    void testStreamMessage_shouldFallBackToLegacyStream_whenPlannerIsUnscripted() {
        UUID userId = databasePopulator.populateUser("stream-pipe-fallback@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        // gear=LOOKUP ("Mennyit"/"aludtam"/"kedden"), but no [fake-plan] sentinel: the planner
        // answers PLANNER_NO_SCRIPT (unparseable), turnPlanner.plan(..) returns empty, and the
        // pre-stream branch falls back to the byte-identical legacy companionLlm.stream(..) call.
        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(), request("Mennyit aludtam kedden?"))
                .collectList().block();

        MessageResponse done = (MessageResponse) events.getLast().data();
        assertThat(done.getContent()).startsWith(FakeCompanionLlm.PREFIX);
        assertThat(done.getContent()).doesNotContain(FakeCompanionLlm.ANSWER_SENTINEL);
    }

    /**
     * mezo-rj214.7 S9.6 Task 3: the stream restructure's whole point is that these frames reach
     * the client LIVE — PLANNING ahead of the pre-stream lap, RETRIEVING once the plan executes
     * (the seam through {@code ChatService#planAndExecuteVolatile}), ANSWERING right before the
     * answerer's own Flux is returned (the streamed LOOKUP path's own emission point, since the
     * seam only covers sync answer calls).
     */
    @Test
    void testStreamMessage_shouldNarratePhases_whenLookupPipelineRuns() {
        UUID userId = databasePopulator.populateUser("stream-pipe-phases-lookup@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("7.5"), 2);
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(), request("Mennyit aludtam mostanában?" + PLAN_SLEEP))
                .collectList().block();

        List<String> names = events.stream().map(ServerSentEvent::event).toList();
        int planning = names.indexOf("phase");
        int firstTool = names.indexOf("tool");
        int firstDelta = names.indexOf("delta");
        assertThat(planning).isNotNegative().isLessThan(firstTool);
        assertThat(firstTool).isLessThan(firstDelta);

        List<String> phases = events.stream().filter(e -> "phase".equals(e.event()))
                .map(e -> ((StreamPhase) e.data()).getPhase()).toList();
        assertThat(phases).containsExactly("planning", "retrieving", "answering");
    }

    /**
     * The replan lap's own RETRIEVING/ANSWERING repeat (pinned in isolation by {@code
     * TurnPhaseSeamTest}) reaches the client through this exact streamed path too — PLANNING still
     * fires only once, at pipeline-attempt start.
     */
    @Test
    void testStreamMessage_shouldRepeatPhases_whenAnalysisReplans() {
        UUID userId = databasePopulator.populateUser("stream-pipe-phases-replan@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("6.0"), 4);
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(),
                        request("Miért alszom rosszul mostanában? [fake-datagap:alvásnapló]" + PLAN_SLEEP))
                .collectList().block();

        List<String> phases = events.stream().filter(e -> "phase".equals(e.event()))
                .map(e -> ((StreamPhase) e.data()).getPhase()).toList();
        assertThat(phases).containsExactly("planning", "retrieving", "answering", "retrieving", "answering");
    }

    /**
     * A planner that never scripted a usable plan still opens with PLANNING — the caller commits
     * to the attempt before it knows the planner will fail — but never reaches RETRIEVING/ANSWERING
     * since the pre-stream lap falls back to the legacy stream before either seam point.
     */
    @Test
    void testStreamMessage_shouldEmitOnlyPlanning_whenPlannerFallsBackToLegacy() {
        UUID userId = databasePopulator.populateUser("stream-pipe-phases-fallback@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(), request("Mennyit aludtam kedden?"))
                .collectList().block();

        List<String> phases = events.stream().filter(e -> "phase".equals(e.event()))
                .map(e -> ((StreamPhase) e.data()).getPhase()).toList();
        assertThat(phases).containsExactly("planning");
        assertThat(events.getLast().event()).isEqualTo("done");
    }
}
