package io.mrkuhne.mezo.feature.companion.feedback.entity;

import java.util.Map;

/**
 * Typed jsonb envelope for {@code feedback_rollup.stats} (Phase 5 W4.2, bd mezo-b3pp.16, spec
 * §4.4) — the {@code PatternEventPayloadEnvelope} precedent: one record, all-nullable fields,
 * a static factory per shape. {@code surface:<kind>}/{@code feed:<kind>} rows fill
 * {@code up/down/total}; the single {@code style} row fills {@code bySurface} (a per-artifact-kind
 * down-reason histogram) and leaves the counts null.
 */
public record FeedbackRollupStatsEnvelope(
    Integer up, Integer down, Integer total,
    Map<String, ReasonHistogram> bySurface
) {

    public record ReasonHistogram(int inaccurate, int tooMuch, int badTiming, int notAboutMe) {
    }

    public static FeedbackRollupStatsEnvelope effectiveness(int up, int down) {
        return new FeedbackRollupStatsEnvelope(up, down, up + down, null);
    }

    public static FeedbackRollupStatsEnvelope style(Map<String, ReasonHistogram> bySurface) {
        return new FeedbackRollupStatsEnvelope(null, null, null, bySurface);
    }
}
