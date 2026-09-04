package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.memory.service.MemoryProjectionWriter.ProjectionCommand;
import java.util.UUID;

/** Commit-boundary hand-off from the OLD memory write to the canonical projection. */
public sealed interface MemoryProjectionEvent {

    record Upsert(ProjectionCommand command, float[] embedding) implements MemoryProjectionEvent {
    }

    record Suppress(UUID userId, String sourceKind, UUID sourceId) implements MemoryProjectionEvent {
    }
}
