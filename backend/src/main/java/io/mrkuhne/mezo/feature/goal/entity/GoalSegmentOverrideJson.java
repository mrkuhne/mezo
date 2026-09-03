package io.mrkuhne.mezo.feature.goal.entity;

/**
 * One accepted per-week energy-balance override on the goal ({@code goal.segment_overrides}
 * jsonb array element). The projection engine substitutes {@code balanceKcal} for the goal's
 * formula energy balance in every goal-week within [fromWeek, toWeek] — the "deload week eats
 * at maintenance" mechanism (spec §6.5). Weeks are goal-week indices (1-based), matching
 * {@code GoalPrescriptionJson.Segment}.
 */
public record GoalSegmentOverrideJson(Integer fromWeek, Integer toWeek, Integer balanceKcal) {
}
