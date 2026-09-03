package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Meal-logging gaps in the last week combined with a rising weight trend (spec §5). */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
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
        // delta only ever reaches here when >= THRESHOLD (0.3), so it is always non-negative — "+" is
        // never conditional.
        String summary = "A héten " + gaps + " nap kaja-log nélkül, közben a súly "
                + "+" + huNumber(delta) + " kg (" + huNumber(first) + " → " + huNumber(last) + ").";
        return List.of(new DetectorSignal(key(), "taplalkozo", summary, 4));
    }

    /** Renders a weight/delta value with a decimal comma (house Hungarian text convention),
     *  deterministically — never a locale-dependent NumberFormat whose output could vary with the
     *  JVM default locale. */
    private static String huNumber(BigDecimal value) {
        return value.toPlainString().replace('.', ',');
    }
}
