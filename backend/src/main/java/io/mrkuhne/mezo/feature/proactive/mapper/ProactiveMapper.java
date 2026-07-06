package io.mrkuhne.mezo.feature.proactive.mapper;

import io.mrkuhne.mezo.api.dto.BriefingRef;
import io.mrkuhne.mezo.api.dto.BriefingResponse;
import io.mrkuhne.mezo.api.dto.WeeklySuggestionResponse;
import io.mrkuhne.mezo.feature.proactive.entity.BriefingContentEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.BriefingEntity;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklySuggestionEntity;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ProactiveMapper {

    @Mapping(target = "date", source = "briefingDate")
    @Mapping(target = "eyebrow", source = "content.eyebrow")
    @Mapping(target = "body", source = "content.body")
    @Mapping(target = "refs", source = "content.refs")
    BriefingResponse toBriefingResponse(BriefingEntity entity);

    BriefingRef toBriefingRef(BriefingContentEnvelope.Ref ref);

    WeeklySuggestionResponse toWeeklySuggestionResponse(WeeklySuggestionEntity entity);

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
