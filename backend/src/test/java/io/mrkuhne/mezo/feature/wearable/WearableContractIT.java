package io.mrkuhne.mezo.feature.wearable;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CalendarDayIn;
import io.mrkuhne.mezo.api.dto.CalendarDaysRequest;
import io.mrkuhne.mezo.api.dto.DailyMetricBatchRequest;
import io.mrkuhne.mezo.api.dto.DailyMetricIn;
import io.mrkuhne.mezo.api.dto.IngestResult;
import io.mrkuhne.mezo.api.dto.SleepNightBatchRequest;
import io.mrkuhne.mezo.api.dto.SleepNightIn;
import io.mrkuhne.mezo.api.dto.WorkoutBatchRequest;
import io.mrkuhne.mezo.api.dto.WorkoutIn;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

class WearableContractIT extends ApiIntegrationTest {

    private static final LocalDate D = LocalDate.parse("2026-11-09");

    private static SleepNightBatchRequest nights(String bedtime) {
        return new SleepNightBatchRequest().nights(List.of(new SleepNightIn().externalId("hk-night-" + D).date(D)
            .bedtime(bedtime).wakeup("06:50").durationH(new BigDecimal("6.83"))));
    }

    @Test
    void everyEndpointAnswersForTheOwner() {
        HttpHeaders h = ownerAuthHeaders();
        IngestResult s = postForBody("/api/wearable/sleep-nights", nights("23:40"), h, HttpStatus.OK, IngestResult.class);
        assertThat(s.getInserted()).isEqualTo(1);
        IngestResult m = postForBody("/api/wearable/daily-metrics",
            new DailyMetricBatchRequest().days(List.of(new DailyMetricIn().date(D).steps(4000))), h, HttpStatus.OK, IngestResult.class);
        assertThat(m.getInserted()).isEqualTo(1);
        OffsetDateTime start = OffsetDateTime.parse("2026-11-09T07:30:00+01:00");
        IngestResult w = postForBody("/api/wearable/workouts", new WorkoutBatchRequest().workouts(List.of(
            new WorkoutIn().externalId("hk-w").activityType("running").startAt(start).endAt(start.plusMinutes(30)))),
            h, HttpStatus.OK, IngestResult.class);
        assertThat(w.getInserted()).isEqualTo(1);
        putForBody("/api/wearable/calendar-days",
            new CalendarDaysRequest().days(List.of(new CalendarDayIn().date(D).events(List.of()))), h, HttpStatus.NO_CONTENT, String.class);
    }

    @Test
    void withoutTokenIsUnauthorized() {
        var r = exchangeForResponse(HttpMethod.POST, "/api/wearable/sleep-nights", nights("23:40"), new HttpHeaders());
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void malformedBedtimeIsBadRequest() {
        var r = exchangeForResponse(HttpMethod.POST, "/api/wearable/sleep-nights", nights("7:5"), ownerAuthHeaders());
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
