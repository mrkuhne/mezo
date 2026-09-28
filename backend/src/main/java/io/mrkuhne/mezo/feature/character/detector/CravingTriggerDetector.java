package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInItem;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Craving trigger (Check-in 2.0, mezo-ck2, spec §3.7) — which PRIOR factor precedes the user's
 * strong-craving days ({@code craving >= 7} day mean) more often than their other answered days?
 * Three deterministic factors, each evaluated only where its data exists (absent, never "no"):
 *
 * <ul>
 *   <li><b>short sleep</b> — the night leading into the day was under {@link #SHORT_SLEEP_H} h;
 *   <li><b>high stress</b> — the PREVIOUS day's stress mean was {@code >= }{@link #HIGH_STRESS};
 *   <li><b>low protein</b> — the PREVIOUS day's protein stayed under {@link #LOW_PROTEIN_RATIO}
 *       of that day's own target.
 * </ul>
 *
 * <p>Whoop guard: a factor is compared only when at least {@link #MIN_DAYS_PER_GROUP} craving days
 * AND {@link #MIN_DAYS_PER_GROUP} non-craving days have it evaluable. A factor "precedes" when its
 * rate on craving days is at least {@link #MIN_RATE_GAP} above the rate on the other days and it
 * occurred before at least {@link #MIN_HITS} craving days. The strongest gap wins. The summary
 * states the co-occurrence and the two rates, never a cause.
 *
 * <p>State-change gate over the 8-week series: state = the winning factor.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CravingTriggerDetector implements CharacterDetector {

    static final int CRAVING_MIN = 7;
    static final int MIN_DAYS_PER_GROUP = 5;
    static final int MIN_HITS = 3;
    static final double MIN_RATE_GAP = 0.25;
    static final double SHORT_SLEEP_H = 6.5;
    static final int HIGH_STRESS = 7;
    static final double LOW_PROTEIN_RATIO = 0.8;

    private enum Factor {
        ROVID_ALVAS("rövid alvás (6,5 óra alatt az előző éjjel)"),
        MAGAS_STRESSZ("magas stressz előző nap (7 vagy fölötte)"),
        KEVES_FEHERJE("kevés fehérje előző nap (a napi cél 80%-a alatt)");

        final String label;

        Factor(String label) {
            this.label = label;
        }
    }

    @Override
    public String key() {
        return "craving-trigger";
    }

    @Override
    public Map<CheckInItem, String> checkInNeeds() {
        return Map.of(CheckInItem.CRAVING, "Most azt figyeljük, mi előzi meg az erős sóvárgásos napjaidat.");
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        Finding today = finding(in, in.day());
        Finding yesterday = finding(in, in.day().minusDays(1));
        if (today == null || (yesterday != null && today.factor() == yesterday.factor())) {
            return List.of();
        }
        String summary = "Az erős sóvárgású napjaid (7 vagy fölötte) előtt gyakoribb volt a "
                + today.factor().label + ": " + today.cravingDays() + " ilyen napból "
                + today.cravingHits() + " előtt (" + TrailingWindow.pct(today.cravingRate()) + "%), a többi "
                + today.otherDays() + " megválaszolt napból csak " + today.otherHits() + " előtt ("
                + TrailingWindow.pct(today.otherRate()) + "%). Együttjárás a saját adataidban, nem ok.";
        return List.of(new DetectorSignal(key(), "taplalkozo", summary, 3));
    }

    record Finding(Factor factor, int cravingDays, int cravingHits, int otherDays, int otherHits,
                   double cravingRate, double otherRate) {}

    static Finding finding(DetectorInput in, LocalDate asOf) {
        Map<LocalDate, DetectorInput.CheckinDayPoint> checkins = new HashMap<>();
        for (DetectorInput.CheckinDayPoint c : in.trend().checkinDays()) {
            if (!c.date().isAfter(asOf)) {
                checkins.put(c.date(), c);
            }
        }
        Map<LocalDate, DetectorInput.SleepPoint> sleep = new HashMap<>();
        for (DetectorInput.SleepPoint s : in.trend().sleepEightWeeks()) {
            if (!s.date().isAfter(asOf)) {
                sleep.put(s.date(), s);
            }
        }
        Map<LocalDate, DetectorInput.MealDayPoint> meals = new HashMap<>();
        for (DetectorInput.MealDayPoint m : in.trend().mealDays()) {
            if (!m.date().isAfter(asOf)) {
                meals.put(m.date(), m);
            }
        }
        Finding best = null;
        for (Factor f : Factor.values()) {
            int[] counts = new int[4]; // cravingDays, cravingHits, otherDays, otherHits
            for (DetectorInput.CheckinDayPoint c : checkins.values()) {
                if (c.craving() == null) {
                    continue;
                }
                Boolean present = present(f, c.date(), checkins, sleep, meals);
                if (present == null) {
                    continue;
                }
                int base = c.craving().doubleValue() >= CRAVING_MIN ? 0 : 2;
                counts[base]++;
                if (present) {
                    counts[base + 1]++;
                }
            }
            if (counts[0] < MIN_DAYS_PER_GROUP || counts[2] < MIN_DAYS_PER_GROUP || counts[1] < MIN_HITS) {
                continue;
            }
            double cravingRate = (double) counts[1] / counts[0];
            double otherRate = (double) counts[3] / counts[2];
            if (cravingRate - otherRate < MIN_RATE_GAP) {
                continue;
            }
            if (best == null || cravingRate - otherRate > best.cravingRate() - best.otherRate()) {
                best = new Finding(f, counts[0], counts[1], counts[2], counts[3], cravingRate, otherRate);
            }
        }
        return best;
    }

    /** Whether the factor preceded {@code day}; null when the factor's data is absent. */
    private static Boolean present(Factor f, LocalDate day, Map<LocalDate, DetectorInput.CheckinDayPoint> checkins,
                                   Map<LocalDate, DetectorInput.SleepPoint> sleep,
                                   Map<LocalDate, DetectorInput.MealDayPoint> meals) {
        return switch (f) {
            case ROVID_ALVAS -> {
                DetectorInput.SleepPoint s = sleep.get(day);
                yield s == null || s.durationH() == null ? null : s.durationH().doubleValue() < SHORT_SLEEP_H;
            }
            case MAGAS_STRESSZ -> {
                DetectorInput.CheckinDayPoint prev = checkins.get(day.minusDays(1));
                yield prev == null || prev.stress() == null ? null : prev.stress().doubleValue() >= HIGH_STRESS;
            }
            case KEVES_FEHERJE -> {
                DetectorInput.MealDayPoint prev = meals.get(day.minusDays(1));
                yield prev == null || prev.proteinG() == null || prev.proteinTarget() == null
                        || prev.proteinTarget().signum() <= 0 ? null
                        : prev.proteinG().doubleValue() < prev.proteinTarget().doubleValue() * LOW_PROTEIN_RATIO;
            }
        };
    }
}
