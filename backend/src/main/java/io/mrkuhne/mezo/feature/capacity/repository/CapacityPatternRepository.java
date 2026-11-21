package io.mrkuhne.mezo.feature.capacity.repository;

import io.mrkuhne.mezo.feature.capacity.entity.CapacityPatternEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CapacityPatternRepository extends JpaRepository<CapacityPatternEntity, UUID> {
    List<CapacityPatternEntity> findByCreatedByAndDeletedFalse(UUID owner);
}
