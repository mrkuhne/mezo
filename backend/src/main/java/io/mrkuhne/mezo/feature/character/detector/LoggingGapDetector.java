package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Consecutive days with no meal logs ending at the observed day (spec §5 meta-behavior). */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class LoggingGapDetector implements CharacterDetector {

    @Override
    public String key() {
        return "logging-gap";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        int streak = 0;
        LocalDate d = in.day();
        while (!in.mealDates().contains(d) && streak < 14) {
            streak++;
            d = d.minusDays(1);
        }
        if (streak < 2) {
            return List.of();
        }
        boolean atCap = streak >= 14;
        String summary;
        if (atCap) {
            // the 14-day window can't tell a 14-day gap from a much longer one, so say so honestly
            // instead of asserting a precise day count (and dropping a stale "utolsó:" clause).
            summary = "legalább 14 napja nincs étkezés logolva.";
        } else {
            LocalDate last = in.mealDates().stream().max(LocalDate::compareTo).orElse(null);
            summary = streak + ". napja nincs étkezés logolva"
                    + (last != null ? " (utolsó: " + last + ")." : ".");
        }
        return List.of(new DetectorSignal(key(), "drill", summary, Math.min(streak, 5)));
    }
}
