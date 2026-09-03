package io.mrkuhne.mezo.feature.character.detector;

import java.time.LocalDate;

/**
 * Stateless overfiring protection for the detector framework — pure date checks, no table and no
 * "last fired" state.
 *
 * <p>Round 1 (2026-08-31-character-round1-edzes-test-design.md §5) used these as the PRIMARY gate:
 * gym/sport/run/sleep data is episodic, so "new data for this family arrived on the observed day"
 * is genuinely selective. Round 2's sources (meals, water, stack, check-ins) arrive EVERY day, so
 * for those the same gate is nearly always open and the round-2 detectors rely primarily on their
 * own state-change gate (round-2 spec §6) — these methods stay as a cheap pre-filter.
 *
 * <p>Round 3 adds a limit to this pattern: where ABSENCE is the signal, a new-data pre-filter is
 * wrong. A review backlog grows because time passes, a streak breaks because no row is written, a
 * check-in slot dies out because nobody fills it — on the very day each of those transitions
 * happens, nothing arrives. Gating those detectors on new data would silence exactly what they
 * exist to catch, so they rely on their state-change gate alone. Only three gates are added here
 * (intention, decision, gratitude); needs and chat deliberately get none.
 */
final class DetectorGates {
    private DetectorGates() {}

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

    static boolean newMealData(DetectorInput in) {
        return in.trend().mealDays().stream().anyMatch(m -> m.date().equals(in.day()));
    }

    static boolean newWaterData(DetectorInput in) {
        return in.trend().waterDays().stream().anyMatch(w -> w.date().equals(in.day()));
    }

    static boolean newStackData(DetectorInput in) {
        return in.trend().stack() != null && in.trend().stack().days().stream()
                .anyMatch(d -> d.date().equals(in.day()) && !d.takenPantryItemIds().isEmpty());
    }

    static boolean newCheckinData(DetectorInput in) {
        return in.trend().checkinDays().stream()
                .anyMatch(c -> c.date().equals(in.day()) && c.count() > 0);
    }

    static boolean newDoseData(DetectorInput in) {
        return in.trend().med() != null && in.trend().med().days().stream()
                .anyMatch(d -> d.date().equals(in.day())
                        && d.daysSinceDose() != null && d.daysSinceDose() == 0);
    }

    static boolean onDay(LocalDate date, DetectorInput in) {
        return date.equals(in.day());
    }

    static boolean newIntentionData(DetectorInput in) {
        return in.trend().intentionDays().stream().anyMatch(i -> i.date().equals(in.day()));
    }

    static boolean newDecisionData(DetectorInput in) {
        return in.trend().decisions().stream()
                .anyMatch(d -> in.day().equals(d.writtenOn()) || in.day().equals(d.reviewedOn()));
    }

    static boolean newGratitudeData(DetectorInput in) {
        return in.trend().gratitudes().stream().anyMatch(g -> g.occurredOn().equals(in.day()));
    }
}
