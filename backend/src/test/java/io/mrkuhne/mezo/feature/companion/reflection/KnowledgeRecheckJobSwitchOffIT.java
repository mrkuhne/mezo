package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.reflection.service.KnowledgeRecheckJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/** Job switch off ⇒ the quarterly knowledge re-check cron bean does not exist (mezo-d6ivw.2,
 *  the {@code ReflectionJobSwitchOffIT} idiom). */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.techcore.cron.knowledge-recheck-job.enabled=false")
class KnowledgeRecheckJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoJobBean_whenJobSwitchOff() {
        assertThat(context.getBeanProvider(KnowledgeRecheckJob.class).getIfAvailable()).isNull();
    }
}
