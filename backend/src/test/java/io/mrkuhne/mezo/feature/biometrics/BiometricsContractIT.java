package io.mrkuhne.mezo.feature.biometrics;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LogSleepRequest;
import io.mrkuhne.mezo.api.dto.LogWeightRequest;
import io.mrkuhne.mezo.api.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.api.dto.SleepLogResponse;
import io.mrkuhne.mezo.api.dto.WeightLogResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.api.dto.AdaptiveReason;
import io.mrkuhne.mezo.api.dto.CheckInItemId;
import io.mrkuhne.mezo.api.dto.CravingKind;
import io.mrkuhne.mezo.api.dto.PainRegion;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

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
    void testLogSleep_shouldRoundTrip_whenPostedViaContract() {
        HttpHeaders headers = ownerAuthHeaders();
        SleepLogResponse created = postForBody("/api/biometrics/sleep",
            LogSleepRequest.builder()
                .date(LocalDate.parse("2026-06-11"))
                .bedtime("23:10")
                .wakeup("06:45")
                .durationH(new BigDecimal("7.58"))
                .quality(8)
                .build(),
            headers, HttpStatus.CREATED, SleepLogResponse.class);
        assertThat(created.getQuality()).isEqualTo(8);

        List<SleepLogResponse> all =
            getForList("/api/biometrics/sleep", headers, HttpStatus.OK, SleepLogResponse.class);
        assertThat(all).hasSize(1);
        assertThat(all.get(0).getId()).isEqualTo(created.getId());
    }

    @Test
    void testLogSleep_shouldReturn400FieldError_whenQualityOutOfRange() {
        String body = postForBody("/api/biometrics/sleep",
            LogSleepRequest.builder()
                .date(LocalDate.parse("2026-06-11"))
                .quality(0)   // spec: minimum 1 -> generated @Min -> FIELD error
                .build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "quality", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testSleepEndpoints_shouldReturn401_whenNoToken() {
        getForBody("/api/biometrics/sleep", null, HttpStatus.UNAUTHORIZED, Void.class);
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
                .activityLevel(io.mrkuhne.mezo.api.dto.BiometricProfileUpsertRequest.ActivityLevelEnum.MIXED)
                .build(),
            headers, HttpStatus.OK, io.mrkuhne.mezo.api.dto.BiometricProfileResponse.class);

        io.mrkuhne.mezo.api.dto.BiometricProfileResponse got =
            getForBody("/api/biometrics/profile", headers, HttpStatus.OK,
                io.mrkuhne.mezo.api.dto.BiometricProfileResponse.class);
        assertThat(got.getActivityLevel())
            .isEqualTo(io.mrkuhne.mezo.api.dto.BiometricProfileResponse.ActivityLevelEnum.MIXED);
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
    @Test
    void testSaveCheckIn_shouldRoundTripLongNote_whenBeyondFormerLimits() {
        HttpHeaders headers = ownerAuthHeaders();
        String note = "Hosszabb gondolat a mai napról. ".repeat(1000);
        CheckInResponse saved = postForBody("/api/biometrics/checkin",
            SaveCheckInRequest.builder()
                .date(LocalDate.parse("2026-06-11")).slotTime("09:00").state("done")
                .note(note).build(),
            headers, HttpStatus.OK, CheckInResponse.class);
        assertThat(saved.getNote()).isEqualTo(note);

        List<CheckInResponse> day = getForList("/api/biometrics/checkin?date=2026-06-11",
            headers, HttpStatus.OK, CheckInResponse.class);
        assertThat(day).singleElement().extracting(CheckInResponse::getNote).isEqualTo(note);
    }

    @Test
    void testSaveCheckIn_shouldRoundTripCheckIn2Fields_whenPostedViaContract() {
        HttpHeaders headers = ownerAuthHeaders();
        postForBody("/api/biometrics/checkin",
            SaveCheckInRequest.builder()
                .date(LocalDate.parse("2026-06-11")).slotTime("20:00").state("done")
                .energy(6).mood(8).stress(3).body(5).mental(7)
                .pain(true).painRegions(List.of(PainRegion.TERD, PainRegion.DEREK)).painIntensity(5)
                .craving(7).cravingKinds(List.of(CravingKind.EDES))
                .digestion(4).connection(8).dayRating(7)
                .askedItems(List.of(CheckInItemId.ENERGY, CheckInItemId.DAY))
                .adaptiveItem(CheckInItemId.MOTIVATION).adaptiveReason(AdaptiveReason.RANDOM)
                .build(),
            headers, HttpStatus.OK, CheckInResponse.class);

        // Raw JSON: the wire values are the contract's enum strings.
        String json = getForBody("/api/biometrics/checkin?date=2026-06-11", headers, HttpStatus.OK, String.class);
        assertThat(json).contains("\"painRegions\":[\"TERD\",\"DEREK\"]", "\"cravingKinds\":[\"EDES\"]",
            "\"askedItems\":[\"energy\",\"day\"]", "\"adaptiveItem\":\"motivation\"",
            "\"adaptiveReason\":\"RANDOM\"", "\"dayRating\":7", "\"quickExit\":false");
    }

    @Test
    void testSaveCheckIn_shouldReturn400_whenNewScaleOutOfRange() {
        HttpHeaders headers = ownerAuthHeaders();
        String body = postForBody("/api/biometrics/checkin",
            SaveCheckInRequest.builder()
                .date(LocalDate.parse("2026-06-11")).slotTime("06:30").state("done")
                .mood(11).painIntensity(0).dayRating(12).build(),
            headers, HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "mood", "VALIDATION_INVALID_VALUE");
        assertHasFieldError(body, "painIntensity", "VALIDATION_INVALID_VALUE");
        assertHasFieldError(body, "dayRating", "VALIDATION_INVALID_VALUE");
    }

    /** Follow-up C: an unknown enum constant in the body is the client's fault — 400, never 500. */
    @Test
    void testSaveCheckIn_shouldReturn400NamingTheField_whenBodyEnumUnknown() {
        HttpHeaders headers = ownerAuthHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String base = "{\"date\":\"2026-06-11\",\"slotTime\":\"20:00\",\"state\":\"done\",";

        assertHasFieldError(postForBody("/api/biometrics/checkin", base + "\"pain\":true,\"painRegions\":[\"TERD\",\"FAROK\"]}",
            headers, HttpStatus.BAD_REQUEST, String.class), "painRegions[1]", "VALIDATION_INVALID_VALUE");
        assertHasFieldError(postForBody("/api/biometrics/checkin", base + "\"cravingKinds\":[\"SAVANYU\"]}",
            headers, HttpStatus.BAD_REQUEST, String.class), "cravingKinds[0]", "VALIDATION_INVALID_VALUE");
        assertHasFieldError(postForBody("/api/biometrics/checkin", base + "\"adaptiveReason\":\"WHIM\"}",
            headers, HttpStatus.BAD_REQUEST, String.class), "adaptiveReason", "VALIDATION_INVALID_VALUE");
        assertHasFieldError(postForBody("/api/biometrics/checkin", base + "\"askedItems\":[\"energy\",\"luck\"]}",
            headers, HttpStatus.BAD_REQUEST, String.class), "askedItems[1]", "VALIDATION_INVALID_VALUE");
    }

    /** Follow-up C: broken JSON has no field to name — still a plain 400 with the house format. */
    @Test
    void testSaveCheckIn_shouldReturn400_whenBodyIsNotJson() {
        HttpHeaders headers = ownerAuthHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String body = postForBody("/api/biometrics/checkin", "{\"date\":", headers, HttpStatus.BAD_REQUEST, String.class);
        assertThat(body).contains("\"code\":\"VALIDATION_INVALID_VALUE\"").contains("\"exceptionTraceId\"");
    }
}
