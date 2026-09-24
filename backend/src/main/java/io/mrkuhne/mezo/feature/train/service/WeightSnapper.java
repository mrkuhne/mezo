package io.mrkuhne.mezo.feature.train.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Per-machine weight memory (mezo-bk7l2) — pure, no Spring, no DB. Moves a prescribed working
 * weight that is KNOWN to be missing on the exercise's machine onto the nearest available one,
 * with the reps recomputed at equal effort (the Java twin of the FE {@code repEquivalence.ts}).
 *
 * <p>Candidates: weights ever logged on the exercise first (proven to exist), else the plate grid
 * around the base (untried, may exist). The move keeps its DIRECTION relative to last session's
 * reference weight — an upward step never snaps back onto (or below) the reference, which would
 * re-prescribe the same set forever (the Liftosaur #338 stall). Of the lighter/heavier candidate
 * the one whose reps sit inside the rep range wins; if both or neither do, the smaller overshoot,
 * ties to the lighter.
 */
public final class WeightSnapper {

    private WeightSnapper() {}

    /** Beyond this relative swing the Epley round-trip is guesswork (same guard as the FE). */
    private static final double MAX_SWING = 0.2;
    private static final int GRID_STEPS = 4;

    public record Snap(BigDecimal weightKg, int reps) {}

    public static Optional<Snap> snap(BigDecimal base, int reps, Integer rir, int repMin, int repMax,
                                      BigDecimal refWeight, Set<BigDecimal> gaps, Set<BigDecimal> used,
                                      BigDecimal plateStep) {
        BigDecimal b = norm(base);
        Set<BigDecimal> gap = normAll(gaps);
        if (!gap.contains(b)) {
            return Optional.empty();
        }
        int dir = b.compareTo(norm(refWeight));
        if (dir == 0) {
            return Optional.empty();
        }
        BigDecimal ref = norm(refWeight);
        Predicate<BigDecimal> allowed = w -> w.signum() > 0 && !gap.contains(w)
            && (dir > 0 ? w.compareTo(ref) > 0 : w.compareTo(ref) < 0);
        Set<BigDecimal> known = normAll(used).stream().filter(allowed).collect(Collectors.toSet());

        BigDecimal lower = known.stream().filter(w -> w.compareTo(b) < 0).max(Comparator.naturalOrder())
            .orElseGet(() -> grid(b, plateStep, -1).filter(allowed).findFirst().orElse(null));
        BigDecimal higher = known.stream().filter(w -> w.compareTo(b) > 0).min(Comparator.naturalOrder())
            .orElseGet(() -> grid(b, plateStep, 1).filter(allowed).findFirst().orElse(null));

        Snap lo = candidate(b, reps, rir, lower);
        Snap hi = candidate(b, reps, rir, higher);
        if (lo == null || hi == null) {
            return Optional.ofNullable(lo != null ? lo : hi);
        }
        return Optional.of(overshoot(hi, repMin, repMax) < overshoot(lo, repMin, repMax) ? hi : lo);
    }

    /** Reps at {@code weightKg} for the same effort as {@code targetKg × reps @ rir}; null past the guard. */
    public static Integer equivalentReps(BigDecimal targetKg, int reps, Integer rir, BigDecimal weightKg) {
        double t = targetKg.doubleValue();
        double w = weightKg.doubleValue();
        if (t <= 0 || w <= 0) {
            return null;
        }
        if (norm(targetKg).compareTo(norm(weightKg)) == 0) {
            return reps;
        }
        if (Math.abs(w / t - 1) > MAX_SWING) {
            return null;
        }
        int r = rir != null ? rir : 0;
        double e1rm = t * (1 + (reps + r) / 30.0);
        long out = Math.round(30 * (e1rm / w - 1) - r);
        return (int) Math.min(50, Math.max(1, out));
    }

    /**
     * A logged weight counts as evidence that the prescribed one is missing only when it is a NEAR
     * swap: at most one load increment, or 10 % of the prescription, away. A bigger move is a choice.
     */
    public static boolean isNearSwap(BigDecimal prescribed, BigDecimal logged, BigDecimal increment,
                                     BigDecimal nearFraction) {
        BigDecimal delta = norm(prescribed).subtract(norm(logged)).abs();
        if (delta.signum() == 0) {
            return false;
        }
        BigDecimal limit = increment.max(prescribed.multiply(nearFraction));
        return delta.compareTo(limit) <= 0;
    }

    /** Two-decimal key so 95, 95.0 and 95.00 are one weight (numeric(6,2) on the wire). */
    public static BigDecimal norm(BigDecimal x) {
        return x.setScale(2, RoundingMode.HALF_UP);
    }

    private static Set<BigDecimal> normAll(Set<BigDecimal> xs) {
        return xs.stream().map(WeightSnapper::norm).collect(Collectors.toSet());
    }

    /** The plate-grid multiples strictly beyond {@code b} in direction {@code sign}, nearest first. */
    private static Stream<BigDecimal> grid(BigDecimal b, BigDecimal step, int sign) {
        BigDecimal first = sign < 0
            ? b.divide(step, 0, RoundingMode.CEILING).subtract(BigDecimal.ONE).multiply(step)
            : b.divide(step, 0, RoundingMode.FLOOR).add(BigDecimal.ONE).multiply(step);
        return Stream.iterate(norm(first), w -> norm(w.add(step.multiply(BigDecimal.valueOf(sign)))))
            .limit(GRID_STEPS);
    }

    private static Snap candidate(BigDecimal base, int reps, Integer rir, BigDecimal w) {
        if (w == null) {
            return null;
        }
        Integer r = equivalentReps(base, reps, rir, w);
        return r == null ? null : new Snap(w, r);
    }

    private static int overshoot(Snap s, int repMin, int repMax) {
        return s.reps() < repMin ? repMin - s.reps() : Math.max(0, s.reps() - repMax);
    }
}
