package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GoalSuggestionPreviewResponse;
import io.mrkuhne.mezo.api.dto.GoalSuggestionAcceptRequest;
import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalSuggestionRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.GoalSuggestionPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** Contract and ownership coverage for the read-only suggestion review projection. */
class GoalSuggestionPreviewApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private GoalSuggestionPopulator suggestionPopulator;
    @Autowired private GoalSuggestionRepository suggestionRepository;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalEngineService goalEngineService;

    @Test
    void testPreviewGoalSuggestion_shouldReturn401_whenUnauthenticated() {
        getForBody("/api/goals/" + UUID.randomUUID() + "/suggestions/"
            + UUID.randomUUID() + "/preview", null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testPreviewGoalSuggestion_shouldReturn404_whenSuggestionBelongsToAnotherUser() {
        UUID owner = ownerId();
        GoalEntity goal = evaluatedCut(owner);
        GoalSuggestionEntity suggestion = suggestionPopulator.createOpen(
            owner, goal.getId(), "phase_change", "deload:foreign:w1", deloadPayload());

        String body = getForBody(previewUri(goal, suggestion),
            registerUser("Preview B-user").headers(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testPreviewGoalSuggestion_shouldCompareDeloadWithoutWriting_whenProposed() {
        UUID owner = ownerId();
        GoalEntity goal = evaluatedCut(owner);
        GoalSuggestionEntity suggestion = suggestionPopulator.createOpen(
            owner, goal.getId(), "phase_change", "deload:preview:w1", deloadPayload());

        GoalSuggestionPreviewResponse response = getForBody(
            previewUri(goal, suggestion), ownerAuthHeaders(), HttpStatus.OK,
            GoalSuggestionPreviewResponse.class);

        assertThat(response.getStatus().getValue()).isEqualTo("proposed");
        assertThat(response.getAffectedFromWeek()).isEqualTo(1);
        assertThat(response.getAffectedToWeek()).isEqualTo(1);
        assertThat(response.getCurrent().getTrajectory().getValue()).isEqualTo("cut");
        assertThat(response.getProposed().getTrajectory().getValue()).isEqualTo("cut");
        assertThat(response.getChangedFields()).contains("weekAverageKcal", "segment");
        assertThat(response.getUnchangedFields()).contains("trajectory", "targetWeightKg", "targetDate");
        assertThat(response.getCanApply()).isTrue();
        assertThat(response.getPreviewFingerprint()).hasSize(64).matches("[0-9a-f]{64}");

        assertThat(goalRepository.findById(goal.getId()).orElseThrow().getSegmentOverrides())
            .as("GET preview must not mutate the managed goal")
            .isNull();
        assertThat(suggestionRepository.findById(suggestion.getId()).orElseThrow().getStatus())
            .as("GET preview must not decide the suggestion")
            .isEqualTo("proposed");
    }

    @Test
    void testPreviewGoalSuggestion_shouldExposeWeeklyCorrectionProjection_whenProposed() {
        UUID owner = ownerId();
        GoalEntity goal = evaluatedCut(owner);
        GoalSuggestionEntity suggestion = suggestionPopulator.createOpen(
            owner, goal.getId(), "weekly_correction", "weekly:2026-08-24",
            weeklyPayload(goal));

        GoalSuggestionPreviewResponse response = getForBody(
            previewUri(goal, suggestion), ownerAuthHeaders(), HttpStatus.OK,
            GoalSuggestionPreviewResponse.class);

        assertThat(response.getReasonCode()).isEqualTo("weekly_correction");
        assertThat(response.getProposed().getWeekAverageKcal())
            .isEqualTo(response.getCurrent().getWeekAverageKcal() - 120);
        assertThat(response.getChangedFields()).contains("weekAverageKcal");
        assertThat(response.getCanApply()).isTrue();
    }

    @Test
    void testPreviewGoalSuggestion_shouldBlockDirectionConflict_whenCutWouldBecomeBulk() {
        UUID owner = ownerId();
        GoalEntity goal = evaluatedCut(owner);
        GoalSuggestionEntity suggestion = suggestionPopulator.createOpen(
            owner, goal.getId(), "phase_change", "preset:bulk:conflict",
            phasePayload("bulk", "cut"));

        GoalSuggestionPreviewResponse response = getForBody(
            previewUri(goal, suggestion), ownerAuthHeaders(), HttpStatus.OK,
            GoalSuggestionPreviewResponse.class);

        assertThat(response.getCurrent().getTargetWeightKg()).isEqualByComparingTo("80.00");
        assertThat(response.getProposed().getTrajectory().getValue()).isEqualTo("bulk");
        assertThat(response.getBlockers()).containsExactly("GOAL_DIRECTION_TARGET_CONFLICT");
        assertThat(response.getCanApply()).isFalse();
        assertThat(response.getPreviewFingerprint()).isNull();
    }

    @Test
    void testPreviewGoalSuggestion_shouldReturnHistoricalDiffWithoutApply_whenAlreadyAccepted() {
        UUID owner = ownerId();
        GoalEntity goal = evaluatedCut(owner);
        GoalSuggestionEntity suggestion = suggestionPopulator.createOpen(
            owner, goal.getId(), "phase_change", "deload:history:w1", deloadPayload());
        suggestion.setStatus("accepted");
        suggestion.setDecidedAt(Instant.parse("2026-09-04T12:00:00Z"));
        suggestionRepository.saveAndFlush(suggestion);

        GoalSuggestionPreviewResponse response = getForBody(
            previewUri(goal, suggestion), ownerAuthHeaders(), HttpStatus.OK,
            GoalSuggestionPreviewResponse.class);

        assertThat(response.getStatus().getValue()).isEqualTo("accepted");
        assertThat(response.getCurrent()).isNotNull();
        assertThat(response.getProposed()).isNotNull();
        assertThat(response.getCanApply()).isFalse();
        assertThat(response.getPreviewFingerprint()).isNull();
    }

    @Test
    void testPreviewGoalSuggestion_shouldKeepTheReviewedBeforeAfterDiff_whenAcceptedThroughApi() {
        UUID owner = ownerId();
        GoalEntity goal = evaluatedCut(owner);
        GoalSuggestionEntity suggestion = suggestionPopulator.createOpen(
            owner, goal.getId(), "weekly_correction", "weekly:accepted-history",
            weeklyPayload(goal));
        GoalSuggestionPreviewResponse before = getForBody(
            previewUri(goal, suggestion), ownerAuthHeaders(), HttpStatus.OK,
            GoalSuggestionPreviewResponse.class);

        postForBody("/api/goals/" + goal.getId() + "/suggestions/" + suggestion.getId() + "/accept",
            GoalSuggestionAcceptRequest.builder()
                .previewFingerprint(before.getPreviewFingerprint()).build(),
            ownerAuthHeaders(), HttpStatus.OK, GoalResponse.class);
        GoalSuggestionPreviewResponse history = getForBody(
            previewUri(goal, suggestion), ownerAuthHeaders(), HttpStatus.OK,
            GoalSuggestionPreviewResponse.class);

        assertThat(history.getStatus().getValue()).isEqualTo("accepted");
        assertThat(history.getCurrent().getWeekAverageKcal())
            .isEqualTo(before.getCurrent().getWeekAverageKcal());
        assertThat(history.getProposed().getWeekAverageKcal())
            .isEqualTo(before.getProposed().getWeekAverageKcal());
    }

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private GoalEntity evaluatedCut(UUID owner) {
        profilePopulator.create(owner);
        GoalEntity goal = goalPopulator.createGoal(owner, "cut", "active");
        goalEngineService.evaluate(owner, goal.getId());
        return goalRepository.findById(goal.getId()).orElseThrow();
    }

    private static String previewUri(GoalEntity goal, GoalSuggestionEntity suggestion) {
        return "/api/goals/" + goal.getId() + "/suggestions/" + suggestion.getId() + "/preview";
    }

    private static GoalSuggestionPayloadJson deloadPayload() {
        return new GoalSuggestionPayloadJson(
            "Deload hét — tartás.", null, 0, 1, 1, null, "Deload", "cut",
            null, null, null, null, null, null, null, null, null, null, null);
    }

    private static GoalSuggestionPayloadJson phasePayload(String suggested, String snapshot) {
        return new GoalSuggestionPayloadJson(
            "A mezo más célirányt javasol.", suggested, null, null, null, null, "Meso", snapshot,
            null, null, null, null, null, null, null, null, null, null, null);
    }

    private static GoalSuggestionPayloadJson weeklyPayload(GoalEntity goal) {
        return new GoalSuggestionPayloadJson(
            "Heti korrekció.", null, null, null, null, null, null, goal.getTrajectory(),
            "2026-08-24", -120, new BigDecimal("-0.20"), new BigDecimal("-0.50"), false,
            5, 2780, 2900, OffsetDateTime.now(), goal.getRateTargetPctPerWeek(),
            goal.getBalanceAdjustmentKcal());
    }
}
