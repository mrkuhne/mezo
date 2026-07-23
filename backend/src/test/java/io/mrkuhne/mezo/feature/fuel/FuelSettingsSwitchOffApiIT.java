package io.mrkuhne.mezo.feature.fuel;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** With the fuel-settings switch OFF, the @ConditionalOnProperty controller is absent -> 404. */
@TestPropertySource(properties = "mezo.feature.fuel-settings.enabled=false")
class FuelSettingsSwitchOffApiIT extends ApiIntegrationTest {

    @Test
    void testGetFuelSettings_shouldReturn404_whenFuelSettingsSwitchOff() {
        getForBody("/api/fuel/settings", ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
}
