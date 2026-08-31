package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphTraversalQuery.NeighborEdge;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * W2.4 (mezo-b3pp.9, spec §6.4): the {@code [Összefüggések]} prompt block — the part of the
 * knowledge graph that touches what the user just said, rendered as Hungarian "A → verb → B ·
 * strength" lines under {@code mezo.companion.graph.render-max-tokens}. Seeds come from
 * {@link GraphTraversalService#seedsFor} (deterministic), the neighborhood from the recursive
 * CTE with {@code graph.maxHops}/{@code graph.topK}. Every node that appears in a rendered line
 * becomes a {@code GraphNode} ref (id = node id, label = the node's title, mezo-b3pp.33) so the
 * answer's provenance shows what the graph contributed — capped at {@code graph.maxRefs} in
 * first-appearance order. Present only when this bean exists, i.e. the graph switch is on —
 * {@code ChatService} holds it through an {@code ObjectProvider}.
 *
 * <p>Failure honesty (IDENT-3): never throws — any failure logs a warn and yields
 * {@link GraphContext#EMPTY}; the caller's {@code degraded} flag is NOT touched.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH},
    havingValue = "true")
public class GraphPromptAssembler {

    /** Header of the block — same "\n\n…:\n" shape as the facts/[Emlékek] headers. */
    public static final String CONNECTIONS_HEADER = "\n\n[Összefüggések] (a tudásgráfból, a mostani témához"
            + " kapcsolódó szálak — nyersanyag, nem felolvasandó lista; ok → viszony → okozat · erősség):\n";

    /** Ref kind on the wire — the FE chip shows the label when present, else falls back to the id. */
    public static final String REF_KIND = "GraphNode";

    /** What one turn's graph lookup produced: the rendered block ("" when nothing) + GraphNode refs. */
    public record GraphContext(String block, List<RefsEnvelope.Ref> refs) {
        public static final GraphContext EMPTY = new GraphContext("", List.of());
    }

    /** The render result: block text + exactly the edges that made it in under the cap. */
    record Rendered(String block, List<NeighborEdge> rendered) {
        static final Rendered EMPTY = new Rendered("", List.of());
    }

    /** Same chars-per-token estimate as the [Emlékek] block (PromptMemoryAssembler). */
    static final int CHARS_PER_TOKEN = 3;

    private final GraphTraversalService traversalService;
    private final CompanionProperties properties;

    /** The block for one turn. Never throws. */
    public GraphContext assemble(UUID userId, String userMessage) {
        if (userMessage == null || userMessage.isBlank()) {
            return GraphContext.EMPTY;
        }
        try {
            CompanionProperties.Graph graph = properties.graph();
            List<UUID> seeds = traversalService.seedsFor(userId, userMessage);
            List<NeighborEdge> edges = traversalService.neighborhood(userId, seeds, graph.maxHops(), graph.topK());
            Rendered rendered = renderBlock(edges, graph.renderMaxTokens());
            if (rendered.rendered().isEmpty()) {
                return GraphContext.EMPTY;
            }
            // one ref per node, first-appearance order — the same node may sit on several lines.
            // Capped (mezo-b3pp.33): topK edges yield up to 2×topK node refs against the shared
            // tools.max-refs-per-turn budget, and graph refs are added LAST, so an uncapped graph
            // turn fills the whole footer with graph chips and truncates mid-list.
            LinkedHashMap<UUID, RefsEnvelope.Ref> byNode = new LinkedHashMap<>();
            for (NeighborEdge edge : rendered.rendered()) {
                byNode.putIfAbsent(edge.fromNodeId(),
                        new RefsEnvelope.Ref(REF_KIND, edge.fromNodeId().toString(), edge.fromTitle()));
                byNode.putIfAbsent(edge.toNodeId(),
                        new RefsEnvelope.Ref(REF_KIND, edge.toNodeId().toString(), edge.toTitle()));
            }
            List<RefsEnvelope.Ref> refs = byNode.values().stream()
                    .limit(graph.maxRefs())
                    .toList();
            return new GraphContext(rendered.block(), refs);
        } catch (RuntimeException e) {
            log.warn("Graph context skipped for user {} — the turn continues without [Összefüggések]", userId, e);
            return GraphContext.EMPTY;
        }
    }

    /**
     * Renders weight-ordered edges under the token cap; stops at the FIRST overflowing line (the
     * order IS the relevance statement — a shorter later line never jumps ahead). Empty when
     * nothing fits.
     *
     * <p>Every line reads cause-first, as the header promises ({@code ok → viszony → okozat}).
     * {@code PRECEDED_BY} stores the opposite direction — {@code from PRECEDED_BY to} means the
     * TO-node happened first (see {@link GraphEdgeEntity#KIND_PRECEDED_BY}) — so its endpoints are
     * SWAPPED by {@link GraphEdgeLineRenderer#renderLine}, which this method calls: {@code
     * - <to> → megelőzte → <from>}. No other kind is swapped.
     */
    static Rendered renderBlock(List<NeighborEdge> edges, int maxTokens) {
        if (edges.isEmpty()) {
            return Rendered.EMPTY;
        }
        StringBuilder block = new StringBuilder(CONNECTIONS_HEADER);
        List<NeighborEdge> rendered = new ArrayList<>();
        for (NeighborEdge edge : edges) {
            String line = "- " + GraphEdgeLineRenderer.renderLine(
                    edge.kind(), edge.fromTitle(), edge.toTitle(), edge.weight()) + '\n';
            if (estimateTokens(block.length() + line.length()) > maxTokens) {
                break;
            }
            block.append(line);
            rendered.add(edge);
        }
        return rendered.isEmpty() ? Rendered.EMPTY : new Rendered(block.toString(), List.copyOf(rendered));
    }

    static int estimateTokens(int chars) {
        return (chars + CHARS_PER_TOKEN - 1) / CHARS_PER_TOKEN;
    }
}
