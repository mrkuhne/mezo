package io.mrkuhne.mezo.feature.activity.controller;

import io.mrkuhne.mezo.api.controller.ActivityApi;
import io.mrkuhne.mezo.api.dto.ActivityCategoryRequest;
import io.mrkuhne.mezo.api.dto.ActivityCreateRequest;
import io.mrkuhne.mezo.api.dto.ActivityResponse;
import io.mrkuhne.mezo.api.dto.ActivityWriteResponse;
import io.mrkuhne.mezo.feature.activity.service.ActivityService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/activity surface (E2, bd mezo-jzca) — thin delegation, ownership from the principal. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ACTIVITY_SWITCH, havingValue = "true")
public class ActivityController implements ActivityApi {

    private final ActivityService activityService;
    private final CurrentUserId currentUserId;

    @Override
    public ActivityWriteResponse createActivity(ActivityCreateRequest request) {
        return activityService.create(currentUserId.get(), request.getText(), request.getOccurredOn());
    }

    @Override
    public List<ActivityResponse> getActivityDay(LocalDate date) {
        return activityService.getDay(currentUserId.get(), date);
    }

    @Override
    public ActivityWriteResponse categorizeActivity(UUID id, ActivityCategoryRequest request) {
        return activityService.categorize(currentUserId.get(), id, request.getSkillKey());
    }

    @Override
    public List<ActivityResponse> getActivityHistory(LocalDate from, LocalDate to) {
        return activityService.history(currentUserId.get(), from, to);
    }
}
