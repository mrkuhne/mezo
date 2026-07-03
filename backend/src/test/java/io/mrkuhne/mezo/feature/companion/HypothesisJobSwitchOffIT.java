package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.HypothesisJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/** Job switch off ⇒ the weekly hypothesis cron bean does not exist. */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.techcore.cron.hypothesis-job.enabled=false")
class HypothesisJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoJobBean_whenJobSwitchOff() {
        assertThat(context.getBeanProvider(HypothesisJob.class).getIfAvailable()).isNull();
    }
}
