package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.service.CompanionMessageJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Cron switch off ⇒ the CompanionMessageJob bean does not exist. */
@TestPropertySource(properties = "mezo.techcore.cron.feed-job.enabled=false")
class CompanionMessageJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldNotContainCompanionMessageJobBean_whenCronSwitchedOff() {
        assertThat(context.getBeanNamesForType(CompanionMessageJob.class)).isEmpty();
    }
}
