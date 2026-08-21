package io.mrkuhne.mezo.feature.journal.mapper;

import io.mrkuhne.mezo.api.dto.GratitudeEntryResponse;
import io.mrkuhne.mezo.feature.journal.entity.GratitudeEntryEntity;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface GratitudeMapper {
    GratitudeEntryResponse toResponse(GratitudeEntryEntity e);
    default OffsetDateTime map(Instant i) { return i == null ? null : i.atOffset(ZoneOffset.UTC); }
}
