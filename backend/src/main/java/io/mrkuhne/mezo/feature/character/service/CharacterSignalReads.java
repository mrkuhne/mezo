package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.character.detector.DetectorInput;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
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
import java.time.DayOfWeek;
import java.time.LocalDate;
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

    public DetectorInput gather(UUID owner, LocalDate day) {
        LocalDate windowStart = day.minusDays(WINDOW_DAYS - 1);
        LocalDate trendStart = day.minusWeeks(TREND_WEEKS).plusDays(1);

        Set<LocalDate> mealDates = new HashSet<>();
        Map<LocalDate, Integer> checkinCounts = new HashMap<>();
        for (LocalDate d = windowStart; !d.isAfter(day); d = d.plusDays(1)) {
            if (!mealRepository
                    .findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(owner, d)
                    .isEmpty()) {
                mealDates.add(d);
            }
            int count = checkInRepository.findByCreatedByAndDateOrderBySlotTime(owner, d).size();
            checkinCounts.put(d, count);
        }

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
                        List.of(), List.of(), null, List.of(), null));
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
}
