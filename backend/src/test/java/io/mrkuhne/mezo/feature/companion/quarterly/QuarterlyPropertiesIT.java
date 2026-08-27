package io.mrkuhne.mezo.feature.companion.quarterly;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.quarterly.config.QuarterlyProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** W5.3 (mezo-b3pp.20): the quarterly knobs bind from yml — schedule + caps, config not code. */
class QuarterlyPropertiesIT extends AbstractIntegrationTest {

    @Autowired private QuarterlyProperties properties;

    @Test
    void testConfig_shouldBindQuarterlyBlock_whenContextStarts() {
        assertThat(properties.cron()).isEqualTo("0 0 4 1 1,4,7,10 *");
        assertThat(properties.maxCandidates()).isEqualTo(2);
        assertThat(properties.maxPeriodLines()).isEqualTo(6);
        assertThat(properties.renderMaxChars()).isEqualTo(400);
    }
}
