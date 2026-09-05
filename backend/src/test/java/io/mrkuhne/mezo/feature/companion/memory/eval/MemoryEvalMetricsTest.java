package io.mrkuhne.mezo.feature.companion.memory.eval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalCorpus.EvalQuery;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalMetrics.EvalOutcome;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MemoryEvalMetricsTest {

    @Test
    void testEvaluate_shouldCalculateGradedRankingMetrics_whenMultipleGoldItemsExist() {
        EvalQuery query = query("q1", Map.of("a", 2, "b", 1), false);
        EvalOutcome outcome = outcome("q1", List.of("b", "x", "a"), List.of("b", "x"));

        MemoryEvalMetrics.EvalMetrics metrics = MemoryEvalMetrics.evaluate(List.of(query), List.of(outcome));

        // DCG = 1/log2(2) + 3/log2(4) = 2.5; IDCG = 3 + 1/log2(3).
        double expectedNdcg = 2.5 / (3.0 + 1.0 / log2(3.0));
        assertThat(metrics.recallAt5()).isCloseTo(1.0, within(1e-9));
        assertThat(metrics.ndcgAt5()).isCloseTo(expectedNdcg, within(1e-9));
        assertThat(metrics.mrr()).isCloseTo(1.0 / 3.0, within(1e-9));
        assertThat(metrics.contextPrecision()).isCloseTo(0.5, within(1e-9));
    }

    @Test
    void testEvaluate_shouldScoreRequiredItemAsMissing_whenOnlySupportingItemIsRetrieved() {
        EvalQuery query = query("q1", Map.of("required", 2, "support", 1), false);
        EvalOutcome outcome = outcome("q1", List.of("support"), List.of("support"));

        MemoryEvalMetrics.EvalMetrics metrics = MemoryEvalMetrics.evaluate(List.of(query), List.of(outcome));

        assertThat(metrics.recallAt5()).isCloseTo(0.5, within(1e-9));
        assertThat(metrics.ndcgAt5()).isCloseTo(1.0 / (3.0 + 1.0 / log2(3.0)), within(1e-9));
        assertThat(metrics.mrr()).isZero();
        assertThat(metrics.contextPrecision()).isCloseTo(1.0, within(1e-9));
    }

    @Test
    void testEvaluate_shouldReturnZeroRankingMetrics_whenSelectionIsEmpty() {
        EvalQuery query = query("q1", Map.of("required", 2), false);

        MemoryEvalMetrics.EvalMetrics metrics = MemoryEvalMetrics.evaluate(
                List.of(query), List.of(outcome("q1", List.of(), List.of())));

        assertThat(metrics.recallAt5()).isZero();
        assertThat(metrics.ndcgAt5()).isZero();
        assertThat(metrics.mrr()).isZero();
        assertThat(metrics.contextPrecision()).isZero();
    }

    @Test
    void testEvaluate_shouldCalculateEmptyFalsePositiveRate_andCountOwnershipLeaks() {
        List<EvalQuery> queries = List.of(
                query("empty-hit", Map.of(), true),
                query("empty-clean", Map.of(), true));
        List<EvalOutcome> outcomes = List.of(
                new EvalOutcome("empty-hit", List.of("foreign"), List.of("foreign"), 1),
                new EvalOutcome("empty-clean", List.of(), List.of(), 0));

        MemoryEvalMetrics.EvalMetrics metrics = MemoryEvalMetrics.evaluate(queries, outcomes);

        assertThat(metrics.emptyFalsePositiveRate()).isCloseTo(0.5, within(1e-9));
        assertThat(metrics.ownershipLeaks()).isEqualTo(1);
    }

    @Test
    void testEvaluate_shouldMacroAveragePerQueryMetrics() {
        List<EvalQuery> queries = List.of(
                query("perfect", Map.of("a", 2), false),
                query("miss", Map.of("b", 2), false));
        List<EvalOutcome> outcomes = List.of(
                outcome("perfect", List.of("a"), List.of("a")),
                outcome("miss", List.of(), List.of()));

        MemoryEvalMetrics.EvalMetrics metrics = MemoryEvalMetrics.evaluate(queries, outcomes);

        assertThat(metrics.recallAt5()).isCloseTo(0.5, within(1e-9));
        assertThat(metrics.ndcgAt5()).isCloseTo(0.5, within(1e-9));
        assertThat(metrics.mrr()).isCloseTo(0.5, within(1e-9));
        assertThat(metrics.contextPrecision()).isCloseTo(0.5, within(1e-9));
    }

    @Test
    void testEvaluate_shouldUseFirstUsefulItemForMrr_whenNoRequiredItemExists() {
        EvalQuery query = query("q1", Map.of("support", 1), false);

        MemoryEvalMetrics.EvalMetrics metrics = MemoryEvalMetrics.evaluate(
                List.of(query), List.of(outcome("q1", List.of("noise", "support"), List.of("support"))));

        assertThat(metrics.mrr()).isCloseTo(0.5, within(1e-9));
    }

    @Test
    void testEvaluate_shouldRejectDuplicateRankedOrSelectedSourceKeys() {
        EvalQuery query = query("q1", Map.of("a", 2), false);

        assertThatThrownBy(() -> MemoryEvalMetrics.evaluate(
                List.of(query), List.of(outcome("q1", List.of("a", "a"), List.of("a")))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> MemoryEvalMetrics.evaluate(
                List.of(query), List.of(outcome("q1", List.of("a"), List.of("a", "a")))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void testEvaluate_shouldRejectDuplicateOutcomeIds() {
        EvalQuery query = query("q1", Map.of("a", 2), false);

        assertThatThrownBy(() -> MemoryEvalMetrics.evaluate(
                List.of(query),
                List.of(
                        outcome("q1", List.of("a"), List.of("a")),
                        outcome("q1", List.of(), List.of()))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void testValidateApprovedReview_shouldRejectEveryUnboundOrMissingHumanField() {
        EvalQuery query = query("q1", Map.of("a", 2), false);
        MemoryEvalCorpus artifact = new MemoryEvalCorpus(
                "memory-hu-v1", 20260904L, "holdout", List.of(), List.of(query));
        EvalQuery alteredQuery = new EvalQuery(
                "q1", "rich", "scenario", "paraphrase", "Más kérdés", List.of(),
                Map.of("a", 2), false);
        MemoryEvalCorpus other = new MemoryEvalCorpus(
                "memory-hu-v1", 20260904L, "holdout", List.of(), List.of(alteredQuery));
        LocalDate reviewedAt = LocalDate.of(2026, 9, 5);
        MemoryEvalCorpus.ReviewMetadata valid = review("Daniel", reviewedAt, 1, "sha", "approved");

        assertThat(SyntheticMemoryCorpusGenerator.validateApprovedReview(
                artifact, artifact, "sha", valid)).isEqualTo(valid);
        assertReviewRejected(other, artifact, review("Daniel", reviewedAt, 1, "sha", "approved"));
        assertReviewRejected(artifact, artifact, review("Daniel", reviewedAt, 1, "wrong", "approved"));
        assertReviewRejected(artifact, artifact, review("Daniel", reviewedAt, 0, "sha", "approved"));
        assertReviewRejected(artifact, artifact, new MemoryEvalCorpus.ReviewMetadata(
                "other", 20260904L, "Daniel", reviewedAt, 1, "sha", "approved"));
        assertReviewRejected(artifact, artifact, new MemoryEvalCorpus.ReviewMetadata(
                "memory-hu-v1", 1L, "Daniel", reviewedAt, 1, "sha", "approved"));
        assertReviewRejected(artifact, artifact, review("Daniel", reviewedAt, 1, "sha", "pending"));
        assertReviewRejected(artifact, artifact, review(" ", reviewedAt, 1, "sha", "approved"));
        assertReviewRejected(artifact, artifact, review("Daniel", null, 1, "sha", "approved"));
    }

    private static void assertReviewRejected(
            MemoryEvalCorpus supplied, MemoryEvalCorpus artifact,
            MemoryEvalCorpus.ReviewMetadata review) {
        assertThatThrownBy(() -> SyntheticMemoryCorpusGenerator.validateApprovedReview(
                supplied, artifact, "sha", review))
                .isInstanceOf(IllegalStateException.class);
    }

    private static MemoryEvalCorpus.ReviewMetadata review(
            String reviewer, LocalDate reviewedAt, int count, String sha, String status) {
        return new MemoryEvalCorpus.ReviewMetadata(
                "memory-hu-v1", 20260904L, reviewer, reviewedAt, count, sha, status);
    }

    private static EvalQuery query(String id, Map<String, Integer> relevance, boolean expectsEmpty) {
        return new EvalQuery(id, "rich", "scenario", "paraphrase", "Kérdés", List.of(),
                relevance, expectsEmpty);
    }

    private static EvalOutcome outcome(String id, List<String> ranked, List<String> selected) {
        return new EvalOutcome(id, ranked, selected, 0);
    }

    private static double log2(double value) {
        return Math.log(value) / Math.log(2.0);
    }
}
