package io.mrkuhne.mezo.feature.proactive.entity;

import java.util.List;

/**
 * Typed jsonb envelope for {@code diagnosis.evidence} (mezo-hqfi, the
 * {@code WeeklyReviewHighlightsEnvelope} precedent): the code-collected candidate list, FROZEN at
 * generation time. It is persisted rather than recomputed on read, so a diagnosis always shows
 * the numbers it actually reasoned from — weeks later, a recomputed window would put different
 * values next to the same conclusion.
 *
 * <p>{@code kind} is one of {@code metric|pattern|fact|derived}. The metric-only fields
 * ({@code metricKey}, {@code value}, {@code baselineValue}, {@code delta}, {@code coverageDays})
 * are null for pattern, fact, and derived items. {@code derived} rows (mezo-85x5r §2) are
 * code-computed facts — {@link io.mrkuhne.mezo.feature.proactive.service.WeightDecomposition}'s
 * "számvetés" rows for the WEIGHT phenomenon — not a raw metric series.
 */
public record DiagnosisEvidenceEnvelope(List<EvidenceItem> items) {

    public record EvidenceItem(
            String kind,
            String label,
            String detail,
            String sourceHu,
            String metricKey,
            Double value,
            Double baselineValue,
            Double delta,
            Integer coverageDays) {
    }
}
