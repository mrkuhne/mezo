package io.mrkuhne.mezo.feature.notification.domain;

/**
 * One category's effective notification preference (bd mezo-h4wp.6.2) — either a stored
 * {@code notification_pref} row, or the category's code default when no row exists yet. Kept
 * distinct from the generated {@code NotificationPref} DTO so the service layer never depends
 * on the wire contract; {@code NotificationController} maps between the two.
 */
public record CategoryPref(NotificationCategory category, boolean enabled, int leadMinutes) {}
