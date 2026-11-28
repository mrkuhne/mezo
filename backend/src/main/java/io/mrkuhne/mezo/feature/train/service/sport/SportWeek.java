package io.mrkuhne.mezo.feature.train.service.sport;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;

/**
 * An ISO week (Monday–Sunday) of the Sport read models (Boop Sport S2, mezo-r36n9.202). "Today" is always the owner's
 * calendar day ({@code mezo.wearable.zone}), never the server's UTC day: Sunday 23:30 local is still this week,
 * Monday 00:30 local is already the next one.
 */
public record SportWeek(LocalDate start, LocalDate end) {

    /** The week containing {@code date}. */
    public static SportWeek of(LocalDate date) {
        LocalDate monday = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return new SportWeek(monday, monday.plusDays(6));
    }

    /** The owner's calendar day at {@code now}. */
    public static LocalDate today(Instant now, ZoneId zone) {
        return now.atZone(zone).toLocalDate();
    }

    /** The week the request asked for: {@code week} (any date of it) or, when absent, the week of {@code today}. */
    public static SportWeek resolve(LocalDate week, LocalDate today) {
        return of(week != null ? week : today);
    }

    /** The week {@code n} weeks before this one. */
    public SportWeek minusWeeks(int n) {
        return new SportWeek(start.minusWeeks(n), end.minusWeeks(n));
    }

    public boolean contains(LocalDate date) {
        return !date.isBefore(start) && !date.isAfter(end);
    }
}
