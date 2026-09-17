package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Pins the {@link TurnPhase} emission order through {@link ChatService#pipelineAnswer}, incl. the
 * replan lap's repeat. Deliberately NOT {@code @Transactional} — mirrors {@link
 * ChatServicePipelineIT}'s precedent: {@link PlanExecutor}'s pool threads read with their own
 * connections.
 */
@ActiveProfiles("companion-fake")
class TurnPhaseSeamTest extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private CompanionToolRegistry toolRegistry;
    @Autowired private DatabasePopulator databasePopulator;

    private static final String PLAN_PANTRY =
        " [fake-plan:{\"needsData\":true,\"steps\":[{\"tool\":\"get_pantry\",\"args\":{},\"why\":\"kamra\"}]}]";

    @Test
    void testPipelineAnswer_shouldEmitRetrievingAndAnswering_whenPlanExecutes() {
        UUID userId = databasePopulator.populateUser("phase-seam@test.local");
        List<TurnPhase> phases = new ArrayList<>();

        String answer = chatService.pipelineAnswer(userId, UUID.randomUUID(), TurnGear.LOOKUP,
            "HANG", "\n\nMa: " + LocalDate.now() + "\n", List.of(),
            "Mi van a kamrában?" + PLAN_PANTRY, LocalDate.now(),
            toolRegistry.newTurnAudit(), phases::add);

        assertThat(answer).isNotNull();
        assertThat(phases).containsExactly(TurnPhase.RETRIEVING, TurnPhase.ANSWERING);
    }

    @Test
    void testPipelineAnswer_shouldRepeatPhases_whenAnalysisReplans() {
        UUID userId = databasePopulator.populateUser("phase-replan@test.local");
        List<TurnPhase> phases = new ArrayList<>();

        chatService.pipelineAnswer(userId, UUID.randomUUID(), TurnGear.ANALYSIS,
            "HANG", "\n\nMa: " + LocalDate.now() + "\n", List.of(),
            "Miért üres a kamrám mostanában? [fake-datagap:vásárlások]" + PLAN_PANTRY,
            LocalDate.now(), toolRegistry.newTurnAudit(), phases::add);

        assertThat(phases).containsExactly(TurnPhase.RETRIEVING, TurnPhase.ANSWERING,
            TurnPhase.RETRIEVING, TurnPhase.ANSWERING);
    }

    @Test
    void testPipelineAnswer_shouldTolerateNullConsumer_whenSyncPathCalls() {
        UUID userId = databasePopulator.populateUser("phase-null@test.local");

        String answer = chatService.pipelineAnswer(userId, UUID.randomUUID(), TurnGear.LOOKUP,
            "HANG", "\n\nMa: " + LocalDate.now() + "\n", List.of(),
            "Mi van a kamrában?" + PLAN_PANTRY, LocalDate.now(),
            toolRegistry.newTurnAudit(), null);

        assertThat(answer).isNotNull();
    }

    @Test
    void testPipelineAnswer_shouldNotEmitRetrieving_whenPlanNeedsNoData() {
        UUID userId = databasePopulator.populateUser("phase-empty@test.local");
        List<TurnPhase> phases = new ArrayList<>();
        String emptyPlan = " [fake-plan:{\"needsData\":false,\"steps\":[]}]";

        String answer = chatService.pipelineAnswer(userId, UUID.randomUUID(), TurnGear.LOOKUP,
            "HANG", "\n\nMa: " + LocalDate.now() + "\n", List.of(),
            "Mi van a kamrában?" + emptyPlan, LocalDate.now(),
            toolRegistry.newTurnAudit(), phases::add);

        assertThat(answer).isNotNull();
        assertThat(phases).containsExactly(TurnPhase.ANSWERING);
    }
}
