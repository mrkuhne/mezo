package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.TrainingYearPlanEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TrainingYearPlanRepository extends JpaRepository<TrainingYearPlanEntity, UUID> {

    Optional<TrainingYearPlanEntity> findByCreatedByAndStatusAndDeletedFalse(UUID createdBy, String status);

    Optional<TrainingYearPlanEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
