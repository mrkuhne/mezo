package io.mrkuhne.mezo.feature.biometrics;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LogWeightRequest;
import io.mrkuhne.mezo.api.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.api.dto.WeightLogResponse;
import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the GENERATED contract interfaces (api/openapi.yml). */
class BiometricsContractIT extends ApiIntegrationTest {

    @Test
    void testLogWeight_shouldRoundTrip_whenPostedViaContract() {
        HttpHeaders headers = ownerAuthHeaders();
        WeightLogResponse created = postForBody("/api/biometrics/weight",
            LogWeightRequest.builder()
                .date(LocalDate.parse("2026-06-11"))
                .weightKg(new BigDecimal("82.50"))
                .build(),
            headers, HttpStatus.CREATED, WeightLogResponse.class);
        assertThat(created.getValue()).isEqualByComparingTo("82.50");

        List<WeightLogResponse> all =
            getForList("/api/biometrics/weight", headers, HttpStatus.OK, WeightLogResponse.class);
        assertThat(all).hasSize(1);
        assertThat(all.get(0).getId()).isEqualTo(created.getId());
    }

    @Test
    void testLogWeight_shouldReturn400FieldError_whenWeightNotPositive() {
        String body = postForBody("/api/biometrics/weight",
            LogWeightRequest.builder()
                .date(LocalDate.parse("2026-06-11"))
                .weightKg(new BigDecimal("-1"))
                .build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        // spec constraint (exclusiveMinimum 0) -> generated @DecimalMin -> FIELD error
        assertHasFieldError(body, "weightKg", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testSaveCheckIn_shouldUpsertSameSlot_whenPostedTwice() {
        HttpHeaders headers = ownerAuthHeaders();
        CheckInResponse first = postForBody("/api/biometrics/checkin",
            SaveCheckInRequest.builder()
                .date(LocalDate.parse("2026-06-11")).slotTime("09:00").state("done").energy(7)
                .build(),
            headers, HttpStatus.OK, CheckInResponse.class);
        CheckInResponse second = postForBody("/api/biometrics/checkin",
            SaveCheckInRequest.builder()
                .date(LocalDate.parse("2026-06-11")).slotTime("09:00").state("skipped")
                .build(),
            headers, HttpStatus.OK, CheckInResponse.class);
        assertThat(second.getId()).isEqualTo(first.getId());

        List<CheckInResponse> day = getForList("/api/biometrics/checkin?date=2026-06-11",
            headers, HttpStatus.OK, CheckInResponse.class);
        assertThat(day).hasSize(1);
        assertThat(day.get(0).getState()).isEqualTo("skipped");
    }
}
