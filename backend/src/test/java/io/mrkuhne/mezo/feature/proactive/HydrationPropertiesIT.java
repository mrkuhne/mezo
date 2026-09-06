package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Round 2 S2 (bd mezo-d58h.7.2, spec §12): the training-day hydration tuning binds from
 *  {@code mezo.proactive.hydration}. Binding only — the probe itself is exercised in
 *  {@code HydrationShortfallProbeIT}. */
class HydrationPropertiesIT extends AbstractIntegrationTest {

    @Autowired private ProactiveProperties properties;

    @Test
    void testHydrationProperties_shouldBindFromYaml_whenContextStarts() {
        assertThat(properties.hydration().checkpointCron()).isEqualTo("0 0 15 * * *");
        assertThat(properties.hydration().shortfallPct()).isEqualTo(60);
        assertThat(properties.hydration().minProRatedMl()).isEqualTo(500);
        assertThat(properties.hydration().checkpointEyebrow()).isEqualTo("Hidratáció");
        assertThat(properties.hydration().checkpointTemplate()).contains("{logged}", "{prorated}", "{target}");
    }
}
