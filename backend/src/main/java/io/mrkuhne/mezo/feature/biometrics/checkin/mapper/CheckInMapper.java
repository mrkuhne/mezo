package io.mrkuhne.mezo.feature.biometrics.checkin.mapper;

import io.mrkuhne.mezo.feature.biometrics.checkin.dto.CheckInResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface CheckInMapper {
    CheckInResponse toResponse(CheckInEntity entity);
}
