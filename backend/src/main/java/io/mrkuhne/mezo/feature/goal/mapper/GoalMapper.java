package io.mrkuhne.mezo.feature.goal.mapper;

import io.mrkuhne.mezo.api.dto.GoalFeasibility;
import io.mrkuhne.mezo.api.dto.GoalGuardStatus;
import io.mrkuhne.mezo.api.dto.GoalMuscleGuardStatus;
import io.mrkuhne.mezo.api.dto.GoalPrescription;
import io.mrkuhne.mezo.api.dto.GoalPrescriptionSegment;
import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.api.dto.GoalStrengthGuardStatus;
import io.mrkuhne.mezo.api.dto.TdeeBootstrap;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Entity -> {@link GoalResponse}. The entity stores {@code trajectory}/{@code status} as plain
 * {@code String} and {@code guards} as {@code List<String>}; the generated DTO uses inner enums, so
 * each is converted explicitly via the enum's {@code fromValue(String)}. MapStruct cannot auto-map
 * {@code List<String>} -> {@code List<Enum>}, hence the {@code toGuardEnums} default method.
 *
 * <p>The engine outputs {@code tdeeBootstrap}/{@code prescription} are typed jsonb records
 * ({@link TdeeBootstrapJson}/{@link GoalPrescriptionJson}); they are projected to the contract DTOs
 * by the {@code toTdee*}/{@code toPrescription*} default methods, which convert the record's plain
 * {@code String} enum fields ({@code formula}, {@code basis}, {@code verdict}) to the DTO enums.
 * Both are nullable until the goal is evaluated.
 */
@Mapper(componentModel = "spring")
public interface GoalMapper {

    @Mapping(target = "trajectory",
        expression = "java(GoalResponse.TrajectoryEnum.fromValue(entity.getTrajectory()))")
    @Mapping(target = "status",
        expression = "java(GoalResponse.StatusEnum.fromValue(entity.getStatus()))")
    @Mapping(target = "guards",
        expression = "java(toGuardEnums(entity.getGuards()))")
    @Mapping(target = "tdeeBootstrap",
        expression = "java(toTdeeBootstrap(entity.getTdeeBootstrap()))")
    @Mapping(target = "prescription",
        expression = "java(toPrescription(entity.getPrescription()))")
    GoalResponse toResponse(GoalEntity entity);

    default List<GoalResponse.GuardsEnum> toGuardEnums(List<String> guards) {
        return guards == null ? List.of()
            : guards.stream().map(GoalResponse.GuardsEnum::fromValue).toList();
    }

    default TdeeBootstrap toTdeeBootstrap(TdeeBootstrapJson j) {
        if (j == null) {
            return null;
        }
        return TdeeBootstrap.builder()
            .bmr(j.bmr())
            .tdee(j.tdee())
            .pal(j.pal())
            .formula(j.formula() == null ? null : TdeeBootstrap.FormulaEnum.fromValue(j.formula()))
            .computedAt(j.computedAt())
            .build();
    }

    default GoalPrescription toPrescription(GoalPrescriptionJson j) {
        if (j == null) {
            return null;
        }
        return GoalPrescription.builder()
            .generatedAt(j.generatedAt())
            .basis(j.basis() == null ? null : GoalPrescription.BasisEnum.fromValue(j.basis()))
            .segments(toSegments(j.segments()))
            .guardStatus(toGuardStatus(j.guardStatus()))
            .feasibility(toFeasibility(j.feasibility()))
            .build();
    }

    default List<GoalPrescriptionSegment> toSegments(List<GoalPrescriptionJson.Segment> segments) {
        if (segments == null) {
            return List.of();
        }
        return segments.stream().map(s -> GoalPrescriptionSegment.builder()
            .fromWeek(s.fromWeek())
            .toWeek(s.toWeek())
            .label(s.label())
            .kcal(s.kcal())
            .proteinG(s.proteinG())
            .sleepTargetH(s.sleepTargetH())
            .restDays(s.restDays() == null ? List.of() : s.restDays())
            .projectedRateKgPerWk(s.projectedRateKgPerWk())
            .rationale(s.rationale())
            .build()).toList();
    }

    default GoalGuardStatus toGuardStatus(GoalPrescriptionJson.GuardStatus g) {
        if (g == null) {
            return null;
        }
        return GoalGuardStatus.builder()
            .strength(toStrengthGuard(g.strength()))
            .muscle(toMuscleGuard(g.muscle()))
            .build();
    }

    default GoalStrengthGuardStatus toStrengthGuard(GoalPrescriptionJson.GuardStatus.Strength s) {
        if (s == null) {
            return null;
        }
        return GoalStrengthGuardStatus.builder()
            .active(s.active())
            .e1rmTrendPct(s.e1rmTrendPct())
            .breached(s.breached())
            .notes(s.notes() == null ? List.of() : s.notes())
            .build();
    }

    default GoalMuscleGuardStatus toMuscleGuard(GoalPrescriptionJson.GuardStatus.Muscle m) {
        if (m == null) {
            return null;
        }
        return GoalMuscleGuardStatus.builder()
            .active(m.active())
            .minWeeklySetsPerMuscle(m.minWeeklySetsPerMuscle())
            .belowMaintenanceMuscles(
                m.belowMaintenanceMuscles() == null ? List.of() : m.belowMaintenanceMuscles())
            .rateWithinCap(m.rateWithinCap())
            .proteinMonitored(m.proteinMonitored())
            .notes(m.notes() == null ? List.of() : m.notes())
            .build();
    }

    default GoalFeasibility toFeasibility(GoalPrescriptionJson.Feasibility f) {
        if (f == null) {
            return null;
        }
        return GoalFeasibility.builder()
            .verdict(f.verdict() == null ? null : GoalFeasibility.VerdictEnum.fromValue(f.verdict()))
            .notes(f.notes() == null ? List.of() : f.notes())
            .build();
    }
}
