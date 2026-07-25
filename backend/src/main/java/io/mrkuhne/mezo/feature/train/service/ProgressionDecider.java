package io.mrkuhne.mezo.feature.train.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Pure RIR-aware double-progression decision (spec §5.1). No Spring, no DB — given the last
 * completed WORKING reference set + the recipe bounds + whether this is a deload week, it
 * decides the lever, the working base weight, the working rep target, the signed deltas, and
 * the HU rationale. Weightless / first-session cases are handled by {@link SetRecommendationService},
 * never here (precondition: {@code ref.weightKg() != null}).
 */
public final class ProgressionDecider {

    private ProgressionDecider() {}

    public enum Lever { WEIGHT, REP, HOLD, DELOAD }

    public record RefSet(BigDecimal weightKg, int reps, Integer rir) {}

    public record Decision(Lever lever, BigDecimal base, int workingReps,
                           BigDecimal deltaKg, Integer deltaReps, String rationale) {}

    public static Decision decide(RefSet ref, int repMin, int repMax, int targetRir,
                                  BigDecimal inc, BigDecimal plateStep, boolean deloadWeek) {
        int rp = ref.reps();
        int rir = ref.rir() != null ? ref.rir() : targetRir; // null RIR → neutral slack
        int slack = rir - targetRir;
        BigDecimal w = ref.weightKg();

        if (deloadWeek) {
            BigDecimal base = round(w.multiply(new BigDecimal("0.9")), plateStep);
            return new Decision(Lever.DELOAD, base, repMin, base.subtract(w), null,
                "Deload hét — visszaveszünk");
        }
        if (rp >= repMax) {
            BigDecimal base = round(w.add(inc), plateStep);
            return new Decision(Lever.WEIGHT, base, repMin, inc, null,
                "Múlt hét " + rp + "×" + strip(w) + " kg a tartomány tetején → +" + strip(inc) + " kg");
        }
        if (rp >= repMin) {
            if (slack >= 1) {
                int reps = Math.min(rp + 1, repMax);
                return new Decision(Lever.REP, w, reps, null, 1,
                    "Múlt hét könnyen ment (RIR " + rir + ") → +1 rep");
            }
            return new Decision(Lever.HOLD, w, rp, null, null,
                "Múlt hét RIR " + rir + " a célon → tartás, konszolidálás");
        }
        // rp < repMin
        if (slack < 0) {
            BigDecimal base = round(w.subtract(inc), plateStep);
            return new Decision(Lever.WEIGHT, base, repMin, inc.negate(), null,
                "Múlt hét " + rp + " rep a cél alatt, grind → −" + strip(inc) + " kg");
        }
        return new Decision(Lever.HOLD, w, repMin, null, null, "Súly tart, cél a tartomány alja");
    }

    private static BigDecimal round(BigDecimal x, BigDecimal step) {
        BigDecimal rounded = x.divide(step, 0, RoundingMode.HALF_UP).multiply(step);
        return rounded.max(BigDecimal.ZERO).min(BigDecimal.valueOf(999));
    }

    private static String strip(BigDecimal x) {
        return x.stripTrailingZeros().toPlainString();
    }
}
