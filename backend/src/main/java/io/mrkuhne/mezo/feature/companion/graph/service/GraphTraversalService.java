package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphTraversalQuery;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphTraversalQuery.ActiveNode;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphTraversalQuery.NeighborEdge;
import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * W2.4 (mezo-b3pp.9, spec §6.4): the graph's read side for the prompt. {@link #seedsFor} picks
 * the seed nodes DETERMINISTICALLY — no LLM — by matching the user message's folded search
 * tokens ({@link ToolText#searchTokens}: lowercase, accent-stripped, 1-char tokens dropped)
 * against the folded title/summary of every ACTIVE node at a WORD START
 * ({@link #startsAWordInFolded}, mezo-b3pp.34). Tokens shorter than {@link #MIN_TOKEN_CHARS} or in {@link #STOPWORDS} are
 * ignored: a 2-char needle ("ma", "az") or a bare "nem"/"volt" would seed half the graph on every
 * turn. Matching nodes are ranked (title hit, then distinct token hits, ties broken by the query's
 * own TOTAL {@code created_at desc, id} row order — {@code Stream.sorted} is stable, so this is
 * deliberate, not incidental) and capped at {@code graph.max-seeds} — {@link #neighborhood} is the recursive CTE walk
 * ({@link GraphTraversalQuery}) from those seeds.
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

    /**
     * Hungarian filler that would otherwise seed the graph on its own (mezo-b3pp.34). These are
     * ≥3 chars, so the length filter lets them through, and node summaries are ordinary Hungarian
     * prose — so one "nem" in a chatty turn matched most of the graph, and once the seed set is
     * the whole graph the neighborhood walk degenerates into "the globally strongest edges",
     * which is no longer an answer to the question that was asked.
     *
     * <p>Deliberately SMALL and closed: only words that carry no topic at all. Anything that could
     * name a subject the user might ask about stays out — a stopword list that is too eager
     * silently deletes real turns, which is the harder failure to notice.
     *
     * <p>Every entry is written already FOLDED (lowercase, accent-stripped, the {@link
     * ToolText#fold} idiom) — a matching token has already been through the same fold, so an
     * accented entry here would simply never match and silently do nothing.
     */
    static final Set<String> STOPWORDS = Set.of(
        "nem", "hogy", "csak", "volt", "mert", "kell", "most", "meg", "van", "lesz", "lehet",
        "azt", "ezt", "ami", "amit", "aki", "akit", "vagy", "pedig", "utan", "elott", "mar",
        "majd", "igen", "talan", "szerintem", "tenyleg", "megis", "persze");

    private final GraphTraversalQuery traversalQuery;
    private final CompanionProperties properties;

    /**
     * Active nodes whose folded title or summary contains a folded message token (≥3 chars, not a
     * stopword) at a WORD START, ranked title-hit-first then by distinct-token-hit-count, and
     * capped at {@code graph.max-seeds} (mezo-b3pp.34).
     */
    public List<UUID> seedsFor(UUID userId, String userMessage) {
        List<String> tokens = ToolText.searchTokens(userMessage).stream()
                .map(t -> t.replaceAll(EDGE_PUNCTUATION, ""))
                .filter(t -> t.length() >= MIN_TOKEN_CHARS)
                .filter(t -> !STOPWORDS.contains(t))
                .distinct()
                .toList();
        if (tokens.isEmpty()) {
            return List.of();
        }
        // Rank before capping: an unordered truncation would make the block depend on row order.
        // A TITLE hit outranks a summary-only hit (the stronger topical signal), then more distinct
        // matching tokens wins. NO further tie-break HERE: Stream.sorted is stable, so nodes left
        // tied on both keys keep activeNodes()' own row order — recency is a real relevance signal,
        // unlike a node id. That order is GraphTraversalQuery.ACTIVE_NODES_SQL's own
        // `created_at desc, id` — the `id` secondary key makes it a TOTAL order, which is what lets
        // this stable sort be a determinism guarantee rather than an accident of query-plan luck.
        // Each node's title/summary is folded ONCE here (not per-token inside startsAWordInFolded) —
        // seedsFor runs on the synchronous chat path, and folding is a Normalizer.normalize + regex
        // pass over the whole field.
        record Scored(ActiveNode node, boolean titleHit, long tokenHits) {}
        return traversalQuery.activeNodes(userId).stream()
                .map(n -> {
                    String foldedTitle = ToolText.fold(n.title());
                    String foldedSummary = ToolText.fold(n.summary());
                    boolean titleHit = tokens.stream().anyMatch(t -> startsAWordInFolded(foldedTitle, t));
                    long tokenHits = tokens.stream().filter(t ->
                            startsAWordInFolded(foldedTitle, t) || startsAWordInFolded(foldedSummary, t)).count();
                    return new Scored(n, titleHit, tokenHits);
                })
                .filter(s -> s.tokenHits() > 0)
                .sorted(Comparator.comparing(Scored::titleHit).reversed()
                        .thenComparing(Comparator.comparingLong(Scored::tokenHits).reversed()))
                .limit(properties.graph().maxSeeds())
                .map(s -> s.node().id())
                .toList();
    }

    /**
     * Word-START containment on an ALREADY-folded field — the graph's own rule, deliberately NOT
     * {@link ToolText#containsFolded} (mezo-b3pp.34). That primitive is plain substring
     * containment and is shared with {@code FuelTools}, where a user-typed filter genuinely wants
     * to match anywhere; changing it would silently alter unrelated tool behaviour. Here plain
     * containment produced false seeds — "ital" matched "vitalitás" — while an exact-word rule
     * would be wrong for an agglutinative language, where "alvás" must still reach
     * "alvásminőség". Matching a token only where it STARTS a word is the rule that keeps the
     * prefix case and drops the infix one.
     *
     * <p>Takes the field already folded rather than folding it itself: {@code seedsFor} folds each
     * node's title/summary ONCE and calls this once per token, so a hot per-token
     * {@link ToolText#fold} (a {@code Normalizer.normalize} + regex pass) is not repeated.
     */
    private static boolean startsAWordInFolded(String folded, String foldedToken) {
        int from = 0;
        while (true) {
            int i = folded.indexOf(foldedToken, from);
            if (i < 0) {
                return false;
            }
            if (i == 0 || !Character.isLetterOrDigit(folded.charAt(i - 1))) {
                return true;
            }
            from = i + 1;
        }
    }

    /** Weight-ordered ≤maxHops neighborhood of the seeds; empty seeds ⇒ empty (no SQL at all). */
    public List<NeighborEdge> neighborhood(UUID userId, Collection<UUID> seedNodeIds, int maxHops, int topK) {
        if (seedNodeIds.isEmpty()) {
            return List.of();
        }
        return traversalQuery.neighborhood(userId, seedNodeIds, maxHops, topK);
    }
}
