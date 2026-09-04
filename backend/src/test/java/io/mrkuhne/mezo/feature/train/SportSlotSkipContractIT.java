package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SportSlotSkipResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.SportSlotSkipPopulator;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trip through the GENERATED sport-slot-skips read (mezo-d58h.5, api/openapi.yml) —
 *  the FE's own dedicated GET behind {@code weekAgenda.ts}'s skip filter. */
class SportSlotSkipContractIT extends ApiIntegrationTest {

    @Autowired private SportSlotSkipPopulator populator;

    private static final LocalDate FRI = LocalDate.parse("2026-09-11"); // a Friday

    @Test
    void testListSportSlotSkips_shouldReturn401_whenUnauthenticated() {
        getForBody("/api/train/sport-slot-skips?from=" + FRI + "&to=" + FRI.plusDays(6), null,
            HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testListSportSlotSkips_shouldReturnEmptyList_whenNoneInRange() {
        HttpHeaders auth = ownerAuthHeaders();

        List<SportSlotSkipResponse> result = getForList(
            "/api/train/sport-slot-skips?from=" + FRI + "&to=" + FRI.plusDays(6), auth, HttpStatus.OK,
            SportSlotSkipResponse.class);

        assertThat(result).isEmpty();
    }

    @Test
    void testListSportSlotSkips_shouldReturnSkipsInRange_whenPresent() {
        RegisteredUser owner = registerUser("Skip Range Owner");
        populator.createSkip(owner.id(), 4, "18:00", FRI);
        populator.createSkip(owner.id(), 1, "07:00", FRI.plusDays(3));
        populator.createSkip(owner.id(), 4, "18:00", FRI.plusDays(30)); // outside the range

        List<SportSlotSkipResponse> result = getForList(
            "/api/train/sport-slot-skips?from=" + FRI + "&to=" + FRI.plusDays(6), owner.headers(), HttpStatus.OK,
            SportSlotSkipResponse.class);

        assertThat(result).extracting(SportSlotSkipResponse::getDayOfWeek, SportSlotSkipResponse::getTime,
            SportSlotSkipResponse::getDate)
            .containsExactly(
                org.assertj.core.groups.Tuple.tuple(4, "18:00", FRI),
                org.assertj.core.groups.Tuple.tuple(1, "07:00", FRI.plusDays(3)));
    }

    @Test
    void testListSportSlotSkips_shouldNotLeakAnotherUsersSkips() {
        RegisteredUser owner = registerUser("Skip Leak Owner");
        RegisteredUser other = registerUser("Other Skip User");
        populator.createSkip(other.id(), 4, "18:00", FRI);

        List<SportSlotSkipResponse> result = getForList(
            "/api/train/sport-slot-skips?from=" + FRI + "&to=" + FRI.plusDays(6), owner.headers(), HttpStatus.OK,
            SportSlotSkipResponse.class);

        assertThat(result).isEmpty();
    }
}
