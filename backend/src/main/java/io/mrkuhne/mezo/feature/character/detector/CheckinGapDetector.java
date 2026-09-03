package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** No check-in today while the prior 7 days show an active habit (spec §5 meta-behavior). */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CheckinGapDetector implements CharacterDetector {

    @Override
    public String key() {
        return "checkin-gap";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (in.checkinCounts().getOrDefault(in.day(), 0) != 0) {
            return List.of();
        }
        int sum = 0;
        for (int i = 1; i <= 7; i++) {
            LocalDate d = in.day().minusDays(i);
            sum += in.checkinCounts().getOrDefault(d, 0);
        }
        double mean = sum / 7.0;
        if (mean < 2) {
            return List.of();
        }
        String summary = "Ma 0 check-in a heti átlag " + Math.round(mean) + " mellett.";
        return List.of(new DetectorSignal(key(), "drill", summary, 3));
    }
}
