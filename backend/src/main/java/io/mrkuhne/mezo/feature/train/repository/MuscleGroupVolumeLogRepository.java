package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Repository for {@link MuscleGroupVolumeLogEntity}. Extends {@link JpaRepository} directly
 * rather than the house {@code OwnedRepository}, whose {@code findAllOwned} JPQL orders by a
 * {@code date} field this entity does not carry; volume logs are keyed by mesocycle + muscle.
 */
public interface MuscleGroupVolumeLogRepository extends JpaRepository<MuscleGroupVolumeLogEntity, UUID> {

    List<MuscleGroupVolumeLogEntity> findByCreatedByAndMesocycleIdInOrderByMuscleAsc(
        UUID createdBy, Collection<UUID> mesocycleIds);

    /**
     * Physical delete (not the entity's soft delete): the (mesocycle, muscle) unique constraint is
     * not partial on is_deleted, so a tombstone would block the group coming back (VolumeLedger).
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "delete from muscle_group_volume_log where id in (:ids)", nativeQuery = true)
    void hardDeleteByIds(@Param("ids") Collection<UUID> ids);
}
