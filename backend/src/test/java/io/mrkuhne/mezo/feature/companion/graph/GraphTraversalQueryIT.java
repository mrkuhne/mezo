package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphTraversalQuery;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphTraversalQuery.NeighborEdge;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** W2.4 (mezo-b3pp.9): the recursive-CTE neighborhood — hop bound, weight order, cycle safety,
 *  active-only, owner-scoped. */
class GraphTraversalQueryIT extends AbstractIntegrationTest {

    @Autowired private GraphTraversalQuery query;
    @Autowired private GraphPopulator graphPopulator;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testNeighborhood_shouldReturnAtMostTwoHopsInWeightOrder_onSeededThreeHopChain() {
        UUID userId = databasePopulator.populateUser("graph-trav-chain@test.local");
        GraphNodeEntity a = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Késői evés");
        GraphNodeEntity b = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Rossz alvás");
        GraphNodeEntity c = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Gyenge edzés");
        GraphNodeEntity d = graphPopulator.createNode(userId, GraphNodeEntity.KIND_GOAL, "Erőnövelés");
        graphPopulator.createEdge(userId, a.getId(), b.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.400");
        graphPopulator.createEdge(userId, b.getId(), c.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.700");
        graphPopulator.createEdge(userId, c.getId(), d.getId(), GraphEdgeEntity.KIND_CONFLICTS, "0.900");

        List<NeighborEdge> edges = query.neighborhood(userId, List.of(a.getId()), 2, 8);

        // 3rd hop (c→d) is out of reach; the two in reach come weight-desc, not hop order
        assertThat(edges).extracting(NeighborEdge::fromTitle, NeighborEdge::toTitle, NeighborEdge::hops)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("Rossz alvás", "Gyenge edzés", 2),
                        org.assertj.core.groups.Tuple.tuple("Késői evés", "Rossz alvás", 1));
        assertThat(edges.getFirst().kind()).isEqualTo(GraphEdgeEntity.KIND_TRIGGERS);
        assertThat(edges.getFirst().weight()).isEqualByComparingTo("0.700");
    }

    @Test
    void testNeighborhood_shouldWalkIncomingEdgesToo_andRespectTopK() {
        UUID userId = databasePopulator.populateUser("graph-trav-undirected@test.local");
        GraphNodeEntity seed = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Stressz");
        GraphNodeEntity in1 = graphPopulator.createNode(userId, GraphNodeEntity.KIND_LIFE_EVENT, "Költözés");
        GraphNodeEntity out1 = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Rossz alvás");
        GraphNodeEntity out2 = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PREFERENCE, "Esti séta");
        graphPopulator.createEdge(userId, in1.getId(), seed.getId(), GraphEdgeEntity.KIND_PRECEDED_BY, "0.800");
        graphPopulator.createEdge(userId, seed.getId(), out1.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.600");
        graphPopulator.createEdge(userId, seed.getId(), out2.getId(), GraphEdgeEntity.KIND_SUPPORTS, "0.300");

        List<NeighborEdge> edges = query.neighborhood(userId, List.of(seed.getId()), 2, 2);

        assertThat(edges).extracting(NeighborEdge::fromTitle, NeighborEdge::toTitle)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("Költözés", "Stressz"),
                        org.assertj.core.groups.Tuple.tuple("Stressz", "Rossz alvás"));
    }

    @Test
    void testNeighborhood_shouldTerminate_andReportEachEdgeOnce_onCycle() {
        UUID userId = databasePopulator.populateUser("graph-trav-cycle@test.local");
        GraphNodeEntity a = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "A");
        GraphNodeEntity b = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "B");
        GraphNodeEntity c = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "C");
        graphPopulator.createEdge(userId, a.getId(), b.getId(), GraphEdgeEntity.KIND_RELATES_TO, "0.500");
        graphPopulator.createEdge(userId, b.getId(), c.getId(), GraphEdgeEntity.KIND_RELATES_TO, "0.500");
        graphPopulator.createEdge(userId, c.getId(), a.getId(), GraphEdgeEntity.KIND_RELATES_TO, "0.500");

        List<NeighborEdge> edges = query.neighborhood(userId, List.of(a.getId()), 3, 20);

        assertThat(edges).hasSize(3);
        assertThat(edges).extracting(NeighborEdge::edgeId).doesNotHaveDuplicates();
    }

    @Test
    void testNeighborhood_shouldSkipArchivedAndSoftDeleted_andOtherUsers() {
        UUID userId = databasePopulator.populateUser("graph-trav-active@test.local");
        UUID other = databasePopulator.populateUser("graph-trav-other@test.local");
        GraphNodeEntity seed = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Seed");
        GraphNodeEntity live = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Élő");
        GraphNodeEntity archived = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Archivált");
        archived.setStatus(GraphNodeEntity.STATUS_ARCHIVED);
        nodeRepository.saveAndFlush(archived);
        GraphNodeEntity gone = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Törölt");
        graphPopulator.createEdge(userId, seed.getId(), live.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.500");
        graphPopulator.createEdge(userId, seed.getId(), archived.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.900");
        graphPopulator.createEdge(userId, seed.getId(), gone.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.900");
        nodeRepository.delete(gone);
        nodeRepository.flush();
        GraphNodeEntity foreign = graphPopulator.createNode(other, GraphNodeEntity.KIND_PATTERN, "Idegen");
        graphPopulator.createEdge(other, foreign.getId(), foreign.getId(), GraphEdgeEntity.KIND_RELATES_TO, "0.900");

        List<NeighborEdge> edges = query.neighborhood(userId, List.of(seed.getId()), 2, 8);

        assertThat(edges).extracting(NeighborEdge::toTitle).containsExactly("Élő");
    }
}
