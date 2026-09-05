package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalInput;
import io.mrkuhne.mezo.feature.companion.memory.repository.KnowledgeFactRetrievalQuery;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** Confirmed-fact retrieval; facts have stable IDs but no canonical memory_item identity. */
@Service("facts")
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FactMemoryRetriever implements MemoryRetriever {

    private final KnowledgeFactRetrievalQuery query;

    @Override
    public String name() {
        return "facts";
    }

    @Override
    public List<MemoryCandidate> retrieve(RetrievalInput input) {
        return query.search(
                        input.request().userId(), input.query().rawQuery(),
                        input.request().asOf(), input.candidateLimit())
                .stream()
                .map(hit -> new MemoryCandidate(
                        name(), "knowledge_fact", hit.id(), null, hit.id(), "knowledge_fact",
                        hit.category(), hit.factText(), hit.occurredOn(), hit.score(),
                        hit.pinned(), hit.conflicting(), 1.0, null, hit.conflictingWithId()))
                .toList();
    }
}
