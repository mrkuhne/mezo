package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.TrainingYearBlockEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TrainingYearBlockRepository extends JpaRepository<TrainingYearBlockEntity, UUID> {

    List<TrainingYearBlockEntity> findByPlanIdAndDeletedFalseOrderByOrdinalAsc(UUID planId);

    Optional<TrainingYearBlockEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** Every block holding the mesocycle — a list, because the index is not unique (callers keep it to one). */
    List<TrainingYearBlockEntity> findByCreatedByAndMesocycleIdAndDeletedFalse(UUID createdBy, UUID mesocycleId);
}
