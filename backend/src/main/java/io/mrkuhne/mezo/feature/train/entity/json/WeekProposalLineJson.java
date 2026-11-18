package io.mrkuhne.mezo.feature.train.entity.json;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * One changed exercise inside a weekly volume proposal (spec §6.4). {@code kind} is
 * {@code "sets" | "weight" | "reps"}; {@code decision} is {@code null | "accepted" | "kept"}.
 * {@code dayName} is the template day's label; {@code fromKg}/{@code toKg} carry a weight line's
 * load (null for sets and reps). The last three were added in S3 — rows stored before read them as null.
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
    BigDecimal toKg) {

    /** {@code kind} of a set-count line. */
    public static final String KIND_SETS = "sets";
    /** {@code decision} values ({@code null} = undecided). */
    public static final String DECISION_ACCEPTED = "accepted";
    public static final String DECISION_KEPT = "kept";

    /** The same line with {@code decision} set. */
    public WeekProposalLineJson withDecision(String newDecision) {
        return new WeekProposalLineJson(id, exerciseId, exerciseName, dayIndex, muscleGroup, kind, from, to,
            reasons, newDecision, dayName, fromKg, toKg);
    }
}
