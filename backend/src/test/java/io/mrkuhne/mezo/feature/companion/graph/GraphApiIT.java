package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GraphEdgeCountResponse;
import io.mrkuhne.mezo.api.dto.GraphNodeResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * HTTP-level contract IT for the {@code /api/companion/graph} surface (bd mezo-b3pp.6) — drives
 * the generated {@code KnowledgeGraphApi}: active-node listing, archive, ownership 404.
 */
class GraphApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private GraphPopulator graphPopulator;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testListGraphNodes_shouldReturnOnlyActiveNodes_whenSomeArchived() {
        UUID owner = ownerId();
        graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Aktív csomópont.");
        GraphNodeEntity toArchive = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "Archiválandó.");
        // Archive via the real endpoint so the status change is genuinely persisted, not just
        // mutated on a detached entity (toArchive was returned by GraphPopulator's own saveAndFlush,
        // and GraphApiIT talks to a separately-threaded Tomcat, so an in-memory setter here would
        // never reach the DB).
        postForBody("/api/companion/graph/node/" + toArchive.getId() + "/archive", null,
            ownerAuthHeaders(), HttpStatus.OK, GraphNodeResponse.class);

        List<GraphNodeResponse> nodes = getForList("/api/companion/graph/node", ownerAuthHeaders(),
            HttpStatus.OK, GraphNodeResponse.class);

        assertThat(nodes).extracting(GraphNodeResponse::getTitle)
            .contains("Aktív csomópont.")
            .doesNotContain("Archiválandó.");
    }

    @Test
    void testArchiveGraphNode_shouldFlipStatusAndDropFromActiveListing_whenOwnNode() {
        UUID owner = ownerId();
        GraphNodeEntity node = graphPopulator.createNode(owner, GraphNodeEntity.KIND_GOAL, "Archiválandó cél.");

        GraphNodeResponse archived = postForBody("/api/companion/graph/node/" + node.getId() + "/archive",
            null, ownerAuthHeaders(), HttpStatus.OK, GraphNodeResponse.class);

        assertThat(archived.getStatus()).isEqualTo(GraphNodeResponse.StatusEnum.ARCHIVED);

        List<GraphNodeResponse> active = getForList("/api/companion/graph/node", ownerAuthHeaders(),
            HttpStatus.OK, GraphNodeResponse.class);
        assertThat(active).extracting(GraphNodeResponse::getId).doesNotContain(node.getId());
    }

    @Test
    void testArchiveGraphNode_shouldReturn404_whenNotOwnNode() {
        UUID otherUser = userPopulator.createUser().getId();
        GraphNodeEntity node = graphPopulator.createNode(otherUser, GraphNodeEntity.KIND_GOAL, "Nem az enyém.");

        String body = postForBody("/api/companion/graph/node/" + node.getId() + "/archive", null,
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "GRAPH_NODE_NOT_FOUND");
    }

    @Test
    void testListGraphNodes_shouldIncludeTopEdges_forNodesWithEdges() {
        UUID owner = ownerId();
        GraphNodeEntity from = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Késői evés");
        GraphNodeEntity to = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Rossz alvás");
        graphPopulator.createEdge(owner, from.getId(), to.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.800");

        List<GraphNodeResponse> nodes = getForList("/api/companion/graph/node", ownerAuthHeaders(),
            HttpStatus.OK, GraphNodeResponse.class);

        GraphNodeResponse fromResponse = nodes.stream()
            .filter(n -> n.getId().equals(from.getId())).findFirst().orElseThrow();
        assertThat(fromResponse.getTopEdges()).containsExactly("Késői evés → kiváltja → Rossz alvás · erős");
    }

    @Test
    void testCountGraphEdges_shouldReturnActiveEdgeCount_excludingOtherUsersAndArchivedNodeEdges() {
        UUID owner = ownerId();
        GraphNodeEntity a = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "A csomópont");
        GraphNodeEntity b = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "B csomópont");
        graphPopulator.createEdge(owner, a.getId(), b.getId(), GraphEdgeEntity.KIND_TRIGGERS);

        // another user's edge must not be counted
        UUID otherUser = userPopulator.createUser().getId();
        GraphNodeEntity otherA = graphPopulator.createNode(otherUser, GraphNodeEntity.KIND_PATTERN, "Más A");
        GraphNodeEntity otherB = graphPopulator.createNode(otherUser, GraphNodeEntity.KIND_PATTERN, "Más B");
        graphPopulator.createEdge(otherUser, otherA.getId(), otherB.getId(), GraphEdgeEntity.KIND_TRIGGERS);

        // an edge whose endpoint node is archived must not be counted
        GraphNodeEntity c = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "C csomópont");
        GraphNodeEntity toArchive = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Archiválandó");
        graphPopulator.createEdge(owner, c.getId(), toArchive.getId(), GraphEdgeEntity.KIND_TRIGGERS);
        postForBody("/api/companion/graph/node/" + toArchive.getId() + "/archive", null,
            ownerAuthHeaders(), HttpStatus.OK, GraphNodeResponse.class);

        GraphEdgeCountResponse response = getForBody("/api/companion/graph/edge/count", ownerAuthHeaders(),
            HttpStatus.OK, GraphEdgeCountResponse.class);

        assertThat(response.getCount()).isEqualTo(1);
    }
}
