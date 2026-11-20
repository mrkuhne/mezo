package io.mrkuhne.mezo.feature.train.service;

/**
 * The weekly grind signal of one exercise (volume engine v2, spec §6.4; mezo-r36n9.115). Pure.
 *
 * <p>Unstyled run: the newest logged reserve is {@code gap} or more below the row's stored target. Styled run:
 * the same gap rule against the week's effective (ramped) reserve, or — when that reserve is 0–1 and the RIR too
 * noisy to read — the set landed two or more reps under what was prescribed (the ramped grind of
 * {@link ProgressionDecider}). Without the fix a target of 0–1 could never grind (mezo-s5sd4).
 */
public final class GrindRule {
    static final int REPS_SHORT = 2;

    private GrindRule() {}

    public static boolean unstyled(int rir, Integer storedTargetRir, int gap) {
        return storedTargetRir != null && rir <= storedTargetRir - gap;
    }

    public static boolean styled(int rir, int reps, Integer targetReps, int effectiveReserve, int gap) {
        if (rir <= effectiveReserve - gap) {
            return true;
        }
        return effectiveReserve <= 1 && targetReps != null && reps <= targetReps - REPS_SHORT;
    }
}
