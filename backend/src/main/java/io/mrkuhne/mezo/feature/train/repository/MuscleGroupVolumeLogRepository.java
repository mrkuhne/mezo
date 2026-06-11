package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link MuscleGroupVolumeLogEntity}. Extends {@link JpaRepository} directly
 * rather than the house {@code OwnedRepository}, whose {@code findAllOwned} JPQL orders by a
 * {@code date} field this entity does not carry; volume logs are keyed by mesocycle + muscle.
 */
public interface MuscleGroupVolumeLogRepository extends JpaRepository<MuscleGroupVolumeLogEntity, UUID> {

    List<MuscleGroupVolumeLogEntity> findByCreatedByAndMesocycleIdInOrderByMuscleAsc(
        UUID createdBy, Collection<UUID> mesocycleIds);
}
