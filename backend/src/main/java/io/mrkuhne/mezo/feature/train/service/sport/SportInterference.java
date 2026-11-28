package io.mrkuhne.mezo.feature.train.service.sport;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * The gym ↔ sport interference rules, in one place (Boop Sport S2, mezo-r36n9.202). The heavy-session rule and the
 * decline-pair count were the character feature's {@code SportInterferenceDetector} logic; that detector now calls
 * this, and the Sport area's hints read the same numbers. Pure.
 *
 * <p><b>Gap thresholds (re-checked 2026-11-28):</b> Robineau et al. 2016 (JSCR, 0 / 6 / 24 h between strength and
 * endurance work) advise against less than 6 h between two contradictory sessions; the meta-analytic interference
 * shows within short gaps (Sports Med 2021: same session, not beyond ~2–3 h). Hence < 3 h = tight (watch),
 * 3–6 h = short (info), ≥ 6 h = nothing to say.
 */
public final class SportInterference {

    public static final int HEAVY_SHOULDER_MIN = 6;
    public static final BigDecimal HEAVY_RPE_MIN = new BigDecimal("8");
    public static final double DECLINE_THRESHOLD = -1.0;
    public static final int MIN_DECLINE_PAIRS = 2;
    public static final double GAP_TIGHT_HOURS = 3.0;
    public static final double GAP_SHORT_HOURS = 6.0;

    private SportInterference() {
    }

    /** One sport session as the rules see it. */
    public record SportDay(LocalDate date, Integer shoulderStrain, BigDecimal rpe) {
    }

    /** A heavy sport session: shoulder strain ≥ 6 or RPE ≥ 8. */
    public static boolean heavy(Integer shoulderStrain, BigDecimal rpe) {
        return (shoulderStrain != null && shoulderStrain >= HEAVY_SHOULDER_MIN)
            || (rpe != null && rpe.compareTo(HEAVY_RPE_MIN) >= 0);
    }

    /**
     * Heavy sport days followed the next day by a gym session whose sets fell short of target on average by at least
     * one rep. {@code nextDayDelta}: date → the mean (reps − target reps) of that day's gym sets, absent when the day
     * had no comparable set.
     */
    public static int declinePairs(List<SportDay> sport, Map<LocalDate, Double> nextDayDelta) {
        int pairs = 0;
        for (SportDay s : sport) {
            if (!heavy(s.shoulderStrain(), s.rpe())) {
                continue;
            }
            Double delta = nextDayDelta.get(s.date().plusDays(1));
            if (delta != null && delta <= DECLINE_THRESHOLD) {
                pairs++;
            }
        }
        return pairs;
    }

    /** The gap's verdict: {@code TIGHT}, {@code SHORT} or {@code null} (≥ 6 h or unknown). */
    public static String gapVerdict(Double gapHours) {
        if (gapHours == null) {
            return null;
        }
        if (gapHours < GAP_TIGHT_HOURS) {
            return "TIGHT";
        }
        return gapHours < GAP_SHORT_HOURS ? "SHORT" : null;
    }
}
