package io.mrkuhne.mezo.feature.companion.graph.entity;

import java.util.UUID;

/**
 * One edge the W2.3 extractor PROPOSED from a LIFE_EVENT candidate to an existing active node
 * (spec §6.3). Proposed edges live in {@code knowledge_node.meta.proposedEdges} until the user
 * confirms the candidate — extraction never writes {@code knowledge_edge} rows itself, so a
 * rejected candidate leaves no residue anywhere.
 *
 * @param toNodeId   the existing node the edge points at
 * @param kind       TRIGGERS | PRECEDED_BY (the only two kinds the extractor may propose)
 * @param confidence 0..1 from the model; the created edge's weight is {@code confidence x 0.5}
 */
public record GraphProposedEdge(UUID toNodeId, String kind, Double confidence) {

    /** The {@code meta} key the envelope is stored under. */
    public static final String META_KEY = "proposedEdges";
}
