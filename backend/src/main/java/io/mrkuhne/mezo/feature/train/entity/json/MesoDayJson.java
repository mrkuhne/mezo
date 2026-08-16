package io.mrkuhne.mezo.feature.train.entity.json;

import java.util.List;

/**
 * A single template day, persisted verbatim inside {@code meso_template.days} — mirrors the
 * contract's {@code MesoDayInput} schema field-for-field.
 */
public record MesoDayJson(
    String day,
    String type,
    String muscle,
    Boolean muscleAccent,
    String note,
    List<GymExerciseJson> exercises
) {}
