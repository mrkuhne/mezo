package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.HighlightCitationSource;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewEntity;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewHighlightsEnvelope.Highlight;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklyReviewRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Proactive side of {@link HighlightCitationSource} (mezo-d20.7.7) — the ONE consumer of
 * {@code weekly_review.highlights} beyond rendering them as the "amire épült" chips.
 *
 * <p><b>Derived, not accumulated — the whole design in one sentence:</b> the count is a fold over
 * the live weekly-review rows of the trailing window, computed on read. Everything the slice had
 * to guarantee falls out of that rather than being defended by code:
 * <ul>
 *   <li><b>idempotence over regenerate</b> — {@code WeeklyReviewService.regenerate} soft-deletes
 *       the week's row and writes a new one; the week is counted once because there is only ever
 *       one LIVE row per week (the partial unique index), whatever happened before;</li>
 *   <li><b>reversibility</b> — a soft-deleted review stops contributing the instant it is deleted;
 *       a ledger would have to be walked back, and a ledger row that outlived its review would be
 *       exactly the "unexplainable bump" the design forbids;</li>
 *   <li><b>honesty</b> — the number is not a stored opinion about a pattern, it is a restatement
 *       of what the live reviews literally say. Nothing can drift out of sync with them.</li>
 * </ul>
 * The cost of not materialising is one bounded read (≤ {@code citation-window-weeks} narrow rows)
 * per call — cheaper than the score recomputation the same page already does.
 *
 * <p>A ref that is null (rows written before this slice) or points at something soft-deleted since
 * simply finds no match in the caller's entity list and drops out — a citation of a vanished fact
 * is not an error, and the Monday round never touches this path at all.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class HighlightCitationSourceAdapter implements HighlightCitationSource {

    private final WeeklyReviewRepository weeklyReviewRepository;
    private final ProactiveProperties properties;

    @Override
    public Map<UUID, Integer> citedWeeks(UUID userId, String kind) {
        LocalDate from = LocalDate.now()
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .minusWeeks(properties.weeklyReview().citationWindowWeeks());
        Map<UUID, Integer> counts = new HashMap<>();
        for (WeeklyReviewEntity review : weeklyReviewRepository
                .findByCreatedByAndWeekStartGreaterThanEqual(userId, from)) {
            if (review.getHighlights() == null || review.getHighlights().highlights() == null) {
                continue;
            }
            // WEEKS, not mentions: one week's review can list the same pattern twice (a confirmed
            // AND a reinforced event in the same week are two candidates over one pattern), and
            // "the model said it twice in one paragraph" is not a second week of evidence.
            Set<UUID> citedThisWeek = new HashSet<>();
            for (Highlight highlight : review.getHighlights().highlights()) {
                if (highlight == null || highlight.refId() == null || !kind.equals(highlight.kind())) {
                    continue;
                }
                citedThisWeek.add(highlight.refId());
            }
            citedThisWeek.forEach(refId -> counts.merge(refId, 1, Integer::sum));
        }
        return counts;
    }
}
