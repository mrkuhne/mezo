package io.mrkuhne.mezo.feature.goal.controller;

import io.mrkuhne.mezo.api.controller.GoalApi;
import io.mrkuhne.mezo.api.dto.GoalPlanAttachRequest;
import io.mrkuhne.mezo.api.dto.GoalPlanLinkResponse;
import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.api.dto.GoalTimelineResponse;
import io.mrkuhne.mezo.api.dto.GoalUpsertRequest;
import io.mrkuhne.mezo.feature.goal.service.GoalService;
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
        // G3 Task 6 (mezo-3sc): replace with real timeline-service delegation
        throw new UnsupportedOperationException("G3 Task 6: mezo-3sc");
    }

    @Override
    public GoalPlanLinkResponse attachGoalPlan(UUID id, GoalPlanAttachRequest goalPlanAttachRequest) {
        // G3 Task 6 (mezo-3sc): replace with real plan-link-service delegation
        throw new UnsupportedOperationException("G3 Task 6: mezo-3sc");
    }

    @Override
    public void detachGoalPlan(UUID id, UUID linkId) {
        // G3 Task 6 (mezo-3sc): replace with real plan-link-service delegation
        throw new UnsupportedOperationException("G3 Task 6: mezo-3sc");
    }
}
