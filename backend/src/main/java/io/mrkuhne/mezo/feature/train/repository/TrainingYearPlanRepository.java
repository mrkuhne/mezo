package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.TrainingYearPlanEntity;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

public interface TrainingYearPlanRepository extends JpaRepository<TrainingYearPlanEntity, UUID> {

    Optional<TrainingYearPlanEntity> findByCreatedByAndStatusAndDeletedFalse(UUID createdBy, String status);

    Optional<TrainingYearPlanEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** The active plan holding a row lock to commit — serialises every write of one plan. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<TrainingYearPlanEntity> findLockedByCreatedByAndStatusAndDeletedFalse(UUID createdBy, String status);

    /** Owned-by-id lookup holding a row lock to commit (block edits). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<TrainingYearPlanEntity> findLockedByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
