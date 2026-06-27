package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LevelUpResult;
import io.mrkuhne.mezo.api.dto.SportScheduleSlotInput;
import io.mrkuhne.mezo.api.dto.SportScheduleSlotResponse;
import io.mrkuhne.mezo.api.dto.SportSessionCreateRequest;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the GENERATED T3 sport contract (api/openapi.yml). */
class SportContractIT extends ApiIntegrationTest {

    private static SportSessionCreateRequest.SportSessionCreateRequestBuilder sessionReq() {
        return SportSessionCreateRequest.builder()
            .duration(90).setsPlayed(5).rpe(new BigDecimal("7")).shoulderStrain(6);
    }

    private static SportScheduleSlotInput slot(int dayOfWeek, String time, int durationMin, String kind) {
        return SportScheduleSlotInput.builder()
            .dayOfWeek(dayOfWeek).time(time).durationMin(durationMin).kind(kind).build();
    }

    // ---- 401s ------------------------------------------------------------------

    @Test
    void testLogSportSession_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/train/sport-sessions", sessionReq().build(),
            null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testGetSportSchedule_shouldReturn401_whenUnauthenticated() {
        getForBody("/api/train/sport-schedule", null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testReplaceSportSchedule_shouldReturn401_whenUnauthenticated() {
        putForBody("/api/train/sport-schedule", List.of(slot(0, "18:15", 90, "training")),
            null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    // ---- POST /sport-sessions ---------------------------------------------------

    @Test
    void testLogSportSession_shouldReturn201AndAppearInList_whenValid() {
        HttpHeaders auth = ownerAuthHeaders();

        SportSessionResponse created = postForBody("/api/train/sport-sessions",
            sessionReq().notes("kontrakt teszt").build(), auth, HttpStatus.CREATED, SportSessionResponse.class);

        assertThat(created.getId()).isNotNull();
        assertThat(created.getDate()).isEqualTo(LocalDate.now());
        assertThat(created.getSport()).isEqualTo("volleyball");
        assertThat(created.getIntensity()).isNull();
        assertThat(created.getJumpCount()).isNull();

        List<SportSessionResponse> sessions =
            getForList("/api/train/sport-sessions", auth, HttpStatus.OK, SportSessionResponse.class);
        assertThat(sessions).extracting(SportSessionResponse::getId).contains(created.getId());
    }

    @Test
    void testLogSportSession_shouldReturn400RequiredField_whenDurationMissing() {
        String body = postForBody("/api/train/sport-sessions",
            SportSessionCreateRequest.builder().setsPlayed(5).rpe(new BigDecimal("7")).shoulderStrain(6).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "duration", "VALIDATION_REQUIRED_FIELD");
    }

    @Test
    void testLogSportSession_shouldReturn400InvalidValue_whenRpeOutOfRange() {
        String body = postForBody("/api/train/sport-sessions",
            sessionReq().rpe(new BigDecimal("11")).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "rpe", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testLogSportSession_shouldReturn201WithLevelUp_whenCrossWithoutVolleyballFields() {
        SportSessionResponse created = postForBody("/api/train/sport-sessions",
            SportSessionCreateRequest.builder().sport("cross").duration(45).rounds(8)
                .rpe(new BigDecimal("8")).build(),
            ownerAuthHeaders(), HttpStatus.CREATED, SportSessionResponse.class);

        assertThat(created.getSport()).isEqualTo("cross");
        assertThat(created.getRounds()).isEqualTo(8);
        assertThat(created.getSetsPlayed()).isNull();
        assertThat(created.getLevelUp()).isNotNull();
        assertThat(created.getLevelUp().getSource()).isEqualTo(LevelUpResult.SourceEnum.SPORT);
    }

    @Test
    void testLogSportSession_shouldReturn400InvalidValue_whenSportNotAllowed() {
        String body = postForBody("/api/train/sport-sessions",
            sessionReq().sport("tennis").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "sport", "VALIDATION_INVALID_VALUE");
    }

    // ---- GET/PUT /sport-schedule --------------------------------------------------

    @Test
    void testSportSchedule_shouldRoundTripFullReplace_whenPutTwice() {
        HttpHeaders auth = ownerAuthHeaders();

        assertThat(getForList("/api/train/sport-schedule", auth, HttpStatus.OK,
            SportScheduleSlotResponse.class)).isEmpty();

        List<SportScheduleSlotResponse> first = putForList("/api/train/sport-schedule",
            List.of(slot(0, "18:15", 90, "training"), slot(5, "10:00", 120, "match")), auth);
        assertThat(first).extracting(SportScheduleSlotResponse::getDayOfWeek).containsExactly(0, 5);

        List<SportScheduleSlotResponse> second = putForList("/api/train/sport-schedule",
            List.of(slot(2, "19:00", 60, "training")), auth);
        assertThat(second).hasSize(1);

        List<SportScheduleSlotResponse> after =
            getForList("/api/train/sport-schedule", auth, HttpStatus.OK, SportScheduleSlotResponse.class);
        assertThat(after).hasSize(1);
        assertThat(after.get(0).getDayOfWeek()).isEqualTo(2);
        assertThat(after.get(0).getKind()).isEqualTo(SportScheduleSlotResponse.KindEnum.TRAINING);
    }

    @Test
    void testReplaceSportSchedule_shouldReturn400InvalidValue_whenDayOfWeekOutOfRange() {
        // List<@Valid X> method validation -> ConstraintViolationException handler (T2 lesson).
        String body = putForBody("/api/train/sport-schedule", List.of(slot(7, "18:15", 90, "training")),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "dayOfWeek", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testReplaceSportSchedule_shouldReturn400InvalidValue_whenKindUnknown() {
        String body = putForBody("/api/train/sport-schedule", List.of(slot(0, "18:15", 90, "race")),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "kind", "VALIDATION_INVALID_VALUE");
    }

    /** PUT returning a JSON array — deserialized via the shared ObjectMapper. */
    private List<SportScheduleSlotResponse> putForList(String uri, Object request, HttpHeaders auth) {
        String body = putForBody(uri, request, auth, HttpStatus.OK, String.class);
        try {
            return objectMapper.readValue(body, objectMapper.getTypeFactory()
                .constructCollectionType(List.class, SportScheduleSlotResponse.class));
        } catch (Exception e) {
            throw new IllegalStateException("Failed to deserialize slot list: " + body, e);
        }
    }
}
