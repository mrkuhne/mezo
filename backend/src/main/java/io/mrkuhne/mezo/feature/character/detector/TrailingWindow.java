package io.mrkuhne.mezo.feature.character.detector;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

/**
 * Shared trailing-window arithmetic + Hungarian number formatting for the detectors that use the
 * state-change gate (round-2 spec §4/§6, round-3 spec §4.2).
 *
 * <p>Such a detector computes its finding as a {@code String} state AS OF a date, over a trailing
 * window of the 8-week series, and fires only when the state as of {@code day} is non-null and
 * differs from the state as of {@code day - 1}. These sources arrive daily, so the new-data gate
 * alone would re-announce an unchanged pattern every night.
 *
 * <p>Named {@code TrailingWindow} rather than after any one round: rounds 2 and 3 both use it, and
 * round 3 adds longer windows for its episodic sources (decisions 42 days, gratitude and restart
 * 28 days) alongside the 14-day default.
 */
final class TrailingWindow {
    private TrailingWindow() {}

    static final int WINDOW_DAYS = 14;

    /** True when {@code date} falls in the trailing WINDOW_DAYS days ending at (and including) asOf. */
    static boolean inWindow(LocalDate date, LocalDate asOf) {
        return inWindow(date, asOf, WINDOW_DAYS);
    }

    /**
     * True when {@code date} falls in the trailing {@code days} days ending at (and including)
     * asOf. Any window used here must fit inside the 8-week series with room for the day-1
     * evaluation too — i.e. {@code days + 1 <= 56}.
     */
    static boolean inWindow(LocalDate date, LocalDate asOf, int days) {
        return !date.isAfter(asOf) && !date.isBefore(asOf.minusDays(days - 1L));
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
