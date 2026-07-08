package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.ExerciseSetResponse;
import io.mrkuhne.mezo.api.dto.LastWeekRef;
import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.WorkoutFeedbackInput;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.WorkoutStartRequest;
import io.mrkuhne.mezo.api.dto.WorkoutSummaryResponse;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.HypertrophyDriveGate;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.progression.ProgressionGate;
import io.mrkuhne.mezo.feature.progression.gym.GymSignal;
import io.mrkuhne.mezo.feature.train.signal.GymSignalCalculator;
import io.mrkuhne.mezo.feature.progression.mapper.LevelUpResultMapper;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Workout-execution slice service (T2): today's workout context, instance start/resume, set
 * logging, RP feedback, finish. Template rows in {@code workout_session} are date-less with
 * {@code templateSessionId == null}; instances carry {@code date}, {@code status} and the
 * template back-link. All finders are scoped by {@code createdBy}; child writes verify the
 * parent chain belongs to the caller. Per house rule (spring_patterns.md) only the write
 * methods carry method-level {@code @Transactional}.
 */
@Service
@RequiredArgsConstructor
public class WorkoutService {

    /** DayOfWeek (MONDAY..SUNDAY) → the HU day labels the frontend's DAY_ORDER uses. */
    public static final List<String> HU_DAY_LABELS =
        List.of("Hét", "Kedd", "Sze", "Csü", "Pén", "Szo", "Vas");

    private final MesocycleRepository mesocycleRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseFeedbackRepository exerciseFeedbackRepository;
    private final ExerciseCatalogRepository exerciseCatalogRepository;
    private final TrainMapper mapper;
    // Progression collaborators (T6): the gym finish awards XP behind the feature switch. The gate
    // bean exists ONLY when mezo.feature.progression.enabled=true, so an absent provider ⇔ switch off.
    private final GymSignalCalculator gymSignalCalculator;
    private final ProgressionService progressionService;
    private final LevelUpResultMapper levelUpResultMapper;
    private final ObjectProvider<ProgressionGate> progressionGate;
    // Hypertrophy Drive (P1): the recommendation engine + its feature gate. The gate bean exists ONLY
    // when mezo.feature.hypertrophy-drive.enabled=true, so an absent provider ⇔ switch off (mirrors
    // progressionGate); off ⇒ getToday attaches no prescribedSets and the FE falls back to the logger.
    private final SetRecommendationService setRecommendationService;
    private final ObjectProvider<HypertrophyDriveGate> hypertrophyGate;

    public WorkoutTodayResponse getToday(UUID createdBy) {
        WorkoutTodayResponse empty = new WorkoutTodayResponse();
        empty.setWeekDoneDates(List.of());
        MesocycleEntity activeMeso = mesocycleRepository
            .findByCreatedByAndStatusAndDeletedFalse(createdBy, "active")
            .stream().findFirst().orElse(null);
        if (activeMeso == null) {
            return empty;
        }
        // Gym done-state signal: this week's instance dates with >=1 logged set. Computed
        // regardless of whether today is a gym day, so the weekly rows can mark PAST done days.
        List<LocalDate> weekDoneDates = doneDatesThisWeek(createdBy);
        empty.setWeekDoneDates(weekDoneDates);
        String todayLabel = HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        WorkoutSessionEntity day = workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(activeMeso.getId()))
            .stream()
            .filter(s -> s.getTemplateSessionId() == null && todayLabel.equals(s.getDayLabel()))
            .findFirst().orElse(null);
        if (day == null) {
            return empty;
        }
        List<ExerciseEntity> exercises = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy, List.of(day.getId()));
        if (exercises.isEmpty()) {
            return empty; // rest day
        }
        Map<UUID, LastWeekRef> lastWeek = lastWeekRefs(createdBy, day.getId());
        // Demo videos: one batched catalog fetch for the day's linked exercises (catalog_id →
        // video_url), never per-exercise. Map keyed by catalog id; nulls filtered out.
        List<UUID> catalogIds = exercises.stream()
            .map(ExerciseEntity::getCatalogId).filter(java.util.Objects::nonNull).toList();
        Map<UUID, String> videoByCatalog = catalogIds.isEmpty() ? Map.of()
            : exerciseCatalogRepository.findByIdIn(catalogIds).stream()
                .filter(c -> c.getVideoUrl() != null)
                .collect(Collectors.toMap(ExerciseCatalogEntity::getId, ExerciseCatalogEntity::getVideoUrl));
        WorkoutSessionEntity open = workoutSessionRepository
            .findFirstByCreatedByAndTemplateSessionIdAndStatusOrderByDateDescCreatedAtDesc(
                createdBy, day.getId(), "active")
            .orElse(null);
        return WorkoutTodayResponse.builder()
            .templateSessionId(day.getId())
            .dayLabel(day.getDayLabel())
            .title(day.getType())
            .durationEst(day.getDurationEst())
            .exercises(exercises.stream().map(e -> {
                TodayExercise t = mapper.toTodayExercise(e);
                t.setLastWeek(lastWeek.get(e.getId()));
                if (e.getCatalogId() != null) {
                    t.setVideoUrl(videoByCatalog.get(e.getCatalogId()));
                }
                if (hypertrophyGate.getIfAvailable() != null) {
                    Prescription p = setRecommendationService.prescribe(createdBy, e, day.getId());
                    t.setPrescribedSets(p.sets());
                    t.setRationale(p.rationale());
                }
                return t;
            }).toList())
            .openWorkout(open != null ? toInstanceResponse(createdBy, open) : null)
            .weekDoneDates(weekDoneDates)
            .build();
    }

    /**
     * Workout instances with logged work (>=1 non-skipped set) in the inclusive date range, date
     * ascending — the same "done" semantics as {@link #doneDatesThisWeek}. Read method: no
     * {@code @Transactional}, matching {@link #getToday}.
     */
    public List<WorkoutSummaryResponse> listWorkouts(UUID createdBy, LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw new SystemRuntimeErrorException(SystemMessage.error("TRAIN_INVALID_DATE_RANGE").build());
        }
        return workoutSessionRepository.findDoneInstancesBetween(createdBy, from, to).stream()
            .map(mapper::toWorkoutSummary)
            .toList();
    }

    /** Dates (this Mon–Sun week) with a gym instance carrying >=1 logged set — gym done-state. */
    private List<LocalDate> doneDatesThisWeek(UUID createdBy) {
        LocalDate today = LocalDate.now();
        LocalDate monday = today.minusDays(today.getDayOfWeek().getValue() - 1L);
        return workoutSessionRepository.findDoneInstanceDates(createdBy, monday, monday.plusDays(6));
    }

    /**
     * "Last week" reference per exercise: the TOP set (max weight, ties broken by insertion order)
     * of the most recent COMPLETED instance of the same template day.
     */
    private Map<UUID, LastWeekRef> lastWeekRefs(UUID createdBy, UUID templateSessionId) {
        return workoutSessionRepository
            .findFirstByCreatedByAndTemplateSessionIdAndStatusOrderByDateDescCreatedAtDesc(
                createdBy, templateSessionId, "completed")
            .map(prev -> exerciseSetRepository
                .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, prev.getId()).stream()
                .filter(s -> "working".equals(s.getKind())
                    && s.getWeightKg() != null && s.getReps() != null && s.getRir() != null)
                .collect(Collectors.toMap(ExerciseSetEntity::getExerciseId, this::toLastWeekRef,
                    (a, b) -> b.getWeightKg().compareTo(a.getWeightKg()) > 0 ? b : a)))
            .orElse(Map.of());
    }

    private LastWeekRef toLastWeekRef(ExerciseSetEntity set) {
        return LastWeekRef.builder()
            .weightKg(set.getWeightKg())
            .reps(set.getReps())
            .rir(set.getRir())
            .build();
    }

    @Transactional
    public WorkoutInstanceResponse startWorkout(UUID createdBy, WorkoutStartRequest req) {
        WorkoutSessionEntity template = workoutSessionRepository.findById(req.getTemplateSessionId())
            .filter(s -> createdBy.equals(s.getCreatedBy()) && s.getTemplateSessionId() == null)
            .orElseThrow(WorkoutService::notFound);
        // Spec rule: an open instance is resumed, never duplicated.
        WorkoutSessionEntity open = workoutSessionRepository
            .findFirstByCreatedByAndTemplateSessionIdAndStatusOrderByDateDescCreatedAtDesc(
                createdBy, template.getId(), "active")
            .orElse(null);
        if (open != null) {
            return toInstanceResponse(createdBy, open);
        }
        WorkoutSessionEntity instance = new WorkoutSessionEntity();
        instance.setCreatedBy(createdBy); // server-side ownership — never from the client
        instance.setMesocycleId(template.getMesocycleId());
        instance.setTemplateSessionId(template.getId());
        instance.setDayLabel(template.getDayLabel());
        instance.setType(template.getType());
        instance.setMuscle(template.getMuscle());
        instance.setMuscleAccent(template.isMuscleAccent());
        instance.setDurationEst(template.getDurationEst());
        instance.setOrderIndex(template.getOrderIndex());
        instance.setDate(LocalDate.now());
        instance.setStatus("active");
        return toInstanceResponse(createdBy, workoutSessionRepository.save(instance));
    }

    @Transactional
    public ExerciseSetResponse logSet(UUID createdBy, UUID workoutId, SetLogRequest req) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        if (!"active".equals(instance.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_WORKOUT_NOT_ACTIVE").build(), HttpStatus.CONFLICT);
        }
        // The exercise must hang off the instance's template day — child writes verify the chain.
        exerciseRepository.findById(req.getExerciseId())
            .filter(e -> createdBy.equals(e.getCreatedBy())
                && instance.getTemplateSessionId().equals(e.getWorkoutSessionId()))
            .orElseThrow(WorkoutService::notFound);
        ExerciseSetEntity set = new ExerciseSetEntity();
        set.setCreatedBy(createdBy);
        set.setExerciseId(req.getExerciseId());
        set.setWorkoutSessionId(instance.getId());
        set.setSetIndex(req.getSetIndex());
        set.setWeightKg(req.getWeightKg());
        set.setReps(req.getReps());
        set.setRir(req.getRir());
        set.setSide(req.getSide());
        set.setNote(req.getNote());
        set.setKind(req.getKind() != null ? req.getKind() : "working");
        set.setDoneAt(Instant.now());
        return mapper.toSetResponse(exerciseSetRepository.save(set));
    }

    /**
     * Skip a whole exercise in an active instance: persist a skip-marker {@link ExerciseSetEntity}
     * (skipped=true, no performance fields). Mirrors {@link #logSet}'s guards — owned active
     * instance + exercise must hang off the instance's template day. A skip marker is NOT a logged
     * set: it carries the next free set index but does not flip the gym done-state (see
     * {@link WorkoutSessionRepository#findDoneInstanceDates}).
     */
    @Transactional
    public void skipExercise(UUID createdBy, UUID workoutId, UUID exerciseId) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        if (!"active".equals(instance.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("TRAIN_WORKOUT_NOT_ACTIVE").build(), HttpStatus.CONFLICT);
        }
        // The exercise must hang off the instance's template day — child writes verify the chain.
        exerciseRepository.findById(exerciseId)
            .filter(e -> createdBy.equals(e.getCreatedBy())
                && instance.getTemplateSessionId().equals(e.getWorkoutSessionId()))
            .orElseThrow(WorkoutService::notFound);
        // Idempotent: a skip marker already present for this (instance, exercise) is a no-op
        // (mirrors saveFeedback's find-or-create intent — no duplicate marker rows).
        List<ExerciseSetEntity> instanceSets = exerciseSetRepository
            .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instance.getId());
        boolean alreadySkipped = instanceSets.stream()
            .anyMatch(s -> s.getExerciseId().equals(exerciseId) && s.isSkipped());
        if (alreadySkipped) {
            return;
        }
        int nextIndex = (int) instanceSets.stream()
            .filter(s -> s.getExerciseId().equals(exerciseId))
            .count();
        ExerciseSetEntity marker = new ExerciseSetEntity();
        marker.setCreatedBy(createdBy); // server-side ownership — never from the client
        marker.setExerciseId(exerciseId);
        marker.setWorkoutSessionId(instance.getId());
        marker.setSetIndex(nextIndex);
        marker.setSkipped(true); // marker, not a logged set: perf fields stay null
        marker.setDoneAt(Instant.now());
        exerciseSetRepository.save(marker);
    }

    @Transactional
    public void saveFeedback(UUID createdBy, UUID workoutId, List<WorkoutFeedbackInput> items) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        // Batch: the template day's exercises + this instance's existing feedback rows are each
        // loaded ONCE (was findById + findBy... + save per item — 2N+N round-trips).
        Set<UUID> dayExerciseIds = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
                createdBy, List.of(instance.getTemplateSessionId())).stream()
            .map(ExerciseEntity::getId)
            .collect(Collectors.toSet());
        Map<UUID, ExerciseFeedbackEntity> byExercise = exerciseFeedbackRepository
            .findByCreatedByAndWorkoutSessionId(createdBy, instance.getId()).stream()
            .collect(Collectors.toMap(ExerciseFeedbackEntity::getExerciseId, f -> f));
        List<ExerciseFeedbackEntity> rows = new ArrayList<>(items.size());
        for (WorkoutFeedbackInput in : items) {
            // The exercise must hang off the instance's template day — child writes verify the chain.
            if (!dayExerciseIds.contains(in.getExerciseId())) {
                throw notFound();
            }
            // Upsert per (instance, exercise) — the DB UNIQUE backs this invariant.
            ExerciseFeedbackEntity row = byExercise.computeIfAbsent(in.getExerciseId(), exId -> {
                ExerciseFeedbackEntity f = new ExerciseFeedbackEntity();
                f.setCreatedBy(createdBy);
                f.setWorkoutSessionId(instance.getId());
                f.setExerciseId(exId);
                return f;
            });
            row.setPump(in.getPump());
            row.setJointPain(in.getJointPain());
            row.setWorkload(in.getWorkload());
            rows.add(row);
        }
        exerciseFeedbackRepository.saveAll(rows);
    }

    /**
     * Set the durable per-exercise note (F4) — preloaded on the next session via {@link #getToday}.
     * Owner-scoped write; a foreign or missing exercise is a 404. A null/blank note clears it.
     */
    @Transactional
    public void saveExerciseNote(UUID createdBy, UUID exerciseId, String note) {
        ExerciseEntity exercise = exerciseRepository.findById(exerciseId)
            .filter(e -> createdBy.equals(e.getCreatedBy()))
            .orElseThrow(WorkoutService::notFound);
        exercise.setNote(note);
        exerciseRepository.save(exercise);
    }

    @Transactional
    public WorkoutInstanceResponse finishWorkout(UUID createdBy, UUID workoutId) {
        WorkoutSessionEntity instance = ownedInstanceOrThrow(createdBy, workoutId);
        if ("active".equals(instance.getStatus())) {
            instance.setStatus("completed"); // dirty-checked, flushed at commit
        }
        WorkoutInstanceResponse base = toInstanceResponse(createdBy, instance);
        // Progression runs ONLY when the feature switch is on (gate bean present) and only here in
        // finishWorkout — never via the shared toInstanceResponse, so start/resume stay levelUp-free.
        // Atomic with the completion (same @Transactional); applyGym is idempotent on the instance id,
        // so a re-finish returns the stored payload without double-awarding.
        if (progressionGate.getIfAvailable() != null) {
            GymSignal signal = gymSignalCalculator.compute(createdBy, instance.getId());
            base.setLevelUp(levelUpResultMapper.toDto(progressionService.applyGym(createdBy, signal)));
        }
        return base;
    }

    /** Instance gate: owned AND an instance row (template rows are not loggable targets). */
    private WorkoutSessionEntity ownedInstanceOrThrow(UUID createdBy, UUID workoutId) {
        return workoutSessionRepository.findById(workoutId)
            .filter(s -> createdBy.equals(s.getCreatedBy()) && s.getTemplateSessionId() != null)
            .orElseThrow(WorkoutService::notFound);
    }

    private WorkoutInstanceResponse toInstanceResponse(UUID createdBy, WorkoutSessionEntity instance) {
        return WorkoutInstanceResponse.builder()
            .id(instance.getId())
            .templateSessionId(instance.getTemplateSessionId())
            .date(instance.getDate())
            .status(WorkoutInstanceResponse.StatusEnum.fromValue(instance.getStatus()))
            .sets(exerciseSetRepository
                .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(createdBy, instance.getId())
                .stream().map(mapper::toSetResponse).toList())
            .build();
    }

    /** Ownership gate: a missing row and a foreign row are indistinguishable to the caller (404). */
    private static SystemRuntimeErrorException notFound() {
        return OwnershipGuard.notFound();
    }
}
