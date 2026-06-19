package io.mrkuhne.mezo.feature.biometrics;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LogWeightRequest;
import io.mrkuhne.mezo.api.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.api.dto.WeightLogResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
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
    void testGetWeightTrend_shouldReturnEwmaSeriesRateAndSufficiency_whenWeighInsSeeded() {
        HttpHeaders headers = ownerAuthHeaders();
        // 22 daily weigh-ins descending 84.0 → 82.5 (span 21d, dense) → a full EWMA trend.
        for (int day = 0; day <= 21; day++) {
            BigDecimal w = BigDecimal.valueOf(84.0 - 1.5 / 21.0 * day).setScale(2, java.math.RoundingMode.HALF_UP);
            postForBody("/api/biometrics/weight",
                LogWeightRequest.builder().date(LocalDate.of(2026, 5, 1).plusDays(day)).weightKg(w).build(),
                headers, HttpStatus.CREATED, WeightLogResponse.class);
        }

        WeightTrendResponse trend = getForBody("/api/biometrics/weight/trend",
            headers, HttpStatus.OK, WeightTrendResponse.class);

        assertThat(trend.getEwmaSeries()).hasSize(22);
        assertThat(trend.getLatestTrendKg()).isNotNull();
        // Descending series → a negative weekly rate; full sufficiency at 22 logs over a 21-day span.
        assertThat(trend.getWeeklyRateKgPerWeek().doubleValue()).isNegative();
        assertThat(trend.getDataSufficiency())
            .isEqualTo(WeightTrendResponse.DataSufficiencyEnum.FULL);
    }

    @Test
    void testGetWeightTrend_shouldReturnNoneWithEmptySeries_whenNoWeighIns() {
        WeightTrendResponse trend = getForBody("/api/biometrics/weight/trend",
            ownerAuthHeaders(), HttpStatus.OK, WeightTrendResponse.class);

        assertThat(trend.getEwmaSeries()).isEmpty();
        assertThat(trend.getDataSufficiency())
            .isEqualTo(WeightTrendResponse.DataSufficiencyEnum.NONE);
    }

    @Test
    void testUpsertProfile_shouldRoundTripActivityLevel_whenModerate() {
        HttpHeaders headers = ownerAuthHeaders();
        putForBody("/api/biometrics/profile",
            io.mrkuhne.mezo.api.dto.BiometricProfileUpsertRequest.builder()
                .sex("M").heightCm(new BigDecimal("180.0")).birthDate(LocalDate.of(1991, 3, 1))
                .activityLevel(io.mrkuhne.mezo.api.dto.BiometricProfileUpsertRequest.ActivityLevelEnum.MODERATE)
                .build(),
            headers, HttpStatus.OK, io.mrkuhne.mezo.api.dto.BiometricProfileResponse.class);

        io.mrkuhne.mezo.api.dto.BiometricProfileResponse got =
            getForBody("/api/biometrics/profile", headers, HttpStatus.OK,
                io.mrkuhne.mezo.api.dto.BiometricProfileResponse.class);
        assertThat(got.getActivityLevel())
            .isEqualTo(io.mrkuhne.mezo.api.dto.BiometricProfileResponse.ActivityLevelEnum.MODERATE);
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
