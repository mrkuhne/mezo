package io.mrkuhne.mezo.feature.companion.memory.eval;

import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalMetrics.EvalMetrics;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/** Pure, immutable release policy for promoting chat retrieval beyond SHADOW mode. */
public final class MemoryEvalGate {

    static final BigDecimal MIN_RECALL_AT_5 = new BigDecimal("0.85");
    static final BigDecimal MIN_CONTEXT_PRECISION_GAIN = new BigDecimal("0.10");
    static final BigDecimal MAX_EMPTY_FALSE_POSITIVE_RATE = new BigDecimal("0.05");
    static final Duration MAX_P95 = Duration.ofMillis(250);

    private MemoryEvalGate() {
    }

    public static GateResult evaluate(
            EvalMetrics candidate,
            EvalMetrics baseline,
            Duration candidateP95,
            EvalBudget budget) {
        return evaluate(candidate, baseline, candidateP95, EvalCost.ZERO, budget);
    }

    public static GateResult evaluate(
            EvalMetrics candidate,
            EvalMetrics baseline,
            Duration candidateP95,
            EvalCost actualCost,
            EvalBudget budget) {
        boolean recall = decimal(candidate.recallAt5()).compareTo(MIN_RECALL_AT_5) >= 0;
        boolean ndcg = decimal(candidate.ndcgAt5()).compareTo(decimal(baseline.ndcgAt5())) > 0;
        boolean mrr = decimal(candidate.mrr()).compareTo(decimal(baseline.mrr())) > 0;
        boolean contextPrecision = decimal(candidate.contextPrecision())
                .subtract(decimal(baseline.contextPrecision()))
                .compareTo(MIN_CONTEXT_PRECISION_GAIN) >= 0;
        boolean ownershipIsolation = candidate.ownershipLeaks() == 0;
        boolean emptyFalsePositiveRate = decimal(candidate.emptyFalsePositiveRate())
                .compareTo(MAX_EMPTY_FALSE_POSITIVE_RATE) <= 0;
        boolean latencyP95 = candidateP95.compareTo(MAX_P95) <= 0;
        boolean embeddingBudget = actualCost.embeddingUsd().compareTo(budget.maxEmbeddingUsd()) <= 0;
        boolean rerankingBudget = actualCost.rerankingUsd().compareTo(budget.maxRerankingUsd()) <= 0;

        return new GateResult(
                recall,
                ndcg,
                mrr,
                contextPrecision,
                ownershipIsolation,
                emptyFalsePositiveRate,
                latencyP95,
                embeddingBudget,
                rerankingBudget);
    }

    private static BigDecimal decimal(double value) {
        return BigDecimal.valueOf(value);
    }

    public record EvalBudget(BigDecimal maxEmbeddingUsd, BigDecimal maxRerankingUsd) {
        public EvalBudget {
            if (maxEmbeddingUsd == null || maxRerankingUsd == null
                    || maxEmbeddingUsd.signum() < 0 || maxRerankingUsd.signum() < 0) {
                throw new IllegalArgumentException("Eval budgets must be non-null and non-negative");
            }
        }
    }

    public record EvalCost(BigDecimal embeddingUsd, BigDecimal rerankingUsd) {
        static final EvalCost ZERO = new EvalCost(BigDecimal.ZERO, BigDecimal.ZERO);

        public EvalCost {
            if (embeddingUsd == null || rerankingUsd == null
                    || embeddingUsd.signum() < 0 || rerankingUsd.signum() < 0) {
                throw new IllegalArgumentException("Eval costs must be non-null and non-negative");
            }
        }
    }

    public record GateResult(
            boolean recallAt5,
            boolean ndcgAt5,
            boolean mrr,
            boolean contextPrecision,
            boolean ownershipIsolation,
            boolean emptyFalsePositiveRate,
            boolean latencyP95,
            boolean embeddingBudget,
            boolean rerankingBudget) {

        public boolean passed() {
            return recallAt5 && ndcgAt5 && mrr && contextPrecision && ownershipIsolation
                    && emptyFalsePositiveRate && latencyP95 && embeddingBudget && rerankingBudget;
        }

        public List<String> failedGates() {
            List<String> failures = new ArrayList<>();
            addFailure(failures, recallAt5, "recallAt5");
            addFailure(failures, ndcgAt5, "ndcgAt5");
            addFailure(failures, mrr, "mrr");
            addFailure(failures, contextPrecision, "contextPrecision");
            addFailure(failures, ownershipIsolation, "ownershipIsolation");
            addFailure(failures, emptyFalsePositiveRate, "emptyFalsePositiveRate");
            addFailure(failures, latencyP95, "latencyP95");
            addFailure(failures, embeddingBudget, "embeddingBudget");
            addFailure(failures, rerankingBudget, "rerankingBudget");
            return List.copyOf(failures);
        }

        private static void addFailure(List<String> failures, boolean passed, String name) {
            if (!passed) {
                failures.add(name);
            }
        }
    }
}
