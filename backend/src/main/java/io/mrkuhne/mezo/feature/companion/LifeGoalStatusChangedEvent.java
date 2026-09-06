package io.mrkuhne.mezo.feature.companion;

import java.util.UUID;

/**
 * Published by {@code LifeGoalService.changeStatus} (mezo-iizd.11 — final review Finding 2) on
 * every life-goal status transition. Lives in {@code companion}, not {@code lifegoal}, on purpose:
 * the {@link LifeGoalGraphSource} port sits here for the exact same reason (companion cannot import
 * lifegoal — ArchUnit {@code feature_slices_are_cycle_free}), and an event class is just a
 * one-field port. {@code lifegoal} already legally imports {@code companion} (it implements
 * {@link LifeGoalGraphSource}), so publishing this from {@code LifeGoalService} adds no new
 * dependency edge.
 *
 * <p>Consumed by {@code GraphPromotionListener}'s AFTER_COMMIT + {@code @Async} hook, the same
 * idiom as every other promotion trigger (see that class's javadoc): the immediate graph sync runs
 * OUTSIDE the status-change transaction, so a graph failure can never roll back or 500 the user's
 * own status change. Doing this synchronously inside {@code changeStatus}'s own
 * {@code @Transactional} — the original shape — meant a {@code GraphPromotionService} exception
 * (or the nested LLM-bearing edge-structuring it triggers) would have taken the goal's own status
 * write down with it.
 */
public record LifeGoalStatusChangedEvent(UUID userId, UUID goalId) {
}
