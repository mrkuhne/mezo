package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.VolumeProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class VolumePropertiesIT extends AbstractIntegrationTest {
    @Autowired VolumeProperties props;

    @Test
    void testVolumeProperties_shouldBindDefaults() {
        assertThat(props.step()).isEqualTo(2);
        assertThat(props.deloadFraction()).isEqualByComparingTo("0.5");
        assertThat(props.grindRirGap()).isEqualTo(2);
        assertThat(props.stepEmphasize()).isEqualTo(2);
        assertThat(props.stepGrow()).isEqualTo(1);
        assertThat(props.stepDeficit()).isEqualTo(1);
        assertThat(props.bands()).isEqualTo(new VolumeProperties.Bands(3, 2, 5, 8));
        assertThat(props.weeklyReview().mode()).isEqualTo("auto");
        assertThat(props.signals()).isEqualTo(new VolumeProperties.Signals(3, 2, 7));
        assertThat(props.baselines()).containsKeys(
            "chest", "back", "shoulder", "biceps", "triceps", "quad", "ham", "glute", "calf");
        assertThat(props.baselines().get("chest"))
            .isEqualTo(new VolumeProperties.Baseline(8, 14, 20));
    }
}
