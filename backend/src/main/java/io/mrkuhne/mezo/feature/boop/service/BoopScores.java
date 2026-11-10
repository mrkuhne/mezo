package io.mrkuhne.mezo.feature.boop.service;

import io.mrkuhne.mezo.feature.boop.config.BoopProperties;
import java.time.LocalTime;

/**
 * The five Boop scores of a day (Boop S3, mezo-r36n9.7) — pure, no Spring. Formulas are product
 * calls documented in {@code docs/features/boop-ios.md}. The sleep formula mirrors
 * {@code DayEvaluationEngine#sleepDim} (private there): duration vs target 0.7 + quality
 * ((q-1)/9) 0.3; without a quality the duration ratio alone.
 */
public class BoopScores {

    /** Default of {@code mezo.boop.nights-needed}: logged nights before Forma is computed. */
    static final int MIN_NIGHTS_FOR_FORMA = 14;
    private static final double MIN_FUEL_SHARE = 0.05;
    private static final LocalTime FUEL_FROM = LocalTime.of(7, 0);
    private static final LocalTime FUEL_TO = LocalTime.of(21, 0);

    /** {@code state}: good (>=70), okay (50-69), tired (<50) or learning (forma unknown). */
    public record Scores(Integer forma, Integer alvas, Integer mozgas, Integer fuel, Integer pulzus,
                         Integer pulzusBpm, String state) {}

    private final int stepsGoal;
    private final int nightsNeeded;

    public BoopScores(int stepsGoal) {
        this(stepsGoal, MIN_NIGHTS_FOR_FORMA);
    }

    public BoopScores(int stepsGoal, int nightsNeeded) {
        this.stepsGoal = stepsGoal;
        this.nightsNeeded = nightsNeeded;
    }

    public BoopScores(BoopProperties props) {
        this(props.stepsGoal(), props.nightsNeeded());
    }

    public Scores compute(BoopDay d, LocalTime now) {
        Integer alvas = alvas(d);
        Integer pulzus = null;
        if (d.restingHr() != null && d.baselineRestingHr() != null) {
            pulzus = clamp(Math.round(70 + (d.baselineRestingHr() - d.restingHr()) * 6));
        }
        int steps = d.steps() == null ? 0 : d.steps();
        // A non-positive goal is a misconfiguration: no score rather than a divide-by-zero 100.
        Integer mozgas = stepsGoal <= 0 ? null : clamp(Math.round(steps * 100.0 / stepsGoal));
        Integer fuel = fuel(d, now);

        Integer forma = null;
        if (alvas != null && d.nightsKnown() >= nightsNeeded) {
            double load = 100 - Math.min(60, d.yesterdayLoad().minutes() / 2.0); // unrounded; only forma rounds
            double p = pulzus == null ? 70 : pulzus; // no resting HR: neutral
            forma = (int) Math.round(0.45 * alvas + 0.35 * p + 0.20 * load);
        }
        return new Scores(forma, alvas, mozgas, fuel, pulzus, d.restingHr(), stateOf(forma));
    }

    static String stateOf(Integer forma) {
        return forma == null ? "learning" : forma >= 70 ? "good" : forma >= 50 ? "okay" : "tired";
    }

    private static Integer alvas(BoopDay d) {
        if (d.sleep() == null || d.sleepTargetMin() <= 0) return null;
        double ratio = Math.min(1.0, d.sleep().totalMin() / (double) d.sleepTargetMin());
        Integer q = d.sleep().quality();
        double v = q == null ? ratio : 0.7 * ratio + 0.3 * Math.max(0, Math.min(1, (q - 1) / 9.0));
        return clamp(Math.round(v * 100));
    }

    private static Integer fuel(BoopDay d, LocalTime now) {
        if (!now.isAfter(FUEL_FROM) || d.kcalTarget() <= 0) return null;
        double span = java.time.Duration.between(FUEL_FROM, FUEL_TO).toMinutes();
        double elapsed = java.time.Duration.between(FUEL_FROM, now).toMinutes();
        double share = Math.min(1.0, elapsed / span);
        // Too early to judge: just past 07:00 the expected share is ~0 and any breakfast would read
        // as 100 %. Below 5 % of the 07:00-21:00 span (07:42) there is no fuel score yet.
        if (share < MIN_FUEL_SHARE) return null;
        return clamp(Math.round(d.kcalSoFar() / (d.kcalTarget() * share) * 100));
    }

    private static int clamp(long v) {
        return (int) Math.max(0, Math.min(100, v));
    }
}
