package io.mrkuhne.mezo.feature.train.service;

import java.util.UUID;

/**
 * Consumer-owned port (ADR 0012): train's schedule mutations must trigger a goal-prescription
 * recompute (the weekly EAT is derived from the SCHEDULE, so a schedule edit otherwise leaves a
 * stale prescription — mezo-3g5w), but goal → train already exists
 * ({@code WeeklyScheduledActivityService}), so a direct train → goal import would close a new
 * slice cycle. Train owns this seam; the goal slice provides the adapter.
 */
public interface GoalRecomputePort {

    /** Recompute the owner's active goal, if any — must be graceful (no goal → no-op, never throw). */
    void recomputeActiveGoal(UUID userId);
}
