package io.mrkuhne.mezo.feature.telemetry.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The shipped {@code mezo.telemetry} defaults (bd mezo-o5cz, spec §5). */
class TelemetryPropertiesTest extends AbstractIntegrationTest {

    @Autowired private TelemetryProperties properties;

    @Test
    void testDefaults_shouldMatchTheShippedYaml_whenContextBoots() {
        assertThat(properties.retentionDays()).isEqualTo(90);
        assertThat(properties.retentionCron()).isEqualTo("0 45 3 * * *");
        assertThat(properties.batchMax()).isEqualTo(50);
        assertThat(properties.rateLimitPerMinute()).isEqualTo(120);
        assertThat(properties.occurredAtClampHours()).isEqualTo(24);
    }
}
