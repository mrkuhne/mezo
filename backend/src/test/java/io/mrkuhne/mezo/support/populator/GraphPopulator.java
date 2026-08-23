package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphEdgeRepository;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.transaction.annotation.Transactional;

/** Test data factory for GraphNodeEntity/GraphEdgeEntity — persists via {@code saveAndFlush} so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class GraphPopulator {

    private final GraphNodeRepository nodeRepository;
    private final GraphEdgeRepository edgeRepository;

    /** JPA-managed shared EntityManager — the {@code @CreationTimestamp} backdate needs a native
     *  update; field-injected {@code @PersistenceContext} is the house exception to constructor DI
     *  (the {@code FeedbackPopulator} precedent). */
    @PersistenceContext
    private EntityManager em;

    public GraphNodeEntity createNode(UUID owner, String kind, String title) {
        GraphNodeEntity n = new GraphNodeEntity();
        n.setCreatedBy(owner);
        n.setKind(kind);
        n.setTitle(title);
        return nodeRepository.saveAndFlush(n);
    }

    public GraphEdgeEntity createEdge(UUID owner, UUID fromNodeId, UUID toNodeId, String kind) {
        GraphEdgeEntity e = new GraphEdgeEntity();
        e.setCreatedBy(owner);
        e.setFromNodeId(fromNodeId);
        e.setToNodeId(toNodeId);
        e.setKind(kind);
        return edgeRepository.saveAndFlush(e);
    }

    /** W2.4 (mezo-b3pp.9): an edge with an explicit weight — traversal tests pin weight ordering. */
    public GraphEdgeEntity createEdge(UUID owner, UUID fromNodeId, UUID toNodeId, String kind, String weight) {
        GraphEdgeEntity e = new GraphEdgeEntity();
        e.setCreatedBy(owner);
        e.setFromNodeId(fromNodeId);
        e.setToNodeId(toNodeId);
        e.setKind(kind);
        e.setWeight(new BigDecimal(weight));
        return edgeRepository.saveAndFlush(e);
    }

    /** W2.3 (mezo-b3pp.8): a pending LIFE_EVENT candidate exactly as the extractor writes it —
     *  status=candidate, source_kind=extractor, occurred_on set, proposals parked in meta. */
    public GraphNodeEntity createCandidateNode(UUID owner, String kind, String title,
            LocalDate occurredOn, Map<String, Object> meta) {
        GraphNodeEntity n = new GraphNodeEntity();
        n.setCreatedBy(owner);
        n.setKind(kind);
        n.setTitle(title);
        n.setStatus(GraphNodeEntity.STATUS_CANDIDATE);
        n.setSourceKind("extractor");
        n.setOccurredOn(occurredOn);
        n.setMeta(meta);
        return nodeRepository.saveAndFlush(n);
    }

    /** W2.5 (mezo-b3pp.10): a candidate node with a controlled {@code created_at}, for
     *  deterministic stale-candidate-prune window tests — the {@code FeedbackPopulator
     *  .createVerdictAt} precedent. */
    @Transactional
    public GraphNodeEntity createCandidateNodeAt(UUID owner, String kind, String title,
            LocalDate occurredOn, Map<String, Object> meta, Instant createdAt) {
        GraphNodeEntity n = createCandidateNode(owner, kind, title, occurredOn, meta);
        em.createNativeQuery("update knowledge_node set created_at = :at where id = :id")
            .setParameter("at", createdAt).setParameter("id", n.getId()).executeUpdate();
        em.clear();
        return nodeRepository.findById(n.getId()).orElseThrow();
    }
}
