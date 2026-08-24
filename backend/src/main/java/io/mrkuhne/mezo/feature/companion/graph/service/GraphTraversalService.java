package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.companion.graph.repository.GraphTraversalQuery;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphTraversalQuery.ActiveNode;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphTraversalQuery.NeighborEdge;
import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * W2.4 (mezo-b3pp.9, spec §6.4): the graph's read side for the prompt. {@link #seedsFor} picks
 * the seed nodes DETERMINISTICALLY — no LLM — by matching the user message's folded search
 * tokens ({@link ToolText#searchTokens}: lowercase, accent-stripped, 1-char tokens dropped)
 * against the folded title/summary of every ACTIVE node; {@link #neighborhood} is the recursive
 * CTE walk ({@link GraphTraversalQuery}) from those seeds. Tokens shorter than
 * {@link #MIN_TOKEN_CHARS} are ignored here too: a 2-char needle ("ma", "az") would seed half the
 * graph on every turn.
 *
 * <p>No {@code @Transactional}, and — deliberately — no JPA repository at all: BOTH reads go
 * through {@link GraphTraversalQuery}, i.e. raw JDBC on the caller's connection under its own
 * savepoint. A Hibernate query failure would mark the chat turn's transaction rollback-only, and
 * {@code GraphPromptAssembler}'s catch → EMPTY could then no longer save the turn (IDENT-3).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH, havingValue = "true")
public class GraphTraversalService {

    /** Shortest token that may seed a traversal (Hungarian stems are rarely shorter). */
    static final int MIN_TOKEN_CHARS = 3;

    /** Sentence punctuation clinging to a token ("alvás?" → "alvas?") would match nothing —
     *  {@link ToolText#searchTokens} splits on whitespace/comma/semicolon only, so strip the
     *  leading/trailing non-letter/digit run here rather than change that shared primitive. */
    private static final String EDGE_PUNCTUATION = "^[^\\p{L}\\p{N}]+|[^\\p{L}\\p{N}]+$";

    private final GraphTraversalQuery traversalQuery;

    /** Active nodes whose folded title or summary contains any folded message token (≥3 chars). */
    public List<UUID> seedsFor(UUID userId, String userMessage) {
        List<String> tokens = ToolText.searchTokens(userMessage).stream()
                .map(t -> t.replaceAll(EDGE_PUNCTUATION, ""))
                .filter(t -> t.length() >= MIN_TOKEN_CHARS)
                .toList();
        if (tokens.isEmpty()) {
            return List.of();
        }
        return traversalQuery.activeNodes(userId).stream()
                .filter(node -> tokens.stream().anyMatch(t ->
                        ToolText.containsFolded(node.title(), t) || ToolText.containsFolded(node.summary(), t)))
                .map(ActiveNode::id)
                .toList();
    }

    /** Weight-ordered ≤maxHops neighborhood of the seeds; empty seeds ⇒ empty (no SQL at all). */
    public List<NeighborEdge> neighborhood(UUID userId, Collection<UUID> seedNodeIds, int maxHops, int topK) {
        if (seedNodeIds.isEmpty()) {
            return List.of();
        }
        return traversalQuery.neighborhood(userId, seedNodeIds, maxHops, topK);
    }
}
