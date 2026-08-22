package io.mrkuhne.mezo.feature.companion.graph.mapper;

import io.mrkuhne.mezo.api.dto.GraphNodeResponse;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface GraphMapper {

    @Mapping(target = "kind", expression = "java(GraphNodeResponse.KindEnum.fromValue(e.getKind()))")
    @Mapping(target = "status", expression = "java(GraphNodeResponse.StatusEnum.fromValue(e.getStatus()))")
    GraphNodeResponse toResponse(GraphNodeEntity e);

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
