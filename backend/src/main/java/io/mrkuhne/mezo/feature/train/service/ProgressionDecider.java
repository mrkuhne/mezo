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
            if (slack < 0) { // grind: hit reps but harder than planned → consolidate
                return new Decision(Lever.HOLD, w, rp, null, null,
                    "Múlt hét RIR " + rir + " a cél alatt → tartás, konszolidálás");
            }
            int reps = Math.min(rp + 1, repMax); // double progression: build reps toward the top
            return new Decision(Lever.REP, w, reps, null, 1,
                "Múlt hét " + rp + " rep a tartományban → +1 rep");
        }
        // rp < repMin
        if (slack <= 0) { // too heavy AND at/over target effort → drop load
            BigDecimal base = round(w.subtract(inc), plateStep);
            return new Decision(Lever.WEIGHT, base, repMin, inc.negate(), null,
                "Múlt hét " + rp + " rep a cél alatt, grind → −" + strip(inc) + " kg");
        }
        return new Decision(Lever.HOLD, w, repMin, null, null, "Súly tart, cél a tartomány alja");
    }

    /**
     * Readiness "Könnyítsük" (Check-in 2.0, mezo-ck2): caps a decision at HOLD — never more weight
     * or reps than last week. An upward move (WEIGHT +, REP) becomes HOLD at last week's weight and
     * last week's reps (clamped into the recipe range); a move that is already a hold or lighter
     * (HOLD, WEIGHT −, DELOAD) is returned unchanged.
     */
    public static Decision capAtHold(Decision d, RefSet ref, int repMin, int repMax) {
        boolean up = d.lever() == Lever.REP
            || (d.lever() == Lever.WEIGHT && d.deltaKg() != null && d.deltaKg().signum() > 0);
        if (!up) {
            return d;
        }
        int reps = Math.max(repMin, Math.min(ref.reps(), repMax));
        return new Decision(Lever.HOLD, ref.weightKg(), reps, null, null, LIGHTENED_RATIONALE);
    }

    /** HU rationale of a readiness-held exercise. */
    public static final String LIGHTENED_RATIONALE = "Könnyített nap — a múlt heti súly marad";

    private static BigDecimal round(BigDecimal x, BigDecimal step) {
        BigDecimal rounded = x.divide(step, 0, RoundingMode.HALF_UP).multiply(step);
        return rounded.max(BigDecimal.ZERO).min(BigDecimal.valueOf(999));
    }

    private static String strip(BigDecimal x) {
        return x.stripTrailingZeros().toPlainString();
    }
}
