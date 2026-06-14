package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link RunningBlockEntity}. Extends {@link JpaRepository} directly (matching the
 * sibling {@code MesocycleRepository}); the house {@code OwnedRepository} orders by a {@code date}
 * field this entity does not carry, so blocks are ordered by {@code startDate} via an explicit
 * finder. The {@code is_deleted = false} filter comes from the entity {@code @SQLRestriction}.
 */
public interface RunningBlockRepository extends JpaRepository<RunningBlockEntity, UUID> {

    List<RunningBlockEntity> findByCreatedByAndDeletedFalseOrderByStartDateAsc(UUID createdBy);

    Optional<RunningBlockEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** All owned blocks in one status — the activate flow archives the previous active one. */
    List<RunningBlockEntity> findByCreatedByAndStatusAndDeletedFalse(UUID createdBy, String status);
}
