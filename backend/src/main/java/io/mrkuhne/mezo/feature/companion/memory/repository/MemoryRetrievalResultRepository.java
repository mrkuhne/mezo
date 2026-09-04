package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalResultEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemoryRetrievalResultRepository extends JpaRepository<MemoryRetrievalResultEntity, UUID> {

    Optional<MemoryRetrievalResultEntity> findByIdAndRunIdAndCreatedBy(
            UUID id, UUID runId, UUID createdBy);
}
