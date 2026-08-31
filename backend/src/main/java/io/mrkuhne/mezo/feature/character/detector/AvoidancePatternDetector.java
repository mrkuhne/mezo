package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Avoidance pattern (round 1, spec §4): an exercise that keeps getting whole-sale skipped is a
 * dodge signal. NOTE — {@code ExerciseWork.skippedSets} is 0/1 in practice: WorkoutService
 * persists at most ONE whole-exercise skip marker per (instance, exercise), so it is really a
 * per-day flag ("was this exercise skipped that day"), not a magnitude. Fires when one exercise
 * was skipped on >= 2 different days OR has >= 3 skipped sets total in the 14-day window (the
 * latter, given the 0/1 reality, is effectively also "skipped on >= 3 days" — the OR is kept for
 * literal spec compliance). Gated on new gym data. Expert {@code drill}; lists the most-skipped
 * exercise plus up to 2 more qualifying exercises, joined with " · ".
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class AvoidancePatternDetector implements CharacterDetector {

    private static final int MIN_DAYS = 2;
    private static final int MIN_TOTAL_SKIPPED = 3;
    private static final int MAX_NAMED = 3;

    @Override
    public String key() {
        return "avoidance-pattern";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!RoundOneGates.newGymData(in)) {
            return List.of();
        }
        Map<String, Set<LocalDate>> skipDaysByExercise = new LinkedHashMap<>();
        Map<String, Integer> totalSkippedByExercise = new LinkedHashMap<>();
        for (DetectorInput.GymDay day : in.gymDays()) {
            for (DetectorInput.ExerciseWork work : day.exercises()) {
                if (work.skippedSets() > 0) {
                    skipDaysByExercise.computeIfAbsent(work.exerciseName(), k -> new TreeSet<>())
                            .add(day.date());
                    totalSkippedByExercise.merge(work.exerciseName(), work.skippedSets(), Integer::sum);
                }
            }
        }
        List<Map.Entry<String, Set<LocalDate>>> qualifying = new ArrayList<>();
        for (Map.Entry<String, Set<LocalDate>> e : skipDaysByExercise.entrySet()) {
            int days = e.getValue().size();
            int total = totalSkippedByExercise.get(e.getKey());
            if (days >= MIN_DAYS || total >= MIN_TOTAL_SKIPPED) {
                qualifying.add(e);
            }
        }
        if (qualifying.isEmpty()) {
            return List.of();
        }
        qualifying.sort((a, b) -> b.getValue().size() - a.getValue().size());
        List<String> parts = new ArrayList<>();
        for (Map.Entry<String, Set<LocalDate>> e : qualifying.subList(0, Math.min(MAX_NAMED, qualifying.size()))) {
            parts.add("a(z) " + e.getKey() + " edzésein " + e.getValue().size() + " alkalommal");
        }
        String summary = "Kihagyás-minta: " + String.join(" · ", parts) + " maradt ki (14 nap).";
        return List.of(new DetectorSignal(key(), "drill", summary, 3));
    }
}
