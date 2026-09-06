package io.mrkuhne.mezo.feature.companion.memory.eval;

import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalCorpus.EvalQuery;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

/** Pure retrieval metric calculator; all quality metrics are macro-averaged per eligible query. */
public final class MemoryEvalMetrics {

    private static final int RANKING_CUTOFF = 5;

    private MemoryEvalMetrics() {
    }

    public static EvalMetrics evaluate(List<EvalQuery> queries, List<EvalOutcome> outcomes) {
        Map<String, EvalOutcome> outcomesById = new HashMap<>();
        for (EvalOutcome outcome : outcomes) {
            if (outcomesById.put(outcome.queryId(), outcome) != null) {
                throw new IllegalArgumentException("Duplicate eval outcome: " + outcome.queryId());
            }
        }

        double recall = 0.0;
        double ndcg = 0.0;
        double mrr = 0.0;
        double precision = 0.0;
        int rankedQueries = 0;
        int emptyQueries = 0;
        int emptyFalsePositives = 0;
        int ownershipLeaks = 0;
        for (EvalQuery query : queries) {
            EvalOutcome outcome = outcomesById.get(query.id());
            if (outcome == null) {
                throw new IllegalArgumentException("Missing eval outcome: " + query.id());
            }
            ownershipLeaks += outcome.ownershipLeaks();
            if (query.expectsEmpty()) {
                emptyQueries++;
                if (!outcome.selectedSourceKeys().isEmpty()) {
                    emptyFalsePositives++;
                }
                continue;
            }
            rankedQueries++;
            recall += recallAt5(query, outcome);
            ndcg += ndcgAt5(query, outcome);
            mrr += reciprocalRank(query, outcome);
            precision += contextPrecision(query, outcome);
        }
        return new EvalMetrics(
                average(recall, rankedQueries),
                average(ndcg, rankedQueries),
                average(mrr, rankedQueries),
                average(precision, rankedQueries),
                average(emptyFalsePositives, emptyQueries),
                ownershipLeaks);
    }

    private static double recallAt5(EvalQuery query, EvalOutcome outcome) {
        long relevantCount = query.relevanceBySourceKey().values().stream().filter(grade -> grade > 0).count();
        if (relevantCount == 0) {
            return 0.0;
        }
        long hits = outcome.rankedSourceKeys().stream().limit(RANKING_CUTOFF)
                .filter(key -> query.relevanceBySourceKey().getOrDefault(key, 0) > 0)
                .distinct()
                .count();
        return (double) hits / relevantCount;
    }

    private static double ndcgAt5(EvalQuery query, EvalOutcome outcome) {
        double dcg = dcg(outcome.rankedSourceKeys().stream().limit(RANKING_CUTOFF)
                .map(key -> query.relevanceBySourceKey().getOrDefault(key, 0))
                .toList());
        double ideal = dcg(query.relevanceBySourceKey().values().stream()
                .sorted(java.util.Comparator.reverseOrder())
                .limit(RANKING_CUTOFF)
                .toList());
        return ideal == 0.0 ? 0.0 : dcg / ideal;
    }

    private static double dcg(List<Integer> grades) {
        double total = 0.0;
        for (int index = 0; index < grades.size(); index++) {
            total += (Math.pow(2.0, grades.get(index)) - 1.0) / log2(index + 2.0);
        }
        return total;
    }

    private static double reciprocalRank(EvalQuery query, EvalOutcome outcome) {
        boolean hasRequired = query.relevanceBySourceKey().containsValue(2);
        for (int index = 0; index < outcome.rankedSourceKeys().size(); index++) {
            int grade = query.relevanceBySourceKey().getOrDefault(outcome.rankedSourceKeys().get(index), 0);
            if (grade == 2 || (!hasRequired && grade > 0)) {
                return 1.0 / (index + 1.0);
            }
        }
        return 0.0;
    }

    private static double contextPrecision(EvalQuery query, EvalOutcome outcome) {
        if (outcome.selectedSourceKeys().isEmpty()) {
            return 0.0;
        }
        long relevant = outcome.selectedSourceKeys().stream()
                .filter(key -> query.relevanceBySourceKey().getOrDefault(key, 0) > 0)
                .count();
        return (double) relevant / outcome.selectedSourceKeys().size();
    }

    private static double average(double total, int count) {
        return count == 0 ? 0.0 : total / count;
    }

    private static double log2(double value) {
        return Math.log(value) / Math.log(2.0);
    }

    public record EvalOutcome(
            String queryId,
            List<String> rankedSourceKeys,
            List<String> selectedSourceKeys,
            int ownershipLeaks) {

        public EvalOutcome {
            rankedSourceKeys = List.copyOf(rankedSourceKeys);
            selectedSourceKeys = List.copyOf(selectedSourceKeys);
            if (new HashSet<>(rankedSourceKeys).size() != rankedSourceKeys.size()
                    || new HashSet<>(selectedSourceKeys).size() != selectedSourceKeys.size()) {
                throw new IllegalArgumentException("Eval outcomes cannot contain duplicate source keys");
            }
        }
    }

    public record EvalMetrics(
            double recallAt5,
            double ndcgAt5,
            double mrr,
            double contextPrecision,
            double emptyFalsePositiveRate,
            int ownershipLeaks) {
    }
}
