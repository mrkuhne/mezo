package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.BiometricProfileUpsertRequest;
import io.mrkuhne.mezo.api.dto.FeasibilityPreviewRequest;
import io.mrkuhne.mezo.api.dto.FeasibilityPreviewResponse;
import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.api.dto.GoalSuggestionResponse;
import io.mrkuhne.mezo.api.dto.GoalUpsertRequest;
import io.mrkuhne.mezo.api.dto.LogWeightRequest;
import io.mrkuhne.mezo.api.dto.WeightLogResponse;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.GoalSuggestionPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the GENERATED goal contract (api/openapi.yml). */
class GoalContractIT extends ApiIntegrationTest {

    @Autowired private GoalSuggestionPopulator suggestionPopulator;

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

    // ── Fuel P5 day-planner settings round-trip (mezo-9ys) ──────────────────────────────────────────

    @Test
    void testCreateGoal_shouldRoundTripPlannerSettings_whenProvided() {
        HttpHeaders auth = ownerAuthHeaders();
        GoalResponse created = postForBody("/api/goals",
            req().mealsPerDay(4).wakeTime("06:00").bedTime("23:00").build(),
            auth, HttpStatus.CREATED, GoalResponse.class);
        assertThat(created.getMealsPerDay()).isEqualTo(4);
        assertThat(created.getWakeTime()).isEqualTo("06:00");
        assertThat(created.getBedTime()).isEqualTo("23:00");

        // The columns persisted — a follow-up GET echoes them back.
        GoalResponse refetched = getForBody("/api/goals/" + created.getId(), auth, HttpStatus.OK, GoalResponse.class);
        assertThat(refetched.getMealsPerDay()).isEqualTo(4);
        assertThat(refetched.getWakeTime()).isEqualTo("06:00");
        assertThat(refetched.getBedTime()).isEqualTo("23:00");
    }

    @Test
    void testUpdateGoal_shouldKeepPlannerSettingsNull_whenOmitted() {
        HttpHeaders auth = ownerAuthHeaders();
        // Create WITH planner settings, then PUT WITHOUT them — the omitted fields round-trip to null.
        GoalResponse created = postForBody("/api/goals",
            req().mealsPerDay(4).wakeTime("06:00").bedTime("23:00").build(),
            auth, HttpStatus.CREATED, GoalResponse.class);

        GoalResponse updated = putForBody("/api/goals/" + created.getId(), req().build(),
            auth, HttpStatus.OK, GoalResponse.class);
        assertThat(updated.getMealsPerDay()).isNull();
        assertThat(updated.getWakeTime()).isNull();
        assertThat(updated.getBedTime()).isNull();

        GoalResponse refetched = getForBody("/api/goals/" + created.getId(), auth, HttpStatus.OK, GoalResponse.class);
        assertThat(refetched.getMealsPerDay()).isNull();
        assertThat(refetched.getWakeTime()).isNull();
        assertThat(refetched.getBedTime()).isNull();
    }

    @Test
    void testCreateGoal_shouldReject_whenWakeTimeMalformed() {
        // "6:00" is missing the leading hour digit → fails the HH:mm pattern → 400 FIELD error on wakeTime.
        String body = postForBody("/api/goals", req().wakeTime("6:00").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "wakeTime", "VALIDATION_INVALID_VALUE");
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

        // The NEAT/EAT split + per-segment energy balance map through to the contract DTOs (mezo-eujg).
        assertThat(evaluated.getTdeeBootstrap().getNeat()).isNotNull();
        assertThat(evaluated.getTdeeBootstrap().getNeatBaselineKcal()).isNotNull();
        assertThat(evaluated.getTdeeBootstrap().getWeeklyEatKcalPerDay()).isNotNull();
        assertThat(evaluated.getPrescription().getSegments().get(0).getDailyEnergyBalanceKcal()).isNotNull();

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

    // ── POST /api/goals/feasibility-preview (G6 Task 2: mezo-06n) — stateless realism preview ───────

    @Test
    void testFeasibilityPreview_shouldReturn200WithDerivedRateAndVerdict_whenAggressiveDraft() {
        HttpHeaders auth = ownerAuthHeaders();
        LocalDate start = LocalDate.of(2026, 6, 1);
        // (84 − 78) / 84 * 100 / 5 weeks ≈ 1.43 %BW/wk → over the 1.0 cap → aggressive + cap-paced date.
        FeasibilityPreviewRequest body = FeasibilityPreviewRequest.builder()
            .trajectory("cut").startWeightKg(new BigDecimal("84.00")).targetWeightKg(new BigDecimal("78.00"))
            .startDate(start).targetDate(start.plusWeeks(5)).build();

        FeasibilityPreviewResponse res = postForBody("/api/goals/feasibility-preview", body, auth,
            HttpStatus.OK, FeasibilityPreviewResponse.class);

        assertThat(res.getDerivedRatePctPerWeek())
            .isCloseTo(new BigDecimal("1.43"), within(new BigDecimal("0.01")));
        assertThat(res.getWithinSafeBand()).isFalse();
        assertThat(res.getVerdict()).isEqualTo(FeasibilityPreviewResponse.VerdictEnum.AGGRESSIVE);
        assertThat(res.getSuggestedTargetDate()).isEqualTo(start.plusWeeks(8));
    }

    @Test
    void testFeasibilityPreview_shouldReturn401_whenUnauthenticated() {
        FeasibilityPreviewRequest body = FeasibilityPreviewRequest.builder()
            .trajectory("cut").startWeightKg(new BigDecimal("84.00")).targetWeightKg(new BigDecimal("80.00"))
            .startDate(LocalDate.of(2026, 6, 1)).targetDate(LocalDate.of(2026, 7, 27)).build();
        postForBody("/api/goals/feasibility-preview", body, null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    // ── GET/POST /api/goals/{id}/suggestions* (Diet Plan slice 4 Task 8: mezo-ktg8) ─────────────────

    @Test
    void testListGoalSuggestions_shouldReturnEmpty_whenNoneProposed() {
        HttpHeaders auth = ownerAuthHeaders();
        GoalResponse goal = postForBody("/api/goals", req().build(), auth, HttpStatus.CREATED, GoalResponse.class);

        List<GoalSuggestionResponse> suggestions = getForList(
            "/api/goals/" + goal.getId() + "/suggestions", auth, HttpStatus.OK, GoalSuggestionResponse.class);

        assertThat(suggestions).isEmpty();
    }

    @Test
    void testListGoalSuggestions_shouldReturnOne_whenProposed() {
        RegisteredUser owner = registerUser("Suggestion Lister");
        GoalResponse goal = postForBody("/api/goals", req().build(), owner.headers(), HttpStatus.CREATED, GoalResponse.class);
        suggestionPopulator.createOpen(owner.id(), goal.getId(), "phase_change", "preset:cut-prep:m1",
            new GoalSuggestionPayloadJson(
                "A cut-prep mezo deficitet javasol.", "cut", null, null, null, null, "Pre-cut prep", "cut"));

        List<GoalSuggestionResponse> suggestions = getForList(
            "/api/goals/" + goal.getId() + "/suggestions", owner.headers(), HttpStatus.OK, GoalSuggestionResponse.class);

        assertThat(suggestions).hasSize(1);
        assertThat(suggestions.get(0).getPayload().getReason()).isEqualTo("A cut-prep mezo deficitet javasol.");
    }

    @Test
    void testAcceptGoalSuggestion_shouldFlipTrajectory_whenSnapshotMatches() {
        RegisteredUser owner = registerUser("Suggestion Acceptor");
        GoalResponse goal = postForBody("/api/goals", req().trajectory("bulk").build(), owner.headers(),
            HttpStatus.CREATED, GoalResponse.class);
        UUID suggestionId = suggestionPopulator.createOpen(
            owner.id(), goal.getId(), "phase_change", "preset:cut-prep:m1",
            new GoalSuggestionPayloadJson(
                "A cut-prep mezo deficitet javasol.", "cut", null, null, null, null, "Pre-cut prep", "bulk")
        ).getId();

        GoalResponse accepted = postForBody(
            "/api/goals/" + goal.getId() + "/suggestions/" + suggestionId + "/accept",
            null, owner.headers(), HttpStatus.OK, GoalResponse.class);

        assertThat(accepted.getTrajectory()).isEqualTo(GoalResponse.TrajectoryEnum.CUT);
    }

    @Test
    void testAcceptGoalSuggestion_shouldPersistSupersede_whenSnapshotStale() {
        // Non-@Transactional HTTP-level test (mezo-ktg8 final-review finding 1): accept's stale-race
        // branch used to set the suggestion SUPERSEDED and then throw the 409 from inside the SAME
        // @Transactional method — the RuntimeException rolled the supersede back with it, so the row
        // stayed 'proposed' forever (dismiss was the only escape). The fix persists the supersede via
        // a REQUIRES_NEW helper BEFORE the 409 is thrown. Since ApiIntegrationTest is NOT
        // @Transactional, this test's own request boundaries are the real HTTP transaction — a
        // regression here would show up as the suggestion still being open after the 409.
        RegisteredUser owner = registerUser("Suggestion Stale Persist");
        GoalResponse goal = postForBody("/api/goals", req().trajectory("cut").build(), owner.headers(),
            HttpStatus.CREATED, GoalResponse.class);
        UUID suggestionId = suggestionPopulator.createOpen(
            owner.id(), goal.getId(), "phase_change", "preset:cut-prep:m1",
            new GoalSuggestionPayloadJson(
                "A cut-prep mezo deficitet javasol.", "cut", null, null, null, null, "Pre-cut prep", "bulk")
        ).getId();

        // snapshotTrajectory ("bulk") no longer matches the goal's current trajectory ("cut") → 409.
        postForBody("/api/goals/" + goal.getId() + "/suggestions/" + suggestionId + "/accept",
            null, owner.headers(), HttpStatus.CONFLICT, String.class);

        // The supersede must have survived the 409 request's own rollback: a follow-up list call
        // must NOT show the suggestion as open — if the supersede had rolled back too, it would
        // still read 'proposed' here.
        List<GoalSuggestionResponse> suggestions = getForList(
            "/api/goals/" + goal.getId() + "/suggestions", owner.headers(), HttpStatus.OK, GoalSuggestionResponse.class);
        assertThat(suggestions).isEmpty();
    }

    @Test
    void testDismissGoalSuggestion_shouldReturn204AndLeaveList_whenValid() {
        RegisteredUser owner = registerUser("Suggestion Dismisser");
        GoalResponse goal = postForBody("/api/goals", req().build(), owner.headers(), HttpStatus.CREATED, GoalResponse.class);
        UUID suggestionId = suggestionPopulator.createOpen(
            owner.id(), goal.getId(), "phase_change", "preset:cut-prep:m1",
            new GoalSuggestionPayloadJson(
                "A cut-prep mezo deficitet javasol.", "cut", null, null, null, null, "Pre-cut prep", "cut")
        ).getId();

        postForBody("/api/goals/" + goal.getId() + "/suggestions/" + suggestionId + "/dismiss",
            null, owner.headers(), HttpStatus.NO_CONTENT, Void.class);

        List<GoalSuggestionResponse> suggestions = getForList(
            "/api/goals/" + goal.getId() + "/suggestions", owner.headers(), HttpStatus.OK, GoalSuggestionResponse.class);
        assertThat(suggestions).isEmpty();
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
