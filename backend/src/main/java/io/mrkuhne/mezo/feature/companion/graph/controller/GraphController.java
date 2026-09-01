package io.mrkuhne.mezo.feature.companion.graph.controller;

import io.mrkuhne.mezo.api.controller.KnowledgeGraphApi;
import io.mrkuhne.mezo.api.dto.GraphCandidateDecisionRequest;
import io.mrkuhne.mezo.api.dto.GraphEdgeCountResponse;
import io.mrkuhne.mezo.api.dto.GraphNodeResponse;
import io.mrkuhne.mezo.feature.companion.graph.mapper.GraphMapper;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
import io.mrkuhne.mezo.feature.companion.graph.service.LifeEventCandidateService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/companion/graph surface (bd mezo-b3pp.6) — gated on {@code KNOWLEDGE_GRAPH_SWITCH}
 *  (off ⇒ the whole surface 404s and no graph beans exist). */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH, havingValue = "true")
public class GraphController implements KnowledgeGraphApi {

    private final GraphService graphService;
    private final GraphMapper graphMapper;
    private final CurrentUserId currentUserId;
    private final LifeEventCandidateService candidateService;

    @Override
    public List<GraphNodeResponse> listGraphNodes() {
        return graphService.listActiveWithTopEdges(currentUserId.get()).stream()
            .map(nwe -> {
                GraphNodeResponse response = graphMapper.toResponse(nwe.node());
                response.setTopEdges(nwe.topEdgeLines());
                return response;
            })
            .toList();
    }

    @Override
    public GraphNodeResponse archiveGraphNode(UUID id) {
        return graphMapper.toResponse(graphService.archive(currentUserId.get(), id));
    }

    @Override
    public List<GraphNodeResponse> listGraphCandidates() {
        return candidateService.listPending(currentUserId.get());
    }

    @Override
    public GraphNodeResponse decideGraphCandidate(UUID id, GraphCandidateDecisionRequest graphCandidateDecisionRequest) {
        return candidateService.decide(currentUserId.get(), id, graphCandidateDecisionRequest);
    }

    @Override
    public GraphEdgeCountResponse countGraphEdges() {
        return new GraphEdgeCountResponse().count(graphService.countActiveEdges(currentUserId.get()));
    }
}
