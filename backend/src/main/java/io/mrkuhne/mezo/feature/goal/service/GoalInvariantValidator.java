package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Component;

/** Single cross-field invariant for every weight-goal write and evaluation path. */
@Component
public class GoalInvariantValidator {

    private static final long MINIMUM_WINDOW_DAYS = 7;

    /** Rejects a too-short window or a target that contradicts the selected trajectory. */
    public void validate(
            String trajectory, BigDecimal startWeightKg, BigDecimal targetWeightKg,
            LocalDate startDate, LocalDate targetDate) {
        if (!hasValidWindow(startDate, targetDate)) {
            throw field("GOAL_WINDOW_TOO_SHORT", "targetDate");
        }
        if (!hasCoherentDirection(trajectory, startWeightKg, targetWeightKg)) {
            throw field("GOAL_DIRECTION_TARGET_CONFLICT", "targetWeightKg");
        }
    }

    /** Side-effect-free guard for rows created before the write invariant existed. */
    public boolean isCoherent(GoalEntity goal) {
        return goal != null
            && hasValidWindow(goal.getStartDate(), goal.getTargetDate())
            && hasCoherentDirection(
                goal.getTrajectory(), goal.getStartWeightKg(), goal.getTargetWeightKg());
    }

    private boolean hasValidWindow(LocalDate startDate, LocalDate targetDate) {
        return startDate != null
            && targetDate != null
            && ChronoUnit.DAYS.between(startDate, targetDate) >= MINIMUM_WINDOW_DAYS;
    }

    private boolean hasCoherentDirection(
            String trajectory, BigDecimal startWeightKg, BigDecimal targetWeightKg) {
        if (trajectory == null || startWeightKg == null) {
            return false;
        }
        return switch (trajectory) {
            case "cut" -> targetWeightKg != null && targetWeightKg.compareTo(startWeightKg) < 0;
            case "bulk" -> targetWeightKg != null && targetWeightKg.compareTo(startWeightKg) > 0;
            case "maintain" -> targetWeightKg == null;
            default -> false;
        };
    }

    private SystemRuntimeErrorException field(String code, String fieldName) {
        return new SystemRuntimeErrorException(SystemMessage.field(code, fieldName).build());
    }
}
