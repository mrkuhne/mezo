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
    }
}
