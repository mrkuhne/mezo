package io.mrkuhne.mezo.feature.character.detector;

import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Component;

/** Consecutive days with no meal logs ending at the observed day (spec §5 meta-behavior). */
@Component
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
        LocalDate last = in.mealDates().stream().max(LocalDate::compareTo).orElse(null);
        String summary = streak + ". napja nincs étkezés logolva"
                + (last != null ? " (utolsó: " + last + ")." : ".");
        return List.of(new DetectorSignal(key(), "drill", summary, Math.min(streak, 5)));
    }
}
