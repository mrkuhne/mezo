package io.mrkuhne.mezo.feature.goal.repository;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GoalRepository extends JpaRepository<GoalEntity, UUID> {

    // No 'date' base field => extend JpaRepository directly (not OwnedRepository).
    // Active-first ordering: 'active' < 'archived' < 'planned' alphabetically is wrong,
    // so the service sorts; here we order by start_date and let the service hoist active.
    List<GoalEntity> findByCreatedByAndDeletedFalseOrderByStartDateDesc(UUID createdBy);

    Optional<GoalEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** All owned goals in one status — drives the single-active invariant on activate. */
    List<GoalEntity> findByCreatedByAndStatusAndDeletedFalse(UUID createdBy, String status);
}
