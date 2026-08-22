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
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * W2.2 cheap-LLM edge structurer (bd mezo-b3pp.7, spec §6.2): given a freshly promoted node and
 * the user's existing active nodes, propose typed edges. Suggestions below
 * {@code mezo.companion.graph.edge-confidence-floor} are dropped; the survivors are created at
 * {@code weight = confidence × 0.5} — edges start humble and only W2.5 reinforcement raises them.
 *
 * <p>IDENT-3: a failed, empty or unparseable answer means NO edges — never a failed promotion. The
 * caller has already persisted the node before this runs. Emptiness gate: with no other active
 * node there is nothing to link to and no LLM call is made.
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

    private final CompanionLlm companionLlm;
    private final GraphService graphService;
    private final GraphNodeRepository nodeRepository;
    private final ObjectMapper objectMapper;
    private final CompanionProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;

    /** Best-effort: proposes and persists edges from {@code newNode}. Never throws. */
    public void structureEdges(UUID userId, GraphNodeEntity newNode, String evidenceSourceKind, UUID evidenceSourceId) {
        try {
            List<GraphNodeEntity> candidates = nodeRepository
                .findByCreatedByAndStatusAndIdNotAndDeletedFalseOrderByCreatedAtDesc(
                    userId, GraphNodeEntity.STATUS_ACTIVE, newNode.getId());
            if (candidates.isEmpty()) {
                return;   // emptiness gate — nothing to link to, no LLM call
            }
            String raw = llmCallContextHolder.runWith(
                new LlmCallContext("companion_graph", "structure_edges", evidenceSourceKind, evidenceSourceId),
                () -> companionLlm.complete(SYSTEM_PROMPT, buildUserMessage(newNode, candidates)));
            for (GraphEdgeSuggestion s : parse(raw)) {
                if (s.index() == null || s.index() < 0 || s.index() >= candidates.size()
                        || s.kind() == null || !ALLOWED_KINDS.contains(s.kind())
                        || s.confidence() == null
                        || s.confidence() < properties.graph().edgeConfidenceFloor()) {
                    continue;
                }
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
