package io.mrkuhne.mezo.feature.companion;

import java.util.List;

/**
 * The single seam between the companion and any embedding provider (V2.1, roadmap §V2.1).
 * Mirrors the {@link CompanionLlm} port pattern: everything above this interface is
 * deterministic and provider-agnostic; below it sits one adapter ({@code GeminiEmbeddingAdapter}
 * for real traffic, {@code FakeEmbeddingAdapter} under the {@code companion-fake} profile so
 * integration tests never touch the network).
 *
 * <p>Documents and queries are separate methods because retrieval-tuned models embed them
 * asymmetrically (Gemini task types RETRIEVAL_DOCUMENT vs RETRIEVAL_QUERY); a fake keeps them
 * identical. Returned vectors are L2-normalized, {@link #DIMENSIONS}-long unit vectors —
 * gemini-embedding-001 only self-normalizes at 3072 dims, so the adapter normalizes
 * client-side (bd mezo-c30 research, spec §7).
 */
public interface EmbeddingPort {

    /**
     * The vector dimension — structural, not tunable: the {@code memory_embedding.embedding}
     * column is {@code vector(768)} (surviving invariant per ADR 0008 / bd mezo-c30).
     */
    int DIMENSIONS = 768;

    /** Embeds narrative units for storage (daily summaries, chat turns), one vector per text. */
    List<float[]> embedDocuments(List<String> texts);

    /** Embeds a search query for ANN recall against stored document vectors. */
    float[] embedQuery(String text);
}
