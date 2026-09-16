package io.mrkuhne.mezo.feature.companion.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("companion-fake")
class CompanionTurnPropertiesIT extends AbstractIntegrationTest {

    @Autowired
    private CompanionProperties properties;

    @Test
    void testTurn_shouldBindDefaults_whenApplicationYmlIsLoaded() {
        assertThat(properties.turn()).isNotNull();
        assertThat(properties.turn().gear().classifierEnabled()).isTrue();
        assertThat(properties.turn().answerer().chatEffort()).isEqualTo("high");
    }
}
