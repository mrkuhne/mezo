package io.mrkuhne.mezo.feature.notification.domain;

import java.util.List;

/**
 * Everything {@code DueEvaluator} needs, already read (bd mezo-h4wp.6.2). {@code null}/empty
 * means "unavailable" — a missing prose row or an absent ritual configuration yields no anchor
 * for that category, never a fabricated one.
 *
 * @param backendAnchors  gym, ritual, lights_out, wind_down, medication
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
     *                     {@code DueEvaluator} to build {@link DueItem#dedupKey()}
     */
    public record AnchoredEvent(NotificationCategory category, int minuteOfDay,
                                 String dedupSuffix, String title, String body, String url) {}
}
