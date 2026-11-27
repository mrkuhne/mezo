package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.feature.train.service.sport.SportInterference;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Sport-interference (round 1, spec §4): a heavy sport day (shoulder strain >= 6 or RPE >= 8)
 * followed the next day by a gym session whose sets show a systematic reps-vs-target decline
 * (mean delta <= -1) means the sport load is eating into training capacity. Fires on >= 2 such
 * pairs in the 14-day window, gated on new gym OR new sport data (DetectorGates). The rule itself lives in
 * train's {@link SportInterference} (Boop Sport S2, mezo-r36n9.202) so the Sport area's hints read the same numbers.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class SportInterferenceDetector implements CharacterDetector {

    @Override
    public String key() {
        return "sport-interference";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newGymData(in) && !DetectorGates.newSportData(in)) {
            return List.of();
        }
        List<SportInterference.SportDay> sport = in.sportSessions().stream()
            .map(sp -> new SportInterference.SportDay(sp.date(), sp.shoulderStrain(), sp.rpe()))
            .toList();
        Map<LocalDate, Double> deltas = new HashMap<>();
        for (SportInterference.SportDay sp : sport) {
            LocalDate next = sp.date().plusDays(1);
            Double delta = avgRepsVsTargetDelta(in, next);
            if (delta != null) deltas.put(next, delta);
        }
        int pairs = SportInterference.declinePairs(sport, deltas);
        if (pairs < SportInterference.MIN_DECLINE_PAIRS) {
            return List.of();
        }
        String summary = "Sport-interferencia: " + pairs
                + " alkalommal esett vissza a gym a nagy terhelésű sportnap után (14 nap).";
        return List.of(new DetectorSignal(key(), "edzo", summary, Math.min(2 + pairs, 5)));
    }

    private static Double avgRepsVsTargetDelta(DetectorInput in, LocalDate date) {
        int n = 0;
        int sum = 0;
        for (DetectorInput.GymDay g : in.gymDays()) {
            if (!g.date().equals(date)) continue;
            for (DetectorInput.ExerciseWork w : g.exercises()) {
                for (DetectorInput.SetPoint s : w.sets()) {
                    if (s.reps() != null && s.targetReps() != null && !s.skipped()) {
                        sum += s.reps() - s.targetReps();
                        n++;
                    }
                }
            }
        }
        return n == 0 ? null : (double) sum / n;
    }
}
