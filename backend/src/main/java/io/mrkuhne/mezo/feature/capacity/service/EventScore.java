package io.mrkuhne.mezo.feature.capacity.service;

import java.util.UUID;

/**
 * How demanding one calendar event is (Boop B7 K1): each component 0..3, {@code restores} when it gives energy back.
 * {@code source} is a {@code ScoreSource} value (llm | rule). {@code feedback}: the owner's own label that shaped the
 * score ({@code FeedbackEffect} value drains | neutral | feeds), {@code null} when he has not labelled the event.
 */
public record EventScore(UUID eventId, int mental, int social, int physical, boolean restores, String kind,
                         double confidence, String source, String feedback) {

    /** An unlabelled score. */
    public EventScore(UUID eventId, int mental, int social, int physical, boolean restores, String kind,
                      double confidence, String source) {
        this(eventId, mental, social, physical, restores, kind, confidence, source, null);
    }
}
