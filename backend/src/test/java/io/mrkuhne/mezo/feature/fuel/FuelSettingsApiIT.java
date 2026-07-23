package io.mrkuhne.mezo.feature.fuel;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelSettingsResponse;
import io.mrkuhne.mezo.api.dto.SetFuelSettingsRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the generated {@code FuelSettingsApi} contract. */
class FuelSettingsApiIT extends ApiIntegrationTest {

    @Test
    void testGetFuelSettings_shouldReturnConfigDefaultGhost_whenNoneSet() {
        FuelSettingsResponse s =
            getForBody("/api/fuel/settings", ownerAuthHeaders(), HttpStatus.OK, FuelSettingsResponse.class);

        assertThat(s.getMealsPerDay()).isEqualTo(4);
        assertThat(s.getCaffeineCutoff()).isEqualTo("14:00");
    }

    @Test
    void testSetFuelSettings_shouldUpsertSingleRow_whenSavedTwice() {
        HttpHeaders auth = ownerAuthHeaders();
        putForBody("/api/fuel/settings",
            SetFuelSettingsRequest.builder().mealsPerDay(5).caffeineCutoff("13:00").build(),
            auth, HttpStatus.OK, FuelSettingsResponse.class);
        FuelSettingsResponse second = putForBody("/api/fuel/settings",
            SetFuelSettingsRequest.builder().mealsPerDay(3).caffeineCutoff("15:30").build(),
            auth, HttpStatus.OK, FuelSettingsResponse.class);

        assertThat(second.getMealsPerDay()).isEqualTo(3);

        FuelSettingsResponse read =
            getForBody("/api/fuel/settings", auth, HttpStatus.OK, FuelSettingsResponse.class);
        assertThat(read.getMealsPerDay()).isEqualTo(3);
        assertThat(read.getCaffeineCutoff()).isEqualTo("15:30");
    }

    @Test
    void testSetFuelSettings_shouldReturn400FieldErrors_whenInvalid() {
        SetFuelSettingsRequest bad = SetFuelSettingsRequest.builder()
            .mealsPerDay(7).caffeineCutoff("25:99").build();

        String body = putForBody("/api/fuel/settings", bad, ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "mealsPerDay", "VALIDATION_INVALID_VALUE");
        assertHasFieldError(body, "caffeineCutoff", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testFuelSettingsEndpoints_shouldReturn401_whenNoToken() {
        getForBody("/api/fuel/settings", null, HttpStatus.UNAUTHORIZED, Void.class);
    }
}
