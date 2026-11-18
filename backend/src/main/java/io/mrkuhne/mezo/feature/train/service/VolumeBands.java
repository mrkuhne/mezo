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
        int[] range = switch (tier) {
            case MAINTAIN -> {
                int divisor = cfg.maintainLowDivisor();
                yield new int[] {(mev + divisor - 1) / divisor, mev - 1};   // ceil(mev / divisor)
            }
            case GROW -> new int[] {mev, mav};
            case EMPHASIZE -> new int[] {mav - cfg.emphasizeLowOffset(), mrv};
        };
        int low = Math.max(1, range[0]);
        int high = Math.max(low, range[1]);
        return new Band(low, high, mrv);
    }
}
