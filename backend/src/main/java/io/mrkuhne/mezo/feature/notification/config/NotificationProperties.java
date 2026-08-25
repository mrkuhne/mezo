package io.mrkuhne.mezo.feature.notification.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Push notification content tunables (bd mezo-h4wp.6.1). N2 extends this same record rather than
 * inventing a second one.
 *
 * @param bodyMaxChars notification body is truncated to this many chars before {@link
 *     io.mrkuhne.mezo.feature.notification.service.PushSender} encrypts and sends it
 * @param medicationTime the fixed HH:mm the {@code medication} category anchors on — medication
 *     has no per-day time column, only {@code MedicationCycleService}'s derived cycle day (spec §6)
 * @param decisionReviewTime the fixed HH:mm the {@code decision_review} category anchors on — a
 *     decision's review has no time of its own, only a due DATE (spec §5.4)
 * @param proseExcerptChars how much of an already-generated prose row (briefing/heartbeat/weekly/
 *     memoir) {@code AnchorResolver} excerpts into a push body — cut at a word boundary, never a
 *     new LLM call on the push path (spec §6)
 * @param dispatchCron N2's per-minute {@code NotificationDispatchJob} schedule
 * @param catchUpMinutes width (minutes) of {@code DueEvaluator}'s <b>backward</b> firing window — a
 *     half-open {@code [0, catchUpMinutes)} on {@code nowMinute - (anchorMinute - leadMinutes)}, so
 *     a genuinely missed cron minute still delivers the notification on the NEXT tick without
 *     double-sending (the push_log dedup, not this window, is what prevents a double-send)
 * @param proseGenerationGraceMin how many minutes past its content generator's own cron minute a
 *     prose category's anchor is pushed when the two would otherwise collide — see
 *     {@code AnchorResolver.anchorAfterGeneration}. Both jobs queue on the SAME size-1 scheduler
 *     thread and every generator makes an LLM call, so an anchor landing on the generator's minute
 *     provably finds no row and the category never fires at all.
 * @param quietHours the do-not-disturb window (W5.2, bd mezo-b3pp.19) — today only the
 *     {@code intervention} category consults it (see {@link QuietHours}); widening it to every
 *     category is a later, deliberate decision, not a drive-by.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.notification")
public record NotificationProperties(
        @Min(20) @Max(2000) int bodyMaxChars,
        @NotBlank @Pattern(regexp = "([01]\\d|2[0-3]):[0-5]\\d") String medicationTime,
        @NotBlank @Pattern(regexp = "([01]\\d|2[0-3]):[0-5]\\d") String decisionReviewTime,
        @Min(20) @Max(2000) int proseExcerptChars,
        @NotBlank String dispatchCron,
        @Min(1) @Max(60) int catchUpMinutes,
        @Min(0) @Max(240) int proseGenerationGraceMin,
        @NotNull @Valid QuietHours quietHours) {

    /** The do-not-disturb window (W5.2, bd mezo-b3pp.19). Wraps midnight when start > end
     *  (the 22:00→07:00 default). start == end means "no quiet hours". */
    public record QuietHours(
            @NotBlank @Pattern(regexp = "([01]\\d|2[0-3]):[0-5]\\d") String start,
            @NotBlank @Pattern(regexp = "([01]\\d|2[0-3]):[0-5]\\d") String end) {}
}
