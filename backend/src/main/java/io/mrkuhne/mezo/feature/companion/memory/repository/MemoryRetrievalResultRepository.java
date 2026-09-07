package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalResultEntity;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MemoryRetrievalResultRepository extends JpaRepository<MemoryRetrievalResultEntity, UUID> {

    Optional<MemoryRetrievalResultEntity> findByIdAndRunIdAndCreatedBy(
            UUID id, UUID runId, UUID createdBy);

    /** Serializes first feedback writes and excludes ranked candidates that were never disclosed. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<MemoryRetrievalResultEntity> findByIdAndRunIdAndCreatedByAndSelectedTrue(
            UUID id, UUID runId, UUID createdBy);

    /**
     * One run's candidates in stored (final, post-rerank) rank order. Also the admin explorer's
     * run-detail read (mezo-4qyt) — deliberately the SAME finder rather than an {@code …RankAsc}
     * twin: two derived queries with identical semantics would drift.
     */
    List<MemoryRetrievalResultEntity> findByRunIdAndCreatedByOrderByRank(UUID runId, UUID createdBy);

    /**
     * mezo-4qyt: per-run candidate and selected counts for ONE page of the admin explorer's run
     * list, in a single statement. Loading each run's candidates just to size them would be an
     * N+1 over 25 runs; the counts are all the list column needs.
     */
    @Query(value = """
            select r.run_id as runId,
                   count(*) as candidateCount,
                   count(*) filter (where r.selected) as selectedCount
            from memory_retrieval_result r
            where r.created_by = :createdBy
              and r.is_deleted = false
              and r.run_id in (:runIds)
            group by r.run_id
            """, nativeQuery = true)
    List<MemoryRetrievalRunCountRow> countByRunIds(
            @Param("createdBy") UUID createdBy, @Param("runIds") Collection<UUID> runIds);
}
