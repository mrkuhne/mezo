package io.mrkuhne.mezo.feature.train.entity;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * The signature provenance envelope (design handoff §4): baseline -> adjustments ->
 * confidence -> optional user override. Persisted as a single jsonb column via
 * {@code @JdbcTypeCode(SqlTypes.JSON)}; Fuel reuses this pattern for meal score.
 */
public record ProvenanceEnvelope(
    Baseline baseline,
    List<Adjustment> adjustments,
    Double confidence,
    String note,
    UserOverride userOverride
) {
    public record Baseline(String name, Integer mev, Integer mav, Integer mrv) {}

    /** kind ∈ pattern | recovery | niggle | sport-cross; delta keys ∈ mev|mav|mrv. */
    public record Adjustment(String kind, String label, Map<String, Integer> delta, Boolean warning) {}

    public record UserOverride(Integer mev, Integer mav, Integer mrv, OffsetDateTime at) {}
}
