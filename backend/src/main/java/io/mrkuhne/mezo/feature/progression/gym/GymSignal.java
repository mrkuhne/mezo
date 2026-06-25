package io.mrkuhne.mezo.feature.progression.gym;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

/**
 * The progression-relevant signal extracted from one completed gym instance.
 * volumeByMuscle: Σ(weight×reps) per muscle token (whole kg). bestE1rm: max Epley over weighted
 * sets (null if the instance had no weighted set). workSetCount/bodyweightRepCount drive
 * strength_endurance / bodyweight XP.
 */
public record GymSignal(
    UUID instanceId,
    Map<String, Long> volumeByMuscle,
    BigDecimal bestE1rm,
    int workSetCount,
    int bodyweightRepCount
) {}
