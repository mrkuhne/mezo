package io.mrkuhne.mezo.feature.companion.graph.repository;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GraphEdgeRepository extends JpaRepository<GraphEdgeEntity, UUID> {

    Optional<GraphEdgeEntity> findByCreatedByAndFromNodeIdAndToNodeIdAndKindAndDeletedFalse(
        UUID createdBy, UUID fromNodeId, UUID toNodeId, String kind);

    List<GraphEdgeEntity> findByCreatedByAndFromNodeIdAndDeletedFalse(UUID createdBy, UUID fromNodeId);

    List<GraphEdgeEntity> findByCreatedByAndToNodeIdAndDeletedFalse(UUID createdBy, UUID toNodeId);

    /** W2.5 (mezo-b3pp.10): every active edge for a user — the nightly decay/prune pass loads
     *  them all once rather than per-node, since the ADR 0031 scale assumption (hundreds of
     *  nodes, single user) makes one flat list cheaper than N traversal queries. */
    List<GraphEdgeEntity> findByCreatedByAndDeletedFalse(UUID createdBy);

    /**
     * Edges the active-graph surface considers: non-deleted, and BOTH endpoint nodes are active
     * (createdBy = userId, status = active, not deleted) — the exact node predicate that feeds
     * {@code titleById} in {@code GraphService#listActiveWithTopEdges}, whose in-memory {@code
     * titleById.containsKey(...)} check on both endpoints this query reproduces in SQL so the
     * count agrees with what that surface renders.
     */
    @Query("""
        select count(e) from GraphEdgeEntity e
        where e.createdBy = :userId and e.deleted = false
          and exists (
            select 1 from GraphNodeEntity n
            where n.id = e.fromNodeId and n.createdBy = :userId
              and n.status = :#{T(io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity).STATUS_ACTIVE} and n.deleted = false
          )
          and exists (
            select 1 from GraphNodeEntity n
            where n.id = e.toNodeId and n.createdBy = :userId
              and n.status = :#{T(io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity).STATUS_ACTIVE} and n.deleted = false
          )
        """)
    int countActiveByUserId(@Param("userId") UUID userId);
}
