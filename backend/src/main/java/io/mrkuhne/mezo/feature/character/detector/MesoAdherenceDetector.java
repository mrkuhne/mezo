package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Meso-adherence (round 1, spec §4): missed training days against the active mesocycle's weekly
 * plan. Per spec §5 — "deload weeks (phaseCurve) suppress the false alarm — reduced load in a
 * deload week is plan-conform" (docs/superpowers/specs/2026-08-31-character-round1-edzes-test-design.md
 * §5) — a deload week suppresses this detector entirely, unconditionally.
 *
 * <p>Gate nuance: a plain {@code newGymData} gate would make a missed planned day itself
 * unreportable, because a missed day produces no new gym row to trigger the gate on. A miss IS
 * the new information, so the "new data arrived" gate is widened to also fire when the observed
 * day itself is a missed planned day (the miss is discovered simply by the nightly run reaching
 * that date). This only widens which runs are eligible to fire — the {@code missed >= 2}
 * threshold from spec §4 still gates every case, including the day-itself-missed one; a single
 * missed day must stay quiet.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class MesoAdherenceDetector implements CharacterDetector {

    private static final int WINDOW_DAYS = 7;
    private static final int MIN_MISSED = 2;

    @Override
    public String key() {
        return "meso-adherence";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (in.meso() == null) {
            return List.of();
        }
        if (in.meso().deloadWeek()) {
            return List.of();
        }
        LocalDate day = in.day();
        int missed = 0;
        for (int i = 0; i < WINDOW_DAYS; i++) {
            LocalDate d = day.minusDays(i);
            if (in.meso().plannedDays().contains(d.getDayOfWeek()) && !in.meso().doneDays().contains(d)) {
                missed++;
            }
        }
        boolean dayItselfMissed = in.meso().plannedDays().contains(day.getDayOfWeek())
                && !in.meso().doneDays().contains(day);
        boolean fires = missed >= MIN_MISSED && (DetectorGates.newGymData(in) || dayItselfMissed);
        if (!fires) {
            return List.of();
        }
        String summary = "A heti tervből " + missed + " edzésnap kimaradt (hét: "
                + in.meso().currentWeek() + "/" + in.meso().totalWeeks() + ").";
        return List.of(new DetectorSignal(key(), "edzo", summary, Math.min(1 + missed, 4)));
    }
}
