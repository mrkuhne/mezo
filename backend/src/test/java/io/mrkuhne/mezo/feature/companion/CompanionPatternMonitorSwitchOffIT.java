package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.PatternMonitorService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/** Companion switch off ⇒ a monitor bean nem létezik (a végpont 404 — a FE degraded ága). */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class CompanionPatternMonitorSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoMonitorBean_whenCompanionSwitchOff() {
        assertThat(context.getBeanProvider(PatternMonitorService.class).getIfAvailable()).isNull();
    }
}
