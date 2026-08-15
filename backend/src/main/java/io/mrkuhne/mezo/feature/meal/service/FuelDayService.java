package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.FuelDayRollup;
import io.mrkuhne.mezo.api.dto.FuelWeekResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.meal.mapper.MealMapper;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Assembles {@link FuelDayResponse} for the Fuel-day MacroHero: {@code targets} are
 * goal-engine-driven with config fallback — kcal+protein come from the active goal's current
 * prescription segment (TDEE − deficit, weekly-stepped) when one exists, else from
 * {@link NutritionTargetsProperties}; carbs/fat/water always stay config (the engine prescribes
 * only kcal+protein). Also assembles the day's owner-scoped meals (logged_at-ordered) and
 * {@code consumed} = Σ the day's meal macros. {@code water} consumed is the real Σ of the
 * day's water-log entries (via {@link WaterLogService}); no meal carries water in v1.
 */
@Service
@RequiredArgsConstructor
public class FuelDayService {

    private static final String GOAL_STATUS_ACTIVE = "active";

    private final MealRepository mealRepository;
    private final MealMapper mapper;
    private final NutritionTargetsProperties targets;
    private final WaterLogService waterLogService;
    private final GoalRepository goalRepository;

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
            .targets(targetSet(userId, date))
            .consumed(consumed(meals, water))
            .meals(meals)
            .build();
    }

    /**
     * Seven-day rollup {@code start..start+6} — per-day goal/config targets + consumed Σ, no meal
     * bodies. Feeds the Terv weekly stats (kcal avg / protein-hit days) and is the designated
     * server aggregate for the Insights Weekly review (Phase-2 roadmap D′).
     */
    @Transactional(readOnly = true)
    public FuelWeekResponse getWeek(UUID userId, LocalDate start) {
        List<FuelDayRollup> days = start.datesUntil(start.plusDays(7))
            .map(d -> FuelDayRollup.builder()
                .date(d)
                .targets(targetSet(userId, d))
                .consumed(consumedFor(userId, d))
                .build())
            .toList();
        return FuelWeekResponse.builder().start(start).days(days).build();
    }

    private MacroSet consumedFor(UUID userId, LocalDate date) {
        List<MealResponse> meals = mealRepository
            .findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(userId, date).stream()
            .map(mapper::toResponse)
            .toList();
        return consumed(meals, waterLogService.sumForDay(userId, date));
    }

    /** kcal+protein from the active goal's current prescription segment (TDEE − deficit, the
     *  goal-engine truth); c/f/water stay config. No active goal / no segment ⇒ full config. */
    private MacroSet targetSet(UUID userId, LocalDate date) {
        GoalEntity goal = goalRepository
            .findByCreatedByAndStatusAndDeletedFalse(userId, GOAL_STATUS_ACTIVE)
            .stream().findFirst().orElse(null);
        Integer kcal = null;
        Integer protein = null;
        if (goal != null && goal.getStartDate() != null) {
            long week = ChronoUnit.DAYS.between(goal.getStartDate(), date) / 7 + 1;
            GoalPrescriptionJson.Segment seg =
                GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
            if (seg != null) {
                kcal = seg.kcal();
                protein = seg.proteinG();
            }
        }
        return MacroSet.builder()
            .kcal(BigDecimal.valueOf(kcal != null ? kcal : targets.kcal()))
            .p(BigDecimal.valueOf(protein != null ? protein : targets.p()))
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
