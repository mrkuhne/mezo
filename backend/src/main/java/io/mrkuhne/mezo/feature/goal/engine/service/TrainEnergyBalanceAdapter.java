package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.train.service.EnergyBalancePort;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Goal-side adapter for train's {@link EnergyBalancePort} (ADR 0012 — see the port's javadoc). A
 * deficit is an ACTIVE goal whose trajectory is {@code cut}: the goal's own direction word, which
 * {@code GoalInvariantValidator} ties to a target weight below the start weight.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TrainEnergyBalanceAdapter implements EnergyBalancePort {

    private final GoalRepository goalRepository;

    @Override
    public boolean isInDeficit(UUID userId, LocalDate date) {
        try {
            return goalRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(userId, "active")
                .stream().findFirst()
                .map(GoalEntity::getTrajectory)
                .map("cut"::equals)
                .orElse(false);
        } catch (RuntimeException e) {
            log.warn("energy-balance read failed, treating as no deficit", e);
            return false;
        }
    }
}
