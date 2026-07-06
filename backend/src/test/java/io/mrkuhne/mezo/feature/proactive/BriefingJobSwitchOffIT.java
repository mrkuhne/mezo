package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.service.BriefingJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Cron switch off ⇒ the BriefingJob bean does not exist (the DailySummaryJobSwitchOffIT idiom). */
@TestPropertySource(properties = "mezo.techcore.cron.briefing-job.enabled=false")
class BriefingJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldNotContainBriefingJobBean_whenCronSwitchedOff() {
        assertThat(context.getBeanNamesForType(BriefingJob.class)).isEmpty();
    }
}
