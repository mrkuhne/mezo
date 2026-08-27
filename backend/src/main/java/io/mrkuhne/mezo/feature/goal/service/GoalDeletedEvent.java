package io.mrkuhne.mezo.feature.goal.service;

import java.util.UUID;

/**
 * Published by {@code GoalService.deleteGoal} (bd mezo-b3pp.31). {@link GoalSavedEvent} covers
 * every write that can change a goal's title or status, and the graph's {@code syncGoal} demotes
 * a goal that merely stops being active — but a soft-deleted goal is invisible to that finder, so
 * the delete needs an event of its own or its GOAL node stays active forever.
 */
public record GoalDeletedEvent(UUID userId, UUID goalId) {
}
