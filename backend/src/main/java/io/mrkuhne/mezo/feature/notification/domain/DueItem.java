package io.mrkuhne.mezo.feature.notification.domain;

/**
 * One notification decided to be due right now (bd mezo-h4wp.6.2) — the output of
 * {@code DueEvaluator#due}. {@code dedupKey} is built from the category key and the
 * <strong>anchor</strong> time, not the fire time, so changing a category's configured lead does
 * not mint a new key and re-fire a notification already sent today for the same anchor; a later
 * task consults {@code push_log} by this key to prevent a double-send within the catch-up window.
 *
 * @param minuteOfDay the anchor's minute-of-day (0-1439) that produced this item — the same value
 *                     embedded in {@code dedupKey}, not the (lead-adjusted) fire minute
 */
public record DueItem(NotificationCategory category, int minuteOfDay, String dedupKey,
                       String title, String body, String url) {}
