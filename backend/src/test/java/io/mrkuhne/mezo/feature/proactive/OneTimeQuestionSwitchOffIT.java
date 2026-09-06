package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.service.FeatureAbandonmentDetector;
import io.mrkuhne.mezo.feature.proactive.service.FlatFeedbackDetector;
import io.mrkuhne.mezo.feature.proactive.service.OneTimeQuestionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Round 2 S5 (bd mezo-d58h.7.5): with the proactive switch off, no question bean exists at all. */
@TestPropertySource(properties = "mezo.feature.proactive.enabled=false")
class OneTimeQuestionSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldNotHoldTheQuestionBeans_whenProactiveIsOff() {
        assertThat(context.getBeanProvider(OneTimeQuestionService.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(FeatureAbandonmentDetector.class).getIfAvailable()).isNull();
        assertThat(context.getBeanProvider(FlatFeedbackDetector.class).getIfAvailable()).isNull();
    }
}
