package io.mrkuhne.mezo.feature.progression.run;

import java.util.UUID;

/**
 * Progression-relevant signal from one logged run session. kind (sprint|pyramid|steady) comes from
 * the prescribed session in the block structure; the metric fields are the logged actuals (any may
 * be null). pyramid is treated as sprint for scoring.
 */
public record RunSignal(
    UUID logId,
    String kind,
    Integer completedRounds,
    Integer durationMin,
    Integer rpeActual,
    String sprintLandmark,
    Integer hrRecoverySec
) {}
