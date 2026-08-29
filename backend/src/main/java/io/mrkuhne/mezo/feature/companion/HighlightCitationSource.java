package io.mrkuhne.mezo.feature.companion;

import java.util.Map;
import java.util.UUID;

/**
 * Port for the weekly review's highlight feedback (mezo-d20.7.7, handoff §6.4/B): every Monday the
 * weekly generator names which pattern / fact / life event / memory the week was actually built on
 * and persists that as {@code weekly_review.highlights}. This port hands companion the ONE thing it
 * can honestly do with that: a count of how many recent weeks cited a given entity.
 *
 * <p><b>What a citation is worth.</b> A highlight is the model's own selection out of a list the
 * CODE collected — it is evidence that the companion found the thing useful, not a measurement of
 * the thing. So it is deliberately kept as a SEPARATE, visible signal and never folded into a
 * number that means something else:
 * <ul>
 *   <li>{@code PatternEntity.confidence} is a statistic (Pearson r/n/p, or the V3.2 four-factor
 *       critique score) and stays untouched; a citation cannot promote a pattern, move its status,
 *       or fill a confidence the data does not support. It is rendered beside the statistic.</li>
 *   <li>{@code KnowledgeFactEntity.reinforcementCount} means "the user re-stated/re-confirmed
 *       this"; the model quoting its own knowledge is NOT that, so it is not widened to cover
 *       citations — the same call {@code WeeklyLessonService} made for weekly duplicates
 *       (mezo-d20.7.6). Citations act only as a TIE-BREAKER under reinforcement when the top-N
 *       prompt slots are contested.</li>
 * </ul>
 *
 * <p><b>Derived, never accumulated.</b> The count is computed on read from the live (non
 * soft-deleted) {@code weekly_review} rows in a trailing window. That is what makes the two hard
 * requirements structural rather than defended by code: a {@code regenerate} soft-deletes the old
 * row and writes a new one for the same week, so the week keeps contributing exactly once, and a
 * soft-deleted review stops contributing the moment it is deleted — no ledger to reconcile, no
 * unexplainable bump left behind.
 *
 * <p>Bean exists only when both the companion and proactive switches are on; consume via
 * {@code ObjectProvider} — an absent bean means the signal is not measurable, which surfaces as
 * {@code null}, never as a stand-in zero. The dependency stays proactive → companion, never back
 * ({@code WeekReviewSource} precedent, {@code ArchitectureTest#feature_slices_are_cycle_free}).
 */
public interface HighlightCitationSource {

    /** {@code weekly_review.highlights[].kind} for a pattern citation. */
    String KIND_PATTERN = "Pattern";

    /** {@code weekly_review.highlights[].kind} for a knowledge-fact citation. */
    String KIND_FACT = "Fact";

    /**
     * How many of the trailing window's live weekly reviews cited each entity of {@code kind},
     * keyed by the cited entity's id. Entities never cited are simply absent from the map (the
     * caller reads that as 0); a highlight whose ref is unknown or whose target no longer exists
     * contributes nothing.
     */
    Map<UUID, Integer> citedWeeks(UUID userId, String kind);
}
