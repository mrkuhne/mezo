package io.mrkuhne.mezo.feature.train.mapper;

import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.api.dto.ExerciseSetResponse;
import io.mrkuhne.mezo.api.dto.GymExercise;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.GymScheduleSlotResponse;
import io.mrkuhne.mezo.api.dto.MesoDay;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.SportEventResponse;
import io.mrkuhne.mezo.api.dto.SportScheduleSlotResponse;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.VolumeBaseline;
import io.mrkuhne.mezo.api.dto.VolumeProfile;
import io.mrkuhne.mezo.api.dto.VolumeRecompute;
import io.mrkuhne.mezo.api.dto.WorkoutSummaryResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoTemplateEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.SportEventEntity;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.json.GymExerciseJson;
import io.mrkuhne.mezo.feature.train.entity.json.MesoDayJson;
import io.mrkuhne.mezo.feature.train.entity.json.VolumeBaselineJson;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
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

    @Mapping(target = "type", expression = "java(ExerciseCatalogItem.TypeEnum.fromValue(entity.getType()))")
    @Mapping(target = "editable", ignore = true)
    @Mapping(target = "mediaEditable", ignore = true)
    @Mapping(target = "authoredByMe", ignore = true)
    @Mapping(target = "authorName", ignore = true)
    ExerciseCatalogItem toCatalogItem(ExerciseCatalogEntity entity);

    @Mapping(target = "duration", source = "durationMin")
    SportSessionResponse toResponse(SportSessionEntity entity);

    @Mapping(target = "kind",
        expression = "java(SportScheduleSlotResponse.KindEnum.fromValue(entity.getKind()))")
    SportScheduleSlotResponse toSlotResponse(SportScheduleSlotEntity entity);

    @Mapping(target = "kind",
        expression = "java(SportEventResponse.KindEnum.fromValue(entity.getKind()))")
    SportEventResponse toEventResponse(SportEventEntity entity);

    GymScheduleSlotResponse toGymSlotResponse(GymScheduleSlotEntity entity);

    // setIndex needs an explicit source mapping: the generated builder's `setIndex(Integer)` method
    // IS the field's fluent accessor, but MapStruct's builder introspection parses any method
    // starting with lowercase "set" as a classic JavaBean setter and strips the prefix — so it sees
    // the target property as "index", not "setIndex". Left implicit, MapStruct silently drops the
    // field instead of mapping it (mezo-l3on: caught by the delete+renumber IT asserting the
    // response setIndex).
    @Mapping(target = "index", source = "setIndex")
    @Mapping(target = "kind", expression = "java(ExerciseSetResponse.KindEnum.fromValue(entity.getKind()))")
    @Mapping(target = "medals", ignore = true)
    ExerciseSetResponse toSetResponse(ExerciseSetEntity entity);

    @Mapping(target = "targetRIR", source = "targetRir")
    @Mapping(target = "type", expression = "java(TodayExercise.TypeEnum.fromValue(entity.getType()))")
    @Mapping(target = "lastWeek", ignore = true)
    @Mapping(target = "prescribedSets", ignore = true)
    @Mapping(target = "rationale", ignore = true)
    @Mapping(target = "progression", ignore = true)
    TodayExercise toTodayExercise(ExerciseEntity entity);

    @Mapping(target = "status", expression = "java(WorkoutSummaryResponse.StatusEnum.fromValue(entity.getStatus()))")
    // origin needs the same fromValue() treatment as status: MapStruct's default String->enum
    // conversion calls Enum.valueOf() (matches constant NAMES), which throws for the lowercase
    // 'meso'/'custom' DB values against the MESO/CUSTOM constants (mezo-ws2x).
    @Mapping(target = "origin", expression = "java(WorkoutSummaryResponse.OriginEnum.fromValue(entity.getOrigin()))")
    @Mapping(target = "title", source = "type")
    WorkoutSummaryResponse toWorkoutSummary(WorkoutSessionEntity entity);

    VolumeRecompute toRecompute(VolumeRecomputeJson json);

    // ── meso template (mezo-meyc.1): plan document ↔ jsonb ↔ contract ─────────────────────────
    // A template's days/volumePerMuscle live as typed jsonb records, so the same plan travels three
    // ways: OUT to the client (MesoDay/VolumeBaseline), IN from the wizard (MesoDayInput/
    // VolumeBaseline) and ACROSS to the run stamper (MesoDayInput again — TrainService.stampRun
    // reuses the wizard input shape, so it never learns about the template's storage records).

    /** runCount needs a run-count query, so the service stitches it onto the mapped response. */
    @Mapping(target = "phaseCurve", expression = "java(templatePhaseCurve(entity.getPhaseCurve()))")
    @Mapping(target = "runCount", ignore = true)
    MesoTemplateResponse toTemplateResponse(MesoTemplateEntity entity);

    /**
     * A template day has no {@code workout_session} row yet — {@code id}/{@code current} stay null.
     * {@code muscle}/{@code exercises} are guaranteed non-null by {@link MesoDayJson}'s compact
     * constructor, so the required response fields are always well-formed.
     */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "current", ignore = true)
    @Mapping(target = "exerciseCount", expression = "java(json.exercises().size())")
    MesoDay toDay(MesoDayJson json);

    /** {@code id} is the recipe's stored identity (see {@link GymExerciseJson}); media is run-side only. */
    @Mapping(target = "targetRIR", source = "targetRir")
    @Mapping(target = "type", expression = "java(GymExercise.TypeEnum.fromValue(json.type()))")
    @Mapping(target = "videoUrl", ignore = true)
    @Mapping(target = "imageStartUrl", ignore = true)
    @Mapping(target = "imageEndUrl", ignore = true)
    GymExercise toGymExercise(GymExerciseJson json);

    List<MesoDayJson> toDaysJson(List<MesoDayInput> days);

    MesoDayJson toDayJson(MesoDayInput input);

    /**
     * The wizard never sends a recipe id, so every create/update mints a fresh one — the plan
     * document owns its exercise identities, and a full-replace update legitimately renews them.
     */
    @Mapping(target = "id", expression = "java(java.util.UUID.randomUUID())")
    @Mapping(target = "targetRir", source = "targetRIR")
    @Mapping(target = "type", expression = "java(input.getType().getValue())")
    GymExerciseJson toExerciseJson(GymExerciseInput input);

    /**
     * Run rows → stored recipe (the rerun path materializes a template out of a legacy run); the
     * recipe's {@code id} is that run's {@code exercise} row id.
     */
    List<GymExerciseJson> toExercisesJson(List<ExerciseEntity> exercises);

    GymExerciseJson toExerciseJson(ExerciseEntity entity);

    List<MesoDayInput> toDayInputs(List<MesoDayJson> days);

    MesoDayInput toDayInput(MesoDayJson json);

    /**
     * Stamping direction: {@code GymExerciseInput} deliberately has no id, so the template's recipe
     * ids can never leak into the run — its {@code exercise} rows get their own generated PKs.
     */
    @Mapping(target = "targetRIR", source = "targetRir")
    @Mapping(target = "type", expression = "java(GymExerciseInput.TypeEnum.fromValue(json.type()))")
    GymExerciseInput toExerciseInput(GymExerciseJson json);

    Map<String, VolumeBaseline> toBaselines(Map<String, VolumeBaselineJson> volumePerMuscle);

    Map<String, VolumeBaselineJson> toBaselinesJson(Map<String, VolumeBaseline> volumePerMuscle);

    VolumeBaseline toBaseline(VolumeBaselineJson json);

    VolumeBaselineJson toBaselineJson(VolumeBaseline baseline);

    default List<MesocycleResponse.PhaseCurveEnum> phaseCurve(List<String> curve) {
        return curve.stream().map(MesocycleResponse.PhaseCurveEnum::fromValue).toList();
    }

    default List<MesoTemplateResponse.PhaseCurveEnum> templatePhaseCurve(List<String> curve) {
        return curve.stream().map(MesoTemplateResponse.PhaseCurveEnum::fromValue).toList();
    }

    /** Entity stores Instant; the generated contract type uses OffsetDateTime (UTC on the wire either way). */
    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
