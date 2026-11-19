package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseDiscomfortEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseDiscomfortRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.techcore.persistence.OwnershipGuard;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The swap-time "nem esik jól" note (mezo-r36n9.66, spec §6.1): remembered per exercise IDENTITY and day, so
 * the substitute ranker can steer away from it for {@code recordWindowDays}. Idempotent per day; the day is
 * the active workout's date.
 */
@Service
@RequiredArgsConstructor
public class ExerciseDiscomfortService {

    private final ExerciseDiscomfortRepository repository;
    private final ExerciseRepository exerciseRepository;
    private final WorkoutExerciseChangeService workoutExerciseChangeService;

    @Transactional
    public void mark(UUID createdBy, UUID workoutId, UUID exerciseId) {
        WorkoutSessionEntity instance = workoutExerciseChangeService.activeInstanceOrThrow(createdBy, workoutId);
        ExerciseEntity row = rowOrThrow(createdBy, instance, exerciseId);
        String key = ExerciseHistoryResolver.identityKey(row);
        if (repository.findByCreatedByAndIdentityKeyAndNotedOn(createdBy, key, instance.getDate()).isPresent()) {
            return;
        }
        ExerciseDiscomfortEntity e = new ExerciseDiscomfortEntity();
        e.setCreatedBy(createdBy); // server-side from principal, never from client
        e.setIdentityKey(key);
        e.setCatalogId(row.getCatalogId());
        e.setNotedOn(instance.getDate());
        repository.save(e);
    }

    /** Removes the workout day's note only — older records keep counting. */
    @Transactional
    public void clear(UUID createdBy, UUID workoutId, UUID exerciseId) {
        WorkoutSessionEntity instance = workoutExerciseChangeService.activeInstanceOrThrow(createdBy, workoutId);
        ExerciseEntity row = rowOrThrow(createdBy, instance, exerciseId);
        repository.findByCreatedByAndIdentityKeyAndNotedOn(
            createdBy, ExerciseHistoryResolver.identityKey(row), instance.getDate())
            .ifPresent(repository::delete);
    }

    /** The exercise row must be the user's own and belong to this instance or its template day. */
    private ExerciseEntity rowOrThrow(UUID createdBy, WorkoutSessionEntity instance, UUID exerciseId) {
        return exerciseRepository.findById(exerciseId)
            .filter(e -> createdBy.equals(e.getCreatedBy())
                && (instance.getTemplateSessionId().equals(e.getWorkoutSessionId())
                    || instance.getId().equals(e.getWorkoutSessionId())))
            .orElseThrow(OwnershipGuard::notFound);
    }
}
