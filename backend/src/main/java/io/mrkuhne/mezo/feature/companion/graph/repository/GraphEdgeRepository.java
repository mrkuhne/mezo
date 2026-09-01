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

    /** W2.5 (mezo-b3pp.10): every active edge for a user — the nightly decay/prune pass loads
     *  them all once rather than per-node, since the ADR 0031 scale assumption (hundreds of
     *  nodes, single user) makes one flat list cheaper than N traversal queries. */
    List<GraphEdgeEntity> findByCreatedByAndDeletedFalse(UUID createdBy);

    /** Same "active edge" filter as {@link #findByCreatedByAndDeletedFalse(UUID)} — count-only
     *  form for the edge-count endpoint. */
    int countByCreatedByAndDeletedFalse(UUID userId);

    /** Alias matching the {@code GraphService} call site naming for the edge-count endpoint. */
    default int countActiveByUserId(UUID userId) {
        return countByCreatedByAndDeletedFalse(userId);
    }
}
