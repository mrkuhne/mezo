package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SportEventCreateRequest;
import io.mrkuhne.mezo.api.dto.SportEventResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the GENERATED one-off sport-event contract (mezo-e1sp, api/openapi.yml). */
class SportEventContractIT extends ApiIntegrationTest {

    private static SportEventCreateRequest.SportEventCreateRequestBuilder eventReq(LocalDate date) {
        return SportEventCreateRequest.builder().date(date).time("19:00").durationMin(90);
    }

    // ---- 401s ------------------------------------------------------------------

    @Test
    void testListSportEvents_shouldReturn401_whenUnauthenticated() {
        getForBody("/api/train/sport-events", null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testCreateSportEvent_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/train/sport-events", eventReq(LocalDate.now()).build(),
            null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testDeleteSportEvent_shouldReturn401_whenUnauthenticated() {
        deleteAndExpect("/api/train/sport-events/" + UUID.randomUUID(), null, HttpStatus.UNAUTHORIZED);
    }

    // ---- POST + GET -------------------------------------------------------------

    @Test
    void testCreateSportEvent_shouldReturn201AndAppearInList_whenValid() {
        HttpHeaders auth = ownerAuthHeaders();
        LocalDate saturday = LocalDate.now().plusDays(3);

        SportEventResponse created = postForBody("/api/train/sport-events",
            eventReq(saturday).kind("match").sport("volleyball").location("BVSC csarnok").build(),
            auth, HttpStatus.CREATED, SportEventResponse.class);

        assertThat(created.getId()).isNotNull();
        assertThat(created.getDate()).isEqualTo(saturday);
        assertThat(created.getKind()).isEqualTo(SportEventResponse.KindEnum.MATCH);
        assertThat(created.getSport()).isEqualTo("volleyball");
        assertThat(created.getLocation()).isEqualTo("BVSC csarnok");

        List<SportEventResponse> events =
            getForList("/api/train/sport-events", auth, HttpStatus.OK, SportEventResponse.class);
        assertThat(events).extracting(SportEventResponse::getId).contains(created.getId());
    }

    @Test
    void testCreateSportEvent_shouldDefaultTrainingVolleyball_whenKindAndSportOmitted() {
        SportEventResponse created = postForBody("/api/train/sport-events",
            eventReq(LocalDate.now()).build(), ownerAuthHeaders(), HttpStatus.CREATED, SportEventResponse.class);

        assertThat(created.getKind()).isEqualTo(SportEventResponse.KindEnum.TRAINING);
        assertThat(created.getSport()).isEqualTo("volleyball");
    }

    @Test
    void testListSportEvents_shouldFilterByRangeAndOrderByDateTime_whenFromToGiven() {
        HttpHeaders auth = ownerAuthHeaders();
        LocalDate monday = LocalDate.now();

        postForBody("/api/train/sport-events", eventReq(monday.plusDays(9)).build(),
            auth, HttpStatus.CREATED, SportEventResponse.class); // outside the range
        postForBody("/api/train/sport-events", eventReq(monday.plusDays(2)).time("20:00").build(),
            auth, HttpStatus.CREATED, SportEventResponse.class);
        postForBody("/api/train/sport-events", eventReq(monday.plusDays(2)).time("08:00").sport("trx").build(),
            auth, HttpStatus.CREATED, SportEventResponse.class);

        List<SportEventResponse> week = getForList(
            "/api/train/sport-events?from=" + monday + "&to=" + monday.plusDays(6),
            auth, HttpStatus.OK, SportEventResponse.class);

        assertThat(week).hasSize(2);
        assertThat(week).extracting(SportEventResponse::getTime).containsExactly("08:00", "20:00");
    }

    // ---- Validation -------------------------------------------------------------

    @Test
    void testCreateSportEvent_shouldReturn400RequiredField_whenDateMissing() {
        String body = postForBody("/api/train/sport-events",
            SportEventCreateRequest.builder().time("19:00").durationMin(90).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "date", "VALIDATION_REQUIRED_FIELD");
    }

    @Test
    void testCreateSportEvent_shouldReturn400InvalidValue_whenSportUnknown() {
        String body = postForBody("/api/train/sport-events",
            eventReq(LocalDate.now()).sport("tennis").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "sport", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreateSportEvent_shouldReturn400InvalidValue_whenKindUnknown() {
        String body = postForBody("/api/train/sport-events",
            eventReq(LocalDate.now()).kind("race").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "kind", "VALIDATION_INVALID_VALUE");
    }

    // ---- DELETE -----------------------------------------------------------------

    @Test
    void testDeleteSportEvent_shouldSoftDeleteAndDisappearFromList_whenOwned() {
        HttpHeaders auth = ownerAuthHeaders();

        SportEventResponse created = postForBody("/api/train/sport-events",
            eventReq(LocalDate.now().plusDays(1)).build(), auth, HttpStatus.CREATED, SportEventResponse.class);

        deleteAndExpect("/api/train/sport-events/" + created.getId(), auth, HttpStatus.NO_CONTENT);

        List<SportEventResponse> after =
            getForList("/api/train/sport-events", auth, HttpStatus.OK, SportEventResponse.class);
        assertThat(after).extracting(SportEventResponse::getId).doesNotContain(created.getId());
    }

    @Test
    void testDeleteSportEvent_shouldReturn404_whenUnknownId() {
        deleteAndExpect("/api/train/sport-events/" + UUID.randomUUID(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND);
    }
}
