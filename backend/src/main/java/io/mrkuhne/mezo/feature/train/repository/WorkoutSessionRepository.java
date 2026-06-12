package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link WorkoutSessionEntity}. Extends {@link JpaRepository} directly rather than
 * the house {@code OwnedRepository}, whose {@code findAllOwned} JPQL orders by a {@code date} field
 * sessions only optionally carry; sessions are ordered within a mesocycle by {@code orderIndex}.
 */
public interface WorkoutSessionRepository extends JpaRepository<WorkoutSessionEntity, UUID> {

    List<WorkoutSessionEntity> findByCreatedByAndMesocycleIdInOrderByOrderIndexAsc(
        UUID createdBy, Collection<UUID> mesocycleIds);

    Optional<WorkoutSessionEntity> findFirstByCreatedByAndTemplateSessionIdAndStatusOrderByDateDescCreatedAtDesc(
        UUID createdBy, UUID templateSessionId, String status);
}
