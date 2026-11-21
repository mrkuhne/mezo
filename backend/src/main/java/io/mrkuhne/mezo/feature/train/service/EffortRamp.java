package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties;
import java.util.List;

/**
 * Pure policy: lowers the target reps-in-reserve across a block's loading weeks and raises it in a
 * deload week (training style, mezo-r36n9.79). Loading weeks are those whose phase is not "Deload".
 */
public final class EffortRamp {

    private EffortRamp() {}

    /**
     * @param week 1-based week of the block; outside the curve (or no curve) the base is returned
     * @param free true on a free exercise: the result never drops below the configured floor
     */
    public static int effectiveReserve(int base, int week, List<String> phaseCurve, boolean free,
                                       TrainStyleProperties.Ramp cfg) {
        int floor = free ? cfg.freeFloor() : 0;
        if (phaseCurve == null || week < 1 || week > phaseCurve.size()) {
            return Math.max(base, floor);
        }
        if (isFlatMev(phaseCurve)) {
            return Math.max(base, floor);
        }
        int result;
        if (isDeload(phaseCurve.get(week - 1))) {
            result = base + cfg.deloadDelta();
        } else {
            int loading = 0;
            int position = 0;
            for (int i = 0; i < phaseCurve.size(); i++) {
                if (isDeload(phaseCurve.get(i))) continue;
                loading++;
                if (i < week) position++;
            }
            if (position <= (loading + 2) / 3) {
                result = base;
            } else if (position < loading) {
                result = base - cfg.middleDelta();
            } else {
                result = base - cfg.lastWeekDelta();
            }
        }
        return Math.max(Math.max(result, 0), floor);
    }

    /** A consolidation curve (no deload, every week MEV) never ramps. */
    private static boolean isFlatMev(List<String> curve) {
        return curve.stream().allMatch(p -> p != null && p.equalsIgnoreCase("MEV"));
    }

    private static boolean isDeload(String phase) {
        return phase != null && phase.equalsIgnoreCase("Deload");
    }
}
