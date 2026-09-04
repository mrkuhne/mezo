package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.companion.TodayActivitySource;
import io.mrkuhne.mezo.feature.companion.TodayQuestSource;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.repository.WaterLogRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationDoseRepository;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.people.entity.MentionEntity;
import io.mrkuhne.mezo.feature.people.repository.MentionRepository;
import io.mrkuhne.mezo.feature.ritual.entity.RitualDayEntity;
import io.mrkuhne.mezo.feature.ritual.repository.RitualDayRepository;
import io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * V3.1 series extraction: one per-day scalar series per {@link MetricKey}, composed READ-ONLY
 * from the owning features (the snapshot/digest precedent — companion → others, never back).
 * Multi-row days aggregate deterministically (avg scores, sum loads/volumes, max sleep row,
 * latest weigh-in); missing days are simply absent — the correlation aligns on presence, it
 * never invents values. The two documented exceptions are {@code HABITS_DONE} and
 * {@code COMBINED_LOAD_MIN}, where absence of a row genuinely means zero.
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
    private final ExerciseFeedbackRepository exerciseFeedbackRepository;
    private final MealRepository mealRepository;
    private final FuelDayService fuelDayService;
    private final MedicationRepository medicationRepository;
    private final MedicationDoseRepository medicationDoseRepository;
    private final MedicationCycleService medicationCycleService;
    private final WaterLogRepository waterLogRepository;
    private final WeightLogRepository weightLogRepository;
    private final CheckInRepository checkInRepository;
    private final HabitDayRepository habitDayRepository;
    private final RitualDayRepository ritualDayRepository;
    private final MentionRepository mentionRepository;
    private final CompanionProperties properties;
    // activity/quest a companiontól függ (LLM-hívók) — a napi-XP olvasás ezért porton át jön
    // (TodayActivitySource/TodayQuestSource minta), különben szelet-ciklus zárulna.
    private final ObjectProvider<TodayActivitySource> todayActivitySource;
    private final ObjectProvider<TodayQuestSource> todayQuestSource;

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
            case DAILY_KCAL -> fuelRollup(userId, from, to, MacroSet::getKcal);
            case DAILY_PROTEIN_G -> fuelRollup(userId, from, to, MacroSet::getP);
            case MEAL_SCORE -> mealScore(userId, from, to);
            case MEDICATION_DOSE_MG -> medicationDose(userId, from, to);
            case MEDICATION_CYCLE_DAY -> medicationCycleDay(userId, from, to);
            case DAILY_WATER_ML -> dailyWater(userId, from, to);
            case WEIGHT_DELTA_KG -> weightDelta(userId, from, to);
            case CHECKIN_STRESS -> checkIn(userId, from, to, CheckInEntity::getStress);
            case CHECKIN_ENERGY -> checkIn(userId, from, to, CheckInEntity::getEnergy);
            case GYM_WORKLOAD -> gymFeedback(userId, from, to, ExerciseFeedbackEntity::getWorkload, false);
            case GYM_JOINT_PAIN -> gymFeedback(userId, from, to, ExerciseFeedbackEntity::getJointPain, true);
            case CHECKIN_BODY -> checkIn(userId, from, to, CheckInEntity::getBody);
            case CHECKIN_MENTAL -> checkIn(userId, from, to, CheckInEntity::getMental);
            case BEDTIME_HOUR -> sleep(userId, from, to, s -> clockHour(s.getBedtime(), true));
            case WAKEUP_HOUR -> sleep(userId, from, to, s -> clockHour(s.getWakeup(), false));
            case SLEEP_AWAKENINGS -> sleep(userId, from, to, s ->
                    s.getAwakenings() == null ? null : s.getAwakenings().doubleValue());
            case HABITS_DONE -> habitsDone(userId, from, to);
            case RITUAL_CLOSED -> ritualClosed(userId, from, to);
            case DAILY_XP -> dailyXp(userId, from, to);
            case SOCIAL_MENTIONS -> socialMentions(userId, from, to);
            case RUN_HR_RECOVERY_S -> hrRecovery(userId, from, to);
            case WEEKEND -> weekend(from, to);
            case ACWR -> acwr(userId, from, to);
            case TRAINING_MONOTONY -> trainingMonotony(userId, from, to);
            case BEDTIME_VARIABILITY -> bedtimeVariability(userId, from, to);
            case SHOULDER_STRAIN -> shoulderStrain(userId, from, to);
            case WEIGHT_TREND_PCT_WK -> weightTrendPctWk(userId, from, to);
            case COMBINED_LOAD_MIN -> combinedLoad(userId, from, to);
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

    /**
     * "H:mm"/"HH:mm" óra-string → törtóra; lefekvésnél az éjfél utáni óra +24 (01:00 → 25.0,
     * dél előtti cutoff), hogy a sorozat monoton maradjon a "későn feküdt" tengelyen.
     * Hibás/hiányzó string → null (nincs adatpont, sosem találunk ki értéket).
     */
    private static Double clockHour(String clock, boolean shiftPastMidnight) {
        if (clock == null || !clock.matches("\\d{1,2}:\\d{2}")) {
            return null;
        }
        String[] parts = clock.split(":");
        int hour = Integer.parseInt(parts[0]);
        int minute = Integer.parseInt(parts[1]);
        if (hour > 23 || minute > 59) {
            return null;
        }
        double fractional = hour + minute / 60.0;
        return shiftPastMidnight && hour < 12 ? fractional + 24 : fractional;
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

    /** Σ weight×reps over the day's non-skipped logged sets (the get_training_log scope=gym math). */
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

    /** The day's LAST meal as fractional hour-of-day (system zone) — the "late eating" signal.
     *  Bounded read (mezo-9gp3, mezo-d58h.6): the metric only ever looks at {@code [from, to]},
     *  no rolling margin, so the query is scoped there directly instead of loading every meal
     *  the user has ever logged and filtering in Java. */
    private Map<LocalDate, Double> lateMealHour(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> series = new HashMap<>();
        for (MealEntity meal : mealRepository
                .findByCreatedByAndDeletedFalseAndMealDateBetweenOrderByMealDateAsc(userId, from, to)) {
            var local = meal.getLoggedAt().atZone(ZoneId.systemDefault());
            double hour = local.getHour() + local.getMinute() / 60.0;
            series.merge(meal.getMealDate(), hour, Math::max);
        }
        return series;
    }

    private interface FuelValue {
        BigDecimal value(MacroSet consumed);
    }

    /** Napi fuel-rollup — csak étkezéses napok (a DAILY_KCAL eredeti mintája, mezőre paraméterezve). */
    private Map<LocalDate, Double> fuelRollup(UUID userId, LocalDate from, LocalDate to, FuelValue extractor) {
        Map<LocalDate, Double> series = new HashMap<>();
        List<LocalDate> mealDays = mealRepository.findAllOwned(userId).stream()
                .map(MealEntity::getMealDate)
                .filter(d -> !d.isBefore(from) && !d.isAfter(to))
                .distinct()
                .toList();
        for (LocalDate day : mealDays) {
            FuelDayResponse fuelDay = fuelDayService.getDay(userId, day);
            BigDecimal value = extractor.value(fuelDay.getConsumed());
            if (value != null && value.signum() > 0) {
                series.put(day, value.doubleValue());
            }
        }
        return series;
    }

    /** A nap score-olt étkezéseinek átlaga (score nélküli meal nem adatpont). */
    private Map<LocalDate, Double> mealScore(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, List<Double>> perDay = new HashMap<>();
        for (MealEntity meal : mealRepository.findAllOwned(userId)) {
            if (meal.getMealDate().isBefore(from) || meal.getMealDate().isAfter(to)
                    || meal.getScore() == null) {
                continue;
            }
            perDay.computeIfAbsent(meal.getMealDate(), d -> new ArrayList<>())
                    .add(meal.getScore().doubleValue());
        }
        return average(perDay);
    }

    /**
     * Aktuális dózis-szint naponta: az adott napon-vagy-előtte utolsó beadott dózis (a ciklusnap-
     * deriválás horgony-mintája). Az első beadás előtti napokra nincs adat — honest absence.
     */
    private Map<LocalDate, Double> medicationDose(UUID userId, LocalDate from, LocalDate to) {
        MedicationEntity med = medicationRepository
                .findFirstByCreatedByAndActiveTrueAndDeletedFalse(userId).orElse(null);
        if (med == null) {
            return Map.of();
        }
        Map<LocalDate, Double> series = new HashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            LocalDate current = day;
            medicationDoseRepository
                    .findFirstByCreatedByAndMedicationIdAndDeletedFalseAndAdministeredDateLessThanEqualOrderByAdministeredDateDesc(
                            userId, med.getId(), day)
                    .ifPresent(dose -> {
                        if (dose.getDose() != null) {
                            series.put(current, dose.getDose().doubleValue());
                        }
                    });
        }
        return series;
    }

    /** The derived medication cycle day per date (honest-zero days skipped — no dose anchor yet). */
    private Map<LocalDate, Double> medicationCycleDay(UUID userId, LocalDate from, LocalDate to) {
        MedicationEntity med = medicationRepository
                .findFirstByCreatedByAndActiveTrueAndDeletedFalse(userId).orElse(null);
        if (med == null) {
            return Map.of();
        }
        Map<LocalDate, Double> series = new HashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            int cycleDay = medicationCycleService.derive(userId, med, day).cycleDay();
            if (cycleDay > 0) {
                series.put(day, (double) cycleDay);
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
        // date-asc alone leaves same-day rows in unspecified SQL order — sort by createdAt too,
        // so the LAST put is deterministically the latest weigh-in of the day (review finding).
        weightLogRepository.findAllOwned(userId).stream()
                .filter(log -> !log.getDate().isBefore(from.minusDays(1)) && !log.getDate().isAfter(to))
                .sorted(java.util.Comparator.comparing(WeightLogEntity::getDate)
                        .thenComparing(WeightLogEntity::getCreatedAt))
                .forEach(log -> weights.put(log.getDate(), log.getWeightKg().doubleValue()));
        Map<LocalDate, Double> series = new HashMap<>();
        weights.forEach((day, weight) -> {
            Double previous = weights.get(day.minusDays(1));
            if (previous != null && !day.isBefore(from)) {
                series.put(day, weight - previous);
            }
        });
        return series;
    }

    /**
     * 7 napos gördülő legkisebb-négyzetes súly-lejtő %/hét-ben (a lejtő kg/nap × 7 / ablakátlag
     * × 100). Honest gate: <4 mérés a gördülő ablakban ⇒ nincs adatpont. Belső ablak-kiterjesztés
     * (az ACWR mintája): a hívó [from,to]-ja változatlan.
     *
     * <p>Bounded read (mezo-9gp3, mezo-d58h.6): the rolling slope needs the 6-day margin BEFORE
     * {@code from} too, so the query is scoped to {@code [from-6, to]} — narrowing it to
     * {@code [from, to]} would silently drop the first window's leading days and change values.
     */
    private Map<LocalDate, Double> weightTrendPctWk(UUID userId, LocalDate from, LocalDate to) {
        TreeMap<LocalDate, Double> weights = new TreeMap<>();
        weightLogRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateAscCreatedAtAsc(
                        userId, from.minusDays(6), to)
                .stream()
                .sorted(java.util.Comparator.comparing(WeightLogEntity::getDate)
                        .thenComparing(WeightLogEntity::getCreatedAt))
                .forEach(log -> weights.put(log.getDate(), log.getWeightKg().doubleValue()));

        Map<LocalDate, Double> series = new HashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            List<double[]> points = new ArrayList<>(); // {dayIndex 0..6, weightKg}
            for (int i = 6; i >= 0; i--) {
                Double kg = weights.get(day.minusDays(i));
                if (kg != null) {
                    points.add(new double[] {6 - i, kg});
                }
            }
            if (points.size() < 4) {
                continue;
            }
            double meanX = points.stream().mapToDouble(p -> p[0]).average().orElseThrow();
            double meanY = points.stream().mapToDouble(p -> p[1]).average().orElseThrow();
            double num = 0;
            double den = 0;
            for (double[] p : points) {
                num += (p[0] - meanX) * (p[1] - meanY);
                den += (p[0] - meanX) * (p[0] - meanX);
            }
            if (den == 0) {
                continue;
            }
            double slopeKgPerDay = num / den;
            series.put(day, slopeKgPerDay * 7 / meanY * 100);
        }
        return series;
    }

    private interface FeedbackValue {
        Integer value(ExerciseFeedbackEntity feedback);
    }

    /** Set-debrief jelek a nap befejezett edzései felett — workload átlag, fájdalom csúcs (max). */
    private Map<LocalDate, Double> gymFeedback(UUID userId, LocalDate from, LocalDate to,
                                               FeedbackValue extractor, boolean peak) {
        Map<LocalDate, List<Double>> perDay = new HashMap<>();
        for (WorkoutSessionEntity session : workoutSessionRepository.findDoneInstancesBetween(userId, from, to)) {
            if (session.getDate() == null) {
                continue;
            }
            for (ExerciseFeedbackEntity feedback : exerciseFeedbackRepository
                    .findByCreatedByAndWorkoutSessionId(userId, session.getId())) {
                Integer value = extractor.value(feedback);
                if (value != null) {
                    perDay.computeIfAbsent(session.getDate(), d -> new ArrayList<>()).add(value.doubleValue());
                }
            }
        }
        if (!peak) {
            return average(perDay);
        }
        Map<LocalDate, Double> series = new HashMap<>();
        perDay.forEach((day, values) -> series.put(day,
                values.stream().mapToDouble(Double::doubleValue).max().orElseThrow()));
        return series;
    }

    private interface CheckInValue {
        Integer value(CheckInEntity checkIn);
    }

    /** Avg of the day's check-in slots for the given score. B2 (mezo-8tp8): queries the
     *  {@code [from, to]} window directly instead of loading every check-in the user has ever
     *  logged and filtering in Java. */
    private Map<LocalDate, Double> checkIn(UUID userId, LocalDate from, LocalDate to, CheckInValue extractor) {
        Map<LocalDate, List<Double>> perDay = new HashMap<>();
        for (CheckInEntity checkIn : checkInRepository.findByCreatedByAndDeletedFalseAndDateBetween(userId, from, to)) {
            Integer value = extractor.value(checkIn);
            if (value != null) {
                perDay.computeIfAbsent(checkIn.getDate(), d -> new ArrayList<>()).add(value.doubleValue());
            }
        }
        return average(perDay);
    }

    /** 0/1 hétvége-jel (szo–vas) — tiszta naptári sorozat, kontroll-változó. */
    private static Map<LocalDate, Double> weekend(LocalDate from, LocalDate to) {
        Map<LocalDate, Double> series = new HashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            DayOfWeek dow = day.getDayOfWeek();
            series.put(day, dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY ? 1.0 : 0.0);
        }
        return series;
    }

    /**
     * Napi terhelés közös skálán: sport-perc + gym-volumen perc-ekvivalens (kg / load-gym-kg-per-min).
     * Naptári tömb — a nem-logolt nap terhelése valódi 0 (a gördülő ablakok ezt igénylik).
     */
    private double[] dailyLoad(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> sport = sportLoad(userId, from, to);
        Map<LocalDate, Double> gym = gymVolume(userId, from, to);
        double kgPerMin = properties.patterns().loadGymKgPerMin();
        int days = (int) (to.toEpochDay() - from.toEpochDay()) + 1;
        double[] load = new double[days];
        for (int i = 0; i < days; i++) {
            LocalDate day = from.plusDays(i);
            load[i] = sport.getOrDefault(day, 0.0) + gym.getOrDefault(day, 0.0) / kgPerMin;
        }
        return load;
    }

    /**
     * A dailyLoad naptári sor sorozatként: minden nap létezik, a nem-logolt nap valódi 0 — a
     * HABITS_DONE utáni második dokumentált kivétel a "missing stays missing" szabály alól
     * (edzés-nemlét itt információ, a gördülő terhelés-ablakok ezt igénylik).
     */
    private Map<LocalDate, Double> combinedLoad(UUID userId, LocalDate from, LocalDate to) {
        double[] load = dailyLoad(userId, from, to);
        Map<LocalDate, Double> series = new HashMap<>();
        for (int i = 0; i < load.length; i++) {
            series.put(from.plusDays(i), load[i]);
        }
        return series;
    }

    /**
     * ACWR: 7 napos akut / 28 napos krónikus átlag-terhelés aránya. Az extraktor az ablak ELŐTTI
     * 28 napot is beolvassa (belső ablak-kiterjesztés — a hívó [from,to]-ja változatlan);
     * krónikus 0 → nincs adatpont.
     */
    private Map<LocalDate, Double> acwr(UUID userId, LocalDate from, LocalDate to) {
        LocalDate extendedFrom = from.minusDays(27);
        double[] load = dailyLoad(userId, extendedFrom, to);
        Map<LocalDate, Double> series = new HashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            int idx = (int) (day.toEpochDay() - extendedFrom.toEpochDay());
            double acute = mean(load, idx - 6, idx);
            double chronic = mean(load, idx - 27, idx);
            if (chronic > 0) {
                series.put(day, acute / chronic);
            }
        }
        return series;
    }

    /** Foster-monotónia: 7 napos gördülő átlag/szórás; szórás=0 → definiálatlan, nincs adatpont. */
    private Map<LocalDate, Double> trainingMonotony(UUID userId, LocalDate from, LocalDate to) {
        LocalDate extendedFrom = from.minusDays(6);
        double[] load = dailyLoad(userId, extendedFrom, to);
        Map<LocalDate, Double> series = new HashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            int idx = (int) (day.toEpochDay() - extendedFrom.toEpochDay());
            double mean = mean(load, idx - 6, idx);
            double sd = stdDev(load, idx - 6, idx, mean);
            if (sd > 0) {
                series.put(day, mean / sd);
            }
        }
        return series;
    }

    /** A bedtime-hour 7 napos gördülő (populációs) szórása — social jetlag jel; min. 3 nap adat. */
    private Map<LocalDate, Double> bedtimeVariability(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> bedtimes = sleep(userId, from.minusDays(6), to,
                s -> clockHour(s.getBedtime(), true));
        Map<LocalDate, Double> series = new HashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            List<Double> window = new ArrayList<>();
            for (int i = 0; i <= 6; i++) {
                Double value = bedtimes.get(day.minusDays(i));
                if (value != null) {
                    window.add(value);
                }
            }
            if (window.size() < 3) {
                continue;
            }
            double mean = window.stream().mapToDouble(Double::doubleValue).average().orElseThrow();
            double sq = window.stream().mapToDouble(v -> (v - mean) * (v - mean)).sum();
            series.put(day, Math.sqrt(sq / window.size()));
        }
        return series;
    }

    private static double mean(double[] values, int fromIdx, int toIdx) {
        double sum = 0;
        for (int i = fromIdx; i <= toIdx; i++) {
            sum += values[i];
        }
        return sum / (toIdx - fromIdx + 1);
    }

    /** Populációs szórás a [fromIdx,toIdx] szeleten (a 7 napos Foster-ablak fix hosszú). */
    private static double stdDev(double[] values, int fromIdx, int toIdx, double mean) {
        double sq = 0;
        for (int i = fromIdx; i <= toIdx; i++) {
            sq += (values[i] - mean) * (values[i] - mean);
        }
        return Math.sqrt(sq / (toIdx - fromIdx + 1));
    }

    /** Kész szokások száma naponta — habit-soros nap 0-val is adatpont, sor nélküli nap nem. */
    private Map<LocalDate, Double> habitsDone(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> series = new HashMap<>();
        for (HabitDayEntity habit : habitDayRepository.findByCreatedByAndHabitDateBetween(userId, from, to)) {
            double done = HabitDayEntity.STATUS_DONE.equals(habit.getStatus()) ? 1 : 0;
            series.merge(habit.getHabitDate(), done, Double::sum);
        }
        return series;
    }

    /**
     * 0/1 lezárás-sorozat (point-biserial). ritual_day sor reflexióra is születhet (mezo-b3pp.2),
     * ezért a lezárás mércéje a {@code closed_at is not null}, nem a sor léte; a 0-kat a naptár
     * adja — de csak az első valaha lezárt nap (adopció) UTÁN: előtte a hiány nem
     * "nem zárta le", hanem "még nem használta a rituálét".
     */
    private Map<LocalDate, Double> ritualClosed(UUID userId, LocalDate from, LocalDate to) {
        LocalDate adopted = ritualDayRepository.findFirstByCreatedByAndClosedAtIsNotNullOrderByRitualDateAsc(userId)
                .map(RitualDayEntity::getRitualDate).orElse(null);
        if (adopted == null) {
            return Map.of();
        }
        Set<LocalDate> closed = ritualDayRepository
                .findByCreatedByAndRitualDateBetweenAndClosedAtIsNotNull(userId, from, to).stream()
                .map(RitualDayEntity::getRitualDate)
                .collect(Collectors.toSet());
        Map<LocalDate, Double> series = new HashMap<>();
        for (LocalDate day = from.isBefore(adopted) ? adopted : from; !day.isAfter(to); day = day.plusDays(1)) {
            series.put(day, closed.contains(day) ? 1.0 : 0.0);
        }
        return series;
    }

    /** Napi össz-XP (activity + habit + completed quest); 0 XP-s nap nem adatpont (DAILY_KCAL-minta).
     *  Az activity/quest oldal portokon át jön; hiányzó bean (kapcsoló ki) = nincs az a forrás. */
    private Map<LocalDate, Double> dailyXp(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> series = new HashMap<>();
        TodayActivitySource activities = todayActivitySource.getIfAvailable();
        if (activities != null) {
            activities.awardedXpByDay(userId, from, to).forEach((day, xp) ->
                    series.merge(day, xp.doubleValue(), Double::sum));
        }
        habitDayRepository.findByCreatedByAndHabitDateBetween(userId, from, to).forEach(h -> {
            if (h.getXpAwarded() != null && h.getXpAwarded() > 0) {
                series.merge(h.getHabitDate(), h.getXpAwarded().doubleValue(), Double::sum);
            }
        });
        TodayQuestSource quests = todayQuestSource.getIfAvailable();
        if (quests != null) {
            quests.completedXpByDay(userId, from, to).forEach((day, xp) ->
                    series.merge(day, xp.doubleValue(), Double::sum));
        }
        return series;
    }

    /** People-említések napi darabszáma (ts rendszerzónás napja). */
    private Map<LocalDate, Double> socialMentions(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> series = new HashMap<>();
        for (MentionEntity mention : mentionRepository.findAllByCreatedByAndDeletedFalseOrderByTsDesc(userId)) {
            LocalDate day = mention.getTs().atZone(ZoneId.systemDefault()).toLocalDate();
            if (!day.isBefore(from) && !day.isAfter(to)) {
                series.merge(day, 1.0, Double::sum);
            }
        }
        return series;
    }

    /** Futás utáni pulzus-visszaállás (mp) napi átlaga — ritka adat, a kapu kezeli. */
    private Map<LocalDate, Double> hrRecovery(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, List<Double>> perDay = new HashMap<>();
        runSessionLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from)
                .forEach(r -> {
                    if (!r.getDate().isAfter(to) && r.getHrRecoverySec() != null) {
                        perDay.computeIfAbsent(r.getDate(), d -> new ArrayList<>())
                                .add(r.getHrRecoverySec().doubleValue());
                    }
                });
        return average(perDay);
    }

    /** A nap sport-session shoulder_strain CSÚCSA (1–10; null-os session nem adatpont). */
    private Map<LocalDate, Double> shoulderStrain(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Double> series = new HashMap<>();
        sportSessionRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from)
                .forEach(s -> {
                    if (!s.getDate().isAfter(to) && s.getShoulderStrain() != null) {
                        series.merge(s.getDate(), s.getShoulderStrain().doubleValue(), Math::max);
                    }
                });
        return series;
    }

    private static Map<LocalDate, Double> average(Map<LocalDate, List<Double>> perDay) {
        Map<LocalDate, Double> series = new HashMap<>();
        perDay.forEach((day, values) -> series.put(day,
                values.stream().mapToDouble(Double::doubleValue).average().orElseThrow()));
        return series;
    }
}
