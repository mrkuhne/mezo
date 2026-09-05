package io.mrkuhne.mezo.feature.companion.memory.dto;

import java.time.LocalDate;
import java.util.UUID;

/** One selected, rendered and auditable long-term-memory context item. */
public record MemoryContextItem(
        UUID retrievalResultId,
        UUID memoryItemId,
        UUID sourceId,
        String sourceKind,
        String label,
        String content,
        LocalDate occurredOn,
        String indicator,
        ScoreBreakdown score) {
}
