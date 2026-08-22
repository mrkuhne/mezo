package io.mrkuhne.mezo.feature.goal.service;

import java.util.UUID;

/**
 * Published by {@link GoalService} on every write that can change a goal's title or status
 * (create/update/activate/archive). Consumed by the W2.2 graph promotion listener, which keeps the
 * goal's GOAL node in sync — active goals get an active node, everything else archives its node.
 * The goal feature knows nothing about the graph: this is a one-way event, no cycle.
 */
public record GoalSavedEvent(UUID userId, UUID goalId) {
}
