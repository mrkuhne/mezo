package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.DefaultToolDefinition;
import org.springframework.ai.tool.definition.ToolDefinition;
import tools.jackson.databind.ObjectMapper;

class PlanValidatorTest {

    private static final String FUEL_SCHEMA = """
        {"type":"object","properties":{
          "range":{"type":"string","description":"day vagy week"},
          "date":{"type":"string"},"days":{"type":"integer"}}}""";

    /** Definition-only stub: the validator must never invoke a callback. */
    private static ToolCallback stub(String name, String schema) {
        ToolDefinition def = DefaultToolDefinition.builder()
            .name(name).description("stub").inputSchema(schema).build();
        return new ToolCallback() {
            @Override public ToolDefinition getToolDefinition() { return def; }
            @Override public String call(String toolInput) { throw new AssertionError("validator must not call tools"); }
            @Override public String call(String toolInput, ToolContext ctx) { throw new AssertionError("validator must not call tools"); }
        };
    }

    private final PlanValidator validator = new PlanValidator(new ObjectMapper(),
        CompanionPropertiesFixtures.withGearClassifier(true));

    private final List<ToolCallback> callbacks = List.of(stub("get_fuel_log", FUEL_SCHEMA));

    @Test
    void testValidate_shouldAcceptStep_whenToolAndArgsMatchTheSchema() {
        TurnPlan plan = new TurnPlan(true, List.of(
            new TurnPlan.PlanStep("get_fuel_log", Map.of("range", "day"), "mai étkezés")));

        ValidatedPlan validated = validator.validate(plan, callbacks);

        assertThat(validated.steps()).hasSize(1);
        assertThat(validated.rejections()).isEmpty();
    }

    @Test
    void testValidate_shouldRejectStep_whenToolIsUnknown() {
        TurnPlan plan = new TurnPlan(true, List.of(
            new TurnPlan.PlanStep("log_meal", Map.of(), "írjuk fel")));

        ValidatedPlan validated = validator.validate(plan, callbacks);

        assertThat(validated.steps()).isEmpty();
        assertThat(validated.rejections()).singleElement().asString().contains("log_meal").contains("ismeretlen eszköz");
    }

    @Test
    void testValidate_shouldRejectStep_whenAnArgIsNotInTheSchema() {
        TurnPlan plan = new TurnPlan(true, List.of(
            new TurnPlan.PlanStep("get_fuel_log", Map.of("range", "day", "grams", true), "mai étkezés")));

        ValidatedPlan validated = validator.validate(plan, callbacks);

        assertThat(validated.steps()).isEmpty();
        assertThat(validated.rejections()).singleElement().asString().contains("grams").contains("ismeretlen paraméter");
    }

    @Test
    void testValidate_shouldCapSteps_whenThePlanExceedsTheToolBudget() {
        List<TurnPlan.PlanStep> many = java.util.stream.IntStream.range(0, 20)
            .mapToObj(i -> new TurnPlan.PlanStep("get_fuel_log", Map.of("range", "day"), "lépés " + i))
            .toList();

        ValidatedPlan validated = validator.validate(new TurnPlan(true, many), callbacks);

        // The fixture's tools budget is maxCallsPerTurn=15 (mirrors application.yml).
        assertThat(validated.steps()).hasSize(15);
        assertThat(validated.rejections()).hasSize(5);
        assertThat(validated.rejections().getFirst()).contains("lépéskeret");
    }
}
