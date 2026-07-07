package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link ExerciseSetEntity}. Extends {@link JpaRepository} directly rather than the
 * house {@code OwnedRepository}, whose {@code findAllOwned} JPQL orders by a {@code date} field
 * this entity does not carry; sets are ordered within an exercise by {@code setIndex}.
 */
public interface ExerciseSetRepository extends JpaRepository<ExerciseSetEntity, UUID> {

    List<ExerciseSetEntity> findByCreatedByAndExerciseIdOrderBySetIndexAsc(
        UUID createdBy, UUID exerciseId);

    List<ExerciseSetEntity> findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(
        UUID createdBy, UUID workoutSessionId);

    /**
     * The owner's logged sets of one exercise inside one workout instance, in set order — the
     * set-level challenge outcome evaluator's input (compare the instance's actuals against a target).
     */
    List<ExerciseSetEntity> findByCreatedByAndWorkoutSessionIdAndExerciseIdOrderBySetIndexAsc(
        UUID createdBy, UUID workoutSessionId, UUID exerciseId);

    /** Every logged (reps present) set of the owner — record aggregation input. */
    List<ExerciseSetEntity> findByCreatedByAndRepsNotNull(UUID createdBy);
}
