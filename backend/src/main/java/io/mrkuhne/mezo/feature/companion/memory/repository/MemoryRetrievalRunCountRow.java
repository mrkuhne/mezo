package io.mrkuhne.mezo.feature.companion.memory.repository;

import java.util.UUID;

/**
 * Projection for {@link MemoryRetrievalResultRepository#countByRunIds} (mezo-4qyt): how many
 * candidates one run ranked and how many of them reached the rendered context.
 */
public interface MemoryRetrievalRunCountRow {

    UUID getRunId();

    long getCandidateCount();

    long getSelectedCount();
}
