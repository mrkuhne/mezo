package io.mrkuhne.mezo.feature.companion.config;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@ActiveProfiles("companion-fake")
class CompanionPropertiesIT extends AbstractIntegrationTest {
    @Autowired CompanionProperties properties;

    @Test
    void testMaxCallsPerTurn_shouldBe15_forDeepToolChains() {
        assertThat(properties.tools().maxCallsPerTurn()).isEqualTo(15);
    }
}
