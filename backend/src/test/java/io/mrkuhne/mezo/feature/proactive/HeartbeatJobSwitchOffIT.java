package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.service.HeartbeatJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** The third switch: heartbeat-job off ⇒ no HeartbeatJob bean (the lazy GET still serves). */
@TestPropertySource(properties = "mezo.techcore.cron.heartbeat-job.enabled=false")
class HeartbeatJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired
    private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoHeartbeatJobBean_whenJobSwitchOff() {
        assertThat(context.getBeanNamesForType(HeartbeatJob.class)).isEmpty();
    }
}
