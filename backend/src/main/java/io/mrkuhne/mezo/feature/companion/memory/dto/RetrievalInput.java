package io.mrkuhne.mezo.feature.companion.memory.dto;

/** Fully prepared, version-pinned input shared by every memory retriever. */
public record RetrievalInput(
        MemoryRequest request,
        PreparedMemoryQuery query,
        String embeddingVersion,
        int candidateLimit,
        /**
         * The dense-search vector for {@link #query}, embedded ONCE before the fan-out and outside
         * the per-retriever deadline (bd mezo-iddo). {@code null} means the embedding hop failed or
         * ran out of its own budget: dense recall is skipped for this run and the remaining
         * retrievers answer on their own. Retrievers must never embed anything themselves — the
         * per-retriever deadline is sized for a database query, not a network call.
         */
        float[] queryEmbedding) {
}
