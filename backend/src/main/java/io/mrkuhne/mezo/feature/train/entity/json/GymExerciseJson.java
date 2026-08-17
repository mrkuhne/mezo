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
    UUID catalogId
) {}
