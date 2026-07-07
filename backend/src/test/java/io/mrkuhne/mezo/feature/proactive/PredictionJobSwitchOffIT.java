package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.service.PredictionJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** The third switch: prediction-job off ⇒ no PredictionJob bean (the lazy GET still serves). */
@TestPropertySource(properties = "mezo.techcore.cron.prediction-job.enabled=false")
class PredictionJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired
    private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoPredictionJobBean_whenJobSwitchOff() {
        assertThat(context.getBeanNamesForType(PredictionJob.class)).isEmpty();
    }
}
