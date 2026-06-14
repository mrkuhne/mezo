package io.mrkuhne.mezo.feature.train.mapper;

import io.mrkuhne.mezo.api.dto.RunSessionLogResponse;
import io.mrkuhne.mezo.api.dto.RunningBlockResponse;
import io.mrkuhne.mezo.api.dto.RunningBlockStructureDto;
import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Entity → generated {@code api.dto} mapper for the Futás (running) slice. Mirrors
 * {@link TrainMapper}: the lowercase {@code String} status maps to the generated enum via
 * {@code fromValue}, and the typed-jsonb {@link RunningBlockStructure} record tree round-trips
 * field-for-field with {@link RunningBlockStructureDto} (same names/types both sides).
 */
@Mapper(componentModel = "spring")
public interface RunningMapper {

    @Mapping(target = "status",
        expression = "java(RunningBlockResponse.StatusEnum.fromValue(entity.getStatus()))")
    RunningBlockResponse toResponse(RunningBlockEntity entity);

    RunSessionLogResponse toResponse(RunSessionLogEntity entity);

    RunningBlockStructure toEntityStructure(RunningBlockStructureDto dto);

    RunningBlockStructureDto toDtoStructure(RunningBlockStructure structure);
}
