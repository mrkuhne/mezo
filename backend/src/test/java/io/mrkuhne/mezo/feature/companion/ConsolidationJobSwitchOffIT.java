package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.ConsolidationJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Job switch off ⇒ the consolidation cron bean does not exist (mezo-b3pp.13). */
@TestPropertySource(properties = "mezo.techcore.cron.consolidation-job.enabled=false")
class ConsolidationJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoJobBean_whenJobSwitchOff() {
        assertThat(context.getBeanProvider(ConsolidationJob.class).getIfAvailable()).isNull();
    }
}
