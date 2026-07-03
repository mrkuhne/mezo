package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Switch-off state (house rule: both switch states tested): with
 * {@code mezo.feature.companion.enabled=false} no CompanionLlm bean exists — real or fake —
 * and the context still boots (the app is fully usable with companion off).
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class CompanionSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ObjectProvider<CompanionLlm> companionLlmProvider;

    @Test
    void testContext_shouldHaveNoCompanionLlmBean_whenSwitchOff() {
        assertThat(companionLlmProvider.getIfAvailable()).isNull();
    }
}
