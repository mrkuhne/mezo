package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MemoryItemRepository extends JpaRepository<MemoryItemEntity, UUID> {

    Optional<MemoryItemEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<MemoryItemEntity> findByCreatedByAndSourceKindAndSourceId(
            UUID createdBy, String sourceKind, UUID sourceId);

    @Query(value = """
            select i.*
            from memory_item i
            left join memory_vector v
              on v.memory_item_id = i.id
             and v.created_by = i.created_by
             and v.embedding_version = :targetVersion
            where i.created_by = :createdBy
              and i.is_deleted = false
              and i.state = 'active'
              and (v.id is null
                   or v.is_deleted = true
                   or v.status <> 'ready'
                   or v.embedded_content_hash <> i.content_hash)
            order by i.occurred_on, i.id
            limit :batchSize
            for update of i skip locked
            """, nativeQuery = true)
    List<MemoryItemEntity> findReembeddingCandidates(
            @Param("createdBy") UUID createdBy,
            @Param("targetVersion") String targetVersion,
            @Param("batchSize") int batchSize);
}
