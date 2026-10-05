package io.mrkuhne.mezo.feature.train.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

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

    /**
     * The proportional step (mezo-bk7sn): the wanted jump as a fraction of the load, the largest
     * jump prescribed as one step (normal / big-reserve), the RIR surplus that counts as a big
     * reserve, how many reps past the range top are built before a too-big jump is forced, and
     * the plate grid that stands in for the machine's unknown ladder.
     */
    public record StepPolicy(BigDecimal stepPercent, BigDecimal maxJump, BigDecimal maxJumpReserve,
                             int reserveSlack, int repOverflow, BigDecimal plateStep) {}

    public static Decision decide(RefSet ref, int repMin, int repMax, int targetRir, StepPolicy policy,
                                  Set<BigDecimal> used, Set<BigDecimal> gaps, boolean deloadWeek) {
        int rp = ref.reps();
        int rir = ref.rir() != null ? ref.rir() : targetRir; // null RIR → neutral slack
        int slack = rir - targetRir;
        BigDecimal w = ref.weightKg();

        if (deloadWeek) {
            BigDecimal base = round(w.multiply(new BigDecimal("0.9")), policy.plateStep());
            return new Decision(Lever.DELOAD, base, repMin, base.subtract(w), null,
                "Deload hét — visszaveszünk");
        }
        if (rp >= repMax) {
            return up(ref, rp, rir, slack, repMin, repMax, targetRir, policy, used, gaps);
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
        if (slack <= 0) { // too heavy AND at/over target effort → drop load, if the ladder allows
            return down(ref, rp, rir, slack, repMin, repMax, targetRir, policy, used, gaps);
        }
        return new Decision(Lever.HOLD, w, repMin, null, null, "Súly tart, cél a tartomány alja");
    }

    /**
     * Top of the range. The candidate is the real weight above {@code w} nearest to a
     * {@code stepPercent} jump (one further on a big reserve). A jump within the cap is taken at
     * equal-effort reps; a bigger one first builds reps past the range top (RP / Alpha
     * Progression: reps before a disproportionate load jump), then is forced.
     */
    private static Decision up(RefSet ref, int rp, int rir, int slack, int repMin, int repMax, int targetRir,
                               StepPolicy policy, Set<BigDecimal> used, Set<BigDecimal> gaps) {
        BigDecimal w = ref.weightKg();
        List<BigDecimal> above = ladder(w, 1, policy.plateStep(), used, gaps);
        if (above.isEmpty()) {
            return new Decision(Lever.HOLD, w, repMax, null, null, "Súly tart — nincs nehezebb súly");
        }
        BigDecimal wanted = w.multiply(BigDecimal.ONE.add(policy.stepPercent()));
        int i = nearest(above, wanted);
        BigDecimal c1 = above.get(i);
        if (slack >= policy.reserveSlack() && i + 1 < above.size()
            && fits(w, above.get(i + 1), policy.maxJumpReserve())) {
            BigDecimal c2 = above.get(i + 1);
            return weightUp(ref, rir, c2, repMin, repMax, targetRir,
                "Múlt hét " + rp + "×" + fmt(w) + " kg, RIR " + rir + " — sok tartalék → +"
                    + fmt(c2.subtract(w)) + " kg (+" + pct(w, c2) + "%)");
        }
        if (fits(w, c1, policy.maxJump())) {
            return weightUp(ref, rir, c1, repMin, repMax, targetRir,
                "Múlt hét " + rp + "×" + fmt(w) + " kg a tartomány tetején → +"
                    + fmt(c1.subtract(w)) + " kg (+" + pct(w, c1) + "%)");
        }
        if (rp < repMax + policy.repOverflow()) {
            int reps = rp + 1;
            return new Decision(Lever.REP, w, reps, null, 1,
                "A " + fmt(c1) + " kg +" + pct(w, c1) + "% ugrás lenne → előbb " + reps
                    + " ismétlés " + fmt(w) + " kg-mal");
        }
        int reps = clamp(equalEffortReps(w, rp, rir, targetRir, c1), Math.max(1, repMin - policy.repOverflow()), repMax);
        return new Decision(Lever.WEIGHT, c1, reps, c1.subtract(w), null,
            rp + " ismétlés " + fmt(w) + " kg-mal megvan → " + fmt(c1) + " kg (+" + pct(w, c1) + "%)");
    }

    private static Decision weightUp(RefSet ref, int rir, BigDecimal base, int repMin, int repMax,
                                     int targetRir, String rationale) {
        BigDecimal w = ref.weightKg();
        int reps = clamp(equalEffortReps(w, ref.reps(), rir, targetRir, base), repMin, repMax);
        return new Decision(Lever.WEIGHT, base, reps, base.subtract(w), null, rationale);
    }

    /**
     * Below the range at/over target effort. The candidate is the real weight below {@code w}
     * nearest to a {@code stepPercent} drop. When even that drop is beyond the cap and the miss
     * is within {@code repOverflow} reps, the weight stays and reps are built from below — the
     * mirror of the up branch, so a forced jump never ping-pongs back down.
     */
    private static Decision down(RefSet ref, int rp, int rir, int slack, int repMin, int repMax, int targetRir,
                                 StepPolicy policy, Set<BigDecimal> used, Set<BigDecimal> gaps) {
        BigDecimal w = ref.weightKg();
        List<BigDecimal> below = ladder(w, -1, policy.plateStep(), used, gaps);
        BigDecimal wanted = w.multiply(BigDecimal.ONE.subtract(policy.stepPercent()));
        BigDecimal d = below.isEmpty() ? null : below.get(nearest(below, wanted));
        if (d == null || (!fits(w, d, policy.maxJump()) && rp >= repMin - policy.repOverflow())) {
            String what = d == null ? "Nincs könnyebb súly" : "A " + fmt(d) + " kg −" + pct(w, d) + "% lenne";
            if (slack == 0) {
                return new Decision(Lever.REP, w, rp + 1, null, 1,
                    what + " → maradunk, " + (rp + 1) + " ismétlés a cél");
            }
            return new Decision(Lever.HOLD, w, rp, null, null, what + " → maradunk, " + rp + " ismétlés a cél");
        }
        int reps = clamp(equalEffortReps(w, rp, rir, targetRir, d), repMin, repMax);
        return new Decision(Lever.WEIGHT, d, reps, d.subtract(w), null,
            "Múlt hét " + rp + " rep a cél alatt, grind → −" + fmt(w.subtract(d)) + " kg");
    }

    /**
     * Reps at {@code base} for the same effort as {@code w × reps @ rir}, landing on the TARGET
     * RIR (Epley both ways, like {@link WeightSnapper#equivalentReps}); at least 1.
     */
    public static int equalEffortReps(BigDecimal w, int reps, Integer rir, int targetRir, BigDecimal base) {
        int r = rir != null ? rir : targetRir;
        double e1rm = w.doubleValue() * (1 + (reps + r) / 30.0);
        long out = Math.round(30 * (e1rm / base.doubleValue() - 1) - targetRir);
        return (int) Math.max(1, Math.min(50, out));
    }

    /**
     * The real weights strictly beyond {@code w} in direction {@code sign}, nearest first: every
     * weight ever logged on the exercise plus the plate grid (the machine's ladder is not
     * stored), minus the weights known to be missing (mezo-bk7l2). Bounded to ±50 % of {@code w}.
     */
    private static List<BigDecimal> ladder(BigDecimal w, int sign, BigDecimal step,
                                           Set<BigDecimal> used, Set<BigDecimal> gaps) {
        BigDecimal ref = WeightSnapper.norm(w);
        Set<BigDecimal> gap = new HashSet<>();
        gaps.forEach(g -> gap.add(WeightSnapper.norm(g)));
        BigDecimal lo = ref.multiply(new BigDecimal("0.5"));
        BigDecimal hi = ref.multiply(new BigDecimal("1.5")).add(step.multiply(BigDecimal.valueOf(2)))
            .min(BigDecimal.valueOf(999));
        TreeSet<BigDecimal> out = new TreeSet<>();
        used.forEach(u -> out.add(WeightSnapper.norm(u)));
        for (BigDecimal x = WeightSnapper.norm(step); x.compareTo(hi) <= 0; x = WeightSnapper.norm(x.add(step))) {
            out.add(x);
        }
        List<BigDecimal> list = new ArrayList<>();
        for (BigDecimal x : sign > 0 ? out : out.descendingSet()) {
            boolean beyond = sign > 0 ? x.compareTo(ref) > 0 : x.compareTo(ref) < 0;
            boolean inBand = sign > 0 ? x.compareTo(hi) <= 0 : x.compareTo(lo) >= 0;
            if (beyond && inBand && x.signum() > 0 && !gap.contains(x)) {
                list.add(x);
            }
        }
        return list;
    }

    /** Index of the ladder entry nearest to {@code target}; a tie goes to the later (further) one. */
    private static int nearest(List<BigDecimal> ladder, BigDecimal target) {
        int best = 0;
        for (int i = 1; i < ladder.size(); i++) {
            if (ladder.get(i).subtract(target).abs().compareTo(ladder.get(best).subtract(target).abs()) <= 0) {
                best = i;
            }
        }
        return best;
    }

    private static boolean fits(BigDecimal w, BigDecimal c, BigDecimal cap) {
        return c.subtract(w).abs().compareTo(w.multiply(cap)) <= 0;
    }

    private static int pct(BigDecimal w, BigDecimal c) {
        return c.subtract(w).abs().multiply(BigDecimal.valueOf(100)).divide(w, 0, RoundingMode.HALF_UP).intValue();
    }

    private static int clamp(int x, int lo, int hi) {
        return Math.max(lo, Math.min(hi, x));
    }

    /** HU kg: no trailing zeros, decimal comma (62,5). */
    private static String fmt(BigDecimal x) {
        return x.stripTrailingZeros().toPlainString().replace('.', ',');
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

    /** HU rationale of a load-factor comeback session (Kihagyás S2 kímélő mód, mezo-q4xt2.2). */
    public static final String COMEBACK_RATIONALE = "Visszatérő edzés — kb. 10%-kal könnyebb";

    private static BigDecimal round(BigDecimal x, BigDecimal step) {
        BigDecimal rounded = x.divide(step, 0, RoundingMode.HALF_UP).multiply(step);
        return rounded.max(BigDecimal.ZERO).min(BigDecimal.valueOf(999));
    }

}
