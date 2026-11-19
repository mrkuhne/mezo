package io.mrkuhne.mezo.feature.penz.service.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Mirrors the old app's {@code src/domain/monthClose.test.ts} 1:1 (9 cases). */
class PenzMonthCloseTest {

    private static YearMonth m(String s) {
        return YearMonth.parse(s);
    }

    private static LocalDate d(String s) {
        return LocalDate.parse(s);
    }

    private static MonthCloseInput close(String month) {
        return new MonthCloseInput(m(month), 0);
    }

    private static MonthCloseInput close(String month, long deficitMinor) {
        return new MonthCloseInput(m(month), deficitMinor);
    }

    private static MonthlyAllowance remaining(long remainingMinor) {
        return new MonthlyAllowance(m("2026-11"), 0, 0, 0, 0, 0, 0, 0, 0, 0, remainingMinor);
    }

    // monthClose.test.ts > monthsToClose > lists unclosed past months oldest first
    @Test
    void listsUnclosedPastMonthsOldestFirst() {
        assertThat(MonthCloseRules.monthsToClose(d("2027-01-15"), m("2026-11"), List.of()))
            .containsExactly(m("2026-11"), m("2026-12"));
    }

    // monthClose.test.ts > monthsToClose > skips closed months
    @Test
    void skipsClosedMonths() {
        assertThat(MonthCloseRules.monthsToClose(d("2027-01-15"), m("2026-11"), List.of(close("2026-11"))))
            .containsExactly(m("2026-12"));
    }

    // monthClose.test.ts > monthsToClose > returns [] with no data or only current month
    @Test
    void returnsEmptyWithNoDataOrOnlyCurrentMonth() {
        assertThat(MonthCloseRules.monthsToClose(d("2026-11-15"), null, List.of())).isEmpty();
        assertThat(MonthCloseRules.monthsToClose(d("2026-11-15"), m("2026-11"), List.of())).isEmpty();
    }

    // monthClose.test.ts > closeOutcome > leftover when positive
    @Test
    void leftoverWhenPositive() {
        assertThat(MonthCloseRules.closeOutcome(remaining(259_000_00))).isEqualTo(new CloseOutcome(259_000_00, 0));
    }

    // monthClose.test.ts > closeOutcome > deficit when negative
    @Test
    void deficitWhenNegative() {
        assertThat(MonthCloseRules.closeOutcome(remaining(-40_000_00))).isEqualTo(new CloseOutcome(0, 40_000_00));
    }

    // monthClose.test.ts > closeOutcome > zero
    @Test
    void zero() {
        assertThat(MonthCloseRules.closeOutcome(remaining(0))).isEqualTo(new CloseOutcome(0, 0));
    }

    // monthClose.test.ts > previousDeficit > reads previous month close
    @Test
    void readsPreviousMonthClose() {
        assertThat(MonthCloseRules.previousDeficit(m("2026-12"), List.of(close("2026-11", 40_000_00))))
            .isEqualTo(40_000_00);
    }

    // monthClose.test.ts > previousDeficit > is 0 without a close
    @Test
    void isZeroWithoutAClose() {
        assertThat(MonthCloseRules.previousDeficit(m("2026-12"), List.of())).isZero();
    }

    // monthClose.test.ts > previousDeficit > handles year boundary
    @Test
    void handlesYearBoundary() {
        assertThat(MonthCloseRules.previousDeficit(m("2027-01"), List.of(close("2026-12", 5)))).isEqualTo(5);
    }
}
