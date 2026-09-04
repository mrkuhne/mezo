package io.mrkuhne.mezo.feature.companion.memory.entity;

import java.time.Instant;
import java.util.UUID;

/** Typed origin metadata for a canonical memory projection. */
public record MemoryProvenanceEnvelope(
        String sourceTable,
        Instant sourceUpdatedAt,
        String projectorVersion,
        UUID conversationId) {

    public static MemoryProvenanceEnvelope empty() {
        return new MemoryProvenanceEnvelope(null, null, null, null);
    }
}
