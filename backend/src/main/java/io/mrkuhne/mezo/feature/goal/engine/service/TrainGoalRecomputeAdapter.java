package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.train.service.GoalRecomputePort;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Goal-side adapter for train's {@link GoalRecomputePort} (ADR 0012 — see the port's javadoc). */
@Component
@RequiredArgsConstructor
public class TrainGoalRecomputeAdapter implements GoalRecomputePort {

    private final GoalEngineService goalEngineService;

    @Override
    public void recomputeActiveGoal(UUID userId) {
        goalEngineService.recomputeActiveGoal(userId);
    }
}
