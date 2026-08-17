package io.mrkuhne.mezo.feature.train.entity.json;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * The frozen end-of-mesocycle report payload, persisted verbatim in {@code mesocycle_report.report}
 * at close time — mirrors the contract's {@code MesocycleReportResponse} computed sections
 * (adherence/volume/strength/records; the identity/date/eval fields live as plain columns on
 * {@code MesocycleReportEntity} or are read live off {@code MesocycleEntity}). Freezing these here
 * means a historical report never drifts when later data (logs, catalog edits) changes.
 */
public record MesoReportJson(
    Adherence adherence,
    VolumeArcJson volume,
    List<StrengthDelta> strength,
    Records records
) {

    /** Mirrors the contract's {@code MesoReportAdherence} schema field-for-field. */
    public record Adherence(
        Integer plannedSessions,
        Integer completedSessions,
        Integer plannedWeeks,
        Integer completedWeeks,
        Integer completionPct
    ) {}

    /** Mirrors the contract's {@code MesoStrengthDelta} schema field-for-field. */
    public record StrengthDelta(
        String exerciseName,
        UUID catalogId,
        String muscle,
        Integer firstWeek,
        Integer lastWeek,
        Double firstTopKg,
        Integer firstTopReps,
        Double lastTopKg,
        Integer lastTopReps,
        Double firstE1rm,
        Double lastE1rm,
        Double deltaKg,
        Double deltaPct
    ) {}

    /** Mirrors the contract's {@code MesoReportRecords} schema field-for-field. */
    public record Records(Integer medalCount, List<RecordHighlight> top) {}

    /** Mirrors the contract's {@code MesoRecordHighlight} schema field-for-field. */
    public record RecordHighlight(String exerciseName, String kind, LocalDate date, Double value) {}

    /**
     * Mirrors the contract's {@code MesocycleVolumeArcResponse} schema field-for-field.
     * {@code status}/{@code phase}/{@code phaseCurve} are kept as plain strings, not Java enums —
     * same loosely-typed idiom as {@code MesoTemplateEntity.phaseCurve}.
     */
    public record VolumeArcJson(
        UUID mesocycleId,
        String title,
        Integer currentWeek,
        Integer weeks,
        LocalDate startDate,
        LocalDate endDate,
        String status,
        List<String> phaseCurve,
        List<MuscleVolumeArc> muscles
    ) {

        /** Mirrors the contract's {@code MuscleVolumeArc} schema field-for-field. */
        public record MuscleVolumeArc(String muscle, String region, Integer mrv, List<VolumeArcWeek> weeks) {}

        /** Mirrors the contract's {@code VolumeArcWeek} schema field-for-field. */
        public record VolumeArcWeek(Integer week, String phase, Integer planned, Integer actual, Boolean isCurrent) {}
    }
}
