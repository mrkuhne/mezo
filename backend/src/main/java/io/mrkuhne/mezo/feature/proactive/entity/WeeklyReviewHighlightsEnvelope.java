package io.mrkuhne.mezo.feature.proactive.entity;

import java.util.List;

/**
 * Typed jsonb envelope for {@code weekly_review.highlights} (the {@code MemoirAnchorsEnvelope}
 * precedent, spec §5, mezo-p2tr): refs the model SELECTED by index from code-collected
 * candidates — never invented. {@code kind} is one of {@code Pattern|Fact|LifeEvent|Memory}.
 */
public record WeeklyReviewHighlightsEnvelope(List<Highlight> highlights) {

    public record Highlight(String kind, String label) {
    }
}
