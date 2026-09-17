package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.DefaultToolDefinition;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import tools.jackson.databind.ObjectMapper;

/**
 * Unit test with stub callbacks and a real pool — the end-to-end run against the real registry
 * happens in TurnPipelineIT (Task 8). NOTE ON MOCKS: the house testing standard forbids mocks in
 * INTEGRATION tests; this is a plain unit test of orchestration logic, where a stubbed registry
 * is the only way to script slow/failing tools deterministically.
 */
class PlanExecutorTest {

    private final ThreadPoolTaskExecutor pool = new ThreadPoolTaskExecutor();
    private final ObjectMapper objectMapper = new ObjectMapper();

    { pool.setCorePoolSize(4); pool.initialize(); }

    @AfterEach
    void shutDown() { pool.shutdown(); }

    private static ToolCallback tool(String name, java.util.function.Function<String, String> body) {
        ToolDefinition def = DefaultToolDefinition.builder()
            .name(name).description("stub").inputSchema("{\"type\":\"object\",\"properties\":{}}").build();
        return new ToolCallback() {
            @Override public ToolDefinition getToolDefinition() { return def; }
            @Override public String call(String toolInput) { return body.apply(toolInput); }
            @Override public String call(String toolInput, ToolContext ctx) { return body.apply(toolInput); }
        };
    }

    private PlanExecutor executor(long stepTimeoutMs, ToolCallback... tools) {
        CompanionToolRegistry registry = Mockito.mock(CompanionToolRegistry.class);
        Mockito.when(registry.callbacks(Mockito.any())).thenReturn(List.of(tools));
        Mockito.when(registry.toolContext(Mockito.any(), Mockito.any())).thenReturn(Map.of());
        return new PlanExecutor(registry, objectMapper,
            CompanionPropertiesFixtures.withExecutor(4, stepTimeoutMs), pool);
    }

    private static TurnPlan.PlanStep step(String tool) {
        return new TurnPlan.PlanStep(tool, Map.of(), "teszt");
    }

    private static TurnPlan.PlanStep step(String tool, String why) {
        return new TurnPlan.PlanStep(tool, Map.of(), why);
    }

    @Test
    void testExecute_shouldReturnOutcomesInPlanOrder_whenStepsFinishOutOfOrder() throws Exception {
        CountDownLatch releaseSlow = new CountDownLatch(1);
        ToolCallback slow = tool("slow_tool", in -> {
            try { releaseSlow.await(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return "lassú kész";
        });
        ToolCallback fast = tool("fast_tool", in -> { releaseSlow.countDown(); return "gyors kész"; });
        PlanExecutor executor = executor(5_000, slow, fast);

        List<ToolCallAudit.ToolOutcome> outcomes = executor.execute(
            new ValidatedPlan(List.of(step("slow_tool"), step("fast_tool")), List.of()),
            UUID.randomUUID(), new ToolCallAudit(15, 10));

        assertThat(outcomes).extracting(ToolCallAudit.ToolOutcome::name)
            .containsExactly("slow_tool", "fast_tool");
        assertThat(outcomes).extracting(ToolCallAudit.ToolOutcome::result)
            .containsExactly("lassú kész", "gyors kész");
    }

    @Test
    void testExecute_shouldReportTimeoutHonestly_whenAStepMissesTheDeadline() {
        CountDownLatch never = new CountDownLatch(1);
        ToolCallback hanging = tool("hang_tool", in -> {
            try { never.await(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return "soha";
        });
        PlanExecutor executor = executor(200, hanging, tool("ok_tool", in -> "rendben"));

        List<ToolCallAudit.ToolOutcome> outcomes = executor.execute(
            new ValidatedPlan(List.of(step("hang_tool"), step("ok_tool")), List.of()),
            UUID.randomUUID(), new ToolCallAudit(15, 10));

        never.countDown();
        assertThat(outcomes.getFirst().result()).isEqualTo(PlanExecutor.STEP_TIMEOUT);
        assertThat(outcomes.get(1).result()).isEqualTo("rendben");
    }

    @Test
    void testExecute_shouldReportFailureHonestly_whenSubmissionItselfBreaks() {
        // A tool that is in the plan but not in the registry's callback list: validator normally
        // prevents this, but the executor must not throw if reality diverges.
        PlanExecutor executor = executor(1_000, tool("present_tool", in -> "megvan"));

        List<ToolCallAudit.ToolOutcome> outcomes = executor.execute(
            new ValidatedPlan(List.of(step("missing_tool"), step("present_tool")), List.of()),
            UUID.randomUUID(), new ToolCallAudit(15, 10));

        assertThat(outcomes.getFirst().result()).isEqualTo(PlanExecutor.STEP_FAILED);
        assertThat(outcomes.get(1).result()).isEqualTo("megvan");
    }

    @Test
    void testExecute_shouldStayNearTheSingleDeadline_whenMultipleStepsAllHang() {
        // Fix round 1, finding 4: a per-entry future.get(timeoutMs) compounds to steps × timeoutMs
        // (here 2 × 300 ms = 600 ms would still pass a loose bound, so the point is proven at a
        // step count where the OLD behaviour would already look suspicious under a tight bound).
        // The real guarantee is a single shared deadline: wall time stays near ONE stepTimeoutMs,
        // not the sum, however many steps hang.
        CountDownLatch neverA = new CountDownLatch(1);
        CountDownLatch neverB = new CountDownLatch(1);
        ToolCallback hangingA = tool("hang_a", in -> {
            try { neverA.await(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return "soha a";
        });
        ToolCallback hangingB = tool("hang_b", in -> {
            try { neverB.await(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return "soha b";
        });
        PlanExecutor executor = executor(300, hangingA, hangingB);

        long start = System.nanoTime();
        List<ToolCallAudit.ToolOutcome> outcomes = executor.execute(
            new ValidatedPlan(List.of(step("hang_a"), step("hang_b")), List.of()),
            UUID.randomUUID(), new ToolCallAudit(15, 10));
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;

        neverA.countDown();
        neverB.countDown();

        assertThat(outcomes).extracting(ToolCallAudit.ToolOutcome::result)
            .containsExactly(PlanExecutor.STEP_TIMEOUT, PlanExecutor.STEP_TIMEOUT);
        // Loose bound to avoid flake: well under the 2×300ms the old per-entry logic would need.
        assertThat(elapsedMs).isLessThan(1_500);
    }

    @Test
    void testExecute_shouldCarryThePlannersWhy_whenStepProvidesOne() {
        PlanExecutor executor = executor(1_000, tool("ok_tool", in -> "rendben"));

        List<ToolCallAudit.ToolOutcome> outcomes = executor.execute(
            new ValidatedPlan(List.of(step("ok_tool", "hogy lássam a mai étkezést")), List.of()),
            UUID.randomUUID(), new ToolCallAudit(15, 10));

        assertThat(outcomes.getFirst().why()).isEqualTo("hogy lássam a mai étkezést");
    }

    @Test
    void testExecute_shouldDefaultWhyToEmptyString_whenStepWhyIsBlank() {
        // The parser's default for an omitted `why` is "" (never null) — the executor must not
        // translate that into null on the way into the outcome record.
        PlanExecutor executor = executor(1_000, tool("ok_tool", in -> "rendben"));

        List<ToolCallAudit.ToolOutcome> outcomes = executor.execute(
            new ValidatedPlan(List.of(step("ok_tool", "")), List.of()),
            UUID.randomUUID(), new ToolCallAudit(15, 10));

        assertThat(outcomes.getFirst().why()).isEqualTo("");
    }
}
