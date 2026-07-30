package io.mrkuhne.mezo.feature.notification.domain;

import org.springframework.lang.Nullable;

/**
 * One FE-written recurring notification-schedule entry (bd mezo-h4wp.6.3) — the domain-level
 * mirror of the generated {@code NotificationScheduleEntry} DTO, kept distinct so
 * {@code NotificationScheduleService} never depends on the wire contract;
 * {@code NotificationController} maps between the two.
 *
 * @param weekday ISO 1=Mon..7=Sun; {@code null} means every day
 * @param body nullable — not every entry carries a body
 */
public record ScheduleEntry(
    @Nullable Integer weekday,
    String time,
    String category,
    String title,
    @Nullable String body,
    String deeplink,
    String source) {}
