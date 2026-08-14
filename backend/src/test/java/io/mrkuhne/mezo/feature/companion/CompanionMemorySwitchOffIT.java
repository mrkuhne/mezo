package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.MemoryObservatoryService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Companion switch off ⇒ az obszervatórium bean nem létezik (a végpontok 404 — a FE degraded ága). */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class CompanionMemorySwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoObservatoryBean_whenCompanionSwitchOff() {
        assertThat(context.getBeanProvider(MemoryObservatoryService.class).getIfAvailable()).isNull();
    }
}
