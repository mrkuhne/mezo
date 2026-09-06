package io.mrkuhne.mezo.feature.proactive.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Once-ever question tuning (round 2 S5, bd mezo-d58h.7.5, spec 2026-09-05 §c) — every threshold is
 * config, never code. Own record rather than another field on {@code SetupCheckProperties}:
 * questions are a different genre (asked once, ever; no re-emit window at all), and the
 * {@code FlagProperties}/{@code SetupCheckProperties} precedent is one record per genre.
 *
 * <p>There is deliberately NO cron and NO re-emit window here. The pass rides {@code SetupCheckJob}'s
 * existing schedule (the spec forbids a new cron near the dawn cluster), and "once ever" is enforced
 * by the envelope-key dedupe in {@code OneTimeQuestionService}, not by a window a config edit could
 * re-open.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.proactive.questions")
public record QuestionProperties(

    @NotNull @Valid FeatureAbandonment featureAbandonment,

    @NotNull @Valid FlatFeedback flatFeedback
) {

    public record FeatureAbandonment(
        /** Nothing new in the family for this many days ⇒ the family reads as shelved. */
        @Min(7) @Max(365) int idleDays,
        /** Honesty gate: fewer rows than this EVER means "never really used" — silence, because an
         *  empty table is not abandonment (spec §(17)). */
        @Min(1) @Max(1000) int minPriorRows
    ) {
    }

    public record FlatFeedback(
        /** How many of the most recent feedback-carrying workouts must be identical. */
        @Min(3) @Max(50) int windowWorkouts,
        /** Read cap for the newest-first debrief scan. Single-user volumes (spec §12): the whole
         *  window is grouped in memory, and the OLDEST workout inside the cap is dropped because the
         *  cap may have cut it in half. */
        @Min(50) @Max(2000) int maxFeedbackRows
    ) {
    }
}
