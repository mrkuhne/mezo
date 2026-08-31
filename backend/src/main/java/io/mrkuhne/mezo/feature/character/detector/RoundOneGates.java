package io.mrkuhne.mezo.feature.character.detector;

import java.time.LocalDate;

/**
 * Stateless overfiring protection for the round-1 (edzés & test) detectors, spec §5 of
 * 2026-08-31-character-round1-edzes-test-design.md: a sliding window recomputed nightly must not
 * re-announce an unchanged state, so a detector only fires when NEW data for its source family
 * arrived on the observed day. No table, no "last fired" state — pure date checks.
 */
final class RoundOneGates {
    private RoundOneGates() {}

    static boolean newGymData(DetectorInput in) {
        return in.gymDays().stream().anyMatch(g -> g.date().equals(in.day()));
    }

    static boolean newSportData(DetectorInput in) {
        return in.sportSessions().stream().anyMatch(s -> s.date().equals(in.day()));
    }

    static boolean newRunData(DetectorInput in) {
        return in.runLogs().stream().anyMatch(r -> r.date().equals(in.day()));
    }

    static boolean newSleepData(DetectorInput in) {
        return in.sleepPoints().stream().anyMatch(s -> s.date().equals(in.day()));
    }

    static boolean onDay(LocalDate date, DetectorInput in) {
        return date.equals(in.day());
    }
}
