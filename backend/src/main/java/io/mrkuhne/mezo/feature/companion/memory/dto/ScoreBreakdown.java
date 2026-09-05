package io.mrkuhne.mezo.feature.companion.memory.dto;

/** Explainable deterministic components of one fused retrieval score. */
public record ScoreBreakdown(
        double rrf,
        double temporal,
        double salience,
        double sourceReliability,
        double pinned,
        double recency,
        double finalScore) {
}
