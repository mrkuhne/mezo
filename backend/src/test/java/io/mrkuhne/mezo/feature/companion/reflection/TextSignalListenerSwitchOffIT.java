package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.reflection.service.ReflectionJob;
import io.mrkuhne.mezo.feature.companion.reflection.service.TextSignalExtractor;
import io.mrkuhne.mezo.feature.companion.reflection.service.TextSignalListener;
import io.mrkuhne.mezo.feature.companion.reflection.service.TextSignalService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Reflexió switch off ⇒ NO text-signal bean exists at all (the {@code PatternDetectionJobSwitchOffIT}
 * shape). Structural, not behavioural: with the extractor bean absent, no extraction call is even
 * reachable.
 *
 * <p>S2 (mezo-eq85.2): the cron switch is deliberately left ON here — the master switch alone must
 * be enough to stand the nightly job down. Gated only on its own cron switch, {@code ReflectionJob}
 * would be constructed with three missing collaborators and take the whole context with it.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.companion.reflection.enabled=false",
    "mezo.techcore.cron.reflection-job.enabled=true"
})
class TextSignalListenerSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoTextSignalBeans_whenReflectionSwitchOff() {
        assertThat(context.getBeanProvider(TextSignalListener.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(TextSignalService.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(TextSignalExtractor.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(ReflectionJob.class).getIfAvailable()).isNull();
    }
}
