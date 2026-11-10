package io.mrkuhne.mezo.feature.boop;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.BoopBrief;
import io.mrkuhne.mezo.api.dto.SessionTime;
import io.mrkuhne.mezo.api.dto.SessionTimeRequest;
import io.mrkuhne.mezo.feature.boop.repository.WorkoutTimeOverrideRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CalendarEventPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/** Boop S3 Task 7 (mezo-r36n9.7): PUT/DELETE /api/boop/session-time move today's gym session. */
@ActiveProfiles("companion-fake")
class SessionTimeIT extends ApiIntegrationTest {

    private static final ZoneId BUDAPEST = ZoneId.of("Europe/Budapest");
    /** A past Tuesday (schedule dayOfWeek 1). */
    private static final String DATE = "2026-11-03";
    private static final String URL = "/api/boop/session-time";

    @Autowired private TrainPopulator train;
    @Autowired private CalendarEventPopulator calendar;
    @Autowired private WorkoutTimeOverrideRepository overrides;

    private RegisteredUser plannedUser() {
        RegisteredUser u = registerUser("Boop session time");
        var meso = train.createActiveMeso(u.id());
        var kedd = train.createWorkoutSession(u.id(), meso.getId(), "Kedd", "Legs 1", 1, "active");
        train.createExercise(u.id(), kedd.getId(), "Guggolás", 0);
        train.createGymSlot(u.id(), 1, "18:00");
        return u;
    }

    private SessionTimeRequest req(String date, String time) {
        SessionTimeRequest r = new SessionTimeRequest();
        r.setDate(date);
        r.setTime(time);
        return r;
    }

    private BoopBrief brief(RegisteredUser u) {
        return getForBody("/api/boop/brief?date=" + DATE, u.headers(), HttpStatus.OK, BoopBrief.class);
    }

    @Test
    void testPut_shouldStoreTheTimeAndLastWriteWins() {
        RegisteredUser u = plannedUser();

        SessionTime first = putForBody(URL, req(DATE, "18:30"), u.headers(), HttpStatus.OK, SessionTime.class);
        assertThat(first.getDate()).isEqualTo(DATE);
        assertThat(first.getTime()).isEqualTo("18:30");
        assertThat(first.getPlannedTime()).isEqualTo("18:00");

        SessionTime second = putForBody(URL, req(DATE, "19:00"), u.headers(), HttpStatus.OK, SessionTime.class);
        assertThat(second.getTime()).isEqualTo("19:00");
        assertThat(second.getPlannedTime()).isEqualTo("18:00");
        assertThat(overrides.findByCreatedByAndDate(u.id(), LocalDate.parse(DATE))).isPresent();
        assertThat(brief(u).getDay().getSession().getTime()).isEqualTo("19:00");
    }

    @Test
    void testMove_shouldClearTheConflictAndDeleteShouldBringItBack_withPutDeletePutWorking() {
        RegisteredUser u = plannedUser();
        LocalDate d = LocalDate.parse(DATE);
        calendar.createEvent(u.id(), d, "Megbeszélés",
            LocalDateTime.of(d, java.time.LocalTime.of(16, 30)).atZone(BUDAPEST).toInstant(),
            LocalDateTime.of(d, java.time.LocalTime.of(17, 30)).atZone(BUDAPEST).toInstant());

        BoopBrief before = brief(u);
        assertThat(before.getDay().getSession().getTime()).isEqualTo("18:00");
        assertThat(before.getConflict()).isNotNull();

        putForBody(URL, req(DATE, "18:30"), u.headers(), HttpStatus.OK, SessionTime.class);
        BoopBrief moved = brief(u);
        assertThat(moved.getDay().getSession().getTime()).isEqualTo("18:30");
        assertThat(moved.getDay().getSession().getPlannedTime()).isEqualTo("18:00");
        assertThat(moved.getConflict()).isNull();

        deleteAndExpect(URL + "?date=" + DATE, u.headers(), HttpStatus.NO_CONTENT);
        BoopBrief cleared = brief(u);
        assertThat(cleared.getDay().getSession().getTime()).isEqualTo("18:00");
        assertThat(cleared.getConflict()).isNotNull();
        assertThat(overrides.findByCreatedByAndDate(u.id(), d)).isEmpty();

        SessionTime again = putForBody(URL, req(DATE, "19:15"), u.headers(), HttpStatus.OK, SessionTime.class);
        assertThat(again.getTime()).isEqualTo("19:15");
        assertThat(brief(u).getDay().getSession().getTime()).isEqualTo("19:15");

        // A DELETE with nothing to clear is still a 204 (idempotent).
        deleteAndExpect(URL + "?date=" + DATE, u.headers(), HttpStatus.NO_CONTENT);
        deleteAndExpect(URL + "?date=" + DATE, u.headers(), HttpStatus.NO_CONTENT);
    }

    @Test
    void testPut_shouldReturn404_whenThereIsNoPlannedSession() {
        RegisteredUser u = registerUser("Boop no session");
        String body = putForBody(URL, req(DATE, "18:30"), u.headers(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "BOOP_NO_PLANNED_SESSION");
        assertThat(overrides.findByCreatedByAndDate(u.id(), LocalDate.parse(DATE))).isEmpty();
    }

    @Test
    void testPut_shouldReturn400_whenDateOrTimeIsImpossible() {
        RegisteredUser u = plannedUser();
        String impossible = putForBody(URL, req("2026-02-30", "18:30"), u.headers(), HttpStatus.BAD_REQUEST,
            String.class);
        assertHasFieldError(impossible, "date", "VALIDATION_INVALID_VALUE");
        String future = putForBody(URL, req("2099-01-01", "18:30"), u.headers(), HttpStatus.BAD_REQUEST,
            String.class);
        assertHasFieldError(future, "date", "VALIDATION_INVALID_VALUE");
        String badTime = putForBody(URL, req(DATE, "25:61"), u.headers(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(badTime, "time", "VALIDATION_INVALID_VALUE");
        String malformed = putForBody(URL, req(DATE, "6:30"), u.headers(), HttpStatus.BAD_REQUEST, String.class);
        assertThat(malformed).isNotBlank();
        String delFuture = exchangeForBody(org.springframework.http.HttpMethod.DELETE, URL + "?date=2099-01-01", null,
            u.headers(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(delFuture, "date", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testPut_shouldBeOwnerScoped_andRequireAuth() {
        RegisteredUser a = plannedUser();
        RegisteredUser b = plannedUser();
        putForBody(URL, req(DATE, "18:30"), a.headers(), HttpStatus.OK, SessionTime.class);
        assertThat(brief(b).getDay().getSession().getTime()).isEqualTo("18:00");
        putForBody(URL, req(DATE, "18:30"), null, HttpStatus.UNAUTHORIZED, String.class);
    }
}
