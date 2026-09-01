package io.mrkuhne.mezo.feature.character.detector;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

/**
 * Shared windowing + Hungarian number formatting for the round-2 detectors (round-2 spec §4, §6).
 *
 * <p>Every round-2 detector computes its finding as a {@code String} state AS OF a date, over the
 * trailing {@link #WINDOW_DAYS} days of the 8-week series, and fires only when the state as of
 * {@code day} is non-null and differs from the state as of {@code day - 1}. Round-2 sources arrive
 * daily, so the new-data gate alone would re-announce an unchanged pattern every night.
 */
final class RoundTwoWindow {
    private RoundTwoWindow() {}

    static final int WINDOW_DAYS = 14;

    /** True when {@code date} falls in the trailing WINDOW_DAYS days ending at (and including) asOf. */
    static boolean inWindow(LocalDate date, LocalDate asOf) {
        return !date.isAfter(asOf) && !date.isBefore(asOf.minusDays(WINDOW_DAYS - 1L));
    }

    /** Hungarian decimal comma — never let a raw '.' separator reach a summary. */
    static String hu(BigDecimal v, int scale) {
        return v.setScale(scale, RoundingMode.HALF_UP).toPlainString().replace('.', ',');
    }

    /** A 0..1 ratio rendered as a whole-percent string. */
    static String pct(double ratio) {
        return String.valueOf(Math.round(ratio * 100));
    }
}
