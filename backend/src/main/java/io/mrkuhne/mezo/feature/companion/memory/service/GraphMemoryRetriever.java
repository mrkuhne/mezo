package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphTraversalService;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalInput;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** Knowledge-graph neighborhood adapter for the shared memory candidate contract. */
@Service("graph")
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH},
        havingValue = "true")
public class GraphMemoryRetriever implements MemoryRetriever {

    private final GraphTraversalService traversalService;
    private final CompanionProperties properties;

    @Override
    public String name() {
        return "graph";
    }

    @Override
    public List<MemoryCandidate> retrieve(RetrievalInput input) {
        UUID userId = input.request().userId();
        List<UUID> seeds = traversalService.seedsFor(
                userId, input.query().rawQuery(), input.request().asOf());
        if (seeds.isEmpty()) {
            return List.of();
        }
        int topK = Math.min(input.candidateLimit(), properties.graph().topK());
        return traversalService.neighborhood(
                        userId, seeds, properties.graph().maxHops(), topK, input.request().asOf()).stream()
                .map(edge -> new MemoryCandidate(
                        name(), "knowledge_edge", edge.edgeId(), null, edge.edgeId(),
                        "knowledge_edge", edge.kind(),
                        edge.fromTitle() + " --" + edge.kind() + "--> " + edge.toTitle(),
                        null, edge.weight().doubleValue(), false,
                        GraphEdgeEntity.KIND_CONFLICTS.equals(edge.kind()), 0.5))
                .toList();
    }
}
