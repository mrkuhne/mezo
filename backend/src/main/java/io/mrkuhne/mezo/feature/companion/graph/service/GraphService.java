package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEvidence;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphEdgeRepository;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

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
    // A meta-patch jsonb szövegét írja — a natív MERGE UPDATE paramétere (mezo-06o0.7).
    private final ObjectMapper objectMapper;
    // Ugyanahhoz: a natív merge után a node-ot (és csak azt) újraolvassuk.
    private final EntityManager entityManager;
    // ObjectProvider, nem közvetlen függés: a promóter @ConditionalOnProperty mögött van, és a
    // közvetlen injektálás kör-függést zárna (GraphPromotionService -> GraphService).
    private final ObjectProvider<GraphPromotionService> promotionService;

    /**
     * UPSERT by (createdBy, sourceKind, sourceId) — re-promotion updates title/summary/meta, never
     * duplicates. A {@code null} {@code meta} means LEAVE THE EXISTING META ALONE (bd mezo-06o0.7):
     * a caller that owns only a few keys upserts with {@code null} and follows up with {@link
     * #mergeMeta}, instead of reading-merging-writing the whole map across two statements.
     */
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
        if (meta != null) {
            node.setMeta(meta);
        }
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
        return mergeMeta(userId, nodeId, Map.of(key, value));
    }

    /**
     * MERGE több meta-kulcsot EGYETLEN atomi UPDATE-tel (bd mezo-06o0.7). A korábbi
     * read-modify-write alak READ COMMITTED alatt lost-update ablakot nyitott: ha egy @Async
     * {@code PersonSavedEvent} szinkron beleszaladt az éjszakai kör {@code putMeta}-jába ugyanazon
     * a node-on, az egyik írás eldobta a másik kulcsát — és ha az elveszett kulcs az
     * {@code edgeStructuredOn} volt, újranyílt a „legfeljebb egyszer" LLM-kapu. A {@code jsonb ||}
     * a soron belül, a sor zárolása alatt olvassa a régi értéket, tehát nincs mit elveszíteni.
     *
     * <p>A {@code findOwnedNode} a tulajdonlás-kapu (idegen node ⇒ 404). A natív írás megkerüli a
     * persistence contextet, ezért utána a node-ot — és CSAK azt — frissítjük: egy teljes
     * {@code clear()} leválasztaná a hívó többi entitását is (a {@code restore} pont ezért mentett
     * vissza elavult státuszt), a frissítés viszont ugyanazt a managed példányt adja tovább.
     */
    @Transactional
    public GraphNodeEntity mergeMeta(UUID userId, UUID nodeId, Map<String, Object> patch) {
        GraphNodeEntity node = findOwnedNode(userId, nodeId);
        if (patch.isEmpty()) {
            return node;
        }
        nodeRepository.mergeMeta(userId, nodeId, objectMapper.writeValueAsString(patch));
        entityManager.refresh(node);
        return node;
    }

    @Transactional(readOnly = true)
    public List<GraphNodeEntity> listActive(UUID userId) {
        return nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
            userId, GraphNodeEntity.STATUS_ACTIVE);
    }

    /** Count of active edges for the current user — same "active edge" filter as {@link
     *  #listActiveWithTopEdges}'s edge source. */
    @Transactional(readOnly = true)
    public int countActiveEdges(UUID userId) {
        return edgeRepository.countActiveByUserId(userId);
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
        Map<UUID, List<GraphEdgeEntity>> touchingByNode = touchingEdgesByNode(userId, titleById.keySet());
        return nodes.stream()
            .map(node -> new NodeWithTopEdges(node, topEdgeLines(node.getId(), touchingByNode, titleById)))
            .toList();
    }

    /**
     * Minden BELSŐ él (mindkét végpontja a megadott node-halmazban) csomópontonként csoportosítva,
     * EGY lekérdezésből (bd mezo-06o0.6). Ez a ház idiómája a „node-onként edgesFrom + edgesTo"
     * N+1 helyett — a {@link #listActiveWithTopEdges} és a {@code PersonGraphEdgeAdapter} is
     * ezen áll, hogy a két felület ugyanazt az „aktív él" szabályt lássa.
     *
     * <p>Egy önhurok (from == to) ugyanahhoz a node-hoz KÉTSZER kerülne be, ezért kiszűrjük — a
     * korábbi {@code edgesFrom + edgesTo} összefűzés is duplán tartalmazta volna.
     */
    @Transactional(readOnly = true)
    public Map<UUID, List<GraphEdgeEntity>> touchingEdgesByNode(UUID userId, Set<UUID> nodeIds) {
        Map<UUID, List<GraphEdgeEntity>> touchingByNode = new HashMap<>();
        if (nodeIds.isEmpty()) {
            return touchingByNode;
        }
        for (GraphEdgeEntity edge : edgeRepository.findByCreatedByAndDeletedFalse(userId)) {
            if (!nodeIds.contains(edge.getFromNodeId()) || !nodeIds.contains(edge.getToNodeId())) {
                continue;
            }
            touchingByNode.computeIfAbsent(edge.getFromNodeId(), k -> new ArrayList<>()).add(edge);
            if (!edge.getFromNodeId().equals(edge.getToNodeId())) {
                touchingByNode.computeIfAbsent(edge.getToNodeId(), k -> new ArrayList<>()).add(edge);
            }
        }
        return touchingByNode;
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
        if (meta != null) {
            node.setMeta(meta);
        }
        return nodeRepository.saveAndFlush(node);
    }

    @Transactional(readOnly = true)
    public List<GraphNodeEntity> listCandidates(UUID userId) {
        return nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
            userId, GraphNodeEntity.STATUS_CANDIDATE);
    }

    /** A felhasználó kézi archiválása (mezo-06o0.5): a státusz mellé a SZÁNDÉK is rögzül, és
     *  ettől kezdve a promóciós szinkron nem emelheti vissza aktívra — a rejtés csak
     *  {@link #restore} útján oldható. */
    @Transactional
    public GraphNodeEntity archive(UUID userId, UUID nodeId) {
        GraphNodeEntity node = findOwnedNode(userId, nodeId);
        node.setStatus(GraphNodeEntity.STATUS_ARCHIVED);
        node.setUserArchivedAt(OffsetDateTime.now());
        return nodeRepository.saveAndFlush(node);
    }

    /**
     * A kézi archiválás visszavonása (mezo-06o0.5): a szándék-marker törlődik, és a státusz
     * AZONNAL a forrásból származik újra — nem vakon `active`, mert a forrás közben inaktívvá
     * válhatott, és akkor a hajnali reconcile csendben visszaarchiválná (spec D5).
     *
     * <p><b>Csak KÉZZEL archivált node-on hívható (code review finding, mezo-06o0.5).</b> Enélkül
     * egy {@code candidate} node — aminek az id-je publikus a {@code GET
     * .../node/candidate} listán, és aminek {@code sourceId}-je null — {@link #resyncNode}
     * forrás-nélküli ágán keresztül egyenesen {@code active}-ra emelkedne, megkerülve {@code
     * LifeEventCandidateService.decide}-ot: a már eldöntött-e kaput, a finomított
     * címet/összefoglalót és a proposedEdges materializációt. Ugyanígy egy GÉPI úton (pl.
     * {@code retractPattern}) archivált node sem "visszaállítandó" ezen az úton — annak a
     * forrásnak kell újra kvalifikálnia, nem egy explicit felhasználói kattintásnak. A ház elve:
     * amit az AI derivál, felhasználói döntés nélkül soha nem válik tartóssá.
     */
    @Transactional
    public GraphNodeEntity restore(UUID userId, UUID nodeId) {
        GraphNodeEntity node = findOwnedNode(userId, nodeId);
        if (!node.isUserArchived()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("GRAPH_NODE_NOT_USER_ARCHIVED").build(), HttpStatus.CONFLICT);
        }
        node.setUserArchivedAt(null);
        GraphPromotionService promoter = promotionService.getIfAvailable();
        if (promoter == null) {
            // Defensive only: GraphService and GraphPromotionService share the same
            // @ConditionalOnProperty gate (KNOWLEDGE_GRAPH_SWITCH), so whenever this bean exists
            // to be called, the promoter bean exists too — this branch is unreachable in practice.
            node.setStatus(GraphNodeEntity.STATUS_ACTIVE);
        } else {
            promoter.resyncNode(userId, node);
        }
        return nodeRepository.saveAndFlush(node);
    }

    /** A kézzel archivált node-ok, legutóbb elrejtett elöl. */
    @Transactional(readOnly = true)
    public List<GraphNodeEntity> listUserArchived(UUID userId) {
        return nodeRepository
            .findByCreatedByAndUserArchivedAtIsNotNullAndDeletedFalseOrderByUserArchivedAtDesc(userId);
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
