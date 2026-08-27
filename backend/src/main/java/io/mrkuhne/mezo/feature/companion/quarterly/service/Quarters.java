package io.mrkuhne.mezo.feature.companion.quarterly.service;

import java.time.LocalDate;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * W5.3 (bd mezo-b3pp.20, spec §9.3) — the slice's calendar arithmetic in one place. A "quarter"
 * here is always the CALENDAR quarter keyed by its first day (Jan/Apr/Jul/Oct 1st), the same way
 * {@code period_summary.period_start} keys a week by its Monday and a month by its 1st: one
 * identity per period, so a quarter can never be reviewed twice under two different keys.
 *
 * <p>Pure static helper (the {@code ToolText}/{@code GraphEdgeLineRenderer} idiom) — three
 * callers need it and none of them owns it: the quarterly job (which quarter just finished),
 * {@code ProfileAssembler} (the decision-quality trend window) and the {@code compare_periods}
 * tool (parsing what the model asked for).
 */
public final class Quarters {

    /** {@code 2026-Q3} (case-insensitive) or {@code 2026-07} — the two period spellings the
     *  {@code compare_periods} tool accepts. Anything else is not a period. */
    private static final Pattern QUARTER = Pattern.compile("(\\d{4})-[Qq]([1-4])");
    private static final Pattern MONTH = Pattern.compile("(\\d{4})-(0[1-9]|1[0-2])");

    private Quarters() {
    }

    /** The first day of the calendar quarter {@code date} falls in. */
    public static LocalDate startOf(LocalDate date) {
        int firstMonth = ((date.getMonthValue() - 1) / 3) * 3 + 1;
        return LocalDate.of(date.getYear(), firstMonth, 1);
    }

    /** The quarter before {@code quarterStart} — crosses the year boundary for Q1. */
    public static LocalDate previous(LocalDate quarterStart) {
        return quarterStart.minusMonths(3);
    }

    /** The INCLUSIVE last day of the quarter starting at {@code quarterStart}. */
    public static LocalDate endOf(LocalDate quarterStart) {
        return quarterStart.plusMonths(3).minusDays(1);
    }

    /** {@code 2026-Q3} — the label the prompt, the candidate title and the tool output all use. */
    public static String label(LocalDate quarterStart) {
        return quarterStart.getYear() + "-Q" + ((quarterStart.getMonthValue() - 1) / 3 + 1);
    }

    /** Whether {@code text} spells a QUARTER (as opposed to a month) — the tool renders a quarter
     *  from its three month rungs, a month from its own. */
    public static boolean isQuarter(String text) {
        return text != null && QUARTER.matcher(text.strip()).matches();
    }

    /**
     * The first day of the period {@code text} names, or {@code null} when it names none. Never
     * throws: this parses MODEL-SUPPLIED text, and an unparseable argument must reach the tool's
     * honest "nincs adat" branch, not a TOOL_FAILED stack trace.
     */
    public static LocalDate parse(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String trimmed = text.strip();
        Matcher quarter = QUARTER.matcher(trimmed);
        if (quarter.matches()) {
            int q = Integer.parseInt(quarter.group(2));
            return LocalDate.of(Integer.parseInt(quarter.group(1)), (q - 1) * 3 + 1, 1);
        }
        Matcher month = MONTH.matcher(trimmed.toLowerCase(Locale.ROOT));
        if (month.matches()) {
            return LocalDate.of(Integer.parseInt(month.group(1)), Integer.parseInt(month.group(2)), 1);
        }
        return null;
    }
}
