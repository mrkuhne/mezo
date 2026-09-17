package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * The S9.4 slice end-to-end, DARK: planner (fake, scripted) -> validator -> executor -> outcomes.
 *
 * <p>Deliberately NOT {@code @Transactional}: {@link PlanExecutor} fans steps out onto
 * {@code applicationTaskExecutor} pool threads, each opening its own DB connection for its tool
 * read — the same reason {@code MemoryContextServiceIT} and its sibling memory-platform ITs skip
 * it. A wrapping test transaction holds its connection open uncommitted on the JUnit thread, so a
 * pool thread's separate connection cannot see rows this test just inserted (READ COMMITTED); the
 * populated user/sleep-log commit immediately instead, and {@code ResetDatabase} truncates
 * between tests for isolation.
 */
@ActiveProfiles("companion-fake")
class TurnPipelineIT extends AbstractIntegrationTest {

    @Autowired private TurnPlanner turnPlanner;
    @Autowired private PlanExecutor planExecutor;
    @Autowired private io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry toolRegistry;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;

    @Test
    void testPipeline_shouldExecuteScriptedPlanOverRealTools_whenDataExists() {
        UUID userId = databasePopulator.populateUser("pipeline@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("7.5"), 2);

        String scripted = """
            [fake-plan:{"needsData":true,"steps":[\
            {"tool":"get_recovery","args":{"scope":"sleep","days":3},"why":"alvás"},\
            {"tool":"get_pantry","args":{},"why":"kamra"}]}]""";
        ValidatedPlan plan = turnPlanner
            .plan(List.of(), "Hogy aludtam, és mi van a kamrában? " + scripted, LocalDate.now())
            .orElseThrow();

        assertThat(plan.steps()).hasSize(2);
        assertThat(plan.rejections()).isEmpty();

        ToolCallAudit audit = toolRegistry.newTurnAudit();
        List<ToolCallAudit.ToolOutcome> outcomes = planExecutor.execute(plan, userId, audit);

        assertThat(outcomes).extracting(ToolCallAudit.ToolOutcome::name)
            .containsExactly("get_recovery", "get_pantry");
        // Real rendered Hungarian from the real tools, not stub text. The pantry is EMPTY for
        // this user, so assert honesty (a real render, no failure text), not specific content.
        assertThat(outcomes.getFirst().result()).contains("7,5");
        assertThat(outcomes.get(1).result()).isNotBlank()
            .isNotEqualTo(PlanExecutor.STEP_FAILED)
            .isNotEqualTo(PlanExecutor.STEP_TIMEOUT);
        // The audit is the same choke point the live loop uses — envelopes fill identically.
        assertThat(audit.callCount()).isEqualTo(2);
        assertThat(audit.toToolCallsEnvelope()).isNotNull();
    }

    @Test
    void testPipeline_shouldSurviveAnUnknownStep_whenTheScriptIsPartiallyBroken() {
        UUID userId = databasePopulator.populateUser("pipeline-broken@test.local");

        String scripted = """
            [fake-plan:{"needsData":true,"steps":[\
            {"tool":"log_meal","args":{},"why":"nem létezik"},\
            {"tool":"get_pantry","args":{},"why":"kamra"}]}]""";
        ValidatedPlan plan = turnPlanner
            .plan(List.of(), "kamra? " + scripted, LocalDate.now())
            .orElseThrow();

        assertThat(plan.steps()).singleElement()
            .extracting(TurnPlan.PlanStep::tool).isEqualTo("get_pantry");
        assertThat(plan.rejections()).singleElement().asString().contains("log_meal");

        List<ToolCallAudit.ToolOutcome> outcomes =
            planExecutor.execute(plan, userId, toolRegistry.newTurnAudit());
        assertThat(outcomes).hasSize(1);
    }
}
