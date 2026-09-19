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
        float[] queryEmbedding,
        /**
         * The single {@code memory_item.source_kind} this run may retrieve, or {@code null} for an
         * unscoped run. Derived from {@link io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy#scopedSourceKind()}
         * — see that javadoc for why the scoping has to happen in the QUERY and not in the caller's
         * mapping. A retriever that can never yield the scoped kind (facts, graph) must return
         * empty rather than burn a pooled connection and a slice of the deadline (mezo-eq85.10).
         */
        String sourceKind) {
}
