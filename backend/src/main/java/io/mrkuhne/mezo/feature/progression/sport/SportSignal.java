package io.mrkuhne.mezo.feature.progression.sport;

import java.util.UUID;

/** Raw sport metrics resolved from a saved sport_session row; XP math lives in ProgressionService. */
public record SportSignal(
    UUID sessionId, String kind, Integer durationMin, Integer setsPlayed, Integer rounds, Integer rpe) {}
