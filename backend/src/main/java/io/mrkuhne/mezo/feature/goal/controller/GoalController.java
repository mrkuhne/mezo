package io.mrkuhne.mezo.feature.goal.controller;

import io.mrkuhne.mezo.api.controller.GoalApi;
import io.mrkuhne.mezo.api.dto.ExpenditureExplanationResponse;
import io.mrkuhne.mezo.api.dto.ExpenditureHistoryResponse;
import io.mrkuhne.mezo.api.dto.ExpenditureWeeklyCardResponse;
import io.mrkuhne.mezo.api.dto.FeasibilityPreviewRequest;
import io.mrkuhne.mezo.api.dto.FeasibilityPreviewResponse;
import io.mrkuhne.mezo.api.dto.GoalPlanAttachRequest;
import io.mrkuhne.mezo.api.dto.GoalOverviewResponse;
import io.mrkuhne.mezo.api.dto.GoalPlanLinkResponse;
import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.api.dto.GoalSuggestionAcceptRequest;
import io.mrkuhne.mezo.api.dto.GoalSuggestionPreviewResponse;
import io.mrkuhne.mezo.api.dto.GoalSuggestionResponse;
import io.mrkuhne.mezo.api.dto.GoalTimelineResponse;
import io.mrkuhne.mezo.api.dto.GoalUpsertRequest;
import io.mrkuhne.mezo.api.dto.IntakeDayMarkRequest;
import io.mrkuhne.mezo.api.dto.IntakeDayMarkResult;
import io.mrkuhne.mezo.api.dto.IntakeDayStatus;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalFeasibilityService;
import io.mrkuhne.mezo.feature.goal.mapper.ExpenditureInsightMapper;
import io.mrkuhne.mezo.feature.goal.service.ExpenditureExplanationService;
import io.mrkuhne.mezo.feature.goal.service.ExpenditureInsightService;
import io.mrkuhne.mezo.feature.goal.service.GoalPlanLinkService;
import io.mrkuhne.mezo.feature.goal.service.GoalOverviewService;
import io.mrkuhne.mezo.feature.goal.service.GoalService;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionService;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionPreviewService;
import io.mrkuhne.mezo.feature.goal.service.GoalTimelineService;
import io.mrkuhne.mezo.feature.goal.service.IntakeDayMarkService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Implements the generated {@link GoalApi}; mappings/validation come from the interface. */
@RestController
@RequiredArgsConstructor
public class GoalController implements GoalApi {

    private final GoalService goalService;
    private final GoalOverviewService goalOverviewService;
    private final GoalPlanLinkService goalPlanLinkService;
    private final GoalTimelineService goalTimelineService;
    private final GoalEngineService goalEngineService;
    private final GoalFeasibilityService goalFeasibilityService;
    private final GoalSuggestionService goalSuggestionService;
    private final GoalSuggestionPreviewService goalSuggestionPreviewService;
    private final ExpenditureExplanationService expenditureExplanationService;
    private final ExpenditureInsightService expenditureInsightService;
    private final IntakeDayMarkService intakeDayMarkService;
    private final ExpenditureInsightMapper expenditureInsightMapper;
    private final CurrentUserId currentUserId;

    @Override
    public List<GoalResponse> listGoals() {
        return goalService.listGoals(currentUserId.get());
    }

    @Override
    public GoalResponse getGoal(UUID id) {
        return goalService.getGoal(currentUserId.get(), id);
    }

    @Override
    public GoalOverviewResponse getGoalOverview(UUID id) {
        return goalOverviewService.getOverview(currentUserId.get(), id);
    }

    @Override
    public GoalResponse createGoal(GoalUpsertRequest goalUpsertRequest) {
        return goalService.createGoal(currentUserId.get(), goalUpsertRequest);
    }

    @Override
    public GoalResponse updateGoal(UUID id, GoalUpsertRequest goalUpsertRequest) {
        return goalService.updateGoal(currentUserId.get(), id, goalUpsertRequest);
    }

    @Override
    public void deleteGoal(UUID id) {
        goalService.deleteGoal(currentUserId.get(), id);
    }

    @Override
    public GoalResponse activateGoal(UUID id) {
        return goalService.activateGoal(currentUserId.get(), id);
    }

    @Override
    public GoalResponse archiveGoal(UUID id) {
        return goalService.archiveGoal(currentUserId.get(), id);
    }

    @Override
    public GoalTimelineResponse listGoalTimeline(UUID id) {
        return goalTimelineService.getTimeline(currentUserId.get(), id);
    }

    @Override
    public GoalResponse evaluateGoal(UUID id) {
        UUID userId = currentUserId.get();
        // The engine assembles + persists the prescription (+ tdeeBootstrap) onto the goal; re-fetch via
        // the standard get path so the response carries the freshly-persisted jsonb (mapped by GoalMapper).
        goalEngineService.evaluate(userId, id);
        return goalService.getGoal(userId, id);
    }

    @Override
    public FeasibilityPreviewResponse feasibilityPreview(FeasibilityPreviewRequest feasibilityPreviewRequest) {
        // Stateless realism preview for the 2-step wizard (G6 §3.2): derive + grade a DRAFT window before
        // any goal is saved. Resolve the principal per controller convention, but the compute ignores it —
        // there is no goal, no persistence, no ownership.
        currentUserId.get();
        return goalFeasibilityService.preview(feasibilityPreviewRequest);
    }

    @Override
    public GoalPlanLinkResponse attachGoalPlan(UUID id, GoalPlanAttachRequest goalPlanAttachRequest) {
        return goalPlanLinkService.attachPlan(currentUserId.get(), id, goalPlanAttachRequest);
    }

    @Override
    public void detachGoalPlan(UUID id, UUID linkId) {
        goalPlanLinkService.detachPlan(currentUserId.get(), id, linkId);
    }

    @Override
    public List<GoalSuggestionResponse> listGoalSuggestions(UUID id) {
        return goalSuggestionService.listOpen(currentUserId.get(), id);
    }

    @Override
    public GoalResponse acceptGoalSuggestion(
            UUID id, UUID suggestionId, GoalSuggestionAcceptRequest goalSuggestionAcceptRequest) {
        return goalSuggestionService.accept(
            currentUserId.get(), id, suggestionId, goalSuggestionAcceptRequest);
    }

    @Override
    public GoalSuggestionPreviewResponse previewGoalSuggestion(UUID id, UUID suggestionId) {
        return goalSuggestionPreviewService.preview(currentUserId.get(), id, suggestionId);
    }

    @Override
    public void dismissGoalSuggestion(UUID id, UUID suggestionId) {
        goalSuggestionService.dismiss(currentUserId.get(), id, suggestionId);
    }

    /**
     * The generated {@code GoalApi} fixes this to a single {@code @ResponseStatus(200)}
     * (spring-generator {@code useResponseEntity=false}, house-wide), but the contract also
     * declares a bodyless {@code 204} for "nothing was ever reviewed with the explainer" — see
     * {@code api/feature/goal/goal.yml}. A {@link ResponseStatusException} is the standard Spring
     * escape hatch for that one path (mirrors {@code CharacterController.bootstrapCharacter}).
     */
    @Override
    public ExpenditureExplanationResponse getExpenditureExplanation() {
        return expenditureExplanationService.getLatestExplanation(currentUserId.get())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NO_CONTENT));
    }

    @Override
    public ExpenditureHistoryResponse getExpenditureHistory(Integer limit) {
        return expenditureInsightMapper.toHistoryResponse(
            expenditureInsightService.history(currentUserId.get(), limit));
    }

    /** Same 204 escape hatch as {@link #getExpenditureExplanation()} — nothing worth showing this week. */
    @Override
    public ExpenditureWeeklyCardResponse getExpenditureWeeklyCard() {
        return expenditureInsightService.weeklyCard(currentUserId.get())
            .map(expenditureInsightMapper::toWeeklyCardResponse)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NO_CONTENT));
    }

    @Override
    public void dismissExpenditureWeeklyCard(LocalDate weekStart) {
        expenditureInsightService.dismiss(currentUserId.get(), weekStart);
    }

    @Override
    public List<IntakeDayStatus> getIntakeDays(LocalDate from, LocalDate to) {
        return expenditureInsightMapper.toDayStatuses(
            expenditureInsightService.days(currentUserId.get(), from, to));
    }

    @Override
    public IntakeDayMarkResult setIntakeDayMark(LocalDate date, IntakeDayMarkRequest intakeDayMarkRequest) {
        UUID userId = currentUserId.get();
        IntakeDayMarkService.MarkResult result = intakeDayMarkService.mark(
            userId, date, intakeDayMarkRequest.getStatus().getValue().toUpperCase(Locale.ROOT));
        return toMarkResult(userId, date, result);
    }

    @Override
    public IntakeDayMarkResult clearIntakeDayMark(LocalDate date) {
        UUID userId = currentUserId.get();
        IntakeDayMarkService.MarkResult result = intakeDayMarkService.clear(userId, date);
        return toMarkResult(userId, date, result);
    }

    /** The day's freshly re-chained live status — always re-read after the mark/clear (never stale). */
    private IntakeDayMarkResult toMarkResult(UUID userId, LocalDate date, IntakeDayMarkService.MarkResult result) {
        IntakeDayStatus day = expenditureInsightMapper.toDayStatuses(
            expenditureInsightService.days(userId, date, date)).get(0);
        return expenditureInsightMapper.toMarkResult(result, day);
    }
}
