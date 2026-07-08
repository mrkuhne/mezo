package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.service.ChallengeJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** The third switch: challenge-job off ⇒ no ChallengeJob bean (the lazy GET evaluation still serves). */
@TestPropertySource(properties = "mezo.techcore.cron.challenge-job.enabled=false")
class ChallengeJobSwitchOffIT extends AbstractIntegrationTest {

    @Autowired
    private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoChallengeJobBean_whenJobSwitchOff() {
        assertThat(context.getBeanNamesForType(ChallengeJob.class)).isEmpty();
    }
}
