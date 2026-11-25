package io.mrkuhne.mezo.feature.mail.service.classify;

/**
 * The per-sender prior of the morning post (spec §5.5), applied OUTSIDE the model: a smoothed share of the owner's
 * "érdekel" taps for one sender shifts the model's relevance score by at most two points either way. Pure — the
 * caller reads the taps and computes the age weights ({@link #weight}).
 */
public final class SenderPrior {

    /** The most the prior may move a score, up or down. */
    public static final double MAX_SHIFT = 2.0;

    private SenderPrior() {}

    /**
     * The score shift for a sender, in {@code -2..+2}.
     *
     * <p>{@code interest} and {@code nope} are the raw tap counts; {@code ageWeightedTotal} is the sum of the age
     * weights of ALL those taps (each {@link #weight} is in {@code (0, 1]}, so it never exceeds their number).
     * The Laplace-smoothed share {@code (interest + 1) / (interest + nope + 2)} is centred on 0.5 and scaled to
     * {@code ±2}; the scale then shrinks by the average freshness {@code ageWeightedTotal / (interest + nope)}, so a
     * sender the owner has not tapped for a long time drifts back to no shift.
     */
    public static double shift(int interest, int nope, double ageWeightedTotal) {
        int i = Math.max(0, interest);
        int n = i + Math.max(0, nope);
        if (n == 0 || ageWeightedTotal <= 0) {
            return 0.0;
        }
        double share = (i + 1.0) / (n + 2.0);
        double freshness = Math.min(1.0, ageWeightedTotal / n);
        double shift = (share - 0.5) * 2.0 * MAX_SHIFT * freshness;
        return Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, shift));
    }

    /** One tap's weight: {@code 0.5^(ageDays / halfLifeDays)}; a tap dated after "now" counts in full. */
    public static double weight(double ageDays, int halfLifeDays) {
        if (ageDays <= 0) {
            return 1.0;
        }
        return Math.pow(0.5, ageDays / Math.max(1, halfLifeDays));
    }
}
