package io.mrkuhne.mezo.feature.train.service;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Consumer-owned port (ADR 0012, the {@link GoalRecomputePort} pattern): the weekly volume decision
 * needs to know whether the owner is cutting, but goal → train already exists
 * ({@code WeeklyScheduledActivityService}), so a direct train → goal import would close a new slice
 * cycle. Train owns this seam; the goal slice provides the adapter. Pure read.
 */
public interface EnergyBalancePort {

    /**
     * True when the owner's active weight goal aims at losing weight on {@code date}. No active
     * goal, or any missing data → false; must be graceful (never throw).
     */
    boolean isInDeficit(UUID userId, LocalDate date);
}
