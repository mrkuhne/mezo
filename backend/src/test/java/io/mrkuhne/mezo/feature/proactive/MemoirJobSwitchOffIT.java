package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.service.MemoirJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Cron switch off ⇒ the MemoirJob bean does not exist (the WeeklySuggestionJobSwitchOffIT twin). */
@TestPropertySource(properties = "mezo.techcore.cron.memoir-job.enabled=false")
class MemoirJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldNotContainMemoirJobBean_whenCronSwitchedOff() {
        assertThat(context.getBeanNamesForType(MemoirJob.class)).isEmpty();
    }
}
