package io.mrkuhne.mezo.feature.activity.mapper;

import io.mrkuhne.mezo.api.dto.ActivityResponse;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ActivityMapper {

    @Mapping(target = "durationMin",
        expression = "java(e.getExtracted() == null ? null : e.getExtracted().durationMin())")
    @Mapping(target = "amountHuf",
        expression = "java(e.getExtracted() == null ? null : e.getExtracted().amountHuf())")
    ActivityResponse toResponse(ActivityLogEntity e);

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
