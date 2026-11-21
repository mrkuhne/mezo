package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import org.junit.jupiter.api.Test;

class LearningStateTest {

    private static final CapacityProperties P = new CapacityProperties(true, new CapacityProperties.Verdict(0.6, 0.9, 1.0),
            1.25, 1.3, 90, 15, new CapacityProperties.Learning(14, 5), null, null, null, 2000, 6.0);

    @Test
    void learningUntilFourteenDaysAndFiveLabels() {
        assertThat(LearningState.of(13, 9, P)).isTrue();
        assertThat(LearningState.of(14, 4, P)).isTrue();
        assertThat(LearningState.of(14, 5, P)).isFalse();
    }
}
