package io.mrkuhne.mezo.feature.train.entity.json;

import java.util.List;

/**
 * A single template day, persisted verbatim inside {@code meso_template.days} — mirrors the
 * contract's {@code MesoDayInput} schema field-for-field.
 *
 * <p>The compact constructor keeps the stored document well-formed for the two fields the
 * contract's {@code MesoDay} marks required but {@code MesoDayInput} allows to be omitted (a rest
 * day carries neither): {@code muscle} defaults to {@code ""} and {@code exercises} to an empty
 * list — the same coercion {@code TrainService.stampRun} applies to the run's rows. It runs on
 * every construction path (mapper, hand-rolled rerun materialization, Jackson's record
 * deserialization), so even a document written before this rule reads back well-formed.
 */
public record MesoDayJson(
    String day,
    String type,
    String muscle,
    Boolean muscleAccent,
    String note,
    List<GymExerciseJson> exercises
) {
    public MesoDayJson {
        muscle = muscle != null ? muscle : "";
        exercises = exercises != null ? List.copyOf(exercises) : List.of();
    }
}
