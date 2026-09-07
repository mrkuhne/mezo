package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminMemoryGraphEdge;
import io.mrkuhne.mezo.api.dto.AdminMemoryGraphNode;
import io.mrkuhne.mezo.api.dto.AdminMemoryGraphResponse;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEvidence;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * The explorer's STRUCTURED graph read (mezo-4qyt.2) — the first mezo surface to return
 * {@code knowledge_edge} rows as data rather than as a rendered {@code [Összefüggések]} line, and
 * the only one that can see past the entities' {@code @SQLRestriction("is_deleted = false")}.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.feature.knowledge-graph.enabled=true",
    "mezo.feature.admin-memory.enabled=true"
})
class AdminMemoryGraphIT extends ApiIntegrationTest {

    @Autowired private GraphPopulator graphPopulator;

    // ==== ownership ====

    @Test
    void testGraph_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");

        String body = getForBody(graphUri(anna.id()), anna.headers(), HttpStatus.FORBIDDEN, String.class);

        assertHasRequestError(body, "AUTH_FORBIDDEN");
    }

    @Test
    void testVectors_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");

        String body = getForBody("/api/admin/users/" + anna.id() + "/memory/vectors",
                anna.headers(), HttpStatus.FORBIDDEN, String.class);

        assertHasRequestError(body, "AUTH_FORBIDDEN");
    }

    @Test
    void testNeighbors_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");

        String body = getForBody(
                "/api/admin/users/" + anna.id() + "/memory/vectors/" + UUID.randomUUID() + "/neighbors",
                anna.headers(), HttpStatus.FORBIDDEN, String.class);

        assertHasRequestError(body, "AUTH_FORBIDDEN");
    }

    @Test
    void testHealth_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");

        String body = getForBody("/api/admin/users/" + anna.id() + "/memory/health",
                anna.headers(), HttpStatus.FORBIDDEN, String.class);

        assertHasRequestError(body, "AUTH_FORBIDDEN");
    }

    // ==== structured edges ====

    @Test
    void testGraph_shouldReturnStructuredEdgesWithEvidence_whenOwner() {
        RegisteredUser anna = registerUser("Anna");
        GraphNodeEntity from = graphPopulator.createNode(anna.id(), GraphNodeEntity.KIND_PATTERN, "Futás");
        GraphNodeEntity to = graphPopulator.createNode(anna.id(), GraphNodeEntity.KIND_GOAL, "Jó alvás");
        UUID evidenceSource = UUID.randomUUID();
        GraphEdgeEntity edge = graphPopulator.createEdgeWithEvidence(anna.id(), from.getId(), to.getId(),
                GraphEdgeEntity.KIND_TRIGGERS, "0.740",
                List.of(new GraphEdgeEvidence("pattern_event", evidenceSource, "megerősítve",
                        Instant.parse("2026-06-01T20:00:00Z"))));

        AdminMemoryGraphResponse response = getForBody(graphUri(anna.id()),
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryGraphResponse.class);

        assertThat(response.getEdges()).hasSize(1);
        AdminMemoryGraphEdge returned = response.getEdges().getFirst();
        assertThat(returned.getId()).isEqualTo(edge.getId());
        assertThat(returned.getFrom()).isEqualTo(from.getId());
        assertThat(returned.getTo()).isEqualTo(to.getId());
        assertThat(returned.getKind()).isEqualTo(GraphEdgeEntity.KIND_TRIGGERS);
        assertThat(returned.getWeight()).isEqualTo(0.74);
        assertThat(returned.getDeleted()).isFalse();
        assertThat(returned.getEvidence()).hasSize(1);
        assertThat(returned.getEvidence().getFirst().getSourceKind()).isEqualTo("pattern_event");
        assertThat(returned.getEvidence().getFirst().getSourceId()).isEqualTo(evidenceSource);
        assertThat(returned.getEvidence().getFirst().getNote()).isEqualTo("megerősítve");
        // Both endpoints carry the same single link, so both radii are explainable from the response.
        assertThat(response.getNodes()).extracting(AdminMemoryGraphNode::getDegree)
                .containsExactly(1, 1);
        // Read live from mezo.companion.graph, never mirrored into mezo.admin.memory.
        assertThat(response.getDecayFactor()).isEqualTo(0.99);
        assertThat(response.getPruneBelow()).isEqualTo(0.05);
    }

    @Test
    void testGraph_shouldHideDeletedByDefaultAndShowThemWhenAsked() {
        RegisteredUser anna = registerUser("Anna");
        GraphNodeEntity live = graphPopulator.createNode(anna.id(), GraphNodeEntity.KIND_PATTERN, "Élő");
        GraphNodeEntity gone = graphPopulator.createNode(anna.id(), GraphNodeEntity.KIND_PATTERN, "Törölt");
        graphPopulator.softDeleteNode(gone);

        AdminMemoryGraphResponse hidden = getForBody(graphUri(anna.id()),
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryGraphResponse.class);
        AdminMemoryGraphResponse shown = getForBody(graphUri(anna.id()) + "?includeDeleted=true",
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryGraphResponse.class);

        assertThat(hidden.getNodes()).extracting(AdminMemoryGraphNode::getId)
                .containsExactly(live.getId());
        assertThat(shown.getNodes()).extracting(AdminMemoryGraphNode::getId)
                .containsExactlyInAnyOrder(live.getId(), gone.getId());
        assertThat(shown.getNodes()).filteredOn(node -> node.getId().equals(gone.getId()))
                .singleElement()
                .extracting(AdminMemoryGraphNode::getDeleted)
                .isEqualTo(true);
    }

    @Test
    void testGraph_shouldNotShipDanglingEdges_whenOneEndpointIsFiltered() {
        RegisteredUser anna = registerUser("Anna");
        GraphNodeEntity from = graphPopulator.createNode(anna.id(), GraphNodeEntity.KIND_PATTERN, "Futás");
        GraphNodeEntity to = graphPopulator.createNode(anna.id(), GraphNodeEntity.KIND_GOAL, "Jó alvás");
        graphPopulator.createEdge(anna.id(), from.getId(), to.getId(), GraphEdgeEntity.KIND_TRIGGERS);
        graphPopulator.softDeleteNode(to);

        AdminMemoryGraphResponse hidden = getForBody(graphUri(anna.id()),
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryGraphResponse.class);
        AdminMemoryGraphResponse shown = getForBody(graphUri(anna.id()) + "?includeDeleted=true",
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryGraphResponse.class);

        // d3-force throws on a link to a node id it never received, so a half-visible edge is
        // dropped rather than shipped dangling.
        assertThat(hidden.getEdges()).isEmpty();
        assertThat(shown.getEdges()).hasSize(1);
    }

    @Test
    void testGraph_shouldExcludeArchivedByDefault() {
        RegisteredUser anna = registerUser("Anna");
        GraphNodeEntity active = graphPopulator.createNode(anna.id(), GraphNodeEntity.KIND_PATTERN, "Aktív");
        GraphNodeEntity archived = graphPopulator.createNodeWithStatus(anna.id(),
                GraphNodeEntity.KIND_PATTERN, "Archivált", GraphNodeEntity.STATUS_ARCHIVED);

        AdminMemoryGraphResponse hidden = getForBody(graphUri(anna.id()),
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryGraphResponse.class);
        AdminMemoryGraphResponse shown = getForBody(graphUri(anna.id()) + "?includeArchived=true",
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryGraphResponse.class);

        assertThat(hidden.getNodes()).extracting(AdminMemoryGraphNode::getId)
                .containsExactly(active.getId());
        assertThat(shown.getNodes()).extracting(AdminMemoryGraphNode::getId)
                .containsExactlyInAnyOrder(active.getId(), archived.getId());
    }

    @Test
    void testGraph_shouldNeverLeakAnotherUsersNodes() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bea = registerUser("Bea");
        GraphNodeEntity annas = graphPopulator.createNode(anna.id(), GraphNodeEntity.KIND_PATTERN, "Anna");
        graphPopulator.createNode(bea.id(), GraphNodeEntity.KIND_PATTERN, "Bea");

        AdminMemoryGraphResponse response = getForBody(graphUri(anna.id()),
                ownerAuthHeaders(), HttpStatus.OK, AdminMemoryGraphResponse.class);

        assertThat(response.getNodes()).extracting(AdminMemoryGraphNode::getId)
                .containsExactly(annas.getId());
    }

    private static String graphUri(UUID userId) {
        return "/api/admin/users/" + userId + "/memory/graph";
    }
}
