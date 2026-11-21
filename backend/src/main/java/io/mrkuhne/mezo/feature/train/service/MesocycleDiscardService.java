package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoTemplateRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code POST /api/train/mesocycles/{id}/discard} (mezo-r36n9.113): „Mégsem, eldobom" — throws away a block that
 * was never trained, as if it had not been started. Allowed for an owned planned/active block with no logged
 * session (no instance row of any status); soft-deletes the run, its template days, their exercise rows and its
 * volume rows (each entity's own soft delete), and the template it was started from when that template has no
 * other runs. Unlike a close it computes no report, publishes no {@code MesocycleClosed} and calls no AI.
 */
@Service
@RequiredArgsConstructor
public class MesocycleDiscardService {

    static final String HAS_LOGS = "TRAIN_MESO_DISCARD_HAS_LOGS";

    private final MesocycleRepository mesocycleRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final MesoTemplateRepository templateRepository;

    @Transactional
    public void discard(UUID createdBy, UUID id) {
        MesocycleEntity run = OwnershipGuard.ownedOrThrow(mesocycleRepository.findById(id), createdBy);
        if ("archived".equals(run.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error(ExerciseTechniqueService.RUN_NOT_EDITABLE).build(), HttpStatus.CONFLICT);
        }
        List<WorkoutSessionEntity> sessions = workoutSessionRepository
            .findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(createdBy, List.of(id));
        if (sessions.stream().anyMatch(s -> s.getTemplateSessionId() != null)) {
            throw new SystemRuntimeErrorException(SystemMessage.error(HAS_LOGS).build(), HttpStatus.CONFLICT);
        }
        List<ExerciseEntity> exercises = sessions.isEmpty() ? List.of() : exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(createdBy,
                sessions.stream().map(WorkoutSessionEntity::getId).toList());
        exerciseRepository.deleteAll(exercises);
        workoutSessionRepository.deleteAll(sessions);
        volumeLogRepository.deleteAll(volumeLogRepository.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(createdBy,
            List.of(id)));
        UUID templateId = run.getTemplateId();
        if (templateId != null
                && mesocycleRepository.countByTemplateIdAndCreatedByAndDeletedFalse(templateId, createdBy) <= 1) {
            templateRepository.findByIdAndCreatedByAndDeletedFalse(templateId, createdBy)
                .ifPresent(templateRepository::delete);
        }
        mesocycleRepository.delete(run);
    }
}
