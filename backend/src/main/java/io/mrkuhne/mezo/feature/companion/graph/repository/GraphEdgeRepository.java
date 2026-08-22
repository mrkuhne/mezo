package io.mrkuhne.mezo.feature.companion.graph.repository;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GraphEdgeRepository extends JpaRepository<GraphEdgeEntity, UUID> {

    Optional<GraphEdgeEntity> findByCreatedByAndFromNodeIdAndToNodeIdAndKindAndDeletedFalse(
        UUID createdBy, UUID fromNodeId, UUID toNodeId, String kind);

    List<GraphEdgeEntity> findByCreatedByAndFromNodeIdAndDeletedFalse(UUID createdBy, UUID fromNodeId);

    List<GraphEdgeEntity> findByCreatedByAndToNodeIdAndDeletedFalse(UUID createdBy, UUID toNodeId);
}
