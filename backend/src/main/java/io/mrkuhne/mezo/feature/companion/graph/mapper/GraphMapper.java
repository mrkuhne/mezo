package io.mrkuhne.mezo.feature.companion.graph.mapper;

import io.mrkuhne.mezo.api.dto.GraphNodeResponse;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphProposedEdge;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface GraphMapper {

    @Mapping(target = "kind", expression = "java(GraphNodeResponse.KindEnum.fromValue(e.getKind()))")
    @Mapping(target = "status", expression = "java(GraphNodeResponse.StatusEnum.fromValue(e.getStatus()))")
    @Mapping(target = "proposedEdgeCount", expression = "java(proposedEdgeCount(e))")
    GraphNodeResponse toResponse(GraphNodeEntity e);

    /** W2.3: how many edges accepting this candidate would create — 0 for every non-candidate
     *  node (an accepted/active node keeps its original {@code meta.proposedEdges} list around
     *  even though {@code LifeEventCandidateService.decide} already materialised those edges, so
     *  the status check here is load-bearing, not redundant with the meta read), and 0 for a
     *  candidate whose meta carries no (or a malformed) proposedEdges list. */
    default Integer proposedEdgeCount(GraphNodeEntity e) {
        if (!GraphNodeEntity.STATUS_CANDIDATE.equals(e.getStatus())) {
            return 0;
        }
        Object raw = e.getMeta() == null ? null : e.getMeta().get(GraphProposedEdge.META_KEY);
        return raw instanceof java.util.List<?> list ? list.size() : 0;
    }

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
