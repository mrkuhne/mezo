package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalFeedbackEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemoryRetrievalFeedbackRepository extends JpaRepository<MemoryRetrievalFeedbackEntity, UUID> {

    Optional<MemoryRetrievalFeedbackEntity> findByCreatedByAndResultId(
            UUID createdBy, UUID resultId);

    List<MemoryRetrievalFeedbackEntity> findByCreatedByAndResultIdIn(
            UUID createdBy, List<UUID> resultIds);
}
