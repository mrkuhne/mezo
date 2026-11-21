package io.mrkuhne.mezo.feature.wearable;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CalendarDayIn;
import io.mrkuhne.mezo.api.dto.CalendarDaysRequest;
import io.mrkuhne.mezo.api.dto.CalendarEventIn;
import io.mrkuhne.mezo.api.dto.DailyMetricBatchRequest;
import io.mrkuhne.mezo.api.dto.DailyMetricIn;
import io.mrkuhne.mezo.api.dto.HealthDeletionRequest;
import io.mrkuhne.mezo.api.dto.HealthDeletionResult;
import io.mrkuhne.mezo.api.dto.HealthSampleBatchRequest;
import io.mrkuhne.mezo.api.dto.HealthSampleIn;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

class WearableContractIT extends ApiIntegrationTest {

    @Autowired private JdbcTemplate jdbc;

    private static final LocalDate D = LocalDate.parse("2026-11-09");

    private static SleepNightBatchRequest nights(String bedtime) {
        return new SleepNightBatchRequest().nights(List.of(new SleepNightIn().externalId("hk-night-" + D).date(D)
            .bedtime(bedtime).wakeup("06:50").durationH(new BigDecimal("6.83")).sourceApp("Sleep Cycle").sleepingHr(51)))
            .windowFrom(D.minusDays(60)).windowTo(D);
    }

    @Test
    void everyEndpointAnswersForTheOwner() {
        HttpHeaders h = ownerAuthHeaders();
        IngestResult s = postForBody("/api/wearable/sleep-nights", nights("23:40"), h, HttpStatus.OK, IngestResult.class);
        assertThat(s.getInserted()).isEqualTo(1);
        IngestResult m = postForBody("/api/wearable/daily-metrics",
            new DailyMetricBatchRequest().days(List.of(new DailyMetricIn().date(D).steps(4000)
                .distanceM(3100).hrvMs(new BigDecimal("52.4")).wristTempC(new BigDecimal("-0.2")))), h, HttpStatus.OK, IngestResult.class);
        assertThat(m.getInserted()).isEqualTo(1);
        OffsetDateTime start = OffsetDateTime.parse("2026-11-09T07:30:00+01:00");
        IngestResult w = postForBody("/api/wearable/workouts", new WorkoutBatchRequest().workouts(List.of(
            new WorkoutIn().externalId("hk-w").activityType("running").startAt(start).endAt(start.plusMinutes(30))
                .distanceM(5000).maxHr(170).sourceBundle("com.apple.health"))),
            h, HttpStatus.OK, IngestResult.class);
        assertThat(w.getInserted()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select distance_m from daily_metric where date = ?", Integer.class, D)).isEqualTo(3100);
        assertThat(jdbc.queryForObject("select sleeping_hr from sleep_log where external_id = ?", Integer.class,
            "hk-night-" + D)).isEqualTo(51);
        assertThat(jdbc.queryForObject("select max_hr from wearable_workout where external_id = 'hk-w'", Integer.class))
            .isEqualTo(170);
        putForBody("/api/wearable/calendar-days",
            new CalendarDaysRequest().days(List.of(new CalendarDayIn().date(D).events(List.of(new CalendarEventIn().externalId("ek-1").title("X")
                .startAt(start).endAt(start.plusMinutes(30)).allDay(false))))), h, HttpStatus.NO_CONTENT, String.class);
        assertThat(jdbc.queryForObject("select external_id from calendar_event where title = 'X'", String.class))
            .isEqualTo("ek-1");
    }

    @Test
    void calendarEventKeepsNewFields() {
        HttpHeaders h = ownerAuthHeaders();
        OffsetDateTime start = OffsetDateTime.parse("2026-11-10T09:00:00+01:00");
        CalendarEventIn full = new CalendarEventIn().externalId("ek-full").title("Workshop").startAt(start)
            .endAt(start.plusHours(2)).allDay(false).attendeeCount(3).attendeeNames(List.of("Anna", "Béla"))
            .organizerIsMe(true).location("Iroda").recurring(true).availability(CalendarEventIn.AvailabilityEnum.TENTATIVE)
            .notes("Hozz laptopot");
        putForBody("/api/wearable/calendar-days", new CalendarDaysRequest().days(List.of(new CalendarDayIn().date(D)
            .events(List.of(full)))), h, HttpStatus.NO_CONTENT, String.class);
        var row = jdbc.queryForMap("select attendee_count, attendee_names::text as names, organizer_is_me, location, recurring, "
            + "availability, notes from calendar_event where external_id = 'ek-full'");
        assertThat(row.get("attendee_count")).isEqualTo(3);
        assertThat(row.get("names").toString()).contains("Anna").contains("Béla");
        assertThat(row.get("organizer_is_me")).isEqualTo(true);
        assertThat(row.get("location")).isEqualTo("Iroda");
        assertThat(row.get("recurring")).isEqualTo(true);
        assertThat(row.get("availability")).isEqualTo("tentative");
        assertThat(row.get("notes")).isEqualTo("Hozz laptopot");

        CalendarEventIn tooLong = new CalendarEventIn().externalId("ek-long").title("Y").startAt(start)
            .endAt(start.plusHours(1)).allDay(false).notes("x".repeat(2001));
        var r = exchangeForResponse(HttpMethod.PUT, "/api/wearable/calendar-days",
            new CalendarDaysRequest().days(List.of(new CalendarDayIn().date(D).events(List.of(tooLong)))), h);
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
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

    private static HealthSampleBatchRequest samples(String end) {
        OffsetDateTime s = OffsetDateTime.parse("2026-11-09T08:00:00+01:00");
        return new HealthSampleBatchRequest().samples(List.of(new HealthSampleIn().externalId("hs-1")
            .metric(HealthSampleIn.MetricEnum.BODY_MASS).start(s).end(OffsetDateTime.parse(end)).value(80.4)
            .unit("kg").meta(java.util.Map.of("k", 1))));
    }

    @Test
    void samplesAndDeletionsRoundTrip() {
        HttpHeaders h = ownerAuthHeaders();
        IngestResult r = postForBody("/api/wearable/samples", samples("2026-11-09T08:01:00+01:00"), h, HttpStatus.OK, IngestResult.class);
        assertThat(r.getInserted()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select weight_kg from weight_log where external_id = 'hs-1'", BigDecimal.class))
            .isEqualByComparingTo("80.40");
        HealthDeletionResult d = postForBody("/api/wearable/deletions",
            new HealthDeletionRequest().externalIds(List.of("hs-1")), h, HttpStatus.OK, HealthDeletionResult.class);
        assertThat(d.getDeleted()).isEqualTo(2);
        d = postForBody("/api/wearable/deletions", new HealthDeletionRequest().externalIds(List.of("hs-1")), h,
            HttpStatus.OK, HealthDeletionResult.class);
        assertThat(d.getDeleted()).isZero();
    }

    @Test
    void samplesEndBeforeStartIsBadRequest() {
        var r = exchangeForResponse(HttpMethod.POST, "/api/wearable/samples", samples("2026-11-09T07:00:00+01:00"), ownerAuthHeaders());
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void samplesAndDeletionsWithoutTokenAreUnauthorized() {
        assertThat(exchangeForResponse(HttpMethod.POST, "/api/wearable/samples", samples("2026-11-09T08:01:00+01:00"),
            new HttpHeaders()).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(exchangeForResponse(HttpMethod.POST, "/api/wearable/deletions",
            new HealthDeletionRequest().externalIds(List.of("x")), new HttpHeaders()).getStatusCode())
            .isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
