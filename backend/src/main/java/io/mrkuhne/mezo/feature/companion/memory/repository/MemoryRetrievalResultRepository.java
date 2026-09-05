package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalResultEntity;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

public interface MemoryRetrievalResultRepository extends JpaRepository<MemoryRetrievalResultEntity, UUID> {

    Optional<MemoryRetrievalResultEntity> findByIdAndRunIdAndCreatedBy(
            UUID id, UUID runId, UUID createdBy);

    /** Serializes first feedback writes and excludes ranked candidates that were never disclosed. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<MemoryRetrievalResultEntity> findByIdAndRunIdAndCreatedByAndSelectedTrue(
            UUID id, UUID runId, UUID createdBy);

    List<MemoryRetrievalResultEntity> findByRunIdAndCreatedByOrderByRank(UUID runId, UUID createdBy);
}
