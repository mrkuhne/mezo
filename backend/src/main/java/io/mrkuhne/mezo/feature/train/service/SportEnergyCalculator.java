package io.mrkuhne.mezo.feature.train.service;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * Personalised MET kcal for a logged sport or run session — our own deterministic arithmetic
 * (ported from the Titanium prototype {@code sport-state.js:6-144}), never AI, never a model call.
 *
 * <p>{@code kcal = met * 3.5 * weightKg / 200 * minutes * personalFactor}, where
 * {@code personalFactor = sexFactor (F: 0.94) * ageFactor (−0.2%/yr past 30, clamped 0.90–1.05)
 * * leanFactor (from body-fat %, clamped 0.92–1.08; 1 when unknown)}. The same body weight burns
 * differently with a different amount of lean mass, and resting metabolism drifts slowly with age.
 *
 * <p>Every method returns {@link Optional#empty()} rather than a number when an input the estimate
 * genuinely needs is missing (weight, a positive duration) — the caller persists NULL, never 0, so
 * no surface can present "0 kcal" as if it were a measurement.
 *
 * <p>The wire carries only the sport, the minutes and the felt intensity, so the per-sport MET
 * table folds the prototype's mode pickers into the intensity scale (intensity 5 = the lighter
 * mode, 10 = the harder one) and evaluates the pace/climb/stroke formulas at the prototype's own
 * default session (bike 25 km/h flat, swim freestyle, hike 300 m of climb). The pace formulas
 * themselves ({@link #runMet}, {@link #bikeMet}, {@link #hikeMet}) are ported verbatim and public,
 * so a later contract that carries distance or climb can feed them the real numbers.
 */
public final class SportEnergyCalculator {

    private SportEnergyCalculator() {}

    /** The prototype's moderate-effort fallback — "other" and any unknown sport id. */
    private static final double DEFAULT_MET = 5.0;

    /** Personal correction on top of the MET formula. */
    public static double personalFactor(String sex, int age, BigDecimal bodyFatPct) {
        double sexFactor = isFemale(sex) ? 0.94 : 1.0;
        double ageFactor = Math.min(1.05, Math.max(0.90, 1 - (age - 30) * 0.002));
        double leanFactor = bodyFatPct == null
            ? 1.0
            : Math.min(1.08, Math.max(0.92, 1 + (25 - bodyFatPct.doubleValue()) * 0.004));
        return sexFactor * ageFactor * leanFactor;
    }

    /** Running earns its MET from the pace actually held, not from a label (prototype :29). */
    public static double runMet(double kmh) {
        return kmh > 0 ? Math.min(19, Math.max(4, kmh * 1.02 + 0.3)) : 0;
    }

    /** Cycling likewise (prototype :30); the terrain multiplier is applied by the caller. */
    public static double bikeMet(double kmh) {
        return kmh > 0 ? Math.min(16, Math.max(3.5, kmh * 0.42 + 0.6)) : 0;
    }

    /** Walking sits near 4 MET; every 100 m of climb adds roughly a third of a MET (prototype :104). */
    public static double hikeMet(int climbM) {
        return Math.min(11, 4 + Math.max(0, climbM) / 100.0 * 0.35);
    }

    /**
     * The MET of one session of {@code sport} at the felt {@code intensity} (1–10, nullable → the
     * prototype's default for that sport).
     */
    public static double metFor(String sport, Integer intensity) {
        if (sport == null) {
            return DEFAULT_MET;
        }
        return switch (sport) {
            // Mode pickers folded into the intensity scale: intensity 5 = the lighter mode's MET,
            // intensity 10 = the harder mode's. Constants are the prototype's mode METs.
            case "volleyball" -> modeScale(intensity, 7, 4.5, 6.5);   // edzés 4.5 / meccs 6.5
            case "football" -> modeScale(intensity, 7, 7.0, 10.0);    // edzés 7 / meccs 10
            case "basketball" -> modeScale(intensity, 7, 6.5, 8.0);   // edzés 6.5 / meccs 8
            case "tennis" -> modeScale(intensity, 6, 5.0, 7.3);       // páros 5 / egyes 7.3
            case "trx" -> 3.5 + intensityOr(intensity, 7) * 0.42;
            case "cross" -> 5 + intensityOr(intensity, 8) * 0.5;
            case "swim" -> 8.3;                       // "gyors" (freestyle), the prototype default
            case "bike" -> bikeMet(25.0);             // 25 km on flat terrain in an hour
            case "hike" -> hikeMet(300);              // the prototype's default 300 m of climb
            default -> DEFAULT_MET;                   // "other" and anything unknown
        };
    }

    /**
     * The estimate for a logged sport session, or empty when the athlete's weight or a positive
     * duration is unknown.
     */
    public static Optional<Integer> estimate(String sport, int durationMin, Integer intensity,
        BigDecimal weightKg, String sex, int age, BigDecimal bodyFatPct) {
        return estimateWithMet(metFor(sport, intensity), durationMin, weightKg, sex, age, bodyFatPct);
    }

    /**
     * The same estimate from an already-known MET — the run path, whose MET comes from the pace
     * ({@link #runMet}) rather than from the sport table.
     */
    public static Optional<Integer> estimateWithMet(double met, int durationMin, BigDecimal weightKg,
        String sex, int age, BigDecimal bodyFatPct) {
        if (weightKg == null || durationMin <= 0 || met <= 0) {
            return Optional.empty();
        }
        double base = met * 3.5 * weightKg.doubleValue() / 200 * durationMin;
        return Optional.of((int) Math.round(base * personalFactor(sex, age, bodyFatPct)));
    }

    private static boolean isFemale(String sex) {
        return sex != null && ("F".equalsIgnoreCase(sex) || "female".equalsIgnoreCase(sex));
    }

    private static int intensityOr(Integer intensity, int fallback) {
        return intensity == null ? fallback : Math.max(1, Math.min(10, intensity));
    }

    /**
     * Interpolates between the two mode METs over the 1–10 intensity scale: {@code light} at
     * intensity 5, {@code hard} at 10, extrapolated downward but never below {@code light - 1}.
     */
    private static double modeScale(Integer intensity, int fallback, double light, double hard) {
        double i = intensityOr(intensity, fallback);
        double met = light + (i - 5) * (hard - light) / 5.0;
        return Math.min(hard, Math.max(light - 1, met));
    }
}
