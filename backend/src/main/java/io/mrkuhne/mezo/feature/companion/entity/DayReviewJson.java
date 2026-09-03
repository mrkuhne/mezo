package io.mrkuhne.mezo.feature.companion.entity;

import java.util.List;
import java.util.Map;

/**
 * Typed envelope for the {@code day_review.envelope} jsonb column (mezo-jcpt.4) — the day's
 * LLM prose layer. Mapped via {@code @JdbcTypeCode(SqlTypes.JSON)} on {@link DayReviewEntity}
 * (the {@code MealBreakdownJson} precedent).
 *
 * <p><b>A nap LLM-rétege — cache, nem igazság:</b> the deterministic 6-dimension score
 * ({@code DayEvaluationEngine} / {@code DayScoreService}) is the source of truth; this record is
 * a lazily-computed, lazily-cached narrative over that day's numbers. {@link DayReviewEntity
 * #getInputsHash()} says whether the cached prose still matches the day's current deterministic
 * inputs — a hash mismatch means the row is stale, not that it is wrong to have stored.
 *
 * @param context a POINT-IN-TIME SNAPSHOT of the unscored signals the LLM was shown when this
 *     envelope was generated — kept so a cached narrative can be read back against the facts that
 *     produced it. It is <b>NOT</b> the source the API response serves: {@code DayReviewService}
 *     recomputes the signals deterministically on EVERY read (they are deliberately outside the
 *     {@code inputsHash}, so a cache hit must never resurrect a stale weight trend or energy
 *     value). Do not "fix" the response to read this field instead — that would serve yesterday's
 *     numbers under today's narrative.
 */
public record DayReviewJson(
    List<String> narrative,
    Map<String, String> dimensionNotes,
    List<Highlight> highlights,
    Adjustment adjustment,
    List<ContextSignal> context
) {

    /** One of up to 3 highlights. {@code kind}: {@code key|pattern|win}. */
    public record Highlight(String kind, String label) {
    }

    /** The AI's proposed score nudge — clamp {@code delta ∈ [-5, +5]} is enforced upstream. */
    public record Adjustment(int delta, String reason) {
    }

    /** One unscored, deterministically-filled context fact. */
    public record ContextSignal(String label, String value) {
    }
}
