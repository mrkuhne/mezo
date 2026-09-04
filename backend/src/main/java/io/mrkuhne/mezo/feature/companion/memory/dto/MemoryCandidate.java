package io.mrkuhne.mezo.feature.companion.memory.dto;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Retriever-neutral candidate with stable identity, source metadata and local evidence.
 * {@code memoryItemId} is absent for fact/graph candidates; {@code occurredOn} is absent when the
 * source (currently a graph edge) has no honest event date.
 */
public record MemoryCandidate(
        String retriever,
        String candidateKind,
        UUID stableId,
        UUID memoryItemId,
        UUID sourceId,
        String sourceKind,
        String label,
        String content,
        LocalDate occurredOn,
        double localScore,
        boolean pinned,
        boolean conflicting,
        double salience) {
}
