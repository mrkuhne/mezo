package io.mrkuhne.mezo.feature.companion.memory.entity;

import java.time.Instant;
import java.util.UUID;

/** Typed origin metadata for a canonical memory projection. */
public record MemoryProvenanceEnvelope(
        String sourceTable,
        Instant sourceUpdatedAt,
        String projectorVersion,
        UUID conversationId,
        String suppressionReason) {

    public MemoryProvenanceEnvelope(String sourceTable, Instant sourceUpdatedAt, String projectorVersion, UUID conversationId) {
        this(sourceTable, sourceUpdatedAt, projectorVersion, conversationId, null);
    }

    public boolean userSuppressed() {
        return "user".equals(suppressionReason);
    }

    public MemoryProvenanceEnvelope withUserSuppression() {
        return new MemoryProvenanceEnvelope(sourceTable, sourceUpdatedAt, projectorVersion, conversationId, "user");
    }

    public static MemoryProvenanceEnvelope empty() {
        return new MemoryProvenanceEnvelope(null, null, null, null);
    }
}
