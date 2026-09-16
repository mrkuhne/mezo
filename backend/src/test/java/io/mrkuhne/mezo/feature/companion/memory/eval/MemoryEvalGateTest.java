package io.mrkuhne.mezo.feature.companion.memory.eval;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalGate.EvalBudget;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalMetrics.EvalMetrics;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;

class MemoryEvalGateTest {

    private static final EvalMetrics BASELINE = metrics(.70, .62, .65, .55, .09, 0);
    private static final EvalBudget BUDGET = new EvalBudget(new BigDecimal("5.00"), BigDecimal.ZERO);

    @Test
    void testEvaluate_shouldPass_whenEveryReleaseThresholdPasses() {
        EvalMetrics passing = metrics(.85, .71, .76, .68, .04, 0);

        assertThat(MemoryEvalGate.evaluate(passing, BASELINE, Duration.ofMillis(240), BUDGET).passed())
                .isTrue();
    }

    @Test
    void testEvaluate_shouldPass_whenInclusiveThresholdsAndBudgetsAreExact() {
        EvalMetrics exact = metrics(.85, .63, .66, .65, .05, 0);
        MemoryEvalGate.EvalCost exactBudget = new MemoryEvalGate.EvalCost(
                new BigDecimal("5.00"), BigDecimal.ZERO);

        assertThat(MemoryEvalGate.evaluate(
                exact, BASELINE, Duration.ofMillis(250), exactBudget, BUDGET).passed()).isTrue();
    }

    @Test
    void testEvaluate_shouldFailRecallGate_whenRecallIsExactlyEightyFourPointNineNinePercent() {
        assertOnlyGateFails(metrics(.8499, .71, .76, .68, .04, 0), Duration.ofMillis(240), "recallAt5");
    }

    @Test
    void testEvaluate_shouldFailNdcgGate_whenCandidateDoesNotImproveBaseline() {
        assertOnlyGateFails(metrics(.85, .62, .76, .68, .04, 0), Duration.ofMillis(240), "ndcgAt5");
    }

    @Test
    void testEvaluate_shouldFailMrrGate_whenCandidateDoesNotImproveBaseline() {
        assertOnlyGateFails(metrics(.85, .71, .65, .68, .04, 0), Duration.ofMillis(240), "mrr");
    }

    @Test
    void testEvaluate_shouldFailContextPrecisionGate_whenGainIsExactlyNinePointNineNinePercentagePoints() {
        assertOnlyGateFails(metrics(.85, .71, .76, .6499, .04, 0), Duration.ofMillis(240),
                "contextPrecision");
    }

    @Test
    void testEvaluate_shouldFailOwnershipGate_whenOneForeignMemoryLeaks() {
        assertOnlyGateFails(metrics(.85, .71, .76, .68, .04, 1), Duration.ofMillis(240),
                "ownershipIsolation");
    }

    @Test
    void testEvaluate_shouldFailEmptyFalsePositiveGate_whenRateExceedsFivePercent() {
        assertOnlyGateFails(metrics(.85, .71, .76, .68, .0501, 0), Duration.ofMillis(240),
                "emptyFalsePositiveRate");
    }

    @Test
    void testEvaluate_shouldFailLatencyGate_whenP95IsTwoHundredFiftyOneMilliseconds() {
        assertOnlyGateFails(metrics(.85, .71, .76, .68, .04, 0), Duration.ofMillis(251), "latencyP95");
    }

    @Test
    void testEvaluate_shouldFailEmbeddingBudgetGate_whenActualCostExceedsConfiguredMaximum() {
        MemoryEvalGate.GateResult result = MemoryEvalGate.evaluate(
                metrics(.85, .71, .76, .68, .04, 0), BASELINE, Duration.ofMillis(240),
                new MemoryEvalGate.EvalCost(new BigDecimal("5.01"), BigDecimal.ZERO), BUDGET);

        assertThat(result.failedGates()).containsExactly("embeddingBudget");
    }

    @Test
    void testEvaluate_shouldFailRerankingBudgetGate_whenActualCostExceedsConfiguredMaximum() {
        MemoryEvalGate.GateResult result = MemoryEvalGate.evaluate(
                metrics(.85, .71, .76, .68, .04, 0), BASELINE, Duration.ofMillis(240),
                new MemoryEvalGate.EvalCost(BigDecimal.ZERO, new BigDecimal("0.01")), BUDGET);

        assertThat(result.failedGates()).containsExactly("rerankingBudget");
    }

    @Test
    void testReport_shouldCalculateMetricDeltasAndNearestRankPercentiles() {
        EvalMetrics candidate = metrics(.85, .71, .76, .68, .04, 0);

        MemoryEvalReport.MetricComparison comparison = MemoryEvalReport.compare(BASELINE, candidate);
        MemoryEvalReport.LatencyStats latency = MemoryEvalReport.latencyStats(List.of(
                Duration.ofMillis(10), Duration.ofMillis(20), Duration.ofMillis(30),
                Duration.ofMillis(40), Duration.ofMillis(50)));

        assertThat(comparison.delta().recallAt5()).isCloseTo(.15, org.assertj.core.data.Offset.offset(1e-12));
        assertThat(comparison.delta().contextPrecision())
                .isCloseTo(.13, org.assertj.core.data.Offset.offset(1e-12));
        assertThat(latency).isEqualTo(new MemoryEvalReport.LatencyStats(5, 30, 50, 50));
        assertThat(MemoryEvalReport.latencyStats(List.of(Duration.ofNanos(250_000_001))).p95Ms())
                .isEqualTo(251);
    }

    @Test
    void testHardGates_shouldNameReportOnlyFailures_whenExecutionAndAuditAreIncomplete() {
        MemoryEvalGate.GateResult policy = MemoryEvalGate.evaluate(
                metrics(.85, .71, .76, .68, .04, 0), BASELINE, Duration.ofMillis(240), BUDGET);

        MemoryEvalReport.HardGates gates = MemoryEvalReport.HardGates.from(policy, false, false);

        assertThat(gates.passed()).isFalse();
        assertThat(gates.failedGates()).containsExactly("queryExecution", "usageAudit");
    }

    private static void assertOnlyGateFails(EvalMetrics candidate, Duration p95, String expectedGate) {
        MemoryEvalGate.GateResult result = MemoryEvalGate.evaluate(candidate, BASELINE, p95, BUDGET);

        assertThat(result.passed()).isFalse();
        assertThat(result.failedGates()).containsExactly(expectedGate);
    }

    private static EvalMetrics metrics(
            double recallAt5,
            double ndcgAt5,
            double mrr,
            double contextPrecision,
            double emptyFalsePositiveRate,
            int ownershipLeaks) {
        return new EvalMetrics(
                recallAt5, ndcgAt5, mrr, contextPrecision, emptyFalsePositiveRate, ownershipLeaks);
    }
}
