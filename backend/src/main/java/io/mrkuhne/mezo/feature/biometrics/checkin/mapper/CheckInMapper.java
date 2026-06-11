package io.mrkuhne.mezo.feature.biometrics.checkin.mapper;

import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface CheckInMapper {

    CheckInResponse toResponse(CheckInEntity entity);

    /** Entity stores Instant; the generated contract type uses OffsetDateTime (UTC on the wire either way). */
    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
