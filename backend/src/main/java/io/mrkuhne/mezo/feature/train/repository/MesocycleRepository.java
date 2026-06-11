package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link MesocycleEntity}. Extends {@link JpaRepository} directly rather than the
 * house {@code OwnedRepository}, whose {@code findAllOwned} JPQL orders by a {@code date} field
 * this entity does not carry; mesocycles are ordered by their {@code startDate} instead.
 */
public interface MesocycleRepository extends JpaRepository<MesocycleEntity, UUID> {

    List<MesocycleEntity> findByCreatedByAndDeletedFalseOrderByStartDateAsc(UUID createdBy);

    /** All owned mesocycles in one status — the activate flow archives the previous active ones. */
    List<MesocycleEntity> findByCreatedByAndStatusAndDeletedFalse(UUID createdBy, String status);
}
