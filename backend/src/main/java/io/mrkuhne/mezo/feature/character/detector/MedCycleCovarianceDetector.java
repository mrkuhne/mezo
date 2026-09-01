package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Medication-cycle covariance (round 2, spec §2, §5) — ÉRZÉKENY. Buckets the daily check-in scales
 * by CYCLE DAY (days since the last dose, dose-anchored, never calendar-anchored) and reports the
 * bucket that diverges most from the cycle mean. This is the day-since-dose analysis GLP-1 trackers
 * productise, and it inherits their framing discipline: context, not measurement; description, not
 * diagnosis, and never anything resembling dosing advice.
 *
 * <p>Days whose last dose is older than a full cycle are marked {@code stale} by the read layer
 * (because {@code MedicationCycleService} clamps them for the Fuel UI) and are dropped here — a
 * clamped day would otherwise pile weeks of no-dose days into the last bucket.
 *
 * <p>Sensitivity is enforced at CLAIM level: the konzílium proposal prompt already marks
 * gyógyszerciklus topics {@code sensitive=true}, and the portrait writer / prompt assembler render
 * the ÉRZÉKENY marker. There is no code-level gate, so this summary's own wording must already be
 * neutral and purely descriptive.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class MedCycleCovarianceDetector implements CharacterDetector {

    private static final int MIN_USABLE_DAYS = 14;
    private static final int MIN_DAYS_PER_BUCKET = 2;
    private static final double MIN_DELTA_POINTS = 1.0;

    private record Metric(String key, String label, boolean higherIsBetter) {}

    private static final List<Metric> METRICS = List.of(
            new Metric("energy", "energia", true),
            new Metric("stress", "stressz", false),
            new Metric("body", "testi közérzet", true),
            new Metric("mental", "mentális tisztaság", true));

    @Override
    public String key() {
        return "med-cycle-covariance";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (in.trend().med() == null) {
            return List.of();
        }
        if (!DetectorGates.newCheckinData(in) && !DetectorGates.newDoseData(in)) {
            return List.of();
        }
        Finding today = finding(in, in.day());
        Finding yesterday = finding(in, in.day().minusDays(1));
        if (today == null || today.state().equals(yesterday == null ? "" : yesterday.state())) {
            return List.of();
        }
        String direction = today.delta() < 0 ? "alacsonyabb" : "magasabb";
        String summary = "A gyógyszerciklus " + today.cycleDay() + ". napján a(z) " + today.label()
                + " átlaga " + RoundTwoWindow.hu(BigDecimal.valueOf(Math.abs(today.delta())), 1)
                + " ponttal " + direction + " a ciklus átlagánál (" + today.bucketDays()
                + " ilyen nap, 8 hét).";
        return List.of(new DetectorSignal(key(), "doki", summary, 3));
    }

    private record Finding(String state, int cycleDay, String label, double delta, int bucketDays) {}

    private static Finding finding(DetectorInput in, LocalDate asOf) {
        Map<LocalDate, DetectorInput.CheckinDayPoint> checkins = new HashMap<>();
        for (DetectorInput.CheckinDayPoint c : in.trend().checkinDays()) {
            checkins.put(c.date(), c);
        }
        // cycleDay -> the day's check-ins, stale days dropped
        Map<Integer, List<DetectorInput.CheckinDayPoint>> buckets = new TreeMap<>();
        int usable = 0;
        for (DetectorInput.MedCycleDayPoint d : in.trend().med().days()) {
            if (d.stale() || d.date().isAfter(asOf)) {
                continue;
            }
            DetectorInput.CheckinDayPoint c = checkins.get(d.date());
            if (c == null) {
                continue;
            }
            buckets.computeIfAbsent(d.cycleDay(), k -> new ArrayList<>()).add(c);
            usable++;
        }
        if (usable < MIN_USABLE_DAYS) {
            return null;
        }
        Finding best = null;
        for (Metric metric : METRICS) {
            Double overall = mean(buckets.values().stream().flatMap(List::stream).toList(), metric);
            if (overall == null) {
                continue;
            }
            for (Map.Entry<Integer, List<DetectorInput.CheckinDayPoint>> e : buckets.entrySet()) {
                if (e.getValue().size() < MIN_DAYS_PER_BUCKET) {
                    continue;
                }
                Double bucketMean = mean(e.getValue(), metric);
                if (bucketMean == null) {
                    continue;
                }
                double delta = bucketMean - overall;
                if (Math.abs(delta) < MIN_DELTA_POINTS) {
                    continue;
                }
                if (best == null || Math.abs(delta) > Math.abs(best.delta())) {
                    best = new Finding(metric.key() + ":" + e.getKey() + ":"
                            + Math.round(delta * 10), e.getKey(), metric.label(), delta,
                            e.getValue().size());
                }
            }
        }
        return best;
    }

    private static Double mean(List<DetectorInput.CheckinDayPoint> rows, Metric metric) {
        double sum = 0;
        int n = 0;
        for (DetectorInput.CheckinDayPoint c : rows) {
            BigDecimal v = switch (metric.key()) {
                case "energy" -> c.energy();
                case "stress" -> c.stress();
                case "body" -> c.body();
                default -> c.mental();
            };
            if (v != null) {
                sum += v.doubleValue();
                n++;
            }
        }
        return n == 0 ? null : sum / n;
    }
}
