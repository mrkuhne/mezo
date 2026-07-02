package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link ExerciseFeedbackEntity}. Extends {@link JpaRepository} directly (no
 * {@code date} field for the house {@code OwnedRepository} ordering); rows are unique per
 * (workout instance, exercise) and looked up exactly that way for the upsert.
 */
public interface ExerciseFeedbackRepository extends JpaRepository<ExerciseFeedbackEntity, UUID> {

    Optional<ExerciseFeedbackEntity> findByCreatedByAndWorkoutSessionIdAndExerciseId(
        UUID createdBy, UUID workoutSessionId, UUID exerciseId);

    List<ExerciseFeedbackEntity> findByCreatedByAndWorkoutSessionId(UUID createdBy, UUID workoutSessionId);
}
