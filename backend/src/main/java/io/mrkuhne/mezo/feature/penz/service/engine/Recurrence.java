package io.mrkuhne.mezo.feature.penz.service.engine;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

/** Recurring-rule occurrences, a port of the old app's {@code src/domain/recurrence.ts}. */
public final class Recurrence {

    private Recurrence() {
    }

    /**
     * Occurrences within [from, to] inclusive, anchored at the rule's start date. Ignores
     * {@code active} and {@code lastMaterializedDate}. A monthly/yearly day past the month's end
     * is clamped to the last day (31 Jan → 28 Feb; 29 Feb → 28 Feb in a non-leap year).
     */
    public static List<LocalDate> occurrencesInRange(RecurringRuleInput rule, LocalDate from, LocalDate to) {
        LocalDate lo = PenzDates.max(from, rule.startDate());
        LocalDate hi = rule.endDate() != null ? PenzDates.min(rule.endDate(), to) : to;
        List<LocalDate> out = new ArrayList<>();
        if (lo.isAfter(hi)) {
            return out;
        }
        switch (rule.frequency()) {
            case WEEKLY -> {
                for (LocalDate d = rule.startDate(); !d.isAfter(hi); d = d.plusDays(7)) {
                    pushIfIn(out, d, lo, hi);
                }
            }
            case MONTHLY -> {
                for (YearMonth ym = YearMonth.from(rule.startDate()); !ym.atDay(1).isAfter(hi); ym = ym.plusMonths(1)) {
                    pushIfIn(out, monthlyDate(rule.startDate(), ym), lo, hi);
                }
            }
            case YEARLY -> {
                int month = rule.startDate().getMonthValue();
                for (int y = rule.startDate().getYear(); y <= hi.getYear(); y++) {
                    pushIfIn(out, monthlyDate(rule.startDate(), YearMonth.of(y, month)), lo, hi);
                }
            }
        }
        return out;
    }

    /** Active rules only: occurrences in (lastMaterializedDate, or the day before start; today]. */
    public static List<LocalDate> dueOccurrences(RecurringRuleInput rule, LocalDate today) {
        if (!rule.active()) {
            return List.of();
        }
        LocalDate from = rule.lastMaterializedDate() != null ? rule.lastMaterializedDate().plusDays(1) : rule.startDate();
        return occurrencesInRange(rule, from, today);
    }

    /**
     * The monthly HUF equivalent of a rule's amount (old {@code recurringMath.ts monthlyHufMinor}): weekly ×52/12,
     * yearly /12, monthly as is; rounded half up like the old {@code Math.round} (amounts are positive).
     */
    public static long monthlyHufMinor(Frequency frequency, long amountHufMinor) {
        return switch (frequency) {
            case WEEKLY -> Math.round(amountHufMinor * 52 / 12.0);
            case YEARLY -> Math.round(amountHufMinor / 12.0);
            case MONTHLY -> amountHufMinor;
        };
    }

    private static LocalDate monthlyDate(LocalDate start, YearMonth ym) {
        return ym.atDay(Math.min(start.getDayOfMonth(), ym.lengthOfMonth()));
    }

    private static void pushIfIn(List<LocalDate> out, LocalDate d, LocalDate lo, LocalDate hi) {
        if (!d.isBefore(lo) && !d.isAfter(hi)) {
            out.add(d);
        }
    }
}
