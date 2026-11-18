package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.service.VolumeBands.Band;
import org.junit.jupiter.api.Test;

class VolumeBandsTest {
    private static final VolumeProperties.Bands CFG = new VolumeProperties.Bands(3, 2, 5, 8);

    @Test void backBands() {
        var back = new VolumeProperties.Baseline(10, 16, 22);
        assertThat(VolumeBands.band(back, PriorityTier.MAINTAIN, CFG)).isEqualTo(new Band(4, 9, 22));
        assertThat(VolumeBands.band(back, PriorityTier.GROW, CFG)).isEqualTo(new Band(10, 16, 22));
        assertThat(VolumeBands.band(back, PriorityTier.EMPHASIZE, CFG)).isEqualTo(new Band(14, 22, 22));
    }

    @Test void bicepsBands() {
        var biceps = new VolumeProperties.Baseline(6, 10, 14);
        assertThat(VolumeBands.band(biceps, PriorityTier.MAINTAIN, CFG)).isEqualTo(new Band(2, 5, 14));
        assertThat(VolumeBands.band(biceps, PriorityTier.EMPHASIZE, CFG)).isEqualTo(new Band(8, 14, 14));
    }

    @Test void lowNeverAboveHigh() {   // a degenerate table must still give a usable band
        var tiny = new VolumeProperties.Baseline(1, 1, 1);
        for (var tier : PriorityTier.values()) {
            var b = VolumeBands.band(tiny, tier, CFG);
            assertThat(b.low()).isBetween(1, b.high());
        }
    }
}
