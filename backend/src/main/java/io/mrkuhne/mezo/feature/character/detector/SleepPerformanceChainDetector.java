package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Sleep-performance chain (round 1, spec §4): a poor night ({@code quality <= 4} OR
 * {@code durationH < 6}, null-safe — a null field simply doesn't qualify that clause) followed by
 * a same-day performance decline means bad sleep is eating into training capacity. A
 * {@link DetectorInput.SleepPoint} dated {@code D} is the night leading INTO day {@code D}
 * (companion "last night" convention, see {@link DetectorInput.SleepPoint}), so the decline is
 * checked on that SAME date D: a systematic gym reps-vs-target decline (mean delta {@code <= -1},
 * reusing the {@code avgRepsVsTargetDelta} helper pattern from {@link SportInterferenceDetector}),
 * OR a run with {@code rpeActual >= 8}, OR a sport session with {@code rpe >= 8}. Fires on >= 2
 * such pairs in the 14-day window, gated on new sleep, gym, run, OR sport data (DetectorGates).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class SleepPerformanceChainDetector implements CharacterDetector {

    private static final int POOR_QUALITY_MAX = 4;
    private static final BigDecimal MIN_DURATION_H = new BigDecimal("6");
    private static final double GYM_DECLINE_THRESHOLD = -1.0;
    private static final int HIGH_RPE = 8;
    private static final BigDecimal HIGH_RPE_BD = new BigDecimal("8");
    private static final int MIN_PAIRS = 2;

    @Override
    public String key() {
        return "sleep-performance-chain";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newSleepData(in) && !DetectorGates.newGymData(in)
                && !DetectorGates.newRunData(in) && !DetectorGates.newSportData(in)) {
            return List.of();
        }
        int pairs = 0;
        for (DetectorInput.SleepPoint sp : in.sleepPoints()) {
            boolean poor = (sp.quality() != null && sp.quality() <= POOR_QUALITY_MAX)
                    || (sp.durationH() != null && sp.durationH().compareTo(MIN_DURATION_H) < 0);
            if (poor && declinedOn(in, sp.date())) {
                pairs++;
            }
        }
        if (pairs < MIN_PAIRS) {
            return List.of();
        }
        String summary = "Rossz alvás után visszaesik a teljesítmény: " + pairs
                + " ilyen nap 14 napon belül.";
        return List.of(new DetectorSignal(key(), "szomnologus", summary, Math.min(2 + pairs, 5)));
    }

    private static boolean declinedOn(DetectorInput in, LocalDate date) {
        Double gymDelta = avgRepsVsTargetDelta(in, date);
        if (gymDelta != null && gymDelta <= GYM_DECLINE_THRESHOLD) {
            return true;
        }
        for (DetectorInput.RunPoint r : in.runLogs()) {
            if (r.date().equals(date) && r.rpeActual() != null && r.rpeActual() >= HIGH_RPE) {
                return true;
            }
        }
        for (DetectorInput.SportPoint s : in.sportSessions()) {
            if (s.date().equals(date) && s.rpe() != null && s.rpe().compareTo(HIGH_RPE_BD) >= 0) {
                return true;
            }
        }
        return false;
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
