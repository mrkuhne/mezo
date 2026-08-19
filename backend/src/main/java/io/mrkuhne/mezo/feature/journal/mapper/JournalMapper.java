package io.mrkuhne.mezo.feature.journal.mapper;

import io.mrkuhne.mezo.api.dto.JournalEntryResponse;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface JournalMapper {

    @Mapping(target = "source", expression = "java(JournalEntryResponse.SourceEnum.fromValue(e.getSource()))")
    JournalEntryResponse toResponse(JournalEntryEntity e);

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
