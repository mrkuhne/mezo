package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.api.dto.GoalUpsertRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the GENERATED goal contract (api/openapi.yml). */
class GoalContractIT extends ApiIntegrationTest {

    private static GoalUpsertRequest.GoalUpsertRequestBuilder req() {
        return GoalUpsertRequest.builder()
            .title("Nyári cut").trajectory("cut").guards(List.of("strength", "muscle"))
            .startDate(LocalDate.of(2026, 6, 1)).targetDate(LocalDate.of(2026, 7, 27))
            .startWeightKg(new BigDecimal("84.20")).targetWeightKg(new BigDecimal("80.00"))
            .rateTargetPctPerWeek(new BigDecimal("0.70")).identityFrame("Erő megtartva.");
    }

    @Test
    void testCreateGoal_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/goals", req().build(), null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testCreateGoal_shouldReturn201AndAppearInList_whenValid() {
        HttpHeaders auth = ownerAuthHeaders();
        GoalResponse created = postForBody("/api/goals", req().build(), auth, HttpStatus.CREATED, GoalResponse.class);
        assertThat(created.getId()).isNotNull();
        assertThat(created.getStatus()).isEqualTo(GoalResponse.StatusEnum.PLANNED);
        List<GoalResponse> goals = getForList("/api/goals", auth, HttpStatus.OK, GoalResponse.class);
        assertThat(goals).extracting(GoalResponse::getId).contains(created.getId());
    }

    @Test
    void testCreateGoal_shouldReturn400_whenTitleMissing() {
        String body = postForBody("/api/goals", req().title(null).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "title", "VALIDATION_REQUIRED_FIELD");
    }

    @Test
    void testActivateGoal_shouldFlipStatusToActive_whenCalled() {
        HttpHeaders auth = ownerAuthHeaders();
        GoalResponse created = postForBody("/api/goals", req().build(), auth, HttpStatus.CREATED, GoalResponse.class);
        GoalResponse activated = postForBody("/api/goals/" + created.getId() + "/activate", null, auth,
            HttpStatus.OK, GoalResponse.class);
        assertThat(activated.getStatus()).isEqualTo(GoalResponse.StatusEnum.ACTIVE);
    }

    @Test
    void testGetGoal_shouldReturn404_whenUnknownId() {
        getForBody("/api/goals/" + UUID.randomUUID(), ownerAuthHeaders(),
            HttpStatus.NOT_FOUND, String.class);
    }
}
