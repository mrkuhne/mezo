package io.mrkuhne.mezo.feature.biometrics.sleep;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LogSleepRequest;
import io.mrkuhne.mezo.api.dto.SleepLogResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** The D5 enriched fields ride the existing POST /api/biometrics/sleep (additive, all optional). */
class SleepLogEnrichedApiIT extends ApiIntegrationTest {

    @Test
    void testLogSleep_shouldRoundTripEnrichedFields_whenProvided() {
        LogSleepRequest req = LogSleepRequest.builder()
            .date(LocalDate.of(2026, 7, 22))
            .bedtime("00:42").wakeup("09:03")
            .durationH(new BigDecimal("7.48")) // 7h29m asleep
            .inBedMin(501)                     // 8h21m in bed
            .awakeMin(52).lightMin(206).remMin(144).deepMin(100)
            .sourceQualityPct(95)
            .source("screenshot")
            .build();

        SleepLogResponse saved = postForBody("/api/biometrics/sleep", req, ownerAuthHeaders(),
            HttpStatus.CREATED, SleepLogResponse.class);

        assertThat(saved.getInBedMin()).isEqualTo(501);
        assertThat(saved.getAwakeMin()).isEqualTo(52);
        assertThat(saved.getLightMin()).isEqualTo(206);
        assertThat(saved.getRemMin()).isEqualTo(144);
        assertThat(saved.getDeepMin()).isEqualTo(100);
        assertThat(saved.getSourceQualityPct()).isEqualTo(95);
        assertThat(saved.getSource()).isEqualTo("screenshot");
    }

    @Test
    void testLogSleep_shouldDefaultSourceManualAndNullPhases_whenOmitted() {
        LogSleepRequest req = LogSleepRequest.builder()
            .date(LocalDate.of(2026, 7, 22))
            .bedtime("23:10").wakeup("06:45")
            .durationH(new BigDecimal("7.50"))
            .build();

        SleepLogResponse saved = postForBody("/api/biometrics/sleep", req, ownerAuthHeaders(),
            HttpStatus.CREATED, SleepLogResponse.class);

        assertThat(saved.getSource()).isEqualTo("manual");
        assertThat(saved.getInBedMin()).isNull();
        assertThat(saved.getAwakeMin()).isNull();
        assertThat(saved.getSourceQualityPct()).isNull();
    }

    @Test
    void testLogSleep_shouldReturn400FieldError_whenSourceQualityOutOfRange() {
        LogSleepRequest req = LogSleepRequest.builder()
            .date(LocalDate.of(2026, 7, 22)).sourceQualityPct(101).build();

        String body = postForBody("/api/biometrics/sleep", req, ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "sourceQualityPct", "VALIDATION_INVALID_VALUE");
    }
}
