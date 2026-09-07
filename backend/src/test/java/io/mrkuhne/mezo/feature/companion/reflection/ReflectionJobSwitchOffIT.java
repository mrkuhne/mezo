package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.reflection.service.ReflectionJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/** Job switch off ⇒ the nightly reflection cron bean does not exist (mezo-eq85.2). */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.techcore.cron.reflection-job.enabled=false")
class ReflectionJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoJobBean_whenJobSwitchOff() {
        assertThat(context.getBeanProvider(ReflectionJob.class).getIfAvailable()).isNull();
    }
}
