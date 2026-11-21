package io.mrkuhne.mezo.feature.capacity.entity;

import java.util.Optional;

/** How the owner says an event felt (Boop B7 K1, mezo-r36n9.17): stored as {@link #value()}. */
public enum FeedbackEffect {
    DRAINS("drains"),
    NEUTRAL("neutral"),
    FEEDS("feeds");

    private final String value;

    FeedbackEffect(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static Optional<FeedbackEffect> of(String value) {
        for (FeedbackEffect e : values()) {
            if (e.value.equals(value)) {
                return Optional.of(e);
            }
        }
        return Optional.empty();
    }
}
