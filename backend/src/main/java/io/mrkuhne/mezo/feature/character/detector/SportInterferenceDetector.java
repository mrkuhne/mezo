package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Sport-interference (round 1, spec §4): a heavy sport day (shoulder strain >= 6 or RPE >= 8)
 * followed the next day by a gym session whose sets show a systematic reps-vs-target decline
 * (mean delta <= -1) means the sport load is eating into training capacity. Fires on >= 2 such
 * pairs in the 14-day window, gated on new gym OR new sport data (RoundOneGates).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class SportInterferenceDetector implements CharacterDetector {

    private static final int SHOULDER_STRAIN_MIN = 6;
    private static final BigDecimal RPE_MIN = new BigDecimal("8");
    private static final double DECLINE_THRESHOLD = -1.0;
    private static final int MIN_PAIRS = 2;

    @Override
    public String key() {
        return "sport-interference";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!RoundOneGates.newGymData(in) && !RoundOneGates.newSportData(in)) {
            return List.of();
        }
        int pairs = 0;
        for (DetectorInput.SportPoint sp : in.sportSessions()) {
            boolean heavy = (sp.shoulderStrain() != null && sp.shoulderStrain() >= SHOULDER_STRAIN_MIN)
                    || (sp.rpe() != null && sp.rpe().compareTo(RPE_MIN) >= 0);
            if (!heavy) continue;
            LocalDate next = sp.date().plusDays(1);
            Double delta = avgRepsVsTargetDelta(in, next);
            if (delta != null && delta <= DECLINE_THRESHOLD) pairs++;
        }
        if (pairs < MIN_PAIRS) {
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
