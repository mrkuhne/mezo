package io.mrkuhne.mezo.feature.penz.service.engine;

import static io.mrkuhne.mezo.feature.penz.service.engine.PenzDates.addDays;
import static io.mrkuhne.mezo.feature.penz.service.engine.PenzDates.addMonths;
import static io.mrkuhne.mezo.feature.penz.service.engine.PenzDates.compareDates;
import static io.mrkuhne.mezo.feature.penz.service.engine.PenzDates.daysBetweenInclusive;
import static io.mrkuhne.mezo.feature.penz.service.engine.PenzDates.daysInMonth;
import static io.mrkuhne.mezo.feature.penz.service.engine.PenzDates.firstDay;
import static io.mrkuhne.mezo.feature.penz.service.engine.PenzDates.lastDay;
import static io.mrkuhne.mezo.feature.penz.service.engine.PenzDates.monthOf;
import static io.mrkuhne.mezo.feature.penz.service.engine.PenzDates.monthsBetween;
import static io.mrkuhne.mezo.feature.penz.service.engine.PenzDates.nextMonth;
import static io.mrkuhne.mezo.feature.penz.service.engine.PenzDates.prevMonth;
import static io.mrkuhne.mezo.feature.penz.service.engine.PenzDates.todayInTz;
import static io.mrkuhne.mezo.feature.penz.service.engine.PenzDates.weekStart;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

/** Mirrors the old app's {@code src/domain/dates.test.ts} 1:1 (5 cases). */
class PenzDatesTest {

    private static LocalDate d(String s) {
        return LocalDate.parse(s);
    }

    private static YearMonth m(String s) {
        return YearMonth.parse(s);
    }

    // dates.test.ts > todayInTz respects timezone
    @Test
    void todayInTzRespectsTimezone() {
        assertThat(todayInTz(ZoneId.of("Europe/Budapest"), Instant.parse("2026-10-31T23:30:00Z")))
            .isEqualTo(d("2026-11-01"));
    }

    // dates.test.ts > weekStart is Monday
    @Test
    void weekStartIsMonday() {
        assertThat(weekStart(d("2026-11-04"))).isEqualTo(d("2026-11-02"));
        assertThat(weekStart(d("2026-11-02"))).isEqualTo(d("2026-11-02"));
        assertThat(weekStart(d("2026-11-08"))).isEqualTo(d("2026-11-02"));
    }

    // dates.test.ts > month helpers
    @Test
    void monthHelpers() {
        assertThat(daysInMonth(m("2028-02"))).isEqualTo(29);
        assertThat(daysInMonth(m("2026-02"))).isEqualTo(28);
        assertThat(monthOf(d("2026-11-15"))).isEqualTo(m("2026-11"));
        assertThat(firstDay(m("2026-11"))).isEqualTo(d("2026-11-01"));
        assertThat(lastDay(m("2026-11"))).isEqualTo(d("2026-11-30"));
        assertThat(nextMonth(m("2026-12"))).isEqualTo(m("2027-01"));
        assertThat(prevMonth(m("2026-01"))).isEqualTo(m("2025-12"));
    }

    // dates.test.ts > addMonths and monthsBetween
    @Test
    void addMonthsAndMonthsBetween() {
        assertThat(addMonths(m("2026-11"), 2)).isEqualTo(m("2027-01"));
        assertThat(addMonths(m("2026-01"), -1)).isEqualTo(m("2025-12"));
        assertThat(monthsBetween(m("2026-11"), m("2027-01"))).isEqualTo(2);
        assertThat(monthsBetween(m("2026-11"), m("2026-10"))).isEqualTo(-1);
    }

    // dates.test.ts > day arithmetic
    @Test
    void dayArithmetic() {
        assertThat(addDays(d("2026-11-30"), 1)).isEqualTo(d("2026-12-01"));
        assertThat(addDays(d("2026-03-29"), 1)).isEqualTo(d("2026-03-30"));
        assertThat(addDays(d("2026-11-01"), -1)).isEqualTo(d("2026-10-31"));
        assertThat(daysBetweenInclusive(d("2026-11-02"), d("2026-11-30"))).isEqualTo(29);
        assertThat(compareDates(d("2026-01-01"), d("2026-01-02"))).isLessThan(0);
        assertThat(compareDates(d("2026-01-02"), d("2026-01-02"))).isZero();
    }
}
