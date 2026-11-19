package io.mrkuhne.mezo.feature.train.entity.json;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * One changed exercise inside a weekly volume proposal (spec §6.4). {@code kind} is
 * {@code "sets" | "weight" | "reps"}; {@code decision} is {@code null | "accepted" | "kept"}.
 * {@code dayName} is the template day's label; {@code fromKg}/{@code toKg} carry a weight line's
 * load (null for sets and reps). {@code dayName}/{@code fromKg}/{@code toKg} were added in S3, the last seven
 * (technique wire values, challenge flag, rep bounds) in T3 — rows stored before read them as null.
 */
public record WeekProposalLineJson(
    String id,
    UUID exerciseId,
    String exerciseName,
    int dayIndex,
    String muscleGroup,
    String kind,
    Integer from,
    Integer to,
    List<String> reasons,
    String decision,
    String dayName,
    BigDecimal fromKg,
    BigDecimal toKg,
    String fromTechnique,
    String toTechnique,
    Boolean challenge,
    Integer fromRepMin,
    Integer fromRepMax,
    Integer toRepMin,
    Integer toRepMax) {

    /** {@code kind} of a set-count line. */
    public static final String KIND_SETS = "sets";
    /** {@code kind} of a technique line (T3). */
    public static final String KIND_TECHNIQUE = "technique";
    /** {@code kind} of a rep-range line (T3). */
    public static final String KIND_REP_RANGE = "rep_range";
    /** {@code decision} values ({@code null} = undecided). */
    public static final String DECISION_ACCEPTED = "accepted";
    public static final String DECISION_KEPT = "kept";

    /** The same line with {@code decision} set. */
    public WeekProposalLineJson withDecision(String newDecision) {
        return new WeekProposalLineJson(id, exerciseId, exerciseName, dayIndex, muscleGroup, kind, from, to,
            reasons, newDecision, dayName, fromKg, toKg,
            fromTechnique, toTechnique, challenge, fromRepMin, fromRepMax, toRepMin, toRepMax);
    }
}
