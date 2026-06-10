package io.mrkuhne.mezo.feature.biometrics.sleep.mapper;

import io.mrkuhne.mezo.feature.biometrics.sleep.dto.SleepLogResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface SleepLogMapper {
    @Mapping(target = "duration", source = "durationH")
    @Mapping(target = "mealToSleep", constant = "0")
    SleepLogResponse toResponse(SleepLogEntity entity);
}
