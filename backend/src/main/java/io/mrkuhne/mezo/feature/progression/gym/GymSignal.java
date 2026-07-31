package io.mrkuhne.mezo.feature.progression.gym;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

/**
 * The progression-relevant signal extracted from one completed gym instance.
 * volumeByMuscle: Σ(weight×reps) per muscle token (whole kg). bestE1rm: max Epley over weighted
 * sets (null if the instance had no weighted set). workSetCount/bodyweightRepCount drive
 * strength_endurance / bodyweight XP. recordMedalCount/targetMedalCount are the RECORD-tier and
 * TARGET-tier medals earned inside this session, driving the max_strength PR bonus and the
 * strength_endurance target bonus respectively.
 */
public record GymSignal(
    UUID instanceId,
    Map<String, Long> volumeByMuscle,
    BigDecimal bestE1rm,
    int workSetCount,
    int bodyweightRepCount,
    /** RECORD-tier medals earned in this session — each pays prBonusXp into max_strength. */
    int recordMedalCount,
    /** TARGET_HIT medals earned in this session — capped, pays into strength_endurance. */
    int targetMedalCount
) {}
