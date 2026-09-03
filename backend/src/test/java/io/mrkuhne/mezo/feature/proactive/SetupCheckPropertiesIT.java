package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.config.SetupCheckProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** S3 (bd mezo-d58h.3): setup-check tuning binds from {@code mezo.proactive.setup-checks} — the
 *  cadence, buffers and feasibility tolerance the setup checks (Tasks 3-4) read. Binding only;
 *  the checks themselves are not exercised here. */
class SetupCheckPropertiesIT extends AbstractIntegrationTest {

    @Autowired private SetupCheckProperties properties;

    @Test
    void testSetupCheckProperties_shouldBindFromYaml_whenContextStarts() {
        assertThat(properties.cron()).isEqualTo("0 10 6 * * *");
        assertThat(properties.reEmitHours()).isEqualTo(168);
        assertThat(properties.planFeasibility().wakeBufferMin()).isEqualTo(45);
        assertThat(properties.planFeasibility().commuteBufferMin()).isEqualTo(30);
        assertThat(properties.planFeasibility().morningCutoffHour()).isEqualTo(10);
        assertThat(properties.planFeasibility().misfitToleranceMin()).isEqualTo(45);
        assertThat(properties.planFeasibility().bedtimeWindowDays()).isEqualTo(14);
        assertThat(properties.planFeasibility().minBedtimeSamples()).isEqualTo(4);
    }
}
