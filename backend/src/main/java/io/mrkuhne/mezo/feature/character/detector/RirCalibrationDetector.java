package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * RIR-calibration miss events (round 1, spec §4): within one exercise in one session, a logged
 * RIR should predict the next same-weight set. rir >= 2 followed by a reps collapse (>= 3 fewer)
 * means the RIR was OVERestimated (closer to failure than claimed); rir == 0 followed by reps
 * holding (drop <= 1) means UNDERestimated. Fires on >= 3 events in the 14-day window with a
 * dominant direction, gated on new gym data (RoundOneGates).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class RirCalibrationDetector implements CharacterDetector {

    private static final int MIN_EVENTS = 3;

    @Override
    public String key() {
        return "rir-calibration";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!RoundOneGates.newGymData(in)) {
            return List.of();
        }
        int over = 0;
        int under = 0;
        for (DetectorInput.GymDay day : in.gymDays()) {
            for (DetectorInput.ExerciseWork work : day.exercises()) {
                List<DetectorInput.SetPoint> sets = work.sets();
                for (int i = 0; i + 1 < sets.size(); i++) {
                    DetectorInput.SetPoint a = sets.get(i);
                    DetectorInput.SetPoint b = sets.get(i + 1);
                    if (a.rir() == null || a.reps() == null || b.reps() == null
                            || a.skipped() || b.skipped()
                            || a.weightKg() == null || b.weightKg() == null
                            || a.weightKg().compareTo(b.weightKg()) != 0) {
                        continue;
                    }
                    int drop = a.reps() - b.reps();
                    if (a.rir() >= 2 && drop >= 3) {
                        over++;
                    } else if (a.rir() == 0 && drop <= 1) {
                        under++;
                    }
                }
            }
        }
        int total = over + under;
        if (total < MIN_EVENTS || over == under) {
            return List.of();
        }
        String summary = over > under
                ? "A RIR-becslés felfelé csúszik: " + over + " szettpárnál a mondott 2+ RIR után "
                        + "összeomlott a következő szett (14 nap)."
                : "A RIR-becslés lefelé csúszik: " + under + " szettpárnál a mondott 0 RIR után is "
                        + "tartotta a repset a következő szett (14 nap).";
        return List.of(new DetectorSignal(key(), "edzo", summary, Math.min(2 + total / 2, 5)));
    }
}
