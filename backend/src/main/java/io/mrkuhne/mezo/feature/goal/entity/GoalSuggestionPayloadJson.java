package io.mrkuhne.mezo.feature.goal.entity;

import java.util.UUID;

/**
 * Typed body of a {@link GoalSuggestionEntity}, persisted as the {@code payload} jsonb column
 * (app-ObjectMapper serialized via {@code @JdbcTypeCode(SqlTypes.JSON)}, the
 * {@code GoalPrescriptionJson} idiom). A {@code phase_change} carries EITHER
 * {@code suggestedTrajectory} (meso preset ↔ goal trajectory mismatch) OR
 * {@code balanceOverrideKcal}+{@code fromWeek}+{@code toWeek} (deload → maintenance-leaning week).
 * {@code snapshotTrajectory} is the accept-time race guard: the goal's trajectory at proposal
 * time — a mismatch at accept means the goal changed underneath and the suggestion is stale.
 */
public record GoalSuggestionPayloadJson(
    String reason,               // Hungarian, user-facing
    String suggestedTrajectory,  // cut|bulk|maintain, nullable
    Integer balanceOverrideKcal, // kcal/day override (0 = maintenance), nullable
    Integer fromWeek,            // goal-week span of the override, nullable
    Integer toWeek,
    UUID mesoId,                 // the triggering mesocycle, nullable
    String mesoTitle,
    String snapshotTrajectory    // race guard, never null
) {
}
