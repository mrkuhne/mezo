package io.mrkuhne.mezo.feature.companion.memory.dto;

/** Fully prepared, version-pinned input shared by every memory retriever. */
public record RetrievalInput(
        MemoryRequest request,
        PreparedMemoryQuery query,
        String embeddingVersion,
        int candidateLimit) {
}
