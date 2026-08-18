package io.mrkuhne.mezo.feature.train.mapper;

import io.mrkuhne.mezo.api.dto.MesoContext;
import io.mrkuhne.mezo.api.dto.MesoContextTotals;
import io.mrkuhne.mezo.api.dto.MesoContextWeek;
import io.mrkuhne.mezo.api.dto.MesoRecordHighlight;
import io.mrkuhne.mezo.api.dto.MesoReportAdherence;
import io.mrkuhne.mezo.api.dto.MesoReportRecords;
import io.mrkuhne.mezo.api.dto.MesoStrengthDelta;
import io.mrkuhne.mezo.api.dto.MesocycleVolumeArcResponse;
import io.mrkuhne.mezo.api.dto.MuscleVolumeArc;
import io.mrkuhne.mezo.api.dto.VolumeArcWeek;
import io.mrkuhne.mezo.feature.train.entity.json.MesoContextJson;
import io.mrkuhne.mezo.feature.train.entity.json.MesoReportJson;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * The close report's jsonb snapshot ↔ contract mapper (mezo-meyc.2). Two directions, both
 * mechanical:
 *
 * <ul>
 *   <li><b>IN</b> — {@link MesocycleVolumeArcResponse} → {@link MesoReportJson.VolumeArcJson}: the
 *       live {@code VolumeArcService.arc(...)} output is frozen verbatim into the report row, so a
 *       historical report survives any later engine change.</li>
 *   <li><b>OUT</b> — the stored records → the generated {@code api.dto} models the report endpoint
 *       returns.</li>
 * </ul>
 *
 * <p>The stored side keeps {@code status}/{@code phase}/{@code phaseCurve} as plain strings (the
 * loosely-typed jsonb idiom of {@code MesoTemplateEntity.phaseCurve}), so every enum crossing needs
 * an explicit {@code fromValue()}/{@code getValue()} expression — MapStruct's default String→enum
 * conversion is {@code Enum.valueOf()}, which would throw on the contract's mixed-case tokens
 * ({@code Deload}, {@code active}).
 */
@Mapper(componentModel = "spring")
public interface MesoReportMapper {

    // ── freeze: live arc response → stored jsonb ────────────────────────────────

    @Mapping(target = "status", expression = "java(arc.getStatus().getValue())")
    @Mapping(target = "phaseCurve", expression = "java(phaseCurveJson(arc.getPhaseCurve()))")
    MesoReportJson.VolumeArcJson toArcJson(MesocycleVolumeArcResponse arc);

    MesoReportJson.VolumeArcJson.MuscleVolumeArc toMuscleArcJson(MuscleVolumeArc muscle);

    @Mapping(target = "phase", expression = "java(week.getPhase().getValue())")
    MesoReportJson.VolumeArcJson.VolumeArcWeek toArcWeekJson(VolumeArcWeek week);

    // ── read back: stored jsonb → contract ─────────────────────────────────────

    @Mapping(target = "status",
        expression = "java(MesocycleVolumeArcResponse.StatusEnum.fromValue(json.status()))")
    @Mapping(target = "phaseCurve", expression = "java(phaseCurve(json.phaseCurve()))")
    MesocycleVolumeArcResponse toArc(MesoReportJson.VolumeArcJson json);

    MuscleVolumeArc toMuscleArc(MesoReportJson.VolumeArcJson.MuscleVolumeArc json);

    @Mapping(target = "phase", expression = "java(VolumeArcWeek.PhaseEnum.fromValue(json.phase()))")
    VolumeArcWeek toArcWeek(MesoReportJson.VolumeArcJson.VolumeArcWeek json);

    MesoReportAdherence toAdherence(MesoReportJson.Adherence json);

    List<MesoStrengthDelta> toStrength(List<MesoReportJson.StrengthDelta> json);

    MesoStrengthDelta toStrengthDelta(MesoReportJson.StrengthDelta json);

    MesoReportRecords toRecords(MesoReportJson.Records json);

    MesoRecordHighlight toHighlight(MesoReportJson.RecordHighlight json);

    /** Null until S3 fills the context snapshot — the contract declares it nullable for that. */
    MesoContext toContext(MesoContextJson json);

    MesoContextWeek toContextWeek(MesoContextJson.Week json);

    MesoContextTotals toContextTotals(MesoContextJson.Totals json);

    default List<String> phaseCurveJson(List<MesocycleVolumeArcResponse.PhaseCurveEnum> curve) {
        return curve == null ? List.of()
            : curve.stream().map(MesocycleVolumeArcResponse.PhaseCurveEnum::getValue).toList();
    }

    default List<MesocycleVolumeArcResponse.PhaseCurveEnum> phaseCurve(List<String> curve) {
        return curve == null ? List.of()
            : curve.stream().map(MesocycleVolumeArcResponse.PhaseCurveEnum::fromValue).toList();
    }
}
