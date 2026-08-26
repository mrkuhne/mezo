package io.mrkuhne.mezo.feature.companion.quarterly;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.quarterly.service.QuarterlyReviewJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Job switch off ⇒ the quarterly cron bean does not exist (mezo-b3pp.20). */
@TestPropertySource(properties = "mezo.techcore.cron.quarterly-review-job.enabled=false")
class QuarterlyReviewJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoJobBean_whenJobSwitchOff() {
        assertThat(context.getBeanProvider(QuarterlyReviewJob.class).getIfAvailable()).isNull();
    }
}
