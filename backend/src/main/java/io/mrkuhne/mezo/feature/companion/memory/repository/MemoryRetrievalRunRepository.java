package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalRunEntity;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MemoryRetrievalRunRepository extends JpaRepository<MemoryRetrievalRunEntity, UUID> {

    Optional<MemoryRetrievalRunEntity> findByTraceIdAndCreatedBy(UUID traceId, UUID createdBy);

    /**
     * mezo-4qyt: the admin explorer's run list. Paged and owner-scoped; the entity's
     * {@code @SQLRestriction("is_deleted = false")} already hides soft-deleted runs, and the
     * retention job HARD-deletes past 30 days, so a page can legitimately shrink between two
     * requests — the response carries {@code retentionDays} so the surface can say why.
     */
    Page<MemoryRetrievalRunEntity> findByCreatedByOrderByCreatedAtDesc(UUID createdBy, Pageable pageable);

    /** mezo-4qyt: one owner-scoped run for the explorer's run detail. */
    Optional<MemoryRetrievalRunEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);

    @Modifying
    @Query(value = """
            delete from memory_retrieval_run
            where created_by = :createdBy and created_at < :cutoff
            """, nativeQuery = true)
    int hardDeleteByCreatedByAndCreatedAtBefore(
            @Param("createdBy") UUID createdBy, @Param("cutoff") Instant cutoff);
}
