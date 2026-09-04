package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemoryItemRepository extends JpaRepository<MemoryItemEntity, UUID> {

    Optional<MemoryItemEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<MemoryItemEntity> findByCreatedByAndSourceKindAndSourceId(
            UUID createdBy, String sourceKind, UUID sourceId);
}
