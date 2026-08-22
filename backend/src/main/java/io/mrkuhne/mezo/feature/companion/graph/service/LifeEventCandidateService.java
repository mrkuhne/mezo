package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.api.dto.GraphCandidateDecisionRequest;
import io.mrkuhne.mezo.api.dto.GraphNodeResponse;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEvidence;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphProposedEdge;
import io.mrkuhne.mezo.feature.companion.graph.mapper.GraphMapper;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The W2.3 L2 confirm inbox (bd mezo-b3pp.8, spec §6.3) — the {@code FactCandidateService.decide}
 * idiom for LIFE_EVENT candidates. Extraction only ever proposes ({@code status=candidate},
 * edges parked in {@code meta.proposedEdges}); this is the ONLY path that turns a proposal into
 * durable graph structure. One decision per candidate: a node that is no longer {@code candidate}
 * answers 400, never a silent second activation.
 *
 * <p>Reject is a soft delete, not an {@code archived} status: an un-confirmed guess must leave no
 * residue at all (spec's own acceptance wording), and archived is reserved for nodes that WERE
 * true and are being retired (W2.6's archive action).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH, havingValue = "true")
public class LifeEventCandidateService {

    /** {@code knowledge_edge.evidence[].sourceKind} for an edge born from a confirmed candidate. */
    public static final String EVIDENCE_SOURCE = "extractor";

    private final GraphService graphService;
    private final GraphNodeRepository nodeRepository;
    private final GraphMapper graphMapper;

    @Transactional(readOnly = true)
    public List<GraphNodeResponse> listPending(UUID userId) {
        return graphService.listCandidates(userId).stream().map(graphMapper::toResponse).toList();
    }

    @Transactional
    public GraphNodeResponse decide(UUID userId, UUID nodeId, GraphCandidateDecisionRequest request) {
        GraphNodeEntity node = nodeRepository.findByIdAndCreatedByAndDeletedFalse(nodeId, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("GRAPH_NODE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (!GraphNodeEntity.STATUS_CANDIDATE.equals(node.getStatus())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("GRAPH_CANDIDATE_ALREADY_DECIDED").build());
        }
        if ("reject".equals(request.getDecision())) {
            GraphNodeResponse response = graphMapper.toResponse(node);
            nodeRepository.delete(node);   // @SQLDelete soft delete — no edges were ever written
            return response;
        }
        node.setStatus(GraphNodeEntity.STATUS_ACTIVE);
        GraphNodeEntity active = nodeRepository.saveAndFlush(node);
        proposedEdges(active).forEach(edge -> createEdge(userId, active, edge));
        return graphMapper.toResponse(active);
    }

    /** Materialise one proposed edge — silently skipped when its target vanished (archived or
     *  soft-deleted) between extraction and the decision: a stale proposal must never block the
     *  confirmation of an otherwise good life event. */
    private void createEdge(UUID userId, GraphNodeEntity from, GraphProposedEdge proposed) {
        Optional<GraphNodeEntity> target = nodeRepository
            .findByIdAndCreatedByAndDeletedFalse(proposed.toNodeId(), userId)
            .filter(t -> GraphNodeEntity.STATUS_ACTIVE.equals(t.getStatus()));
        if (target.isEmpty()) {
            log.info("Skipping proposed edge from {} to vanished node {}", from.getId(), proposed.toNodeId());
            return;
        }
        BigDecimal weight = BigDecimal.valueOf(proposed.confidence())
            .multiply(new BigDecimal("0.5")).setScale(3, RoundingMode.HALF_UP);
        graphService.upsertEdge(userId, from.getId(), target.get().getId(), proposed.kind(), weight,
            List.of(new GraphEdgeEvidence(EVIDENCE_SOURCE, from.getId(),
                "life-event confirm confidence=" + proposed.confidence(), Instant.now())));
    }

    /** Read the typed envelope back out of the generic {@code meta} map. Anything malformed is
     *  dropped rather than thrown: a confirmed life event with one unreadable proposal is still a
     *  confirmed life event. */
    private List<GraphProposedEdge> proposedEdges(GraphNodeEntity node) {
        Object raw = node.getMeta() == null ? null : node.getMeta().get(GraphProposedEdge.META_KEY);
        if (!(raw instanceof List<?> list)) {
            return List.of();
        }
        return list.stream()
            .filter(Map.class::isInstance).map(Map.class::cast)
            .map(LifeEventCandidateService::toProposedEdge)
            .filter(Objects::nonNull)
            .toList();
    }

    private static GraphProposedEdge toProposedEdge(Map<?, ?> raw) {
        try {
            Object to = raw.get("toNodeId");
            Object kind = raw.get("kind");
            Object confidence = raw.get("confidence");
            if (to == null || kind == null || !(confidence instanceof Number number)) {
                return null;
            }
            return new GraphProposedEdge(UUID.fromString(to.toString()), kind.toString(), number.doubleValue());
        } catch (IllegalArgumentException e) {
            return null;   // not a UUID — a malformed proposal, never a failed confirmation
        }
    }
}
