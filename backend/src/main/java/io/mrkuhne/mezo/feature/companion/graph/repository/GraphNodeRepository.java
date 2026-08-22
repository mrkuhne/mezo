package io.mrkuhne.mezo.feature.companion.graph.repository;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GraphNodeRepository extends JpaRepository<GraphNodeEntity, UUID> {

    Optional<GraphNodeEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<GraphNodeEntity> findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
        UUID createdBy, String sourceKind, UUID sourceId);

    List<GraphNodeEntity> findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
        UUID createdBy, String status);

    /** W2.2 edge structurer's candidate list — every OTHER active node the new node could link to. */
    List<GraphNodeEntity> findByCreatedByAndStatusAndIdNotAndDeletedFalseOrderByCreatedAtDesc(
        UUID createdBy, String status, UUID excludedId);
}
