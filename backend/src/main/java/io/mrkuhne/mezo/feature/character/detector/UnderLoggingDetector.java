package io.mrkuhne.mezo.feature.character.detector;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

/** Meal-logging gaps in the last week combined with a rising weight trend (spec §5). */
@Component
public class UnderLoggingDetector implements CharacterDetector {

    private static final BigDecimal THRESHOLD = new BigDecimal("0.3");

    @Override
    public String key() {
        return "under-logging";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        int gaps = 0;
        for (int i = 0; i <= 6; i++) {
            LocalDate d = in.day().minusDays(i);
            if (!in.mealDates().contains(d)) {
                gaps++;
            }
        }
        if (gaps < 3) {
            return List.of();
        }
        List<DetectorInput.WeightPoint> sorted = in.weights().stream()
                .sorted(Comparator.comparing(DetectorInput.WeightPoint::date))
                .toList();
        if (sorted.size() < 2) {
            return List.of();
        }
        BigDecimal first = sorted.get(0).kg();
        BigDecimal last = sorted.get(sorted.size() - 1).kg();
        BigDecimal delta = last.subtract(first);
        if (delta.compareTo(THRESHOLD) < 0) {
            return List.of();
        }
        String sign = delta.signum() >= 0 ? "+" : "";
        String summary = "A héten " + gaps + " nap kaja-log nélkül, közben a súly "
                + sign + delta + " kg (" + first + " → " + last + ").";
        return List.of(new DetectorSignal(key(), "taplalkozo", summary, 4));
    }
}
