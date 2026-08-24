package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import java.math.BigDecimal;
import java.util.Map;

/**
 * The Hungarian "cause → verb → effect · strength" edge-line format — extracted out of
 * {@link GraphPromptAssembler} (W2.4, mezo-b3pp.9) so the `[Összefüggések]` prompt block and the
 * W2.6 (mezo-b3pp.11) `GraphNodeResponse.topEdges` REST field render identically off one source
 * of truth. Package-private: only {@link GraphPromptAssembler} and {@link GraphService} call it.
 */
final class GraphEdgeLineRenderer {

    private GraphEdgeLineRenderer() {
    }

    /** Hungarian relation verb per edge kind — unknown kinds fall back to the raw kind. */
    static final Map<String, String> KIND_VERBS = Map.of(
            GraphEdgeEntity.KIND_TRIGGERS, "kiváltja",
            GraphEdgeEntity.KIND_PRECEDED_BY, "megelőzte",
            GraphEdgeEntity.KIND_SUPPORTS, "támogatja",
            GraphEdgeEntity.KIND_CONFLICTS, "ütközik vele",
            GraphEdgeEntity.KIND_RELATES_TO, "kapcsolódik");

    /** Weight → coarse Hungarian strength word; the model/UI reads words better than 0.437. */
    static String strength(BigDecimal weight) {
        double w = weight == null ? 0 : weight.doubleValue();
        return w >= 0.7 ? "erős" : w >= 0.35 ? "közepes" : "gyenge";
    }

    /**
     * Renders one line, cause-first. {@code PRECEDED_BY} stores the opposite direction — {@code
     * from PRECEDED_BY to} means the TO-node happened first — so its endpoints are SWAPPED here;
     * no other kind is swapped.
     */
    static String renderLine(String kind, String fromTitle, String toTitle, BigDecimal weight) {
        boolean swap = GraphEdgeEntity.KIND_PRECEDED_BY.equals(kind);
        String cause = swap ? toTitle : fromTitle;
        String effect = swap ? fromTitle : toTitle;
        return cause + " → " + KIND_VERBS.getOrDefault(kind, kind) + " → " + effect + " · " + strength(weight);
    }
}
