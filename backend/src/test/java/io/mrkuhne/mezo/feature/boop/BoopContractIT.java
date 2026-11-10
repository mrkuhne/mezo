package io.mrkuhne.mezo.feature.boop;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.BoopBrief;
import io.mrkuhne.mezo.api.dto.BoopDay;
import io.mrkuhne.mezo.api.dto.BoopSleep;
import jakarta.validation.constraints.NotNull;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;

/** Boop S3 Task 6 (mezo-r36n9.7): /api/boop/brief round-trips through the generated BoopApi. */
@ActiveProfiles("companion-fake")
class BoopContractIT extends ApiIntegrationTest {

    private static final String DATE = "2026-11-10";

    @Autowired private SleepLogPopulator sleepLogs;

    /** Final review I3: a night logged without bedtime or wakeup (the sleep API allows it) must not
     *  break the brief — 200, the two times are explicit nulls, and the contract says they may be. */
    @Test
    void testGetBrief_shouldSerializeNullSleepTimes_whenTheNightHasNoBedtimeOrWakeup() throws Exception {
        RegisteredUser u = registerUser("Boop timeless night");
        sleepLogs.createSleepLog(u.id(), LocalDate.parse(DATE), new BigDecimal("7.00"), 7); // no times

        String raw = getForBody("/api/boop/brief?date=" + DATE, u.headers(), HttpStatus.OK, String.class);

        JsonNode sleep = objectMapper.readTree(raw).get("day").get("sleep");
        assertThat(sleep.get("totalMin").asInt()).isEqualTo(420);
        assertThat(sleep.has("bedtime")).isTrue();
        assertThat(sleep.get("bedtime").isNull()).isTrue();
        assertThat(sleep.get("wakeup").isNull()).isTrue();
        // The contract (and so every generated client) declares both nullable.
        assertThat(BoopSleep.class.getMethod("getBedtime").isAnnotationPresent(NotNull.class)).isFalse();
        assertThat(BoopSleep.class.getMethod("getWakeup").isAnnotationPresent(NotNull.class)).isFalse();
    }

    /** Final review M1: no wearable day → steps and active kcal are null on the wire, never a fake 0. */
    @Test
    void testGetBrief_shouldSendNullStepsAndActiveKcal_whenThereIsNoWearableDay() throws Exception {
        RegisteredUser u = registerUser("Boop no steps");

        String raw = getForBody("/api/boop/brief?date=" + DATE, u.headers(), HttpStatus.OK, String.class);

        JsonNode day = objectMapper.readTree(raw).get("day");
        assertThat(day.get("steps").isNull()).isTrue();
        assertThat(day.get("activeKcal").isNull()).isTrue();
        assertThat(day.get("stepsGoal").asInt()).isEqualTo(9000);
        assertThat(BoopDay.class.getMethod("getSteps").isAnnotationPresent(NotNull.class)).isFalse();
        assertThat(BoopDay.class.getMethod("getActiveKcal").isAnnotationPresent(NotNull.class)).isFalse();
    }

    @Test
    void testGetBrief_shouldReturnTheFullSchema_whenAuthenticated() {
        RegisteredUser u = registerUser("Boop brief");
        sleepLogs.createSleepLog(u.id(), LocalDate.parse(DATE), new BigDecimal("7.50"), 8);

        BoopBrief b = getForBody("/api/boop/brief?date=" + DATE, u.headers(), HttpStatus.OK, BoopBrief.class);

        assertThat(b.getDate()).isEqualTo(DATE);
        assertThat(b.getGeneratedAt()).isNotNull();
        assertThat(b.getState()).isNotNull();
        assertThat(b.getMetrics()).hasSize(5);
        assertThat(b.getBrief()).isNotEmpty();
        assertThat(b.getEnergy().getHourly()).hasSize(19);
        assertThat(b.getTonightTip()).isNotBlank();
        assertThat(b.getDay().getSleep().getTotalMin()).isEqualTo(450);
        assertThat(b.getDay().getDeepSleepWeek()).hasSize(7);
        assertThat(b.getDay().getRestingHrWeek()).hasSize(7);
        assertThat(b.getDay().getCalendar().getBusySlots()).hasSize(72);
        assertThat(b.getDay().getIntention()).isNotNull();

        // A second user sees their own (empty) day, not the first user's night.
        RegisteredUser other = registerUser("Boop other");
        BoopBrief theirs = getForBody("/api/boop/brief?date=" + DATE, other.headers(), HttpStatus.OK, BoopBrief.class);
        assertThat(theirs.getDay().getSleep()).isNull();
    }

    @Test
    void testGetBrief_shouldReject_whenDateMalformedOrUnauthenticated() {
        RegisteredUser u = registerUser("Boop bad date");
        getForBody("/api/boop/brief?date=10-11-2026", u.headers(), HttpStatus.BAD_REQUEST, String.class);
        getForBody("/api/boop/brief?date=" + DATE, null, HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void testGetBrief_shouldReturn400WithAFieldError_whenTheDateDoesNotExistOrIsInTheFuture() {
        RegisteredUser u = registerUser("Boop impossible date");
        String impossible = getForBody("/api/boop/brief?date=2026-02-30", u.headers(), HttpStatus.BAD_REQUEST,
            String.class);
        assertHasFieldError(impossible, "date", "VALIDATION_INVALID_VALUE");
        String month13 = postForBody("/api/boop/brief/regenerate?date=2026-13-01", null, u.headers(),
            HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(month13, "date", "VALIDATION_INVALID_VALUE");
        String future = getForBody("/api/boop/brief?date=2099-01-01", u.headers(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(future, "date", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testRegenerate_shouldReturn409WithTheLimitCode_whenCalledAFourthTime() {
        RegisteredUser u = registerUser("Boop regen");
        for (int i = 0; i < 3; i++) {
            postForBody("/api/boop/brief/regenerate?date=" + DATE, null, u.headers(), HttpStatus.OK, BoopBrief.class);
        }
        String body = postForBody("/api/boop/brief/regenerate?date=" + DATE, null, u.headers(),
            HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "BOOP_REGENERATE_LIMIT_REACHED");
    }
}
