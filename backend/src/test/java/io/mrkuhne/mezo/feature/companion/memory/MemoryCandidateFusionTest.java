package io.mrkuhne.mezo.feature.companion.memory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.PreparedMemoryQuery;
import io.mrkuhne.mezo.feature.companion.memory.dto.QueryMode;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalServingMode;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryCandidateFusion;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class MemoryCandidateFusionTest {

    private static final LocalDate AS_OF = LocalDate.of(2026, 9, 5);

    private final MemoryCandidateFusion fusion = new MemoryCandidateFusion(properties());

    @Test
    void testFuse_shouldSumWeightedRrfAndDeduplicate_whenStableCandidateAppearsTwice() {
        UUID stableId = UUID.randomUUID();
        MemoryCandidate dense = candidate("dense", stableId, "Régi pontos emlék", AS_OF.minusDays(20), 0.9);
        MemoryCandidate lexical = candidate("lexical", stableId, "Régi pontos emlék", AS_OF.minusDays(20), 0.9);
        Map<String, List<MemoryCandidate>> ranked = new LinkedHashMap<>();
        ranked.put("dense", List.of(dense));
        ranked.put("lexical", List.of(candidate("lexical", UUID.randomUUID(), "Másik", AS_OF, 0.7), lexical));

        var fused = fusion.fuse(ranked, query(), AS_OF);

        double expected = 1.0 / 61.0 + 1.0 / 62.0;
        assertThat(fused).filteredOn(item -> item.candidate().stableId().equals(stableId)).hasSize(1);
        assertThat(fused.stream().filter(item -> item.candidate().stableId().equals(stableId)).findFirst().orElseThrow()
                .score().rrf()).isCloseTo(expected, within(1e-12));
        assertThat(fused.stream().filter(item -> item.candidate().stableId().equals(stableId)).findFirst().orElseThrow()
                .retrieverRanks()).containsEntry("dense", 1).containsEntry("lexical", 2);
    }

    @Test
    void testFuse_shouldUseStableDeterministicOrder_whenFinalScoresTie() {
        UUID lowestId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID highestId = UUID.fromString("00000000-0000-0000-0000-000000000002");
        MemoryCandidate older = candidate("dense", UUID.randomUUID(), "older", AS_OF.minusDays(4), 0.5);
        MemoryCandidate newerHighId = candidate("dense", highestId, "newer-b", AS_OF.minusDays(1), 0.5);
        MemoryCandidate newerLowId = candidate("dense", lowestId, "newer-a", AS_OF.minusDays(1), 0.5);

        var fused = fusion.fuse(Map.of(
                "dense", List.of(older),
                "lexical", List.of(newerHighId),
                "facts", List.of(newerLowId)), query(), AS_OF);

        assertThat(fused).extracting(item -> item.candidate().stableId())
                .containsExactly(lowestId, highestId, older.stableId());
    }

    @Test
    void testFuse_shouldKeepMateriallyStrongerOlderExactMatchAhead_whenRecentCandidateHasRecencyBoost() {
        UUID oldExactId = UUID.randomUUID();
        MemoryCandidate oldDense = candidate("dense", oldExactId, "maratoni alvás", AS_OF.minusDays(800), 1.0);
        MemoryCandidate oldLexical = candidate("lexical", oldExactId, "maratoni alvás", AS_OF.minusDays(800), 1.0);
        MemoryCandidate recent = candidate("facts", UUID.randomUUID(), "mai általános emlék", AS_OF, 0.5);

        var fused = fusion.fuse(Map.of(
                "dense", List.of(oldDense),
                "lexical", List.of(oldLexical),
                "facts", List.of(recent)), query(), AS_OF);

        assertThat(fused.getFirst().candidate().stableId()).isEqualTo(oldExactId);
        assertThat(fused.getFirst().score().recency()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"decision", "gratitude"})
    void testFuse_shouldApplyCanonicalStructuredSourceReliability_whenSourceKindIsProjected(String sourceKind) {
        MemoryCandidate candidate = candidate("dense", UUID.randomUUID(), "strukturalt emlek", AS_OF, 0.5,
                sourceKind);

        var fused = fusion.fuse(Map.of("dense", List.of(candidate)), query(), AS_OF);

        assertThat(fused.getFirst().score().sourceReliability()).isCloseTo(0.003, within(1e-12));
    }

    private static MemoryCandidate candidate(
            String retriever, UUID stableId, String content, LocalDate occurredOn, double salience) {
        return candidate(retriever, stableId, content, occurredOn, salience, "journal_entry");
    }

    private static MemoryCandidate candidate(
            String retriever, UUID stableId, String content, LocalDate occurredOn, double salience,
            String sourceKind) {
        return new MemoryCandidate(retriever, "memory_item", stableId, stableId, stableId,
                sourceKind, "Napló", content, occurredOn, 0.9, false, false, salience, null, null);
    }

    private static PreparedMemoryQuery query() {
        return new PreparedMemoryQuery(QueryMode.SELF_CONTAINED, "alvás", "alvás", Optional.empty(), Optional.empty());
    }

    static MemoryPlatformProperties properties() {
        return new MemoryPlatformProperties(
                "v1", "google", "model", 1, RetrievalServingMode.SHADOW,
                new MemoryPlatformProperties.Retrieval(30, 1200, 600),
                new MemoryPlatformProperties.Reembedding(false, "v1", 100, "0 10 4 * * *"),
                new MemoryPlatformProperties.Audit(30, "0 50 3 * * *"),
                new MemoryPlatformProperties.Fusion(
                        60, Map.of("dense", 1.0, "lexical", 1.0, "facts", 1.0, "graph", 1.0),
                        0.005, 0.004, 0.004, 0.002, 0.003),
                new MemoryPlatformProperties.Execution(200),
                new MemoryPlatformProperties.Reranker(false, 0.002, 20, 600, 200),
                new MemoryPlatformProperties.Indicators(365));
    }
}
