package io.mrkuhne.mezo.feature.notification.domain;

import java.util.List;

/**
 * Everything {@code DueEvaluator} needs, already read (bd mezo-h4wp.6.2). {@code null}/empty
 * means "unavailable" — a missing prose row or an absent ritual configuration yields no anchor
 * for that category, never a fabricated one.
 *
 * @param backendAnchors  gym, ritual, lights_out, wind_down, medication, decision_review,
 *                        intervention (companion_message kind=intervention, mezo-b3pp.19)
 *                        + the feed-anchored categories (app_notification rows, mezo-gzhp.3)
 * @param proseAnchors    briefing, midday, evening, sleep_reaction, weight_reaction, weekly,
 *                        memoir — only when the content row EXISTS
 * @param scheduleAnchors checkin, fuel_slot — from {@code notification_schedule}
 */
public record AnchorSet(
        List<AnchoredEvent> backendAnchors,
        List<AnchoredEvent> proseAnchors,
        List<AnchoredEvent> scheduleAnchors) {

    /**
     * One resolved anchor for a category on a given day.
     *
     * @param minuteOfDay the raw anchor time (e.g. a 17:30 gym slot) — NOT lead-adjusted;
     *                     {@code DueEvaluator} subtracts the category's configured lead to compute
     *                     the fire minute
     * @param dedupSuffix  the anchor's stable identity for the day (conventionally its
     *                     {@code HH:mm}), concatenated onto the category key by
     *                     {@code DueEvaluator} to build {@link DueItem#dedupKey()}. 8 categories use
     *                     a different shape, {@code "HH:mm:{id8}"} (the anchor minute plus a source
     *                     row's id, first 8 hex chars): the 6 feed-anchored categories (mezo-gzhp.3)
     *                     key off the {@code app_notification} row's id — the bare {@code HH:mm}
     *                     form would collapse two same-family events wake-deferred onto the same
     *                     minute into one push (see {@code AnchorResolver.feedAnchors});
     *                     {@code decision_review} (mezo-b3pp.4) keys off the {@code decision_entry}
     *                     row's id for the same reason at a fixed anchor instead of a wake-deferred
     *                     one — two decisions can share a {@code review_due} day and therefore the
     *                     same fixed anchor minute (see {@code AnchorResolver.decisionReviewAnchors});
     *                     and {@code intervention} (mezo-b3pp.19) keys off the {@code companion_message}
     *                     row's id for the same reason again — a quiet-hours-deferred card generated
     *                     YESTERDAY can land on the SAME target day and minute as today's own card
     *                     (see {@code AnchorResolver.interventionAnchors}), so the id form is
     *                     load-bearing, not cosmetic, even though one card/day makes it collision-free
     *                     within a single day today.
     */
    public record AnchoredEvent(NotificationCategory category, int minuteOfDay,
                                 String dedupSuffix, String title, String body, String url) {}
}
