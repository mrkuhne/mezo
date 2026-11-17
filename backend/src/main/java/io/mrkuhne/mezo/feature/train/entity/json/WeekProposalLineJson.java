package io.mrkuhne.mezo.feature.train.entity.json;

import java.util.List;
import java.util.UUID;

/**
 * One changed exercise inside a weekly volume proposal (spec §6.4). {@code kind} is only
 * {@code "sets"} for now; {@code decision} is {@code null | "accepted" | "kept"}.
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
    String decision) {}
