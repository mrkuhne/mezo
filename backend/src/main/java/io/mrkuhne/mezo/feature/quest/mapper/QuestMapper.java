package io.mrkuhne.mezo.feature.quest.mapper;

import io.mrkuhne.mezo.api.dto.QuestResponse;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface QuestMapper {

    @Mapping(target = "targetLabel", expression = "java(QuestDisplay.targetLabel(e))")
    @Mapping(target = "metric", source = "target.metric")
    QuestResponse toQuestResponse(DailyQuestEntity e);

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
