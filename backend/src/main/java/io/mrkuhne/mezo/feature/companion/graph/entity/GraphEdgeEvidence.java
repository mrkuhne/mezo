package io.mrkuhne.mezo.feature.companion.graph.entity;

import java.time.Instant;
import java.util.UUID;

/**
 * One evidence item behind a {@code knowledge_edge} (spec §4.2): the source row that justified
 * creating or reinforcing the edge, e.g. a confirmed pattern or a life-event confirmation.
 */
public record GraphEdgeEvidence(String sourceKind, UUID sourceId, String note, Instant at) {
}
