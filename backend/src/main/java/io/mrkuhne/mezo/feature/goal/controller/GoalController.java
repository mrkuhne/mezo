package io.mrkuhne.mezo.feature.goal.controller;

import io.mrkuhne.mezo.api.controller.GoalApi;
import io.mrkuhne.mezo.api.dto.GoalPlanAttachRequest;
import io.mrkuhne.mezo.api.dto.GoalPlanLinkResponse;
import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.api.dto.GoalTimelineResponse;
import io.mrkuhne.mezo.api.dto.GoalUpsertRequest;
import io.mrkuhne.mezo.feature.goal.service.GoalPlanLinkService;
import io.mrkuhne.mezo.feature.goal.service.GoalService;
import io.mrkuhne.mezo.feature.goal.service.GoalTimelineService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated {@link GoalApi}; mappings/validation come from the interface. */
@RestController
@RequiredArgsConstructor
public class GoalController implements GoalApi {

    private final GoalService goalService;
    private final GoalPlanLinkService goalPlanLinkService;
    private final GoalTimelineService goalTimelineService;
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
        // TODO Task 10 (mezo-g1u): replace with real goal-evaluation-engine delegation
        throw new UnsupportedOperationException("G5 Task 10: mezo-g1u");
    }

    @Override
    public GoalPlanLinkResponse attachGoalPlan(UUID id, GoalPlanAttachRequest goalPlanAttachRequest) {
        return goalPlanLinkService.attachPlan(currentUserId.get(), id, goalPlanAttachRequest);
    }

    @Override
    public void detachGoalPlan(UUID id, UUID linkId) {
        goalPlanLinkService.detachPlan(currentUserId.get(), id, linkId);
    }
}
