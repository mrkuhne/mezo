package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionService;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
import io.mrkuhne.mezo.feature.companion.graph.service.PersonGraphEdgeAdapter;
import io.mrkuhne.mezo.feature.people.PersonGraphEdgeSource;
import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.PersonPopulator;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Emberek S5 gráf-tükör, Task 5 (bd mezo-06o0.4): a {@link PersonGraphEdgeAdapter} — a
 * {@link PersonGraphEdgeSource} port graph-oldali megvalósítása — a személy PERSON node-jának
 * legerősebb éleit adja vissza, ugyanazzal a magyar szótárral, amit a {@code [Összefüggések]}
 * prompt-blokk és a {@code GraphNodeResponse.topEdges} használ.
 */
@ActiveProfiles("companion-fake")
class PersonGraphEdgeAdapterIT extends AbstractIntegrationTest {

    @Autowired private PersonGraphEdgeAdapter adapter;
    @Autowired private GraphPromotionService promotionService;
    @Autowired private GraphService graphService;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private PersonPopulator personPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void edgesByPerson_shouldReturnRenderedEdges_forActivePersonNode() {
        UUID userId = ownerId();
        PersonEntity person = personPopulator.createPerson(userId, "Ádám");
        GraphNodeEntity personNode = promotionService.syncPerson(userId, person.getId()).orElseThrow();
        GraphNodeEntity goalNode = graphService.upsertNode(userId, GraphNodeEntity.KIND_GOAL,
            "Futóblokk · 8 hét", null, "goal_test", UUID.randomUUID(), null, java.util.Map.of());
        graphService.upsertEdge(userId, personNode.getId(), goalNode.getId(),
            GraphEdgeEntity.KIND_SUPPORTS, new BigDecimal("0.800"), List.of());

        List<PersonGraphEdgeSource.Edge> edges = adapter.edgesByPerson(userId).get(person.getId());

        assertThat(edges).hasSize(1);
        assertThat(edges.getFirst().nodeKind()).isEqualTo(GraphNodeEntity.KIND_GOAL);
        assertThat(edges.getFirst().title()).isEqualTo("Futóblokk · 8 hét");
        assertThat(edges.getFirst().relationHu()).isEqualTo("támogatja");
        assertThat(edges.getFirst().strength()).isEqualTo("erős");
    }

    @Test
    void edgesByPerson_shouldDropEdge_whenOtherEndpointIsArchived() {
        UUID userId = ownerId();
        PersonEntity person = personPopulator.createPerson(userId, "Ádám");
        GraphNodeEntity personNode = promotionService.syncPerson(userId, person.getId()).orElseThrow();
        GraphNodeEntity goalNode = graphService.upsertNode(userId, GraphNodeEntity.KIND_GOAL,
            "Futóblokk · 8 hét", null, "goal_test", UUID.randomUUID(), null, java.util.Map.of());
        graphService.upsertEdge(userId, personNode.getId(), goalNode.getId(),
            GraphEdgeEntity.KIND_SUPPORTS, new BigDecimal("0.800"), List.of());
        graphService.archive(userId, goalNode.getId());

        List<PersonGraphEdgeSource.Edge> edges = adapter.edgesByPerson(userId).get(person.getId());

        assertThat(edges).isNull();
    }

    @Test
    void edgesByPerson_shouldCapAtThree_orderedByWeightDesc() {
        UUID userId = ownerId();
        PersonEntity person = personPopulator.createPerson(userId, "Ádám");
        GraphNodeEntity personNode = promotionService.syncPerson(userId, person.getId()).orElseThrow();
        BigDecimal[] weights = {new BigDecimal("0.900"), new BigDecimal("0.700"),
            new BigDecimal("0.500"), new BigDecimal("0.300")};
        String[] titles = {"Cél A", "Cél B", "Cél C", "Cél D"};
        for (int i = 0; i < weights.length; i++) {
            GraphNodeEntity goalNode = graphService.upsertNode(userId, GraphNodeEntity.KIND_GOAL,
                titles[i], null, "goal_test", UUID.randomUUID(), null, java.util.Map.of());
            graphService.upsertEdge(userId, personNode.getId(), goalNode.getId(),
                GraphEdgeEntity.KIND_SUPPORTS, weights[i], List.of());
        }

        List<PersonGraphEdgeSource.Edge> edges = adapter.edgesByPerson(userId).get(person.getId());

        assertThat(edges).hasSize(3);
        assertThat(edges.stream().map(PersonGraphEdgeSource.Edge::title).toList())
            .containsExactly("Cél A", "Cél B", "Cél C");
    }
}
