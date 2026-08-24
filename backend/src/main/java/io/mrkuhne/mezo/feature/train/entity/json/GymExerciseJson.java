package io.mrkuhne.mezo.feature.train.entity.json;

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
    Boolean countsTowardVolume
) {
    /**
     * Documents written before mezo-gbo7 carry no {@code countsTowardVolume}; Jackson hands us null
     * for them. Default it to TRUE here — on every construction path (mapper, hand-rolled rerun
     * materialization, Jackson) — so the volume math never has to null-check, mirroring the
     * coercion {@link MesoDayJson} applies to its own optional fields.
     */
    public GymExerciseJson {
        countsTowardVolume = countsTowardVolume == null || countsTowardVolume;
    }
}
