package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphEdgeRepository;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for GraphNodeEntity/GraphEdgeEntity — persists via {@code saveAndFlush} so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class GraphPopulator {

    private final GraphNodeRepository nodeRepository;
    private final GraphEdgeRepository edgeRepository;

    public GraphNodeEntity createNode(UUID owner, String kind, String title) {
        GraphNodeEntity n = new GraphNodeEntity();
        n.setCreatedBy(owner);
        n.setKind(kind);
        n.setTitle(title);
        return nodeRepository.saveAndFlush(n);
    }

    public GraphEdgeEntity createEdge(UUID owner, UUID fromNodeId, UUID toNodeId, String kind) {
        GraphEdgeEntity e = new GraphEdgeEntity();
        e.setCreatedBy(owner);
        e.setFromNodeId(fromNodeId);
        e.setToNodeId(toNodeId);
        e.setKind(kind);
        return edgeRepository.saveAndFlush(e);
    }
}
