package io.mrkuhne.mezo.feature.tutorial;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** With the tutorial switch OFF, the @ConditionalOnProperty controller is absent -> 404. */
@TestPropertySource(properties = "mezo.feature.tutorial.enabled=false")
class TutorialProgressSwitchOffApiIT extends ApiIntegrationTest {

    @Test
    void testGetTutorialProgress_shouldReturn404_whenTutorialSwitchOff() {
        getForBody("/api/tutorial/progress", ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
}
