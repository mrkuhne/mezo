package io.mrkuhne.mezo.feature.train.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Pure medal rules (spec 2026-07-30-medal-collection-design.md §6). No Spring, no DB — given one
 * candidate set and every comparable set logged strictly before it (same exercise identity,
 * working, reps present), decides which medals that set earns.
 *
 * <p>Medals are DERIVED, never stored: this class is replayed over the set history rather than
 * consulted once and persisted, so editing a past set silently corrects the whole medal history.
 *
 * <p>Invariants: strict {@code >} (a tie earns nothing); a candidate with no comparable prior
 * earns no RECORD medal (the baseline is established silently); {@code TARGET_HIT} is
 * history-independent and compares only against the set's own snapshotted prescription.
 */
public final class MedalEvaluator {

    private static final BigDecimal THIRTY = new BigDecimal("30");

    private MedalEvaluator() {}

    public enum MedalKind { WEIGHT, REPS_AT_WEIGHT, E1RM, SESSION_VOLUME, TARGET_HIT }

    /** One comparable set already logged before the candidate. */
    public record Prior(BigDecimal weightKg, int reps) {}

    /** The set being judged. {@code targetWeightKg}/{@code targetReps} are null when unprescribed. */
    public record Candidate(BigDecimal weightKg, int reps, BigDecimal targetWeightKg, Integer targetReps) {}

    /** An earned medal. {@code previousValue} is null when nothing was beaten (TARGET_HIT). */
    public record Award(MedalKind kind, BigDecimal value, BigDecimal previousValue) {}

    public static List<Award> forSet(Candidate candidate, List<Prior> priors) {
        List<Award> awards = new ArrayList<>();
        BigDecimal w = candidate.weightKg();

        if (w != null) {
            BigDecimal bestWeight = priors.stream().map(Prior::weightKg)
                .filter(java.util.Objects::nonNull).max(BigDecimal::compareTo).orElse(null);
            if (bestWeight != null && w.compareTo(bestWeight) > 0) {
                awards.add(new Award(MedalKind.WEIGHT, w, bestWeight));
            }

            Integer bestRepsAtWeight = priors.stream()
                .filter(p -> p.weightKg() != null && p.weightKg().compareTo(w) == 0)
                .map(Prior::reps).max(Integer::compareTo).orElse(null);
            if (bestRepsAtWeight != null && candidate.reps() > bestRepsAtWeight) {
                awards.add(new Award(MedalKind.REPS_AT_WEIGHT,
                    BigDecimal.valueOf(candidate.reps()), BigDecimal.valueOf(bestRepsAtWeight)));
            }

            BigDecimal e1rm = epley(w, candidate.reps());
            BigDecimal bestE1rm = priors.stream()
                .filter(p -> p.weightKg() != null)
                .map(p -> epley(p.weightKg(), p.reps())).max(BigDecimal::compareTo).orElse(null);
            if (bestE1rm != null && e1rm.compareTo(bestE1rm) > 0) {
                awards.add(new Award(MedalKind.E1RM,
                    e1rm.setScale(1, RoundingMode.HALF_UP), bestE1rm.setScale(1, RoundingMode.HALF_UP)));
            }
        }

        if (candidate.targetWeightKg() != null && candidate.targetReps() != null
            && w != null && w.compareTo(candidate.targetWeightKg()) >= 0
            && candidate.reps() >= candidate.targetReps()) {
            awards.add(new Award(MedalKind.TARGET_HIT, BigDecimal.valueOf(candidate.reps()), null));
        }
        return awards;
    }

    /** Session-scoped: null when there is no prior session or this one does not beat it. */
    public static Award sessionVolume(BigDecimal sessionVolume, BigDecimal bestPriorSessionVolume) {
        if (sessionVolume == null || bestPriorSessionVolume == null
            || sessionVolume.compareTo(bestPriorSessionVolume) <= 0) {
            return null;
        }
        return new Award(MedalKind.SESSION_VOLUME, sessionVolume, bestPriorSessionVolume);
    }

    /** Epley e1RM: weight × (30 + reps) / 30, scale 4 HALF_UP (matches ExerciseRecordService). */
    public static BigDecimal epley(BigDecimal weightKg, int reps) {
        return weightKg.multiply(BigDecimal.valueOf(30L + reps)).divide(THIRTY, 4, RoundingMode.HALF_UP);
    }
}
