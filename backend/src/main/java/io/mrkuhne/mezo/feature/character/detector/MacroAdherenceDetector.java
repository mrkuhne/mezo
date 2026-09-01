package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Macro adherence (round 2, spec §5): over the trailing 14 logged days, does kcal or protein
 * systematically miss the day's REAL target? Targets follow {@code FuelDayService}'s precedence
 * (the active goal's week segment prescribes kcal + protein, config fills the rest), resolved in
 * {@code CharacterSignalReads}.
 *
 * <p>State = "{metric}:{direction}" over the window as of a date; fires only when the state as of
 * {@code day} is non-null and differs from the state as of {@code day - 1} (round-2 spec §6), so a
 * stable multi-week deficit is announced ONCE, not every night.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class MacroAdherenceDetector implements CharacterDetector {

    private static final int MIN_LOGGED_DAYS = 7;
    private static final double KCAL_THRESHOLD = 0.10;    // 10% mean deviation
    private static final double PROTEIN_THRESHOLD = 0.15; // 15% mean deviation

    @Override
    public String key() {
        return "macro-adherence";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newMealData(in)) {
            return List.of();
        }
        Finding today = finding(in, in.day());
        Finding yesterday = finding(in, in.day().minusDays(1));
        if (today == null || today.state().equals(yesterday == null ? "" : yesterday.state())) {
            return List.of();
        }
        String metric = today.protein() ? "fehérje" : "kalória";
        String direction = today.deviation() < 0 ? "alálövi" : "túllövi";
        String summary = "A " + metric + "-cél szisztematikus eltérése: " + today.days()
                + " logolt napon átlagosan " + RoundTwoWindow.pct(Math.abs(today.deviation()))
                + "%-kal " + direction + " a napi célt (14 nap).";
        return List.of(new DetectorSignal(key(), "taplalkozo", summary, 3));
    }

    private record Finding(String state, boolean protein, double deviation, int days) {}

    private static Finding finding(DetectorInput in, LocalDate asOf) {
        List<DetectorInput.MealDayPoint> window = new ArrayList<>();
        for (DetectorInput.MealDayPoint m : in.trend().mealDays()) {
            if (RoundTwoWindow.inWindow(m.date(), asOf) && m.kcal().signum() > 0) {
                window.add(m);
            }
        }
        if (window.size() < MIN_LOGGED_DAYS) {
            return null;
        }
        double kcalDev = meanDeviation(window, true);
        double proteinDev = meanDeviation(window, false);
        // kcal wins ties: it is the target the user actually steers by
        if (Math.abs(kcalDev) >= KCAL_THRESHOLD) {
            return new Finding("kcal:" + (kcalDev < 0 ? "under" : "over"), false, kcalDev, window.size());
        }
        if (Math.abs(proteinDev) >= PROTEIN_THRESHOLD) {
            return new Finding("protein:" + (proteinDev < 0 ? "under" : "over"), true, proteinDev,
                    window.size());
        }
        return null;
    }

    private static double meanDeviation(List<DetectorInput.MealDayPoint> window, boolean kcal) {
        double sum = 0;
        int n = 0;
        for (DetectorInput.MealDayPoint m : window) {
            BigDecimal actual = kcal ? m.kcal() : m.proteinG();
            BigDecimal target = kcal ? m.kcalTarget() : m.proteinTarget();
            if (target == null || target.signum() == 0) {
                continue;
            }
            sum += actual.subtract(target).doubleValue() / target.doubleValue();
            n++;
        }
        return n == 0 ? 0 : sum / n;
    }
}
