package io.mrkuhne.mezo.feature.dayclose;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CheckInLineRequest;
import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.api.dto.DayCloseLineResponse;
import io.mrkuhne.mezo.api.dto.DayCloseRequest;
import io.mrkuhne.mezo.api.dto.DayCloseResponse;
import io.mrkuhne.mezo.api.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.feature.biometrics.checkin.config.OwnerZoneProperties;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/** Boop B3 (mezo-r36n9.13): /api/day-close over HTTP — the date window, Boop's lines, their cache, the 503. */
@ActiveProfiles("companion-fake")
class DayCloseApiIT extends ApiIntegrationTest {

    @Autowired private OwnerZoneProperties ownerZone;
    @Autowired private FakeCompanionLlm fakeLlm;

    private LocalDate today;

    @BeforeEach
    void setUp() {
        today = LocalDate.now(ownerZone.zoneId());
    }

    private static DayCloseRequest close(String goalText) {
        return new DayCloseRequest()
            .capturedAt(OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1))
            .clientRef(UUID.randomUUID())
            .dayRating(4)
            .eveningEnergy(7)
            .goalText(goalText)
            .goalOutcome(DayCloseRequest.GoalOutcomeEnum.PARTIAL)
            .planGoals(List.of());
    }

    @Test
    void futureDateIs400() {
        RegisteredUser u = registerUser("dayclose future");
        String err = putForBody("/api/day-close/" + today.plusDays(1), close("Cél"), u.headers(),
            HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(err, "date", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void olderThanSevenDaysIs400() {
        RegisteredUser u = registerUser("dayclose old");
        putForBody("/api/day-close/" + today.minusDays(8), close("Cél"), u.headers(),
            HttpStatus.BAD_REQUEST, String.class);
        // the window's edge is inclusive
        putForBody("/api/day-close/" + today.minusDays(7), close("Cél"), u.headers(),
            HttpStatus.OK, DayCloseResponse.class);
    }

    @Test
    void getUnclosedDayIs404() {
        RegisteredUser u = registerUser("dayclose open");
        getForBody("/api/day-close/" + today, u.headers(), HttpStatus.NOT_FOUND, String.class);
        postForBody("/api/day-close/" + today + "/line", null, u.headers(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void lineEndpointReturns503SafeWhenLlmDown() {
        RegisteredUser u = registerUser("dayclose line");
        putForBody("/api/day-close/" + today, close("Futás " + FakeCompanionLlm.FAIL_COMPLETE), u.headers(),
            HttpStatus.OK, DayCloseResponse.class);

        String err = postForBody("/api/day-close/" + today + "/line", null, u.headers(),
            HttpStatus.SERVICE_UNAVAILABLE, String.class);
        assertHasRequestError(err, "DAY_CLOSE_LINE_UNAVAILABLE");

        // the model is back: one call, then the same line from the cache (same inputs, same hash)
        putForBody("/api/day-close/" + today, close("Futás a parkban"), u.headers(), HttpStatus.OK,
            DayCloseResponse.class);
        int before = fakeLlm.dayCloseLineCallCount();
        DayCloseLineResponse first = postForBody("/api/day-close/" + today + "/line", null, u.headers(),
            HttpStatus.OK, DayCloseLineResponse.class);
        DayCloseLineResponse second = postForBody("/api/day-close/" + today + "/line", null, u.headers(),
            HttpStatus.OK, DayCloseLineResponse.class);

        assertThat(first.getLine()).isNotBlank();
        assertThat(second.getLine()).isEqualTo(first.getLine());
        assertThat(fakeLlm.dayCloseLineCallCount()).isEqualTo(before + 1);
        DayCloseResponse stored = getForBody("/api/day-close/" + today, u.headers(), HttpStatus.OK,
            DayCloseResponse.class);
        assertThat(stored.getBoopLine()).isEqualTo(first.getLine());

        // a changed close drops the stale line; the next ask calls the model again
        putForBody("/api/day-close/" + today, close("Futás a parkban").dayRating(2), u.headers(), HttpStatus.OK,
            DayCloseResponse.class);
        assertThat(getForBody("/api/day-close/" + today, u.headers(), HttpStatus.OK, DayCloseResponse.class)
            .getBoopLine()).isNull();
        postForBody("/api/day-close/" + today + "/line", null, u.headers(), HttpStatus.OK, DayCloseLineResponse.class);
        assertThat(fakeLlm.dayCloseLineCallCount()).isEqualTo(before + 2);
    }

    @Test
    void checkInLineIsCachedAndRejectsAnEmptySlot() {
        RegisteredUser u = registerUser("dayclose checkin line");
        postForBody("/api/biometrics/checkin", SaveCheckInRequest.builder().date(today).slotTime("06:30")
            .state("done").energy(5).mood(6).stress(4).body(5).mental(6).build(), u.headers(), HttpStatus.OK,
            CheckInResponse.class);
        postForBody("/api/biometrics/checkin", SaveCheckInRequest.builder().date(today).slotTime("14:00")
            .state("done").energy(7).mood(7).stress(3).body(6).mental(7).build(), u.headers(), HttpStatus.OK,
            CheckInResponse.class);

        int before = fakeLlm.dayCloseLineCallCount();
        DayCloseLineResponse first = postForBody("/api/day-close/" + today + "/checkin-line",
            new CheckInLineRequest().slot("14:00"), u.headers(), HttpStatus.OK, DayCloseLineResponse.class);
        DayCloseLineResponse second = postForBody("/api/day-close/" + today + "/checkin-line",
            new CheckInLineRequest().slot("14:00"), u.headers(), HttpStatus.OK, DayCloseLineResponse.class);

        assertThat(first.getLine()).isNotBlank();
        assertThat(second.getLine()).isEqualTo(first.getLine());
        assertThat(fakeLlm.dayCloseLineCallCount()).isEqualTo(before + 1);
        // the prompt cites the energy against the earlier check-in of the day
        assertThat(fakeLlm.lastUserMessage()).contains("energia 7").contains("06:30");

        postForBody("/api/day-close/" + today + "/checkin-line", new CheckInLineRequest().slot("10:00"),
            u.headers(), HttpStatus.BAD_REQUEST, String.class);
        postForBody("/api/day-close/" + today + "/checkin-line", new CheckInLineRequest().slot("nope"),
            u.headers(), HttpStatus.BAD_REQUEST, String.class);
        postForBody("/api/day-close/" + today + "/checkin-line", new CheckInLineRequest().slot(""),
            u.headers(), HttpStatus.BAD_REQUEST, String.class);
        postForBody("/api/day-close/" + today.plusDays(1) + "/checkin-line", new CheckInLineRequest().slot("14:00"),
            u.headers(), HttpStatus.BAD_REQUEST, String.class);
    }
}
