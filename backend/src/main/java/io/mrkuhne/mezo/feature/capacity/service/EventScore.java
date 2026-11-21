package io.mrkuhne.mezo.feature.capacity.service;

import java.util.UUID;

/**
 * How demanding one calendar event is (Boop B7 K1): each component 0..3, {@code restores} when it gives energy back.
 * {@code source} is a {@code ScoreSource} value (llm | rule).
 */
public record EventScore(UUID eventId, int mental, int social, int physical, boolean restores, String kind,
                         double confidence, String source) {
}
