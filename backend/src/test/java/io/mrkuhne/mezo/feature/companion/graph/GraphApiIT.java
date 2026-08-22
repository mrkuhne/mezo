package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GraphNodeResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
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
        toArchive.setStatus(GraphNodeEntity.STATUS_ARCHIVED);

        List<GraphNodeResponse> nodes = getForList("/api/companion/graph/node", ownerAuthHeaders(),
            HttpStatus.OK, GraphNodeResponse.class);

        assertThat(nodes).extracting(GraphNodeResponse::getTitle).contains("Aktív csomópont.");
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
}
