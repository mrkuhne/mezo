package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse.DataSufficiencyEnum;
import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Pure, config-driven classification behind the Goal hub's primary course message. */
@Service
@RequiredArgsConstructor
public class GoalOverviewCourseService {

    private static final int RATE_SCALE = 3;

    private final GoalInvariantValidator invariantValidator;
    private final GoalEngineProperties properties;

    public Course classify(GoalEntity goal, WeightTrendResponse trend) {
        if (!invariantValidator.isCoherent(goal)) {
            return new Course("invalid", "goal_invalid", null, null, null);
        }
        if (trend == null || trend.getDataSufficiency() == DataSufficiencyEnum.NONE) {
            return new Course("learning", "trend_missing", null, null, null);
        }

        BigDecimal observed = trend.getLast4wRateKgPerWeek();
        BigDecimal target = signedTargetRate(goal, trend.getLatestTrendKg());
        BigDecimal tolerance = target.abs()
            .multiply(properties.overview().rateTolerancePercent())
            .movePointLeft(2)
            .max(properties.overview().rateToleranceFloorKgPerWeek());
        boolean directionMatches = sameDirection(goal.getTrajectory(), observed);
        boolean withinBand = observed.subtract(target).abs().compareTo(tolerance) <= 0;
        LocalDate projection = projectedDate(goal, trend.getLatestTrendKg(), observed, directionMatches);

        if (directionMatches && withinBand) {
            return new Course("on_track", "rate_on_track", observed, target, projection);
        }
        return new Course(
            "watch", directionMatches ? "rate_off_track" : "rate_wrong_direction",
            observed, target, projection);
    }

    private BigDecimal signedTargetRate(GoalEntity goal, BigDecimal currentWeightKg) {
        if ("maintain".equals(goal.getTrajectory())) {
            return BigDecimal.ZERO.setScale(RATE_SCALE);
        }
        BigDecimal base = currentWeightKg == null || currentWeightKg.signum() <= 0
            ? goal.getStartWeightKg() : currentWeightKg;
        BigDecimal magnitude = base.multiply(goal.getRateTargetPctPerWeek())
            .movePointLeft(2).setScale(RATE_SCALE, RoundingMode.HALF_UP);
        return "cut".equals(goal.getTrajectory()) ? magnitude.negate() : magnitude;
    }

    private boolean sameDirection(String trajectory, BigDecimal observed) {
        if (observed == null) {
            return false;
        }
        return switch (trajectory) {
            case "cut" -> observed.signum() < 0;
            case "bulk" -> observed.signum() > 0;
            case "maintain" -> true;
            default -> false;
        };
    }

    private LocalDate projectedDate(
            GoalEntity goal, BigDecimal currentWeightKg, BigDecimal observed, boolean directionMatches) {
        if (!directionMatches || "maintain".equals(goal.getTrajectory())
                || currentWeightKg == null || observed == null || observed.signum() == 0) {
            return null;
        }
        BigDecimal remaining = currentWeightKg.subtract(goal.getTargetWeightKg()).abs();
        long weeks = remaining.divide(observed.abs(), 0, RoundingMode.CEILING).longValue();
        return LocalDate.now().plusWeeks(weeks);
    }

    /** Internal read-model fragment; the assembler maps it onto generated wire enums. */
    public record Course(
        String status,
        String reasonCode,
        BigDecimal signedObservedRate,
        BigDecimal signedTargetRate,
        LocalDate projectedTargetDate
    ) {
    }
}
