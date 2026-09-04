package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryVectorEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemoryVectorRepository extends JpaRepository<MemoryVectorEntity, UUID> {

    List<MemoryVectorEntity> findByCreatedByAndMemoryItemIdOrderByEmbeddingVersion(
            UUID createdBy, UUID memoryItemId);

    Optional<MemoryVectorEntity> findByCreatedByAndMemoryItemIdAndEmbeddingVersionAndStatusAndDeletedFalse(
            UUID createdBy, UUID memoryItemId, String embeddingVersion, String status);
}
