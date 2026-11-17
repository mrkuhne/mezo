package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.VolumeProperties;

/** Weekly set band of one muscle group for a priority tier: pure function of the landmarks. */
public final class VolumeBands {
    private VolumeBands() {}

    /** Weekly working-set band; {@code limit} is the hard ceiling (the group's MRV). */
    public record Band(int low, int high, int limit) {}

    public static Band band(VolumeProperties.Baseline landmarks, PriorityTier tier,
                            VolumeProperties.Bands cfg) {
        int mev = landmarks.mev();
        int mav = landmarks.mav();
        int mrv = landmarks.mrv();
        int low;
        int high;
        switch (tier) {
            case MAINTAIN -> {
                int divisor = cfg.maintainLowDivisor();
                low = (mev + divisor - 1) / divisor;   // ceil(mev / divisor)
                high = mev - 1;
            }
            case GROW -> {
                low = mev;
                high = mav;
            }
            case EMPHASIZE -> {
                low = mav - cfg.emphasizeLowOffset();
                high = mrv;
            }
            default -> throw new IllegalStateException("Unhandled tier " + tier);
        }
        low = Math.max(1, low);
        high = Math.max(low, high);
        return new Band(low, high, mrv);
    }
}
