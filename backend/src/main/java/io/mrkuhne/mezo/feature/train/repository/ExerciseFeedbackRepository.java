package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Limit;
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

    /** Batch feedback lookup across many instances — {@code CharacterSignalReads}' gym-day read. */
    List<ExerciseFeedbackEntity> findByCreatedByAndWorkoutSessionIdIn(
        UUID createdBy, Collection<UUID> workoutSessionIds);

    /** Flat-feedback detection (round 2 S5, bd mezo-d58h.7.5, spec 2026-09-05 §(18)): the newest
     *  debrief rows first, capped by the caller. The rows carry no workout date of their own —
     *  {@code created_at} IS when the debrief was tapped, which is exactly the ordering the
     *  question is about. */
    List<ExerciseFeedbackEntity> findByCreatedByOrderByCreatedAtDesc(UUID createdBy, Limit limit);
}
