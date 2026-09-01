package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GraphNodeResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphEdgeRepository;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * HTTP-level contract IT for the W2.3 L2 confirm inbox (bd mezo-b3pp.8, spec §6.3) — the
 * generated {@code KnowledgeGraphApi} candidate list + decision endpoints: extraction only ever
 * proposes ({@code status=candidate}, edges parked in {@code meta.proposedEdges}); accept
 * activates the node and creates its proposed edges, reject leaves no residue anywhere.
 */
class GraphCandidateApiIT extends ApiIntegrationTest {

    private static final String CANDIDATE = "/api/companion/graph/node/candidate";

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private GraphPopulator graphPopulator;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private GraphEdgeRepository edgeRepository;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private GraphNodeEntity candidateWithEdgeTo(UUID owner, GraphNodeEntity target, double confidence) {
        return graphPopulator.createCandidateNode(owner, GraphNodeEntity.KIND_LIFE_EVENT,
            "Új munkahely első hete", LocalDate.of(2026, 8, 21),
            Map.of("proposedEdges", List.of(Map.of(
                "toNodeId", target.getId().toString(), "kind", "TRIGGERS", "confidence", confidence))));
    }

    @Test
    void testListGraphCandidates_shouldReturnOnlyCandidates_whenActiveNodesAlsoExist() {
        UUID owner = ownerId();
        GraphNodeEntity active = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Aktív minta");
        candidateWithEdgeTo(owner, active, 0.8);

        List<GraphNodeResponse> candidates = getForList(CANDIDATE, ownerAuthHeaders(),
            HttpStatus.OK, GraphNodeResponse.class);

        assertThat(candidates).hasSize(1);
        GraphNodeResponse candidate = candidates.getFirst();
        assertThat(candidate.getTitle()).isEqualTo("Új munkahely első hete");
        assertThat(candidate.getStatus()).isEqualTo(GraphNodeResponse.StatusEnum.CANDIDATE);
        assertThat(candidate.getOccurredOn()).isEqualTo(LocalDate.of(2026, 8, 21));
        assertThat(candidate.getProposedEdgeCount()).isEqualTo(1);
    }

    @Test
    void testDecideGraphCandidate_shouldActivateNodeAndCreateProposedEdges_whenAccepted() {
        UUID owner = ownerId();
        GraphNodeEntity active = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Aktív minta");
        GraphNodeEntity candidate = candidateWithEdgeTo(owner, active, 0.8);

        GraphNodeResponse decided = postForBody("/api/companion/graph/node/" + candidate.getId() + "/decision",
            Map.of("decision", "accept"), ownerAuthHeaders(), HttpStatus.OK, GraphNodeResponse.class);

        assertThat(decided.getStatus()).isEqualTo(GraphNodeResponse.StatusEnum.ACTIVE);
        // the accept response itself must not still claim the (already-materialised) proposal
        // (GraphMapper.proposedEdgeCount is 0 for any non-candidate node, even though the node's
        // meta.proposedEdges list is left untouched — the status check is load-bearing there)
        assertThat(decided.getProposedEdgeCount()).isZero();
        assertThat(nodeRepository.findById(candidate.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
        List<GraphEdgeEntity> edges = edgeRepository.findAll();
        assertThat(edges).hasSize(1);
        assertThat(edges.getFirst().getFromNodeId()).isEqualTo(candidate.getId());
        assertThat(edges.getFirst().getToNodeId()).isEqualTo(active.getId());
        assertThat(edges.getFirst().getKind()).isEqualTo(GraphEdgeEntity.KIND_TRIGGERS);
        // edges start humble: weight = confidence x 0.5 (the W2.2 structurer rule)
        assertThat(edges.getFirst().getWeight()).isEqualByComparingTo("0.400");
        assertThat(edges.getFirst().getEvidence()).singleElement()
            .satisfies(e -> assertThat(e.sourceKind()).isEqualTo("extractor"));

        // and the same honest 0 shows up when the now-active node is read back through the
        // ordinary active-node list, not just in the one-shot decision response
        List<GraphNodeResponse> activeNodes = getForList("/api/companion/graph/node", ownerAuthHeaders(),
            HttpStatus.OK, GraphNodeResponse.class);
        assertThat(activeNodes).filteredOn(n -> n.getId().equals(candidate.getId()))
            .singleElement()
            .satisfies(n -> assertThat(n.getProposedEdgeCount()).isZero());
    }

    @Test
    void testDecideGraphCandidate_shouldSkipProposedEdge_whenTargetNodeIsGone() {
        UUID owner = ownerId();
        GraphNodeEntity active = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Aktív minta");
        GraphNodeEntity candidate = candidateWithEdgeTo(owner, active, 0.8);
        nodeRepository.delete(active);   // soft-delete: the target vanished before the decision

        GraphNodeResponse decided = postForBody("/api/companion/graph/node/" + candidate.getId() + "/decision",
            Map.of("decision", "accept"), ownerAuthHeaders(), HttpStatus.OK, GraphNodeResponse.class);

        assertThat(decided.getStatus()).isEqualTo(GraphNodeResponse.StatusEnum.ACTIVE);
        assertThat(edgeRepository.findAll()).isEmpty();
    }

    @Test
    void testDecideGraphCandidate_shouldAcceptButCreateNoEdges_whenProposedEdgesAreMalformed() {
        // review finding #2 (mezo-b3pp.8): the confirm boundary must not trust stored meta JSON —
        // an out-of-range confidence, an unknown kind, and a self-loop must each be dropped rather
        // than reaching GraphService.upsertEdge (where they would violate a DB CHECK and turn an
        // accept into a 500 rollback).
        UUID owner = ownerId();
        GraphNodeEntity active = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Aktív minta");
        GraphNodeEntity candidate = graphPopulator.createCandidateNode(owner, GraphNodeEntity.KIND_LIFE_EVENT,
            "Gyanús javaslatok", LocalDate.of(2026, 8, 21), Map.of("proposedEdges", List.of(
                Map.of("toNodeId", active.getId().toString(), "kind", "TRIGGERS", "confidence", 5),
                Map.of("toNodeId", active.getId().toString(), "kind", "UNKNOWN_KIND", "confidence", 0.5))));
        // a proposal pointing back at the candidate's own (not-yet-assigned) id can't be set up
        // ahead of time, so add it once the id is known, directly on the persisted row's meta.
        GraphNodeEntity selfLoop = nodeRepository.findById(candidate.getId()).orElseThrow();
        selfLoop.setMeta(Map.of("proposedEdges", List.of(
            Map.of("toNodeId", active.getId().toString(), "kind", "TRIGGERS", "confidence", 5),
            Map.of("toNodeId", active.getId().toString(), "kind", "UNKNOWN_KIND", "confidence", 0.5),
            Map.of("toNodeId", candidate.getId().toString(), "kind", "TRIGGERS", "confidence", 0.8))));
        nodeRepository.saveAndFlush(selfLoop);

        GraphNodeResponse decided = postForBody("/api/companion/graph/node/" + candidate.getId() + "/decision",
            Map.of("decision", "accept"), ownerAuthHeaders(), HttpStatus.OK, GraphNodeResponse.class);

        assertThat(decided.getStatus()).isEqualTo(GraphNodeResponse.StatusEnum.ACTIVE);
        assertThat(edgeRepository.findAll()).isEmpty();
    }

    @Test
    void testDecideGraphCandidate_shouldReturn404_whenNotOwnCandidate() {
        UUID otherUser = userPopulator.createUser().getId();
        GraphNodeEntity candidate = graphPopulator.createCandidateNode(otherUser, GraphNodeEntity.KIND_LIFE_EVENT,
            "Nem az enyém.", LocalDate.of(2026, 8, 21), Map.of("proposedEdges", List.of()));

        String body = postForBody("/api/companion/graph/node/" + candidate.getId() + "/decision",
            Map.of("decision", "accept"), ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "GRAPH_NODE_NOT_FOUND");
    }

    @Test
    void testListGraphCandidates_shouldNotIncludeAnotherUsersCandidate() {
        UUID owner = ownerId();
        UUID otherUser = userPopulator.createUser().getId();
        graphPopulator.createCandidateNode(otherUser, GraphNodeEntity.KIND_LIFE_EVENT,
            "Nem az enyém.", LocalDate.of(2026, 8, 21), Map.of("proposedEdges", List.of()));
        GraphNodeEntity active = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Aktív minta");
        candidateWithEdgeTo(owner, active, 0.8);

        List<GraphNodeResponse> candidates = getForList(CANDIDATE, ownerAuthHeaders(),
            HttpStatus.OK, GraphNodeResponse.class);

        assertThat(candidates).extracting(GraphNodeResponse::getTitle).containsExactly("Új munkahely első hete");
    }

    @Test
    void testDecideGraphCandidate_shouldLeaveNoResidue_whenRejected() {
        UUID owner = ownerId();
        GraphNodeEntity active = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Aktív minta");
        GraphNodeEntity candidate = candidateWithEdgeTo(owner, active, 0.8);

        postForBody("/api/companion/graph/node/" + candidate.getId() + "/decision",
            Map.of("decision", "reject"), ownerAuthHeaders(), HttpStatus.OK, GraphNodeResponse.class);

        assertThat(nodeRepository.findById(candidate.getId())).isEmpty();   // @SQLRestriction hides it
        assertThat(edgeRepository.findAll()).isEmpty();
        List<GraphNodeResponse> candidates = getForList(CANDIDATE, ownerAuthHeaders(),
            HttpStatus.OK, GraphNodeResponse.class);
        assertThat(candidates).isEmpty();
    }

    @Test
    void testDecideGraphCandidate_shouldReturn400_whenAlreadyDecided() {
        UUID owner = ownerId();
        GraphNodeEntity active = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Aktív minta");
        GraphNodeEntity candidate = candidateWithEdgeTo(owner, active, 0.8);
        String url = "/api/companion/graph/node/" + candidate.getId() + "/decision";

        postForBody(url, Map.of("decision", "accept"), ownerAuthHeaders(), HttpStatus.OK, GraphNodeResponse.class);
        String body = postForBody(url, Map.of("decision", "accept"), ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "GRAPH_CANDIDATE_ALREADY_DECIDED");
    }

    @Test
    void testDecideGraphCandidate_shouldApplyRefinedTitle_whenAcceptedWithRefinedTitle() {
        UUID owner = ownerId();
        GraphNodeEntity active = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Aktív minta");
        GraphNodeEntity candidate = candidateWithEdgeTo(owner, active, 0.8);

        GraphNodeResponse decided = postForBody("/api/companion/graph/node/" + candidate.getId() + "/decision",
            Map.of("decision", "accept", "refinedTitle", "Finomított cím"), ownerAuthHeaders(),
            HttpStatus.OK, GraphNodeResponse.class);

        assertThat(decided.getTitle()).isEqualTo("Finomított cím");
        assertThat(nodeRepository.findById(candidate.getId()).orElseThrow().getTitle())
            .isEqualTo("Finomított cím");
    }

    @Test
    void testDecideGraphCandidate_shouldApplyRefinedSummary_whenAcceptedWithRefinedSummary() {
        UUID owner = ownerId();
        GraphNodeEntity active = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Aktív minta");
        GraphNodeEntity candidate = candidateWithEdgeTo(owner, active, 0.8);

        GraphNodeResponse decided = postForBody("/api/companion/graph/node/" + candidate.getId() + "/decision",
            Map.of("decision", "accept", "refinedSummary", "Finomított összegzés"), ownerAuthHeaders(),
            HttpStatus.OK, GraphNodeResponse.class);

        assertThat(decided.getSummary()).isEqualTo("Finomított összegzés");
        assertThat(nodeRepository.findById(candidate.getId()).orElseThrow().getSummary())
            .isEqualTo("Finomított összegzés");
    }

    @Test
    void testDecideGraphCandidate_shouldIgnoreRefinedFields_whenRejected() {
        UUID owner = ownerId();
        GraphNodeEntity active = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Aktív minta");
        GraphNodeEntity candidate = candidateWithEdgeTo(owner, active, 0.8);

        postForBody("/api/companion/graph/node/" + candidate.getId() + "/decision",
            Map.of("decision", "reject", "refinedTitle", "Nem számít", "refinedSummary", "Ez sem"),
            ownerAuthHeaders(), HttpStatus.OK, GraphNodeResponse.class);

        assertThat(nodeRepository.findById(candidate.getId())).isEmpty();   // @SQLRestriction hides it
        assertThat(edgeRepository.findAll()).isEmpty();
    }

    @Test
    void testDecideGraphCandidate_shouldReturn404_whenNodeIsUnknown() {
        ownerId();
        String body = postForBody("/api/companion/graph/node/" + UUID.randomUUID() + "/decision",
            Map.of("decision", "accept"), ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "GRAPH_NODE_NOT_FOUND");
    }
}
