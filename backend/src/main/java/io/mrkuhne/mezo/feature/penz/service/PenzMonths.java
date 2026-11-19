package io.mrkuhne.mezo.feature.penz.service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;

/** 'YYYY-MM' helpers of Boop Pénz. */
final class PenzMonths {

    private PenzMonths() {
    }

    /** Parses a 'YYYY-MM' month; anything else is a 400 field error on {@code month}. */
    static YearMonth requireMonth(String month) {
        try {
            if (month == null || month.length() != 7) {
                throw PenzErrors.field("month");
            }
            return YearMonth.parse(month);
        } catch (DateTimeParseException ex) {
            throw PenzErrors.field("month");
        }
    }

    static LocalDate first(YearMonth m) {
        return m.atDay(1);
    }

    static LocalDate last(YearMonth m) {
        return m.atEndOfMonth();
    }
}
