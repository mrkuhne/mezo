package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.service.ExperimentJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** The third switch: experiment-job off ⇒ no ExperimentJob bean (the lazy propose GET still serves). */
@TestPropertySource(properties = "mezo.techcore.cron.experiment-job.enabled=false")
class ExperimentJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired
    private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoExperimentJobBean_whenJobSwitchOff() {
        assertThat(context.getBeanNamesForType(ExperimentJob.class)).isEmpty();
    }
}
