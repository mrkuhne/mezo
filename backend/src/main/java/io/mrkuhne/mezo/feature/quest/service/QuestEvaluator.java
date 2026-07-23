package io.mrkuhne.mezo.feature.quest.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.meal.repository.MealItemRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.meal.service.WaterLogService;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Derived quest completion (E1, bd mezo-df7q): pure reads over already-logged domain data —
 * the quest is data-verified by construction, never self-claimed (honest completion). Unknown
 * metrics evaluate to false (a stale catalog row can never complete by accident).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.QUEST_SWITCH, havingValue = "true")
public class QuestEvaluator {

    private final CheckInRepository checkInRepository;
    private final WeightLogRepository weightLogRepository;
    private final SleepLogRepository sleepLogRepository;
    private final WaterLogService waterLogService;
    private final FuelDayService fuelDayService;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final MealItemRepository mealItemRepository;
    private final io.mrkuhne.mezo.feature.intention.repository.IntentionFocusRepository intentionFocusRepository;

    public boolean satisfied(DailyQuestEntity q) {
        LocalDate d = q.getQuestDate();
        BigDecimal threshold = q.getTarget().threshold();
        return switch (q.getTarget().metric()) {
            // Plan-adherence (mezo-ws2x D5): MESO-only — a completed custom (saját) instance
            // never satisfies the planned "gym_session_done" quest.
            case "gym_session_done" -> !workoutSessionRepository
                .findMesoDoneInstanceDates(q.getCreatedBy(), d, d).isEmpty();
            case "checkin_full" -> checkInRepository
                .findByCreatedByAndDateOrderBySlotTime(q.getCreatedBy(), d).size()
                >= threshold.intValue();
            case "weight_logged" -> weightLogRepository
                .findFirstByCreatedByAndDeletedFalseAndDateOrderByCreatedAtDesc(q.getCreatedBy(), d)
                .isPresent();
            case "water_target" -> waterLogService.sumForDay(q.getCreatedBy(), d)
                >= threshold.intValue();
            case "sleep_target" -> sleepLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(q.getCreatedBy(), d)
                .stream()
                .anyMatch(s -> d.equals(s.getDate()) && s.getDurationH() != null
                    && s.getDurationH().compareTo(threshold) >= 0);
            case "protein_target" -> fuelDayService.getDay(q.getCreatedBy(), d)
                .getConsumed().getP().compareTo(threshold) >= 0;
            case "own_recipe_meal" -> mealItemRepository
                .existsByCreatedByAndDeletedFalseAndSourceAndMeal_MealDate(q.getCreatedBy(), "recipe", d);
            case "intention_focus_set" -> !intentionFocusRepository
                .findByCreatedByAndFocusDateAndDeletedFalseOrderByCreatedAtAsc(q.getCreatedBy(), d).isEmpty();
            default -> {
                log.warn("Unknown quest metric '{}' on quest {} — treated as not satisfied",
                    q.getTarget().metric(), q.getId());
                yield false;
            }
        };
    }
}
