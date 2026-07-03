package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.repository.WaterLogRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

/**
 * V3.1 series extraction: one per-day scalar series per {@link MetricKey}, composed READ-ONLY
 * from the owning features (the snapshot/digest precedent — companion → others, never back).
 * Multi-row days aggregate deterministically (avg scores, sum loads/volumes, max sleep row,
 * latest weigh-in); missing days are simply absent — the correlation aligns on presence, it
 * never invents values.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MetricSeriesService {

    private final SleepLogRepository sleepLogRepository;
    private final SportSessionRepository sportSessionRepository;
    private final RunSessionLogRepository runSessionLogRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final MealRepository mealRepository;
    private final FuelDayService fuelDayService;
    private final MedicationRepository medicationRepository;
    private final MedicationCycleService medicationCycleService;
    private final WaterLogRepository waterLogRepository;
    private final WeightLogRepository weightLogRepository;
    private final CheckInRepository checkInRepository;

    /**
     * The metric's per-day values inside {@code [from, to]} (inclusive). Reads traverse LAZY
     * associations in the gym path (session sets) — hence the read-only transaction.
     */
    @Transactional(readOnly = true)
    public Map<LocalDate, Double> series(UUID userId, MetricKey metric, LocalDate from, LocalDate to) {
        return switch (metric) {
            case SLEEP_QUALITY -> sleep(userId, from, to, s ->
                    s.getQuality() == null ? null : s.getQuality().doubleValue());
            case SLEEP_DURATION_H -> sleep(userId, from, to, s ->
                    s.getDurationH() == null ? null : s.getDurationH().doubleValue());
            case TRAINING_RPE -> trainingRpe(userId, from, to);
            case SPORT_LOAD_MIN -> sportLoad(userId, from, to);
            case GYM_VOLUME_KG -> gymVolume(userId, from, to);
            case LATE_MEAL_HOUR -> lateMealHour(userId, from, to);
            case DAILY_KCAL -> dailyKcal(userId, from, to);
            case RETA_CYCLE_DAY -> retaCycleDay(userId, from, to);
            case DAILY_WATER_ML -> dailyWater(userId, from, to);
            case WEIGHT_DELTA_KG -> weightDelta(userId, from, to);
            case CHECKIN_STRESS -> checkIn(userId, from, to, CheckInEntity::getStress);
            case CHECKIN_ENERGY -> checkIn(userId, from, to, CheckInEntity::getEnergy);
        };
    }

    private interface SleepValue {
        Double value(SleepLogEntity sleep);
    }

    private Map<LocalDate, Double> sleep(UUID userId, LocalDate from, LocalDate to, SleepValue extractor) {
        Map<LocalDate, Double> series = new HashMap<>();
        for (SleepLogEntity sleep : sleepLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from)) {
            if (sleep.getDate().isAfter(to)) {
                continue;
            }
            Double value = extractor.value(sleep);
            if (value != null) {
                series.merge(sleep.getDate(), value, Math::max);
            }
        }
        return series;
    }

    /** Avg of the day's RPE-like signals (sport rpe 1-10 + run rpeActual 1-10). */
    private Map<LocalDate, Double> trainingRpe(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, List<Double>> perDay = new HashMap<>();
        sportSessionRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from)
                .forEach(s -> {
                    if (!s.getDate().isAfter(to) && s.getRpe() != null) {
                        perDay.computeIfAbsent(s.getDate(), d -> new ArrayList<>())
                                .add(s.getRpe().doubleValue());
                    }
                });
        runSessionLogRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from)
                .forEach(r -> {
                    if (!r.getDate().isAfter(to) && r.getRpeActual() != null) {
                        perDay.computeIfAbsent(r.getDate(), d -> new ArrayList<>())
                                .add(r.getRpeActual().doubleValue());
                    }
                });
        return average(perDay);
    }

    /** Sum of the day's sport-session minutes. */
    private Map<LocalDate, Double> sportLoad(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> series = new HashMap<>();
        sportSessionRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from)
                .forEach(s -> {
                    if (!s.getDate().isAfter(to) && s.getDurationMin() != null) {
                        series.merge(s.getDate(), s.getDurationMin().doubleValue(), Double::sum);
                    }
                });
        return series;
    }

    /** Σ weight×reps over the day's non-skipped logged sets (the get_recent_workouts math). */
    private Map<LocalDate, Double> gymVolume(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> series = new HashMap<>();
        for (WorkoutSessionEntity session : workoutSessionRepository.findDoneInstancesBetween(userId, from, to)) {
            if (session.getDate() == null) {
                continue;
            }
            double volume = 0;
            for (ExerciseSetEntity set : exerciseSetRepository
                    .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(userId, session.getId())) {
                if (!set.isSkipped() && set.getReps() != null && set.getWeightKg() != null) {
                    volume += set.getWeightKg().doubleValue() * set.getReps();
                }
            }
            if (volume > 0) {
                series.merge(session.getDate(), volume, Double::sum);
            }
        }
        return series;
    }

    /** The day's LAST meal as fractional hour-of-day (system zone) — the "late eating" signal. */
    private Map<LocalDate, Double> lateMealHour(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> series = new HashMap<>();
        for (MealEntity meal : mealRepository.findAllOwned(userId)) {
            if (meal.getMealDate().isBefore(from) || meal.getMealDate().isAfter(to)) {
                continue;
            }
            var local = meal.getLoggedAt().atZone(ZoneId.systemDefault());
            double hour = local.getHour() + local.getMinute() / 60.0;
            series.merge(meal.getMealDate(), hour, Math::max);
        }
        return series;
    }

    /** Consumed kcal per day — only days that have meals; reuses the FuelDay mapper math. */
    private Map<LocalDate, Double> dailyKcal(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> series = new HashMap<>();
        List<LocalDate> mealDays = mealRepository.findAllOwned(userId).stream()
                .map(MealEntity::getMealDate)
                .filter(d -> !d.isBefore(from) && !d.isAfter(to))
                .distinct()
                .toList();
        for (LocalDate day : mealDays) {
            FuelDayResponse fuelDay = fuelDayService.getDay(userId, day);
            BigDecimal kcal = fuelDay.getConsumed().getKcal();
            if (kcal != null && kcal.signum() > 0) {
                series.put(day, kcal.doubleValue());
            }
        }
        return series;
    }

    /** The derived Reta cycle day per date (honest-zero days skipped — no dose anchor yet). */
    private Map<LocalDate, Double> retaCycleDay(UUID userId, LocalDate from, LocalDate to) {
        MedicationEntity med = medicationRepository
                .findFirstByCreatedByAndActiveTrueAndDeletedFalse(userId).orElse(null);
        if (med == null) {
            return Map.of();
        }
        Map<LocalDate, Double> series = new HashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            int retaDay = medicationCycleService.derive(userId, med, day).retaDay();
            if (retaDay > 0) {
                series.put(day, (double) retaDay);
            }
        }
        return series;
    }

    /** Logged water per day (an unlogged 0 is absence, not a data point). */
    private Map<LocalDate, Double> dailyWater(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> series = new HashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            int sum = waterLogRepository.sumAmountForDay(userId, day);
            if (sum > 0) {
                series.put(day, (double) sum);
            }
        }
        return series;
    }

    /** Morning weight change vs the PREVIOUS calendar day — gaps yield no point (never bridged). */
    private Map<LocalDate, Double> weightDelta(UUID userId, LocalDate from, LocalDate to) {
        TreeMap<LocalDate, Double> weights = new TreeMap<>();
        for (WeightLogEntity log : weightLogRepository.findAllOwned(userId)) {
            if (!log.getDate().isBefore(from.minusDays(1)) && !log.getDate().isAfter(to)) {
                weights.put(log.getDate(), log.getWeightKg().doubleValue()); // findAllOwned is date-asc → latest wins
            }
        }
        Map<LocalDate, Double> series = new HashMap<>();
        weights.forEach((day, weight) -> {
            Double previous = weights.get(day.minusDays(1));
            if (previous != null && !day.isBefore(from)) {
                series.put(day, weight - previous);
            }
        });
        return series;
    }

    private interface CheckInValue {
        Integer value(CheckInEntity checkIn);
    }

    /** Avg of the day's check-in slots for the given score. */
    private Map<LocalDate, Double> checkIn(UUID userId, LocalDate from, LocalDate to, CheckInValue extractor) {
        Map<LocalDate, List<Double>> perDay = new HashMap<>();
        for (CheckInEntity checkIn : checkInRepository.findAllOwned(userId)) {
            if (checkIn.getDate().isBefore(from) || checkIn.getDate().isAfter(to)) {
                continue;
            }
            Integer value = extractor.value(checkIn);
            if (value != null) {
                perDay.computeIfAbsent(checkIn.getDate(), d -> new ArrayList<>()).add(value.doubleValue());
            }
        }
        return average(perDay);
    }

    private static Map<LocalDate, Double> average(Map<LocalDate, List<Double>> perDay) {
        Map<LocalDate, Double> series = new HashMap<>();
        perDay.forEach((day, values) -> series.put(day,
                values.stream().mapToDouble(Double::doubleValue).average().orElseThrow()));
        return series;
    }
}
