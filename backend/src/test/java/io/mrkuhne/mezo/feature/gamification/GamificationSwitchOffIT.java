package io.mrkuhne.mezo.feature.gamification;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** With the gamification switch OFF, the @ConditionalOnProperty controller bean is absent -> 404. */
@TestPropertySource(properties = "mezo.feature.gamification.enabled=false")
class GamificationSwitchOffIT extends ApiIntegrationTest {

    @Test
    void testGetGamificationProfile_shouldReturn404_whenGamificationSwitchOff() {
        getForBody("/api/gamification/profile", ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }

    @Test
    void testGetGamificationDay_shouldReturn404_whenGamificationSwitchOff() {
        getForBody("/api/gamification/day/" + LocalDate.now(), ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
}
