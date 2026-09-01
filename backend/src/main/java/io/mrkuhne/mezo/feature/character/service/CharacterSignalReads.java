package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.character.detector.DetectorInput;
import io.mrkuhne.mezo.feature.fuel.entity.ProtocolEntity;
import io.mrkuhne.mezo.feature.fuel.entity.ProtocolItemEntity;
import io.mrkuhne.mezo.feature.fuel.entity.SupplementIntakeEntity;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolItemRepository;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolRepository;
import io.mrkuhne.mezo.feature.fuel.repository.SupplementIntakeRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.repository.WaterLogRepository;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle;
import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
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
import java.util.TreeMap;
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
    private final ProtocolRepository protocolRepository;
    private final ProtocolItemRepository protocolItemRepository;
    private final SupplementIntakeRepository supplementIntakeRepository;
    private final PantryItemRepository pantryItemRepository;
    private final MedicationRepository medicationRepository;
    private final MedicationCycleService medicationCycleService;

    public DetectorInput gather(UUID owner, LocalDate day) {
        LocalDate windowStart = day.minusDays(WINDOW_DAYS - 1);
        LocalDate trendStart = day.minusWeeks(TREND_WEEKS).plusDays(1);

        List<DetectorInput.MealDayPoint> mealDays = gatherMealDays(owner, trendStart, day);
        Set<LocalDate> mealDates = mealDays.stream()
                .map(DetectorInput.MealDayPoint::date)
                .filter(d -> !d.isBefore(windowStart))
                .collect(java.util.stream.Collectors.toCollection(HashSet::new));

        List<CheckInEntity> checkins =
                checkInRepository.findByCreatedByAndDeletedFalseAndDateBetween(owner, trendStart, day);
        Map<LocalDate, Integer> checkinCounts = new HashMap<>();
        for (LocalDate d = windowStart; !d.isAfter(day); d = d.plusDays(1)) {
            checkinCounts.put(d, 0); // an entry for EVERY day of the 14-day window, zeros included
        }
        for (CheckInEntity c : checkins) {
            if (!c.getDate().isBefore(windowStart) && !c.getDate().isAfter(day)) {
                checkinCounts.merge(c.getDate(), 1, Integer::sum);
            }
        }
        List<DetectorInput.CheckinDayPoint> checkinDays = toCheckinDays(checkins);

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

        DetectorInput.StackContext stack = gatherStack(owner, trendStart, day);
        DetectorInput.MedContext medCycle = gatherMedCycle(owner, trendStart, day);

        return new DetectorInput(day, mealDates, checkinCounts, weights, journalTexts,
                gymDays, sportSessions, runLogs, sleepPoints, meso,
                new DetectorInput.TrendWindow(runsEightWeeks, gymEightWeeks,
                        mealDays, waterDays, stack, checkinDays, medCycle,
                        List.of(), List.of(), List.of(), List.of(), null, List.of(), List.of(),
                        List.of()));
    }

    /** Per-day means of the day's logged check-in slots; a scale nobody logged stays null. */
    private List<DetectorInput.CheckinDayPoint> toCheckinDays(List<CheckInEntity> checkins) {
        Map<LocalDate, List<CheckInEntity>> byDate = new TreeMap<>();
        for (CheckInEntity c : checkins) {
            byDate.computeIfAbsent(c.getDate(), k -> new ArrayList<>()).add(c);
        }
        List<DetectorInput.CheckinDayPoint> out = new ArrayList<>();
        for (Map.Entry<LocalDate, List<CheckInEntity>> e : byDate.entrySet()) {
            out.add(new DetectorInput.CheckinDayPoint(e.getKey(), e.getValue().size(),
                    mean(e.getValue(), CheckInEntity::getEnergy),
                    mean(e.getValue(), CheckInEntity::getStress),
                    mean(e.getValue(), CheckInEntity::getBody),
                    mean(e.getValue(), CheckInEntity::getMental)));
        }
        return List.copyOf(out);
    }

    private static BigDecimal mean(List<CheckInEntity> rows,
                                   java.util.function.Function<CheckInEntity, Integer> field) {
        int sum = 0;
        int n = 0;
        for (CheckInEntity c : rows) {
            Integer v = field.apply(c);
            if (v != null) {
                sum += v;
                n++;
            }
        }
        return n == 0 ? null : BigDecimal.valueOf(sum).divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP);
    }

    /**
     * The active supplement protocol plus per-day intakes; null when there is no active protocol
     * (absent, never "zero compliance"). The intake finder bounds only BELOW, so the upper bound
     * is applied in memory — the round-1 weight-read precedent for catch-up honesty. Whether an
     * item was EXPECTED on a given day is deliberately NOT decided here: it depends on that day's
     * training, which the detector resolves from {@code trend().gymEightWeeks()} as of two
     * different dates (round-2 spec §4.3). What IS decided here is the item's {@code startedOn} —
     * the one bound the detector cannot derive from the day series alone.
     */
    private DetectorInput.StackContext gatherStack(UUID owner, LocalDate from, LocalDate to) {
        ProtocolEntity protocol = protocolRepository
                .findByCreatedByAndStatusAndDeletedFalse(owner, "active").orElse(null);
        if (protocol == null) {
            return null;
        }
        Map<UUID, String> names = new HashMap<>();
        for (PantryItemEntity p : pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner)) {
            names.put(p.getId(), p.getName());
        }
        List<DetectorInput.StackItem> items = new ArrayList<>();
        for (ProtocolItemEntity pi : protocolItemRepository
                .findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(protocol.getId())) {
            // startedOn bounds compliance BELOW: an item added today was never expected last week,
            // so a day before it must not be scored as a skip (spec §4.3 at the item-day level).
            LocalDate startedOn = pi.getCreatedAt() == null ? null
                    : pi.getCreatedAt().atZone(ZoneId.systemDefault()).toLocalDate();
            items.add(new DetectorInput.StackItem(pi.getPantryItemId(),
                    names.getOrDefault(pi.getPantryItemId(), "ismeretlen kiegészítő"),
                    pi.getSlotKey(), pi.getRestDayFallback(), startedOn));
        }

        Map<LocalDate, Set<UUID>> takenByDate = new TreeMap<>();
        for (SupplementIntakeEntity si : supplementIntakeRepository
                .findByCreatedByAndDeletedFalseAndTakenDateGreaterThanEqualOrderByTakenDateAscTakenAtAsc(
                        owner, from)) {
            if (si.getTakenDate().isAfter(to)) {
                continue; // catch-up upper bound (the finder only bounds below)
            }
            takenByDate.computeIfAbsent(si.getTakenDate(), k -> new HashSet<>())
                    .add(si.getPantryItemId());
        }
        List<DetectorInput.StackDayPoint> days = new ArrayList<>();
        for (Map.Entry<LocalDate, Set<UUID>> e : takenByDate.entrySet()) {
            days.add(new DetectorInput.StackDayPoint(e.getKey(), Set.copyOf(e.getValue())));
        }
        return new DetectorInput.StackContext(List.copyOf(items), List.copyOf(days));
    }

    /**
     * The active medication's cycle projected onto every day of the window, reusing
     * {@link MedicationCycleService} rather than reimplementing the cycle-day formula — that
     * formula must have exactly one home. {@code derive} queries the latest dose at-or-before its
     * own date, so it is catch-up-safe by construction.
     *
     * <p>{@code stale} is the round-2 precision guard: {@code derive} CLAMPS a cycle day when the
     * last dose is older than a full cycle (a deliberate Fuel-UI behaviour), which for covariance
     * would pile weeks of no-dose days into the last bucket. The flag lets the detector drop them.
     *
     * <p>Trade-off, mirroring {@link #gatherGymDays}: {@code derive} is called once per window day,
     * so an 8-week window costs ~56 indexed single-row lookups. That is acceptable for a nightly
     * job, and the alternative — reimplementing the cycle-day formula here over one bulk dose read
     * — would give that formula a second home, which is exactly what this method exists to avoid.
     */
    private DetectorInput.MedContext gatherMedCycle(UUID owner, LocalDate from, LocalDate to) {
        MedicationEntity med = medicationRepository
                .findFirstByCreatedByAndActiveTrueAndDeletedFalse(owner).orElse(null);
        if (med == null || med.getCycle() == null) {
            return null;
        }
        int cycleLength = med.getCycle().cycleLengthDays();
        List<DetectorInput.MedCycleDayPoint> days = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            MedicationCycle cycle = medicationCycleService.derive(owner, med, d);
            if (cycle.cycleDay() == 0 || cycle.lastDoseDate() == null) {
                continue; // honest zero: no dose at or before this day
            }
            // cycle.cycleDay() is CLAMPED, so it is NOT a usable days-since-dose once the clamp
            // bites — recompute the true distance. It MUST use the same day authority `derive`
            // used (the dose's administeredDate column), not a local date re-derived from the
            // dose INSTANT in the server zone: those disagree whenever the server zone differs
            // from the offset the dose was logged in, which shifts `stale` by a day and can hide
            // the dose day from DetectorGates.newDoseData (it requires daysSinceDose == 0).
            int daysSince = (int) ChronoUnit.DAYS.between(cycle.lastDoseDate(), d);
            boolean stale = daysSince + 1 > cycleLength;
            days.add(new DetectorInput.MedCycleDayPoint(d, cycle.cycleDay(), cycle.phaseKey(),
                    daysSince, stale));
        }
        return new DetectorInput.MedContext(cycleLength, List.copyOf(days));
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
