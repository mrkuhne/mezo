package io.mrkuhne.mezo.feature.penz.service.engine;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;

/**
 * Calendar helpers, a port of the old app's {@code src/domain/dates.ts}. Calendar days are
 * {@link LocalDate}, months {@link YearMonth}; the week starts on Monday.
 */
public final class PenzDates {

    private PenzDates() {
    }

    /** The calendar day {@code now} falls on in {@code zone}. */
    public static LocalDate todayInTz(ZoneId zone, Instant now) {
        return LocalDate.ofInstant(now, zone);
    }

    public static LocalDate addDays(LocalDate d, long n) {
        return d.plusDays(n);
    }

    public static YearMonth monthOf(LocalDate d) {
        return YearMonth.from(d);
    }

    public static int daysInMonth(YearMonth m) {
        return m.lengthOfMonth();
    }

    public static LocalDate firstDay(YearMonth m) {
        return m.atDay(1);
    }

    public static LocalDate lastDay(YearMonth m) {
        return m.atEndOfMonth();
    }

    public static YearMonth nextMonth(YearMonth m) {
        return m.plusMonths(1);
    }

    public static YearMonth prevMonth(YearMonth m) {
        return m.minusMonths(1);
    }

    /** Monday of the week containing {@code d}. */
    public static LocalDate weekStart(LocalDate d) {
        return d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    public static int daysBetweenInclusive(LocalDate a, LocalDate b) {
        return Math.toIntExact(ChronoUnit.DAYS.between(a, b) + 1);
    }

    public static int compareDates(LocalDate a, LocalDate b) {
        return Integer.signum(a.compareTo(b));
    }

    public static YearMonth addMonths(YearMonth m, long n) {
        return m.plusMonths(n);
    }

    /** Whole months from {@code from} to {@code to}; negative when {@code to} is earlier. */
    public static int monthsBetween(YearMonth from, YearMonth to) {
        return Math.toIntExact(ChronoUnit.MONTHS.between(from, to));
    }

    /** The earlier of two dates. */
    static LocalDate min(LocalDate a, LocalDate b) {
        return a.isBefore(b) ? a : b;
    }

    /** The later of two dates. */
    static LocalDate max(LocalDate a, LocalDate b) {
        return a.isAfter(b) ? a : b;
    }
}
