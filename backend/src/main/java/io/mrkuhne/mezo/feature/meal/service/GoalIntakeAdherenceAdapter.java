package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.api.dto.FuelDayRollup;
import io.mrkuhne.mezo.api.dto.FuelWeekResponse;
import io.mrkuhne.mezo.feature.goal.engine.port.IntakeAdherencePort;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Meal-side implementation of {@link IntakeAdherencePort} off the FuelDayService week rollup. */
@Component
@RequiredArgsConstructor
public class GoalIntakeAdherenceAdapter implements IntakeAdherencePort {

    private final FuelDayService fuelDayService;

    @Override
    public IntakeAdherence weekAdherence(UUID userId, LocalDate weekStart) {
        FuelWeekResponse week = fuelDayService.getWeek(userId, weekStart);
        int loggedDays = 0;
        BigDecimal intakeSum = BigDecimal.ZERO;
        BigDecimal targetSum = BigDecimal.ZERO;
        for (FuelDayRollup day : week.getDays()) {
            BigDecimal kcal = day.getConsumed().getKcal();
            if (kcal == null || kcal.signum() <= 0) {
                continue; // unlogged day — absence is missing data, not a zero-kcal day
            }
            loggedDays++;
            intakeSum = intakeSum.add(kcal);
            targetSum = targetSum.add(day.getTargets().getKcal());
        }
        if (loggedDays == 0) {
            return new IntakeAdherence(0, 0, 0);
        }
        return new IntakeAdherence(
            loggedDays,
            intakeSum.divide(BigDecimal.valueOf(loggedDays), 0, RoundingMode.HALF_UP).intValueExact(),
            targetSum.divide(BigDecimal.valueOf(loggedDays), 0, RoundingMode.HALF_UP).intValueExact());
    }
}
