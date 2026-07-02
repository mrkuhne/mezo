package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.feature.meal.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.meal.mapper.MealMapper;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Assembles {@link FuelDayResponse} for the Fuel-day MacroHero: config-driven {@code targets}
 * (from {@link NutritionTargetsProperties}), the day's owner-scoped meals (logged_at-ordered),
 * and {@code consumed} = Σ the day's meal macros. {@code water} consumed is the real Σ of the
 * day's water-log entries (via {@link WaterLogService}); no meal carries water in v1.
 */
@Service
@RequiredArgsConstructor
public class FuelDayService {

    private final MealRepository mealRepository;
    private final MealMapper mapper;
    private final NutritionTargetsProperties targets;
    private final WaterLogService waterLogService;

    // Annotated by exception: the meal mapper walks LAZY items with open-in-view false (spring_patterns.md).
    @Transactional(readOnly = true)
    public FuelDayResponse getDay(UUID userId, LocalDate date) {
        List<MealResponse> meals = mealRepository
            .findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(userId, date).stream()
            .map(mapper::toResponse)
            .toList();
        int water = waterLogService.sumForDay(userId, date);
        return FuelDayResponse.builder()
            .date(date)
            .targets(targetSet())
            .consumed(consumed(meals, water))
            .meals(meals)
            .build();
    }

    private MacroSet targetSet() {
        return MacroSet.builder()
            .kcal(BigDecimal.valueOf(targets.kcal()))
            .p(BigDecimal.valueOf(targets.p()))
            .c(BigDecimal.valueOf(targets.c()))
            .f(BigDecimal.valueOf(targets.f()))
            .water(BigDecimal.valueOf(targets.water()))
            .build();
    }

    /** consumed = Σ meal macros; water = Σ the day's water-log entries. */
    private MacroSet consumed(List<MealResponse> meals, int water) {
        BigDecimal kcal = BigDecimal.ZERO, p = BigDecimal.ZERO, c = BigDecimal.ZERO, f = BigDecimal.ZERO;
        for (MealResponse m : meals) {
            kcal = kcal.add(m.getMacros().getKcal());
            p = p.add(m.getMacros().getP());
            c = c.add(m.getMacros().getC());
            f = f.add(m.getMacros().getF());
        }
        return MacroSet.builder()
            .kcal(kcal).p(p).c(c).f(f)
            .water(BigDecimal.valueOf(water))
            .build();
    }
}
