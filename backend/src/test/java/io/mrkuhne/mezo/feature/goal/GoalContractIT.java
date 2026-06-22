package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.BiometricProfileUpsertRequest;
import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.api.dto.GoalUpsertRequest;
import io.mrkuhne.mezo.api.dto.LogWeightRequest;
import io.mrkuhne.mezo.api.dto.WeightLogResponse;
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
            .identityFrame("Erő megtartva.");
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
        // rateTargetPctPerWeek is no longer an input — the response carries the server-derived value:
        // (84.20 − 80.00) / 84.20 * 100 / 8 weeks ≈ 0.62.
        assertThat(created.getRateTargetPctPerWeek())
            .isCloseTo(new BigDecimal("0.62"), within(new BigDecimal("0.01")));
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
    void testCreateGoal_shouldReturn400_whenTargetDateBeforeStartDate() {
        String body = postForBody("/api/goals",
            req().startDate(LocalDate.of(2026, 6, 1)).targetDate(LocalDate.of(2026, 5, 1)).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "targetDate", "VALIDATION_INVALID_VALUE");
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

    // ── POST /api/goals/{id}/evaluate (G5 Task 10: mezo-g1u) ────────────────────────────────────────

    @Test
    void testEvaluateGoal_shouldReturn200WithPopulatedPrescriptionAndBootstrap_whenProfileSeeded() {
        HttpHeaders auth = ownerAuthHeaders();
        seedProfile(auth);
        seedWeighIns(auth);
        GoalResponse goal = postForBody("/api/goals", req().build(), auth, HttpStatus.CREATED, GoalResponse.class);

        GoalResponse evaluated = postForBody("/api/goals/" + goal.getId() + "/evaluate", null, auth,
            HttpStatus.OK, GoalResponse.class);

        // With a profile + weigh-ins the engine produces a full prescription (feasibility + ≥1 segment)
        // and a TDEE bootstrap.
        assertThat(evaluated.getPrescription()).isNotNull();
        assertThat(evaluated.getPrescription().getFeasibility()).isNotNull();
        assertThat(evaluated.getPrescription().getFeasibility().getVerdict()).isNotNull();
        assertThat(evaluated.getPrescription().getSegments()).isNotEmpty();
        assertThat(evaluated.getTdeeBootstrap()).isNotNull();

        // The prescription was persisted on the goal: a follow-up GET returns it.
        GoalResponse refetched = getForBody("/api/goals/" + goal.getId(), auth, HttpStatus.OK, GoalResponse.class);
        assertThat(refetched.getPrescription()).isNotNull();
        assertThat(refetched.getPrescription().getSegments()).isNotEmpty();
        assertThat(refetched.getTdeeBootstrap()).isNotNull();
    }

    @Test
    void testEvaluateGoal_shouldReturn200WithGracefulNote_whenNoBiometricProfile() {
        HttpHeaders auth = ownerAuthHeaders();
        // No profile seeded → graceful: a prescription carrying the "profile required" feasibility note,
        // NOT a 4xx (Task 9 recompute triggers rely on this not throwing).
        GoalResponse goal = postForBody("/api/goals", req().build(), auth, HttpStatus.CREATED, GoalResponse.class);

        GoalResponse evaluated = postForBody("/api/goals/" + goal.getId() + "/evaluate", null, auth,
            HttpStatus.OK, GoalResponse.class);

        assertThat(evaluated.getPrescription()).isNotNull();
        assertThat(evaluated.getPrescription().getFeasibility()).isNotNull();
        assertThat(evaluated.getPrescription().getFeasibility().getNotes())
            .anyMatch(n -> n.contains("Biometriai profil"));
        // No profile → no bootstrap.
        assertThat(evaluated.getTdeeBootstrap()).isNull();
    }

    @Test
    void testEvaluateGoal_shouldReturn404_whenUnknownId() {
        postForBody("/api/goals/" + UUID.randomUUID() + "/evaluate", null, ownerAuthHeaders(),
            HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void testEvaluateGoal_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/goals/" + UUID.randomUUID() + "/evaluate", null, null,
            HttpStatus.UNAUTHORIZED, Void.class);
    }

    private void seedProfile(HttpHeaders auth) {
        putForBody("/api/biometrics/profile",
            BiometricProfileUpsertRequest.builder()
                .sex("M").heightCm(new BigDecimal("180.0"))
                .birthDate(LocalDate.of(1991, 3, 1)).bodyFatPct(new BigDecimal("15.0"))
                .build(),
            auth, HttpStatus.OK, Object.class);
    }

    private void seedWeighIns(HttpHeaders auth) {
        for (int day = 0; day <= 14; day++) {
            BigDecimal w = new BigDecimal("84.00").subtract(new BigDecimal("0.10").multiply(BigDecimal.valueOf(day)));
            postForBody("/api/biometrics/weight",
                LogWeightRequest.builder().date(LocalDate.of(2026, 5, 1).plusDays(day)).weightKg(w).build(),
                auth, HttpStatus.CREATED, WeightLogResponse.class);
        }
    }
}
