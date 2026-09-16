package io.mrkuhne.mezo.feature.companion.memory.eval;

import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalGate.EvalBudget;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalGate.GateResult;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalMetrics.EvalMetrics;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Machine-readable artifact emitted by the opt-in real-provider memory evaluation. */
public record MemoryEvalReport(
        String corpusVersion,
        String corpusSha256,
        Instant generatedAt,
        String gitCommit,
        ProviderInfo provider,
        MetricComparison overall,
        Map<String, MetricComparison> byPersona,
        Map<String, MetricComparison> byFamily,
        LatencyComparison noRewriteNoRerankLatency,
        Usage usage,
        EvalBudget budget,
        List<String> failedQueryIds,
        HardGates hardGates,
        boolean passed) {

    public MemoryEvalReport {
        byPersona = Collections.unmodifiableMap(new LinkedHashMap<>(byPersona));
        byFamily = Collections.unmodifiableMap(new LinkedHashMap<>(byFamily));
        failedQueryIds = List.copyOf(failedQueryIds);
    }

    static MetricComparison compare(EvalMetrics baseline, EvalMetrics candidate) {
        return new MetricComparison(baseline, candidate, new MetricDelta(
                candidate.recallAt5() - baseline.recallAt5(),
                candidate.ndcgAt5() - baseline.ndcgAt5(),
                candidate.mrr() - baseline.mrr(),
                candidate.contextPrecision() - baseline.contextPrecision(),
                candidate.emptyFalsePositiveRate() - baseline.emptyFalsePositiveRate(),
                candidate.ownershipLeaks() - baseline.ownershipLeaks()));
    }

    static LatencyStats latencyStats(List<Duration> samples) {
        if (samples.isEmpty()) {
            return new LatencyStats(0, 0, 0, 0);
        }
        List<Long> millis = samples.stream()
                .map(MemoryEvalReport::ceilingMillis)
                .sorted(Comparator.naturalOrder())
                .toList();
        return new LatencyStats(
                millis.size(), percentile(millis, .50), percentile(millis, .95), percentile(millis, .99));
    }

    private static long percentile(List<Long> sortedMillis, double quantile) {
        int index = Math.max(0, (int) Math.ceil(quantile * sortedMillis.size()) - 1);
        return sortedMillis.get(index);
    }

    private static long ceilingMillis(Duration duration) {
        return Math.ceilDiv(duration.toNanos(), 1_000_000L);
    }

    public record ProviderInfo(String provider, String model, String embeddingVersion) {
    }

    public record MetricComparison(EvalMetrics baseline, EvalMetrics candidate, MetricDelta delta) {
    }

    public record MetricDelta(
            double recallAt5,
            double ndcgAt5,
            double mrr,
            double contextPrecision,
            double emptyFalsePositiveRate,
            int ownershipLeaks) {
    }

    public record LatencyComparison(LatencyStats baseline, LatencyStats candidate) {
    }

    public record LatencyStats(int samples, long p50Ms, long p95Ms, long p99Ms) {
    }

    public record Usage(EmbeddingUsage embedding, RewriteUsage rewrite, RerankerUsage reranker) {
    }

    public record EmbeddingUsage(int calls, long billableCharacters, int unpricedCalls, BigDecimal costUsd) {
    }

    /** Conditional context-dependent quality path; reported separately and excluded from latency. */
    public record RewriteUsage(String model, int calls, long tokens, int unpricedCalls, BigDecimal costUsd) {
    }

    public record RerankerUsage(int calls, long tokens, BigDecimal costUsd) {
    }

    public record HardGates(
            boolean recallAt5,
            boolean ndcgAt5,
            boolean mrr,
            boolean contextPrecision,
            boolean ownershipIsolation,
            boolean emptyFalsePositiveRate,
            boolean latencyP95,
            boolean embeddingBudget,
            boolean rerankingBudget,
            boolean queryExecution,
            boolean usageAudit,
            boolean passed) {

        static HardGates from(GateResult result, boolean queryExecution, boolean usageAudit) {
            return new HardGates(
                    result.recallAt5(), result.ndcgAt5(), result.mrr(), result.contextPrecision(),
                    result.ownershipIsolation(), result.emptyFalsePositiveRate(), result.latencyP95(),
                    result.embeddingBudget(), result.rerankingBudget(), queryExecution, usageAudit,
                    result.passed() && queryExecution && usageAudit);
        }

        List<String> failedGates() {
            List<String> failures = new java.util.ArrayList<>(resultFailures());
            addFailure(failures, queryExecution, "queryExecution");
            addFailure(failures, usageAudit, "usageAudit");
            return List.copyOf(failures);
        }

        private List<String> resultFailures() {
            List<String> failures = new java.util.ArrayList<>();
            addFailure(failures, recallAt5, "recallAt5");
            addFailure(failures, ndcgAt5, "ndcgAt5");
            addFailure(failures, mrr, "mrr");
            addFailure(failures, contextPrecision, "contextPrecision");
            addFailure(failures, ownershipIsolation, "ownershipIsolation");
            addFailure(failures, emptyFalsePositiveRate, "emptyFalsePositiveRate");
            addFailure(failures, latencyP95, "latencyP95");
            addFailure(failures, embeddingBudget, "embeddingBudget");
            addFailure(failures, rerankingBudget, "rerankingBudget");
            return failures;
        }

        private static void addFailure(List<String> failures, boolean passed, String name) {
            if (!passed) {
                failures.add(name);
            }
        }
    }
}
