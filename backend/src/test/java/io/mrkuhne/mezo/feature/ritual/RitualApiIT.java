package io.mrkuhne.mezo.feature.ritual;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.RitualCloseRequest;
import io.mrkuhne.mezo.api.dto.RitualDayResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

class RitualApiIT extends ApiIntegrationTest {

    @Autowired SleepGoalPopulator sleepGoalPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testGetDay_shouldServeGhostWindow_whenNoSleepGoal() {
        RitualDayResponse day = getForBody("/api/ritual/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        // config-ghost bed anchor is 22:00 (WAKE 06:00 − 480 min default target, mezo.sleep defaults)
        assertThat(day.getClosed()).isFalse();
        assertThat(day.getWindow().getBedTime()).isEqualTo("22:00");
        assertThat(day.getWindow().getOpensAt()).isEqualTo("20:45");
        assertThat(day.getWindow().getPrepStartsAt()).isEqualTo("21:15");
    }

    @Test
    void testGetDay_shouldRecenterWindow_whenSleepGoalExists() {
        sleepGoalPopulator.goal(ownerId()); // WAKE 06:45, 450 min → derived bed 23:15
        RitualDayResponse day = getForBody("/api/ritual/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(day.getWindow().getBedTime()).isEqualTo("23:15");
        assertThat(day.getWindow().getOpensAt()).isEqualTo("22:00");
    }

    @Test
    void testClose_shouldBeIdempotent_whenClosedTwice() {
        var req = RitualCloseRequest.builder().date(LocalDate.now()).build();
        RitualDayResponse first = postForBody("/api/ritual/close", req,
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        RitualDayResponse second = postForBody("/api/ritual/close", req,
            ownerAuthHeaders(), HttpStatus.OK, RitualDayResponse.class);
        assertThat(first.getClosed()).isTrue();
        assertThat(second.getClosedAt()).isEqualTo(first.getClosedAt());
    }

    @Test
    void testClose_shouldReject_whenNotToday() {
        String err = postForBody("/api/ritual/close",
            RitualCloseRequest.builder().date(LocalDate.now().minusDays(1)).build(),
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(err, "RITUAL_NOT_TODAY");
    }
}
