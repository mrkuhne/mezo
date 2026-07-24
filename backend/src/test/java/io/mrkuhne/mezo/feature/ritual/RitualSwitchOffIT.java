package io.mrkuhne.mezo.feature.ritual;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** With the ritual switch OFF, the @ConditionalOnProperty controller bean is absent -> 404. */
@TestPropertySource(properties = "mezo.feature.ritual.enabled=false")
class RitualSwitchOffIT extends ApiIntegrationTest {

    @Test
    void testGetRitualDay_shouldReturn404_whenRitualSwitchOff() {
        getForBody("/api/ritual/day/" + LocalDate.now(), ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
}
