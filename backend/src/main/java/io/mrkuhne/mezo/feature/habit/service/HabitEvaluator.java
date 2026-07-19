package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.fuel.repository.SupplementIntakeRepository;
import io.mrkuhne.mezo.feature.habit.config.HabitProperties;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Pure reads over already-logged data (the QuestEvaluator twin) — habits are never self-claimed
 * where a real signal exists. Unknown metric -> false (a stale catalog row can't complete).
 * Timestamp-less sources degrade to honest date-presence (spec §3 note): gym sessions have no
 * completed_at, so training_done_today counts a completed instance on the date.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.HABIT_SWITCH, havingValue = "true")
public class HabitEvaluator {

    private final SleepLogRepository sleepLogRepository;
    private final WeightLogRepository weightLogRepository;
    private final SupplementIntakeRepository supplementIntakeRepository;
    private final PantryItemRepository pantryItemRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final RunSessionLogRepository runSessionLogRepository;
    private final MealRepository mealRepository;
    private final FuelDayService fuelDayService;
    private final HabitTargets habitTargets;
    private final HabitProperties properties;

    /** Metrics decidable during the day (re-checked on every read). */
    public static final Set<String> INTRADAY_METRICS = Set.of("sleep_wake_window", "manual",
        "weight_logged_before", "stim_intake_before", "training_done_today", "breakfast_protein");
    /** Metrics decidable only once the day is over (nightly close / next read). */
    public static final Set<String> END_OF_DAY_METRICS = Set.of("no_stim_after", "last_meal_before");
    /** Decided by the NEXT day's sleep log (deadline: next day noon). */
    public static final String METRIC_BED_NEXT_DAY = "bedtime_next_day";

    public boolean satisfied(String metric, UUID userId, LocalDate date) {
        return switch (metric) {
            case "sleep_wake_window" -> sleepLog(userId, date)
                .map(SleepLogEntity::getWakeup).filter(Objects::nonNull)
                .map(w -> withinWindow(LocalTime.parse(w),
                    habitTargets.resolve(userId).wake(), properties.wakeWindowMin()))
                .orElse(false);
            case "weight_logged_before" -> weightLogRepository
                .findFirstByCreatedByAndDeletedFalseAndDateOrderByCreatedAtDesc(userId, date)
                .map(w -> localTime(w.getCreatedAt())
                    .isBefore(LocalTime.parse(properties.weighInCutoff())))
                .orElse(false);
            case "stim_intake_before" -> stimIntakes(userId, date).stream()
                .anyMatch(t -> t.isBefore(LocalTime.parse(properties.morningWindowEnd())));
            case "training_done_today" ->
                !workoutSessionRepository.findDoneInstanceDates(userId, date, date).isEmpty()
                    || runSessionLogRepository
                        .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, date)
                        .stream()
                        .anyMatch(r -> date.equals(r.getDate()) && localTime(r.getCreatedAt())
                            .isBefore(LocalTime.parse(properties.workoutCutoff())));
            case "breakfast_protein" -> fuelDayService.getDay(userId, date).getMeals().stream()
                .filter(m -> "breakfast".equals(m.getSlot()))
                .map(m -> m.getMacros().getP())
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .compareTo(BigDecimal.valueOf(properties.proteinTargetG())) >= 0;
            case "no_stim_after" -> stimIntakes(userId, date).stream()
                .noneMatch(t -> t.isAfter(LocalTime.parse(properties.caffeineCutoff())));
            case "last_meal_before" -> {
                var meals = mealRepository
                    .findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(userId, date);
                if (meals.isEmpty()) {
                    yield true; // nothing logged after close — vacuously kept
                }
                LocalTime close = habitTargets.resolve(userId).bed()
                    .minusMinutes(properties.kitchenCloseOffsetMin());
                yield !localTime(meals.getLast().getLoggedAt()).isAfter(close);
            }
            case METRIC_BED_NEXT_DAY -> sleepLog(userId, date.plusDays(1))
                .map(SleepLogEntity::getBedtime).filter(Objects::nonNull)
                .map(b -> bedtimeOnTime(LocalTime.parse(b),
                    habitTargets.resolve(userId).bed(), properties.bedGraceMin()))
                .orElse(false);
            default -> {
                log.warn("Unknown habit metric '{}' — treated as not satisfied", metric);
                yield false;
            }
        };
    }

    private Optional<SleepLogEntity> sleepLog(UUID userId, LocalDate date) {
        return sleepLogRepository
            .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, date)
            .stream().filter(s -> date.equals(s.getDate())).findFirst();
    }

    /** Local wall-clock times of the day's stim-kind intakes (owner-scoped pantry resolution). */
    private List<LocalTime> stimIntakes(UUID userId, LocalDate date) {
        return supplementIntakeRepository
            .findByCreatedByAndTakenDateAndDeletedFalseOrderByTakenAtAsc(userId, date).stream()
            .filter(i -> pantryItemRepository
                .findByIdAndCreatedByAndDeletedFalse(i.getPantryItemId(), userId)
                .map(p -> "stim".equals(p.getKind())).orElse(false))
            .map(i -> localTime(i.getTakenAt()))
            .toList();
    }

    private static LocalTime localTime(Instant instant) {
        return instant.atZone(ZoneId.systemDefault()).toLocalTime();
    }

    private static boolean withinWindow(LocalTime actual, LocalTime target, int windowMin) {
        return !actual.isBefore(target.minusMinutes(windowMin))
            && !actual.isAfter(target.plusMinutes(windowMin));
    }

    /** HH:mm before noon reads as after-midnight (23:00 target + grace never wraps in v1). */
    private static boolean bedtimeOnTime(LocalTime bedtime, LocalTime target, int graceMin) {
        int actual = bedtime.getHour() * 60 + bedtime.getMinute();
        if (actual < 12 * 60) {
            actual += 24 * 60;
        }
        int limit = target.getHour() * 60 + target.getMinute() + graceMin;
        if (target.getHour() < 12) {
            limit += 24 * 60;
        }
        return actual <= limit;
    }
}
