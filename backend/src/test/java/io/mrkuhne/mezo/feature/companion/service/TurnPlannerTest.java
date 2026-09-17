package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.DefaultToolDefinition;
import org.springframework.ai.tool.definition.ToolDefinition;
import reactor.core.publisher.Flux;
import tools.jackson.databind.ObjectMapper;

class TurnPlannerTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 17);

    /** Minimal scripted port: answers completeSmart from a queue, records the prompts it saw. */
    private static final class ScriptedLlm implements CompanionLlm {
        final List<String> systemPrompts = new ArrayList<>();
        final List<String> userMessages = new ArrayList<>();
        private final java.util.Deque<String> replies;
        ScriptedLlm(String... replies) { this.replies = new java.util.ArrayDeque<>(List.of(replies)); }

        @Override public String completeSmart(String systemPrompt, String turnContext,
                                              List<Turn> history, String userMessage) {
            systemPrompts.add(systemPrompt);
            userMessages.add(userMessage);
            return replies.pop();
        }
        // Unused port surface:
        @Override public String complete(String s, List<Turn> h, String u,
                                         List<org.springframework.ai.tool.ToolCallback> t, Map<String, Object> c) {
            throw new UnsupportedOperationException();
        }
        @Override public Flux<String> stream(String s, List<Turn> h, String u,
                                             List<org.springframework.ai.tool.ToolCallback> t, Map<String, Object> c) {
            throw new UnsupportedOperationException();
        }
        @Override public String complete(String s, String u, List<InlineImage> i) { throw new UnsupportedOperationException(); }
        @Override public String complete(String s, String u, InlineAudio a) { throw new UnsupportedOperationException(); }
    }

    private static ToolCallback stub(String name) {
        ToolDefinition def = DefaultToolDefinition.builder().name(name).description("stub")
            .inputSchema("{\"type\":\"object\",\"properties\":{\"range\":{\"type\":\"string\"}}}").build();
        return new ToolCallback() {
            @Override public ToolDefinition getToolDefinition() { return def; }
            @Override public String call(String in) { throw new AssertionError("planner must not call tools"); }
            @Override public String call(String in, ToolContext ctx) { throw new AssertionError("planner must not call tools"); }
        };
    }

    private TurnPlanner planner(ScriptedLlm llm) {
        CompanionToolRegistry registry = Mockito.mock(CompanionToolRegistry.class);
        Mockito.when(registry.callbacks(Mockito.any())).thenReturn(List.of(stub("get_fuel_log")));
        Mockito.when(registry.newTurnAudit()).thenReturn(new io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit(15, 10));
        ObjectMapper mapper = new ObjectMapper();
        ToolCatalogue catalogue = new ToolCatalogue(registry, mapper);
        return new TurnPlanner(llm, new TurnPlanParser(mapper), new PlanValidator(mapper,
            CompanionPropertiesFixtures.withExecutor(4, 1000)), catalogue, registry,
            CompanionPropertiesFixtures.withExecutor(4, 1000));
    }

    @Test
    void testPlan_shouldReturnValidatedSteps_whenTheModelPlansCleanly() {
        ScriptedLlm llm = new ScriptedLlm(
            "{\"needsData\":true,\"steps\":[{\"tool\":\"get_fuel_log\",\"args\":{\"range\":\"day\"},\"why\":\"mai étkezés\"}]}");

        ValidatedPlan plan = planner(llm).plan(List.of(), "Mit ettem ma?", TODAY).orElseThrow();

        assertThat(plan.steps()).hasSize(1);
        assertThat(llm.systemPrompts.getFirst()).startsWith(TurnPlanner.PROMPT_MARKER)
            .contains("[Eszköz-katalógus]").contains("get_fuel_log");
    }

    @Test
    void testPlan_shouldRepairOnce_whenTheFirstPlanIsRejected() {
        ScriptedLlm llm = new ScriptedLlm(
            "{\"needsData\":true,\"steps\":[{\"tool\":\"log_meal\",\"args\":{},\"why\":\"írd fel\"}]}",
            "{\"needsData\":true,\"steps\":[{\"tool\":\"get_fuel_log\",\"args\":{\"range\":\"day\"},\"why\":\"mai étkezés\"}]}");

        ValidatedPlan plan = planner(llm).plan(List.of(), "Mit ettem ma?", TODAY).orElseThrow();

        assertThat(plan.steps()).hasSize(1);
        assertThat(llm.userMessages).hasSize(2);
        assertThat(llm.userMessages.get(1)).contains("[JAVÍTÁS]").contains("ismeretlen eszköz");
    }

    @Test
    void testPlan_shouldBeEmpty_whenRepairAlsoFails() {
        ScriptedLlm llm = new ScriptedLlm("zagyvaság", "még mindig zagyvaság");

        assertThat(planner(llm).plan(List.of(), "Mit ettem ma?", TODAY)).isEmpty();
        assertThat(llm.userMessages).hasSize(2);
    }

    @Test
    void testPlan_shouldReturnZeroSteps_whenTheModelSaysNoDataNeeded() {
        ScriptedLlm llm = new ScriptedLlm("{\"needsData\":false,\"steps\":[]}");

        ValidatedPlan plan = planner(llm).plan(List.of(), "Mit gondolsz a kreatinról?", TODAY).orElseThrow();

        assertThat(plan.steps()).isEmpty();
        assertThat(plan.rejections()).isEmpty();
    }

    @Test
    void testPlan_shouldRepair_whenNeedsDataButNoSteps() {
        ScriptedLlm llm = new ScriptedLlm(
            "{\"needsData\":true,\"steps\":[]}",
            "{\"needsData\":true,\"steps\":[{\"tool\":\"get_fuel_log\",\"args\":{\"range\":\"day\"},\"why\":\"mai étkezés\"}]}");

        ValidatedPlan plan = planner(llm).plan(List.of(), "Mit ettem ma?", TODAY).orElseThrow();

        assertThat(plan.steps()).hasSize(1);
        assertThat(llm.userMessages).hasSize(2);
        assertThat(llm.userMessages.get(1)).contains("[JAVÍTÁS]")
            .contains("needsData=true, de nincs egyetlen lépés sem");
    }

    @Test
    void testPlan_shouldNotRepair_whenOnlySomeStepsWereRejected() {
        ScriptedLlm llm = new ScriptedLlm(
            "{\"needsData\":true,\"steps\":[{\"tool\":\"get_fuel_log\",\"args\":{\"range\":\"day\"},\"why\":\"ok\"},"
                + "{\"tool\":\"log_meal\",\"args\":{},\"why\":\"rossz\"}]}");

        ValidatedPlan plan = planner(llm).plan(List.of(), "Mit ettem ma?", TODAY).orElseThrow();

        // A partially valid plan runs as-is; the rejection travels with it for provenance.
        assertThat(plan.steps()).hasSize(1);
        assertThat(plan.rejections()).hasSize(1);
        assertThat(llm.userMessages).hasSize(1);
    }
}
