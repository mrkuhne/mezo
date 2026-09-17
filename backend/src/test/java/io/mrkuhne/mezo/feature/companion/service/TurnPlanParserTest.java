package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class TurnPlanParserTest {

    private final TurnPlanParser parser = new TurnPlanParser(new ObjectMapper());

    @Test
    void testParse_shouldReturnPlan_whenReplyIsCleanJson() {
        String raw = """
            {"needsData":true,"steps":[{"tool":"get_fuel_log","args":{"range":"day"},"why":"mai étkezés"}]}""";

        TurnPlan plan = parser.parse(raw).orElseThrow();

        assertThat(plan.needsData()).isTrue();
        assertThat(plan.steps()).hasSize(1);
        assertThat(plan.steps().getFirst().tool()).isEqualTo("get_fuel_log");
        assertThat(plan.steps().getFirst().args()).isEqualTo(Map.of("range", "day"));
        assertThat(plan.steps().getFirst().why()).isEqualTo("mai étkezés");
    }

    @Test
    void testParse_shouldStripSurroundingProse_whenModelWrapsTheJson() {
        String raw = "Rendben, íme a terv:\n```json\n{\"needsData\":false,\"steps\":[]}\n```\nKész.";

        TurnPlan plan = parser.parse(raw).orElseThrow();

        assertThat(plan.needsData()).isFalse();
        assertThat(plan.steps()).isEmpty();
    }

    @Test
    void testParse_shouldNormalizeNulls_whenFieldsAreOmitted() {
        // steps omitted entirely; a step with no args and no why
        TurnPlan noSteps = parser.parse("{\"needsData\":false}").orElseThrow();
        TurnPlan bareStep = parser.parse(
            "{\"needsData\":true,\"steps\":[{\"tool\":\"get_pantry\"}]}").orElseThrow();

        assertThat(noSteps.steps()).isNotNull().isEmpty();
        assertThat(bareStep.steps().getFirst().args()).isNotNull().isEmpty();
        assertThat(bareStep.steps().getFirst().why()).isEmpty();
    }

    @Test
    void testParse_shouldBeEmpty_whenReplyHasNoJsonOrGarbage() {
        assertThat(parser.parse(null)).isEmpty();
        assertThat(parser.parse("nem tudok tervezni")).isEmpty();
        assertThat(parser.parse("{needsData:maybe}")).isEmpty();
    }
}
