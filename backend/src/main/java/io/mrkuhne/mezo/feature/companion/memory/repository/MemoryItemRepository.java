package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MemoryItemRepository extends JpaRepository<MemoryItemEntity, UUID> {

    /**
     * L1 embedding-count rollup (mezo-eq85.10) — {@code memory_item.source_kind} counted over a
     * LIVE serving-version {@code memory_vector} row, the exact predicate {@code DenseMemoryQuery}
     * uses for ANN eligibility: not deleted (both {@code @SQLRestriction}s apply, this is JPQL),
     * item {@code state = 'active'}, vector {@code ready} with an embedding, on the serving
     * generation, and {@code embedded_content_hash = content_hash}. All SIX matter — a suppressed
     * or superseded item, or one whose text changed since it was embedded, will never be returned
     * by ANN, so counting it as "vetítve" would overstate the store to the user (fix round 1,
     * FIX 7). Replaces the retired {@code MemoryEmbeddingRepository.countByKindForUser}.
     */
    @Query("""
            select i.sourceKind as kind, count(i) as count
            from MemoryItemEntity i
            join MemoryVectorEntity v on v.memoryItemId = i.id and v.createdBy = i.createdBy
            where i.createdBy = :createdBy
              and i.state = 'active'
              and v.embeddingVersion = :servingVersion
              and v.status = 'ready'
              and v.embedding is not null
              and v.embeddedContentHash = i.contentHash
            group by i.sourceKind
            order by count(i) desc, i.sourceKind asc
            """)
    List<KindCount> countBySourceKindForUser(
            @Param("createdBy") UUID createdBy, @Param("servingVersion") String servingVersion);

    interface KindCount {
        String getKind();
        long getCount();
    }

    /**
     * The napló "embedded" flag (mezo-eq85.10) — {@code source_id}s of {@code daily_summary} items
     * that have a live serving-version vector, same predicate as {@link #countBySourceKindForUser}.
     * Replaces the retired {@code MemoryEmbeddingRepository.findRefIdsByCreatedByAndKind}.
     */
    @Query("""
            select i.sourceId
            from MemoryItemEntity i
            join MemoryVectorEntity v on v.memoryItemId = i.id and v.createdBy = i.createdBy
            where i.createdBy = :createdBy
              and i.sourceKind = :sourceKind
              and i.state = 'active'
              and v.embeddingVersion = :servingVersion
              and v.status = 'ready'
              and v.embedding is not null
              and v.embeddedContentHash = i.contentHash
            """)
    Set<UUID> findSourceIdsWithLiveVector(
            @Param("createdBy") UUID createdBy, @Param("sourceKind") String sourceKind,
            @Param("servingVersion") String servingVersion);

    Optional<MemoryItemEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    @Query("select i from MemoryItemEntity i where i.createdBy = :createdBy and i.sourceKind = :sourceKind and i.sourceId = :sourceId and i.chunkIndex = 0")
    Optional<MemoryItemEntity> findByCreatedByAndSourceKindAndSourceId(
            UUID createdBy, String sourceKind, UUID sourceId);

    List<MemoryItemEntity> findByCreatedByAndSourceKindAndSourceIdOrderByChunkIndex(
            UUID createdBy, String sourceKind, UUID sourceId);

    Optional<MemoryItemEntity> findByCreatedByAndSourceKindAndSourceIdAndChunkIndex(
            UUID createdBy, String sourceKind, UUID sourceId, int chunkIndex);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from MemoryItemEntity i where i.createdBy = :createdBy and i.sourceKind = :sourceKind and i.sourceId = :sourceId order by i.chunkIndex")
    List<MemoryItemEntity> findSourceForUpdate(UUID createdBy, String sourceKind, UUID sourceId);

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
