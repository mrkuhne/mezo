package io.mrkuhne.mezo.feature.biometrics.weight.mapper;

import io.mrkuhne.mezo.feature.biometrics.weight.dto.WeightLogResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface WeightLogMapper {
    @Mapping(target = "value", source = "weightKg")
    WeightLogResponse toResponse(WeightLogEntity entity);
}
