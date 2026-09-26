package io.mrkuhne.mezo.feature.companion.reflection.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * S4 (mezo-d6ivw.4): tagged-day vs untagged-day effect size as Cliff's delta — non-parametric,
 * tie- and outlier-robust, valid at the 10–60 point sizes a 60-day personal window yields
 * (spec §S4 delta, prior art: Exist.io strength/confidence split + Bearable's with/without
 * framing). Pure function in the {@code PatternGate} tradition: no Spring, no DB, no clock.
 *
 * <p>Strength (|δ| band) and confidence (subject-day tier) are decided HERE, in code, and
 * independently of each other — a strong effect on few days is "erős együttjárás, gyenge
 * bizonyosság", never averaged into one number.
 */
public final class EffectLinkCalculator {

    public static final int MIN_SUBJECT_DAYS = 5;
    public static final int MIN_COMPLEMENT_DAYS = 10;
    public static final double NEGLIGIBLE = 0.147;
    public static final double SMALL = 0.33;
    public static final double MEDIUM = 0.474;
    public static final int TIER_MEDIUM_MIN = 8;
    public static final int TIER_STRONG_MIN = 16;

    public record Effect(double cliffsDelta, double meanDiff, int subjectDays,
                         int complementDays, String strengthBand, String confidenceTier) {}

    private EffectLinkCalculator() {}

    /**
     * Splits the metric series into subject-day and complement-day samples; a day missing
     * from the series is not a data point on either side. Empty = below gate or negligible.
     */
    public static Optional<Effect> compute(Set<LocalDate> subjectDays,
                                           Map<LocalDate, Double> metricSeries) {
        List<Double> subject = new ArrayList<>();
        List<Double> complement = new ArrayList<>();
        metricSeries.forEach((day, value) ->
                (subjectDays.contains(day) ? subject : complement).add(value));
        if (subject.size() < MIN_SUBJECT_DAYS || complement.size() < MIN_COMPLEMENT_DAYS) {
            return Optional.empty();
        }
        long wins = 0;
        long losses = 0;
        for (double s : subject) {
            for (double c : complement) {
                if (s > c) wins++;
                else if (s < c) losses++;
            }
        }
        double delta = (wins - losses) / (double) (subject.size() * complement.size());
        if (Math.abs(delta) < NEGLIGIBLE) {
            return Optional.empty();
        }
        double meanDiff = mean(subject) - mean(complement);
        return Optional.of(new Effect(delta, meanDiff, subject.size(), complement.size(),
                band(Math.abs(delta)), tier(subject.size())));
    }

    private static String band(double absDelta) {
        return absDelta < SMALL ? "enyhe" : absDelta < MEDIUM ? "kozepes" : "eros";
    }

    private static String tier(int subjectDays) {
        return subjectDays >= TIER_STRONG_MIN ? "eros"
                : subjectDays >= TIER_MEDIUM_MIN ? "kozepes" : "gyenge";
    }

    private static double mean(List<Double> values) {
        return values.stream().mapToDouble(Double::doubleValue).average().orElseThrow();
    }
}
