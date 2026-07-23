package io.mrkuhne.mezo.feature.biometrics.sleep;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** With the sleep-goal switch OFF, the @ConditionalOnProperty controller bean is absent -> 404. */
@TestPropertySource(properties = "mezo.feature.sleep-goal.enabled=false")
class SleepGoalSwitchOffApiIT extends ApiIntegrationTest {

    @Test
    void testGetSleepGoal_shouldReturn404_whenSleepGoalSwitchOff() {
        getForBody("/api/sleep/goal", ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
}
