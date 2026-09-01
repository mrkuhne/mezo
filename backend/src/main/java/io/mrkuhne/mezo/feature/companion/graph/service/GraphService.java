package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEvidence;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphEdgeRepository;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Knowledge-graph node/edge CRUD (Phase 5 W2.1, bd mezo-b3pp.6, spec §4.2/§6.1). {@link
 * #upsertNode}/{@link #upsertEdge} are the idempotent promotion primitives later slices call —
 * W2.2's pattern/fact/goal promotion, W2.3's life-event confirm — never insert directly. Gated
 * {@code KNOWLEDGE_GRAPH_SWITCH}.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH, havingValue = "true")
public class GraphService {

    private final GraphNodeRepository nodeRepository;
    private final GraphEdgeRepository edgeRepository;

    /** UPSERT by (createdBy, sourceKind, sourceId) — re-promotion updates title/summary/meta, never duplicates. */
    @Transactional
    public GraphNodeEntity upsertNode(UUID userId, String kind, String title, String summary,
            String sourceKind, UUID sourceId, LocalDate occurredOn, Map<String, Object> meta) {
        GraphNodeEntity node = (sourceKind != null && sourceId != null)
            ? nodeRepository.findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(userId, sourceKind, sourceId)
                .orElseGet(GraphNodeEntity::new)
            : new GraphNodeEntity();
        node.setCreatedBy(userId);
        node.setKind(kind);
        node.setTitle(title);
        node.setSummary(summary);
        node.setSourceKind(sourceKind);
        node.setSourceId(sourceId);
        node.setOccurredOn(occurredOn);
        node.setMeta(meta);
        return nodeRepository.saveAndFlush(node);
    }

    /** Read-only twin of {@link #upsertNode}'s idempotency key — W2.2 uses it to tell a freshly
     *  created node from a re-promotion (only a NEW node pays for the LLM edge structurer). */
    @Transactional(readOnly = true)
    public Optional<GraphNodeEntity> findBySource(UUID userId, String sourceKind, UUID sourceId) {
        return nodeRepository.findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(userId, sourceKind, sourceId);
    }

    /** MERGE a single meta key onto an owned node (code review fix, S5 mezo-06o0.4) — unlike
     *  {@link #upsertNode}, which replaces the whole {@code meta} map, this only ever adds/updates
     *  ONE key, so a caller that owns a narrow slice of the jsonb (e.g. {@code
     *  PersonExtractionService.linkPersonEdges}'s {@code edgeStructuredOn} marker) can never
     *  clobber keys another caller (e.g. {@code GraphPromotionService.syncPerson}) owns. */
    @Transactional
    public GraphNodeEntity putMeta(UUID userId, UUID nodeId, String key, Object value) {
        GraphNodeEntity node = findOwnedNode(userId, nodeId);
        Map<String, Object> meta = node.getMeta() == null ? new HashMap<>() : new HashMap<>(node.getMeta());
        meta.put(key, value);
        node.setMeta(meta);
        return nodeRepository.saveAndFlush(node);
    }

    @Transactional(readOnly = true)
    public List<GraphNodeEntity> listActive(UUID userId) {
        return nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
            userId, GraphNodeEntity.STATUS_ACTIVE);
    }

    /** Fixed UI display cap — not a {@code CompanionProperties.Graph} tuning knob, this is
     *  presentation, not graph behavior. */
    private static final int TOP_EDGES_PER_NODE = 3;

    /** W2.6 (mezo-b3pp.11, spec §6.6): one active node + its strongest touching edges,
     *  pre-rendered as Hungarian text lines for the Tudástár "Kapcsolatok" surface. */
    public record NodeWithTopEdges(GraphNodeEntity node, List<String> topEdgeLines) {
    }

    /**
     * Active nodes plus each node's top-{@value #TOP_EDGES_PER_NODE} touching edges (both
     * directions), rendered via {@link GraphEdgeLineRenderer} — the same renderer {@code
     * GraphPromptAssembler} uses for the {@code [Összefüggések]} prompt block. An edge whose
     * OTHER endpoint is archived/candidate/deleted is dropped entirely: a line that names a node
     * no longer in "current knowledge" would confuse the surface, not inform it.
     */
    @Transactional(readOnly = true)
    public List<NodeWithTopEdges> listActiveWithTopEdges(UUID userId) {
        List<GraphNodeEntity> nodes = listActive(userId);
        if (nodes.isEmpty()) {
            return List.of();
        }
        Map<UUID, String> titleById = nodes.stream()
            .collect(Collectors.toMap(GraphNodeEntity::getId, GraphNodeEntity::getTitle));
        Map<UUID, List<GraphEdgeEntity>> touchingByNode = new HashMap<>();
        for (GraphEdgeEntity edge : edgeRepository.findByCreatedByAndDeletedFalse(userId)) {
            if (!titleById.containsKey(edge.getFromNodeId()) || !titleById.containsKey(edge.getToNodeId())) {
                continue;
            }
            touchingByNode.computeIfAbsent(edge.getFromNodeId(), k -> new ArrayList<>()).add(edge);
            touchingByNode.computeIfAbsent(edge.getToNodeId(), k -> new ArrayList<>()).add(edge);
        }
        return nodes.stream()
            .map(node -> new NodeWithTopEdges(node, topEdgeLines(node.getId(), touchingByNode, titleById)))
            .toList();
    }

    private List<String> topEdgeLines(UUID nodeId, Map<UUID, List<GraphEdgeEntity>> touchingByNode,
            Map<UUID, String> titleById) {
        return touchingByNode.getOrDefault(nodeId, List.of()).stream()
            .sorted(Comparator.comparing(GraphEdgeEntity::getWeight).reversed()
                .thenComparing(GraphEdgeEntity::getId))
            .limit(TOP_EDGES_PER_NODE)
            .map(e -> GraphEdgeLineRenderer.renderLine(e.getKind(),
                titleById.get(e.getFromNodeId()), titleById.get(e.getToNodeId()), e.getWeight()))
            .toList();
    }

    /**
     * W2.3 (spec §6.3): one AI-proposed candidate node, of whatever {@code kind} the caller
     * proposes — kind-agnostic since W5.3 (mezo-b3pp.20), and two callers now write two different
     * kinds through it: {@code LifeEventExtractionService} proposes {@code LIFE_EVENT} candidates
     * off a day's texts, {@code QuarterlyReviewService.persistCandidates} proposes {@code SEASON}
     * candidates off a finished quarter's month rungs. They differ only in what they pass; the
     * write, the status and the inbox they land in are the same, which is why both are decided
     * through the one kind-agnostic {@code LifeEventCandidateService.decide}.
     *
     * <p>Deliberately NOT an upsert — candidates carry {@code sourceId = null}, so {@code
     * uq_knowledge_node_source} does not apply and there is no key to update on; each caller's own
     * period-scoped dedupe probe ({@code countExtractorNodesOnDay} for a day,
     * {@code countQuarterlyNodesOnQuarter} for a quarter) is what keeps a re-run from proposing
     * the same period twice.
     *
     * <p>Status is {@code candidate}: IDENT-6 says nothing the AI derives becomes durable without
     * an explicit decision.
     */
    @Transactional
    public GraphNodeEntity createCandidate(UUID userId, String kind, String title, String summary,
            String sourceKind, LocalDate occurredOn, Map<String, Object> meta) {
        GraphNodeEntity node = new GraphNodeEntity();
        node.setCreatedBy(userId);
        node.setKind(kind);
        node.setTitle(title);
        node.setSummary(summary);
        node.setStatus(GraphNodeEntity.STATUS_CANDIDATE);
        node.setSourceKind(sourceKind);
        node.setOccurredOn(occurredOn);
        node.setMeta(meta);
        return nodeRepository.saveAndFlush(node);
    }

    @Transactional(readOnly = true)
    public List<GraphNodeEntity> listCandidates(UUID userId) {
        return nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
            userId, GraphNodeEntity.STATUS_CANDIDATE);
    }

    @Transactional
    public GraphNodeEntity archive(UUID userId, UUID nodeId) {
        GraphNodeEntity node = findOwnedNode(userId, nodeId);
        node.setStatus(GraphNodeEntity.STATUS_ARCHIVED);
        return nodeRepository.saveAndFlush(node);
    }

    /** UPSERT by (createdBy, fromNodeId, toNodeId, kind) — re-proposing the same edge updates weight/evidence. */
    @Transactional
    public GraphEdgeEntity upsertEdge(UUID userId, UUID fromNodeId, UUID toNodeId, String kind,
            BigDecimal weight, List<GraphEdgeEvidence> evidence) {
        GraphEdgeEntity edge = edgeRepository
            .findByCreatedByAndFromNodeIdAndToNodeIdAndKindAndDeletedFalse(userId, fromNodeId, toNodeId, kind)
            .orElseGet(GraphEdgeEntity::new);
        edge.setCreatedBy(userId);
        edge.setFromNodeId(fromNodeId);
        edge.setToNodeId(toNodeId);
        edge.setKind(kind);
        if (weight != null) {
            edge.setWeight(weight);
        }
        edge.setEvidence(evidence);
        return edgeRepository.saveAndFlush(edge);
    }

    @Transactional(readOnly = true)
    public List<GraphEdgeEntity> edgesFrom(UUID userId, UUID nodeId) {
        return edgeRepository.findByCreatedByAndFromNodeIdAndDeletedFalse(userId, nodeId);
    }

    @Transactional(readOnly = true)
    public List<GraphEdgeEntity> edgesTo(UUID userId, UUID nodeId) {
        return edgeRepository.findByCreatedByAndToNodeIdAndDeletedFalse(userId, nodeId);
    }

    private GraphNodeEntity findOwnedNode(UUID userId, UUID nodeId) {
        return nodeRepository.findByIdAndCreatedByAndDeletedFalse(nodeId, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("GRAPH_NODE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
