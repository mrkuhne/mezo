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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
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

    @Transactional(readOnly = true)
    public List<GraphNodeEntity> listActive(UUID userId) {
        return nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
            userId, GraphNodeEntity.STATUS_ACTIVE);
    }

    /** W2.3 (spec §6.3): a LIFE_EVENT candidate the extractor proposed. Deliberately NOT an
     *  upsert — extractor candidates carry {@code sourceId = null}, so {@code
     *  uq_knowledge_node_source} does not apply and there is no key to update on; a later slice's
     *  own day-scoped dedupe probe is what keeps a re-run from proposing the same night twice.
     *  Status is {@code candidate}: IDENT-6 says nothing the AI derives becomes durable without
     *  an explicit decision. */
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
