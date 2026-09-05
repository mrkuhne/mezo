package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalInput;
import io.mrkuhne.mezo.feature.companion.memory.repository.DenseMemoryQuery;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** Canonical vector retrieval for the configured serving embedding generation. */
@Service("dense")
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class DenseMemoryRetriever implements MemoryRetriever {

    private final EmbeddingPort embeddingPort;
    private final DenseMemoryQuery query;

    @Override
    public String name() {
        return "dense";
    }

    @Override
    public List<MemoryCandidate> retrieve(RetrievalInput input) {
        float[] embedding = embeddingPort.embedQuery(input.query().denseQuery());
        return query.nearest(
                        input.request().userId(), vectorLiteral(embedding), input.embeddingVersion(),
                        input.request().asOf(), input.request().conversationId(), input.candidateLimit())
                .stream()
                .map(hit -> new MemoryCandidate(
                        name(), "memory_item", hit.itemId(), hit.itemId(), hit.sourceId(),
                        hit.sourceKind(), hit.label(), hit.content(), hit.occurredOn(),
                        Math.clamp(1.0 - hit.distance(), 0.0, 1.0), false, false,
                        hit.salience().doubleValue(), hit.diversityGroupId(), null))
                .toList();
    }

    private static String vectorLiteral(float[] vector) {
        StringBuilder literal = new StringBuilder("[");
        for (int i = 0; i < vector.length; i++) {
            if (i > 0) {
                literal.append(',');
            }
            literal.append(vector[i]);
        }
        return literal.append(']').toString();
    }
}
