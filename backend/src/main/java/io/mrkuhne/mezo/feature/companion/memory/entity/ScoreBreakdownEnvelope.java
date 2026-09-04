package io.mrkuhne.mezo.feature.companion.memory.entity;

import java.util.Map;

/** Explainable persisted components of one fused retrieval score. */
public record ScoreBreakdownEnvelope(
        Map<String, Integer> retrieverRanks,
        Double rrf,
        Double pinnedBoost,
        Double sourceReliabilityBoost,
        Double temporalBoost,
        Double salienceBoost,
        Double recencyBoost,
        Double rerankerScore,
        Double finalScore) {

    public static ScoreBreakdownEnvelope empty() {
        return new ScoreBreakdownEnvelope(Map.of(), 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0);
    }
}
