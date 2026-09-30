package io.mrkuhne.mezo.feature.train.service;

import java.math.BigDecimal;

/**
 * Pure policy for the comedown (recovery period) ramp: lighter loads and reduced reps-in-reserve
 * on the return to training (Kihagyás S2, "kímélő mód", mezo-q4xt2.2).
 *
 * <p>Produces softened set counts, conservative RIR floors, and a load factor for scaling
 * estimated 1RMs.
 */
public final class ComebackRamp {

    private ComebackRamp() {}

    /** Load scale factor on 1RM estimates during recovery ramp (e.g. 0.90 = 90% of normal). */
    public static final BigDecimal LOAD_FACTOR = new BigDecimal("0.90");

    /**
     * Reduce a planned set count for the recovery ramp.
     *
     * <p>Logic: {@code max(1, sets - max(1, round(sets/3.0)))}.
     *
     * <ul>
     *   <li>1 → 1
     *   <li>2 → 1
     *   <li>3 → 2
     *   <li>4 → 3
     *   <li>5 → 3
     *   <li>6 → 4
     * </ul>
     */
    public static int lightenedSets(int sets) {
        int reduction = Math.max(1, Math.round(sets / 3.0f));
        return Math.max(1, sets - reduction);
    }

    /**
     * Enforce a conservative floor on target reps-in-reserve (RIR) during recovery ramp.
     *
     * <p>Logic: {@code max(3, targetRir == null ? 0 : targetRir)}.
     *
     * <ul>
     *   <li>null → 3
     *   <li>1 → 3
     *   <li>3 → 3
     *   <li>4 → 4
     *   <li>5 → 5
     * </ul>
     */
    public static int rirFloor(Integer targetRir) {
        int value = targetRir == null ? 0 : targetRir;
        return Math.max(3, value);
    }
}
