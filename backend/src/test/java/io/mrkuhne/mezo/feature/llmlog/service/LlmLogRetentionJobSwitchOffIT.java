package io.mrkuhne.mezo.feature.llmlog.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Job switch off ⇒ the cron bean does not exist (no scheduled scrub can ever fire). */
@TestPropertySource(properties = "mezo.techcore.cron.llm-log-retention-job.enabled=false")
class LlmLogRetentionJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoJobBean_whenJobSwitchOff() {
        assertThat(context.getBeanProvider(LlmLogRetentionJob.class).getIfAvailable()).isNull();
    }
}
