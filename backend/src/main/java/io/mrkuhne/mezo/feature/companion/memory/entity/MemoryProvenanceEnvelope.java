package io.mrkuhne.mezo.feature.companion.memory.entity;

import java.time.Instant;
import java.util.UUID;

/** Typed origin metadata for a canonical memory projection. S2 (mezo-d6ivw.2) appends the
 *  trailing {@code patternId}/{@code confirmSource} fields — they also double as {@code
 *  io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity}'s pattern-promotion provenance
 *  (see {@link #patternPromotion}), not only the memory projection this record was originally
 *  named for. */
public record MemoryProvenanceEnvelope(
        String sourceTable,
        Instant sourceUpdatedAt,
        String projectorVersion,
        UUID conversationId,
        String suppressionReason,
        UUID patternId,
        String confirmSource) {

    public MemoryProvenanceEnvelope(String sourceTable, Instant sourceUpdatedAt, String projectorVersion, UUID conversationId) {
        this(sourceTable, sourceUpdatedAt, projectorVersion, conversationId, null, null, null);
    }

    public MemoryProvenanceEnvelope(String sourceTable, Instant sourceUpdatedAt, String projectorVersion, UUID conversationId, String suppressionReason) {
        this(sourceTable, sourceUpdatedAt, projectorVersion, conversationId, suppressionReason, null, null);
    }

    public boolean userSuppressed() {
        return "user".equals(suppressionReason);
    }

    public MemoryProvenanceEnvelope withUserSuppression() {
        return new MemoryProvenanceEnvelope(sourceTable, sourceUpdatedAt, projectorVersion, conversationId, "user", patternId, confirmSource);
    }

    public static MemoryProvenanceEnvelope empty() {
        return new MemoryProvenanceEnvelope(null, null, null, null, null, null, null);
    }

    /** S2 (mezo-d6ivw.2): a knowledge fact born from a pattern confirm — who and from what. */
    public static MemoryProvenanceEnvelope patternPromotion(UUID patternId, String confirmSource) {
        return new MemoryProvenanceEnvelope("pattern", null, null, null, null, patternId, confirmSource);
    }
}
