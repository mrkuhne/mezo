package io.mrkuhne.mezo.feature.biometrics.sleep.mapper;

import io.mrkuhne.mezo.api.dto.Hypnogram;
import io.mrkuhne.mezo.api.dto.SleepLogResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepHypnogram;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface SleepLogMapper {
    @Mapping(target = "duration", source = "durationH")
    @Mapping(target = "mealToSleep", constant = "0")
    SleepLogResponse toResponse(SleepLogEntity entity);

    /** Entity record -> generated API model. Explicit so the jsonb field can never be
     *  silently dropped if the generator's model shape changes. */
    default Hypnogram map(SleepHypnogram h) {
        return h == null ? null
            : Hypnogram.builder().bucketMin(h.bucketMin()).stages(h.stages()).build();
    }
}
