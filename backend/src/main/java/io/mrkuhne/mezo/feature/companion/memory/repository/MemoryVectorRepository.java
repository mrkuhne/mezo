package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryVectorEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MemoryVectorRepository extends JpaRepository<MemoryVectorEntity, UUID> {

    List<MemoryVectorEntity> findByCreatedByAndMemoryItemIdOrderByEmbeddingVersion(
            UUID createdBy, UUID memoryItemId);

    Optional<MemoryVectorEntity> findByCreatedByAndMemoryItemIdAndEmbeddingVersionAndStatusAndDeletedFalse(
            UUID createdBy, UUID memoryItemId, String embeddingVersion, String status);

    @Query(value = """
            select * from memory_vector
            where created_by = :createdBy
              and memory_item_id = :memoryItemId
              and embedding_version = :embeddingVersion
            """, nativeQuery = true)
    Optional<MemoryVectorEntity> findByOwnerItemAndVersionIncludingDeleted(
            @Param("createdBy") UUID createdBy,
            @Param("memoryItemId") UUID memoryItemId,
            @Param("embeddingVersion") String embeddingVersion);
}
