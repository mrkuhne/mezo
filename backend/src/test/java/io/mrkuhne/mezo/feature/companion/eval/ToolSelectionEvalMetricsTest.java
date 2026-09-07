package io.mrkuhne.mezo.feature.companion.eval;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.eval.ToolSelectionEvalMetrics.CaseOutcome;
import io.mrkuhne.mezo.feature.companion.eval.ToolSelectionEvalMetrics.EvalReport;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class ToolSelectionEvalMetricsTest {

    private static CaseOutcome outcome(String id, List<String> expected, List<String> actual, long latencyMs, String cost) {
        return new CaseOutcome(id, "kérdés " + id, expected, actual, latencyMs, new BigDecimal(cost), true, false);
    }

    @Test
    void testEvaluate_shouldSeparateHitFromExactMatch_whenAnExtraToolRidesAlong() {
        EvalReport report = ToolSelectionEvalMetrics.evaluate("m", List.of(
            outcome("a", List.of("get_training_plan"), List.of("get_training_plan"), 1000, "0.001"),
            outcome("b", List.of("get_training_plan"), List.of("get_training_plan", "get_training_log"), 1000, "0.001")));

        assertThat(report.hits()).isEqualTo(2);
        assertThat(report.exactMatches()).isEqualTo(1);
        assertThat(report.exactMatchRate()).isEqualTo(0.5);
    }

    @Test
    void testEvaluate_shouldCountACrossDomainToolAsCritical_whenNoExpectedToolSharesItsDomain() {
        EvalReport report = ToolSelectionEvalMetrics.evaluate("m", List.of(
            outcome("a", List.of("get_training_plan"), List.of("get_fuel_log"), 1000, "0.001"),
            outcome("b", List.of("get_training_plan"), List.of("get_training_log"), 1000, "0.001")));

        assertThat(report.criticalWrongTools()).isEqualTo(1);
        assertThat(report.criticalDetails()).singleElement().asString().contains("get_fuel_log");
    }

    @Test
    void testEvaluate_shouldTreatAnUnknownToolNameAsCritical_whenTheDomainMapDoesNotKnowIt() {
        EvalReport report = ToolSelectionEvalMetrics.evaluate("m", List.of(
            outcome("a", List.of("get_training_plan"), List.of("get_something_new"), 1000, "0.001")));

        assertThat(report.criticalWrongTools()).isEqualTo(1);
    }

    @Test
    void testEvaluate_shouldReportNearestRankPercentiles_whenLatenciesSpanTheCaseSet() {
        EvalReport report = ToolSelectionEvalMetrics.evaluate("m", List.of(
            outcome("a", List.of("get_training_plan"), List.of("get_training_plan"), 100, "0.001"),
            outcome("b", List.of("get_training_plan"), List.of("get_training_plan"), 200, "0.002"),
            outcome("c", List.of("get_training_plan"), List.of("get_training_plan"), 300, "0.003"),
            outcome("d", List.of("get_training_plan"), List.of("get_training_plan"), 4000, "0.004")));

        assertThat(report.latencyP50()).isEqualTo(200);
        assertThat(report.latencyP95()).isEqualTo(4000);
        assertThat(report.costPerSuccessP50()).isEqualByComparingTo("0.002");
        assertThat(report.totalCostUsd()).isEqualByComparingTo("0.010");
    }

    @Test
    void testEvaluate_shouldExcludeMissesFromCostPerSuccessfulAction_whenACaseSelectedNoRightTool() {
        EvalReport report = ToolSelectionEvalMetrics.evaluate("m", List.of(
            outcome("a", List.of("get_training_plan"), List.of("get_training_plan"), 100, "0.001"),
            outcome("b", List.of("get_training_plan"), List.of(), 100, "9.000")));

        assertThat(report.costPerSuccessP50()).isEqualByComparingTo("0.001");
        assertThat(report.totalCostUsd()).isEqualByComparingTo("9.001");
        assertThat(report.misses()).singleElement().asString().contains("[b]");
    }

    @Test
    void testEvaluate_shouldReportJsonValidityAndErrorsSeparately_whenACaseThrew() {
        EvalReport report = ToolSelectionEvalMetrics.evaluate("m", List.of(
            new CaseOutcome("a", "q", List.of("get_training_plan"), List.of(), 100, BigDecimal.ZERO, false, true),
            outcome("b", List.of("get_training_plan"), List.of("get_training_plan"), 100, "0.001")));

        assertThat(report.errors()).isEqualTo(1);
        assertThat(report.jsonValidRate()).isEqualTo(0.5);
        assertThat(report.hits()).isEqualTo(1);
    }
}
