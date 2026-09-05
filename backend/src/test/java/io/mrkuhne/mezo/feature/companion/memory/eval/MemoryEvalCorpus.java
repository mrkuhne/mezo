package io.mrkuhne.mezo.feature.companion.memory.eval;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import java.time.LocalDate;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Immutable JSON shape shared by deterministic CI and the manual semantic release evaluation. */
public record MemoryEvalCorpus(
        String corpusVersion,
        long generatorSeed,
        String split,
        List<EvalSource> sources,
        List<EvalQuery> queries) {

    public MemoryEvalCorpus {
        sources = List.copyOf(sources);
        queries = List.copyOf(queries);
    }

    public record EvalPersona(String id, String displayName, String loggingStyle, String lifeContext) {
    }

    public record EvalSource(
            String key,
            String personaId,
            String scenarioId,
            String sourceKind,
            LocalDate occurredOn,
            String content,
            int vectorAxis,
            double salience,
            String state,
            boolean foreignDistractor) {
    }

    public record EvalQuery(
            String id,
            String personaId,
            String scenarioId,
            String family,
            String query,
            List<CompanionLlm.Turn> history,
            Map<String, Integer> relevanceBySourceKey,
            boolean expectsEmpty) {

        public EvalQuery {
            history = List.copyOf(history);
            relevanceBySourceKey = Collections.unmodifiableMap(new LinkedHashMap<>(relevanceBySourceKey));
        }
    }

    public record ReviewMetadata(
            String corpusVersion,
            long generatorSeed,
            String reviewedBy,
            LocalDate reviewedAt,
            int queryCount,
            String holdoutSha256,
            String status) {
    }
}
