package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.character.detector.DetectorInput;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.repository.WaterLogRepository;
import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * The single cross-feature read composer for the detector framework (Karakter spec §5, mezo-1gim.3):
 * assembles a {@link DetectorInput} slice from meal, check-in, weight, journal, gym, sport, run,
 * sleep, and mesocycle data, mirroring the read-only cross-feature repository access pattern used
 * by {@code ContextSnapshotAssembler} (feature/companion).
 *
 * <p><b>Catch-up honesty:</b> every read is bounded above by {@code day} — either directly via the
 * range finder's upper bound, or (where a finder only bounds below, e.g. the weight read) by an
 * in-memory filter — so a catch-up run for a past {@code day} never leaks data logged afterwards
 * into the slice.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterSignalReads {

    private static final int WINDOW_DAYS = 14;
    private static final int TREND_WEEKS = 8;
    private static final String PHASE_DELOAD = "Deload";

    private final MealRepository mealRepository;
    private final WeightLogRepository weightLogRepository;
    private final CheckInRepository checkInRepository;
    private final JournalEntryRepository journalEntryRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseFeedbackRepository exerciseFeedbackRepository;
    private final ExerciseRepository exerciseRepository;
    private final SportSessionRepository sportSessionRepository;
    private final RunSessionLogRepository runSessionLogRepository;
    private final SleepLogRepository sleepLogRepository;
    private final MesocycleRepository mesocycleRepository;
    private final GymScheduleSlotRepository gymScheduleSlotRepository;
    private final WaterLogRepository waterLogRepository;
    private final GoalRepository goalRepository;
    private final NutritionTargetsProperties nutritionTargets;

    public DetectorInput gather(UUID owner, LocalDate day) {
        LocalDate windowStart = day.minusDays(WINDOW_DAYS - 1);
        LocalDate trendStart = day.minusWeeks(TREND_WEEKS).plusDays(1);

        List<DetectorInput.MealDayPoint> mealDays = gatherMealDays(owner, trendStart, day);
        Set<LocalDate> mealDates = mealDays.stream()
                .map(DetectorInput.MealDayPoint::date)
                .filter(d -> !d.isBefore(windowStart))
                .collect(java.util.stream.Collectors.toCollection(HashSet::new));

        Map<LocalDate, Integer> checkinCounts = new HashMap<>();
        for (LocalDate d = windowStart; !d.isAfter(day); d = d.plusDays(1)) {
            checkinCounts.put(d, checkInRepository.findByCreatedByAndDateOrderBySlotTime(owner, d).size());
        }

        List<DetectorInput.WaterDayPoint> waterDays = gatherWaterDays(owner, trendStart, day);

        List<DetectorInput.WeightPoint> weights = weightLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(owner, windowStart)
                .stream()
                // The finder only bounds below (>= windowStart); during catch-up runs for a past
                // `day`, entries logged AFTER `day` would otherwise leak into the window and
                // distort under-logging's first-vs-last delta, so bound above in memory here.
                .filter(w -> !w.getDate().isAfter(day))
                .map(w -> new DetectorInput.WeightPoint(w.getDate(), w.getWeightKg()))
                .sorted(Comparator.comparing(DetectorInput.WeightPoint::date))
                .toList();

        Map<LocalDate, List<String>> journalTexts = new HashMap<>();
        for (JournalEntryEntity entry : journalEntryRepository
                .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
                        owner, windowStart, day)) {
            journalTexts.computeIfAbsent(entry.getOccurredOn(), k -> new ArrayList<>())
                    .add(entry.getText());
        }

        List<DetectorInput.GymDay> gymEightWeeks = gatherGymDays(owner, trendStart, day);
        List<DetectorInput.GymDay> gymDays = gymEightWeeks.stream()
                .filter(g -> !g.date().isBefore(windowStart))
                .toList();

        List<DetectorInput.SportPoint> sportSessions = sportSessionRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(owner, windowStart, day)
                .stream()
                .map(this::toSportPoint)
                .toList();

        List<DetectorInput.RunPoint> runsEightWeeks = runSessionLogRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(owner, trendStart, day)
                .stream()
                .map(this::toRunPoint)
                .toList();
        List<DetectorInput.RunPoint> runLogs = runsEightWeeks.stream()
                .filter(r -> !r.date().isBefore(windowStart))
                .toList();

        List<DetectorInput.SleepPoint> sleepPoints = sleepLogRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(owner, windowStart, day)
                .stream()
                .map(this::toSleepPoint)
                .toList();

        DetectorInput.MesoContext meso = gatherMeso(owner, windowStart, day);

        return new DetectorInput(day, mealDates, checkinCounts, weights, journalTexts,
                gymDays, sportSessions, runLogs, sleepPoints, meso,
                new DetectorInput.TrendWindow(runsEightWeeks, gymEightWeeks,
                        mealDays, waterDays, null, List.of(), null));
    }

    /**
     * Gym instance days in {@code [from, to]}, each with per-exercise aggregates. ONE strategy
     * (implementer's choice per the round-1 brief): for every completed instance, pull ALL its
     * logged sets in one call ({@code findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc}) and
     * split working-vs-skipped in memory, rather than the batched working-only finder plus a
     * separate skip count — this keeps the working/skipped bookkeeping in a single pass per
     * instance. The number of gym instances inside an 8-week window is small, so the extra
     * per-instance round trip is acceptable for a nightly job.
     */
    private List<DetectorInput.GymDay> gatherGymDays(UUID owner, LocalDate from, LocalDate to) {
        List<WorkoutSessionEntity> instances = workoutSessionRepository
                .findDoneInstancesBetween(owner, from, to);
        if (instances.isEmpty()) {
            return List.of();
        }
        List<UUID> sessionIds = instances.stream().map(WorkoutSessionEntity::getId).toList();
        Map<UUID, Map<UUID, ExerciseFeedbackEntity>> feedbackBySessionAndExercise = new HashMap<>();
        for (ExerciseFeedbackEntity fb : exerciseFeedbackRepository
                .findByCreatedByAndWorkoutSessionIdIn(owner, sessionIds)) {
            feedbackBySessionAndExercise
                    .computeIfAbsent(fb.getWorkoutSessionId(), k -> new HashMap<>())
                    .put(fb.getExerciseId(), fb);
        }

        List<DetectorInput.GymDay> gymDays = new ArrayList<>();
        for (WorkoutSessionEntity instance : instances) {
            List<ExerciseSetEntity> sets = exerciseSetRepository
                    .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(owner, instance.getId());
            if (sets.isEmpty()) {
                gymDays.add(new DetectorInput.GymDay(instance.getDate(), List.of()));
                continue;
            }
            Map<UUID, List<ExerciseSetEntity>> byExercise = new LinkedHashMap<>();
            for (ExerciseSetEntity s : sets) {
                byExercise.computeIfAbsent(s.getExerciseId(), k -> new ArrayList<>()).add(s);
            }
            Map<UUID, String> exerciseNames = exerciseRepository.findAllById(byExercise.keySet())
                    .stream()
                    .filter(e -> owner.equals(e.getCreatedBy()))
                    .collect(java.util.stream.Collectors.toMap(ExerciseEntity::getId, ExerciseEntity::getName));

            Map<UUID, ExerciseFeedbackEntity> feedbackByExercise = feedbackBySessionAndExercise
                    .getOrDefault(instance.getId(), Map.of());

            List<DetectorInput.ExerciseWork> works = new ArrayList<>();
            for (Map.Entry<UUID, List<ExerciseSetEntity>> entry : byExercise.entrySet()) {
                String name = exerciseNames.get(entry.getKey());
                if (name == null) {
                    continue; // not owned (or deleted) — skip rather than surface a stray name
                }
                List<ExerciseSetEntity> all = entry.getValue();
                List<ExerciseSetEntity> working = all.stream()
                        .filter(s -> "working".equals(s.getKind()) && !s.isSkipped())
                        .sorted(Comparator.comparing(ExerciseSetEntity::getSetIndex))
                        .toList();
                int skippedSets = (int) all.stream().filter(ExerciseSetEntity::isSkipped).count();
                List<DetectorInput.SetPoint> setPoints = working.stream()
                        .map(s -> new DetectorInput.SetPoint(s.getSetIndex(), s.getWeightKg(), s.getReps(),
                                s.getRir(), s.getTargetWeightKg(), s.getTargetReps(), s.isSkipped()))
                        .toList();
                ExerciseFeedbackEntity fb = feedbackByExercise.get(entry.getKey());
                works.add(new DetectorInput.ExerciseWork(name, working.size(), skippedSets, setPoints,
                        fb != null ? fb.getJointPain() : null,
                        fb != null ? fb.getPump() : null,
                        fb != null ? fb.getWorkload() : null));
            }
            gymDays.add(new DetectorInput.GymDay(instance.getDate(), works));
        }
        return gymDays;
    }

    private DetectorInput.MesoContext gatherMeso(UUID owner, LocalDate windowStart, LocalDate day) {
        List<MesocycleEntity> activeMesos = mesocycleRepository
                .findByCreatedByAndStatusAndDeletedFalse(owner, "active");
        if (activeMesos.isEmpty()) {
            return null;
        }
        MesocycleEntity meso = activeMesos.get(0);
        Set<DayOfWeek> plannedDays = gymScheduleSlotRepository
                .findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(owner)
                .stream()
                .map(slot -> DayOfWeek.of(slot.getDayOfWeek() + 1))
                .collect(java.util.stream.Collectors.toSet());
        Set<LocalDate> doneDays = new HashSet<>(
                workoutSessionRepository.findMesoDoneInstanceDates(owner, windowStart, day));
        return new DetectorInput.MesoContext(meso.getTitle(), meso.getCurrentWeek(), meso.getWeeks(),
                isDeloadPhase(meso), plannedDays, doneDays);
    }

    /** Mirrors {@code VolumeProgressionService.isDeloadPhase}: phaseCurve[currentWeek-1], bounds-checked. */
    private boolean isDeloadPhase(MesocycleEntity meso) {
        List<String> phaseCurve = meso.getPhaseCurve();
        int idx = meso.getCurrentWeek() - 1;
        if (phaseCurve == null || idx < 0 || idx >= phaseCurve.size()) {
            return false;
        }
        return PHASE_DELOAD.equalsIgnoreCase(phaseCurve.get(idx));
    }

    private DetectorInput.SportPoint toSportPoint(SportSessionEntity s) {
        return new DetectorInput.SportPoint(
                s.getDate(), s.getSport(), s.getRpe(), s.getShoulderStrain(), s.getJumpCount(), s.getIntensity());
    }

    private DetectorInput.RunPoint toRunPoint(RunSessionLogEntity r) {
        return new DetectorInput.RunPoint(
                r.getDate(), r.getRpeActual(), r.getHrRecoverySec(), r.getCompletedRounds());
    }

    private DetectorInput.SleepPoint toSleepPoint(SleepLogEntity s) {
        return new DetectorInput.SleepPoint(s.getDate(), s.getQuality(), s.getDurationH(), s.getAwakenings());
    }

    /**
     * One meal-aggregate row per day that has at least one logged meal. Macros are sums over the
     * frozen item snapshots; the NOVA-4 share is kcal-weighted over the LINE level
     * ({@code MealItemEntity.snapshotNova}) rather than the meal-level {@code breakdown.nova}
     * envelope, because {@code breakdown} can be NULL on legacy/manual meals while the line
     * snapshots are written for every line (round-2 spec §4.1). Targets mirror
     * {@code FuelDayService}'s precedence exactly: the active goal's week segment prescribes kcal
     * and protein, everything else comes from the config.
     */
    private List<DetectorInput.MealDayPoint> gatherMealDays(UUID owner, LocalDate from, LocalDate to) {
        List<MealEntity> meals = mealRepository.findWithItemsBetween(owner, from, to);
        if (meals.isEmpty()) {
            return List.of();
        }
        GoalEntity goal = goalRepository.findByCreatedByAndStatusAndDeletedFalse(owner, "active")
                .stream().findFirst().orElse(null);

        Map<LocalDate, List<MealEntity>> byDate = new LinkedHashMap<>();
        for (MealEntity m : meals) {
            byDate.computeIfAbsent(m.getMealDate(), k -> new ArrayList<>()).add(m);
        }
        List<DetectorInput.MealDayPoint> out = new ArrayList<>();
        for (Map.Entry<LocalDate, List<MealEntity>> e : byDate.entrySet()) {
            LocalDate date = e.getKey();
            BigDecimal kcal = BigDecimal.ZERO;
            BigDecimal protein = BigDecimal.ZERO;
            BigDecimal carbs = BigDecimal.ZERO;
            BigDecimal fat = BigDecimal.ZERO;
            BigDecimal classifiedKcal = BigDecimal.ZERO;
            BigDecimal nova4Kcal = BigDecimal.ZERO;
            List<DetectorInput.MealPoint> mealPoints = new ArrayList<>();
            for (MealEntity m : e.getValue()) {
                BigDecimal mealKcal = BigDecimal.ZERO;
                Integer dominantNova = null;
                BigDecimal dominantKcal = BigDecimal.ZERO;
                for (MealItemEntity item : m.getItems()) {
                    BigDecimal lineKcal = nz(item.getSnapshotKcal());
                    mealKcal = mealKcal.add(lineKcal);
                    protein = protein.add(nz(item.getSnapshotProteinG()));
                    carbs = carbs.add(nz(item.getSnapshotCarbsG()));
                    fat = fat.add(nz(item.getSnapshotFatG()));
                    if (item.getSnapshotNova() != null) {
                        classifiedKcal = classifiedKcal.add(lineKcal);
                        if (item.getSnapshotNova() >= 4) {
                            nova4Kcal = nova4Kcal.add(lineKcal);
                        }
                        if (lineKcal.compareTo(dominantKcal) > 0) {
                            dominantKcal = lineKcal;
                            dominantNova = item.getSnapshotNova().intValue();
                        }
                    }
                }
                kcal = kcal.add(mealKcal);
                mealPoints.add(new DetectorInput.MealPoint(
                        m.getSlot(),
                        LocalTime.from(m.getLoggedAt().atZone(ZoneId.systemDefault())),
                        mealKcal, dominantNova));
            }
            BigDecimal coverage = kcal.signum() == 0 ? null
                    : classifiedKcal.divide(kcal, 4, RoundingMode.HALF_UP);
            BigDecimal nova4Share = classifiedKcal.signum() == 0 ? null
                    : nova4Kcal.divide(classifiedKcal, 4, RoundingMode.HALF_UP);
            out.add(new DetectorInput.MealDayPoint(date, kcal, protein, carbs, fat,
                    nova4Share, coverage, kcalTarget(goal, date), proteinTarget(goal, date),
                    List.copyOf(mealPoints)));
        }
        return List.copyOf(out);
    }

    /** {@code FuelDayService#targetSet} precedence: goal-week segment kcal, else config. */
    private BigDecimal kcalTarget(GoalEntity goal, LocalDate date) {
        GoalPrescriptionJson.Segment seg = segmentFor(goal, date);
        return BigDecimal.valueOf(seg != null && seg.kcal() != null ? seg.kcal() : nutritionTargets.kcal());
    }

    /** {@code FuelDayService#targetSet} precedence: goal-week segment protein, else config. */
    private BigDecimal proteinTarget(GoalEntity goal, LocalDate date) {
        GoalPrescriptionJson.Segment seg = segmentFor(goal, date);
        return BigDecimal.valueOf(seg != null && seg.proteinG() != null ? seg.proteinG() : nutritionTargets.p());
    }

    private GoalPrescriptionJson.Segment segmentFor(GoalEntity goal, LocalDate date) {
        if (goal == null || goal.getStartDate() == null) {
            return null;
        }
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), date) / 7 + 1;
        return GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
    }

    /** Per-day water totals; a day with no log is ABSENT, never a 0 ml row. */
    private List<DetectorInput.WaterDayPoint> gatherWaterDays(UUID owner, LocalDate from, LocalDate to) {
        List<DetectorInput.WaterDayPoint> out = new ArrayList<>();
        for (Object[] row : waterLogRepository.sumsBetween(owner, from, to)) {
            out.add(new DetectorInput.WaterDayPoint((LocalDate) row[0],
                    ((Number) row[1]).intValue(), nutritionTargets.water()));
        }
        return List.copyOf(out);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
