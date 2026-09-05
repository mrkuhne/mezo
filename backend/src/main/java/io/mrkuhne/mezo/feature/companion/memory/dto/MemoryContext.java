package io.mrkuhne.mezo.feature.companion.memory.dto;

import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import java.util.List;
import java.util.UUID;

/** Structured and prompt-ready result of one long-term-memory retrieval run. */
public record MemoryContext(
        List<MemoryContextItem> items,
        String promptBlock,
        List<RefsEnvelope.Ref> refs,
        UUID traceId) {

    public static final MemoryContext EMPTY = new MemoryContext(List.of(), "", List.of(), null);
}
