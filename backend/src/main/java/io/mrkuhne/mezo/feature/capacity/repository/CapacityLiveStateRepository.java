package io.mrkuhne.mezo.feature.capacity.repository;

import io.mrkuhne.mezo.feature.capacity.entity.CapacityLiveStateEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CapacityLiveStateRepository extends JpaRepository<CapacityLiveStateEntity, UUID> {
    Optional<CapacityLiveStateEntity> findByCreatedByAndDeletedFalse(UUID owner);
}
