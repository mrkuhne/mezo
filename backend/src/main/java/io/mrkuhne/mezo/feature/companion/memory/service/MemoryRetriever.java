package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalInput;
import java.util.List;

/** One independently executable candidate source; failures are deliberately propagated. */
public interface MemoryRetriever {

    String name();

    List<MemoryCandidate> retrieve(RetrievalInput input);
}
