package io.mrkuhne.mezo.feature.admin.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminMemoryCandidate;
import io.mrkuhne.mezo.api.dto.AdminMemoryRetrieverTrace;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalResultEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.ScoreBreakdownEnvelope;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * mezo-4qyt: the derived {@code fusionRank}/{@code rerankDelta} contract. The fixtures'
 * stored {@code rank} order deliberately differs from their {@code finalScore} order, which is
 * exactly the situation a reranked run produces.
 */
class AdminMemoryRunMapperTest {

    private final AdminMemoryRunMapper mapper = new AdminMemoryRunMapper();

    @Test
    void testCandidates_shouldDeriveFusionRankFromFinalScore_whenStoredRankDiffers() {
        // finalScore order: e(0.9) > b(0.8) > d(0.7) > a(0.6) > c(0.5)
        List<MemoryRetrievalResultEntity> rows = List.of(
                row(1, 0.6, 0.5, "a"),
                row(2, 0.8, 0.5, "b"),
                row(3, 0.5, 0.5, "c"),
                row(4, 0.7, 0.5, "d"),
                row(5, 0.9, 0.5, "e"));

        List<AdminMemoryCandidate> mapped = mapper.candidates(rows);

        assertThat(mapped).extracting(AdminMemoryCandidate::getRank)
                .containsExactly(1, 2, 3, 4, 5);
        assertThat(mapped).extracting(AdminMemoryCandidate::getFusionRank)
                .containsExactly(4, 2, 5, 3, 1);
        // rerankDelta = fusionRank - rank
        assertThat(mapped).extracting(AdminMemoryCandidate::getRerankDelta)
                .containsExactly(3, 0, 2, -1, -4);
    }

    @Test
    void testCandidates_shouldLeaveRerankDeltaNull_whenNoCandidateCarriesARerankerScore() {
        List<MemoryRetrievalResultEntity> rows = List.of(
                rowWithoutRerankerScore(1, 0.6, "a"),
                rowWithoutRerankerScore(2, 0.8, "b"));

        List<AdminMemoryCandidate> mapped = mapper.candidates(rows);

        assertThat(mapped).extracting(AdminMemoryCandidate::getRerankDelta)
                .containsOnlyNulls();
        // fusionRank is still real: it is derived, not conditional on a rerank having happened.
        assertThat(mapped).extracting(AdminMemoryCandidate::getFusionRank).containsExactly(2, 1);
    }

    @Test
    void testCandidates_shouldBreakFinalScoreTiesByOccurredOnThenRefId_whenScoresAreEqual() {
        UUID lower = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID higher = UUID.fromString("00000000-0000-0000-0000-000000000002");
        MemoryRetrievalResultEntity older = row(1, 0.5, 0.5, "older");
        older.setOccurredOn(LocalDate.of(2026, 1, 1));
        older.setCandidateRefId(higher);
        MemoryRetrievalResultEntity newer = row(2, 0.5, 0.5, "newer");
        newer.setOccurredOn(LocalDate.of(2026, 6, 1));
        newer.setCandidateRefId(lower);

        List<AdminMemoryCandidate> mapped = mapper.candidates(List.of(older, newer));

        // occurredOn desc wins before the refId tiebreak: the NEWER row takes fusion rank 1.
        assertThat(mapped.get(0).getFusionRank()).isEqualTo(2);
        assertThat(mapped.get(1).getFusionRank()).isEqualTo(1);
    }

    @Test
    void testScoreBreakdown_shouldKeepAnAbsentRetrieverKeyAbsent_whenARetrieverMissedTheCandidate() {
        // "the retriever did not return this candidate" and "it ranked it 0th" are different facts.
        ScoreBreakdownEnvelope envelope = new ScoreBreakdownEnvelope(
                Map.of("dense", 1, "lexical", 3), 0.03, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.7);

        Map<String, Integer> ranks = mapper.scoreBreakdown(envelope).getRetrieverRanks();

        assertThat(ranks).containsOnlyKeys("dense", "lexical");
        assertThat(ranks).doesNotContainKey("graph");
    }

    @Test
    void testTrace_shouldSortByRetrieverNameAndCarryErrors_whenTraceHasMixedEntries() {
        Map<String, Object> trace = new LinkedHashMap<>();
        trace.put("lexical", Map.of("durationMs", 7, "candidateCount", 2));
        trace.put("dense", Map.of("durationMs", 12, "candidateCount", 0, "error", "TIMEOUT"));
        // A legacy scalar entry is not a retriever and must not be rendered as one.
        trace.put("denseCandidates", 1);

        List<AdminMemoryRetrieverTrace> mapped = mapper.trace(trace);

        assertThat(mapped).extracting(AdminMemoryRetrieverTrace::getRetriever)
                .containsExactly("dense", "lexical");
        assertThat(mapped.get(0).getError()).isEqualTo("TIMEOUT");
        assertThat(mapped.get(0).getDurationMs()).isEqualTo(12L);
        assertThat(mapped.get(1).getCandidateCount()).isEqualTo(2);
        assertThat(mapped.get(1).getError()).isNull();
    }

    private static MemoryRetrievalResultEntity row(
            int rank, double finalScore, double rerankerScore, String content) {
        MemoryRetrievalResultEntity entity = base(rank, content);
        entity.setScoreBreakdown(new ScoreBreakdownEnvelope(
                Map.of("dense", rank), 0.02, 0.0, 0.0, 0.0, 0.0, 0.0, rerankerScore, finalScore));
        return entity;
    }

    private static MemoryRetrievalResultEntity rowWithoutRerankerScore(
            int rank, double finalScore, String content) {
        MemoryRetrievalResultEntity entity = base(rank, content);
        entity.setScoreBreakdown(new ScoreBreakdownEnvelope(
                Map.of("dense", rank), 0.02, 0.0, 0.0, 0.0, 0.0, 0.0, null, finalScore));
        return entity;
    }

    private static MemoryRetrievalResultEntity base(int rank, String content) {
        MemoryRetrievalResultEntity entity = new MemoryRetrievalResultEntity();
        entity.setId(UUID.randomUUID());
        entity.setRunId(UUID.randomUUID());
        entity.setCandidateKind("memory_item");
        entity.setCandidateRefId(UUID.randomUUID());
        entity.setRank(rank);
        entity.setSelected(rank <= 2);
        entity.setContentSnapshot(content);
        return entity;
    }
}
