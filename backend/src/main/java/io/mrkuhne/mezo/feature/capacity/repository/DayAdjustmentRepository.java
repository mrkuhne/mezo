package io.mrkuhne.mezo.feature.capacity.repository;

import io.mrkuhne.mezo.feature.capacity.entity.DayAdjustmentEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DayAdjustmentRepository extends JpaRepository<DayAdjustmentEntity, UUID> {
    List<DayAdjustmentEntity> findByCreatedByAndDateAndDeletedFalse(UUID owner, java.time.LocalDate date);
}
