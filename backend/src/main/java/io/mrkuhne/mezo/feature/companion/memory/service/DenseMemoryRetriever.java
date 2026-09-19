package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalInput;
import io.mrkuhne.mezo.feature.companion.memory.repository.DenseMemoryQuery;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** Canonical vector retrieval for the configured serving embedding generation. */
@Service("dense")
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class DenseMemoryRetriever implements MemoryRetriever {

    private final DenseMemoryQuery query;

    @Override
    public String name() {
        return "dense";
    }

    /**
     * Ranks against the vector the caller already embedded. This method must stay purely
     * database-bound: it runs inside {@code execution.retriever-timeout-ms}, a 200 ms budget sized
     * for one indexed query. It used to call the embedding provider here, which is why it lost that
     * race on 55 of 55 production runs (bd mezo-iddo); the hop now happens once in
     * {@link MemoryQueryEmbedder}, before the fan-out.
     */
    @Override
    public List<MemoryCandidate> retrieve(RetrievalInput input) {
        float[] embedding = input.queryEmbedding();
        if (embedding == null) {
            // Not a silent empty result: a missing embedding means this retriever could not run,
            // and the coordinator has to record that on the run's trace. Returning List.of() here
            // would count dense as a SUCCESS and hide the outage — the very failure mode that let
            // this bug survive unseen for weeks (bd mezo-iddo).
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("COMPANION_QUERY_EMBEDDING_UNAVAILABLE").build());
        }
        return query.nearest(
                        input.request().userId(), vectorLiteral(embedding), input.embeddingVersion(),
                        input.request().asOf(), input.request().conversationId(),
                        input.candidateLimit(), input.sourceKind())
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
