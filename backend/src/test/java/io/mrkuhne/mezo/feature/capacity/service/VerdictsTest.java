package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import org.junit.jupiter.api.Test;

class VerdictsTest {

    private static final CapacityProperties P = new CapacityProperties(true, new CapacityProperties.Verdict(0.6, 0.9, 1.0),
            1.25, 1.3, 90, 15, new CapacityProperties.Learning(14, 5), null, null, null, 2000);

    @Test
    void thresholdsMapToWords() {
        assertThat(Verdicts.word(0.59, P)).isEqualTo("laza");
        assertThat(Verdicts.word(0.6, P)).isEqualTo("rendben");
        assertThat(Verdicts.word(0.9, P)).isEqualTo("szoros");
        assertThat(Verdicts.word(1.0, P)).isEqualTo("szoros");
        assertThat(Verdicts.word(1.01, P)).isEqualTo("túl sok");
    }
}
