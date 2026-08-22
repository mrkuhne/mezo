package io.mrkuhne.mezo.feature.companion.graph.controller;

import io.mrkuhne.mezo.api.controller.KnowledgeGraphApi;
import io.mrkuhne.mezo.api.dto.GraphNodeResponse;
import io.mrkuhne.mezo.feature.companion.graph.mapper.GraphMapper;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
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

    @Override
    public List<GraphNodeResponse> listGraphNodes() {
        return graphService.listActive(currentUserId.get()).stream().map(graphMapper::toResponse).toList();
    }

    @Override
    public GraphNodeResponse archiveGraphNode(UUID id) {
        return graphMapper.toResponse(graphService.archive(currentUserId.get(), id));
    }
}
