package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * One home for the Epley estimated-1RM formula and its eligibility rule (Titanium T2). No
 * Spring, no DB — given a weight/reps pair (or a logged {@link ExerciseSetEntity}), decides
 * whether an e1RM estimate makes sense and computes it. Never throws: out-of-range or missing
 * inputs return {@code null}/{@code false} instead of raising.
 */
public final class OneRepMax {

    private OneRepMax() {}

    /** Reps above this are too high-rep for a trustworthy Epley estimate (product decision). */
    public static final int REP_CAP = 12;

    private static final BigDecimal THIRTY = BigDecimal.valueOf(30L);

    /**
     * Epley e1RM: weight × (30 + reps) / 30, scale 4 HALF_UP. Returns {@code null} for
     * null/non-positive weight, null/{@code < 1} reps, or {@code reps > REP_CAP}.
     */
    public static BigDecimal estimate(BigDecimal weightKg, Integer reps) {
        if (weightKg == null || weightKg.signum() <= 0) {
            return null;
        }
        if (reps == null || reps < 1 || reps > REP_CAP) {
            return null;
        }
        return weightKg.multiply(BigDecimal.valueOf(30L + reps)).divide(THIRTY, 4, RoundingMode.HALF_UP);
    }

    /** Whether a logged set is eligible for an e1RM estimate. */
    public static boolean eligible(ExerciseSetEntity set) {
        return "working".equals(set.getKind())
            && !set.isSkipped()
            && set.getWeightKg() != null
            && set.getWeightKg().signum() > 0
            && set.getReps() != null
            && set.getReps() >= 1
            && set.getReps() <= REP_CAP;
    }
}
