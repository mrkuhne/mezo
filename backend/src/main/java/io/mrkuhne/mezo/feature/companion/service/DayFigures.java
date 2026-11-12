package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.wearable.entity.DailyMetricEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Map;
import java.util.Objects;
import java.util.OptionalDouble;
import java.util.function.Function;

/**
 * The day figures Boop's chat quotes (Boop B3, mezo-r36n9.13) — ONE place for the 14-day usual, the
 * rounding and the clock/number formats, shared by {@link BoopDayContext} (the "Ma" block, the chips) and
 * {@code DayTools} (get_wearable / get_calendar), so the block and a tool never print one value two ways.
 */
public final class DayFigures {

    /** The "usual" window: {@code date-14 … date-1}. */
    public static final int BASELINE_DAYS = 14;

    private DayFigures() {
    }

    /** Mean over {@code date-14 … date-1} of the non-null values; null when there are none. */
    public static Double usual(LocalDate date, Map<LocalDate, DailyMetricEntity> byDate,
                               Function<DailyMetricEntity, Integer> value) {
        OptionalDouble avg = date.minusDays(BASELINE_DAYS).datesUntil(date)
            .map(byDate::get).filter(Objects::nonNull).map(value).filter(Objects::nonNull)
            .mapToInt(Integer::intValue).average();
        return avg.isPresent() ? avg.getAsDouble() : null;
    }

    /** HRV in whole milliseconds; null stays null. */
    public static Integer hrv(DailyMetricEntity m) {
        return m == null || m.getHrvMs() == null ? null : round(m.getHrvMs());
    }

    /** " (szokott 50)" — or "" without a usual. */
    public static String usualSuffix(Double usual) {
        return usual == null ? "" : " (szokott " + Math.round(usual) + ")";
    }

    public static int round(BigDecimal v) {
        return v.setScale(0, RoundingMode.HALF_UP).intValue();
    }

    /** 0 for null — a sum nobody logged is 0 eaten, not unknown. */
    public static int roundOrZero(BigDecimal v) {
        return v == null ? 0 : round(v);
    }

    public static String hhmm(LocalTime t) {
        return String.format("%02d:%02d", t.getHour(), t.getMinute());
    }

    /** Hungarian digit grouping with a plain space: 2450 → "2 450". */
    public static String grouped(int value) {
        String digits = Integer.toString(Math.abs(value));
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < digits.length(); i++) {
            if (i > 0 && (digits.length() - i) % 3 == 0) {
                out.append(' ');
            }
            out.append(digits.charAt(i));
        }
        return (value < 0 ? "-" : "") + out;
    }
}
