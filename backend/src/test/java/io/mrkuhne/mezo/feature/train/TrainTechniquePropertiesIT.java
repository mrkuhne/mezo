package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.TrainTechniqueProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class TrainTechniquePropertiesIT extends AbstractIntegrationTest {
    @Autowired TrainTechniqueProperties props;

    @Test
    void testTrainTechniqueProperties_shouldBindDefaults() {
        assertThat(props.restDrop()).isEqualTo(new TrainTechniqueProperties.Drop(0, 30, 30));
        assertThat(props.drop()).isEqualTo(new TrainTechniqueProperties.Drop(0, 20, 0));
        assertThat(props.myo()).isEqualTo(new TrainTechniqueProperties.Myo(1, 5, 3, 20, 4));
        assertThat(props.partials()).isEqualTo(new TrainTechniqueProperties.Partials(0));
        assertThat(props.capWeight()).isEqualTo(2);
    }
}
