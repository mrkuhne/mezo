package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class TrainStylePropertiesIT extends AbstractIntegrationTest {
    @Autowired TrainStyleProperties props;

    @Test
    void testTrainStyleProperties_shouldBindDefaults() {
        assertThat(props.alloutFreeReserve()).isEqualTo(1);
        assertThat(props.sameRangeMaxAgeDays()).isEqualTo(56);
        assertThat(props.stallWeeks()).isEqualTo(2);
        assertThat(props.ramp()).isEqualTo(new TrainStyleProperties.Ramp(1, 2, 2, 1));
        assertThat(props.styles()).containsOnlyKeys("balanced", "volume", "heavy", "allout");
        assertThat(props.styles().get("balanced")).isEqualTo(
            new TrainStyleProperties.Style(6, 10, 10, 15, null, 2, 3, 150, 90, 3));
        assertThat(props.styles().get("allout")).isEqualTo(
            new TrainStyleProperties.Style(6, 10, 8, 12, 2, 0, null, 180, 120, 2));
    }
}
