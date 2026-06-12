package io.mrkuhne.mezo.feature.train.mapper;

import io.mrkuhne.mezo.api.dto.ExerciseSetResponse;
import io.mrkuhne.mezo.api.dto.GymExercise;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.VolumeProfile;
import io.mrkuhne.mezo.api.dto.VolumeRecompute;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Entity → generated {@code api.dto} mapper for the Train slice. The nested aggregate fields
 * ({@code volumePerMuscle}, {@code days}) are assembled in {@link
 * io.mrkuhne.mezo.feature.train.service.TrainService}; this mapper covers the flat field
 * mappings plus the typed-jsonb {@code ProvenanceEnvelope → VolumeSource} round-trip (MapStruct
 * matches the records field-for-field, so no hand-rolled provenance mapping is needed).
 */
@Mapper(componentModel = "spring")
public interface TrainMapper {

    // days/volumePerMuscle are assembled in the service; statuses to enums via generated fromValue
    @Mapping(target = "status", expression = "java(MesocycleResponse.StatusEnum.fromValue(entity.getStatus()))")
    @Mapping(target = "phaseCurve", expression = "java(phaseCurve(entity.getPhaseCurve()))")
    @Mapping(target = "volumePerMuscle", ignore = true)
    @Mapping(target = "days", ignore = true)
    MesocycleResponse toResponse(MesocycleEntity entity);

    @Mapping(target = "current", source = "currentSets")
    VolumeProfile toProfile(MuscleGroupVolumeLogEntity entity);

    @Mapping(target = "targetRIR", source = "targetRir")
    @Mapping(target = "type", expression = "java(GymExercise.TypeEnum.fromValue(entity.getType()))")
    GymExercise toGymExercise(ExerciseEntity entity);

    @Mapping(target = "duration", source = "durationMin")
    SportSessionResponse toResponse(SportSessionEntity entity);

    ExerciseSetResponse toSetResponse(ExerciseSetEntity entity);

    @Mapping(target = "targetRIR", source = "targetRir")
    @Mapping(target = "type", expression = "java(TodayExercise.TypeEnum.fromValue(entity.getType()))")
    @Mapping(target = "lastWeek", ignore = true)
    TodayExercise toTodayExercise(ExerciseEntity entity);

    VolumeRecompute toRecompute(VolumeRecomputeJson json);

    default List<MesocycleResponse.PhaseCurveEnum> phaseCurve(List<String> curve) {
        return curve.stream().map(MesocycleResponse.PhaseCurveEnum::fromValue).toList();
    }
}
