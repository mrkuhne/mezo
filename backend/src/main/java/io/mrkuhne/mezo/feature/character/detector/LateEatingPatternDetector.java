package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Late-eating pattern (round 2, spec §5): a substantial meal logged late in the evening, repeatedly
 * followed by a worse night. A {@link DetectorInput.SleepPoint} dated {@code D} is the night
 * leading INTO day {@code D} (the companion "last night" convention), so the night AFTER a late
 * meal on day {@code D} is the sleep point dated {@code D + 1} — the off-by-one that matters here.
 *
 * <p>Owned by {@code szomnologus}: this is a rhythm signal ("alvásminőség és -ritmus"), not a
 * nutrition-quality one.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class LateEatingPatternDetector implements CharacterDetector {

    private static final LocalTime LATE_FROM = LocalTime.of(21, 30);
    private static final BigDecimal SUBSTANTIAL_KCAL = new BigDecimal("300");
    private static final int POOR_QUALITY_MAX = 5;
    private static final BigDecimal SHORT_DURATION_H = new BigDecimal("6.5");
    private static final int MIN_PAIRS = 2;

    @Override
    public String key() {
        return "late-eating-pattern";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newMealData(in) && !DetectorGates.newSleepData(in)) {
            return List.of();
        }
        Integer today = pairs(in, in.day());
        Integer yesterday = pairs(in, in.day().minusDays(1));
        if (today == null || today.equals(yesterday)) {
            return List.of();
        }
        String summary = "Késő esti evés után rosszabb az éjszaka: " + today
                + " ilyen nap 14 napon belül (21:30 után legalább 300 kcal).";
        return List.of(new DetectorSignal(key(), "szomnologus", summary, 3));
    }

    /** Null when below the minimum; otherwise the pair count, which doubles as the state. */
    private static Integer pairs(DetectorInput in, LocalDate asOf) {
        Map<LocalDate, DetectorInput.SleepPoint> nights = new HashMap<>();
        for (DetectorInput.SleepPoint sp : in.sleepPoints()) {
            nights.put(sp.date(), sp);
        }
        int pairs = 0;
        for (DetectorInput.MealDayPoint m : in.trend().mealDays()) {
            if (!TrailingWindow.inWindow(m.date(), asOf) || !hasLateMeal(m)) {
                continue;
            }
            DetectorInput.SleepPoint night = nights.get(m.date().plusDays(1));
            if (night != null && poor(night)) {
                pairs++;
            }
        }
        return pairs < MIN_PAIRS ? null : pairs;
    }

    private static boolean hasLateMeal(DetectorInput.MealDayPoint m) {
        for (DetectorInput.MealPoint p : m.meals()) {
            if (p.loggedAtLocalTime() != null && !p.loggedAtLocalTime().isBefore(LATE_FROM)
                    && p.kcal() != null && p.kcal().compareTo(SUBSTANTIAL_KCAL) >= 0) {
                return true;
            }
        }
        return false;
    }

    private static boolean poor(DetectorInput.SleepPoint sp) {
        return (sp.quality() != null && sp.quality() <= POOR_QUALITY_MAX)
                || (sp.durationH() != null && sp.durationH().compareTo(SHORT_DURATION_H) < 0);
    }
}
