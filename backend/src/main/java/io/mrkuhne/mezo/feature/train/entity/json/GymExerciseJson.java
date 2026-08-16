package io.mrkuhne.mezo.feature.train.entity.json;

import java.util.UUID;

/**
 * A single template exercise, persisted verbatim inside a {@link MesoDayJson}'s {@code exercises}
 * array — mirrors the contract's {@code GymExerciseInput} schema field-for-field.
 */
public record GymExerciseJson(
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
