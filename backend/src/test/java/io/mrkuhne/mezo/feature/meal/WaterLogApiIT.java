package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.meal.entity.WaterLogEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.WaterLogPopulator;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import tools.jackson.databind.JsonNode;

class WaterLogApiIT extends ApiIntegrationTest {

    @Autowired private WaterLogPopulator waterPop;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private int dayWater(String date) {
        ResponseEntity<String> day = exchangeForResponse(
            HttpMethod.GET, "/api/fuel/day/" + date, null, ownerAuthHeaders());
        assertThat(day.getStatusCode().value()).isEqualTo(200);
        JsonNode json = objectMapper.readTree(day.getBody());
        return json.get("consumed").get("water").asInt();
    }

    @Test
    void testLogWater_shouldReturn201AndSumIntoDayRollup_whenPosted() {
        ownerId();
        String today = LocalDate.now().toString();

        ResponseEntity<String> res = exchangeForResponse(HttpMethod.POST, "/api/water-log",
            Map.of("date", today, "amountMl", 250), ownerAuthHeaders());
        assertThat(res.getStatusCode().value()).isEqualTo(201);
        exchangeForResponse(HttpMethod.POST, "/api/water-log",
            Map.of("date", today, "amountMl", 500), ownerAuthHeaders());

        assertThat(dayWater(today)).isEqualTo(750);
    }

    @Test
    void testGetFuelDay_shouldReportZeroWater_whenNothingLogged() {
        ownerId();
        assertThat(dayWater(LocalDate.now().toString())).isZero();
    }

    @Test
    void testLogWater_shouldReject_whenAmountNonPositive() {
        ownerId();
        ResponseEntity<String> res = exchangeForResponse(HttpMethod.POST, "/api/water-log",
            Map.of("date", LocalDate.now().toString(), "amountMl", 0), ownerAuthHeaders());
        assertThat(res.getStatusCode().value()).isEqualTo(400);
        assertHasFieldError(res.getBody(), "amountMl", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testDeleteWaterLog_shouldRemoveFromRollup_whenDeleted() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        WaterLogEntity row = waterPop.createWaterLog(owner, today, 400);

        deleteAndExpect("/api/water-log/" + row.getId(), ownerAuthHeaders(), org.springframework.http.HttpStatus.NO_CONTENT);

        assertThat(dayWater(today.toString())).isZero();
    }

    @Test
    void testDeleteWaterLog_shouldReturn404_whenMissing() {
        ownerId();
        deleteAndExpect("/api/water-log/" + UUID.randomUUID(), ownerAuthHeaders(), org.springframework.http.HttpStatus.NOT_FOUND);
    }
}
