package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.ExerciseSetResponse;
import io.mrkuhne.mezo.api.dto.SetLogRequest;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.api.dto.WorkoutStartRequest;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.mapper.TrainMapper;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
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
    static final List<String> HU_DAY_LABELS =
        List.of("Hét", "Kedd", "Sze", "Csü", "Pén", "Szo", "Vas");

    private final MesocycleRepository mesocycleRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final TrainMapper mapper;

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
        set.setDoneAt(Instant.now());
        return mapper.toSetResponse(exerciseSetRepository.save(set));
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
        return new SystemRuntimeErrorException(
            SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
