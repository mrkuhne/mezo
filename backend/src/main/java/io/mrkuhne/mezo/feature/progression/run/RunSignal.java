package io.mrkuhne.mezo.feature.progression.run;

import java.util.List;
import java.util.UUID;

/**
 * Progression-relevant signal from one logged run session. kind (sprint|pyramid|steady) comes from
 * the prescribed session in the block structure; the metric fields are the logged actuals (any may
 * be null). pyramid shares the sprint skill set, but is scored against its own prescription — see
 * {@code prescribedWorkSecs}.
 *
 * @param prescribedWorkSecs the prescribed work-segment durations, in plan order, for a session
 *     whose segments enumerate every round individually (today: {@code pyramid}); {@code null} for
 *     every other kind. A sprint's segments are a single work/rest template repeated
 *     {@code rounds} times, so they are NOT a per-round enumeration and are not carried here.
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
    Integer hrRecoverySec,
    List<Integer> prescribedWorkSecs
) {}
