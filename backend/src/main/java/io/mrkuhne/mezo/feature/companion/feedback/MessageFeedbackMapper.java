package io.mrkuhne.mezo.feature.companion.feedback;

import io.mrkuhne.mezo.api.dto.MessageFeedbackResponse;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface MessageFeedbackMapper {

    MessageFeedbackResponse toResponse(MessageFeedbackEntity entity);

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
