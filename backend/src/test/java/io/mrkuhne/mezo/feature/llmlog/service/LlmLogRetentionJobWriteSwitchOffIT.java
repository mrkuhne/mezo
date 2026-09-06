package io.mrkuhne.mezo.feature.llmlog.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/**
 * The retention switch is deliberately independent of the write switch: payload already on disk
 * keeps aging while recording is off, so turning off {@code mezo.feature.llm-log.enabled} must
 * NOT take the retention job bean down with it.
 */
@TestPropertySource(properties = {
    "mezo.feature.llm-log.enabled=false",
    // mezo-c9k4: the "RetentionSwitchOn" half of this test's name used to ride on the shared test
    // profile leaving the cron switch at its production default; that profile now disables it, so
    // the precondition is stated here explicitly instead of being inherited.
    "mezo.techcore.cron.llm-log-retention-job.enabled=true"
})
class LlmLogRetentionJobWriteSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveJobBean_whenWriteSwitchOffButRetentionSwitchOn() {
        assertThat(context.getBeanProvider(LlmLogRetentionJob.class).getIfAvailable()).isNotNull();
    }
}
