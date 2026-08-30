package io.mrkuhne.mezo.feature.proactive.entity;

import java.util.List;
import java.util.UUID;

/**
 * Typed jsonb envelope for {@code weekly_review.highlights} (the {@code MemoirAnchorsEnvelope}
 * precedent, spec §5, mezo-p2tr): refs the model SELECTED by index from code-collected
 * candidates — never invented. {@code kind} is one of {@code Pattern|Fact|LifeEvent|Memory}.
 *
 * <p>{@code refId} (mezo-d20.7.7) is the id of the entity the candidate was collected FROM — the
 * pattern / knowledge fact / life-event node / memoir row — so a citation can be counted against
 * the thing itself instead of against a display label. It is NULLABLE on purpose:
 * <ul>
 *   <li>rows written before mezo-d20.7.7 have none, and matching them back by label would be a
 *       guess (the Fact label is a truncated {@code factText}, a Pattern title can be re-worded)
 *       — an unknown ref stays unknown and simply carries no citation, never a fuzzy match;</li>
 *   <li>a ref is a LOOSE reference, not an FK: the target may be soft-deleted later, and a
 *       citation of something that no longer exists resolves to nothing rather than failing.</li>
 * </ul>
 */
public record WeeklyReviewHighlightsEnvelope(List<Highlight> highlights) {

    public record Highlight(String kind, String label, UUID refId) {

        /** Kind constants — mirrored by {@code HighlightCitationSource} and the FE RefTag kinds. */
        public static final String KIND_PATTERN = "Pattern";
        public static final String KIND_FACT = "Fact";
        public static final String KIND_LIFE_EVENT = "LifeEvent";
        public static final String KIND_MEMORY = "Memory";
    }
}
