package io.mrkuhne.mezo.feature.goal.service;

import java.util.UUID;

/** A newly persisted goal suggestion that becomes visible only after its transaction commits. */
public record GoalSuggestionProposedEvent(
    UUID userId,
    UUID goalId,
    UUID suggestionId,
    String kind
) {
}
