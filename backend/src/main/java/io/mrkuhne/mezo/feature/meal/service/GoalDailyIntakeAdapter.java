package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.api.dto.FuelDayRollup;
import io.mrkuhne.mezo.api.dto.FuelWeekResponse;
import io.mrkuhne.mezo.feature.goal.engine.port.DailyIntakePort;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Meal-side implementation of {@link DailyIntakePort} off the FuelDayService week rollup. */
@Component
@RequiredArgsConstructor
public class GoalDailyIntakeAdapter implements DailyIntakePort {

    private final FuelDayService fuelDayService;

    @Override
    public List<DayIntake> between(UUID userId, LocalDate from, LocalDate to) {
        List<DayIntake> result = new ArrayList<>();
        LocalDate weekStart = from.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        while (!weekStart.isAfter(to)) {
            FuelWeekResponse week = fuelDayService.getWeek(userId, weekStart);
            for (FuelDayRollup day : week.getDays()) {
                LocalDate date = day.getDate();
                if (date.isBefore(from) || date.isAfter(to)) {
                    continue;
                }
                BigDecimal kcal = day.getConsumed().getKcal();
                if (kcal == null || kcal.signum() <= 0) {
                    continue; // unlogged day — absence is missing data, not a zero-kcal day
                }
                BigDecimal carbs = day.getConsumed().getC();
                result.add(new DayIntake(
                    date,
                    kcal.setScale(0, RoundingMode.HALF_UP).intValueExact(),
                    carbs == null ? 0 : carbs.setScale(0, RoundingMode.HALF_UP).intValueExact()));
            }
            weekStart = weekStart.plusWeeks(1);
        }
        return result;
    }
}
