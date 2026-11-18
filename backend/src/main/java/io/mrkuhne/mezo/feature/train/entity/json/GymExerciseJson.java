package io.mrkuhne.mezo.feature.train.entity.json;

import java.util.List;
import java.util.UUID;

/**
 * A single template exercise, persisted verbatim inside a {@link MesoDayJson}'s {@code exercises}
 * array — mirrors the contract's {@code GymExerciseInput} schema field-for-field, plus an
 * {@code id}.
 *
 * <p>{@code id} is the recipe's STABLE identity inside the plan document (the contract's
 * {@code GymExercise.id} is required, and the template editor keys rows by it). The wizard never
 * sends one, so it is server-synthesized on every create/update; a template materialized out of a
 * legacy run reuses that run's {@code exercise} row ids. It is NOT a foreign key: starting a run
 * inserts fresh {@code exercise} rows with their own generated PKs.
 */
public record GymExerciseJson(
    UUID id,
    String name,
    String muscle,
    Integer warmupSets,
    Integer workingSets,
    Integer repMin,
    Integer repMax,
    Integer targetRir,
    Double anchorWeightKg,
    String type,
    String warning,
    UUID catalogId,
    Boolean countsTowardVolume,
    String trainingStyle,        // wire value (balanced|volume|heavy|allout) or null (mezo-r36n9.79)
    Integer restSec,             // stamped rest seconds, null when unstyled
    List<String> overrides,      // repRange|workingSets|targetRir|restSec the stamper must keep
    String technique,            // wire value (none|rest_drop|drop|myo|partials) or null (mezo-r36n9.80)
    String techniqueSource,      // owner|planner|ai or null
    Boolean challenge            // partials-challenge flag; null in old documents
) {
    /**
     * Documents written before mezo-gbo7 carry no {@code countsTowardVolume}; Jackson hands us null
     * for them. Default it here — on every construction path (mapper, hand-rolled rerun
     * materialization, Jackson) — so the volume math never has to null-check. Absent means "counts",
     * except for {@code plyo}, which defaults to exempt: this mirrors both the migration's own
     * backfill (which set existing plyo rows to {@code false}) and {@link
     * io.mrkuhne.mezo.feature.train.service.TrainService#toExerciseEntity} downstream, so a template
     * document and the live {@code exercise} row it stamps out never disagree about a plyo exercise
     * that never had the flag set explicitly.
     */
    public GymExerciseJson {
        countsTowardVolume = countsTowardVolume != null ? countsTowardVolume : !"plyo".equals(type);
    }

    /** Same exercise with the three technique fields replaced (mezo-r36n9.80). */
    public GymExerciseJson withTechnique(String technique, String techniqueSource, Boolean challenge) {
        return new GymExerciseJson(id, name, muscle, warmupSets, workingSets, repMin, repMax, targetRir,
            anchorWeightKg, type, warning, catalogId, countsTowardVolume, trainingStyle, restSec, overrides,
            technique, techniqueSource, challenge);
    }
}
