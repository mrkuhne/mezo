package io.mrkuhne.mezo.feature.train.service;

import java.util.Map;

/** Per-muscle priority tier — picks which volume landmark is "100%" for the weekly ramp (mezo-3m5m, spec GD4). */
public enum PriorityTier {
    EMPHASIZE, GROW, MAINTAIN;

    /** Sparse-map resolve: null map, absent key, or unknown value all mean the GROW default. */
    public static PriorityTier of(Map<String, String> priorities, String muscle) {
        if (priorities == null) return GROW;
        return switch (priorities.getOrDefault(muscle, "grow")) {
            case "emphasize" -> EMPHASIZE;
            case "maintain" -> MAINTAIN;
            default -> GROW;
        };
    }

    public int ceiling(int mev, int mav, int mrv) {
        return switch (this) { case EMPHASIZE -> mrv; case GROW -> mav; case MAINTAIN -> mev; };
    }

    public boolean rampEnabled() {
        return this != MAINTAIN;
    }
}
