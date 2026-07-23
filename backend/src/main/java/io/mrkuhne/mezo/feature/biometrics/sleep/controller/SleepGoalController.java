package io.mrkuhne.mezo.feature.biometrics.sleep.controller;

import io.mrkuhne.mezo.api.controller.SleepGoalApi;
import io.mrkuhne.mezo.api.dto.SetSleepGoalRequest;
import io.mrkuhne.mezo.api.dto.SleepGoalResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepGoalService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/sleep/goal surface (mezo-dbsr) — mappings/validation come from the generated {@link SleepGoalApi}. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.SLEEP_GOAL_SWITCH, havingValue = "true")
public class SleepGoalController implements SleepGoalApi {

    private final SleepGoalService service;
    private final CurrentUserId currentUserId;

    @Override
    public SleepGoalResponse getSleepGoal() {
        return service.getGoal(currentUserId.get());
    }

    @Override
    public SleepGoalResponse setSleepGoal(SetSleepGoalRequest setSleepGoalRequest) {
        return service.setGoal(currentUserId.get(), setSleepGoalRequest);
    }
}
