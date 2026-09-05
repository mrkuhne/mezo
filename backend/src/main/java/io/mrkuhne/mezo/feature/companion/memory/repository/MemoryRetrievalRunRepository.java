package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalRunEntity;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MemoryRetrievalRunRepository extends JpaRepository<MemoryRetrievalRunEntity, UUID> {

    Optional<MemoryRetrievalRunEntity> findByTraceIdAndCreatedBy(UUID traceId, UUID createdBy);

    @Modifying
    @Query(value = """
            delete from memory_retrieval_run
            where created_by = :createdBy and created_at < :cutoff
            """, nativeQuery = true)
    int hardDeleteByCreatedByAndCreatedAtBefore(
            @Param("createdBy") UUID createdBy, @Param("cutoff") Instant cutoff);
}
