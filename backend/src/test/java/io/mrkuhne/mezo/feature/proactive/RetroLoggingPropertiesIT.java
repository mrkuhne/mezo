package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Round 2 S3 (bd mezo-d58h.7.3, spec §9): the retro/batch-logging tuning binds from
 *  {@code mezo.proactive.retro-logging}. Binding only — the detection itself is exercised in
 *  {@code RetroLoggingProbeIT}. */
class RetroLoggingPropertiesIT extends AbstractIntegrationTest {

    @Autowired private ProactiveProperties properties;

    @Test
    void testRetroLoggingProperties_shouldBindFromYaml_whenContextStarts() {
        assertThat(properties.retroLogging().windowDays()).isEqualTo(14);
        assertThat(properties.retroLogging().minMeals()).isEqualTo(10);
        assertThat(properties.retroLogging().retroPct()).isEqualTo(40);
    }
}
