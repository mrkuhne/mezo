package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link ExerciseEntity}. Extends {@link JpaRepository} directly rather than the
 * house {@code OwnedRepository}, whose {@code findAllOwned} JPQL orders by a {@code date} field
 * this entity does not carry; exercises are ordered within a session by {@code orderIndex}.
 */
public interface ExerciseRepository extends JpaRepository<ExerciseEntity, UUID> {

    List<ExerciseEntity> findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(
        UUID createdBy, Collection<UUID> workoutSessionIds);
}
