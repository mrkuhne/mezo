package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Progression-adherence (round 1, spec §4): actual vs target weight shows a systematic
 * under- or overshoot. Per spec §5 — deload weeks carry a deliberately reduced load, which is
 * plan-conform, not a progression failure — the simplest faithful rule is to skip the whole
 * current week's days when {@code meso.deloadWeek()} is true
 * (docs/superpowers/specs/2026-08-31-character-round1-edzes-test-design.md §5).
 *
 * <p>Over the 14-day window, sets with both {@code weightKg} and {@code targetWeightKg} logged
 * (and not skipped) are classified: undershoot when the logged weight is >= 2.5 kg under target,
 * overshoot when it is >= 2.5 kg over. Fires on >= 4 such events with a dominant direction,
 * gated on new gym data (RoundOneGates).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class ProgressionAdherenceDetector implements CharacterDetector {

    private static final BigDecimal THRESHOLD_KG = new BigDecimal("2.5");
    private static final int MIN_EVENTS = 4;

    @Override
    public String key() {
        return "progression-adherence";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (in.meso() != null && in.meso().deloadWeek()) {
            return List.of();
        }
        if (!RoundOneGates.newGymData(in)) {
            return List.of();
        }
        int under = 0;
        int over = 0;
        for (DetectorInput.GymDay day : in.gymDays()) {
            for (DetectorInput.ExerciseWork work : day.exercises()) {
                for (DetectorInput.SetPoint s : work.sets()) {
                    if (s.weightKg() == null || s.targetWeightKg() == null || s.skipped()) {
                        continue;
                    }
                    if (s.weightKg().compareTo(s.targetWeightKg().subtract(THRESHOLD_KG)) <= 0) {
                        under++;
                    } else if (s.weightKg().compareTo(s.targetWeightKg().add(THRESHOLD_KG)) >= 0) {
                        over++;
                    }
                }
            }
        }
        int total = under + over;
        if (total < MIN_EVENTS || under == over) {
            return List.of();
        }
        String summary = under > over
                ? "Terhelés-követés: a beírt súly " + under
                        + " szettnél maradt el 2,5+ kg-mal a targettől (14 nap)."
                : "Terhelés-követés: a beírt súly " + over
                        + " szettnél lőtt túl 2,5+ kg-mal a targeten (14 nap).";
        return List.of(new DetectorSignal(key(), "edzo", summary, Math.min(2 + total / 2, 5)));
    }
}
