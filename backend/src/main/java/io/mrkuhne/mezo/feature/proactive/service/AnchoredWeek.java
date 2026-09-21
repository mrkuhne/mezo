package io.mrkuhne.mezo.feature.proactive.service;

import java.time.LocalDate;

/**
 * The shared anchored-week clamp (mezo-85x5r final-review wave) — the WEEK-ANCHORED {@code
 * weight} phenomenon's window is {@code [anchorStart, min(anchorStart+6, today)]}, so a running
 * week reports on what has happened SO FAR rather than pretending the unlived days already
 * exist. Package-private: {@link DiagnosisService#generate}, {@link DiagnosisService#isStale},
 * and {@link DiagnosisGenerator#generate} are its only callers — a fourth caller would mean this
 * graduates to its own class outside the service package.
 */
final class AnchoredWeek {

    private AnchoredWeek() {
    }

    /** The anchored week's inclusive END date — {@code anchorStart + 6} (its Sunday), or {@code
     *  today} when the week has not fully elapsed yet (the running/just-closing week). */
    static LocalDate windowTo(LocalDate anchorStart, LocalDate today) {
        LocalDate anchorEnd = anchorStart.plusDays(6);
        return anchorEnd.isBefore(today) ? anchorEnd : today;
    }
}
