package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.api.dto.LifeGoalProposeRequest;
import io.mrkuhne.mezo.api.dto.LifeGoalProposeResponse;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * POST /api/life-goals/propose (spec D9) — placeholder for Task 5's rule-template / AI proposer.
 *
 * <p>Task-3 override: the brief has this throw a raw {@code UnsupportedOperationException}, which
 * would fail the ArchUnit "no raw RuntimeException" rule in the full suite. It throws the standard
 * {@code SystemRuntimeErrorException} instead, mapped to 503 so callers can distinguish "not built
 * yet" from a validation error; Task 5 replaces the body with the real proposer.
 */
@Service
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalProposeService {
    public LifeGoalProposeResponse propose(UUID userId, LifeGoalProposeRequest req) {
        throw new SystemRuntimeErrorException(
            SystemMessage.error("LIFE_GOAL_AI_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
    }
}
