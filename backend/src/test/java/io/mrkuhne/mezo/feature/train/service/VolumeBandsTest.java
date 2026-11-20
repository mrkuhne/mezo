package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.feature.train.service.VolumeBands.Band;
import org.junit.jupiter.api.Test;

class VolumeBandsTest {
    private static final VolumeProperties.Bands CFG = new VolumeProperties.Bands(3, 2, 5, 8, 1, 2, 2);

    @Test void backBands() {
        var back = new VolumeProperties.Baseline(10, 16, 22);
        assertThat(VolumeBands.band(back, PriorityTier.MAINTAIN, false, CFG)).isEqualTo(new Band(4, 9, 22, false));
        assertThat(VolumeBands.band(back, PriorityTier.GROW, false, CFG)).isEqualTo(new Band(10, 16, 22, false));
        assertThat(VolumeBands.band(back, PriorityTier.EMPHASIZE, false, CFG)).isEqualTo(new Band(14, 22, 22, false));
    }

    @Test void bicepsBands() {
        var biceps = new VolumeProperties.Baseline(6, 10, 14);
        assertThat(VolumeBands.band(biceps, PriorityTier.MAINTAIN, false, CFG)).isEqualTo(new Band(2, 5, 14, false));
        assertThat(VolumeBands.band(biceps, PriorityTier.EMPHASIZE, false, CFG)).isEqualTo(new Band(8, 14, 14, false));
    }

    @Test void lowNeverAboveHigh() {   // a degenerate table must still give a usable band
        var tiny = new VolumeProperties.Baseline(1, 1, 1);
        for (var tier : PriorityTier.values()) {
            var b = VolumeBands.band(tiny, tier, false, CFG);
            assertThat(b.low()).isBetween(1, b.high());
        }
    }

    @Test void sportLowersQuad() {   // quad 8/12/18
        var quad = new VolumeProperties.Baseline(8, 12, 18);
        assertThat(VolumeBands.band(quad, PriorityTier.MAINTAIN, true, CFG)).isEqualTo(new Band(2, 5, 18, true));
        assertThat(VolumeBands.band(quad, PriorityTier.GROW, true, CFG)).isEqualTo(new Band(7, 10, 18, true));
        assertThat(VolumeBands.band(quad, PriorityTier.GROW, false, CFG)).isEqualTo(new Band(8, 12, 18, false));
    }

    @Test void sportNeverCollapsesTheBand() {   // high stays at least low + 1
        var tiny = new VolumeProperties.Baseline(2, 3, 4);
        var b = VolumeBands.band(tiny, PriorityTier.GROW, true, CFG);
        assertThat(b.high()).isGreaterThanOrEqualTo(b.low() + 1);
        assertThat(b.low()).isGreaterThanOrEqualTo(1);
    }
}
