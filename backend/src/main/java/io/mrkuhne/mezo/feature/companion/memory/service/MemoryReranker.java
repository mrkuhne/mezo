package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryCandidateFusion.FusedCandidate;
import java.util.List;
import java.util.Map;

/** Optional ordering seam over deterministic fused candidates. */
public interface MemoryReranker {

    boolean shouldRerank(
            MemoryRequest request,
            Map<String, List<MemoryCandidate>> rankedByRetriever,
            List<FusedCandidate> selected);

    List<FusedCandidate> rerank(List<FusedCandidate> fusedOrder);
}
