package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;

/**
 * Repository for {@link MesocycleEntity}. Extends {@link JpaRepository} directly rather than the
 * house {@code OwnedRepository}, whose {@code findAllOwned} JPQL orders by a {@code date} field
 * this entity does not carry; mesocycles are ordered by their {@code startDate} instead.
 */
public interface MesocycleRepository extends JpaRepository<MesocycleEntity, UUID> {

    List<MesocycleEntity> findByCreatedByAndDeletedFalseOrderByStartDateAsc(UUID createdBy);

    /** Owned-by-id lookup — the goal-plan link service validates the referenced plan (read-only). */
    Optional<MesocycleEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** Owned-by-id lookup holding a row lock to commit — serialises the weekly proposal per run. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<MesocycleEntity> findLockedByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** The stored status straight from the database (a scalar read, never a stale managed entity). */
    @Query("select m.status from MesocycleEntity m where m.id = :id")
    String findStatusById(@Param("id") UUID id);

    /** All owned mesocycles in one status — the activate flow archives the previous active ones. */
    List<MesocycleEntity> findByCreatedByAndStatusAndDeletedFalse(UUID createdBy, String status);

    /** How many runs were started from a template — the template library's {@code runCount}. */
    long countByTemplateIdAndCreatedByAndDeletedFalse(UUID templateId, UUID createdBy);

    /** Runs still on a given volume model in the given statuses, all owners — the one-time amount migration. */
    List<MesocycleEntity> findByVolumeModelAndStatusInAndDeletedFalse(short volumeModel, Collection<String> statuses);
}
