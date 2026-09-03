package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromptAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * W2.4 review fix (mezo-b3pp.33): {@code graph.max-refs} caps GraphNode refs per turn. A separate
 * class from {@link GraphPromptAssemblerIT} because the cap is overridden via
 * {@link TestPropertySource} at class scope — the sibling IT's own cases rely on the default
 * (uncapped-for-their-fixture-size) value.
 */
@TestPropertySource(properties = "mezo.companion.graph.max-refs=3")
class GraphPromptAssemblerRefsCapIT extends AbstractIntegrationTest {

    @Autowired private GraphPromptAssembler assembler;
    @Autowired private GraphPopulator graphPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testAssemble_shouldCapGraphRefs_whenTheTraversalRendersMoreNodesThanTheLimit() {
        UUID userId = databasePopulator.populateUser("graph-refs-cap@test.local");
        // star topology: hub is 1 hop from every neighbor, so all 4 edges are within maxHops and
        // topK — descending weight fixes rendering order, so first-appearance order is
        // deterministic: hub, n1, n2, n3, n4 (5 distinct nodes across 4 edges).
        GraphNodeEntity hub = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Rossz alvás");
        GraphNodeEntity n1 = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Késői evés");
        GraphNodeEntity n2 = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Gyenge edzés");
        GraphNodeEntity n3 = graphPopulator.createNode(userId, GraphNodeEntity.KIND_GOAL, "Erőnövelés");
        GraphNodeEntity n4 = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Stressz");
        graphPopulator.createEdge(userId, hub.getId(), n1.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.900");
        graphPopulator.createEdge(userId, hub.getId(), n2.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.800");
        graphPopulator.createEdge(userId, hub.getId(), n3.getId(), GraphEdgeEntity.KIND_CONFLICTS, "0.700");
        graphPopulator.createEdge(userId, hub.getId(), n4.getId(), GraphEdgeEntity.KIND_RELATES_TO, "0.600");

        GraphPromptAssembler.GraphContext ctx = assembler.assemble(userId, "miért rossz az alvás mostanában?");

        assertThat(ctx.refs()).hasSize(3);
        assertThat(ctx.refs()).extracting(RefsEnvelope.Ref::id).containsExactly(
                hub.getId().toString(), n1.getId().toString(), n2.getId().toString());
    }
}
