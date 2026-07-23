package io.mrkuhne.mezo.feature.biometrics.sleep;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** With the sleep-shot switch OFF, the @ConditionalOnProperty controller is absent -> 404. */
@TestPropertySource(properties = "mezo.feature.sleep-shot.enabled=false")
class SleepShotDisabledApiIT extends ApiIntegrationTest {

    @Test
    void testDraft_shouldReturn404_whenSleepShotSwitchOff() {
        postForBody("/api/sleep/screenshot", null, ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
}
