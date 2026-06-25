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
    // reserved: plumbed through but not yet consumed by applyRun (sprint scores off rounds + RPE);
    // kept for a future sprint-scoring refinement that weights the landmark distance.
    String sprintLandmark,
    Integer hrRecoverySec
) {}
