package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEvidence;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * W2.2 cheap-LLM edge structurer (bd mezo-b3pp.7, spec §6.2): given a freshly promoted node and
 * the user's existing active nodes, propose typed edges. Suggestions below
 * {@code mezo.companion.graph.edge-confidence-floor} are dropped; of the survivors, at most
 * {@code mezo.companion.graph.top-k} are created (highest confidence first — the plan's locked
 * decision to reuse W2.4's traversal cap rather than add a second knob), each at
 * {@code weight = confidence × 0.5} — edges start humble and only W2.5 reinforcement raises them.
 * The candidate list handed to the model is bounded the same way (a small multiple of {@code
 * top-k}, newest first) so prompt size stays flat as the graph grows instead of scaling with the
 * user's total active node count.
 *
 * <p>IDENT-3: a failed, empty or unparseable answer means NO edges — never a failed promotion. The
 * caller has already persisted the node before this runs. Emptiness gate: with no other active
 * node there is nothing to link to and no LLM call is made.
 *
 * <p><b>Transaction shape (deliberate):</b> this method runs INSIDE the caller's (
 * {@code GraphPromotionService.promotePattern}) transaction — no {@code @Transactional} here, and
 * specifically NOT {@code REQUIRES_NEW}. {@code REQUIRES_NEW} was tried and reverted: for a
 * genuinely NEW node (the only case this method runs for) the node is flushed but not yet
 * committed in the outer transaction, so a separate transaction inserting {@code knowledge_edge}
 * rows against it deterministically fails {@code fk_knowledge_edge_from_node_id_knowledge_node_id}
 * under read-committed isolation — confirmed by running the IT suite with that propagation:
 * every edge-creating test failed with that exact FK violation (surfacing as {@code
 * UnexpectedRollbackException} once caught and swallowed here, since the SAME failure mode this
 * paragraph exists to explain). So promotion is genuinely all-or-nothing: node and edges commit
 * or roll back together. That is safe because promotion is idempotent and self-healing — the next
 * re-confirm or the nightly reconciler (W2.5) re-promotes the same node deterministically — and the
 * user-facing "a graph hiccup never blocks the user-visible write" guarantee is Task 3's job (the
 * async, after-commit promotion hook), not this method's.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH},
    havingValue = "true")
public class GraphEdgeStructurer {

    /** Dispatch key for FakeCompanionLlm (the FactExtractionService.EXTRACTION_MARKER idiom). */
    public static final String STRUCTURER_MARKER = "[graph-edge-structurer]";

    private static final Set<String> ALLOWED_KINDS = Set.of(
        GraphEdgeEntity.KIND_TRIGGERS, GraphEdgeEntity.KIND_PRECEDED_BY,
        GraphEdgeEntity.KIND_SUPPORTS, GraphEdgeEntity.KIND_CONFLICTS,
        GraphEdgeEntity.KIND_RELATES_TO);

    private static final String SYSTEM_PROMPT = STRUCTURER_MARKER + """

        Te egy tudásgráf él-strukturáló vagy. Bemenet: egy ÚJ csomópont és a meglévő csomópontok
        számozott listája. Feladat: eldönteni, hogy az ÚJ csomópontból melyik meglévő csomópont felé
        vezet értelmes, tényleg megalapozott kapcsolat.

        Válasz KIZÁRÓLAG JSON tömb, magyarázat nélkül:
        [{"index": 0, "kind": "TRIGGERS", "confidence": 0.0}]

        - kind ∈ TRIGGERS | PRECEDED_BY | SUPPORTS | CONFLICTS | RELATES_TO
        - confidence 0.0–1.0: mennyire vagy biztos a kapcsolatban
        - Csak valódi kapcsolatot javasolj; ha nincs ilyen, a válasz üres tömb: []
        - Ne találj ki új csomópontot, és ne hivatkozz a listán kívüli indexre.
        """;

    /** Candidate pool bound = {@code top-k} × this multiplier — a small multiple so the model has
     *  room to choose the best {@code top-k} from more than exactly {@code top-k} options, while
     *  keeping the prompt's size bounded regardless of how large the user's graph grows. */
    private static final int CANDIDATE_POOL_MULTIPLIER = 3;

    private final CompanionLlm companionLlm;
    private final GraphService graphService;
    private final GraphNodeRepository nodeRepository;
    private final ObjectMapper objectMapper;
    private final CompanionProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;

    /** Best-effort: proposes and persists edges from {@code newNode}. Never throws. */
    public void structureEdges(UUID userId, GraphNodeEntity newNode, String evidenceSourceKind, UUID evidenceSourceId) {
        try {
            int topK = properties.graph().topK();
            List<GraphNodeEntity> candidates = nodeRepository
                .findByCreatedByAndStatusAndIdNotAndDeletedFalseOrderByCreatedAtDesc(
                    userId, GraphNodeEntity.STATUS_ACTIVE, newNode.getId(),
                    Limit.of(topK * CANDIDATE_POOL_MULTIPLIER));
            if (candidates.isEmpty()) {
                return;   // emptiness gate — nothing to link to, no LLM call
            }
            String raw = llmCallContextHolder.runWith(
                new LlmCallContext("companion_graph", "structure_edges", evidenceSourceKind, evidenceSourceId),
                () -> companionLlm.complete(SYSTEM_PROMPT, buildUserMessage(newNode, candidates)));
            List<GraphEdgeSuggestion> accepted = parse(raw).stream()
                .filter(s -> s.index() != null && s.index() >= 0 && s.index() < candidates.size()
                    && s.kind() != null && ALLOWED_KINDS.contains(s.kind())
                    && s.confidence() != null && s.confidence() >= properties.graph().edgeConfidenceFloor())
                // top-k cap (plan's locked decision — reuse the traversal knob, no new cap knob):
                // a chatty model must never create unboundedly many edges from one promotion.
                .sorted(Comparator.comparingDouble(GraphEdgeSuggestion::confidence).reversed())
                .limit(topK)
                .toList();
            for (GraphEdgeSuggestion s : accepted) {
                BigDecimal weight = BigDecimal.valueOf(s.confidence())
                    .multiply(new BigDecimal("0.5")).setScale(3, RoundingMode.HALF_UP);
                graphService.upsertEdge(userId, newNode.getId(), candidates.get(s.index()).getId(),
                    s.kind(), weight,
                    List.of(new GraphEdgeEvidence(evidenceSourceKind, evidenceSourceId,
                        "structurer confidence=" + s.confidence(), Instant.now())));
            }
        } catch (Exception e) {
            // IDENT-3: the node stands on its own; a missing edge set is an honest degraded graph.
            log.warn("Graph edge structuring failed for node {}", newNode.getId(), e);
        }
    }

    private List<GraphEdgeSuggestion> parse(String raw) throws Exception {
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start < 0 || end <= start) {
            return List.of();
        }
        return objectMapper.readValue(raw.substring(start, end + 1),
            objectMapper.getTypeFactory().constructCollectionType(List.class, GraphEdgeSuggestion.class));
    }

    private String buildUserMessage(GraphNodeEntity newNode, List<GraphNodeEntity> candidates) {
        StringBuilder sb = new StringBuilder();
        sb.append("ÚJ CSOMÓPONT (").append(newNode.getKind()).append("): ").append(newNode.getTitle()).append('\n');
        if (newNode.getSummary() != null && !newNode.getSummary().isBlank()) {
            sb.append("Részletek: ").append(newNode.getSummary()).append('\n');
        }
        sb.append("\nMEGLÉVŐ CSOMÓPONTOK:\n");
        for (int i = 0; i < candidates.size(); i++) {
            GraphNodeEntity c = candidates.get(i);
            sb.append(i).append(". (").append(c.getKind()).append(") ").append(c.getTitle()).append('\n');
        }
        return sb.toString();
    }
}
