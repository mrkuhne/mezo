package io.mrkuhne.mezo.feature.train.service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * Shared meso-week math (spec DA1/DA2): {@code startDate}-anchored 7-day week buckets, 1-based.
 * Package-visible — shared by {@link TrainService} (calendar-week-on-activate) and
 * {@link VolumeProgressionService} (the weekly rollover trigger + last-week window), so the two
 * never drift on what "week n" means. Pure, no Spring/DB.
 */
final class MesoWeeks {
    private MesoWeeks() {}

    /** Week containing today, clamped to [1, weeks] — week 1 before the start date. */
    static int clampWeek(LocalDate startDate, int weeks) {
        return weekOf(startDate, LocalDate.now(), weeks);
    }

    /** 1-based meso-week containing {@code date}, clamped [1, weeks]. */
    static int weekOf(LocalDate startDate, LocalDate date, int weeks) {
        long wk = ChronoUnit.DAYS.between(startDate, date) / 7 + 1;
        return (int) Math.max(1, Math.min(weeks, wk));
    }

    /** The {@code [from, to]} LocalDate range covering 1-based week {@code w}, anchored on {@code startDate}. */
    static Window weekWindow(LocalDate startDate, int week) {
        LocalDate from = startDate.plusDays(7L * (week - 1));
        LocalDate to = startDate.plusDays(7L * week - 1);
        return new Window(from, to);
    }

    record Window(LocalDate from, LocalDate to) {}
}
