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
import io.mrkuhne.mezo.feature.nutrition.service.DietPreferencesResolver;
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
 * Assembles {@link FuelDayResponse} for the Fuel-day MacroHero: {@code targets} come from the
 * active goal's prescribed recept when one covers the date — kcal + protein + carbs + fat from the
 * {@link GoalPrescriptionJson} segment of that date's goal-week (mezo-najo; the recept IS the
 * TDEE + training + deficit prescription; carbs/fat since mezo-xwgb) — falling back to the
 * config-driven {@link NutritionTargetsProperties} per field when there is no active/evaluated
 * goal, no covering segment, or the segment predates the carbs/fat split. Water is never
 * prescribed by the goal; it always comes from {@link DietPreferencesResolver} (the saved
 * preference row, or its config ghost when none exists). {@code consumed}
 * = Σ the day's meal macros; {@code water} consumed is the real Σ of the day's water-log entries
 * (via {@link WaterLogService}); no meal carries water in v1.
 */
@Service
@RequiredArgsConstructor
public class FuelDayService {

    private final MealRepository mealRepository;
    private final MealMapper mapper;
    private final NutritionTargetsProperties targets;
    private final WaterLogService waterLogService;
    private final GoalRepository goalRepository;
    private final DietPreferencesResolver dietPreferences;

    // Annotated by exception: the meal mapper walks LAZY items with open-in-view false (spring_patterns.md).
    @Transactional(readOnly = true)
    public FuelDayResponse getDay(UUID userId, LocalDate date) {
        List<MealResponse> meals = mealRepository
            .findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(userId, date).stream()
            .map(mapper::toResponse)
            .toList();
        int water = waterLogService.sumForDay(userId, date);
        int waterMl = dietPreferences.resolve(userId).waterMl();
        return FuelDayResponse.builder()
            .date(date)
            .targets(targetSet(activeGoal(userId), date, waterMl))
            .consumed(consumed(meals, water))
            .meals(meals)
            .build();
    }

    /**
     * Seven-day rollup {@code start..start+6} — per-day targets (the goal recept is week-segmented,
     * so a segment boundary can fall inside the rendered week) + consumed Σ, no meal bodies. Feeds
     * the Terv weekly stats (kcal avg / protein-hit days) and is the designated server aggregate
     * for the Insights Weekly review (Phase-2 roadmap D′).
     */
    @Transactional(readOnly = true)
    public FuelWeekResponse getWeek(UUID userId, LocalDate start) {
        GoalEntity goal = activeGoal(userId);
        // Resolve preferences ONCE for the whole week, not per day (7 identical queries otherwise).
        int waterMl = dietPreferences.resolve(userId).waterMl();
        List<FuelDayRollup> days = start.datesUntil(start.plusDays(7))
            .map(d -> FuelDayRollup.builder()
                .date(d)
                .targets(targetSet(goal, d, waterMl))
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

    private GoalEntity activeGoal(UUID userId) {
        return goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")
            .stream().findFirst().orElse(null);
    }

    /**
     * kcal + protein + carbs + fat from the active goal's recept segment covering {@code date}'s
     * goal-week (week derived from startDate — the ContextSnapshotAssembler#goalBlock idiom);
     * config fallback per field when there is no goal, no evaluated prescription, no covering
     * segment (e.g. a date before the goal started), or the segment predates the carbs/fat split
     * (pre-slice-1 prescriptions carry null carbsG/fatG). {@code waterMl} is caller-resolved (once
     * per request, via {@link DietPreferencesResolver}) since water is never goal-prescribed.
     */
    private MacroSet targetSet(GoalEntity goal, LocalDate date, int waterMl) {
        GoalPrescriptionJson.Segment seg = null;
        if (goal != null && goal.getStartDate() != null) {
            long week = ChronoUnit.DAYS.between(goal.getStartDate(), date) / 7 + 1;
            seg = GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
        }
        return MacroSet.builder()
            .kcal(BigDecimal.valueOf(seg != null && seg.kcal() != null ? seg.kcal() : targets.kcal()))
            .p(BigDecimal.valueOf(seg != null && seg.proteinG() != null ? seg.proteinG() : targets.p()))
            .c(BigDecimal.valueOf(seg != null && seg.carbsG() != null ? seg.carbsG() : targets.c()))
            .f(BigDecimal.valueOf(seg != null && seg.fatG() != null ? seg.fatG() : targets.f()))
            .water(BigDecimal.valueOf(waterMl))
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
