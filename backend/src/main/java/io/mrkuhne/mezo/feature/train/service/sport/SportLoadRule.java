package io.mrkuhne.mezo.feature.train.service.sport;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * The one load scale of the Sport area (Boop Sport S2, mezo-r36n9.202, spec §6): <b>session-RPE × minutes</b>
 * (Foster et al. 2001) for both layers, so a volleyball evening and a gym morning stack on one bar.
 * <ul>
 *   <li><b>Sport:</b> the logged {@code rpe}, else the 1–10 {@code intensity}, × {@code durationMin}. Either missing →
 *       unknown ({@code null}), never a guess.</li>
 *   <li><b>Gym:</b> session RPE = the mean of {@code 10 − RIR} over the session's done working sets (the logged RIR,
 *       else the exercise's target RIR) × the session's minutes. A session with no done working set → unknown.
 *       Resistance-training session-RPE is validated (Day et al. 2004); the per-set {@code 10 − RIR} mean is our
 *       stand-in for the session rating the gym log does not ask for.</li>
 * </ul>
 * Pure.
 */
public final class SportLoadRule {

    private SportLoadRule() {
    }

    /** Sport load, or {@code null} when effort or duration is unknown. */
    public static Integer sport(BigDecimal rpe, Integer intensity, Integer durationMin) {
        BigDecimal effort = rpe != null ? rpe : (intensity != null ? BigDecimal.valueOf(intensity) : null);
        if (effort == null || durationMin == null || durationMin <= 0 || effort.signum() <= 0) {
            return null;
        }
        return effort.multiply(BigDecimal.valueOf(durationMin)).setScale(0, RoundingMode.HALF_UP).intValueExact();
    }

    /**
     * Gym session RPE from its done working sets' RIR values ({@code null} entries are sets with no RIR at all and
     * are left out); {@code null} when no set carries one. Clamped to 1..10.
     */
    public static BigDecimal gymSessionRpe(List<Integer> rirs) {
        int n = 0;
        int sum = 0;
        for (Integer rir : rirs) {
            if (rir == null) {
                continue;
            }
            sum += Math.max(1, Math.min(10, 10 - rir));
            n++;
        }
        return n == 0 ? null : BigDecimal.valueOf(sum).divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP);
    }

    /** Gym load, or {@code null} when the session RPE is unknown or the minutes are not positive. */
    public static Integer gym(BigDecimal sessionRpe, int minutes) {
        if (sessionRpe == null || minutes <= 0) {
            return null;
        }
        return sessionRpe.multiply(BigDecimal.valueOf(minutes)).setScale(0, RoundingMode.HALF_UP).intValueExact();
    }
}
