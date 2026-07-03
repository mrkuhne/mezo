package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymScheduleSlotInput;
import io.mrkuhne.mezo.api.dto.GymScheduleSlotResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the GENERATED gym-schedule contract (api/openapi.yml). */
class GymScheduleContractIT extends ApiIntegrationTest {

    private static final String SCHEDULE = "/api/train/gym-schedule";

    private static GymScheduleSlotInput slot(int dayOfWeek, String time) {
        return GymScheduleSlotInput.builder().dayOfWeek(dayOfWeek).time(time).build();
    }

    // ---- 401s ------------------------------------------------------------------

    @Test
    void testGetGymSchedule_shouldReturn401_whenUnauthenticated() {
        getForBody(SCHEDULE, null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testReplaceGymSchedule_shouldReturn401_whenUnauthenticated() {
        putForBody(SCHEDULE, List.of(slot(1, "18:30")),
            null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testGetGymSchedule_shouldReturnEmpty_whenNoneSet() {
        List<GymScheduleSlotResponse> slots =
            getForList(SCHEDULE, ownerAuthHeaders(), HttpStatus.OK, GymScheduleSlotResponse.class);
        assertThat(slots).isEmpty();
    }

    @Test
    void testPutGymSchedule_shouldReplaceAllOrdered_whenFullListPut() {
        HttpHeaders auth = ownerAuthHeaders();

        List<GymScheduleSlotResponse> put =
            putForList(SCHEDULE, List.of(slot(3, "18:30"), slot(1, "18:30")), auth);
        assertThat(put).extracting(GymScheduleSlotResponse::getDayOfWeek).containsExactly(1, 3);

        // PUT again replaces (no accumulation).
        putForList(SCHEDULE, List.of(slot(5, "09:00")), auth);

        List<GymScheduleSlotResponse> after =
            getForList(SCHEDULE, auth, HttpStatus.OK, GymScheduleSlotResponse.class);
        assertThat(after).singleElement().satisfies(s -> {
            assertThat(s.getDayOfWeek()).isEqualTo(5);
            assertThat(s.getTime()).isEqualTo("09:00");
        });
    }

    /** PUT returning a JSON array — deserialized via the shared ObjectMapper. */
    private List<GymScheduleSlotResponse> putForList(String uri, Object request, HttpHeaders auth) {
        String body = putForBody(uri, request, auth, HttpStatus.OK, String.class);
        try {
            return objectMapper.readValue(body, objectMapper.getTypeFactory()
                .constructCollectionType(List.class, GymScheduleSlotResponse.class));
        } catch (Exception e) {
            throw new IllegalStateException("Failed to deserialize slot list: " + body, e);
        }
    }
}
