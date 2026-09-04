package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalRunEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemoryRetrievalRunRepository extends JpaRepository<MemoryRetrievalRunEntity, UUID> {

    Optional<MemoryRetrievalRunEntity> findByTraceIdAndCreatedBy(UUID traceId, UUID createdBy);
}
