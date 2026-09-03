package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Niggle map (round 1, spec §4). There is NO niggle entity — niggle truth is scattered across
 * ExerciseFeedbackEntity.jointPain (1..3, per exercise per session) and
 * SportSessionEntity.shoulderStrain (1..10). Fires when jointPain >= 2 repeats on the same
 * exercise (>= 2 sessions in the window) or shoulderStrain >= 6 on >= 2 sport sessions; the
 * summary carries the body map. Gated on new gym OR sport data.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class NiggleMapDetector implements CharacterDetector {

    private static final int JOINT_PAIN_MIN = 2;
    private static final int SHOULDER_STRAIN_MIN = 6;
    private static final int MIN_REPEATS = 2;

    @Override
    public String key() {
        return "niggle-map";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newGymData(in) && !DetectorGates.newSportData(in)) {
            return List.of();
        }
        Map<String, Integer> painCounts = new LinkedHashMap<>();
        for (DetectorInput.GymDay day : in.gymDays()) {
            for (DetectorInput.ExerciseWork work : day.exercises()) {
                if (work.worstJointPain() != null && work.worstJointPain() >= JOINT_PAIN_MIN) {
                    painCounts.merge(work.exerciseName(), 1, Integer::sum);
                }
            }
        }
        List<String> parts = new ArrayList<>();
        for (Map.Entry<String, Integer> e : painCounts.entrySet()) {
            if (e.getValue() >= MIN_REPEATS) {
                parts.add(e.getKey() + ": ízület-jelzés " + e.getValue() + "×");
            }
        }
        long strained = in.sportSessions().stream()
                .filter(s -> s.shoulderStrain() != null && s.shoulderStrain() >= SHOULDER_STRAIN_MIN)
                .count();
        if (strained >= MIN_REPEATS) {
            parts.add("váll-terhelés " + SHOULDER_STRAIN_MIN + "+ a sportnapokon " + strained + "×");
        }
        if (parts.isEmpty()) {
            return List.of();
        }
        String summary = "Niggle-térkép (14 nap): " + String.join(" · ", parts) + ".";
        return List.of(new DetectorSignal(key(), "edzo", summary, Math.min(2 + parts.size(), 5)));
    }
}
